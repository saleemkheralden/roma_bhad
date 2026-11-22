-- Battalions (Phase 5): a battalion holds companies, the way a company holds teams.
--
--   * Staff only: battalion staff join with the battalion's code (join_battalion). Cadets and
--     company staff never need to join a battalion.
--   * Top-down: a battalion admin adds a company with the company's staff code
--     (battalion_add_company) and removes it (battalion_remove_company). A company admin can
--     detach the company (company_leave_battalion) if it was added by mistake.
--   * The battalion dashboard returns counts only (teams, roster size, today's roll-call
--     totals, open/overdue team tasks): no names, no reasons. Battalion membership opens no
--     company or team tables.

create table public.battalions (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index battalions_created_by_idx on public.battalions (created_by);

alter table public.companies add column battalion_id bigint references public.battalions (id) on delete set null;
create index companies_battalion_idx on public.companies (battalion_id);

create table public.battalion_members (
  id bigint generated always as identity primary key,
  battalion_id bigint not null references public.battalions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (battalion_id, user_id)
);
create index battalion_members_user_idx on public.battalion_members (user_id);

-- Helpers ----------------------------------------------------------------------

create or replace function private.is_battalion_member(p_battalion_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.battalion_members m
                 where m.battalion_id = p_battalion_id and m.user_id = (select auth.uid()));
$$;

create or replace function private.is_battalion_admin(p_battalion_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.battalion_members m
                 where m.battalion_id = p_battalion_id and m.user_id = (select auth.uid()) and m.is_admin);
$$;

revoke execute on function private.is_battalion_member(bigint), private.is_battalion_admin(bigint) from public, anon;
grant execute on function private.is_battalion_member(bigint), private.is_battalion_admin(bigint) to authenticated;

-- A code unique across teams, companies and battalions (the join page tries all three).
create or replace function private.new_unit_code()
returns text language plpgsql volatile set search_path = '' as $$
declare v_code text;
begin
  loop
    v_code := private.new_invite_code();
    exit when not exists (select 1 from public.teams where invite_code = v_code)
          and not exists (select 1 from public.companies where invite_code = v_code)
          and not exists (select 1 from public.battalions where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke execute on function private.new_unit_code() from public, anon;

-- Members guard: only admins change is_admin; a battalion keeps one admin.
create or replace function private.guard_battalion_members()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    if new.battalion_id <> old.battalion_id or new.user_id <> old.user_id then
      raise exception 'cannot move a battalion member' using errcode = '42501';
    end if;
    if new.is_admin is distinct from old.is_admin and not private.is_battalion_admin(old.battalion_id) then
      raise exception 'only battalion admins can change admins' using errcode = '42501';
    end if;
  end if;
  if old.is_admin and (tg_op = 'DELETE' or not new.is_admin) then
    if not exists (select 1 from public.battalion_members m
                   where m.battalion_id = old.battalion_id and m.is_admin and m.id <> old.id) then
      raise exception 'a battalion needs at least one admin' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger battalion_members_guard before update or delete on public.battalion_members
  for each row execute function private.guard_battalion_members();

-- Companies may only change battalion_id through the RPCs below.
create or replace function private.guard_company_battalion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin') then return new; end if;
  if new.battalion_id is distinct from old.battalion_id then
    raise exception 'battalions add companies with battalion_add_company' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger companies_battalion_guard before update on public.companies
  for each row execute function private.guard_company_battalion();

-- RLS ----------------------------------------------------------------------------

alter table public.battalions enable row level security;
alter table public.battalion_members enable row level security;

create policy "members read battalion" on public.battalions for select to authenticated
  using ((select private.is_battalion_member(id)));
create policy "admins rename battalion" on public.battalions for update to authenticated
  using ((select private.is_battalion_admin(id))) with check ((select private.is_battalion_admin(id)));
create policy "admins delete battalion" on public.battalions for delete to authenticated
  using ((select private.is_battalion_admin(id)));

create policy "members read battalion members" on public.battalion_members for select to authenticated
  using ((select private.is_battalion_member(battalion_id)));
create policy "admins edit battalion members" on public.battalion_members for update to authenticated
  using ((select private.is_battalion_admin(battalion_id))) with check ((select private.is_battalion_admin(battalion_id)));
create policy "admins remove battalion members" on public.battalion_members for delete to authenticated
  using ((select private.is_battalion_admin(battalion_id)) or user_id = (select auth.uid()));

revoke all on public.battalions, public.battalion_members from anon;
grant select, update, delete on public.battalions to authenticated;
grant select, update, delete on public.battalion_members to authenticated;

-- RPC bodies (private, definer) + invoker wrappers (public) ------------------------

create or replace function private.create_battalion(p_name text, p_display_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id bigint;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.battalions (name, invite_code, created_by)
    values (trim(p_name), private.new_unit_code(), v_uid) returning id into v_id;
  insert into public.battalion_members (battalion_id, user_id, display_name, is_admin)
    values (v_id, v_uid, trim(p_display_name), true);
  return v_id;
end;
$$;

create or replace function private.preview_battalion(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.battalions;
begin
  if (select auth.uid()) is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v from public.battalions where invite_code = upper(trim(p_code));
  if v.id is null then return null; end if;
  return jsonb_build_object('battalion_id', v.id, 'battalion_name', v.name,
    'already_member', private.is_battalion_member(v.id));
end;
$$;

create or replace function private.join_battalion(p_code text, p_display_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id bigint;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into v_id from public.battalions where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into public.battalion_members (battalion_id, user_id, display_name)
    values (v_id, v_uid, trim(p_display_name)) on conflict (battalion_id, user_id) do nothing;
  return v_id;
end;
$$;

create or replace function private.battalion_add_company(p_battalion_id bigint, p_company_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_co public.companies;
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins can add companies' using errcode = '42501';
  end if;
  select * into v_co from public.companies where invite_code = upper(trim(p_company_code));
  if v_co.id is null then raise exception 'invalid company code' using errcode = 'P0002'; end if;
  if v_co.battalion_id is not null and v_co.battalion_id <> p_battalion_id then
    raise exception 'the company belongs to another battalion' using errcode = '23505';
  end if;
  update public.companies set battalion_id = p_battalion_id where id = v_co.id;
  return jsonb_build_object('company_id', v_co.id, 'company_name', v_co.name);
end;
$$;

create or replace function private.battalion_remove_company(p_battalion_id bigint, p_company_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins can remove companies' using errcode = '42501';
  end if;
  update public.companies set battalion_id = null where id = p_company_id and battalion_id = p_battalion_id;
end;
$$;

create or replace function private.company_leave_battalion(p_company_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_company_admin(p_company_id) then
    raise exception 'only company admins can detach the company' using errcode = '42501';
  end if;
  update public.companies set battalion_id = null where id = p_company_id;
end;
$$;

create or replace function private.regenerate_battalion_code(p_battalion_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not private.is_battalion_admin(p_battalion_id) then
    raise exception 'only battalion admins can change the code' using errcode = '42501';
  end if;
  v_code := private.new_unit_code();
  update public.battalions set invite_code = v_code where id = p_battalion_id;
  return v_code;
end;
$$;

-- Companies of a battalion, as counts only. Battalion members only.
create or replace function private.battalion_dashboard(p_battalion_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today date := private.today();
begin
  if not private.is_battalion_member(p_battalion_id) then
    raise exception 'not a member of this battalion' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'company_id', c.id,
      'company_name', c.name,
      'teams', (select count(*) from public.teams t where t.company_id = c.id),
      'roster', (select count(*) from public.team_members m join public.teams t on t.id = m.team_id where t.company_id = c.id),
      'reported_teams', coalesce(rc.reported, 0),
      'present', coalesce(rc.present, 0),
      'late', coalesce(rc.late, 0),
      'absent', coalesce(rc.absent, 0),
      'open_tasks', (select count(*) from public.tasks k join public.teams t on t.id = k.team_id
                       where t.company_id = c.id and k.visibility = 'team' and k.status = 'open'),
      'overdue_tasks', (select count(*) from public.tasks k join public.teams t on t.id = k.team_id
                          where t.company_id = c.id and k.visibility = 'team' and k.status = 'open' and k.due_on < v_today)
    ) order by c.name)
    from public.companies c
    -- Each team's latest roll call today, summed per company.
    left join lateral (
      select count(*) as reported,
             sum((select count(*) from public.attendance_entries e where e.session_id = s.id and e.status = 'present')) as present,
             sum((select count(*) from public.attendance_entries e where e.session_id = s.id and e.status = 'late')) as late,
             sum((select count(*) from public.attendance_entries e where e.session_id = s.id and e.status = 'absent')) as absent
      from public.teams t
      join lateral (
        select s.id from public.attendance_sessions s
        where s.team_id = t.id and (s.created_at at time zone 'Asia/Jerusalem')::date = v_today
        order by s.created_at desc limit 1
      ) s on true
      where t.company_id = c.id
    ) rc on true
    where c.battalion_id = p_battalion_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function private.create_battalion(text, text), private.preview_battalion(text),
  private.join_battalion(text, text), private.battalion_add_company(bigint, text),
  private.battalion_remove_company(bigint, bigint), private.company_leave_battalion(bigint),
  private.regenerate_battalion_code(bigint), private.battalion_dashboard(bigint) from public, anon;
grant execute on function private.create_battalion(text, text), private.preview_battalion(text),
  private.join_battalion(text, text), private.battalion_add_company(bigint, text),
  private.battalion_remove_company(bigint, bigint), private.company_leave_battalion(bigint),
  private.regenerate_battalion_code(bigint), private.battalion_dashboard(bigint) to authenticated;

create function public.create_battalion(p_name text, p_display_name text)
returns bigint language sql security invoker set search_path = '' as $$ select private.create_battalion(p_name, p_display_name); $$;
create function public.preview_battalion(p_code text)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.preview_battalion(p_code); $$;
create function public.join_battalion(p_code text, p_display_name text)
returns bigint language sql security invoker set search_path = '' as $$ select private.join_battalion(p_code, p_display_name); $$;
create function public.battalion_add_company(p_battalion_id bigint, p_company_code text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.battalion_add_company(p_battalion_id, p_company_code); $$;
create function public.battalion_remove_company(p_battalion_id bigint, p_company_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.battalion_remove_company(p_battalion_id, p_company_id); $$;
create function public.company_leave_battalion(p_company_id bigint)
returns void language sql security invoker set search_path = '' as $$ select private.company_leave_battalion(p_company_id); $$;
create function public.regenerate_battalion_code(p_battalion_id bigint)
returns text language sql security invoker set search_path = '' as $$ select private.regenerate_battalion_code(p_battalion_id); $$;
create function public.battalion_dashboard(p_battalion_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.battalion_dashboard(p_battalion_id); $$;

revoke execute on function public.create_battalion(text, text), public.preview_battalion(text),
  public.join_battalion(text, text), public.battalion_add_company(bigint, text),
  public.battalion_remove_company(bigint, bigint), public.company_leave_battalion(bigint),
  public.regenerate_battalion_code(bigint), public.battalion_dashboard(bigint) from public, anon;
grant execute on function public.create_battalion(text, text), public.preview_battalion(text),
  public.join_battalion(text, text), public.battalion_add_company(bigint, text),
  public.battalion_remove_company(bigint, bigint), public.company_leave_battalion(bigint),
  public.regenerate_battalion_code(bigint), public.battalion_dashboard(bigint) to authenticated;
