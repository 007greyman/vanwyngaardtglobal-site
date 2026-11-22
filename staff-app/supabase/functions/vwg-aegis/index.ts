// vwg-aegis: the only door between Aegis (VWG's encrypted desktop ops console) and the Staff app.
//
// Called from Aegis's main process with header `x-vwg-aegis-key: <secret>` (own secret, separate
// from the alerts key; only its SHA-256 is stored in private.push_config.aegis_secret_sha256).
// Three actions, nothing else:
//   operators.sync  {operators:[{aegisId,name,email,phone,siaLicence,siaExpiry,vettingExpiry}]}
//                   Full list of CLEARED operators. Creates/updates their staff records (they can
//                   then create a password in the app); Aegis operators missing from the list are
//                   switched off (active=false).
//   job.push        {aegisId,codename,area,siteName,address,city,notes,
//                    shifts:[{operatorAegisId,date,start,end,role,timesTbc}], movements:[{date,time,from,to,notes}],
//                    brief:{base64}?, driverBrief:{base64}?}
//                   One job as a site (named by CODENAME, never the client) + shifts per operator +
//                   the job brief PDF in the private bucket jobdocs/<siteId>/. Role SDD = driver: drivers
//                   get the driver brief (audience 'driver'), everyone else the job brief (audience
//                   'team' when there is a driver brief). Movements = the run sheet, shown to the team.
//   job.close       {aegisId}: removes upcoming shifts and the job brief; the site drops out of view.
// Need-to-know access is enforced by the database policies (need_to_know.sql), not here.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false });
// Server-side only (function env); never sent anywhere.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const COLORS = ["#2f6fb5", "#b48c40", "#2e8b57", "#8e44ad", "#c0392b", "#16a085", "#d35400"];
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const idPart = (v: unknown) => String(v ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorised(req: Request) {
  const key = req.headers.get("x-vwg-aegis-key") || "";
  if (key.length < 32) return false;
  const [row] = await sql`select value from private.push_config where key = 'aegis_secret_sha256'`;
  if (!row) return false;
  const got = await sha256hex(key);
  let diff = got.length ^ row.value.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ row.value.charCodeAt(i);
  return diff === 0;
}

// The staff record id for an Aegis operator: a record already linked to that Aegis operator
// wins (e.g. a manager who also works jobs, linked by hand), then one with the same email,
// so nobody gets a second account.
async function staffIdFor(aegisId: string, email: string) {
  const [linked] = await sql`select id from public.records where collection = 'staff'
    and data->>'aegisId' = ${aegisId} order by (data->>'isAdmin')::boolean desc nulls last limit 1`;
  if (linked) return linked.id;
  const [byEmail] = await sql`select id from public.records where collection = 'staff'
    and lower(data->>'email') = lower(${email}) limit 1`;
  return byEmail?.id ?? `aegis-op-${aegisId}`;
}

async function operatorsSync(body: any) {
  const list = Array.isArray(body.operators) ? body.operators.slice(0, 500) : [];
  // An empty list would switch every operator off: only when Aegis says so explicitly.
  if (!list.length && body.allowEmpty !== true) return { error: "empty operator list (send allowEmpty:true to switch everyone off)" };
  const keep: string[] = [];
  let created = 0, updated = 0;
  for (const [i, o] of list.entries()) {
    const aegisId = idPart(o.aegisId);
    const email = str(o.email, 200).toLowerCase();
    const name = str(o.name, 120);
    if (!aegisId || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    const id = await staffIdFor(aegisId, email);
    keep.push(id);
    const [old] = await sql`select data from public.records where collection = 'staff' and id = ${id}`;
    if (old && old.data.isAdmin) continue; // never touch a manager's record from Aegis
    const fields = {
      name, email, phone: str(o.phone, 40), role: "Close Protection Officer", dept: "Close Protection",
      empNo: `OP-${aegisId}`, isAdmin: false, active: true, aegisId, jobOnly: o.jobOnly === true,
      licence: str(o.siaLicence, 40),
      compliance: {
        ...(old?.data?.compliance || {}),
        sia: { ref: str(o.siaLicence, 40), date: isDate(str(o.siaExpiry, 10)) ? str(o.siaExpiry, 10) : "" },
        vetting: o.jobOnly === true
          ? { ref: "Job-only access (not fully vetted)", date: "" }
          : { ref: "Cleared (VWG)", date: isDate(str(o.vettingExpiry, 10)) ? str(o.vettingExpiry, 10) : "" },
      },
    };
    const base = { id, color: COLORS[i % COLORS.length], photo: null, emergency: "", address: "", leaveAllowance: 0,
      pin: String(1000 + Math.floor(Math.random() * 9000)), startDate: new Date().toISOString().slice(0, 10), rate: 0 };
    const data: any = { ...base, ...(old?.data || {}), ...fields };
    // Job-only people (e.g. a supplier's driver) must finish onboarding in the app (documents + NDA)
    // and be approved by a manager before they see any job.
    if (o.jobOnly === true && !data.onboarding) data.onboarding = { status: "pending" };
    await sql`insert into public.records (collection, id, data) values ('staff', ${id}, ${sql.json(data)})
      on conflict (collection, id) do update set data = excluded.data`;
    old ? updated++ : created++;
  }
  // Operators who came from Aegis but are no longer cleared: switch off (their history stays).
  const off = await sql`update public.records set data = data || '{"active": false}'::jsonb
    where collection = 'staff' and data ? 'aegisId' and coalesce((data->>'active')::boolean, true)
      and not coalesce((data->>'isAdmin')::boolean, false) and not (id = any(${keep}))
    returning id`;
  return { created, updated, deactivated: off.length, skipped: list.length - keep.length };
}

async function jobPush(body: any) {
  const aegisId = idPart(body.aegisId);
  const codename = str(body.codename, 60);
  const area = str(body.area, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!aegisId || !codename || !area) return { error: "aegisId, codename and area are required" };
  const siteId = `aegis-job-${aegisId}`;
  const site = {
    id: siteId, name: str(body.siteName, 120) || codename, customer: codename, area,
    address: str(body.address, 200), city: str(body.city, 80), region: "", country: str(body.country, 60),
    code: codename.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20), lat: null, lng: null,
    notes: str(body.notes, 1000), contacts: [], aegis: true,
    movements: (Array.isArray(body.movements) ? body.movements.slice(0, 300) : [])
      .map((m: any) => ({ date: str(m.date, 10), time: str(m.time, 5), from: str(m.from, 160), to: str(m.to, 160), notes: str(m.notes, 300) }))
      .filter((m: any) => isDate(m.date) && (m.time === "" || isTime(m.time)) && (m.from || m.to)),
  };
  await sql`insert into public.records (collection, id, data) values ('sites', ${siteId}, ${sql.json(site)})
    on conflict (collection, id) do update set data = public.records.data || excluded.data`;

  // shifts: replace this job's upcoming shifts with the ones sent
  const shifts = Array.isArray(body.shifts) ? body.shifts.slice(0, 400) : [];
  const ids: string[] = [];
  let missing = 0;
  for (const s of shifts) {
    const date = str(s.date, 10), start = str(s.start, 5), end = str(s.end, 5);
    const opId = idPart(s.operatorAegisId);
    if (!isDate(date) || !isTime(start) || !isTime(end) || !opId) continue;
    const [staff] = await sql`select id from public.records where collection = 'staff' and data->>'aegisId' = ${opId}
      and coalesce((data->>'active')::boolean, true) limit 1`;
    if (!staff) { missing++; continue; }
    const id = `aegis-sh-${aegisId}-${opId}-${date}`;
    ids.push(id);
    const role = /^(TL|CPO|SDD|RST|Medic|Ops)$/.test(str(s.role, 8)) ? str(s.role, 8) : "CPO";
    // timesTbc: the day is booked but the hours are confirmed daily by the TL (suppliers' drivers).
    const data = { id, staffId: staff.id, siteId, date, start, end, role, timesTbc: s.timesTbc === true,
      notes: str(s.notes, 300), status: "confirmed", aegis: true };
    await sql`insert into public.records (collection, id, data) values ('shifts', ${id}, ${sql.json(data)})
      on conflict (collection, id) do update set data = public.records.data || excluded.data`;
  }
  const dropped = await sql`delete from public.records where collection = 'shifts' and data->>'siteId' = ${siteId}
    and (data->>'date')::date >= current_date and not (id = any(${ids})) returning id`;

  // job brief (team) and driver brief (drivers only)
  const hasDriverBrief = !!(body.driverBrief && typeof body.driverBrief.base64 === "string");
  const put = async (kind: "job" | "driver", file: any, audience: string, title: string, text: string) => {
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
    if (bytes.length < 500 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error(`${kind} brief is not a PDF`);
    const path = `${siteId}/${kind}-brief.pdf`;
    const up = await admin.storage.from("jobdocs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(up.error.message);
    const doc = { id: `aegis-${kind === "job" ? "doc" : "drv"}-${aegisId}`, title, scope: "site", refId: siteId, audience,
      requireSign: true, date: new Date().toISOString(), aegis: true, body: text,
      file: { bucket: "jobdocs", path, name: kind === "job" ? "Job brief.pdf" : "Driver brief.pdf" } };
    await sql`insert into public.records (collection, id, data) values ('documents', ${doc.id}, ${sql.json(doc)})
      on conflict (collection, id) do update set data = excluded.data`;
  };
  let brief = false, driverBrief = false;
  try {
    if (body.brief && typeof body.brief.base64 === "string") {
      await put("job", body.brief, hasDriverBrief ? "team" : "all", `Job brief – ${codename}`,
        "Your job brief for this assignment. Open the PDF below and sign to confirm you have read it. Do not share, screenshot or forward it.");
      brief = true;
    }
    if (hasDriverBrief) {
      await put("driver", body.driverBrief, "driver", `Driver brief – ${codename}`,
        "Your driver brief: pick-ups, drop-offs, timings and vehicle requirements. Your run sheet is under Run Sheet in the menu. Do not share, screenshot or forward it.");
      driverBrief = true;
    } else {
      await sql`delete from public.records where collection = 'documents' and id = ${"aegis-drv-" + aegisId}`;
      await admin.storage.from("jobdocs").remove([`${siteId}/driver-brief.pdf`]);
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { siteId, shifts: ids.length, removedShifts: dropped.length, operatorsNotInApp: missing, brief, driverBrief,
    movements: site.movements.length };
}

async function jobClose(body: any) {
  const aegisId = idPart(body.aegisId);
  if (!aegisId) return { error: "aegisId is required" };
  const siteId = `aegis-job-${aegisId}`;
  const dropped = await sql`delete from public.records where collection = 'shifts' and data->>'siteId' = ${siteId}
    and (data->>'date')::date >= current_date returning id`;
  await sql`delete from public.records where collection = 'documents' and id in (${"aegis-doc-" + aegisId}, ${"aegis-drv-" + aegisId})`;
  await admin.storage.from("jobdocs").remove([`${siteId}/job-brief.pdf`, `${siteId}/driver-brief.pdf`]);
  await sql`update public.records set data = data || '{"closed": true}'::jsonb where collection = 'sites' and id = ${siteId}`;
  return { siteId, removedShifts: dropped.length };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await authorised(req))) return json({ error: "forbidden" }, 403);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  try {
    const out = body.action === "operators.sync" ? await operatorsSync(body)
      : body.action === "job.push" ? await jobPush(body)
      : body.action === "job.close" ? await jobClose(body)
      : { error: "unknown action" };
    return json(out, (out as any).error ? 400 : 200);
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
