import { MealImageViewer } from "calorie-flow-design-system";
import { meals } from "./_fixtures";

const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d9c9a3"/><text x="300" y="210" font-family="system-ui" font-size="28" fill="#5b4a2f" text-anchor="middle">Grilled chicken salad</text></svg>`;
const placeholderPhoto = "data:image/svg+xml;utf8," + encodeURIComponent(placeholderSvg);

export function Default() {
  return <MealImageViewer meal={{ ...meals[1], imageUrl: placeholderPhoto }} />;
}
