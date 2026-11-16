-- What the signed-in user may do in a team, so the UI can show or hide actions.
-- Display only: every write is still enforced by RLS.
-- SECURITY INVOKER: it only calls the private helpers, which scope themselves to auth.uid().
create or replace function public.my_permissions(p_team_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'is_member', private.is_team_member(p_team_id),
    'is_admin', private.is_team_admin(p_team_id),
    'can_command', private.can_command(p_team_id),
    'can_manage', private.can_manage(p_team_id),
    'today', private.today()
  );
$$;

revoke execute on function public.my_permissions(bigint) from public, anon;
grant execute on function public.my_permissions(bigint) to authenticated;
