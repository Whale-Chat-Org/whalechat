import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isPermission, type Permission } from "@/lib/rbac/statements";
import { redis } from "@/lib/redis";

/**
 * Turn a user id into the set of permissions they hold.
 *
 * @remarks Postgres is the only thing that can produce an answer here. Redis is
 * in front of it, and every path through this module treats a cache problem as
 * "ask Postgres again" rather than as a verdict — there is deliberately no
 * branch that returns an empty set on a cache miss, because that locks the only
 * administrator out of their own instance the first time Redis restarts.
 */

/** How long a resolved permission set may sit in Redis. */
const PERMISSIONS_TTL_SECONDS = 300;

/**
 * How long the access version may sit in Redis.
 *
 * @remarks The upper bound on how long a grant edit can take to be seen by an
 * instance that did not perform it. Short, because it is one integer read and
 * the whole point of the version is to be current. Bumps also delete this key,
 * so the TTL only matters when that delete fails.
 */
const VERSION_TTL_SECONDS = 10;

const VERSION_KEY = "whalechat:rbac:version";

/** The single row's id. There is only ever one. */
const VERSION_ROW_ID = 1;

function permissionsKey(version: string, userId: string) {
  return `whalechat:rbac:v${version}:perms:${userId}`;
}

/**
 * Run a Redis call, treating any failure as a miss.
 *
 * @remarks Redis is a cache and a coordination surface, never a source of
 * truth — see docs/architecture.md. Swallowing the error here is what keeps a
 * Redis outage from becoming an authorization outage.
 */
async function tryRedis<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

/**
 * The current access version, as a string.
 *
 * @remarks Read through Redis, but the row is authoritative. A missing row
 * reads as version 1 rather than creating one: this runs on every permission
 * check, and a read path that writes is a read path that can fail.
 */
export async function readAccessVersion(): Promise<string> {
  const cached = await tryRedis(() => redis.get(VERSION_KEY));
  if (cached) return cached;

  const row = await prisma.accessVersion.findUnique({
    where: { id: VERSION_ROW_ID },
    select: { version: true },
  });
  const version = (row?.version ?? BigInt(1)).toString();

  await tryRedis(() =>
    redis.set(VERSION_KEY, version, "EX", VERSION_TTL_SECONDS)
  );
  return version;
}

/**
 * Invalidate every cached permission set.
 *
 * @remarks Call inside the same transaction as any write to a role, a grant or
 * an assignment, so a committed change can never be paired with a stale cache.
 *
 * One increment replaces a fan-out. Editing a role's grants changes the
 * effective permissions of everyone holding it, and enumerating those holders
 * to delete their keys is both an extra query and a race — a resolution already
 * in flight can write the old set back in after the delete. Bumping the version
 * moves every reader to a namespace that has nothing in it yet, atomically.
 *
 * The keys left behind in the old namespace are unreachable and expire on their
 * own TTL.
 */
export async function bumpAccessVersion(
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  await tx.accessVersion.upsert({
    where: { id: VERSION_ROW_ID },
    create: { id: VERSION_ROW_ID, version: BigInt(2) },
    update: { version: { increment: BigInt(1) } },
  });

  // Drop the cached version so the next read sees the bump immediately rather
  // than up to VERSION_TTL_SECONDS later. If this fails the TTL still bounds it,
  // which is why it is not worth a retry.
  await tryRedis(() => redis.del(VERSION_KEY));
}

/** Read a user's permissions straight from Postgres. */
async function readPermissions(userId: string): Promise<Permission[]> {
  const grants = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    select: { permission: { select: { key: true } } },
    distinct: ["permissionId"],
  });

  // `isPermission` is the gate between the table and the rest of the module. A
  // key the code no longer defines grants nothing, however it got into the row.
  return grants
    .map((grant) => grant.permission.key)
    .filter((key): key is Permission => isPermission(key));
}

/**
 * Every permission a user holds, through every role they have.
 *
 * @remarks The union across roles, so holding two roles grants the sum of both.
 * There is no deny rule and no precedence to reason about: a permission is held
 * or it is not.
 */
export async function resolvePermissions(
  userId: string
): Promise<Set<Permission>> {
  const version = await readAccessVersion();
  const key = permissionsKey(version, userId);

  const cached = await tryRedis(() => redis.get(key));
  if (cached) {
    try {
      const parsed: unknown = JSON.parse(cached);
      if (Array.isArray(parsed)) return new Set(parsed.filter(isPermission));
    } catch {
      // Unparseable entry — fall through and recompute rather than trust it.
    }
  }

  const permissions = await readPermissions(userId);

  await tryRedis(() =>
    redis.set(
      key,
      JSON.stringify(permissions),
      "EX",
      PERMISSIONS_TTL_SECONDS
    )
  );

  return new Set(permissions);
}
