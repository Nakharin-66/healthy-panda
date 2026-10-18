import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchChatPage } from "@/lib/chat/chat.service";
import { sendCoachMessage } from "@/lib/chat/ai.service";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@/types/chat";
import { afterConversationStart } from "@/lib/chat/coach.rules";

export function useCoachChat(profileId?: string) {
  const qc = useQueryClient();
  const send = useServerFn(sendCoachMessage);
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [sendError, setSendError] = useState("");
  const [retryable, setRetryable] = useState(true);
  const [failedText, setFailedText] = useState("");
  const inFlight = useRef(false);
  const [conversation, setConversation] = useState<{ profileId?: string; since: string | null }>({ since: null });
  useEffect(() => {
    let since: string | null = null;
    if (profileId) {
      try {
        const saved = localStorage.getItem(`hp_coach_started_at:${profileId}`);
        if (saved && Number.isFinite(Date.parse(saved))) since = new Date(saved).toISOString();
      } catch { /* The current page still works when browser storage is unavailable. */ }
    }
    setConversation({ profileId, since });
    setOptimistic([]);
    setSendError("");
    setFailedText("");
  }, [profileId]);
  const ready = !!profileId && conversation.profileId === profileId;
  const since = ready ? conversation.since : null;
  const startNewChat = useCallback(() => {
    if (!profileId || inFlight.current) return;
    const timestamp = new Date().toISOString();
    try { localStorage.setItem(`hp_coach_started_at:${profileId}`, timestamp); } catch { /* Page state is the fallback. */ }
    setConversation({ profileId, since: timestamp });
    setOptimistic([]);
    setSendError("");
    setFailedText("");
  }, [profileId]);
  const query = useInfiniteQuery({
    queryKey: ["coach_chat", profileId, since],
    enabled: ready,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      profileId
        ? fetchChatPage(profileId, pageParam, since)
        : Promise.resolve({ messages: [], nextCursor: null }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60000,
    retry: 1,
  });
  const history = useMemo(
    () =>
      [...(query.data?.pages ?? [])]
        .reverse()
        .flatMap((p) => p.messages)
        .filter((m) => m.role !== "system" && afterConversationStart(m.created_at, since)),
    [query.data, since],
  );
  const messages = useMemo(() => [...history, ...optimistic], [history, optimistic]);
  const sendMessage = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim();
      if (!text || inFlight.current) return false;
      if (text.length > CHAT_MAX_LENGTH) {
        setSendError("ข้อความต้องไม่เกิน 1000 ตัวอักษร");
        return false;
      }
      if (!profileId || !ready) {
        setSendError("กรุณาเข้าสู่ระบบและรอโหลดโปรไฟล์ก่อนคุยกับโค้ช");
        return false;
      }
      inFlight.current = true;
      setThinking(true);
      setSendError("");
      setRetryable(true);
      setFailedText(text);
      setOptimistic([
        {
          id: `local-${Date.now()}`,
          role: "user",
          message: text,
          created_at: new Date().toISOString(),
          pending: true,
        },
      ]);
      try {
        const result = await send({ data: { message: text, ...(since ? { conversationStartedAt: since } : {}) } });
        if (result.error) {
          setSendError(result.error);
          setRetryable(result.retryable ?? false);
          if (result.reply)
            setOptimistic((prev) => [
              ...prev,
              {
                id: `reply-${Date.now()}`,
                role: "assistant",
                message: result.reply,
                created_at: new Date().toISOString(),
              },
            ]);
          return false;
        }
        await qc.invalidateQueries({ queryKey: ["coach_chat", profileId] });
        setOptimistic([]);
        setFailedText("");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        setSendError(
          /unauthorized|jwt/i.test(message)
            ? "กรุณาเข้าสู่ระบบใหม่เพื่อคุยกับโค้ช"
            : /[ก-๙]/.test(message)
              ? message
              : "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่",
        );
        return false;
      } finally {
        setThinking(false);
        inFlight.current = false;
      }
    },
    [profileId, qc, send, since, ready],
  );
  return {
    messages,
    startNewChat,
    composerKey: since ?? "original",
    isLoading: !ready || query.isLoading,
    isError: query.isError,
    error: query.error,
    hasOlder: !!query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
    reload: query.refetch,
    thinking,
    sending: thinking,
    sendMessage,
    sendError,
    retryable,
    failedText,
  };
}
