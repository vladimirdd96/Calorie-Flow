create table if not exists public.coach_chats (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

insert into public.coach_chats (user_id, id, title, created_at, updated_at)
select user_id, gen_random_uuid(), 'Past Coach conversation', min(created_at), max(created_at)
from public.coach_messages
group by user_id;

alter table public.coach_messages add column if not exists chat_id uuid;
update public.coach_messages messages
set chat_id = chats.id
from public.coach_chats chats
where chats.user_id = messages.user_id and messages.chat_id is null;

alter table public.coach_messages alter column chat_id set not null;
alter table public.coach_messages drop constraint if exists coach_messages_pkey;
alter table public.coach_messages drop constraint if exists coach_messages_user_id_id_key;
alter table public.coach_messages add constraint coach_messages_user_chat_id_fk
  foreign key (user_id, chat_id) references public.coach_chats(user_id, id) on delete cascade;
alter table public.coach_messages add constraint coach_messages_user_chat_message_key primary key (user_id, chat_id, id);

create index if not exists coach_chats_user_updated_idx on public.coach_chats (user_id, updated_at desc);
create index if not exists coach_messages_user_chat_created_idx on public.coach_messages (user_id, chat_id, created_at asc);

alter table public.coach_chats enable row level security;
grant select, insert, update, delete on public.coach_chats to authenticated;
create policy "Users own their coach chats"
  on public.coach_chats for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
