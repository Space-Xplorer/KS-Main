import { FEST, ORGANISERS, type Organiser } from "@/content/celestra";

/** Same colour logic as the manifest: cyan is Kakşyā Śāstra, violet is ED Cell. */
const ACCENT: Record<string, { rule: string; text: string }> = {
  kaksya_sastra_vnrvjiet: { rule: "bg-plasma", text: "text-plasma" },
  ed_cell_vnrvjiet: { rule: "bg-nebula", text: "text-nebula" },
};

export function About() {
  return (
    <section id="about" className="border-edge border-b">
      <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-8 sm:py-32">
        <p className="kicker">Who runs it</p>
        <h2 className="font-display mt-4 max-w-[20ch] text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Two clubs, one fest.
        </h2>
        <p className="text-haze mt-6 max-w-[56ch] text-lg leading-relaxed">
          Celestra is run jointly by the space club and the entrepreneurship cell
          of {FEST.institution}. That is why half the line-up is orbital mechanics
          and the other half is pitching to investors.
        </p>

        <div className="mt-16 grid gap-px sm:grid-cols-2">
          {ORGANISERS.map((organiser) => (
            <OrganiserCard key={organiser.instagram} organiser={organiser} />
          ))}
        </div>

        <div className="border-edge mt-16 grid gap-10 border-t pt-10 sm:grid-cols-2">
          <div>
            <h3 className="kicker">About {FEST.institution}</h3>
            <p className="text-haze mt-4 leading-relaxed">
              {FEST.institutionFull} is a 30-year-old autonomous institution,
              accredited with NAAC A++ twice and QS I-GAUGE &ldquo;Diamond&rdquo;
              rated twice, with 7,800+ students and 500+ faculty across 16 B.Tech,
              13 M.Tech and 5 Ph.D. programmes.
            </p>
          </div>
          <div>
            <h3 className="kicker">About Vignana Jyothi</h3>
            <p className="text-haze mt-4 leading-relaxed">
              A not-for-profit society founded in 1991 by industrialists,
              academicians, entrepreneurs and philanthropists who believed
              education is the foundation of long-term societal impact. It runs
              seven institutions from elementary to doctoral level.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrganiserCard({ organiser }: { organiser: Organiser }) {
  const accent = ACCENT[organiser.instagram] ?? {
    rule: "bg-edge-bright",
    text: "text-haze",
  };

  return (
    <article className="bg-deep/60 relative p-8 sm:p-10">
      <span aria-hidden="true" className={`absolute top-0 left-0 h-0.5 w-16 ${accent.rule}`} />

      <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">
        {organiser.name}
      </h3>
      <p className={`mt-1.5 font-mono text-[0.72rem] tracking-[0.14em] uppercase ${accent.text}`}>
        {organiser.kind}
      </p>

      <p className="text-haze mt-6 leading-relaxed">{organiser.description}</p>

      <dl className="mt-8 space-y-5">
        <div>
          <dt className="kicker">Vision</dt>
          <dd className="text-haze mt-2 text-[0.95rem] leading-relaxed">
            {organiser.vision}
          </dd>
        </div>
        <div>
          <dt className="kicker">Mission</dt>
          <dd className="text-haze mt-2 text-[0.95rem] leading-relaxed">
            {organiser.mission}
          </dd>
        </div>
      </dl>

      <a
        href={`https://instagram.com/${organiser.instagram}`}
        target="_blank"
        rel="noreferrer noopener"
        className={`mt-8 inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.14em] ${accent.text} hover:underline hover:underline-offset-4`}
      >
        @{organiser.instagram} ↗
      </a>
    </article>
  );
}
