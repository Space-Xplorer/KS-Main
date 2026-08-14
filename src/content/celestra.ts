/**
 * All Celestra — I content, in one place.
 *
 * Sources, in order of authority:
 *   1. Annexure I "Detailed Event Schedule & Tentative Venue Allocation" —
 *      dates, times, venues, organising clubs.
 *   2. Event posters — branding, team sizes, per-event coordinators, artwork.
 *   3. The sponsorship brochure — descriptions, vision/mission, partner copy.
 *
 * Where the posters and the Annexure disagreed on a date, the poster was
 * generally taken as correct (it is what students have actually seen on
 * Instagram). Confirmed moves:
 *
 *   escape-room         18 Aug -> 19 Aug   (poster)
 *   battle-of-brands    18 Aug -> 19 Aug   (poster)
 *   investors-roulette  19 Aug -> 18 Aug   (poster)
 *   guest-lecture        19 Aug -> 17 Aug   (updated poster, confirmed directly)
 *
 * The updated posters (Aug 2026 batch) also confirmed the day-level grouping:
 * the panel discussion and Space Talk run Day 1, every ED Cell
 * (entrepreneurship) event runs Day 2, and every Kakşyā Śāstra (space) event
 * runs Day 3.
 *
 * One poster left a field blank in the artwork, so it still comes from the
 * Annexure: elevator-pitch (no date or venue printed).
 *
 * Spelling: British English throughout ("organise", "defence", "programme").
 */

export interface FestMeta {
  readonly name: string;
  readonly edition: string;
  readonly tagline: string;
  readonly motto: string;
  readonly hosts: readonly string[];
  readonly institution: string;
  readonly institutionFull: string;
  readonly datesLabel: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly venue: string;
  readonly intro: string;
  readonly occasion: string;
  readonly onePass: string;
}

export const FEST: FestMeta = {
  name: "Celestra",
  edition: "I",
  tagline: "The Space & Entrepreneurship Fest",
  motto: "Where Vision Meets The Universe",
  hosts: ["Kakşyā Śāstra", "ED Cell"],
  institution: "VNRVJIET",
  institutionFull:
    "Vallurupalli Nageswara Rao Vignana Jyothi Institute of Engineering & Technology",
  datesLabel: "17-19 August 2026",
  startIso: "2026-08-17",
  endIso: "2026-08-19",
  venue: "VNRVJIET, Bachupally, Hyderabad",
  occasion: "In celebration of National Space Day and International Entrepreneurs' Day",
  intro:
    "A three day celebration bringing Space Tech, entrepreneurship, " +
    "innovation, technology and business under one platform. Technical " +
    "challenges, interactive games, startup activities and expert sessions, " +
    "plus the chance to meet scientists, founders and industry professionals.",
  onePass: "One pass. Multiple experiences. Endless possibilities.",
};

/**
 * Ticketing, per the registration form.
 *
 * NOT free. An earlier version of this file said "Free entry", which was wrong
 * and is exactly the sort of claim that must never be guessed at.
 *
 * The early bird window (₹125) has closed. ₹149 is the only price now live —
 * do not resurrect the ₹125 figure without confirming the window reopened.
 */
export const FEE = {
  amount: "₹149",
  note: "per person, covers all three days",
  groupOffer: "Bring a crew of 4: buy 3 passes, the 4th is free.",
} as const;

/** Who the fest is for, per the form. Helps a visitor self-identify fast. */
export const OPEN_TO: readonly string[] = [
  "School & college students",
  "Entrepreneurs & enthupreneurs",
  "Space & tech enthusiasts",
  "Anyone curious about space, technology & innovation",
];

/** Google Form. Replace once the in-house registration flow ships. */
export const REGISTRATION_URL = "https://forms.gle/TC6UqFrJMzY6LEH5A";

/* -------------------------------------------------------------------------- */
/* Organising clubs                                                            */
/* -------------------------------------------------------------------------- */

export type ClubId = "ks" | "edcell" | "joint" | "vjsv" | "xplor";

export interface Club {
  readonly id: ClubId;
  readonly name: string;
  readonly rail: string;
  readonly text: string;
  readonly dot: string;
}

/**
 * Four colours, not five: Kakşyā Śāstra and ED Cell each own one, jointly-run
 * sessions get a third, and visiting partner clubs share a fourth. Beyond four
 * the legend stops being memorable and colour stops carrying meaning.
 */
