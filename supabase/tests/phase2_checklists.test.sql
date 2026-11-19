-- Task checklists (issue #2). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'cmd3@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'cadet4@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'cadet5@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'out3@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select public.create_team('צוות צ׳קליסט', 'מפקד', 'שלישי');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a3';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.join_team((select invite_code from t), null, 'צוער', 'ד');
insert into public.tasks (team_id, visibility, title) select team_id, 'private', 'משימה פרטית' from t;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select public.join_team((select invite_code from t), null, 'צוערת', 'ה');

-- A holds a command role today and creates an assigned and a team-wide task.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.name = 'א׳ צוות'
  and m.user_id = '00000000-0000-0000-0000-0000000000a3';
insert into public.tasks (team_id, visibility, title, assignee_member_id)
select team_id, 'team', 'להכין מצגת',
       (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b3')
from t;
insert into public.tasks (team_id, visibility, title) select team_id, 'team', 'למלא משוב' from t;

select pg_temp.as_postgres();
create temp table ids as select
  (select id from public.tasks where team_id = (select team_id from t) and title = 'להכין מצגת') as assigned,
  (select id from public.tasks where team_id = (select team_id from t) and title = 'למלא משוב') as wide,
  (select id from public.tasks where team_id = (select team_id from t) and title = 'משימה פרטית') as priv;
grant select on ids to authenticated;

-- Command ------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ insert into public.task_checklist_items (task_id, team_id, text, position)
  select assigned, (select team_id from t), x.text, x.pos from ids,
  (values ('לאסוף חומרים', 1), ('לכתוב שקפים', 2), ('חזרה', 3)) as x(text, pos) $$,
  'command adds steps to a team task');
select lives_ok($$ insert into public.task_checklist_items (task_id, team_id, text, position)
  select wide, (select team_id from t), 'לקרוא את ההנחיות', 1 from ids $$,
  'command adds steps to a team-wide task');
select is((select created_by from public.task_checklist_items where text = 'חזרה'),
  '00000000-0000-0000-0000-0000000000a3'::uuid, 'created_by is set by the database');
select throws_ok($$ insert into public.task_checklist_items (task_id, team_id, text)
  select priv, (select team_id from t), 'לא שלי' from ids $$,
  '42501', null, 'command cannot add steps to someone''s private task');
select is((select count(*)::int from public.task_checklist_items where task_id = (select priv from ids)), 0,
  'command does not see private steps');

-- Assignee B ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.task_checklist_items where team_id = (select team_id from t)), 4,
  'a cadet reads team task steps');
select lives_ok($$ update public.task_checklist_items set done = true where text = 'לאסוף חומרים' $$,
  'the assignee ticks a step');
select is((select done_by from public.task_checklist_items where text = 'לאסוף חומרים'),
  '00000000-0000-0000-0000-0000000000b3'::uuid, 'done_by is set by the database');
select throws_ok($$ update public.task_checklist_items set text = 'שונה' where text = 'לכתוב שקפים' $$,
  '42501', null, 'the assignee cannot rename a step');
select throws_ok($$ insert into public.task_checklist_items (task_id, team_id, text)
  select assigned, (select team_id from t), 'עוד שלב' from ids $$,
  '42501', null, 'the assignee cannot add steps');
delete from public.task_checklist_items where text = 'חזרה'; -- not an editor: filtered
select is((select count(*)::int from public.task_checklist_items where task_id = (select assigned from ids)), 3,
  'the assignee cannot remove steps');
select lives_ok($$ insert into public.task_checklist_items (task_id, team_id, text, position)
  select priv, (select team_id from t), 'שלב פרטי', 1 from ids $$, 'the owner adds steps to a private task');

-- Cadet C (not the assignee) --------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
update public.task_checklist_items set done = true where text in ('לכתוב שקפים', 'לקרוא את ההנחיות'); -- filtered
select is((select count(*)::int from public.task_checklist_items where team_id = (select team_id from t) and done), 1,
  'a cadet cannot tick steps of someone else''s task or a team-wide task');
select is((select count(*)::int from public.task_checklist_items where task_id = (select priv from ids)), 0,
  'a teammate does not see private steps');

-- Limit and closed tasks ------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ insert into public.task_checklist_items (task_id, team_id, text)
  select assigned, (select team_id from t), 'שלב ' || n from ids, generate_series(1, 18) n $$,
  '23514', null, 'a task has at most 20 steps');
update public.tasks set status = 'done' where id = (select assigned from ids);
select throws_ok($$ insert into public.task_checklist_items (task_id, team_id, text)
  select assigned, (select team_id from t), 'מאוחר' from ids $$,
  '42501', null, 'a closed task takes no new steps');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
update public.task_checklist_items set done = true where text = 'לכתוב שקפים'; -- closed: filtered
select is((select done from public.task_checklist_items where text = 'לכתוב שקפים'), false,
  'steps of a closed task cannot be ticked');

-- Outsider, anon, cascade ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select is((select count(*)::int from public.task_checklist_items), 0, 'outsider sees no steps');

select pg_temp.as_postgres();
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.task_checklist_items $$, '42501', null, 'anon has no access');

select pg_temp.as_postgres();
delete from public.tasks where id = (select wide from ids);
select is((select count(*)::int from public.task_checklist_items where task_id = (select wide from ids)), 0,
  'deleting a task deletes its steps');

select * from finish();
rollback;
