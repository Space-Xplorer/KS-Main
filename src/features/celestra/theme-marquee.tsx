import { THEMES } from "@/content/celestra";

/**
 * The fest's subject matter as a moving band.
 *
 * The list is repeated three times and the track translates by exactly one
 * third, so the loop is seamless. Marked aria-hidden and mirrored by a visually
 * hidden static list — a screen reader should read fifteen themes once, not an
 * infinite scroll.
 */
export function ThemeMarquee() {
  return (
    <section className="border-edge overflow-hidden border-b py-5">
      <h2 className="sr-only">Event themes</h2>
      <ul className="sr-only">
        {THEMES.map((theme) => (
          <li key={theme}>{theme}</li>
        ))}
      </ul>

      <div
        aria-hidden="true"
        className="marquee-track flex w-max items-center gap-8 whitespace-nowrap"
      >
        {[0, 1, 2].map((copy) => (
          <ul key={copy} className="flex items-center gap-8">
            {THEMES.map((theme) => (
              <li
                key={theme}
                className="text-dust flex items-center gap-8 font-mono text-[0.75rem] tracking-[0.14em] uppercase"
              >
                {theme}
                <span className="bg-edge-bright h-1 w-1 rotate-45" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