export const CLUBS: Record<ClubId, Club> = {
  ks: {
    id: "ks",
    name: "Kakşyā Śāstra",
    rail: "bg-plasma",
    text: "text-plasma",
    dot: "bg-plasma",
  },
  edcell: {
    id: "edcell",
    name: "ED Cell",
    rail: "bg-nebula",
    text: "text-nebula",
    dot: "bg-nebula",
  },
  joint: {
    id: "joint",
    name: "Kakşyā Śāstra × ED Cell",
    rail: "bg-signal",
    text: "text-signal",
    dot: "bg-signal",
  },
  vjsv: {
    id: "vjsv",
    name: "VJ Sahiti Vanam",
    rail: "bg-verdant",
    text: "text-verdant",
    dot: "bg-verdant",
  },
  xplor: {
    id: "xplor",
    name: "XploR XR",
    rail: "bg-verdant",
    text: "text-verdant",
    dot: "bg-verdant",
  },
};

export const LEGEND: readonly { label: string; dot: string }[] = [
  { label: "Kakşyā Śāstra", dot: "bg-plasma" },
  { label: "ED Cell", dot: "bg-nebula" },
  { label: "Jointly hosted", dot: "bg-signal" },
  { label: "Partner clubs", dot: "bg-verdant" },
];

/* -------------------------------------------------------------------------- */
/* Schedule                                                                    */
/* -------------------------------------------------------------------------- */

export interface FestDay {
  readonly id: string;
  readonly label: string;
  readonly weekday: string;
  readonly date: string;
  readonly iso: string;
}

export const DAYS: readonly FestDay[] = [
  {
    id: "day-1",
    label: "Day 1",
    weekday: "Monday",
    date: "17 August 2026",
    iso: "2026-08-17",
  },
  {
    id: "day-2",
    label: "Day 2",
    weekday: "Tuesday",
    date: "18 August 2026",
    iso: "2026-08-18",
  },
  {
    id: "day-3",
    label: "Day 3",
    weekday: "Wednesday",
    date: "19 August 2026",
    iso: "2026-08-19",
  },
];

export interface EventContact {
  readonly name: string;
  readonly phone: string;
}

export interface FestEvent {
  readonly id: string;
  readonly title: string;
  /** Name used on the poster, when it differs from the schedule entry. */
  readonly posterTitle?: string;
  readonly day: string;
  readonly time: string;
  readonly club: ClubId;
  readonly venue: string;
  readonly hook?: string;
  readonly description?: string;
  readonly teamSize?: string;
  readonly poster?: string;
  readonly contacts?: readonly EventContact[];
  /** Speaker billing, for talks. */
  readonly speaker?: string;
  readonly speakerBio?: string;
  readonly topic?: string;
}

