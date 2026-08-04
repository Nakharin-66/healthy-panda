import { useCallback, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchChatPage } from "@/lib/chat/chat.service";
import { requestAssistantReply } from "@/lib/chat/ai.service";
import { chatErrorMessage } from "@/lib/chat/chat.utils";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@/types/chat";

export function useCoachChat(profileId?: string) {
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const inFlight = useRef(false);

  const query = useInfiniteQuery({
    queryKey: ["coach_chat", profileId],
    enabled: !!profileId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchChatPage(profileId!, pageParam),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
    retry: 1,
  });

  const history = useMemo<ChatMessage[]>(() => {
    const pages = query.data?.pages ?? [];
    // Pages come newest-batch-first from the paginator; oldest page renders first.
    return [...pages].reverse().flatMap((p) => p.messages);
  }, [query.data]);

  const messages = useMemo(() => [...history, ...optimistic], [history, optimistic]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, CHAT_MAX_LENGTH);
      if (!text || inFlight.current) return;
      if (!profileId) {
        toast.error("ยังโหลดโปรไฟล์ไม่เสร็จ ลองอีกครั้งนะ");
        return;
      }

      inFlight.current = true;
      const localId = `local-${Date.now()}`;
      setOptimistic([
        { id: localId, role: "user", message: text, created_at: new Date().toISOString(), pending: true },
      ]);
      setThinking(true);

      try {
        // The server function persists both the user message and the reply.
        await requestAssistantReply({ prompt: text, history });
        await qc.invalidateQueries({ queryKey: ["coach_chat", profileId] });
        setOptimistic([]);
      } catch (error) {
        setOptimistic([]);
        toast.error(chatErrorMessage(error));
      } finally {
        setThinking(false);
        inFlight.current = false;
      }
    },
    [history, profileId, qc],
  );

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasOlder: !!query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
    thinking,
    sending: thinking,
    sendMessage,
  };
}
