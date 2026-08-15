import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NEW_CHAT_NAME } from "@/lib/deepseek";

/** Merge conditional class names, resolving conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_NAME_LENGTH = 40;

/**
 * Turn a chat's first message into a sidebar title: whitespace collapsed and
 * trimmed to {@link MAX_NAME_LENGTH} on a word boundary where possible.
 */
export function deriveChatName(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();

  if (!clean) return NEW_CHAT_NAME;
  if (clean.length <= MAX_NAME_LENGTH) return clean;

  const cut = clean.slice(0, MAX_NAME_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");

  // Only break on a word boundary if it isn't leaving a stub.
  const truncated = lastSpace > MAX_NAME_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;

  return `${truncated.trimEnd()}…`;
}
