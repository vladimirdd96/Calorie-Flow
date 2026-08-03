// Derives instructions, dietary tags, and ingredient quantities for seeded recipes
// from their existing name + ingredient list, so every catalogue recipe is actually cookable.

const meatWords = /\b(chicken|beef|pork|turkey|lamb|bacon|sausage|salami|mortadella|prosciutto|ham|chuck roast|steak|ground (beef|pork|lamb)|veal|corned beef|hot dogs?|picanha|tomahawk|ribeye)\b/i;
const fishWords = /\b(shrimp|salmon|tuna|fish|halibut|cod|prawns?)\b/i;
const dairyWords = /\b(cheese|butter|cream|milk|yogurt|ricotta|mozzarella|parmesan|cheddar|gruy[eè]re|provolone|feta|mascarpone)\b/i;
const eggWords = /\b(eggs?|egg wash|egg yolk)\b/i;
const honeyWords = /\bhoney\b/i;
const glutenWords = /\b(pasta|noodles|spaghetti|penne|rigatoni|bread|breadcrumbs|flour|tortilla|buns?|pie crust|puff pastry|shortcrust|pizza dough|couscous|panko|hokkien|vermicelli|risoni|pastina|orzo|wonton|dumpling wrapper|egg roll wrapper|ciabatta|graham cracker)\b/i;

function dietaryTagsFor(ingredientNames) {
  const text = ingredientNames.join(", ").toLowerCase();
  const hasMeat = meatWords.test(text);
  const hasFish = fishWords.test(text);
  const hasDairy = dairyWords.test(text);
  const hasEgg = eggWords.test(text);
  const hasHoney = honeyWords.test(text);
  const hasGluten = glutenWords.test(text);
  const tags = [];
  if (!hasMeat && !hasFish) tags.push("vegetarian");
  if (!hasMeat && !hasFish && !hasDairy && !hasEgg && !hasHoney) tags.push("vegan");
  if (!hasMeat && hasFish) tags.push("pescatarian");
  if (!hasGluten) tags.push("glutenFree");
  if (!hasDairy) tags.push("dairyFree");
  return tags;
}

