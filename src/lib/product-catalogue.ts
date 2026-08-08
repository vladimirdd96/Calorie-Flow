import { z } from "zod";
import { nutritionSchema } from "./schemas";
import { getSupabase } from "./supabase";
import type { Food } from "./types";

/**
 * Shared, barcode-keyed packaged-food catalogue (`public.product_catalogue`).
 *
 * Open Food Facts misses most Central/Eastern European supermarket private labels, so
 * a scan that upstream cannot answer is resolved once — by the AI label reader or by
 * hand — and written here, where every other account finds it on the next scan. Reads
 * are the first step of every barcode lookup; they also answer while Open Food Facts is
 * down, which it measurably is from time to time.
 */

const catalogueColumns = "barcode,name,brand,quantity_label,serving_label,serving_grams,package_grams,image_url,nutrients_per_100,keywords,source,source_ref,countries,verified";

/** Barcode symbologies a package scan can produce, normalized to digits. */
export const catalogueBarcodePattern = /^[0-9]{8,14}$/;

const catalogueSourceSchema = z.enum(["open-food-facts", "food-data-central", "restaurant", "branded", "ai-label", "custom"]);
export type CatalogueSource = z.infer<typeof catalogueSourceSchema>;

const numeric = z.union([z.number(), z.string()]).nullish().transform((value) => {
  // PostgREST returns `numeric` columns as strings when they exceed JS-safe precision.
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
});
const shortText = z.string().trim().min(1).max(240).nullish().transform((value) => value || undefined);

const catalogueRowSchema = z.object({
  barcode: z.string().regex(catalogueBarcodePattern),
  name: z.string().trim().min(1).max(240),
  brand: shortText,
  quantity_label: shortText,
  serving_label: shortText,
  serving_grams: numeric,
  package_grams: numeric,
  image_url: z.string().trim().url().nullish().transform((value) => value || undefined),
  nutrients_per_100: nutritionSchema,
  keywords: z.array(z.string().trim().min(1).max(120)).max(40).nullish().transform((value) => value?.length ? value : undefined),
  source: catalogueSourceSchema,
  source_ref: shortText,
  countries: z.array(z.string()).nullish(),
  verified: z.boolean().nullish(),
});

export type CatalogueRow = z.infer<typeof catalogueRowSchema>;

/** Strips separators a hand-typed or scanned barcode may carry. */
export function normalizeBarcode(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Names a package whose own label never showed a legible product name, so the barcode
 * stays findable in search rather than sitting blank.
 *
 * The two shapes this returns are load-bearing beyond display: the `placeholder`
 * column on `product_catalogue` (`supabase/migrations/202608080001_correctable_placeholder_names.sql`)
 * is a generated column matching these exact patterns, which is how the database tells
 * a name nobody actually supplied from a real one without trusting a client-sent flag.
 * Changing this format requires a matching migration, or existing placeholder rows will
 * stop being recognized as correctable by anyone but their original contributor.
 */
export function describeUnnamedProduct(food: Pick<Food, "brand" | "quantityLabel" | "barcode">) {
  const parts = [food.brand, food.quantityLabel].filter(Boolean);
  if (parts.length) return `${parts.join(" ")} (scanned)`;
  return food.barcode ? `Scanned product ${food.barcode}` : "Scanned product";
}

export function catalogueRowToFood(row: CatalogueRow): Food {
  return {
    id: `catalogue-${row.barcode}`,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    imageUrl: row.image_url,
    quantityLabel: row.quantity_label,
    servingLabel: row.serving_label,
    servingGrams: row.serving_grams,
    packageGrams: row.package_grams,
    nutrientsPer100: row.nutrients_per_100,
    keywords: row.keywords,
    source: row.source,
    verified: row.verified || undefined,
  };
}

/** Validates one PostgREST row and maps it to a `Food`, or null when the row is unusable. */
export function parseCatalogueRow(value: unknown): Food | null {
  const parsed = catalogueRowSchema.safeParse(value);
  return parsed.success ? catalogueRowToFood(parsed.data) : null;
}

/**
 * Reads one product by barcode. Returns null for a miss, a malformed row, or any
 * network/RLS failure: a barcode scan must fall through to the online providers
 * rather than fail because the shared catalogue was unreachable.
 */
export async function findCatalogueProduct(barcode: string | string[]): Promise<Food | null> {
  // Callers pass every equivalent GTIN spelling at once so one round trip covers a
  // package filed under its UPC-A in one database and its padded EAN-13 in another.
  const candidates = (Array.isArray(barcode) ? barcode : [barcode])
    .map(normalizeBarcode)
    .filter((value) => catalogueBarcodePattern.test(value));
  if (!candidates.length) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("product_catalogue").select(catalogueColumns).in("barcode", candidates).limit(candidates.length);
    if (error || !Array.isArray(data)) return null;
    // Preserve caller order: the form the scanner actually read is the best match.
    for (const candidate of candidates) {
      const row = data.find((entry) => (entry as { barcode?: string }).barcode === candidate);
      const food = row ? parseCatalogueRow(row) : null;
      if (food) return food;
    }
    return null;
  } catch {
    return null;
  }
}

