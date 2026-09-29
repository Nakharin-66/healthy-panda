# Guest Onboarding + Google-only Sign-in

## What the current setup has
- Supabase external project and Auth stay as-is. `/` is a splash that auto-jumps to `/dashboard`; `/auth` has email/password + Google (opens a new tab inside the preview).
- `profiles` already has: `user_id`, `display_name`, `gender` (male/female/other/undisclosed), `height_cm`, `weight_kg`, `target_weight_kg`, `activity_level` (sedentary/light/moderate/active/very_active), `friend_code` (auto-created once, locked against change), `created_at`, `updated_at`.
- Missing: `age`, `primary_goal`, `onboarding_completed`.

## Database change (needs your approval)
Add to existing `profiles` only (no new tables):
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age smallint,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
-- validation trigger: age 10–120; primary_goal in
-- ('weight','exercise','daily_activity','nutrition','overall') or null
```
Existing RLS (owner can update own row) already covers these columns. Friend code stays as-is (format kept, one-time, never shown UUIDs).

## New flow
```text
/ (Welcome) -> /onboarding (5 steps, progress bar, back/next) -> /dashboard (guest)
guest action needing save -> Auth modal -> Google (same tab redirect)
Google -> Supabase callback -> /auth -> session check -> sync onboarding -> saved route or /dashboard
```
- Welcome: exact Thai copy requested; returning signed-in users or completed guests go straight to dashboard.
- Onboarding steps 1–5 as specified; step 3 shows target weight only for "ควบคุมน้ำหนัก". Step 4 maps to sedentary/light/moderate/active. Step 5 shows starter steps/day, water/day, exercise minutes/week computed from inputs, labeled "คำแนะนำเบื้องต้น แก้ไขได้ภายหลัง".
- Guest data stored in localStorage (`hp_guest_onboarding`); no Supabase account created.
- After sign-in: read guest data, upsert into the user's own profile (by `auth.users.id`), set `onboarding_completed = true`, then clear localStorage only on success.
- Logout: clears session and returns to Welcome.

## Feature gating
- Guests can open every page; pages show clear empty states (no fake data).
- A shared `useRequireAuth()` + `AuthModal` ("เข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้" / "ข้อมูลของคุณจะถูกบันทึก..." / "ดำเนินการต่อด้วย Google") wraps actions: create goal, log food, save scan, AI coach send, Health Connect, join/create challenge, add friend, log activity, profile edits. The current route is remembered for return.

## Sign-in page
- Title "เข้าสู่ Healthy Panda", subtitle as specified, single "ดำเนินการต่อด้วย Google" button. Email/password and register UI removed.
- `signInWithOAuth` normal redirect, `redirectTo = origin + /auth`; no `window.open`. Note: Google refuses to render inside the editor preview frame, so testing should be done in the opened preview/published tab.

## Checks after build
TypeScript, production build, Welcome/onboarding/guest dashboard via browser, modal appears on gated actions, OAuth URL issued in same tab (no popup), sync logic reviewed; full Google round-trip needs your real account.