// Order matters: more specific / liquid matches must come before generic grain matches
// (e.g. "rice vinegar" must not match the "rice" grain rule).
const categoryRules = [
  { test: /\b(rice vinegar|rice wine|white wine vinegar|red wine vinegar|apple cider vinegar|balsamic vinegar)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(soy sauce|fish sauce|oyster sauce|vinegar|olive oil|sesame oil|avocado oil|coconut oil|hot sauce|worcestershire sauce|hoisin|sriracha|gochujang|tahini|pesto)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(lime juice|lemon juice|orange juice)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(beef|chicken|vegetable|fish)\s+(broth|stock)\b|\bbroth\b|\bstock\b/i, unit: "cups", base: 2, round: "quarter" },
  { test: /\b(chicken thighs?|chicken breasts?|whole chicken|chicken drumsticks?|chicken wings?)\b/i, unit: "lb", base: 1.25, round: "quarter" },
  { test: /\b(beef|steak|chuck roast|ground beef|ribeye|flank steak|skirt steak|tenderloin|brisket|rump cap|picanha|tomahawk)\b(?!\s*(broth|stock))/i, unit: "lb", base: 1.25, round: "quarter" },
  { test: /\b(pork|lamb|veal|bacon|sausage|salami|mortadella|prosciutto|ham(?! and)|hot dogs?)\b/i, unit: "lb", base: 1, round: "quarter" },
  { test: /\b(shrimp|salmon|tuna|fish fillets?|halibut|cod|white fish)\b/i, unit: "lb", base: 1, round: "quarter" },
  { test: /\b(ground turkey)\b/i, unit: "lb", base: 1, round: "quarter" },
  { test: /\b(rice|quinoa|couscous|risoni|orzo|farro|pearl couscous)\b/i, unit: "cup", base: 1, round: "quarter" },
  { test: /\b(pasta|spaghetti|penne|rigatoni|noodles|vermicelli|hokkien|shells)\b/i, unit: "oz", base: 8, round: "whole" },
  { test: /\bgarlic\b(?!\s*powder)/i, unit: "cloves", base: 3, round: "whole" },
  { test: /\bonion\b(?!\s*powder)|\bshallot\b/i, unit: "", base: 1, round: "whole" },
  { test: /\b(bell pepper|jalape[nñ]o|lime|lemon|avocado|cucumber|zucchini)\b/i, unit: "", base: 1, round: "whole" },
  { test: /\b(carrots?)\b/i, unit: "", base: 2, round: "whole" },
  { test: /\b(celery)\b/i, unit: "stalks", base: 2, round: "whole" },
  { test: /\b(ginger)\b/i, unit: "tbsp, grated", base: 1, round: "eighth" },
  { test: /\b(coconut milk|heavy cream|whole milk|milk)\b/i, unit: "cup", base: 1, round: "quarter" },
  { test: /\b(cherry tomatoes|tomatoes|kale|spinach|arugula|broccoli|cauliflower florets|cabbage|bean sprouts|coleslaw mix|lettuce)\b/i, unit: "cups", base: 2, round: "quarter" },
  { test: /\beggs?\b(?!\s*(wash|yolk))/i, unit: "", base: 2, round: "whole" },
  { test: /\b(mayonnaise|dijon mustard|mustard|relish|pickles?)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(cheese|cheddar|mozzarella|parmesan|feta|ricotta|gruy[eè]re|provolone)\b/i, unit: "cup, shredded", base: 0.75, round: "quarter" },
  { test: /\b(butter)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(sugar|honey|maple syrup|agave)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(tortillas?|buns?|pita)\b/i, unit: "", base: 4, round: "whole" },
  { test: /\b(salt|pepper|paprika|cumin|oregano|thyme|cinnamon|nutmeg|chil[il]i? flakes|seasoning|powder|turmeric|curry powder|sumac|saffron|cornstarch|vanilla extract|rosemary|bay leaves?)\b/i, unit: "tsp", base: 1, round: "eighth" },
  { test: /\b(cilantro|parsley|basil|coriander|mint|chives|dill)\b/i, unit: "", base: 1, round: "whole", suffix: " bunch, chopped" },
  { test: /\b(sesame seeds|breadcrumbs|panko)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(scallions?|green onions?)\b/i, unit: "", base: 3, round: "whole" },
  { test: /\b(tomato paste)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(white wine|red wine)\b/i, unit: "cup", base: 0.5, round: "quarter" },
  { test: /\b(flour)\b/i, unit: "cup", base: 0.5, round: "quarter" },
  { test: /\b(mushrooms)\b/i, unit: "cups, sliced", base: 2, round: "quarter" },
  { test: /\b(kalamata olives|green olives|capers)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(black beans|corn|green beans|snap peas)\b/i, unit: "cup", base: 1, round: "quarter" },
  { test: /\b(chipotle peppers in adobo)\b/i, unit: "peppers, minced", base: 2, round: "whole" },
  { test: /\b(bbq sauce)\b/i, unit: "cup", base: 0.5, round: "quarter" },
  { test: /\b(coconut aminos|vegetable oil)\b/i, unit: "tbsp", base: 2, round: "eighth" },
  { test: /\b(rotisserie chicken)\b/i, unit: "cups, shredded", base: 2, round: "quarter" },
  { test: /\b(leeks?)\b/i, unit: "", base: 1, round: "whole" },
  { test: /\b(prawns?)\b/i, unit: "lb", base: 1, round: "quarter" },
];

