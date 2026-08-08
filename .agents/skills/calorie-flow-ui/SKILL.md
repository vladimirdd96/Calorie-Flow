---
name: calorie-flow-ui
description: Apply Calorie Flow’s established design system and UI-quality workflow when implementing, changing, debugging, reviewing, or refining product UI. Use for screens, components, layout, CSS, mobile and desktop responsiveness, accessibility, sheets, menus, and user-facing interaction behavior in this repository.
---

# Calorie Flow UI

Deliver a complete, handoff-consistent product experience rather than an isolated component. Make the narrow phone experience the baseline and use desktop space purposefully.

## Establish the source of truth

1. Run `npm run docs:list` and read the task-matching documentation before changing code.
2. Read `docs/ui-patterns.md` and `docs/design-coverage.md` for every UI task. For a covered surface, read the relevant material in `design_handoff_calorie_flow_mobile` before implementation.
3. Inspect the closest existing screen, analogous interaction, shared primitive, and token usage. Reuse them unless a real product difference requires a new pattern.
4. Treat the established semantic tokens, Avenir-based typography, and existing light/dark behavior as fixed design constraints. Do not add a competing palette, font, card treatment, or ornamental effect.

## Design and implementation loop

1. State the user-facing job and the complete set of states affected before editing: normal, empty, loading, error, disabled, and success where applicable.
2. Choose one coherent composition and action hierarchy. Prefer progressive disclosure and shared controls over duplicate actions or parallel workflows.
3. For a new or materially reshaped flow, invoke `$impeccable` after establishing the product context in `AGENTS.md`. Preserve the project handoff and design system when its general design guidance would conflict.
4. Implement the vertical slice completely: interaction behavior, accessible semantics, focus management, touch targets, responsive layout, and recovery paths belong with the visual change.
5. Keep visual intent and implementation aligned. A UI request is not satisfied by functional controls with unreviewed layout, generic filler UI, or a desktop-only composition.

## Visual quality gate

1. Render and inspect every changed screen at a narrow phone viewport (360–390 px) and a wide desktop viewport.
2. Check container width, text wrapping, control sizing, alignment, overflow, scroll ownership, action hierarchy, visible keyboard focus, and reduced-motion behavior where motion changes.
3. For a dialog, drawer, sheet, or menu, exercise the first and last interactive elements, close action, Escape handling, scrolling, focus restoration, and primary action.
4. Fix observed issues before running final checks. Visual verification is evidence, not a formality.
