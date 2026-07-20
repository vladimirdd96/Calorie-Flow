<!-- read_when: auth, login, logout, session, token, passwordless, magic link, account, user, sync -->

# Authentication and sync

Calorie Flow runs in guest mode by default. `src/hooks/useAuth.ts` manages optional Supabase passwordless authentication, and `src/lib/supabase.ts` creates a browser client only when both public Supabase variables are configured.

Guest records remain in IndexedDB. Signed-in users can opt into a private Supabase-backed copy. Never make an account a prerequisite for adding or viewing meals.

The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role keys are prohibited. The Cloudflare worker verifies the user's access token before paid AI calls.

The account screen supports magic links plus Google and Apple OAuth. OAuth always redirects back to `window.location.origin`, so each local and production app URL must be in Supabase Auth's redirect allow list. Provider credentials live only in Google Cloud, Apple Developer, and Supabase Auth provider settings; never store them in this repository.

See `CLOUD_SYNC_SETUP.md` for redirect URLs and deployment setup.
