# Agent Task Rules

Apply these rules to every task, regardless of size.

## Before changing code

1. Run `npm run docs:list` and read only documentation whose `read_when` hints match the task.
2. Preserve Calorie Flow's local-first behavior. Cloud sync and AI features must remain optional.
3. Keep browser-safe configuration separate from server-side secrets; never expose a secret through `NEXT_PUBLIC_*`.

## Commits and checks

- Use conventional commits: `<type>(<scope>): <subject>`.
- Stage only files touched by the task; never use `git add .`.
- Run `npm run typecheck` for TypeScript changes and `npm run lint` for any code change. Run `npm test` when behavior is covered by tests.
- Do not bypass hooks or commit a task that has failing relevant checks.

## Scope and design

- Do not include unrelated cleanup in a task commit; record it as a follow-up instead.
- Validate external data at boundaries and avoid unchecked casts.
- Prefer discriminated unions to coordinated boolean flags and define reusable status/role/event values as `as const` objects.
- Keep feature-specific code together and give features explicit public APIs as they grow.
