/* Copyright (c) 2026 Jack van Wyngaardt. All rights reserved.
 * Proprietary and confidential. Licensed to Van Wyngaardt Global Ltd. See LICENSE.txt. */
// vwg-reminders: "clock on" reminders. Called every 5 minutes by pg_cron (header x-cron-key, a
// value kept only in private.push_config). For every rostered shift starting within the next 30
// minutes (Jack: 30 min before) whose person is not clocked in, it sends one push alert to that person's devices.
// "TBC" days (hours confirmed daily by the TL) are reminded on their planned time, worded as planned.
// Skips people still in onboarding, inactive staff, and shifts already reminded.
import webpush from "npm:web-push@3.6.7";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (!cfg) {
    const rows = await sql`select key, value from private.push_config`;
    cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  }
  return cfg;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const c = await config();
  const key = req.headers.get("x-cron-key") || "";
  if (!c.cron_key || key.length < 32 || key !== c.cron_key) return json({ error: "forbidden" }, 403);

  const due = await sql`
    select sh.id as shift_id, sh.data->>'staffId' as staff_id, sh.data->>'start' as start,
           coalesce((sh.data->>'timesTbc')::boolean, false) as tbc,
           coalesce(si.data->>'customer', si.data->>'name', 'your shift') as job
      from public.records sh
      join public.records st on st.collection = 'staff' and st.id = sh.data->>'staffId'
      left join public.records si on si.collection = 'sites' and si.id = sh.data->>'siteId'
     where sh.collection = 'shifts'
       and sh.data->>'staffId' is not null
       and coalesce(sh.data->>'status', 'confirmed') not in ('cancelled', 'offered')
       and coalesce((st.data->>'active')::boolean, true)
       and coalesce(st.data->'onboarding'->>'status', 'approved') = 'approved'
       and (case when sh.data->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and sh.data->>'start' ~ '^[0-9]{2}:[0-9]{2}$'
                 then ((sh.data->>'date') || ' ' || (sh.data->>'start'))::timestamp at time zone 'Europe/London' end)
           between now() and now() + interval '30 minutes'
       and not exists (select 1 from public.records e where e.collection = 'entries'
                        and e.data->>'staffId' = sh.data->>'staffId' and e.data->>'clockOut' is null)
       and not exists (select 1 from private.shift_reminders r where r.shift_id = sh.id)`;

  let sent = 0, people = 0;
  for (const d of due) {
    await sql`insert into private.shift_reminders (shift_id, sent_at) values (${d.shift_id}, now()) on conflict do nothing`;
    const subs = await sql`select endpoint, p256dh, auth from public.push_subscriptions where staff_id = ${d.staff_id}`;
    if (!subs.length) continue;
    people++;
    const payload = JSON.stringify({
      title: `Clock on: ${d.job}`,
      body: d.tbc
        ? `Your shift is planned for ${d.start} (TBC: the TL confirms the time). Clock on in the VWG Staff app when you start.`
        : `Your shift starts at ${d.start}. Open the VWG Staff app and clock on.`,
      url: "./index.html", tag: `clock-${d.shift_id}`,
    });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 1800, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sql`delete from public.push_subscriptions where endpoint = ${s.endpoint}`;
      }
    }
  }
  // keep the dedupe table small
  await sql`delete from private.shift_reminders where sent_at < now() - interval '3 days'`;
  return json({ due: due.length, people, sent });
});