function scaleAmount(base, servings, round) {
  const factor = servings / 4;
  if (round === "whole") return String(Math.max(1, Math.round(base * factor)));
  const step = round === "quarter" ? 0.25 : 0.125;
  const value = Math.max(step, Math.round((base * factor) / step) * step);
  if (value === Math.round(value)) return String(value);
  const whole = Math.floor(value);
  const frac = value - whole;
  const fracLabel = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : frac === 0.125 ? "⅛" : frac === 0.375 ? "⅜" : String(Math.round(frac * 100) / 100);
  return whole > 0 ? `${whole}${fracLabel}` : fracLabel;
}

function quantityFor(name, servings) {
  for (const rule of categoryRules) {
    if (rule.test.test(name)) {
      const amount = scaleAmount(rule.base, servings, rule.round);
      const base = rule.unit ? `${amount} ${rule.unit}` : amount;
      return rule.suffix ? `${base}${rule.suffix}` : base;
    }
  }
  return undefined;
}

const noCookWords = /deviled|dip\b|guacamole|no-bake|energy bites|overnight oats|carpaccio|tataki|ceviche|salted citrus bars|tuiles|cookies\b|bars\b/i;
const dessertWords = /cake|cookie|muffin|\bbar\b|cheesecake|tuile|pudding|scone|(coffee|toffee|chocolate|cream|lemon|key lime|pecan|apple|pumpkin)[\s-]+pie/i;
const savoryPieWords = /\bpie\b|pot pie/i;
const bakingBreadWords = /quiche|casserole|egg bake|frittata|egg bites/i;

