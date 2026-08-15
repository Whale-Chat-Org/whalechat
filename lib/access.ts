/**
 * Access-control vocabulary shared by the server config and the admin UI.
 *
 * @remarks Kept apart from `lib/auth.ts` on purpose: that module pulls in Prisma,
 * Redis and the Resend key, none of which may cross into a client bundle. These
 * are plain strings, so both sides can import them.
 */

/**
 * Ban reason stamped on every self-registered account.
 *
 * Doubles as the marker the admin table reads to tell "never approved" apart
 * from "approved once, revoked later" — both are just `banned = true`.
 */
export const PENDING_APPROVAL_REASON = "Awaiting administrator approval";

/** Ban reason used when an administrator takes access away again. */
export const REVOKED_REASON = "Access revoked by an administrator";

/**
 * Ban reason carried by the first administrator between claiming the instance
 * and entering their license key.
 *
 * @remarks Doing this with a ban rather than a new column is what stops a
 * half-claimed admin signing in through `POST /api/auth/sign-in/email`, which
 * never passes through the page redirects that guard onboarding.
 */
export const ONBOARDING_PENDING_REASON = "Onboarding not completed";

/** Shown at the sign-in attempt of anyone still in the queue. */
export const PENDING_APPROVAL_MESSAGE =
  "Your account is awaiting administrator approval.";

/** The roles this app knows about. Anything else is treated as a plain user. */
export type Role = "user" | "admin";
