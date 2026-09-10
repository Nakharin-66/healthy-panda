import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, Users, Globe, Check, Loader2, ExternalLink } from "lucide-react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useSettings, useUpdateSettings } from "@/lib/db";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "ความเป็นส่วนตัว | Healthy Panda" },
      {
        name: "description",
        content:
          "ควบคุมการมองเห็นข้อมูลและกิจกรรมสุขภาพของคุณ เลือกระดับความเป็นส่วนตัวที่เหมาะกับคุณได้ตลอดเวลา",
      },
      { property: "og:title", content: "ความเป็นส่วนตัว | Healthy Panda" },
      {
        property: "og:description",
        content: "เลือกระดับความเป็นส่วนตัวของข้อมูลสุขภาพและกิจกรรมของคุณ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

type Level = "private" | "friends" | "public";

const LEVELS: {
  value: Level;
  label: string;
  icon: typeof Lock;
  summary: string;
  bullets: string[];
}[] = [
  {
    value: "private",
    label: "ส่วนตัว",
    icon: Lock,
    summary:
      "ข้อมูลสุขภาพและกิจกรรมของคุณจะแสดงเฉพาะคุณเท่านั้น ผู้ใช้อื่นจะไม่สามารถมองเห็นข้อมูลเหล่านี้ได้",
    bullets: [
      "ข้อมูลสุขภาพเป็นส่วนตัว",
      "กิจกรรมส่วนตัวไม่แสดงต่อผู้ใช้อื่น",
      "ข้อมูลการใช้งานเพื่อการจัดอันดับต้องปฏิบัติตามกติกาของฟีเจอร์นั้น",
    ],
  },
  {
    value: "friends",
    label: "เพื่อน",
    icon: Users,
    summary: "อนุญาตให้เพื่อนเห็นข้อมูลบางประเภทที่ระบบรองรับการแชร์",
    bullets: [
      "เพื่อนสามารถเห็นข้อมูลที่อนุญาต",
      "ผู้ใช้ทั่วไปที่ไม่ใช่เพื่อนไม่สามารถเห็นข้อมูลนั้น",
      "ข้อมูลสุขภาพที่ละเอียดอ่อนยังคงเป็นข้อมูลส่วนตัว",
    ],
  },
  {
    value: "public",
    label: "สาธารณะ",
    icon: Globe,
    summary: "อนุญาตให้ผู้ใช้รายอื่นเห็นข้อมูลบางประเภทที่ระบบรองรับการเผยแพร่",
    bullets: [
      "เหมาะกับ Challenge และการจัดอันดับ",
      "ข้อมูลที่ระบบกำหนดให้เป็นสาธารณะอาจแสดงต่อผู้ใช้รายอื่น",
      "ไม่เปิดเผยข้อมูลสุขภาพที่ละเอียดอ่อนโดยอัตโนมัติ",
    ],
  },
];

const SHARED_DATA: { label: string; status: Record<Level, string> }[] = [
  {
    label: "โปรไฟล์",
    status: { private: "เฉพาะคุณ", friends: "เฉพาะเพื่อน", public: "ทุกคนที่ใช้แอป" },
  },
  {
    label: "กิจกรรม",
    status: { private: "เฉพาะคุณ", friends: "เฉพาะเพื่อน", public: "ทุกคนที่ใช้แอป" },
  },
  {
    label: "เป้าหมาย",
    status: { private: "เฉพาะคุณ", friends: "เฉพาะเพื่อน", public: "เฉพาะเพื่อน" },
  },
  {
    label: "คะแนน Challenge",
    status: {
      private: "แสดงในอันดับตามกติกาของฟีเจอร์",
      friends: "แสดงในอันดับและเพื่อนเห็นได้",
      public: "แสดงในอันดับต่อทุกคน",
    },
  },
  { label: "ข้อมูลสุขภาพ", status: { private: "เฉพาะคุณ", friends: "เฉพาะคุณ", public: "เฉพาะคุณ" } },
  { label: "ข้อมูลการนอน", status: { private: "เฉพาะคุณ", friends: "เฉพาะคุณ", public: "เฉพาะคุณ" } },
  { label: "ข้อมูลอาหาร", status: { private: "เฉพาะคุณ", friends: "เฉพาะคุณ", public: "เฉพาะคุณ" } },
];

function formatThaiDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function PrivacyPage() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const settingsQuery = useSettings(profile?.id);
  const settings = settingsQuery.data;
  const updateSettings = useUpdateSettings(profile?.id);
  const [pending, setPending] = useState<Level | null>(null);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อจัดการความเป็นส่วนตัวของคุณ" />
      </AppScreen>
    );
  }

  const isLoading = profileQuery.isLoading || settingsQuery.isLoading;
  const isError = profileQuery.isError || settingsQuery.isError;
  const current = (settings?.privacy_level ?? "private") as Level;

  const confirm = () => {
    if (!pending) return;
    updateSettings.mutate(
      { privacy_level: pending },
      {
        onSuccess: () => {
          toast.success("บันทึกการตั้งค่าความเป็นส่วนตัวแล้ว");
          setPending(null);
        },
        onError: () => toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง"),
      },
    );
  };

  return (
    <AppScreen>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/profile" })}
          aria-label="กลับไปหน้าบัญชี"
          className="grid size-9 place-items-center rounded-xl bg-secondary active:scale-95"
        >
          <ArrowLeft className="size-4.5" strokeWidth={2.4} />
        </button>
        <h1 className="text-xl font-black">ความเป็นส่วนตัว</h1>
      </div>

      <p className="mb-4 px-1 text-xs font-bold leading-relaxed text-muted-foreground">
        ควบคุมการมองเห็นข้อมูลและกิจกรรมสุขภาพของคุณ เลือกระดับความเป็นส่วนตัวที่เหมาะกับคุณได้ตลอดเวลา
      </p>

      {isLoading ? (
        <div className="card-soft flex items-center justify-center gap-2 p-8 text-sm font-bold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> กำลังโหลด...
        </div>
      ) : isError ? (
        <div className="card-soft p-6 text-center">
          <p className="text-sm font-extrabold">ไม่สามารถโหลดข้อมูลได้</p>
          <button
            onClick={() => {
              profileQuery.refetch();
              settingsQuery.refetch();
            }}
            className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
          >
            ลองอีกครั้ง
          </button>
        </div>
      ) : !settings ? (
        <div className="card-soft p-6 text-center text-sm font-bold text-muted-foreground">
          ยังไม่มีข้อมูลการตั้งค่า
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {LEVELS.map((level) => {
              const active = current === level.value;
              const Icon = level.icon;
              return (
                <button
                  key={level.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    if (!active) setPending(level.value);
                  }}
                  className={`card-soft w-full p-4 text-left transition-colors ${
                    active ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                        active ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"
                      }`}
                    >
                      <Icon className="size-4.5" strokeWidth={2.3} />
                    </span>
                    <span className="flex-1 text-sm font-extrabold">{level.label}</span>
                    {active ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-primary">
                        <Check className="size-3.5" strokeWidth={3} /> ใช้งานอยู่
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 text-xs font-bold leading-relaxed text-muted-foreground">
                    {level.summary}
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {level.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-[11px] font-bold text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <h2 className="mb-2 mt-5 px-1 text-sm font-extrabold text-muted-foreground">
            ข้อมูลที่สามารถแชร์
          </h2>
          <section className="card-soft divide-y divide-border p-1">
            {SHARED_DATA.map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-3 py-3">
                <span className="flex-1 text-sm font-extrabold">{item.label}</span>
                <span className="text-right text-[11px] font-bold text-muted-foreground">
                  {item.status[current]}
                </span>
              </div>
            ))}
          </section>

          <h2 className="mb-2 mt-5 px-1 text-sm font-extrabold text-muted-foreground">
            หลักการความเป็นส่วนตัว
          </h2>
          <section className="card-soft p-4">
            <p className="text-xs font-bold leading-relaxed text-muted-foreground">
              การเลือกระดับความเป็นส่วนตัวไม่ได้หมายความว่าข้อมูลทุกประเภทจะถูกแชร์ในระดับเดียวกัน
              ระบบจะแยกการแชร์ข้อมูลตามประเภทและสิทธิ์ของแต่ละฟีเจอร์
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                "ข้อมูลสุขภาพละเอียดอ่อน = ส่วนตัวเสมอ",
                "ข้อมูลกิจกรรม = ขึ้นกับระดับความเป็นส่วนตัวและฟีเจอร์",
                "การจัดอันดับ = แสดงข้อมูลตามระดับความเป็นส่วนตัวของผู้ใช้",
                "ข้อมูลอาหารและการนอน = ส่วนตัวเสมอ",
              ].map((b) => (
                <li key={b} className="flex gap-2 text-[11px] font-bold text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-4 px-1 text-[11px] font-bold text-muted-foreground">
            อัปเดตล่าสุด: {formatThaiDate(settings.updated_at) ?? "ยังไม่มีข้อมูล"}
          </p>
          <a
            href="https://www.lovable.dev/privacy"
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-extrabold text-primary"
          >
            อ่านนโยบายความเป็นส่วนตัว <ExternalLink className="size-3" strokeWidth={2.6} />
          </a>
        </>
      )}

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-5">
          <div className="card-soft w-full max-w-sm p-5">
            <p className="text-sm font-extrabold">เปลี่ยนการตั้งค่าความเป็นส่วนตัว?</p>
            <p className="mt-2 text-xs font-bold leading-relaxed text-muted-foreground">
              การเปลี่ยนแปลงนี้มีผลต่อการมองเห็นข้อมูลของคุณ คุณสามารถเปลี่ยนการตั้งค่าได้ทุกเมื่อ
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPending(null)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirm}
                disabled={updateSettings.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {updateSettings.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                ยืนยันการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppScreen>
  );
}
