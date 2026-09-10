import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { HealthConnectCard } from "@/components/HealthConnectCard";
import { useProfile, useUpdateProfile, useSettings, useUpdateSettings } from "@/lib/db";
import { useActivityLogs } from "@/lib/activities";
import { useResolvedAvatar, useUploadAvatar, validateAvatarFile } from "@/lib/avatar";
import { THEME_LABEL, normalizeTheme, storeTheme, useThemeSync, type ThemePref } from "@/lib/theme";
import avatarFallback from "@/assets/panda-avatar.png";
import {
  ChevronRight,
  Scale,
  History,
  Shield,
  Bell,
  Moon,
  LogOut,
  Camera,
  Loader2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "บัญชีของฉัน | Healthy Panda" },
      {
        name: "description",
        content: "จัดการข้อมูลส่วนตัว รูปโปรไฟล์ เป้าหมายน้ำหนัก การแจ้งเตือน ธีม และการเชื่อมต่อแอปสุขภาพ",
      },
      { property: "og:title", content: "บัญชีของฉัน | Healthy Panda" },
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

const NOT_SET = "ยังไม่ได้ตั้งค่า";

const genderLabel: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "ไม่ระบุ",
  undisclosed: "ไม่ระบุ",
};

const privacyLabel: Record<string, string> = {
  private: "ส่วนตัว",
  friends: "เพื่อน",
  public: "สาธารณะ",
};

function Row({
  icon: Icon,
  label,
  value,
  onClick,
  right,
}: {
  icon: typeof Scale;
  label: string;
  value?: string | undefined;
  onClick?: (() => void) | undefined;
  right?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4.5" strokeWidth={2.3} />
      </span>
      <span className="flex-1 text-sm font-extrabold">{label}</span>
      {value ? <span className="text-xs font-bold text-muted-foreground">{value}</span> : null}
      {right ?? <ChevronRight className="size-4 text-muted-foreground" />}
    </>
  );
  if (!onClick) {
    return <div className="flex w-full items-center gap-3 px-3 py-3.5 text-left">{content}</div>;
  }
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3.5 text-left">
      {content}
    </button>
  );
}

