-- Phase 2: team and private tasks.
--
-- Access (CLAUDE.md):
--   * Team tasks: every team member reads them; command (staff or today's
--     role-holder) creates, edits, assigns and deletes them. The assignee may
--     mark their own task done or open again, and change nothing else.
--   * Private tasks: only the owner (owner_id = auth.uid()) sees or touches them.
--   * Visibility never changes after creation (a private task can't be promoted).
--   * Info-security: generic task text only; no operational fields.

create table public.tasks (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  visibility text not null check (visibility in ('team', 'private')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 500),
  due_on date,
  due_time time,
  assignee_member_id bigint,
  owner_id uuid references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (assignee_member_id, team_id) references public.team_members (id, team_id) on delete set null (assignee_member_id),
  -- a time only makes sense with a date
  check (due_time is null or due_on is not null),
  -- private tasks belong to their owner and are never assigned
  check (visibility = 'team' or (owner_id is not null and assignee_member_id is null))
);

create index tasks_team_open_idx on public.tasks (team_id, status, due_on);
create index tasks_assignee_idx on public.tasks (assignee_member_id, team_id);
create index tasks_owner_idx on public.tasks (owner_id);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_done_by_idx on public.tasks (done_by);

-- Is this roster row me? (definer: reads team_members without RLS recursion)
create or replace function private.is_me(p_member_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.id = p_member_id and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_me(bigint) from public, anon;
grant execute on function private.is_me(bigint) to authenticated;

-- Guard: immutable visibility/team; assignees may only flip status;
-- done_at/done_by are always set by the database.
create or replace function private.guard_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Checked by RLS after this trigger runs, so the owner is always the caller.
    if new.visibility = 'private' then
      new.owner_id := (select auth.uid());
    else
      new.owner_id := null;
    end if;
    new.status := 'open';
    new.done_at := null;
    new.done_by := null;
    return new;
  end if;

  if new.team_id <> old.team_id or new.visibility <> old.visibility then
    raise exception 'a task cannot move between teams or change visibility' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'a task owner cannot change' using errcode = '42501';
  end if;

  if old.visibility = 'team' and not private.can_command(old.team_id) then
    -- Not command: must be the assignee (RLS already checked), and only status may change.
    if (new.title, new.notes, new.due_on, new.due_time, new.assignee_member_id)
       is distinct from (old.title, old.notes, old.due_on, old.due_time, old.assignee_member_id) then
      raise exception 'only staff or today''s role-holders can edit team tasks' using errcode = '42501';
    end if;
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.done_at := now();
    new.done_by := (select auth.uid());
  elsif new.status = 'open' then
    new.done_at := null;
    new.done_by := null;
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;

create trigger tasks_guard
  before insert or update on public.tasks
  for each row execute function private.guard_tasks();

alter table public.tasks enable row level security;

create policy "read team tasks and own private tasks" on public.tasks
  for select to authenticated
  using (
    (visibility = 'team' and (select private.is_team_member(team_id)))
    or (visibility = 'private' and owner_id = (select auth.uid()) and (select private.is_team_member(team_id)))
  );

create policy "command creates team tasks; members create private ones" on public.tasks
  for insert to authenticated
  with check (
    (visibility = 'team' and (select private.can_command(team_id)) and created_by = (select auth.uid()))
    or (visibility = 'private' and owner_id = (select auth.uid()) and (select private.is_team_member(team_id)))
  );

create policy "command or assignee updates team tasks; owner updates private" on public.tasks
  for update to authenticated
  using (
    (visibility = 'team' and ((select private.can_command(team_id)) or (select private.is_me(assignee_member_id))))
    or (visibility = 'private' and owner_id = (select auth.uid()))
  )
  with check (
    (visibility = 'team' and ((select private.can_command(team_id)) or (select private.is_me(assignee_member_id))))
    or (visibility = 'private' and owner_id = (select auth.uid()))
  );

create policy "command deletes team tasks; owner deletes private" on public.tasks
  for delete to authenticated
  using (
    (visibility = 'team' and (select private.can_command(team_id)))
    or (visibility = 'private' and owner_id = (select auth.uid()))
  );

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
