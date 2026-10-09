import { useState } from "react";
import { toast } from "sonner";
import mascot from "@/assets/panda-avatar.png";
import { closeAuthModal, oauthErrorMessage, signInWithGoogle, signInWithLine, useAuthModalOpen } from "@/lib/guest";

function useOAuthClick(fn: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(oauthErrorMessage(null, err instanceof Error ? err.message : null));
      setBusy(false);
    }
  };
  return { busy, run };
}

export function GoogleButton({ label = "ดำเนินการต่อด้วย Google", returnTo }: { label?: string; returnTo?: string }) {
  const { busy, run } = useOAuthClick(() => signInWithGoogle(returnTo));
  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card py-3.5 text-sm font-extrabold active:scale-[0.98] disabled:opacity-60"
    >
      <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
        G
      </span>
      {busy ? "กำลังไปที่ Google..." : label}
    </button>
  );
}

export function LineButton({ label = "เข้าสู่ระบบด้วย LINE", returnTo }: { label?: string; returnTo?: string }) {
  const { busy, run } = useOAuthClick(() => signInWithLine(returnTo));
  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card py-3.5 text-sm font-extrabold active:scale-[0.98] disabled:opacity-60"
    >
      <span className="grid h-5 place-items-center rounded-md bg-primary px-1 text-[9px] font-black text-primary-foreground">
        LINE
      </span>
      {busy ? "กำลังไปที่ LINE..." : label}
    </button>
  );
}

export function AuthModal() {
  const open = useAuthModalOpen();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-end bg-foreground/50 p-4 sm:place-items-center"
      onClick={closeAuthModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-soft w-full max-w-sm p-6 text-center"
      >
        <img src={mascot} alt="แพนด้าแดง" width={512} height={512} className="mx-auto size-16 rounded-full bg-primary-soft ring-4 ring-primary/20" />
        <h2 className="mt-3 text-lg font-black">เข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          ข้อมูลของคุณจะถูกบันทึกและสามารถใช้งานต่อได้เมื่อกลับมาใช้แอปอีกครั้ง
        </p>
        <div className="mt-5 space-y-2">
          <GoogleButton />
          <LineButton />
          <button onClick={closeAuthModal} className="w-full py-2 text-xs font-bold text-muted-foreground">
            ไว้ทีหลัง
          </button>
        </div>
      </div>
    </div>
  );
}
