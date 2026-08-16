import { readJson, withUser } from "@/lib/api-server";
import { createChat, listChats, type NewChat } from "@/lib/chats";
import {
  DEFAULT_SYSTEM_PROMPT,
  NEW_CHAT_NAME,
  resolveModel,
} from "@/lib/deepseek";

/** This user's chats, most recently updated first. */
export const GET = withUser(async (userId) =>
  Response.json(await listChats(userId))
);

/**
 * Start a chat.
 *
 * @remarks Every field is defaulted server-side, so the client can post an empty
 * body — there is no new-chat dialog to collect anything. Fields are read one by
 * one rather than spread: spreading the body would let a caller set `userId`.
 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<NewChat>(req);

  const chat = await createChat(userId, {
    name: typeof body.name === "string" ? body.name : NEW_CHAT_NAME,
    model: resolveModel(body.model),
    systemPrompt:
      typeof body.systemPrompt === "string"
        ? body.systemPrompt
        : DEFAULT_SYSTEM_PROMPT,
  });

  return Response.json(chat, { status: 201 });
});
