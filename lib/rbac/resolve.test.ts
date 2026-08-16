import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyGrants = vi.fn();
const findVersion = vi.fn();
const upsertVersion = vi.fn();

const redisGet = vi.fn();
const redisSet = vi.fn();
const redisDel = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolePermission: { findMany: () => findManyGrants() },
    accessVersion: {
      findUnique: () => findVersion(),
      upsert: () => upsertVersion(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: (key: string) => redisGet(key),
    set: (...args: unknown[]) => redisSet(...args),
    del: (key: string) => redisDel(key),
  },
}));

const { bumpAccessVersion, readAccessVersion, resolvePermissions } =
  await import("./resolve");

/** Shapes a grant row the way the `select` in `readPermissions` does. */
const grant = (key: string) => ({ permission: { key } });

beforeEach(() => {
  vi.clearAllMocks();
  redisGet.mockResolvedValue(null);
  redisSet.mockResolvedValue("OK");
  redisDel.mockResolvedValue(1);
  findVersion.mockResolvedValue({ version: BigInt(7) });
  findManyGrants.mockResolvedValue([grant("user:list"), grant("role:list")]);
});

describe("readAccessVersion", () => {
  it("prefers the cached value", async () => {
    redisGet.mockResolvedValue("42");

    expect(await readAccessVersion()).toBe("42");
    expect(findVersion).not.toHaveBeenCalled();
  });

  it("falls back to Postgres and caches the result", async () => {
    expect(await readAccessVersion()).toBe("7");
    expect(redisSet).toHaveBeenCalled();
  });

  it("reads a missing row as version 1 rather than creating one", async () => {
    // This runs on every permission check. A read path that writes is a read
    // path that can fail, and failing here would deny everyone.
    findVersion.mockResolvedValue(null);

    expect(await readAccessVersion()).toBe("1");
  });
});

describe("resolvePermissions", () => {
  it("reads Postgres on a cold cache and writes the result back", async () => {
    const permissions = await resolvePermissions("u1");

    expect([...permissions].sort()).toEqual(["role:list", "user:list"]);
    expect(findManyGrants).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalled();
  });

  it("serves a cached set without touching Postgres", async () => {
    redisGet.mockImplementation(async (key: string) =>
      key.includes("perms") ? JSON.stringify(["user:list"]) : "7"
    );

    expect([...(await resolvePermissions("u1"))]).toEqual(["user:list"]);
    expect(findManyGrants).not.toHaveBeenCalled();
  });

  it("ignores a cached key the code no longer defines", async () => {
    // A grant left over from a renamed permission must not resolve to anything,
    // because no code path checks for it any more.
    redisGet.mockImplementation(async (key: string) =>
      key.includes("perms") ? JSON.stringify(["user:list", "billing:read"]) : "7"
    );

    expect([...(await resolvePermissions("u1"))]).toEqual(["user:list"]);
  });

  it("recomputes rather than trusting an unparseable entry", async () => {
    redisGet.mockImplementation(async (key: string) =>
      key.includes("perms") ? "{ not json" : "7"
    );

    expect((await resolvePermissions("u1")).size).toBe(2);
    expect(findManyGrants).toHaveBeenCalledTimes(1);
  });

  it("still answers from Postgres when Redis is down", async () => {
    // The property the whole module is built around: a cache failure must never
    // become a verdict. Denying here would lock the only administrator out of
    // their instance the first time Redis restarts.
    redisGet.mockRejectedValue(new Error("ECONNREFUSED"));
    redisSet.mockRejectedValue(new Error("ECONNREFUSED"));

    expect((await resolvePermissions("u1")).size).toBe(2);
  });

  it("holds the union of every role's grants", async () => {
    findManyGrants.mockResolvedValue([
      grant("user:list"),
      grant("role:list"),
      grant("role:assign"),
    ]);

    expect((await resolvePermissions("u1")).size).toBe(3);
  });

  it("is empty for a user with no roles, without erroring", async () => {
    findManyGrants.mockResolvedValue([]);

    expect((await resolvePermissions("u1")).size).toBe(0);
  });
});

describe("bumpAccessVersion", () => {
  it("increments the row and drops the cached version", async () => {
    await bumpAccessVersion();

    expect(upsertVersion).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledWith("whalechat:rbac:version");
  });

  it("moves cached sets into an unreachable namespace", async () => {
    // Invalidation is namespacing, not deletion: after a bump every reader
    // looks under a new prefix, so the old entries can never be read again.
    redisGet.mockImplementation(async (key: string) =>
      key.includes("perms") ? JSON.stringify(["user:list"]) : "7"
    );
    await resolvePermissions("u1");
    const keyBefore = redisGet.mock.calls.at(-1)?.[0] as string;

    redisGet.mockImplementation(async (key: string) =>
      key.includes("perms") ? null : "8"
    );
    await resolvePermissions("u1");
    const keyAfter = redisGet.mock.calls.at(-1)?.[0] as string;

    expect(keyBefore).toContain("v7");
    expect(keyAfter).toContain("v8");
    expect(keyAfter).not.toBe(keyBefore);
  });
});
