<!-- read_when: API, endpoint, route, handler, request, response, HTTP, fetch, OpenAI, label, worker -->

# API surfaces

The Next.js routes handle AI package interpretation (`src/app/api/analyze-label/route.ts`) and optional Open Food Facts lookups (`src/app/api/food-search/route.ts`) during local Next development and deployment. Label analysis accepts one to three explicitly selected package images, so a nutrition table, barcode, and package size can be read together. Food search accepts a 2–100 character `q` query, validates the upstream response, and returns a temporary-unavailable response without affecting local or custom food search. `cloudflare/sites-worker.js` provides the matching deployed Cloudflare Sites API surface, including AI Coach and package interpretation.

AI calls require a server-side `OPENAI_API_KEY`. Model names are optional configuration with safe defaults. Do not send data to OpenAI until the user explicitly invokes an AI feature.

Validate request bodies and external responses at the boundary. Return actionable JSON errors with appropriate HTTP status codes, and never return credentials, access tokens, or private diary data beyond the authenticated user.
