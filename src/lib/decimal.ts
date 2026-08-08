export const decimalPlaces = 2;

/** Rounds user-entered measurements without leaking binary floating-point tails into storage. */
export function roundDecimal(value: number, places = decimalPlaces) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseDecimal(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function decimalString(value: number, places = decimalPlaces) {
  return String(roundDecimal(value, places));
}
