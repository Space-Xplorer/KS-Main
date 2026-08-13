import type { IdGenerator } from "@/core/ports";

export const cryptoIdGenerator: IdGenerator = {
  newId: () => crypto.randomUUID(),
};
