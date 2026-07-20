<!-- read_when: database, DB, IndexedDB, Supabase, migration, schema, table, SQL, row level security, RLS -->

# Data storage

`src/lib/db.ts` owns the local IndexedDB store used by guest mode. Writes resolve only after the IndexedDB transaction commits, and snapshot replacement updates meals, foods, and profile in one transaction so an interrupted restore cannot leave a half-cleared diary. `src/lib/cloud.ts` coordinates optional cloud synchronization. Shared domain types live in `src/lib/types.ts`; `src/lib/schemas.ts` validates cloud, backup, and AI data at their boundaries.

Meals persist a `loggedDate` local calendar key in addition to the ISO `createdAt` timestamp. Calendar views and Coach date filters prefer `loggedDate`; older rows fall back to deriving a date from `createdAt` for compatibility.

Supabase migrations are SQL files under `supabase/migrations/`, ordered by their timestamp prefix. Apply a new migration through the Supabase SQL editor or CLI; never edit a migration that may already be deployed.

The user-sync migration enables Row Level Security. Any new cloud table or operation must be scoped to `auth.uid()` and documented in `docs/CLOUD_SYNC_SETUP.md` when it changes setup requirements.

## Packaged-food catalogue

Do not copy a global product catalogue into `user_foods`: it is a private, per-user sync table. The app searches Open Food Facts on demand, then persists only foods a user logs. This keeps guest mode useful, preserves offline access to the user's history, and prevents a shared catalogue from consuming the free database tier.

If a hosted catalogue is needed later, keep it in a separate public, read-only table with a compact normalized schema (barcode, name, brand, package/serving quantities, nutrients, source revision). Import a country/category subset first, measure its data plus index size, and leave headroom below Supabase Free's 500 MB database-size limit. Open Food Facts data is ODbL: attribution and share-alike obligations apply to a derived database.
