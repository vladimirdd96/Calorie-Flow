-- Keep the existing per-user RLS policies in force while allowing open devices
-- to receive changes for their own diary through Supabase Realtime.
alter publication supabase_realtime add table public.user_profiles;
alter publication supabase_realtime add table public.user_meals;
alter publication supabase_realtime add table public.user_foods;
