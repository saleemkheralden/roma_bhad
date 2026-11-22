-- Companies add and remove their teams (top-down). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'coadmin@test.local'),   -- company admin
  ('00000000-0000-0000-0000-0000000000e2', 'costaff@test.local'),   -- company member, not admin
  ('00000000-0000-0000-0000-0000000000e3', 'teamadmin@test.local'), -- admin of the team
  ('00000000-0000-0000-0000-0000000000e4', 'other@test.local');     -- admin of another company

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select public.create_team('צוות למעלה', 'אחראי', 'צוות');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_company('פלוגה ג', 'אחראית פלוגה');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select public.create_company('פלוגה ד', 'אחראי אחר');
select pg_temp.as_postgres();
create temp table f as select
  (select id from public.teams where created_by = '00000000-0000-0000-0000-0000000000e3') as team_id,
  (select invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000e3') as team_code,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000e1') as co_id,
  (select invite_code from public.companies where created_by = '00000000-0000-0000-0000-0000000000e1') as co_code,
  (select id from public.companies where created_by = '00000000-0000-0000-0000-0000000000e4') as other_id;
grant select on f to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select public.join_company((select co_code from f), 'סגל');

-- A team can't attach itself any more --------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select public.link_team_to_company((select team_id from f), (select co_code from f)) $$, '42501', null,
  'a team admin can no longer link the team to a company');

-- Only the company admin adds ------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select public.company_add_team((select co_id from f), (select team_code from f)) $$, '42501', null,
  'a company member who is not admin cannot add teams');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select public.company_add_team((select co_id from f), 'ZZZZZZZZ') $$, 'P0002', null, 'a wrong team code is refused');
select is((public.company_add_team((select co_id from f), lower((select team_code from f))))->>'team_name', 'צוות למעלה',
  'the company admin adds the team with its code (any case)');
select pg_temp.as_postgres();
select is((select company_id from public.teams where id = (select team_id from f)), (select co_id from f), 'the team is in the company');

-- Another company can't take it -----------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select throws_ok($$ select public.company_add_team((select other_id from f), (select team_code from f)) $$, '23505', null,
  'a team already in a company cannot be added to another');
select lives_ok($$ select public.company_remove_team((select other_id from f), (select team_id from f)) $$, 'removing it from a company it is not in does nothing');
select pg_temp.as_postgres();
select is((select company_id from public.teams where id = (select team_id from f)), (select co_id from f), 'the team stayed in its company');

-- The team admin can still detach; the company admin can remove ----------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select lives_ok($$ select public.link_team_to_company((select team_id from f), null) $$, 'the team admin can detach the team');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.company_add_team((select co_id from f), (select team_code from f));
select public.company_remove_team((select co_id from f), (select team_id from f));
select pg_temp.as_postgres();
select is((select company_id from public.teams where id = (select team_id from f)), null::bigint, 'the company admin removes the team');

select * from finish();
rollback;
