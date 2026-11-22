-- Link units without codes. Codes stay as a fallback for units you don't manage yourself.
--
--   * company_add_my_team: an admin of both the company and the team adds it with one tap
--     (moving it from another company needs admin there too).
--   * create_team_in_company: a company admin opens a new team directly inside the company
--     (they become its admin, like any team creator, and can hand that over later).
--   * battalion_add_my_company / create_company_in_battalion: the same one level up.
--   * battalion_move_team: a battalion admin moves a team between two of its companies.
--   * battalion_structure: the battalion's companies and their team names (unit names only, no
--     people), for battalion admins managing the structure. The dashboard stays counts-only.

create or replace function private.company_add_my_team(p_company_id bigint, p_team_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current bigint;
begin
  if not private.is_company_admin(p_company_id) or not private.is_team_admin(p_team_id) then
    raise exception 'you need to be an admin of both the company and the team' using errcode = '42501';
  end if;
  select company_id into v_current from public.teams where id = p_team_id;
  if v_current is not null and v_current <> p_company_id and not private.is_company_admin(v_current) then
    raise exception 'the team belongs to another company' using errcode = '23505';
  end if;
  update public.teams set company_id = p_company_id where id = p_team_id;
end;
$$;

create or replace function private.create_team_in_company(p_company_id bigint, p_name text, p_first_name text, p_last_name text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_team bigint;
begin
  if not private.is_company_admin(p_company_id) then
    raise exception 'only company admins can open teams in the company' using errcode = '42501';
  end if;
  v_team := public.create_team(p_name, p_first_name, coalesce(p_last_name, ''));
  update public.teams set company_id = p_company_id where id = v_team;
  return v_team;
end;
$$;

create or replace function private.battalion_add_my_company(p_battalion_id bigint, p_company_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current bigint;
begin
  if not private.is_battalion_admin(p_battalion_id) or not private.is_company_admin(p_company_id) then
    raise exception 'you need to be an admin of both the battalion and the company' using errcode = '42501';
  end if;
  select battalion_id into v_current from public.companies where id = p_company_id;
  if v_current is not null and v_current <> p_battalion_id and not private.is_battalion_admin(v_current) then
    raise exception 'the company belongs to another battalion' using errcode = '23505';
  end if;
  update public.companies set battalion_id = p_battalion_id where id = p_company_id;
end;
$$;

create or replace function private.create_company_in_battalion(p_battalion_id bigint, p_name text, p_display_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_company bigint;
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins can open companies in the battalion' using errcode = '42501';
  end if;
  v_company := private.create_company(p_name, p_display_name, null);
  update public.companies set battalion_id = p_battalion_id where id = v_company;
  return v_company;
end;
$$;

create or replace function private.battalion_move_team(p_battalion_id bigint, p_team_id bigint, p_company_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins can move teams' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t join public.companies c on c.id = t.company_id
                 where t.id = p_team_id and c.battalion_id = p_battalion_id)
     or not exists (select 1 from public.companies where id = p_company_id and battalion_id = p_battalion_id) then
    raise exception 'both companies must be in this battalion' using errcode = '23514';
  end if;
  update public.teams set company_id = p_company_id where id = p_team_id;
end;
$$;

create or replace function private.battalion_structure(p_battalion_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins manage the structure' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'company_id', c.id,
      'company_name', c.name,
      'teams', coalesce((select jsonb_agg(jsonb_build_object('team_id', t.id, 'team_name', t.name) order by t.name)
                         from public.teams t where t.company_id = c.id), '[]'::jsonb)
    ) order by c.name)
    from public.companies c where c.battalion_id = p_battalion_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function private.company_add_my_team(bigint, bigint), private.create_team_in_company(bigint, text, text, text),
  private.battalion_add_my_company(bigint, bigint), private.create_company_in_battalion(bigint, text, text),
  private.battalion_move_team(bigint, bigint, bigint), private.battalion_structure(bigint) from public, anon;
grant execute on function private.company_add_my_team(bigint, bigint), private.create_team_in_company(bigint, text, text, text),
  private.battalion_add_my_company(bigint, bigint), private.create_company_in_battalion(bigint, text, text),
  private.battalion_move_team(bigint, bigint, bigint), private.battalion_structure(bigint) to authenticated;

create function public.company_add_my_team(p_company_id bigint, p_team_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.company_add_my_team(p_company_id, p_team_id); $$;
create function public.create_team_in_company(p_company_id bigint, p_name text, p_first_name text, p_last_name text default '')
returns bigint language sql security invoker set search_path = '' as $$ select private.create_team_in_company(p_company_id, p_name, p_first_name, p_last_name); $$;
create function public.battalion_add_my_company(p_battalion_id bigint, p_company_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.battalion_add_my_company(p_battalion_id, p_company_id); $$;
create function public.create_company_in_battalion(p_battalion_id bigint, p_name text, p_display_name text)
returns bigint language sql security invoker set search_path = '' as $$ select private.create_company_in_battalion(p_battalion_id, p_name, p_display_name); $$;
create function public.battalion_move_team(p_battalion_id bigint, p_team_id bigint, p_company_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.battalion_move_team(p_battalion_id, p_team_id, p_company_id); $$;
create function public.battalion_structure(p_battalion_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.battalion_structure(p_battalion_id); $$;

revoke execute on function public.company_add_my_team(bigint, bigint), public.create_team_in_company(bigint, text, text, text),
  public.battalion_add_my_company(bigint, bigint), public.create_company_in_battalion(bigint, text, text),
  public.battalion_move_team(bigint, bigint, bigint), public.battalion_structure(bigint) from public, anon;
grant execute on function public.company_add_my_team(bigint, bigint), public.create_team_in_company(bigint, text, text, text),
  public.battalion_add_my_company(bigint, bigint), public.create_company_in_battalion(bigint, text, text),
  public.battalion_move_team(bigint, bigint, bigint), public.battalion_structure(bigint) to authenticated;
