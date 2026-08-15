"use server";

import { redirect } from "next/navigation";
import { ONBOARDING_PENDING_REASON } from "@/lib/access";
import { auth } from "@/lib/auth";
import { codeEmail, sendMail } from "@/lib/email";
import { generateLicenseKey, normaliseLicenseKey } from "@/lib/license-key";
import {
  clearOnboardedCache,
  getOnboardingState,
  markOnboarded,
} from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

/** What every action hands back to the form. */
export interface OnboardingResult {
  error?: string;
  notice?: string;
}

const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";

/**
 * Send a freshly generated key to the address that claimed the instance.
 *
 * @remarks Rotating on every send is why the key is never stored in plain text:
 * it only exists between here and the password hash.
 */
async function deliverKey(email: string, key: string, resent: boolean) {
  const { text, html } = codeEmail({
    heading: resent ? "Your new license key" : "Your WhaleChat license key",
    body: resent
      ? "Here is a new license key for this instance. Any key sent before this one has stopped working."
      : "Enter this key to finish setting up WhaleChat. It also becomes your password, so keep it until you have changed it in your account settings.",
    code: key,
    footer:
      "If you did not request this, someone is setting up a WhaleChat instance with your address. Ignore this and they cannot finish.",
  });

  await sendMail({
    to: email,
    subject: resent ? "Your new license key" : "Your WhaleChat license key",
    text,
    html,
  });
}

/**
 * Step 1 — take ownership of an unclaimed instance.
 *
 * @remarks Whoever gets here first becomes the administrator; there is no shared
 * secret to check against because the whole point is that none is configured.
 * The window closes the moment this succeeds.
 */
export async function claimAdmin(
  _previous: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  if (!(await rateLimit("onboarding:claim", 5, 60 * 15))) {
    return { error: TOO_MANY };
  }

  // Re-read rather than trusting the page that rendered the form: two people
  // could have loaded step 1 at the same time.
  const state = await getOnboardingState();
  if (state.step !== "claim") {
    return { error: "This instance has already been claimed. Reload the page." };
  }

  const key = generateLicenseKey();

  try {
    // No `headers`, deliberately. `createUser` is the one admin endpoint that
    // permits a headerless server call, and it is also the only way to set
    // `role` — the admin plugin marks that field `input: false`, so sign-up can
    // never produce an administrator.
    await auth.api.createUser({
      body: {
        email,
        name: email.split("@")[0],
        password: key,
        role: "admin",
        data: {
          // The key email proves control of this mailbox, so a separate
          // verification email would ask for the same thing twice.
          emailVerified: true,
          banned: true,
          banReason: ONBOARDING_PENDING_REASON,
        },
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return { error: `Could not create the administrator: ${detail}` };
  }

  await deliverKey(email, key, false);
  redirect("/onboarding");
}

/**
 * Step 2 — prove the claimed mailbox is readable, and open the instance.
 */
export async function activateAdmin(
  _previous: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const key = normaliseLicenseKey(String(formData.get("licenseKey") ?? ""));

  if (!key) return { error: "Enter the license key from your email." };

  // Tight: this is a guessable secret reachable without a session.
  if (!(await rateLimit("onboarding:activate", 10, 60 * 15))) {
    return { error: TOO_MANY };
  }

  const state = await getOnboardingState();
  if (state.step !== "activate") {
    return { error: "Onboarding is not waiting for a key. Reload the page." };
  }

  const ctx = await auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(state.userId);
  const credential = accounts.find(
    (account) => account.providerId === "credential"
  );

  if (!credential?.password) {
    return { error: "This instance has no key set. Send yourself a new one." };
  }

  const valid = await ctx.password.verify({
    password: key,
    hash: credential.password,
  });

  if (!valid) return { error: "That key is not right. Check the latest email." };

  await prisma.user.update({
    where: { id: state.userId },
    data: { banned: false, banReason: null, banExpires: null },
  });
  await markOnboarded();

  redirect("/auth/sign-in");
}

/**
 * Replace the key and send it again, always to the address already on file.
 *
 * @remarks It cannot be redirected to a different mailbox, so it is safe to
 * leave unauthenticated: the worst an attacker achieves is mailing the rightful
 * owner a new key and invalidating their old one.
 */
export async function resendKey(): Promise<OnboardingResult> {
  if (!(await rateLimit("onboarding:resend", 5, 60 * 15))) {
    return { error: TOO_MANY };
  }

  const state = await getOnboardingState();
  if (state.step !== "activate") {
    return { error: "There is nothing to resend. Reload the page." };
  }

  const key = generateLicenseKey();
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(
    state.userId,
    await ctx.password.hash(key)
  );

  await deliverKey(state.email, key, true);

  return { notice: `A new key is on its way to ${state.email}.` };
}

/**
 * Discard a half-claimed administrator so the instance can be claimed again.
 *
 * @remarks Typing the pending address is not real authentication — it stops a
 * drive-by reset, not someone who knows the address. That is consistent with a
 * first-come-wins claim: anyone who could reset this could equally have claimed
 * the instance first. The door closes for good at activation.
 */
export async function startOver(
  _previous: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const confirmation = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!(await rateLimit("onboarding:restart", 5, 60 * 15))) {
    return { error: TOO_MANY };
  }

  const state = await getOnboardingState();
  if (state.step !== "activate") {
    return { error: "There is nothing to reset. Reload the page." };
  }

  if (confirmation !== state.email.toLowerCase()) {
    return { error: "That does not match the address this instance was claimed with." };
  }

  await prisma.user.delete({ where: { id: state.userId } });
  await clearOnboardedCache();

  redirect("/onboarding");
}
