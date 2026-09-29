import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Fns = Database["public"]["Functions"];
export type ChallengeParticipation = Database["public"]["Enums"]["challenge_participation"];
export type ChallengeBoardVisibility = Database["public"]["Enums"]["challenge_board_visibility"];
export type ChallengeRow = Fns["challenge_list"]["Returns"][number];
export type BoardRow = Fns["challenge_board"]["Returns"][number];
export type SeriesRow = Fns["challenge_series"]["Returns"][number];
export type InviteRow = Fns["challenge_invites_detail"]["Returns"][number];
export type ChallengeMetric = "steps" | "distance_km" | "active_minutes" | "calories_burned";
export type ChallengeState = "upcoming" | "running" | "ended" | "cancelled";

export const TIMEZONE_LABEL = "เวลาประเทศไทย (GMT+7)";

export const METRICS: {
  value: ChallengeMetric;
  label: string;
  desc: string;
  unit: string;
  max: number;
  step: number;
  placeholder: string;
}[] = [
  { value: "steps", label: "จำนวนก้าว", desc: "แข่งขันจากจำนวนก้าวสะสม", unit: "ก้าว", max: 100000, step: 1, placeholder: "50000" },
  { value: "distance_km", label: "ระยะทาง", desc: "แข่งขันจากระยะทางสะสม", unit: "กม.", max: 200, step: 0.1, placeholder: "30" },
  { value: "active_minutes", label: "เวลาออกกำลังกาย", desc: "แข่งขันจากเวลาที่ออกกำลังกายสะสม", unit: "นาที", max: 1440, step: 1, placeholder: "300" },
  { value: "calories_burned", label: "แคลอรีที่เผาผลาญ", desc: "แข่งขันจาก Active Calories ที่เผาผลาญสะสม", unit: "kcal", max: 10000, step: 1, placeholder: "2000" },
];

export function metricInfo(metric: string) {
  return METRICS.find((m) => m.value === metric) ?? {
    value: metric as ChallengeMetric, label: metric, desc: "", unit: "", max: 1000000, step: 1, placeholder: "",
  };
}

export const PARTICIPATION_LABEL: Record<ChallengeParticipation, string> = {
  everyone: "ทุกคนที่มีรหัส",
  friends: "เฉพาะเพื่อน",
  invite_only: "เฉพาะผู้ได้รับเชิญ",
};
export const BOARD_LABEL: Record<ChallengeBoardVisibility, string> = {
  everyone: "สาธารณะ",
  friends: "เฉพาะเพื่อน",
  participants: "เฉพาะผู้เข้าร่วม",
};
export const STATE_LABEL: Record<string, string> = {
  upcoming: "ยังไม่เริ่ม",
  running: "กำลังดำเนินการ",
  ended: "สิ้นสุดแล้ว",
  cancelled: "ยกเลิกแล้ว",
};
export const SOURCE_LABEL: Record<string, string> = {
  health_device: "Smartwatch / อุปกรณ์สุขภาพ",
  manual: "กรอกข้อมูลเอง",
};

export const CHALLENGE_ERROR_TH: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
  invalid_title: "กรุณาตั้งชื่อชาเลนจ์ (ไม่เกิน 80 ตัวอักษร)",
  invalid_metric: "ประเภทชาเลนจ์ไม่ถูกต้อง",
  invalid_target: "กรุณาระบุเป้าหมายให้มากกว่า 0",
  invalid_range: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น",
  range_too_long: "ระยะเวลาชาเลนจ์ต้องไม่เกิน 1 ปี",
  challenge_not_found: "ไม่พบชาเลนจ์นี้",
  challenge_closed: "ชาเลนจ์นี้ปิดรับแล้ว",
  challenge_expired: "ชาเลนจ์นี้หมดเวลาแล้ว",
  join_not_allowed: "ผู้สร้างไม่ได้เปิดให้คุณเข้าร่วมชาเลนจ์นี้",
  already_joined: "คุณเข้าร่วมชาเลนจ์นี้แล้ว",
  challenge_code_not_found: "ไม่พบรหัสชาเลนจ์นี้",
  not_owner: "เฉพาะผู้สร้างชาเลนจ์เท่านั้น",
  not_challenge_owner: "เฉพาะผู้สร้างชาเลนจ์เท่านั้นที่เชิญได้",
  not_friends: "ผู้ใช้นี้ยังไม่ได้เป็นเพื่อนของคุณ",
  not_joined: "กรุณาเข้าร่วมชาเลนจ์ก่อน",
  invalid_value: "ค่าต้องไม่ติดลบและไม่เว้นว่าง",
  value_too_large: "ค่าที่กรอกสูงเกินกว่าที่เป็นไปได้ต่อวัน",
  date_out_of_range: "วันที่ต้องอยู่ในช่วงเวลาของชาเลนจ์",
  duplicate: "มีรายการกรอกเองของวันนี้อยู่แล้ว กรุณาแก้ไขรายการเดิม",
  invite_not_found: "ไม่พบคำเชิญนี้ อาจถูกยกเลิกไปแล้ว",
};

export function challengeErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message) : String(error ?? "");
  if (raw.includes("duplicate key")) return CHALLENGE_ERROR_TH.duplicate!;
  for (const key of Object.keys(CHALLENGE_ERROR_TH)) if (raw.includes(key)) return CHALLENGE_ERROR_TH[key]!;
  return "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง";
}

