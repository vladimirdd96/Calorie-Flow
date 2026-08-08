# GitHub Copilot Instructions

Read `AGENTS.md` and `CLAUDE.md` before making changes. They define Calorie Flow's task rules, architecture, checks, and documentation system.

Quick reference:

- Run `npm run docs:list` and read matching domain docs before coding.
- Use `src/lib/env.ts` for app configuration; do not expose secrets with `NEXT_PUBLIC_*`.
- Keep local tracking usable without Supabase or OpenAI configuration.
- Never use a personal Google or Supabase account for agent work. Read `docs/agent-auth.md` and use the disposable local Supabase auth smoke test for login or CI work.
- Run typecheck, lint, and relevant tests before committing.
- Use conventional commits and stage only task-touched files.
