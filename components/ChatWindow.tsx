"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, MessageSquarePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SendIcon } from "./SendIcon";
import { ModelPicker } from "./ModelPicker";
import { useChatStore } from "@/store/chatStore";
import { MessageBubble } from "./MessageBubble";
import { sendChatMessage } from "@/lib/api";
import { toast } from "sonner";
import { cn, deriveChatName } from "@/lib/utils";
import { NEW_CHAT_NAME } from "@/lib/deepseek";

/** One rail width shared by header, message column and composer so they align. */
const RAIL = "mx-auto w-full max-w-3xl px-4 sm:px-6";

interface ChatWindowProps {
  /** Invoked by the empty state's "New chat" button. */
  onNewChat: () => void;
}

/** The conversation pane: header, message list and composer. */
export function ChatWindow({ onNewChat }: ChatWindowProps) {
  const { currentChatId, messages, chats, addMessage, updateChat } =
    useChatStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChat = chats.find((c) => c.id === currentChatId);
  // Memoized so the empty-array fallback doesn't produce a new reference each
  // render, which would re-run the scroll effect below every time.
  const currentMessages = useMemo(
    () => (currentChatId ? messages[currentChatId] ?? [] : []),
    [currentChatId, messages]
  );

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [currentMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
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
        role: "user",
        content: userMessage,
      });

      // Title the chat from its opening message. Guarded on the message count
      // rather than the name alone, so a deliberate rename is never overwritten.
      if (isFirstMessage && currentChat.name === NEW_CHAT_NAME) {
        await updateChat(currentChatId, {
          name: deriveChatName(userMessage),
        });
      }

      const response = await sendChatMessage(
        currentChat,
        userMessage,
        currentMessages
      );

      await addMessage({
        chatId: currentChatId,
        role: "assistant",
        content: response.content,
        tokenCount: response.tokenCount,
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
