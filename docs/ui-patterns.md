<!-- read_when: component, screen, UI, layout, style, design, theme, accessibility, PWA, mobile -->

# UI patterns

`src/app/page.tsx` is the Next.js route boundary and imports the sole client entry point, `src/features/tracker/TrackerApp.tsx`. The tracker feature owns cross-feature orchestration only: `useLocalFirstData`, `useTrackerActions`, and `useTrackerUiState` isolate synchronization, persisted diary mutations, and ephemeral UI state. Product UI remains in its vertical slice under `src/features/`; do not add pass-through components or an `app` feature folder just to re-export another component. Keep the daily log fast and understandable on a phone-sized viewport, with advanced tools in progressive disclosure.

Each slice exposes a small root API and owns its own `components/`, `hooks/`, contracts, and feature-only helpers. Components render one cohesive concern; hooks own a focused state/effect boundary; cross-feature coordination passes narrow callbacks or contracts rather than importing another feature's private folders. Production feature modules have a 500-line guard, so split by responsibility before a file grows into a god component.

Nutrition data is health-adjacent: label estimates clearly, avoid medical claims, and preserve the user's existing entries unless they explicitly confirm a replacement. The app must remain useful offline through its signed-in local cache.

Use semantic controls, visible labels, keyboard-accessible dialogs, and sufficient contrast. Modal sheets must trap focus, restore it when closed, and make the underlying app inert. Keep destructive diary actions recoverable with an Undo window where practical. Never hide a required action at a mobile breakpoint. Test any UI behavior that affects nutrition calculations or persisted diary data.
