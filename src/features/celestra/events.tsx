import Image from "next/image";

import {
  CLUBS,
  DAYS,
  EVENTS,
  FEE,
  OPEN_TO,
  REGISTRATION_URL,
  type FestDay,
  type FestEvent,
} from "@/content/celestra";

/**
 * What's on.
 *
 * This is the part of the page that has a job: help someone decide which
 * events to attend, then get them registered. So each event is a card led by
 * its own poster, with the three things a student actually asks (when, where,
 * how big a team) visible without clicking, and Register one tap away.
 *
 * Grouped by day because attendance is planned by day.
 *
 * Detail expands via <details>, so it works with JavaScript disabled and
 * before hydration.
 */

/**
 * Minutes past midnight for the start of a slot, so a day reads in the order
 * you would actually walk it. Times are written for humans ("10:00 AM -
 * 4:00 PM"), so this only needs the leading clock time.
 */
function startMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const [, rawHour, minute, meridiem] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  let hour = Number(rawHour) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(minute);
}

const SCHEDULE = DAYS.map((day) => ({
  day,
  events: EVENTS.filter((event) => event.day === day.id).toSorted(
    (a, b) => startMinutes(a.time) - startMinutes(b.time),
  ),
}));

export function Events() {
  return (
    <section id="events" className="border-edge border-b">
      <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-8 sm:py-28">
        <header className="max-w-[46ch]">
          <p className="kicker">What&rsquo;s on</p>
          <h2 className="font-display mt-4 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
            Pick your events.
          </h2>
          <p className="text-haze mt-5 text-lg leading-relaxed">
            {EVENTS.length} events across {DAYS.length} days, run by both clubs.
            One pass covers all of them: {FEE.amount} per person, {FEE.later}{" "}
            after the early bird window. Register through the form, or scan the
            QR on any poster.
          </p>
        </header>

        <div className="border-edge mt-10 border-t pt-6">
          <p className="kicker">Open to</p>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
            {OPEN_TO.map((who) => (
              <li
                key={who}
                className="border-edge text-haze border px-3 py-1.5 text-[0.85rem]"
              >
                {who}
              </li>
            ))}
          </ul>
        </div>

        {SCHEDULE.map(({ day, events }) => (
          <div key={day.id} className="mt-16">
            <DayHeading day={day} count={events.length} />

            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          </div>
        ))}

        <p className="text-dust mt-14 font-mono text-[0.72rem] tracking-[0.08em]">
          Rooms are provisional and may change closer to the date.
        </p>
      </div>
    </section>
  );
}

function DayHeading({ day, count }: { day: FestDay; count: number }) {
  return (
    <div className="border-edge flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b pb-3">
      <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">
        {day.label}
      </h3>
      <time dateTime={day.iso} className="text-plasma text-[0.95rem]">
        {day.weekday}, {day.date}
      </time>
      <span className="text-dust font-mono text-[0.7rem] tracking-[0.1em] uppercase">
        {count} {count === 1 ? "event" : "events"}
      </span>
    </div>
  );
}

function EventCard({ event }: { event: FestEvent }) {
  const club = CLUBS[event.club];
  const expandable = Boolean(event.description ?? event.speakerBio);

  return (
    <li className="border-edge bg-deep/40 hover:border-edge-bright group flex flex-col border transition-colors">
      {event.poster ? (
        <a
          href={event.poster}
          target="_blank"
          rel="noreferrer noopener"
          className="relative block overflow-hidden"
          aria-label={`Open the ${event.title} poster full size`}
        >
          <Image
            src={event.poster}
            alt={
              event.posterTitle
                ? `Poster for ${event.title} (${event.posterTitle})`
                : `Poster for ${event.title}`
            }
            width={990}
            height={1400}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 24rem"
            className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="bg-void/85 text-starlight absolute top-2 right-2 px-2 py-1 font-mono text-[0.6rem] tracking-[0.1em] uppercase opacity-0 transition-opacity group-hover:opacity-100">
            Full poster
          </span>
        </a>
      ) : (
        // No poster supplied yet. A coloured plate keeps the grid even instead
        // of leaving a ragged hole.
        <div className="border-edge flex aspect-[99/140] items-center justify-center border-b">
          <span className="text-dust font-mono text-[0.7rem] tracking-[0.14em] uppercase">
            Poster coming soon
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <span aria-hidden="true" className={`block h-0.5 w-8 ${club.rail}`} />

        <p className="text-haze tabular mt-3 font-mono text-[0.75rem]">
          {event.time}
        </p>

        <h4 className="font-display mt-1 text-xl leading-tight font-semibold tracking-[-0.02em]">
          {event.title}
        </h4>

        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`font-mono text-[0.68rem] tracking-[0.1em] uppercase ${club.text}`}
          >
            {club.name}
          </span>
          <span aria-hidden="true" className="bg-edge-bright h-3 w-px" />
          <span className="text-dust font-mono text-[0.7rem]">{event.venue}</span>
        </p>

        {event.teamSize && (
          <p className="text-haze mt-2 font-mono text-[0.7rem]">
            Teams of {event.teamSize.replace(" members", "")}
          </p>
        )}

        {event.hook && (
          <p className="text-haze mt-3 text-[0.95rem] leading-snug italic">
            {event.hook}
          </p>
        )}

        {event.speaker && (
          <p className="text-plasma mt-3 text-[0.9rem]">
            Speaker: {event.speaker}
          </p>
        )}

        <div className="flex-1" />

        {expandable && (
          <details className="group/d mt-4">
            <summary className="text-dust hover:text-starlight flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors">
              <span className="manifest-marker inline-block transition-transform duration-300">
                +
              </span>
              Details
            </summary>

            <div className="mt-3 space-y-3">
              {event.topic && (
                <p className="text-starlight text-[0.9rem]">
                  &ldquo;{event.topic}&rdquo;
                </p>
              )}
              {event.description && (
                <p className="text-haze text-[0.9rem] leading-relaxed">
                  {event.description}
                </p>
              )}
              {event.speakerBio && (
                <p className="text-haze text-[0.9rem] leading-relaxed">
                  {event.speakerBio}
                </p>
              )}
              {event.contacts && event.contacts.length > 0 && (
                <div>
                  <p className="kicker">Ask the organisers</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {event.contacts.map((contact) => (
                      <li key={contact.phone}>
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, "")}`}
                          className="text-haze hover:text-plasma font-mono text-[0.75rem] transition-colors"
                        >
                          {contact.name} · {contact.phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}

        <a
          href={REGISTRATION_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="border-edge-bright text-starlight hover:bg-starlight hover:text-void mt-4 block border py-2.5 text-center font-mono text-[0.72rem] tracking-[0.16em] uppercase transition-colors"
        >
          Register
        </a>
      </div>
    </li>
  );
}
