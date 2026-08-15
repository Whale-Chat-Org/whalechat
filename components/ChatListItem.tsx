"use client";

import { useState } from "react";
import { MessageSquare, MoreHorizontal } from "lucide-react";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatSession } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeleteMenuItem } from "./DeleteMenuItem";

interface ChatListItemProps {
  chat: ChatSession;
  isActive: boolean;
  onSelect: () => void;
}

/** A single chat row in the sidebar, with a hover-revealed delete menu. */
export function ChatListItem({
  chat,
  isActive,
  onSelect,
}: ChatListItemProps) {
  const { deleteChat } = useChatStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          onClick={onSelect}
          tooltip={chat.name}
        >
          <MessageSquare className="size-4 shrink-0" />
          {/* min-w-0 is what lets truncate actually ellipsize inside a flex row */}
          <span className="min-w-0 flex-1 truncate">{chat.name}</span>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              aria-label={`Options for ${chat.name}`}
            >
              <MoreHorizontal className="size-4" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-40">
            <DeleteMenuItem onSelect={() => setConfirmOpen(true)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete chat?"
        description={`"${chat.name}" and all its messages will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => deleteChat(chat.id)}
      />
    </>
  );
}
