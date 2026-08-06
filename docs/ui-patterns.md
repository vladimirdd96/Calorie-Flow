<!-- read_when: component, screen, UI, layout, style, design, theme, accessibility, PWA, mobile -->

# UI patterns

`src/app/page.tsx` is the Next.js route boundary and imports the sole client entry point, `src/features/tracker/TrackerApp.tsx`. The tracker feature owns cross-feature orchestration only: `useLocalFirstData`, `useTrackerActions`, and `useTrackerUiState` isolate synchronization, persisted diary mutations, and ephemeral UI state. Product UI remains in its vertical slice under `src/features/`; do not add pass-through components or an `app` feature folder just to re-export another component. Keep the daily log fast and understandable on a phone-sized viewport, with advanced tools in progressive disclosure.

Each slice exposes a small root API and owns its own `components/`, `hooks/`, contracts, and feature-only helpers. Components render one cohesive concern; hooks own a focused state/effect boundary; cross-feature coordination passes narrow callbacks or contracts rather than importing another feature's private folders. Production feature modules have a 500-line guard, so split by responsibility before a file grows into a god component.

Nutrition data is health-adjacent: label estimates clearly, avoid medical claims, and preserve the user's existing entries unless they explicitly confirm a replacement. The app must remain useful offline through its signed-in local cache.

Use semantic controls, visible labels, keyboard-accessible dialogs, and sufficient contrast. Modal sheets must trap focus, restore it when closed, and make the underlying app inert. Keep destructive diary actions recoverable with an Undo window where practical. Never hide a required action at a mobile breakpoint. Test any UI behavior that affects nutrition calculations or persisted diary data.

### Sheet scrolling

`.sheet-backdrop` owns the scroll for ordinary sheets, so the scrollbar sits outside the sheet surface instead of on its inner rounded edge. The sheet itself has `overflow: visible`, no `max-height`, and `margin-top: auto` for bottom anchoring. Full-height shells (`.add-food-sheet-shell`) are the exception: they fill the viewport and keep their own scroller, with the backdrop set to `overflow: hidden`. Drag-to-dismiss gating in `src/features/shared/Sheet.tsx` reads `scrollOffset()`, which takes whichever of the two actually scrolled; the backdrop's click-to-close ignores presses that start in the scrollbar gutter.

Sheets that open with a hero photo pull it up past the sheet's top padding and drag handle (`margin-top: -30px`), so the handle and close button float over the image; both carry `z-index: 2` to paint above it.

### Diary hero and optional habits

The hero card (`TodaySummary`) carries nutrition only: the day navigator straddling its top edge, the calorie ring, macro targets, and the full-nutrition disclosure. Optional habits — fasting, weight, water — live in `HabitStrip` (`src/features/diary/components/HabitStrip.tsx`), one tile row directly below the hero. Each enabled habit contributes a tile; the strip renders nothing when all three are off, and a single remaining tile lays out horizontally instead of as a lone column.

A tile opens that habit's `Sheet`, not an inline panel: current value, a seven-point trend, and only the controls needed to log today (fasting goal chips, one weight field, water plus/minus). Deeper editing stays in Insights, reached from the sheet's history link via `onOpenInsights`. Add a new optional habit by extending `habitTileKeys` and its sheet, not by putting another control back in the hero.

### Signaling a configurable feature

When a card or section surfaces a value the user can tune (a target, a threshold, a preference), add `ConfigShortcut` (`src/features/shared/ConfigShortcut.tsx`) rather than inventing a settings affordance per feature. It renders the shared `.config-shortcut` ghost icon-button (`SlidersHorizontal`, dimmed until hover/focus) and takes a single `onClick`. It never opens an inline settings sheet — wire `onClick` to `navigateTo` (the `AppNavigationTarget` contract in `src/features/navigation/types.ts`) so it redirects to the feature's real configuration screen, the same one reachable from Profile.

Placement follows one rule: the shortcut is always the first/outermost element in whatever occupies the card's top-right.
- Empty corner (e.g. `.today-hero`) — it floats there alone via `position: absolute; top; right` on the card.
- An existing top-right action row (e.g. a card's own icon-button cluster) — it becomes the leading item in that row instead of a separate floating element, so it never overlaps existing controls.

See `TodaySummary.tsx`'s `onOpenTargets` prop for the reference wiring: `TodayView` → `TrackerApp`'s `navigateTo({ tab: "profile", section: "profile" })`.

### Catalogue browse rails

Unfiltered catalogue browsing is a stack of rails, not one flat list. `catalogueRailSpecs` (`src/features/planning/cataloguePresentation.ts`) is the single ordered source of truth: a fresh-picks rail, one rail per cuisine, one per dietary tag, then community. Rails are grouped by what a user browses for, never by provenance — image attribution belongs on the card and in `RecipeDetail`, not in a rail title.

Two rules keep the stack readable, and both live in `claimRailItems`. A recipe appears in exactly one rail: rails claim in spec order, and a later rail skips anything already claimed. No rail exceeds `RAIL_CAP`, so an early rail cannot drain the catalogue before the ones below it claim their slice; a rail that cannot reach `RAIL_MIN_ITEMS` is dropped rather than rendered half-empty.

`useCatalogueRails` (`src/features/planning/hooks/useCatalogueRails.ts`) fetches a batch of rails at a time, each with its own `fetchCatalogue` query, and an `IntersectionObserver` in `CatalogueRails` loads the next batch before it scrolls into view. Batches must resolve in spec order because claiming does — do not fetch a later rail ahead of an earlier one. The hook has no reset path: `CatalogueRails` is mounted only while no filter is active, and unmounting is what clears the claims. Applying a filter replaces the rails entirely with the flat `.catalogue-grid`.

Rail scroll controls (`.catalogue-row-control`) are edge-anchored scrims spanning the track, carrying a chevron and no other chrome. They show on every viewport, dimmed on pointer devices until the row is hovered, and are never hidden outright — a control the user cannot find is worse than one that is always faintly present.
