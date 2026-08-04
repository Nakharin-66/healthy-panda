import { Link } from "@tanstack/react-router";
import mascot from "@/assets/panda-avatar.png";

export function SignInPrompt({ message }: { message?: string }) {
  return (
    <section className="card-soft flex flex-col items-center p-6 text-center">
      <img
        src={mascot}
        alt="แพนด้าแดงชวนเข้าสู่ระบบ"
        width={512}
        height={512}
        className="size-16 rounded-full bg-primary-soft ring-4 ring-primary/20"
      />
      <p className="mt-3 text-sm font-extrabold">ยังไม่ได้เข้าสู่ระบบ</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {message ?? "เข้าสู่ระบบเพื่อบันทึกและซิงก์ข้อมูลสุขภาพจริงของคุณ"}
      </p>
      <Link
        to="/auth"
        className="mt-4 rounded-2xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
      >
        เข้าสู่ระบบ / สมัครสมาชิก
      </Link>
    </section>
  );
}
