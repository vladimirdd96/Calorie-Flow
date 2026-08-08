<!-- read_when: requirement, search, food library, saved food, catalogue, product behavior -->

# Product requirements log

This is the durable record of product requirements stated in user requests. Read the relevant entries before implementing related work, and append new requirements when a request establishes behavior that should persist.

## Food search — 2026-07-23

- The Food Library has one search experience for saved foods, recipes, previously selected foods, and online catalogue results.
- Local matches are prioritized: personal/custom foods and foods already selected or logged should rank before general reference and online results; recipes are included in the same search.
- Online catalogue lookup remains optional. Saved/local results must continue working offline, and an unavailable online provider must not block adding or selecting local food.
- Barcode scanning, label reading, manual food entry, and quick macros remain separate capture actions; they are not duplicate text-search modes.

## Recipe logging — 2026-07-23

- Recipe logging shows a compact meal and date choice, defaulting to today, and persists the selected calendar date.
- Recipe ingredients can be removed individually with an explicit confirmation; recipe logging does not offer ingredient replacement controls.
- Recipe photos remain visible and editable from the recipe logging sheet.

## Food photos — 2026-07-23

- Photos added to a logged meal or recipe are persisted in the local database and optional cloud sync payload.
- When the logged item is linked to a saved food, its photo is also shown for that food in the Food Library.
- Food photos use the same resized private data-URL format as meal and recipe photos so offline storage remains available.

## Modal sheets — 2026-07-23

- On touch devices, when a modal sheet is scrolled to the top, dragging downward from its body or visible handle by at least 90 px closes it; upward drags continue scrolling content, and shorter downward drags return the sheet to its resting position.

## Nutrition insights averages — 2026-07-23

- Macro values in Insights are averages per logged day, not totals across the seven-day window. The UI must state that only days with logged food are included and compare each average with the user's daily target.

## Meal planning and food library navigation — 2026-07-30

- Meal plans can contain either saved recipes or saved foods. Existing recipe-based plan entries remain valid, and shopping lists continue to use recipe ingredients only.
- When Foods is opened from Plan, the Food Library provides an explicit return action to Plan in addition to the primary navigation.

## Add food quick reuse — 2026-08-04

- The Add Food sheet exposes saved recipes and foods already used in the diary before the user searches.
- Quick-reuse items are ranked by diary usage, with recipe logs counted once even when a recipe creates multiple ingredient rows.
- Selecting a quick-reuse recipe follows the existing recipe portion/logging flow; selecting a food follows the existing food portion flow.

## Desktop workspace and catalogue browsing — 2026-08-05

- Desktop uses a responsive workspace beside the persistent navigation rail; pages may use the extra width purposefully, while forms, diary rows, and conversations retain readable inner measures.
- Plan → Catalogue presents the default browse state as a featured landscape recipe followed by landscape recipe rails. Searching or filtering keeps a practical responsive grid, and every recipe action continues to work from the existing detail flow.

## In-app section navigation — 2026-08-05

- Cross-page links to a tabbed workspace must name both the destination page and its intended tab. For example, the Today weight and fasting shortcuts open the matching Insights histories instead of the default overview.

## Calorie targeting, pace and adaptive maintenance — 2026-08-08

- Goal and pace are editable wherever targets are, not only during onboarding. Onboarding and Profile → Edit targets render the same `TargetEditor`, so the two surfaces cannot drift apart.
- Pace is a percentage of bodyweight per week, not a fixed calorie step, so a pace means the same rate of change at any body size. Each pace shows the calorie target it produces and the weekly rate it implies at the moment it is chosen.
- The target's derivation (BMR → maintenance → pace delta → target) is available on the target itself, collapsed by default.
- No target is recommended below the higher of the user's BMR and a sex-specific floor. When a pace would go lower, the target is held at the floor and the UI says so.
- A user may set their own calorie number. It is reachable through a collapsed disclosure below the calculated path, never a co-equal control, and it is annotated with the deficit and weekly rate it implies. A number above the floor is always accepted.
- Macros respond to the goal: protein rises on a cut and is computed against goal weight, or a BMI-25 reference weight when no goal weight is set, rather than raw bodyweight. Fat has a floor, and a split that cannot fit the target reports the shortfall instead of silently zeroing carbs.
- After enough logged days and weigh-ins, Insights may offer a maintenance figure derived from real intake and the weight trend. It is always a suggestion the user confirms, never applied automatically.
- When a self-set target is exceeded on most logged days for three weeks, Insights offers to rebuild it from real data. Eating under a self-set target is not a failure state and never triggers this.
