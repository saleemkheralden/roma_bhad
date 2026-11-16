-- Keep-alive for Supabase Free (projects pause after 7 days without activity).
-- A scheduled GitHub Action calls this every few days. It touches no data.
create or replace function public.ping()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
