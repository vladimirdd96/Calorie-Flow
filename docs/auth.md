<!-- read_when: auth, login, logout, session, token, passwordless, magic link, account, user, sync -->

# Authentication and sync

On a fresh install, Calorie Flow requires users to create or sign into an account before target setup. `src/hooks/useAuth.ts` manages Supabase passwordless magic links, Google OAuth, session recovery, and legacy password recovery events. `src/lib/supabase.ts` creates a browser client only when both public Supabase variables are configured; an unconfigured deployment cannot open the diary.

Signed-in users have a private Supabase-backed copy of their diary.

Open devices subscribe to Realtime changes for the signed-in user's profile,
meals, and foods. A visible-tab focus/visibility refresh and 30-second fallback
poll protect against missed Realtime events. IndexedDB remains the local-first
store, and remote changes are merged before replacing the local snapshot. Meal
deletes are tracked from Realtime delete events so another device cannot
recreate a deleted meal during a concurrent local sync.

The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service-role keys are prohibited. The Cloudflare worker verifies the user's access token before optional AI calls.

The account screen supports magic links and Google OAuth. Auth redirects use the configured canonical app URL in production and the current origin during local development. The canonical production URL is `https://calorie-flow.vladimirdd96.workers.dev`, which must be in Supabase Auth's redirect allow list. Provider credentials live only in Google Cloud and Supabase Auth provider settings; never store them in this repository.

See `CLOUD_SYNC_SETUP.md` for redirect URLs and deployment setup.
