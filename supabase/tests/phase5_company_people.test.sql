-- The company's people come from its teams. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'coadmin7@test.local'), -- company admin + team admin
  ('00000000-0000-0000-0000-0000000000b7', 'cadetA7@test.local'),  -- cadet who gets a company role
  ('00000000-0000-0000-0000-0000000000c7', 'cadetB7@test.local'),  -- cadet with no company role
  ('00000000-0000-0000-0000-0000000000d7', 'other7@test.local');   -- admin of a team outside the company

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select public.create_team('צוות פ1', 'מפקד', 'א');
select public.create_company('פלוגה ז', 'אחראי');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d7');
select public.create_team('צוות בחוץ', 'אחר', 'ב');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000a7') as team_id,
  (select invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a7') as team_code,
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000d7') as out_team_id,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000a7') as co_id;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
select public.join_team((select team_code from f), null, 'רוני', 'כהן');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
select public.join_team((select team_code from f), null, 'דנה', 'לוי');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select public.company_add_team((select co_id from f), (select team_code from f));

-- People come from the teams ------------------------------------------------------------
select is(jsonb_array_length(public.company_people((select co_id from f))), 3, 'the company lists the cadets of its teams');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
select throws_ok($$ select public.company_dashboard((select co_id from f)) $$, '42501', null, 'a cadet without a company role has no dashboard');

-- The admin gives a cadet a company command role today ------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select lives_ok($$ insert into public.company_role_assignments (company_id, role_id, team_member_id, start_date, end_date)
  select (select co_id from f), r.id, m.id, private.today(), private.today()
  from public.company_roles r, public.team_members m
  where r.company_id = (select co_id from f) and r.is_command
    and m.user_id = '00000000-0000-0000-0000-0000000000b7' limit 1 $$, 'a company role goes to a cadet of one of its teams');
select pg_temp.as_postgres();
select throws_ok($$ insert into public.company_role_assignments (company_id, role_id, team_member_id, start_date, end_date)
  select (select co_id from f), r.id, m.id, private.today(), private.today()
  from public.company_roles r, public.team_members m
  where r.company_id = (select co_id from f) and m.team_id = (select out_team_id from f) limit 1 $$, '23514', null,
  'a cadet from a team outside the company cannot get a company role');
select throws_ok($$ insert into public.company_role_assignments (company_id, role_id, start_date, end_date)
  select (select co_id from f), r.id, private.today(), private.today()
  from public.company_roles r where r.company_id = (select co_id from f) limit 1 $$, '23514', null,
  'an assignment needs exactly one person');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
select is((select count(*)::int from public.companies where id = (select co_id from f)), 1, 'the role-holder sees the company');
select lives_ok($$ select public.company_dashboard((select co_id from f)) $$, 'and its dashboard');
select lives_ok($$ insert into public.company_roles (company_id, name) select co_id, 'תפקיד חדש' from f $$, 'a command role today lets them manage the company');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
select is((select count(*)::int from public.companies where id = (select co_id from f)), 0, 'another cadet still does not see the company');
select throws_ok($$ select public.company_people((select co_id from f)) $$, '42501', null, 'nor its people list');

-- The team leaves the company: its cadets' company roles go --------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select public.company_remove_team((select co_id from f), (select team_id from f));
select pg_temp.as_postgres();
select is((select count(*)::int from public.company_role_assignments where company_id = (select co_id from f) and team_member_id is not null), 0,
  'company roles of the team''s cadets are removed with the team');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
select is((select count(*)::int from public.companies where id = (select co_id from f)), 0, 'and the cadet no longer sees the company');

select * from finish();
rollback;
