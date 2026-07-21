-- Supabase grants newly created functions to API roles by default. Acceptance
-- must be callable only with an authenticated session; the function itself
-- also verifies the caller's uid and email before updating an invitation.
revoke execute on function public.accept_diary_share(uuid) from anon;
grant execute on function public.accept_diary_share(uuid) to authenticated;
