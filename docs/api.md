<!-- read_when: API, endpoint, route, handler, request, response, HTTP, fetch, OpenAI, label, worker -->

# API surfaces

The meal-photo endpoint accepts a user-selected food image or calorie-app screenshot and returns an estimated meal for confirmation before diary logging.

Coach responses may also include a validated `mealAction` for explicit logging requests or `mealChoices` for ambiguous date/meal-type requests. The browser owns the final local/cloud diary write; the server never writes diary rows during AI inference.

The Next.js routes handle the private nutrition Coach (`src/app/api/coach/route.ts`), AI package interpretation (`src/app/api/analyze-label/route.ts`), and optional food catalogue lookups (`src/app/api/food-search/route.ts`) during local Next development and OpenNext deployment. Food search aggregates Open Food Facts with USDA FoodData Central when the server-only `FDC_API_KEY` is configured; either provider may be unavailable without breaking local or custom-food search. Label analysis accepts one to three explicitly selected package images, so a nutrition table, barcode, and package size can be read together. Food search accepts a 2–100 character `q` query or an 8–18 digit `barcode`, uses Bulgarian/English localization for Open Food Facts, validates upstream responses, and returns source-labelled normalized foods. `cloudflare/sites-worker.js` maintains the matching static-Sites API surface. Label results may use the recognized product name and brand for a best-effort catalogue metadata/image match; scanned nutrition remains the fallback.

AI calls require the Cloudflare Workers AI `AI` binding and a verified Supabase bearer session. The browser never receives an AI credential. Do not send data to Workers AI until the user explicitly invokes an AI feature. The Coach uses GLM-4.7-Flash and label reading uses Kimi K2.6. When `hideCalories` is enabled, Coach tools omit calorie fields and the server redacts numeric calorie output before returning it.

Validate request bodies and external responses at the boundary. Return actionable JSON errors with appropriate HTTP status codes, and never return credentials, access tokens, or private diary data beyond the authenticated user.
