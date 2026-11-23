-- Linking units without codes. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'boss8@test.local'),   -- battalion + company admin, admin of team 1
  ('00000000-0000-0000-0000-0000000000b8', 'tadmin8@test.local'), -- admin of team 2 only
  ('00000000-0000-0000-0000-0000000000c8', 'staff8@test.local');  -- battalion member, not admin

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select public.create_team('צוות 1', 'בוס', 'א');
select public.create_company('פלוגה ח', 'בוס');
select public.create_battalion('גדוד ב', 'בוס');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b8');
select public.create_team('צוות 2', 'אחראי', 'ב');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000a8') as t1,
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000b8') as t2,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000a8') as co,
  (select id from public.battalions where created_by = '00000000-0000-0000-0000-0000000000a8') as bat,
  (select invite_code from public.battalions where created_by = '00000000-0000-0000-0000-0000000000a8') as bat_code;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c8');
select public.join_battalion((select bat_code from f), 'סגל');

-- Teams into the company ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select lives_ok($$ select public.company_add_my_team((select co from f), (select t1 from f)) $$, 'an admin of both adds the team with one tap');
select throws_ok($$ select public.company_add_my_team((select co from f), (select t2 from f)) $$, '42501', null,
  'not without being the team''s admin too (that one needs its code)');
select lives_ok($$ select public.create_team_in_company((select co from f), 'צוות 3', 'בוס', 'א') $$, 'a company admin opens a team inside the company');
select pg_temp.as_postgres();
select is((select count(*)::int from public.teams where company_id = (select co from f)), 2, 'both teams are in the company');

-- Companies into the battalion ----------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c8');
select throws_ok($$ select public.battalion_add_my_company((select bat from f), (select co from f)) $$, '42501', null,
  'a battalion member who is not admin cannot add companies');
select throws_ok($$ select public.create_company_in_battalion((select bat from f), 'פלוגה ט', 'סגל') $$, '42501', null,
  'nor open companies in it');
select throws_ok($$ select public.battalion_structure((select bat from f)) $$, '42501', null, 'nor see the structure');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select lives_ok($$ select public.battalion_add_my_company((select bat from f), (select co from f)) $$, 'an admin of both adds the company with one tap');
select lives_ok($$ select public.create_company_in_battalion((select bat from f), 'פלוגה ט', 'בוס') $$, 'a battalion admin opens a company inside');
select is(jsonb_array_length(public.battalion_structure((select bat from f))), 2, 'the structure lists both companies');

-- Moving a team between companies of the battalion ---------------------------------------
select pg_temp.as_postgres();
create temp table g as select id as co2 from public.companies where name = 'פלוגה ט';
grant select on g to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select lives_ok($$ select public.battalion_move_team((select bat from f), (select t1 from f), (select co2 from g)) $$, 'the battalion admin moves a team');
select pg_temp.as_postgres();
select is((select company_id from public.teams where id = (select t1 from f)), (select co2 from g), 'the team is in the other company');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select throws_ok($$ select public.battalion_move_team((select bat from f), (select t2 from f), (select co2 from g)) $$, '23514', null,
  'a team outside the battalion cannot be moved in');
select ok(position('בוס' in public.battalion_structure((select bat from f))::text) = 0, 'the structure holds unit names only, no people');

select * from finish();
rollback;
