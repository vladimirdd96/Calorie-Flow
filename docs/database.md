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

## Recipe catalogue

`public_recipes` (`supabase/migrations/202608030001_public_recipes.sql`) follows the same separate-public-table pattern: it is not part of the per-user `user_profiles` blob, since it must be readable across accounts. Rows come from two sources — `community` (a user's own `Recipe`, mirrored here when they toggle "Share to catalogue"; `author_id` set, deletable only by that author) and `ai` (server-generated via `/api/recipes/generate`; `author_id` null, not user-deletable). A generated `search_key` column (normalized, lowercased name) carries a unique index so the catalogue cannot accumulate near-duplicate recipes regardless of source; callers must check for an existing `search_key` before inserting and link to the existing row instead.

Photos on `ai`-sourced rows may be hotlinked from the recipe's source site (`image_url` pointing at their URL, `image_credit` recording `{ label, sourceUrl }` for a visible "via {site}" credit) rather than downloaded — the AI rewrites ingredient/nutrition text independently of the source rather than copying it. `recipe_generation_log` tracks one row per user (`generated_at`) so the generate endpoint can enforce a 7-day cooldown per account; both new tables use the same per-user RLS scoping (`auth.uid()`) as every other cloud table, and there is no service-role key in this project — server routes that need to write on a user's behalf forward that user's own bearer token to Supabase, the same technique `authenticatePaidFeature` already uses.
