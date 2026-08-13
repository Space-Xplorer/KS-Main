import {
  CONTACT,
  PARTNERS,
  PARTNER_REASONS,
  TRACK_RECORD,
  WE_INVITE,
} from "@/content/celestra";

export function Partner() {
  return (
    <section id="partner" className="border-edge border-b">
      <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-8 sm:py-32">
        <p className="kicker">Partner with us</p>
        <h2 className="font-display mt-4 max-w-[18ch] text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Put your name on the first one.
        </h2>
        <p className="text-haze mt-6 max-w-[56ch] text-lg leading-relaxed">
          Celestra was started on the belief that curiosity sparks discovery and
          collaboration drives innovation. We are looking for industry experts,
          researchers, educators and space enthusiasts to help make space
          education more accessible.
        </p>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          <div>
            <h3 className="kicker">Why partner with us</h3>
            <ul className="mt-6">
              {PARTNER_REASONS.map((reason, i) => (
                <li
                  key={reason}
                  className="border-edge flex items-baseline gap-4 border-b py-4 first:border-t"
                >
                  <span className="text-plasma tabular font-mono text-[0.7rem]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-haze">{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="kicker">We invite</h3>
            <ul className="mt-6">
              {WE_INVITE.map((who, i) => (
                <li
                  key={who}
                  className="border-edge flex items-baseline gap-4 border-b py-4 first:border-t"
                >
                  <span className="text-nebula tabular font-mono text-[0.7rem]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-haze">{who}</span>
                </li>
              ))}
            </ul>

            <a
              href={`mailto:${CONTACT.emails[0]}?subject=Celestra%20I%20Partnership`}
              className="bg-starlight text-void hover:bg-plasma mt-8 inline-block px-7 py-3 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors"
            >
              Get in touch
            </a>
          </div>
        </div>

        {/* Already on board — named, so a prospective partner sees company. */}
        <div className="border-edge mt-20 border-t pt-10">
          <h3 className="kicker">This edition&rsquo;s partners</h3>
          <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {PARTNERS.map((group) => (
              <div key={group.role}>
                <dt className="text-dust font-mono text-[0.68rem] tracking-[0.14em] uppercase">
                  {group.role}
                </dt>
                <dd className="mt-2 space-y-1">
                  {group.names.map((name) => (
                    <span key={name} className="text-haze block text-[0.95rem]">
                      {name}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Evidence that these clubs actually ship, rather than a claim. */}
        <div className="border-edge mt-16 border-t pt-10">
          <h3 className="kicker">Previously, by these clubs</h3>
          <ul className="mt-6 columns-1 gap-x-12 sm:columns-2 lg:columns-3">
            {TRACK_RECORD.map((item) => (
              <li
                key={item.title}
                className="mb-3 flex items-baseline gap-3 break-inside-avoid"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-1 w-1 shrink-0 rotate-45 ${
                    item.host === "ED Cell" ? "bg-nebula" : "bg-plasma"
                  }`}
                />
                <span className="text-haze text-[0.95rem]">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
