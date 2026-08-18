"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";

import {
  formatLat,
  formatLon,
  haversineDistanceKm,
  TARGET_COORDINATES,
  TOLERANCE_KM,
  type Coordinates,
} from "./coordinates";

const VIEW_W = 1000;
const VIEW_H = 500;
const LON_STEP = 30;
const LAT_STEP = 30;

export type Guess = {
  id: number;
  coords: Coordinates;
  hit: boolean;
};

/** Deterministic wobbly blob so it renders identically on server and client. */
function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  points = 11,
): string {
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble =
      0.76 +
      0.22 * Math.sin(angle * 3 + seed) +
      0.12 * Math.sin(angle * 5 + seed * 1.7);
    coords.push([
      cx + Math.cos(angle) * rx * wobble,
      cy + Math.sin(angle) * ry * wobble,
    ]);
  }
  const first = coords[0]!;
  let d = `M ${first[0].toFixed(1)} ${first[1].toFixed(1)} `;
  for (let i = 0; i < points; i++) {
    const [x0, y0] = coords[i]!;
    const [x1, y1] = coords[(i + 1) % points]!;
    d += `Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)} `;
  }
  return `${d}Z`;
}

/** Loosely evocative of real continents — atmosphere, not cartography. */
const LANDMASSES = [
  { d: blobPath(215, 135, 95, 68, 1.3), className: "fill-nebula/16" },
  { d: blobPath(330, 300, 68, 108, 2.6), className: "fill-nebula/16" },
  { d: blobPath(552, 245, 82, 128, 4.1), className: "fill-plasma/14" },
  { d: blobPath(672, 112, 168, 92, 5.7), className: "fill-plasma/14" },
  { d: blobPath(872, 322, 62, 44, 7.2), className: "fill-signal/16" },
];

const LON_LINES = Array.from(
  { length: 360 / LON_STEP + 1 },
  (_, i) => -180 + i * LON_STEP,
);
const LAT_LINES = Array.from(
  { length: 180 / LAT_STEP + 1 },
  (_, i) => -90 + i * LAT_STEP,
);

function lonToX(lon: number): number {
  return ((lon + 180) / 360) * VIEW_W;
}

function latToY(lat: number): number {
  return ((90 - lat) / 180) * VIEW_H;
}

function signalStrength(distanceKm: number): string {
  if (distanceKm <= TOLERANCE_KM) return "LOCKED";
  if (distanceKm <= TOLERANCE_KM * 2) return "STRONG";
  if (distanceKm <= TOLERANCE_KM * 6) return "MODERATE";
  if (distanceKm <= TOLERANCE_KM * 16) return "WEAK";
  return "FAINT";
}

/**
 * Purely a display: it renders the trail of submitted guesses and animates
 * the latest one in. Submission itself happens through CoordinateForm —
 * clicking a precise lat/lon on a hand-wavy star chart isn't the point.
 */
