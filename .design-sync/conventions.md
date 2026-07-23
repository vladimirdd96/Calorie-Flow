## Wrapping and setup

No provider or root wrapper is required — components read CSS custom properties
and semantic class names directly, nothing is injected via React context.
Theme is a single attribute on `<html>`: `<html data-theme="dark">` switches
every token to its dark values (see `_ds_bundle.css` — the block starting
`html[data-theme="dark"] { ... }`). Default (no attribute, or any other value)
is light. Set it once on the document, not per-component.

`Sheet` renders via `createPortal(..., document.body)` and expects
`document.body` to exist (it does in any browser render). It also toggles a
`sheet-open` class on `<body>` while mounted — harmless if unused, but don't
rely on `<body>` staying class-free while a `Sheet` is open.

`BottomNav` is `position: fixed; bottom: 0` — it pins itself to the real
viewport bottom. Don't wrap it in a container with `transform` or
`overflow: hidden` between it and the viewport, or it detaches from the
screen edge (this is exactly why its own preview card looks clipped locally —
see NOTES.md).

## Styling idiom

This is a **semantic-class system**, not a utility-class one — there is no
`bg-surface-1` / `gap-md` family to compose from. Each component owns a small
set of purpose-named classes (`.card`, `.icon-button`, `.icon-button.ghost`,
`.primary-button`, `.primary-button.full`, `.hero-card`, `.macro-card`,
`.meal-list`, `.sheet`, `.bottom-nav`) and styles come from the class, not
from props or inline utility strings. When building new layout glue for this
DS, prefer composing with `.card` (surface + border + radius + shadow) and
`.icon-button` (44×44 tap target, add `.ghost` for a borderless variant)
rather than inventing new class names — new one-off classes won't pick up
the token system automatically the way these do.

Color, radius, and shadow are CSS custom properties, referenced as
`var(--name)`:

- **Surfaces**: `--bg`, `--bg-soft`, `--panel`, `--panel-strong`, `--panel-soft`
- **Borders/lines**: `--border`, `--border-strong`, `--line`
- **Text**: `--text`, `--muted`, `--muted-2`
- **Brand/accent**: `--mint`, `--mint-strong`
- **Nutrition semantics**: `--protein`, `--carbs`, `--fat`, `--blue`, `--amber`, `--red`
- **Radius**: `--radius-lg` (18px, cards), `--radius-md` (13px), `--radius-sm` (10px)
- **Shadow**: `--shadow` (used on `.card`)

All of these flip automatically under `html[data-theme="dark"]` — never
hard-code a color that could instead be one of these tokens.

## Where the truth lives

Read `_ds_bundle.css` (imported by `styles.css`) before styling anything new —
it's the single compiled stylesheet with every token and class this DS ships
(this repo has no separate token files or docs site). Per-component usage is
in each `components/<group>/<Name>/<Name>.prompt.md`.

## Example

```jsx
const { TodayView, BottomNav, Sheet } = window.CalorieFlowDS;

function Screen() {
  return (
    <div className="app-shell">
      <TodayView
        profile={profile}
        meals={meals}
        dateKey={dateKey}
        syncLabel="Synced privately"
        showHomeScreenPrompt={false}
        onDateChange={() => {}}
        onAdd={() => {}}
        onOpenCoach={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
        onOpenDetails={() => {}}
        onOpenNutritionDetails={() => {}}
        onOpenImage={() => {}}
        onDropMeal={() => {}}
        onDuplicate={() => {}}
        onMove={() => {}}
        onDismissHomeScreenPrompt={() => {}}
        onOpenCalendar={() => {}}
        onSaveProfile={() => {}}
        onSaveRecipe={async () => {}}
      />
      <BottomNav tab="today" onChange={() => {}} planEnabled={true} />
    </div>
  );
}
```

A modal built from `Sheet` (used the same way `TodayView` uses it internally
for calendar/meal-detail overlays):

```jsx
<Sheet onClose={() => {}} label="Edit meal">
  <div className="sheet-header">
    <div>
      <span className="eyebrow">Lunch</span>
      <h2>Grilled chicken salad</h2>
    </div>
  </div>
  <p>480 kcal · 42g protein · 28g carbs · 20g fat</p>
</Sheet>
```
