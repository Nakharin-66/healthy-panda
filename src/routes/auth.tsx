import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import mascot from "@/assets/panda-avatar.png";
import { GoogleButton } from "@/components/AuthModal";
import { syncGuestToProfile, takeReturnTo } from "@/lib/guest";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ Healthy Panda" },
      {
        name: "description",
        content: "เข้าสู่ระบบด้วย Google เพื่อบันทึกข้อมูลสุขภาพและใช้งาน Healthy Panda ได้เต็มรูปแบบ",
      },
      { property: "og:title", content: "เข้าสู่ Healthy Panda" },
      {
        property: "og:description",
        content: "บันทึกข้อมูลสุขภาพของคุณ และใช้งานฟีเจอร์ของ Healthy Panda ได้อย่างเต็มรูปแบบ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(true);
  const done = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, "") || window.location.search);
    const err = params.get("error_description") || params.get("error");
    if (err) toast.error(decodeURIComponent(err.replace(/\+/g, " ")));

    const finish = async () => {
      if (done.current) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setChecking(false);
        return;
      }
      done.current = true;
      try {
        await syncGuestToProfile();
      } catch (e) {
        toast.error("บันทึกข้อมูลเริ่มต้นไม่สำเร็จ จะลองใหม่อีกครั้งภายหลัง");
        console.error(e);
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: takeReturnTo(), replace: true });
    };

    finish();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") finish();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, qc]);

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <img
          src={mascot}
          alt="มาสคอตแพนด้าแดง Healthy Panda"
          width={512}
          height={512}
          className="size-20 rounded-full bg-primary-soft ring-4 ring-primary/25"
        />
        <h1 className="mt-4 text-2xl font-black">เข้าสู่ Healthy Panda</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          บันทึกข้อมูลสุขภาพของคุณ และใช้งานฟีเจอร์ของ Healthy Panda ได้อย่างเต็มรูปแบบ
        </p>
        <div className="card-soft mt-6 w-full p-5">
          {checking ? (
            <p className="py-3 text-sm font-bold text-muted-foreground">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
          ) : (
            <GoogleButton />
          )}
        </div>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-4 text-xs font-bold text-primary"
        >
          ใช้งานต่อแบบ Guest
        </button>
      </div>
    </main>
  );
}
