-- The company's people come from its teams. Nobody needs a code to be "in" the company.
--
--   * Company roles (א׳ פלוגה…) can be given to any cadet on a team of the company
--     (team_member_id), as well as to company staff (member_id, as before). The database
--     checks that the cadet's team is in the company, and drops those assignments if the team
--     leaves the company.
--   * Whoever holds a company role today or later counts as a company member (sees the company
--     and its dashboard), and a command role today lets them manage it, like company staff.
--     Other cadets still don't see the company dashboard: it holds absence reasons.
--   * company_people() lists the cadets of the company's teams, for the role picker.

alter table public.company_role_assignments
  alter column member_id drop not null,
  add column team_member_id bigint references public.team_members (id) on delete cascade,
  add constraint company_assignment_one_person check (num_nonnulls(member_id, team_member_id) = 1);
create index company_assignments_team_member_idx on public.company_role_assignments (team_member_id);

-- A cadet assignee must be on a team of this company.
create or replace function private.guard_company_assignment_person()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.team_member_id is not null and not exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where m.id = new.team_member_id and t.company_id = new.company_id
  ) then
    raise exception 'the cadet is not on a team of this company' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger company_assignments_person_guard
  before insert or update on public.company_role_assignments
  for each row execute function private.guard_company_assignment_person();

-- When a team leaves a company, its cadets' company roles there go too.
create or replace function private.drop_company_roles_of_team()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.company_id is not null and new.company_id is distinct from old.company_id then
    delete from public.company_role_assignments a
    using public.team_members m
    where a.team_member_id = m.id and m.team_id = new.id and a.company_id = old.company_id;
  end if;
  return null;
end;
$$;
create trigger teams_drop_company_roles
  after update of company_id on public.teams
  for each row execute function private.drop_company_roles_of_team();

revoke execute on function private.guard_company_assignment_person(), private.drop_company_roles_of_team() from public, anon;

-- Membership now includes cadets holding a company role today or later (they prepare tonight).
create or replace function private.is_company_member(p_company_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = p_company_id and m.user_id = (select auth.uid()))
      or exists (select 1 from public.company_role_assignments a
                 join public.team_members tm on tm.id = a.team_member_id
                 where a.company_id = p_company_id and tm.user_id = (select auth.uid())
                   and a.end_date >= private.today());
$$;

create or replace function private.can_manage_company(p_company_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_company_admin(p_company_id) or exists (
    select 1 from public.company_role_assignments a
    join public.company_roles r on r.id = a.role_id
    left join public.company_members m on m.id = a.member_id
    left join public.team_members tm on tm.id = a.team_member_id
    where a.company_id = p_company_id and r.is_command
      and (m.user_id = (select auth.uid()) or tm.user_id = (select auth.uid()))
      and private.today() between a.start_date and a.end_date
  );
$$;

-- The cadets of the company's teams (company members only).
create or replace function private.company_people(p_company_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'not a member of this company' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_member_id', m.id,
      'name', trim(m.first_name || ' ' || m.last_name),
      'team_id', t.id,
      'team_name', t.name,
      'joined', m.user_id is not null,
      'is_me', m.user_id is not distinct from (select auth.uid()) and m.user_id is not null
    ) order by t.name, m.first_name, m.last_name)
    from public.team_members m join public.teams t on t.id = m.team_id
    where t.company_id = p_company_id
  ), '[]'::jsonb);
end;
$$;
revoke execute on function private.company_people(bigint) from public, anon;
grant execute on function private.company_people(bigint) to authenticated;

create function public.company_people(p_company_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.company_people(p_company_id); $$;
revoke execute on function public.company_people(bigint) from public, anon;
grant execute on function public.company_people(bigint) to authenticated;
