import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { EVENTS, FEST } from "@/content/celestra";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/** Carries the dossier voice: indices, data labels, track tags. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

const title = `${FEST.name} ${FEST.edition} · ${FEST.tagline}`;
const description =
  `${FEST.tagline} by ${FEST.hosts.join(" × ")} at ${FEST.institution}, ` +
  `${FEST.datesLabel}. ${EVENTS.length} events across space engineering, ` +
  `entrepreneurship and expert sessions.`;

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s · ${FEST.name} ${FEST.edition}`,
  },
  description,
  applicationName: `${FEST.name} ${FEST.edition}`,
  keywords: [
    "Celestra",
    "Kakşyā Śāstra",
    "ED Cell",
    "VNRVJIET",
    "space fest",
    "entrepreneurship fest",
    "aerospace",
    "startup",
    "student events",
    "Hyderabad",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: `${FEST.name} ${FEST.edition}`,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-void text-starlight flex min-h-full flex-col">
        {/* Keyboard users should not have to tab through the whole nav. */}
        <a
          href="#main"
          className="bg-plasma text-void focus:ring-starlight sr-only rounded-md px-4 py-2 font-medium focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
