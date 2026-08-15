"use client";

import { memo, useState } from "react";
import { Copy, Check, MoreHorizontal } from "lucide-react";
import { Message } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeleteMenuItem } from "./DeleteMenuItem";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useChatStore } from "@/store/chatStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: Message;
}

/**
 * One turn in the conversation: the user's message as a right-aligned bubble,
 * the assistant's as left-aligned full-width markdown.
 *
 * @remarks Assistant replies are deliberately not boxed — code blocks, tables
 * and Mermaid diagrams need the full column width to stay readable.
 */
export const MessageBubble = memo(
  function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === "user";
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { copied, copy } = useCopyToClipboard();
    const { currentChatId, deleteMessage } = useChatStore();

    const handleCopy = async () => {
      const ok = await copy(message.content);
      if (ok) toast.success("Copied");
      else toast.error("Failed to copy");
    };

    const handleDelete = async () => {
      if (!currentChatId) return;
      try {
        await deleteMessage(currentChatId, message.id);
        toast.success("Message deleted");
      } catch {
        toast.error("Failed to delete message");
      }
    };

    return (
      <>
        <div
          className={cn(
            "group/message flex w-full flex-col gap-1.5",
            "animate-in fade-in slide-in-from-bottom-1 duration-300",
            isUser ? "items-end" : "items-start"
          )}
        >
          {isUser ? (
            <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5">
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-[0.9375rem]">
                {message.content}
              </div>
            </div>
          ) : (
            <div className="w-full min-w-0 text-sm leading-relaxed sm:text-[0.9375rem]">
              <MarkdownRenderer content={message.content} />
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-2",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1 opacity-0 transition-opacity",
                "group-hover/message:opacity-100 focus-within:opacity-100",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                aria-label="Copy message"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isUser ? "end" : "start"}
                  className="w-40"
                >
                  <DropdownMenuItem onSelect={handleCopy}>
                    <Copy className="mr-2 size-4" />
                    Copy
                  </DropdownMenuItem>
                  <DeleteMenuItem onSelect={() => setConfirmOpen(true)} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!isUser && message.tokenCount && (
              <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
                {message.tokenCount.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete message?"
          description="This message will be permanently removed from the conversation."
          confirmLabel="Delete"
          onConfirm={handleDelete}
        />
      </>
    );
  },
  // Compares the fields actually rendered; the default shallow check would only
  // compare the `message` reference.
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.tokenCount === next.message.tokenCount
);
