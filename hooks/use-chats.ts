"use client";

/**
 * Chats and messages as server state.
 *
 * Every mutation invalidates rather than patching the cache by hand, and none of
 * them are optimistic: the server is awaited and its answer is what renders. At
 * one round-trip per action on a local database that is not slow enough to be
 * worth the reconciliation code, and it means the screen can never show a
 * message that failed to save.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/chat-api";

/** This user's chats, most recently updated first. */
export function useChats() {
  return useQuery({ queryKey: api.chatsKey, queryFn: api.fetchChats });
}

/** One chat's messages, or an idle query while nothing is selected. */
export function useMessages(chatId: string | null) {
  return useQuery({
    // The key is only built when there is an id; `enabled` keeps the query from
    // running for the empty state.
    queryKey: api.messagesKey(chatId ?? ""),
    queryFn: () => api.fetchMessages(chatId!),
    enabled: Boolean(chatId),
  });
}

/** Start a chat on the server's defaults. */
export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.chatsKey }),
  });
}

interface UpdateChatVars {
  chatId: string;
  updates: api.ChatPatch;
}

/** Rename a chat, switch its model, or rewrite its system prompt. */
export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, updates }: UpdateChatVars) =>
      api.updateChat(chatId, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.chatsKey }),
  });
}

/** Delete a chat and drop its messages from the cache. */
export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteChat,
    onSuccess: (_result, chatId) => {
      queryClient.invalidateQueries({ queryKey: api.chatsKey });
      // The rows are gone server-side; drop the cached copy rather than leave it
      // to go stale behind a chat that no longer exists.
      queryClient.removeQueries({ queryKey: api.messagesKey(chatId) });
    },
  });
}

interface AddMessageVars {
  chatId: string;
  message: api.NewMessage;
}

/** Append a turn to a chat. */
export function useAddMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, message }: AddMessageVars) =>
      api.addMessage(chatId, message),
    onSuccess: (_result, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: api.messagesKey(chatId) });
      // Refreshes messageCount, and the sidebar order the append just changed.
      queryClient.invalidateQueries({ queryKey: api.chatsKey });
    },
  });
}

interface DeleteMessageVars {
  chatId: string;
  messageId: string;
}

/** Remove one message from a chat. */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, messageId }: DeleteMessageVars) =>
      api.deleteMessage(chatId, messageId),
    onSuccess: (_result, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: api.messagesKey(chatId) });
      queryClient.invalidateQueries({ queryKey: api.chatsKey });
    },
  });
}
