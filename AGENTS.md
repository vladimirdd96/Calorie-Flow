# Agent Task Rules

Apply these rules to every task, regardless of size.

## Before changing code

1. Run `npm run docs:list` and read only documentation whose `read_when` hints match the task.
2. Preserve Calorie Flow's local-first behavior. Cloud sync and AI features must remain optional.
3. Keep browser-safe configuration separate from server-side secrets; never expose a secret through `NEXT_PUBLIC_*`.
4. When fixing a bug, audit every other screen, entry point, and shared component/state path that could exhibit the same behavior. Reproduce or inspect each relevant location and fix all affected instances before handoff; do not limit the fix to the screen named in the report.

## Product and design context

Calorie Flow is a calm, trustworthy, mobile-first nutrition companion. People use it to log food quickly, understand their day at a glance, and keep tracking even when they are offline. The tone is clear, grounded, and supportive—not clinical, gamified, attention-seeking, or generic.

- The existing token system, shared primitives, and live product patterns are the default design language. Reuse and extend them before creating a new treatment.
- `design_handoff_calorie_flow_mobile` is the visual source of truth for the covered screens. When it applies, match its hierarchy, copy, spacing, states, and interactions precisely while preserving real data and local-first behavior.
- `docs/design-coverage.md` maps a requested surface to its source of truth. `docs/ui-patterns.md` owns shared interaction and accessibility conventions.
- Keep the established Avenir-based typography and semantic tokens. Do not add a font, palette, or decorative style that competes with the product’s existing system unless the user explicitly requests a visual redesign.

## UI initiative and craftsmanship

For every UI, component, layout, styling, accessibility, or interaction task, use `$calorie-flow-ui` as the working quality gate. For a new or materially reshaped experience, also use `$impeccable`; the project design context and explicit handoff always take precedence over a general-purpose design skill.

- Inspect the closest existing screen, shared component, and interaction before choosing an implementation. Extend a proven pattern instead of producing a generic UI or a parallel visual language.
- Make ordinary product decisions autonomously from the user’s request, the handoff, and the established system. Ask only when a decision would meaningfully change product behavior, brand direction, or a user-owned choice.
- Treat responsive layout, empty/loading/error states, keyboard focus, action hierarchy, and touch target size as part of the feature—not cleanup for a later pass.
- For a changed flow, visually inspect the actual result, identify defects, and iterate before declaring it ready. Never substitute a code review or typecheck for a rendered UI review.

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
- Use vertical feature slices. A feature's public entry module, components, hooks, contracts, and feature-only helpers belong under `src/features/<feature>/`; do not create pass-through shells or centralise product UI in tracker/route modules.
- Apply SOLID at feature boundaries: give each module one coherent responsibility, depend on callbacks or narrow contracts instead of another feature's internals, and keep persistence/network adapters behind the feature hook or helper that owns that concern.
- Put reusable React state/effect logic in the feature's `hooks/` folder and feature UI in `components/`. Cross-feature consumers may import a feature's documented root API or explicit contract, never its `components/`, `hooks/`, or private helpers.
- Keep production feature modules below 500 lines. Split a growing module by responsibility before extending it; an exception requires a documented architectural decision and a focused test.
- Validate external data at boundaries and avoid unchecked casts.
- Prefer discriminated unions to coordinated boolean flags and define reusable status/role/event values as `as const` objects.
- Keep feature-specific code together and give features explicit public APIs as they grow.

## UI completion gate

- A UI task is not complete when the code merely typechecks. Before reporting completion, render and inspect every changed screen at the narrow phone layout and a wide desktop layout.
- Check the actual rendered result for container width, heading wrapping, control sizing, alignment, overflow, focus states, and action hierarchy. A screenshot with clipped, stacked, oversized, or misaligned controls is a failing check.
- For dialogs and sheets, verify the first and last interactive elements, scrolling behavior, close action, keyboard focus, and the primary action at the target viewport. Fix layout defects before running the final checks.
- Do not mark a UI task complete or push it until the visual check passes. If visual verification is unavailable, report the task as unverified rather than complete.

## Test authentication and UI verification

- Never sign in with a user's personal Google, email, or Supabase account for agent work or CI. Do not create a hosted test user in the production project as a shortcut.
- The required default is the dedicated `calorie-flow-agent-ui` account in the isolated `calorie-flow-agent-ui` Supabase staging project. Use the agent-browser vault profile `calorie-flow-agent-ui`; it logs into the app with the staging account and reuses its persisted session. For a fresh login, retrieve its values only from the system secret store, never from source or shell history.
- Read `docs/agent-auth.md` before any login, authentication, Supabase, pipeline, CI, browser-session, or visual-verification work. It is the source of truth for commands and the narrow exception for a separately provisioned staging account.
- Agent-browser credentials and session state belong only in its encrypted local vault; any exported state must stay in the ignored `.agent-browser/` directory. Never commit credentials, JWTs, storage state, cookies, `.env*`, or a Supabase service-role key. Public anon/publishable keys are not a substitute for an authenticated session.
- Visual verification is a local pre-push requirement for agents, never a CI job. Start the app against the isolated staging project, use the `calorie-flow-agent-ui` vault profile, inspect narrow and desktop layouts, and run `npm run test:visual` when reproducible evidence is needed. Its email, password, and any session must never appear in commands, logs, documentation, or source.
- If the staging account or its secrets are unavailable, report visual verification as unavailable; do not fall back to personal Google authentication or create a production test account.
