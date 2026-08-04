import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppScreen } from "@/components/BottomNav";
import { PandaHeader } from "@/components/PandaHeader";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/hooks/useAuth";
import {
  useProfile,
  useChallenges,
  useMyChallengeProgress,
  useJoinChallenge,
  useWeekExercise,
} from "@/lib/db";
import avatar from "@/assets/panda-avatar.png";
import { Trophy, Flame, Check } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "ท้าทาย AI & ตารางอันดับ | Healthy Panda" },
      {
        name: "description",
        content: "แข่งเดินและเผาผลาญแคลอรีกับเพื่อนในชุมชน ลุ้นเข็มกลัดแพนด้าและถ้วยรางวัล",
      },
      { property: "og:title", content: "ท้าทาย AI & ตารางอันดับ | Healthy Panda" },
      {
        property: "og:description",
        content: "ตารางอันดับชุมชน Healthy Panda พร้อมความท้าทายรายสัปดาห์",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

const podium = [
  { rank: 2, name: "ก้อง", steps: "12,908", h: "h-20" },
  { rank: 1, name: "มินท์", steps: "15,240", h: "h-28" },
  { rank: 3, name: "พีช", steps: "11,455", h: "h-14" },
];

function Leaderboard() {
  const { signedIn, loading } = useAuth();
  const { data: profile } = useProfile();
  const { data: challenges } = useChallenges();
  const { data: joined } = useMyChallengeProgress(profile?.id);
  const { data: week } = useWeekExercise(profile?.id);
  const join = useJoinChallenge(profile?.id);
  const [tab, setTab] = useState<"challenges" | "ranking">("challenges");

  const burned = week?.calories ?? 0;
  const target = 2000;
  const pct = Math.min(Math.round((burned / target) * 100), 100);

  return (
    <AppScreen>
      <PandaHeader
        title="ท้าทายสัปดาห์นี้"
        subtitle="กลุ่ม: แพนด้าสายเดิน 🐾"
        streak={profile?.streak_days ?? 0}
      />

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
        <>
          {!loading && !signedIn ? (
            <div className="mb-4">
              <SignInPrompt message="เข้าสู่ระบบเพื่อเข้าร่วมชาเลนจ์และเก็บแต้มรางวัล" />
            </div>
          ) : (
            <section className="card-soft mb-4 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-extrabold">
                  <Flame className="size-4 text-primary" /> รักษาอันดับของคุณ
                </p>
                <p className="text-xs font-extrabold text-muted-foreground">
                  {Math.round(burned).toLocaleString("th-TH")} / {target.toLocaleString("th-TH")} kcal
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                เผาผลาญอีก {Math.max(target - Math.round(burned), 0).toLocaleString("th-TH")} kcal
                เพื่อปิดชาเลนจ์นี้!
              </p>
            </section>
          )}

          <section className="space-y-2.5">
            {(challenges ?? []).map((c) => {
              const mine = joined?.find((j) => j.challenge_id === c.id);
              return (
                <div key={c.id} className="card-soft p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <Trophy className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold">{c.title}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{c.description}</p>
                      <p className="mt-1 text-[11px] font-bold text-primary">
                        +{c.reward_points} แต้ม • ถึง {new Date(c.end_date).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={!!mine || !profile?.id || join.isPending}
                    onClick={() =>
                      join.mutate(c.id, { onSuccess: () => toast.success("เข้าร่วมชาเลนจ์แล้ว!") })
                    }
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-extrabold ${
                      mine
                        ? "bg-success-soft text-success"
                        : "bg-primary text-primary-foreground active:scale-[0.98] disabled:opacity-60"
                    }`}
                  >
                    {mine ? (
                      <>
                        <Check className="size-4" /> เข้าร่วมแล้ว
                      </>
                    ) : (
                      "เข้าร่วมชาเลนจ์"
                    )}
                  </button>
                </div>
              );
            })}
          </section>
        </>
      ) : (
        <>
          <section className="card-soft mb-4 p-4">
            <div className="flex items-end justify-center gap-3">
              {podium.map((p) => (
                <div key={p.rank} className="flex w-24 flex-col items-center">
                  <div className="relative mb-2">
                    <img
                      src={avatar}
                      alt={p.name}
                      width={512}
                      height={512}
                      className="size-14 rounded-full bg-primary-soft ring-2 ring-primary/30"
                    />
                    {p.rank === 1 ? (
                      <Trophy className="absolute -right-1 -top-2 size-5 text-primary" />
                    ) : null}
                  </div>
                  <p className="text-xs font-extrabold">{p.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{p.steps} ก้าว</p>
                  <div
                    className={`mt-2 grid w-full ${p.h} place-items-center rounded-t-2xl ${
                      p.rank === 1 ? "bg-primary" : "bg-primary-soft"
                    }`}
                  >
                    <span
                      className={`text-2xl font-black ${
                        p.rank === 1 ? "text-primary-foreground" : "text-primary"
                      }`}
                    >
                      {p.rank}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <p className="card-soft p-4 text-center text-xs font-semibold text-muted-foreground">
            อันดับชุมชนจะแสดงจริงเมื่อเปิดโหมดแชร์ข้อมูล (ความเป็นส่วนตัว: friends/public) ในหน้าบัญชี
            — ตอนนี้ข้อมูลของแต่ละคนถูกป้องกันด้วย RLS
          </p>
        </>
      )}
    </AppScreen>
  );
}
