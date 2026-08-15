"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Submit button that disables itself while its form is in flight.
 *
 * @remarks Reads `useFormStatus`, so it must live *inside* the `<form>` rather
 * than own it. Double-submitting onboarding would either claim twice or burn a
 * rate-limit attempt for nothing.
 */
export function SubmitButton({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} variant={variant}>
      {pending && <Spinner />}
      {children}
    </Button>
  );
}
