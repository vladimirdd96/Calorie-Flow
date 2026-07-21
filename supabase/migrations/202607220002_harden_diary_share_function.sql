-- The acceptance RPC already schema-qualifies data access and authorizes against
-- auth.uid() plus the JWT email. An empty path prevents object shadowing in its
-- SECURITY DEFINER execution context.
alter function public.accept_diary_share(uuid) set search_path = '';
