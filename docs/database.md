<!-- read_when: database, DB, IndexedDB, Supabase, migration, schema, table, SQL, row level security, RLS -->

# Data storage

`src/lib/db.ts` owns the local IndexedDB store used by guest mode. `src/lib/cloud.ts` coordinates optional cloud synchronization. Shared domain types live in `src/lib/types.ts`.

Supabase migrations are SQL files under `supabase/migrations/`, ordered by their timestamp prefix. Apply a new migration through the Supabase SQL editor or CLI; never edit a migration that may already be deployed.

The user-sync migration enables Row Level Security. Any new cloud table or operation must be scoped to `auth.uid()` and documented in `docs/CLOUD_SYNC_SETUP.md` when it changes setup requirements.
