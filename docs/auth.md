<!-- read_when: auth, login, logout, session, token, passwordless, magic link, account, user, sync -->

# Authentication and sync

Calorie Flow opens an account gateway on the first visit, while preserving local-only use as an explicit choice. `src/hooks/useAuth.ts` manages Supabase email/password registration, password recovery, magic links, and Google OAuth. `src/lib/supabase.ts` creates a browser client only when both public Supabase variables are configured.

Guest records remain in IndexedDB. Signed-in users can opt into a private Supabase-backed copy. Never make an account a prerequisite for adding or viewing meals.

The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role keys are prohibited. The Cloudflare worker verifies the user's access token before paid AI calls.

The account screen supports email/password, password recovery, magic links, and Google OAuth. Auth redirects always return to `window.location.origin`, so each local and production app URL must be in Supabase Auth's redirect allow list. Provider credentials live only in Google Cloud and Supabase Auth provider settings; never store them in this repository.

See `CLOUD_SYNC_SETUP.md` for redirect URLs and deployment setup.
