"use client";

import { useActionState, useState } from "react";
import {
  activateAdmin,
  resendKey,
  startOver,
  type OnboardingResult,
} from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/onboarding/SubmitButton";
import { Button } from "@/components/ui/button";
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

/** Step 2: the instance is claimed, waiting on the key from that mailbox. */
export function ActivateForm({ email }: { email: string }) {
  const [result, action] = useActionState(activateAdmin, EMPTY);
  const [resendResult, resendAction] = useActionState(
    async () => resendKey(),
    EMPTY
  );
  const [restartResult, restartAction] = useActionState(startOver, EMPTY);
  const [restarting, setRestarting] = useState(false);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Enter your license key</CardTitle>
        <CardDescription>
          We sent a key to <span className="font-medium">{email}</span>. It also
          becomes your password.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form action={action} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="licenseKey">License key</FieldLabel>
            <Input
              id="licenseKey"
              name="licenseKey"
              required
              autoFocus
              autoComplete="one-time-code"
              spellCheck={false}
              placeholder="WHALE-XXXXX-XXXXX-XXXXX"
              className="font-mono tracking-wider"
            />
            <FieldDescription>
              Case and spacing don&apos;t matter.
            </FieldDescription>
          </Field>

          {result.error && (
            <p role="alert" className="text-destructive text-sm">
              {result.error}
            </p>
          )}

          <SubmitButton>Finish setup</SubmitButton>
        </form>

        <div className="flex flex-col gap-2 border-t pt-4">
          <form action={resendAction}>
            <SubmitButton variant="ghost">Resend the key</SubmitButton>
          </form>

          {(resendResult.notice || resendResult.error) && (
            <p
              role="status"
              className={
                resendResult.error
                  ? "text-destructive text-sm"
                  : "text-muted-foreground text-sm"
              }
            >
              {resendResult.error ?? resendResult.notice}
            </p>
          )}

          <p className="text-muted-foreground text-xs">
            Resending replaces the key — the one in the older email stops working.
          </p>

          {restarting ? (
            <form action={restartAction} className="flex flex-col gap-2 pt-2">
              <Field>
                <FieldLabel htmlFor="confirmEmail">
                  Confirm the claimed address to start over
                </FieldLabel>
                <Input
                  id="confirmEmail"
                  name="confirmEmail"
                  type="email"
                  required
                  autoFocus
                  placeholder={email}
                />
                <FieldDescription>
                  This discards the pending administrator so the instance can be
                  claimed with a different address.
                </FieldDescription>
              </Field>

              {restartResult.error && (
                <p role="alert" className="text-destructive text-sm">
                  {restartResult.error}
                </p>
              )}

              <SubmitButton variant="destructive">
                Discard and start over
              </SubmitButton>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRestarting(true)}
            >
              Use a different email
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
