import { allHabitFeatures, defaultHabitFeatures, type HabitFeature } from "./types";

/** Optional habits are off until the user enables them in Customize. */
export function isHabitFeatureEnabled(enabledFeatures: HabitFeature[] | undefined, feature: HabitFeature) {
  return Array.isArray(enabledFeatures) && enabledFeatures.includes(feature);
}

export function toggleHabitFeature(enabledFeatures: HabitFeature[] | undefined, feature: HabitFeature): HabitFeature[] {
  const current = new Set(enabledFeatures || defaultHabitFeatures);
  if (current.has(feature)) current.delete(feature);
  else current.add(feature);
  return allHabitFeatures.filter((candidate) => current.has(candidate));
}
