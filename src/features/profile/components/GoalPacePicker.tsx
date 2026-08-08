"use client";

import { Clock, TriangleAlert } from "lucide-react";
import { NumericInput } from "@/features/shared/NumericInput";
import { estimateGoalEta, resolveCalorieTarget, weeklyRateFor } from "@/lib/energy";
import { formatWeeklyRate, isImperial, kgToLb, lbToKg, weightUnitFor } from "@/lib/units";
import { goalPaces, type GoalPace, type Profile } from "@/lib/types";
import { paceMeta } from "./targetCopy";

const etaFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long" });

/**
 * Pace with its consequence attached. The calorie result and the weekly rate sit on the control
 * itself, because a pace chosen without seeing what it produces is a pace chosen blind.
 */
export function GoalPacePicker({ profile, onUpdate }: { profile: Profile; onUpdate: <K extends keyof Profile>(key: K, value: Profile[K]) => void }) {
  if (profile.goalMode === "maintain") return null;
  const active = profile.goalPace || goalPaces.moderate;
  const roundingStep = profile.calorieRoundingStep ?? 25;
  const imperial = isImperial(profile.measurementSystem);
  const eta = estimateGoalEta(profile);
  const goalWeightInput = typeof profile.goalWeightKg === "number"
    ? String(Math.round((imperial ? kgToLb(profile.goalWeightKg) : profile.goalWeightKg) * 10) / 10)
    : "";

  return (
    <div className="field-block">
      <span id="goal-pace-label">Pace</span>
      <div className="pace-cards" role="group" aria-labelledby="goal-pace-label">
        {(Object.keys(paceMeta) as GoalPace[]).map((pace) => {
          const meta = paceMeta[pace];
          const target = resolveCalorieTarget({ ...profile, goalPace: pace }, roundingStep).target;
          const rate = weeklyRateFor({ ...profile, goalPace: pace });
          return (
            <button key={pace} type="button" className={`pace-card${active === pace ? " active" : ""}`} aria-pressed={active === pace} onClick={() => onUpdate("goalPace", pace)}>
              <strong>{meta.label}</strong>
              <b>{target.toLocaleString()} kcal</b>
              <small>{profile.goalMode === "lose" ? meta.percentLose : meta.percentGain}</small>
              <em>{formatWeeklyRate(rate, profile.measurementSystem)} / week</em>
            </button>
          );
        })}
      </div>

      <label className="goal-weight-row">
        <span>Goal weight <small>optional</small></span>
        <span className="goal-weight-value">
          <NumericInput
            inputMode="decimal"
            step="0.1"
            min={imperial ? 77 : 35}
            max={imperial ? 661 : 300}
            value={goalWeightInput}
            aria-label="Goal weight"
            onChange={(event) => {
              const raw = event.target.value;
              if (raw.trim() === "") return onUpdate("goalWeightKg", undefined);
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) return;
              onUpdate("goalWeightKg", imperial ? lbToKg(parsed) : parsed);
            }}
          />
          <span className="unit">{weightUnitFor(profile.measurementSystem)}</span>
        </span>
      </label>

      {eta.status === "ready" && (
        <p className="goal-eta">
          <Clock size={13} aria-hidden="true" />
          <span>At this pace you&apos;d get there in about <b>{Math.max(1, Math.round(eta.weeks))} weeks</b> — around <b>{etaFormatter.format(eta.date)}</b>.</span>
        </p>
      )}
      {eta.status === "wrong-direction" && (
        <p className="goal-eta invalid">
          <TriangleAlert size={13} aria-hidden="true" />
          <span>
            That goal weight is {profile.goalMode === "lose" ? "above" : "below"} your current weight. Switch your goal to {profile.goalMode === "lose" ? "Gain" : "Lose"}, or set a {profile.goalMode === "lose" ? "lower" : "higher"} number.
          </span>
        </p>
      )}
      {eta.status === "reached" && (
        <p className="goal-eta">
          <Clock size={13} aria-hidden="true" />
          <span>You&apos;re already at your goal weight.</span>
        </p>
      )}
    </div>
  );
}
