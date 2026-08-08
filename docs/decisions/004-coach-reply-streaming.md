# ADR-004: Stream Coach replies

**Date:** 2026-08-08  
**Status:** proposed — deferred, not scheduled

## Context

`src/app/api/coach/route.ts` runs up to four tool-calling turns against Workers AI (reading the profile, reading meals) and then returns one JSON payload: `reply`, plus optional `mealAction`, `mealChoices` and `sources`. Nothing reaches the browser until the whole loop finishes, so the user watches `.coach-typing` for the full duration — commonly 5–15 seconds for a recipe answer.

Two costs follow from that. The user cannot tell whether the Coach understood the question until the answer lands complete, and the Stop button aborts a request whose output was never shown, so stopping always discards everything rather than letting the user cut off an answer that is visibly going the wrong way.

This was raised during the Coach UI rebuild and deliberately left out of it: it is a server architecture change, not a page fix, and a mistake in it breaks meal logging rather than a layout.

## Decision

Not now. Keep the single-payload response. Revisit when there is capacity to do the route rewrite and its testing properly — the owner deferred it on 2026-08-08.

When it is picked up, the shape is: stream text deltas over SSE while the tool loop runs, and emit the structured `mealAction` / `mealChoices` only in a terminal event, because those are known only once the loop completes.

## Consequences

**Good (of deferring):** No risk to the meal-logging tool flow, which is the part of Coach that writes to the diary. The UI work already landed stands on its own.  
**Bad (of deferring):** Perceived latency stays as it is, and Stop remains close to useless — the two most common complaints about a chat that thinks for ten seconds.

Note for planning: streaming does not meaningfully change inference cost, since the same prompt and completion are billed either way. The cost is implementation and test effort, not API spend.

## Alternatives considered

- **Optimistic placeholder text** — rejected; it fakes progress without telling the user anything true about the answer.
- **Streaming the tool loop's intermediate steps too** ("reading your meals…") — possible later, but it exposes internal tool names and needs its own copy pass; not required for the main benefit.

## When implemented, these change with it

- `requestCoachReply` in `src/features/coach/lib/coachApi.ts` — currently `await response.json()` once; becomes a reader over the stream.
- `ask()` in `src/features/coach/hooks/useCoachChats.ts` — appends the assistant message after the request resolves; would need to append early and mutate it as deltas arrive, including on the `regenerate` path that replaces a message in place.
- Abort handling — `AbortError` currently discards the turn; with a partial reply on screen it has to decide whether to keep, mark, or drop what arrived, and whether to persist it via `saveCloudCoachMessage`.
- `docs/api.md` and `docs/ui-patterns.md` — both describe the single-payload contract.
