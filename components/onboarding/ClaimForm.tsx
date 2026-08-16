"use client";

import { useActionState } from "react";
import { claimAdmin, type OnboardingResult } from "@/app/onboarding/actions";
import { FormError } from "@/components/onboarding/FormError";
import { SubmitButton } from "@/components/onboarding/SubmitButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const EMPTY: OnboardingResult = {};

/** Step 1: claim an instance that has no administrator yet. */
export function ClaimForm() {
  const [result, action] = useActionState(claimAdmin, EMPTY);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set up WhaleChat</CardTitle>
        <CardDescription>
          Nobody administers this instance yet. Enter your email and we&apos;ll
          send you a license key to claim it.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
            />
            <FieldDescription>
              This becomes the administrator account.
            </FieldDescription>
          </Field>

          <FormError message={result.error} />

          <SubmitButton>Send my license key</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
