/**
 * The validation message an onboarding server action hands back to its form.
 *
 * @remarks `role="alert"` so a screen reader announces the failure without the
 * user having to hunt for it — the form does not move when this appears.
 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}
