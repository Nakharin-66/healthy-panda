import sprite from "@/assets/panda-metrics.png";

const POS: Record<string, string> = {
  steps: "0% 0%",
  distance_km: "100% 0%",
  active_minutes: "0% 100%",
  calories_burned: "100% 100%",
};

/** Red-panda illustration matching a challenge metric (cropped from a 2x2 sprite). */
export function MetricArt({ metric, className = "size-14" }: { metric: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label="ภาพแพนด้าแดงประจำประเภทชาเลนจ์"
      className={`inline-block shrink-0 bg-no-repeat ${className}`}
      style={{ backgroundImage: `url(${sprite})`, backgroundSize: "200% 200%", backgroundPosition: POS[metric] ?? "0% 0%" }}
    />
  );
}
