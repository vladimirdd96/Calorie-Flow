<!-- read_when: agent, login, authentication, Supabase, CI, pipeline, browser, visual verification, test account -->

# Agent authentication and local UI verification

## Dedicated hosted staging account

Visual testing uses one dedicated email/password account in the separate `calorie-flow-agent-ui` Supabase project. It has the same migrations and RLS policies as Calorie Flow, but contains no production users or diary data. It exists solely for agents' local visual checks.

This is deliberately a hosted account—not a Docker fixture—because the visual task is to verify the browser application. The account can sign into a locally built app configured with the staging project's URL and publishable key, which verifies the real Supabase Auth/session/RLS path without touching production.

The staging account is password-only. Do not use Google OAuth, a personal email, a personal browser profile, an anonymous account, or a production test account.

## Local agent workflow

The account credentials and staging configuration live in the system secret store under the `calorie-flow-agent-ui` account. The password is also stored in agent-browser's credential vault as `calorie-flow-agent-ui`; the vault fills the sign-in form without revealing the password to an agent.

Run the app with the staging public configuration retrieved from that secret store, then use the vault profile:

```sh
agent-browser auth login calorie-flow-agent-ui
```

Use a named, encrypted agent-browser session for repeated work. Session state belongs under the ignored `.agent-browser/` directory and must be cleared when the account password rotates. Never save a session, password, JWT, or Supabase secret in the repository.

For a reproducible authenticated visual smoke check, provide the four `E2E_*` environment values through the secret manager and run:

```sh
npm run test:visual
```

It signs in, verifies the authenticated diary shell, and captures phone (`390×844`) and desktop (`1440×960`) screenshots under `artifacts/e2e/`.

## CI boundary

Visual verification is deliberately **not** part of CI. CI runs the regular typecheck, lint, test, and build checks only. Agents must complete the local narrow-and-desktop visual check before pushing UI changes.

When rotating the staging password, update the browser vault and system secret store together. If credentials are unavailable, visual verification is unavailable; do not bypass the rule with a personal login.
