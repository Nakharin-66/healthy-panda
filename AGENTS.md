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
