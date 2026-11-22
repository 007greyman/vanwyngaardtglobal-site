-- VWG Staff: need-to-know access for operators (2026-11-22). Run after schema.sql. Safe to run again.
--
-- Before this, any signed-in staff member could read every staff record, site and shift.
-- Operators are subcontracted close-protection staff working on sensitive jobs, so a
-- non-manager now sees only:
--   * their own staff record, the managers (to contact them), and teammates who share a site
--     with them on a current/upcoming shift;
--   * the sites of their own current/upcoming shifts (window: yesterday onwards) and nothing else;
--   * their own shifts (plus offered shifts at those same sites);
--   * company documents, and site/customer documents for their own sites;
--   * the All Staff thread, their sites' threads and their own direct messages;
--   * their own clock-ins, leave, forms, welfare checks etc. (unchanged), the sign-on register
--     and site log for their own sites.
-- When a job ends (no shift from yesterday onwards), its site, team and documents drop out of view.
-- Managers (is_admin) keep seeing everything. Writes are unchanged (records_insert/update/delete).

create or replace function public.my_site_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.data->>'siteId'), '{}')
  from public.records r
  where r.collection = 'shifts'
    and r.owner = public.my_staff_id()
    and r.data->>'siteId' is not null
    and (r.data->>'date')::date >= current_date - 1
$$;

create or replace function public.my_team_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.owner), '{}')
  from public.records r
  where r.collection = 'shifts'
    and r.owner is not null
    and r.data->>'siteId' = any(public.my_site_ids())
    and (r.data->>'date')::date >= current_date - 1
$$;

create or replace function public.my_customers() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.data->>'customer'), '{}')
  from public.records r
  where r.collection = 'sites' and r.id = any(public.my_site_ids()) and r.data->>'customer' is not null
$$;

revoke execute on function public.my_site_ids(), public.my_team_ids(), public.my_customers() from public, anon;
grant execute on function public.my_site_ids(), public.my_team_ids(), public.my_customers() to authenticated;

drop policy if exists records_select on public.records;
create policy records_select on public.records for select to authenticated using (
  public.is_admin()
  or (public.my_staff_id() is not null and (
    case collection
      when 'staff' then id = public.my_staff_id()
                     or coalesce((data->>'isAdmin')::boolean, false)
                     or id = any(public.my_team_ids())
      when 'sites' then id = any(public.my_site_ids())
      when 'shifts' then owner = public.my_staff_id()
                      or (owner is null and data->>'status' = 'offered' and data->>'siteId' = any(public.my_site_ids()))
      when 'documents' then data->>'scope' = 'company'
                         or (data->>'scope' = 'site' and data->>'refId' = any(public.my_site_ids()))
                         or (data->>'scope' = 'customer' and data->>'refId' = any(public.my_customers()))
      when 'messages' then data->>'thread' = 'all'
                        or owner = public.my_staff_id()
                        or data->>'thread' = any(select 'site:' || unnest(public.my_site_ids()))
                        or data->>'thread' like 'dm:%' and position(public.my_staff_id() in data->>'thread') > 0
      when 'register' then owner = public.my_staff_id() or data->>'siteId' = any(public.my_site_ids())
      when 'occurrences' then owner = public.my_staff_id() or data->>'siteId' = any(public.my_site_ids())
      when 'training' then true
      else owner = public.my_staff_id()   -- entries, leave, incidents, welfare, trainingDone, docReads, support, staffDocs
    end
  ))
);
