import { askPandaCoach } from "@/lib/chat/coach.functions";
import type { ChatMessage } from "@/types/chat";

export type AssistantReplyRequest = {
  /** The message the user just sent. */
  prompt: string;
  /** Recent conversation for context (oldest -> newest). */
  history: ChatMessage[];
};

export type AssistantReply = {
  message: string;
  metadata: Record<string, unknown>;
};

/**
 * Single AI boundary for the coach.
 *
 * Calls a server function that builds the signed-in user's health context,
 * queries Gemini through the AI gateway, and persists both chat messages.
 * The API key never reaches the browser.
 */
export async function requestAssistantReply(
  request: AssistantReplyRequest,
): Promise<AssistantReply> {
  const history = request.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.message }));

  const reply = await askPandaCoach({ data: { prompt: request.prompt, history } });
  return { message: reply.message, metadata: { model: reply.model } };
}
