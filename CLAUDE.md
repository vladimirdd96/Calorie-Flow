# Agent Instructions

READ AGENTS.md AS PART OF THE AGENT RULES TOO!

## Core principle

Make the smallest correct change with explicit contracts and a single source of truth. Calorie Flow requires an account, while its IndexedDB cache keeps tracking fast and available offline.

## Docs system

Before writing code, run `npm run docs:list`. Read only the documents whose `read_when` hints match the task:

- `docs/auth.md` — auth, login, session, token, account, sync
- `docs/database.md` — database, migration, schema, SQL, Supabase
- `docs/api.md` — API, endpoint, route, request, response, Workers AI
- `docs/ui-patterns.md` — component, screen, UI, styling, accessibility
- `docs/i18n.md` — text, copy, translation, locale

Update relevant documentation in the same change when an architectural decision or contract changes.

## Commit policy

- Format: `<type>(<scope>): <subject>`; use lowercase, imperative subjects.
- Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`, `revert`.
- Stage only task-touched files. Every completed task should leave a focused commit.

## Branch policy

A task worked on a dedicated branch is not done when the commit is pushed. Before marking the task complete: merge the branch into `main`, push `main`, delete the local branch, and delete the remote branch. If remote branch deletion fails (permissions, proxy), say so explicitly rather than silently leaving it.

## Checks

| Change | Required check |
| --- | --- |
| TypeScript | `npm run typecheck` |
| Any code | `npm run lint` |
| Behavior with tests | `npm test` |
| Supabase authentication, CI, browser login, or visual sign-in | Read `docs/agent-auth.md`; use the `calorie-flow-agent-ui` browser-vault profile and run `npm run test:visual` |

## Agent test authentication

Personal Google and Supabase accounts are prohibited for agent testing. Use the dedicated account in the isolated `calorie-flow-agent-ui` staging project; never add credentials, browser state, or service-role keys to the repository. `docs/agent-auth.md` defines the exact workflow.

## Patterns

### Configuration

Read application configuration through `src/lib/env.ts`; do not introduce new direct `process.env` reads in application code. Public browser variables may be optional for development tooling, but the diary must not open without Supabase configuration. Secrets are server-only and must never use the `NEXT_PUBLIC_` prefix.

### Runtime boundaries

Validate user input and third-party responses at their entry point. Derive types from schemas when practical; do not treat a TypeScript assertion as validation.

### Errors and state

Use typed, explicit return values for expected failures in new business-logic code. Reserve thrown errors for unexpected failures. Prefer discriminated unions over collections of boolean flags, and exhaustively handle states.

### Constants

Do not duplicate route paths, status values, provider names, or event identifiers as magic strings. Use `as const` objects and derive their types when values are shared.

### Responsive design

Every new feature must be responsive. Layouts default to a narrow phone viewport (~360-390px) and progressively enhance for wider screens; never ship a control, action, or piece of text that is clipped, overlapped, or requires horizontal scroll on a phone. After implementing or changing a screen, dialog, or sheet, render it at a narrow phone width and a wide desktop width and check container width, wrapping, control sizing, and overflow before marking the change complete. If visual verification is not possible in the environment, report the change as unverified rather than complete.
