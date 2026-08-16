"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, MessageSquarePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SendIcon } from "./SendIcon";
import { ModelPicker } from "./ModelPicker";
import {
  useAddMessage,
  useChats,
  useMessages,
  useUpdateChat,
} from "@/hooks/use-chats";
import { useChatStore } from "@/store/chatStore";
import { MessageBubble } from "./MessageBubble";
import { sendChatMessage } from "@/lib/api";
import { toast } from "sonner";
import { cn, deriveChatName } from "@/lib/utils";
import { NEW_CHAT_NAME } from "@/lib/deepseek";
import type { ChatSession, Message } from "@/types/chat";

/** One rail width shared by header, message column and composer so they align. */
const RAIL = "mx-auto w-full max-w-3xl px-4 sm:px-6";

/**
 * Ceiling for the auto-growing composer, in pixels.
 *
 * @remarks Must stay in step with `max-h-[200px]` on the textarea below. Tailwind
 * extracts class names statically, so the class cannot be built from this value —
 * past the cap the element scrolls instead of growing, and the two have to agree
 * on where that is.
 */
const MAX_COMPOSER_HEIGHT = 200;

// Stable empty arrays. An inline `= []` default would be a fresh reference on
// every render, which would re-run the scroll effect below each time.
const NO_MESSAGES: Message[] = [];
const NO_CHATS: ChatSession[] = [];

interface ChatWindowProps {
  /** Invoked by the empty state's "New chat" button. */
  onNewChat: () => void;
}

/** The conversation pane: header, message list and composer. */
export function ChatWindow({ onNewChat }: ChatWindowProps) {
  const currentChatId = useChatStore((state) => state.currentChatId);
  const { data: chats = NO_CHATS } = useChats();
  const { data: currentMessages = NO_MESSAGES } = useMessages(currentChatId);
  const { mutateAsync: addMessage } = useAddMessage();
  const { mutateAsync: updateChat } = useUpdateChat();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChat = chats.find((c) => c.id === currentChatId);

  useEffect(() => {
    const list = scrollRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [currentMessages]);

  // Grow the composer with its content, up to the same cap the class list sets.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const height = Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT);
    textarea.style.height = `${height}px`;
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !currentChatId || !currentChat || isLoading) return;

    const userMessage = input.trim();
    const isFirstMessage = currentMessages.length === 0;

    setInput("");
    setIsLoading(true);

    try {
      await addMessage({
        chatId: currentChatId,
        message: { role: "user", content: userMessage },
      });

      // Title the chat from its opening message. Guarded on the message count
      // rather than the name alone, so a deliberate rename is never overwritten.
      if (isFirstMessage && currentChat.name === NEW_CHAT_NAME) {
        await updateChat({
          chatId: currentChatId,
          updates: { name: deriveChatName(userMessage) },
        });
      }

      // `currentMessages` is the history from before the turn above, which is
      // exactly what the request wants — sendChatMessage appends userMessage.
      const response = await sendChatMessage(
        currentChat,
        userMessage,
        currentMessages
      );

      await addMessage({
        chatId: currentChatId,
        message: {
          role: "assistant",
          content: response.content,
          tokenCount: response.tokenCount,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentChatId) {
    return (
      <div className="flex h-dvh flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-sm space-y-3 text-center">
            <MessageSquarePlus className="mx-auto size-8 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">No chat selected</h2>
            <p className="text-sm text-muted-foreground">
              Pick a conversation from the sidebar, or start a new one.
            </p>
            <Button onClick={onNewChat} className="mt-1 gap-2">
              <Plus className="size-4" />
              New chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <SidebarTrigger />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {currentChat?.name || "Chat"}
        </h2>
        {currentChat && (
          <ModelPicker chatId={currentChat.id} model={currentChat.model} />
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
      >
        <div className={cn(RAIL, "space-y-6 py-6")}>
          {currentMessages.length === 0 && !isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Send a message to start the conversation.
              </p>
            </div>
          ) : (
            currentMessages
              .filter((m) => m.role !== "system")
              .map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Thinking…</span>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-background">
        <div className={cn(RAIL, "py-4")}>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message DeepSeek…"
              className={cn(
                "max-h-[200px] min-h-[52px] resize-none rounded-2xl pr-12",
                "text-sm sm:text-[0.9375rem]",
                "transition-colors"
              )}
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="absolute bottom-2 right-2 size-8 rounded-lg"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
