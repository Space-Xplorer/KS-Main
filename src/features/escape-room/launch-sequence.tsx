"use client";

import { createTimeline, stagger } from "animejs";
import { useEffect, useRef } from "react";

const STREAK_COUNT = 26;
const STREAK_ANGLES = Array.from(
  { length: STREAK_COUNT },
  (_, i) => (360 / STREAK_COUNT) * i,
);

/** Rounded canopy window, cut out of the hull via evenodd fill. */
const WINDOW_PATH =
  "M15,15 L85,15 Q95,15 95,26 L91,72 Q90,83 78,87 L22,87 Q10,83 9,72 L5,26 Q5,15 15,15 Z";
const HULL_PATH = `M0,0 H100 V100 H0 Z ${WINDOW_PATH}`;

const RIVETS: [number, number][] = [
  [15, 15],
  [50, 15],
  [85, 15],
  [95, 26],
  [93, 50],
  [91, 72],
  [78, 87],
  [50, 87],
  [22, 87],
  [9, 72],
  [7, 50],
  [5, 26],
];

const DASH_LIGHTS: [number, number, string][] = [
  [22, 92, "fill-plasma"],
  [36, 92.5, "fill-signal"],
  [50, 93, "fill-verdant"],
  [64, 92.5, "fill-nebula"],
  [78, 92, "fill-plasma"],
];

/** Earth's continents here are pure decoration — three fixed static blobs. */
const EARTH_LANDMASSES = [
  "M -34 -18 Q -46 -4 -30 8 Q -14 18 -2 6 Q 8 -6 -6 -20 Q -20 -28 -34 -18 Z",
  "M 10 -30 Q 32 -34 38 -14 Q 42 4 22 10 Q 4 14 2 -6 Q 0 -22 10 -30 Z",
  "M -18 20 Q -4 16 4 28 Q 10 40 -6 42 Q -22 42 -24 30 Q -26 24 -18 20 Z",
];

