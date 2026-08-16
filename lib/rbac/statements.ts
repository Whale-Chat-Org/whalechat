/**
 * Every permission this app can enforce, as a closed set.
 *
 * @remarks Deliberately code-owned rather than database-owned. A permission is
 * only real if something checks it, and the things that check it are route
 * handlers and pages — so the vocabulary lives next to them and the database
 * holds a mirror. An administrator composes roles out of these; they can never
 * invent a permission string that no code path reads.
 *
 * Client-safe by construction: string literals and one plain object, no imports.
 * `<RoleDialog>` renders the matrix straight from `STATEMENTS`, so this module
 * crosses into the browser bundle and must stay free of Prisma, Redis and
 * Better Auth. That last one is the non-obvious constraint — Better Auth's own
 * `defaultStatements` lives in `better-auth/plugins/admin/access`, which pulls
 * `createAccessControl` in with it. The `user` and `session` entries below are
 * copied from it by hand, and `statements.test.ts` fails if the copy ever drifts.
 */

/**
 * Resources, and the actions each one permits.
 *
 * @remarks `user` and `session` mirror Better Auth's admin plugin exactly — the
 * plugin authorizes its own endpoints against these names, so renaming one here
 * silently stops matching there. `role` is ours.
 *
 * There is no `chat` resource, and that is on purpose. Chat access is ownership,
 * not capability: `lib/chats.ts` puts `userId` *inside* every `where` clause, so
 * another user's chat id matches zero rows. A permission check would be a weaker
 * guarantee bolted onto a stronger one.
 */
export const STATEMENTS = {
  user: [
    "create",
    "list",
    "get",
    "update",
    "delete",
    "set-role",
    "set-password",
    "set-email",
    "ban",
    "impersonate",
    "impersonate-admins",
  ],
  session: ["list", "revoke", "delete"],
  role: ["list", "create", "update", "delete", "assign"],
} as const;

/** A thing permissions are granted over. */
export type Resource = keyof typeof STATEMENTS;

/** The actions permitted on one resource. */
export type Action<R extends Resource = Resource> =
  (typeof STATEMENTS)[R][number];

/**
 * One permission, as the `resource:action` string used everywhere.
 *
 * @remarks Distributed over `Resource` so each resource only pairs with its own
 * actions — `"role:ban"` is a type error, not a runtime surprise. Adding an
 * action to {@link STATEMENTS} widens this union with no other edit.
 */
export type Permission = {
  [R in Resource]: `${R}:${Action<R>}`;
}[Resource];

/** Build a permission key from its halves. */
export function formatPermission<R extends Resource>(
  resource: R,
  action: Action<R>
): Permission {
  return `${resource}:${action}` as Permission;
}

/**
 * Split a permission key back into its halves.
 *
 * @remarks Returns `null` rather than throwing for anything unrecognised. The
 * callers are the seed reconciling the database and the route handlers reading
 * request bodies, and both want to reject an unknown key as data rather than
 * crash on it.
 */
export function parsePermission(
  key: string
): { resource: Resource; action: string } | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;

  const resource = key.slice(0, separator);
  const action = key.slice(separator + 1);
  if (!isResource(resource)) return null;

  const actions: readonly string[] = STATEMENTS[resource];
  return actions.includes(action) ? { resource, action } : null;
}

/** Narrow an arbitrary string to a known resource. */
export function isResource(value: string): value is Resource {
  return Object.hasOwn(STATEMENTS, value);
}

/**
 * Narrow an arbitrary string to a known permission.
 *
 * @remarks The gate between the wire and the rest of the module. Anything
 * arriving from a request body or a database row goes through here first, so no
 * unknown key can reach a grant.
 */
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && parsePermission(value) !== null;
}

/**
 * Every permission, flattened.
 *
 * @remarks What `prisma/seed.ts` reconciles the `auth_permission` table against,
 * and what the `admin` role is granted in full.
 */
export const ALL_PERMISSIONS: readonly Permission[] = Object.entries(
  STATEMENTS
).flatMap(([resource, actions]) =>
  actions.map((action) => `${resource}:${action}` as Permission)
);

/**
 * Keep only the permissions in `requested` that `granted` also holds.
 *
 * @remarks The anti-escalation rule, kept pure so it can be tested without a
 * database: you cannot grant a role a permission you do not hold yourself.
 * Without it `role:create` quietly means *every* permission, because the first
 * thing an attacker with it does is mint a role holding everything else.
 *
 * Returns the rejected keys alongside the allowed ones so the caller can say
 * which ones it refused rather than failing opaquely.
 */
export function filterGrantablePermissions(
  granted: Iterable<Permission>,
  requested: Iterable<Permission>
): { allowed: Permission[]; rejected: Permission[] } {
  const held = new Set(granted);
  const allowed: Permission[] = [];
  const rejected: Permission[] = [];

  for (const permission of requested) {
    (held.has(permission) ? allowed : rejected).push(permission);
  }

  return { allowed, rejected };
}

/** Human-readable resource names for the permission matrix. */
export const RESOURCE_LABELS: Record<Resource, string> = {
  user: "Users",
  session: "Sessions",
  role: "Roles",
};
