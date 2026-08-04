import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ChatBubble, TypingBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useCoachChat } from "@/hooks/useCoachChat";
import { useProfile } from "@/lib/db";
import { isGroupedWithPrevious } from "@/lib/chat/chat.utils";
import avatar from "@/assets/panda-avatar.png";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "โค้ช AI แพนด้า | Healthy Panda" },
      {
        name: "description",
        content: "คุยกับโค้ช AI แพนด้าเพื่อรับคำแนะนำโภชนาการและการออกกำลังกายแบบส่วนตัว",
      },
      { property: "og:title", content: "โค้ช AI แพนด้า | Healthy Panda" },
      {
        property: "og:description",
        content: "คำแนะนำสุขภาพส่วนบุคคลจากโค้ช AI แพนด้าแดง ตลอด 24 ชั่วโมง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Coach,
});

const SUGGESTIONS = [
  "วันนี้ควรกินอะไรดี?",
  "วิเคราะห์โภชนาการวันนี้",
  "วิเคราะห์การออกกำลังกายวันนี้",
  "ลดน้ำหนักยังไงให้ยั่งยืน",
  "ฉันควรดื่มน้ำเพิ่มไหม?",
];

function Coach() {
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const chat = useCoachChat(profile?.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, chat.thinking]);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อคุยกับโค้ชแพนด้าและบันทึกประวัติการสนทนา" />
      </AppScreen>
    );
  }

  const list = chat.messages;

  return (
    <AppScreen>
      <header className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <div className="relative">
          <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-primary-soft">
            <img src={avatar} alt="โค้ชแพนด้า" width={512} height={512} className="size-11" />
          </div>
          <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card bg-success" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold leading-tight">Panda Coach</h1>
          <p className="text-xs font-bold text-success">ออนไลน์ • ตอบทันที</p>
        </div>
      </header>

      <div className="pb-28">
        {chat.hasOlder ? (
          <button
            type="button"
            onClick={() => chat.loadOlder()}
            disabled={chat.isLoadingOlder}
            className="mx-auto mb-2 block rounded-full border border-border px-4 py-1.5 text-xs font-extrabold text-muted-foreground disabled:opacity-50"
          >
            {chat.isLoadingOlder ? "กำลังโหลด..." : "โหลดข้อความก่อนหน้า"}
          </button>
        ) : null}

        {chat.isLoading ? (
          <p className="py-6 text-center text-xs font-bold text-muted-foreground">กำลังโหลดบทสนทนา...</p>
        ) : null}

        {!chat.isLoading && list.length === 0 && !chat.thinking ? (
          <ChatEmptyState
            suggestions={SUGGESTIONS}
            onPick={chat.sendMessage}
            disabled={chat.sending}
          />
        ) : null}

        {list.map((m, i) => (
          <ChatBubble key={m.id} message={m} grouped={isGroupedWithPrevious(m, list[i - 1])} />
        ))}

        {chat.thinking ? <TypingBubble /> : null}
        <div ref={bottomRef} />
      </div>

      <ChatComposer suggestions={SUGGESTIONS} onSend={chat.sendMessage} disabled={chat.sending} />
    </AppScreen>
  );
}
