import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Loader2, Pencil, RefreshCw, Share2, Smartphone, Trash2, TriangleAlert, UserPlus, Keyboard, Check,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppScreen } from "@/components/BottomNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { PersonAvatar } from "@/components/PersonAvatar";
import { MetricArt } from "@/components/MetricArt";
import { ChallengeBoard } from "@/components/ChallengeBoard";
import { ChallengeDialog } from "@/components/ChallengeDialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import { useFriends } from "@/lib/friends";
import {
  BOARD_LABEL, PARTICIPATION_LABEL, SOURCE_LABEL, STATE_LABEL, TIMEZONE_LABEL,
  bkkDate, challengeErrorMessage, fmtDate, fmtDateTime, formatValue, metricInfo, pct,
  useBoard, useChallenge, useChallengeInvites, useChallengeRealtime, useDeleteChallenge,
  useDeleteManualEntry, useInviteFriends, useJoinChallenge, useManualEntries, useSaveManualEntry,
  useSeries, useSyncDevice, type ChallengeRow,
} from "@/lib/challenges";

export const Route = createFileRoute("/challenges/$challengeId")({
  head: () => ({
    meta: [
      { title: "รายละเอียดชาเลนจ์ | Healthy Panda" },
      { name: "description", content: "ความคืบหน้า อันดับ กราฟรายวัน และการอัปเดตข้อมูลจากอุปกรณ์หรือกรอกเอง" },
      { property: "og:title", content: "รายละเอียดชาเลนจ์ | Healthy Panda" },
      { property: "og:description", content: "ดูอันดับจากค่าจริงและชวนเพื่อนเข้าร่วมชาเลนจ์" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detail,
});

function Confirm({ title, body, ok, onOk, onCancel, danger }: { title: string; body: string; ok: string; onOk: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-background p-5">
        <h3 className="text-base font-extrabold">{title}</h3>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{body}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl bg-muted py-2.5 text-xs font-extrabold">ยกเลิก</button>
          <button onClick={onOk} className={`flex-1 rounded-2xl py-2.5 text-xs font-extrabold ${danger ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>{ok}</button>
        </div>
      </div>
    </div>
  );
}

function Detail() {
  const { challengeId } = Route.useParams();
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  useChallengeRealtime(signedIn);
  const q = useChallenge(signedIn ? challengeId : undefined);
  const c = q.data;
  const board = useBoard(c ? challengeId : undefined);

  if (!loading && !signedIn) return <AppScreen><SignInPrompt message="เข้าสู่ระบบเพื่อดูรายละเอียดชาเลนจ์" /></AppScreen>;
  if (q.isLoading || loading) return <AppScreen><div className="grid place-items-center p-16"><Loader2 className="size-6 animate-spin text-primary" /></div></AppScreen>;
  if (!c) {
    return (
      <AppScreen>
        <div className="card-soft mt-6 p-6 text-center">
          <p className="text-sm font-extrabold">ไม่พบชาเลนจ์ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
          <button onClick={() => navigate({ to: "/leaderboard" })} className="mt-3 rounded-2xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground">กลับหน้าชาเลนจ์</button>
        </div>
      </AppScreen>
    );
  }
  return <DetailBody c={c} profileId={profile?.id} board={board} />;
}

function DetailBody({ c, profileId, board }: { c: ChallengeRow; profileId?: string | undefined; board: ReturnType<typeof useBoard> }) {
  const navigate = useNavigate();
  const m = metricInfo(c.metric);
  const join = useJoinChallenge();
  const sync = useSyncDevice();
  const del = useDeleteChallenge();
  const series = useSeries(c.id, c.joined);
  const entries = useManualEntries(c.id, c.joined);
  const saveEntry = useSaveManualEntry();
  const delEntry = useDeleteManualEntry();
  const friends = useFriends(c.is_owner);
  const invites = useChallengeInvites(c.is_owner);
  const inviteFriends = useInviteFriends();

  const [confirm, setConfirm] = useState<null | "join" | "sync" | "delete" | "manual">(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [date, setDate] = useState(() => {
    const today = bkkDate(new Date());
    const s = bkkDate(c.start_at), e = bkkDate(c.end_at);
    return today < s ? s : today > e ? e : today;
  });
  const [value, setValue] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  const pctVal = pct(c.my_value, c.target_value);
  const conflicts = (series.data ?? []).filter((d) => d.device != null && d.manual != null);
  const chartData = useMemo(
    () => (series.data ?? []).map((d) => ({ d: d.d.slice(5).split("-").reverse().join("/"), v: Number(d.used) })),
    [series.data],
  );
  const days = Math.max(1, Math.ceil((new Date(c.end_at).getTime() - new Date(c.start_at).getTime()) / 86400000));
  const dailyTarget = Math.round((c.target_value / days) * 10) / 10;
  const myInvites = (invites.data ?? []).filter((i) => i.challenge_id === c.id && i.direction === "outgoing");
  const statusOf = (pid: string) => myInvites.find((i) => i.counterpart_id === pid)?.status;

  const err = (e: unknown) => toast.error(challengeErrorMessage(e));
  const copyCode = async () => { await navigator.clipboard.writeText(c.challenge_code); toast.success("คัดลอกรหัสแล้ว"); };
  const shareCode = async () => {
    const text = `ร่วมชาเลนจ์ "${c.title}" บน Healthy Panda ด้วยรหัส ${c.challenge_code}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
    else { await navigator.clipboard.writeText(text); toast.success("คัดลอกข้อความเชิญแล้ว"); }
  };

  const submitManual = (): void => {
    const v = Number(value);
    if (value.trim() === "" || !Number.isFinite(v)) { toast.error("กรุณากรอกค่า"); return; }
    if (v < 0) { toast.error("ค่าต้องไม่ติดลบ"); return; }
    if (v > m.max) { toast.error(`ค่าสูงสุดต่อวันคือ ${m.max.toLocaleString("th-TH")} ${m.unit}`); return; }
    if (!profileId) return;
    saveEntry.mutate({ id: editId, challengeId: c.id, profileId, date, value: v }, {
      onSuccess: () => { toast.success("บันทึกข้อมูลแล้ว"); setValue(""); setEditId(undefined); },
      onError: err,
    });
  };

  return (
    <AppScreen>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/leaderboard" })} className="rounded-xl bg-muted p-2" aria-label="ย้อนกลับ"><ArrowLeft className="size-4" /></button>
        <span className="flex-1 truncate text-sm font-extrabold">รายละเอียดชาเลนจ์</span>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-[10px] font-extrabold text-primary">{STATE_LABEL[c.state]}</span>
      </div>

      <section className="card-soft mb-3 p-4">
        <div className="flex gap-3">
          <MetricArt metric={c.metric} className="size-20" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold leading-tight">{c.title}</h1>
            <p className="text-[11px] font-bold text-primary">{m.label}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">โดย {c.is_owner ? "คุณ" : c.owner_name ?? "-"} • {c.participant_count} คน</p>
          </div>
        </div>
        {c.description ? <p className="mt-3 text-xs font-semibold text-muted-foreground">{c.description}</p> : null}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl bg-muted p-2"><dt className="font-bold text-muted-foreground">เริ่มต้น</dt><dd className="font-extrabold">{fmtDateTime(c.start_at)}</dd></div>
          <div className="rounded-2xl bg-muted p-2"><dt className="font-bold text-muted-foreground">สิ้นสุด</dt><dd className="font-extrabold">{fmtDateTime(c.end_at)}</dd></div>
          <div className="rounded-2xl bg-muted p-2"><dt className="font-bold text-muted-foreground">เป้าหมาย</dt><dd className="font-extrabold">{formatValue(c.target_value, c.metric)} {m.unit}</dd></div>
          <div className="rounded-2xl bg-muted p-2"><dt className="font-bold text-muted-foreground">อันดับ</dt><dd className="font-extrabold">{BOARD_LABEL[c.leaderboard_visibility]}</dd></div>
        </dl>
        <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{TIMEZONE_LABEL} • เข้าร่วมได้: {PARTICIPATION_LABEL[c.participation_visibility]}</p>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-primary/40 p-2">
          <span className="flex-1 text-center text-sm font-black tracking-widest text-primary">{c.challenge_code}</span>
          <button onClick={copyCode} className="rounded-xl bg-primary-soft p-2 text-primary" aria-label="คัดลอกรหัส"><Copy className="size-4" /></button>
          <button onClick={shareCode} className="rounded-xl bg-primary-soft p-2 text-primary" aria-label="แชร์รหัส"><Share2 className="size-4" /></button>
        </div>

        {!c.joined && c.state !== "ended" && c.state !== "cancelled" ? (
          <button onClick={() => setConfirm("join")} disabled={join.isPending} className="mt-3 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground">เข้าร่วม Challenge</button>
        ) : c.joined ? (
          <p className="mt-3 flex items-center justify-center gap-1 text-xs font-extrabold text-primary"><Check className="size-4" /> เข้าร่วมแล้ว</p>
        ) : null}
      </section>

      {c.joined ? (
        <section className="card-soft mb-3 p-4">
          <p className="text-xs font-extrabold text-muted-foreground">ความคืบหน้าของคุณ</p>
          <p className="mt-1 text-2xl font-black">{formatValue(c.my_value, c.metric)} <span className="text-sm font-bold text-muted-foreground">/ {formatValue(c.target_value, c.metric)} {m.unit}</span></p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, pctVal)}%` }} /></div>
          <p className="mt-1 text-right text-xs font-black text-primary">{pctVal}%</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            ข้อมูลล่าสุด: {c.last_synced_at ? fmtDateTime(c.last_synced_at) : "ยังไม่มีการอัปเดต"}
            {c.last_source ? ` • แหล่งข้อมูล: ${SOURCE_LABEL[c.last_source] ?? c.last_source}` : ""}
          </p>
          {c.state !== "cancelled" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm("sync")} disabled={sync.isPending} className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-[11px] font-extrabold text-primary-foreground disabled:opacity-60">
                {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />} ดึงข้อมูลล่าสุด
              </button>
              <button onClick={() => (manualOpen ? setManualOpen(false) : setConfirm("manual"))} className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary-soft py-2.5 text-[11px] font-extrabold text-primary">
                <Keyboard className="size-4" /> กรอกข้อมูลเอง
              </button>
            </div>
          ) : null}

          {conflicts.length ? (
            <div className="mt-3 flex gap-2 rounded-2xl bg-destructive/10 p-3 text-[11px] font-semibold text-destructive">
              <TriangleAlert className="size-4 shrink-0" />
              <span>มีข้อมูลทั้งจากอุปกรณ์และกรอกเองใน {conflicts.length} วัน ({conflicts.map((d) => fmtDate(d.d)).join(", ")}) อาจเกิดข้อมูลซ้ำ ระบบใช้ค่าจากอุปกรณ์เป็นหลักและไม่นำมารวมกัน</span>
            </div>
          ) : null}

          {manualOpen ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-border p-3">
              <p className="text-xs font-extrabold">{editId ? "แก้ไขรายการ" : "เพิ่มข้อมูล"}</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" min={bkkDate(c.start_at)} max={bkkDate(c.end_at)} value={date} onChange={(e) => setDate(e.target.value)} aria-label="วันที่" className="rounded-2xl border border-border bg-card px-3 py-2 text-sm font-semibold" />
                <div className="flex items-center rounded-2xl border border-border bg-card pr-3">
                  <input type="number" min={0} max={m.max} step={m.step} value={value} onChange={(e) => setValue(e.target.value)} aria-label={m.label} placeholder="0" className="w-full min-w-0 bg-transparent px-3 py-2 text-sm font-semibold outline-none" />
                  <span className="text-[11px] font-bold text-muted-foreground">{m.unit}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {editId ? <button onClick={() => { setEditId(undefined); setValue(""); }} className="flex-1 rounded-2xl bg-muted py-2 text-[11px] font-extrabold">ยกเลิกแก้ไข</button> : null}
                <button onClick={submitManual} disabled={saveEntry.isPending} className="flex-1 rounded-2xl bg-primary py-2 text-[11px] font-extrabold text-primary-foreground">บันทึก</button>
              </div>
              {(entries.data ?? []).length ? (
                <ul className="divide-y divide-border">
                  {(entries.data ?? []).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-xs">
                      <span className="flex-1 font-bold">{fmtDate(e.data_date)}</span>
                      <span className="font-black">{formatValue(e.value, c.metric)} {m.unit}</span>
                      <button onClick={() => { setEditId(e.id); setDate(e.data_date); setValue(String(e.value)); }} aria-label="แก้ไข" className="rounded-lg bg-muted p-1.5"><Pencil className="size-3.5" /></button>
                      <button onClick={() => { if (window.confirm("ลบรายการนี้หรือไม่?")) delEntry.mutate(e.id, { onSuccess: () => toast.success("ลบรายการแล้ว"), onError: err }); }} aria-label="ลบ" className="rounded-lg bg-muted p-1.5 text-destructive"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[11px] font-semibold text-muted-foreground">ยังไม่มีรายการที่กรอกเอง</p>}
            </div>
          ) : null}
        </section>
      ) : null}

      {c.joined ? (
        <section className="card-soft mb-3 p-4">
          <p className="mb-2 text-xs font-extrabold">กราฟ{m.label}รายวัน</p>
          {chartData.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${formatValue(v, c.metric)} ${m.unit}`, m.label]} />
                  <ReferenceLine y={dailyTarget} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted p-4 text-center">
              <p className="text-xs font-extrabold">ยังไม่มีข้อมูลสุขภาพ</p>
              <p className="text-[11px] font-semibold text-muted-foreground">เชื่อมต่ออุปกรณ์สุขภาพเพื่ออัปเดตข้อมูลอัตโนมัติ หรือกรอกข้อมูลด้วยตนเอง</p>
            </div>
          )}
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">เส้นประ = เป้าหมายเฉลี่ยต่อวัน {formatValue(dailyTarget, c.metric)} {m.unit}/วัน (ใช้ดูความคืบหน้าเท่านั้น)</p>
        </section>
      ) : null}

      <section className="card-soft mb-3 p-4">
        <p className="text-xs font-extrabold">วิธีคำนวณ</p>
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          ระบบรวม{m.label}จากข้อมูลสุขภาพของคุณเฉพาะในช่วง {fmtDateTime(c.start_at)} ถึง {fmtDateTime(c.end_at)} ไม่รวมข้อมูลก่อนเริ่มหรือหลังสิ้นสุด
        </p>
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">การจัดอันดับ: ผู้ที่มี{m.label}สะสมมากกว่าจะอยู่อันดับสูงกว่า ไม่มีการแปลงเป็นคะแนน</p>
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">หากวันเดียวกันมีทั้งข้อมูลจากอุปกรณ์และกรอกเอง ระบบใช้ข้อมูลจากอุปกรณ์เป็นหลัก เพื่อไม่ให้นับซ้ำ</p>
      </section>

      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold">ตารางอันดับ</h2>
          <button onClick={() => board.refetch()} className="flex items-center gap-1 text-[11px] font-extrabold text-primary">
            <RefreshCw className={`size-3.5 ${board.isFetching ? "animate-spin" : ""}`} /> อัปเดตข้อมูลล่าสุด
          </button>
        </div>
        {board.isLoading ? <div className="card-soft grid place-items-center p-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
          : <ChallengeBoard rows={board.data ?? []} metric={c.metric} target={c.target_value} />}
      </section>

      {c.is_owner ? (
        <section className="card-soft mb-3 p-4">
          <p className="mb-2 text-xs font-extrabold">จัดการชาเลนจ์</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setInviteOpen((v) => !v)} className="flex flex-col items-center gap-1 rounded-2xl bg-primary-soft py-2.5 text-[11px] font-extrabold text-primary"><UserPlus className="size-4" />ชวนเพื่อน</button>
            <button onClick={() => setEditing(true)} className="flex flex-col items-center gap-1 rounded-2xl bg-muted py-2.5 text-[11px] font-extrabold"><Pencil className="size-4" />แก้ไข</button>
            <button onClick={() => setConfirm("delete")} className="flex flex-col items-center gap-1 rounded-2xl bg-destructive/10 py-2.5 text-[11px] font-extrabold text-destructive"><Trash2 className="size-4" />ลบ</button>
          </div>
          {inviteOpen ? (
            <div className="mt-3">
              {(friends.data ?? []).length === 0 ? (
                <p className="text-[11px] font-semibold text-muted-foreground">ยังไม่มีเพื่อน ส่งรหัส {c.challenge_code} ให้คนที่ต้องการชวนได้เลย</p>
              ) : (
                <ul className="space-y-1">
                  {(friends.data ?? []).map((f) => {
                    const st = statusOf(f.profile_id);
                    const disabled = !!st && st !== "rejected" && st !== "cancelled";
                    return (
                      <li key={f.profile_id}>
                        <label className="flex items-center gap-2 rounded-2xl p-2 hover:bg-muted">
                          <input type="checkbox" disabled={disabled} checked={picked.includes(f.profile_id)}
                            onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.profile_id] : p.filter((x) => x !== f.profile_id)))} />
                          <PersonAvatar pictureUrl={f.picture_url} name={f.display_name} className="size-8" />
                          <span className="flex-1 truncate text-xs font-bold">{f.display_name}</span>
                          {st === "pending" ? <span className="text-[10px] font-bold text-primary">ส่งแล้ว • รอเข้าร่วม</span>
                            : st === "accepted" ? <span className="text-[10px] font-bold text-primary">เข้าร่วมแล้ว</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {picked.length ? (
                <button disabled={inviteFriends.isPending}
                  onClick={() => inviteFriends.mutate({ challengeId: c.id, friendIds: picked }, { onSuccess: () => { toast.success("ส่งคำเชิญแล้ว"); setPicked([]); }, onError: err })}
                  className="mt-2 w-full rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground">ส่งคำเชิญ ({picked.length})</button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {confirm === "join" ? (
        <Confirm title={`เข้าร่วม "${c.title}"?`} body={`เป้าหมาย ${formatValue(c.target_value, c.metric)} ${m.unit} • ${fmtDate(c.start_at)} – ${fmtDate(c.end_at)} • ผู้เข้าร่วม ${c.participant_count} คน`} ok="เข้าร่วม Challenge"
          onCancel={() => setConfirm(null)} onOk={() => { setConfirm(null); join.mutate(c.id, { onSuccess: () => toast.success("เข้าร่วมชาเลนจ์แล้ว"), onError: err }); }} />
      ) : null}
      {confirm === "sync" ? (
        <Confirm title="อัปเดตข้อมูลจากอุปกรณ์สุขภาพ?" body="ระบบจะดึงข้อมูลสุขภาพที่มีอยู่จากอุปกรณ์ที่เชื่อมต่อ และนำข้อมูลในช่วงเวลาของ Challenge มาคำนวณใหม่" ok="ดึงข้อมูล"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            setConfirm(null);
            sync.mutate(c.id, {
              onSuccess: (r) => {
                if (!r.has_device) toast.error("ยังไม่ได้เชื่อมต่ออุปกรณ์สุขภาพ เชื่อมต่อได้ที่หน้าบัญชี");
                else if (!r.days) toast.message("ยังไม่พบข้อมูลจากอุปกรณ์ในช่วงเวลานี้");
                else toast.success(`อัปเดตแล้ว ${r.days} วัน`);
              },
              onError: err,
            });
          }} />
      ) : null}
      {confirm === "manual" ? (
        <Confirm title="กรอกข้อมูลเอง" body="การกรอกข้อมูลด้วยตนเองควรใช้ข้อมูลตามจริง เพื่อให้ผลการแข่งขันมีความถูกต้องและเป็นธรรม" ok="รับทราบ"
          onCancel={() => setConfirm(null)} onOk={() => { setConfirm(null); setManualOpen(true); }} />
      ) : null}
      {confirm === "delete" ? (
        <Confirm danger title="ลบ Challenge นี้หรือไม่?" body="ข้อมูล Challenge, รายการเข้าร่วม และประวัติที่เกี่ยวข้องจะถูกลบออกจากมุมมองของคุณ ข้อมูลสุขภาพต้นทางจะไม่ถูกลบ" ok="ลบ Challenge"
          onCancel={() => setConfirm(null)}
          onOk={() => { setConfirm(null); del.mutate(c.id, { onSuccess: () => { toast.success("ลบชาเลนจ์แล้ว"); navigate({ to: "/leaderboard" }); }, onError: err }); }} />
      ) : null}
      {editing ? <ChallengeDialog open editing={c} onClose={() => setEditing(false)} /> : null}
    </AppScreen>
  );
}
