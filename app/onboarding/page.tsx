import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivateForm } from "@/components/onboarding/ActivateForm";
import { ClaimForm } from "@/components/onboarding/ClaimForm";
import { getOnboardingState } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Set up · WhaleChat" };

/**
 * First-run setup.
 *
 * @remarks The only page in the app that is reachable without an account, by
 * design: until an administrator exists there is nobody who could approve one.
 * Every other route redirects here through `requireOnboarded()`.
 */
export default async function OnboardingPage() {
  const state = await getOnboardingState();

  if (state.step === "done") redirect("/");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-4">
      {state.step === "claim" ? (
        <ClaimForm />
      ) : (
        <ActivateForm email={state.email} />
      )}
    </main>
  );
}
