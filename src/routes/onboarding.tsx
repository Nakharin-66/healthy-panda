import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  readGuest,
  starterGoals,
  writeGuest,
  type GuestActivity,
  type GuestSex,
  type PrimaryGoal,
} from "@/lib/guest";
import { storedDestination } from "@/lib/miniapp";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าเริ่มต้น | Healthy Panda" },
      { name: "description", content: "บอกข้อมูลพื้นฐานเพื่อรับเป้าหมายสุขภาพเริ่มต้นที่เหมาะกับคุณ" },
      { property: "og:title", content: "ตั้งค่าเริ่มต้น | Healthy Panda" },
      { property: "og:description", content: "รับเป้าหมายก้าวเดิน น้ำดื่ม และการออกกำลังกายเบื้องต้น" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const TOTAL = 5;
const input = "w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary";

function num(v: string) {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<GuestSex>("undisclosed");
  const [goal, setGoal] = useState<PrimaryGoal | null>(null);
  const [target, setTarget] = useState("");
  const [activity, setActivity] = useState<GuestActivity | null>(null);

  useEffect(() => {
    const g = readGuest();
    if (!g) return;
    setNickname(g.nickname);
    setWeight(g.weight_kg?.toString() ?? "");
    setHeight(g.height_cm?.toString() ?? "");
    setAge(g.age?.toString() ?? "");
    setSex(g.sex);
    setGoal(g.primary_goal);
    setTarget(g.target_weight_kg?.toString() ?? "");
    setActivity(g.activity_level);
  }, []);

  const w = num(weight), h = num(height), a = num(age), t = num(target);
  const errors: Record<number, string | null> = {
    1: nickname.trim().length < 1 ? "กรอกชื่อเล่นก่อนนะ" : nickname.length > 40 ? "ชื่อยาวเกินไป" : null,
    2:
      w === null || w < 20 || w > 300 ? "น้ำหนักควรอยู่ระหว่าง 20–300 kg"
      : h === null || h < 100 || h > 250 ? "ส่วนสูงควรอยู่ระหว่าง 100–250 cm"
      : a === null || a < 10 || a > 120 || !Number.isInteger(a) ? "อายุควรอยู่ระหว่าง 10–120 ปี"
      : null,
    3: !goal ? "เลือกเป้าหมายหลัก" : goal === "weight" && (t === null || t < 20 || t > 300) ? "กรอกน้ำหนักเป้าหมาย 20–300 kg" : null,
    4: !activity ? "เลือกระดับกิจกรรม" : null,
    5: null,
  };
  const err = errors[step];
  const rec = goal && activity ? starterGoals({ weight_kg: w, activity_level: activity, primary_goal: goal }) : null;

  const finish = () => {
    if (!goal || !activity) return;
    writeGuest({
      nickname: nickname.trim(),
      weight_kg: w,
      height_cm: h,
      age: a,
      sex,
      primary_goal: goal,
      target_weight_kg: goal === "weight" ? t : null,
      activity_level: activity,
      completed: true,
      saved_at: new Date().toISOString(),
    });
    navigate({ to: storedDestination(), replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col">
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>ขั้นตอน {step} จาก {TOTAL}</span>
            <span>{Math.round((step / TOTAL) * 100)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
        </div>

        <section className="card-soft flex-1 space-y-4 p-5">
          {step === 1 && (
            <>
              <h1 className="text-xl font-black">เราจะเรียกคุณว่าอะไรดี?</h1>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="ชื่อเล่น" maxLength={40} className={input} />
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-xl font-black">ข้อมูลร่างกาย</h1>
              <label className="block text-xs font-bold">น้ำหนัก (kg)
                <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={`${input} mt-1`} />
              </label>
              <label className="block text-xs font-bold">ส่วนสูง (cm)
                <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className={`${input} mt-1`} />
              </label>
              <label className="block text-xs font-bold">อายุ
                <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={`${input} mt-1`} />
              </label>
              <div>
                <p className="text-xs font-bold">เพศ</p>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {([["male", "ชาย"], ["female", "หญิง"], ["undisclosed", "ไม่ระบุ"]] as const).map(([v, l]) => (
                    <Choice key={v} active={sex === v} onClick={() => setSex(v)}>{l}</Choice>
                  ))}
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-xl font-black">เป้าหมายหลักของคุณ</h1>
              <div className="space-y-2">
                {(Object.keys(GOAL_LABELS) as PrimaryGoal[]).map((k) => (
                  <Choice key={k} active={goal === k} onClick={() => setGoal(k)}>{GOAL_LABELS[k]}</Choice>
                ))}
              </div>
              {goal === "weight" && (
                <label className="block text-xs font-bold">น้ำหนักเป้าหมาย (kg)
                  <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={`${input} mt-1`} />
                </label>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <h1 className="text-xl font-black">ระดับกิจกรรมในชีวิตประจำวัน</h1>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as GuestActivity[]).map((k) => (
                  <Choice key={k} active={activity === k} onClick={() => setActivity(k)}>{ACTIVITY_LABELS[k]}</Choice>
                ))}
              </div>
            </>
          )}
          {step === 5 && rec && (
            <>
              <h1 className="text-xl font-black">เป้าหมายเริ่มต้นของคุณ</h1>
              <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-extrabold text-primary">คำแนะนำเบื้องต้น</span>
              <ul className="space-y-2">
                <RecRow label="จำนวนก้าวต่อวัน" value={`${rec.steps.toLocaleString("th-TH")} ก้าว`} />
                <RecRow label="ปริมาณน้ำต่อวัน" value={`${(rec.water_ml / 1000).toFixed(1)} ลิตร`} />
                <RecRow label="เวลาออกกำลังกายต่อสัปดาห์" value={`${rec.exercise_min_week} นาที`} />
              </ul>
              <p className="text-xs font-semibold text-muted-foreground">
                คำนวณจากข้อมูลที่คุณกรอกเป็นแนวทางทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ และคุณสามารถแก้ไขได้ภายหลัง
              </p>
            </>
          )}
          {err && step < 5 ? <p className="text-xs font-bold text-destructive">{err}</p> : null}
        </section>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => (step === 1 ? navigate({ to: "/" }) : setStep(step - 1))}
            className="flex-1 rounded-2xl bg-secondary py-3.5 text-sm font-extrabold"
          >
            ย้อนกลับ
          </button>
          {step < TOTAL ? (
            <button
              disabled={!!err}
              onClick={() => setStep(step + 1)}
              className="flex-[2] rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
            >
              ถัดไป
            </button>
          ) : (
            <button onClick={finish} className="flex-[2] rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground">
              เริ่มใช้งาน Healthy Panda
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}
    >
      {children}
    </button>
  );
}

function RecRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-black text-primary">{value}</span>
    </li>
  );
}
