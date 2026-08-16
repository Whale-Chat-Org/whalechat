/**
 * Reconcile the RBAC tables with the permissions defined in code.
 *
 * @remarks Run it on every deploy — `npm run db:seed`. It is idempotent, keyed
 * on `AuthPermission.key` and `AuthRole.key`, so a second run is a no-op.
 *
 * The direction of trust is one-way: `lib/rbac/statements.ts` is the closed set,
 * and `auth_permission` is a mirror of it that exists so roles have something to
 * foreign-key against. Nothing here reads the database to decide what a
 * permission is.
 *
 * Runs outside Next, so it opens its own client rather than importing the
 * `lib/prisma.ts` singleton — that module's global caching exists to survive the
 * dev server's module reloads, which a one-shot script does not have.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "@/generated/prisma/client";
import { BUILTIN_ROLES } from "@/lib/access";
import { ALL_PERMISSIONS, parsePermission } from "@/lib/rbac/statements";

// Same order as prisma.config.ts: the CLI runs outside Next, so nothing has
// loaded the environment for it, and Next prefers .env.local over .env.
config({ path: [".env.local", ".env"], quiet: true });

/**
 * Definitions for the roles the system guarantees.
 *
 * @remarks `admin` is reconciled to *every* permission on every run, which is
 * the point: a permission added in code must not leave the only administrator
 * unable to use the feature it guards.
 *
 * `user` is created empty and then left alone. It is the role every sign-up
 * receives, and an administrator granting it something is a legitimate choice
 * this script must not keep reverting.
 */
const SYSTEM_ROLES = [
  {
    key: BUILTIN_ROLES.admin,
    name: "Administrator",
    description: "Full access to every part of the instance.",
    grantsEverything: true,
  },
  {
    key: BUILTIN_ROLES.user,
    name: "Member",
    description: "Can use the chat. No administrative access.",
    grantsEverything: false,
  },
] as const;

async function main() {
  // Removing a permission from code does not remove it from the database by
  // default: that cascade would silently drop grants an administrator made
  // deliberately, and a rename looks exactly like a removal from here. Pruning
  // is a decision someone makes on purpose.
  const prune = process.argv.includes("--prune");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await prisma.authPermission.createMany({
      data: ALL_PERMISSIONS.map((key) => {
        const parsed = parsePermission(key);
        if (!parsed) throw new Error(`Unparseable permission: ${key}`);
        return { key, resource: parsed.resource, action: parsed.action };
      }),
      skipDuplicates: true,
    });

    const stored = await prisma.authPermission.findMany({
      select: { id: true, key: true },
    });

    const known = new Set<string>(ALL_PERMISSIONS);
    const orphaned = stored.filter((permission) => !known.has(permission.key));

    if (orphaned.length > 0) {
      const keys = orphaned.map((permission) => permission.key).join(", ");
      if (prune) {
        await prisma.authPermission.deleteMany({
          where: { id: { in: orphaned.map((permission) => permission.id) } },
        });
        console.warn(`Pruned ${orphaned.length} permission(s): ${keys}`);
      } else {
        console.warn(
          `${orphaned.length} permission(s) exist in the database but not in code: ${keys}\n` +
            "They are still grantable and nothing enforces them. Re-run with --prune to remove them."
        );
      }
    }

    const permissionIds = stored
      .filter((permission) => known.has(permission.key))
      .map((permission) => permission.id);

    for (const role of SYSTEM_ROLES) {
      const stored = await prisma.authRole.upsert({
        where: { key: role.key },
        // Name and description are editable in the portal, so only the fields
        // that carry meaning for the code are forced back into line.
        update: { system: true },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          system: true,
        },
        select: { id: true },
      });

      if (!role.grantsEverything) continue;

      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: stored.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    // The cache epoch. Created rather than bumped: a fresh row starts every
    // permission namespace empty, and re-running the seed must not invalidate a
    // healthy cache for no reason.
    await prisma.accessVersion.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, version: BigInt(1) },
    });

    const [roles, permissions] = await Promise.all([
      prisma.authRole.count(),
      prisma.authPermission.count(),
    ]);
    console.log(`Seeded RBAC: ${permissions} permissions, ${roles} roles.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
