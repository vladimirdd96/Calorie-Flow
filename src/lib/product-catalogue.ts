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
export async function findCatalogueProduct(barcode: string): Promise<Food | null> {
  const normalized = normalizeBarcode(barcode);
  if (!catalogueBarcodePattern.test(normalized)) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("product_catalogue").select(catalogueColumns).eq("barcode", normalized).maybeSingle();
    if (error || !data) return null;
    return parseCatalogueRow(data);
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
