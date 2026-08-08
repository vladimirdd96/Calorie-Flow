<!-- read_when: agent, login, authentication, Supabase, CI, pipeline, browser, visual verification, test account -->

# Agent and CI authentication

## Default: disposable local Supabase

All agent and CI authentication uses the repository's local Supabase project. It is a complete, disposable database with the committed migrations, no external OAuth provider, and email confirmation disabled **only locally**. `npm run test:auth` creates the fixed local-only email/password account when needed, signs in through Supabase's public Auth API, verifies the account can write/read/delete its own RLS-protected profile, then signs out.

The email and password in that script are fixtures, not credentials: the account exists only inside a developer's local Docker database or a CI job and cannot authenticate with any hosted project.

```sh
supabase start --exclude vector
eval "$(supabase status -o env)"
npm run test:auth
```

For browser verification, start Next with the same values in the current shell:

```sh
eval "$(supabase status -o env)"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" npm run dev
```

Sign in through the app's Email & password form with the local fixture values from `scripts/e2e/auth-smoke.mjs`. Keep any browser storage state under the ignored `.agent-browser/` directory and delete it when the task ends. Never capture a personal or production session.

The `auth-smoke` GitHub Actions job runs the same commands for every main and pull-request CI run. It does not require any GitHub secret and fails if migration or RLS changes break password authentication.

## Hosted staging exception

Use a hosted test account only when a task specifically requires the deployed environment (for example, validating a Cloudflare production integration). It must be a dedicated account in a **separate, non-production Supabase project** with no real diary data. Store its URL, publishable key, email, and password as environment-specific CI secrets or in the developer's secret manager; never put them in `.env.example`, source, docs, shell history, screenshots, or logs.

The local smoke script refuses non-local URLs by design. A hosted smoke check therefore needs an intentionally separate script and an explicit task authorization. It must not use a service-role key, bypass RLS, or create arbitrary users.

## Rules for agents

- Do not use Google OAuth, a personal email, or a user's live browser profile to test the app.
- Do not sign up an account in the production Supabase project for testing.
- Do not disable confirmation, weaken password settings, or change provider settings in the hosted project to make a test easier.
- If Docker/local Supabase is unavailable, say that visual auth verification is unavailable. Do not substitute a personal login.
