"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import { acceptedMaintenance, customTargetAdherence, maintenanceDiffersEnough, observedMaintenance } from "@/lib/adaptiveEnergy";
import { maintenanceCalories, resolveCalorieTarget } from "@/lib/energy";
import { calorieTargetModes, currentTargetModelVersion, maintenanceSources, type Meal, type Profile } from "@/lib/types";

const DISMISSAL_QUIET_DAYS = 14;

function dismissedRecently(profile: Profile, now: Date) {
  if (!profile.maintenanceReviewDismissedAt) return false;
  const dismissedAt = new Date(profile.maintenanceReviewDismissedAt);
  if (Number.isNaN(dismissedAt.getTime())) return false;
  return (now.getTime() - dismissedAt.getTime()) / 86_400_000 < DISMISSAL_QUIET_DAYS;
}

/**
 * Offers the user's own data in place of a formula — and, when a self-set target is one they
 * plainly cannot hold, offers to rebuild it. Never applies anything on its own: these numbers are
 * health-adjacent, so the change is always the user's to confirm.
 */
export function MaintenanceSuggestion({ profile, meals, onSave, now = new Date() }: { profile: Profile; meals: Meal[]; onSave: (profile: Profile) => void; now?: Date }) {
  // Every card here is built out of calorie figures, which this preference exists to hide.
  if (profile.hideCalories || dismissedRecently(profile, now)) return null;

  const reading = observedMaintenance(meals, profile, now);
  if (reading.status !== "ready") return null;

  const adherence = customTargetAdherence(meals, profile, now);
  const currentMaintenance = maintenanceCalories(profile).maintenance;
  const overshooting = adherence.status === "overshooting";
  const worthOffering = profile.maintenanceSource !== maintenanceSources.observed && maintenanceDiffersEnough(reading.observedMaintenance, currentMaintenance);
  if (!overshooting && !worthOffering) return null;

  const accepted = acceptedMaintenance(reading.observedMaintenance, profile);
  const nextTarget = resolveCalorieTarget(
    { ...profile, maintenanceSource: maintenanceSources.observed, observedMaintenanceKcal: accepted },
    profile.calorieRoundingStep ?? 25,
  ).target;

  const accept = () => onSave({
    ...profile,
    observedMaintenanceKcal: accepted,
    maintenanceSource: maintenanceSources.observed,
    observedMaintenanceUpdatedAt: now.toISOString(),
    maintenanceReviewDismissedAt: undefined,
    targetModelVersion: currentTargetModelVersion,
    ...(overshooting ? { calorieTargetMode: calorieTargetModes.calculated, calorieTargetSetAt: undefined } : {}),
  });

  const dismiss = () => onSave({ ...profile, maintenanceReviewDismissedAt: now.toISOString() });

  if (overshooting) {
    return (
      <section className="insight-card card suggestion attention">
        <span className="action-icon"><TrendingUp /></span>
        <span className="eyebrow">21 days on your own number</span>
        <h3>Your target and your eating have drifted apart</h3>
        <p>
          You set <b>{profile.calorieTarget.toLocaleString()}</b> and have averaged <b>{adherence.meanIntake.toLocaleString()}</b> — over on <b>{adherence.overDays} of {adherence.countedDays}</b> logged days. That usually means the number was set below what your routine will hold, not that you did anything wrong.
        </p>
        <div className="insight-evidence">
          <div><small>Your target</small><strong>{profile.calorieTarget.toLocaleString()}</strong></div>
          <div><small>Your average</small><strong>{adherence.meanIntake.toLocaleString()}</strong></div>
        </div>
        <p>We can rebuild it from what actually happened — your real intake and weight trend — instead of a number picked in advance. That would set a daily target of <b>{nextTarget.toLocaleString()}</b>.</p>
        <div className="insight-card-actions">
          <button type="button" className="primary-button" onClick={accept}>Rebuild my target</button>
          <button type="button" className="secondary-button" onClick={dismiss}>Keep {profile.calorieTarget.toLocaleString()}</button>
        </div>
      </section>
    );
  }

  const losing = reading.weeklyChangeKg < 0;
  return (
    <section className="insight-card card suggestion">
      <span className="action-icon mint"><Sparkles /></span>
      <span className="eyebrow">28 days of your data</span>
      <h3>Your maintenance looks {reading.observedMaintenance < currentMaintenance ? "lower" : "higher"} than we estimated</h3>
      <p>
        You&apos;ve been eating <b>{reading.meanIntake.toLocaleString()} kcal</b> a day and {losing ? "losing" : "gaining"} <b>{Math.abs(reading.weeklyChangeKg).toFixed(2)} kg</b> a week. That points to a maintenance nearer <b>{reading.observedMaintenance.toLocaleString()}</b> than the <b>{Math.round(currentMaintenance).toLocaleString()}</b> the formula gave you.
      </p>
      <div className="insight-evidence">
        <div><small>Days counted</small><strong>{reading.countedDays} of 28</strong></div>
        <div><small>Weigh-ins</small><strong>{reading.weightEntries}</strong></div>
      </div>
      <p>Using your data would move your daily target from <b>{profile.calorieTarget.toLocaleString()}</b> to <b>{nextTarget.toLocaleString()}</b>.</p>
      <div className="insight-card-actions">
        <button type="button" className="primary-button" onClick={accept}>Use my data</button>
        <button type="button" className="secondary-button" onClick={dismiss}>Not now</button>
      </div>
    </section>
  );
}
