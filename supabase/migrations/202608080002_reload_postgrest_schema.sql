-- The previous migration added a column and a function; pushing DDL through the CLI's
-- direct Postgres connection does not always trigger PostgREST's schema cache reload the
-- way applying it through the Studio SQL editor does, so the new column can 42703 against
-- the REST API for a while after the migration is recorded as applied. This notification
-- is what the dashboard sends automatically; it is a no-op otherwise and safe to keep.
notify pgrst, 'reload schema';
