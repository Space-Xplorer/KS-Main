import { z } from "zod";

/**
 * Environment variables, validated at startup.
 *
 * The point is failing loudly at boot instead of yielding `undefined` that
 * surfaces as a confusing runtime error at the worst possible moment. Client
 * and server schemas are separate so a service-role key can never be read
 * from code that ships to the browser.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("must be the full https URL of your Supabase project"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "is required"),
});

const serverSchema = z.object({
  /**
   * Bypasses RLS entirely. Only ever read in route handlers and server
   * components — never in anything with "use client".
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "is required"),
  /** Optional until the email milestone lands. */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Next.js inlines NEXT_PUBLIC_* at build time only when referenced literally,
 * so these cannot be read through a loop or a dynamic key.
 */
export const clientEnv: ClientEnv = parseOrThrow(clientSchema, "client", {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

let cachedServerEnv: ServerEnv | null = null;

/**
 * Lazy so that merely importing this module in a shared file does not blow up
 * in the browser, and so a missing server-only variable is reported the first
 * time server code actually needs it.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. Server-only secrets must never " +
        "reach client code — move this call into a route handler or server component.",
    );
  }

  cachedServerEnv ??= parseOrThrow(serverSchema, "server", {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  });

  return cachedServerEnv;
}

function parseOrThrow<T extends z.ZodType>(
  schema: T,
  scope: string,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")} ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid ${scope} environment:\n${problems}\n\n` +
      `Copy .env.example to .env.local and fill in the missing values.`,
  );
}
