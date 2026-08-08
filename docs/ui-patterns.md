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

### Meal photo capture and review

`MealPhotoReader` (`src/features/food-capture/components/MealPhotoReader.tsx`) owns one linear flow — capture → analyzing → review, or capture → failed — as a discriminated `Phase` union rather than a set of booleans. The camera opens on an explicit tap, never on mount: mobile browsers gate `getUserMedia` behind a user gesture, and an unrequested permission prompt reads as an ambush. The stream is released whenever the sheet leaves the capture step.

`MealPhotoReview` is where a photo estimate becomes trustworthy, and it is the only place a photo meal can be logged from — the flow never hands off to `MealEditor`. It shows the item breakdown the endpoint returned and lets the user rename the dish, re-weigh a food (macros scale with the grams), exclude one, add a missed one, or apply a Smaller/As shown/Larger multiplier to the whole plate; totals recompute from whatever remains included. The free-text hint field re-runs the estimate with the user's own words, which corrects invisible calories — oil, sauces, portion size — far more cheaply than editing six macro fields.

Portion arithmetic lives in `src/features/food-capture/mealPhoto.ts`, not in the component, and is unit-tested: scaling always re-derives from the model's original items so repeated chip taps cannot compound. Every entry this flow writes is marked `estimated`, whatever confidence the model reported, and carries the photo as its `imageUrl`.

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

### Coach conversation surface

`CoachView` (`src/features/coach/CoachView.tsx`) is orchestration only: it resolves the gates (unconfigured, signed out, loading), derives conversation starters from today's lowest tracked macros, and wires three presentational children. All conversation state — chats, the active thread, the draft, the attachment, loading, and errors — belongs to `useCoachChats` (`src/features/coach/hooks/useCoachChats.ts`); the endpoint contract and image downscaling live in `lib/coachApi.ts`.

The thread is a flex column, not a block: that is what makes the message gap apply and lets `.coach-message.user` take `align-self: flex-end` so a question and its answer sit on opposite sides. Do not give `.coach-thread` a `display` that drops flex, and do not add per-message role captions — the side and fill already say who is speaking. Consecutive messages are grouped under a `.coach-day-divider` whenever the day changes.

One input bar, one plus menu. Everything that hands the Coach an image — attach a photo, scan a barcode, read a label — is a `role="menuitem"` inside `.coach-attach-menu`; never add a second row of capture buttons above the composer. `.coach-composer` must keep its `display: grid`, since its `grid-template-columns` is what keeps the plus, the auto-growing textarea and the send button on one line. The textarea grows to `MAX_ROWS_HEIGHT` and sends on Enter, with Shift+Enter for a newline, so keep the placeholder short enough to fit a 360px phone on one line.

Per-message actions live in one `⋯` menu (`.coach-message-menu`): Copy always, Regenerate only on the newest assistant reply, and Edit & resend only on a question. Edit & resend rewinds the thread — it deletes that message and everything after it locally and through `deleteCloudCoachMessages`, then puts the text back in the composer — so an edited question replaces its original instead of stacking a near-duplicate.

Failures are a `CoachError` discriminated union, not a string, because the recovery differs: `history` offers Reload, `reply` offers Try again and re-asks the last question, and `sync`/`notice` are dismiss-only. Never wire a generic Retry that reloads the whole history for an error that had nothing to do with it. Everything scoped to one conversation — draft, attachment, logged meal choices, the error — is cleared by `resetConversationState` on every chat switch; logged choices are keyed by message id **and** label so the same label in another chat is not shown as already logged.

The chat list is a sidebar that docks at 900px and is an edge-flush drawer below that, with its own focus trap and Escape handling. It owns `New chat`, search, and the cross-link into the grocery lists. Unsaved draft conversations appear in the list like any other chat, so the active row is never empty.

Coach is reached from the Today header action (`.today-coach-button`) and the Profile link row, not from `BottomNav`. The nav carries four destinations plus the add action; a fifth destination there costs every other item the width that keeps it usable one-handed, so route new entry points through an existing screen instead of adding a slot.

### Grocery lists

Grocery lists are their own slice (`src/features/groceries`) and live in the Library's **Shopping** tab, next to the plan-derived `ShoppingList`. Coach only links to them: an assistant reply offering a recipe adds its ingredients through `ChooseGroceryListSheet` (or straight to the only list) and then navigates to `{ tab: "plan", section: "shopping" }`. Do not re-add a grocery section to Coach.

`useGroceryLists` stores state as `{ key, lists }` where `key` is the per-account setting key, so a signed-out or mid-switch render yields an empty list rather than the previous account's groceries. Every list operation — pick, create, rename, delete — is one `.grocery-list-menu` dropdown on the list name; deleting the last list leaves a fresh empty one instead of an unusable workspace. The shopping tab is always available, whether or not meal planning is enabled.
### Calorie targets, pace and the manual override

`TargetEditor` (`src/features/profile/components/ProfileTargets.tsx`) is the only editor for goal, pace and targets, and it renders both the onboarding wizard and the Profile → Edit targets sheet from one component. Do not add a second target-editing surface: goal and pace were previously reachable only during onboarding, and the resulting dead end — a user could revisit nothing but the raw number — is the defect this pattern exists to prevent.

A control that determines a number must show that number. `GoalPacePicker` renders each pace as a card carrying both the calorie target it produces and the weekly rate it implies, because a pace on one step with its result on the next is a choice made blind. The same rule drives `.target-derivation`: the arithmetic is one tap from the target, collapsed, so the number can be checked without being explained at people.

The manual override is deliberately quiet. `CustomCalorieOverride` sits last on the surface in a collapsed `nutrition-goals-advanced` disclosure — the same pattern as other optional settings — rather than a segmented control beside the calculated path. It is an escape hatch, not a second first-class route, and presenting it as an equal choice pushes people into hand-picking numbers they have no basis for. A typed number above the safety floor is always accepted; it is annotated with the deficit and weekly rate it implies (`describeCustomTarget`), never blocked.

Energy math lives in `src/lib/energy.ts` and `src/lib/adaptiveEnergy.ts`, never in components — vitest matches `.test.ts` only, so anything worth testing must sit outside the JSX. `normalizeCalorieTarget` in `saveProfile` keeps `calorieTarget` consistent with its inputs, so no editor has to remember to recompute; it must return the identical object reference when nothing changed, or the self-healing effect in `useLocalFirstData` will loop.

Suggestion cards in Insights (`MaintenanceSuggestion`) offer and never apply. Nutrition data is health-adjacent, so a change to a target is always the user's to confirm, the copy attributes a missed target to the number rather than the person, and at most one card shows at a time.