export const EVENTS: readonly FestEvent[] = [
  /* ---- Day 1 ---- */
  {
    id: "inauguration-panel",
    title: "Inauguration & Panel Discussion",
    day: "day-1",
    time: "10:00 AM - 12:00 PM",
    club: "joint",
    venue: "KS Auditorium",
    hook: "How can India lead the next era of the global space race?",
    description:
      "Industry leaders, entrepreneurs and researchers discuss the growth of " +
      "India's SpaceTech ecosystem, the rise of private space startups, " +
      "opportunities for collaboration with ISRO, and the future of commercial " +
      "space, plus the careers and skills needed to build the next generation " +
      "of space innovators.",
  },

  /* ---- Day 2 ---- */
  {
    id: "cosmic-clash",
    title: "Cosmic Clash",
    day: "day-3",
    time: "12:00 PM - 4:00 PM",
    club: "ks",
    venue: "JSK Greens / A-117",
    hook: "Think beyond. Debate beyond. Transform.",
    description:
      "A debate on space and sci-fi related topics. Participants argue " +
      "thought-provoking questions in space science, exploration and " +
      "technology, presenting logical arguments before responding to opposing " +
      "viewpoints in a structured format.",
    poster: "/posters/cosmic-clash.webp",
    contacts: [
      { name: "Jasmitha", phone: "+91 80192 59977" },
      { name: "Tej Sriram", phone: "+91 73964 58144" },
    ],
  },
  {
    id: "orbital-defence",
    title: "Orbital Defence Design Challenge",
    day: "day-3",
    time: "10:00 AM - 12:00 PM",
    club: "ks",
    venue: "E-507",
    hook: "A battle of wits to tackle threats.",
    description:
      "A satellite constellation is under cyberattack and an asteroid is on a " +
      "collision course. Teams tackle realistic space security scenarios by " +
      "designing defence strategies combining engineering, technology and " +
      "mission planning, then justify them while unexpected developments are " +
      "introduced mid-challenge.",
    poster: "/posters/orbital-defence.webp",
    contacts: [
      { name: "Shriya", phone: "+91 68091 60662" },
      { name: "Vignesh", phone: "+91 76740 98342" },
    ],
  },
  {
    id: "battle-of-brands",
    title: "Battle of Brands",
    posterTitle: "BOB 2.0",
    day: "day-2",
    time: "10:00 AM - 4:00 PM",
    club: "edcell",
    venue: "SAC Stage",
    hook: "Can you defend a brand, even if it's not your favourite?",
    description:
      "Teams are randomly assigned rival brands and compete in a fast-paced " +
      "debate, using marketing insight, business strategy and persuasive " +
      "communication to out-argue their opponents under time pressure.",
    teamSize: "1-4 members",
    poster: "/posters/battle-of-brands.webp",
    contacts: [{ name: "Zenith", phone: "+91 89198 58900" }],
  },
  {
    id: "escape-room",
    title: "Space Themed Escape Room",
    posterTitle: "Lost in Space",
    day: "day-3",
    time: "10:00 AM - 4:00 PM",
    club: "ks",
    venue: "A-013",
    hook: "Stranded on an unknown world. Find the clues. Escape alive.",
    description:
      "An immersive sci-fi survival event. Participants play astronauts trapped " +
      "inside a space station after an alien invasion, solving puzzles and " +
      "restoring the escape system before time runs out, while a relentless " +
      "alien hunts them throughout the game, eliminating anyone it catches.",
    teamSize: "2-5 members",
    poster: "/posters/escape-room.webp",
    contacts: [
      { name: "K Jahnavi", phone: "+91 81063 63053" },
      { name: "K Ritheesh", phone: "+91 96424 09450" },
    ],
  },
  {
    id: "sell-the-secret",
    title: "Sell the Secret",
    day: "day-2",
    time: "1:00 PM - 4:00 PM",
    club: "edcell",
    venue: "Dr. APJ Abdul Kalam Auditorium",
    hook: "Can you sell the unsellable?",
    description:
      "Teams receive an unconventional product and must build a complete " +
      "branding, marketing and sales strategy before presenting their campaign " +
      "to a panel of judges, turning odd ideas into marketable opportunities.",
    teamSize: "2-3 members",
    poster: "/posters/sell-the-secret.webp",
    contacts: [
      { name: "Poojitha", phone: "+91 94414 58294" },
      { name: "Niharika", phone: "+91 88977 68869" },
      { name: "Joseph Raj", phone: "+91 79015 50473" },
    ],
  },
  {
    id: "vjsv-ks",
    title: "VJSV × KS Event",
    day: "day-2",
    time: "1:00 PM - 4:00 PM",
    club: "vjsv",
    venue: "E Block Entrance",
    // No poster and no description supplied. Likely the brochure's "Space X
    // Literature Event", but that is inference, not fact — left blank.
  },

  /* ---- Day 3 ---- */
  {
    id: "guest-lecture",
    title: "Space Talk",
    posterTitle: "Space Talk: Beyond Earth, Beyond Imagination",
    day: "day-1",
    time: "2:00 PM onwards",
    club: "ks",
    venue: "KS Auditorium",
    hook: "Beyond Earth. Beyond imagination.",
    speaker: "Bhudeb Chakravarti",
    topic: "Swarm Intelligence in Wireless Sensor Networks for Border Surveillance",
    speakerBio:
      "Technologist and innovation strategist with more than 35 years of " +
      "international experience across India, the USA, China, South East Asia " +
      "and Australia. Chair of the IEEE Aerospace and Electronic Systems " +
      "Society (AESS) Hyderabad Chapter. He specialises in digital " +
      "transformation, Artificial Intelligence, IoT and Systems Engineering " +
      "across aerospace, healthcare IT and smart cities, and is the author of " +
      "Effective Governance through Business Process Reengineering. His " +
      "research covers integrated sensing and communication using wireless " +
      "sensor networks, with more than 25 publications in national and " +
      "international journals and conferences.",
    poster: "/posters/guest-lecture.webp",
  },
  {
    id: "elevator-pitch",
    title: "Elevator Pitch",
    day: "day-2",
    time: "10:00 AM - 3:00 PM",
    club: "edcell",
    venue: "Emergency Lift, E Block",
    hook: "30 to 60 seconds. One ride. One chance.",
    description:
      "Conducted inside an actual elevator. Participants have 30 to 60 seconds to " +
      "pitch their startup idea to a judge acting as a potential investor " +
      "before reaching the top floor, testing clarity, confidence and " +
      "composure under real-world constraints.",
    poster: "/posters/elevator-pitch.webp",
    contacts: [{ name: "Goutami", phone: "+91 93914 90703" }],
  },
  {
    id: "design-your-spacecraft",
    title: "Design Your Own Spacecraft",
    posterTitle: "Rocket Design",
    day: "day-3",
    time: "1:00 PM - 4:00 PM",
    club: "ks",
    venue: "D-319 / D-310",
    hook: "Every great spacecraft begins as a design on a screen.",
    description:
      "Participants are taught the basics of SOLIDWORKS online. In the offline " +
      "round they conceptualise and model a spacecraft or launch vehicle in " +
      "CAD, working within engineering constraints and mission requirements. " +
      "A practical introduction to engineering design, 3D modelling and " +
      "aerospace systems.",
    poster: "/posters/design-your-spacecraft.webp",
    contacts: [{ name: "Tanish", phone: "+91 79897 16924" }],
  },
  {
    id: "vr-gaming",
    title: "VR Gaming Event",
    day: "day-3",
    time: "1:00 PM - 4:00 PM",
    club: "xplor",
    venue: "E Block Entrance",
    hook: "Step inside the simulation.",
    description:
      "Participants explore space-themed simulations and interact with virtual " +
      "environments. An engaging introduction to space technology that " +
      "showcases the role of VR in education, training and scientific " +
      "visualisation.",
  },
  {
    id: "investors-roulette",
    title: "Investor's Roulette",
    posterTitle: "Investor's Roulette 2.0",
    day: "day-2",
    time: "1:00 PM - 4:00 PM",
    club: "edcell",
    venue: "E-530",
    hook: "Will you bet on the future?",
    description:
      "Teams evaluate anonymised startup pitches and decide whether to invest " +
      "or pass before the company's identity is revealed, each decision moving " +
      "their virtual portfolio. A simulation-based introduction to venture " +
      "capital and risk assessment.",
    poster: "/posters/investors-roulette.webp",
    contacts: [{ name: "Sachin", phone: "+91 88614 43300" }],
  },
];

