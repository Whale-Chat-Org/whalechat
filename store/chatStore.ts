"use client";

import { create } from "zustand";

/** The one piece of chat state the client owns outright. */
interface ChatStore {
  /** The chat shown in the conversation pane, or null for the empty state. */
  currentChatId: string | null;
  setCurrentChat: (chatId: string | null) => void;
}

/**
 * Which chat is open — and nothing else.
 *
 * @remarks Chats and messages are server state and live in React Query
 * (`hooks/use-chats.ts`), which owns their fetching, caching and invalidation.
 * The selected id is the only genuinely client-side thing here: it is a UI
 * decision, it never round-trips, and no server response can contradict it.
 */
export const useChatStore = create<ChatStore>((set) => ({
  currentChatId: null,
  setCurrentChat: (chatId) => set({ currentChatId: chatId }),
}));
