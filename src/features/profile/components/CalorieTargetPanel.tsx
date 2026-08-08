"use client";

import { ChevronRight, Check, Droplet, Drumstick, Flame, Info, TriangleAlert, Wheat } from "lucide-react";
import { useState } from "react";
import { NumericInput } from "@/features/shared/NumericInput";
import { activityMultipliers, describeCustomTarget, resolveCalorieTarget } from "@/lib/energy";
import type { MacroTargets } from "@/lib/nutrition";
import { formatWeeklyRate } from "@/lib/units";
import { calorieTargetModes, currentTargetModelVersion, goalPaces, maintenanceSources, type Profile } from "@/lib/types";
import { activityMeta, paceMeta } from "./targetCopy";

type PanelProps = {
  profile: Profile;
  macros: MacroTargets;
  variant: "onboarding" | "sheet";
  /** The target as last saved, so a legacy profile can be told its number moved. */
  storedTarget?: number;
  onPatch: (patch: Partial<Profile>) => void;
};

function MacroRow({ macros }: { macros: MacroTargets }) {
  return (
    <div className="onboarding-macros">
      <span><Drumstick />P <strong>{macros.protein} g</strong></span>
      <span><Wheat />C <strong>{macros.carbs} g</strong></span>
      <span><Droplet />F <strong>{macros.fat} g</strong></span>
    </div>
  );
}

/**
 * The target and how it was arrived at. People trust a number they can take apart, so the derivation
 * is one tap away rather than hidden — but collapsed, because it is reassurance and not a step.
 */
export function CalorieTargetPanel({ profile, macros, variant, storedTarget, onPatch }: PanelProps) {
  const roundingStep = profile.calorieRoundingStep ?? 25;
  const result = resolveCalorieTarget(profile, roundingStep);
  const custom = profile.calorieTargetMode === calorieTargetModes.custom;
  const target = custom ? profile.calorieTarget : result.target;
  const observed = result.maintenanceSource === maintenanceSources.observed;
  const paceLabel = profile.goalMode === "maintain" ? "" : paceMeta[profile.goalPace || goalPaces.moderate].label;
  const showModelNotice = !custom && profile.targetModelVersion !== currentTargetModelVersion && typeof storedTarget === "number" && storedTarget !== result.target;

  return (
    <>
      {showModelNotice && (
        <div className="target-model-notice">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>We changed how pace works</strong>
            <p>Pace now scales with your bodyweight instead of using a fixed calorie step, so it means the same thing at any size. Your daily target moved from <b>{storedTarget.toLocaleString()}</b> to <b>{result.target.toLocaleString()}</b>.</p>
            <button type="button" onClick={() => onPatch({ targetModelVersion: currentTargetModelVersion, calorieTarget: result.target })}>Got it</button>
          </div>
        </div>
      )}

      <div className={variant === "onboarding" ? "onboarding-target" : "calculated-target"}>
        {variant === "onboarding" ? (
          <div className="onboarding-target-heading">
            <span><Flame size={17} aria-hidden="true" /></span>
            <div>
              <small>{custom ? "Your number" : "Starting target"}</small>
              <strong>{target.toLocaleString()} <em>kcal</em></strong>
            </div>
          </div>
        ) : (
          <div>
            <span>{custom ? "Your number" : "Daily target"}</span>
            <strong>{target.toLocaleString()} <small>kcal</small></strong>
          </div>
        )}

        <MacroRow macros={macros} />

        {!custom && (
          <details className="target-derivation">
            <summary>How we got this<ChevronRight size={15} aria-hidden="true" /></summary>
            <div className="derivation-rows">
              {observed ? (
                <div><span>Maintenance, from your last 28 days</span><span>{Math.round(result.maintenance).toLocaleString()} kcal</span></div>
              ) : (
                <>
                  <div><span>Base metabolic rate</span><span>{Math.round(result.bmr).toLocaleString()} kcal</span></div>
                  <div className="sub"><span>Daily movement · {activityMeta[profile.activity].short}</span><span>× {activityMultipliers[profile.activity]}</span></div>
                  <div><span>Maintenance</span><span>{Math.round(result.maintenance).toLocaleString()} kcal</span></div>
                </>
              )}
              {profile.goalMode !== "maintain" && (
                <div className="delta">
                  <span>{paceLabel} {profile.goalMode === "lose" ? "cut" : "surplus"} · {formatWeeklyRate(result.weeklyRateKg, profile.measurementSystem)}/week</span>
                  <span>{result.dailyDelta < 0 ? "−" : "+"} {Math.abs(Math.round(result.dailyDelta)).toLocaleString()} kcal</span>
                </div>
              )}
              <div className="total"><span>Daily target</span><span>{result.target.toLocaleString()} kcal</span></div>
            </div>
          </details>
        )}
      </div>

      {result.clamp.kind === "floor" && !custom && (
        <div className="target-warning caution">
          <TriangleAlert size={17} aria-hidden="true" />
          <div>
            <strong>Held at your resting burn</strong>
            <p>This pace would put you below the <b>{result.clamp.floor.toLocaleString()} kcal</b> your body uses at rest, so the target stays here instead. Choose a gentler pace to move at a rate you can hold.</p>
          </div>
        </div>
      )}

      {macros.shortfallKcal > 0 && (
        <div className="target-warning caution">
          <TriangleAlert size={17} aria-hidden="true" />
          <div>
            <strong>This split doesn&apos;t fit the target</strong>
            <p>Protein and fat alone come to <b>{macros.shortfallKcal.toLocaleString()} kcal</b> more than {target.toLocaleString()}. Raise the target or pick a preset with room for it.</p>
          </div>
        </div>
      )}

    </>
  );
}

