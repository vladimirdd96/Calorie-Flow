<!-- read_when: component, screen, UI, layout, style, design, theme, accessibility, PWA, mobile -->

# UI patterns

`src/components/TrackerApp.tsx` is the primary client experience. Keep the daily log fast and understandable on a phone-sized viewport; advanced tools should remain progressive disclosure.

Nutrition data is health-adjacent: label estimates clearly, avoid medical claims, and preserve the user's existing entries unless they explicitly confirm a replacement. The app must remain useful offline and in guest mode.

Use semantic controls, visible labels, keyboard-accessible dialogs, and sufficient contrast. Test any UI behavior that affects nutrition calculations or persisted diary data.
