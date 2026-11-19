-- Personal task views (issue #1): each cadet chooses how to see their own
-- tasks (list, Kanban board, or by day), and on the board can keep tasks in a
-- personal "in progress" lane and in their own order.
--
-- Everything here is per user and private to that user. Nothing changes what
-- other cadets see: "in progress" and the card order are personal notes on top
-- of a task, while "done" still comes from the task itself (tasks.status, or
-- the cadet's own task_completions row for team-wide tasks).
--
-- Info-security: only a layout name, a lane name and a number. No content.

-- One row per user: their chosen task layout. -------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  task_layout text not null default 'list' check (task_layout in ('list', 'board', 'days')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "read own settings" on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "create own settings" on public.user_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "update own settings" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own settings" on public.user_settings
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;

-- A user's personal board placement of a task. ------------------------------
-- No row = "to do", ordered by due date. "done" is never stored here.
create table public.task_lanes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id bigint not null,
  team_id bigint not null,
  lane text not null default 'todo' check (lane in ('todo', 'doing')),
  position integer not null default 0 check (position between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id),
  foreign key (task_id, team_id) references public.tasks (id, team_id) on delete cascade
);

create index task_lanes_user_team_idx on public.task_lanes (user_id, team_id);
create index task_lanes_task_team_idx on public.task_lanes (task_id, team_id);

alter table public.task_lanes enable row level security;

create policy "read own lanes" on public.task_lanes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The task must be one the caller can see (tasks RLS applies inside exists),
-- so a cadet can't probe for other people's private tasks.
create policy "place tasks I can see" on public.task_lanes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.team_id = task_lanes.team_id)
  );

create policy "move own placements" on public.task_lanes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.team_id = task_lanes.team_id)
  );

create policy "delete own placements" on public.task_lanes
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.task_lanes from anon;
grant select, insert, update, delete on public.task_lanes to authenticated;
