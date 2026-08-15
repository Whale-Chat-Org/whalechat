"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import { ChatSession, Message } from "@/types/chat";
import { chatsDB, messagesDB } from "@/lib/db";

interface ChatStore {
  chats: ChatSession[];
  currentChatId: string | null;
  /** Messages by chat id, loaded lazily when a chat is selected. */
  messages: Record<string, Message[]>;

  loadChats: () => Promise<void>;
  createChat: (
    chat: Omit<ChatSession, "id" | "createdAt" | "updatedAt" | "messageCount">
  ) => Promise<string>;
  updateChat: (chatId: string, updates: Partial<ChatSession>) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  setCurrentChat: (chatId: string) => void;

  loadMessages: (chatId: string) => Promise<void>;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
}

/** Messages excluding the system prompt — what `messageCount` tracks. */
function countVisible(messages: Message[]): number {
  return messages.filter((m) => m.role !== "system").length;
}

/**
 * Persist a chat's messages and refresh the chat's counters, then patch both
 * into state. Shared by {@link ChatStore.addMessage} and
 * {@link ChatStore.deleteMessage}.
 */
async function persistMessages(
  chatId: string,
  messages: Message[],
  set: (fn: (state: ChatStore) => Partial<ChatStore>) => void
) {
  await messagesDB.setItem(chatId, messages);

  const chat = await chatsDB.getItem<ChatSession>(chatId);
  if (!chat) return;

  chat.messageCount = countVisible(messages);
  chat.updatedAt = Date.now();
  await chatsDB.setItem(chatId, chat);

  set((state) => ({
    messages: { ...state.messages, [chatId]: messages },
    chats: state.chats.map((c) => (c.id === chatId ? chat : c)),
  }));
}

/**
 * Chat and message state, persisted to IndexedDB.
 *
 * @remarks Storage is deliberately client-only — there is no server-side chat
 * database. Every mutation writes through to localforage before updating state.
 */
export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: {},

  loadChats: async () => {
    const chats: ChatSession[] = [];
    await chatsDB.iterate<ChatSession, void>((value) => {
      chats.push(value);
    });
    chats.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ chats });
  },

  createChat: async (chatData) => {
    const now = Date.now();
    const chat: ChatSession = {
      ...chatData,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    await chatsDB.setItem(chat.id, chat);
    set((state) => ({ chats: [chat, ...state.chats], currentChatId: chat.id }));
    return chat.id;
  },

  updateChat: async (chatId, updates) => {
    const chat = await chatsDB.getItem<ChatSession>(chatId);
    if (!chat) return;

    const updated = { ...chat, ...updates, updatedAt: Date.now() };
    await chatsDB.setItem(chatId, updated);
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? updated : c)),
    }));
  },

  deleteChat: async (chatId) => {
    await chatsDB.removeItem(chatId);
    await messagesDB.removeItem(chatId);
    set((state) => {
      const messages = { ...state.messages };
      delete messages[chatId];
      return {
        chats: state.chats.filter((c) => c.id !== chatId),
        currentChatId:
          state.currentChatId === chatId ? null : state.currentChatId,
        messages,
      };
    });
  },

  setCurrentChat: (chatId) => {
    set({ currentChatId: chatId });
    get().loadMessages(chatId);
  },

  loadMessages: async (chatId) => {
    const messages = await messagesDB.getItem<Message[]>(chatId);
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages ?? [] },
    }));
  },

  addMessage: async (messageData) => {
    const message: Message = {
      ...messageData,
      id: nanoid(),
      timestamp: Date.now(),
    };

    const { chatId } = message;
    const next = [...(get().messages[chatId] ?? []), message];
    await persistMessages(chatId, next, set);
  },

  deleteMessage: async (chatId, messageId) => {
    const next = (get().messages[chatId] ?? []).filter(
      (m) => m.id !== messageId
    );
    await persistMessages(chatId, next, set);
  },
}));
