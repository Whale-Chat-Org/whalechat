export interface Message {
  id: string;
  chatId: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  /** Total tokens billed for the turn, when the API reported it. */
  tokenCount?: number;
}

export interface ChatSession {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  /** Messages excluding the system prompt. */
  messageCount: number;
}

/** A message as sent to the API — no local metadata. */
export interface ChatContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The normalized reply shape returned by `/api/chat`. */
export interface ChatCompletionResult {
  content: string;
  tokenCount?: number;
}
