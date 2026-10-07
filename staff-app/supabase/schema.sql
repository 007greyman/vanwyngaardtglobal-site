-- VWG Staff app: shared database for Supabase.
-- Run this once in your Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run again after an update.
--
-- Every record the app keeps (staff, sites, shifts, clock-ins, leave...) is one row here.
-- `collection` says what kind of record it is; `data` holds the record itself.
-- Row Level Security below decides who can read and change what.

create table if not exists public.records (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  -- The staff member a record belongs to (clock-ins, leave, messages...), if any.
  owner      text generated always as (coalesce(data->>'staffId', data->>'byStaff')) stored,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists records_owner_idx on public.records (collection, owner);

alter table public.records enable row level security;
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- ---------- Who is signed in ----------

-- True once the signed-in user has clicked the link in their confirmation email.
create or replace function public.email_confirmed() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
$$;

-- The staff record id of the signed-in user (matched on email), or null.
create or replace function public.my_staff_id() returns text
language sql stable security definer set search_path = public as $$
  select r.id from public.records r
  where r.collection = 'staff'
    and lower(r.data->>'email') = lower(auth.jwt()->>'email')
    and coalesce((r.data->>'active')::boolean, true)
    and public.email_confirmed()
  limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.records r
    where r.collection = 'staff'
      and lower(r.data->>'email') = lower(auth.jwt()->>'email')
      and coalesce((r.data->>'active')::boolean, true)
      and coalesce((r.data->>'isAdmin')::boolean, false)
      and public.email_confirmed()
  )
$$;

create or replace function public.staff_count() returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.records where collection = 'staff'
$$;

-- Supabase lets anyone call public functions through its API; only signed-in staff need these.
revoke execute on function public.email_confirmed(), public.my_staff_id(), public.is_admin(), public.staff_count() from public, anon;
grant execute on function public.email_confirmed(), public.my_staff_id(), public.is_admin(), public.staff_count() to authenticated;

-- ---------- Access rules ----------

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

-- Staff can see everything except other people's support chats and personal documents.
create policy records_select on public.records for select to authenticated using (
  public.my_staff_id() is not null and (
    collection not in ('support', 'staffDocs')
    or owner = public.my_staff_id()
    or public.is_admin()
  )
);

-- Managers can add anything. Staff can add their own clock-ins, leave, forms, messages etc.
-- The very first person to sign in (when there are no staff yet) may create themselves as manager.
create policy records_insert on public.records for insert to authenticated with check (
  public.is_admin()
  or (
    public.my_staff_id() is not null
    and owner = public.my_staff_id()
    and collection in ('entries', 'leave', 'incidents', 'occurrences', 'messages', 'register',
                       'welfare', 'trainingDone', 'docReads', 'support', 'staffDocs')
  )
  or (
    collection = 'staff'
    and public.staff_count() = 0
    and public.email_confirmed()
    and lower(data->>'email') = lower(auth.jwt()->>'email')
    and coalesce((data->>'isAdmin')::boolean, false)
  )
);

-- Staff can update their own records, their own profile, the visitor register,
-- and accept or release shifts (the trigger below limits exactly what changes).
create policy records_update on public.records for update to authenticated using (
  public.is_admin()
  or (public.my_staff_id() is not null and (
       owner = public.my_staff_id()
       or (collection = 'staff' and id = public.my_staff_id())
       or collection = 'register'
       or (collection = 'shifts' and (owner is null or owner = public.my_staff_id()))
  ))
) with check (
  public.is_admin()
  or (public.my_staff_id() is not null and (
       (owner = public.my_staff_id()
        and collection in ('entries', 'leave', 'incidents', 'occurrences', 'messages', 'register',
                           'welfare', 'trainingDone', 'docReads', 'support', 'staffDocs', 'shifts'))
       or (collection = 'staff' and id = public.my_staff_id())
       or collection = 'register'
       or (collection = 'shifts' and owner is null)
  ))
);

-- Staff can cancel pending leave, remove their own documents and retake training.
create policy records_delete on public.records for delete to authenticated using (
  public.is_admin()
  or (owner = public.my_staff_id() and (
       (collection = 'leave' and data->>'status' = 'pending')
       or collection in ('staffDocs', 'trainingDone')
  ))
);

-- ---------- Guard rails for non-managers ----------

create or replace function public.records_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_staff_id();
begin
  new.updated_at := now();
  -- Managers, and edits made in the Supabase dashboard (no signed-in app user), are not limited.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- New requests always start unapproved.
    if new.collection = 'leave' then
      new.data := new.data || '{"status": "pending"}';
    elsif new.collection = 'incidents' then
      new.data := new.data || '{"status": "open"}';
    end if;
    return new;
  end if;

  if new.collection = 'staff' then
    -- Staff may change their own name, phone, PIN, photo and compliance, not their job details.
    new.data := new.data || jsonb_build_object(
      'email', old.data->'email', 'isAdmin', old.data->'isAdmin', 'active', old.data->'active',
      'rate', old.data->'rate', 'empNo', old.data->'empNo', 'role', old.data->'role',
      'dept', old.data->'dept', 'startDate', old.data->'startDate',
      'leaveAllowance', old.data->'leaveAllowance');
  elsif new.collection = 'shifts' then
    if new.data = old.data then
      null;
    elsif old.owner is null and old.data->>'status' = 'offered' and new.data->>'staffId' = me then
      new.data := old.data || jsonb_build_object('staffId', me, 'status', 'pending');
    elsif old.owner = me and new.data->>'staffId' is null then
      new.data := old.data || jsonb_build_object('staffId', null, 'status', 'offered');
    else
      raise exception 'You can only accept offered shifts or release your own shifts';
    end if;
  elsif new.collection = 'entries' then
    if old.data->>'clockOut' is not null and new.data <> old.data then
      raise exception 'A finished clock-in can only be changed by a manager';
    end if;
    if new.data->>'clockIn' is distinct from old.data->>'clockIn' then
      raise exception 'Clock-in time can only be changed by a manager';
    end if;
  elsif new.collection in ('leave', 'incidents') then
    if new.data->>'status' is distinct from old.data->>'status' then
      raise exception 'Only a manager can change the status';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records
  for each row execute function public.records_guard();

-- ---------- Sign-up ----------
-- Only people already on the staff list can create an account
-- (except the very first person, who becomes the manager).

create or replace function public.allow_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.staff_count() > 0 and not exists (
    select 1 from public.records
    where collection = 'staff'
      and lower(data->>'email') = lower(new.email)
      and coalesce((data->>'active')::boolean, true)
  ) then
    raise exception 'This email is not on the staff list. Ask your manager to add you first.';
  end if;
  return new;
end
$$;

drop trigger if exists vwg_allow_signup on auth.users;
create trigger vwg_allow_signup before insert on auth.users
  for each row execute function public.allow_signup();

-- Trigger functions only run as triggers; nobody needs to call them through the API.
revoke execute on function public.records_guard(), public.allow_signup() from public, anon, authenticated;

-- ---------- Live updates ----------

do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end
$$;
