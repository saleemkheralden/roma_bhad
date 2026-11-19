-- Phase 4: Web Push subscriptions (one row per device that turned notifications on).
-- Own rows only. The server reads other users' rows with the secret key to send
-- notifications (role assignment, new team task, evening summary); nothing else does.

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000 and endpoint ~* '^https://'),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "read own subscriptions" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "add own subscriptions" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "remove own subscriptions" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;
