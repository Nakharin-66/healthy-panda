import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ChallengeCategory = Database["public"]["Enums"]["challenge_category"];
export type ChallengeGoalMode = Database["public"]["Enums"]["challenge_goal_mode"];
export type ChallengeParticipation = Database["public"]["Enums"]["challenge_participation"];
export type ChallengeBoardVisibility = Database["public"]["Enums"]["challenge_board_visibility"];
export type ChallengeScoringType = Database["public"]["Enums"]["challenge_scoring_type"];
export type ChallengeTargetSource = Database["public"]["Enums"]["challenge_target_source"];
export type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];

export type ChallengeView = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_code: string;
  category: ChallengeCategory;
  metric: string;
  target_value: number;
  unit: string;
  goal_mode: ChallengeGoalMode;
  start_date: string;
  end_date: string;
  reward_points: number;
  participation_visibility: ChallengeParticipation;
  leaderboard_visibility: ChallengeBoardVisibility;
  owner_profile_id: string | null;
  owner_name: string | null;
  owner_picture: string | null;
  is_owner: boolean;
  participant_count: number;
  joined: boolean;
  my_progress: number;
  my_completed: boolean;
  invited: boolean;
  scoring_type: ChallengeScoringType;
  target_source: ChallengeTargetSource;
  max_score: number;
  status: ChallengeStatus;
  effective_status: string;
  my_score: number;
  my_target: number;
};

type RawChallengeView = Database["public"]["CompositeTypes"]["challenge_view"];

function normalize(row: RawChallengeView): ChallengeView {
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    description: row.description ?? null,
    icon: row.icon ?? null,
    challenge_code: row.challenge_code ?? "",
    category: row.category ?? "custom",
    metric: row.metric ?? "steps",
    target_value: Number(row.target_value ?? 0),
    unit: row.unit ?? "",
    goal_mode: row.goal_mode ?? "cumulative",
    start_date: row.start_date ?? "",
    end_date: row.end_date ?? "",
    reward_points: Number(row.reward_points ?? 0),
    participation_visibility: row.participation_visibility ?? "everyone",
    leaderboard_visibility: row.leaderboard_visibility ?? "everyone",
    owner_profile_id: row.owner_profile_id ?? null,
    owner_name: row.owner_name ?? null,
    owner_picture: row.owner_picture ?? null,
    is_owner: !!row.is_owner,
    participant_count: Number(row.participant_count ?? 0),
    joined: !!row.joined,
    my_progress: Number(row.my_progress ?? 0),
    my_completed: !!row.my_completed,
    invited: !!row.invited,
    scoring_type: row.scoring_type ?? "daily_completion",
    target_source: row.target_source ?? "fixed",
    max_score: Number(row.max_score ?? 100),
    status: row.status ?? "open",
    effective_status: row.effective_status ?? "open",
    my_score: Number(row.my_score ?? 0),
    my_target: Number(row.my_target ?? row.target_value ?? 0),
  };
}

export const CATEGORY_LABEL: Record<ChallengeCategory, string> = {
  movement: "การเคลื่อนไหว",
  exercise: "การออกกำลังกาย",
  water: "การดื่มน้ำ",
  sleep: "การนอน",
  wellness: "การดูแลสุขภาพ",
  custom: "เป้าหมายส่วนบุคคล",
};

export const METRIC_LABEL: Record<string, string> = {
  steps: "จำนวนก้าว",
  distance_km: "ระยะทาง",
  active_minutes: "นาทีเคลื่อนไหว",
  exercise_minutes: "นาทีออกกำลังกาย",
  calories_burned: "แคลอรีที่เผาผลาญ",
  water_ml: "การดื่มน้ำ",
  sleep_minutes: "เวลานอน",
  activity_days: "จำนวนวันที่มีกิจกรรม",
};

export const METRIC_UNIT: Record<string, string> = {
  steps: "ก้าว",
  distance_km: "กม.",
  active_minutes: "นาที",
  exercise_minutes: "นาที",
  calories_burned: "kcal",
  water_ml: "มล.",
  sleep_minutes: "นาที",
  activity_days: "วัน",
};

