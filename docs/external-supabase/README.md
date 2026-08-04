# Rebuilding Healthy Panda on your own (external) Supabase project

This project runs on Lovable Cloud's managed backend, and that cannot be
detached or migrated. To run the same Goals + Exercise logging features on
**your own** Supabase project, create a **new Lovable project with Cloud
disabled** and port the pieces below into it.

## 1. Create the new project

1. Sidebar → **Connectors → Lovable Cloud → Disable Cloud** (this affects
   projects you create from then on).
2. Create a new project.
3. In that project, connect the **Supabase integration** with your own
   Supabase credentials.

## 2. Apply the schema

Run [`schema.sql`](./schema.sql) once in your Supabase SQL editor. It contains,
in dependency order:

- enums, `profiles`, `user_settings` and the `handle_new_user()` signup trigger
- `current_profile_id()` security-definer helper used by every RLS policy
- `set_updated_at()` trigger function
- health/water/food/exercise logs, `daily_goals`, `daily_statistics`
- **Goals & Exercise system**: `activity_types` (with the 25 seeded MET
  activities), `activity_logs` (incl. `distance_km`, `distance_source`,
  `distance_synced`), `exercise_goals`, `goal_progress`
- GRANTs, RLS enablement and all policies

## 3. Copy the app code

Files that carry the Goals/Exercise feature:

| File | Purpose |
| --- | --- |
| `src/lib/activities.ts` | queries, mutations, MET calorie math, distance helpers, realtime |
| `src/lib/db.ts` | profile + shared data hooks |
| `src/components/ActivityTypeDialog.tsx` | create/edit activity types |
| `src/components/ActivityLogDialog.tsx` | log a workout (duration, distance, source) |
| `src/components/GoalDialog.tsx` | create/edit exercise goals |
| `src/components/ActivityIcon.tsx` | icon mapping |
| `src/routes/goals.tsx` | Goals screen (achievement bar, tabs, weekly summary) |
| `src/hooks/useAuth.ts`, `src/routes/auth.tsx` | sign-in |
| `src/styles.css` | design tokens (orange/cream/chocolate theme, Nunito) |

Do **not** copy `src/integrations/supabase/*` — those files are generated per
project and will point at the wrong backend.

## 4. Regenerate types

After the schema is applied, regenerate `src/integrations/supabase/types.ts` in
the new project so `activity_types` / `activity_logs` / `exercise_goals` are
typed.

## 5. Move data (optional)

Export from this project via **Cloud → Advanced settings → Export data**, then
import the CSVs into the matching tables in your Supabase project. Insert
`profiles` first, then the log tables, since everything is keyed by
`profile_id`.
