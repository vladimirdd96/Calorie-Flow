-- Public, read-only recipe catalogue: shared user recipes + AI-assisted picks.
-- Kept separate from user_profiles per docs/database.md's packaged-catalogue guidance.

create table if not exists public.public_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 240),
  servings numeric not null check (servings > 0 and servings <= 100),
  serving_grams numeric not null check (serving_grams > 0 and serving_grams <= 20000),
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array'),
  nutrition_per_serving jsonb not null check (jsonb_typeof(nutrition_per_serving) = 'object'),
  image_url text,
  image_credit jsonb,
  source text not null check (source in ('community', 'ai')),
  author_id uuid references auth.users(id) on delete set null,
  -- Normalized name used to dedupe near-identical recipes across both sources.
  search_key text not null generated always as (lower(trim(regexp_replace(name, '[^a-zA-Z0-9]+', ' ', 'g')))) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists public_recipes_search_key_unique on public.public_recipes (search_key);
create index if not exists public_recipes_created_idx on public.public_recipes (created_at desc);

alter table public.public_recipes enable row level security;
grant select, insert, delete on public.public_recipes to authenticated;

create policy "Anyone signed in can read the catalogue"
  on public.public_recipes for select to authenticated
  using (true);

create policy "Users publish their own recipes or contribute AI picks"
  on public.public_recipes for insert to authenticated
  with check (
    (source = 'community' and author_id = (select auth.uid()))
    or (source = 'ai' and author_id is null)
  );

create policy "Users remove their own shared recipes"
  on public.public_recipes for delete to authenticated
  using (source = 'community' and author_id = (select auth.uid()));

-- Tracks each user's last "Refresh my picks" run so /api/recipes/generate can enforce a 7-day cooldown.
create table if not exists public.recipe_generation_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now()
);

alter table public.recipe_generation_log enable row level security;
grant select, insert, update on public.recipe_generation_log to authenticated;

create policy "Users manage their own generation cooldown"
  on public.recipe_generation_log for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