export const METRIC_OPTIONS: { value: string; label: string }[] = [
  { value: "steps", label: "จำนวนก้าว" },
  { value: "distance_km", label: "ระยะทาง (กม.)" },
  { value: "active_minutes", label: "นาทีเคลื่อนไหว" },
  { value: "calories_burned", label: "แคลอรีที่เผาผลาญ" },
  { value: "water_ml", label: "การดื่มน้ำ (มล.)" },
  { value: "sleep_minutes", label: "เวลานอน (นาที)" },
  { value: "activity_days", label: "จำนวนวันที่มีกิจกรรม" },
];

/** Which stored health data each metric is calculated from. */
export const METRIC_SOURCE_LABEL: Record<string, string> = {
  steps: "จำนวนก้าวจากอุปกรณ์สุขภาพที่เชื่อมต่อ (สถิติรายวัน)",
  distance_km: "ระยะทางจากบันทึกกิจกรรม",
  active_minutes: "ระยะเวลาจากบันทึกกิจกรรมและการออกกำลังกาย",
  exercise_minutes: "ระยะเวลาการออกกำลังกาย",
  calories_burned: "แคลอรีที่เผาผลาญจากบันทึกกิจกรรมและการออกกำลังกาย",
  water_ml: "ปริมาณน้ำจากบันทึกการดื่มน้ำ",
  sleep_minutes: "เวลานอนจากสถิติรายวันของอุปกรณ์สุขภาพ",
  activity_days: "จำนวนวันที่มีบันทึกกิจกรรม",
};

export const SCORING_LABEL: Record<ChallengeScoringType, string> = {
  daily_completion: "บรรลุเป้าหมายรายวัน (วันละ 100 คะแนน)",
  progress_percentage: "คิดตามสัดส่วนของเป้าหมาย (สูงสุด 100 คะแนน)",
};

export const TARGET_SOURCE_LABEL: Record<ChallengeTargetSource, string> = {
  fixed: "เป้าหมายเดียวกันทุกคน",
  personal_goal: "ใช้เป้าหมายของแต่ละคน",
};

export const STATUS_LABEL: Record<string, string> = {
  open: "เปิดรับ",
  running: "กำลังดำเนินการ",
  ended: "สิ้นสุดแล้ว",
  closed: "ปิดรับสมาชิก",
  cancelled: "ยกเลิก",
};

export function challengeDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

/** Same rule the database uses when creating a challenge. */
export function computeMaxScore(input: {
  scoring: ChallengeScoringType;
  goalMode: ChallengeGoalMode;
  metric: string;
  startDate: string;
  endDate: string;
}) {
  const dailyStyle =
    input.scoring === "daily_completion" &&
    input.goalMode === "daily" &&
    input.metric !== "activity_days";
  return dailyStyle ? challengeDays(input.startDate, input.endDate) * 100 : 100;
}

export const GOAL_MODE_LABEL: Record<ChallengeGoalMode, string> = {
  daily: "เป้าหมายรายวัน",
  cumulative: "เป้าหมายสะสม",
};

export const PARTICIPATION_LABEL: Record<ChallengeParticipation, string> = {
  everyone: "ทุกคน",
  friends: "เฉพาะเพื่อน",
  invite_only: "เชิญเท่านั้น",
};

export const BOARD_LABEL: Record<ChallengeBoardVisibility, string> = {
  everyone: "ทุกคน",
  friends: "เพื่อน",
  participants: "ผู้เข้าร่วมเท่านั้น",
};

