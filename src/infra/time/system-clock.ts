import type { Clock } from "@/core/ports";

export const systemClock: Clock = {
  now: () => Date.now(),
};
