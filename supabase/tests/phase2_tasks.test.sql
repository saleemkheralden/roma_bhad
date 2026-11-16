-- RLS and trigger tests for tasks (Phase 2). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'cmd@test.local'),   -- role-holder today (command)
  ('00000000-0000-0000-0000-0000000000b1', 'cadet@test.local'), -- cadet, assignee
  ('00000000-0000-0000-0000-0000000000c1', 'other@test.local'), -- another cadet in the team
  ('00000000-0000-0000-0000-0000000000d1', 'out@test.local');   -- outsider

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Setup as the command user: team, members, a command role today.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.create_team('צוות משימות', 'מפקדת', 'בדיקה');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a1';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.join_team((select invite_code from t), null, 'צוער', 'בי');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.join_team((select invite_code from t), null, 'צוערת', 'סי');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.name = 'א׳ צוות'
  and m.user_id = '00000000-0000-0000-0000-0000000000a1';

-- Command creates team tasks ---------------------------------------------------
select lives_ok($$ insert into public.tasks (team_id, visibility, title, assignee_member_id)
  select team_id, 'team', 'להגיש סיכום שיעור',
         (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b1')
  from t $$, 'command creates an assigned team task');
select lives_ok($$ insert into public.tasks (team_id, visibility, title, due_on)
  select team_id, 'team', 'משימה לכל הצוות', private.today() + 1 from t $$, 'command creates a team-wide task');
select is((select owner_id from public.tasks where title = 'משימה לכל הצוות'), null, 'team tasks have no owner');
select lives_ok($$ insert into public.tasks (team_id, visibility, title) select team_id, 'private', 'תזכורת של המפקדת' from t $$,
  'command can also keep private tasks');

-- A cadet --------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.tasks where visibility = 'team'), 2, 'cadet sees both team tasks');
select is((select count(*)::int from public.tasks where visibility = 'private'), 0, 'cadet does not see someone else''s private task');
select throws_ok($$ insert into public.tasks (team_id, visibility, title) select team_id, 'team', 'ניסיון' from t $$,
  '42501', null, 'cadet cannot create team tasks');
select lives_ok($$ insert into public.tasks (team_id, visibility, title, owner_id)
  select team_id, 'private', 'לכבס מדים', '00000000-0000-0000-0000-0000000000c1' from t $$,
  'cadet creates a private task');
select is((select owner_id from public.tasks where title = 'לכבס מדים'), '00000000-0000-0000-0000-0000000000b1'::uuid,
  'owner is forced to the caller, whatever the client sent');
select lives_ok($$ update public.tasks set status = 'done' where title = 'להגיש סיכום שיעור' $$, 'assignee marks their task done');
select is((select done_by from public.tasks where title = 'להגיש סיכום שיעור'), '00000000-0000-0000-0000-0000000000b1'::uuid,
  'done_by is set by the database');
select throws_ok($$ update public.tasks set title = 'שונה' where title = 'להגיש סיכום שיעור' $$,
  '42501', null, 'assignee cannot edit the task text');
update public.tasks set status = 'done' where title = 'משימה לכל הצוות'; -- not assignee: filtered by RLS
select is((select status from public.tasks where title = 'משימה לכל הצוות'), 'open', 'cadet cannot close a team-wide task');
select throws_ok($$ update public.tasks set visibility = 'team' where title = 'לכבס מדים' $$,
  '42501', null, 'a private task cannot be promoted to a team task');
select lives_ok($$ update public.tasks set title = 'לכבס מדים ב', due_on = private.today() + 2 where title = 'לכבס מדים' $$,
  'the owner edits their private task');

-- Another cadet -----------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.tasks where title like 'לכבס מדים%'), 0, 'other cadets cannot see a private task');
delete from public.tasks where title = 'להגיש סיכום שיעור'; -- filtered by RLS
select pg_temp.as_postgres();
select is((select count(*)::int from public.tasks where title = 'להגיש סיכום שיעור' and team_id = (select team_id from t)), 1,
  'a non-command cadet cannot delete team tasks');

-- Outsider ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.tasks), 0, 'outsider sees no tasks');
select throws_ok($$ insert into public.tasks (team_id, visibility, title) select team_id, 'private', 'x' from t $$,
  '42501', null, 'outsider cannot create tasks in the team');

-- Command can edit and delete team tasks ----------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ update public.tasks set title = 'להגיש סיכום שיעור עד 14:00' where title = 'להגיש סיכום שיעור' $$,
  'command edits a team task');
select lives_ok($$ delete from public.tasks where title = 'משימה לכל הצוות' $$, 'command deletes a team task');

select * from finish();
rollback;
