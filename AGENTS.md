<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Guest onboarding lives in localStorage (`hp_guest_onboarding`, src/lib/guest.ts) and syncs to `profiles` after Google sign-in; why: no Supabase account until the user needs saving.
- Sign-in is Google-only via same-tab `signInWithOAuth` redirect to /auth; why: no popups/new tabs, one flow for login and signup.

- Coach chat uses a single database conversation and an authenticated server function; history and health context are loaded server-side to prevent client-supplied health records or cross-user history.
- Coach new-chat boundaries are profile-scoped browser timestamps passed to the authenticated history query; daily history deletion uses the existing signed-in Supabase client and RLS, preserving system denial rows.
- Coach uses AI Elements message/composer primitives with a final-result server-function contract; upstream generation is streamed and consumed server-side because this feature returns a reply DTO.
- Day boundaries use Asia/Bangkok via src/lib/bkk.ts; why: UTC slicing put early-morning Thai entries on the previous day.
- Water day and range queries share profile-scoped optimistic cache updates; why: edits from history must update today's total only when the entry belongs to today.
- LINE MINI App startup initializes a dynamically imported LIFF SDK in a browser effect and validates destinations against content routes before preserving them through the existing OAuth return state; why: LINE encodes deep links in liff.state rather than the app endpoint pathname.
