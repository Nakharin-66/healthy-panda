import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { WaterTracker } from "@/components/WaterTracker";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { readGuest, starterGoals } from "@/lib/guest";
import {
  useProfile,
  useGoals,
  useTodayWater,
  useTodayFood,
  useLatestVitals,
  DEFAULT_GOALS,
} from "@/lib/db";
import { useResolvedAvatar } from "@/lib/avatar";
import {
  useActivityLogs,
  useActivityRealtime,
  totalDistanceKm,
} from "@/lib/activities";
import {
  Heart,
  Moon,
  Droplets,
  Activity,
  Footprints,
  ScanLine,
  Dumbbell,
  Target,
  Route as Route2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ดสุขภาพ | Healthy Panda" },
      {
        name: "description",
        content: "ดูอัตราการเต้นหัวใจ การนอน ออกซิเจน ก้าวเดิน แคลอรีและน้ำดื่มของคุณในที่เดียว",
      },
      { property: "og:title", content: "แดชบอร์ดสุขภาพ | Healthy Panda" },
      {
        property: "og:description",
        content: "สรุปสุขภาพรายวันจากสมาร์ทวอทช์ พร้อมแคลอรี สารอาหารหลัก และการดื่มน้ำ",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const toneClass: Record<string, string> = {
  berry: "bg-berry-soft text-berry",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  primary: "bg-primary-soft text-primary",
};

function Ring({ eaten, goal }: { eaten: number; goal: number }) {
  const pct = Math.min(goal > 0 ? eaten / goal : 0, 1);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-36 shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-black leading-none">{Math.round(eaten)}</p>
        <p className="text-[11px] font-bold text-muted-foreground">/ {goal} kcal</p>
      </div>
    </div>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-bold">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {Math.round(value)}/{goal}ก
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min((value / (goal || 1)) * 100, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function fmt(v: number | undefined, digits = 0) {
  if (v === undefined) return "—";
  return v.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

function Dashboard() {
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const myAvatar = useResolvedAvatar(profile?.picture_url);
  const profileId = profile?.id;
  const { data: goals } = useGoals(profileId);
  const { data: water } = useTodayWater(profileId);
  const { data: food } = useTodayFood(profileId);
  const { data: vitals } = useLatestVitals(profileId);
  const { data: activityLogs } = useActivityLogs(profileId, 30);
  useActivityRealtime(profileId);

  const g = goals ?? { ...DEFAULT_GOALS };
  const waterMl = water?.total ?? 0;
  const waterGoal = g.water_goal_ml;
  const totals = food?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const logs = activityLogs ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekSince = new Date();
  weekSince.setDate(weekSince.getDate() - 6);
  weekSince.setHours(0, 0, 0, 0);
  const monthSince = new Date();
  monthSince.setDate(monthSince.getDate() - 29);
  monthSince.setHours(0, 0, 0, 0);
  const distance = {
    today: totalDistanceKm(logs.filter((l) => l.performed_at.slice(0, 10) === todayKey)),
    week: totalDistanceKm(logs.filter((l) => new Date(l.performed_at) >= weekSince)),
    month: totalDistanceKm(logs.filter((l) => new Date(l.performed_at) >= monthSince)),
  };



  const sleepMinutes = vitals?.["sleep_minutes"]?.value;
  const vitalCards = [
    {
      icon: Heart,
      label: "หัวใจ",
      value: fmt(vitals?.["heart_rate"]?.value),
      unit: "bpm",
      tone: "berry",
    },
    {
      icon: Moon,
      label: "การนอน",
      value:
        sleepMinutes === undefined
          ? "—"
          : `${Math.floor(sleepMinutes / 60)}ชม ${Math.round(sleepMinutes % 60)}`,
      unit: "นาที",
      tone: "info",
    },
    { icon: Droplets, label: "SpO₂", value: fmt(vitals?.["spo2"]?.value), unit: "%", tone: "success" },
    {
      icon: Activity,
      label: "แคลอรีเผาผลาญ",
      value: fmt(vitals?.["calories_burned"]?.value),
      unit: "kcal",
      tone: "primary",
    },
    {
      icon: Footprints,
      label: "ก้าวเดิน",
      value: fmt(vitals?.["steps"]?.value),
      unit: `เป้า ${g.steps_goal.toLocaleString("th-TH")}`,
      tone: "primary",
    },
    ...(distance.today > 0 || distance.week > 0
      ? [
          {
            icon: Route2,
            label: "ระยะทางวันนี้",
            value: fmt(distance.today, 2),
            unit: `สัปดาห์นี้ ${fmt(distance.week, 2)} กม.`,
            tone: "success",
          },
        ]
      : []),
  ];

  if (!loading && !signedIn) {
    const guest = readGuest();
    const rec = guest?.completed ? starterGoals(guest) : null;
    return (
      <AppScreen>
        <PandaHeader
          title={`สวัสดี, ${guest?.nickname || "เพื่อนแพนด้า"}!`}
          subtitle="โหมดทดลองใช้ ยังไม่มีการบันทึกข้อมูลสุขภาพ 🐼"
        />
        {rec ? (
          <section className="card-soft mb-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">เป้าหมายเริ่มต้นของคุณ</h2>
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-extrabold text-primary">คำแนะนำเบื้องต้น</span>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
              <li className="rounded-2xl bg-secondary p-3"><p className="text-base font-black">{rec.steps.toLocaleString("th-TH")}</p><p className="text-[11px] font-semibold text-muted-foreground">ก้าว/วัน</p></li>
              <li className="rounded-2xl bg-secondary p-3"><p className="text-base font-black">{(rec.water_ml / 1000).toFixed(1)} ล.</p><p className="text-[11px] font-semibold text-muted-foreground">น้ำ/วัน</p></li>
              <li className="rounded-2xl bg-secondary p-3"><p className="text-base font-black">{rec.exercise_min_week}</p><p className="text-[11px] font-semibold text-muted-foreground">นาที/สัปดาห์</p></li>
            </ul>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">ยังไม่มีข้อมูลกิจกรรมวันนี้ เข้าสู่ระบบเพื่อเริ่มบันทึกจริง</p>
          </section>
        ) : null}
        <SignInPrompt />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PandaHeader
        title={`สวัสดี, ${profile?.display_name ?? "เพื่อนแพนด้า"}!`}
        subtitle="วันนี้ไปได้สวยเลย 🐼"
        streak={profile?.streak_days ?? 0}
        avatarUrl={myAvatar}
        avatarAlt={profile?.display_name ?? "รูปโปรไฟล์ผู้ใช้"}
      />

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-extrabold text-muted-foreground">
          ข้อมูลจากอุปกรณ์สุขภาพ
        </h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {vitalCards.map(({ icon: Icon, label, value, unit, tone }) => (
            <div key={label} className="card-soft w-32 shrink-0 p-3">
              <span
                className={`mb-2 inline-grid size-8 place-items-center rounded-xl ${toneClass[tone]}`}
              >
                <Icon className="size-4" strokeWidth={2.4} />
              </span>
              <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
              <p className="text-lg font-black leading-tight">{value}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{unit}</p>
            </div>
          ))}
        </div>
        {vitals && Object.keys(vitals).length === 0 ? (
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            ยังไม่มีข้อมูลจากอุปกรณ์ — จับคู่ Health Connect ได้ในหน้าบัญชี
          </p>
        ) : null}
      </section>

      {distance.month > 0 ? (
        <section className="card-soft mb-4 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-2xl bg-success-soft text-success">
              <Route2 className="size-4" strokeWidth={2.4} />
            </span>
            <p className="text-sm font-extrabold">ระยะทางรวม</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: "วันนี้", v: distance.today },
              { l: "7 วัน", v: distance.week },
              { l: "30 วัน", v: distance.month },
            ].map((d) => (
              <div key={d.l} className="rounded-2xl bg-success-soft p-2">
                <p className="text-sm font-black">{fmt(d.v, 2)} กม.</p>
                <p className="text-[10px] font-bold text-muted-foreground">{d.l}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}



      <section className="card-soft mb-4 flex items-center gap-4 p-4">
        <Ring eaten={totals.calories} goal={g.calories_goal} />
        <div className="flex-1 space-y-3">
          <MacroBar
            label="โปรตีน"
            value={totals.protein}
            goal={g.protein_goal_g}
            color="var(--success)"
          />
          <MacroBar label="คาร์บ" value={totals.carbs} goal={g.carb_goal_g} color="var(--primary)" />
          <MacroBar label="ไขมัน" value={totals.fat} goal={g.fat_goal_g} color="var(--berry)" />
        </div>
      </section>

      {totals.calories === 0 ? (
        <section className="card-soft mb-4 p-4 text-center">
          <p className="text-sm font-extrabold">วันนี้ยังไม่มีการบันทึกอาหาร</p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/scan"
              className="flex-1 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground"
            >
              สแกนอาหาร
            </Link>
            <Link
              to="/food/search"
              search={{ q: "" }}
              className="flex-1 rounded-2xl bg-primary-soft py-3 text-xs font-extrabold text-primary"
            >
              ค้นหาเมนู
            </Link>
          </div>
        </section>
      ) : (
        <Link
          to="/food/history"
          className="mb-4 block rounded-2xl bg-primary-soft py-3 text-center text-xs font-extrabold text-primary"
        >
          ดูประวัติอาหาร
        </Link>
      )}

      <WaterTracker profileId={profileId} goal={waterGoal} />

      <section>
        <h2 className="mb-2 text-sm font-extrabold text-muted-foreground">ทำงานด่วน</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: "/scan", label: "สแกนอาหาร", icon: ScanLine },
            { to: "/goals", label: "บันทึกออกกำลังกาย", icon: Dumbbell },
            { to: "/goals", label: "เป้าหมาย", icon: Target },
          ].map(({ to, label, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="card-soft flex flex-col items-center gap-2 p-3 text-center active:scale-95"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="size-5" strokeWidth={2.4} />
              </span>
              <span className="text-[11px] font-extrabold leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </AppScreen>
  );
}
