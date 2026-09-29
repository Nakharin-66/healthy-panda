import { Link } from "@tanstack/react-router";
import { Crown, Medal, Trophy } from "lucide-react";
import { PersonAvatar } from "@/components/PersonAvatar";
import trophyPanda from "@/assets/panda-trophy.png";
import { formatValue, metricInfo, pct, type BoardRow } from "@/lib/challenges";

function NameLink({ row, children }: { row: BoardRow; children: React.ReactNode }) {
  if (row.is_self || !row.visible) return <>{children}</>;
  return (
    <Link to="/friends/$profileId" params={{ profileId: row.profile_id }} className="contents">
      {children}
    </Link>
  );
}

/** Podium (top 3) + full ranking list + sticky own rank when outside top 10. */
export function ChallengeBoard({
  rows,
  metric,
  target,
}: {
  rows: BoardRow[];
  metric: string;
  target: number;
}) {
  const unit = metricInfo(metric).unit;
  if (!rows.length) {
    return (
      <div className="card-soft flex flex-col items-center p-6 text-center">
        <img src={trophyPanda} alt="แพนด้าแดงถือถ้วยรางวัล" width={816} height={816} loading="lazy" className="size-24" />
        <p className="mt-2 text-sm font-extrabold">ยังไม่มีอันดับ</p>
        <p className="text-[11px] font-semibold text-muted-foreground">
          อันดับจะแสดงเมื่อผู้เข้าร่วมมีข้อมูลในช่วงเวลาของชาเลนจ์
        </p>
      </div>
    );
  }
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-16", "h-24", "h-12"];
  const me = rows.find((r) => r.is_self);
  const showSticky = me && me.rank > 10;

  return (
    <div>
      <div className="card-soft relative mb-3 overflow-hidden bg-gradient-to-b from-primary-soft to-card p-4 pt-3">
        <img src={trophyPanda} alt="" aria-hidden width={816} height={816} loading="lazy" className="pointer-events-none absolute -right-3 -top-2 size-20 opacity-90" />
        <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold text-primary">
          <Trophy className="size-4" /> ท็อป 3
        </p>
        <div className="grid grid-cols-3 items-end gap-2">
          {order.map((r, i) =>
            r ? (
              <NameLink key={r.profile_id} row={r}>
                <div className="flex flex-col items-center text-center">
                  {r.rank === 1 ? <Crown className="mb-0.5 size-5 text-primary" /> : <Medal className="mb-0.5 size-4 text-muted-foreground" />}
                  <PersonAvatar pictureUrl={r.picture_url} name={r.display_name} className={r.rank === 1 ? "size-16" : "size-12"} />
                  <p className="mt-1 w-full truncate text-[11px] font-extrabold">{r.is_self ? "คุณ" : r.display_name}</p>
                  <p className="text-[11px] font-black text-primary">
                    {formatValue(r.value, metric)} {unit}
                  </p>
                  <div className={`mt-1 grid w-full place-items-center rounded-t-2xl bg-primary text-lg font-black text-primary-foreground shadow-sm ${heights[i]}`}>
                    {r.rank}
                  </div>
                </div>
              </NameLink>
            ) : (
              <div key={i} />
            ),
          )}
        </div>
      </div>

      <ul className="card-soft divide-y divide-border">
        {rows.map((r) => (
          <li key={r.profile_id}>
            <NameLink row={r}>
              <div className={`flex items-center gap-3 p-3 ${r.is_self ? "bg-primary-soft" : ""}`}>
                <span className="w-6 text-center text-sm font-black text-muted-foreground">{r.rank}</span>
                <PersonAvatar pictureUrl={r.picture_url} name={r.display_name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold">{r.is_self ? "คุณ" : r.display_name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct(r.value, target))}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">{formatValue(r.value, metric)} {unit}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{pct(r.value, target)}%</p>
                </div>
              </div>
            </NameLink>
          </li>
        ))}
      </ul>

      {showSticky ? (
        <div className="sticky bottom-24 z-10 mt-3 flex items-center gap-3 rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg">
          <span className="text-sm font-black">อันดับของคุณ #{me.rank}</span>
          <span className="ml-auto text-xs font-extrabold">{formatValue(me.value, metric)} {unit}</span>
        </div>
      ) : null}
    </div>
  );
}
