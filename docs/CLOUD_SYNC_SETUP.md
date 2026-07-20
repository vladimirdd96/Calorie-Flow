# Cloud sync and AI Coach setup

Calorie Flow works without an account. These steps enable passwordless accounts, cross-device sync, private coach history, AI label reading, and the nutrition Coach.

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/202607180001_user_sync.sql`.
3. In **Authentication → URL Configuration**, set:
   - Site URL: `https://calorie-flow.vladimirdd96.chatgpt.site`
   - Redirect URL: `https://calorie-flow.vladimirdd96.chatgpt.site/**`
4. Keep email authentication enabled. The app uses passwordless magic links.

The migration enables Row Level Security on every user table. The browser receives only the Supabase publishable key; never expose the service-role key.

## 2. Configure build-time variables

Create `.env.local` for local builds:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

## 3. Configure production runtime variables

Set these on the deployed Worker/Sites project:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_COACH_MODEL=gpt-5.6-sol
OPENAI_LABEL_MODEL=gpt-4.1-mini
```

The OpenAI key stays server-side. A ChatGPT subscription does not include API usage, so the project needs an API key from the OpenAI Platform account.

## 4. Verify

1. Request a sign-in link from **Targets → Account & sync**.
2. Log a meal, then sign in on another device and confirm it appears.
3. Open **Coach** and ask “How am I doing today?”
4. Ask “Find a high-protein lunch near Sofia” to verify food-place web search.
5. Ask the Coach to write code; it should decline and redirect to nutrition.

## 5. Enable GitHub deployments

The `Deploy to Cloudflare` workflow deploys the Worker after every push to `main`.
Create a GitHub Actions environment named `production`, then add these environment secrets:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_scoped_workers_deployment_token
```

Create the token in Cloudflare with the **Edit Cloudflare Workers** template, scoped only to the account (and zone, if applicable) that owns Calorie Flow. Do not add OpenAI or Supabase runtime credentials to GitHub: manage those as Cloudflare Worker secrets or dashboard variables so deployments do not copy application secrets through GitHub.
