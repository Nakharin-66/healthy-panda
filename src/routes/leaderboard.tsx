import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ChallengeDialog } from "@/components/ChallengeDialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/db";
import { useResolvedAvatar } from "@/lib/avatar";
import { useFriendRealtime, useFriendSummary } from "@/lib/friends";
import {
  CATEGORY_LABEL,
  METRIC_LABEL,
  challengeErrorMessage,
  challengeStatus,
  daysLeft,
  goalText,
  progressTarget,
  progressUnit,
  useChallengeInvites,
  useChallengeRealtime,
  useJoinChallenge,
  useLeaderboard,
  useLookupChallengeCode,
  useRespondChallengeInvite,
  useSyncProgress,
  useVisibleChallenges,
  type ChallengeView,
} from "@/lib/challenges";
import {
  Trophy,
  Check,
  Loader2,
  Users,
  Medal,
  Clock,
  Plus,
  Search,
  Mail,
  X,
} from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "ชาเลนจ์ & ตารางอันดับ | Healthy Panda" },
      {
        name: "description",
        content: "สร้างชาเลนจ์ของคุณเอง เข้าร่วมด้วยรหัสชาเลนจ์ และเทียบอันดับกับเพื่อนแบบเรียลไทม์",
      },
      { property: "og:title", content: "ชาเลนจ์ & ตารางอันดับ | Healthy Panda" },
      {
        property: "og:description",
        content: "ตารางอันดับ Healthy Panda คำนวณจากข้อมูลกิจกรรมจริงของผู้ใช้",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

const numberTH = (n: number) =>
  Math.round(Number(n)).toLocaleString("th-TH", { maximumFractionDigits: 0 });

function Leaderboard() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const myAvatar = useResolvedAvatar(profile?.picture_url);

  useFriendRealtime(signedIn);
  useChallengeRealtime(signedIn);
  useSyncProgress(signedIn && !!profile?.id);

  const challenges = useVisibleChallenges(signedIn);
  const invites = useChallengeInvites(signedIn);
  const summary = useFriendSummary(signedIn);
  const join = useJoinChallenge();
  const lookup = useLookupChallengeCode();
  const respondInvite = useRespondChallengeInvite();

  const [tab, setTab] = useState<"challenges" | "ranking">("challenges");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<ChallengeView | null>(null);

  const list = challenges.data ?? [];
  useEffect(() => {
    if (!selected && list.length) setSelected(list[0]!.id);
  }, [list, selected]);

  const board = useLeaderboard(signedIn ? selected : undefined, friendsOnly);
  const current = list.find((c) => c.id === selected);
  const pendingInvites = (invites.data ?? []).filter(
    (i) => i.status === "pending" && i.direction === "incoming",
  );

  const openDetail = (id: string) =>
    navigate({ to: "/challenges/$challengeId", params: { challengeId: id } });

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
        <button
          onClick={() => setCreating(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-extrabold text-primary-foreground active:scale-[0.98]"
        >
          <Plus className="size-4" /> สร้างชาเลนจ์
        </button>
        <button
          onClick={() => navigate({ to: "/friends" })}
          className="flex items-center gap-1.5 rounded-2xl bg-primary-soft px-4 py-3 text-xs font-extrabold text-primary"
        >
          <Users className="size-4" /> เพื่อน
          {summary.data?.pending_incoming ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">
              {summary.data.pending_incoming}
            </span>
          ) : null}
        </button>
      </div>

      <section className="card-soft mb-3 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-muted-foreground">
          เข้าร่วมด้วยรหัสชาเลนจ์
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CH-XXXXX"
            aria-label="รหัสชาเลนจ์"
            className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm font-extrabold tracking-wider outline-none focus:border-primary"
          />
          <button
            disabled={lookup.isPending || code.trim().length < 4}
            onClick={() =>
              lookup.mutate(code.trim(), {
                onSuccess: (row) => {
                  setFound(row);
                  if (!row) toast.error("ไม่พบรหัสชาเลนจ์นี้");
                },
                onError: (e) => toast.error(challengeErrorMessage(e)),
              })
            }
            className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {lookup.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            ค้นหา
          </button>
        </div>
        {found ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary-soft p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold">{found.title}</p>
              <p className="text-[11px] font-bold text-muted-foreground">{goalText(found)}</p>
            </div>
            <button
              onClick={() => openDetail(found.id)}
              className="rounded-xl bg-primary px-3 py-1.5 text-[10px] font-extrabold text-primary-foreground"
            >
              ดูรายละเอียด
            </button>
            <button onClick={() => setFound(null)} aria-label="ปิดผลการค้นหา">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
        ) : null}
      </section>

      {pendingInvites.length ? (
        <section className="card-soft mb-3 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-primary">
            <Mail className="size-4" /> คำเชิญเข้าร่วมชาเลนจ์ ({pendingInvites.length})
          </p>
          <ul className="space-y-2">
            {pendingInvites.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <PersonAvatar
                  pictureUrl={i.counterpart_picture}
                  name={i.counterpart_name}
                  className="size-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold">{i.challenge_title}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    จาก {i.counterpart_name}
                  </p>
                </div>
                <button
                  onClick={() => openDetail(i.challenge_id)}
                  className="rounded-xl bg-primary px-3 py-1.5 text-[10px] font-extrabold text-primary-foreground"
                >
                  ดูและเข้าร่วม
                </button>
                <button
                  onClick={() =>
                    respondInvite.mutate(
                      { id: i.id, action: "reject" },
                      {
                        onSuccess: () => toast.success("ปฏิเสธคำเชิญแล้ว"),
                        onError: (e) => toast.error(challengeErrorMessage(e)),
                      },
                    )
                  }
                  className="rounded-xl bg-muted px-2.5 py-1.5 text-[10px] font-extrabold text-muted-foreground"
                >
                  ปฏิเสธ
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-4 flex gap-2">
        {(
          [
            ["challenges", "ชาเลนจ์"],
            ["ranking", "ตารางอันดับ"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-2xl py-2.5 text-xs font-extrabold ${
              tab === k ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "challenges" ? (
        challenges.isLoading ? (
          <Info>
            <Loader2 className="size-4 animate-spin" /> กำลังโหลดชาเลนจ์...
          </Info>
        ) : challenges.isError ? (
          <Info>ไม่สามารถโหลดชาเลนจ์ได้</Info>
        ) : list.length === 0 ? (
          <Info>ยังไม่มีชาเลนจ์ — กด “สร้างชาเลนจ์” เพื่อเริ่มชาเลนจ์แรกของคุณ</Info>
        ) : (
          <section className="space-y-2.5">
            {list.map((c) => {
              const status = challengeStatus(c);
              const target = progressTarget(c);
              const pct = target ? Math.min(Math.round((c.my_progress / target) * 100), 100) : 0;
              const left = daysLeft(c.end_date);
              return (
                <div key={c.id} className="card-soft p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <Trophy className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold">{c.title}</p>
                      {c.description ? (
                        <p className="text-xs font-semibold text-muted-foreground">
                          {c.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] font-bold text-primary">
                        {CATEGORY_LABEL[c.category]} • {METRIC_LABEL[c.metric] ?? c.metric} •{" "}
                        {goalText(c)} • +{c.reward_points} แต้ม
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                        <Clock className="size-3.5" />
                        {left > 0 ? `เหลืออีก ${left} วัน` : "หมดเวลาแล้ว"} • ถึง{" "}
                        {new Date(c.end_date).toLocaleDateString("th-TH")} • {c.participant_count} คน
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                        รหัส {c.challenge_code}
                        {c.is_owner ? " • คุณเป็นผู้สร้าง" : ""}
                        {c.invited && !c.joined ? " • คุณได้รับคำเชิญ" : ""}
                      </p>
                    </div>
                  </div>

                  {c.joined ? (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-extrabold text-muted-foreground">
                        <span>ความคืบหน้าของคุณ</span>
                        <span>
                          {numberTH(c.my_progress)} / {numberTH(target)} {progressUnit(c)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={c.joined || join.isPending || status.key === "expired"}
                      onClick={() =>
                        join.mutate(c.id, {
                          onSuccess: () => toast.success("เข้าร่วมชาเลนจ์แล้ว!"),
                          onError: (e) => toast.error(challengeErrorMessage(e)),
                        })
                      }
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold ${
                        c.joined
                          ? "bg-success-soft text-success"
                          : "bg-primary text-primary-foreground active:scale-[0.98] disabled:opacity-60"
                      }`}
                    >
                      {c.joined ? (
                        <>
                          <Check className="size-4" /> {status.label}
                        </>
                      ) : status.key === "expired" ? (
                        "หมดเวลาแล้ว"
                      ) : (
                        "เข้าร่วมชาเลนจ์"
                      )}
                    </button>
                    <button
                      onClick={() => openDetail(c.id)}
                      className="rounded-2xl bg-primary-soft px-3 py-2.5 text-xs font-extrabold text-primary"
                    >
                      รายละเอียด
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )
      ) : (
        <>
          {list.length ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-[11px] font-extrabold ${
                    selected === c.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex gap-2">
            {(
              [
                [false, "ทุกคน"],
                [true, "เฉพาะเพื่อน"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                onClick={() => setFriendsOnly(v)}
                className={`flex-1 rounded-2xl py-2 text-[11px] font-extrabold ${
                  friendsOnly === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary-soft text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!selected ? (
            <Info>ยังไม่มีชาเลนจ์ให้จัดอันดับ</Info>
          ) : board.isLoading ? (
            <Info>
              <Loader2 className="size-4 animate-spin" /> กำลังโหลดอันดับ...
            </Info>
          ) : board.isError ? (
            <Info>คุณไม่มีสิทธิ์ดูตารางอันดับของชาเลนจ์นี้</Info>
          ) : (board.data ?? []).length === 0 ? (
            <Info>
              ยังไม่มีผู้เข้าร่วมที่แชร์ข้อมูลในชาเลนจ์นี้ — เข้าร่วมชาเลนจ์หรือเพิ่มเพื่อนเพื่อเริ่มแข่งกัน
            </Info>
          ) : (
            <section className="space-y-2">
              {(board.data ?? []).map((row, i) => (
                <div
                  key={row.profile_id}
                  className={`card-soft flex items-center gap-3 p-3 ${
                    row.is_self ? "ring-2 ring-primary/50" : ""
                  }`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-black text-primary">
                    {i < 3 ? <Medal className="size-4" /> : i + 1}
                  </span>
                  <PersonAvatar
                    pictureUrl={row.picture_url}
                    name={row.display_name}
                    className="size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {row.display_name}
                      {row.is_self ? (
                        <span className="ml-1 text-[10px] font-black text-primary">คุณ</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {numberTH(Number(row.progress))} {current ? progressUnit(current) : ""}
                      {row.completed ? " • สำเร็จแล้ว" : ""}
                    </p>
                  </div>
                  {!row.is_self && row.is_friend ? (
                    <button
                      onClick={() =>
                        navigate({
                          to: "/friends/$profileId",
                          params: { profileId: row.profile_id },
                        })
                      }
                      className="rounded-xl bg-primary-soft px-2.5 py-1.5 text-[10px] font-extrabold text-primary"
                    >
                      โปรไฟล์
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          )}

          <p className="mt-4 px-1 text-[11px] font-semibold text-muted-foreground">
            อันดับคำนวณจากข้อมูลกิจกรรมจริงของผู้ใช้ และแสดงเฉพาะผู้ที่ตั้งค่าความเป็นส่วนตัวให้แชร์ได้
          </p>
        </>
      )}

      <ChallengeDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => openDetail(id)}
      />
    </AppScreen>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <p className="card-soft flex items-center justify-center gap-2 p-6 text-center text-xs font-bold text-muted-foreground">
      {children}
    </p>
  );
}
