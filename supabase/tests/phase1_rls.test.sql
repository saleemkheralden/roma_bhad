-- RLS and RPC tests for the Phase 1 schema. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Test users ----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),  -- creates the team (admin)
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),  -- joins as a new member
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),  -- claims a roster name
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local');  -- outsider

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- A creates a team ------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.create_team('צוות 1', 'אבי', 'כהן') $$, 'A can create a team');
select is((select count(*)::int from public.teams), 1, 'A sees their team');
select is((select is_admin from public.team_members where user_id = auth.uid()), true, 'creator is admin');
select is((select count(*)::int from public.team_roles), 4, 'default roles were created');
select is((select count(*)::int from public.team_roles where name = 'קל״ג'), 1, 'default roles include קל״ג');

-- A adds an unclaimed roster entry
select lives_ok($$ insert into public.team_members (team_id, first_name, last_name)
                   select id, 'דנה', 'לוי' from public.teams $$, 'admin can add roster names');

-- Admin alone is not command: cannot take roll call without a role today
select throws_ok($$ insert into public.attendance_sessions (team_id) select id from public.teams $$,
                 '42501', null, 'admin without a role today cannot take roll call');

-- Remember the invite code for the others
select pg_temp.as_postgres();
create temp table ctx as select id as team_id, invite_code from public.teams
  where created_by = '00000000-0000-0000-0000-00000000000a';
grant select on ctx to authenticated;

-- Outsider D -------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.teams), 0, 'outsider sees no teams');
select is((select count(*)::int from public.team_members), 0, 'outsider sees no roster');
select throws_ok($$ insert into public.links (team_id, title, url) select team_id, 'x', 'https://x.test' from ctx $$,
                 '42501', null, 'outsider cannot add links');

-- B joins as a new member --------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select (public.preview_team((select invite_code from ctx)) ->> 'team_name')), 'צוות 1',
          'preview shows the team name');
select is((select jsonb_array_length(public.preview_team((select invite_code from ctx)) -> 'unclaimed')), 1,
          'preview lists unclaimed roster names');
select lives_ok($$ select public.join_team((select invite_code from ctx), null, 'בני', 'גל') $$, 'B can join with the code');
select is((select count(*)::int from public.team_members), 3, 'B now sees the roster');
update public.team_members set is_admin = true where user_id = auth.uid();  -- filtered out by RLS
select is((select is_admin from public.team_members where user_id = auth.uid()), false,
          'B (no role) cannot make themselves admin');
select throws_ok($$ insert into public.attendance_sessions (team_id) select team_id from ctx $$,
                 '42501', null, 'B without a role cannot take roll call');

-- C claims the unclaimed name; D can't claim it again --------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select public.join_team((select invite_code from ctx),
                   (select (public.preview_team((select invite_code from ctx)) -> 'unclaimed' -> 0 ->> 'id')::bigint)) $$,
                 'C claims the roster name');
select is((select first_name from public.team_members where user_id = auth.uid()), 'דנה', 'C is linked to דנה');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.join_team((select invite_code from ctx),
                   (select id from public.team_members where first_name = 'דנה' limit 1)) $$,
                 null, null, 'a claimed name cannot be claimed twice');

-- A assigns B a command role for today -------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.name = 'א׳ צוות' and m.first_name = 'בני';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ insert into public.attendance_sessions (team_id, label) select team_id, 'בוקר' from ctx $$,
                'B with a role today can take roll call');
select lives_ok($$ insert into public.attendance_entries (session_id, team_id, member_id, status)
                   select s.id, s.team_id, m.id, 'present'
                   from public.attendance_sessions s, public.team_members m $$,
                'B can record attendance for the roster');
select throws_ok($$ update public.team_members set is_admin = true where user_id = auth.uid() $$,
                 '42501', null, 'even with a role, B cannot make themselves admin');

-- A role that ended yesterday gives no command ------------------------------------------
select pg_temp.as_postgres();
update public.role_assignments set start_date = private.today() - 2, end_date = private.today() - 1
  where team_id = (select team_id from ctx);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ insert into public.attendance_sessions (team_id) select team_id from ctx $$,
                 '42501', null, 'an expired role gives no command');

-- The last admin cannot demote themselves --------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.team_members set is_admin = false where user_id = auth.uid() $$,
                 '23514', null, 'a team keeps at least one admin');

-- Anonymous users get nothing ------------------------------------------------------------
select pg_temp.as_postgres();
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.teams $$, '42501', null, 'anon has no access to tables');

select * from finish();
rollback;
