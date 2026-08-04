import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/dashboard" });
  }, [loading, signedIn, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = params.get("error_description") || params.get("error");
    if (err) toast.error(decodeURIComponent(err));
  }, []);

  const authErrorMessage = (message: string) => {
    const m = message.toLowerCase();
    if (m.includes("rate limit"))
      return "ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ (จำกัดโดย Supabase)";
    if (m.includes("email address") && m.includes("invalid"))
      return "อีเมลนี้ไม่ถูกต้องหรือถูกปฏิเสธ กรุณาใช้อีเมลจริงอีกอันหนึ่ง";
    if (m.includes("already registered") || m.includes("already been registered"))
      return "อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบ";
    if (m.includes("password")) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    return message;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          setNeedsConfirm(true);
          toast.success("สมัครสำเร็จ! กรุณายืนยันอีเมลในกล่องจดหมายของคุณก่อนเข้าสู่ระบบ 🐼");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("not confirmed")) {
            setNeedsConfirm(true);
            toast.error("อีเมลนี้ยังไม่ได้ยืนยัน กรุณากดยืนยันในอีเมลก่อนเข้าสู่ระบบ");
            return;
          }
          if (error.message.toLowerCase().includes("invalid login")) {
            toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            return;
          }
          throw error;
        }
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(authErrorMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) {
      toast.error("กรอกอีเมลก่อนนะ");
      return;
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(authErrorMessage(error.message));
    else toast.success("ส่งอีเมลยืนยันใหม่แล้ว ตรวจกล่องจดหมายของคุณ");
  };

  const google = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("ไม่สามารถสร้างลิงก์เข้าสู่ระบบ Google");

      const inIframe = window.self !== window.top;
      if (inIframe) {
        // Google blocks its sign-in page inside iframes, so continue in a new tab.
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.info("เปิดหน้าเข้าสู่ระบบ Google ในแท็บใหม่ กรุณาทำต่อในแท็บนั้น");
      } else {
        window.location.assign(data.url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ";
      toast.error(
        message.toLowerCase().includes("not enabled")
          ? "ยังไม่ได้เปิดใช้งาน Google ในโปรเจกต์ Supabase ของคุณ"
          : message,
      );
    } finally {
      setBusy(false);
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
          {needsConfirm ? (
            <button
              type="button"
              onClick={resend}
              className="w-full rounded-2xl bg-secondary py-3 text-xs font-extrabold text-primary active:scale-[0.98]"
            >
              ส่งอีเมลยืนยันอีกครั้ง
            </button>
          ) : null}
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
