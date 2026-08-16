import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ONBOARDING_PENDING_REASON } from "./access";
import { prisma } from "./prisma";
import { redis } from "./redis";

/**
 * Where the instance is in first-run setup.
 *
 * - `claim` — nobody owns this instance yet; anyone can take it.
 * - `activate` — an administrator has been claimed but has not proved they can
 *   read the mailbox it was claimed with.
 * - `done` — there is a working administrator; onboarding is closed for good.
 */
export type OnboardingState =
  | { step: "claim" }
  | { step: "activate"; email: string; userId: string }
  | { step: "done" };

/**
 * Set once onboarding finishes.
 *
 * @remarks Purely a cache. The state is monotonic — `done` is never left — so a
 * hit can skip the query entirely, and losing Redis just means asking Postgres
 * again. It is never used to *grant* anything, only to skip work.
 */
const ONBOARDED_KEY = "whalechat:onboarded";

/**
 * Where first-run setup has got to, derived from the admin accounts that exist.
 *
 * @remarks There is no dedicated column — the ban mechanism carries the state,
 * so a half-claimed administrator is *already* unable to sign in, including
 * through a direct `POST /api/auth/sign-in/email`.
 */
export async function getOnboardingState(): Promise<OnboardingState> {
  // Answer only at request time. Without this, a build run against a database
  // with no administrator prerenders the redirect to /onboarding into a static
  // page — which would then keep redirecting there forever, long after setup
  // finished. Callers redirect before touching `headers()`, so nothing else
  // marks these routes dynamic.
  await connection();

  if (await redis.get(ONBOARDED_KEY)) return { step: "done" };

  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, banned: true, banReason: true },
  });

  if (admins.some((admin) => !admin.banned)) {
    await redis.set(ONBOARDED_KEY, "1");
    return { step: "done" };
  }

  const pending = admins.find(
    (admin) => admin.banned && admin.banReason === ONBOARDING_PENDING_REASON
  );
  if (pending) {
    return { step: "activate", email: pending.email, userId: pending.id };
  }

  // Reaching here means admins exist but every one is banned for some other
  // reason. Deliberately NOT reopening the claim: onboarding must never be
  // available on a database that has been used, or "ban the last admin" becomes
  // a way to take the instance over. Recovery is a manual UPDATE in psql.
  if (admins.length > 0) return { step: "done" };

  return { step: "claim" };
}

/** Let the caller know onboarding finished, so the next read skips the query. */
export async function markOnboarded() {
  await redis.set(ONBOARDED_KEY, "1");
}

/** Drop the cache when the pending admin is discarded. */
export async function clearOnboardedCache() {
  await redis.del(ONBOARDED_KEY);
}

/**
 * Guard for every page that assumes the app is set up.
 *
 * @remarks Lives in the pages rather than `proxy.ts` because Next's proxy runs
 * without database access and could not answer the question.
 */
export async function requireOnboarded() {
  const state = await getOnboardingState();
  if (state.step !== "done") redirect("/onboarding");
}
