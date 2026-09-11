import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  BOARD_LABEL,
  CATEGORY_LABEL,
  GOAL_MODE_LABEL,
  METRIC_OPTIONS,
  METRIC_SOURCE_LABEL,
  PARTICIPATION_LABEL,
  SCORING_LABEL,
  TARGET_SOURCE_LABEL,
  challengeErrorMessage,
  computeMaxScore,
  useCreateChallenge,
  type ChallengeBoardVisibility,
  type ChallengeCategory,
  type ChallengeGoalMode,
  type ChallengeParticipation,
  type ChallengeScoringType,
  type ChallengeTargetSource,
} from "@/lib/challenges";


function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary";
const labelClass = "mb-1 block text-[11px] font-extrabold text-muted-foreground";

export function ChallengeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const create = useCreateChallenge();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ChallengeCategory>("movement");
  const [metric, setMetric] = useState("steps");
  const [target, setTarget] = useState("10000");
  const [goalMode, setGoalMode] = useState<ChallengeGoalMode>("daily");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today(6));
  const [participation, setParticipation] = useState<ChallengeParticipation>("everyone");
  const [board, setBoard] = useState<ChallengeBoardVisibility>("everyone");
  const [scoring, setScoring] = useState<ChallengeScoringType>("daily_completion");
  const [targetSource, setTargetSource] = useState<ChallengeTargetSource>("fixed");

  const maxScore = computeMaxScore({
    scoring,
    goalMode,
    metric,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  });

  if (!open) return null;

  const submit = () => {
    const targetValue = Number(target);
    if (!title.trim()) {
      toast.error("กรุณาตั้งชื่อชาเลนจ์");
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("กรุณาระบุเป้าหมายให้มากกว่า 0");
      return;
    }
    if (endDate < startDate) {
      toast.error("วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม");
      return;
    }


    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        category,
        metric,
        target_value: targetValue,
        goal_mode: goalMode,
        start_date: startDate,
        end_date: endDate,
        participation,
        board,
        scoring,
        target_source: targetSource,
      },
      {
        onSuccess: (row) => {
          toast.success(`สร้างชาเลนจ์สำเร็จ • รหัส ${row?.challenge_code ?? ""}`);
          onClose();
          if (row?.id) onCreated?.(row.id);
        },
        onError: (e) => toast.error(challengeErrorMessage(e)),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">สร้างชาเลนจ์</h2>
          <button onClick={onClose} className="rounded-xl bg-muted p-2" aria-label="ปิด">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="ch-title">
              ชื่อชาเลนจ์
            </label>
            <input
              id="ch-title"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น เดิน 10,000 ก้าวทุกวัน"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ch-desc">
              คำอธิบาย
            </label>
            <textarea
              id="ch-desc"
              className={`${inputClass} min-h-20`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="อธิบายกติกาสั้น ๆ"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ch-cat">
                หมวดหมู่
              </label>
              <select
                id="ch-cat"
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
              >
                {Object.entries(CATEGORY_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-metric">
                ประเภทการวัดผล
              </label>
              <select
                id="ch-metric"
                className={inputClass}
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ch-target">
                เป้าหมาย
              </label>
              <input
                id="ch-target"
                type="number"
                min={1}
                className={inputClass}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-mode">
                รูปแบบเป้าหมาย
              </label>
              <select
                id="ch-mode"
                className={inputClass}
                value={goalMode}
                onChange={(e) => setGoalMode(e.target.value as ChallengeGoalMode)}
              >
                {Object.entries(GOAL_MODE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ch-start">
                วันที่เริ่ม
              </label>
              <input
                id="ch-start"
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-end">
                วันที่สิ้นสุด
              </label>
              <input
                id="ch-end"
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ch-part">
                ผู้ที่เข้าร่วมได้
              </label>
              <select
                id="ch-part"
                className={inputClass}
                value={participation}
                onChange={(e) => setParticipation(e.target.value as ChallengeParticipation)}
              >
                {Object.entries(PARTICIPATION_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-board">
                ผู้ที่ดูอันดับได้
              </label>
              <select
                id="ch-board"
                className={inputClass}
                value={board}
                onChange={(e) => setBoard(e.target.value as ChallengeBoardVisibility)}
              >
                {Object.entries(BOARD_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass} htmlFor="ch-scoring">
                วิธีคำนวณคะแนน
              </label>
              <select
                id="ch-scoring"
                className={inputClass}
                value={scoring}
                onChange={(e) => setScoring(e.target.value as ChallengeScoringType)}
              >
                {Object.entries(SCORING_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ch-target-source">
                แหล่งเป้าหมาย
              </label>
              <select
                id="ch-target-source"
                className={inputClass}
                value={targetSource}
                onChange={(e) => setTargetSource(e.target.value as ChallengeTargetSource)}
              >
                {Object.entries(TARGET_SOURCE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl bg-primary-soft p-3 text-[11px] font-bold text-primary">
            <p>คะแนนสูงสุด = {maxScore.toLocaleString("th-TH")} คะแนน</p>
            <p className="mt-0.5 font-semibold">
              ระบบใช้{METRIC_SOURCE_LABEL[metric] ?? "ข้อมูลสุขภาพที่บันทึกไว้ในระบบ"}
            </p>
            {targetSource === "personal_goal" ? (
              <p className="mt-0.5 font-semibold">
                ผู้เข้าร่วมแต่ละคนจะถูกวัดกับเป้าหมายรายวันของตัวเอง
              </p>
            ) : null}
          </div>

          <p className="text-[11px] font-semibold text-muted-foreground">
            คะแนนและความคืบหน้าคำนวณจากกิจกรรมจริงของผู้เข้าร่วมโดยระบบ ไม่สามารถกรอกเองได้
          </p>

          <button
            onClick={submit}
            disabled={create.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            สร้างชาเลนจ์
          </button>
        </div>
      </div>
    </div>
  );
}
