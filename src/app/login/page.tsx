import { redirect } from "next/navigation";

import { createClient } from "@/infra/supabase/server";
import { LoginForm } from "@/features/auth/login-form";

const DEFAULT_NEXT = "/scanner";

/**
 * Staff sign-in. Not self-serve: accounts are provisioned ahead of the event
 * (see supabase/migrations — `user_roles` only allows admin-written rows), so
 * there is no "create account" link here on purpose.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : DEFAULT_NEXT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: isStaff } = await supabase.rpc("is_staff");
    if (isStaff) redirect(next);
  }

  const initialError =
    params.error === "not_staff"
      ? "Signed in, but this account has no staff role. Ask an organiser to grant one."
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="kicker">Celestra staff</p>
      <h1 className="font-display mt-3 text-2xl font-bold tracking-[-0.02em]">
        Sign in
      </h1>
      <p className="text-haze mt-2 text-sm leading-relaxed">
        For volunteers and organisers running registration and check-in.
      </p>
      <LoginForm next={next} {...(initialError ? { initialError } : {})} />
    </main>
  );
}
