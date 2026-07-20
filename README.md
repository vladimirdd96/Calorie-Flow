# Calorie Flow

A radically simple, local-first calorie-tracking PWA. It keeps the essential daily view in one place and reveals advanced controls only when they are useful.

## What works

- Daily calories, macros, fibre, meals, history, and seven-day trend
- Calorie target calculator using Mifflin–St Jeor and configurable activity/goal
- Balanced, high-protein, keto, high-protein keto, and low-fat macro templates
- Fast recent-food logging with contextual units: serving, package, piece, 100 g, grams, tablespoon, teaspoon, and millilitres
- Open Food Facts name search and barcode lookup
- Live camera barcode scanning through ZXing, plus manual code entry fallback
- AI nutrition-label extraction with structured follow-up questions
- Optional passwordless account with private cross-device Supabase sync
- Nutrition-only AI Coach with read-only tools for the user's targets, meals, and saved foods
- Food-place search when the user explicitly types a location; no device-location access
- Custom foods, editable nutrition, JSON backup/restore, and offline PWA install
- Local IndexedDB guest mode: no account is required

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Accounts, sync, and AI

Follow [docs/CLOUD_SYNC_SETUP.md](docs/CLOUD_SYNC_SETUP.md) to create the database, apply Row Level Security policies, configure magic-link redirects, and set deployment variables.

AI features use Cloudflare Workers AI's managed binding. No model download, provider API key, or browser credential is required. Cloudflare includes a daily free allocation; AI requests stop safely if that allocation is exhausted.

```bash
FDC_API_KEY=your_data_gov_key
```

The Worker verifies a Supabase access token before any AI call. Label extraction uses Kimi K2.6 with a strict JSON schema; the Coach uses GLM-4.7-Flash with read-only function tools. Neither model credential is exposed to the browser.

## Food data and licensing

Packaged-food results are aggregated from [Open Food Facts](https://world.openfoodfacts.org/) and, when configured, [USDA FoodData Central](https://fdc.nal.usda.gov/). The USDA key is server-side only. Open Food Facts is available under the Open Database License (ODbL); Calorie Flow attributes the source in the product UI and caches only foods the user actually selects. If you publish a derived combined food database, review and follow the ODbL attribution and share-alike requirements.

The small bundled list contains generic reference foods and is not medical advice. Nutrition values are estimates and should be checked against the package when accuracy matters.

## Privacy

Guest meal history and profile data stay in IndexedDB. Signed-in users opt into a Supabase-backed copy protected by per-user Row Level Security. Open Food Facts receives search terms/barcodes when used. A label photo is sent to Cloudflare Workers AI only when the user explicitly chooses AI label reading. Coach questions and the minimum relevant diary context are sent to Workers AI when the Coach is used. The app includes export/import so data is portable.

## Validation

```bash
npm test
npm run lint
npm run build
npm run build:cloudflare
```
