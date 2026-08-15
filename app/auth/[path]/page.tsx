import { viewPaths } from "@better-auth-ui/core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Auth } from "@/components/auth/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getServerSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · WhaleChat" };

/**
 * Views that only make sense while signed out. Someone who already has a
 * session gets sent home instead.
 *
 * The rest stay reachable either way: `sign-out` and `redirect` are transitions,
 * and `verify-email` is how a signed-in user confirms a changed address.
 */
const SIGNED_OUT_ONLY: string[] = [
  viewPaths.auth.signIn,
  viewPaths.auth.signUp,
  viewPaths.auth.forgotPassword,
  viewPaths.auth.resetPassword,
  viewPaths.auth.resetLinkSent,
];

/**
 * Every authentication view, on one route.
 *
 * `<Auth>` maps the URL segment to a view, so `/auth/sign-in`, `/auth/sign-up`,
 * `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-link-sent`,
 * `/auth/verify-email`, `/auth/sign-out` and `/auth/redirect` all land here.
 */
export function generateStaticParams() {
  return Object.values(viewPaths.auth).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  // Anything outside the known views is a typo or a probe, not a view we render
  // an empty shell for.
  if (!Object.values(viewPaths.auth).includes(path)) notFound();

  // Signing in is meaningless before there is an administrator to approve anyone.
  await requireOnboarded();

  if (SIGNED_OUT_ONLY.includes(path)) {
    // Validated, not inferred from the cookie: a stale cookie must still be able
    // to reach sign-in, or there is no way back in. See the note in `proxy.ts`.
    const { session } = await getServerSession();
    if (session) redirect("/");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-4">
      <Auth path={path} className="w-full max-w-sm" />
    </main>
  );
}
