-- Shared packaged-food catalogue keyed by barcode.
--
-- Open Food Facts is thin on Central/Eastern European supermarket private labels
-- (Lidl Pilos, Kaufland K-Classic, CBA, Carrefour Classic), so a barcode scan for
-- those products returns nothing and every user re-solves the same package by hand.
-- This table is the shared answer: whatever one account resolves — from a seeded
-- Open Food Facts subset, from the AI label reader, or typed by hand — becomes
-- findable by every other account on the next scan.
--
-- It follows the separate public read-only table pattern docs/database.md prescribes
-- for a hosted catalogue, deliberately kept out of the private per-user `user_foods`
-- sync table. Open Food Facts rows are ODbL: `source` and `source_ref` retain the
-- attribution the licence requires.

create extension if not exists pg_trgm;

create table if not exists public.product_catalogue (
  -- EAN-8/UPC-A/EAN-13/ITF-14 digits only. The scanner normalizes before writing.
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  name text not null check (char_length(name) between 1 and 240),
  brand text check (char_length(brand) <= 120),
  quantity_label text check (char_length(quantity_label) <= 60),
  serving_label text check (char_length(serving_label) <= 60),
  serving_grams numeric check (serving_grams > 0 and serving_grams <= 20000),
  package_grams numeric check (package_grams > 0 and package_grams <= 100000),
  -- Remote thumbnail only. Data URLs would blow up the row size and the free tier.
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 600)),
  nutrients_per_100 jsonb not null check (jsonb_typeof(nutrients_per_100) = 'object'),
  -- Local-language search terms, including Cyrillic spellings, never displayed.
  keywords jsonb not null default '[]'::jsonb check (jsonb_typeof(keywords) = 'array'),
  -- Mirrors FoodSource minus 'seed', which is reserved for foods bundled in the app.
  source text not null check (source in ('open-food-facts', 'food-data-central', 'restaurant', 'branded', 'ai-label', 'custom')),
  -- Upstream identifier retained for ODbL attribution and later re-sync.
  source_ref text check (char_length(source_ref) <= 120),
  countries jsonb not null default '[]'::jsonb check (jsonb_typeof(countries) = 'array'),
  -- True only for rows carrying published composition data, never for AI-read labels.
  verified boolean not null default false,
  contributed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Name search runs over brand + name so "pilos yogurt" and "кисело мляко" both hit.
create index if not exists product_catalogue_search_idx
  on public.product_catalogue using gin ((coalesce(brand, '') || ' ' || name) gin_trgm_ops);
create index if not exists product_catalogue_brand_idx on public.product_catalogue (lower(brand));

alter table public.product_catalogue enable row level security;
grant select, insert, update on public.product_catalogue to authenticated;

create policy "Anyone signed in can read the product catalogue"
  on public.product_catalogue for select to authenticated
  using (true);

create policy "Users contribute products they resolved"
  on public.product_catalogue for insert to authenticated
  with check (contributed_by = (select auth.uid()));

-- Corrections are limited to a contributor's own rows: the barcode primary key already
-- makes the first correct answer win, and letting any account rewrite any row would turn
-- a shared catalogue into a vandalism surface. Bulk imports run with the service-role key
-- and bypass RLS, so seeded rows stay owner-less and immutable from the app.
create policy "Users correct their own contributions"
  on public.product_catalogue for update to authenticated
  using (contributed_by = (select auth.uid()))
  with check (contributed_by = (select auth.uid()));

create or replace function public.touch_product_catalogue_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger product_catalogue_updated_at
  before update on public.product_catalogue
  for each row execute function public.touch_product_catalogue_updated_at();
