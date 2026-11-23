-- Battalion roles: staff or cadets of the battalion, rotating, managed by admins or today's command holder.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'br-admin@test.local'),   -- battalion admin (+ company + team admin)
  ('00000000-0000-0000-0000-0000000000e2', 'br-staff@test.local'),   -- battalion staff, not admin
  ('00000000-0000-0000-0000-0000000000e3', 'br-cadet@test.local'),   -- cadet in the battalion
  ('00000000-0000-0000-0000-0000000000e4', 'br-other@test.local'),   -- cadet of a team outside the battalion
  ('00000000-0000-0000-0000-0000000000e5', 'br-cadet2@test.local');  -- another cadet in the battalion

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Battalion > company > two teams (one moves later); one outside team.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_battalion('גדוד ת', 'מג"ד');
select pg_temp.as_postgres();
create temp table b as select id as bat_id, invite_code as bat_code from public.battalions
  where created_by = '00000000-0000-0000-0000-0000000000e1';
grant select on b to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_company_in_battalion((select bat_id from b), 'פלוגה ת', 'מ"פ');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.companies where battalion_id = (select bat_id from b)) as co_id;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_team_in_company((select co_id from f), 'צוות ת1', 'מפקד', 'א');
select public.create_team_in_company((select co_id from f), 'צוות ת2', 'מפקד', 'ב');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select public.create_team('צוות חיצוני', 'זר', 'ז');
select pg_temp.as_postgres();
create temp table t as select
  (select id from public.teams where name = 'צוות ת1' and company_id = (select co_id from f)) as t1,
  (select id from public.teams where name = 'צוות ת2' and company_id = (select co_id from f)) as t2,
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000e4') as t_out;
-- Roster: cadets e3 (team 1) and e5 (team 2), claimed directly.
insert into public.team_members (team_id, first_name, last_name, user_id)
  values ((select t1 from t), 'צוערת', 'ראשונה', '00000000-0000-0000-0000-0000000000e3'),
         ((select t2 from t), 'צוער', 'שני', '00000000-0000-0000-0000-0000000000e5');
insert into public.battalion_members (battalion_id, user_id, display_name)
  values ((select bat_id from b), '00000000-0000-0000-0000-0000000000e2', 'קצין');
create temp table p as select
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000e3') as cadet,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000e5') as cadet2,
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000e4') as outsider,
  (select id from public.battalion_members where user_id = '00000000-0000-0000-0000-0000000000e2') as staff;
grant select on t, p to authenticated;

-- Roles ---------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into public.battalion_roles (battalion_id, name) values ((select bat_id from b), 'א׳ גדוד') $$,
  'the battalion admin adds a role');
select pg_temp.as_postgres();
create temp table r as select id as role_id from public.battalion_roles where battalion_id = (select bat_id from b);
grant select on r to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ insert into public.battalion_roles (battalion_id, name) values ((select bat_id from b), 'סמל גדוד') $$,
  '42501', null, 'staff who are not admin and hold no command role cannot add roles');
select is((select count(*)::int from public.battalion_roles where battalion_id = (select bat_id from b)), 1,
  'battalion staff read the roles');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select is((select count(*)::int from public.battalion_roles where battalion_id = (select bat_id from b)), 0,
  'a cadet without a battalion role sees nothing');
select throws_ok($$ select public.battalion_dashboard((select bat_id from b)) $$, '42501', null,
  'nor the dashboard');

-- Assignments ------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select is(jsonb_array_length(public.battalion_people((select bat_id from b))), 4,
  'managers see every cadet of the battalion in the picker (2 commanders + 2 cadets), not outsiders');
select throws_ok($$ insert into public.battalion_role_assignments (battalion_id, role_id, team_member_id, start_date, end_date)
                    values ((select bat_id from b), (select role_id from r), (select outsider from p), private.today(), private.today()) $$,
  '23514', null, 'a cadet outside the battalion cannot get a battalion role');
select throws_ok($$ insert into public.battalion_role_assignments (battalion_id, role_id, member_id, team_member_id, start_date, end_date)
                    values ((select bat_id from b), (select role_id from r), (select staff from p), (select cadet from p), private.today(), private.today()) $$,
  '23514', null, 'an assignment names exactly one person');
select lives_ok($$ insert into public.battalion_role_assignments (battalion_id, role_id, team_member_id, start_date, end_date)
                   values ((select bat_id from b), (select role_id from r), (select cadet from p), private.today(), private.today()) $$,
  'the admin gives a cadet a battalion role for today');
select lives_ok($$ insert into public.battalion_role_assignments (battalion_id, role_id, member_id, start_date, end_date)
                   values ((select bat_id from b), (select role_id from r), (select staff from p), private.today() + 1, private.today() + 1) $$,
  'and a staff member one for tomorrow');

-- The cadet on duty today ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select is((select count(*)::int from public.battalions where id = (select bat_id from b)), 1,
  'a cadet with a battalion role sees the battalion');
select lives_ok($$ select public.battalion_dashboard((select bat_id from b)) $$, 'and its counts-only dashboard');
select lives_ok($$ insert into public.battalion_roles (battalion_id, name) values ((select bat_id from b), 'סמל גדוד') $$,
  'a command role today lets the cadet manage battalion roles');
select throws_ok($$ select public.battalion_add_company((select bat_id from b), 'ZZZZZZZZ') $$, '42501', null,
  'but not the battalion''s structure (admins only)');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select is(jsonb_array_length(public.battalion_people((select bat_id from b))), 1,
  'non-managers only get the names of cadets who hold a battalion role');

-- Leaving the battalion drops cadet roles --------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into public.battalion_role_assignments (battalion_id, role_id, team_member_id, start_date, end_date)
                   values ((select bat_id from b), (select role_id from r), (select cadet2 from p), private.today() + 2, private.today() + 2) $$,
  'a role for a cadet of team 2');
select public.company_remove_team((select co_id from f), (select t2 from t));
select pg_temp.as_postgres();
select is((select count(*)::int from public.battalion_role_assignments where team_member_id = (select cadet2 from p)), 0,
  'when the team leaves, its cadets'' battalion roles go');
update public.companies set battalion_id = null where id = (select co_id from f);
select is((select count(*)::int from public.battalion_role_assignments where battalion_id = (select bat_id from b)), 1,
  'when the company leaves, its cadets'' roles go and staff roles stay');

select * from finish();
rollback;
