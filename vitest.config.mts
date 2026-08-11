import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Core is pure TypeScript, so the whole suite runs without a browser,
    // a database, or a network. Keep it that way — it is why these tests
    // stay fast enough to run on every save.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
