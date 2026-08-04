import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GOAL_TEMPLATES, GOAL_TYPES, useSaveGoal, type ExerciseGoal } from "@/lib/activities";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultEnd(period: string) {
  const d = new Date();
  d.setDate(d.getDate() + (period === "daily" ? 0 : period === "monthly" ? 29 : 6));
  return isoDate(d);
}

export function GoalDialog({
  open,
  onOpenChange,
  profileId,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId?: string | undefined;
  editing?: ExerciseGoal | null | undefined;
}) {
  const save = useSaveGoal(profileId);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<string>("minutes");
  const [target, setTarget] = useState("150");
  const [unit, setUnit] = useState("นาที");
  const [period, setPeriod] = useState("weekly");
  const [start, setStart] = useState(() => isoDate(new Date()));
  const [end, setEnd] = useState(() => defaultEnd("weekly"));

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setGoalType(editing?.goal_type ?? "minutes");
    setTarget(editing ? String(editing.target_value) : "150");
    setUnit(editing?.unit ?? "นาที");
    setPeriod(editing?.period ?? "weekly");
    setStart(editing?.start_date ?? isoDate(new Date()));
    setEnd(editing?.end_date ?? defaultEnd("weekly"));
  }, [open, editing]);

  const applyTemplate = (t: (typeof GOAL_TEMPLATES)[number]) => {
    setName(t.name);
    setGoalType(t.goal_type);
    setTarget(String(t.target_value));
    setUnit(t.unit);
    setPeriod(t.period);
    setStart(isoDate(new Date()));
    setEnd(defaultEnd(t.period));
  };

  const submit = async () => {
    const trimmed = name.trim();
    const value = Number(target);
    if (!trimmed) {
      toast.error("กรุณากรอกชื่อเป้าหมาย");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("ค่าเป้าหมายต้องมากกว่า 0");
      return;
    }
    if (new Date(end) < new Date(start)) {
      toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
      return;
    }
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: trimmed,
        goal_type: goalType,
        target_value: value,
        unit: unit.trim() || "หน่วย",
        period,
        start_date: start,
        end_date: end,
      });
      toast.success(editing ? "แก้ไขเป้าหมายแล้ว" : "สร้างเป้าหมายใหม่แล้ว 🎯");
      onOpenChange(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            {editing ? "แก้ไขเป้าหมาย" : "สร้างเป้าหมายใหม่"}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold">
            เป้าหมายใช้ติดตามความสำเร็จเท่านั้น ไม่มีผลต่อการคำนวณแคลอรี
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {GOAL_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t)}
                className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-extrabold text-primary"
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold">ชื่อเป้าหมาย</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="เช่น ออกกำลังกาย 150 นาที/สัปดาห์"
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-extrabold">ประเภทเป้าหมาย</span>
            <div className="flex flex-wrap gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setGoalType(t.value);
                    setUnit(t.unit);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    goalType === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">ค่าเป้าหมาย</span>
              <input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">หน่วย</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={20}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">วันเริ่ม</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-3 py-3 text-xs font-bold outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">วันสิ้นสุด</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-3 py-3 text-xs font-bold outline-none"
              />
            </label>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-2xl bg-secondary py-3 text-sm font-extrabold"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={save.isPending}
            className="flex-1 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:opacity-60"
          >
            บันทึก
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
