-- Task checklists (issue #2): break a task down into smaller steps that can be ticked off.
--
-- Access mirrors the parent task:
--   * Read: whoever can read the task (team members for team tasks, the owner for private ones).
--   * Add, rename, reorder, remove steps: whoever can edit the task
--     (command for team tasks, the owner for private tasks).
--   * Tick a step: the editors above, plus the assignee of an assigned team task.
--     A team-wide task (no assignee) has one shared checklist that command ticks;
--     each cadet still marks their own part through task_completions.
--   * Only while the task is open. done_at / done_by are always set by the database.
--   * Info-security: generic task text only (same rules as tasks.title).

create table public.task_checklist_items (
  id bigint generated always as identity primary key,
  task_id bigint not null,
  team_id bigint not null,
  text text not null check (char_length(trim(text)) between 1 and 120),
  position integer not null default 0,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (task_id, team_id) references public.tasks (id, team_id) on delete cascade
);

create index task_checklist_items_task_idx on public.task_checklist_items (task_id, team_id, position);
create index task_checklist_items_team_idx on public.task_checklist_items (team_id);
create index task_checklist_items_done_by_idx on public.task_checklist_items (done_by);
create index task_checklist_items_created_by_idx on public.task_checklist_items (created_by);

-- What may the caller do with this task's checklist? 'edit' (implies tick), 'tick', 'read' or null.
-- Definer: reads tasks/team_members without their RLS, and checks the caller explicitly.
create or replace function private.checklist_access(p_task_id bigint, p_team_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_team_member(t.team_id) then null
    when t.visibility = 'private' and t.owner_id is distinct from (select auth.uid()) then null
    when t.status <> 'open' then 'read'
    when t.visibility = 'private' then 'edit'
    when private.can_command(t.team_id) then 'edit'
    when t.assignee_member_id is not null and private.is_me(t.assignee_member_id) then 'tick'
    else 'read'
  end
  from public.tasks t
  where t.id = p_task_id and t.team_id = p_team_id;
$$;
revoke execute on function private.checklist_access(bigint, bigint) from public, anon;
grant execute on function private.checklist_access(bigint, bigint) to authenticated;

-- Guard: at most 20 steps per task; tickers may only flip `done`; the database stamps done_at/done_by.
create or replace function private.guard_checklist_items()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.task_checklist_items i
        where i.task_id = new.task_id and i.team_id = new.team_id) >= 20 then
      raise exception 'a task can have at most 20 checklist items' using errcode = '23514';
    end if;
    new.done := false;
    new.done_at := null;
    new.done_by := null;
    new.created_by := (select auth.uid());
    return new;
  end if;

  if new.task_id <> old.task_id or new.team_id <> old.team_id then
    raise exception 'a checklist item cannot move between tasks' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'checklist item author cannot change' using errcode = '42501';
  end if;
  if private.checklist_access(old.task_id, old.team_id) is distinct from 'edit'
     and (new.text, new.position) is distinct from (old.text, old.position) then
    raise exception 'only whoever can edit the task can change its checklist' using errcode = '42501';
  end if;

  if new.done and not old.done then
    new.done_at := now();
    new.done_by := (select auth.uid());
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;

create trigger task_checklist_items_guard
  before insert or update on public.task_checklist_items
  for each row execute function private.guard_checklist_items();

alter table public.task_checklist_items enable row level security;

create policy "read checklist of a task I can read" on public.task_checklist_items
  for select to authenticated
  using ((select private.checklist_access(task_id, team_id)) is not null);

create policy "task editors add checklist items" on public.task_checklist_items
  for insert to authenticated
  with check ((select private.checklist_access(task_id, team_id)) = 'edit');

create policy "task editors and the assignee update checklist items" on public.task_checklist_items
  for update to authenticated
  using ((select private.checklist_access(task_id, team_id)) in ('edit', 'tick'))
  with check ((select private.checklist_access(task_id, team_id)) in ('edit', 'tick'));

create policy "task editors remove checklist items" on public.task_checklist_items
  for delete to authenticated
  using ((select private.checklist_access(task_id, team_id)) = 'edit');

revoke all on public.task_checklist_items from anon;
grant select, insert, update, delete on public.task_checklist_items to authenticated;
