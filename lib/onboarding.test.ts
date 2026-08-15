import { beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_PENDING_REASON, REVOKED_REASON } from "./access";

const findMany = vi.fn();
const redisGet = vi.fn();
const redisSet = vi.fn();
const redisDel = vi.fn();
const redirect = vi.fn();

vi.mock("./prisma", () => ({ prisma: { user: { findMany: () => findMany() } } }));
vi.mock("./redis", () => ({
  redis: {
    get: () => redisGet(),
    set: () => redisSet(),
    del: () => redisDel(),
  },
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
// `connection()` only exists to stop Next prerendering these routes; in a test
// there is nothing to opt out of.
vi.mock("next/server", () => ({ connection: async () => undefined }));

const { getOnboardingState, requireOnboarded } = await import("./onboarding");

const admin = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "u1",
  email: "admin@example.com",
  banned: false,
  banReason: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  redisGet.mockResolvedValue(null);
  redisSet.mockResolvedValue("OK");
});

describe("getOnboardingState", () => {
  it("offers the claim when no administrator exists", async () => {
    findMany.mockResolvedValue([]);

    expect(await getOnboardingState()).toEqual({ step: "claim" });
  });

  it("resumes at the key step for a half-claimed administrator", async () => {
    findMany.mockResolvedValue([
      admin({ banned: true, banReason: ONBOARDING_PENDING_REASON }),
    ]);

    expect(await getOnboardingState()).toEqual({
      step: "activate",
      email: "admin@example.com",
      userId: "u1",
    });
  });

  it("is done once an administrator is active", async () => {
    findMany.mockResolvedValue([admin()]);

    expect(await getOnboardingState()).toEqual({ step: "done" });
  });

  it("does NOT reopen the claim when every administrator is banned", async () => {
    // The security-critical case. Reopening here would make "ban the last
    // admin" a way to take the instance over, so a database that has been used
    // must never offer the claim again — recovery is a manual fix.
    findMany.mockResolvedValue([
      admin({ banned: true, banReason: REVOKED_REASON }),
    ]);

    expect(await getOnboardingState()).toEqual({ step: "done" });
  });

  it("prefers an active administrator over a pending one", async () => {
    findMany.mockResolvedValue([
      admin({ id: "u1", banned: true, banReason: ONBOARDING_PENDING_REASON }),
      admin({ id: "u2", email: "real@example.com" }),
    ]);

    expect(await getOnboardingState()).toEqual({ step: "done" });
  });

  it("short-circuits on the cache without querying", async () => {
    redisGet.mockResolvedValue("1");

    expect(await getOnboardingState()).toEqual({ step: "done" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("caches only once it is genuinely done", async () => {
    findMany.mockResolvedValue([
      admin({ banned: true, banReason: ONBOARDING_PENDING_REASON }),
    ]);
    await getOnboardingState();
    expect(redisSet).not.toHaveBeenCalled();

    findMany.mockResolvedValue([admin()]);
    await getOnboardingState();
    expect(redisSet).toHaveBeenCalledOnce();
  });
});

describe("requireOnboarded", () => {
  it("sends unfinished setups to the onboarding page", async () => {
    findMany.mockResolvedValue([]);

    await requireOnboarded();

    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("lets a finished setup through", async () => {
    findMany.mockResolvedValue([admin()]);

    await requireOnboarded();

    expect(redirect).not.toHaveBeenCalled();
  });
});