export const CHALLENGE_ERROR_TH: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
  title_required: "กรุณาตั้งชื่อชาเลนจ์",
  invalid_metric: "ประเภทการวัดผลไม่ถูกต้อง",
  invalid_target: "กรุณาระบุเป้าหมายให้มากกว่า 0",
  invalid_date_range: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม",
  range_too_long: "ระยะเวลาชาเลนจ์ต้องไม่เกิน 1 ปี",
  challenge_not_found: "ไม่พบชาเลนจ์นี้",
  challenge_closed: "ชาเลนจ์นี้ปิดรับแล้ว",
  challenge_expired: "ชาเลนจ์นี้หมดเวลาแล้ว",
  join_not_allowed: "ชาเลนจ์นี้ไม่เปิดให้คุณเข้าร่วม",
  already_joined: "คุณเข้าร่วมชาเลนจ์นี้แล้ว",
  challenge_code_not_found: "ไม่พบรหัสชาเลนจ์นี้",
  challenge_not_accessible: "คุณไม่มีสิทธิ์เข้าถึงชาเลนจ์นี้",
  not_challenge_owner: "เฉพาะเจ้าของชาเลนจ์เท่านั้นที่เชิญได้",
  not_friends: "ผู้ใช้นี้ยังไม่ได้เป็นเพื่อนของคุณ",
  invite_not_found: "ไม่พบคำเชิญนี้ อาจถูกยกเลิกไปแล้ว",
  not_allowed: "คุณไม่มีสิทธิ์ดำเนินการนี้",
};

export function challengeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const key of Object.keys(CHALLENGE_ERROR_TH)) {
    if (raw.includes(key)) return CHALLENGE_ERROR_TH[key]!;
  }
  return "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง";
}

export function metricUnit(c: Pick<ChallengeView, "metric" | "unit">) {
  return c.unit?.trim() ? c.unit : (METRIC_UNIT[c.metric] ?? "");
}

export function goalText(c: ChallengeView) {
  const unit = metricUnit(c);
  const amount = Math.round(c.target_value).toLocaleString("th-TH");
  return c.goal_mode === "daily"
    ? `${amount} ${unit} ต่อวัน`
    : `${amount} ${unit} สะสมรวม`;
}

