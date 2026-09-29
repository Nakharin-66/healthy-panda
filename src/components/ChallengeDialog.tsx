import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, X } from "lucide-react";
import {
  BOARD_LABEL,
  METRICS,
  PARTICIPATION_LABEL,
  TIMEZONE_LABEL,
  bkkDate,
  bkkToIso,
  challengeErrorMessage,
  metricInfo,
  useCreateChallenge,
  useUpdateChallenge,
  type ChallengeBoardVisibility,
  type ChallengeMetric,
  type ChallengeParticipation,
  type ChallengeRow,
} from "@/lib/challenges";
import { MetricArt } from "@/components/MetricArt";

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary disabled:opacity-60";
const labelClass = "mb-1 block text-[11px] font-extrabold text-muted-foreground";

function bkkTime(s: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
}

export function ChallengeDialog({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  editing?: ChallengeRow | null;
}) {
  const create = useCreateChallenge();
  const update = useUpdateChallenge();
  const locked = !!editing && editing.state !== "upcoming";
  const now = new Date();
  const week = new Date(Date.now() + 6 * 86400000);
  const [step, setStep] = useState<1 | 2>(editing ? 2 : 1);
  const [metric, setMetric] = useState<ChallengeMetric>((editing?.metric as ChallengeMetric) ?? "steps");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [target, setTarget] = useState(editing ? String(editing.target_value) : "");
  const [startDate, setStartDate] = useState(editing ? bkkDate(editing.start_at) : bkkDate(now));
  const [startTime, setStartTime] = useState(editing ? bkkTime(editing.start_at) : "00:00");
  const [endDate, setEndDate] = useState(editing ? bkkDate(editing.end_at) : bkkDate(week));
  const [endTime, setEndTime] = useState(editing ? bkkTime(editing.end_at) : "23:59");
  const [participation, setParticipation] = useState<ChallengeParticipation>(editing?.participation_visibility ?? "everyone");
  const [board, setBoard] = useState<ChallengeBoardVisibility>(editing?.leaderboard_visibility ?? "participants");

  if (!open) return null;
  const info = metricInfo(metric);
  const pending = create.isPending || update.isPending;

  const submit = () => {
    const t = Number(target);
    if (!title.trim()) return toast.error("กรุณาตั้งชื่อชาเลนจ์");
    if (!locked) {
      if (!Number.isFinite(t) || t <= 0) return toast.error("กรุณาระบุเป้าหมายให้มากกว่า 0");
      if (!startDate || !endDate || !startTime || !endTime) return toast.error("กรุณากำหนดวันและเวลาให้ครบ");
      if (endDate < startDate) return toast.error("วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น");
      if (new Date(bkkToIso(endDate, endTime)) <= new Date(bkkToIso(startDate, startTime)))
        return toast.error("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น");
    }
    const input = {
      title: title.trim(),
      description: description.trim(),
      metric,
      target: t,
      start_at: bkkToIso(startDate, startTime),
      end_at: bkkToIso(endDate, `${endTime}`),
      participation,
      board,
    };
    const onError = (e: unknown) => toast.error(challengeErrorMessage(e));
    if (editing) {
      update.mutate({ ...input, id: editing.id }, {
        onSuccess: () => { toast.success("บันทึกการแก้ไขแล้ว"); onClose(); onSaved?.(editing.id); },
        onError,
      });
    } else {
      create.mutate(input, {
        onSuccess: (row) => {
          toast.success(`สร้างชาเลนจ์สำเร็จ • รหัส ${row?.challenge_code ?? ""}`);
          onClose();
          if (row?.id) onSaved?.(row.id);
        },
        onError,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          {step === 2 && !editing ? (
            <button onClick={() => setStep(1)} className="rounded-xl bg-muted p-2" aria-label="ย้อนกลับ">
              <ArrowLeft className="size-4" />
            </button>
          ) : <span />}
          <h2 className="flex-1 text-base font-extrabold">
            {editing ? "แก้ไขชาเลนจ์" : step === 1 ? "เลือกประเภทชาเลนจ์" : "ข้อมูลชาเลนจ์"}
          </h2>
          <button onClick={onClose} className="rounded-xl bg-muted p-2" aria-label="ปิด">
            <X className="size-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMetric(m.value); setTarget(m.placeholder); setStep(2); }}
                className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card p-3 text-center shadow-sm transition hover:border-primary active:scale-[0.98]"
              >
                <MetricArt metric={m.value} className="size-20" />
                <span className="text-sm font-extrabold">{m.label}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">{m.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-primary-soft p-3">
              <MetricArt metric={metric} className="size-12" />
              <div>
                <p className="text-[11px] font-bold text-primary">ประเภท Challenge</p>
                <p className="text-sm font-extrabold">{info.label}</p>
              </div>
            </div>
            {locked ? (
              <p className="rounded-2xl bg-muted p-3 text-[11px] font-semibold text-muted-foreground">
                ชาเลนจ์เริ่มแล้ว แก้ไขได้เฉพาะชื่อและคำอธิบาย หากต้องการเปลี่ยนประเภท เป้าหมาย หรือช่วงเวลา แนะนำให้สร้างชาเลนจ์ใหม่
              </p>
            ) : null}

            <div>
              <label className={labelClass} htmlFor="ch-title">ชื่อ Challenge</label>
              <input id="ch-title" maxLength={80} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เดินให้ครบ 50,000 ก้าว" />
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-desc">คำอธิบาย</label>
              <textarea id="ch-desc" className={`${inputClass} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="สะสมให้ได้มากที่สุดภายในระยะเวลาที่กำหนด" />
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-target">เป้าหมาย ({info.unit})</label>
              <input id="ch-target" type="number" min={0} step={info.step} disabled={locked} className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} />
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">เป้าหมายใช้แสดงความคืบหน้า ไม่ใช่คะแนน</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="ch-sd">วันที่เริ่มต้น</label>
                <input id="ch-sd" type="date" disabled={locked} className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ch-st">เวลาเริ่มต้น</label>
                <input id="ch-st" type="time" disabled={locked} className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ch-ed">วันที่สิ้นสุด</label>
                <input id="ch-ed" type="date" disabled={locked} className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="ch-et">เวลาสิ้นสุด</label>
                <input id="ch-et" type="time" disabled={locked} className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] font-bold text-primary">Timezone: {TIMEZONE_LABEL}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="ch-part">ผู้ที่เข้าร่วมได้</label>
                <select id="ch-part" disabled={locked} className={inputClass} value={participation} onChange={(e) => setParticipation(e.target.value as ChallengeParticipation)}>
                  {Object.entries(PARTICIPATION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="ch-board">ผู้ที่ดูอันดับได้</label>
                <select id="ch-board" disabled={locked} className={inputClass} value={board} onChange={(e) => setBoard(e.target.value as ChallengeBoardVisibility)}>
                  {Object.entries(BOARD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <p className="rounded-2xl bg-primary-soft p-3 text-[11px] font-semibold text-primary">
              อันดับเรียงจากค่าจริงของ{info.label}ที่สะสมในช่วงเวลาของชาเลนจ์ ค่ามากกว่า = อันดับสูงกว่า
            </p>

            <button onClick={submit} disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "บันทึกการแก้ไข" : "สร้างชาเลนจ์"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