/**
 * The way to disagree with the calculated number. Deliberately the last thing on the surface and
 * closed by default: an escape hatch for the few who want it, never a second first-class path.
 */
export function CustomCalorieOverride({ profile, onPatch }: { profile: Profile; onPatch: (patch: Partial<Profile>) => void }) {
  const roundingStep = profile.calorieRoundingStep ?? 25;
  const result = resolveCalorieTarget(profile, roundingStep);
  const custom = profile.calorieTargetMode === calorieTargetModes.custom;
  const target = custom ? profile.calorieTarget : result.target;
  const insight = custom ? describeCustomTarget(profile, target, roundingStep) : undefined;

  // Open by default once a custom target exists, but a deliberate toggle always wins after that.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const overrideOpen = toggled ?? custom;

  const setCustomTarget = (raw: string) => {
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onPatch({ calorieTargetMode: calorieTargetModes.custom, calorieTarget: Math.round(parsed), calorieTargetSetAt: new Date().toISOString() });
  };

  return (
    <>
      <details className="nutrition-goals-advanced" open={overrideOpen} onToggle={(event) => setToggled(event.currentTarget.open)}>
        <summary>
          <span><strong>Set your own calorie number</strong><small>Ignore the pace above and enter a target yourself.</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </summary>
        <div className="custom-target-fields">
          <label className="custom-target-row">
            <span>Daily calories</span>
            <span className="custom-target-value">
              <NumericInput inputMode="numeric" min="800" max="20000" value={target} aria-label="Daily calories" onChange={(event) => setCustomTarget(event.target.value)} />
              <span className="unit">kcal</span>
            </span>
          </label>

          {insight && (
            <div className={`target-warning ${insight.belowFloor ? "blocked" : insight.steeperThanAggressive ? "caution" : "ok"}`}>
              {insight.belowFloor || insight.steeperThanAggressive ? <TriangleAlert size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
              <div>
                {insight.belowFloor ? (
                  <>
                    <strong>Below your resting burn</strong>
                    <p>{target.toLocaleString()} is under the <b>{insight.floor.toLocaleString()} kcal</b> your body uses at rest. Eating here for long tends to cost muscle and stall the loss. We&apos;d suggest <b>{insight.suggestedFloorTarget.toLocaleString()}</b> as the fastest sensible cut.</p>
                  </>
                ) : insight.steeperThanAggressive ? (
                  <>
                    <strong>Steeper than Aggressive</strong>
                    <p>{target.toLocaleString()} is <b>{Math.abs(Math.round(insight.deltaPercent))}% {insight.deltaPercent < 0 ? "below" : "above"}</b> your {Math.round(insight.maintenance).toLocaleString()} maintenance — about <b>{formatWeeklyRate(insight.weeklyRateKg, profile.measurementSystem)} a week</b>. That&apos;s faster than the Aggressive preset. It stays above your {insight.floor.toLocaleString()} kcal floor, so it&apos;s yours to choose.</p>
                  </>
                ) : (
                  <>
                    <strong>{insight.deltaPercent < 0 ? "A sustainable deficit" : insight.deltaPercent > 0 ? "A steady surplus" : "Right at maintenance"}</strong>
                    <p>{target.toLocaleString()} is <b>{Math.abs(Math.round(insight.deltaPercent))}% {insight.deltaPercent < 0 ? "below" : "above"}</b> your {Math.round(insight.maintenance).toLocaleString()} maintenance — about <b>{formatWeeklyRate(insight.weeklyRateKg, profile.measurementSystem)} a week</b>.</p>
                  </>
                )}
              </div>
            </div>
          )}

          {custom && (
            <button type="button" className="text-button" onClick={() => onPatch({ calorieTargetMode: calorieTargetModes.calculated, calorieTarget: result.target, calorieTargetSetAt: undefined })}>
              Use the calculated {result.target.toLocaleString()} instead
            </button>
          )}
        </div>
      </details>
    </>
  );
}