export function LaunchSequence({ onDone }: { onDone?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const horizonRef = useRef<HTMLDivElement>(null);
  const streaksRef = useRef<HTMLDivElement>(null);
  const earthRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const thrustFillRef = useRef<HTMLDivElement>(null);
  const lockTextRef = useRef<HTMLParagraphElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      if (horizonRef.current) horizonRef.current.style.opacity = "0";
      if (thrustFillRef.current) thrustFillRef.current.style.width = "100%";
      const tl = createTimeline({ defaults: { duration: 320, ease: "outQuad" } });
      tl.add(earthRef.current!, { opacity: [0, 1] }).add(
        panelRef.current!,
        { opacity: [0, 1] },
        "<<",
      );
      if (onDone) tl.then(onDone);
      return () => tl.revert();
    }

    const streaks =
      streaksRef.current?.querySelectorAll<HTMLSpanElement>(".launch-streak") ?? [];

    const tl = createTimeline({ defaults: { ease: "outQuad" } });

    tl.add(rootRef.current!, { opacity: [0, 1], duration: 300, ease: "outQuad" })
      .add(thrustFillRef.current!, {
        width: ["0%", "100%"],
        duration: 650,
        ease: "outQuad",
      })
      .add(
        rootRef.current!,
        { translateX: [0, -2.5, 3, -2.5, 2, 0], duration: 420, ease: "inOutSine" },
        "<<",
      )
      .add(
        horizonRef.current!,
        { translateY: [0, 90], opacity: [1, 0], duration: 1100, ease: "inQuad" },
        "-=200",
      )
      .add(
        reticleRef.current!,
        { opacity: [1, 0], scale: [1, 0.6], duration: 400, ease: "inQuad" },
        "<<",
      )
      .add(
        streaks,
        { scaleX: [0, 1], opacity: [0, 0.9, 0], duration: 650, delay: stagger(10) },
        "-=650",
      )
      .add(
        earthRef.current!,
        { opacity: [0, 1], scale: [0.15, 1], duration: 1400, ease: "outExpo" },
        "-=350",
      )
      .add(lockTextRef.current!, { opacity: [0, 1], duration: 400 }, "-=700")
      .add(flashRef.current!, { opacity: [0, 0.85, 0], duration: 500 }, "-=300")
      .add(hudRef.current!, { opacity: [1, 0], duration: 400 }, "-=150")
      .add(
        panelRef.current!,
        { opacity: [0, 1], translateY: [18, 0], duration: 650 },
        "-=250",
      );

    if (onDone) tl.then(onDone);

    return () => {
      tl.revert();
    };
    // Runs exactly once — this component is only ever mounted after the puzzle is solved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-void opacity-0"
      role="status"
      aria-live="polite"
      aria-label="Return vector locked. Cockpit launch sequence in progress."
    >
      {/* Outside view — visible only through the cut-out canopy window */}
      <div className="starfield absolute inset-0" />
      <div
        ref={horizonRef}
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 100%, #6a3fb0 0%, #3a2266 38%, #1a1230 68%, transparent 100%)",
        }}
      />
      <div ref={streaksRef} className="pointer-events-none absolute inset-0">
        {STREAK_ANGLES.map((angle) => (
          <span
            key={angle}
            className="launch-streak"
            style={{ transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0 }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={earthRef}
          className="h-[50vmin] w-[50vmin] rounded-full opacity-0"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, #6fd3f0 0%, #2e86c9 40%, #0c2d55 78%, #05131f 100%)",
            boxShadow: "0 0 100px 24px rgb(76 196 240 / 0.35)",
          }}
        >
          <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden="true">
            {EARTH_LANDMASSES.map((d) => (
              <path key={d} d={d} className="fill-verdant/70" />
            ))}
          </svg>
        </div>
      </div>
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 bg-white opacity-0"
      />

      {/* Cockpit hull, canopy frame and dashboard */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hud-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4cc4f0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4cc4f0" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d={HULL_PATH} className="fill-void" fillRule="evenodd" />
        <path d={WINDOW_PATH} fill="none" stroke="url(#hud-edge)" strokeWidth={0.5} />
        <path
          d={WINDOW_PATH}
          fill="none"
          className="stroke-edge-bright"
          strokeWidth={1.6}
          transform="translate(0 1.2) scale(0.995)"
        />
        {RIVETS.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={0.6}
            className="fill-edge-bright"
          />
        ))}
        {/* Nose struts poking up into the window, as if glimpsing the hull */}
        <path d="M14,87 L25,87 L18,75 Z" className="fill-surface" />
        <path d="M86,87 L75,87 L82,75 Z" className="fill-surface" />
        <circle cx={18} cy={77} r={0.7} className="fill-signal" />
        <circle cx={82} cy={77} r={0.7} className="fill-signal" />
        {DASH_LIGHTS.map(([x, y, cls], i) => (
          <rect
            key={`${x}-${y}`}
            x={x - 3}
            y={y - 1.4}
            width={6}
            height={2.8}
            rx={0.8}
            className={`dash-light ${cls}`}
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </svg>

      {/* HUD overlay */}
      <div ref={hudRef} className="pointer-events-none absolute inset-0 font-mono">
        <div
          ref={reticleRef}
          className="border-plasma/70 absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ left: "50%", top: "51%" }}
        >
          <span className="bg-plasma/70 absolute top-1/2 left-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2" />
          <span className="bg-plasma/70 absolute top-1/2 left-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2" />
        </div>

        <p
          ref={lockTextRef}
          className="text-verdant absolute -translate-x-1/2 text-[0.65rem] tracking-[0.2em] uppercase opacity-0"
          style={{ left: "50%", top: "60%" }}
        >
          Target lock · Earth
        </p>

        <p
          className="text-haze/70 absolute text-[0.6rem] tracking-[0.16em] uppercase"
          style={{ left: "13%", top: "20%" }}
        >
          Sector — deep space
        </p>
        <p
          className="text-haze/70 absolute text-[0.6rem] tracking-[0.16em] uppercase"
          style={{ right: "13%", top: "20%" }}
        >
          Hull 100%
        </p>

        <div className="absolute" style={{ left: "13%", bottom: "16%" }}>
          <p className="text-dust text-[0.6rem] tracking-[0.16em] uppercase">Thrust</p>
          <div className="border-edge-bright mt-1 h-1.5 w-24 overflow-hidden rounded-full border">
            <div
              ref={thrustFillRef}
              className="bg-plasma h-full"
              style={{ width: "0%" }}
            />
          </div>
        </div>
      </div>

      <div
        ref={panelRef}
        className="border-edge-bright bg-deep/80 relative z-20 mx-6 max-w-md rounded-lg border px-8 py-10 text-center opacity-0 backdrop-blur-sm"
      >
        <p className="kicker text-verdant">Return vector locked</p>
        <h2 className="font-display mt-3 text-3xl text-starlight sm:text-4xl">
          Welcome home.
        </h2>
        <p className="text-haze mt-4 text-sm leading-relaxed">
          Trajectory converged on Earth. The crew is out of the dark and the mission log
          closes here — well navigated.
        </p>
        <p className="text-dust mt-6 font-mono text-xs">
          Refresh this page to run the sequence again.
        </p>
      </div>
    </div>
  );
}
