import { FEST_FACTS } from "@/content/celestra";

/**
 * A band of countable facts, directly under the hero.
 *
 * Everything here is derived from the schedule and partner list rather than
 * typed in by hand, so it cannot drift from the rest of the page — and there
 * is nothing aspirational in it.
 */
export function Facts() {
  return (
    <section className="border-edge border-b">
      <dl className="mx-auto grid max-w-[76rem] grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {FEST_FACTS.map((fact) => (
          <div
            key={fact.label}
            className="border-edge border-r border-b px-5 py-7 last:border-r-0 sm:py-8 lg:border-b-0"
          >
            <dt className="sr-only">{fact.label}</dt>
            <dd>
              <span className="font-display tabular block text-3xl font-bold tracking-[-0.02em] sm:text-[2.1rem]">
                {fact.value}
              </span>
              <span className="text-dust mt-2 block font-mono text-[0.66rem] leading-snug tracking-[0.12em] uppercase">
                {fact.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
