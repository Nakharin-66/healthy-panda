import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import avatar from "@/assets/panda-avatar.png";
import { formatChatTime } from "@/lib/chat/chat.utils";
import type { ChatMessage } from "@/types/chat";

type Props = { message: ChatMessage; grouped: boolean };

export function ChatBubble({ message, grouped }: Props) {
  const isUser = message.role === "user";
  const time = formatChatTime(message.created_at);

  if (isUser) {
    return (
      <div className={`flex flex-col items-end ${grouped ? "mt-1" : "mt-3"}`}>
        <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground">
          {message.message}
        </p>
        <span className="mr-1 mt-1 text-[10px] font-bold text-muted-foreground">
          {message.pending ? "กำลังส่ง..." : time}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${grouped ? "mt-1" : "mt-3"}`}>
      {grouped ? (
        <span className="size-7 shrink-0" aria-hidden />
      ) : (
        <img src={avatar} alt="" width={512} height={512} className="mt-1 size-7 shrink-0" />
      )}
      <div className="flex max-w-[80%] flex-col items-start">
        <div className="prose-panda break-words rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5 text-sm font-semibold [&_a]:underline [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-extrabold [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-extrabold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-extrabold [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-extrabold [&_strong]:text-primary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
          <Markdown remarkPlugins={[remarkGfm]}>{message.message}</Markdown>
        </div>
        <span className="ml-1 mt-1 text-[10px] font-bold text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="mt-3 flex gap-2" aria-live="polite">
      <img src={avatar} alt="" width={512} height={512} className="mt-1 size-7 shrink-0" />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5">
        <span className="text-sm font-semibold text-muted-foreground">Panda is thinking...</span>
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
