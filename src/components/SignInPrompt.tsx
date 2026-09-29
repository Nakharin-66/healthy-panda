import mascot from "@/assets/panda-avatar.png";
import { openAuthModal } from "@/lib/guest";

/** Guest preview card: page is viewable, saving real data opens the sign-in modal. */
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
      <p className="mt-3 text-sm font-extrabold">โหมดทดลองใช้ (Guest)</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {message ?? "เข้าสู่ระบบเพื่อบันทึกและซิงก์ข้อมูลสุขภาพจริงของคุณ"}
      </p>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">ยังไม่มีข้อมูลในหน้านี้</p>
      <button
        onClick={openAuthModal}
        className="mt-4 rounded-2xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
      >
        เริ่มใช้งานฟีเจอร์นี้
      </button>
    </section>
  );
}
