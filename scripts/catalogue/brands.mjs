/**
 * Supermarket private labels whose products are the ones a barcode scan most often
 * misses. Open Food Facts tags many of them to whichever country an contributor
 * happened to photograph them in — the Pilos high-protein yogurt sold in Bulgaria is
 * filed under Serbia and Germany — so a country filter alone would skip them. Matching
 * on brand as well catches the whole house range regardless of which market tagged it.
 *
 * Values are compared against Open Food Facts `brands_tags`, which are lowercased and
 * hyphenated (`k-classic`, `chef-select`).
 */
export const houseBrandTags = [
  // Lidl
  "pilos", "milbona", "combino", "crownfield", "freeway", "cien", "dulano", "chef-select",
  "vitasia", "alesto", "bellarom", "belbake", "baresa", "deluxe", "lupilu", "solevita",
  "sondey", "vemondo", "eridanous", "kania", "italiamo", "nixe", "harvest-basket",
  "favorina", "snack-day", "gelatelli", "linessa", "maribel", "mcennedy", "perlenbacher",
  "argus", "batts", "saguaro", "lidl",
  // Kaufland
  "k-classic", "k-bio", "k-take-it-veggie", "k-purland", "k-favourites", "k-free", "kaufland",
  // Carrefour
  "carrefour", "carrefour-bio", "carrefour-classic", "carrefour-extra", "carrefour-selection",
  "reflets-de-france", "simpl",
  // Aldi
  "milfina", "gut-bio", "mamia", "moser-roth", "choceur", "aldi",
  // Billa / REWE
  "billa", "clever", "ja-naturlich", "billa-bio",
  // CBA
  "cba", "cba-fresh",
  // Other chains selling into the same market
  "fantastico", "t-market", "aro", "metro-chef", "spar", "s-budget", "penny", "penny-market",
  "auchan", "pouce", "tesco", "lidl-plus",
];

/** Countries whose whole product range is worth seeding, as Open Food Facts country tags. */
export const defaultCountryTags = ["en:bulgaria"];
