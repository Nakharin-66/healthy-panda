import { supabase } from "@/integrations/supabase/client";
import { CHAT_PAGE_SIZE, rowToMessage, type ChatMessage, type ChatRole } from "@/types/chat";
import { bkkAddDays, bkkDayStart } from "@/lib/bkk";

export type ChatPage = {
  /** Ordered oldest -> newest within the page. */
  messages: ChatMessage[];
  /** `created_at` cursor for the next (older) page, or null when exhausted. */
  nextCursor: string | null;
};

/**
 * Loads one page of chat history, newest-first from the database, returned
 * oldest-first for rendering. Pass `before` (a `created_at` ISO string) to
 * page further back — this is what makes history effectively infinite.
 */
export async function fetchChatPage(
  profileId: string,
  before?: string | null,
  since?: string | null,
): Promise<ChatPage> {
  let q = supabase
    .from("ai_conversations")
    .select("*")
    .eq("profile_id", profileId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);

  if (before) q = q.lt("created_at", before);
  if (since) q = q.gt("created_at", since);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data ?? [];
  const messages = rows.map(rowToMessage).reverse();
  const nextCursor =
    rows.length === CHAT_PAGE_SIZE ? (rows[rows.length - 1]?.created_at ?? null) : null;
  return { messages, nextCursor };
}

/** RLS applies through the signed-in browser client; system block rows are not chat history. */
export async function deleteChatDay(profileId: string, day: string): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("profile_id", profileId)
    .in("role", ["user", "assistant"])
    .gte("created_at", bkkDayStart(day))
    .lt("created_at", bkkDayStart(bkkAddDays(day, 1)));
  if (error) throw error;
}

export type NewChatMessage = {
  role: ChatRole;
  message: string;
  metadata?: Record<string, unknown>;
};

/** Persists one message and returns the stored row as a UI message. */
export async function insertChatMessage(
  profileId: string,
  input: NewChatMessage,
  sessionId?: string,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      profile_id: profileId,
      role: input.role,
      message: input.message,
      metadata: (input.metadata ?? {}) as never,
      ...(sessionId ? { session_id: sessionId } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMessage(data);
}
