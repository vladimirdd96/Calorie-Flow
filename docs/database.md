<!-- read_when: database, DB, IndexedDB, Supabase, migration, schema, table, SQL, row level security, RLS -->

# Data storage

`src/lib/db.ts` owns the local IndexedDB cache for signed-in users. Writes resolve only after the IndexedDB transaction commits, and snapshot replacement updates meals, foods, and profile in one transaction so an interrupted restore cannot leave a half-cleared diary. `src/lib/cloud.ts` coordinates synchronization. Shared domain types live in `src/lib/types.ts`; `src/lib/schemas.ts` validates cloud, backup, and AI data at their boundaries.

Meals persist a `loggedDate` local calendar key in addition to the ISO `createdAt` timestamp. Calendar views and Coach date filters prefer `loggedDate`; older rows fall back to deriving a date from `createdAt` for compatibility.

Supabase migrations are SQL files under `supabase/migrations/`, ordered by their timestamp prefix. Apply a new migration through the Supabase SQL editor or CLI; never edit a migration that may already be deployed.

The user-sync migration enables Row Level Security. Any new cloud table or operation must be scoped to `auth.uid()` and documented in `docs/CLOUD_SYNC_SETUP.md` when it changes setup requirements.

## Private diary sharing

`diary_shares` is an invite-only, read-only sharing table. Owners invite a normalized email address, and only the signed-in account with that address can accept through `accept_diary_share`. Accepted recipients can select the owner's meals and foods through narrowly scoped RLS policies; they cannot see profiles, modify a shared diary, or discover other users. Revoking a share removes read access immediately while retaining the owner's invitation record.

## Packaged-food catalogue

Do not copy a global product catalogue into `user_foods`: it is a private, per-user sync table. The app searches Open Food Facts on demand, then persists only foods a user logs. This preserves offline access to the user's history and prevents a shared catalogue from consuming the free database tier.

If a hosted catalogue is needed later, keep it in a separate public, read-only table with a compact normalized schema (barcode, name, brand, package/serving quantities, nutrients, source revision). Import a country/category subset first, measure its data plus index size, and leave headroom below Supabase Free's 500 MB database-size limit. Open Food Facts data is ODbL: attribution and share-alike obligations apply to a derived database.

## Bundled reference foods

Product catalogues answer barcodes, so they cannot answer "shopska salad", "mojito" or "walnuts". Those foods ship with the app as `source: "seed"` rows: `src/lib/seed.ts` (staples), `src/lib/produce.ts` (raw fruit and vegetables) and `src/lib/reference-foods/` (Bulgarian and European dishes, alcoholic drinks and cocktails, and single foods missing from `produce.ts`). Rows are compact tuples expanded by `buildReferenceFoods`; the id is derived from the name, so renaming a food creates a new row rather than editing the old one.

Nutrition is per 100 g as eaten — per 100 ml for drinks, which the app logs as grams. Only single foods with published composition data set `verified: true`; prepared dishes and mixed drinks stay unverified so meals logged from them are marked estimated.

`Food.keywords` holds local-language search terms, including Cyrillic spellings, that are never displayed. Every search surface must match through `foodMatchesQuery` in `src/lib/food-search.ts` rather than concatenating fields itself.

`initializeFoods` writes seed rows the IndexedDB cache is missing and rewrites the ones whose shipped data has changed, preserving only `lastUsedAt`, so catalogue additions and corrected values reach existing installs. Nothing else on a seed row is user-editable; a user's own edits belong to a `custom` food.

## Recipe catalogue

`public_recipes` (`supabase/migrations/202608030001_public_recipes.sql`) follows the same separate-public-table pattern: it is not part of the per-user `user_profiles` blob, since it must be readable across accounts. Rows come from two sources — `community` (a user's own `Recipe`, mirrored here when they toggle "Share to catalogue"; `author_id` set, deletable only by that author) and `ai` (server-generated via `/api/recipes/generate`; `author_id` null, not user-deletable). A generated `search_key` column (normalized, lowercased name) carries a unique index so the catalogue cannot accumulate near-duplicate recipes regardless of source; callers must check for an existing `search_key` before inserting and link to the existing row instead.

Photos on `ai`-sourced rows may be hotlinked from the recipe's source site (`image_url` pointing at their URL, `image_credit` recording `{ label, sourceUrl }` for a visible "via {site}" credit) rather than downloaded — the AI rewrites ingredient/nutrition text independently of the source rather than copying it. `recipe_generation_log` tracks one row per user (`generated_at`) so the generate endpoint can enforce a 7-day cooldown per account; both new tables use the same per-user RLS scoping (`auth.uid()`) as every other cloud table, and there is no service-role key in this project — server routes that need to write on a user's behalf forward that user's own bearer token to Supabase, the same technique `authenticatePaidFeature` already uses.

## Imported recipes

A recipe imported from a pasted link (`/api/recipes/import`) is an ordinary personal `Recipe` inside the `user_profiles.data` blob, like every other recipe a user creates. Nothing about an import is auto-published: it carries `origin: "imported"` plus an `importedFrom` `{ url, siteName }` for attribution, and it reaches `public_recipes` only if the user later toggles "Share to catalogue" themselves. When a shared recipe's photo is a remote `https://` URL, `publishRecipeToCatalogue` records `image_credit` from `importedFrom` so the hotlink carries the same visible "via {site}" credit as an `ai` row.

`recipe_import_log` (`supabase/migrations/202608060001_recipe_import_log.sql`) holds one row per user (`window_start`, `count`) for a rolling 20-imports-per-hour quota. The point is to bound the endpoint's arbitrary-URL outbound fetch surface, not to ration the feature — contrast the 7-day `recipe_generation_log` cooldown, which rations AI generation. It uses the same `auth.uid()` RLS scoping and the same forwarded-user-token write path as every other cloud table.

`supabase/migrations/202608040001_public_recipes_instructions.sql` added `instructions` (jsonb array of ordered step strings, default `[]`), `cuisine` (text, nullable), and `dietary_tags` (jsonb array, default `[]`) to `public_recipes`, plus an `update` policy scoped to `source = 'ai'` — mirroring the insert policy's symmetry, any authenticated user may complete/correct an AI-sourced row the same way they may create one, while `community` rows stay immutable by anyone but their author. `RecipeIngredient` also gained an optional `quantity` string (freeform cooking-measurement text like `"2 cups"`, separate from the existing `amount`/`unit`/`grams` used for nutrition-logging math) so the catalogue detail view can scale ingredient amounts against a servings stepper.
