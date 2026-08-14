"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/infra/supabase/browser";

/**
 * Email + password sign-in.
 *
 * Deliberately no "forgot password" / self-signup here — accounts are
 * provisioned by an admin ahead of the event (staff roles are granted, not
 * self-claimed; see supabase/migrations for why `user_roles` only allows
 * admin-written rows). A volunteer who can't log in should ask an organiser,
 * not reset their own way into a role.
 */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password."
          : signInError.message,
      );
      setSubmitting(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="kicker block">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-edge bg-deep/40 text-starlight focus:border-plasma mt-2 w-full border px-3 py-2.5 text-sm outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="kicker block">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-edge bg-deep/40 text-starlight focus:border-plasma mt-2 w-full border px-3 py-2.5 text-sm outline-none"
        />
      </div>

      {error && (
        <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-starlight text-void hover:bg-plasma w-full px-7 py-3 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
