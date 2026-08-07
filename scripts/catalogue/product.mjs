/**
 * Normalizes one Open Food Facts export record, in either of the two schemas the export
 * currently mixes together.
 *
 * Open Food Facts is migrating the export (`schema_version` 1001-1004). On a migrated
 * record the flat `nutriments` map is present but **empty**, and nutrition moved to
 * `nutrition.aggregated_set`. Reading only the legacy shape therefore fails silently
 * rather than loudly: the type check passes, every lookup returns zero, and the product is
 * discarded as having no nutrition. A sample of 1,500 records spread across the export
 * found 59% migrated, 23% legacy and 18% with no nutrition at all — so the legacy-only
 * reader was throwing away roughly three quarters of the usable dataset while reporting
 * success.
 *
 * The migrated shape is also strictly better: each nutrient carries its own `unit`, and
 * the set declares `per` (100g/100ml) and `preparation` (as_sold/prepared), none of which
 * the flat `*_100g` keys could express.
 */

/** Nutrient names are shared between schemas; only the container changed. */
const MACROS = {
  calories: { new: "energy-kcal", legacy: "energy-kcal_100g" },
  protein: { new: "proteins", legacy: "proteins_100g" },
  carbs: { new: "carbohydrates", legacy: "carbohydrates_100g" },
  fat: { new: "fat", legacy: "fat_100g" },
  fiber: { new: "fiber", legacy: "fiber_100g" },
  sugar: { new: "sugars", legacy: "sugars_100g" },
};

/** Micronutrients, with the unit the app stores them in. */
const MICROS = {
  sodiumMg: { new: "sodium", legacy: "sodium_100g", unit: "mg" },
  cholesterolMg: { new: "cholesterol", legacy: "cholesterol_100g", unit: "mg" },
  saturatedFatG: { new: "saturated-fat", legacy: "saturated-fat_100g", unit: "g" },
  potassiumMg: { new: "potassium", legacy: "potassium_100g", unit: "mg" },
  calciumMg: { new: "calcium", legacy: "calcium_100g", unit: "mg" },
  ironMg: { new: "iron", legacy: "iron_100g", unit: "mg" },
  magnesiumMg: { new: "magnesium", legacy: "magnesium_100g", unit: "mg" },
  zincMg: { new: "zinc", legacy: "zinc_100g", unit: "mg" },
  vitaminAMcg: { new: "vitamin-a", legacy: "vitamin-a_100g", unit: "mcg" },
  vitaminCMg: { new: "vitamin-c", legacy: "vitamin-c_100g", unit: "mg" },
  vitaminDMcg: { new: "vitamin-d", legacy: "vitamin-d_100g", unit: "mcg" },
  vitaminEMg: { new: "vitamin-e", legacy: "vitamin-e_100g", unit: "mg" },
  vitaminKMcg: { new: "phylloquinone", legacy: "vitamin-k_100g", unit: "mcg" },
  vitaminB12Mcg: { new: "vitamin-b12", legacy: "vitamin-b12_100g", unit: "mcg" },
  folateMcg: { new: "vitamin-b9", legacy: "folates_100g", unit: "mcg" },
};

/** Grams per unit, used to normalize a nutrient onto the unit the app stores. */
const GRAMS_PER = { g: 1, mg: 1e-3, "µg": 1e-6, ug: 1e-6, mcg: 1e-6 };

function numberValue(value) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(numberValue(value) * factor) / factor;
}

/** Converts a migrated nutrient onto `target`, honouring the unit it declares. */
function convert(nutrient, target) {
  // `value` is what the label or manufacturer stated; `value_computed` is derived
  // (energy from macros, salt from sodium). Prefer the stated one.
  const raw = numberValue(nutrient.value ?? nutrient.value_computed);
  if (!raw) return 0;
  const unit = String(nutrient.unit || "").toLowerCase();
  if (target === "g" || target === "mg" || target === "mcg") {
    const grams = raw * (GRAMS_PER[unit] ?? 1);
    return grams / GRAMS_PER[target];
  }
  return raw;
}

function migratedNutrition(record) {
  const set = record.nutrition?.aggregated_set;
  const nutrients = set?.nutrients;
  if (!nutrients || typeof nutrients !== "object") return null;
  // Only per-100 sets are usable as-is. 100ml is fine: the app logs drinks as grams.
  if (set.per !== "100g" && set.per !== "100ml") return null;

  const energy = nutrients["energy-kcal"];
  const kilojoules = nutrients["energy-kj"] || nutrients.energy;
  const nutrition = {
    calories: Math.round(energy ? convert(energy, "kcal") : numberValue(kilojoules?.value) / 4.184),
    protein: round(nutrients[MACROS.protein.new] ? convert(nutrients[MACROS.protein.new], "g") : 0),
    carbs: round(nutrients[MACROS.carbs.new] ? convert(nutrients[MACROS.carbs.new], "g") : 0),
    fat: round(nutrients[MACROS.fat.new] ? convert(nutrients[MACROS.fat.new], "g") : 0),
    fiber: round(nutrients[MACROS.fiber.new] ? convert(nutrients[MACROS.fiber.new], "g") : 0),
    sugar: round(nutrients[MACROS.sugar.new] ? convert(nutrients[MACROS.sugar.new], "g") : 0),
  };
  const micronutrients = {};
  for (const [field, spec] of Object.entries(MICROS)) {
    const nutrient = nutrients[spec.new];
    micronutrients[field] = nutrient ? round(convert(nutrient, spec.unit), 3) : 0;
  }
  if (Object.values(micronutrients).some(Boolean)) nutrition.micronutrients = micronutrients;
  return nutrition;
}

