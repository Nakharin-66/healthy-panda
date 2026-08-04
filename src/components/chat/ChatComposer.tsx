import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { CHAT_MAX_LENGTH } from "@/types/chat";

type Props = {
  suggestions: string[];
  onSend: (text: string) => void;
  disabled?: boolean;
};

export function ChatComposer({ suggestions, onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize up to ~4 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [value]);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="fixed inset-x-0 bottom-[62px] mx-auto max-w-md bg-background px-4 pb-2 pt-2">
      <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
        {suggestions.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => submit(c)}
            className="shrink-0 rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-extrabold text-primary disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-end gap-2 rounded-3xl bg-card p-1.5 shadow-[var(--shadow-card)]"
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={CHAT_MAX_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          placeholder="ถามโค้ชแพนด้า..."
          aria-label="ข้อความถึงโค้ชแพนด้า"
          className="max-h-28 flex-1 resize-none bg-transparent px-3 py-2 text-sm font-semibold outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="ส่งข้อความ"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
        >
          <Send className="size-4.5" strokeWidth={2.4} />
        </button>
      </form>
      {value.length > CHAT_MAX_LENGTH - 100 ? (
        <p className="mt-1 text-right text-[10px] font-bold text-muted-foreground">
          {value.length}/{CHAT_MAX_LENGTH}
        </p>
      ) : null}
    </div>
  );
}
