-- Phase 3: team integrations (Google Calendar now, Google Sheets later).
-- Stores only an identifier (e.g. a calendar ID). Events and sheet contents
-- stay in Google and are never copied into this database.
--
-- Access: team members read; managers (admin or command) add and remove.

create table public.integrations (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('gcal', 'gsheet')),
  external_id text not null check (char_length(external_id) between 3 and 300),
  label text not null default '' check (char_length(label) <= 60),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (team_id, kind, external_id)
);
create index integrations_team_idx on public.integrations (team_id, kind);
create index integrations_created_by_idx on public.integrations (created_by);

-- At most 3 calendars per team (they render together in one embed).
create or replace function private.limit_calendars()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind = 'gcal' and (
    select count(*) from public.integrations i where i.team_id = new.team_id and i.kind = 'gcal'
  ) >= 3 then
    raise exception 'a team can connect up to 3 calendars' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger integrations_limit_calendars
  before insert on public.integrations
  for each row execute function private.limit_calendars();

alter table public.integrations enable row level security;

create policy "members read integrations" on public.integrations
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "managers add integrations" on public.integrations
  for insert to authenticated
  with check ((select private.can_manage(team_id)) and created_by = (select auth.uid()));
create policy "managers edit integrations" on public.integrations
  for update to authenticated
  using ((select private.can_manage(team_id)))
  with check ((select private.can_manage(team_id)));
create policy "managers remove integrations" on public.integrations
  for delete to authenticated
  using ((select private.can_manage(team_id)));

revoke all on public.integrations from anon;
grant select, insert, update, delete on public.integrations to authenticated;
