import {
  errorResponse,
  readJson,
  withUser,
  type RouteContext,
} from "@/lib/api-server";
import { addMessage, listMessages, type NewMessage } from "@/lib/chats";

type Context = RouteContext<{ chatId: string }>;

/** A chat's messages in send order. 404 if the chat is not this user's. */
export const GET = withUser<Context>(async (userId, _req, { params }) => {
  const { chatId } = await params;

  const messages = await listMessages(userId, chatId);
  if (!messages) return errorResponse("Chat not found", 404);

  return Response.json(messages);
});

/**
 * Append a message to a chat.
 *
 * @remarks `role` is restricted to the two roles a conversation actually
 * records. The system turn is not stored — it is synthesized from the chat's
 * `systemPrompt` when the request to DeepSeek is built (`lib/api.ts`).
 */
export const POST = withUser<Context>(async (userId, req, { params }) => {
  const { chatId } = await params;
  const body = await readJson<NewMessage>(req);

  if (body.role !== "user" && body.role !== "assistant") {
    return errorResponse("role must be 'user' or 'assistant'", 400);
  }
  if (typeof body.content !== "string" || !body.content) {
    return errorResponse("content is required", 400);
  }

  const message = await addMessage(userId, chatId, {
    role: body.role,
    content: body.content,
    tokenCount: typeof body.tokenCount === "number" ? body.tokenCount : null,
  });
  if (!message) return errorResponse("Chat not found", 404);

  return Response.json(message, { status: 201 });
});
