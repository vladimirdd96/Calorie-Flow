-- Rolling hourly quota for POST /api/recipes/import. The endpoint follows a URL the user
-- pastes, so the cap bounds that outbound-fetch surface; it is not a feature ration.
create table if not exists public.recipe_import_log (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0)
);

alter table public.recipe_import_log enable row level security;

grant select, insert, update, delete on public.recipe_import_log to authenticated;

drop policy if exists "Users own their import log" on public.recipe_import_log;
create policy "Users own their import log"
  on public.recipe_import_log
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
