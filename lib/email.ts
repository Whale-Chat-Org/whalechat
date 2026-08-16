import { Resend } from "resend";

/**
 * The single outbound mail path.
 *
 * @remarks Resend's HTTP API rather than SMTP, so there is no transport to
 * configure and nothing to run locally. `EMAIL_FROM` must be on a domain
 * verified in the Resend dashboard; `onboarding@resend.dev` works without one
 * but will only deliver to the address that owns the API key.
 */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "WhaleChat <onboarding@resend.dev>";

interface SendMailArgs {
  to: string;
  subject: string;
  /** Plain-text body. Sent alongside the HTML for clients that strip it. */
  text: string;
  html: string;
}

/**
 * Last resort when a message cannot be delivered: put the link somewhere a
 * developer can still reach it.
 *
 * @remarks Never throws. Better Auth sends verification and reset mail from
 * inside the same transaction that writes the user, so throwing here would roll
 * the whole sign-up back and show a 500 — losing the account as well as the
 * email. Failing to *deliver* should not mean failing to *register*; Better
 * Auth can resend later, and an unverified user cannot sign in anyway.
 */
function logUndeliverable(reason: string, to: string, subject: string, text: string) {
  console.error(`[email] ${reason} — "${subject}" was not sent to ${to}.\n${text}`);
}

/**
 * Send one message, or log it where a developer can still reach it.
 *
 * @remarks Never throws — see {@link logUndeliverable} for why that matters.
 */
export async function sendMail({ to, subject, text, html }: SendMailArgs) {
  if (!resend) {
    logUndeliverable("RESEND_API_KEY is not set", to, subject, text);
    return;
  }

  // Resend reports refusals in the body rather than by throwing, so an
  // unchecked call looks successful while delivering nothing.
  const { error } = await resend.emails.send({ from: FROM, to, subject, text, html });

  if (error) {
    // The common one by far: `onboarding@resend.dev` only delivers to the
    // address that owns the API key, so every other recipient is refused until
    // a real domain is verified at https://resend.com/domains and EMAIL_FROM
    // points at it.
    logUndeliverable(`Resend refused it (${error.message})`, to, subject, text);
  }
}

/**
 * One-button email: a sentence, a link, and the same link in plain text for
 * clients that strip the button.
 *
 * @remarks Deliberately inline-styled and table-free. It has to survive Gmail
 * and Outlook, neither of which can be relied on for `<style>` blocks.
 */
export function actionEmail({
  heading,
  body,
  buttonLabel,
  url,
}: {
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
}) {
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#475569">${body}</p>
  <a href="${url}" style="display:inline-block;background:#0f172a;color:#f8fafc;font-size:14px;font-weight:500;text-decoration:none;padding:10px 20px;border-radius:6px">${buttonLabel}</a>
  <p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#94a3b8">Or paste this into your browser:<br><span style="word-break:break-all">${url}</span></p>
</div>`.trim();

  return { text: `${heading}\n\n${body}\n\n${url}\n`, html };
}

/**
 * Code email: the same frame as {@link actionEmail}, but the payload is a string
 * to copy rather than a link to click.
 *
 * @remarks Monospace and letter-spaced, because the recipient has to retype this
 * accurately. There is no button: a link would defeat the point, which is to
 * prove the reader can open this specific mailbox.
 */
export function codeEmail({
  heading,
  body,
  code,
  footer,
}: {
  heading: string;
  body: string;
  code: string;
  footer?: string;
}) {
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#475569">${body}</p>
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:600;letter-spacing:2px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:16px;text-align:center">${code}</div>
  ${footer ? `<p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#94a3b8">${footer}</p>` : ""}
</div>`.trim();

  return {
    text: `${heading}\n\n${body}\n\n${code}\n${footer ? `\n${footer}\n` : ""}`,
    html,
  };
}
