import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Loader2,
  LogOut,
  Medal,
  Share2,
  Trash2,
  Trophy,
  UserPlus,
} from "lucide-react";
import { AppScreen } from "@/components/BottomNav";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useFriends } from "@/lib/friends";
import {
  BOARD_LABEL,
  CATEGORY_LABEL,
  GOAL_MODE_LABEL,
  METRIC_LABEL,
  METRIC_SOURCE_LABEL,
  PARTICIPATION_LABEL,
  SCORING_LABEL,
  STATUS_LABEL,
  TARGET_SOURCE_LABEL,
  challengeErrorMessage,
  challengeStatus,
  daysLeft,
  goalText,
  metricUnit,
  progressTarget,
  progressUnit,
  scoringExplanation,
  useChallengeDetail,
  useChallengeRealtime,
  useDeleteChallenge,
  useInviteFriend,
  useJoinChallenge,
  useLeaderboard,
  useLeaveChallenge,
  useSetChallengeStatus,
  useSyncProgress,
} from "@/lib/challenges";

export const Route = createFileRoute("/challenges/$challengeId")({
  head: () => ({
    meta: [
      { title: "รายละเอียดชาเลนจ์ | Healthy Panda" },
      {
        name: "description",
        content: "ดูกติกา เป้าหมาย ผู้เข้าร่วม และตารางอันดับจริงของชาเลนจ์สุขภาพนี้",
      },
      { property: "og:title", content: "รายละเอียดชาเลนจ์ | Healthy Panda" },
      {
        property: "og:description",
        content: "เข้าร่วมชาเลนจ์ เชิญเพื่อน และแข่งอันดับด้วยข้อมูลกิจกรรมจริง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChallengeDetail,
});

const numberTH = (n: number) =>
  Math.round(Number(n)).toLocaleString("th-TH", { maximumFractionDigits: 0 });

function ChallengeDetail() {
  const { challengeId } = Route.useParams();
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();

  useSyncProgress(signedIn);
  useChallengeRealtime(signedIn);

  const detail = useChallengeDetail(signedIn ? challengeId : undefined);
  const friends = useFriends(signedIn);
  const board = useLeaderboard(signedIn ? challengeId : undefined, false);
  const join = useJoinChallenge();
  const leave = useLeaveChallenge();
  const remove = useDeleteChallenge();
  const invite = useInviteFriend();
  const setStatus = useSetChallengeStatus();
  const [inviting, setInviting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  if (!loading && !signedIn) {
    return (
      <AppScreen>
        <SignInPrompt message="เข้าสู่ระบบเพื่อดูรายละเอียดชาเลนจ์นี้" />
      </AppScreen>
    );
  }

  const c = detail.data;
  const target = c ? progressTarget(c) : 0;
  const pct = c && target ? Math.min(Math.round((c.my_progress / target) * 100), 100) : 0;
  const left = c ? daysLeft(c.end_date) : 0;
  const status = c ? challengeStatus(c) : null;

  const share = async () => {
    if (!c) return;
    const text = `เข้าร่วมชาเลนจ์ "${c.title}" ด้วยรหัส ${c.challenge_code} ใน Healthy Panda`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: c.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("คัดลอกคำเชิญแล้ว");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <AppScreen>
      <button
        onClick={() => navigate({ to: "/leaderboard" })}
        className="mb-3 flex items-center gap-1.5 text-xs font-extrabold text-primary"
      >
        <ArrowLeft className="size-4" /> กลับ
      </button>

      {detail.isLoading ? (
        <Info>
          <Loader2 className="size-4 animate-spin" /> กำลังโหลด...
        </Info>
      ) : detail.isError ? (
        <Info>ไม่สามารถโหลดชาเลนจ์นี้ได้</Info>
      ) : !c ? (
        <Info>ไม่พบชาเลนจ์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง</Info>
      ) : (
        <>
          <section className="card-soft p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Trophy className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold">{c.title}</p>
                {c.description ? (
                  <p className="text-xs font-semibold text-muted-foreground">{c.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] font-bold text-primary">
                  {CATEGORY_LABEL[c.category]} • {METRIC_LABEL[c.metric] ?? c.metric} •{" "}
                  {GOAL_MODE_LABEL[c.goal_mode]}
                </p>
              </div>
              {status ? (
                <span className="rounded-xl bg-primary-soft px-2 py-1 text-[10px] font-black text-primary">
                  {STATUS_LABEL[c.effective_status] ?? status.label}
                </span>
              ) : null}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
              <Row label="เป้าหมาย" value={goalText(c)} />
              <Row label="รูปแบบเป้าหมาย" value={GOAL_MODE_LABEL[c.goal_mode]} />
              <Row
                label="ช่วงเวลา"
                value={`${new Date(c.start_date).toLocaleDateString("th-TH")} – ${new Date(
                  c.end_date,
                ).toLocaleDateString("th-TH")}`}
              />
              <Row label="ผู้เข้าร่วม" value={`${c.participant_count} คน`} />
              <Row label="คะแนนสูงสุด" value={`${numberTH(c.max_score)} คะแนน`} />
              <Row label="แหล่งเป้าหมาย" value={TARGET_SOURCE_LABEL[c.target_source]} />
              <Row label="เข้าร่วมได้" value={PARTICIPATION_LABEL[c.participation_visibility]} />
              <Row label="ดูอันดับได้" value={BOARD_LABEL[c.leaderboard_visibility]} />
              <Row label="ผู้สร้าง" value={c.owner_name ?? "ระบบ"} />
              <Row label="สถานะ" value={STATUS_LABEL[c.effective_status] ?? "-"} />
              <Row
                label="เวลาที่เหลือ"
                value={left > 0 ? `เหลืออีก ${left} วัน` : "หมดเวลาแล้ว"}
              />
              <Row label="คะแนนรางวัล" value={`+${c.reward_points} แต้ม`} />
            </dl>

            <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              <Clock className="size-3.5" /> ความคืบหน้าคำนวณอัตโนมัติจากกิจกรรมจริงของคุณ
            </p>

            <button
              onClick={() => {
                navigator.clipboard.writeText(c.challenge_code);
                toast.success("คัดลอกรหัสชาเลนจ์แล้ว");
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft py-2.5 text-xs font-extrabold text-primary"
            >
              <Copy className="size-4" /> รหัสชาเลนจ์ {c.challenge_code}
            </button>
          </section>

          <section className="card-soft mt-3 p-4">
            <p className="text-xs font-extrabold">วิธีคำนวณคะแนน</p>
            <p className="mt-1 text-[11px] font-bold text-primary">
              {SCORING_LABEL[c.scoring_type]}
            </p>
            <ul className="mt-2 space-y-1">
              {scoringExplanation(c).map((line) => (
                <li key={line} className="text-[11px] font-semibold text-muted-foreground">
                  • {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-extrabold">ข้อมูลที่ใช้ในการคำนวณ</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              {METRIC_LABEL[c.metric] ?? c.metric} —{" "}
              {METRIC_SOURCE_LABEL[c.metric] ?? "ข้อมูลสุขภาพที่บันทึกไว้ในระบบ"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              ตารางอันดับแสดงเฉพาะชื่อ รูปโปรไฟล์ คะแนน และความคืบหน้า ไม่เปิดเผยข้อมูลสุขภาพอื่น
            </p>
          </section>

          {c.joined ? (
            <section className="card-soft mt-3 p-4">
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
              <p className="mt-2 text-[11px] font-black text-primary">
                {numberTH(c.my_score)} / {numberTH(c.max_score)} คะแนน
              </p>
              {c.my_progress <= 0 ? (
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                  ยังไม่มีข้อมูลสุขภาพสำหรับคำนวณความคืบหน้า —
                  เชื่อมต่ออุปกรณ์สุขภาพหรือบันทึกกิจกรรมก่อน
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {c.joined ? (
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-success-soft py-2.5 text-xs font-extrabold text-success">
                <Check className="size-4" /> เข้าร่วมแล้ว
              </span>
            ) : (
              <button
                disabled={join.isPending || left <= 0}
                onClick={() =>
                  join.mutate(c.id, {
                    onSuccess: () => toast.success("เข้าร่วมชาเลนจ์แล้ว!"),
                    onError: (e) => toast.error(challengeErrorMessage(e)),
                  })
                }
                className="flex-1 rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {left <= 0 ? "หมดเวลาแล้ว" : "เข้าร่วมชาเลนจ์"}
              </button>
            )}
            <button
              onClick={share}
              className="rounded-2xl bg-primary-soft px-3 py-2.5 text-xs font-extrabold text-primary"
            >
              <Share2 className="size-4" />
            </button>
            {c.is_owner ? (
              <button
                onClick={() => setInviting((v) => !v)}
                className="flex items-center gap-1.5 rounded-2xl bg-primary-soft px-3 py-2.5 text-xs font-extrabold text-primary"
              >
                <UserPlus className="size-4" /> เชิญเพื่อน
              </button>
            ) : null}
            {c.joined && !c.is_owner ? (
              <button
                onClick={() =>
                  leave.mutate(c.id, {
                    onSuccess: () => toast.success("ออกจากชาเลนจ์แล้ว"),
                    onError: (e) => toast.error(challengeErrorMessage(e)),
                  })
                }
                className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5 text-xs font-extrabold text-muted-foreground"
              >
                <LogOut className="size-4" /> ออก
              </button>
            ) : null}
            {c.is_owner ? (
              <button
                onClick={() => {
                  if (!confirm("ลบชาเลนจ์นี้ถาวรหรือไม่?")) return;
                  remove.mutate(c.id, {
                    onSuccess: () => {
                      toast.success("ลบชาเลนจ์แล้ว");
                      navigate({ to: "/leaderboard" });
                    },
                    onError: (e) => toast.error(challengeErrorMessage(e)),
                  });
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-destructive/10 px-3 py-2.5 text-xs font-extrabold text-destructive"
              >
                <Trash2 className="size-4" /> ลบ
              </button>
            ) : null}
          </div>

          {c.is_owner ? (
            <div className="mt-2 flex gap-2">
              <button
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate(
                    { id: c.id, status: c.status === "closed" ? "open" : "closed" },
                    {
                      onSuccess: () =>
                        toast.success(c.status === "closed" ? "เปิดรับสมาชิกแล้ว" : "ปิดรับสมาชิกแล้ว"),
                      onError: (e) => toast.error(challengeErrorMessage(e)),
                    },
                  )
                }
                className="flex-1 rounded-2xl bg-primary-soft py-2.5 text-xs font-extrabold text-primary disabled:opacity-60"
              >
                {c.status === "closed" ? "เปิดรับสมาชิกอีกครั้ง" : "ปิดรับสมาชิก"}
              </button>
              {c.status !== "cancelled" ? (
                <button
                  disabled={setStatus.isPending}
                  onClick={() => {
                    if (!confirm("ยกเลิกชาเลนจ์นี้หรือไม่?")) return;
                    setStatus.mutate(
                      { id: c.id, status: "cancelled" },
                      {
                        onSuccess: () => toast.success("ยกเลิกชาเลนจ์แล้ว"),
                        onError: (e) => toast.error(challengeErrorMessage(e)),
                      },
                    );
                  }}
                  className="flex-1 rounded-2xl bg-muted py-2.5 text-xs font-extrabold text-muted-foreground disabled:opacity-60"
                >
                  ยกเลิกชาเลนจ์
                </button>
              ) : null}
            </div>
          ) : null}

          {inviting && c.is_owner ? (
            <section className="card-soft mt-3 p-4">
              <p className="mb-2 text-xs font-extrabold">เชิญเพื่อนเข้าร่วม</p>
              {friends.isLoading ? (
                <p className="text-[11px] font-bold text-muted-foreground">กำลังโหลดรายชื่อเพื่อน...</p>
              ) : (friends.data ?? []).length === 0 ? (
                <p className="text-[11px] font-bold text-muted-foreground">
                  คุณยังไม่มีเพื่อน — เพิ่มเพื่อนด้วยรหัสเพื่อนก่อน
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {(friends.data ?? []).map((f) => (
                      <li key={f.profile_id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`inv-${f.profile_id}`}
                          checked={picked.includes(f.profile_id)}
                          onChange={(e) =>
                            setPicked((prev) =>
                              e.target.checked
                                ? [...prev, f.profile_id]
                                : prev.filter((id) => id !== f.profile_id),
                            )
                          }
                          className="size-4 accent-[hsl(var(--primary))]"
                        />
                        <PersonAvatar
                          pictureUrl={f.picture_url}
                          name={f.display_name}
                          className="size-9"
                        />
                        <label
                          htmlFor={`inv-${f.profile_id}`}
                          className="min-w-0 flex-1 truncate text-xs font-extrabold"
                        >
                          {f.display_name}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={invite.isPending || picked.length === 0}
                    onClick={async () => {
                      let ok = 0;
                      let failed = 0;
                      for (const friendProfileId of picked) {
                        try {
                          await invite.mutateAsync({ challengeId: c.id, friendProfileId });
                          ok += 1;
                        } catch {
                          failed += 1;
                        }
                      }
                      setPicked([]);
                      if (ok) toast.success(`ส่งคำเชิญแล้ว ${ok} คน`);
                      if (failed) toast.error(`ส่งไม่สำเร็จ ${failed} คน`);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-60"
                  >
                    {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    ส่งคำเชิญ {picked.length ? `(${picked.length})` : ""}
                  </button>
                </>
              )}
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                เพื่อนที่ได้รับคำเชิญต้องกดเข้าร่วมเองจากหน้ารายละเอียดชาเลนจ์
              </p>
            </section>
          ) : null}

          <h2 className="mt-5 mb-2 px-1 text-sm font-extrabold">ตารางอันดับ</h2>
          {board.isLoading ? (
            <Info>
              <Loader2 className="size-4 animate-spin" /> กำลังโหลดอันดับ...
            </Info>
          ) : board.isError ? (
            <Info>คุณไม่มีสิทธิ์ดูตารางอันดับของชาเลนจ์นี้</Info>
          ) : (board.data ?? []).length === 0 ? (
            <Info>ยังไม่มีผู้เข้าร่วมที่แชร์ข้อมูลในชาเลนจ์นี้</Info>
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
                      {numberTH(Number(row.progress))} {progressUnit(c) || metricUnit(c)}
                      {row.completed ? " • สำเร็จแล้ว" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </AppScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2">
      <dt className="text-[10px] font-bold text-muted-foreground">{label}</dt>
      <dd className="font-extrabold">{value}</dd>
    </div>
  );
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <p className="card-soft flex items-center justify-center gap-2 p-6 text-center text-xs font-bold text-muted-foreground">
      {children}
    </p>
  );
}