export function formatValue(v: number | null | undefined, metric: string) {
  const n = Number(v ?? 0);
  const digits = metric === "distance_km" ? 2 : 0;
  return n.toLocaleString("th-TH", { maximumFractionDigits: digits });
}
export function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.round((Number(value) / Number(target)) * 1000) / 10;
}
const dtf = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
const dtfTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dShort = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
export const fmtDate = (s: string) => dtf.format(new Date(s));
export const fmtDateTime = (s: string) => dtfTime.format(new Date(s)) + " น.";
export const fmtRange = (a: string, b: string) => `${dShort.format(new Date(a))} – ${dtf.format(new Date(b))}`;

export function timeLeft(c: Pick<ChallengeRow, "start_at" | "end_at" | "state">) {
  const now = Date.now();
  if (c.state === "upcoming") {
    const d = Math.ceil((new Date(c.start_at).getTime() - now) / 86400000);
    return `เริ่มในอีก ${d} วัน`;
  }
  if (c.state !== "running") return STATE_LABEL[c.state] ?? "";
  const ms = new Date(c.end_at).getTime() - now;
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `เหลืออีก ${d} วัน`;
  return `เหลืออีก ${Math.max(1, Math.ceil(ms / 3600000))} ชั่วโมง`;
}

/** Bangkok date string (YYYY-MM-DD) for a timestamp. */
export function bkkDate(s: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(s));
}
/** Build an ISO timestamp from Bangkok-local date + time inputs. */
export function bkkToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ["challenges", "challenge", "board", "series", "entries", "challenge_invites"])
    qc.invalidateQueries({ queryKey: [k] });
};

export function useChallenges(enabled = true, includeHidden = false) {
  return useQuery({
    queryKey: ["challenges", includeHidden],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_list", { _include_hidden: includeHidden });
      if (error) throw error;
      return (data ?? []) as ChallengeRow[];
    },
  });
}

export function useChallenge(id?: string) {
  return useQuery({
    queryKey: ["challenge", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_list", { _include_hidden: true });
      if (error) throw error;
      return ((data ?? []) as ChallengeRow[]).find((c) => c.id === id) ?? null;
    },
  });
}

export function useLookupCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("challenge_by_code", { _code: code });
      if (error) throw error;
      return data as string;
    },
  });
}

export type ChallengeInput = {
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  start_at: string;
  end_at: string;
  participation: ChallengeParticipation;
  board: ChallengeBoardVisibility;
};

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ChallengeInput) => {
      const { data, error } = await supabase.rpc("challenge_create", {
        _title: i.title, _description: i.description, _metric: i.metric, _target: i.target,
        _start_at: i.start_at, _end_at: i.end_at, _participation: i.participation, _board: i.board,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ChallengeInput & { id: string }) => {
      const { error } = await supabase.rpc("challenge_update", {
        _challenge_id: i.id, _title: i.title, _description: i.description, _metric: i.metric, _target: i.target,
        _start_at: i.start_at, _end_at: i.end_at, _participation: i.participation, _board: i.board,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

function simpleRpc<N extends "challenge_delete" | "challenge_hide" | "join_challenge" | "leave_challenge">(name: N) {
  return function useIt() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc(name, { _challenge_id: id });
        if (error) throw error;
      },
      onSuccess: () => invalidateAll(qc),
    });
  };
}
export const useDeleteChallenge = simpleRpc("challenge_delete");
export const useHideChallenge = simpleRpc("challenge_hide");
export const useJoinChallenge = simpleRpc("join_challenge");
export const useLeaveChallenge = simpleRpc("leave_challenge");

export function useSyncDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("challenge_sync_device", { _challenge_id: id });
      if (error) throw error;
      return data as { has_device: boolean; days: number; total: number };
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useBoard(id?: string) {
  return useQuery({
    queryKey: ["board", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_board", { _challenge_id: id! });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
  });
}

export function useSeries(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["series", id],
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_series", { _challenge_id: id! });
      if (error) throw error;
      return (data ?? []) as SeriesRow[];
    },
  });
}

export function useManualEntries(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["entries", id],
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_data_entries")
        .select("id, data_date, value, unit, source")
        .eq("challenge_id", id!)
        .eq("source", "manual")
        .order("data_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveManualEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { id?: string; challengeId: string; profileId: string; date: string; value: number }) => {
      if (i.id) {
        const { error } = await supabase
          .from("challenge_data_entries")
          .update({ data_date: i.date, value: i.value })
          .eq("id", i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("challenge_data_entries").insert({
          challenge_id: i.challengeId, profile_id: i.profileId, data_date: i.date, value: i.value, source: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteManualEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenge_data_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useChallengeInvites(enabled = true) {
  return useQuery({
    queryKey: ["challenge_invites"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_invites_detail");
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });
}

export function useInviteFriends() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, friendIds }: { challengeId: string; friendIds: string[] }) => {
      for (const f of friendIds) {
        const { error } = await supabase.rpc("invite_friend_to_challenge", {
          _challenge_id: challengeId, _friend_profile_id: f,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenge_invites"] }),
  });
}

export function useRespondInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "reject" | "cancel" }) => {
      const { error } = await supabase.rpc("respond_challenge_invite", { _invite_id: id, _action: action });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Live updates for participants, challenges, invites and own data entries. */
export function useChallengeRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("challenges-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_participants" }, () => invalidateAll(qc))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => invalidateAll(qc))
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_invites" }, () =>
        qc.invalidateQueries({ queryKey: ["challenge_invites"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_data_entries" }, () => invalidateAll(qc))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, enabled]);
}
