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
import { ActivityIcon, ACTIVITY_ICON_LIST } from "@/components/ActivityIcon";
import { ACTIVITY_CATEGORIES, useSaveActivityType, type ActivityType } from "@/lib/activities";

export function ActivityTypeDialog({
  open,
  onOpenChange,
  profileId,
  editing,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId?: string | undefined;
  editing?: ActivityType | null | undefined;
  existingNames: string[];
}) {
  const save = useSaveActivityType(profileId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("cardio");
  const [icon, setIcon] = useState<string>("dumbbell");
  const [met, setMet] = useState("6");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "cardio");
    setIcon(editing?.icon ?? "dumbbell");
    setMet(editing ? String(editing.met_value) : "6");
    setDescription(editing?.description ?? "");
  }, [open, editing]);

  const submit = async () => {
    const trimmed = name.trim();
    const metValue = Number(met);
    if (!trimmed) {
      toast.error("กรุณากรอกชื่อกิจกรรม");
      return;
    }
    const dupes = existingNames
      .filter((n) => n.toLowerCase() !== (editing?.name ?? "").toLowerCase())
      .map((n) => n.toLowerCase());
    if (dupes.includes(trimmed.toLowerCase())) {
      toast.error("มีกิจกรรมชื่อนี้อยู่แล้ว");
      return;
    }
    if (!Number.isFinite(metValue) || metValue <= 0 || metValue > 30) {
      toast.error("ค่า MET ต้องอยู่ระหว่าง 0.1 - 30");
      return;
    }
    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: trimmed,
        category,
        icon,
        met_value: metValue,
        description: description.trim() || null,
      });
      toast.success(editing ? "แก้ไขกิจกรรมแล้ว" : "เพิ่มกิจกรรมใหม่แล้ว 🐼");
      onOpenChange(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            {editing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold">
            แคลอรีคำนวณอัตโนมัติจาก MET × น้ำหนักตัว × ระยะเวลา
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold">ชื่อกิจกรรม</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="เช่น ตีกอล์ฟ"
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-extrabold">หมวดหมู่</span>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    category === c.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-extrabold">ไอคอน</span>
            <div className="grid grid-cols-7 gap-2">
              {ACTIVITY_ICON_LIST.map((i) => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  aria-label={i}
                  className={`grid aspect-square place-items-center rounded-2xl transition-colors ${
                    icon === i ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"
                  }`}
                >
                  <ActivityIcon name={i} className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-extrabold">ค่า MET (Compendium of Physical Activities)</span>
            <input
              type="number"
              step="0.1"
              min={0.1}
              max={30}
              value={met}
              onChange={(e) => setMet(e.target.value)}
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-extrabold">คำอธิบาย (ไม่บังคับ)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full resize-none rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
            />
          </label>
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
