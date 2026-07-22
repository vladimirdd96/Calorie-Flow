import { defaultHabitFeatures, type HabitFeature } from "./types";

/** Older profiles omit this preference and should retain the original visible habits. */
export function isHabitFeatureEnabled(enabledFeatures: HabitFeature[] | undefined, feature: HabitFeature) {
  return enabledFeatures?.includes(feature) ?? true;
}

export function toggleHabitFeature(enabledFeatures: HabitFeature[] | undefined, feature: HabitFeature): HabitFeature[] {
  const current = new Set(enabledFeatures || defaultHabitFeatures);
  if (current.has(feature)) current.delete(feature);
  else current.add(feature);
  return defaultHabitFeatures.filter((candidate) => current.has(candidate));
}
