import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { HealthConnectCard } from "@/components/HealthConnectCard";
import { useProfile, useUpdateProfile, useSettings, useUpdateSettings, useWeekExercise } from "@/lib/db";
import avatar from "@/assets/panda-avatar.png";
import { ChevronRight, Scale, History, Settings, Bell, Moon, LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "โปรไฟล์ของฉัน | Healthy Panda" },
      {
        name: "description",
        content: "จัดการข้อมูลส่วนตัว เป้าหมายน้ำหนัก บันทึกกิจกรรม และเชื่อมต่อ Health Connect",
      },
      { property: "og:title", content: "โปรไฟล์ของฉัน | Healthy Panda" },
      {
        property: "og:description",
        content: "ตั้งค่าบัญชี เป้าหมายน้ำหนัก และการเชื่อมต่อแอปสุขภาพ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});

function Row({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Scale;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3.5 text-left">
      <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4.5" strokeWidth={2.3} />
      </span>
      <span className="flex-1 text-sm font-extrabold">{label}</span>
      {value ? <span className="text-xs font-bold text-muted-foreground">{value}</span> : null}
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

const genderLabel: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่น ๆ",
  undisclosed: "ไม่ระบุ",
};

function Profile() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings(profile?.id);
  const { data: week } = useWeekExercise(profile?.id);
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings(profile?.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ height: "", weight: "", target: "", name: "", birthday: "" });

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อจัดการโปรไฟล์และเชื่อมต่ออุปกรณ์สุขภาพ" />
      </AppScreen>
    );
  }

  const openEdit = () => {
    setForm({
      name: profile?.display_name ?? "",
      height: profile?.height_cm?.toString() ?? "",
      weight: profile?.weight_kg?.toString() ?? "",
      target: profile?.target_weight_kg?.toString() ?? "",
      birthday: profile?.birthday ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!profile) return;
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        display_name: form.name || profile.display_name,
        height_cm: form.height ? Number(form.height) : null,
        weight_kg: form.weight ? Number(form.weight) : null,
        target_weight_kg: form.target ? Number(form.target) : null,
        birthday: form.birthday || null,
      });
      toast.success("บันทึกโปรไฟล์แล้ว");
      setEditing(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const age = profile?.birthday
    ? Math.floor((Date.now() - new Date(profile.birthday).getTime()) / 31557600000)
    : null;

  return (
    <AppScreen>
      <section className="card-soft mb-4 flex flex-col items-center p-5 text-center">
        <img
          src={profile?.picture_url || avatar}
          alt="รูปโปรไฟล์แพนด้าแดง"
          width={512}
          height={512}
          className="size-20 rounded-full bg-primary-soft object-cover ring-4 ring-primary/25"
        />
        <h1 className="mt-2 text-xl font-black">{profile?.display_name ?? "..."}</h1>
        <p className="text-xs font-bold text-muted-foreground">
          {genderLabel[profile?.gender ?? "undisclosed"]}
          {profile?.birthday ? ` • ${profile.birthday}` : ""}
          {age !== null ? ` • ${age} ปี` : ""}
        </p>
        <div className="mt-4 grid w-full grid-cols-3 gap-2">
          {[
            { l: "น้ำหนัก", v: profile?.weight_kg ? `${profile.weight_kg} กก.` : "—" },
            { l: "เป้าหมาย", v: profile?.target_weight_kg ? `${profile.target_weight_kg} กก.` : "—" },
            { l: "ส่วนสูง", v: profile?.height_cm ? `${profile.height_cm} ซม.` : "—" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-secondary p-2">
              <p className="text-sm font-black">{s.v}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
        <button
          onClick={openEdit}
          className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
        >
          แก้ไขข้อมูลส่วนตัว
        </button>
      </section>

      {editing ? (
        <section className="card-soft mb-4 space-y-2.5 p-4">
          <p className="text-sm font-extrabold">แก้ไขข้อมูล</p>
          {[
            { k: "name" as const, ph: "ชื่อที่แสดง", type: "text" },
            { k: "birthday" as const, ph: "วันเกิด", type: "date" },
            { k: "height" as const, ph: "ส่วนสูง (ซม.)", type: "number" },
            { k: "weight" as const, ph: "น้ำหนัก (กก.)", type: "number" },
            { k: "target" as const, ph: "น้ำหนักเป้าหมาย (กก.)", type: "number" },
          ].map((f) => (
            <input
              key={f.k}
              type={f.type}
              value={form[f.k]}
              placeholder={f.ph}
              onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
            />
          ))}
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
            >
              บันทึก
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
            >
              ยกเลิก
            </button>
          </div>
        </section>
      ) : null}

      <section className="card-soft mb-4 divide-y divide-border p-1">
        <Row
          icon={Scale}
          label="ปรับเป้าหมายน้ำหนัก"
          value={profile?.target_weight_kg ? `${profile.target_weight_kg} กก.` : "ตั้งค่า"}
          onClick={openEdit}
        />
        <Row
          icon={History}
          label="บันทึกกิจกรรม 7 วัน"
          value={`${week?.logs.length ?? 0} รายการ`}
          onClick={() => navigate({ to: "/goals" })}
        />
      </section>

      <h2 className="mb-2 px-1 text-sm font-extrabold text-muted-foreground">เชื่อมต่อแอปสุขภาพ</h2>
      <div className="mb-4">
        <HealthConnectCard />
      </div>

      <h2 className="mb-2 px-1 text-sm font-extrabold text-muted-foreground">ตั้งค่าแอป</h2>
      <section className="card-soft divide-y divide-border p-1">
        <Row
          icon={Bell}
          label="การแจ้งเตือน"
          value={settings?.notification_enabled ? "เปิด" : "ปิด"}
          onClick={() =>
            updateSettings.mutate({ notification_enabled: !settings?.notification_enabled })
          }
        />
        <Row
          icon={Moon}
          label="ธีมแอป"
          value={settings?.theme === "dark" ? "มืด" : "สว่าง"}
          onClick={() =>
            updateSettings.mutate({ theme: settings?.theme === "dark" ? "light" : "dark" })
          }
        />
        <Row
          icon={Settings}
          label="ความเป็นส่วนตัว"
          value={settings?.privacy_level ?? "private"}
          onClick={() =>
            updateSettings.mutate({
              privacy_level: settings?.privacy_level === "private" ? "friends" : "private",
            })
          }
        />
        <Row
          icon={LogOut}
          label="ออกจากระบบ"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        />
      </section>
    </AppScreen>
  );
}
