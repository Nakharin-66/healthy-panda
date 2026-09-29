import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import mascot from "@/assets/panda-mascot.png";
import { useAuth } from "@/hooks/useAuth";
import { readGuest } from "@/lib/guest";

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

  useEffect(() => {
    if (loading) return;
    if (signedIn || readGuest()?.completed) navigate({ to: "/dashboard", replace: true });
  }, [loading, signedIn, navigate]);

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
      <button
        onClick={() => navigate({ to: "/onboarding" })}
        className="mt-2 w-full max-w-xs rounded-full bg-card py-3.5 text-base font-extrabold text-primary shadow-[var(--shadow-card)] active:scale-[0.98]"
      >
        เริ่มต้น
      </button>
      <p className="text-xs font-semibold text-primary-foreground/80">ใช้งานเบื้องต้นได้โดยไม่ต้องสมัครสมาชิก</p>
    </main>
  );
}
