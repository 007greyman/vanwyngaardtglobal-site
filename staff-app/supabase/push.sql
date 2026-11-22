-- VWG Staff: phone alerts (Web Push). Run after schema.sql. Safe to run again.
--
-- push_subscriptions: one row per device that turned alerts on. Each person can only see,
-- add and remove their own devices. For now only managers (admins) may subscribe; staff
-- may later subscribe to the 'brief' topic only.
--
-- The sending keys live in schema `private`, which the Supabase API does not expose. They
-- are inserted separately and are NEVER committed to this (public) repository.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  staff_id   text not null default public.my_staff_id(),
  p256dh     text not null,
  auth       text not null,
  device     text,
  topics     text[] not null default '{intel,brief,test}',
  created_at timestamptz not null default now(),
  last_ok    timestamptz,
  fails      int not null default 0
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists push_own_select on public.push_subscriptions;
drop policy if exists push_own_insert on public.push_subscriptions;
drop policy if exists push_own_update on public.push_subscriptions;
drop policy if exists push_own_delete on public.push_subscriptions;

create policy push_own_select on public.push_subscriptions for select to authenticated
  using (staff_id = public.my_staff_id());
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['brief', 'test']));
create policy push_own_update on public.push_subscriptions for update to authenticated
  using (staff_id = public.my_staff_id())
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['brief', 'test']));
create policy push_own_delete on public.push_subscriptions for delete to authenticated
  using (staff_id = public.my_staff_id());

-- Sending keys (VAPID private key, hash of the sender secret). Not reachable through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.push_config (key text primary key, value text not null);
revoke all on private.push_config from public, anon, authenticated;
