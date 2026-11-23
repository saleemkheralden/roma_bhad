-- Personal checklist ticks on team-wide tasks: each cadet ticks their own steps.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'pt-cmd@test.local'),
  ('00000000-0000-0000-0000-0000000001b1', 'pt-cadet1@test.local'),
  ('00000000-0000-0000-0000-0000000001c1', 'pt-cadet2@test.local'),
  ('00000000-0000-0000-0000-0000000001d1', 'pt-out@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
select public.create_team('צוות סימונים', 'מפקד', 'א');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000001a1';
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000001b1');
select public.join_team((select invite_code from t), null, 'צוער', 'אחד');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c1');
select public.join_team((select invite_code from t), null, 'צוערת', 'שתיים');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001d1');
select public.create_team('צוות אחר', 'זר', 'ז');

-- Command (role today) makes a team-wide task with two steps, and an assigned one with a step.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.name = 'א׳ צוות' and m.user_id = '00000000-0000-0000-0000-0000000001a1';
insert into public.tasks (team_id, visibility, title) select team_id, 'team', 'לקרוא חוברת' from t;
insert into public.tasks (team_id, visibility, title, assignee_member_id)
  select team_id, 'team', 'משימה משובצת',
         (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000001b1') from t;
select pg_temp.as_postgres();
create temp table ids as select
  (select id from public.tasks where team_id = (select team_id from t) and title = 'לקרוא חוברת') as wide,
  (select id from public.tasks where team_id = (select team_id from t) and title = 'משימה משובצת') as assigned,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000001a1') as m_cmd,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000001b1') as m1,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000001c1') as m2,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000001d1') as m_out;
grant select on ids to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
insert into public.task_checklist_items (task_id, team_id, text, position)
  select wide, (select team_id from t), x.text, x.pos from ids, (values ('פרק 1', 1), ('פרק 2', 2)) as x(text, pos);
insert into public.task_checklist_items (task_id, team_id, text, position)
  select assigned, (select team_id from t), 'שלב', 1 from ids;
select pg_temp.as_postgres();
create temp table steps as select
  (select id from public.task_checklist_items where task_id = (select wide from ids) and position = 1) as s1,
  (select id from public.task_checklist_items where task_id = (select wide from ids) and position = 2) as s2,
  (select id from public.task_checklist_items where task_id = (select assigned from ids)) as sa;
grant select on steps to authenticated;

-- Cadet 1 ticks step 1 for themselves.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001b1');
select lives_ok($$ insert into public.task_checklist_ticks (item_id, member_id, team_id)
                   select s1, (select m1 from ids), (select team_id from t) from steps $$,
  'a cadet ticks a step of a team-wide task for themselves');
select throws_ok($$ insert into public.task_checklist_ticks (item_id, member_id, team_id)
                    select s2, (select m2 from ids), (select team_id from t) from steps $$,
  '42501', null, 'but not for another cadet');
select throws_ok($$ insert into public.task_checklist_ticks (item_id, member_id, team_id)
                    select sa, (select m1 from ids), (select team_id from t) from steps $$,
  '42501', null, 'assigned tasks keep the shared tick (no personal ticks)');
select is((select count(*)::int from public.task_checklist_ticks), 1, 'the cadet sees their own tick');

-- Cadet 2 sees none of it: their steps are still open.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001c1');
select is((select count(*)::int from public.task_checklist_ticks), 0, 'another cadet does not see someone else''s ticks');
select is((select count(*)::int from public.task_checklist_items where task_id = (select wide from ids) and done), 0,
  'the step is not ticked for everybody');

-- Command: own ticks too, and no shared tick on a team-wide task any more.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
select is((select count(*)::int from public.task_checklist_ticks), 0, 'command does not read cadets'' ticks either');
select throws_ok($$ update public.task_checklist_items set done = true where id = (select s1 from steps) $$,
  '42501', null, 'nobody ticks a team-wide step for the whole team');
select lives_ok($$ insert into public.task_checklist_ticks (item_id, member_id, team_id)
                   select s2, (select m_cmd from ids), (select team_id from t) from steps $$,
  'command ticks their own copy');

-- An outsider can't tick; closing the task freezes ticks.
select pg_temp.as_user('00000000-0000-0000-0000-0000000001d1');
select throws_ok($$ insert into public.task_checklist_ticks (item_id, member_id, team_id)
                    select s1, (select m_out from ids), (select team_id from t) from steps $$,
  '42501', null, 'someone from another team cannot tick');
select pg_temp.as_user('00000000-0000-0000-0000-0000000001a1');
update public.tasks set status = 'done' where id = (select wide from ids);
select pg_temp.as_user('00000000-0000-0000-0000-0000000001b1');
delete from public.task_checklist_ticks where item_id = (select s1 from steps);
select is((select count(*)::int from public.task_checklist_ticks), 1, 'a closed task''s ticks stay as they were');

-- Removing a step removes its ticks.
select pg_temp.as_postgres();
delete from public.task_checklist_items where id = (select s1 from steps);
select is((select count(*)::int from public.task_checklist_ticks where item_id = (select s1 from steps)), 0,
  'deleting a step deletes its ticks');

select * from finish();
rollback;
