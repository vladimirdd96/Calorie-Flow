<!-- read_when: auth, login, logout, session, token, passwordless, magic link, account, user, sync -->

# Authentication and sync

On a fresh install with Supabase configured, Calorie Flow asks whether to create/sign into an account before target setup. Users can choose Continue as guest, preserving local-first use. Account setup remains available in Targets. `src/hooks/useAuth.ts` manages Supabase passwordless magic links, Google OAuth, session recovery, and legacy password recovery events. `src/lib/supabase.ts` creates a browser client only when both public Supabase variables are configured.

Signed-in users have a private Supabase-backed copy of their diary.

The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role keys are prohibited. The Cloudflare worker verifies the user's access token before paid AI calls.

The account screen supports magic links and Google OAuth. Auth redirects always return to `window.location.origin`, so each local and production app URL must be in Supabase Auth's redirect allow list. Provider credentials live only in Google Cloud and Supabase Auth provider settings; never store them in this repository.

See `CLOUD_SYNC_SETUP.md` for redirect URLs and deployment setup.
