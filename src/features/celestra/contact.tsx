import Image from "next/image";

import {
  CONTACT,
  COORDINATORS,
  FACULTY,
  FEST,
  REGISTRATION_URL,
} from "@/content/celestra";

const LOGO_ASPECT = 900 / 248;
const FOOTER_LOGO_HEIGHT = 22;

export function Contact() {
  return (
    <section id="contact" className="grain relative isolate overflow-hidden">
      <div className="starfield absolute inset-0 -z-10 opacity-60" aria-hidden="true" />

      <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-8 sm:py-32">
        <p className="kicker">Get in touch</p>
        <h2 className="font-display mt-4 max-w-[16ch] text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
          Come build something.
        </h2>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-4">
          <a
            href={REGISTRATION_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="bg-starlight text-void hover:bg-plasma px-7 py-3 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors"
          >
            Register
          </a>
          <span className="text-dust font-mono text-[0.72rem] tracking-[0.14em] uppercase">
            {FEST.datesLabel}
          </span>
        </div>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="kicker">Student coordinators</h3>
            <ul className="mt-5 space-y-3">
              {COORDINATORS.map((person) => (
                <li key={person.phone}>
                  <span className="text-starlight block text-[0.95rem]">
                    {person.name}
                  </span>
                  <a
                    href={`tel:${person.phone.replace(/\s/g, "")}`}
                    className="text-haze hover:text-plasma tabular font-mono text-[0.8rem] transition-colors"
                  >
                    {person.phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="kicker">Email</h3>
            <ul className="mt-5 space-y-3">
              {CONTACT.emails.map((email) => (
                <li key={email}>
                  <a
                    href={`mailto:${email}`}
                    className="text-haze hover:text-plasma font-mono text-[0.8rem] break-all transition-colors"
                  >
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="kicker">Instagram</h3>
            <ul className="mt-5 space-y-3">
              {CONTACT.instagram.map((account) => (
                <li key={account.handle}>
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-haze hover:text-plasma font-mono text-[0.8rem] break-all transition-colors"
                  >
                    @{account.handle} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="kicker">Faculty coordinators</h3>
            <ul className="mt-5 space-y-3">
              {FACULTY.map((person) => (
                <li key={person.name}>
                  <span className="text-starlight block text-[0.95rem]">
                    {person.name}
                  </span>
                  <span className="text-dust block text-[0.8rem] leading-snug">
                    {person.role}
                  </span>
                  {person.phone && (
                    <a
                      href={`tel:${person.phone.replace(/\s/g, "")}`}
                      className="text-haze hover:text-plasma tabular font-mono text-[0.78rem] transition-colors"
                    >
                      {person.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <footer className="border-edge border-t">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/celestra-logo.webp"
              alt="Celestra"
              width={Math.round(FOOTER_LOGO_HEIGHT * LOGO_ASPECT)}
              height={FOOTER_LOGO_HEIGHT}
              className="w-auto opacity-80"
              style={{ height: FOOTER_LOGO_HEIGHT }}
            />
            <p className="text-dust font-mono text-[0.7rem] tracking-[0.14em] uppercase">
              {FEST.hosts.join(" × ")} · {FEST.institution}
            </p>
          </div>
          <p className="text-dust font-mono text-[0.7rem] tracking-[0.14em] uppercase">
            {FEST.venue}
          </p>
        </div>
      </footer>
    </section>
  );
}
