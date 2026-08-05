# Handoff: Calorie Flow — Full Mobile App Rework (inch-for-inch)

## Overview
Eight HTML/JS mockups define the complete mobile UI for Calorie Flow: Today, Add Food, Auth, Coach, Foods/Plan, Insights, Onboarding, Profile. The goal is to rework the real Next.js codebase so every screen matches these mockups **exactly** — layout, spacing, copy, colors, states, and interactions — while keeping the app wired to its real data/services (nothing here should be shipped as static HTML).

## About the Design Files
The `.dc.html` files in this bundle are **design references**, not production code. They're standalone prototypes with fixture data and inline styles (a proprietary preview format's structure — ignore `<x-dc>`/`<sc-if>`/`<sc-for>`/`data-dc-script` wrapper tags; read them as plain markup + a plain JS class with `state` and a `renderVals()` method describing props/handlers). The task is to **recreate this markup, styling, and behavior as React/TSX inside the existing codebase's conventions** (feature folders under `src/features/*`, the existing `Profile`/`Meal`/`Nutrition` types in `src/lib/types.ts`, the existing hooks in `src/features/tracker/hooks/*`), not to copy the HTML in verbatim.

## Fidelity
**High-fidelity.** Every screen is a finished mock: exact copy, exact colors (as CSS custom properties, listed below), exact spacing, exact icon set (lucide), exact component states (empty/expanded/error/loading where shown). Match pixel values as given — do not "improve" spacing or copy.

## IMPORTANT — design tokens: reconcile, don't duplicate
The mockups define their own token namespace (`--cf-bg`, `--cf-card`, `--cf-green`, `--cf-amber`, `--cf-terracotta`, `--cf-blue`, `--cf-orange`, `--cf-text`, `--cf-muted`, `--cf-muted-2`, `--cf-border`, `--cf-border-strong`, `--cf-solid-bg`, `--cf-solid-text`, `--cf-input-bg`, `--cf-icon-muted`) with light/dark values hardcoded in each file's `<style>` block. **The real app already has an equivalent, more complete token system** in `src/app/globals.css` (`--bg`, `--bg-soft`, `--panel`, `--panel-strong`, `--panel-soft`, `--border`, `--border-strong`, `--line`, `--text`, `--muted`, `--muted-2`, `--mint`, `--mint-strong`, `--protein`, `--carbs`, `--fat`, `--blue`, `--amber`, `--red`, `--track`, `--control-surface*`), sourced from the bound CalorieFlowDS design system (oklch-based, theme-aware via `html[data-theme="dark"]`).

Do **not** introduce the `--cf-*` variables into the real app. Map every color in the mockups onto the real token it approximates:

