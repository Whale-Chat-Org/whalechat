import { describe, expect, it } from "vitest";
import { NEW_CHAT_NAME } from "./deepseek";
import { cn, deriveChatName } from "./utils";

describe("cn", () => {
  it("resolves conflicting Tailwind utilities in favour of the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy entries", () => {
    expect(cn("flex", false && "hidden", undefined, "gap-2")).toBe("flex gap-2");
  });
});

describe("deriveChatName", () => {
  it("falls back to the placeholder for an empty message", () => {
    expect(deriveChatName("")).toBe(NEW_CHAT_NAME);
    expect(deriveChatName("   \n\t  ")).toBe(NEW_CHAT_NAME);
  });

  it("collapses whitespace", () => {
    expect(deriveChatName("  hello   there\nfriend ")).toBe("hello there friend");
  });

  it("keeps a message that fits", () => {
    const forty = "a".repeat(40);
    expect(deriveChatName(forty)).toBe(forty);
  });

  it("truncates on a word boundary once past the limit", () => {
    const message =
      "the quick brown fox jumps over the lazy dog and keeps on running";

    const name = deriveChatName(message);

    expect(name.endsWith("…")).toBe(true);
    expect(name).toBe("the quick brown fox jumps over the lazy…");
    // Only the ellipsis may exceed the 40-character budget.
    expect(name.length).toBeLessThanOrEqual(41);
  });

  it("cuts mid-word rather than leaving a stub", () => {
    // One 60-character word: the last space is at index 2, well below the
    // half-limit guard, so breaking there would title the chat "an…".
    const name = deriveChatName(`an ${"x".repeat(60)}`);

    expect(name).toBe(`an ${"x".repeat(37)}…`);
  });
});
