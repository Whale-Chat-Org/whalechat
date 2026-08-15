import { describe, expect, it } from "vitest";
import {
  CHAT_COMPLETIONS_URL,
  DEEPSEEK_MODELS,
  DEFAULT_MODEL,
  resolveModel,
  TEMPERATURE,
} from "./deepseek";

describe("resolveModel", () => {
  it("passes through every model the picker offers", () => {
    for (const model of DEEPSEEK_MODELS) {
      expect(resolveModel(model)).toBe(model);
    }
  });

  it("falls back for chats saved before the v4 rename", () => {
    // The reason this function exists: DeepSeek answers a retired id with an
    // opaque 400, so an old chat would break rather than degrade.
    expect(resolveModel("deepseek-chat")).toBe(DEFAULT_MODEL);
    expect(resolveModel("deepseek-reasoner")).toBe(DEFAULT_MODEL);
  });

  it("falls back for missing or nonsense input", () => {
    expect(resolveModel(undefined)).toBe(DEFAULT_MODEL);
    expect(resolveModel("")).toBe(DEFAULT_MODEL);
    expect(resolveModel("gpt-4")).toBe(DEFAULT_MODEL);
  });
});

describe("constants", () => {
  it("offers the default model in the picker", () => {
    expect(DEEPSEEK_MODELS).toContain(DEFAULT_MODEL);
  });

  it("never points at anything but DeepSeek", () => {
    expect(CHAT_COMPLETIONS_URL).toBe(
      "https://api.deepseek.com/v1/chat/completions"
    );
  });

  it("keeps temperature inside the usable range", () => {
    // The API accepts up to 2, but output degrades badly above ~1.5.
    expect(TEMPERATURE).toBeGreaterThan(0);
    expect(TEMPERATURE).toBeLessThanOrEqual(1.5);
  });
});