/** Name/brand search over the shared catalogue, merged into ordinary food search results. */
export async function searchCatalogue(query: string, limit = 20): Promise<Food[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    // `ilike` on both columns keeps Cyrillic product names matchable without a
    // language-specific text-search configuration.
    const pattern = `%${trimmed.replace(/[%_]/g, (character) => `\\${character}`)}%`;
    const { data, error } = await supabase
      .from("product_catalogue")
      .select(catalogueColumns)
      .or(`name.ilike.${pattern},brand.ilike.${pattern}`)
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map(parseCatalogueRow).filter((food): food is Food => food !== null);
  } catch {
    return [];
  }
}

export type CatalogueContribution = { food: Food; source: CatalogueSource };

/**
 * Publishes a resolved product so the next account scanning that barcode finds it.
 *
 * Best-effort by design: a duplicate barcode (23505) means another account already
 * answered it and the primary key kept the first answer, and any other failure must
 * not disturb the user's own logging. Never throws.
 */
export async function contributeCatalogueProduct({ food, source }: CatalogueContribution): Promise<"published" | "duplicate" | "skipped"> {
  const barcode = normalizeBarcode(food.barcode || "");
  if (!catalogueBarcodePattern.test(barcode)) return "skipped";
  const nutrition = nutritionSchema.safeParse(food.nutrientsPer100);
  // A row with no energy and no macros teaches nobody anything; keep it out of the shared table.
  if (!nutrition.success) return "skipped";
  const { calories, protein, carbs, fat } = nutrition.data;
  if (!calories && !protein && !carbs && !fat) return "skipped";

  const supabase = getSupabase();
  if (!supabase) return "skipped";
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return "skipped";
    const { error } = await supabase.from("product_catalogue").insert({
      barcode,
      name: food.name.slice(0, 240),
      brand: food.brand?.slice(0, 120) || null,
      quantity_label: food.quantityLabel?.slice(0, 60) || null,
      serving_label: food.servingLabel?.slice(0, 60) || null,
      serving_grams: food.servingGrams || null,
      package_grams: food.packageGrams || null,
      image_url: food.imageUrl?.startsWith("https://") ? food.imageUrl.slice(0, 600) : null,
      nutrients_per_100: nutrition.data,
      keywords: food.keywords?.slice(0, 40) || [],
      source,
      countries: [],
      verified: false,
      contributed_by: userId,
    });
    if (!error) return "published";
    return error.code === "23505" ? "duplicate" : "skipped";
  } catch {
    return "skipped";
  }
}

/**
 * Corrects the name on a catalogue row.
 *
 * Renaming a food in the portion sheet is optional and never blocks logging, but a wrong
 * name published under a barcode used to be permanent unless the *original* contributor
 * happened to fix it themselves — including the common case where nobody had a name yet
 * and the row was saved under a generated placeholder like "Scanned product 4056489814795".
 * Routed through the `correct_product_catalogue_name` RPC rather than a table `update()`:
 * it is the one place allowed to touch a row this account did not contribute, and it can
 * only ever change `name`, on a row that is either this account's own contribution or
 * still carries a placeholder name — never a product someone already properly named, and
 * never a row from Open Food Facts or another public provider, which the app has no
 * authority to rewrite. An ineligible or invalid request quietly corrects nothing rather
 * than erroring, which is the same "best effort, never disturb the user" contract
 * `contributeCatalogueProduct` uses.
 */
export async function correctCatalogueProduct(barcode: string, name: string): Promise<void> {
  const normalized = normalizeBarcode(barcode);
  const trimmed = name.trim();
  if (!catalogueBarcodePattern.test(normalized) || !trimmed) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.rpc("correct_product_catalogue_name", { p_barcode: normalized, p_name: trimmed.slice(0, 240) });
  } catch {
    // Best effort: the user's own copy of the food is already corrected regardless.
  }
}
