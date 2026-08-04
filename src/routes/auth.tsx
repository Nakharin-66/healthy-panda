import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import mascot from "@/assets/panda-avatar.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ | Healthy Panda" },
      {
        name: "description",
        content: "เข้าสู่ระบบ Healthy Panda เพื่อบันทึกข้อมูลสุขภาพ อาหาร น้ำดื่ม และเป้าหมายของคุณ",
      },
      { property: "og:title", content: "เข้าสู่ระบบ | Healthy Panda" },
      {
        property: "og:description",
        content: "สมัครหรือเข้าสู่ระบบเพื่อซิงก์ข้อมูลสุขภาพของคุณกับผู้ช่วย AI แพนด้าแดง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/dashboard" });
  }, [loading, signedIn, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("สมัครสำเร็จ! เข้าสู่ระบบได้เลย 🐼");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={mascot}
            alt="มาสคอตแพนด้าแดง Healthy Panda"
            width={512}
            height={512}
            className="size-20 rounded-full bg-primary-soft ring-4 ring-primary/25"
          />
          <h1 className="mt-3 text-2xl font-black">Healthy Panda</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            เข้าสู่ระบบเพื่อบันทึกข้อมูลสุขภาพของคุณ
          </p>
        </div>

        <form onSubmit={submit} className="card-soft space-y-3 p-5">
          {mode === "signup" ? (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ชื่อที่แสดง"
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
            />
          ) : null}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
            className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:opacity-60"
          >
            {mode === "signup" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
          <button
            type="button"
            onClick={google}
            className="w-full rounded-2xl border-2 border-border bg-card py-3.5 text-sm font-extrabold active:scale-[0.98]"
          >
            เข้าสู่ระบบด้วย Google
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="w-full pt-1 text-xs font-bold text-primary"
          >
            {mode === "signup" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครสมาชิก"}
          </button>
        </form>
      </div>
    </main>
  );
}
