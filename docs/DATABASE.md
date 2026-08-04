# Healthy Panda — Database Documentation

Stack: React + TypeScript (TanStack Start) · Supabase PostgreSQL · Supabase Auth (email/password + Google, LINE LIFF ready) · Health Connect (Android) / Apple Health via native bridge · Gemini-class AI coach · Supabase Storage · Row Level Security everywhere.

## Conventions

- Every table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`.
- `updated_at` maintained by trigger `set_updated_at()`.
- All user data hangs off `public.profiles.id` (never off `auth.users` directly).
- Enum types are used instead of free-text where the domain is closed.
- RLS: user-owned rows are matched with `profile_id = public.current_profile_id()`, a `SECURITY DEFINER` helper that returns the caller's profile id (executable by `authenticated` only).
- Device/sample ingestion is server-only (service role); clients get read-only access to their own rows.

## Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | user identity + body metrics | `user_id` (auth), `line_user_id`, `display_name`, `picture_url`, `email`, `gender`, `birthday`, `height_cm`, `weight_kg`, `target_weight_kg`, `activity_level`, `language`, `timezone`, `streak_days` |
| `health_devices` | smartwatch / Health Connect / Apple Health pairing | `profile_id`, `pair_code`, `ingest_token`, `device_name`, `device_kind`, `platform`, `app_version`, `pair_status`, `paired_at`, `last_sync_at` |
| `health_samples` | raw metric stream | `profile_id`, `device_id`, `metric`, `value`, `unit`, `recorded_at`, `source` |
| `water_logs` | each drinking event | `profile_id`, `amount_ml`, `recorded_at` |
| `food_logs` | AI food scan results | `profile_id`, `image_url`, `food_name`, `meal_type`, `calories`, `protein_g`, `fat_g`, `carbohydrates_g`, `fiber_g`, `sugar_g`, `sodium_mg`, `ai_confidence`, `recorded_at` |
| `exercise_logs` | workouts | `profile_id`, `activity_type`, `duration_minutes`, `calories`, `average_heart_rate`, `source`, `recorded_at` |
| `daily_goals` | personalised targets per effective date | `steps_goal`, `calories_goal`, `water_goal_ml`, `sleep_goal_minutes`, `protein_goal_g`, `fat_goal_g`, `carb_goal_g` |
| `daily_statistics` | pre-aggregated dashboard values | `stat_date`, `health_score`, `steps`, `calories`, `water_ml`, `sleep_minutes`, `exercise_minutes`, `heart_rate_avg`, `spo2_avg` |
| `ai_conversations` | Gemini chat history | `session_id`, `role`, `message`, `tokens` |
| `ai_recommendations` | AI health analysis | `recommendation`, `summary`, `risk_level`, `recommendation_type` |
| `challenges` | community challenges (public read) | `title`, `description`, `icon`, `start_date`, `end_date`, `reward_points`, `is_active` |
| `challenge_participants` | N:N join + progress | `challenge_id`, `profile_id`, `progress`, `completed`, `completed_at` |
| `user_badges` | achievements | `badge_name`, `badge_icon`, `unlocked_at` |
| `notifications` | in-app / push queue | `title`, `body`, `notification_type`, `read`, `scheduled_at` |
| `ai_scan_history` | image analysis audit trail | `image_url`, `ai_result` (jsonb), `calories`, `food_log_id` |
| `user_settings` | 1:1 preferences | `theme`, `language`, `notification_enabled`, `health_permission`, `privacy_level` |
| `app_logs` | application events | `action`, `module`, `metadata` (jsonb) |
| `file_assets` | Supabase Storage metadata | `bucket_name`, `file_path`, `mime_type`, `file_size` |

## Enums

`gender`, `activity_level`, `device_platform`, `device_kind`, `pair_status`, `metric_type`, `meal_type`, `chat_role`, `risk_level`, `notification_type`, `privacy_level`.

## Indexes (high-traffic paths)

- `profiles(user_id)`, `profiles(line_user_id)`
- `health_samples(profile_id, metric, recorded_at DESC)`, `health_samples(recorded_at DESC)`, unique `(device_id, metric, recorded_at)` for idempotent ingestion
- `health_devices(profile_id, last_sync_at DESC)`, unique `pair_code`, unique `ingest_token`
- `water_logs / food_logs / exercise_logs / ai_scan_history (profile_id, recorded_at|created_at DESC)`
- `food_logs(profile_id, meal_type, recorded_at DESC)`
- `daily_goals(profile_id, effective_date DESC)` + unique `(profile_id, effective_date)`
- `daily_statistics(profile_id, stat_date DESC)`, `(stat_date, steps DESC)` for ranking, unique `(profile_id, stat_date)`
- `ai_conversations(profile_id, created_at DESC)`, `(session_id, created_at)`
- `challenge_participants(challenge_id, progress DESC)`, `(profile_id)`
- `app_logs(module, created_at DESC)`

## Constraints

- Range checks: height/weight (0–500), `amount_ml` 1–5000, `duration_minutes` 1–1440, `ai_confidence` 0–1, `health_score` 0–100, non-negative macros/calories.
- `challenges`: `end_date >= start_date`.
- Uniqueness: one settings row per profile, one badge name per profile, one goal/stat row per profile per date, one participation row per challenge per profile.
- Cascades: deleting a profile cascades to all owned rows; `app_logs.profile_id` and `ai_scan_history.food_log_id` use `SET NULL` to preserve audit trails.

## RLS summary

| Table group | Read | Write |
| --- | --- | --- |
| `profiles` | own row | own row |
| `water/food/exercise logs`, `daily_goals`, `daily_statistics`, `ai_conversations`, `ai_recommendations`, `challenge_participants`, `user_badges`, `notifications`, `ai_scan_history`, `user_settings`, `file_assets` | own rows | own rows |
| `health_devices`, `health_samples` | own rows | service role only (native bridge) |
| `challenges` | anyone (active only) | service role only |
| `app_logs` | own rows | service role only |

## Auth flow

1. Supabase Auth creates the user (email/password, Google, or LINE LIFF token exchange).
2. Trigger `on_auth_user_created` → `handle_new_user()` inserts `profiles` + `user_settings`.
3. The client resolves its profile through `useProfile()` (self-healing insert for pre-existing users).

## Native health bridge

`POST /api/public/health-connect/ingest`

```json
{
  "token": "<ingest_token>",
  "platform": "android",
  "appVersion": "1.0.0",
  "samples": [{ "metric": "steps", "value": 8412, "unit": "count", "recorded_at": "2026-08-03T09:00:00Z" }]
}
```

The endpoint validates with Zod, resolves the device by `ingest_token`, stamps `profile_id` from the paired device, upserts on `(device_id, metric, recorded_at)`, and updates `last_sync_at` / `pair_status`.

## Seed data

Three active challenges (10k steps for 7 days, water goal 5 days, burn 2,000 kcal).

## TypeScript types

Generated and kept in sync at `src/integrations/supabase/types.ts`. Row/insert/update helpers:

```ts
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type NewFoodLog = TablesInsert<"food_logs">;
type GoalPatch = TablesUpdate<"daily_goals">;
```

Domain-level aliases and all query/mutation hooks live in `src/lib/db.ts`.
