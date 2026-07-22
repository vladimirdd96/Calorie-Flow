# ADR-003: Vertical feature slices for the client app

**Date:** 2026-07-22
**Status:** accepted

## Context

The client app originally accumulated product screens, dialogs, and app-shell coordination in `TrackerApp.tsx`. This makes feature work require unrelated UI and creates unnecessary context load for people and coding agents.

## Decision

Organize client code by product capability under `src/features/<feature>`. A feature owns its UI, local UI state, and a small public API. `src/features/app` owns contracts shared by feature entry points; `src/features/navigation` owns navigation presentation; `TrackerApp`, `AppRuntime`, and `AppShell` are thin composition entries. App-level hooks isolate local-first synchronization, persisted diary actions, and ephemeral UI state.

Cross-feature domain logic, IndexedDB, cloud adapters, and validation remain in `src/lib`. Shared visual primitives belong in a shared layer only when at least two features use them. Features must not read cloud credentials or turn optional cloud/AI services into a requirement for core diary behavior.

## Consequences

**Good:** Smaller change surfaces, clearer ownership, and targeted context for contributors and agents.
**Trade-off:** The app shell must expose intentional callbacks/contracts instead of feature code reaching into sibling state.
