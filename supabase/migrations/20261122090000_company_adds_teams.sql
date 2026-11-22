-- Companies set up their own teams (top-down). Cadets only ever join their team.
--
--   * company_add_team: a company admin adds a team with that team's invite code (the team's
--     staff hand it over). A team already in another company must be removed there first.
--   * company_remove_team: a company admin removes one of its teams.
--   * link_team_to_company: a team can no longer attach itself to a company. Its admin can
--     still detach it (p_code null), in case it was added by mistake.

create or replace function private.company_add_team(p_company_id bigint, p_team_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_team public.teams;
begin
  if not private.is_company_admin(p_company_id) then
    raise exception 'only company admins can add teams' using errcode = '42501';
  end if;
  select * into v_team from public.teams where invite_code = upper(trim(p_team_code));
  if v_team.id is null then raise exception 'invalid team code' using errcode = 'P0002'; end if;
  if v_team.company_id is not null and v_team.company_id <> p_company_id then
    raise exception 'the team belongs to another company' using errcode = '23505';
  end if;
  update public.teams set company_id = p_company_id where id = v_team.id;
  return jsonb_build_object('team_id', v_team.id, 'team_name', v_team.name);
end;
$$;

create or replace function private.company_remove_team(p_company_id bigint, p_team_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_company_admin(p_company_id) then
    raise exception 'only company admins can remove teams' using errcode = '42501';
  end if;
  update public.teams set company_id = null where id = p_team_id and company_id = p_company_id;
end;
$$;

create or replace function private.link_team_to_company(p_team_id bigint, p_code text)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if p_code is not null then
    raise exception 'companies add teams now (company_add_team)' using errcode = '42501';
  end if;
  if not private.is_team_admin(p_team_id) then
    raise exception 'only the team admin can detach the team' using errcode = '42501';
  end if;
  update public.teams set company_id = null where id = p_team_id;
  return null;
end;
$$;

revoke execute on function private.company_add_team(bigint, text), private.company_remove_team(bigint, bigint) from public, anon;
grant execute on function private.company_add_team(bigint, text), private.company_remove_team(bigint, bigint) to authenticated;

create function public.company_add_team(p_company_id bigint, p_team_code text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.company_add_team(p_company_id, p_team_code); $$;
create function public.company_remove_team(p_company_id bigint, p_team_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.company_remove_team(p_company_id, p_team_id); $$;

revoke execute on function public.company_add_team(bigint, text), public.company_remove_team(bigint, bigint) from public, anon;
grant execute on function public.company_add_team(bigint, text), public.company_remove_team(bigint, bigint) to authenticated;
