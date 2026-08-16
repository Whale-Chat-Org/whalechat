import type { Prisma } from "@/generated/prisma/client";
import {
  BUILTIN_ROLES,
  formatRoleMirror,
  parseRoleMirror,
  type RoleKey,
} from "@/lib/access";
import type { AdminRole } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { RbacError } from "@/lib/rbac/errors";
import { bumpAccessVersion } from "@/lib/rbac/resolve";
import {
  filterGrantablePermissions,
  isPermission,
  type Permission,
} from "@/lib/rbac/statements";

/**
 * Every write that touches who holds which role, and the only writer of
 * `User.role`.
 *
 * @remarks `UserRole` is the source of truth; `User.role` is a mirror of it that
 * exists because Better Auth's admin plugin reads that column directly. Keeping
 * both correct is this module's whole job, which is why nothing outside it may
 * write either one.
 *
 * The actor's own permissions are an argument to every operation and are applied
 * *inside* it, following the rule `lib/chats.ts` sets for ownership: the check
 * is part of the write, never a read followed by an `if`.
 */

/**
 * The permission that makes an instance repairable.
 *
 * @remarks Whoever holds it can hand out every other role, so it is the one that
 * must never reach zero non-banned holders. Same reasoning as
 * `lib/onboarding.ts`'s refusal to reopen the claim: a state you cannot get out
 * of without a `psql` session is not a state the app may enter on its own.
 */
const KEYSTONE_PERMISSION: Permission = "role:assign";

