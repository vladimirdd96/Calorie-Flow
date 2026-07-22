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
- Work directly on `main` by default. Do not create or use a separate task branch unless explicitly requested.
- If a task branch is used, it must be merged into `main`, the updated `main` branch must be pushed to trigger deployment, and both the local and remote task branches must be deleted before reporting completion.
- Never report a task complete while its changes exist only on a task branch or have not been pushed from `main`.
- Once a task is complete, all relevant checks pass, and the UI has been verified when applicable, push `main` so deployment is triggered before reporting completion.

## Autonomous completion

- Treat an implementation request as an end-to-end commitment: investigate, implement, test, visually verify UI work, commit, and push without waiting for another prompt.
- Do not pause after an intermediate milestone. Ask the user only when a required decision would materially change product behavior or needs authority outside this repository.
- If a safe decision can be made from the codebase, existing documentation, and task intent, make it and record the rationale in the final handoff.
- **No partial handoffs:** Do not send a final response for an implementation task while required work remains. The only permitted exception is a specific, external blocker that has been exhaustively checked and cannot be resolved without user authority or input. A test failure, a large remaining refactor, an intermediate extraction, or unavailable convenience tooling is not a completion condition.

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

## Local UI test sign-in

- For local visual testing only, agents may use the user's designated Google account to sign in through the existing Google flow. This authorization does not cover sending email, changing account settings, granting permissions, or accessing unrelated Google services.
