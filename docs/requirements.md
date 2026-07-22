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
