<!-- read_when: component, screen, UI, layout, style, design, theme, accessibility, PWA, mobile -->

# UI patterns

`src/app/page.tsx` is the Next.js route boundary and imports the sole client entry point, `src/features/tracker/TrackerApp.tsx`. The tracker feature owns cross-feature orchestration only: `useLocalFirstData`, `useTrackerActions`, and `useTrackerUiState` isolate synchronization, persisted diary mutations, and ephemeral UI state. Product UI remains in its vertical slice under `src/features/`; do not add pass-through components or an `app` feature folder just to re-export another component. Keep the daily log fast and understandable on a phone-sized viewport, with advanced tools in progressive disclosure.

Each slice exposes a small root API and owns its own `components/`, `hooks/`, contracts, and feature-only helpers. Components render one cohesive concern; hooks own a focused state/effect boundary; cross-feature coordination passes narrow callbacks or contracts rather than importing another feature's private folders. Production feature modules have a 500-line guard, so split by responsibility before a file grows into a god component.

Nutrition data is health-adjacent: label estimates clearly, avoid medical claims, and preserve the user's existing entries unless they explicitly confirm a replacement. The app must remain useful offline through its signed-in local cache.

Use semantic controls, visible labels, keyboard-accessible dialogs, and sufficient contrast. Modal sheets must trap focus, restore it when closed, and make the underlying app inert. Keep destructive diary actions recoverable with an Undo window where practical. Never hide a required action at a mobile breakpoint. Test any UI behavior that affects nutrition calculations or persisted diary data.

### Signaling a configurable feature

When a card or section surfaces a value the user can tune (a target, a threshold, a preference), add `ConfigShortcut` (`src/features/shared/ConfigShortcut.tsx`) rather than inventing a settings affordance per feature. It renders the shared `.config-shortcut` ghost icon-button (`SlidersHorizontal`, dimmed until hover/focus) and takes a single `onClick`. It never opens an inline settings sheet — wire `onClick` to `navigateTo` (the `AppNavigationTarget` contract in `src/features/navigation/types.ts`) so it redirects to the feature's real configuration screen, the same one reachable from Profile.

Placement follows one rule: the shortcut is always the first/outermost element in whatever occupies the card's top-right.
- Empty corner (e.g. `.today-hero`) — it floats there alone via `position: absolute; top; right` on the card.
- An existing top-right action row (e.g. a card's own icon-button cluster) — it becomes the leading item in that row instead of a separate floating element, so it never overlaps existing controls.

See `TodaySummary.tsx`'s `onOpenTargets` prop for the reference wiring: `TodayView` → `TrackerApp`'s `navigateTo({ tab: "profile", section: "profile" })`.