const methodTemplates = [
  { test: noCookWords, steps: (n, ing, servings) => [
    `If using boiled/precooked components (eggs, grains, proteins), prepare and cool those first.`,
    `Combine ${ing[0]} with the remaining wet ingredients in a mixing bowl, stirring until smooth and evenly combined.`,
    `Fold in any remaining mix-ins, adjusting texture as needed.`,
    `Taste and adjust seasoning or sweetness.`,
    `Chill or portion as needed, then serve for ${servings} servings.`,
  ] },
  { test: dessertWords, steps: (n, ing) => [
    `Preheat the oven to 350°F (175°C) and prepare your pan (grease, line, or butter as needed).`,
    `Whisk together the dry ingredients in one bowl and the wet ingredients (including ${ing[0]}) in another.`,
    `Combine the wet and dry mixtures, folding gently until just incorporated — don't overmix.`,
    `Pour or spoon the batter into the prepared pan and smooth the top.`,
    `Bake until a toothpick comes out clean (start checking a few minutes before the low end of typical bake time) and let cool before slicing.`,
  ] },
  { test: bakingBreadWords, steps: (n, ing) => [
    `Preheat the oven to 375°F (190°C) and grease your baking dish.`,
    `Whisk together the eggs and dairy in a large bowl until smooth.`,
    `Layer or fold in ${ing[0]} and the remaining ingredients.`,
    `Pour into the prepared dish and bake until set and lightly golden, 25-35 minutes.`,
    `Let rest 5 minutes before slicing and serving.`,
  ] },
  { test: savoryPieWords, steps: (n, ing) => [
    `Cook ${ing[0]} with the aromatics in a large pan or pot over medium heat until browned and fragrant.`,
    `Stir in the remaining filling ingredients and simmer until thickened and well combined.`,
    `Let the filling cool slightly, then transfer to a pie dish or skillet.`,
    `Top with pastry or a mash/crust layer as listed, sealing or crimping the edges, and brush with egg wash if using.`,
    `Bake at 400°F (200°C) until the top is golden and cooked through, about 25-35 minutes.`,
    `Rest 5-10 minutes before slicing and serving.`,
  ] },
  { test: /stir[- ]?fry|stir fried/i, steps: (n, ing, servings) => [
    `Prep all vegetables and aromatics before starting — stir-frying moves fast once the wok is hot.`,
    `Heat oil in a wok or large skillet over high heat until shimmering.`,
    `Add aromatics and cook 30 seconds until fragrant.`,
    `Add ${ing[0]} and stir-fry 3-5 minutes until nearly cooked through.`,
    `Add the remaining vegetables and sauce ingredients, tossing constantly for 2-3 minutes.`,
    `Taste, adjust seasoning, and serve immediately over rice or noodles for ${servings} servings.`,
  ] },
  { test: /soup|stew|chowder|chili|zuppa|braised|pot roast|birria/i, steps: (n, ing) => [
    `Sear or brown ${ing[0]} in a large pot over medium-high heat until well colored.`,
    `Add onion, garlic, and any other aromatics; cook 3-4 minutes until softened.`,
    `Stir in the remaining seasonings and cook 1 minute until fragrant.`,
    `Pour in the broth or liquid and bring to a simmer.`,
    `Cover and simmer (or braise, low and slow) until everything is tender and flavors meld.`,
    `Taste, adjust seasoning, and serve hot.`,
  ] },
  { test: /salad/i, steps: (n, ing) => [
    `Wash and dry all produce thoroughly so the dressing clings instead of pooling.`,
    `Chop ${ing[0]} and any other vegetables into bite-sized pieces.`,
    `Whisk together the dressing ingredients in a small bowl until emulsified.`,
    `Combine all salad ingredients in a large bowl.`,
    `Pour the dressing over just before serving and toss to coat.`,
  ] },
  { test: /roast|grilled?|skewers?|kebabs?|tenderloin|wellington/i, steps: (n, ing) => [
    `Preheat the oven or grill to medium-high heat (about 400°F / 200°C).`,
    `Season ${ing[0]} generously with the listed spices and salt.`,
    `Arrange with space between pieces so it roasts/grills rather than steams.`,
    `Cook, turning or checking partway through, until cooked through and nicely browned.`,
    `Rest 5-10 minutes before slicing or serving.`,
  ] },
  { test: /pasta|noodles|mac and cheese|carbonara/i, steps: (n, ing) => [
    `Bring a large pot of salted water to a boil and cook the pasta/noodles until al dente; reserve a cup of pasta water before draining.`,
    `While the pasta cooks, prepare the sauce: cook ${ing[0]} in a large skillet over medium heat until fragrant.`,
    `Add the remaining sauce ingredients and simmer until slightly thickened.`,
    `Toss the drained pasta into the sauce, loosening with a splash of reserved pasta water if needed.`,
    `Finish with cheese or garnish as listed and serve hot.`,
  ] },
  { test: /taco|burrito|bowl|wraps?/i, steps: (n, ing) => [
    `Cook ${ing[0]} with the listed seasonings until done, then set aside.`,
    `Prepare the base (rice, beans, or greens) according to standard method.`,
    `Chop any fresh toppings.`,
    `Warm tortillas or plate bowls, layering base, protein, and toppings.`,
    `Finish with sauce or dressing and serve immediately.`,
  ] },
];

const defaultSteps = (n, ing, servings) => [
  `Gather and prep all the ingredients before starting.`,
  `Cook ${ing[0]} in a large pan over medium heat until nearly done.`,
  `Add the remaining ingredients in order of cook time, aromatics first, delicate items last.`,
  `Combine everything and cook until flavors come together and everything is heated through.`,
  `Taste, adjust seasoning, and serve warm for ${servings} servings.`,
];

export function instructionsFor(name, ingredientNames, servings) {
  const template = methodTemplates.find((t) => t.test.test(name));
  const steps = (template || { steps: defaultSteps }).steps(name, ingredientNames, servings);
  return steps;
}

export function enrichIngredients(ingredientNames, servings) {
  return ingredientNames.map((name) => ({ name, quantity: quantityFor(name, servings) }));
}

export function enrichEntry(entry) {
  const names = entry.ingredients.map((i) => (typeof i === "string" ? i : i.name));
  return {
    ...entry,
    ingredients: enrichIngredients(names, entry.servings),
    instructions: instructionsFor(entry.name, names, entry.servings),
    dietaryTags: dietaryTagsFor(names),
  };
}
