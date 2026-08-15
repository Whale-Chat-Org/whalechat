import { describe, expect, it } from "vitest";
import { generateLicenseKey, normaliseLicenseKey } from "./license-key";

describe("generateLicenseKey", () => {
  it("has the documented shape", () => {
    expect(generateLicenseKey()).toMatch(/^WHALE-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("never emits characters that are misread when retyped", () => {
    // The whole point of the restricted alphabet: this key arrives by email and
    // is typed back in by hand, so 0/O and 1/I/L must not appear.
    const body = Array.from({ length: 500 }, () =>
      generateLicenseKey().replace("WHALE-", "")
    ).join("");

    expect(body).not.toMatch(/[01OIL]/);
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 1000 }, generateLicenseKey));

    // A collision in 1000 draws would mean the entropy is nowhere near the ~73
    // bits the format implies — i.e. the generator is broken, not unlucky.
    expect(keys.size).toBe(1000);
  });

  it("is long enough to be a password", () => {
    // Better Auth enforces an 8-character minimum, and this key becomes the
    // administrator's password.
    expect(generateLicenseKey().length).toBeGreaterThanOrEqual(8);
  });
});

describe("normaliseLicenseKey", () => {
  it("accepts the key however it was typed", () => {
    expect(normaliseLicenseKey("  whale-a2345-b6789-cdefg  ")).toBe(
      "WHALE-A2345-B6789-CDEFG"
    );
    expect(normaliseLicenseKey("WHALE A2345 B6789 CDEFG")).toBe(
      "WHALEA2345B6789CDEFG"
    );
  });

  it("leaves an already-clean key alone", () => {
    const key = generateLicenseKey();
    expect(normaliseLicenseKey(key)).toBe(key);
  });

  it("does not invent a key from empty input", () => {
    expect(normaliseLicenseKey("   ")).toBe("");
  });
});
