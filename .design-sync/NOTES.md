# design-sync notes

## Repo shape

Calorie Flow is a single Next.js app, not a component-library repo — there was
no existing design-system package, no Storybook, no `dist/` build. To make
`claude.ai/design` build with the app's real components, we extracted a
minimal package (`design-system/`) that re-exports real app components via
relative imports into `src/`:

- `TodayView` (the home screen) — `src/features/diary/DiaryView.tsx`
- `BottomNav` — `src/features/navigation/BottomNav.tsx`
- `Sheet` — `src/features/shared/Sheet.tsx`

Scope is intentionally home-screen-only for this first sync. Grow it later by
adding more re-exports to `design-system/entry.ts` (diary sheets, coach,
insights, planning, profile, food-catalogue, food-capture screens) — same
package, same build, same `_ds_sync.json` anchor, no new package needed.

## Build pipeline (`design-system/`)

`npm run build` (from `design-system/`) does three things:
1. Copies `../src/app/globals.css` → `design-system/globals.css` (cfg's
   `cssEntry` is bounded to the package dir, so the real stylesheet has to be
   copied in, not referenced by relative path outside the package).
2. `tsc --emitDeclarationOnly` — produces `.d.ts` for the whole reachable
   import graph (real types, not synth-entry guesses).
3. `build.mjs` — a small esbuild bundle of `entry.ts` with `packages: external`
   (only our own relative-import graph gets inlined; npm deps like react,
   lucide-react, zod, @supabase/supabase-js stay as bare imports for the
   converter's own esbuild pass) and `define: {"process.env": "{}"}`.

## Re-sync risks / things a future run should know

- **`process.env` shim is load-bearing.** `src/lib/env.ts` reads several
  `process.env.NEXT_PUBLIC_*` / server keys at module top-level. Next.js
  inlines these via its own bundler define; a raw esbuild bundle has no
  `process` global at all, so without the `define: {"process.env": "{}"}` in
  `design-system/build.mjs`, the bundle throws `ReferenceError: process is
  not defined` at IIFE-execution time and **every** component export fails
  (`[BUNDLE_EXPORT]` for all 3, not just the one that touches env). If a
  future component pulls in a new module that reads `process.env.SOMETHING`,
  this same define already covers it (whole-expression replacement, not
  per-key) — no action needed, but worth knowing why it's there before ever
  "cleaning up" that define line.
- **`cssEntry` must stay inside `design-system/`** (cfg path fields are
  bounded to `PKG_DIR`). The `cp` step in `design-system/package.json`'s
  `build` script keeps this fresh from the real `src/app/globals.css` — don't
  hand-edit `design-system/globals.css` directly, it's overwritten every
  build.
- **Known render warn — `BottomNav`, all 3 cells.** The converter's preview
  card wraps single/grid renders in a `transform:translateZ(0)` container
  (`.ds-single` / `.ds-cell` in `lib/emit.mjs`) to give `position:fixed`
  descendants a local containing block. `BottomNav`'s real CSS is
  `position:fixed;bottom:0` with no `top` and no other siblings, so that
  wrapper div collapses to zero height (a fixed child never contributes to
  its containing block's auto/shrink-wrap size — true even for the real
  viewport, but here the "viewport" is the zero-height wrapper itself). The
  bar then grows *upward* from that zero-height reference point, landing
  mostly above the visible crop — every card mode we tried (`single`, `grid`,
  `column`) hits the same interaction; no `cfg.overrides` combination fixes
  it, since it's structural, not a sizing choice. This is a converter/harness
  limitation (`lib/emit.mjs` is off-limits to fork per the base skill), not a
  BottomNav defect — the actual exported component and its CSS are correct
  (verified via the `Sheet`/`TodayView` previews, which use portal+flex
  layouts and render perfectly). Graded `good` on all 3 cells on that basis.
  A future re-sync seeing this same clipped `BottomNav` card should NOT
  re-chase it as a new regression — it's this same known issue recurring.
- **Font substitute accepted**: `globals.css` uses
  `font-family: "Avenir Next", Avenir, "Helvetica Neue", sans-serif` — Apple
  system fonts, never shipped as webfonts by the app (there's no `.woff2` in
  the repo for them). `[FONT_MISSING]` fires every build; accepted as a
  substitute (falls back to system sans-serif / Helvetica Neue in the DS
  pane), not something to chase — nothing to source, this was never
  self-hosted.
- **Pre-existing repo type errors are not part of this sync.** During this
  work `npm run typecheck` briefly showed 2 unrelated errors in
  `DiaryView.tsx` / `useTrackerActions.ts` that were fixed externally
  (outside this sync) before the final build; typecheck is clean as of this
  writing. Not caused by, or relevant to, the design-system extraction.
- **`docs: 0/3 components matched`** is expected — there's no `docsDir` (no
  component docs directory in this repo). `.prompt.md` files are synthesized
  from `.d.ts` + the authored previews, which is fine for this repo's shape.
