import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityIcon } from "@/components/ActivityIcon";
import {
  calcCalories,
  DEFAULT_WEIGHT_KG,
  DISTANCE_SOURCE_LABELS,
  MAX_DISTANCE_KM,
  kmToUnit,
  matchSyncedDistance,
  supportsDistance,
  unitToKm,
  useDistanceSamples,
  useSaveActivityLog,
  type ActivityLog,
  type ActivityType,
} from "@/lib/activities";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityLogDialog({
  open,
  onOpenChange,
  profileId,
  weightKg,
  types,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId?: string | undefined;
  weightKg?: number | null | undefined;
  types: ActivityType[];
  editing?: ActivityLog | null | undefined;
}) {
  const save = useSaveActivityLog(profileId, weightKg);
  const { data: distanceSamples } = useDistanceSamples(profileId);
  const [typeId, setTypeId] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [when, setWhen] = useState(() => toLocalInput(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<"km" | "mi">("km");

  useEffect(() => {
    if (!open) return;
    setTypeId(editing?.activity_type_id ?? types[0]?.id ?? "");
    setMinutes(editing ? String(editing.duration_minutes) : "30");
    setWhen(toLocalInput(editing?.performed_at ?? new Date().toISOString()));
    setNotes(editing?.notes ?? "");
    setUnit("km");
    setDistance(editing?.distance_km != null ? String(Number(editing.distance_km)) : "");
  }, [open, editing, types]);

  const weight = Number(weightKg) > 0 ? Number(weightKg) : DEFAULT_WEIGHT_KG;
  const selected = useMemo(() => types.find((t) => t.id === typeId), [types, typeId]);
  const preview = selected
    ? calcCalories(Number(selected.met_value), weight, Number(minutes) || 0)
    : 0;

  const distanceEnabled = supportsDistance(selected ?? null);
  const synced = useMemo(
    () =>
      distanceEnabled
        ? matchSyncedDistance(distanceSamples, new Date(when).toISOString(), Number(minutes) || 0)
        : null,
    [distanceEnabled, distanceSamples, when, minutes],
  );

  // Synced health data always wins over a manual value.
  useEffect(() => {
    if (synced) setDistance(String(kmToUnit(synced.km, unit).toFixed(2)));
  }, [synced, unit]);


  const submit = async () => {
    const mins = Number(minutes);
    if (!selected) {
      toast.error("กรุณาเลือกกิจกรรม");
      return;
    }
    if (!Number.isFinite(mins) || mins <= 0 || mins > 1440) {
      toast.error("ระยะเวลาต้องอยู่ระหว่าง 1 - 1440 นาที");
      return;
    }

    let distanceKm: number | null = null;
    let distanceSource: "health_connect" | "apple_health" | "smartwatch" | "manual" | null = null;
    let distanceSynced = false;

    if (distanceEnabled) {
      if (synced) {
        distanceKm = synced.km;
        distanceSource = synced.source === "unknown" ? "smartwatch" : synced.source;
        distanceSynced = true;
      } else if (distance.trim()) {
        const raw = Number(distance);
        if (!Number.isFinite(raw) || raw <= 0) {
          toast.error("ระยะทางต้องมากกว่า 0");
          return;
        }
        if (!/^\d+(\.\d{1,2})?$/.test(distance.trim())) {
          toast.error("ระยะทางใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง");
          return;
        }
        const km = Math.round(unitToKm(raw, unit) * 100) / 100;
        if (km <= 0 || km > MAX_DISTANCE_KM) {
          toast.error(`ระยะทางต้องอยู่ระหว่าง 0.01 - ${MAX_DISTANCE_KM} กม.`);
          return;
        }
        distanceKm = km;
        distanceSource = "manual";
      }
    }

    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        activity_type_id: selected.id,
        activity_name: selected.name,
        met_value: Number(selected.met_value),
        duration_minutes: mins,
        performed_at: new Date(when).toISOString(),
        notes: notes.trim() || null,
        distance_km: distanceKm,
        distance_source: distanceSource,
        distance_synced: distanceSynced,
      });
      toast.success(editing ? "แก้ไขบันทึกแล้ว" : `บันทึก ${selected.name} ${mins} นาทีแล้ว 🐼`);
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
            {editing ? "แก้ไขบันทึกกิจกรรม" : "บันทึกกิจกรรม"}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold">
            แคลอรีคำนวณจาก MET × น้ำหนัก {weight} กก. × เวลา (แก้ด้วยมือไม่ได้)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-extrabold">กิจกรรม</span>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeId(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors ${
                    typeId === t.id ? "bg-primary text-primary-foreground" : "bg-secondary"
                  }`}
                >
                  <ActivityIcon name={t.icon} className="size-4 shrink-0" />
                  <span className="flex-1 truncate text-xs font-extrabold">{t.name}</span>
                  <span className="text-[10px] font-bold opacity-80">MET {Number(t.met_value)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">ระยะเวลา (นาที)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold">วัน–เวลา</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-3 py-3 text-xs font-bold outline-none"
              />
            </label>
          </div>

          {distanceEnabled ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-extrabold">ระยะทาง (ไม่บังคับ)</span>
                {synced ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold text-accent">
                    {DISTANCE_SOURCE_LABELS[synced.source === "unknown" ? "smartwatch" : synced.source]}
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={distance}
                  readOnly={!!synced}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="0.00"
                  className={`min-w-0 flex-1 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none ${
                    synced ? "opacity-70" : ""
                  }`}
                />
                <div className="flex shrink-0 gap-1 rounded-2xl bg-secondary p-1">
                  {(["km", "mi"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`rounded-xl px-3 py-2 text-[11px] font-extrabold ${
                        unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {u === "km" ? "กม." : "ไมล์"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                ถ้า Health Connect, Apple Health หรือสมาร์ทวอทช์ที่เชื่อมต่อส่งค่าระยะทางมา ระบบจะใช้ค่านั้นอัตโนมัติ
              </p>
            </div>
          ) : null}


          <label className="block">
            <span className="mb-1 block text-xs font-extrabold">โน้ต (ไม่บังคับ)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full resize-none rounded-2xl bg-secondary px-4 py-3 text-sm font-bold outline-none"
            />
          </label>

          <div className="rounded-2xl bg-primary-soft p-3 text-center">
            <p className="text-[11px] font-bold text-muted-foreground">แคลอรีที่คำนวณได้</p>
            <p className="text-2xl font-black text-primary">{preview.toLocaleString("th-TH")} kcal</p>
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
