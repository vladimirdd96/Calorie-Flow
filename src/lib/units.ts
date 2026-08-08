import { measurementSystems, type MeasurementSystem } from "./types";

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

export const isImperial = (system: MeasurementSystem | undefined) => system === measurementSystems.imperial;
export const weightUnitFor = (system: MeasurementSystem | undefined) => (isImperial(system) ? "lb" : "kg");

export function displayWeight(kg: number, system: MeasurementSystem | undefined) {
  return isImperial(system) ? kgToLb(kg) : kg;
}

/** A weekly rate of change, in the user's own units. Rates are small, so keep two decimals in kg. */
export function formatWeeklyRate(kgPerWeek: number, system: MeasurementSystem | undefined) {
  const magnitude = Math.abs(kgPerWeek);
  return isImperial(system)
    ? `${kgToLb(magnitude).toFixed(1)} lb`
    : `${magnitude.toFixed(2)} kg`;
}
