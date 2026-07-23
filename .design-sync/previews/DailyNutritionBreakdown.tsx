import { DailyNutritionBreakdown } from "calorie-flow-design-system";

const nutrition = {
  calories: 1570,
  protein: 120,
  carbs: 127,
  fat: 64,
  fiber: 24,
  sugar: 33,
  micronutrients: {
    sodiumMg: 1840,
    cholesterolMg: 210,
    saturatedFatG: 14,
    potassiumMg: 2600,
    calciumMg: 780,
    ironMg: 12,
    magnesiumMg: 310,
    zincMg: 9,
    vitaminAMcg: 620,
    vitaminCMg: 65,
    vitaminDMcg: 4,
    vitaminEMg: 8,
    vitaminKMcg: 55,
    vitaminB12Mcg: 3.2,
    folateMcg: 280,
  },
};

export function Default() {
  return <DailyNutritionBreakdown nutrition={nutrition} hideCalories={false} />;
}

export function HideCalories() {
  return <DailyNutritionBreakdown nutrition={nutrition} hideCalories={true} />;
}
