-- Notice board (issue #3): short announcements from role-holders and staff.
--
-- Two audiences:
--   * 'team'    : every team member reads it (the evening catch-up).
--   * 'command' : role-holders only, e.g. handover notes for tomorrow's
--                 role-holders. Read by staff and anyone with a command role
--                 today or later (so tomorrow's holder can read it tonight).
--
-- Access:
--   * Post: command (staff or today's role-holder), as themselves.
--   * Edit / pin / delete: command, or the author (even after their day ends).
--   * Optional expiry date: the board hides a notice after it.
--   * Info-security (CLAUDE.md): generic text only, no locations, operational
--     schedules or equipment. The compose form carries the reminder.
--   * No "seen by" tracking: we don't record who read what.

-- Staff, or holds a command role today or on a later date.
create or replace function private.is_role_holder(p_team_id bigint)
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
      and ra.end_date >= private.today()
  );
$$;
revoke execute on function private.is_role_holder(bigint) from public, anon;
grant execute on function private.is_role_holder(bigint) to authenticated;

create table public.notices (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  audience text not null default 'team' check (audience in ('team', 'command')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null default '' check (char_length(body) <= 1000),
  pinned boolean not null default false,
  expires_on date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index notices_team_idx on public.notices (team_id, pinned, created_at desc);
create index notices_created_by_idx on public.notices (created_by);

-- Guard: the author is always the caller; team, author and creation time never change.
create or replace function private.guard_notices()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.updated_at := null;
    return new;
  end if;

  if new.team_id <> old.team_id
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception 'a notice cannot move between teams or change its author' using errcode = '42501';
  end if;
  if (new.title, new.body, new.audience) is distinct from (old.title, old.body, old.audience) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger notices_guard
  before insert or update on public.notices
  for each row execute function private.guard_notices();

alter table public.notices enable row level security;

create policy "members read team notices; role-holders read command notices" on public.notices
  for select to authenticated
  using (
    (select private.is_team_member(team_id))
    and (audience = 'team' or (select private.is_role_holder(team_id)))
  );

create policy "command posts notices" on public.notices
  for insert to authenticated
  with check ((select private.can_command(team_id)) and created_by = (select auth.uid()));

create policy "command or author edits notices" on public.notices
  for update to authenticated
  using (
    (select private.can_command(team_id))
    or (created_by = (select auth.uid()) and (select private.is_team_member(team_id)))
  )
  with check (
    (select private.can_command(team_id))
    or (created_by = (select auth.uid()) and (select private.is_team_member(team_id)))
  );

create policy "command or author deletes notices" on public.notices
  for delete to authenticated
  using (
    (select private.can_command(team_id))
    or (created_by = (select auth.uid()) and (select private.is_team_member(team_id)))
  );

revoke all on public.notices from anon;
grant select, insert, update, delete on public.notices to authenticated;
