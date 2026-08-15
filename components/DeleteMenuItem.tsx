"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface DeleteMenuItemProps {
  onSelect: () => void;
}

/**
 * The destructive "Delete" entry shared by the chat-row and message menus.
 *
 * @remarks The legacy-style `DropdownMenuItem` in this project has no
 * `variant="destructive"`, so the destructive styling is applied by class.
 */
export function DeleteMenuItem({ onSelect }: DeleteMenuItemProps) {
  return (
    <DropdownMenuItem
      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
      onSelect={onSelect}
    >
      <Trash2 className="mr-2 size-4" />
      Delete
    </DropdownMenuItem>
  );
}
