"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long the `copied` flag stays true after a successful copy. */
const RESET_DELAY_MS = 2000;

/**
 * Copy text to the clipboard and expose a short-lived `copied` flag for
 * swapping a button's icon.
 *
 * @returns `copied` — true for {@link RESET_DELAY_MS} after a successful copy —
 * and `copy`, which resolves to whether the write succeeded so callers can
 * decide their own success/failure messaging.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), RESET_DELAY_MS);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copied, copy };
}
