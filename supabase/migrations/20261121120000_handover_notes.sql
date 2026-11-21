-- Handover notes (Phase 4): today's role-holders leave a short note for whoever holds the roles next.
--
--   * Read: team members (the board already shows who's on duty tomorrow; nothing here is private).
--   * Write: command only (staff, or a command role today), as themselves. The database stamps the
--     author's roster row and account, so a note can't be posted in someone else's name.
--   * Edit: the author only, text only. Remove: the author, or anyone who manages the team.
--   * Info-security: generic text only, like tasks. Kept short, and notes older than two weeks
--     are pruned whenever a new one is written (collect as little as possible).

create table public.handover_notes (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.teams (id) on delete cascade,
  for_date date not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  author_member_id bigint,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (author_member_id, team_id) references public.team_members (id, team_id) on delete set null (author_member_id)
);
create index handover_notes_team_date_idx on public.handover_notes (team_id, for_date);
create index handover_notes_author_idx on public.handover_notes (author_member_id, team_id);
create index handover_notes_created_by_idx on public.handover_notes (created_by);

-- Stamps the author on insert, keeps everything but the text fixed on update.
create or replace function private.guard_handover_notes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.author_member_id := (
      select m.id from public.team_members m
      where m.team_id = new.team_id and m.user_id = (select auth.uid())
    );
    new.created_at := now();
    if new.for_date < private.today() then
      raise exception 'a handover note is for today or a later day' using errcode = '23514';
    end if;
    return new;
  end if;

  if (new.team_id, new.for_date, new.author_member_id, new.created_by, new.created_at)
     is distinct from (old.team_id, old.for_date, old.author_member_id, old.created_by, old.created_at) then
    raise exception 'only the text of a handover note can change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger handover_notes_guard
  before insert or update on public.handover_notes
  for each row execute function private.guard_handover_notes();

-- Prune the team's notes older than two weeks (definer: the writer may not own them).
create or replace function private.prune_handover_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.handover_notes n
  where n.team_id = new.team_id and n.for_date < private.today() - 14;
  return null;
end;
$$;

create trigger handover_notes_prune
  after insert on public.handover_notes
  for each row execute function private.prune_handover_notes();

revoke execute on function private.guard_handover_notes() from public, anon;
revoke execute on function private.prune_handover_notes() from public, anon;

alter table public.handover_notes enable row level security;

create policy "members read handover notes" on public.handover_notes
  for select to authenticated
  using ((select private.is_team_member(team_id)));
create policy "command writes handover notes" on public.handover_notes
  for insert to authenticated
  with check ((select private.can_command(team_id)));
create policy "authors edit their handover notes" on public.handover_notes
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "authors and managers remove handover notes" on public.handover_notes
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.can_manage(team_id)));

revoke all on public.handover_notes from anon;
grant select, insert, update, delete on public.handover_notes to authenticated;
