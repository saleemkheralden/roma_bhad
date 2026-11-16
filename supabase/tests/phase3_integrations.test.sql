-- Integrations (calendar IDs). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'admin3@test.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'cadet4@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'out3@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select public.create_team('צוות יומן', 'אחראית', 'יומן');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a3';
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.join_team((select invite_code from t), null, 'צוער', 'ד');

-- Admin (manager) -------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$ insert into public.integrations (team_id, kind, external_id, created_by)
  select team_id, 'gcal', 'course@group.calendar.google.com', auth.uid() from t $$, 'admin connects a calendar');
select lives_ok($$ insert into public.integrations (team_id, kind, external_id, created_by)
  select team_id, 'gcal', 'b@group.calendar.google.com', auth.uid() from t $$, 'a second calendar');
select lives_ok($$ insert into public.integrations (team_id, kind, external_id, created_by)
  select team_id, 'gcal', 'c@group.calendar.google.com', auth.uid() from t $$, 'a third calendar');
select throws_ok($$ insert into public.integrations (team_id, kind, external_id, created_by)
  select team_id, 'gcal', 'd@group.calendar.google.com', auth.uid() from t $$, '23514', null, 'no more than 3 calendars');

-- Cadet --------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.integrations), 3, 'cadets see the team calendars');
select throws_ok($$ insert into public.integrations (team_id, kind, external_id, created_by)
  select team_id, 'gsheet', 'sheet-id-not-capped', auth.uid() from t $$, '42501', null, 'a cadet cannot connect integrations');
delete from public.integrations; -- filtered by RLS
select is((select count(*)::int from public.integrations), 3, 'a cadet cannot remove calendars');

-- Outsider -----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
select is((select count(*)::int from public.integrations), 0, 'outsider sees no integrations');

select * from finish();
rollback;
