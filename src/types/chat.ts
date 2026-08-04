import type { Tables } from "@/integrations/supabase/types";

export type ChatRole = "user" | "assistant" | "system";

/** A persisted chat row from the `ai_conversations` table. */
export type ChatMessageRow = Tables<"ai_conversations">;

/** UI-level message: either persisted or an optimistic local one. */
export type ChatMessage = {
  id: string;
  role: ChatRole;
  message: string;
  created_at: string;
  pending?: boolean;
};

export const CHAT_MAX_LENGTH = 1000;
export const CHAT_PAGE_SIZE = 30;

export function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    message: row.message,
    created_at: row.created_at,
  };
}
