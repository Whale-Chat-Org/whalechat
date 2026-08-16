import { REVOKED_REASON } from "@/lib/access";
import { auth } from "@/lib/auth";
import type { AdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { RbacError } from "@/lib/rbac/errors";
import { setUserRoles } from "@/lib/rbac/roles";
import type { Permission } from "@/lib/rbac/statements";

/**
 * User administration, on our own terms.
 *
 * @remarks These replace Better Auth's admin-plugin endpoints. That plugin
 * resolves permissions synchronously against a role map assembled when
 * `betterAuth()` is called, so it cannot see anything in `auth_role` — a custom
 * role granting `user:list` would still be refused by it. Owning the operations
 * is what makes database roles mean something.
 *
 * The trade is that guards the plugin gave for free now have to be written
 * here: it refused `YOU_CANNOT_BAN_YOURSELF` server-side, and that refusal is
 * re-implemented below rather than left to the disabled buttons in the table.
 *
 * Every mutation goes through `auth.$context.internalAdapter` rather than
 * `prisma.user.update`. Sessions live in Redis and each one carries a copy of
 * the user; the internal adapter refreshes those copies, a direct write does
 * not — so a ban applied with Prisma would leave the banned user's session
 * working until it expired.
 */

/** The internal adapter, which is where the session-aware writes live. */
async function internals() {
  const context = await auth.$context;
  return context.internalAdapter;
}

/** Refuse an action an administrator has aimed at their own account. */
function refuseSelf(actorId: string, targetUserId: string, action: string) {
  if (actorId === targetUserId) {
    throw new RbacError(`You cannot ${action} your own account.`, 403);
  }
}

/**
 * Refuse to remove the last person who can still administer the instance.
 *
 * @remarks Counts holders of `role:assign` who are not banned, excluding the
 * user about to be banned or deleted. Same shape as the guard in
 * `lib/rbac/roles.ts`, and for the same reason: an instance nobody can
 * administer is only recoverable with a `psql` session.
 */
async function assertNotLastAdministrator(targetUserId: string) {
  const remaining = await prisma.user.count({
    where: {
      id: { not: targetUserId },
      banned: { not: true },
      roles: {
        some: {
          role: { permissions: { some: { permission: { key: "role:assign" } } } },
        },
      },
    },
  });

  if (remaining === 0) {
    throw new RbacError(
      "That would leave nobody able to manage roles. Give another active user that permission first.",
      409
    );
  }
}

/** Every user, most recently created first, with the roles they hold. */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      banned: true,
      banReason: true,
      createdAt: true,
      roles: { select: { role: { select: { key: true, name: true } } } },
    },
  });

  return users.map(({ roles, ...user }) => ({
    ...user,
    roles: roles.map((row) => row.role),
  }));
}

interface CreateUserInput {
  actorId: string;
  actorPermissions: Set<Permission>;
  name: string;
  email: string;
  password: string;
  roleKeys: string[];
}

/**
 * Create an account that is active immediately.
 *
 * @remarks Three steps, and the order is forced. `auth.api.createUser` is called
 * without headers — the only form that skips the plugin's own permission check,
 * and the same call `app/onboarding/actions.ts` relies on. The `user.create`
 * hook in `lib/auth.ts` then stamps `banned: true` on it, because that hook
 * cannot tell an administrator's invitation from a self-registration, so the
 * ban has to be lifted afterwards rather than prevented.
 */
export async function createAdminUser({
  actorId,
  actorPermissions,
  name,
  email,
  password,
  roleKeys,
}: CreateUserInput) {
  const created = await auth.api.createUser({
    body: { name, email, password },
  });

  const adapter = await internals();
  await adapter.updateUser(created.user.id, { banned: false, banReason: null });

  if (roleKeys.length > 0) {
    await setUserRoles({
      actorId,
      actorPermissions,
      targetUserId: created.user.id,
      roleKeys,
    });
  }

  return created.user.id;
}

/**
 * Approve a pending account, or revoke an active one.
 *
 * @remarks One column carries three states, which is why the reason is written
 * as well as the flag: `banned` alone cannot tell "never approved" from
 * "approved once, revoked later", and the users table reads the reason to label
 * the difference.
 */
export async function setUserAccess({
  actorId,
  targetUserId,
  allowed,
}: {
  actorId: string;
  targetUserId: string;
  allowed: boolean;
}) {
  refuseSelf(actorId, targetUserId, allowed ? "approve" : "revoke");
  if (!allowed) await assertNotLastAdministrator(targetUserId);

  const adapter = await internals();
  await adapter.updateUser(targetUserId, {
    banned: !allowed,
    banReason: allowed ? null : REVOKED_REASON,
  });
}

/** Delete an account, and by cascade its sessions, chats and role rows. */
export async function deleteAdminUser({
  actorId,
  targetUserId,
}: {
  actorId: string;
  targetUserId: string;
}) {
  refuseSelf(actorId, targetUserId, "delete");
  await assertNotLastAdministrator(targetUserId);

  const adapter = await internals();
  await adapter.deleteUser(targetUserId);
}

/**
 * Sign a user out everywhere.
 *
 * @remarks Allowed against your own account, unlike the others — signing
 * yourself out of other devices is a reasonable thing to want, and the worst
 * case is having to sign in again.
 */
export async function revokeUserSessions(targetUserId: string) {
  const adapter = await internals();
  await adapter.deleteUserSessions(targetUserId);
}
