-- Battalions: staff-only, top-down, counts-only dashboard. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'batadmin@test.local'),  -- battalion admin
  ('00000000-0000-0000-0000-0000000000f2', 'batstaff@test.local'),  -- battalion member
  ('00000000-0000-0000-0000-0000000000f3', 'coadmin@test.local'),   -- company admin + team admin
  ('00000000-0000-0000-0000-0000000000f4', 'cadet@test.local');     -- cadet in the team

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- A team in a company, with a roll call today
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select public.create_team('צוות גדוד', 'מפקד', 'צוות');
select public.create_company('פלוגה ה', 'אחראי פלוגה');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000f3') as team_id,
  (select invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000f3') as team_code,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000f3') as co_id,
  (select invite_code from public.companies where created_by = '00000000-0000-0000-0000-0000000000f3') as co_code;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select public.company_add_team((select co_id from f), (select team_code from f));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select public.join_team((select team_code from f), null, 'צוערת', 'א');
select pg_temp.as_postgres();
insert into public.attendance_sessions (team_id, label) select team_id, 'בוקר' from f;
insert into public.attendance_entries (session_id, team_id, member_id, status, reason)
  select s.id, s.team_id, m.id, case when m.user_id = '00000000-0000-0000-0000-0000000000f4' then 'absent' else 'present' end,
         case when m.user_id = '00000000-0000-0000-0000-0000000000f4' then 'סיבה פרטית' end
  from public.attendance_sessions s join public.team_members m on m.team_id = s.team_id
  where s.team_id = (select team_id from f);

-- Battalion --------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select public.create_battalion('גדוד א', 'מג"ד') $$, 'anyone signed in can open a battalion');
select pg_temp.as_postgres();
create temp table b as select id as bat_id, invite_code as bat_code from public.battalions
  where created_by = '00000000-0000-0000-0000-0000000000f1';
grant select on b to authenticated;
select isnt((select bat_code from b), (select team_code from f), 'codes are unique across units');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select is((public.preview_battalion(lower((select bat_code from b))))->>'battalion_name', 'גדוד א', 'the code previews the battalion');
select lives_ok($$ select public.join_battalion((select bat_code from b), 'קצין גדודי') $$, 'staff join with the battalion code');
select throws_ok($$ select public.battalion_add_company((select bat_id from b), (select co_code from f)) $$, '42501', null,
  'a battalion member who is not admin cannot add companies');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select throws_ok($$ update public.companies set battalion_id = (select bat_id from b) where id = (select co_id from f) $$, '42501', null,
  'a company admin cannot attach the company to a battalion directly');
select is((select count(*)::int from public.battalions), 0, 'a company admin does not see the battalion');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.battalion_add_company((select bat_id from b), 'ZZZZZZZZ') $$, 'P0002', null, 'a wrong company code is refused');
select is((public.battalion_add_company((select bat_id from b), (select co_code from f)))->>'company_name', 'פלוגה ה',
  'the battalion admin adds the company with its staff code');

-- Dashboard: counts only --------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select is((public.battalion_dashboard((select bat_id from b)))->0->>'teams', '1', 'the dashboard counts the company''s teams');
select is((public.battalion_dashboard((select bat_id from b)))->0->>'absent', '1', 'and today''s roll-call totals');
select ok(position('צוערת' in public.battalion_dashboard((select bat_id from b))::text) = 0
          and position('סיבה' in public.battalion_dashboard((select bat_id from b))::text) = 0,
  'no names or reasons reach the battalion');
select is((select count(*)::int from public.team_members where team_id = (select team_id from f)), 0,
  'battalion membership opens no team tables');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select throws_ok($$ select public.battalion_dashboard((select bat_id from b)) $$, '42501', null, 'a cadet cannot see the battalion dashboard');

-- Detach ----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select lives_ok($$ select public.company_leave_battalion((select co_id from f)) $$, 'the company admin can detach the company');
select pg_temp.as_postgres();
select is((select battalion_id from public.companies where id = (select co_id from f)), null::bigint, 'the company left the battalion');

select * from finish();
rollback;
