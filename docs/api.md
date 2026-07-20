<!-- read_when: API, endpoint, route, handler, request, response, HTTP, fetch, OpenAI, label, worker -->

# API surfaces

The Next.js route `src/app/api/analyze-label/route.ts` handles AI package interpretation during local Next development and deployment. It accepts one to three explicitly selected package images, so a nutrition table, barcode, and package size can be read together. `cloudflare/sites-worker.js` provides the deployed Cloudflare Sites API surface, including AI Coach and package interpretation.

AI calls require a server-side `OPENAI_API_KEY`. Model names are optional configuration with safe defaults. Do not send data to OpenAI until the user explicitly invokes an AI feature.

Validate request bodies and external responses at the boundary. Return actionable JSON errors with appropriate HTTP status codes, and never return credentials, access tokens, or private diary data beyond the authenticated user.
