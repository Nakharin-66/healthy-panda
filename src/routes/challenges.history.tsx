import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { MetricArt } from "@/components/MetricArt";
import { useAuth } from "@/hooks/useAuth";
import {
  STATE_LABEL,
  challengeErrorMessage,
  fmtRange,
  formatValue,
  metricInfo,
  useChallenges,
  useHideChallenge,
} from "@/lib/challenges";

export const Route = createFileRoute("/challenges/history")({
  head: () => ({
    meta: [
      { title: "ประวัติ Challenge | Healthy Panda" },
      { name: "description", content: "ดูชาเลนจ์ที่กำลังดำเนินการ จบแล้ว และที่คุณสร้าง พร้อมอันดับสุดท้ายและค่าที่ทำได้" },
      { property: "og:title", content: "ประวัติ Challenge | Healthy Panda" },
      { property: "og:description", content: "ประวัติชาเลนจ์ของคุณบน Healthy Panda" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const TABS = [
  { v: "running", l: "กำลังดำเนินการ" },
  { v: "ended", l: "จบแล้ว" },
  { v: "mine", l: "สร้างโดยฉัน" },
] as const;

function HistoryPage() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const list = useChallenges(signedIn);
  const hide = useHideChallenge();
  const [tab, setTab] = useState<(typeof TABS)[number]["v"]>("running");

  if (!loading && !signedIn) return <AppScreen><SignInPrompt message="เข้าสู่ระบบเพื่อดูประวัติชาเลนจ์" /></AppScreen>;

  const rows = (list.data ?? []).filter((c) =>
    tab === "mine" ? c.is_owner : c.joined && (tab === "running" ? c.state === "running" || c.state === "upcoming" : c.state === "ended"),
  );

  return (
    <AppScreen>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/leaderboard" })} className="rounded-xl bg-muted p-2" aria-label="ย้อนกลับ"><ArrowLeft className="size-4" /></button>
        <h1 className="text-lg font-extrabold">ประวัติ Challenge</h1>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)} className={`rounded-xl py-2 text-[11px] font-extrabold ${tab === t.v ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{t.l}</button>
        ))}
      </div>
      {list.isLoading ? (
        <div className="card-soft grid place-items-center p-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="card-soft p-6 text-center text-xs font-semibold text-muted-foreground">ยังไม่มีรายการในหมวดนี้</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const m = metricInfo(c.metric);
            return (
              <div key={c.id} className="card-soft flex items-center gap-3 p-3">
                <button onClick={() => navigate({ to: "/challenges/$challengeId", params: { challengeId: c.id } })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <MetricArt metric={c.metric} className="size-12" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{c.title}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">{m.label} • {fmtRange(c.start_at, c.end_at)} • {STATE_LABEL[c.state]}</p>
                    <p className="text-[11px] font-bold text-primary">
                      {c.joined ? `อันดับ #${c.my_rank ?? "-"} / ${c.participant_count} • ` : `${c.participant_count} คน • `}
                      {formatValue(c.my_value, c.metric)} / {formatValue(c.target_value, c.metric)} {m.unit}
                    </p>
                  </div>
                </button>
                {c.joined ? (
                  <button
                    aria-label="ลบออกจากประวัติของฉัน"
                    onClick={() => { if (confirm("ลบรายการนี้ออกจากประวัติของคุณหรือไม่? ข้อมูลของผู้เข้าร่วมคนอื่นจะไม่ถูกลบ")) hide.mutate(c.id, { onSuccess: () => toast.success("ลบออกจากประวัติแล้ว"), onError: (e) => toast.error(challengeErrorMessage(e)) }); }}
                    className="rounded-xl bg-muted p-2 text-muted-foreground"><Trash2 className="size-4" /></button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppScreen>
  );
}
