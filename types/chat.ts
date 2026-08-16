/**
 * Every role a turn can carry, including the synthesized system turn.
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * The two roles a conversation actually records.
 *
 * @remarks The system turn is never persisted — it is synthesized from the
 * chat's `systemPrompt` when the request to DeepSeek is built (`lib/api.ts`).
 */
export type StoredMessageRole = Exclude<MessageRole, "system">;

/** One stored turn of a conversation. */
export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  /** ISO 8601 — a `DateTime` column, as it survives JSON. */
  createdAt: string;
  /** Total tokens billed for the turn, when the API reported it. */
  tokenCount: number | null;
}

/** A conversation as the sidebar and the chat header see it. */
export interface ChatSession {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Messages in the chat. Derived from a `COUNT` on every read rather than
   * stored, so it cannot drift from the rows it describes.
   */
  messageCount: number;
}

/** A message as sent to the API — no local metadata. */
export interface ChatContextMessage {
  role: MessageRole;
  content: string;
}

/** The normalized reply shape returned by `/api/chat`. */
export interface ChatCompletionResult {
  content: string;
  tokenCount?: number;
}
