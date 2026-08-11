import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layer boundaries.
 *
 *   src/app/       Next.js routes            ─┐
 *   src/features/  UI components + hooks     ─┤ may import anything below it
 *   src/infra/     adapters (Supabase, …)     ┤ may import core + lib only
 *   src/core/      pure domain                ┘ imports nothing of ours
 *
 * Dependencies point inward only. These rules are what keep that true once
 * the project has more than one contributor and a deadline.
 */

const CORE_MUST_STAY_PURE =
  "src/core/ must stay pure TypeScript: no framework, no IO, no browser APIs. " +
  "Define a port in src/core/ports.ts and put the implementation in src/infra/.";

const INWARD_ONLY =
  "Dependencies point inward. Lower layers must not import from upper layers.";

const coreRestrictions = {
  patterns: [
    {
      group: ["react", "react-dom", "react/*", "react-dom/*"],
      message: CORE_MUST_STAY_PURE,
    },
    { group: ["next", "next/*"], message: CORE_MUST_STAY_PURE },
    { group: ["@supabase/*"], message: CORE_MUST_STAY_PURE },
    { group: ["dexie", "dexie/*"], message: CORE_MUST_STAY_PURE },
    {
      // Node builtins, both bare and prefixed. Core runs in a browser too.
      group: ["node:*", "fs", "path", "crypto", "os", "child_process"],
      message: CORE_MUST_STAY_PURE,
    },
    {
      // Alias form and any relative escape hatch out of core.
      group: [
        "@/infra",
        "@/infra/*",
        "@/app",
        "@/app/*",
        "@/features",
        "@/features/*",
        "@/lib",
        "@/lib/*",
        "**/infra/**",
        "**/app/**",
        "**/features/**",
      ],
      message: INWARD_ONLY,
    },
  ],
};

const infraRestrictions = {
  patterns: [
    {
      group: [
        "@/app",
        "@/app/*",
        "@/features",
        "@/features/*",
        "**/app/**",
        "**/features/**",
      ],
      message: INWARD_ONLY,
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    // A leading underscore marks a parameter that exists to satisfy an
    // interface but is deliberately unused — common in port implementations.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", coreRestrictions],
    },
  },

  {
    files: ["src/infra/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", infraRestrictions],
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ours:
    "coverage/**",
    "supabase/.temp/**",
    "src/infra/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;
