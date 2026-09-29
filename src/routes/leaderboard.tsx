import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, History, Loader2, Mail, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ChallengeDialog } from "@/components/ChallengeDialog";
import { ChallengeBoard } from "@/components/ChallengeBoard";
import { MetricArt } from "@/components/MetricArt";
import trophyPanda from "@/assets/panda-trophy.png";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import { useResolvedAvatar } from "@/lib/avatar";
import { useFriendRealtime, useFriendSummary } from "@/lib/friends";
import {
  STATE_LABEL,
  challengeErrorMessage,
  fmtRange,
  formatValue,
  metricInfo,
  pct,
  timeLeft,
  useBoard,
  useChallengeInvites,
  useChallengeRealtime,
  useChallenges,
  useJoinChallenge,
  useLookupCode,
  useRespondInvite,
} from "@/lib/challenges";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "ชาเลนจ์ & อันดับ | Healthy Panda" },
      { name: "description", content: "สร้างชาเลนจ์ ชวนเพื่อน และดูอันดับจากค่าจริงของก้าว ระยะทาง เวลาออกกำลังกาย และแคลอรี" },
      { property: "og:title", content: "ชาเลนจ์ & อันดับ | Healthy Panda" },
      { property: "og:description", content: "อันดับเรียงจากค่าจริงของข้อมูลสุขภาพในช่วงเวลาของชาเลนจ์" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const myAvatar = useResolvedAvatar(profile?.picture_url);
  useFriendRealtime(signedIn);
  useChallengeRealtime(signedIn);

  const challenges = useChallenges(signedIn);
  const invites = useChallengeInvites(signedIn);
  const summary = useFriendSummary(signedIn);
  const lookup = useLookupCode();
  const respond = useRespondInvite();
  const join = useJoinChallenge();

  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string>();

  const all = challenges.data ?? [];
  const mine = all.filter((c) => c.joined && (c.state === "running" || c.state === "upcoming"));
  useEffect(() => {
    if ((!selected || !mine.some((c) => c.id === selected)) && mine.length) setSelected(mine[0]!.id);
  }, [mine, selected]);
  const current = mine.find((c) => c.id === selected);
  const board = useBoard(signedIn ? current?.id : undefined);
  const incoming = (invites.data ?? []).filter((i) => i.direction === "incoming" && i.status === "pending");

  const open = (id: string) => navigate({ to: "/challenges/$challengeId", params: { challengeId: id } });

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <PandaHeader title="ชาเลนจ์ & อันดับ" subtitle="แข่งกับเพื่อนด้วยข้อมูลจริง" />
        <SignInPrompt message="เข้าสู่ระบบเพื่อสร้างชาเลนจ์ เข้าร่วม และดูอันดับของคุณ" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PandaHeader
        title="ชาเลนจ์ & อันดับ"
        subtitle={`เพื่อน ${summary.data?.friend_count ?? 0} คน`}
        streak={profile?.streak_days ?? 0}
        avatarUrl={myAvatar}
        avatarAlt={profile?.display_name ?? "รูปโปรไฟล์ของคุณ"}
      />

      <div className="mb-3 flex gap-2">
        <button onClick={() => setCreating(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground active:scale-[0.98]">
          <Plus className="size-4" /> สร้างชาเลนจ์
        </button>
        <button onClick={() => navigate({ to: "/friends" })} className="flex items-center gap-1.5 rounded-2xl bg-primary-soft px-4 py-3 text-xs font-extrabold text-primary">
          <Users className="size-4" /> จัดการเพื่อน
          {summary.data?.pending_incoming ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">{summary.data.pending_incoming}</span>
          ) : null}
        </button>
      </div>

      <section className="card-soft mb-3 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-muted-foreground">เข้าร่วมด้วยรหัส</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HP-CH-XXXXX" aria-label="รหัสชาเลนจ์"
            className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-extrabold tracking-wider outline-none focus:border-primary" />
          <button
            disabled={lookup.isPending || code.trim().length < 4}
            onClick={() => lookup.mutate(code.trim(), { onSuccess: (id) => open(id), onError: (e) => toast.error(challengeErrorMessage(e)) })}
            className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {lookup.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} ค้นหา
          </button>
        </div>
      </section>

      <h2 className="mb-2 text-sm font-extrabold">ชาเลนจ์ของฉัน</h2>
      {challenges.isLoading ? (
        <div className="card-soft grid place-items-center p-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : challenges.isError ? (
        <div className="card-soft p-4 text-center text-xs font-bold text-destructive">โหลดชาเลนจ์ไม่สำเร็จ
          <button onClick={() => challenges.refetch()} className="ml-2 underline">ลองใหม่</button></div>
      ) : mine.length === 0 ? (
        <div className="card-soft flex flex-col items-center p-6 text-center">
          <img src={trophyPanda} alt="แพนด้าแดงถือถ้วยรางวัล" width={816} height={816} loading="lazy" className="size-28" />
          <p className="mt-2 text-sm font-extrabold">ยังไม่มีชาเลนจ์</p>
          <p className="mb-3 text-[11px] font-semibold text-muted-foreground">สร้างชาเลนจ์แรกของคุณ แล้วชวนเพื่อนมาแข่งขันกัน</p>
          <button onClick={() => setCreating(true)} className="rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground">+ สร้างชาเลนจ์</button>
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map((c) => {
            const m = metricInfo(c.metric);
            return (
              <button key={c.id} onClick={() => open(c.id)} className="card-soft flex w-full items-center gap-3 p-3 text-left">
                <MetricArt metric={c.metric} className="size-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{c.title}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">{m.label} • {c.participant_count} คน • อันดับ #{c.my_rank ?? "-"}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct(c.my_value, c.target_value))}%` }} />
                  </div>
                  <p className="mt-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                    <span>{formatValue(c.my_value, c.metric)} / {formatValue(c.target_value, c.metric)} {m.unit}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3" />{timeLeft(c)}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {mine.length ? (
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">ตารางอันดับ</h2>
            <button onClick={() => board.refetch()} className="flex items-center gap-1 text-[11px] font-extrabold text-primary">
              <RefreshCw className={`size-3.5 ${board.isFetching ? "animate-spin" : ""}`} /> อัปเดตข้อมูลล่าสุด
            </button>
          </div>
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {mine.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${c.id === selected ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"}`}>
                {c.title}
              </button>
            ))}
          </div>
          {current ? (
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">
              {metricInfo(current.metric).label} • {fmtRange(current.start_at, current.end_at)} • {STATE_LABEL[current.state]}
            </p>
          ) : null}
          {board.isLoading ? (
            <div className="card-soft grid place-items-center p-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : current ? (
            <ChallengeBoard rows={board.data ?? []} metric={current.metric} target={current.target_value} />
          ) : null}
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Mail className="size-4 text-primary" /> คำเชิญ Challenge</h2>
        {incoming.length === 0 ? (
          <p className="card-soft p-4 text-center text-[11px] font-semibold text-muted-foreground">ยังไม่มีคำเชิญใหม่</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((i) => {
              const m = metricInfo(i.metric);
              return (
                <div key={i.id} className="card-soft p-3">
                  <div className="flex items-center gap-3">
                    <PersonAvatar pictureUrl={i.counterpart_picture} name={i.counterpart_name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{i.title}</p>
                      <p className="text-[11px] font-bold text-muted-foreground">เชิญโดย {i.counterpart_name}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {m.label} • เป้าหมาย {formatValue(i.target_value, i.metric)} {m.unit} • {fmtRange(i.start_at, i.end_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => open(i.challenge_id)} className="flex-1 rounded-xl bg-muted py-2 text-[11px] font-extrabold">ดูรายละเอียด</button>
                    <button
                      disabled={join.isPending}
                      onClick={() => { if (confirm(`เข้าร่วม "${i.title}" หรือไม่?`)) join.mutate(i.challenge_id, { onSuccess: () => toast.success("เข้าร่วมชาเลนจ์แล้ว"), onError: (e) => toast.error(challengeErrorMessage(e)) }); }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 text-[11px] font-extrabold text-primary-foreground">
                      <Check className="size-3.5" /> เข้าร่วม
                    </button>
                    <button
                      onClick={() => respond.mutate({ id: i.id, action: "reject" }, { onSuccess: () => toast.success("ปฏิเสธคำเชิญแล้ว"), onError: (e) => toast.error(challengeErrorMessage(e)) })}
                      className="flex items-center justify-center gap-1 rounded-xl bg-primary-soft px-3 py-2 text-[11px] font-extrabold text-primary">
                      <X className="size-3.5" /> ปฏิเสธ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Link to="/challenges/history" className="card-soft mt-4 flex items-center gap-3 p-3">
        <History className="size-5 text-primary" />
        <span className="flex-1 text-sm font-extrabold">ประวัติ Challenge</span>
        <span className="text-[11px] font-bold text-muted-foreground">ดูทั้งหมด</span>
      </Link>

      {creating ? <ChallengeDialog open onClose={() => setCreating(false)} onSaved={open} /> : null}
    </AppScreen>
  );
}
