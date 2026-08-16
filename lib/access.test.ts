import { describe, expect, it } from "vitest";
import {
  BUILTIN_ROLES,
  formatRoleMirror,
  hasRoleKey,
  parseRoleMirror,
} from "./access";

describe("parseRoleMirror", () => {
  it("reads nothing out of an absent mirror", () => {
    expect(parseRoleMirror(null)).toEqual([]);
    expect(parseRoleMirror(undefined)).toEqual([]);
    expect(parseRoleMirror("")).toEqual([]);
  });

  it("splits several roles apart", () => {
    expect(parseRoleMirror("admin,support")).toEqual(["admin", "support"]);
  });

  it("trims padding and drops empty segments", () => {
    // A trailing comma is what a naive join of an empty list produces, and it
    // would otherwise read as a role whose key is the empty string.
    expect(parseRoleMirror(" admin , support ,, ")).toEqual([
      "admin",
      "support",
    ]);
  });

  it("does not repeat a role listed twice", () => {
    expect(parseRoleMirror("admin,admin")).toEqual(["admin"]);
  });
});

describe("formatRoleMirror", () => {
  it("is null for no roles, so the column stays honestly empty", () => {
    expect(formatRoleMirror([])).toBeNull();
  });

  it("sorts, so the same set always writes the same string", () => {
    expect(formatRoleMirror(["support", "admin"])).toBe("admin,support");
    expect(formatRoleMirror(["admin", "support"])).toBe("admin,support");
  });

  it("deduplicates", () => {
    expect(formatRoleMirror(["admin", "admin"])).toBe("admin");
  });

  it("round-trips through parseRoleMirror", () => {
    const keys = ["support", "admin", "auditor"];
    expect(parseRoleMirror(formatRoleMirror(keys))).toEqual([
      "admin",
      "auditor",
      "support",
    ]);
  });
});

describe("hasRoleKey", () => {
  it("finds the only role", () => {
    expect(hasRoleKey("admin", BUILTIN_ROLES.admin)).toBe(true);
  });

  it("finds a role alongside others", () => {
    // The regression the old `role === "admin"` check could not survive: an
    // administrator who also holds a second role was reported as not one.
    expect(hasRoleKey("admin,support", BUILTIN_ROLES.admin)).toBe(true);
    expect(hasRoleKey("support,admin", BUILTIN_ROLES.admin)).toBe(true);
  });

  it("does not match a role that merely contains the key", () => {
    // Guards against anyone reaching for `mirror.includes("admin")`, which
    // would promote every one of these.
    expect(hasRoleKey("superadmin", BUILTIN_ROLES.admin)).toBe(false);
    expect(hasRoleKey("administrator", BUILTIN_ROLES.admin)).toBe(false);
    expect(hasRoleKey("admin-readonly", BUILTIN_ROLES.admin)).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(hasRoleKey("Admin", BUILTIN_ROLES.admin)).toBe(false);
  });

  it("is false for no mirror at all", () => {
    expect(hasRoleKey(null, BUILTIN_ROLES.admin)).toBe(false);
  });
});
