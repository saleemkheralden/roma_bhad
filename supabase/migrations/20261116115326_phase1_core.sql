-- Phase 1 core: teams, roster, configurable roles, role assignments, roll call, links.
--
-- Security model (see CLAUDE.md):
--   * Every table has RLS. Nothing is granted to `anon`.
--   * A user sees a team only if they hold a claimed roster row (team_members.user_id = auth.uid()).
--   * "Command" (roll call) = course staff, or holding a command role today (Asia/Jerusalem date).
--   * "Manage" (roster, roles, assignments, links) = team admin, or command.
--   * Only admins can change is_admin / is_staff / user_id on roster rows (trigger-enforced).
--   * Info-security: no columns for locations, ID numbers, equipment or anything operational.

create schema if not exists private;
grant usage on schema private to authenticated;

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

create table public.teams (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index teams_created_by_idx on public.teams (created_by);

-- Roster. A row can exist before the person has an account (user_id null);
-- they claim it when they join with the invite code.
create table public.team_members (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  first_name text not null check (char_length(trim(first_name)) between 1 and 40),
  last_name text not null default '' check (char_length(last_name) <= 40),
  nickname text check (char_length(nickname) <= 40),
  is_admin boolean not null default false,
  is_staff boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, user_id),
  unique (id, team_id)
);
create index team_members_team_id_idx on public.team_members (team_id, sort_order, first_name);
create index team_members_user_id_idx on public.team_members (user_id);

-- Configurable role list per team (א׳ צוות, סמל, קל״ג, קמב״צ ...).
create table public.team_roles (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  is_command boolean not null default true,
  sort_order integer not null default 0,
  unique (team_id, name),
  unique (id, team_id)
);

create table public.role_assignments (
  id bigint generated always as identity primary key,
  team_id bigint not null,
  role_id bigint not null,
  member_id bigint not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  foreign key (role_id, team_id) references public.team_roles (id, team_id) on delete cascade,
  foreign key (member_id, team_id) references public.team_members (id, team_id) on delete cascade,
  foreign key (team_id) references public.teams (id) on delete cascade
);
create index role_assignments_team_dates_idx on public.role_assignments (team_id, start_date, end_date);
create index role_assignments_member_idx on public.role_assignments (member_id, team_id);
create index role_assignments_role_idx on public.role_assignments (role_id, team_id);

create table public.attendance_sessions (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 60),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create index attendance_sessions_team_idx on public.attendance_sessions (team_id, created_at desc);
create index attendance_sessions_created_by_idx on public.attendance_sessions (created_by);

create table public.attendance_entries (
  session_id bigint not null,
  team_id bigint not null,
  member_id bigint not null,
  status text not null check (status in ('present', 'absent', 'late')),
  reason text check (char_length(reason) <= 120),
  primary key (session_id, member_id),
  foreign key (session_id, team_id) references public.attendance_sessions (id, team_id) on delete cascade,
  foreign key (member_id, team_id) references public.team_members (id, team_id) on delete cascade
);
create index attendance_entries_team_idx on public.attendance_entries (team_id);
create index attendance_entries_member_idx on public.attendance_entries (member_id, team_id);
create index attendance_entries_session_team_idx on public.attendance_entries (session_id, team_id);