/** The role keys a user currently holds, straight from the join table. */
export async function readRoleKeys(
  userId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<RoleKey[]> {
  const rows = await tx.userRole.findMany({
    where: { userId },
    select: { role: { select: { key: true } } },
  });

  return rows.map((row) => row.role.key);
}

/**
 * Rewrite `User.role` from the join table.
 *
 * @remarks Goes through Better Auth's internal adapter rather than
 * `prisma.user.update`, and that is not a style choice. Sessions live in Redis
 * as secondary storage, and each cached session carries a **copy of the user
 * object**. `internalAdapter.updateUser` calls `refreshUserSessions`, which
 * rewrites that copy in every live session; a direct Prisma write does not, so
 * `session.user.role` would keep reporting the old roles until the session
 * expired — up to seven days.
 *
 * The import is deferred because `lib/auth.ts` imports this module for its
 * create hook. A top-level import would close the cycle at module-evaluation
 * time; this one resolves after both modules exist.
 */
export async function syncRoleMirror(userId: string): Promise<string | null> {
  const mirror = formatRoleMirror(await readRoleKeys(userId));
  const { auth } = await import("@/lib/auth");

  await auth.$context.then((context) =>
    context.internalAdapter.updateUser(userId, { role: mirror })
  );

  return mirror;
}

/**
 * Create the join-table rows for a user who already has a mirror.
 *
 * @remarks The one place the mirror is authoritative, and only because nothing
 * else exists yet: Better Auth's admin plugin stamps `role` during creation —
 * `defaultRole` for a sign-up, the explicit value for
 * `auth.api.createUser({ role: "admin" })` in `app/onboarding/actions.ts`. This
 * runs from the `user.create.after` hook in `lib/auth.ts` and turns that stamp
 * into rows, so a brand-new account is never a mirror with nothing behind it.
 *
 * Silently ignores keys with no matching role. A mirror naming a role that does
 * not exist grants nothing either way, and throwing here would fail the sign-up
 * itself.
 */
export async function adoptRolesFromMirror(
  userId: string,
  mirror: string | null | undefined
): Promise<void> {
  const keys = parseRoleMirror(mirror);
  if (keys.length === 0) return;

  const roles = await prisma.authRole.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  if (roles.length === 0) return;

  await prisma.userRole.createMany({
    data: roles.map((role) => ({ userId, roleId: role.id })),
    skipDuplicates: true,
  });
}

/**
 * Refuse to leave the instance without anyone who can repair it.
 *
 * @remarks Runs inside the transaction, *after* the write, so it sees the state
 * the caller is proposing rather than the one before it. Banned users do not
 * count — they cannot sign in, so a permission they hold is not reachable.
 */
async function assertStillAdministrable(tx: Prisma.TransactionClient) {
  const holders = await tx.user.count({
    where: {
      banned: { not: true },
      roles: {
        some: {
          role: {
            permissions: {
              some: { permission: { key: KEYSTONE_PERMISSION } },
            },
          },
        },
      },
    },
  });

  if (holders === 0) {
    throw new RbacError(
      `That would leave nobody able to manage roles. At least one active user must keep "${KEYSTONE_PERMISSION}".`,
      409
    );
  }
}

/** The permissions a set of roles grants, by role id. */
async function grantsOfRoles(
  tx: Prisma.TransactionClient,
  roleIds: string[]
): Promise<Permission[]> {
  const rows = await tx.rolePermission.findMany({
    where: { roleId: { in: roleIds } },
    select: { permission: { select: { key: true } } },
    distinct: ["permissionId"],
  });

  return rows
    .map((row) => row.permission.key)
    .filter((key): key is Permission => isPermission(key));
}

interface SetUserRolesInput {
  /** The signed-in user performing the change. */
  actorId: string;
  /** What that user may do, resolved from the database. */
  actorPermissions: Set<Permission>;
  targetUserId: string;
  /** The complete set of roles the target should end up with. */
  roleKeys: RoleKey[];
}

/**
 * Replace a user's roles.
 *
 * @remarks Whole-set rather than add/remove: the UI edits a checkbox list, and
 * a single authoritative write cannot interleave with another admin's edit to
 * leave a half-applied result.
 */
export async function setUserRoles({
  actorId,
  actorPermissions,
  targetUserId,
  roleKeys,
}: SetUserRolesInput): Promise<RoleKey[]> {
  // Nobody promotes themselves. The `isSelf` guards in the users table are the
  // cosmetic half of this; refusing here is what actually holds.
  if (actorId === targetUserId) {
    throw new RbacError("You cannot change your own roles.", 403);
  }

  const requested = [...new Set(roleKeys)];

  return prisma.$transaction(async (tx) => {
    const roles = await tx.authRole.findMany({
      where: { key: { in: requested } },
      select: { id: true, key: true },
    });

    const missing = requested.filter(
      (key) => !roles.some((role) => role.key === key)
    );
    if (missing.length > 0) {
      throw new RbacError(`No such role: ${missing.join(", ")}.`, 400);
    }

    // You may only hand out access you already have. Without this, holding
    // `role:assign` is indistinguishable from holding everything: assign a
    // confederate a role you cannot use yourself and the grant is laundered.
    const granted = await grantsOfRoles(
      tx,
      roles.map((role) => role.id)
    );
    const { rejected } = filterGrantablePermissions(actorPermissions, granted);
    if (rejected.length > 0) {
      throw new RbacError(
        `You cannot grant permissions you do not hold: ${rejected.join(", ")}.`,
        403
      );
    }

    await tx.userRole.deleteMany({
      where: { userId: targetUserId, roleId: { notIn: roles.map((r) => r.id) } },
    });
    await tx.userRole.createMany({
      data: roles.map((role) => ({
        userId: targetUserId,
        roleId: role.id,
        assignedBy: actorId,
      })),
      skipDuplicates: true,
    });

    await assertStillAdministrable(tx);
    await bumpAccessVersion(tx);

    return roles.map((role) => role.key);
  }).then(async (keys) => {
    // After the commit, never inside it: this reaches Redis to refresh the
    // cached copy of the user in every live session, and a rolled-back
    // transaction must not leave that copy rewritten.
    await syncRoleMirror(targetUserId);
    return keys;
  });
}

/**
 * True when the role is one the system guarantees.
 *
 * @remarks `admin` and `user` are referenced by key from `lib/auth.ts`
 * (`adminRoles`), `lib/onboarding.ts` and `prisma/seed.ts`. Renaming or deleting
 * one breaks those by silent mismatch rather than by error, so the database
 * refuses instead.
 */
export function isBuiltinRoleKey(key: RoleKey): boolean {
  return Object.values(BUILTIN_ROLES).some((builtin) => builtin === key);
}

/** Every role, with what it grants and how many people hold it. */
export async function listRoles(): Promise<AdminRole[]> {
  const roles = await prisma.authRole.findMany({
    orderBy: [{ system: "desc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      system: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    system: role.system,
    permissions: role.permissions
      .map((row) => row.permission.key)
      .filter((key): key is Permission => isPermission(key))
      .sort(),
    userCount: role._count.users,
  }));
}

/**
 * Reject any requested permission the actor does not hold themselves.
 *
 * @remarks The rule that stops `role:create` from silently meaning *every*
 * permission — otherwise the first move of anyone holding it is to mint a role
 * granting everything else and assign it onward.
 */
function assertGrantable(
  actorPermissions: Set<Permission>,
  requested: Permission[]
) {
  const { rejected } = filterGrantablePermissions(actorPermissions, requested);
  if (rejected.length > 0) {
    throw new RbacError(
      `You cannot grant permissions you do not hold: ${rejected.join(", ")}.`,
      403
    );
  }
}

/** Replace a role's grants, inside a transaction the caller already owns. */
async function writeGrants(
  tx: Prisma.TransactionClient,
  roleId: string,
  permissions: Permission[]
) {
  const rows = await tx.authPermission.findMany({
    where: { key: { in: permissions } },
    select: { id: true },
  });

  await tx.rolePermission.deleteMany({
    where: { roleId, permissionId: { notIn: rows.map((row) => row.id) } },
  });
  await tx.rolePermission.createMany({
    data: rows.map((row) => ({ roleId, permissionId: row.id })),
    skipDuplicates: true,
  });
}

interface RoleInput {
  actorPermissions: Set<Permission>;
  name: string;
  description: string | null;
  permissions: Permission[];
}

/** Create a role granting a subset of what the actor holds. */
export async function createRole({
  actorPermissions,
  key,
  name,
  description,
  permissions,
}: RoleInput & { key: RoleKey }): Promise<string> {
  assertGrantable(actorPermissions, permissions);

  if (!/^[a-z][a-z0-9-]{1,30}$/.test(key)) {
    throw new RbacError(
      "A role key must be lower-case letters, digits and hyphens, starting with a letter.",
      400
    );
  }

  const existing = await prisma.authRole.findUnique({ where: { key } });
  if (existing) throw new RbacError(`A role named "${key}" already exists.`, 409);

  return prisma.$transaction(async (tx) => {
    const role = await tx.authRole.create({
      data: { key, name, description, system: false },
      select: { id: true },
    });

    await writeGrants(tx, role.id, permissions);
    await bumpAccessVersion(tx);

    return role.id;
  });
}

/**
 * Rename a role and replace its grants.
 *
 * @remarks The key is never editable. It is what `User.role` mirrors and what
 * `lib/auth.ts`, `lib/onboarding.ts` and the seed compare against, so changing
 * it would have to rewrite every mirror in the same breath — and a role that
 * needs a different key is a different role.
 */
export async function updateRole({
  actorPermissions,
  roleId,
  name,
  description,
  permissions,
}: RoleInput & { roleId: string }): Promise<void> {
  assertGrantable(actorPermissions, permissions);

  const role = await prisma.authRole.findUnique({
    where: { id: roleId },
    select: { key: true, system: true },
  });
  if (!role) throw new RbacError("No such role.", 404);

  // `admin` must keep every permission: the seed re-grants them all on the next
  // run anyway, and an admin role missing one is an instance whose owner cannot
  // use a feature they own.
  if (role.key === BUILTIN_ROLES.admin) {
    throw new RbacError(
      "The administrator role always holds every permission and cannot be edited.",
      409
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.authRole.update({
      where: { id: roleId },
      data: { name, description },
    });

    await writeGrants(tx, roleId, permissions);
    await assertStillAdministrable(tx);
    await bumpAccessVersion(tx);
  });
}

/** Delete a role, and every assignment of it. */
export async function deleteRole({
  roleId,
}: {
  roleId: string;
}): Promise<void> {
  const role = await prisma.authRole.findUnique({
    where: { id: roleId },
    select: { key: true, system: true, users: { select: { userId: true } } },
  });
  if (!role) throw new RbacError("No such role.", 404);

  if (role.system) {
    throw new RbacError(
      `"${role.key}" is a built-in role and cannot be deleted.`,
      409
    );
  }

  await prisma.$transaction(async (tx) => {
    // The cascade takes the `UserRole` rows with it, which is why the holders
    // were read above: application code does not run for a database cascade, so
    // their mirrors have to be rebuilt explicitly afterwards.
    await tx.authRole.delete({ where: { id: roleId } });
    await assertStillAdministrable(tx);
    await bumpAccessVersion(tx);
  });

  for (const holder of role.users) {
    await syncRoleMirror(holder.userId);
  }
}
