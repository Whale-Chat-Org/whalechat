/**
 * The browser's half of `/api/chats`.
 *
 * No call takes a user id. The server derives it from the session on every
 * request, so there is nothing here that could name someone else's data.
 */

import type { ChatSession, Message, StoredMessageRole } from "@/types/chat";

/**
 * React Query keys. They live here rather than in `hooks/use-chats.ts` so that
 * `app/page.tsx` can prefetch into the same key without importing a client
 * module.
 */
export const chatsKey = ["chats"] as const;
export const messagesKey = (chatId: string) =>
  ["chats", chatId, "messages"] as const;

/** @throws With the server's `error` message when the response is not OK. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Request failed");
  }

  // 204 on the mutations that have nothing useful to return.
  return response.status === 204 ? (undefined as T) : response.json();
}

/** This user's chats, most recently updated first. */
export function fetchChats() {
  return request<ChatSession[]>("/api/chats");
}

/** Defaults — name, model, system prompt — are all filled in server-side. */
export function createChat() {
  return request<ChatSession>("/api/chats", { method: "POST" });
}

/** The fields of a chat a client may change. */
export type ChatPatch = Partial<
  Pick<ChatSession, "name" | "model" | "systemPrompt">
>;

/** Rename a chat, switch its model, or rewrite its system prompt. */
export function updateChat(chatId: string, updates: ChatPatch) {
  return request<void>(`/api/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/** Delete a chat and, by cascade, every message in it. */
export function deleteChat(chatId: string) {
  return request<void>(`/api/chats/${chatId}`, { method: "DELETE" });
}

/** One chat's messages, in send order. */
export function fetchMessages(chatId: string) {
  return request<Message[]>(`/api/chats/${chatId}/messages`);
}

/** The fields a client may set when appending a message. */
export interface NewMessage {
  role: StoredMessageRole;
  content: string;
  tokenCount?: number;
}

/** Append a turn, and move its chat to the top of the sidebar. */
export function addMessage(chatId: string, message: NewMessage) {
  return request<Message>(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

/** Remove one message from a chat. */
export function deleteMessage(chatId: string, messageId: string) {
  return request<void>(`/api/chats/${chatId}/messages/${messageId}`, {
    method: "DELETE",
  });
}
