-- RLS and trigger tests for the notice board (issue #3). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'cmd4@test.local'),   -- role-holder today (command)
  ('00000000-0000-0000-0000-0000000000b4', 'cadet5@test.local'), -- plain cadet
  ('00000000-0000-0000-0000-0000000000c4', 'next4@test.local'),  -- tomorrow's role-holder
  ('00000000-0000-0000-0000-0000000000d4', 'out4@test.local');   -- outsider

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_postgres() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select public.create_team('צוות מודעות', 'מפקדת', 'לוח');
select pg_temp.as_postgres();
create temp table t as
  select id as team_id, invite_code from public.teams where created_by = '00000000-0000-0000-0000-0000000000a4';
grant select on t to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
select public.join_team((select invite_code from t), null, 'צוער', 'בי');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
select public.join_team((select invite_code from t), null, 'מחר', 'סי');

-- The creator is admin, not command: give them a command role today, and the
-- third cadet the same role tomorrow.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into public.role_assignments (team_id, role_id, member_id, start_date, end_date)
select r.team_id, r.id, m.id,
       private.today() + case when m.user_id = '00000000-0000-0000-0000-0000000000c4' then 1 else 0 end,
       private.today() + case when m.user_id = '00000000-0000-0000-0000-0000000000c4' then 1 else 0 end
from public.team_roles r, public.team_members m
where r.team_id = (select team_id from t) and r.name = 'א׳ צוות'
  and m.user_id in ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000c4');

-- Command posts --------------------------------------------------------------------
select lives_ok($$ insert into public.notices (team_id, title, body, pinned)
  select team_id, 'מחר השכמה מוקדמת', 'לא לשכוח מחברות', true from t $$, 'command posts a team notice');
select lives_ok($$ insert into public.notices (team_id, audience, title, created_by)
  select team_id, 'command', 'חפיפה למחר', '00000000-0000-0000-0000-0000000000b4' from t $$, 'command posts a handover note');
select is((select created_by from public.notices where title = 'חפיפה למחר'), '00000000-0000-0000-0000-0000000000a4'::uuid,
  'the author is forced to the caller, whatever the client sent');
select is((select count(*)::int from public.notices where team_id = (select team_id from t)), 2, 'command sees both notices');

-- A plain cadet --------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
select is((select count(*)::int from public.notices where team_id = (select team_id from t)), 1,
  'a cadet sees only the team notice');
select is((select count(*)::int from public.notices where audience = 'command'), 0,
  'a cadet cannot read handover notes');
select throws_ok($$ insert into public.notices (team_id, title) select team_id, 'ניסיון' from t $$,
  '42501', null, 'a cadet cannot post');
update public.notices set pinned = false where title = 'מחר השכמה מוקדמת'; -- filtered by RLS
delete from public.notices where title = 'מחר השכמה מוקדמת';             -- filtered by RLS

-- Tomorrow's role-holder -------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
select is((select count(*)::int from public.notices where audience = 'command'), 1,
  'tomorrow''s role-holder reads the handover note tonight');
select throws_ok($$ insert into public.notices (team_id, title) select team_id, 'עוד לא' from t $$,
  '42501', null, 'tomorrow''s role-holder cannot post before their day');

-- Outsider -------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d4');
select is((select count(*)::int from public.notices), 0, 'an outsider sees no notices');

-- Command edits ----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select is((select pinned from public.notices where title = 'מחר השכמה מוקדמת'), true, 'the cadet could not unpin');
select lives_ok($$ update public.notices set body = 'עם מחברות' where title = 'מחר השכמה מוקדמת' $$, 'command edits');
select isnt((select updated_at from public.notices where title = 'מחר השכמה מוקדמת'), null, 'an edit stamps updated_at');
select throws_ok($$ update public.notices set created_by = '00000000-0000-0000-0000-0000000000b4' where title = 'מחר השכמה מוקדמת' $$,
  '42501', null, 'the author cannot change');

-- The author after their day: drop today's role, they may still remove their own notice.
select pg_temp.as_postgres();
delete from public.role_assignments
where team_id = (select team_id from t) and start_date = private.today();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$ insert into public.notices (team_id, title) select team_id, 'אחרי היום' from t $$,
  '42501', null, 'no longer command: cannot post');
select lives_ok($$ delete from public.notices where title = 'מחר השכמה מוקדמת' $$, 'the author removes their own notice');
select pg_temp.as_postgres();
select is((select count(*)::int from public.notices where team_id = (select team_id from t) and audience = 'team'), 0,
  'the notice is gone');

select * from finish();
rollback;
