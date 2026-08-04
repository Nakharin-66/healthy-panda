import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HeartPulse,
  Copy,
  RefreshCw,
  Smartphone,
  Info,
  Loader2,
  Unlink,
  CheckCircle2,
} from "lucide-react";
import {
  createHealthConnectPairing,
  getHealthConnectStatus,
} from "@/lib/healthConnect.functions";

const TOKEN_KEY = "hp_health_connect_token";

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  heart_rate: { label: "อัตราการเต้นหัวใจ", unit: "bpm" },
  steps: { label: "ก้าวเดิน", unit: "ก้าว" },
  sleep_minutes: { label: "การนอน", unit: "นาที" },
  oxygen_saturation: { label: "SpO₂", unit: "%" },
  active_calories: { label: "แคลอรีที่เผาผลาญ", unit: "kcal" },
  hydration_ml: { label: "การดื่มน้ำ", unit: "ml" },
  weight_kg: { label: "น้ำหนัก", unit: "กก." },
};

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "ยังไม่เคยซิงก์";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.round(hrs / 24)} วันที่แล้ว`;
}

export function HealthConnectCard() {
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setHydrated(true);
  }, []);

  const fetchStatus = useServerFn(getHealthConnectStatus);
  const createPairing = useServerFn(createHealthConnectPairing);

  const status = useQuery({
    queryKey: ["health-connect", token],
    queryFn: () => fetchStatus({ data: { token: token! } }),
    enabled: Boolean(token),
    refetchInterval: 60_000,
  });

  const pair = useMutation({
    mutationFn: () => createPairing(),
    onSuccess: (result) => {
      localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      toast.success("สร้างรหัสจับคู่แล้ว", { description: `รหัส: ${result.pairCode}` });
    },
    onError: () => toast.error("สร้างรหัสจับคู่ไม่สำเร็จ ลองอีกครั้ง"),
  });

  const disconnect = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    queryClient.removeQueries({ queryKey: ["health-connect"] });
    toast.success("ยกเลิกการเชื่อมต่อแล้ว");
  };

  const data = status.data;
  const connected = Boolean(data?.lastSyncAt);
  const latest = Object.entries(data?.latest ?? {});

  return (
    <section className="card-soft p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 place-items-center rounded-2xl ${
            connected ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          <HeartPulse className="size-5" strokeWidth={2.3} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-extrabold">Health Connect</p>
          <p
            className={`text-xs font-bold ${connected ? "text-success" : "text-muted-foreground"}`}
          >
            {!hydrated
              ? "กำลังตรวจสอบ…"
              : !token
                ? "ยังไม่เชื่อมต่อ"
                : connected
                  ? `เชื่อมต่อแล้ว • ซิงก์ ${timeAgo(data?.lastSyncAt)}`
                  : "รอแอปบนมือถือเชื่อมต่อ"}
          </p>
        </div>
        {token ? (
          <button
            onClick={() => status.refetch()}
            className="grid size-9 place-items-center rounded-full border-2 border-border active:scale-95"
            aria-label="ซิงก์ข้อมูลใหม่"
          >
            <RefreshCw className={`size-4 ${status.isFetching ? "animate-spin" : ""}`} />
          </button>
        ) : null}
      </div>

      {hydrated && !token ? (
        <button
          onClick={() => pair.mutate()}
          disabled={pair.isPending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-95 disabled:opacity-60"
        >
          {pair.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Smartphone className="size-4" />
          )}
          สร้างรหัสจับคู่กับมือถือ
        </button>
      ) : null}

      {token && data ? (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-muted-foreground">รหัสจับคู่</p>
              <p className="font-mono text-lg font-black tracking-[0.25em]">{data.pairCode}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(data.pairCode);
                toast.success("คัดลอกรหัสแล้ว");
              }}
              className="grid size-9 place-items-center rounded-xl bg-card active:scale-95"
              aria-label="คัดลอกรหัสจับคู่"
            >
              <Copy className="size-4" />
            </button>
          </div>

          {latest.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {latest.map(([metric, sample]) => {
                const meta = METRIC_LABELS[metric] ?? { label: metric, unit: "" };
                return (
                  <div key={metric} className="rounded-2xl bg-secondary p-3">
                    <p className="text-[10px] font-bold text-muted-foreground">{meta.label}</p>
                    <p className="text-sm font-black">
                      {sample.value.toLocaleString()}{" "}
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {sample.unit ?? meta.unit}
                      </span>
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {timeAgo(sample.recorded_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex gap-2 rounded-2xl bg-info-soft p-3 text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p className="text-[11px] font-bold leading-snug">
                Health Connect เป็น API ของระบบ Android — ต้องมีแอปมือถือ Healthy Panda ติดตั้งบน
                เครื่อง ใส่รหัสจับคู่ด้านบน แล้วข้อมูลจะซิงก์เข้ามาที่นี่อัตโนมัติ
              </p>
            </div>
          )}

          {connected ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-success">
              <CheckCircle2 className="size-3.5" /> รับข้อมูลแล้ว {data.sampleCount} รายการล่าสุด
            </p>
          ) : null}

          <button
            onClick={disconnect}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-border px-4 py-2.5 text-xs font-extrabold active:scale-95"
          >
            <Unlink className="size-3.5" /> ยกเลิกการเชื่อมต่อ
          </button>
        </>
      ) : null}
    </section>
  );
}
