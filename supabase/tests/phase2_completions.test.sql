-- Per-cadet completion of team-wide tasks. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'cmd2@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'cadet2@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'cadet3@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'out2@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.create_team('צוות השלמות', 'מפקד', 'שני');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a2';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select public.join_team((select invite_code from t), null, 'צוער', 'ב');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select public.join_team((select invite_code from t), null, 'צוערת', 'ג');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into public.team_members (team_id, first_name) select team_id, 'בלי טלפון' from t;
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.name = 'א׳ צוות'
  and m.user_id = '00000000-0000-0000-0000-0000000000a2';
insert into public.tasks (team_id, visibility, title) select team_id, 'team', 'למלא משוב' from t;
insert into public.tasks (team_id, visibility, title, assignee_member_id)
select team_id, 'team', 'משימה אישית',
       (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b2')
from t;

select pg_temp.as_postgres();
create temp table ids as select
  (select id from public.tasks where team_id = (select team_id from t) and title = 'למלא משוב') as wide,
  (select id from public.tasks where team_id = (select team_id from t) and title = 'משימה אישית') as assigned,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b2') as b,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000c2') as c,
  (select id from public.team_members where team_id = (select team_id from t) and first_name = 'בלי טלפון') as nophone;
grant select on ids to authenticated;

-- Cadet B ------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ insert into public.task_completions (task_id, team_id, member_id)
  select wide, (select team_id from t), b from ids $$, 'a cadet marks their own part done');
select is((select done_by from public.task_completions where member_id = (select b from ids)),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'done_by is set by the database');
select throws_ok($$ insert into public.task_completions (task_id, team_id, member_id)
  select wide, (select team_id from t), c from ids $$, '42501', null, 'a cadet cannot mark someone else');
select throws_ok($$ insert into public.task_completions (task_id, team_id, member_id)
  select assigned, (select team_id from t), b from ids $$, '42501', null, 'assigned tasks do not take completions');

-- Cadet C ------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.task_completions), 1, 'teammates see who finished');
delete from public.task_completions where member_id = (select b from ids); -- not theirs: filtered
select is((select count(*)::int from public.task_completions), 1, 'a cadet cannot unmark someone else');

-- Command -------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ insert into public.task_completions (task_id, team_id, member_id)
  select wide, (select team_id from t), nophone from ids $$, 'command marks a cadet who has no phone');
select lives_ok($$ delete from public.task_completions where member_id = (select nophone from ids) $$,
  'command can unmark anyone');
select lives_ok($$ update public.tasks set status = 'done' where id = (select wide from ids) $$, 'command closes the task');

-- Closed task -----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$ insert into public.task_completions (task_id, team_id, member_id)
  select wide, (select team_id from t), c from ids $$, '42501', null, 'a closed task takes no more completions');

-- Outsider -------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from public.task_completions), 0, 'outsider sees no completions');

-- Anon -------------------------------------------------------------------------------
select pg_temp.as_postgres();
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.task_completions $$, '42501', null, 'anon has no access');

select * from finish();
rollback;
