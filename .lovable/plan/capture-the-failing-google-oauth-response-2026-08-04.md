# Capture the failing Google OAuth response

1. Wait for the Google account-selection and consent flow to reach the reported failure.
2. Inspect the browser network snapshot for the Google response and Supabase callback request.
3. Record the full authorize URL, HTTP response status, callback URL, and literal OAuth error parameter/message.
4. Report the confirmed reason without changing application code or inferring from redirect configuration.

## Scope

Diagnostic inspection only. No source code, Supabase configuration, or OAuth settings will be modified.