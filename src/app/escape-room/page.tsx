import type { Metadata } from "next";

import { EscapeRoomClient } from "@/features/escape-room/escape-room-client";

/**
 * Final-round puzzle for the escape room. Deliberately not linked from
 * anywhere on the site — reachable only by whoever the physical clues send
 * here. Kept out of search results for the same reason.
 */
export const metadata: Metadata = {
  title: "Return Vector Lock",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <EscapeRoomClient />;
}
