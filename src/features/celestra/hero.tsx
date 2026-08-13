import Image from "next/image";

import { FEE, FEST, REGISTRATION_URL } from "@/content/celestra";

/** Hairline-separated data rows, the way a spec sheet lists facts. */
const META: readonly { label: string; value: string }[] = [
  { label: "Presented by", value: FEST.hosts.join("  ×  ") },
  { label: "Dates", value: FEST.datesLabel },
  { label: "Venue", value: FEST.venue },
];

const LOGO_ASPECT = 900 / 248;
/** Intrinsic size requested from Next's image optimiser — the largest the
 * logo ever renders at (the `h-[clamp(...)]` class below controls the actual
 * responsive display size). Kept close to the source's native 900px width so
 * the glow stays crisp rather than upscaled. */
const HERO_LOGO_INTRINSIC_HEIGHT = 144;

export function Hero() {
  return (
    <section
      id="top"
      className="grain relative isolate overflow-hidden border-b border-edge"
    >
      <div className="starfield absolute inset-0 -z-10" aria-hidden="true" />

      {/* Orbital figure — drawn geometry, deliberately off-centre and clipped
          by the viewport edge so it reads as a diagram, not a decoration.
          Hidden below `sm`: at phone width it sprawls behind the headline and
          fights the text instead of framing it. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 600 600"
        className="text-plasma pointer-events-none absolute -top-24 -right-32 -z-10 hidden h-[34rem] w-[34rem] opacity-20 sm:block lg:right-0 lg:h-[38rem] lg:w-[38rem] lg:opacity-25"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <ellipse cx="300" cy="300" rx="250" ry="96" />
          <ellipse
            cx="300"
            cy="300"
            rx="250"
            ry="96"
            transform="rotate(58 300 300)"
          />
          <ellipse
            cx="300"
            cy="300"
            rx="250"
            ry="96"
            transform="rotate(-58 300 300)"
          />
          <circle cx="300" cy="300" r="42" strokeDasharray="2 6" />
        </g>
        <circle cx="550" cy="300" r="5" fill="currentColor" />
        <circle cx="168" cy="212" r="3" fill="currentColor" opacity="0.7" />
      </svg>

      <div className="mx-auto max-w-[76rem] px-5 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28">
        <p className="kicker">{FEST.tagline}</p>

        {/* The logo mark stands alone as the heading — no typeset "Celestra"
            beside it, so there is exactly one rendering of the wordmark, not
            two competing ones. The edition is a bordered tag rather than a
            large glyph: a lone sans-serif "I" at display size reads as a
            stray pipe, not a numeral. */}
        <h1 className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-3">
          <Image
            src="/brand/celestra-logo.webp"
            alt="Celestra"
            width={Math.round(HERO_LOGO_INTRINSIC_HEIGHT * LOGO_ASPECT)}
            height={HERO_LOGO_INTRINSIC_HEIGHT}
            priority
            className="h-[clamp(3.25rem,12vw,9rem)] w-auto"
          />
          <span className="border-plasma/50 text-plasma mb-2 border px-3 py-1.5 font-mono text-[0.7rem] tracking-[0.2em] whitespace-nowrap uppercase sm:mb-3">
            Edition I
          </span>
        </h1>

        <p className="font-display text-plasma mt-6 text-xl font-light tracking-[0.01em] sm:text-2xl">
          {FEST.motto}
        </p>

        <p className="text-haze mt-2 font-mono text-[0.8rem] tracking-[0.08em]">
          {FEST.onePass}
        </p>

        <p className="text-dust mt-4 max-w-[46ch] font-mono text-[0.75rem] leading-relaxed tracking-[0.08em]">
          {FEST.occasion}
        </p>

        <p className="text-haze mt-8 max-w-[52ch] text-lg leading-relaxed text-balance sm:text-xl">
          {FEST.intro}
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-4">
          <a
            href={REGISTRATION_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="bg-starlight text-void hover:bg-plasma px-7 py-3 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors"
          >
            Register
          </a>
          <a
            href="#events"
            className="border-edge-bright text-haze hover:border-plasma hover:text-starlight border px-7 py-3 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors"
          >
            12 Events ↓
          </a>
          <span className="text-dust font-mono text-[0.72rem] tracking-[0.1em]">
            {FEE.amount} {FEE.note}
            <span className="text-dust/80 block">{FEE.laterNote}</span>
          </span>
        </div>

        <dl className="border-edge mt-20 grid max-w-3xl grid-cols-1 border-t sm:grid-cols-3">
          {META.map((row) => (
            <div
              key={row.label}
              className="border-edge border-b px-0 py-5 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0"
            >
              <dt className="kicker">{row.label}</dt>
              <dd className="text-starlight mt-2 font-mono text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
