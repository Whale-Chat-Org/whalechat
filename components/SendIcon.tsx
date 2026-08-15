import type { SVGProps } from "react";

/**
 * Telegram-style send glyph: a solid paper plane pointing right.
 *
 * @remarks Lucide's `Send` is a tilted outline plane, so this is drawn inline
 * rather than pulled from the icon set. Sized via `className` like a lucide
 * icon, and filled with `currentColor` so it inherits button text colour.
 */
export function SendIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
