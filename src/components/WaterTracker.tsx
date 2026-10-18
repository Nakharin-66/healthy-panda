import { useState } from "react";
import { GlassWater, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAddWater, useDeleteWater, useTodayWater, useUpdateWater, type WaterEntry } from "@/lib/db";
import { bkkDate, bkkInstant, bkkTime } from "@/lib/bkk";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const QUICK = [150, 250, 500];
const MAX_ML = 5000;

function errText(e: unknown) {
  const m = e instanceof Error ? e.message : "";
  return /jwt|auth/i.test(m) ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" : "บันทึกการดื่มน้ำไม่สำเร็จ กรุณาลองใหม่";
}

function validAmount(v: string) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= MAX_ML ? n : null;
}

export function WaterTracker({ profileId, goal }: { profileId: string | undefined; goal: number }) {
  const { data: water } = useTodayWater(profileId);
  const add = useAddWater(profileId);
  const update = useUpdateWater(profileId);
  const del = useDeleteWater(profileId);
  const [custom, setCustom] = useState("");
  const [editing, setEditing] = useState<WaterEntry | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTime, setEditTime] = useState("");
  const [deleting, setDeleting] = useState<WaterEntry | null>(null);

  const waterMl = water?.total ?? 0;
  const logs = water?.logs ?? [];

  const addMl = (n: number) =>
    add.mutate(n, { onError: (e) => toast.error(errText(e)) });

  const submitCustom = () => {
    const n = validAmount(custom);
    if (!n) { toast.error(`กรุณากรอกปริมาณ 1–${MAX_ML} มล.`); return; }
    addMl(n);
    setCustom("");
  };

  const openEdit = (l: WaterEntry) => {
    if (l.id.startsWith("local-")) return;
    setEditing(l);
    setEditAmount(String(l.amount_ml));
    setEditTime(bkkTime(l.recorded_at));
  };

  const saveEdit = () => {
    if (!editing) return;
    const n = validAmount(editAmount);
    if (!n) { toast.error(`กรุณากรอกปริมาณ 1–${MAX_ML} มล.`); return; }
    if (!/^\d{2}:\d{2}$/.test(editTime)) { toast.error("กรุณาระบุเวลาให้ถูกต้อง"); return; }
    update.mutate(
      { id: editing.id, amount_ml: n, recorded_at: bkkInstant(bkkDate(editing.recorded_at), editTime) },
      { onError: () => toast.error("แก้ไขรายการไม่สำเร็จ กรุณาลองใหม่") },
    );
    setEditing(null);
  };

  return (
    <section className="card-soft mb-4 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-info-soft text-info">
          <GlassWater className="size-6" strokeWidth={2.3} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-extrabold">การดื่มน้ำ</p>
          <p className="text-xs font-bold text-muted-foreground">
            {waterMl} / {goal} ml
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`h-8 flex-1 rounded-lg border-2 border-info/25 ${
              i < Math.round((waterMl / (goal || 1)) * 10) ? "bg-info/70" : "bg-info-soft"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((n) => (
          <button
            key={n}
            onClick={() => addMl(n)}
            disabled={!profileId}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-95 disabled:opacity-60"
          >
            <Plus className="size-3.5" /> {n}ml
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitCustom();
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_ML}
          placeholder="กรอกปริมาณเอง (มล.)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-9 rounded-full text-xs"
          aria-label="ปริมาณน้ำ (มล.)"
        />
        <button
          type="submit"
          disabled={!profileId || !custom}
          className="shrink-0 rounded-full bg-primary-soft px-4 text-xs font-extrabold text-primary active:scale-95 disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </form>

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-extrabold text-muted-foreground">ประวัติวันนี้</p>
        {logs.length === 0 ? (
          <p className="text-[11px] font-semibold text-muted-foreground">ยังไม่มีการบันทึกการดื่มน้ำวันนี้</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(l)}
                  className="flex flex-1 items-center justify-between text-left text-xs font-bold"
                  aria-label={`แก้ไข ${l.amount_ml} มล. เวลา ${bkkTime(l.recorded_at)}`}
                >
                  <span>{l.amount_ml} มล.</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {bkkTime(l.recorded_at)} น. <Pencil className="size-3" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => !l.id.startsWith("local-") && setDeleting(l)}
                  className="grid size-7 place-items-center rounded-full text-destructive"
                  aria-label="ลบรายการ"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขการดื่มน้ำ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-bold">
              ปริมาณ (มล.)
              <Input type="number" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </label>
            <label className="block text-xs font-bold">
              เวลา
              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button onClick={saveEdit}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรายการนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${deleting.amount_ml} มล. เวลา ${bkkTime(deleting.recorded_at)} น.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting)
                  del.mutate(deleting.id, { onError: () => toast.error("ลบรายการไม่สำเร็จ กรุณาลองใหม่") });
                setDeleting(null);
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
