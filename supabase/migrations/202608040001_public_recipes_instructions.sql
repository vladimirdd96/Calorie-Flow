alter table public.public_recipes
  add column instructions jsonb not null default '[]'::jsonb,
  add column cuisine text,
  add column dietary_tags jsonb not null default '[]'::jsonb;

create policy "Authenticated users can complete AI catalogue recipes"
  on public.public_recipes for update to authenticated
  using (source = 'ai')
  with check (source = 'ai');