/* -------------------------------------------------------------------------- */
/* Stats                                                                       */
/* -------------------------------------------------------------------------- */

export interface Stat {
  readonly value: string;
  readonly label: string;
}

/* FEST_FACTS is defined below, after PARTNERS, because it counts them. */

/* -------------------------------------------------------------------------- */
/* Organisers                                                                  */
/* -------------------------------------------------------------------------- */

export interface Organiser {
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly vision: string;
  readonly mission: string;
  readonly instagram: string;
}

export const ORGANISERS: readonly Organiser[] = [
  {
    name: "Kakşyā Śāstra",
    kind: "The Space Club of VNRVJIET",
    description:
      "Founded to ignite curiosity and foster innovation in space science and " +
      "astrophysics. We believe in hands-on learning, creative collaboration, " +
      "and empowering students as the next generation of pioneers.",
    vision:
      "To create impactful projects and research teams driven by diverse space " +
      "interests, host monthly events to connect enthusiasts, and conduct " +
      "sessions that educate and inspire the next generation of space leaders.",
    mission:
      "To spark curiosity about space, educate students, build projects, and " +
      "connect with space professionals, creating a vibrant community where " +
      "knowledge, innovation and passion for space thrive.",
    instagram: "kaksya_sastra_vnrvjiet",
  },
  {
    name: "ED Cell",
    kind: "Entrepreneurship Development Cell, VNRVJIET",
    description:
      "Fosters innovation, entrepreneurship and leadership by empowering " +
      "students to transform ideas into impactful ventures, through " +
      "workshops, startup competitions, mentorship, industry interactions and " +
      "networking.",
    vision:
      "To build a thriving entrepreneurial ecosystem where every student has " +
      "the opportunity, confidence and support to transform ideas into " +
      "impactful ventures.",
    mission:
      "To cultivate a culture of innovation and entrepreneurship by connecting " +
      "students with founders, mentors, investors and industry through " +
      "experiential learning, startup initiatives and collaborative " +
      "opportunities.",
    instagram: "ed_cell_vnrvjiet",
  },
];

export const THEMES: readonly string[] = [
  "Aerospace Engineering",
  "Spacecraft Design",
  "Orbital Defence",
  "Space Robotics",
  "Astronomy",
  "Satellite Systems",
  "Space Education",
  "Space Entrepreneurship",
  "Innovation & Product Design",
  "Engineering Design (CAD)",
  "Autonomous Vehicles",
  "Artificial Intelligence",
  "Scientific Communication",
  "Space Policy",
  "Future Technologies",
];

