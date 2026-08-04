// Server-only helpers for Health Connect device pairing + sample ingestion.
// Health Connect itself is an Android OS API, so a native companion app reads it
// on the phone and pushes samples to /api/public/health-connect/ingest.

export const HEALTH_METRICS = [
  "heart_rate",
  "steps",
  "sleep_minutes",
  "oxygen_saturation",
  "active_calories",
  "hydration_ml",
  "weight_kg",
  "distance_km",
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];

export type HealthSampleInput = {
  metric: HealthMetric;
  value: number;
  unit?: string | null | undefined;
  recorded_at: string;
  source?: string | null | undefined;
};


const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPairCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => PAIR_CODE_ALPHABET[b % PAIR_CODE_ALPHABET.length]).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function createPairing(profileId?: string | null) {
  const db = await admin();
  const { data, error } = await db
    .from("health_devices")
    .insert({ pair_code: randomPairCode(), profile_id: profileId ?? null })
    .select("id, pair_code, ingest_token")
    .single();
  if (error) throw error;
  return { pairCode: data.pair_code, token: data.ingest_token };
}

export async function readSyncStatus(token: string) {
  const db = await admin();
  const { data: device, error } = await db
    .from("health_devices")
    .select("id, pair_code, platform, app_version, paired_at, last_sync_at")
    .eq("ingest_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!device) return null;

  const { data: samples, error: sampleError } = await db
    .from("health_samples")
    .select("metric, value, unit, recorded_at, source")
    .eq("device_id", device.id)
    .order("recorded_at", { ascending: false })
    .limit(60);
  if (sampleError) throw sampleError;

  const latest: Record<string, { value: number; unit: string | null; recorded_at: string }> = {};
  for (const s of samples ?? []) {
    if (!latest[s.metric]) {
      latest[s.metric] = { value: Number(s.value), unit: s.unit, recorded_at: s.recorded_at };
    }
  }

  return {
    pairCode: device.pair_code,
    platform: device.platform,
    appVersion: device.app_version,
    pairedAt: device.paired_at,
    lastSyncAt: device.last_sync_at,
    sampleCount: samples?.length ?? 0,
    latest,
  };
}

export async function ingestSamples(input: {
  token: string;
  platform?: string | null;
  appVersion?: string | null;
  samples: HealthSampleInput[];
}) {
  const db = await admin();
  const { data: device, error } = await db
    .from("health_devices")
    .select("id, paired_at, profile_id")
    .eq("ingest_token", input.token)
    .maybeSingle();
  if (error) throw error;
  if (!device) return { ok: false as const, status: 401, message: "Unknown ingest token" };

  const rows = input.samples.map((s) => ({
    device_id: device.id,
    profile_id: device.profile_id,
    metric: s.metric,
    value: s.value,
    unit: s.unit ?? null,
    recorded_at: s.recorded_at,
    source: s.source ?? "health_connect",
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await db
      .from("health_samples")
      .upsert(rows, { onConflict: "device_id,metric,recorded_at" });
    if (upsertError) throw upsertError;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("health_devices")
    .update({
      last_sync_at: now,
      paired_at: device.paired_at ?? now,
      pair_status: "paired",
      platform: input.platform ?? null,
      app_version: input.appVersion ?? null,
    })
    .eq("id", device.id);
  if (updateError) throw updateError;

  return { ok: true as const, accepted: rows.length, syncedAt: now };
}
