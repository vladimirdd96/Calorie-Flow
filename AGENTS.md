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
- Once a task is complete, all relevant checks pass, and the UI has been verified when applicable, push the task commit so deployment is triggered before reporting completion.

## Scope and design

- Do not include unrelated cleanup in a task commit; record it as a follow-up instead.
- Validate external data at boundaries and avoid unchecked casts.
- Prefer discriminated unions to coordinated boolean flags and define reusable status/role/event values as `as const` objects.
- Keep feature-specific code together and give features explicit public APIs as they grow.

## UI completion gate

- A UI task is not complete when the code merely typechecks. Before reporting completion, render and inspect every changed screen at the narrow phone layout and a wide desktop layout.
- Check the actual rendered result for container width, heading wrapping, control sizing, alignment, overflow, focus states, and action hierarchy. A screenshot with clipped, stacked, oversized, or misaligned controls is a failing check.
- For dialogs and sheets, verify the first and last interactive elements, scrolling behavior, close action, keyboard focus, and the primary action at the target viewport. Fix layout defects before running the final checks.
- Do not mark a UI task complete or push it until the visual check passes. If visual verification is unavailable, report the task as unverified rather than complete.