export const TRACK_RECORD: readonly { title: string; host: string }[] = [
  { title: "Astro-Engineering Workshop", host: "Kakşyā Śāstra" },
  { title: "Rocketry & Rocket Building Workshop", host: "Kakşyā Śāstra" },
  { title: "Seminar on Black Holes & Careers in Astronomy", host: "Kakşyā Śāstra" },
  { title: "Seminar on ISRO & CubeSats", host: "Kakşyā Śāstra" },
  { title: "Star-gazing Night", host: "Kakşyā Śāstra" },
  { title: "Space Themed Escape Room", host: "Kakşyā Śāstra" },
  { title: "VJ Ecficio 6.0 & 7.0", host: "ED Cell" },
  { title: "Entrepreneurs' Day 2025", host: "ED Cell" },
  { title: "Founder's Friday", host: "ED Cell" },
  { title: "MBB Panel Discussion", host: "ED Cell" },
  { title: "BVR SCIENT Industry Connect", host: "ED Cell" },
];

/* -------------------------------------------------------------------------- */
/* Partners                                                                    */
/* -------------------------------------------------------------------------- */

export const PARTNERS: readonly { role: string; names: readonly string[] }[] = [
  { role: "Event partners", names: ["VJ Sahiti Vanam", "XploR XR"] },
  { role: "Organising partners", names: ["Candleves", "AIRBOTS"] },
  { role: "Campaign partners", names: ["Student Tribe", "VJ Vibes"] },
  { role: "Coverage partners", names: ["Scintillate", "VJ Teatro"] },
];

/**
 * Facts, counted from the schedule and partner list — not projections.
 *
 * The brochure's "350+ participants / 2,000+ footfall / 10,000+ impressions"
 * were sponsorship TARGETS for a first edition that has not happened yet.
 * Printing them on a public page reads as a claim about reality, so they are
 * deliberately absent. If a sponsor deck needs them, they belong in the deck.
 */
export const FEST_FACTS: readonly Stat[] = [
  { value: String(EVENTS.length), label: "Events & sessions" },
  { value: String(DAYS.length), label: "Days" },
  {
    value: String(new Set(EVENTS.map((event) => event.venue)).size),
    label: "Venues across campus",
  },
  { value: String(ORGANISERS.length), label: "Host clubs" },
  {
    value: String(PARTNERS.reduce((total, group) => total + group.names.length, 0)),
    label: "Partner clubs",
  },
  { value: FEE.amount, label: "Registration fee" },
];

export const PARTNER_REASONS: readonly string[] = [
  "Showcase your expertise",
  "Strengthen your presence in the space ecosystem",
  "Promote innovation & entrepreneurship",
  "Build industry and academia connections",
  "Connect with potential interns & hires",
  "Network with students, faculty & industry experts",
  "Gain targeted exposure through technical events and digital outreach",
];

export const WE_INVITE: readonly string[] = [
  "Panelists for industry discussions",
  "Technical session speakers",
  "SpaceTech startup founders",
  "Aerospace researchers & professionals",
  "Space industry professionals",
  "Academic & research leaders",
];

/* -------------------------------------------------------------------------- */
/* Contact                                                                     */
/* -------------------------------------------------------------------------- */

export interface Coordinator {
  readonly name: string;
  readonly phone: string;
}

export const COORDINATORS: readonly Coordinator[] = [
  { name: "Maheshwar Patnala", phone: "+91 95158 71625" },
  { name: "Sachin Tripathi", phone: "+91 88614 43300" },
  { name: "Tejasree", phone: "+91 76750 92587" },
];

export const FACULTY: readonly { name: string; role: string; phone?: string }[] = [
  {
    name: "Dr. K. Vijay Chandra",
    role: "Faculty Coordinator, Kakşyā Śāstra",
    phone: "+91 98850 37274",
  },
  {
    name: "Dr. C. Kiran",
    role: "Global Relationship Officer, VNRVJIET",
    phone: "+91 90307 51024",
  },
  {
    name: "Dr. M. Venkata Ramana",
    role: "Faculty Coordinator, ED Cell",
    phone: "+91 98497 68437",
  },
];

export const CONTACT = {
  emails: ["kaksyasastra@vnrvjiet.in", "edcell@vnrvjiet.in"],
  instagram: [
    { handle: "celestra_vnrvjiet", url: "https://instagram.com/celestra_vnrvjiet" },
    {
      handle: "kaksya_sastra_vnrvjiet",
      url: "https://instagram.com/kaksya_sastra_vnrvjiet",
    },
    { handle: "ed_cell_vnrvjiet", url: "https://instagram.com/ed_cell_vnrvjiet" },
  ],
} as const;

export const BANNER = "/posters/celestra-banner.webp";

/** The "3+1" group offer promo, run as an Instagram story. */
export const GROUP_OFFER_POSTER = "/posters/group-offer.webp";
