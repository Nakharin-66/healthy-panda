import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ActivityIcon } from "@/components/ActivityIcon";
import { ActivityTypeDialog } from "@/components/ActivityTypeDialog";
import { ActivityLogDialog } from "@/components/ActivityLogDialog";
import { GoalDialog } from "@/components/GoalDialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_WEIGHT_KG,
  DISTANCE_SOURCE_LABELS,
  formatDistanceKm,
  goalProgress,
  totalDistanceKm,
  useActivityLogs,
  useActivityRealtime,
  useActivityTypes,
  goalDeadline,
  useArchiveGoal,
  useArchivedGoals,
  useDeleteActivityType,
  useDeleteGoal,
  useExerciseGoals,
  useRestoreGoal,
  useSoftDeleteActivityLog,
  type ActivityLog,
  type ActivityType,
  type DistanceSource,
  type ExerciseGoal,
} from "@/lib/activities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Archive,
  Dumbbell,
  Flame,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Clock,
  Route as Route2,
} from "lucide-react";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "เป้าหมาย & กิจกรรมออกกำลังกาย | Healthy Panda" },
      {
        name: "description",
        content:
          "สร้างกิจกรรมออกกำลังกายของคุณเอง บันทึกกิจกรรมพร้อมคำนวณแคลอรีอัตโนมัติด้วยค่า MET และติดตามเป้าหมายรายสัปดาห์",
      },
      { property: "og:title", content: "เป้าหมาย & กิจกรรมออกกำลังกาย | Healthy Panda" },
      {
        property: "og:description",
        content: "จัดการกิจกรรม MET บันทึกการออกกำลังกาย และติดตามความคืบหน้าเป้าหมายแบบเรียลไทม์",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Goals,
});

type Tab = "logs" | "goals" | "types";

