"use client";

import { Plus, MessageSquare, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useChats } from "@/hooks/use-chats";
import { useChatStore } from "@/store/chatStore";
import { ChatListItem } from "./ChatListItem";
import { UserButton } from "./auth/user/user-button";

interface AppSidebarProps {
  onNewChat: () => void;
  /** Adds the admin portal to the user menu. Cosmetic — `/admin` gates itself. */
  canAdminister: boolean;
}

/** Chat list, new-chat action and the signed-in user, in shadcn's collapsible sidebar. */
export function AppSidebar({ onNewChat, canAdminister }: AppSidebarProps) {
  const currentChatId = useChatStore((state) => state.currentChatId);
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const { data: chats = [], isPending } = useChats();
  const { isMobile, setOpenMobile } = useSidebar();

  // On mobile the sidebar is an overlay drawer, so acting on it should dismiss
  // it — otherwise the chat you just opened stays hidden behind it.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleNewChat = () => {
    onNewChat();
    closeOnMobile();
  };

  const handleSelect = (chatId: string) => {
    setCurrentChat(chatId);
    closeOnMobile();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          size="sm"
        >
          <Plus className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">New chat</span>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === currentChatId}
                  onSelect={() => handleSelect(chat.id)}
                />
              ))}
            </SidebarMenu>

            {isPending && (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )}

            {!isPending && chats.length === 0 && (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                <MessageSquare className="mx-auto mb-2 size-6 opacity-40" />
                <p>No chats yet</p>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <UserButton
            className="h-auto w-full justify-start px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            align="start"
            links={
              canAdminister
                ? [
                    {
                      label: "Admin portal",
                      href: "/admin",
                      icon: <ShieldCheck />,
                    },
                  ]
                : undefined
            }
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