function legacyNutrition(record) {
  const nutriments = record.nutriments;
  if (!nutriments || typeof nutriments !== "object" || !Object.keys(nutriments).length) return null;
  const nutrition = {
    calories: Math.round(numberValue(nutriments["energy-kcal_100g"]) || numberValue(nutriments.energy_100g) / 4.184),
    protein: round(nutriments.proteins_100g),
    carbs: round(nutriments.carbohydrates_100g),
    fat: round(nutriments.fat_100g),
    fiber: round(nutriments.fiber_100g),
    sugar: round(nutriments.sugars_100g),
  };
  const micronutrients = {};
  for (const [field, spec] of Object.entries(MICROS)) {
    const raw = numberValue(nutriments[spec.legacy]);
    // Legacy values are all grams; the app stores some of them in mg or µg.
    micronutrients[field] = raw ? round(raw / GRAMS_PER[spec.unit === "g" ? "g" : spec.unit], 3) : 0;
  }
  if (Object.values(micronutrients).some(Boolean)) nutrition.micronutrients = micronutrients;
  return nutrition;
}

export function readNutrition(record) {
  return migratedNutrition(record) || legacyNutrition(record);
}

/**
 * Rebuilds the front-of-pack thumbnail URL. The migrated export dropped
 * `image_front_small_url` entirely and keeps only `images.selected.front.<lang>`, from
 * which the public path is derived: codes longer than eight digits are split 3/3/3/rest.
 */
export function readImageUrl(record, preferredLanguages = ["en"]) {
  const front = record.images?.selected?.front;
  if (front && typeof front === "object") {
    const languages = [...preferredLanguages, record.lang, ...Object.keys(front)].filter(Boolean);
    for (const language of languages) {
      const image = front[language];
      if (!image?.rev) continue;
      const code = String(record.code || "");
      if (!code) return null;
      const path = code.length <= 8 ? code : `${code.slice(0, 3)}/${code.slice(3, 6)}/${code.slice(6, 9)}/${code.slice(9)}`;
      return `https://images.openfoodfacts.org/images/products/${path}/front_${language}.${image.rev}.200.jpg`;
    }
  }
  const legacy = record.image_front_small_url || record.image_small_url;
  return typeof legacy === "string" && legacy.startsWith("https://") ? legacy : null;
}

function positive(value, max = Infinity) {
  const parsed = numberValue(value);
  return parsed > 0 && parsed <= max ? Math.round(parsed * 10) / 10 : null;
}

/** Local-language names, kept as hidden search terms so Cyrillic spellings still match. */
export function readKeywords(record, name) {
  const terms = new Set();
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith("product_name_") && !key.startsWith("generic_name_")) continue;
    if (typeof value !== "string") continue;
    const term = value.trim();
    if (term && term !== name && term.length <= 120) terms.add(term);
  }
  return [...terms].slice(0, 20);
}

/**
 * Uniform view of a product across both schemas, or null when it carries no name, no
 * valid barcode, or no nutrition worth storing.
 */
export function normalizeProduct(record) {
  const code = String(record.code || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return null;
  const name = String(record.product_name || record.product_name_en || record.generic_name || "").trim().slice(0, 200);
  if (!name) return null;
  const nutrition = readNutrition(record);
  if (!nutrition) return null;
  // A row with neither energy nor macros cannot answer "how much did I eat".
  if (!nutrition.calories && !nutrition.protein && !nutrition.carbs && !nutrition.fat) return null;

  return {
    code,
    name,
    brand: String(record.brands || "").split(",")[0]?.trim().slice(0, 120) || null,
    quantityLabel: String(record.quantity || "").trim().slice(0, 60) || null,
    servingLabel: String(record.serving_size || "").trim().slice(0, 60) || null,
    servingGrams: positive(record.serving_quantity, 20_000),
    packageGrams: positive(record.product_quantity, 100_000),
    imageUrl: readImageUrl(record),
    nutrition,
    keywords: readKeywords(record, name),
    countriesTags: Array.isArray(record.countries_tags) ? record.countries_tags : [],
    brandsTags: Array.isArray(record.brands_tags) ? record.brands_tags : [],
  };
}
