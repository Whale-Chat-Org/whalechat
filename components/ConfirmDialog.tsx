"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Label on the destructive button. Defaults to "Confirm". */
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * Replaces the native confirm() previously used for destructive actions.
 *
 * @remarks The generated `AlertDialogContent` is full-bleed and square-cornered
 * below the `sm` breakpoint, and its footer stacks buttons full-width. Both are
 * overridden here so the dialog reads as a card on phones too.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] gap-3 rounded-xl p-5 sm:max-w-sm sm:p-6">
        <AlertDialogHeader className="space-y-1.5">
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
          <AlertDialogCancel className="mt-0 flex-1 sm:flex-none">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({ variant: "destructive" }),
              "flex-1 sm:flex-none"
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
