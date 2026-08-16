"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { useCreateChat } from "@/hooks/use-chats";
import { useChatStore } from "@/store/chatStore";
import { toast } from "sonner";

interface ChatAppProps {
  /** Whether to offer the admin portal in the sidebar's user menu. */
  isAdmin: boolean;
}

/** The chat application shell: sidebar and conversation pane. */
export function ChatApp({ isAdmin }: ChatAppProps) {
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const { mutate: createChat } = useCreateChat();

  // No dialog: a new chat starts immediately on the server's defaults and
  // renames itself from the first message (see ChatWindow).
  const handleNewChat = () => {
    createChat(undefined, {
      onSuccess: (chat) => setCurrentChat(chat.id),
      onError: () => toast.error("Failed to create chat"),
    });
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
