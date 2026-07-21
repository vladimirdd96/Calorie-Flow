create table if not exists public.diary_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(recipient_email) and char_length(recipient_email) between 3 and 320),
  recipient_id uuid references auth.users(id) on delete set null,
  scope text not null default 'diary' check (scope in ('diary')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (owner_id, recipient_email),
  check ((status = 'accepted') = (recipient_id is not null))
);

create index if not exists diary_shares_owner_idx on public.diary_shares (owner_id, status);
create index if not exists diary_shares_recipient_idx on public.diary_shares (recipient_id, status);

alter table public.diary_shares enable row level security;
grant select, insert, update, delete on public.diary_shares to authenticated;

create policy "Owners manage their diary shares"
  on public.diary_shares for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Recipients can see their diary invitations"
  on public.diary_shares for select to authenticated
  using (
    recipient_id = (select auth.uid())
    or recipient_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create or replace function public.accept_diary_share(share_id uuid)
returns public.diary_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_share public.diary_shares;
begin
  update public.diary_shares
  set recipient_id = auth.uid(), status = 'accepted', accepted_at = now(), revoked_at = null
  where id = share_id
    and status = 'pending'
    and recipient_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  returning * into accepted_share;

  if not found then
    raise exception 'This invitation is unavailable.' using errcode = 'P0001';
  end if;

  return accepted_share;
end;
$$;

revoke all on function public.accept_diary_share(uuid) from public;
grant execute on function public.accept_diary_share(uuid) to authenticated;

create policy "Accepted recipients can read shared meals"
  on public.user_meals for select to authenticated
  using (exists (
    select 1 from public.diary_shares
    where diary_shares.owner_id = user_meals.user_id
      and diary_shares.recipient_id = (select auth.uid())
      and diary_shares.status = 'accepted'
      and diary_shares.scope = 'diary'
  ));

create policy "Accepted recipients can read shared foods"
  on public.user_foods for select to authenticated
  using (exists (
    select 1 from public.diary_shares
    where diary_shares.owner_id = user_foods.user_id
      and diary_shares.recipient_id = (select auth.uid())
      and diary_shares.status = 'accepted'
      and diary_shares.scope = 'diary'
  ));
