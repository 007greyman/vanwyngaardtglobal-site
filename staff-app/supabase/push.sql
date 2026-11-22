-- Copyright (c) 2026 Jack van Wyngaardt. All rights reserved.
-- Proprietary and confidential. Licensed to Van Wyngaardt Global Ltd. See LICENSE.txt.
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

-- ---------- Intel Briefs (daily VWG Intel brief PDFs, managers only) ----------
-- Private bucket; files are uploaded by the vwg-brief function and opened with signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefs', 'briefs', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists briefs_admin_read on storage.objects;
create policy briefs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'briefs' and public.is_admin());

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(), title text not null, path text not null unique,
  size int, created_at timestamptz not null default now());
alter table public.briefs enable row level security;
revoke all on public.briefs from anon;
grant select on public.briefs to authenticated;
drop policy if exists briefs_admin_select on public.briefs;
create policy briefs_admin_select on public.briefs for select to authenticated using (public.is_admin());

-- Managers only for now (2026-11-22): staff may only subscribe to tests.
drop policy if exists push_own_insert on public.push_subscriptions;
drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['test']));
create policy push_own_update on public.push_subscriptions for update to authenticated
  using (staff_id = public.my_staff_id())
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['test']));

-- Area each brief applies to ("london" = London grid + UK). Later: operators see only briefs for
-- the area of the job they're currently deployed on.
alter table public.briefs add column if not exists area text;
create index if not exists briefs_area_idx on public.briefs (area, created_at desc);

-- ---------- Aegis link (2026-11-22) ----------
-- Job briefs from Aegis: private bucket jobdocs/<siteId>/..., readable by managers and the
-- operators currently deployed on that site. Intel briefs readable by operators deployed in the
-- brief's area. Operators may subscribe to brief alerts. (Need-to-know record access:
-- need_to_know.sql. Function: functions/vwg-aegis.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jobdocs', 'jobdocs', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false;
drop policy if exists jobdocs_read on storage.objects;
create policy jobdocs_read on storage.objects for select to authenticated
  using (bucket_id = 'jobdocs' and (public.is_admin() or split_part(name, '/', 1) = any(public.my_site_ids())));
create or replace function public.my_areas() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct lower(r.data->>'area')), '{}') from public.records r
  where r.collection = 'sites' and r.id = any(public.my_site_ids()) and r.data->>'area' is not null
$$;
revoke execute on function public.my_areas() from public, anon;
grant execute on function public.my_areas() to authenticated;
drop policy if exists briefs_admin_select on public.briefs;
drop policy if exists briefs_select on public.briefs;
create policy briefs_select on public.briefs for select to authenticated
  using (public.is_admin() or (public.my_staff_id() is not null and area = any(public.my_areas())));
drop policy if exists briefs_admin_read on storage.objects;
drop policy if exists briefs_read on storage.objects;
create policy briefs_read on storage.objects for select to authenticated
  using (bucket_id = 'briefs' and (public.is_admin()
    or exists (select 1 from public.briefs b where b.path = name and b.area = any(public.my_areas()))));
drop policy if exists push_own_insert on public.push_subscriptions;
drop policy if exists push_own_update on public.push_subscriptions;
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['brief', 'test']));
create policy push_own_update on public.push_subscriptions for update to authenticated
  using (staff_id = public.my_staff_id())
  with check (staff_id = public.my_staff_id() and (public.is_admin() or topics <@ array['brief', 'test']));

-- ---------- Drivers (2026-11-22) ----------
-- Roles per site from shifts; site documents can target drivers (audience 'driver') or the rest of
-- the team (audience 'team'). Applied as migration driver_audience; see need_to_know.sql for the base
-- policy. Drivers (SDD) can be job-only (not fully vetted) and see only that job.

-- ---------- Onboarding + 24-hour window (2026-11-22) ----------
-- Applied as migrations onboarding_gate and job_only_24h_window: my_onboarded(), my_job_only(),
-- my_site_ids() returns nothing until onboarding is approved and, for job-only staff, until
-- 24 h before their first shift on a site; collection 'onboarding' (own rows + managers);
-- records_guard lets staff move their onboarding only from pending to submitted.

-- ---------- Receipts + positions (2026-11-22) ----------
-- Applied as migration message_receipts_and_positions: collection 'receipts' (rc-<staffId>-<thread>,
-- visible to everyone in that conversation) and 'positions' (pos-<entryId>, live location while
-- clocked in; own rows + managers only). Both writable by their owner.
