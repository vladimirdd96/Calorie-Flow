"use client";

import { maintenanceCalories } from "@/lib/energy";
import { maintenanceSources, type Profile } from "@/lib/types";

/**
 * Only appears once there is a real alternative to offer. The formula is a population average; a
 * user's own logs beat it, but the choice stays theirs.
 */
export function MaintenanceSourceField({ profile, onPatch }: { profile: Profile; onPatch: (patch: Partial<Profile>) => void }) {
  const observed = profile.observedMaintenanceKcal;
  if (typeof observed !== "number" || !Number.isFinite(observed) || observed <= 0) return null;
  const formula = Math.round(maintenanceCalories({ ...profile, maintenanceSource: undefined }).maintenance);
  const usingObserved = profile.maintenanceSource === maintenanceSources.observed;

  return (
    <div className="maintenance-source">
      <span id="maintenance-source-label">Maintenance estimate</span>
      <div className="segmented two" role="group" aria-labelledby="maintenance-source-label">
        <button type="button" aria-pressed={!usingObserved} className={usingObserved ? "" : "active"} onClick={() => onPatch({ maintenanceSource: maintenanceSources.formula })}>
          Formula · {formula.toLocaleString()}
        </button>
        <button type="button" aria-pressed={usingObserved} className={usingObserved ? "active" : ""} onClick={() => onPatch({ maintenanceSource: maintenanceSources.observed })}>
          My data · {Math.round(observed).toLocaleString()}
        </button>
      </div>
      <small>
        {usingObserved
          ? "Built from your logged intake and weight trend. Switching back uses the Mifflin–St Jeor estimate instead."
          : "Your logs suggest a different maintenance than the formula. Switching recalculates every pace above."}
      </small>
    </div>
  );
}
