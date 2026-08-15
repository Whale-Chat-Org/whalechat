"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEEPSEEK_MODELS } from "@/lib/deepseek";
import { useChatStore } from "@/store/chatStore";
import { toast } from "sonner";

interface ModelPickerProps {
  chatId: string;
  /** The chat's current model id. */
  model: string;
}

/**
 * Switch the active chat's model from the conversation header.
 *
 * @remarks The choice is stored per chat, so switching affects only this
 * conversation and takes effect on the next message sent.
 */
export function ModelPicker({ chatId, model }: ModelPickerProps) {
  const { updateChat } = useChatStore();

  const handleChange = async (next: string) => {
    if (next === model) return;
    try {
      await updateChat(chatId, { model: next });
      toast.success(`Switched to ${next}`);
    } catch {
      toast.error("Failed to switch model");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          <span className="max-w-[9rem] truncate">{model}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup value={model} onValueChange={handleChange}>
          {DEEPSEEK_MODELS.map((m) => (
            <DropdownMenuRadioItem key={m} value={m} className="text-sm">
              {m}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
