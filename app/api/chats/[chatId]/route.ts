import {
  errorResponse,
  readJson,
  withUser,
  type RouteContext,
} from "@/lib/api-server";
import { deleteChat, updateChat, type ChatUpdate } from "@/lib/chats";
import { resolveModel } from "@/lib/deepseek";

type Context = RouteContext<{ chatId: string }>;

/**
 * Rename a chat, switch its model, or change its system prompt.
 *
 * @remarks Only those three fields are read. A 404 covers both "no such chat"
 * and "not yours" — telling the two apart would confirm that an id exists.
 */
export const PATCH = withUser<Context>(async (userId, req, { params }) => {
  const { chatId } = await params;
  const body = await readJson<ChatUpdate>(req);

  const updates: ChatUpdate = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.model === "string") updates.model = resolveModel(body.model);
  if (typeof body.systemPrompt === "string") {
    updates.systemPrompt = body.systemPrompt;
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse("Nothing to update", 400);
  }

  const updated = await updateChat(userId, chatId, updates);
  if (!updated) return errorResponse("Chat not found", 404);

  return new Response(null, { status: 204 });
});

/** Delete a chat and, by cascade, every message in it. */
export const DELETE = withUser<Context>(async (userId, _req, { params }) => {
  const { chatId } = await params;

  const deleted = await deleteChat(userId, chatId);
  if (!deleted) return errorResponse("Chat not found", 404);

  return new Response(null, { status: 204 });
});
