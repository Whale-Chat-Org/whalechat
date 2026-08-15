import { describe, expect, it } from "vitest";
import { actionEmail, codeEmail } from "./email";

describe("actionEmail", () => {
  const url = "https://example.com/api/auth/verify-email?token=abc123";

  it("puts the link in both parts", () => {
    const { text, html } = actionEmail({
      heading: "Confirm your email",
      body: "Tap the button.",
      buttonLabel: "Confirm",
      url,
    });

    // The text part is not decoration: it is the fallback for clients that
    // strip HTML, so the link has to be reachable there too.
    expect(text).toContain(url);
    expect(html).toContain(`href="${url}"`);
  });

  it("repeats the link as copyable text for clients that strip the button", () => {
    const { html } = actionEmail({
      heading: "H",
      body: "B",
      buttonLabel: "Go",
      url,
    });

    expect(html.split(url).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("carries the heading and body through", () => {
    const { text, html } = actionEmail({
      heading: "Reset your password",
      body: "Someone asked to reset it.",
      buttonLabel: "Choose a new password",
      url,
    });

    for (const part of [text, html]) {
      expect(part).toContain("Reset your password");
      expect(part).toContain("Someone asked to reset it.");
    }
    expect(html).toContain("Choose a new password");
  });
});

describe("codeEmail", () => {
  it("puts the code in both parts and offers no link", () => {
    const { text, html } = codeEmail({
      heading: "Your WhaleChat license key",
      body: "Enter this to finish setup.",
      code: "WHALE-A2345-B6789-CDEFG",
    });

    expect(text).toContain("WHALE-A2345-B6789-CDEFG");
    expect(html).toContain("WHALE-A2345-B6789-CDEFG");
    // A clickable link would defeat the point — the reader has to prove they can
    // open this specific mailbox.
    expect(html).not.toContain("<a ");
  });

  it("omits the footer entirely when there isn't one", () => {
    const without = codeEmail({ heading: "H", body: "B", code: "C" });
    const withFooter = codeEmail({
      heading: "H",
      body: "B",
      code: "C",
      footer: "Ignore this if it wasn't you.",
    });

    expect(withFooter.html).toContain("Ignore this if it wasn&apos;t you.".replace("&apos;", "'"));
    expect(withFooter.text).toContain("Ignore this if it wasn't you.");
    expect(without.html).not.toContain("<p style=\"font-size:12px");
  });
});