export function StarChart({ guesses }: { guesses: Guess[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const latestGuess = guesses.length > 0 ? guesses[guesses.length - 1] : null;
  const trail = guesses.length > 1 ? guesses.slice(0, -1) : [];

  useEffect(() => {
    if (!latestGuess) return;
    const svg = svgRef.current;
    if (!svg) return;
    const marker = svg.querySelector<SVGGElement>(
      `[data-guess-id="${latestGuess.id}"]`,
    );
    if (!marker) return;

    if (latestGuess.hit) {
      animate(marker, {
        scale: [0, 1.35, 1],
        opacity: [0, 1],
        duration: 700,
        ease: "outElastic(1, .6)",
      });
    } else {
      animate(marker, {
        scale: [0, 1],
        opacity: [0, 1],
        duration: 200,
        ease: "outQuad",
      });
      animate(marker, {
        translateX: [0, -7, 7, -4, 4, 0],
        duration: 400,
        delay: 60,
        ease: "inOutSine",
      });
    }
  }, [latestGuess]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Navigation star chart showing submitted return-vector guesses."
        className="starfield grain relative aspect-2/1 w-full rounded-lg border border-edge-bright"
      >
        <defs>
          <radialGradient id="chart-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#090d1a" stopOpacity="0" />
            <stop offset="100%" stopColor="#05070e" stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="chart-scanline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4cc4f0" stopOpacity="0" />
            <stop offset="50%" stopColor="#4cc4f0" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#4cc4f0" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} className="fill-deep" />

        {LANDMASSES.map((land, i) => (
          <path key={i} d={land.d} className={land.className} />
        ))}

        <rect width={VIEW_W} height={VIEW_H} fill="url(#chart-vignette)" />

        <rect
          x={0}
          y={-60}
          width={VIEW_W}
          height={60}
          fill="url(#chart-scanline)"
          className="scan-line"
          pointerEvents="none"
        />

        {LON_LINES.map((lon) => (
          <line
            key={lon}
            x1={lonToX(lon)}
            x2={lonToX(lon)}
            y1={0}
            y2={VIEW_H}
            className="stroke-edge-bright/60"
            strokeWidth={lon === 0 ? 1.1 : 0.6}
          />
        ))}
        {LAT_LINES.map((lat) => (
          <line
            key={lat}
            x1={0}
            x2={VIEW_W}
            y1={latToY(lat)}
            y2={latToY(lat)}
            className="stroke-edge-bright/60"
            strokeWidth={lat === 0 ? 1.1 : 0.6}
          />
        ))}

        {LON_LINES.filter((lon) => lon !== 180).map((lon) => (
          <text
            key={lon}
            x={lonToX(lon) + 4}
            y={12}
            className="fill-dust font-mono"
            fontSize={9}
            pointerEvents="none"
          >
            {formatLon(lon)}
          </text>
        ))}
        {LAT_LINES.filter((lat) => lat !== -90 && lat !== 90).map((lat) => (
          <text
            key={lat}
            x={4}
            y={latToY(lat) - 4}
            className="fill-dust font-mono"
            fontSize={9}
            pointerEvents="none"
          >
            {formatLat(lat)}
          </text>
        ))}

        {trail.map((g) => (
          <circle
            key={g.id}
            cx={lonToX(g.coords.lon)}
            cy={latToY(g.coords.lat)}
            r={3.5}
            className="fill-dust/50"
            pointerEvents="none"
          />
        ))}

        {latestGuess && (
          <g
            key={latestGuess.id}
            data-guess-id={latestGuess.id}
            transform={`translate(${lonToX(latestGuess.coords.lon)} ${latToY(latestGuess.coords.lat)})`}
            opacity={0}
            pointerEvents="none"
          >
            <circle
              r={16}
              className={latestGuess.hit ? "stroke-verdant" : "stroke-signal"}
              fill="none"
              strokeWidth={1.5}
              opacity={0.65}
            />
            <circle
              r={4}
              className={latestGuess.hit ? "fill-verdant" : "fill-signal"}
            />
            {[
              [-22, 0, -10, 0],
              [22, 0, 10, 0],
              [0, -22, 0, -10],
              [0, 22, 0, 10],
            ].map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={latestGuess.hit ? "stroke-verdant" : "stroke-signal"}
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
      </svg>

      <div className="border-edge mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 font-mono text-xs">
        <span className="text-dust">
          ATTEMPT{" "}
          <span className="text-starlight tabular">
            {String(guesses.length).padStart(2, "0")}
          </span>
        </span>
        {latestGuess ? (
          <span className="text-dust">
            LAST VECTOR{" "}
            <span className="text-starlight tabular">
              {formatLat(latestGuess.coords.lat)} {formatLon(latestGuess.coords.lon)}
            </span>{" "}
            · SIGNAL{" "}
            <span className={latestGuess.hit ? "text-verdant" : "text-signal"}>
              {signalStrength(
                haversineDistanceKm(latestGuess.coords, TARGET_COORDINATES),
              )}
            </span>
          </span>
        ) : (
          <span className="text-dust">AWAITING FIRST LOCK ATTEMPT</span>
        )}
      </div>
    </div>
  );
}
