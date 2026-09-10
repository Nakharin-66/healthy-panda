import { useState } from "react";
import avatar from "@/assets/panda-avatar.png";
import { Flame } from "lucide-react";

export function PandaHeader({
  title,
  subtitle,
  streak,
  avatarUrl,
  avatarAlt,
}: {
  title: string;
  subtitle?: string;
  streak?: number;
  avatarUrl?: string | null;
  avatarAlt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!avatarUrl && !failed;
  return (
    <header className="mb-5 flex items-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft ring-2 ring-primary/30">
        {showPhoto ? (
          <img
            src={avatarUrl!}
            alt={avatarAlt ?? "รูปโปรไฟล์ผู้ใช้"}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="size-12 object-cover"
          />
        ) : (
          <img src={avatar} alt="แพนด้าแดงโปรไฟล์" width={512} height={512} className="size-11" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm font-semibold text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {typeof streak === "number" ? (
        <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)]">
          <Flame className="size-4" /> {streak}
        </span>
      ) : null}
    </header>
  );
}
