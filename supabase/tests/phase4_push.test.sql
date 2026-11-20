-- Push subscriptions: own rows only. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'push-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b5', 'push-b@test.local');

create or replace function pg_temp.as_user(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select lives_ok($$ insert into public.push_subscriptions (endpoint, p256dh, auth)
  values ('https://push.example/a-1', 'p256dh-key-aaaa', 'auth-aaaa') $$, 'a user saves their own device');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-0000000000b5', 'https://push.example/forged', 'p256dh-key-aaaa', 'auth-aaaa') $$,
  '42501', null, 'cannot save a device for someone else');
select throws_ok($$ insert into public.push_subscriptions (endpoint, p256dh, auth)
  values ('http://insecure.example/x', 'p256dh-key-aaaa', 'auth-aaaa') $$,
  '23514', null, 'only https push endpoints');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
select is((select count(*)::int from public.push_subscriptions), 0, 'others cannot see my devices');
delete from public.push_subscriptions; -- filtered by RLS
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from public.push_subscriptions), 1, 'others cannot remove my devices');
select lives_ok($$ delete from public.push_subscriptions where endpoint = 'https://push.example/a-1' $$, 'I can remove my device');

select * from finish();
rollback;
