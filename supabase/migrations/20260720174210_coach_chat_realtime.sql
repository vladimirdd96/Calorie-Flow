-- Keep signed-in Coach workspaces current when the same account is open elsewhere.
alter publication supabase_realtime add table public.coach_chats;
alter publication supabase_realtime add table public.coach_messages;