| Mockup token | Real token | Notes |
|---|---|---|
| `--cf-bg` | `--bg` | page background |
| `--cf-card` | `--panel` | card surfaces |
| `--cf-input-bg` | `--control-surface` or `--panel-soft` | inputs |
| `--cf-text` | `--text` | primary text |
| `--cf-muted` | `--muted` | secondary text |
| `--cf-muted-2` | `--muted-2` | tertiary text |
| `--cf-border` | `--border` | hairlines |
| `--cf-border-strong` | `--border-strong` | dashed dividers, stronger borders |
| `--cf-icon-muted` | `--muted-2` | muted icons |
| `--cf-solid-bg` / `--cf-solid-text` | invert of `--text`/`--bg` — use `--text`/`--bg` (the app's high-contrast solid button already exists as `.primary-button`-style solid fill; reuse it) |
| `--cf-green` | `--mint` (or `--protein` when specifically labeling protein) | primary brand/action green |
| `--cf-amber` / `--cf-orange` | `--carbs` (amber) | secondary accent, carbs |
| `--cf-terracotta` | `--fat` | fat / destructive-adjacent warm accent |
| `--cf-blue` | `--blue` | fibre / water / info accent |
| (red/destructive) | `--red` | delete actions |

Where a mockup hardcodes an rgba tint (e.g. `rgba(50,109,54,.1)` for icon chips, `rgba(60,40,20,.12)` shadows), reproduce the same *effect* (soft tinted background, soft warm shadow) using `color-mix(in oklch, var(--mint) 10%, transparent)` / `var(--shadow)` conventions already used elsewhere in `globals.css` (see `.empty-icon`, `.meal-icon`, `.ring-tooltip` for the pattern) rather than new literals.

Font: mockups use Google Fonts "Quicksand". The real app uses `"Avenir Next", Avenir, "Helvetica Neue", sans-serif` (set in `_ds_bundle.css`/`globals.css`). **Keep the app's existing font** — this is a token/typeface decision already made by the bound design system; do not add Quicksand. Font sizes/weights/letter-spacing from the mockups should still be matched at the CSS level.

Icons: mockups use `lucide` via a CDN `<script>` + `data-lucide` attributes. The real app already imports `lucide-react` components directly (see `DiaryView.tsx` imports) — use the same icon names as React components (e.g. `data-lucide="drumstick"` → `<Drumstick />`), not the CDN script.

## Screens → Real Files

### 1. Today — `Calorie Flow - Today (Mobile).dc.html`
- **Real files**: `src/features/diary/DiaryView.tsx`, `src/features/diary/components/DiaryPrimitives.tsx` (`ProgressRing`, `MiniProgressRing`), `src/app/globals.css` (`.hero-card`, `.macro-card`, `.progress-ring`, `.ring-*`, `.meal-*`, `.hero-stat-grid`), hooks in `src/features/tracker/hooks/*`.
- **What's new vs. the current implementation** — add to `DiaryView.tsx`/`DiaryPrimitives.tsx`:
  - Header: greeting eyebrow ("Good afternoon") above "Calorie Flow" wordmark; date pill becomes a segmented control (prev/label/next) inline in the header instead of a separate row; a Coach icon-button in the header.
  - Hero card top row: two pill toggle buttons ("Fasting since…" timer icon, "Weight" scale icon) that expand an inline panel below (not a sheet) — fasting shows elapsed/goal bar + 4 goal-hour chips (12/14/16/18h) + session summary text; weight shows a numeric input + Save + "See your trend" link.
  - Ring center content changes semantics: shows **remaining/over** (not "eaten") as the big number, with unit label under it ("kcal left"/"kcal over", turns `--fat`-colored when over) and a third line with the eaten/total recap. When `profile.hideCalories`, ring instead shows grams of protein remaining.
  - Macro list to the right of the ring changes from the 3-pill chip row to a vertical list: icon + label + "X / Y g" + thin progress bar per macro (protein, carbs, fat, **and fibre** — 4 rows total, using `Drumstick`, `Wheat`, `Droplet`, `Leaf` icons respectively).
  - "Full nutrition details" becomes an **inline expand** (chevron toggle) directly in the hero card — not a navigation to a separate sheet: reveals a stacked macro-share bar, per-macro target bars, fibre/sugar/remaining-kcal chip row, and a nested "Micronutrients (N)" toggle revealing mineral + vitamin chip grids (reuse `DailyNutritionBreakdown` data shape but this inline layout, chips not detail-cards).
  - New **Water** card between hero and meal list: −/+ buttons flanking N segmented glass blocks, label "X of Y glasses · Z L".
  - Meal rows gain: optional photo thumbnail (or tinted utensils icon tile), an "Est." badge for estimated entries, a per-row "⋯" menu (Edit/Move or copy/Delete) instead of a hover action row, and drag-and-drop between meal groups.
  - Empty meal group renders as a dashed-outline "Add {meal}" button, not the current `.empty-meals` pattern.
  - Meal group header shows "{name} / {guide} kcal" with color flip to `--fat` when over guide, plus a "Combine into recipe" affordance when a group has 2+ items.
  - Undo toast (bottom, above nav) after delete, auto-dismiss ~6s.
  - Bottom nav: 5 items (Today / Plan / **center circular Add button** / Insights / Profile) fixed to viewport bottom with a notch cut into the tab bar behind the center button — reuse the DS `BottomNav` component/pattern (`planEnabled` prop) rather than hand-building.
  - Calendar sheet (opened from the date pill): month grid where each day cell is a mini ring (reuse `MiniProgressRing`/`CalendarSheet` from DS or `DiaryView`'s existing `CalendarSheet`), a per-day kcal summary row below the grid, "View this day" CTA.
  - Meal image viewer (full-bleed photo, gradient caption) and Edit-meal / Move-or-copy sheets as bottom sheets — the DS ships `MealImageViewer`, `MoveMealSheet`, `DuplicateMealSheet`, `FoodEditor`/`MealEditor` for exactly this; wire to those instead of hand-rolling.

### 2. Add Food — `Calorie Flow - Add Food (Mobile).dc.html`
- **Real files**: `src/features/food-capture/FoodCapture.tsx` + `components/BarcodeScanner.tsx`, `LabelReader.tsx`, `MealPhotoReader.tsx`, `FoodEntrySheets.tsx`. DS equivalents: `AddFoodSheet`, `PortionSheet`, `FoodEditor`.
- Match: start view with search + "Quick add" 2-col tile grid (zap icon, "no food record" caption), logging-date switcher at top ("Logging to this day"), photo/barcode/label capture entry points, results list rows with icon tile + macro line + kcal.

### 3. Auth — `Calorie Flow - Auth (Mobile).dc.html`
- **Real file**: `src/features/auth/AuthGateway.tsx`. DS equivalent: `AuthGateway`.
- Match: centered card, "CF" mark, headline/subhead, segmented Sign in/Sign up control, form inputs styled per `.cf-input` (46px min-height, 12px radius, 1px border).

### 4. Coach — `Calorie Flow - Coach (Mobile).dc.html`
- **Real files**: `src/features/coach/CoachView.tsx`, `src/features/coach/lib/*`, `src/features/coach/types.ts`. DS equivalent: `CoachView`.
- Match: header with back button, "Your food companion" eyebrow, New chat + history menu buttons; chat bubbles — user bubble solid-filled with `16px 16px 4px 16px` radius, assistant bubble card-colored `16px 16px 16px 4px` radius with soft shadow; 3-dot typing indicator with staggered bounce animation.

### 5. Foods / Plan — `Calorie Flow - Foods (Mobile).dc.html`
- **Real files**: `src/features/food-catalogue/DiscoverView.tsx`, `src/features/planning/PlanView.tsx`. DS equivalents: `DiscoverView`, `PlanView`.
- Match: eyebrow + title header, tab switcher between Foods/Plan (`.cf-tab` pattern — flex, 700 weight, pill active state), horizontal-scrolling chip row with a right-edge fade mask (`.cf-hscroll-wrap::after` gradient), row list with photo/icon tile pattern shared with Today's meal rows.

### 6. Insights — `Calorie Flow - Insights (Mobile).dc.html`
- **Real files**: `src/features/insights/InsightsView.tsx`, `src/features/insights/averageNutrition.ts`. DS equivalent: `InsightsView`.
- Match: 4-way section tab bar (icon + label pills), 2-up stat cards (streak w/ flame icon, days logged), bar chart ("Calories by day" with avg annotation), weight section (input + Save row, 3-up latest/change/average cards, history list with delta colored by sign), fasting section (2-up average/longest cards, history list with colored duration).

### 7. Onboarding — `Calorie Flow - Onboarding (Mobile).dc.html`
- **Real files**: `src/features/profile/ProfileView.tsx` (`OnboardingDialog`, `TargetEditor` with `onboarding` prop), `src/app/globals.css` (`.onboarding-*`). DS equivalent: `OnboardingDialog`.
- **Note**: the real app currently renders onboarding as a full-screen dark overlay/card (`.onboarding-overlay`/`.onboarding-card`); the mockup renders it as a plain in-page flow (light card, step progress dots, back/continue footer). Rework `OnboardingDialog`/`TargetEditor` to match the mockup's structure: "CF" mark + "60-second setup" eyebrow + step title header, 3-segment progress bar, card body per step (diet-preset radio cards with description + P/C/F macro line, target summary with editable macro fields), sticky footer with Back (outlined) + primary continue button.

### 8. Profile — `Calorie Flow - Profile (Mobile).dc.html`
- **Real files**: `src/features/profile/ProfileView.tsx`, `components/ProfilePreferences.tsx`, `components/ProfileTargets.tsx`. DS equivalent: `ProfileView`.
- Match: avatar-initial header (56px rounded tile) + eyebrow "Profile" + name, tab switcher, toggle-switch styling (`.cf-switch` — 46×27px track, green fill when checked), row-hover list style shared with Foods/Today.

## Shared Interaction Patterns (apply everywhere)
- All bottom sheets: rounded-top (`20px 20px 0 0`) panel sliding up over a `rgba(30,24,14,.35)`-equivalent scrim (map to `color-mix(in oklch, var(--text) 20%, transparent)` or similar existing overlay token), drag handle bar (36×4px) centered at top, `max-height` with internal scroll.
- All icon-only buttons are 44×44px minimum (hit target), `12px` radius, transparent or card background.
- All progress bars: track uses `--track`/`--border`, fill uses the relevant semantic color, `4–6px` radius, animated width transitions.
- Empty/dashed states: 1px dashed `--border-strong`, `12–16px` radius.
- Chevron rotation on expand/collapse: 180° rotate, `0.2s ease`.

## Assets
- `assets/icon.svg` — app mark, used in headers and Auth/Onboarding "CF" badge (badge is currently a text tile, not the SVG — keep as-is per mockup, just a colored square with "CF").
- Icons throughout are `lucide` glyphs — use `lucide-react` (already a dependency per `DiaryView.tsx` imports) with the same icon names referenced in each mockup's `data-lucide="…"` attributes.

## Files in this bundle
All 8 mockups plus their shared runtime helpers, for reference:
- `Calorie Flow - Today (Mobile).dc.html`
- `Calorie Flow - Add Food (Mobile).dc.html`
- `Calorie Flow - Auth (Mobile).dc.html`
- `Calorie Flow - Coach (Mobile).dc.html`
- `Calorie Flow - Foods (Mobile).dc.html`
- `Calorie Flow - Insights (Mobile).dc.html`
- `Calorie Flow - Onboarding (Mobile).dc.html`
- `Calorie Flow - Profile (Mobile).dc.html`
- `cf-fixtures.js` — the fixture/sample data the mockups use; real values should come from the app's real `Profile`/`Meal`/`Food` state instead, but this shows the shape of copy/numbers used in the mocks.
- `assets/icon.svg`

Open any `.dc.html` file directly in a browser to view it live — no build step required.
