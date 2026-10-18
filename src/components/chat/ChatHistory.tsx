import { useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ChatBubble } from "./ChatBubble";
import { deleteChatDay, fetchChatPage } from "@/lib/chat/chat.service";
import { bkkAddDays, bkkDate } from "@/lib/bkk";
import { isGroupedWithPrevious } from "@/lib/chat/chat.utils";
import type { ChatMessage } from "@/types/chat";

function dayLabel(day: string) {
  const today = bkkDate();
  if (day === today) return "วันนี้";
  if (day === bkkAddDays(today, -1)) return "เมื่อวาน";
  return new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChatHistory({
  profileId,
  disabled,
}: {
  profileId: string | undefined;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: ["coach_history", profileId],
    enabled: open && !!profileId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      profileId
        ? fetchChatPage(profileId, pageParam)
        : Promise.resolve({ messages: [], nextCursor: null }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
  });
  const groups = useMemo(() => {
    const grouped = new Map<string, ChatMessage[]>();
    const messages = [...(history.data?.pages ?? [])].reverse().flatMap((page) => page.messages);
    for (const message of messages) {
      const day = bkkDate(message.created_at);
      grouped.set(day, [...(grouped.get(day) ?? []), message]);
    }
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [history.data]);
  async function confirmDelete() {
    if (!profileId || !selectedDay || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteChatDay(profileId, selectedDay);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coach_history", profileId] }),
        qc.invalidateQueries({ queryKey: ["coach_chat", profileId] }),
      ]);
      setSelectedDay(null);
    } catch {
      setError("ลบประวัติไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !profileId}
        onClick={() => setOpen(true)}
      >
        <History className="size-4" />
        ประวัติแชท
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ประวัติแชท</DialogTitle>
            <DialogDescription>บทสนทนาของคุณตามวันในเวลาไทย</DialogDescription>
          </DialogHeader>
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลดประวัติ...</p>
          ) : null}
          {history.isError ? (
            <div role="alert" className="text-sm text-destructive">
              โหลดประวัติไม่สำเร็จ{" "}
              <Button variant="outline" size="sm" onClick={() => history.refetch()}>
                ลองใหม่
              </Button>
            </div>
          ) : null}
          {!history.isLoading && !history.isError && groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีประวัติแชท</p>
          ) : null}
          {groups.map(([day, messages]) => (
            <div key={day} className="border-b border-border pb-3">
              <details>
                <summary className="cursor-pointer py-2 text-sm font-bold">{dayLabel(day)}</summary>
                {messages.map((message, index) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    grouped={isGroupedWithPrevious(message, messages[index - 1])}
                  />
                ))}
              </details>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label={`ลบประวัติ ${dayLabel(day)}`}
                title={`ลบประวัติ ${dayLabel(day)}`}
                onClick={() => {
                  setError("");
                  setSelectedDay(day);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {history.hasNextPage ? (
            <Button
              variant="outline"
              disabled={history.isFetchingNextPage}
              onClick={() => history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "กำลังโหลด..." : "โหลดข้อความก่อนหน้า"}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!selectedDay}
        onOpenChange={(value) => {
          if (!value && !deleting) setSelectedDay(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ลบประวัติ{selectedDay ? ` ${dayLabel(selectedDay)}` : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ข้อความของคุณและคำตอบโค้ชทั้งหมดในวันนี้จะถูกลบถาวร ไม่สามารถคืนค่าได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "กำลังลบ..." : "ลบประวัติทั้งวัน"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
