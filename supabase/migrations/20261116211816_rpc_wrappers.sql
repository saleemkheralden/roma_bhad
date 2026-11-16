-- Move the SECURITY DEFINER bodies of the team RPCs into the unexposed `private`
-- schema, and expose thin SECURITY INVOKER wrappers in `public` instead
-- (Supabase guidance: privileged functions live outside the API schema).
-- Behaviour is unchanged: each private body still checks auth.uid().

alter function public.create_team(text, text, text) set schema private;
alter function public.preview_team(text) set schema private;
alter function public.join_team(text, bigint, text, text) set schema private;
alter function public.regenerate_invite_code(bigint) set schema private;

-- The bodies stay callable by signed-in users only (via the wrappers below).
revoke execute on function private.create_team(text, text, text) from public, anon;
revoke execute on function private.preview_team(text) from public, anon;
revoke execute on function private.join_team(text, bigint, text, text) from public, anon;
revoke execute on function private.regenerate_invite_code(bigint) from public, anon;
grant execute on function private.create_team(text, text, text) to authenticated;
grant execute on function private.preview_team(text) to authenticated;
grant execute on function private.join_team(text, bigint, text, text) to authenticated;
grant execute on function private.regenerate_invite_code(bigint) to authenticated;

create function public.create_team(p_name text, p_first_name text, p_last_name text default '')
returns bigint
language sql
security invoker
set search_path = ''
as $$ select private.create_team(p_name, p_first_name, p_last_name); $$;

create function public.preview_team(p_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.preview_team(p_code); $$;

create function public.join_team(
  p_code text,
  p_member_id bigint default null,
  p_first_name text default null,
  p_last_name text default ''
)
returns bigint
language sql
security invoker
set search_path = ''
as $$ select private.join_team(p_code, p_member_id, p_first_name, p_last_name); $$;

create function public.regenerate_invite_code(p_team_id bigint)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.regenerate_invite_code(p_team_id); $$;

revoke execute on function public.create_team(text, text, text) from public, anon;
revoke execute on function public.preview_team(text) from public, anon;
revoke execute on function public.join_team(text, bigint, text, text) from public, anon;
revoke execute on function public.regenerate_invite_code(bigint) from public, anon;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.preview_team(text) to authenticated;
grant execute on function public.join_team(text, bigint, text, text) to authenticated;
grant execute on function public.regenerate_invite_code(bigint) to authenticated;
