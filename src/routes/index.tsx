import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import mascot from "@/assets/panda-mascot.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Healthy Panda — เริ่มต้นดูแลสุขภาพ" },
      {
        name: "description",
        content: "Healthy Panda ผู้ช่วยสุขภาพ AI พร้อมมาสคอตแพนด้าแดง ติดตามแคลอรี น้ำ และกิจวัตร",
      },
      { property: "og:title", content: "Healthy Panda — เริ่มต้นดูแลสุขภาพ" },
      {
        property: "og:description",
        content: "ผู้ช่วยสุขภาพ AI พร้อมมาสคอตแพนด้าแดง ติดตามแคลอรี น้ำ และกิจวัตรประจำวัน",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/dashboard" }), 2200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-primary px-6 text-center">
      <div className="grid size-56 place-items-center rounded-full bg-primary-foreground/15 animate-in fade-in zoom-in-75 duration-700">
        <img
          src={mascot}
          alt="มาสคอตแพนด้าแดง Healthy Panda"
          width={816}
          height={816}
          className="size-44 drop-shadow-xl"
        />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-4xl font-black tracking-tight text-primary-foreground">Healthy Panda</h1>
        <p className="mt-2 text-sm font-bold text-primary-foreground/80">
          สุขภาพดีเริ่มได้ทุกวัน กับเพื่อนแพนด้าของคุณ
        </p>
      </div>
      <button
        onClick={() => navigate({ to: "/dashboard" })}
        className="mt-4 rounded-full bg-card px-8 py-3 text-sm font-extrabold text-primary shadow-[var(--shadow-card)]"
      >
        เข้าสู่แอป
      </button>
    </main>
  );
}
