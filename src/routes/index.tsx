import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import mascot from "@/assets/panda-mascot.png";
import { useAuth } from "@/hooks/useAuth";
import { oauthErrorMessage, readGuest, signInWithGoogle, signInWithLine } from "@/lib/guest";
import { storedDestination } from "@/lib/miniapp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Healthy Panda — สุขภาพที่ดี เริ่มต้นได้จากวันนี้" },
      {
        name: "description",
        content: "มาทำความรู้จักคุณ และตั้งเป้าหมายสุขภาพที่เหมาะกับคุณ ใช้งานเบื้องต้นได้โดยไม่ต้องสมัครสมาชิก",
      },
      { property: "og:title", content: "Healthy Panda — สุขภาพที่ดี เริ่มต้นได้จากวันนี้" },
      {
        property: "og:description",
        content: "ตั้งเป้าหมายสุขภาพที่เหมาะกับคุณกับเพื่อนแพนด้าแดง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (new URLSearchParams(window.location.search).has("liff.state")) return;
    if (signedIn || readGuest()?.completed) navigate({ to: storedDestination(), replace: true });
  }, [loading, signedIn, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle(storedDestination());
    } catch (err) {
      setSigningIn(false);
      const m = err instanceof Error ? err.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ";
      toast.error(m.toLowerCase().includes("not enabled") ? "ยังไม่ได้เปิดใช้งาน Google ใน Supabase" : m);
    }
  };

  const [lineBusy, setLineBusy] = useState(false);
  const handleLineSignIn = async () => {
    setLineBusy(true);
    try {
      await signInWithLine(storedDestination());
    } catch (err) {
      setLineBusy(false);
      toast.error(oauthErrorMessage(null, err instanceof Error ? err.message : null));
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-primary px-6 text-center">
      <div className="grid size-56 place-items-center rounded-full bg-primary-foreground/15 animate-in fade-in zoom-in-75 duration-700">
        <img src={mascot} alt="มาสคอตแพนด้าแดง Healthy Panda" width={816} height={816} className="size-44 drop-shadow-xl" />
      </div>
      <div className="max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl font-black leading-tight text-primary-foreground">
          สุขภาพที่ดี เริ่มต้นได้จากวันนี้
        </h1>
        <p className="mt-3 text-sm font-bold text-primary-foreground/85">
          มาทำความรู้จักคุณ และตั้งเป้าหมายสุขภาพที่เหมาะกับคุณ
        </p>
      </div>
      <div className="mt-2 w-full max-w-xs space-y-2.5">
        <button
          onClick={() => navigate({ to: "/onboarding" })}
          className="w-full rounded-full bg-card py-3.5 text-base font-extrabold text-primary shadow-[var(--shadow-card)] active:scale-[0.98]"
        >
          เริ่มต้น
        </button>
        <button
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary-foreground/40 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          <span className="grid size-5 place-items-center rounded-full bg-primary-foreground text-[11px] font-black text-primary">
            G
          </span>
          {signingIn ? "กำลังไปที่ Google..." : "เข้าสู่ระบบด้วย Google"}
        </button>
        <button
          onClick={handleLineSignIn}
          disabled={lineBusy}
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary-foreground/40 py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          <span className="grid h-5 place-items-center rounded-md bg-primary-foreground px-1 text-[9px] font-black text-primary">
            LINE
          </span>
          {lineBusy ? "กำลังไปที่ LINE..." : "เข้าสู่ระบบด้วย LINE"}
        </button>
      </div>
      <p className="text-xs font-semibold text-primary-foreground/80">สำหรับผู้ที่มีบัญชีหรือเคยใช้งานแล้ว กดเข้าสู่ระบบได้เลย</p>
    </main>
  );
}