export function daysLeft(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

export function challengeStatus(c: ChallengeView) {
  const today = new Date().toISOString().slice(0, 10);
  if (c.effective_status === "cancelled") return { key: "cancelled", label: "ยกเลิก" } as const;
  if (c.my_completed) return { key: "completed", label: "สำเร็จแล้ว" } as const;
  if (c.effective_status === "ended" || c.end_date < today)
    return { key: "expired", label: "สิ้นสุดแล้ว" } as const;
  if (c.effective_status === "closed" && !c.joined)
    return { key: "closed", label: "ปิดรับสมาชิก" } as const;
  if (c.start_date > today) return { key: "upcoming", label: "เปิดรับ" } as const;
  if (c.joined) return { key: "joined", label: "กำลังดำเนินการ" } as const;
  return { key: "open", label: "ยังไม่เข้าร่วม" } as const;
}

/** Human explanation of how the score is produced, from the challenge's own rules. */
export function scoringExplanation(c: ChallengeView): string[] {
  const unit = metricUnit(c);
  const amount = Math.round(c.target_value).toLocaleString("th-TH");
  const lines: string[] = [];

  if (c.target_source === "personal_goal") {
    lines.push("ระบบใช้เป้าหมายรายวันที่ผู้เข้าร่วมแต่ละคนตั้งไว้เอง");
    if (c.my_target > 0) {
      lines.push(`เป้าหมายของคุณตอนนี้: ${Math.round(c.my_target).toLocaleString("th-TH")} ${unit}`);
    }
  } else {
    lines.push(
      c.goal_mode === "daily"
        ? `ทุกคนใช้เป้าหมายเดียวกัน: ${amount} ${unit} ต่อวัน`
        : `ทุกคนใช้เป้าหมายเดียวกัน: ${amount} ${unit} สะสมรวม`,
    );
  }

  if (c.scoring_type === "daily_completion" && c.goal_mode === "daily") {
    lines.push("บรรลุเป้าหมายรายวัน = 100 คะแนน");
  } else {
    lines.push("คะแนน = สัดส่วนความคืบหน้าเทียบเป้าหมาย");
  }

  lines.push(`คะแนนสูงสุด = ${c.max_score.toLocaleString("th-TH")} คะแนน`);
  lines.push(`ระบบใช้${METRIC_SOURCE_LABEL[c.metric] ?? "ข้อมูลสุขภาพที่บันทึกไว้ในระบบ"}`);
  return lines;
}

/** Target used for the progress bar: daily goals are counted in days. */
export function progressTarget(c: ChallengeView) {
  if (c.goal_mode !== "daily" || c.metric === "activity_days") return c.target_value;
  const start = new Date(`${c.start_date}T00:00:00`).getTime();
  const end = new Date(`${c.end_date}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function progressUnit(c: ChallengeView) {
  return c.goal_mode === "daily" && c.metric !== "activity_days" ? "วัน" : metricUnit(c);
}

export function useVisibleChallenges(enabled = true) {
  return useQuery({
    queryKey: ["challenges"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_visible_challenges");
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function useChallengeDetail(challengeId?: string) {
  return useQuery({
    queryKey: ["challenge_detail", challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_detail", {
        _challenge_id: challengeId!,
      });
      if (error) throw error;
      const row = data?.[0];
      return row ? normalize(row) : null;
    },
  });
}

export function useLookupChallengeCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("lookup_challenge_code", { _code: code });
      if (error) throw error;
      const row = data?.[0];
      return row ? normalize(row) : null;
    },
  });
}

export type CreateChallengeInput = {
  title: string;
  description: string;
  category: ChallengeCategory;
  metric: string;
  target_value: number;
  goal_mode: ChallengeGoalMode;
  start_date: string;
  end_date: string;
  participation: ChallengeParticipation;
  board: ChallengeBoardVisibility;
  scoring: ChallengeScoringType;
  target_source: ChallengeTargetSource;
};

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChallengeInput) => {
      const { data, error } = await supabase.rpc("create_challenge", {
        _title: input.title,
        _description: input.description,
        _category: input.category,
        _metric: input.metric,
        _target_value: input.target_value,
        _goal_mode: input.goal_mode,
        _start_date: input.start_date,
        _end_date: input.end_date,
        _participation: input.participation,
        _board: input.board,
        _scoring: input.scoring,
        _target_source: input.target_source,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge_participants"] });
    },
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("join_challenge", { _challenge_id: challengeId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge_detail"] });
      qc.invalidateQueries({ queryKey: ["challenge_invites"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useLeaveChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("leave_challenge", { _challenge_id: challengeId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge_detail"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}

/** Owner-only: close registration or cancel the challenge. */
export function useSetChallengeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChallengeStatus }) => {
      const { error } = await supabase.rpc("set_challenge_status", {
        _challenge_id: id,
        _status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge_detail"] });
    },
  });
}

export function useChallengeInvites(enabled = true) {
  return useQuery({
    queryKey: ["challenge_invites"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_challenge_invites");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInviteFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, friendProfileId }: { challengeId: string; friendProfileId: string }) => {
      const { error } = await supabase.rpc("invite_friend_to_challenge", {
        _challenge_id: challengeId,
        _friend_profile_id: friendProfileId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenge_invites"] }),
  });
}

export function useRespondChallengeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "reject" | "cancel" }) => {
      const { error } = await supabase.rpc("respond_challenge_invite", {
        _invite_id: id,
        _action: action,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenge_invites"] });
      qc.invalidateQueries({ queryKey: ["challenges"] });
    },
  });
}

export function useLeaderboard(challengeId?: string, friendsOnly = false) {
  return useQuery({
    queryKey: ["leaderboard", challengeId, friendsOnly],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_leaderboard", {
        _challenge_id: challengeId!,
        _friends_only: friendsOnly,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Recalculates the signed-in user's progress from real logs, server-side. */
export function useSyncProgress(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    supabase.rpc("sync_challenge_progress").then(({ error }) => {
      if (!active || error) return;
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge_detail"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    });
    return () => {
      active = false;
    };
  }, [enabled, qc]);
}

/** Live challenge, participant and invite updates. */
export function useChallengeRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("challenges-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_participants" }, () => {
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
        qc.invalidateQueries({ queryKey: ["challenges"] });
        qc.invalidateQueries({ queryKey: ["challenge_detail"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => {
        qc.invalidateQueries({ queryKey: ["challenges"] });
        qc.invalidateQueries({ queryKey: ["challenge_detail"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_invites" }, () => {
        qc.invalidateQueries({ queryKey: ["challenge_invites"] });
        qc.invalidateQueries({ queryKey: ["challenges"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, enabled]);
}
