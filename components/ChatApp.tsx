"use client";

import { useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { useChatStore } from "@/store/chatStore";
import {
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  NEW_CHAT_NAME,
} from "@/lib/deepseek";
import { toast } from "sonner";

interface ChatAppProps {
  /** Whether to offer the admin portal in the sidebar's user menu. */
  isAdmin: boolean;
}

/** The chat application shell: sidebar and conversation pane. */
export function ChatApp({ isAdmin }: ChatAppProps) {
  const { loadChats, createChat } = useChatStore();

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // No dialog: a new chat starts immediately with the defaults and renames
  // itself from the first message (see ChatWindow).
  const handleNewChat = async () => {
    try {
      await createChat({
        name: NEW_CHAT_NAME,
        model: DEFAULT_MODEL,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      });
    } catch {
      toast.error("Failed to create chat");
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar onNewChat={handleNewChat} isAdmin={isAdmin} />

      <SidebarInset className="min-w-0">
        <ChatWindow onNewChat={handleNewChat} />
      </SidebarInset>
    </SidebarProvider>
  );
}
