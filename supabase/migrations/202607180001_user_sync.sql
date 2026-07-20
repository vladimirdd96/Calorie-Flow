create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_meals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists user_meals_user_created_idx
  on public.user_meals (user_id, created_at desc);

create table if not exists public.user_foods (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists user_foods_user_updated_idx
  on public.user_foods (user_id, updated_at desc);

create table if not exists public.coach_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at desc);

alter table public.user_profiles enable row level security;
alter table public.user_meals enable row level security;
alter table public.user_foods enable row level security;
alter table public.coach_messages enable row level security;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_meals to authenticated;
grant select, insert, update, delete on public.user_foods to authenticated;
grant select, insert, update, delete on public.coach_messages to authenticated;

create policy "Users own their profile"
  on public.user_profiles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users own their meals"
  on public.user_meals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users own their foods"
  on public.user_foods for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users own their coach history"
  on public.coach_messages for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
