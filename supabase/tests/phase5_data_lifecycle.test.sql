-- End of course: only admins delete a team, and deleting it removes everything in it. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'admin5@test.local'),
  ('00000000-0000-0000-0000-0000000000b5', 'cadet5@test.local'),
  ('00000000-0000-0000-0000-0000000000d5', 'out5@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select public.create_team('צוות מחיקה', 'אחראית', 'מחיקה');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a5';
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
select public.join_team((select invite_code from t), null, 'צוער', 'ה');
-- The cadet keeps a private task: deleting the team must remove it too.
insert into public.tasks (team_id, visibility, title, owner_id)
  select team_id, 'private', 'פרטי', auth.uid() from t;

-- Outsider and cadet cannot delete the team ------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d5');
delete from public.teams where id = (select team_id from t);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
select is((select count(*)::int from public.teams where id = (select team_id from t)), 1, 'an outsider cannot delete the team');
delete from public.teams where id = (select team_id from t);
select is((select count(*)::int from public.teams where id = (select team_id from t)), 1, 'a cadet cannot delete the team');
select is((select count(*)::int from public.tasks where team_id = (select team_id from t)), 1, 'the cadet still has their private task');

-- The admin deletes it, and every row goes ------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select lives_ok($$ delete from public.teams where id = (select team_id from t) $$, 'the admin deletes the team');
select pg_temp.as_postgres();
select is((select count(*)::int from public.teams where id = (select team_id from t)), 0, 'the team is gone');
select is((select count(*)::int from public.team_members where team_id = (select team_id from t)), 0, 'the roster is gone');
select is((select count(*)::int from public.tasks where team_id = (select team_id from t)), 0, 'private tasks of members are gone too');

select * from finish();
rollback;
