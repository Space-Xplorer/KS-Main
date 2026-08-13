import Image from "next/image";

import { BANNER, FEST } from "@/content/celestra";

/**
 * The official event poster, shown whole rather than as a hero background.
 *
 * It already carries its own motto, dates and a QR code baked into the
 * artwork — stacking hero copy on top of it would duplicate that text in two
 * different typefaces over a busy image. Showing it as a self-contained
 * frame, right after the hero, keeps both legible: crisp HTML type above,
 * the designed artwork below it.
 */
export function OfficialPoster() {
  return (
    <section className="border-edge border-b">
      <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-8">
        <p className="kicker text-center">The official poster</p>

        <a
          href={BANNER}
          target="_blank"
          rel="noreferrer noopener"
          className="group border-edge hover:border-edge-bright relative mt-6 block overflow-hidden border"
        >
          <Image
            src={BANNER}
            alt={`${FEST.name} ${FEST.edition} official poster: ${FEST.motto}, ${FEST.datesLabel}, ${FEST.venue}. Includes a QR code to register.`}
            width={1400}
            height={734}
            sizes="(max-width: 1024px) 92vw, 76rem"
            className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.015]"
          />
          <span className="bg-void/85 text-starlight absolute top-3 right-3 px-2.5 py-1.5 font-mono text-[0.65rem] tracking-[0.12em] uppercase opacity-0 transition-opacity group-hover:opacity-100">
            Open full size ↗
          </span>
        </a>
      </div>
    </section>
  );
}
