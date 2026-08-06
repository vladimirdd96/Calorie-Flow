import { NextRequest, NextResponse } from "next/server";
import { authenticatePaidFeature } from "@/lib/server-auth";
import { estimateRecipeNutrition, isEstimatableRecipe } from "@/lib/recipe-nutrition";
import { getWorkersAi } from "@/lib/workers-ai";

export const runtime = "nodejs";

type RequestBody = { ingredients?: unknown; servings?: unknown; servingGrams?: unknown };

export async function POST(request: NextRequest) {
  const auth = await authenticatePaidFeature(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json() as RequestBody;
    if (!isEstimatableRecipe(body)) {
      return NextResponse.json({ error: "Add ingredients, servings, and grams per serving first." }, { status: 400 });
    }

    const estimate = await estimateRecipeNutrition(await getWorkersAi(), body);
    if (!estimate) return NextResponse.json({ error: "The estimate service did not return usable nutrition data." }, { status: 502 });
    return NextResponse.json(estimate);
  } catch {
    return NextResponse.json({ error: "The nutrition estimate could not be generated. You can still enter it manually." }, { status: 500 });
  }
}
