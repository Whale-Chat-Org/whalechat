/**
 * Every read and write of a chat, scoped to its owner.
 *
 * The `userId` argument always comes from the server-side session — never from
 * the request body or a path segment. It is applied *inside* each query rather
 * than checked afterwards, so a chat id belonging to someone else matches no row
 * at all: reads come back `null` and writes affect zero rows. Fetch-then-compare
 * would work too, but only while nobody forgets the compare.
 */

import type {
  Chat as ChatRow,
  Message as MessageRow,
} from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { ChatSession, Message, StoredMessageRole } from "@/types/chat";

/** The fields a client may set when creating a chat. */
export interface NewChat {
  name: string;
  model: string;
  systemPrompt: string;
}

/** The fields a client may change on an existing chat. */
export type ChatUpdate = Partial<NewChat>;

/** The fields a client may set when appending a message. */
export interface NewMessage {
  role: StoredMessageRole;
  content: string;
  tokenCount?: number | null;
}

/** Widen a row plus its message count into the shape the client reads. */
function toChatSession(
  chat: ChatRow & { _count: { messages: number } }
): ChatSession {
  return {
    id: chat.id,
    name: chat.name,
    model: chat.model,
    systemPrompt: chat.systemPrompt,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    messageCount: chat._count.messages,
  };
}

/** Same for a message row — dates become ISO strings on the way out. */
function toMessage(message: MessageRow): Message {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    tokenCount: message.tokenCount,
  };
}

/** Count every message — none are stored with `role: "system"`. */
const withCount = { _count: { select: { messages: true } } } as const;

/** This user's chats, most recently updated first — the sidebar's only query. */
export async function listChats(userId: string): Promise<ChatSession[]> {
  const chats = await prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: withCount,
  });

  return chats.map(toChatSession);
}

/** Start a chat owned by this user. Defaults are decided by the route. */
export async function createChat(
  userId: string,
  data: NewChat
): Promise<ChatSession> {
  const chat = await prisma.chat.create({
    data: { ...data, userId },
    include: withCount,
  });

  return toChatSession(chat);
}

/** @returns False when the chat does not exist *or* belongs to someone else. */
export async function updateChat(
  userId: string,
  chatId: string,
  data: ChatUpdate
): Promise<boolean> {
  const { count } = await prisma.chat.updateMany({
    where: { id: chatId, userId },
    data,
  });

  return count > 0;
}

/** Messages cascade — see `onDelete: Cascade` on the relation. */
export async function deleteChat(
  userId: string,
  chatId: string
): Promise<boolean> {
  const { count } = await prisma.chat.deleteMany({
    where: { id: chatId, userId },
  });

  return count > 0;
}

/**
 * A chat's messages in send order.
 *
 * @returns `null` when the chat is not this user's, which the route turns into a
 * 404. Selecting through the scoped chat rather than querying `message` by
 * `chatId` is what keeps "not yours" distinguishable from "no messages yet".
 */
export async function listMessages(
  userId: string,
  chatId: string
): Promise<Message[] | null> {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return chat ? chat.messages.map(toMessage) : null;
}

/**
 * Append a message and move its chat to the top of the sidebar.
 *
 * @returns `null` when the chat is not this user's.
 *
 * @remarks The scoped `updateMany` is both the authorization check and the
 * `updatedAt` bump, so there is no window where one holds and the other does
 * not. It is deliberately not wrapped in a transaction: if the insert below
 * failed, the cost is a chat whose timestamp moved without a message, which
 * misorders the sidebar and nothing more.
 */
export async function addMessage(
  userId: string,
  chatId: string,
  data: NewMessage
): Promise<Message | null> {
  const { count } = await prisma.chat.updateMany({
    where: { id: chatId, userId },
    data: { updatedAt: new Date() },
  });

  if (count === 0) return null;

  const message = await prisma.message.create({ data: { ...data, chatId } });
  return toMessage(message);
}

/** @returns False when the message, its chat, or the ownership link is missing. */
export async function deleteMessage(
  userId: string,
  chatId: string,
  messageId: string
): Promise<boolean> {
  const { count } = await prisma.message.deleteMany({
    where: { id: messageId, chatId, chat: { userId } },
  });

  return count > 0;
}
