-- Per-cadet completion for team-wide tasks (team tasks with no assignee).
--
-- Access:
--   * Everyone in the team sees who has finished (it's a team task).
--   * A cadet marks or unmarks their own row.
--   * Command (staff or today's role-holder) can mark or unmark anyone,
--     e.g. a cadet who has no phone during the day.
--   * Only team-wide, still-open team tasks accept completions.
--   * done_by / done_at are always set by the database.

alter table public.tasks add constraint tasks_id_team_id_key unique (id, team_id);

create table public.task_completions (
  task_id bigint not null,
  team_id bigint not null,
  member_id bigint not null,
  done_at timestamptz not null default now(),
  done_by uuid references auth.users (id) on delete set null default auth.uid(),
  primary key (task_id, member_id),
  foreign key (task_id, team_id) references public.tasks (id, team_id) on delete cascade,
  foreign key (member_id, team_id) references public.team_members (id, team_id) on delete cascade
);
create index task_completions_team_idx on public.task_completions (team_id);
create index task_completions_member_idx on public.task_completions (member_id, team_id);
create index task_completions_task_team_idx on public.task_completions (task_id, team_id);
create index task_completions_done_by_idx on public.task_completions (done_by);

-- Is this an open, team-wide task of this team? (definer: tasks has its own RLS)
create or replace function private.is_open_team_wide_task(p_task_id bigint, p_team_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.team_id = p_team_id
      and t.visibility = 'team' and t.assignee_member_id is null and t.status = 'open'
  ) and private.is_team_member(p_team_id);
$$;
revoke execute on function private.is_open_team_wide_task(bigint, bigint) from public, anon;
grant execute on function private.is_open_team_wide_task(bigint, bigint) to authenticated;

create or replace function private.stamp_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.done_at := now();
  new.done_by := (select auth.uid());
  return new;
end;
$$;

create trigger task_completions_stamp
  before insert on public.task_completions
  for each row execute function private.stamp_completion();

alter table public.task_completions enable row level security;

create policy "members read completions" on public.task_completions
  for select to authenticated
  using ((select private.is_team_member(team_id)));

create policy "mark own or (command) anyone's completion" on public.task_completions
  for insert to authenticated
  with check (
    (select private.is_open_team_wide_task(task_id, team_id))
    and ((select private.is_me(member_id)) or (select private.can_command(team_id)))
  );

create policy "unmark own or (command) anyone's completion" on public.task_completions
  for delete to authenticated
  using (
    (select private.is_open_team_wide_task(task_id, team_id))
    and ((select private.is_me(member_id)) or (select private.can_command(team_id)))
  );

revoke all on public.task_completions from anon;
grant select, insert, delete on public.task_completions to authenticated;
