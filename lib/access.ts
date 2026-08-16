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

/**
 * The two roles the system guarantees exist.
 *
 * @remarks Marked `system` in the database, which is what stops an administrator
 * deleting or renaming them. `admin` is load-bearing three times over: Better
 * Auth's `adminRoles: ["admin"]` authorizes its own endpoints against it,
 * `isAdmin()` reads it, and `lib/onboarding.ts` derives first-run state from who
 * holds it. Every other role is an ordinary row an administrator can edit.
 */
export const BUILTIN_ROLES = {
  admin: "admin",
  user: "user",
} as const;

/** One of the guaranteed roles. */
export type BuiltinRoleKey = (typeof BUILTIN_ROLES)[keyof typeof BUILTIN_ROLES];

/**
 * A role's stable identifier — `AuthRole.key`.
 *
 * @remarks A plain string, not a union: roles live in Postgres now, so the set
 * is not knowable at compile time. {@link BuiltinRoleKey} narrows it where the
 * value really is fixed.
 */
export type RoleKey = string;

/**
 * Separator Better Auth uses to pack several roles into `User.role`.
 *
 * @remarks `UserRole` is the source of truth; that column is a denormalized
 * mirror of it, written only by `lib/rbac/roles.ts`. The mirror exists because
 * the admin plugin reads the column directly to authorize `listUsers`,
 * `setRole`, `banUser`, `removeUser` and `impersonateUser` — the entire existing
 * portal — and it expects this format.
 */
const ROLE_MIRROR_SEPARATOR = ",";

/** Read the role keys out of a `User.role` mirror. */
export function parseRoleMirror(value: string | null | undefined): RoleKey[] {
  if (!value) return [];

  return [
    ...new Set(
      value
        .split(ROLE_MIRROR_SEPARATOR)
        .map((key) => key.trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * Pack role keys into a `User.role` mirror.
 *
 * @remarks Sorted, so the same set of roles always produces the same string.
 * That makes the column diffable and keeps a no-op assignment from writing a
 * row — worth more than preserving assignment order, which nothing reads.
 * Returns `null` for no roles, because the column is nullable and an empty
 * string would read as a role named "".
 */
export function formatRoleMirror(keys: Iterable<RoleKey>): string | null {
  const unique = [...new Set([...keys].map((key) => key.trim()).filter(Boolean))];
  if (unique.length === 0) return null;

  return unique.sort().join(ROLE_MIRROR_SEPARATOR);
}

/**
 * True when a `User.role` mirror includes the given role.
 *
 * @remarks The replacement for every `role === "admin"` comparison in the
 * codebase. Those were correct only while a user could hold exactly one role: a
 * mirror of `"admin,support"` is an administrator, and equality says otherwise.
 */
export function hasRoleKey(
  mirror: string | null | undefined,
  key: RoleKey
): boolean {
  return parseRoleMirror(mirror).includes(key);
}
