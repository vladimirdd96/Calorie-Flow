# Agent Instructions

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

## Checks

| Change | Required check |
| --- | --- |
| TypeScript | `npm run typecheck` |
| Any code | `npm run lint` |
| Behavior with tests | `npm test` |

## Patterns

### Configuration

Read application configuration through `src/lib/env.ts`; do not introduce new direct `process.env` reads in application code. Public browser variables may be optional for development tooling, but the diary must not open without Supabase configuration. Secrets are server-only and must never use the `NEXT_PUBLIC_` prefix.

### Runtime boundaries

Validate user input and third-party responses at their entry point. Derive types from schemas when practical; do not treat a TypeScript assertion as validation.

### Errors and state

Use typed, explicit return values for expected failures in new business-logic code. Reserve thrown errors for unexpected failures. Prefer discriminated unions over collections of boolean flags, and exhaustively handle states.

### Constants

Do not duplicate route paths, status values, provider names, or event identifiers as magic strings. Use `as const` objects and derive their types when values are shared.