function Goals() {
  const { signedIn, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const profileId = profile?.id;
  useActivityRealtime(profileId);

  const { data: types, isLoading: typesLoading } = useActivityTypes(profileId);
  const { data: logs, isLoading: logsLoading } = useActivityLogs(profileId);
  const { data: goals, isLoading: goalsLoading } = useExerciseGoals(profileId);
  const softDelete = useSoftDeleteActivityLog();
  const deleteType = useDeleteActivityType();
  const archiveGoal = useArchiveGoal();

  const [tab, setTab] = useState<Tab>("logs");
  const [typeDialog, setTypeDialog] = useState(false);
  const [editingType, setEditingType] = useState<ActivityType | null>(null);
  const [logDialog, setLogDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);
  const [goalDialog, setGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ExerciseGoal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ActivityLog | null>(null);

  const allLogs = logs ?? [];
  const allTypes = types ?? [];
  const weight = Number(profile?.weight_kg) > 0 ? Number(profile?.weight_kg) : DEFAULT_WEIGHT_KG;

  const week = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const w = allLogs.filter((l) => new Date(l.performed_at) >= since);
    return {
      logs: w,
      minutes: w.reduce((s, l) => s + l.duration_minutes, 0),
      calories: w.reduce((s, l) => s + Number(l.calories), 0),
      days: new Set(w.map((l) => l.performed_at.slice(0, 10))).size,
      distance: totalDistanceKm(w),
    };
  }, [allLogs]);

  const overallPct = useMemo(() => {
    const active = (goals ?? []).filter((g) => g.status !== "archived");
    if (!active.length) return 0;
    const sum = active.reduce((s, g) => s + goalProgress(g, allLogs).pct, 0);
    return Math.round(sum / active.length);
  }, [goals, allLogs]);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <PandaHeader title="เป้าหมายของฉัน" />
        <SignInPrompt message="เข้าสู่ระบบเพื่อบันทึกกิจกรรมและติดตามเป้าหมายจริง" />
      </AppScreen>
    );
  }

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await softDelete.mutateAsync({ id: target.id });
      toast.success("ลบบันทึกแล้ว", {
        action: {
          label: "เลิกทำ",
          onClick: () => {
            softDelete
              .mutateAsync({ id: target.id, restore: true })
              .then(() => toast.success("กู้คืนบันทึกแล้ว"))
              .catch(() => toast.error("กู้คืนไม่สำเร็จ"));
          },
        },
      });
    } catch {
      toast.error("ลบไม่สำเร็จ");
    }
  };

  const removeType = async (t: ActivityType) => {
    try {
      await deleteType.mutateAsync(t.id);
      toast.success("ลบกิจกรรมแล้ว");
    } catch {
      toast.error("ลบไม่ได้ — กิจกรรมนี้ถูกใช้ในบันทึกแล้ว");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "logs", label: "บันทึกกิจกรรม" },
    { key: "goals", label: "เป้าหมาย" },
    { key: "types", label: "ประเภทกิจกรรม" },
  ];

  return (
    <AppScreen>
      <PandaHeader
        title="เป้าหมายของฉัน"
        subtitle={`น้ำหนักที่ใช้คำนวณ ${weight} กก.`}
        streak={profile?.streak_days ?? 0}
      />

      <section className="card-soft mb-4 p-4">
        <div className="mb-2 flex items-end justify-between">
          <p className="text-sm font-extrabold">ความสำเร็จเป้าหมายรวม</p>
          <p className="text-2xl font-black text-primary">{overallPct}%</p>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className={`mt-3 grid gap-2 text-center ${week.distance > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
          {[
            { l: "ออกกำลังกาย", v: `${week.days}/7 วัน` },
            { l: "เผาผลาญ", v: `${Math.round(week.calories).toLocaleString("th-TH")} kcal` },
            { l: "เวลารวม", v: `${Math.floor(week.minutes / 60)}ชม ${week.minutes % 60}น` },
            ...(week.distance > 0 ? [{ l: "ระยะทาง", v: formatDistanceKm(week.distance) }] : []),
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-primary-soft p-2">
              <p className="text-sm font-black">{s.v}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 flex gap-1.5 rounded-full bg-secondary p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-2 text-[11px] font-extrabold transition-all ${
              tab === t.key ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "logs" ? (
        <section className="space-y-2.5">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingLog(null);
                setLogDialog(true);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
            >
              <Plus className="size-4" /> บันทึกกิจกรรม
            </button>
            <button
              onClick={() => {
                setEditingType(null);
                setTypeDialog(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-extrabold text-primary active:scale-[0.98]"
            >
              <Plus className="size-4" /> เพิ่มกิจกรรม
            </button>
          </div>

          {logsLoading ? (
            <>
              <Skeleton className="h-[68px] rounded-3xl" />
              <Skeleton className="h-[68px] rounded-3xl" />
            </>
          ) : allLogs.length === 0 ? (
            <p className="card-soft p-6 text-center text-xs font-semibold text-muted-foreground">
              ยังไม่มีบันทึกกิจกรรม — เริ่มออกกำลังกายวันนี้เลย! 🐼
            </p>
          ) : (
            allLogs.map((l) => (
              <article
                key={l.id}
                className="card-soft flex items-center gap-3 p-3.5 duration-300 animate-in fade-in slide-in-from-bottom-1"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <ActivityIcon
                    name={allTypes.find((t) => t.id === l.activity_type_id)?.icon ?? "dumbbell"}
                    className="size-5"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{l.activity_name}</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    <Flame className="size-3 text-primary" /> {Math.round(Number(l.calories))} kcal
                    <Clock className="ml-1 size-3" /> {l.duration_minutes}น
                    {l.distance_km != null ? (
                      <>
                        <Route2 className="ml-1 size-3 text-accent" /> {formatDistanceKm(Number(l.distance_km))}
                      </>
                    ) : null}
                    {" • "}
                    {new Date(l.performed_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {l.distance_km != null && l.distance_synced ? (
                    <span className="mt-0.5 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-extrabold text-accent">
                      {DISTANCE_SOURCE_LABELS[(l.distance_source as DistanceSource) ?? "unknown"]}
                    </span>
                  ) : null}
                  {l.notes ? (
                    <span className="block truncate text-[10px] font-semibold text-muted-foreground">{l.notes}</span>
                  ) : null}
                </span>
                <button
                  aria-label="แก้ไข"
                  onClick={() => {
                    setEditingLog(l);
                    setLogDialog(true);
                  }}
                  className="grid size-9 place-items-center rounded-xl bg-secondary text-foreground active:scale-95"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  aria-label="ลบ"
                  onClick={() => setPendingDelete(l)}
                  className="grid size-9 place-items-center rounded-xl bg-secondary text-destructive active:scale-95"
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "goals" ? (
        <section className="space-y-2.5">
          <button
            onClick={() => {
              setEditingGoal(null);
              setGoalDialog(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
          >
            <Plus className="size-4" /> สร้างเป้าหมาย
          </button>

          {goalsLoading ? (
            <Skeleton className="h-24 rounded-3xl" />
          ) : (goals ?? []).length === 0 ? (
            <p className="card-soft p-6 text-center text-xs font-semibold text-muted-foreground">
              ยังไม่มีเป้าหมาย — ลองเริ่มจาก “ออกกำลังกาย 150 นาที/สัปดาห์” 🎯
            </p>
          ) : (
            (goals ?? []).map((g) => {
              const p = goalProgress(g, allLogs);
              return (
                <article key={g.id} className="card-soft p-4 duration-300 animate-in fade-in">
                  <div className="mb-1.5 flex items-start gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <Target className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{g.name}</p>
                      <p className="text-[11px] font-bold text-muted-foreground">
                        {p.value.toLocaleString("th-TH")} / {Number(g.target_value).toLocaleString("th-TH")} {g.unit} •{" "}
                        {new Date(g.start_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} –{" "}
                        {new Date(g.end_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <p className={`text-lg font-black ${p.done ? "text-accent" : "text-primary"}`}>{p.pct}%</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${p.done ? "bg-accent" : "bg-primary"}`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingGoal(g);
                        setGoalDialog(true);
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-[11px] font-extrabold"
                    >
                      <Pencil className="size-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() =>
                        archiveGoal
                          .mutateAsync(g.id)
                          .then(() => toast.success("เก็บเป้าหมายเข้าคลังแล้ว"))
                          .catch(() => toast.error("ทำรายการไม่สำเร็จ"))
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-[11px] font-extrabold text-destructive"
                    >
                      <Undo2 className="size-3" /> เก็บเข้าคลัง
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {tab === "types" ? (
        <section className="space-y-2.5">
          <button
            onClick={() => {
              setEditingType(null);
              setTypeDialog(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.98]"
          >
            <Plus className="size-4" /> เพิ่มกิจกรรม
          </button>

          {typesLoading || profileLoading ? (
            <Skeleton className="h-16 rounded-3xl" />
          ) : (
            allTypes.map((t) => (
              <article key={t.id} className="card-soft flex items-center gap-3 p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <ActivityIcon name={t.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{t.name}</span>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    MET {Number(t.met_value)} •{" "}
                    {ACTIVITY_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}
                    {t.is_builtin ? " • ค่าเริ่มต้น" : ""}
                  </span>
                </span>
                {t.is_builtin ? (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground">
                    ระบบ
                  </span>
                ) : (
                  <>
                    <button
                      aria-label="แก้ไขกิจกรรม"
                      onClick={() => {
                        setEditingType(t);
                        setTypeDialog(true);
                      }}
                      className="grid size-9 place-items-center rounded-xl bg-secondary active:scale-95"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="ลบกิจกรรม"
                      onClick={() => removeType(t)}
                      className="grid size-9 place-items-center rounded-xl bg-secondary text-destructive active:scale-95"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </article>
            ))
          )}
          <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-muted-foreground">
            <Dumbbell className="size-3" /> แคลอรี = MET × น้ำหนัก (กก.) × ระยะเวลา (ชม.)
          </p>
        </section>
      ) : null}

      <ActivityTypeDialog
        open={typeDialog}
        onOpenChange={setTypeDialog}
        profileId={profileId}
        editing={editingType}
        existingNames={allTypes.map((t) => t.name)}
      />
      <ActivityLogDialog
        open={logDialog}
        onOpenChange={setLogDialog}
        profileId={profileId}
        weightKg={profile?.weight_kg ?? null}
        types={allTypes}
        editing={editingLog}
      />
      <GoalDialog
        open={goalDialog}
        onOpenChange={setGoalDialog}
        profileId={profileId}
        editing={editingGoal}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-3xl sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold">ลบบันทึกนี้?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-semibold">
              “{pendingDelete?.activity_name}” จะถูกลบออกจากสรุปผล — กู้คืนได้ทันทีหลังลบ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="m-0 flex-1 rounded-2xl text-sm font-extrabold">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="m-0 flex-1 rounded-2xl bg-destructive text-sm font-extrabold text-destructive-foreground"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppScreen>
  );
}
