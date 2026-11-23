-- Editing roles and assignments in place: managers yes, cadets no. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'admin9@test.local'),
  ('00000000-0000-0000-0000-0000000000b9', 'cadet9@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
select public.create_team('צוות עריכה', 'אחראי', 'ע');
select public.create_company('פלוגה עריכה', 'אחראי');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000a9') as team_id,
  (select invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a9') as team_code,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000a9') as co_id;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
select public.join_team((select team_code from f), null, 'צוער', 'ט');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
  select r.team_id, r.id, m.id, private.today() + 1, private.today() + 1
  from public.team_roles r, public.team_members m
  where r.team_id = (select team_id from f) and m.team_id = r.team_id and m.user_id = '00000000-0000-0000-0000-0000000000b9' limit 1;
select pg_temp.as_postgres();
create temp table a as select id from public.role_assignments where team_id = (select team_id from f);
create temp table r as select id from public.team_roles where team_id = (select team_id from f) order by id limit 1;
grant select on a, r to authenticated;

-- Team: the admin edits, the cadet cannot ------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
update public.role_assignments set end_date = private.today() + 9 where id = (select id from a);
update public.team_roles set name = 'שונה' where id = (select id from r);
select pg_temp.as_postgres();
select is((select end_date from public.role_assignments where id = (select id from a)), private.today() + 1, 'a cadet cannot change assignment dates');
select isnt((select name from public.team_roles where id = (select id from r)), 'שונה', 'a cadet cannot rename a role');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
select lives_ok($$ update public.role_assignments set start_date = private.today() + 2, end_date = private.today() + 5 where id = (select id from a) $$,
  'the admin moves and extends an assignment');
select lives_ok($$ update public.team_roles set name = 'סמל תורן', is_command = false where id = (select id from r) $$,
  'the admin renames a role and changes its command flag');
select pg_temp.as_postgres();
select is((select end_date - start_date from public.role_assignments where id = (select id from a)), 3, 'the new dates are saved');
select is((select is_command from public.team_roles where id = (select id from r)), false, 'the command flag is saved');

-- Company: hand a role over from staff to a cadet of its team -----------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
select public.company_add_team((select co_id from f), (select team_code from f));
insert into public.company_role_assignments (company_id, role_id, member_id, start_date, end_date)
  select (select co_id from f), cr.id, cm.id, private.today(), private.today()
  from public.company_roles cr, public.company_members cm
  where cr.company_id = (select co_id from f) and cm.company_id = cr.company_id limit 1;
select lives_ok($$ update public.company_role_assignments
  set member_id = null, team_member_id = (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b9')
  where company_id = (select co_id from f) $$, 'a company role is handed from staff to a cadet');
select throws_ok($$ update public.company_role_assignments set member_id = null, team_member_id = null
  where company_id = (select co_id from f) $$, '23514', null, 'an edit still needs exactly one person');

select * from finish();
rollback;
