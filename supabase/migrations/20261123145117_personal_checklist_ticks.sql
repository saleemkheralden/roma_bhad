-- Personal checklist ticks on team-wide tasks.
--
-- A team-wide task (team task with no assignee) is done by every cadet, so its steps were one
-- shared checklist: one cadet's tick showed as done for everybody. Now each cadet ticks their
-- own copy of the steps (like task_completions for the task itself):
--   * task_checklist_ticks: one row per (step, me). Own rows only: read, add, remove.
--   * Only on open team-wide tasks, by a member of the task's team.
--   * The shared `done` flag on a team-wide task's steps is no longer used and is cleared;
--     assigned and private tasks keep the shared flag (only one person ticks them anyway).
--   * Command still adds and removes the steps themselves.

create table public.task_checklist_ticks (
  item_id bigint not null references public.task_checklist_items (id) on delete cascade,
  member_id bigint not null references public.team_members (id) on delete cascade,
  team_id bigint not null references public.teams (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (item_id, member_id)
);
create index task_checklist_ticks_member_idx on public.task_checklist_ticks (member_id);
create index task_checklist_ticks_team_idx on public.task_checklist_ticks (team_id);

-- May the caller tick this step as this member? Open team-wide task, the member is me, same team.
create or replace function private.can_tick_own_step(p_item_id bigint, p_member_id bigint, p_team_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.task_checklist_items i
    join public.tasks t on t.id = i.task_id and t.team_id = i.team_id
    join public.team_members m on m.id = p_member_id and m.team_id = t.team_id
    where i.id = p_item_id and i.team_id = p_team_id
      and t.visibility = 'team' and t.assignee_member_id is null and t.status = 'open'
      and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.can_tick_own_step(bigint, bigint, bigint) from public, anon;
grant execute on function private.can_tick_own_step(bigint, bigint, bigint) to authenticated;

alter table public.task_checklist_ticks enable row level security;

create policy "read my own ticks" on public.task_checklist_ticks for select to authenticated
  using ((select private.is_me(member_id)));
create policy "tick my own steps" on public.task_checklist_ticks for insert to authenticated
  with check ((select private.can_tick_own_step(item_id, member_id, team_id)));
create policy "untick my own steps" on public.task_checklist_ticks for delete to authenticated
  using ((select private.can_tick_own_step(item_id, member_id, team_id)));

revoke all on public.task_checklist_ticks from anon;
grant select, insert, delete on public.task_checklist_ticks to authenticated;

-- The shared flag is not used on team-wide tasks any more: clear it, and refuse new shared ticks.
update public.task_checklist_items i set done = false, done_at = null, done_by = null
from public.tasks t
where t.id = i.task_id and t.team_id = i.team_id and t.visibility = 'team' and t.assignee_member_id is null and i.done;

create or replace function private.guard_team_wide_shared_tick()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.done is distinct from old.done and new.done and exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.team_id = new.team_id and t.visibility = 'team' and t.assignee_member_id is null
  ) then
    raise exception 'steps of a team-wide task are ticked per cadet (task_checklist_ticks)' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_team_wide_shared_tick() from public, anon;
create trigger task_checklist_items_team_wide_guard
  before update on public.task_checklist_items
  for each row execute function private.guard_team_wide_shared_tick();
