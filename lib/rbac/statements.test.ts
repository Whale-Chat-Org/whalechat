import { defaultStatements } from "better-auth/plugins/admin/access";
import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  STATEMENTS,
  filterGrantablePermissions,
  formatPermission,
  isPermission,
  parsePermission,
  RESOURCE_LABELS,
  type Permission,
} from "./statements";

describe("STATEMENTS", () => {
  it("covers every action Better Auth's admin plugin declares", () => {
    // `lib/rbac/statements.ts` copies these by hand rather than importing them,
    // because importing `better-auth/plugins/admin/access` drags
    // `createAccessControl` into the client bundle. This is the check that the
    // copy has not drifted — importing it here is fine, tests run in node.
    for (const [resource, actions] of Object.entries(defaultStatements)) {
      const ours: readonly string[] =
        STATEMENTS[resource as keyof typeof STATEMENTS] ?? [];

      for (const action of actions) {
        expect(
          ours,
          `${resource}:${action} is missing from STATEMENTS`
        ).toContain(action);
      }
    }
  });

  it("has a label for every resource", () => {
    for (const resource of Object.keys(STATEMENTS)) {
      expect(RESOURCE_LABELS).toHaveProperty(resource);
    }
  });
});

describe("ALL_PERMISSIONS", () => {
  it("is one entry per resource-action pair", () => {
    const expected = Object.values(STATEMENTS).reduce(
      (total, actions) => total + actions.length,
      0
    );

    expect(ALL_PERMISSIONS).toHaveLength(expected);
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("holds only keys that parse back", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(parsePermission(permission), permission).not.toBeNull();
    }
  });
});

describe("parsePermission", () => {
  it("splits a known key", () => {
    expect(parsePermission("user:list")).toEqual({
      resource: "user",
      action: "list",
    });
  });

  it("round-trips with formatPermission", () => {
    expect(formatPermission("role", "assign")).toBe("role:assign");
    expect(parsePermission(formatPermission("role", "assign"))).toEqual({
      resource: "role",
      action: "assign",
    });
  });

  it("rejects an unknown resource or action", () => {
    expect(parsePermission("billing:read")).toBeNull();
    expect(parsePermission("user:launch-missiles")).toBeNull();
  });

  it("rejects malformed keys rather than throwing", () => {
    expect(parsePermission("user")).toBeNull();
    expect(parsePermission(":list")).toBeNull();
    expect(parsePermission("")).toBeNull();
  });
});

describe("isPermission", () => {
  it("narrows only known keys", () => {
    expect(isPermission("user:list")).toBe(true);
    expect(isPermission("user:everything")).toBe(false);
    expect(isPermission(42)).toBe(false);
    expect(isPermission(null)).toBe(false);
  });
});

describe("filterGrantablePermissions", () => {
  const held: Permission[] = ["user:list", "role:list"];

  it("allows what the granter holds", () => {
    const { allowed, rejected } = filterGrantablePermissions(held, [
      "user:list",
    ]);

    expect(allowed).toEqual(["user:list"]);
    expect(rejected).toEqual([]);
  });

  it("rejects what the granter does not hold", () => {
    // The escalation this exists to stop: holding `role:create` would otherwise
    // amount to holding every permission, since the first thing it can do is
    // mint a role granting the rest.
    const { allowed, rejected } = filterGrantablePermissions(held, [
      "user:delete",
    ]);

    expect(allowed).toEqual([]);
    expect(rejected).toEqual(["user:delete"]);
  });

  it("separates a mixed request rather than failing it whole", () => {
    const { allowed, rejected } = filterGrantablePermissions(held, [
      "user:list",
      "user:delete",
    ]);

    expect(allowed).toEqual(["user:list"]);
    expect(rejected).toEqual(["user:delete"]);
  });

  it("allows granting nothing", () => {
    expect(filterGrantablePermissions(held, [])).toEqual({
      allowed: [],
      rejected: [],
    });
  });

  it("lets a holder of everything grant anything", () => {
    const { rejected } = filterGrantablePermissions(
      ALL_PERMISSIONS,
      ALL_PERMISSIONS
    );

    expect(rejected).toEqual([]);
  });

  it("never lets an empty granter grant", () => {
    const { allowed } = filterGrantablePermissions([], ALL_PERMISSIONS);
    expect(allowed).toEqual([]);
  });
});
