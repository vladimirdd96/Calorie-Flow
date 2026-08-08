<!-- read_when: agent, login, authentication, Supabase, CI, pipeline, browser, visual verification, test account -->

# Agent and CI authentication

## Dedicated hosted staging account

Visual testing uses one dedicated email/password account in the separate `calorie-flow-agent-ui` Supabase project. It has the same migrations and RLS policies as Calorie Flow, but contains no production users or diary data. It exists solely for agents and automated visual checks.

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

## CI configuration

GitHub environment `agent-ui` must contain these secrets:

| Secret | Purpose |
| --- | --- |
| `E2E_SUPABASE_URL` | Isolated staging project URL |
| `E2E_SUPABASE_PUBLISHABLE_KEY` | Isolated staging project public key |
| `E2E_EMAIL` | Dedicated agent account email |
| `E2E_PASSWORD` | Dedicated agent account password |

The `visual-auth` CI job builds the application with the staging URL/key, starts it locally, signs in through agent-browser, and uploads screenshots even when the test fails. It does not start Docker or use a Supabase service-role key.

Rotate the password in Supabase Auth and replace the browser-vault and GitHub environment values together. If credentials are unavailable, visual verification is unavailable; do not bypass the rule with a personal login.
