import {
  ChatCompletionResult,
  ChatContextMessage,
  ChatSession,
  Message,
} from "@/types/chat";

/**
 * Send a turn to the local `/api/chat` route, which adds the API key
 * server-side and forwards to DeepSeek.
 *
 * @param messages - The conversation so far, excluding the new turn.
 * @throws If the route returns a non-OK status, with the server's error message.
 *
 * @remarks The full history is sent every time — with a 1M-token context window
 * there is nothing to gain from trimming or summarizing it.
 */
export async function sendChatMessage(
  chat: ChatSession,
  userMessage: string,
  messages: Message[]
): Promise<ChatCompletionResult> {
  const context: ChatContextMessage[] = [
    { role: "system", content: chat.systemPrompt },
    ...messages
      .filter((m) => m.role !== "system")
      .map(({ role, content }) => ({ role, content })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: chat.model, messages: context }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to send message");
  }

  return { content: data.content, tokenCount: data.tokenCount };
}
