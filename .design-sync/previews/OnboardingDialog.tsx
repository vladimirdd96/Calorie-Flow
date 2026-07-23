import { OnboardingDialog } from "calorie-flow-design-system";
import { noop, profile } from "./_fixtures";

export function Default() {
  return <OnboardingDialog profile={{ ...profile, onboardingDone: false }} onSave={noop} />;
}