function Profile() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const settingsQuery = useSettings(profile?.id);
  const settings = settingsQuery.data;
  const activityQuery = useActivityLogs(profile?.id, 7);
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings(profile?.id);
  const uploadAvatar = useUploadAvatar(profile?.id);
  const resolvedAvatar = useResolvedAvatar(profile?.picture_url);

  const theme = normalizeTheme(settings?.theme);
  useThemeSync(settingsQuery.isSuccess ? theme : undefined);

  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [weightGoalOpen, setWeightGoalOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birthday: "",
    gender: "undisclosed",
    height: "",
    weight: "",
    target: "",
  });

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อจัดการโปรไฟล์และเชื่อมต่ออุปกรณ์สุขภาพ" />
      </AppScreen>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <AppScreen>
        <div className="card-soft flex items-center justify-center gap-2 p-8 text-sm font-bold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> กำลังโหลด...
        </div>
      </AppScreen>
    );
  }

  if (profileQuery.isError) {
    return (
      <AppScreen>
        <div className="card-soft p-6 text-center">
          <p className="text-sm font-extrabold">ไม่สามารถโหลดข้อมูลได้</p>
          <button
            onClick={() => profileQuery.refetch()}
            className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </AppScreen>
    );
  }

  const openEdit = () => {
    setForm({
      name: profile?.display_name ?? "",
      birthday: profile?.birthday ?? "",
      gender: profile?.gender === "other" ? "undisclosed" : (profile?.gender ?? "undisclosed"),
      height: profile?.height_cm?.toString() ?? "",
      weight: profile?.weight_kg?.toString() ?? "",
      target: profile?.target_weight_kg?.toString() ?? "",
    });
    setEditing(true);
  };

  const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  const validate = () => {
    if (!form.name.trim()) return "กรุณากรอกชื่อ-นามสกุล";
    if (form.birthday && new Date(form.birthday).getTime() > Date.now())
      return "วันเกิดต้องไม่เป็นวันที่ในอนาคต";
    const h = numberOrNull(form.height);
    if (h !== null && (!Number.isFinite(h) || h < 80 || h > 250))
      return "ส่วนสูงต้องอยู่ระหว่าง 80–250 ซม.";
    const w = numberOrNull(form.weight);
    if (w !== null && (!Number.isFinite(w) || w < 20 || w > 400))
      return "น้ำหนักต้องอยู่ระหว่าง 20–400 กก.";
    const t = numberOrNull(form.target);
    if (t !== null && (!Number.isFinite(t) || t < 20 || t > 400))
      return "น้ำหนักเป้าหมายต้องอยู่ระหว่าง 20–400 กก.";
    return null;
  };

  const save = async () => {
    if (!profile) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        display_name: form.name.trim(),
        birthday: form.birthday || null,
        gender: form.gender as typeof profile.gender,
        height_cm: numberOrNull(form.height),
        weight_kg: numberOrNull(form.weight),
        target_weight_kg: numberOrNull(form.target),
      });
      toast.success("บันทึกข้อมูลสำเร็จ");
      setEditing(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const pickFile = (file?: File | null) => {
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setPreview({ file, url: URL.createObjectURL(file) });
  };

  const confirmUpload = async () => {
    if (!preview) return;
    try {
      await uploadAvatar.mutateAsync(preview.file);
      toast.success("เปลี่ยนรูปโปรไฟล์แล้ว");
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    } catch {
      toast.error("อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const saveTargetWeight = async () => {
    if (!profile) return;
    const t = numberOrNull(targetInput);
    if (t === null || !Number.isFinite(t) || t < 20 || t > 400) {
      toast.error("น้ำหนักเป้าหมายต้องอยู่ระหว่าง 20–400 กก.");
      return;
    }
    try {
      await updateProfile.mutateAsync({ id: profile.id, target_weight_kg: t });
      toast.success("บันทึกข้อมูลสำเร็จ");
      setWeightGoalOpen(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const cycleTheme = () => {
    const order: ThemePref[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length]!;
    storeTheme(next);
    updateSettings.mutate(
      { theme: next },
      { onError: () => toast.error("บันทึกธีมไม่สำเร็จ") },
    );
  };

  const cyclePrivacy = () => {
    const order = ["private", "friends", "public"] as const;
    const current = settings?.privacy_level ?? "private";
    const next = order[(order.indexOf(current) + 1) % order.length]!;
    updateSettings.mutate(
      { privacy_level: next },
      { onError: () => toast.error("บันทึกความเป็นส่วนตัวไม่สำเร็จ") },
    );
  };

  const age = profile?.birthday
    ? Math.floor((Date.now() - new Date(profile.birthday).getTime()) / 31557600000)
    : null;

  const activityCount = activityQuery.isLoading
    ? "กำลังโหลด..."
    : activityQuery.isError
      ? "โหลดไม่ได้"
      : `${activityQuery.data?.length ?? 0} รายการ`;

  const settingValue = (value?: string) =>
    settingsQuery.isLoading ? "กำลังโหลด..." : settingsQuery.isError ? "โหลดไม่ได้" : value;

  return (
    <AppScreen>
      <section className="card-soft mb-4 flex flex-col items-center p-5 text-center">
        <div className="relative">
          <img
            src={resolvedAvatar || avatarFallback}
            alt={`รูปโปรไฟล์ของ ${profile?.display_name ?? "ผู้ใช้"}`}
            width={512}
            height={512}
            className="size-24 rounded-full bg-primary-soft object-cover ring-4 ring-primary/25"
          />
          <button
            onClick={() => fileInput.current?.click()}
            aria-label="เปลี่ยนรูปโปรไฟล์"
            className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] active:scale-95"
          >
            <Camera className="size-4" strokeWidth={2.4} />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <h1 className="mt-3 text-xl font-black">{profile?.display_name ?? "ผู้ใช้"}</h1>
        <p className="mt-0.5 text-xs font-bold text-muted-foreground">
          {genderLabel[profile?.gender ?? "undisclosed"]}
          {profile?.birthday ? ` • ${profile.birthday}` : ""}
          {age !== null ? ` • ${age} ปี` : ""}
        </p>
        <button
          onClick={() => fileInput.current?.click()}
          className="mt-3 rounded-full border-2 border-border px-4 py-2 text-xs font-extrabold active:scale-95"
        >
          เปลี่ยนรูปโปรไฟล์
        </button>

        <div className="mt-4 grid w-full grid-cols-3 gap-2">
          {[
            { l: "น้ำหนัก", v: profile?.weight_kg ? `${profile.weight_kg} กก.` : NOT_SET },
            { l: "เป้าหมาย", v: profile?.target_weight_kg ? `${profile.target_weight_kg} กก.` : NOT_SET },
            { l: "ส่วนสูง", v: profile?.height_cm ? `${profile.height_cm} ซม.` : NOT_SET },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-secondary p-2.5">
              <p className="text-xs font-black leading-tight">{s.v}</p>
              <p className="mt-1 text-[10px] font-bold text-muted-foreground">{s.l}</p>
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

      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-5">
          <div className="card-soft w-full max-w-sm p-5 text-center">
            <p className="text-sm font-extrabold">ตัวอย่างรูปโปรไฟล์</p>
            <img
              src={preview.url}
              alt="ตัวอย่างรูปโปรไฟล์ที่เลือก"
              className="mx-auto mt-4 size-32 rounded-full object-cover ring-4 ring-primary/25"
            />
            <div className="mt-5 flex gap-2">
              <button
                onClick={confirmUpload}
                disabled={uploadAvatar.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {uploadAvatar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                บันทึกรูปนี้
              </button>
              <button
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/50 p-0 sm:place-items-center sm:p-5">
          <div className="card-soft max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-b-[var(--radius-xl)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-black">แก้ไขข้อมูลส่วนตัว</p>
              <button onClick={() => setEditing(false)} aria-label="ปิด">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2.5">
              <label className="block text-xs font-extrabold text-muted-foreground">ชื่อ-นามสกุล</label>
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
              />
              <label className="block text-xs font-extrabold text-muted-foreground">วันเกิด</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.birthday}
                onChange={(e) => setForm((s) => ({ ...s, birthday: e.target.value }))}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
              />
              <label className="block text-xs font-extrabold text-muted-foreground">เพศ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "male", l: "ชาย" },
                  { v: "female", l: "หญิง" },
                  { v: "undisclosed", l: "ไม่ระบุ" },
                ].map((g) => (
                  <button
                    key={g.v}
                    onClick={() => setForm((s) => ({ ...s, gender: g.v }))}
                    className={`rounded-2xl py-2.5 text-xs font-extrabold ${
                      form.gender === g.v
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
              {[
                { k: "height" as const, l: "ส่วนสูง (ซม.)" },
                { k: "weight" as const, l: "น้ำหนักปัจจุบัน (กก.)" },
                { k: "target" as const, l: "น้ำหนักเป้าหมาย (กก.)" },
              ].map((f) => (
                <div key={f.k}>
                  <label className="block pb-2 text-xs font-extrabold text-muted-foreground">
                    {f.l}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form[f.k]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                    className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={updateProfile.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
              >
                {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                บันทึก
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {weightGoalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-5">
          <div className="card-soft w-full max-w-sm p-5">
            <p className="text-sm font-extrabold">ปรับเป้าหมายน้ำหนัก</p>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="น้ำหนักเป้าหมาย (กก.)"
              className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveTargetWeight}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
              >
                บันทึก
              </button>
              <button
                onClick={() => setWeightGoalOpen(false)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {signOutOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-5">
          <div className="card-soft w-full max-w-sm p-5 text-center">
            <p className="text-sm font-extrabold">คุณต้องการออกจากระบบหรือไม่?</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setSignOutOpen(false)}
                className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
              >
                ยกเลิก
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSignOutOpen(false);
                  navigate({ to: "/auth" });
                }}
                className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-extrabold text-destructive-foreground"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="card-soft mb-4 divide-y divide-border p-1">
        <Row
          icon={Scale}
          label="ปรับเป้าหมายน้ำหนัก"
          value={profile?.target_weight_kg ? `${profile.target_weight_kg} กก.` : NOT_SET}
          onClick={() => {
            setTargetInput(profile?.target_weight_kg?.toString() ?? "");
            setWeightGoalOpen(true);
          }}
        />
        <Row
          icon={History}
          label="บันทึกกิจกรรม 7 วัน"
          value={activityCount}
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
          right={
            <button
              role="switch"
              aria-checked={!!settings?.notification_enabled}
              aria-label="เปิดหรือปิดการแจ้งเตือน"
              disabled={!settings}
              onClick={() =>
                updateSettings.mutate(
                  { notification_enabled: !settings?.notification_enabled },
                  { onError: () => toast.error("บันทึกการแจ้งเตือนไม่สำเร็จ") },
                )
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings?.notification_enabled ? "bg-primary" : "bg-muted"
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-card transition-all ${
                  settings?.notification_enabled ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          }
        />
        <Row
          icon={Moon}
          label="ธีมแอป"
          value={settingValue(THEME_LABEL[theme])}
          onClick={cycleTheme}
        />
        <Row
          icon={Shield}
          label="ความเป็นส่วนตัว"
          value={settingValue(privacyLabel[settings?.privacy_level ?? "private"])}
          onClick={cyclePrivacy}
        />
        <Row icon={LogOut} label="ออกจากระบบ" onClick={() => setSignOutOpen(true)} />
      </section>
    </AppScreen>
  );
}
