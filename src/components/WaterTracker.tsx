import { useState } from "react";
import { GlassWater, Plus, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { useAddWater, useDeleteWater, useTodayWater, useWaterHistory, useUpdateWater, type WaterEntry } from "@/lib/db";
import { bkkDate, bkkInstant, bkkTime } from "@/lib/bkk";
import { waterDayLabel, waterSegmentFill } from "@/lib/water";
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDays, setHistoryDays] = useState(7);
  const history = useWaterHistory(profileId, historyDays, historyOpen);

  const waterMl = water?.total ?? 0;
  const groups = new Map<string, WaterEntry[]>();
  for (const entry of history.data?.logs ?? []) {
    const day = bkkDate(entry.recorded_at);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }

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
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(editTime)) { toast.error("กรุณาระบุเวลาให้ถูกต้อง"); return; }
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
        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full text-muted-foreground" aria-label="ประวัติการดื่มน้ำ" title="ประวัติการดื่มน้ำ" onClick={() => setHistoryOpen(true)}>
          <History className="size-5" />
        </Button>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
             className="relative h-8 flex-1 overflow-hidden rounded-lg border-2 border-info/25 bg-info-soft"
          >
            <div className="absolute inset-y-0 left-0 bg-info/70" style={{ width: `${waterSegmentFill(waterMl, goal, i) * 100}%` }} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map((n) => (
          <Button
            key={n}
            onClick={() => addMl(n)}
            disabled={!profileId}
            className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-95 disabled:opacity-60"
          >
            <Plus className="size-3.5" /> {n}ml
          </Button>
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
        <Button
          type="submit"
          disabled={!profileId || !custom}
          className="shrink-0 rounded-full bg-primary-soft px-4 text-xs font-extrabold text-primary active:scale-95 disabled:opacity-60"
        >
          เพิ่ม
        </Button>
      </form>

      <p className="mt-3 text-[11px] font-semibold text-muted-foreground">ดื่มน้ำวันนี้ {water?.count ?? 0} ครั้ง</p>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85dvh]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>ประวัติการดื่มน้ำ</DialogTitle></DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto">
            {history.isLoading ? <p className="text-xs text-muted-foreground">กำลังโหลดประวัติ...</p>
              : history.isError ? <div className="space-y-2"><p className="text-xs text-destructive">โหลดประวัติไม่สำเร็จ กรุณาลองใหม่</p><Button variant="outline" size="sm" onClick={() => { toast.error("โหลดประวัติไม่สำเร็จ กรุณาลองใหม่"); void history.refetch(); }}>ลองใหม่</Button></div>
              : groups.size === 0 ? <p className="text-xs text-muted-foreground">ยังไม่มีการบันทึกการดื่มน้ำ</p>
              : [...groups].map(([day, entries]) => (
                <div key={day} className="mb-3">
                  <p className="mb-1 text-[11px] font-extrabold text-muted-foreground">{waterDayLabel(day)}</p>
                  <ul className="divide-y divide-border">
                    {entries.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 py-1.5">
                        <Button variant="ghost" type="button" disabled={l.id.startsWith("local-")} onClick={() => openEdit(l)} className="h-auto flex-1 justify-between px-0 text-left text-xs font-bold" aria-label={`แก้ไข ${l.amount_ml} มล. เวลา ${bkkTime(l.recorded_at)}`}>
                          <span>{l.amount_ml} มล.</span>
                          <span className="flex items-center gap-1 text-muted-foreground">{bkkTime(l.recorded_at)} น. <Pencil className="size-3" /></span>
                        </Button>
                        <Button variant="ghost" size="icon" type="button" disabled={l.id.startsWith("local-")} onClick={() => setDeleting(l)} className="size-7 rounded-full text-destructive" aria-label="ลบรายการ"><Trash2 className="size-3.5" /></Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
          <Button variant="outline" disabled={history.isFetching} onClick={() => setHistoryDays((days) => days + 7)}>ดูย้อนหลังเพิ่ม 7 วัน</Button>
        </DialogContent>
      </Dialog>

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
