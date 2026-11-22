/* Copyright (c) 2026 Jack van Wyngaardt. All rights reserved.
 * Proprietary and confidential. Licensed to Van Wyngaardt Global Ltd. See LICENSE.txt. */
// vwg-push: sends VWG phone alerts (Web Push) to devices in public.push_subscriptions.
//
// Two callers:
//  1. VWG Intel (laptop now, AWS later): header `x-vwg-push-key: <sender secret>`, any topic.
//     Only the secret's SHA-256 is stored (private.push_config.send_secret_sha256).
//  2. A signed-in staff member in the Staff app: Authorization: Bearer <user JWT>, topic "test" only,
//     sent to that person's own devices.
// Each alert is encrypted for the receiving device (RFC 8291) by web-push, so the push service
// (Apple/Google/Mozilla) only carries ciphertext. Dead subscriptions (404/410) are removed.
// Keys come from schema `private` over the direct DB connection; nothing secret is in this file.
import webpush from "npm:web-push@3.6.7";
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vwg-push-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (!cfg) {
    const rows = await sql`select key, value from private.push_config`;
    cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  }
  return cfg;
}

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// The staff id of the caller's JWT, if they are active staff (managers and operators).
async function callerStaffId(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;
  const rows = await sql`select id from public.records where collection = 'staff'
    and lower(data->>'email') = lower(${data.user.email})
    and coalesce((data->>'active')::boolean, true) limit 1`;
  return rows[0]?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let msg: { topic?: string; title?: string; body?: string; url?: string; tag?: string; area?: string };
  try { msg = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const topic = String(msg.topic || "");
  if (!/^(intel|brief|test|onboarding)$/.test(topic)) return json({ error: "unknown topic" }, 400);

  const c = await config();
  const key = req.headers.get("x-vwg-push-key");
  let onlyStaff: string | null = null;
  if (key) {
    if (!sameHex(await sha256hex(key), c.send_secret_sha256)) return json({ error: "forbidden" }, 403);
  } else {
    onlyStaff = await callerStaffId(req);
    if (!onlyStaff || (topic !== "test" && topic !== "onboarding")) return json({ error: "forbidden" }, 403);
  }
  // A staff member's "I've submitted my onboarding" goes to the managers, with text set here
  // (never the caller's), and only if their onboarding really is submitted.
  if (topic === "onboarding" && onlyStaff) {
    const [me] = await sql`select data->>'name' as name, data->'onboarding'->>'status' as st from public.records
      where collection = 'staff' and id = ${onlyStaff}`;
    if (!me || me.st !== "submitted") return json({ error: "nothing submitted" }, 400);
    msg = { title: "VWG Staff · onboarding submitted", body: `${me.name} has uploaded their documents and signed the NDA. Review and approve in the Staff app.`, url: "./index.html", tag: `onb-${onlyStaff}` };
    onlyStaff = null;
  }

  // Intel goes to active managers only. A brief goes to managers and to operators deployed
  // (shift from yesterday onwards) at a site in the brief's area (Jack 2026-11-22). Tests go
  // to the caller's own devices.
  const area = msg.area ? String(msg.area).toLowerCase().slice(0, 40) : null;
  const subs = await sql`select s.endpoint, s.p256dh, s.auth from public.push_subscriptions s
    join public.records r on r.collection = 'staff' and r.id = s.staff_id
    where ${topic} = any(s.topics)
      and coalesce((r.data->>'active')::boolean, true)
      and ((${topic} = 'test') or coalesce((r.data->>'isAdmin')::boolean, false)
           or (${topic} = 'brief' and ${area}::text is not null and exists (
                select 1 from public.records sh join public.records si
                  on si.collection = 'sites' and si.id = sh.data->>'siteId'
                where sh.collection = 'shifts' and sh.owner = r.id
                  and (sh.data->>'date')::date >= current_date - 1
                  and lower(si.data->>'area') = ${area}
                  -- onboarding approved, and job-only people only within 24 h of the shift
                  and coalesce(r.data->'onboarding'->>'status', 'approved') = 'approved'
                  and (not coalesce((r.data->>'jobOnly')::boolean, false)
                       or now() >= ((sh.data->>'date') || ' ' || coalesce(nullif(sh.data->>'start', ''), '00:00'))::timestamp
                                   at time zone 'Europe/London' - interval '24 hours'))))
      and (${onlyStaff}::text is null or s.staff_id = ${onlyStaff})`;

  const payload = JSON.stringify({
    title: String(msg.title || "VWG").slice(0, 120),
    body: String(msg.body || "").slice(0, 1500),
    url: msg.url ? String(msg.url).slice(0, 500) : undefined,
    tag: msg.tag ? String(msg.tag).slice(0, 64) : undefined,
  });
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        { TTL: topic === "intel" ? 6 * 3600 : 24 * 3600, urgency: topic === "intel" ? "high" : "normal" });
      sent++;
      await sql`update public.push_subscriptions set last_ok = now(), fails = 0 where endpoint = ${s.endpoint}`;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        removed++;
        await sql`delete from public.push_subscriptions where endpoint = ${s.endpoint}`;
      } else {
        failed++;
        await sql`update public.push_subscriptions set fails = fails + 1 where endpoint = ${s.endpoint}`;
      }
    }
  }));
  return json({ sent, removed, failed, devices: subs.length });
});
