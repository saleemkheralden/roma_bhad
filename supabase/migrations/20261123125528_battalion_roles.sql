-- Battalion roles, like team and company roles: a configurable role list and rotating
-- assignments (role + person + date range).
--
--   * A battalion role goes to battalion staff (member_id) or to a cadet on a team of one of
--     the battalion's companies (team_member_id); exactly one of the two. The database checks
--     the cadet is in the battalion, and drops those assignments when the team or its company
--     leaves the battalion (moving a team between the battalion's own companies keeps them).
--   * Holding a battalion role today or later makes a cadet a battalion member (they see the
--     battalion and its counts-only dashboard); a command role today lets them manage the
--     battalion's roles and assignments, like battalion admins.
--   * battalion_people() lists names for the role picker: every cadet of the battalion for
--     managers, otherwise only the cadets who hold a battalion role (so the list can show them).

create table public.battalion_roles (
  id bigint generated always as identity primary key,
  battalion_id bigint not null references public.battalions (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  is_command boolean not null default true,
  sort_order integer not null default 0,
  unique (battalion_id, name),
  unique (id, battalion_id)
);

create table public.battalion_role_assignments (
  id bigint generated always as identity primary key,
  battalion_id bigint not null references public.battalions (id) on delete cascade,
  role_id bigint not null,
  member_id bigint,
  team_member_id bigint references public.team_members (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  constraint battalion_assignment_one_person check (num_nonnulls(member_id, team_member_id) = 1),
  foreign key (role_id, battalion_id) references public.battalion_roles (id, battalion_id) on delete cascade
);
-- battalion_members has no (id, battalion_id) key yet; add it so staff assignees stay in their battalion.
alter table public.battalion_members add constraint battalion_members_id_battalion_key unique (id, battalion_id);
alter table public.battalion_role_assignments
  add foreign key (member_id, battalion_id) references public.battalion_members (id, battalion_id) on delete cascade;

create index battalion_assignments_dates_idx on public.battalion_role_assignments (battalion_id, start_date, end_date);
create index battalion_assignments_role_idx on public.battalion_role_assignments (role_id, battalion_id);
create index battalion_assignments_member_idx on public.battalion_role_assignments (member_id, battalion_id);
create index battalion_assignments_team_member_idx on public.battalion_role_assignments (team_member_id);

-- Helpers ----------------------------------------------------------------------

-- Is this team (through its company) in the battalion?
create or replace function private.team_in_battalion(p_team_id bigint, p_battalion_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams t join public.companies c on c.id = t.company_id
                 where t.id = p_team_id and c.battalion_id = p_battalion_id);
$$;

-- Membership now includes cadets holding a battalion role today or later (they prepare tonight).
create or replace function private.is_battalion_member(p_battalion_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.battalion_members m
                 where m.battalion_id = p_battalion_id and m.user_id = (select auth.uid()))
      or exists (select 1 from public.battalion_role_assignments a
                 join public.team_members tm on tm.id = a.team_member_id
                 where a.battalion_id = p_battalion_id and tm.user_id = (select auth.uid())
                   and a.end_date >= private.today());
$$;

create or replace function private.can_manage_battalion(p_battalion_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_battalion_admin(p_battalion_id) or exists (
    select 1 from public.battalion_role_assignments a
    join public.battalion_roles r on r.id = a.role_id
    left join public.battalion_members m on m.id = a.member_id
    left join public.team_members tm on tm.id = a.team_member_id
    where a.battalion_id = p_battalion_id and r.is_command
      and (m.user_id = (select auth.uid()) or tm.user_id = (select auth.uid()))
      and private.today() between a.start_date and a.end_date
  );
$$;

revoke execute on function private.team_in_battalion(bigint, bigint), private.can_manage_battalion(bigint) from public, anon;
grant execute on function private.team_in_battalion(bigint, bigint), private.can_manage_battalion(bigint) to authenticated;

-- A cadet assignee must be on a team of one of the battalion's companies.
create or replace function private.guard_battalion_assignment_person()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.team_member_id is not null and not exists (
    select 1 from public.team_members m
    where m.id = new.team_member_id and private.team_in_battalion(m.team_id, new.battalion_id)
  ) then
    raise exception 'the cadet is not on a team of this battalion' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger battalion_assignments_person_guard
  before insert or update on public.battalion_role_assignments
  for each row execute function private.guard_battalion_assignment_person();

-- A team changed company: drop its cadets' battalion roles where the team is no longer in that battalion.
create or replace function private.drop_battalion_roles_of_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.company_id is distinct from old.company_id then
    delete from public.battalion_role_assignments a
    using public.team_members m
    where a.team_member_id = m.id and m.team_id = new.id
      and not private.team_in_battalion(new.id, a.battalion_id);
  end if;
  return null;
end;
$$;
create trigger teams_drop_battalion_roles
  after update of company_id on public.teams
  for each row execute function private.drop_battalion_roles_of_team();

-- A company left the battalion: its cadets' roles in that battalion go too.
create or replace function private.drop_battalion_roles_of_company()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.battalion_id is not null and new.battalion_id is distinct from old.battalion_id then
    delete from public.battalion_role_assignments a
    using public.team_members m join public.teams t on t.id = m.team_id
    where a.team_member_id = m.id and t.company_id = new.id and a.battalion_id = old.battalion_id;
  end if;
  return null;
end;
$$;
create trigger companies_drop_battalion_roles
  after update of battalion_id on public.companies
  for each row execute function private.drop_battalion_roles_of_company();

revoke execute on function private.guard_battalion_assignment_person(), private.drop_battalion_roles_of_team(),
  private.drop_battalion_roles_of_company() from public, anon;

-- RLS ----------------------------------------------------------------------------

alter table public.battalion_roles enable row level security;
alter table public.battalion_role_assignments enable row level security;

create policy "members read battalion roles" on public.battalion_roles for select to authenticated
  using ((select private.is_battalion_member(battalion_id)));
create policy "managers add battalion roles" on public.battalion_roles for insert to authenticated
  with check ((select private.can_manage_battalion(battalion_id)));
create policy "managers edit battalion roles" on public.battalion_roles for update to authenticated
  using ((select private.can_manage_battalion(battalion_id))) with check ((select private.can_manage_battalion(battalion_id)));
create policy "managers remove battalion roles" on public.battalion_roles for delete to authenticated
  using ((select private.can_manage_battalion(battalion_id)));

create policy "members read battalion assignments" on public.battalion_role_assignments for select to authenticated
  using ((select private.is_battalion_member(battalion_id)));
create policy "managers add battalion assignments" on public.battalion_role_assignments for insert to authenticated
  with check ((select private.can_manage_battalion(battalion_id)));
create policy "managers edit battalion assignments" on public.battalion_role_assignments for update to authenticated
  using ((select private.can_manage_battalion(battalion_id))) with check ((select private.can_manage_battalion(battalion_id)));
create policy "managers remove battalion assignments" on public.battalion_role_assignments for delete to authenticated
  using ((select private.can_manage_battalion(battalion_id)));

revoke all on public.battalion_roles, public.battalion_role_assignments from anon;
grant select, insert, update, delete on public.battalion_roles, public.battalion_role_assignments to authenticated;

-- People for the role picker -------------------------------------------------------

create or replace function private.battalion_people(p_battalion_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_all boolean;
begin
  if not private.is_battalion_member(p_battalion_id) then
    raise exception 'not a member of this battalion' using errcode = '42501';
  end if;
  v_all := private.can_manage_battalion(p_battalion_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_member_id', m.id,
      'name', trim(m.first_name || ' ' || m.last_name),
      'team_name', t.name,
      'company_name', c.name,
      'is_me', m.user_id is not distinct from (select auth.uid()) and m.user_id is not null
    ) order by c.name, t.name, m.first_name, m.last_name)
    from public.team_members m
    join public.teams t on t.id = m.team_id
    join public.companies c on c.id = t.company_id
    where c.battalion_id = p_battalion_id
      and (v_all or exists (select 1 from public.battalion_role_assignments a
                            where a.battalion_id = p_battalion_id and a.team_member_id = m.id))
  ), '[]'::jsonb);
end;
$$;
revoke execute on function private.battalion_people(bigint) from public, anon;
grant execute on function private.battalion_people(bigint) to authenticated;

create function public.battalion_people(p_battalion_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.battalion_people(p_battalion_id); $$;
revoke execute on function public.battalion_people(bigint) from public, anon;
grant execute on function public.battalion_people(bigint) to authenticated;
