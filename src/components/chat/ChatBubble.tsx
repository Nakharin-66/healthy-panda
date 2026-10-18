import avatar from "@/assets/panda-avatar.png";
import { formatChatTime } from "@/lib/chat/chat.utils";
import type { ChatMessage } from "@/types/chat";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
export function ChatBubble({ message, grouped }: { message: ChatMessage; grouped: boolean }) {
  const user = message.role === "user";
  return (
    <Message
      from={message.role}
      className={`${grouped ? "mt-1" : "mt-3"} ${user ? "items-end" : "items-start"}`}
    >
      <div className="flex max-w-full gap-2">
        {!user && !grouped ? <img src={avatar} alt="" className="size-7 shrink-0" /> : null}
        <MessageContent
          className={
            user
              ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground whitespace-pre-wrap break-words"
              : "min-w-0 break-words"
          }
        >
          {user ? message.message : <MessageResponse>{message.message}</MessageResponse>}
        </MessageContent>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {message.pending ? "กำลังส่ง..." : formatChatTime(message.created_at)}
      </span>
    </Message>
  );
}
export function TypingBubble() {
  return (
    <div className="mt-3 flex items-center gap-2" role="status">
      <img src={avatar} alt="" className="size-7" />
      <Shimmer>โค้ชกำลังพิมพ์...</Shimmer>
    </div>
  );
}
