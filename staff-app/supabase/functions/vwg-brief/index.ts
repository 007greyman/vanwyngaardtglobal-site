/* Copyright (c) 2026 Jack van Wyngaardt. All rights reserved.
 * Proprietary and confidential. Licensed to Van Wyngaardt Global Ltd. See LICENSE.txt. */
// vwg-brief: stores the VWG Intel daily brief PDF for the Staff app's "Intel Briefs" page.
//
// Called by VWG Intel (laptop now, AWS later) with header `x-vwg-push-key: <sender secret>`
// (same secret as vwg-push; only its SHA-256 is stored), body = the PDF, header
// `x-brief-title`. The file goes to the PRIVATE storage bucket `briefs`; managers open it
// through a short-lived signed link. Briefs older than KEEP_DAYS are deleted on each upload.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const KEEP_DAYS = 30;
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 2, prepare: false });
// Server-side only (function env); never sent to a browser.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = req.headers.get("x-vwg-push-key") || "";
  const [row] = await sql`select value from private.push_config where key = 'send_secret_sha256'`;
  const got = await sha256hex(key);
  let diff = got.length ^ (row?.value || "").length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (row?.value || "").charCodeAt(i);
  if (!key || diff) return json({ error: "forbidden" }, 403);

  const pdf = new Uint8Array(await req.arrayBuffer());
  if (pdf.length < 1000 || new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") return json({ error: "not a pdf" }, 400);
  const title = (req.headers.get("x-brief-title") || "VWG Intel brief").slice(0, 160);
  // Where the brief applies (e.g. "london" = London grid + UK). Operators will later only see
  // briefs for the area they're deployed in (Jack 2026-11-22).
  const area = (req.headers.get("x-brief-area") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || null;
  const now = new Date();
  const path = `${now.toISOString().slice(0, 7)}/${now.toISOString().replace(/[:.]/g, "-")}.pdf`;

  const up = await admin.storage.from("briefs").upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (up.error) return json({ error: up.error.message }, 500);
  const [b] = await sql`insert into public.briefs (title, path, size, area) values (${title}, ${path}, ${pdf.length}, ${area}) returning id`;

  // retention
  const old = await sql`delete from public.briefs where created_at < now() - make_interval(days => ${KEEP_DAYS}) returning path`;
  if (old.length) await admin.storage.from("briefs").remove(old.map((o) => o.path));

  return json({ id: b.id, path, removed: old.length });
});
