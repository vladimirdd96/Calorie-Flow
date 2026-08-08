<!-- read_when: design, UI, screen, component, handoff -->

# Calorie Flow design coverage

This inventory compares the eight screens in `design_handoff_calorie_flow_mobile` with the current product entry points. The handoff remains the visual source of truth; the real app keeps its token names, data, and local-first behavior.

| Handoff surface | Live entry point | Coverage | Remaining work handled in this pass |
| --- | --- | --- | --- |
| Today | `TodayView`, `TodaySummary`, `TodayWater` | Implemented | Secondary meal, fasting, weight, nutrition-detail, photo, move/copy, and undo surfaces use the same token language. |
| Add Food | `AddFoodSheet` and capture components | Implemented | Manual food, barcode-not-found, label, photo, voice, and portion states share the handoff treatment. |
| Auth | `AuthGateway` | Implemented | Recovery, unavailable-provider, and confirmation states use the same form/button system. |
| Coach | `CoachView` | Implemented | Signed-out, loading, history, grocery, source, and composer states use the same calm surfaces. |
| Foods / Plan | `DiscoverView`, `PlanView` | Implemented | Plan calendar, recipe editor/delete, food return action, and shopping states are included. |
| Insights | `InsightsView` | Implemented | Weight and fasting history are additional handoff-compatible sections. |
| Onboarding | `OnboardingDialog`, `TargetEditor` | Implemented | Reworked as the handoff’s plain in-page three-step flow with progress segments and sticky actions. |
| Profile → Edit targets | `TargetEditor` (non-onboarding) | Implemented | The same editor as onboarding, mounted in a `Sheet`. Replaced `DailyTargetsSheet`, which offered four raw number fields and no calculation. |
| Profile | `ProfileView`, `ProfileCustomize` | Implemented | Account sync, diary sharing, data export/restore, and customization are additional handoff-compatible sections. |

## Product UI outside the eight mockups

These are functional surfaces that do not have standalone handoff pages, so they are reconciled to the same system rather than copied from an older visual language:

- account recovery and provider-unavailable states;
- optional measurement and weight prompts;
- meal timing confirmation, meal edit, move/copy, duplicate, and image viewer sheets;
- custom food, portion, recipe, label, barcode, voice, and meal-photo capture states;
- plan recipe creation/deletion, calendar, food selection, and shopping list states;
- Coach grocery-list selection/management and chat history actions;
- profile sharing, sync status, backup export/restore, and display preferences.

The shared rules are: tokenized surfaces, solid semantic actions, 44px minimum icon targets, rounded-top sheets with a single scroll region, muted explanatory copy, and accent color reserved for the action or nutrient meaning.
