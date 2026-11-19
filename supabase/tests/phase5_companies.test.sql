-- Company level: membership, team linking, dashboard access. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'coadmin@test.local'),  -- team admin who creates the company
  ('00000000-0000-0000-0000-0000000000b6', 'pluga@test.local'),    -- joins the company (א׳ פלוגה)
  ('00000000-0000-0000-0000-0000000000c6', 'cadet6@test.local'),   -- team member, not company
  ('00000000-0000-0000-0000-0000000000d6', 'other6@test.local');   -- admin of another team

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- A: team + company ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select public.create_team('צוות פלוגתי', 'אחראי', 'א');
select pg_temp.as_postgres();
create temp table t as select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a6';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select lives_ok($$ select public.create_company('פלוגה ב', 'אחראי פלוגה', (select team_id from t)) $$, 'team admin creates a company and links the team');
select pg_temp.as_postgres();
create temp table co as select id as company_id, invite_code from public.companies where created_by = '00000000-0000-0000-0000-0000000000a6';
grant select on co to authenticated;
select is((select company_id from public.teams where id = (select team_id from t)), (select company_id from co), 'the team is linked');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select is((select count(*)::int from public.company_roles where company_id = (select company_id from co)), 2, 'default company roles');
select throws_ok($$ update public.teams set company_id = null where id = (select team_id from t) $$, '42501', null,
  'company_id changes only through the RPC');

-- C: team member only ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c6');
select public.join_team((select invite_code from t), null, 'צוער', 'ג');
select is((select count(*)::int from public.companies), 0, 'a team member does not see the company');
select throws_ok($$ select public.company_dashboard((select company_id from co)) $$, '42501', null, 'nor its dashboard');
select throws_ok($$ select public.link_team_to_company((select team_id from t), null) $$, '42501', null,
  'a non-admin cannot unlink the team');

-- B: joins the company with its code --------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
select is((public.preview_company((select invite_code from co)) ->> 'company_name'), 'פלוגה ב', 'preview by code');
select lives_ok($$ select public.join_company((select invite_code from co), 'א׳ פלוגה') $$, 'B joins the company');
select is((select jsonb_array_length(public.company_dashboard((select company_id from co)))), 1, 'B sees the company''s team on the dashboard');
select is((select count(*)::int from public.team_members), 0, 'company membership does not open the team''s roster table');
update public.company_members set is_admin = true where user_id = auth.uid(); -- filtered by RLS
select is((select is_admin from public.company_members where user_id = auth.uid()), false, 'B cannot make themselves company admin');
select throws_ok($$ insert into public.company_roles (company_id, name) select company_id, 'x' from co $$, '42501', null,
  'B (no role) cannot add company roles');

-- A gives B a company command role today -> B can manage roles ------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
insert into public.company_role_assignments (company_id, role_id, member_id, start_date, end_date)
select c.company_id, r.id, m.id, private.today(), private.today()
from co c join public.company_roles r on r.company_id = c.company_id and r.name = 'א׳ פלוגה'
join public.company_members m on m.company_id = c.company_id and m.user_id = '00000000-0000-0000-0000-0000000000b6';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
select lives_ok($$ insert into public.company_roles (company_id, name) select company_id, 'קמב״צ פלוגתי' from co $$,
  'today''s א׳ פלוגה manages company roles');
select throws_ok($$ update public.company_members set is_admin = true where user_id = auth.uid() $$, '42501', null,
  'even with a company role, B cannot make themselves admin');

-- D: admin of another team cannot link it without... the code works, but not someone else's team
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d6');
select public.create_team('צוות אחר', 'ד', '');
select throws_ok($$ select public.link_team_to_company((select team_id from t), (select invite_code from co)) $$, '42501', null,
  'cannot link a team you do not administer');

-- Last admin cannot leave --------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select throws_ok($$ delete from public.company_members where user_id = auth.uid() $$, '23514', null,
  'a company keeps at least one admin');

select * from finish();
rollback;
