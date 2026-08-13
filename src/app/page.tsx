import { CLUBS, EVENTS, FEST } from "@/content/celestra";
import { About } from "@/features/celestra/about";
import { Contact } from "@/features/celestra/contact";
import { Events } from "@/features/celestra/events";
import { Facts } from "@/features/celestra/facts";
import { Hero } from "@/features/celestra/hero";
import { OfficialPoster } from "@/features/celestra/official-poster";
import { Partner } from "@/features/celestra/partner";
import { SiteHeader } from "@/features/celestra/site-header";
import { ThemeMarquee } from "@/features/celestra/theme-marquee";

/**
 * Celestra — I landing page.
 *
 * Fully static: no data fetching, no client JS beyond the mobile nav, so it
 * loads on venue wifi. Content lives in src/content/celestra.ts.
 */
/**
 * schema.org Event data, so the fest can surface as a rich result with real
 * dates and a venue rather than a plain blue link. Generated from the same
 * content source as the page, so the two cannot drift.
 *
 * Note: "organizer" is spelled the American way on purpose — it is a
 * schema.org property name, not prose. The rest of the site is British English.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Festival",
  name: `${FEST.name} ${FEST.edition}`,
  description: FEST.intro,
  startDate: FEST.startIso,
  endDate: FEST.endIso,
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: FEST.institutionFull,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Hyderabad",
      addressRegion: "Telangana",
      addressCountry: "IN",
    },
  },
  organizer: FEST.hosts.map((name) => ({ "@type": "Organization", name })),
  subEvent: EVENTS.map((event) => ({
    "@type": "Event",
    name: event.title,
    ...(event.description ? { description: event.description } : {}),
    location: { "@type": "Place", name: event.venue },
    organizer: { "@type": "Organization", name: CLUBS[event.club].name },
  })),
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Content is our own static data, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />
      <main id="main">
        <Hero />
        <OfficialPoster />
        <Facts />
        <ThemeMarquee />
        <Events />
        <About />
        <Partner />
        <Contact />
      </main>
    </>
  );
}
