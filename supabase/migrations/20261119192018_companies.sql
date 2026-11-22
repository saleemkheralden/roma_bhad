-- Phase 5: company level (פלוגה). A company groups teams; company members (staff,
-- א׳ פלוגה and other company role-holders) see a read-only dashboard of its teams.
--
-- Access:
--   * Company members read the company, its members, roles and assignments.
--   * Company admins (creator + promoted) manage members, roles and assignments; so do
--     today's company role-holders (command roles), like at team level.
--   * Joining a company: with its invite code (join_company).
--   * Linking a team: only that team's admin, with the company's code (link_team_to_company).
--   * The dashboard aggregates teams through a definer function gated on membership; it
--     returns names, roll-call statuses/reasons, task counts and today's roles. Nothing else.

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index companies_created_by_idx on public.companies (created_by);

alter table public.teams add column company_id bigint references public.companies (id) on delete set null;
create index teams_company_idx on public.teams (company_id);

create table public.company_members (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, user_id),
  unique (id, company_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.company_roles (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  is_command boolean not null default true,
  sort_order integer not null default 0,
  unique (company_id, name),
  unique (id, company_id)
);

create table public.company_role_assignments (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  role_id bigint not null,
  member_id bigint not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  foreign key (role_id, company_id) references public.company_roles (id, company_id) on delete cascade,
  foreign key (member_id, company_id) references public.company_members (id, company_id) on delete cascade
);
create index company_assignments_dates_idx on public.company_role_assignments (company_id, start_date, end_date);
create index company_assignments_role_idx on public.company_role_assignments (role_id, company_id);
create index company_assignments_member_idx on public.company_role_assignments (member_id, company_id);

-- Helpers ----------------------------------------------------------------------

create or replace function private.is_company_member(p_company_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = p_company_id and m.user_id = (select auth.uid()));
$$;

create or replace function private.is_company_admin(p_company_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.is_admin);
$$;

create or replace function private.can_manage_company(p_company_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_company_admin(p_company_id) or exists (
    select 1 from public.company_role_assignments a
    join public.company_roles r on r.id = a.role_id
    join public.company_members m on m.id = a.member_id
    where a.company_id = p_company_id and m.user_id = (select auth.uid()) and r.is_command
      and private.today() between a.start_date and a.end_date
  );
$$;

revoke execute on function private.is_company_member(bigint), private.is_company_admin(bigint),
  private.can_manage_company(bigint) from public, anon;
grant execute on function private.is_company_member(bigint), private.is_company_admin(bigint),
  private.can_manage_company(bigint) to authenticated;

-- Members guard: only admins change is_admin; a company keeps one admin.
create or replace function private.guard_company_members()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    if new.company_id <> old.company_id or new.user_id <> old.user_id then
      raise exception 'cannot move a company member' using errcode = '42501';
    end if;
    if new.is_admin is distinct from old.is_admin and not private.is_company_admin(old.company_id) then
      raise exception 'only company admins can change admins' using errcode = '42501';
    end if;
  end if;
  if old.is_admin and (tg_op = 'DELETE' or not new.is_admin) then
    if not exists (select 1 from public.company_members m
                   where m.company_id = old.company_id and m.is_admin and m.id <> old.id) then
      raise exception 'a company needs at least one admin' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger company_members_guard before update or delete on public.company_members
  for each row execute function private.guard_company_members();

-- RLS ----------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_roles enable row level security;
alter table public.company_role_assignments enable row level security;

create policy "members read company" on public.companies for select to authenticated
  using ((select private.is_company_member(id)));
create policy "admins rename company" on public.companies for update to authenticated
  using ((select private.is_company_admin(id))) with check ((select private.is_company_admin(id)));
create policy "admins delete company" on public.companies for delete to authenticated
  using ((select private.is_company_admin(id)));

create policy "members read company members" on public.company_members for select to authenticated
  using ((select private.is_company_member(company_id)));
create policy "managers edit company members" on public.company_members for update to authenticated
  using ((select private.can_manage_company(company_id))) with check ((select private.can_manage_company(company_id)));
create policy "managers remove company members" on public.company_members for delete to authenticated
  using ((select private.can_manage_company(company_id)) or user_id = (select auth.uid()));

create policy "members read company roles" on public.company_roles for select to authenticated
  using ((select private.is_company_member(company_id)));
create policy "managers add company roles" on public.company_roles for insert to authenticated
  with check ((select private.can_manage_company(company_id)));
create policy "managers edit company roles" on public.company_roles for update to authenticated
  using ((select private.can_manage_company(company_id))) with check ((select private.can_manage_company(company_id)));
create policy "managers remove company roles" on public.company_roles for delete to authenticated
  using ((select private.can_manage_company(company_id)));

create policy "members read company assignments" on public.company_role_assignments for select to authenticated
  using ((select private.is_company_member(company_id)));
create policy "managers add company assignments" on public.company_role_assignments for insert to authenticated
  with check ((select private.can_manage_company(company_id)));
create policy "managers edit company assignments" on public.company_role_assignments for update to authenticated
  using ((select private.can_manage_company(company_id))) with check ((select private.can_manage_company(company_id)));
create policy "managers remove company assignments" on public.company_role_assignments for delete to authenticated
  using ((select private.can_manage_company(company_id)));

revoke all on public.companies, public.company_members, public.company_roles,
  public.company_role_assignments from anon;
grant select, update, delete on public.companies to authenticated;
grant select, update, delete on public.company_members to authenticated;
grant select, insert, update, delete on public.company_roles, public.company_role_assignments to authenticated;

-- Teams may only change company_id through the RPCs below (column-level guard).
create or replace function private.guard_team_company()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'link a team to a company with link_team_to_company' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger teams_company_guard before update on public.teams
  for each row execute function private.guard_team_company();

-- RPC bodies (private, definer) + invoker wrappers (public) ------------------------

create or replace function private.create_company(p_name text, p_display_name text, p_team_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id bigint; v_code text;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_team_id is not null and not private.is_team_admin(p_team_id) then
    raise exception 'only the team admin can link the team' using errcode = '42501';
  end if;
  loop
    v_code := private.new_invite_code();
    exit when not exists (select 1 from public.companies where invite_code = v_code)
          and not exists (select 1 from public.teams where invite_code = v_code);
  end loop;
  insert into public.companies (name, invite_code, created_by) values (trim(p_name), v_code, v_uid) returning id into v_id;
  insert into public.company_members (company_id, user_id, display_name, is_admin)
    values (v_id, v_uid, trim(p_display_name), true);
  insert into public.company_roles (company_id, name, is_command, sort_order)
    values (v_id, 'א׳ פלוגה', true, 1), (v_id, 'סמל פלוגה', true, 2);
  if p_team_id is not null then update public.teams set company_id = v_id where id = p_team_id; end if;
  return v_id;
end;
$$;

create or replace function private.preview_company(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.companies;
begin
  if (select auth.uid()) is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v from public.companies where invite_code = upper(trim(p_code));
  if v.id is null then return null; end if;
  return jsonb_build_object('company_id', v.id, 'company_name', v.name,
    'already_member', private.is_company_member(v.id));
end;
$$;

create or replace function private.join_company(p_code text, p_display_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id bigint;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into v_id from public.companies where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into public.company_members (company_id, user_id, display_name)
    values (v_id, v_uid, trim(p_display_name)) on conflict (company_id, user_id) do nothing;
  return v_id;
end;
$$;

create or replace function private.link_team_to_company(p_team_id bigint, p_code text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not private.is_team_admin(p_team_id) then
    raise exception 'only the team admin can link the team' using errcode = '42501';
  end if;
  if p_code is null then
    update public.teams set company_id = null where id = p_team_id;
    return null;
  end if;
  select id into v_id from public.companies where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  update public.teams set company_id = v_id where id = p_team_id;
  return v_id;
end;
$$;

create or replace function private.regenerate_company_code(p_company_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not private.is_company_admin(p_company_id) then
    raise exception 'only company admins can change the code' using errcode = '42501';
  end if;
  loop
    v_code := private.new_invite_code();
    exit when not exists (select 1 from public.companies where invite_code = v_code)
          and not exists (select 1 from public.teams where invite_code = v_code);
  end loop;
  update public.companies set invite_code = v_code where id = p_company_id;
  return v_code;
end;
$$;

-- Teams of a company, as a summary for its dashboard. Members only.
create or replace function private.company_dashboard(p_company_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today date := private.today();
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'not a member of this company' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', t.id,
      'team_name', t.name,
      'roster', (select count(*) from public.team_members m where m.team_id = t.id),
      'roles_today', coalesce((
        select jsonb_agg(jsonb_build_object('role', r.name, 'name', trim(m.first_name || ' ' || m.last_name)) order by r.sort_order)
        from public.role_assignments a
        join public.team_roles r on r.id = a.role_id
        join public.team_members m on m.id = a.member_id
        where a.team_id = t.id and v_today between a.start_date and a.end_date), '[]'::jsonb),
      'roll_call', (
        select jsonb_build_object(
          'label', s.label,
          'at', s.created_at,
          'present', (select count(*) from public.attendance_entries e where e.session_id = s.id and e.status = 'present'),
          'exceptions', coalesce((
            select jsonb_agg(jsonb_build_object('name', trim(m.first_name || ' ' || m.last_name), 'status', e.status, 'reason', e.reason))
            from public.attendance_entries e join public.team_members m on m.id = e.member_id
            where e.session_id = s.id and e.status <> 'present'), '[]'::jsonb))
        from public.attendance_sessions s
        where s.team_id = t.id and (s.created_at at time zone 'Asia/Jerusalem')::date = v_today
        order by s.created_at desc limit 1),
      'open_tasks', (select count(*) from public.tasks k where k.team_id = t.id and k.visibility = 'team' and k.status = 'open'),
      'overdue_tasks', (select count(*) from public.tasks k where k.team_id = t.id and k.visibility = 'team'
                          and k.status = 'open' and k.due_on < v_today)
    ) order by t.name)
    from public.teams t where t.company_id = p_company_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function private.create_company(text, text, bigint), private.preview_company(text),
  private.join_company(text, text), private.link_team_to_company(bigint, text),
  private.regenerate_company_code(bigint), private.company_dashboard(bigint) from public, anon;
grant execute on function private.create_company(text, text, bigint), private.preview_company(text),
  private.join_company(text, text), private.link_team_to_company(bigint, text),
  private.regenerate_company_code(bigint), private.company_dashboard(bigint) to authenticated;

create function public.create_company(p_name text, p_display_name text, p_team_id bigint default null)
returns bigint language sql security invoker set search_path = '' as $$ select private.create_company(p_name, p_display_name, p_team_id); $$;
create function public.preview_company(p_code text)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.preview_company(p_code); $$;
create function public.join_company(p_code text, p_display_name text)
returns bigint language sql security invoker set search_path = '' as $$ select private.join_company(p_code, p_display_name); $$;
create function public.link_team_to_company(p_team_id bigint, p_code text)
returns bigint language sql security invoker set search_path = '' as $$ select private.link_team_to_company(p_team_id, p_code); $$;
create function public.regenerate_company_code(p_company_id bigint)
returns text language sql security invoker set search_path = '' as $$ select private.regenerate_company_code(p_company_id); $$;
create function public.company_dashboard(p_company_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.company_dashboard(p_company_id); $$;

revoke execute on function public.create_company(text, text, bigint), public.preview_company(text),
  public.join_company(text, text), public.link_team_to_company(bigint, text),
  public.regenerate_company_code(bigint), public.company_dashboard(bigint) from public, anon;
grant execute on function public.create_company(text, text, bigint), public.preview_company(text),
  public.join_company(text, text), public.link_team_to_company(bigint, text),
  public.regenerate_company_code(bigint), public.company_dashboard(bigint) to authenticated;
