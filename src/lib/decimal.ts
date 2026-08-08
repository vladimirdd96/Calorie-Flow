export const decimalPlaces = 2;

/** Rounds user-entered measurements without leaking binary floating-point tails into storage. */
export function roundDecimal(value: number, places = decimalPlaces) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Converts the locale decimal separator into the format stored by the app. */
export function normalizeDecimalInput(value: string) {
  return value.replace(",", ".");
}

export function decimalString(value: number, places = decimalPlaces) {
  return String(roundDecimal(value, places));
}
