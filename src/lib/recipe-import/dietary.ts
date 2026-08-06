import { dietaryTags } from "../types";
import type { DietaryTag, Nutrition } from "../types";

/**
 * Heuristic dietary tagging from an ingredient list, ported from the catalogue seeding
 * script so imported recipes carry the same tags as seeded ones. Tags are a filter aid,
 * not a medical claim — the user can edit them in the composer.
 */

const meatWords = /\b(chicken|beef|pork|turkey|lamb|bacon|sausage|salami|mortadella|prosciutto|ham|chuck roast|steak|ground (beef|pork|lamb)|veal|corned beef|hot dogs?|picanha|tomahawk|ribeye|duck|goose|venison|gelatin)\b/i;
const fishWords = /\b(shrimp|salmon|tuna|fish|halibut|cod|prawns?|anchov(y|ies)|sardines?|scallops?|crab|lobster|mussels?|clams?|squid|calamari|oysters?)\b/i;
const dairyWords = /\b(cheese|butter|cream|milk|yogurt|yoghurt|ricotta|mozzarella|parmesan|cheddar|gruy[eè]re|provolone|feta|mascarpone|ghee|custard)\b/i;
const eggWords = /\b(eggs?|egg wash|egg yolk|mayonnaise)\b/i;
const honeyWords = /\bhoney\b/i;
const glutenWords = /\b(pasta|noodles|spaghetti|penne|rigatoni|bread|breadcrumbs|flour|tortilla|buns?|pie crust|puff pastry|shortcrust|pizza dough|couscous|panko|hokkien|vermicelli|risoni|pastina|orzo|wonton|dumpling wrapper|egg roll wrapper|ciabatta|graham cracker|barley|farro|seitan|soy sauce)\b/i;
/** Grains/starches/sugars/legumes that disqualify a dish from keto or paleo, even if it happens to be low-carb overall. */
const starchyWords = /\b(rice|potato|corn|oats?|quinoa|grits|fonio|barley|bulgur|couscous|beans?|lentils?|chickpeas|peas)\b/i;
const refinedSugarWords = /\b(sugar|honey|maple syrup|agave|jam|jaggery|condensed milk|brown sugar)\b/i;
const legumeWords = /\b(beans?|lentils?|chickpeas|peanuts?|peanut butter|tofu|edamame|soy)\b/i;

/** Non-vegan animal products that are not meat or fish, kept separate so plant milks do not trip the dairy test. */
const plantDairy = /\b(coconut|almond|oat|soy|cashew|rice)\s+(milk|cream|yogurt|yoghurt|butter)\b/i;

export function dietaryTagsFor(ingredientNames: string[], nutritionPerServing?: Nutrition): DietaryTag[] {
  const text = ingredientNames.join(", ").toLowerCase();
  const withoutPlantDairy = text.replace(new RegExp(plantDairy.source, "gi"), " ");
  const hasMeat = meatWords.test(text);
  const hasFish = fishWords.test(text);
  const hasDairy = dairyWords.test(withoutPlantDairy);
  const hasEgg = eggWords.test(text);
  const hasHoney = honeyWords.test(text);
  const hasGluten = glutenWords.test(text);
  const hasStarch = starchyWords.test(text);
  const hasRefinedSugar = refinedSugarWords.test(text);
  const hasLegumes = legumeWords.test(text);

  const tags: DietaryTag[] = [];
  if (!hasMeat && !hasFish) tags.push(dietaryTags.vegetarian);
  if (!hasMeat && !hasFish && !hasDairy && !hasEgg && !hasHoney) tags.push(dietaryTags.vegan);
  if (!hasMeat && hasFish) tags.push(dietaryTags.pescatarian);
  if (!hasGluten) tags.push(dietaryTags.glutenFree);
  if (!hasDairy) tags.push(dietaryTags.dairyFree);
  // Keto: low-carb per serving and free of grains, starch, and refined sugar.
  if (nutritionPerServing && nutritionPerServing.carbs <= 12 && !hasStarch && !hasGluten && !hasRefinedSugar) tags.push(dietaryTags.keto);
  // Paleo: whole-food, no dairy/grains/legumes/refined sugar.
  if (!hasDairy && !hasGluten && !hasStarch && !hasLegumes && !hasRefinedSugar) tags.push(dietaryTags.paleo);
  return tags;
}
