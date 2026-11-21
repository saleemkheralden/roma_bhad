-- Handover notes (Phase 4). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'admin6@test.local'),  -- team admin, no role today
  ('00000000-0000-0000-0000-0000000000b6', 'cmd6@test.local'),    -- holds a command role today
  ('00000000-0000-0000-0000-0000000000c6', 'cadet6@test.local'),  -- plain cadet
  ('00000000-0000-0000-0000-0000000000d6', 'out6@test.local');    -- outsider

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select public.create_team('צוות חפיפה', 'אחראית', 'חפיפה');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a6';
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
select public.join_team((select invite_code from t), null, 'מפקד', 'היום');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c6');
select public.join_team((select invite_code from t), null, 'צוערת', 'ג');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id, private.today(), private.today()
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.is_command
  and m.user_id = '00000000-0000-0000-0000-0000000000b6'
limit 1;

-- Today's role-holder writes for tomorrow -----------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
select lives_ok($$ insert into public.handover_notes (team_id, for_date, body)
  select team_id, private.today() + 1, 'הנוכחות של הבוקר נלקחת אחרי המסדר' from t $$, 'a role-holder leaves a note for tomorrow');
select is((select author_member_id from public.handover_notes),
  (select id from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b6'), 'the author is stamped by the database');
select throws_ok($$ insert into public.handover_notes (team_id, for_date, body)
  select team_id, private.today() - 1, 'מאתמול' from t $$, '23514', null, 'notes cannot be backdated');
select lives_ok($$ update public.handover_notes set body = 'הנוכחות נלקחת אחרי המסדר' $$, 'the author edits the text');
select throws_ok($$ update public.handover_notes set for_date = private.today() + 3 $$, '42501', null, 'the day of a note cannot change');

-- A plain cadet ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c6');
select is((select count(*)::int from public.handover_notes), 1, 'members read handover notes');
select throws_ok($$ insert into public.handover_notes (team_id, for_date, body)
  select team_id, private.today() + 1, 'ניסיון' from t $$, '42501', null, 'a cadet without a role cannot write notes');
update public.handover_notes set body = 'שונה';
delete from public.handover_notes;
select pg_temp.as_postgres();
select is((select body from public.handover_notes), 'הנוכחות נלקחת אחרי המסדר', 'a cadet can neither edit nor remove someone else''s note');

-- Outsider ------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d6');
select is((select count(*)::int from public.handover_notes), 0, 'an outsider sees no notes');

-- Pruning old notes -----------------------------------------------------------------
select pg_temp.as_postgres();
alter table public.handover_notes disable trigger handover_notes_guard;
insert into public.handover_notes (team_id, for_date, body) select team_id, private.today() - 20, 'ישן' from t;
alter table public.handover_notes enable trigger handover_notes_guard;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
select lives_ok($$ insert into public.handover_notes (team_id, for_date, body)
  select team_id, private.today(), 'עוד הערה' from t $$, 'a role-holder can also write for today');
select pg_temp.as_postgres();
select is((select count(*)::int from public.handover_notes where body = 'ישן'), 0, 'notes older than two weeks are pruned on write');

-- A manager removes notes -----------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select lives_ok($$ delete from public.handover_notes $$, 'the admin removes notes');
select is((select count(*)::int from public.handover_notes), 0, 'all notes are gone');

select * from finish();
rollback;
