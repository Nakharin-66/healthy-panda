import avatar from "@/assets/panda-avatar.png";

type Props = { suggestions: string[]; onPick: (text: string) => void; disabled?: boolean };

export function ChatEmptyState({ suggestions, onPick, disabled }: Props) {
  return (
    <section className="card-soft p-5 text-center">
      <img
        src={avatar}
        alt="โค้ชแพนด้าแดง"
        width={512}
        height={512}
        className="mx-auto size-16 rounded-full bg-primary-soft ring-4 ring-primary/20"
      />
      <h2 className="mt-3 text-base font-extrabold">สวัสดี ฉันคือ Panda AI Coach</h2>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">
        ฉันช่วยวิเคราะห์สุขภาพ โภชนาการ การออกกำลังกาย การนอน และเป้าหมายของคุณได้
        เริ่มด้วยการถามคำถาม หรือเลือกหัวข้อด้านล่างนี้เลย
      </p>
      <div className="mt-4 grid gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-primary/30 bg-primary-soft px-3 py-2.5 text-xs font-extrabold text-primary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
