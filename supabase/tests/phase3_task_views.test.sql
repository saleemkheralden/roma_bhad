-- RLS tests for personal task views (issue #1): user_settings and task_lanes.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'cmd3@test.local'),   -- creates the team (command via staff role today)
  ('00000000-0000-0000-0000-0000000000b3', 'cadet3@test.local'), -- cadet
  ('00000000-0000-0000-0000-0000000000c3', 'other3@test.local'), -- another cadet
  ('00000000-0000-0000-0000-0000000000d3', 'out3@test.local');   -- outsider

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select public.create_team('צוות תצוגות', 'מפקד', 'בדיקה');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a3';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.join_team((select invite_code from t), null, 'צוער', 'בי');
insert into public.tasks (team_id, visibility, title) select team_id, 'private', 'פרטית של בי' from t;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select public.join_team((select invite_code from t), null, 'צוערת', 'סי');
insert into public.tasks (team_id, visibility, title) select team_id, 'private', 'פרטית של סי' from t;

select pg_temp.as_postgres();
insert into public.tasks (team_id, visibility, title) select team_id, 'team', 'משימת צוות' from t;
create temp table ids as select
  (select id from public.tasks where title = 'פרטית של בי') as b_private,
  (select id from public.tasks where title = 'פרטית של סי') as c_private,
  (select id from public.tasks where title = 'משימת צוות') as team_task;
grant select on ids to authenticated;

-- user_settings ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select lives_ok($$ insert into public.user_settings (task_layout) values ('board') $$, 'a user saves their layout');
select is((select user_id from public.user_settings), '00000000-0000-0000-0000-0000000000b3'::uuid, 'user_id defaults to the caller');
select throws_ok($$ insert into public.user_settings (user_id, task_layout)
  values ('00000000-0000-0000-0000-0000000000c3', 'days') $$, '42501', null, 'cannot write someone else''s settings');
select throws_ok($$ update public.user_settings set task_layout = 'grid' $$, '23514', null, 'only known layouts');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.user_settings), 0, 'settings are private to their user');
update public.user_settings set task_layout = 'days'; -- someone else's row: filtered
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select task_layout from public.user_settings), 'board', 'another user cannot change my layout');

-- task_lanes ----------------------------------------------------------------------
select lives_ok($$ insert into public.task_lanes (task_id, team_id, lane, position)
  select b_private, (select team_id from t), 'doing', 0 from ids $$, 'move my private task to in progress');
select lives_ok($$ insert into public.task_lanes (task_id, team_id, lane, position)
  select team_task, (select team_id from t), 'doing', 1 from ids $$, 'move a team task on my own board');
select throws_ok($$ insert into public.task_lanes (task_id, team_id, lane)
  select c_private, (select team_id from t), 'doing' from ids $$, '42501', null,
  'cannot place someone else''s private task (cannot see it)');
select throws_ok($$ update public.task_lanes set lane = 'done' $$, '23514', null, 'done is never stored as a lane');
select lives_ok($$ update public.task_lanes set position = 5 where task_id = (select team_task from ids) $$,
  'reorder my own cards');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.task_lanes), 0, 'lanes are private: a teammate sees none of mine');
delete from public.task_lanes; -- not theirs: filtered
select lives_ok($$ insert into public.task_lanes (task_id, team_id) select team_task, (select team_id from t) from ids $$,
  'each cadet keeps their own placement of the same team task');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.task_lanes), 2, 'my placements survive a teammate''s delete');

-- Outsider and cascade ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select throws_ok($$ insert into public.task_lanes (task_id, team_id) select team_task, (select team_id from t) from ids $$,
  '42501', null, 'an outsider cannot place a team task');

select pg_temp.as_postgres();
delete from public.tasks where id = (select team_task from ids);
select is((select count(*)::int from public.task_lanes where team_id = (select team_id from t)), 1,
  'deleting a task removes everyone''s placements of it');

select * from finish();
rollback;