create table public.links (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  category text not null default '' check (char_length(category) <= 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index links_team_idx on public.links (team_id, sort_order);

-------------------------------------------------------------------------------
-- Permission helpers (private schema: not exposed through the Data API).
-- SECURITY DEFINER so they can read team_members without recursing into its RLS;
-- every one of them is scoped to the calling user via auth.uid().
-------------------------------------------------------------------------------

create or replace function private.today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jerusalem')::date;
$$;

create or replace function private.is_team_member(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_team_admin(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = (select auth.uid()) and m.is_admin
  );
$$;

-- Staff, or holds a command role whose date range includes today.
create or replace function private.can_command(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = (select auth.uid()) and m.is_staff
  )
  or exists (
    select 1
    from public.role_assignments ra
    join public.team_roles r on r.id = ra.role_id
    join public.team_members m on m.id = ra.member_id
    where ra.team_id = p_team_id
      and m.user_id = (select auth.uid())
      and r.is_command
      and private.today() between ra.start_date and ra.end_date
  );
$$;

create or replace function private.can_manage(p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_team_admin(p_team_id) or private.can_command(p_team_id);
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-------------------------------------------------------------------------------
-- Roster guard: only admins may change is_admin / is_staff / user_id,
-- and a team must keep at least one admin.
-- Privileged RPCs below run as the function owner and are allowed through.
-- SECURITY INVOKER on purpose: current_user must be the caller (authenticated)
-- for normal API writes, and the RPC owner (postgres) inside create_team/join_team.
-------------------------------------------------------------------------------

create or replace function private.guard_team_members()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if (new.is_admin or new.is_staff or new.user_id is not null)
       and not private.is_team_admin(new.team_id) then
      raise exception 'only team admins can add admins, staff or linked accounts'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.team_id <> old.team_id then
      raise exception 'cannot move a member to another team' using errcode = '42501';
    end if;
    if (new.is_admin is distinct from old.is_admin
        or new.is_staff is distinct from old.is_staff
        or new.user_id is distinct from old.user_id)
       and not private.is_team_admin(old.team_id) then
      raise exception 'only team admins can change admin, staff or account links'
        using errcode = '42501';
    end if;
  end if;

  -- Keep at least one admin (on demotion or deletion of an admin).
  if old.is_admin and (tg_op = 'DELETE' or not new.is_admin) then
    if not exists (
      select 1 from public.team_members m
      where m.team_id = old.team_id and m.is_admin and m.id <> old.id
    ) then
      raise exception 'a team needs at least one admin' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger team_members_guard
  before insert or update or delete on public.team_members
  for each row execute function private.guard_team_members();

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_roles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.links enable row level security;

-- teams: created only through create_team(); members read; admins rename/delete.
create policy "members read their team" on public.teams
  for select to authenticated
  using ((select private.is_team_member(id)));
create policy "admins update team" on public.teams
  for update to authenticated
  using ((select private.is_team_admin(id)))
  with check ((select private.is_team_admin(id)));
create policy "admins delete team" on public.teams
  for delete to authenticated
  using ((select private.is_team_admin(id)));

-- team_members
create policy "members read roster" on public.team_members
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "managers add to roster" on public.team_members
  for insert to authenticated
  with check ((select private.can_manage(team_id)));
create policy "managers edit roster" on public.team_members
  for update to authenticated
  using ((select private.can_manage(team_id)))
  with check ((select private.can_manage(team_id)));
create policy "managers remove from roster" on public.team_members
  for delete to authenticated
  using ((select private.can_manage(team_id)));

-- team_roles
create policy "members read roles" on public.team_roles
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "managers add roles" on public.team_roles
  for insert to authenticated
  with check ((select private.can_manage(team_id)));
create policy "managers edit roles" on public.team_roles
  for update to authenticated
  using ((select private.can_manage(team_id)))
  with check ((select private.can_manage(team_id)));
create policy "managers remove roles" on public.team_roles
  for delete to authenticated
  using ((select private.can_manage(team_id)));

-- role_assignments
create policy "members read assignments" on public.role_assignments
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "managers add assignments" on public.role_assignments
  for insert to authenticated
  with check ((select private.can_manage(team_id)));
create policy "managers edit assignments" on public.role_assignments
  for update to authenticated
  using ((select private.can_manage(team_id)))
  with check ((select private.can_manage(team_id)));
create policy "managers remove assignments" on public.role_assignments
  for delete to authenticated
  using ((select private.can_manage(team_id)));

-- attendance_sessions: everyone in the team can read; command takes roll call.
create policy "members read roll calls" on public.attendance_sessions
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "command starts roll call" on public.attendance_sessions
  for insert to authenticated
  with check ((select private.can_command(team_id)) and created_by = (select auth.uid()));
create policy "command edits roll call" on public.attendance_sessions
  for update to authenticated
  using ((select private.can_command(team_id)))
  with check ((select private.can_command(team_id)));
create policy "command deletes roll call" on public.attendance_sessions
  for delete to authenticated
  using ((select private.can_command(team_id)));

-- attendance_entries
create policy "members read entries" on public.attendance_entries
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "command adds entries" on public.attendance_entries
  for insert to authenticated
  with check ((select private.can_command(team_id)));
create policy "command edits entries" on public.attendance_entries
  for update to authenticated
  using ((select private.can_command(team_id)))
  with check ((select private.can_command(team_id)));
create policy "command removes entries" on public.attendance_entries
  for delete to authenticated
  using ((select private.can_command(team_id)));

-- links
create policy "members read links" on public.links
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "managers add links" on public.links
  for insert to authenticated
  with check ((select private.can_manage(team_id)));
create policy "managers edit links" on public.links
  for update to authenticated
  using ((select private.can_manage(team_id)))
  with check ((select private.can_manage(team_id)));
create policy "managers remove links" on public.links
  for delete to authenticated
  using ((select private.can_manage(team_id)));

-------------------------------------------------------------------------------
-- Data API grants (new tables are not exposed automatically). Never to anon.
-------------------------------------------------------------------------------

revoke all on public.teams, public.team_members, public.team_roles, public.role_assignments,
  public.attendance_sessions, public.attendance_entries, public.links from anon;

grant select, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members, public.team_roles,
  public.role_assignments, public.attendance_sessions, public.attendance_entries,
  public.links to authenticated;

-------------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER because the caller is not yet a member).
-- Each checks auth.uid() and is executable by `authenticated` only.
-------------------------------------------------------------------------------

create or replace function private.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 8 chars from an unambiguous alphabet (no 0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
$$;

create or replace function public.create_team(p_name text, p_first_name text, p_last_name text default '')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id bigint;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  loop
    v_code := private.new_invite_code();
    exit when not exists (select 1 from public.teams where invite_code = v_code);
  end loop;

  insert into public.teams (name, invite_code, created_by)
  values (trim(p_name), v_code, v_uid)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, first_name, last_name, is_admin)
  values (v_team_id, v_uid, trim(p_first_name), trim(coalesce(p_last_name, '')), true);

  insert into public.team_roles (team_id, name, is_command, sort_order)
  values
    (v_team_id, 'א׳ צוות', true, 1),
    (v_team_id, 'סמל', true, 2),
    (v_team_id, 'קל״ג', true, 3),
    (v_team_id, 'קמב״צ', true, 4);

  return v_team_id;
end;
$$;

-- What someone with the invite code sees before joining: the team name and
-- the roster names that haven't been claimed yet (so they can pick themselves).
create or replace function public.preview_team(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into v_team from public.teams where invite_code = upper(trim(p_code));
  if v_team.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'already_member', exists (
      select 1 from public.team_members
      where team_id = v_team.id and user_id = (select auth.uid())
    ),
    'unclaimed', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'last_name', m.last_name)
                       order by m.first_name, m.last_name)
      from public.team_members m
      where m.team_id = v_team.id and m.user_id is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Join a team: claim an existing unclaimed roster row, or add yourself.
create or replace function public.join_team(
  p_code text,
  p_member_id bigint default null,
  p_first_name text default null,
  p_last_name text default ''
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id bigint;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select id into v_team_id from public.teams where invite_code = upper(trim(p_code));
  if v_team_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.team_members where team_id = v_team_id and user_id = v_uid) then
    return v_team_id;
  end if;

  if p_member_id is not null then
    update public.team_members
       set user_id = v_uid
     where id = p_member_id and team_id = v_team_id and user_id is null;
    if not found then
      raise exception 'that name was already claimed' using errcode = 'P0001';
    end if;
  else
    if p_first_name is null or char_length(trim(p_first_name)) = 0 then
      raise exception 'first name is required' using errcode = '22023';
    end if;
    insert into public.team_members (team_id, user_id, first_name, last_name)
    values (v_team_id, v_uid, trim(p_first_name), trim(coalesce(p_last_name, '')));
  end if;

  return v_team_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_team_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_team_admin(p_team_id) then
    raise exception 'only team admins can change the invite code' using errcode = '42501';
  end if;
  loop
    v_code := private.new_invite_code();
    exit when not exists (select 1 from public.teams where invite_code = v_code);
  end loop;
  update public.teams set invite_code = v_code where id = p_team_id;
  return v_code;
end;
$$;

revoke execute on function public.create_team(text, text, text) from public, anon;
revoke execute on function public.preview_team(text) from public, anon;
revoke execute on function public.join_team(text, bigint, text, text) from public, anon;
revoke execute on function public.regenerate_invite_code(bigint) from public, anon;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.preview_team(text) to authenticated;
grant execute on function public.join_team(text, bigint, text, text) to authenticated;
grant execute on function public.regenerate_invite_code(bigint) to authenticated;

revoke execute on function private.new_invite_code() from public, anon, authenticated;
revoke execute on function private.guard_team_members() from public, anon, authenticated;
