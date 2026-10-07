/* Van Wyngaardt Global — Staff app
 * Single-page, offline-first. Data is kept in this device's localStorage and, when
 * Supabase is configured in config.js, shared live between all staff phones.
 */
(function () {
  'use strict';

  // Defaults; config.js (window.VWG_CONFIG) overrides any of these.
  const CONFIG = Object.assign({
    company: 'Van Wyngaardt Global',
    shortName: 'VWG Staff',
    domain: 'vanwyngaardtglobal.com',
    version: 'v1.2.0(3)',
    currency: '£',
    supportPhone: '',
    supportPhoneOoh: '',
    supportEmail: '',
    emergencyPhone: '999',
    welfareMinutes: 60,
    siteRadiusMetres: 200,
    region: 'UK',
    startPage: 'shifts',
    loginBackground: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
  }, window.VWG_CONFIG || {}, { version: 'v1.2.0(3)' });
  const CLOUD = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  // hq.html sets VWG_HQ: the desktop console for managers. It keeps its own sign-in and
  // saved copy, so it never signs out or mixes with the staff app in the same browser.
  const HQ = !!window.VWG_HQ;
  if (HQ) CONFIG.startPage = 'hq';
  const HQ_ONLY = 'The HQ console is for managers only. Staff should use the VWG Staff app.';
  const STORE_KEY = HQ ? (CLOUD ? 'vwg-hq-cloud' : 'vwg-hq-demo') : CLOUD ? 'vwg-staff-cloud' : 'vwg-staff-v2';
  const COLORS = ['#1a1a1a', '#0b6e0b', '#b86e00', '#6b3fa0', '#b5461b', '#0e7490', '#a3195b', '#4d7c0f'];

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const randomPin = () => String(1000 + Math.floor(Math.random() * 9000));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const dayTitle = (s) => { const d = parseYmd(s); return `${DAYS[d.getDay()]} - ${dmy(d)}`; };
  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtStamp = (iso) => { const d = new Date(iso); return `${dmy(d)} ${fmtTime(d)}`; };
  const fmtDur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
  const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
  const hours = (ms) => ms / 3600000;
  const money = (n) => `${CONFIG.currency}${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const shiftMinutes = (s) => { const [a, b] = s.start.split(':').map(Number); const [c, d] = s.end.split(':').map(Number); let m = (c * 60 + d) - (a * 60 + b); if (m <= 0) m += 1440; return m; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');

  async function hashPassword(pw, salt) {
    const data = new TextEncoder().encode(`${salt}:${pw}`);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for non-secure contexts (plain http on a LAN).
    let h = 2166136261;
    for (const b of data) { h ^= b; h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }

  // ---------- Icons ----------
  const ic = (d, size = 22, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    back: '<path d="M15 4l-8 8 8 8"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    refresh: '<path d="M20 11a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6l9 7 9-7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="15.5" r="1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    log: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    send: '<path d="M4 12l16-8-6 16-2-6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  };

  // The company logo (logo.png: transparent background, made for dark backgrounds).
  function logoImg(size = 230) {
    return `<img class="logo-img" src="logo.png" style="width:${size}px" alt="${esc(CONFIG.company)} Limited">`;
  }

  const DEFAULT_AVATAR = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
    <rect width="100" height="100" fill="#fff"/>
    <path d="M14 100c2-18 16-26 36-26s34 8 36 26z" fill="#2b2b2b"/>
    <path d="M42 64h16v12a8 8 0 0 1-16 0z" fill="#f2c28f"/>
    <ellipse cx="50" cy="44" rx="19" ry="23" fill="#f7cfa0"/>
    <path d="M30 42c0-16 9-24 20-24s20 8 20 24c-3-8-9-12-20-12s-17 4-20 12z" fill="#a0621e"/>
  </svg>`;

  // ---------- Static content ----------
  const FORM_TYPES = ['Incident Report', 'Near Miss', 'Patrol Report', 'Vehicle Check', 'Lost Property', 'Maintenance Issue'];
  const SLIDES = [
    { icon: I.clock, title: 'Clock in & out', text: 'Start and finish your shift with one tap, or scan the site QR / NFC tag.' },
    { icon: I.cal, title: 'My Shifts', text: 'See your roster week by week, with site address, maps and contacts.' },
    { icon: I.log, title: 'Logs & forms', text: 'Record occurrences, report incidents and sign visitors on site.' },
    { icon: I.heart, title: 'Stay safe', text: 'Welfare checks keep lone workers safe. Help is one tap away.' },
  ];

  // ---------- Data ----------
  const emptyDb = () => ({
    version: 2, staff: [], sites: [], shifts: [], entries: [], leave: [], incidents: [], occurrences: [],
    documents: [], docReads: [], messages: [], register: [], welfare: [], trainingDone: [], resetRequests: [], training: [], support: [], staffDocs: [],
    session: null, onboarded: false,
  });
  let db = load();
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
      if (raw) { const saved = JSON.parse(raw); return migrate(Object.assign(emptyDb(), saved), saved); }
    } catch (e) {
      // Never start over silently on top of real data: keep a copy so it can be restored.
      console.error('Could not load saved data', e);
      try { if (raw) localStorage.setItem(STORE_KEY + '-backup-' + Date.now(), raw); } catch (e2) { /* storage full */ }
    }
    return emptyDb();
  }
  // Fill in fields added after data was first saved on a device.
  function migrate(d, saved = {}) {
    d.staff.forEach((s) => { if (s.licence === undefined) s.licence = ''; if (s.leaveAllowance === undefined) s.leaveAllowance = 28; if (!s.pin) s.pin = randomPin(); if (!s.compliance) s.compliance = {}; });
    if (!saved.training) d.training = defaultTraining();
    else if ((saved.trainingVersion || 1) < 2) {
      // Replace the built-in modules with the current set; keep any a manager added.
      d.training = [...defaultTraining(), ...d.training.filter((t) => !/^v\d$/.test(t.id))];
      d.trainingDone = d.trainingDone.filter((x) => !/^v\d$/.test(x.moduleId));
    }
    if (!CLOUD && (saved.trainingVersion || 1) < 3) {
      // Built-in modules gained their walkthrough videos (shared mode gets them from the database).
      const defaults = Object.fromEntries(defaultTraining().map((t) => [t.id, t.video]));
      d.training.forEach((t) => { if (!t.video && defaults[t.id]) t.video = defaults[t.id]; });
    }
    d.trainingVersion = 3;
    d.documents.forEach((x) => { if (!x.scope) { x.scope = 'company'; x.refId = null; x.requireSign = true; } });
    d.messages.forEach((m) => { if (!m.thread) m.thread = 'all'; });
    [...d.docReads, ...d.trainingDone].forEach((x) => { if (!x.id) x.id = uid(); });
    return d;
  }
  function localSave() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { toast('Could not save on this device'); } }
  function save() { localSave(); if (CLOUD) cloudSchedulePush(); }

  async function seed() {
    if (db.staff.length) return;
    const people = [
      ['VWG001', 'Jack van Wyngaardt', 'Managing Director', 'Management', true, 30],
      ['VWG002', 'Sarah Mitchell', 'Operations Manager', 'Operations', true, 20],
      ['VWG003', 'Daniel Okafor', 'Security Supervisor', 'Security', false, 15],
      ['VWG004', 'Emma Clarke', 'Security Officer', 'Security', false, 13],
      ['VWG005', 'Liam Patel', 'Security Officer', 'Security', false, 13],
    ];
    for (let i = 0; i < people.length; i++) {
      const [empNo, name, role, dept, isAdmin, rate] = people[i];
      const salt = uid();
      db.staff.push({
        id: uid(), empNo, name, role, dept, isAdmin, rate, active: true,
        email: name.split(' ')[0].toLowerCase() + '@' + CONFIG.domain,
        phone: '07700 900' + pad(100 + i).slice(-3), startDate: ymd(addDays(new Date(), -200 * (i + 1))),
        color: COLORS[i % COLORS.length], salt, pwHash: await hashPassword('Password1', salt),
        photo: null, emergency: '', address: '', leaveAllowance: 28, pin: randomPin(),
        compliance: isAdmin ? {} : { sia: { ref: '', date: ymd(addDays(new Date(), i === 4 ? 40 : 500)) }, rtw: { ref: '', date: ymd(addDays(new Date(), 900)) }, vetting: { ref: 'BS-' + (2200 + i), date: ymd(addDays(new Date(), -300)) } },
        licence: isAdmin ? '' : '1017' + String(4000000000 + i * 1234567).slice(0, 12),
      });
    }
    db.sites = [
      { id: uid(), customer: 'Northgate Logistics', name: 'Northgate Distribution Centre', address: 'Unit 4 Northgate Way', city: 'Birmingham', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-NG01', lat: 52.4862, lng: -1.8904,
        contacts: [{ name: 'Control Room', role: '24/7', phone: '0121 000 0001' }, { name: 'Mark Evans', role: 'Site Manager', phone: '0121 000 0002' }] },
      { id: uid(), customer: 'Harbour Retail Park', name: 'Harbour Gatehouse', address: '1 Harbour Road', city: 'Manchester', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-HR01', lat: 53.4808, lng: -2.2426,
        contacts: [{ name: 'Gatehouse', role: 'Front desk', phone: '0161 000 0001' }] },
      { id: uid(), customer: 'Crestwood Estates', name: 'Crestwood Tower Reception', address: '22 Crest Street', city: 'London', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-CT01', lat: 51.5074, lng: -0.1278,
        contacts: [{ name: 'Building Manager', role: 'Weekdays', phone: '020 0000 0001' }] },
    ];
    const monday = startOfWeek(new Date());
    const patterns = [['07:00', '19:00'], ['19:00', '07:00'], ['08:00', '16:00']];
    db.staff.forEach((s, i) => {
      if (i < 1) return;
      for (let d = 0; d < 14; d++) {
        if ((d + i) % 3 === 0) continue;
        const date = ymd(addDays(monday, d));
        const [start, end] = patterns[(i + d) % patterns.length];
        db.shifts.push({ id: uid(), staffId: s.id, siteId: db.sites[i % db.sites.length].id, date, start, end, notes: '', status: d < 7 ? 'confirmed' : (d % 2 ? 'confirmed' : 'pending') });
      }
    });
    // Jack also gets a shift today so the demo login has something to clock into.
    db.shifts.push({ id: uid(), staffId: db.staff[0].id, siteId: db.sites[0].id, date: ymd(new Date()), start: '07:00', end: '19:00', notes: '', status: 'confirmed' });
    [2, 4, 9].forEach((d, k) => db.shifts.push({ id: uid(), staffId: null, siteId: db.sites[k % db.sites.length].id, date: ymd(addDays(monday, d)), start: k === 1 ? '19:00' : '07:00', end: k === 1 ? '07:00' : '19:00', notes: 'Cover needed', status: 'offered' }));
    const now = new Date().toISOString();
    db.training = defaultTraining(); db.trainingVersion = 3;
    const [ng, hr, ct] = db.sites;
    db.documents = [
      { id: uid(), title: 'Code of Conduct', scope: 'company', refId: null, requireSign: true, date: now, body: 'All staff must act with honesty, integrity and professionalism.\n\n1. Treat customers, visitors and colleagues with respect.\n2. Follow all lawful instructions from supervisors.\n3. Never consume alcohol or drugs before or during a shift.\n4. Keep all site information confidential.' },
      { id: uid(), title: 'Uniform & Appearance', scope: 'company', refId: null, requireSign: false, date: now, body: 'Full company uniform must be worn on every shift, including your ID badge and hi-vis where required. Uniform must be clean and in good repair.' },
      { id: uid(), title: 'Emergency Procedures', scope: 'company', refId: null, requireSign: true, date: now, body: `In an emergency:\n\n1. Make yourself safe.\n2. Call ${CONFIG.emergencyPhone}.\n3. Inform the site control room.\n4. Record everything in the Occurrence Log as soon as it is safe to do so.` },
      { id: uid(), title: 'Customer Service Standards', scope: 'customer', refId: ng.customer, requireSign: false, date: now, body: 'Greet every driver and visitor. Check paperwork against the delivery schedule before opening any gate.' },
      { id: uid(), title: 'Assignment Instructions', scope: 'site', refId: ng.id, requireSign: true, date: now, body: 'Patrol the perimeter every 2 hours, scanning each checkpoint QR code. Gate 2 is locked from 22:00 to 06:00. All vehicles must be logged on the sign-on register.' },
      { id: uid(), title: 'Site Map', scope: 'site', refId: hr.id, requireSign: false, date: now, body: 'Gatehouse at the main entrance on Harbour Road. Service yard behind Units 3–6. Fire assembly point: car park row A.' },
      { id: uid(), title: 'Reception Camera Systems', scope: 'site', refId: ct.id, requireSign: false, date: now, body: 'CCTV monitors are at the reception desk. Recording is retained for 30 days. Only the building manager may export footage.' },
    ];
    db.messages.push({ id: uid(), staffId: db.staff[1].id, thread: 'all', text: `Morning team 👋 Welcome to the new ${CONFIG.shortName} app. Please check your shifts for the next two weeks.`, time: now });
    save();
  }

  // ---------- Selectors ----------
  const me = () => db.staff.find((s) => s.id === db.session);
  const staffById = (id) => db.staff.find((s) => s.id === id);
  const siteById = (id) => db.sites.find((s) => s.id === id);
  const openEntry = (staffId) => db.entries.find((e) => e.staffId === staffId && !e.clockOut);
  const onBreak = (e) => e && e.breaks.some((b) => !b.end);
  function entryWorkedMs(e, now = Date.now()) {
    let ms = (e.clockOut ? new Date(e.clockOut).getTime() : now) - new Date(e.clockIn).getTime();
    for (const b of e.breaks) ms -= (b.end ? new Date(b.end).getTime() : now) - new Date(b.start).getTime();
    return Math.max(0, ms);
  }
  const entryBreakMs = (e, now = Date.now()) => e.breaks.reduce((t, b) => t + ((b.end ? new Date(b.end).getTime() : now) - new Date(b.start).getTime()), 0);
  const workedBetween = (staffId, from, to) => db.entries.filter((e) => e.staffId === staffId && new Date(e.clockIn) >= from && new Date(e.clockIn) < to).reduce((t, e) => t + entryWorkedMs(e), 0);
  const byStart = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);
  const weekRange = () => { const from = addDays(startOfWeek(new Date()), ui.weekOffset * 7); return [from, addDays(from, 7)]; };
  const inWeek = (s) => { const [from, to] = weekRange(); return s.date >= ymd(from) && s.date < ymd(to); };
  function lastWelfare(staffId) {
    return db.welfare.filter((w) => w.staffId === staffId).sort((a, b) => b.time.localeCompare(a.time))[0];
  }
  function welfareDue(staffId) {
    const e = openEntry(staffId);
    if (!e) return false;
    const last = lastWelfare(staffId);
    const since = Math.max(new Date(e.clockIn).getTime(), last ? new Date(last.time).getTime() : 0);
    return Date.now() - since > CONFIG.welfareMinutes * 60000;
  }

  // ---------- UI state ----------
  const ui = { route: CONFIG.startPage, params: {}, stack: [], drawer: false, slide: 0, weekOffset: 0, tsRange: 'week', adminTab: 'live', showPw: false, supportTyping: false, leaveMonth: 0, formQ: '', docTab: 'site', docQ: '', msgQ: '', regDay: null, regSite: null };
  let ticker = null;
  let scanStop = null;

  function go(route, params = {}, push = true) {
    if (push) ui.stack.push({ route: ui.route, params: ui.params });
    else ui.stack = [];
    ui.route = route; ui.params = params; ui.drawer = false;
    render(); window.scrollTo(0, 0);
  }
  function back() {
    const prev = ui.stack.pop() || { route: CONFIG.startPage, params: {} };
    ui.route = prev.route; ui.params = prev.params; render(); window.scrollTo(0, 0);
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function openSheet(html, onSubmit) {
    const root = $('#sheet-root');
    root.innerHTML = `<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div></div>`;
    const bd = root.firstElementChild;
    bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-dismiss]')) closeSheet(); });
    const form = root.querySelector('form');
    if (form && onSubmit) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        form.querySelectorAll('input[type=checkbox]').forEach((c) => { data[c.name] = c.checked; });
        const err = await onSubmit(data, form);
        if (err) { const el = form.querySelector('.error'); if (el) el.textContent = err; return; }
        closeSheet();
      });
    }
    return root;
  }
  function closeSheet() {
    if (scanStop) { scanStop(); scanStop = null; }
    $('#sheet-root').innerHTML = '';
    if (CLOUD && cloud.renderWanted) { cloud.renderWanted = false; setTimeout(requestRender); }
  }

  // ---------- Chrome ----------
  function topbar(title, { left = 'menu', right = '' } = {}) {
    const l = left === 'back'
      ? `<button class="tb-btn" data-action="back">${ic(I.back, 24)}Back</button>`
      : `<button class="tb-btn" data-action="open-drawer" aria-label="Menu">${ic(I.menu, 26)}</button>`;
    return `<header class="topbar"><div class="topbar-inner">${l}<h1${title.length > 22 ? ' style="font-size:16px"' : ''}>${esc(title)}</h1><div class="tb-right">${right}</div></div></header>`;
  }
  const refreshBtn = `<button class="tb-btn" data-action="refresh" aria-label="Refresh">${ic(I.refresh, 24, 2.4)}</button>`;
  function weekNav() {
    const [from] = weekRange(); const to = addDays(from, 6);
    return `<div class="weeknav"><button class="arrow" data-action="week-prev" aria-label="Previous week">${ic(I.left, 26, 2.6)}</button>
      <div class="week-pill">${MON[from.getMonth()]} ${pad(from.getDate())} - ${MON[to.getMonth()]} ${pad(to.getDate())}</div>
      <button class="arrow" data-action="week-next" aria-label="Next week">${ic(I.right, 26, 2.6)}</button></div>`;
  }
  const statusPill = (s) => `<span class="status st-${slug(s)}">${esc(cap(s))}</span>`;
  function avatarImg(s) { return s.photo ? `<img src="${s.photo}" alt="">` : DEFAULT_AVATAR; }
  function avatar(s) { return `<div class="avatar" style="background:${s.color}">${s.photo ? `<img src="${s.photo}" alt="">` : initials(s.name)}</div>`; }

  const MENU = [
    ['occurrence', 'Occurrence Log'], ['shifts', 'My Shifts'], ['offered', 'Offered Shifts'],
    ['leave', 'Submit Leave'], ['forms', 'Incident / Forms'], ['docs', 'Document Library'], ['messages', 'Team Message'],
    ['register', 'Electronic Sign On Register'], ['welfare', 'Welfare Check'], ['support', 'VWG Support'],
    ['profile', 'My Profile'], ['training', 'Training Module'], ['home', 'Dashboard'], ['timesheet', 'My Timesheet'],
  ];
  function drawer() {
    const u = me(); const e = openEntry(u.id);
    return `<div class="drawer-wrap"><div class="drawer-inner">
      <div class="drawer-shade" data-action="close-drawer"></div>
      <button class="drawer-close" data-action="close-drawer" aria-label="Close menu">${ic(I.menu, 26)}</button>
      <nav class="drawer">
        <div class="drawer-head backdrop-art">
          <div class="avatar-wrap">
            <div class="avatar-big">${avatarImg(u)}</div>
            <label class="cam" aria-label="Change photo">${ic(I.camera, 18)}<input type="file" accept="image/*" id="photo-input" hidden></label>
          </div>
          <div class="head-btns">
            <button class="btn-gold-sq ${e ? 'live' : ''}" data-action="${e ? 'clock-out' : 'clock-in'}">${e ? 'CLOCK OUT' : 'CLOCK IN'}</button>
            <button class="btn-gold-sq" data-action="scan">QR / NFC</button>
          </div>
          <div class="head-status" id="head-status">${e ? `On shift · <span id="drawer-elapsed">${fmtClock(entryWorkedMs(e))}</span>` : esc(u.name)}</div>
        </div>
        <div class="menu">
          ${MENU.map(([r, label]) => `<button class="menu-item ${ui.route === r ? 'on' : ''}" data-nav="${r}"><span>${label}</span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>`).join('')}
          ${u.isAdmin ? `<button class="menu-item ${ui.route === 'admin' ? 'on' : ''}" data-nav="admin"><span>Admin Dashboard</span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>` : ''}
          <button class="menu-item danger" data-action="logout"><span>Sign Out</span></button>
        </div>
        <div class="menu-version">${CONFIG.version} - ${esc(CONFIG.region)}</div>
      </nav>
    </div></div>`;
  }

  // ---------- Pre-login screens ----------
  function viewOnboarding() {
    const last = ui.slide === SLIDES.length - 1;
    return `<div class="onboard backdrop-art">
      <div class="onboard-top"><button class="skip" data-action="finish-onboard">Skip</button></div>
      <div class="slides" id="slides"><div class="slides-track" style="transform:translateX(-${ui.slide * 100}%)">
        ${SLIDES.map((s, i) => `<div class="slide">${i === 0 ? logoImg(210) : `<div class="slide-art">${ic(s.icon, 76, 1.6)}</div>`}<h2 style="margin-top:${i === 0 ? 34 : 0}px">${s.title}</h2><p>${s.text}</p></div>`).join('')}
      </div></div>
      <div class="dots">${SLIDES.map((_, i) => `<span class="dot ${i === ui.slide ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn-pill" data-action="${last ? 'finish-onboard' : 'next-slide'}">${last ? 'Get Started' : 'Next'}</button>
    </div>`;
  }

  function viewLogin() {
    return `<div class="login backdrop-art">
      ${logoImg(230)}
      <h1>Welcome to ${esc(CONFIG.company)}</h1>
      <p class="lead">Sign in below to get started</p>
      <form id="login-form" autocomplete="on">
        <label class="pill-input">${ic(I.mail, 26, 1.4)}<input id="email" name="email" type="email" placeholder="Email Address" autocomplete="username" autocapitalize="off" required></label>
        <label class="pill-input">${ic(I.lock, 24, 1.5)}<input id="password" name="password" type="${ui.showPw ? 'text' : 'password'}" placeholder="Password" autocomplete="current-password" required>
          <button type="button" class="eye" data-action="toggle-pw" aria-label="Show password">${ic(ui.showPw ? I.eye : I.eyeOff, 24, 1.8)}</button></label>
        <div class="error" id="login-error"></div>
        <button class="btn-pill" type="submit">Sign In</button>
      </form>
      <button class="forgot" data-action="forgot">Forgot Password</button>
      <div class="or">OR</div>
      <button class="btn-pill" data-action="domain-login">Log In with Domain</button>
      <div class="version">${CONFIG.version}</div>
      ${CLOUD ? '' : `<div class="demo-hint">Demo: <b>jack@${CONFIG.domain}</b> (admin) or <b>emma@${CONFIG.domain}</b> · password <b>Password1</b></div>`}
    </div>`;
  }

  // ---------- Home ----------
  function viewHome() {
    const u = me(); const e = openEntry(u.id); const now = new Date();
    const today = db.shifts.filter((s) => s.staffId === u.id && s.date === ymd(now)).sort(byStart)[0];
    const next = db.shifts.filter((s) => s.staffId === u.id && s.date >= ymd(now)).sort(byStart).slice(0, 3);
    const wk = startOfWeek(now);
    const offered = db.shifts.filter((s) => s.status === 'offered' && s.date >= ymd(now)).length;
    const due = welfareDue(u.id);
    const status = !e ? 'Clocked out' : onBreak(e) ? 'On break' : `On shift${e.siteId ? ' · ' + esc(siteById(e.siteId)?.name || '') : ''}`;
    const tile = (r, icon, label) => `<button class="tile" data-nav="${r}"><span class="ti">${ic(icon, 22)}</span>${label}</button>`;
    return topbar('Dashboard') + `<div class="page">
      <div class="dash-hero backdrop-art">
        <div class="dash-time" id="live-time">${fmtTime(now)}</div>
        <div class="dash-date">${DAYS[now.getDay()]} - ${dmy(now)}</div>
        <div class="dash-status"><span class="dot-live" style="background:${e ? '#1f9d63' : '#9ca3af'}"></span>${status}${e ? ` · <b id="elapsed">${fmtClock(entryWorkedMs(e))}</b>` : ''}</div>
        <div class="head-btns" style="margin-top:18px">
          ${e ? `<button class="btn-gold-sq" data-action="${onBreak(e) ? 'break-end' : 'break-start'}">${onBreak(e) ? 'END BREAK' : 'BREAK'}</button><button class="btn-gold-sq live" data-action="clock-out">CLOCK OUT</button>`
            : '<button class="btn-gold-sq" data-action="clock-in">CLOCK IN</button>'}
          <button class="btn-gold-sq" data-action="scan">QR / NFC</button>
        </div>
      </div>
      <div class="pad">
        ${due ? `<button class="card" data-nav="welfare" style="width:100%;text-align:left;border-left:5px solid var(--amber)"><b>Welfare check due</b><div class="small muted">Tap to confirm you are OK</div></button>` : ''}
        <div class="stats">
          <div class="stat"><b>${hours(workedBetween(u.id, wk, addDays(wk, 7))).toFixed(1)}</b><span>Hours this week</span></div>
          <div class="stat"><b>${db.shifts.filter((s) => s.staffId === u.id && s.date >= ymd(wk) && s.date < ymd(addDays(wk, 7))).length}</b><span>Shifts this week</span></div>
          <div class="stat"><b>${offered}</b><span>Offered shifts</span></div>
        </div>
        ${today ? `<div class="small muted" style="margin:4px 4px 6px">TODAY</div>${shiftCard(today)}` : ''}
        <div class="tiles" style="padding:0 0 12px">
          ${tile('shifts', I.cal, 'My Shifts')}${tile('occurrence', I.log, 'Occurrence Log')}${tile('forms', I.shield, 'Incident / Forms')}
          ${tile('messages', I.chat, 'Team Message')}${tile('welfare', I.heart, 'Welfare Check')}${tile('register', I.user, 'Sign On Register')}
        </div>
        <div class="small muted" style="margin:4px 4px 6px">UPCOMING</div>
        ${next.length ? next.map(shiftCard).join('') : '<div class="empty">No upcoming shifts</div>'}
      </div></div>`;
  }

  // ---------- Shifts ----------
  function shiftCard(s) {
    const site = siteById(s.siteId) || {};
    return `<button class="shift-card" data-nav="shift" data-id="${s.id}">
      <div class="body">
        <div class="d">${dayTitle(s.date)}</div>
        <div class="t">${s.start} - ${s.end}</div>
        <div class="l">Customer : ${esc(site.customer || '-')}</div>
        <div class="l">Site : ${esc(site.name || '-')}</div>
        <div class="s">Status : ${statusPill(s.status)}</div>
      </div><span class="chev">${ic(I.right, 28, 1.6)}</span></button>`;
  }

  function viewShifts() {
    const list = db.shifts.filter((s) => s.staffId === db.session && inWeek(s)).sort(byStart);
    return topbar('My Shifts') + weekNav() + `<div class="page">${list.length ? `<div class="pad">${list.map(shiftCard).join('')}</div>` : '<div class="empty-state">No Shifts scheduled this week.</div>'}</div>`;
  }

  function viewOffered() {
    const list = db.shifts.filter((s) => s.status === 'offered' && !s.staffId && inWeek(s)).sort(byStart);
    return topbar('Offered Shifts', { right: refreshBtn }) + weekNav() + `<div class="page white">${list.length ? `<div class="pad">${list.map(shiftCard).join('')}</div>` : '<div class="empty-state">No Offered Shifts available right now.</div>'}</div>`;
  }

  function viewShift() {
    const s = db.shifts.find((x) => x.id === ui.params.id);
    if (!s) return topbar('My Roster Detail', { left: 'back' }) + '<div class="page white"><div class="empty-state">This shift is no longer available.</div></div>';
    const site = siteById(s.siteId) || {};
    const u = me();
    const isMine = s.staffId === u.id;
    const isToday = s.date === ymd(new Date());
    const e = openEntry(u.id);
    const q = encodeURIComponent([site.address, site.city, site.region, site.country].filter(Boolean).join(', '));
    let actions = '';
    if (s.status === 'offered' && !s.staffId) actions = `<button class="btn btn-gold btn-block" data-action="accept-shift" data-id="${s.id}">Accept Shift</button>`;
    else if (isMine && isToday && !e) actions = `<button class="btn btn-gold btn-block" data-action="clock-in" data-id="${s.id}">Clock In to this Shift</button>`;
    else if (isMine && e && e.shiftId === s.id) actions = `<button class="btn btn-red btn-block" data-action="clock-out">Clock Out</button>`;
    if (isMine && s.date >= ymd(new Date()) && !(e && e.shiftId === s.id)) actions += `<button class="btn btn-ghost btn-block" data-action="release-shift" data-id="${s.id}" style="margin-top:10px">Offer Shift for Cover</button>`;
    return topbar(isMine || s.staffId ? 'My Roster Detail' : 'Offered Shift', { left: 'back' }) + `<div class="page white">
      <div class="section"><div class="body">
        <div class="d">${dayTitle(s.date)}</div>
        <div class="d">${s.start} - ${s.end}</div>
        <div class="l">Customer : ${esc(site.customer || '-')}</div>
        <div class="l">Site : ${esc(site.name || '-')}</div>
        <div class="l" style="margin-top:10px">Status : ${statusPill(s.status)}</div>
      </div></div>
      <div class="section"><div class="body"><h3>Notes</h3><p>${esc(s.notes || '-')}</p></div></div>
      <a class="section" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener"><div class="body">
        <h3>Open in Maps</h3>
        <p>Address : ${esc(site.address || '-')}</p><p>City : ${esc(site.city || '-')}</p><p>State : ${esc(site.region || '-')}</p><p>Country : ${esc(site.country || '-')}</p>
      </div><span class="chev">${ic(I.right, 28, 1.6)}</span></a>
      <button class="section" data-action="contacts" data-id="${site.id || ''}"><div class="body"><h3>View Contacts</h3><p>Check Available Contacts</p></div><span class="chev">${ic(I.right, 28, 1.6)}</span></button>
      ${actions ? `<div class="pad" style="padding-top:18px">${actions}</div>` : ''}
    </div>`;
  }

  // ---------- Occurrence log ----------
  function viewOccurrence() {
    const list = db.occurrences.slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 100);
    return topbar('Occurrence Log', { right: `<button class="tb-btn" data-action="occ-new" aria-label="Add entry">${ic(I.plus, 26)}</button>` }) + `<div class="page"><div class="pad">
      <button class="btn btn-gold btn-block" data-action="occ-new" style="margin-bottom:12px">${ic(I.plus, 18)}New Entry</button>
      ${list.length ? `<div class="card">${list.map((o) => { const s = staffById(o.staffId); const site = siteById(o.siteId); return `<div class="item"><div class="item-main"><div class="item-title">${esc(o.text)}</div><div class="item-sub">${fmtStamp(o.time)} · ${esc(s?.name || 'Unknown')}${site ? ' · ' + esc(site.name) : ''}</div></div>${o.kind !== 'note' ? `<span class="status st-${o.kind === 'checkpoint' ? 'offered' : 'low'}">${cap(o.kind)}</span>` : ''}</div>`; }).join('')}</div>` : '<div class="empty">No entries yet.</div>'}
    </div></div>`;
  }
  function addOccurrence(text, kind = 'note', siteId = null) {
    const e = openEntry(db.session);
    db.occurrences.push({ id: uid(), staffId: db.session, siteId: siteId || e?.siteId || null, time: new Date().toISOString(), text, kind });
  }

  // ---------- Leave ----------
  const leaveDays = (l) => Math.round((parseYmd(l.to) - parseYmd(l.from)) / 86400000) + 1;
  function leaveBalance(u) {
    const year = String(new Date().getFullYear());
    const used = db.leave.filter((l) => l.staffId === u.id && l.status === 'approved' && /annual/i.test(l.type) && l.from.startsWith(year)).reduce((t, l) => t + leaveDays(l), 0);
    return (u.leaveAllowance || 0) - used;
  }
  function viewLeave() {
    const u = me();
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + ui.leaveMonth);
    const y = base.getFullYear(); const m = base.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    const mine = db.leave.filter((l) => l.staffId === u.id && l.status !== 'declined');
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell"></div>');
    for (let d = 1; d <= count; d++) {
      const key = ymd(new Date(y, m, d));
      const l = mine.find((x) => key >= x.from && key <= x.to);
      const cls = l ? (l.status === 'approved' ? 'lv-approved' : 'lv-pending') : '';
      cells.push(`<button class="cal-cell" data-action="leave-day" data-date="${key}"><span class="cal-num ${cls} ${key === ymd(new Date()) ? 'today' : ''}">${d}</span></button>`);
    }
    while (cells.length % 7) cells.push('<div class="cal-cell"></div>');
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(`<div class="cal-row">${cells.slice(i, i + 7).join('')}</div>`);
    const list = db.leave.filter((l) => l.staffId === u.id).sort((a, b) => b.from.localeCompare(a.from));
    return topbar('Submit Leave', { right: refreshBtn }) + `<div class="page white">
      <div class="cal-head"><button data-action="month-prev">Previous</button><b>${MON[m].toUpperCase()} ${y}</b><button data-action="month-next">Next</button></div>
      <div class="cal-dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
      ${rows.join('')}
      <div class="legend">
        <h3>Draft / For Approval</h3><div class="lg"><span class="lg-dot"></span>Leave</div>
        <h3>Approved</h3><div class="lg"><span class="lg-dot filled"></span>Leave</div>
        <h3>Fixed Leave Balance</h3><div class="lg">${leaveBalance(u).toFixed(2)} Days</div>
      </div>
      <p class="small muted" style="margin:14px 16px 0">Tap a date to request leave.</p>
      ${list.length ? `<div class="pad" style="padding-top:0"><h3 style="margin:6px 4px">My Requests</h3><div class="card">${list.map((l) => leaveRow(l)).join('')}</div></div>` : ''}
    </div>`;
  }
  function leaveRow(l, admin = false) {
    const who = admin ? staffById(l.staffId) : null;
    const days = leaveDays(l);
    return `<div class="item"><div class="item-main"><div class="item-title">${who ? esc(who.name) + ' · ' : ''}${esc(l.type)} · ${days} day${days > 1 ? 's' : ''}</div>
      <div class="item-sub">${dmy(parseYmd(l.from))} - ${dmy(parseYmd(l.to))}${l.reason ? ' · ' + esc(l.reason) : ''}</div></div>
      ${admin && l.status === 'pending' ? approveBtns('leave', l.id) : statusPill(l.status)}</div>`;
  }
  const approveBtns = (kind, id) => `<div class="row" style="flex:0 0 auto;gap:6px"><button class="btn btn-green btn-sm" data-action="${kind}-approve" data-id="${id}">✓</button><button class="btn btn-red btn-sm" data-action="${kind}-decline" data-id="${id}">✕</button></div>`;
  function sheetLeave(date) {
    const existing = db.leave.find((l) => l.staffId === db.session && l.status !== 'declined' && date >= l.from && date <= l.to);
    if (existing) {
      openSheet(`<h2>${esc(existing.type)}</h2>
        <p style="margin-top:0">${dmy(parseYmd(existing.from))} - ${dmy(parseYmd(existing.to))} · ${leaveDays(existing)} day(s)</p>
        <p>Status : ${statusPill(existing.status)}</p>${existing.reason ? `<p class="muted">${esc(existing.reason)}</p>` : ''}
        ${existing.status === 'pending' ? `<button class="btn btn-red btn-block" data-action="leave-cancel" data-id="${existing.id}">Cancel Request</button>` : ''}
        <button class="btn btn-ghost btn-block" data-dismiss style="margin-top:10px">Close</button>`);
      return;
    }
    openSheet(`<h2>Request Leave</h2><form class="form">
      <div class="field"><label>Leave type</label><select class="input" name="type"><option>Annual Leave</option><option>Sick Leave</option><option>Compassionate Leave</option><option>Unpaid Leave</option><option>Training</option><option>Unavailability</option></select></div>
      <div class="row"><div class="field"><label>From</label><input class="input" type="date" name="from" value="${date}" required></div>
      <div class="field"><label>To</label><input class="input" type="date" name="to" value="${date}" required></div></div>
      <div class="field"><label>Reason</label><textarea class="input" name="reason" placeholder="Optional"></textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Submit Leave</button></form>`, (d) => {
      if (d.to < d.from) return 'End date is before start date';
      if (db.leave.some((l) => l.staffId === db.session && l.status !== 'declined' && d.from <= l.to && d.to >= l.from)) return 'You already have leave booked on those dates';
      db.leave.push({ id: uid(), staffId: db.session, type: d.type, from: d.from, to: d.to, reason: d.reason.trim(), status: 'pending', created: new Date().toISOString() });
      save(); render(); toast('Leave request submitted');
    });
  }

  // ---------- Forms ----------
  const formRef = (i) => i.ref || 'F' + String(db.incidents.indexOf(i) + 1).padStart(5, '0');
  function viewForms() {
    const u = me(); const q = ui.formQ.trim().toLowerCase();
    const list = db.incidents.filter((i) => u.isAdmin || i.staffId === u.id)
      .filter((i) => { if (!q) return true; const site = siteById(i.siteId) || {}; return [i.form, i.title, formRef(i), site.name, site.customer, site.city, site.address].join(' ').toLowerCase().includes(q); })
      .sort((a, b) => b.time.localeCompare(a.time));
    return topbar('Incident / Forms', { right: `<button class="tb-btn" data-action="form-pick">Add</button>` }) + `<div class="page white">
      <div class="searchbar">${ic(I.search, 22)}<input id="form-q" placeholder="Location, Site, ID, or Form Name" value="${esc(ui.formQ)}" autocomplete="off"></div>
      <div id="form-list">${list.map((i) => incidentSection(i, u.isAdmin)).join('')}</div>
    </div>`;
  }
  function incidentSection(i, admin) {
    const site = siteById(i.siteId); const who = staffById(i.staffId);
    return `<div class="section"><div class="body">
      <h3>${esc(i.form)}</h3><p>${esc(i.title)}</p>
      <p class="l">ID : ${formRef(i)} · ${fmtStamp(i.time)}</p>
      <p class="l">Site : ${esc(site?.name || '-')}${admin && who ? ` · ${esc(who.name)}` : ''}</p>
      <p class="l">${esc(i.details)}</p>
      <p class="l" style="margin-top:8px">Status : ${statusPill(i.status)} <span class="small muted">${esc(cap(i.severity))} priority</span></p>
    </div>${admin && i.status === 'open' ? `<button class="btn btn-green btn-sm" data-action="incident-resolve" data-id="${i.id}">Resolve</button>` : ''}</div>`;
  }
  function incidentRow(i, admin = false) {
    const site = siteById(i.siteId); const who = admin ? staffById(i.staffId) : null;
    return `<div class="item"><div class="item-main"><div class="item-title">${formRef(i)} · ${esc(i.form)} · ${esc(i.title)}</div>
      <div class="item-sub">${fmtStamp(i.time)}${site ? ' · ' + esc(site.name) : ''}${who ? ' · ' + esc(who.name) : ''} · ${esc(cap(i.severity))} priority</div>
      <div class="small" style="margin-top:4px">${esc(i.details)}</div></div>
      ${admin && i.status === 'open' ? `<button class="btn btn-green btn-sm" data-action="incident-resolve" data-id="${i.id}">Resolve</button>` : statusPill(i.status)}</div>`;
  }
  const siteOptions = (sel) => `<option value="">— None —</option>` + db.sites.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  function sheetFormPick() {
    openSheet(`<h2>Select Form</h2>${FORM_TYPES.map((t) => `<button class="menu-item" data-action="form-new" data-type="${esc(t)}"><span>${esc(t)}</span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>`).join('')}
      <button class="btn btn-ghost btn-block" data-dismiss style="margin-top:14px">Cancel</button>`);
  }
  function sheetForm(type) {
    const e = openEntry(db.session);
    const now = new Date();
    openSheet(`<h2>${esc(type)}</h2><form class="form">
      <div class="field"><label>Site</label><select class="input" name="siteId">${siteOptions(e?.siteId)}</select></div>
      <div class="row"><div class="field"><label>Date</label><input class="input" type="date" name="date" value="${ymd(now)}" required></div>
      <div class="field"><label>Time</label><input class="input" type="time" name="time" value="${fmtTime(now)}" required></div></div>
      <div class="field"><label>Title</label><input class="input" name="title" required placeholder="Short summary"></div>
      <div class="field"><label>Priority</label><select class="input" name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
      <div class="field"><label>Details</label><textarea class="input" name="details" required placeholder="What happened, who was involved, action taken"></textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Submit</button></form>`, (d) => {
      const time = new Date(`${d.date}T${d.time}`).toISOString();
      const ref = 'F' + String(db.incidents.length + 1).padStart(5, '0');
      db.incidents.push({ id: uid(), ref, staffId: db.session, form: type, siteId: d.siteId || null, time, title: d.title.trim(), severity: d.severity, details: d.details.trim(), status: 'open' });
      addOccurrence(`${type} ${ref} submitted: ${d.title.trim()}`, 'form', d.siteId || null);
      save(); render(); toast(`${type} ${ref} submitted`);
    });
  }

  // ---------- Documents ----------
  const DOC_TABS = [['shift', 'Shift Docs'], ['company', 'Company'], ['customer', 'Customer'], ['site', 'Site']];
  function docHeading(d) {
    if (d.scope === 'site') return siteById(d.refId)?.name || 'Site';
    if (d.scope === 'customer') return d.refId || 'Customer';
    return CONFIG.company;
  }
  const docSigned = (d) => db.docReads.some((r) => r.docId === d.id && r.staffId === db.session);
  const docStatus = (d) => !d.requireSign ? 'View Only' : docSigned(d) ? 'Signed' : 'Signature Required';
  function docsForTab(tab) {
    if (tab !== 'shift') return db.documents.filter((d) => d.scope === tab);
    // Shift docs: documents for the sites and customers of my shifts from today onwards.
    const today = ymd(new Date());
    const sites = new Set(db.shifts.filter((s) => s.staffId === db.session && s.date >= today).map((s) => s.siteId));
    const customers = new Set([...sites].map((id) => siteById(id)?.customer).filter(Boolean));
    return db.documents.filter((d) => (d.scope === 'site' && sites.has(d.refId)) || (d.scope === 'customer' && customers.has(d.refId)));
  }
  function viewDocs() {
    const u = me(); const q = ui.docQ.trim().toLowerCase();
    const list = docsForTab(ui.docTab).filter((d) => !q || [d.title, docHeading(d), d.body].join(' ').toLowerCase().includes(q));
    return topbar('Document Library', { right: u.isAdmin ? `<button class="tb-btn" data-action="doc-new">Add</button>` : '' }) + `<div class="page white">
      <div class="tabs">${DOC_TABS.map(([k, label]) => `<button class="${ui.docTab === k ? 'on' : ''}" data-doctab="${k}">${label}</button>`).join('')}</div>
      <div class="pad" style="padding-bottom:4px"><input class="keyword" id="doc-q" placeholder="Enter Keyword here..." value="${esc(ui.docQ)}" autocomplete="off"></div>
      <div id="doc-list">${list.length ? list.map((d) => `<button class="section" data-nav="doc" data-id="${d.id}"><div class="body">
        <h3 style="margin:10px 0 12px">${esc(docHeading(d))}</h3><p style="font-size:17px">${esc(d.title)}</p>
        <p class="l">Status : &nbsp;<b>${docStatus(d)}</b></p></div><span class="chev">${ic(I.right, 22, 1.6)}</span></button>`).join('') : '<div class="empty" style="padding-top:30vh">No documents found.</div>'}</div>
    </div>`;
  }
  function viewDoc() {
    const d = db.documents.find((x) => x.id === ui.params.id);
    if (!d) return topbar('Document', { left: 'back' }) + '<div class="page white"><div class="empty-state">Document not found.</div></div>';
    const u = me();
    const r = db.docReads.find((x) => x.docId === d.id && x.staffId === u.id);
    return topbar('Document', { left: 'back' }) + `<div class="page white"><div class="pad">
      <div class="small muted">${esc(docHeading(d))}</div>
      <h2 style="margin:4px 0 2px">${esc(d.title)}</h2><div class="small muted" style="margin-bottom:14px">Updated ${dmy(new Date(d.date))} · ${docStatus(d)}</div>
      <div class="doc-body">${esc(d.body)}</div>
      ${d.requireSign ? `<div style="margin-top:24px">${r ? `<div class="muted small">✓ You signed this on ${fmtStamp(r.time)}</div>` : `<button class="btn btn-gold btn-block" data-action="doc-read" data-id="${d.id}">I have read and understood</button>`}</div>` : ''}
      ${u.isAdmin ? `<div class="small muted" style="margin-top:18px">${d.requireSign ? `Signed by ${db.docReads.filter((x) => x.docId === d.id).length} of ${db.staff.filter((s) => s.active).length} staff` : ''}</div>
        <button class="btn btn-ghost btn-block" style="margin-top:10px;color:var(--red)" data-action="doc-delete" data-id="${d.id}">${ic(I.trash, 18)}Delete document</button>` : ''}
    </div></div>`;
  }
  function sheetDocNew() {
    const customers = [...new Set(db.sites.map((s) => s.customer))];
    openSheet(`<h2>Add Document</h2><form class="form">
      <div class="field"><label>Title</label><input class="input" name="title" required></div>
      <div class="field"><label>Library</label><select class="input" name="scope" id="doc-scope"><option value="company">Company</option><option value="customer">Customer</option><option value="site">Site</option></select></div>
      <div class="field" id="doc-cust" hidden><label>Customer</label><select class="input" name="customer">${customers.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field" id="doc-site" hidden><label>Site</label><select class="input" name="siteId">${db.sites.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Content</label><textarea class="input" name="body" style="height:180px" required></textarea></div>
      <label class="check"><input type="checkbox" name="requireSign">Staff must sign "read and understood"</label>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Publish</button></form>`, (d) => {
      const refId = d.scope === 'site' ? d.siteId : d.scope === 'customer' ? d.customer : null;
      if (d.scope !== 'company' && !refId) return 'Choose where this document belongs';
      db.documents.unshift({ id: uid(), title: d.title.trim(), scope: d.scope, refId, requireSign: !!d.requireSign, body: d.body, date: new Date().toISOString() });
      ui.docTab = d.scope; save(); render(); toast('Document published');
    });
    const sel = $('#doc-scope');
    sel.addEventListener('change', () => { $('#doc-cust').hidden = sel.value !== 'customer'; $('#doc-site').hidden = sel.value !== 'site'; });
  }

  // ---------- Team message ----------
  function threadsFor(u) {
    const list = [{ id: 'all', name: `All Staff`, kind: 'group' }];
    db.sites.forEach((s) => list.push({ id: 'site:' + s.id, name: s.name, kind: 'site' }));
    db.staff.filter((s) => s.active && s.id !== u.id).forEach((s) => list.push({ id: 'dm:' + [u.id, s.id].sort().join(':'), name: s.name, kind: 'dm', staff: s }));
    return list.map((t) => {
      const msgs = db.messages.filter((m) => (m.thread || 'all') === t.id);
      return { ...t, last: msgs.sort((a, b) => b.time.localeCompare(a.time))[0], count: msgs.length };
    });
  }
  function threadName(id) {
    if (id === 'all') return 'All Staff';
    if (id.startsWith('site:')) return siteById(id.slice(5))?.name || 'Site';
    const other = id.split(':').slice(1).find((x) => x !== db.session);
    return staffById(other)?.name || 'Direct Message';
  }
  function viewMessages() {
    const u = me(); const q = ui.msgQ.trim().toLowerCase();
    let list = threadsFor(u);
    list = q ? list.filter((t) => t.name.toLowerCase().includes(q) || db.messages.some((m) => (m.thread || 'all') === t.id && m.text.toLowerCase().includes(q)))
      : list.filter((t) => t.count || t.kind !== 'dm');
    list.sort((a, b) => (b.last?.time || '').localeCompare(a.last?.time || ''));
    const icon = (t) => t.kind === 'dm' ? avatar(t.staff) : `<div class="avatar" style="background:var(--brand);color:var(--gold-light)">${ic(t.kind === 'site' ? I.shield : I.chat, 20)}</div>`;
    return topbar('Team Message', { right: refreshBtn }) + `<div class="page white">
      <div class="searchbar flush">${ic(I.search, 22)}<input id="msg-q" value="${esc(ui.msgQ)}" autocomplete="off" aria-label="Search people, sites or messages"></div>
      <div id="msg-list">${list.map((t) => `<button class="thread" data-nav="thread" data-id="${t.id}">${icon(t)}<div class="item-main"><div class="item-title">${esc(t.name)}</div>
        <div class="item-sub">${t.last ? esc((t.last.staffId === u.id ? 'You: ' : '') + t.last.text).slice(0, 60) : 'No messages yet'}</div></div>
        <div class="small muted">${t.last ? fmtTime(new Date(t.last.time)) : ''}</div></button>`).join('')}</div>
    </div>`;
  }
  function viewThread() {
    const u = me(); const id = ui.params.id || 'all';
    const list = db.messages.filter((m) => (m.thread || 'all') === id).sort((a, b) => a.time.localeCompare(b.time)).slice(-200);
    return topbar(threadName(id), { left: 'back' }) + `<div class="page"><div class="chat" id="chat">
      ${list.length ? list.map((m) => { const s = staffById(m.staffId); const mine = m.staffId === u.id; return `<div class="bubble ${mine ? 'me' : ''}">${mine || id.startsWith('dm:') ? '' : `<div class="who">${esc(s?.name || 'Former staff')}</div>`}${esc(m.text)}<div class="when">${fmtStamp(m.time)}</div></div>`; }).join('') : '<div class="empty">No messages yet. Say hello!</div>'}
    </div></div>
    <form class="composer" id="composer"><input name="text" placeholder="Type a message" autocomplete="off" aria-label="Message"><button type="submit" aria-label="Send">${ic(I.send, 20)}</button></form>`;
  }

  // ---------- Electronic sign on register ----------
  function registerSite() {
    if (ui.regSite && siteById(ui.regSite)) return ui.regSite;
    const e = openEntry(db.session);
    const today = db.shifts.find((s) => s.staffId === db.session && s.date === ymd(new Date()));
    return e?.siteId || today?.siteId || db.sites[0]?.id || null;
  }
  function registerRows(siteId, day) {
    const ids = new Set();
    db.shifts.filter((s) => s.siteId === siteId && s.date === day && s.staffId && s.status !== 'cancelled').forEach((s) => ids.add(s.staffId));
    const entries = db.entries.filter((e) => e.siteId === siteId && ymd(new Date(e.clockIn)) === day);
    entries.forEach((e) => ids.add(e.staffId));
    return [...ids].map((id) => {
      const mine = entries.filter((e) => e.staffId === id).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
      const last = mine[mine.length - 1];
      return { staff: staffById(id), on: mine[0] ? fmtTime(new Date(mine[0].clockIn)) : '', off: last?.clockOut ? fmtTime(new Date(last.clockOut)) : 'N/A' };
    }).filter((r) => r.staff);
  }
  function viewRegister() {
    const [from] = weekRange();
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    if (!days.some((d) => ymd(d) === ui.regDay)) ui.regDay = days.some((d) => ymd(d) === ymd(new Date())) ? ymd(new Date()) : ymd(days[0]);
    const siteId = registerSite(); const site = siteById(siteId);
    const rows = site ? registerRows(siteId, ui.regDay) : [];
    const visitors = db.register.filter((r) => r.siteId === siteId && ymd(new Date(r.inAt)) === ui.regDay).sort((a, b) => b.inAt.localeCompare(a.inAt));
    const staffPic = (s) => `<div class="reg-pic">${s.photo ? `<img src="${s.photo}" alt="">` : DEFAULT_AVATAR}</div>`;
    return topbar('Electronic Sign On Register', { right: `<button class="tb-btn" data-action="register-share">Share</button>` }) + weekNav() + `<div class="page white">
      <div class="daystrip">${days.map((d) => `<button data-regday="${ymd(d)}"><span>${DAYS[d.getDay()].slice(0, 3)}</span><b class="${ymd(d) === ui.regDay ? 'sel' : ''}">${pad(d.getDate())}</b></button>`).join('')}</div>
      <button class="reg-site" data-action="register-site">Site Name : ${esc(site?.name || 'No sites')}</button>
      ${rows.length ? rows.map((r) => `<div class="reg-row">${staffPic(r.staff)}<div class="reg-main">
          <div><b>Staff Name :</b>&nbsp; ${esc(r.staff.name)}</div><div><b>Licence :</b>&nbsp; ${esc(r.staff.licence || '')}</div>
          <div class="reg-times"><div><b>Sign On Time</b><span>${r.on}</span></div><div><b>Sign Out Time</b><span>${r.on ? r.off : 'N/A'}</span></div></div>
        </div></div>`).join('') : '<div class="empty" style="padding:40px 20px">No staff rostered or signed on for this day.</div>'}
      <div class="pad"><div class="card-head" style="margin:14px 4px 8px"><h3>Visitors</h3><button class="btn btn-gold btn-sm" data-action="visitor-new">${ic(I.plus, 16)}Sign In Visitor</button></div>
        ${visitors.length ? `<div class="card">${visitors.map((r) => `<div class="item"><div class="item-main"><div class="item-title">${esc(r.name)}${r.company ? ' · ' + esc(r.company) : ''}</div>
          <div class="item-sub">${esc(r.purpose || '')}${r.vehicle ? ' · 🚗 ' + esc(r.vehicle) : ''}</div><div class="item-sub">In ${fmtTime(new Date(r.inAt))}${r.outAt ? ' · Out ' + fmtTime(new Date(r.outAt)) : ''}</div></div>
          ${r.outAt ? statusPill('signed out') : `<button class="btn btn-dark btn-sm" data-action="visitor-out" data-id="${r.id}">Sign Out</button>`}</div>`).join('')}</div>` : '<div class="empty">No visitors.</div>'}
      </div>
    </div>`;
  }
  async function shareRegister() {
    const site = siteById(registerSite()); if (!site) return;
    const rows = registerRows(site.id, ui.regDay);
    const text = `Electronic Sign On Register\nSite: ${site.name}\nDate: ${dayTitle(ui.regDay)}\n\n` +
      (rows.map((r) => `${r.staff.name}${r.staff.licence ? ' (Licence ' + r.staff.licence + ')' : ''} — On: ${r.on || '-'}  Off: ${r.on ? r.off : 'N/A'}`).join('\n') || 'No staff signed on.');
    if (navigator.share) { try { await navigator.share({ title: `Sign On Register — ${site.name}`, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    download(`sign-on-register-${slug(site.name)}-${ui.regDay}.csv`, toCsv([['Site', 'Date', 'Staff name', 'Licence', 'Sign on', 'Sign out'], ...rows.map((r) => [site.name, dmy(parseYmd(ui.regDay)), r.staff.name, r.staff.licence, r.on, r.on ? r.off : 'N/A'])]));
  }

  // ---------- Welfare ----------
  function viewWelfare() {
    const u = me(); const last = lastWelfare(u.id); const due = welfareDue(u.id);
    const hist = db.welfare.filter((w) => w.staffId === u.id).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 10);
    return topbar('Welfare Check') + `<div class="page white"><div class="pad" style="text-align:center">
      <button class="welfare-btn ${due ? 'due' : ''}" data-action="welfare-ok">I'M OK</button>
      <div>${last ? `Last check: <b>${fmtStamp(last.time)}</b>` : 'No welfare checks yet'}</div>
      <div class="small muted" style="margin:6px 0 22px">${openEntry(u.id) ? `While on shift, check in every ${CONFIG.welfareMinutes} minutes.${due ? ' <b style="color:var(--amber)">Check due now.</b>' : ''}` : 'Welfare checks are required while you are on shift.'}</div>
      <button class="btn btn-red btn-block" data-action="welfare-help">I NEED HELP</button>
      <div class="card" style="text-align:left;margin-top:18px"><h3>History</h3>${hist.length ? hist.map((w) => `<div class="item"><div class="item-main">${fmtStamp(w.time)}${w.geo ? ' <span class="small muted">· 📍</span>' : ''}</div>${w.status === 'ok' ? '<span class="status st-confirmed">OK</span>' : '<span class="status st-high">Help</span>'}</div>`).join('') : '<div class="empty">No history</div>'}</div>
    </div></div>`;
  }

  // ---------- Support chat ----------
  const SUPPORT_FAQ = [
    [/password|log ?in|sign ?in/i, 'To reset your password, tap "Forgot Password" on the sign-in screen. A manager will give you a temporary password, which you can change under My Profile.'],
    [/clock|forgot to/i, 'If you forgot to clock in or out, add a note in the Occurrence Log and let your supervisor know. They can correct your times from the Admin Dashboard.'],
    [/qr|nfc|scan|code/i, 'If a QR code won\'t scan, check the app has camera permission, or type the site code printed under the QR code into the QR / NFC screen.'],
    [/leave|holiday|time off/i, 'Open Submit Leave from the menu, tap the first day you want off, and choose the dates. You\'ll see a filled blue circle once it\'s approved.'],
    [/shift|roster|cover/i, 'Your roster is under My Shifts. To pick up extra work, open Offered Shifts and tap Accept Shift. A manager will confirm it.'],
    [/pay|timesheet|hours/i, 'Your hours and estimated pay are under My Timesheet. You can export them to a spreadsheet with the download button.'],
  ];
  const supportTeam = () => db.staff.filter((s) => s.isAdmin && s.active).slice(0, 3);
  function supportWelcome() {
    const tel = (n) => `<a class="tel" href="tel:${n.replace(/\s/g, '')}">${esc(n)}</a>`;
    return `Hi there! 👋 Welcome to ${esc(CONFIG.shortName)} Support. I’m here to help with any questions or issues you may have—just let me know what you need help with.<br><br>
      Prefer to speak to someone? Our telephone support team is also available:<br><br>
      ${CONFIG.supportPhoneOoh
        ? `📞 Weekdays, 9am–5pm: ${tel(CONFIG.supportPhone)}<br>📞 Evenings &amp; weekends: ${tel(CONFIG.supportPhoneOoh)}`
        : `📞 Call us: ${tel(CONFIG.supportPhone)}`}`;
  }
  function viewSupport() {
    const u = me(); const team = supportTeam();
    const msgs = db.support.filter((m) => m.staffId === u.id).sort((a, b) => a.time.localeCompare(b.time));
    const faces = (size) => `<div class="faces">${team.map((s) => `<span class="face" style="width:${size}px;height:${size}px;background:${s.color}">${s.photo ? `<img src="${s.photo}" alt="">` : initials(s.name)}</span>`).join('') || `<span class="face" style="width:${size}px;height:${size}px">${ic(I.user, size / 2)}</span>`}</div>`;
    const bubble = (m) => m.from === 'staff'
      ? `<div class="sp-msg me"><div class="sp-bubble">${m.image ? `<img src="${m.image}" alt="Attachment">` : ''}${m.text ? esc(m.text) : ''}</div></div>`
      : `<div class="sp-msg">${faces(22)}<div class="sp-bubble${m.html ? ' html' : ''}">${m.html || esc(m.text)}${m.authorId ? `<div class="sp-who">${esc(staffById(m.authorId)?.name.split(' ')[0] || 'Support')}</div>` : ''}</div></div>`;
    return topbar(`${CONFIG.shortName} Support`) + `<div class="page white"><div class="sp-frame">
      <div class="sp-head">${faces(48)}<div><b>${esc(team.map((s) => s.name.split(' ')[0]).join(', ') || 'Support Team')}</b><div>We typically reply in a few minutes</div></div></div>
      <div class="sp-body" id="sp-body">${bubble({ from: 'support', html: supportWelcome() })}${msgs.map(bubble).join('')}${ui.supportTyping ? `<div class="sp-msg">${faces(22)}<div class="sp-bubble typing">•••</div></div>` : ''}</div>
      <form class="sp-input" id="support-form">
        <input name="text" placeholder="Ask me anything..." autocomplete="off" aria-label="Message">
        <label class="sp-icon" aria-label="Attach a photo">${ic('<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>', 24, 1.6)}<input type="file" accept="image/*" id="support-file" hidden></label>
        <button type="submit" class="sp-icon" aria-label="Send">${ic(I.send, 24, 1.6)}</button>
      </form>
    </div></div>`;
  }
  function sendSupport(text, image) {
    db.support.push({ id: uid(), staffId: db.session, from: 'staff', text, image: image || null, time: new Date().toISOString() });
    save(); ui.supportTyping = true; render();
    const hit = SUPPORT_FAQ.find(([re]) => re.test(text || ''));
    const reply = hit ? hit[1] + '\n\nIf that doesn\'t solve it, reply here and a member of the team will pick it up.'
      : `Thanks for your message. A member of the ${CONFIG.company} team will reply shortly. For anything urgent, please call us on ${CONFIG.supportPhone}.`;
    const staffId = db.session;
    setTimeout(() => {
      db.support.push({ id: uid(), staffId, from: 'support', text: reply, authorId: null, time: new Date().toISOString() });
      ui.supportTyping = false; save(); if (ui.route === 'support' && !ui.drawer) render();
    }, 1200);
  }
  function sheetSupportReply(staffId) {
    const s = staffById(staffId);
    const msgs = db.support.filter((m) => m.staffId === staffId).sort((a, b) => a.time.localeCompare(b.time)).slice(-20);
    openSheet(`<h2>Support · ${esc(s?.name || '')}</h2>
      <div class="sp-body" style="max-height:40vh;overflow-y:auto;padding:0 0 10px">${msgs.map((m) => `<div class="sp-msg ${m.from === 'staff' ? '' : 'me'}"><div class="sp-bubble">${m.image ? `<img src="${m.image}" alt="">` : ''}${esc(m.text || '')}<div class="sp-who">${m.from === 'staff' ? esc(s?.name || '') : m.authorId ? esc(staffById(m.authorId)?.name || '') : 'Auto-reply'} · ${fmtStamp(m.time)}</div></div></div>`).join('')}</div>
      <form class="form"><div class="field"><label>Reply</label><textarea class="input" name="text" required></textarea></div><div class="error"></div><button class="btn btn-gold btn-block" type="submit">Send Reply</button></form>`, (d) => {
      db.support.push({ id: uid(), staffId, from: 'support', text: d.text.trim(), authorId: db.session, time: new Date().toISOString() });
      save(); render(); toast('Reply sent');
    });
  }

  // ---------- Profile ----------
  function viewProfile() {
    const u = me();
    const [first, ...rest] = u.name.split(' ');
    const row = (label, name, value, attrs = '') => `<label class="pf-row"><b>${label}</b><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
    const link = (route, label) => `<button type="button" class="pf-row" data-nav="${route}"><b>${label}</b><span class="chev">${ic(I.right, 22, 1.6)}</span></button>`;
    return topbar('My Profile') + `<div class="page white"><form id="profile-form" class="pf">
      <div class="pf-photo"><div class="avatar-wrap" style="width:150px;height:150px;margin:0 auto">
        <div class="avatar-big" style="width:150px;height:150px">${avatarImg(u)}</div>
        <label class="cam cam-lg" aria-label="Change photo">${ic(I.camera, 26, 2.2)}<input type="file" accept="image/*" id="photo-input" hidden></label></div></div>
      ${row('First Name', 'first', first, 'required autocomplete="given-name"')}
      ${row('Last Name', 'last', rest.join(' '), 'autocomplete="family-name"')}
      ${row('Email', 'email', u.email, `type="email" required autocapitalize="off"${CLOUD ? ' readonly title="Ask a manager to change your sign-in email"' : ''}`)}
      ${row('Mobile', 'phone', u.phone, 'type="tel" autocomplete="tel"')}
      ${row('Pin', 'pin', u.pin || '', 'inputmode="numeric" pattern="\\d{4}" maxlength="4"')}
      ${link('mydocs', 'My Documents')}${link('compliance', 'My Compliance')}${link('companycompliance', 'Company Compliance')}
      <div class="error" id="profile-error" style="padding:6px 12px 0"></div>
      <button class="btn btn-gold btn-block pf-save" type="submit">Save Changes</button>
      <button type="button" class="btn btn-block pf-logout" data-action="logout">Logout</button>
      <div style="border-top:1px solid #d4d7dc;margin:12px 10px 0;padding-top:14px;text-align:center"><button type="button" class="small muted" style="text-decoration:underline" data-action="change-pw">Change password</button></div>
    </form></div>`;
  }

  // My Documents: files the staff member keeps on record (ID, licence card, certificates).
  function viewMyDocs() {
    const list = db.staffDocs.filter((d) => d.staffId === db.session).sort((a, b) => b.date.localeCompare(a.date));
    return topbar('My Documents', { left: 'back', right: `<label class="tb-btn">Add<input type="file" id="mydoc-file" accept="image/*,application/pdf" hidden></label>` }) + `<div class="page white">
      ${list.length ? list.map((d) => `<div class="section"><div class="body"><h3>${esc(d.name)}</h3><p class="l">${esc(d.kind)} · added ${dmy(new Date(d.date))}</p></div>
        <a class="btn btn-ghost btn-sm" href="${d.data}" download="${esc(d.fileName)}" target="_blank" rel="noopener">View</a>
        <button class="btn btn-ghost btn-sm" style="margin-left:6px;color:var(--red)" data-action="mydoc-delete" data-id="${d.id}" aria-label="Delete">${ic(I.trash, 16)}</button></div>`).join('')
        : '<div class="empty-state">No documents yet.<br>Tap Add to upload your ID, licence or certificates.</div>'}
    </div>`;
  }
  const COMPLIANCE = [
    ['sia', 'SIA Licence', 'expiry'], ['rtw', 'Right to Work', 'expiry'], ['vetting', 'BS7858 Vetting', 'date'],
    ['dbs', 'DBS Check', 'date'], ['firstaid', 'First Aid Certificate', 'expiry'],
  ];
  function complianceStatus(item, kind) {
    if (!item || !item.date) return 'missing';
    if (kind === 'date') return 'valid';
    const days = (parseYmd(item.date) - parseYmd(ymd(new Date()))) / 86400000;
    return days < 0 ? 'expired' : days <= 60 ? 'expiring' : 'valid';
  }
  const complianceIssues = (s) => COMPLIANCE.filter(([k, , kind]) => ['missing', 'expired'].includes(complianceStatus(s.compliance?.[k], kind))).length;
  function viewCompliance() {
    const u = me(); const c = u.compliance || {};
    const label = { valid: 'Valid', expiring: 'Expiring Soon', expired: 'Expired', missing: 'Missing' };
    return topbar('My Compliance', { left: 'back' }) + `<div class="page white">
      ${COMPLIANCE.map(([k, title, kind]) => { const st = complianceStatus(c[k], kind); return `<button class="section" data-action="compliance-edit" data-id="${k}"><div class="body">
        <h3>${title}</h3>${k === 'sia' ? `<p class="l">Licence : ${esc(u.licence || '-')}</p>` : c[k]?.ref ? `<p class="l">Reference : ${esc(c[k].ref)}</p>` : ''}
        <p class="l">${kind === 'expiry' ? 'Expiry' : 'Completed'} : ${c[k]?.date ? dmy(parseYmd(c[k].date)) : '-'}</p>
        <p class="l" style="margin-top:8px">Status : <span class="status st-${st}">${label[st]}</span></p></div><span class="chev">${ic(I.right, 22, 1.6)}</span></button>`; }).join('')}
    </div>`;
  }
  function sheetCompliance(key) {
    const u = me(); const [, title, kind] = COMPLIANCE.find(([k]) => k === key); const item = (u.compliance || {})[key] || {};
    openSheet(`<h2>${title}</h2><form class="form">
      ${key === 'sia' ? `<div class="field"><label>Licence number</label><input class="input" name="ref" inputmode="numeric" value="${esc(u.licence || '')}"></div>` : `<div class="field"><label>Reference (optional)</label><input class="input" name="ref" value="${esc(item.ref || '')}"></div>`}
      <div class="field"><label>${kind === 'expiry' ? 'Expiry date' : 'Date completed'}</label><input class="input" type="date" name="date" value="${esc(item.date || '')}"></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save</button></form>`, (d) => {
      u.compliance = u.compliance || {};
      if (key === 'sia') u.licence = d.ref.trim();
      u.compliance[key] = { ref: key === 'sia' ? '' : d.ref.trim(), date: d.date };
      save(); render(); toast(`${title} updated`);
    });
  }
  function viewCompanyCompliance() {
    const docs = db.documents.filter((d) => d.requireSign && (d.scope === 'company' || docsForTab('shift').includes(d)));
    const done = (t) => db.trainingDone.some((x) => x.moduleId === t.id && x.staffId === db.session);
    const out = docs.filter((d) => !docSigned(d)).length + db.training.filter((t) => t.q && !done(t)).length;
    return topbar('Company Compliance', { left: 'back' }) + `<div class="page white">
      <div class="pad"><div class="total-bar" style="margin:0"><div><span>Outstanding</span><b>${out}</b></div><div style="text-align:right"><span>Status</span><b>${out ? 'Action needed' : 'Up to date ✓'}</b></div></div></div>
      <h3 style="margin:14px 12px 4px">Policies to sign</h3>
      ${docs.map((d) => `<button class="section" data-nav="doc" data-id="${d.id}"><div class="body"><p>${esc(d.title)}</p><p class="l">${esc(docHeading(d))}</p></div>${docSigned(d) ? statusPill('signed') : '<span class="status st-pending">Outstanding</span>'}</button>`).join('') || '<div class="empty">Nothing to sign.</div>'}
      <h3 style="margin:18px 12px 4px">Training</h3>
      ${db.training.filter((t) => t.q).map((t) => `<button class="section" data-nav="module" data-id="${t.id}"><div class="body"><p>${esc(t.title)}</p></div>${done(t) ? statusPill('completed') : '<span class="status st-pending">Outstanding</span>'}</button>`).join('')}
    </div>`;
  }

  // ---------- Training ----------
  const FILM_ICON = `<svg class="film" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#111111"/><rect x="6" y="8" width="52" height="48" rx="5" fill="none" stroke="#fff" stroke-width="3.5"/>
    <path d="M6 18h52M6 46h52" stroke="#fff" stroke-width="3.5"/><path d="M13 13h6M24 13h6M35 13h6M46 13h6M13 51h6M24 51h6M35 51h6M46 51h6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M26 24v16l13-8z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
  function defaultTraining() {
    return [
      { id: 'v1', title: 'Clock Out with Customer Approval', desc: 'This video will show you how to clock out using the customer approval feature', video: 'videos/clock-out-customer-approval.mp4', body: 'At the end of your shift tap CLOCK OUT. If the site needs sign-off, ask the customer\'s representative to type their name and sign in the box, then tap Clock Out. Their approval is saved with your hours and shown on your timesheet.', q: 'Who signs the customer approval box?', options: ['You', 'The customer\'s representative on site', 'Your manager at head office'], answer: 1 },
      { id: 'v2', title: 'Submitting Leave & Unavailability', desc: 'A short video on how to submit for time off', video: 'videos/submitting-leave-unavailability.mp4', body: 'Open Submit Leave and tap the first day you need off. Choose the leave type (or Unavailability if you just can\'t work that day) and the dates. A hollow blue circle means waiting for approval; a filled circle means approved.', q: 'What does a filled blue circle on the leave calendar mean?', options: ['Approved', 'Declined', 'Bank holiday'], answer: 0 },
      { id: 'v3', title: 'Clocking into Shifts', desc: 'A short video on how to clock into your shift', video: 'videos/clocking-into-shifts.mp4', body: 'Open the menu and tap CLOCK IN, or open today\'s shift under My Shifts and tap "Clock In to this Shift". At sites with a QR code or NFC tag, tap QR / NFC and scan it to clock in at that site. Your location is saved when you clock in, if you allow it.', q: 'How do you clock in at a site that has a QR code?', options: ['Email your manager', 'Tap QR / NFC and scan the code', 'Wait for the shift to start'], answer: 1 },
      { id: 'v4', title: 'My Roster page', desc: `A short video on how to use the My Roster page of the ${CONFIG.shortName} app`, video: 'videos/my-roster-page.mp4', body: 'Open My Shifts and use the arrows to move between weeks. Tap a shift to open My Roster Detail: notes, Open in Maps and View Contacts. You can also offer a shift for cover.', q: 'How do you see site contacts for a shift?', options: ['Tap the shift, then View Contacts', 'Look in Training', 'You cannot'], answer: 0 },
    ];
  }
  function viewTraining() {
    const u = me();
    const done = (t) => db.trainingDone.some((x) => x.moduleId === t.id && x.staffId === db.session);
    return topbar('Training Module', { right: u.isAdmin ? `<button class="tb-btn" data-action="module-new">Add</button>` : '' }) + `<div class="page white">
      ${db.training.map((t) => `<button class="tr-row" data-nav="module" data-id="${t.id}">${FILM_ICON}<div><b>${esc(t.title)}</b><p>${esc(t.desc)}</p>${done(t) ? '<span class="tr-done">✓ Completed</span>' : ''}</div></button>`).join('') || '<div class="empty-state">No training modules yet.</div>'}
    </div>`;
  }
  function videoEmbed(url) {
    if (!url) return `<div class="video-ph">${FILM_ICON}<span>Video coming soon — read the guide below.</span></div>`;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Training video" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `<div class="video"><iframe src="https://player.vimeo.com/video/${vm[1]}" title="Training video" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    return `<div class="video"><video src="${esc(url)}${url.includes('#') ? '' : '#t=0.8'}" controls playsinline preload="metadata"></video></div>`;
  }
  function viewModule() {
    const t = db.training.find((x) => x.id === ui.params.id);
    if (!t) return topbar('Training', { left: 'back' }) + '<div class="page white"><div class="empty-state">Module not found.</div></div>';
    const done = db.trainingDone.find((x) => x.moduleId === t.id && x.staffId === db.session);
    return topbar('Training', { left: 'back' }) + `<div class="page white">${videoEmbed(t.video)}<div class="pad">
      <h2 style="margin:6px 0 2px">${esc(t.title)}</h2><div class="small muted" style="margin-bottom:14px">${esc(t.desc)}</div>
      <div class="doc-body">${esc(t.body || '')}</div>
      ${t.q ? `<div class="card" style="margin-top:20px"><h3>Quick check</h3><p style="margin-top:0">${esc(t.q)}</p>
        <form id="quiz" class="form">${t.options.map((o, i) => `<label class="check" style="font-weight:400"><input type="radio" name="a" value="${i}" required>${esc(o)}</label>`).join('')}
        <div class="error"></div><button class="btn btn-gold btn-block" type="submit">${done ? 'Retake' : 'Submit answer'}</button></form>
        ${done ? `<div class="small muted" style="margin-top:8px">✓ Completed on ${dmy(new Date(done.date))}</div>` : ''}</div>`
        : done ? `<div class="small muted" style="margin-top:18px">✓ Watched on ${dmy(new Date(done.date))}</div>` : `<button class="btn btn-gold btn-block" style="margin-top:20px" data-action="module-done" data-id="${t.id}">Mark as Watched</button>`}
      ${me().isAdmin ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;color:var(--red)" data-action="module-delete" data-id="${t.id}">${ic(I.trash, 18)}Delete module</button>` : ''}
    </div></div>`;
  }
  function sheetModuleNew() {
    openSheet(`<h2>Add Training Video</h2><form class="form">
      <div class="field"><label>Title</label><input class="input" name="title" required></div>
      <div class="field"><label>Short description</label><input class="input" name="desc" required></div>
      <div class="field"><label>Video link (YouTube, Vimeo or .mp4)</label><input class="input" name="video" type="url" placeholder="https://"></div>
      <div class="field"><label>Written guide (optional)</label><textarea class="input" name="body"></textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Publish</button></form>`, (d) => {
      db.training.push({ id: uid(), title: d.title.trim(), desc: d.desc.trim(), video: d.video.trim(), body: d.body.trim() });
      save(); render(); toast('Training video added');
    });
  }

  // ---------- Timesheet ----------
  function viewTimesheet() {
    const u = me(); const now = new Date(); let from, to, label;
    if (ui.tsRange === 'week') { from = startOfWeek(now); to = addDays(from, 7); label = 'This week'; }
    else if (ui.tsRange === 'last') { to = startOfWeek(now); from = addDays(to, -7); label = 'Last week'; }
    else { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1); label = 'This month'; }
    const list = db.entries.filter((e) => e.staffId === u.id && new Date(e.clockIn) >= from && new Date(e.clockIn) < to).sort((a, b) => b.clockIn.localeCompare(a.clockIn));
    const total = list.reduce((t, e) => t + entryWorkedMs(e), 0);
    return topbar('My Timesheet', { right: `<button class="tb-btn" data-action="export-mine" aria-label="Export CSV">${ic(I.download, 24)}</button>` }) + `<div class="page"><div class="pad">
      <div class="seg"><button class="${ui.tsRange === 'week' ? 'on' : ''}" data-ts="week">This week</button><button class="${ui.tsRange === 'last' ? 'on' : ''}" data-ts="last">Last week</button><button class="${ui.tsRange === 'month' ? 'on' : ''}" data-ts="month">Month</button></div>
      <div class="total-bar"><div><span>${label}</span><b>${fmtDur(total)}</b></div><div style="text-align:right"><span>Est. gross pay</span><b>${money(hours(total) * (u.rate || 0))}</b></div></div>
      ${list.length ? `<div class="card">${list.map((e) => entryRow(e)).join('')}</div>` : '<div class="empty">No clock-ins in this period.</div>'}
    </div></div>`;
  }
  function entryGeoLine(e) {
    const a = geoBadge(e); const b = e.clockOut ? geoBadge(e, true) : '';
    return a || b ? `<div class="item-sub geo-line">${a ? `In: ${a}` : ''}${a && b ? ' &nbsp; ' : ''}${b ? `Out: ${b}` : ''}</div>` : '';
  }
  function entryRow(e, who = false) {
    const cin = new Date(e.clockIn); const site = siteById(e.siteId); const s = who ? staffById(e.staffId) : null;
    return `<div class="item"><div class="item-main"><div class="item-title">${s ? esc(s.name) + ' · ' : ''}${DAYS[cin.getDay()].slice(0, 3)} ${dmy(cin)}</div>
      <div class="item-sub">${fmtTime(cin)} - ${e.clockOut ? fmtTime(new Date(e.clockOut)) : 'now'}${site ? ' · ' + esc(site.name) : ''}${e.breaks.length ? ' · breaks ' + fmtDur(entryBreakMs(e)) : ''}${e.method !== 'app' ? ' · ' + e.method.toUpperCase() : ''}${who ? '' : e.geo ? ' · 📍' : ''}</div>${who ? entryGeoLine(e) : ''}${e.approval ? `<button class="small" style="color:var(--green);font-weight:600" data-action="view-approval" data-id="${e.id}">✓ Customer approved · ${esc(e.approval.name)}</button>` : ''}</div>
      <div class="item-end">${e.clockOut ? fmtDur(entryWorkedMs(e)) : statusPill('on site')}</div></div>`;
  }

  // ---------- Admin ----------
  function adminBody(tab) {
    let body = '';
    if (tab === 'live') {
      const live = db.staff.filter((s) => openEntry(s.id));
      const today = ymd(new Date());
      const rostered = db.shifts.filter((s) => s.date === today && s.staffId);
      const missing = rostered.filter((s) => !openEntry(s.staffId) && !db.entries.some((e) => e.staffId === s.staffId && ymd(new Date(e.clockIn)) === today));
      const pending = db.leave.filter((l) => l.status === 'pending').length + db.shifts.filter((s) => s.status === 'pending' && s.staffId).length + db.resetRequests.filter((r) => !r.done).length + db.incidents.filter((i) => i.status === 'open').length;
      body = `<div class="stats"><div class="stat"><b>${live.length}</b><span>On shift</span></div><div class="stat"><b>${rostered.length}</b><span>Rostered today</span></div><div class="stat"><b>${pending}</b><span>To review</span></div></div>
        <div class="card"><h3>On shift now</h3>${live.length ? live.map((s) => { const e = openEntry(s.id); const site = siteById(e.siteId); return `<div class="item">${avatar(s)}<div class="item-main"><div class="item-title">${esc(s.name)}</div><div class="item-sub">In ${fmtTime(new Date(e.clockIn))}${site ? ' · ' + esc(site.name) : ''}${onBreak(e) ? ' · on break' : ''}${welfareDue(s.id) ? ' · <b style="color:var(--amber)">welfare overdue</b>' : ''}</div></div><div class="item-end">${fmtDur(entryWorkedMs(e))}</div></div>`; }).join('') : '<div class="empty">Nobody is clocked in.</div>'}</div>
        <div class="card"><h3>Not clocked in yet</h3>${missing.length ? missing.map((s) => { const p = staffById(s.staffId); const site = siteById(s.siteId); return `<div class="item">${p ? avatar(p) : ''}<div class="item-main"><div class="item-title">${esc(p?.name)}</div><div class="item-sub">${s.start} - ${s.end} · ${esc(site?.name || '')}</div></div></div>`; }).join('') : '<div class="empty">Everyone rostered is accounted for.</div>'}</div>
        <div class="card"><h3>Welfare alerts</h3>${db.welfare.filter((w) => w.status === 'help').slice(-5).reverse().map((w) => `<div class="item"><div class="item-main"><div class="item-title">${esc(staffById(w.staffId)?.name)}</div><div class="item-sub">${fmtStamp(w.time)}${w.geo ? ` · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${w.geo.lat},${w.geo.lng}">location</a>` : ''}</div></div>${statusPill('high')}</div>`).join('') || '<div class="empty">No help requests.</div>'}</div>
        <div class="card"><h3>Recent clock-ins</h3>${db.entries.slice().sort((a, b) => b.clockIn.localeCompare(a.clockIn)).slice(0, 8).map((e) => entryRow(e, true)).join('') || '<div class="empty">No activity yet.</div>'}</div>`;
    } else if (tab === 'staff') {
      body = `<button class="btn btn-gold btn-block" data-action="staff-new" style="margin-bottom:12px">${ic(I.plus, 18)}Add Staff Member</button>
        <div class="card">${db.staff.slice().sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<button class="item" data-action="staff-edit" data-id="${s.id}">${avatar(s)}<div class="item-main"><div class="item-title">${esc(s.name)}${s.active ? '' : ' <span class="small muted">(inactive)</span>'}</div><div class="item-sub">${esc(s.empNo)} · ${esc(s.role)}${s.isAdmin ? ' · Admin' : ''}${!s.isAdmin && complianceIssues(s) ? ` · <b style="color:var(--red)">${complianceIssues(s)} compliance issue(s)</b>` : ''}</div></div><span class="chev">${ic(I.right, 20)}</span></button>`).join('')}</div>`;
    } else if (tab === 'sites') {
      body = `<button class="btn btn-gold btn-block" data-action="site-new" style="margin-bottom:12px">${ic(I.plus, 18)}Add Site</button>
        <div class="card">${db.sites.map((s) => `<button class="item" data-action="site-edit" data-id="${s.id}"><div class="item-main"><div class="item-title">${esc(s.name)}</div><div class="item-sub">${esc(s.customer)} · ${esc(s.city)} · QR/NFC code <b>${esc(s.code)}</b> · ${s.lat != null ? `within ${s.radius || CONFIG.siteRadiusMetres} m of map position` : '<b style="color:var(--amber)">no map position: add one to check clock-on locations</b>'}</div></div><span class="chev">${ic(I.right, 20)}</span></button>`).join('') || '<div class="empty">No sites yet.</div>'}</div>`;
    } else if (tab === 'roster') {
      const [from] = weekRange();
      const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(from, i)));
      body = `<button class="btn btn-gold btn-block" data-action="shift-new" style="margin-bottom:6px">${ic(I.plus, 18)}Add Shift</button>${weekNav()}
        ${days.map((d) => { const list = db.shifts.filter((s) => s.date === d).sort(byStart); return `<div class="card"><h3>${dayTitle(d)}</h3>${list.length ? list.map((s) => { const p = staffById(s.staffId); const site = siteById(s.siteId); return `<button class="item" data-action="shift-edit" data-id="${s.id}"><div class="item-main"><div class="item-title">${s.start} - ${s.end} · ${esc(p ? p.name : 'Open shift')}</div><div class="item-sub">${esc(site?.customer || '')} · ${esc(site?.name || '')}</div></div>${statusPill(s.status)}</button>`; }).join('') : '<div class="empty">No shifts</div>'}</div>`; }).join('')}`;
    } else if (tab === 'requests') {
      const accepted = db.shifts.filter((s) => s.status === 'pending' && s.staffId).sort(byStart);
      const leave = db.leave.slice().sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.from.localeCompare(a.from));
      const inc = db.incidents.slice().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.time.localeCompare(a.time));
      const resets = db.resetRequests.filter((r) => !r.done);
      const chats = [...new Set(db.support.map((m) => m.staffId))].map((sid) => { const ms = db.support.filter((m) => m.staffId === sid).sort((a, b) => a.time.localeCompare(b.time)); return { sid, last: ms[ms.length - 1], waiting: !ms.some((m) => m.from === 'support' && m.authorId && m.time > (ms.filter((x) => x.from === 'staff').pop()?.time || '')) }; }).sort((a, b) => b.last.time.localeCompare(a.last.time));
      body = `${chats.length ? `<div class="card"><h3>Support chats</h3>${chats.map((c) => `<div class="item"><div class="item-main"><div class="item-title">${esc(staffById(c.sid)?.name || 'Former staff')}</div><div class="item-sub">${esc(c.last.text || '📷 Photo').slice(0, 60)} · ${fmtStamp(c.last.time)}</div></div><button class="btn ${c.waiting ? 'btn-gold' : 'btn-ghost'} btn-sm" data-action="support-reply" data-id="${c.sid}">Reply</button></div>`).join('')}</div>` : ''}${resets.length ? `<div class="card"><h3>Password resets</h3>${resets.map((r) => `<div class="item"><div class="item-main"><div class="item-title">${esc(r.email)}</div><div class="item-sub">${fmtStamp(r.time)}</div></div><button class="btn btn-dark btn-sm" data-action="reset-do" data-id="${r.id}">Reset</button></div>`).join('')}</div>` : ''}
        <div class="card"><h3>Shifts to confirm</h3>${accepted.length ? accepted.map((s) => `<div class="item"><div class="item-main"><div class="item-title">${esc(staffById(s.staffId)?.name)}</div><div class="item-sub">${dayTitle(s.date)} · ${s.start} - ${s.end} · ${esc(siteById(s.siteId)?.name || '')}</div></div>${approveBtns('shift', s.id)}</div>`).join('') : '<div class="empty">Nothing to confirm.</div>'}</div>
        <div class="card"><h3>Leave</h3>${leave.length ? leave.map((l) => leaveRow(l, true)).join('') : '<div class="empty">No leave requests.</div>'}</div>
        <div class="card"><h3>Incidents & forms</h3>${inc.length ? inc.map((i) => incidentRow(i, true)).join('') : '<div class="empty">No submissions.</div>'}</div>`;
    } else if (tab === 'reports') {
      const from = startOfWeek(new Date()); const to = addDays(from, 7);
      const rows = db.staff.filter((s) => s.active).map((s) => ({ s, ms: workedBetween(s.id, from, to) }));
      const total = rows.reduce((a, r) => a + r.ms, 0); const cost = rows.reduce((a, r) => a + hours(r.ms) * (r.s.rate || 0), 0);
      body = `<div class="total-bar"><div><span>Hours this week</span><b>${fmtDur(total)}</b></div><div style="text-align:right"><span>Wage cost</span><b>${money(cost)}</b></div></div>
        <div class="card"><h3>By staff member</h3>${rows.map((r) => `<div class="item">${avatar(r.s)}<div class="item-main"><div class="item-title">${esc(r.s.name)}</div><div class="item-sub">${money(hours(r.ms) * (r.s.rate || 0))}</div></div><div class="item-end">${fmtDur(r.ms)}</div></div>`).join('')}</div>
        <div class="grid-2"><button class="btn btn-ghost" data-action="export-all">${ic(I.download, 18)}Timesheets</button><button class="btn btn-ghost" data-action="export-register">${ic(I.download, 18)}Visitors</button>
        <button class="btn btn-ghost" data-action="backup">${ic(I.download, 18)}Backup</button><button class="btn btn-ghost" data-action="restore">${ic(I.log, 18)}Restore</button></div>`;
    }
    return body;
  }
  function viewAdmin() {
    const tab = ui.adminTab;
    const t = (k, label) => `<button class="${tab === k ? 'on' : ''}" data-admin="${k}">${label}</button>`;
    const body = adminBody(tab);
    return topbar('Admin Dashboard') + `<div class="page"><div class="pad">
      <div class="seg">${t('live', 'Live')}${t('staff', 'Staff')}${t('sites', 'Sites')}${t('roster', 'Roster')}${t('requests', 'Requests')}${t('reports', 'Reports')}</div>${body}</div></div>`;
  }

  // ---------- Sheets ----------
  function sheetContacts(site) {
    const list = site?.contacts || [];
    openSheet(`<h2>Contacts${site ? ' · ' + esc(site.name) : ''}</h2>
      ${list.length ? list.map((c) => `<a class="item" href="tel:${esc(c.phone.replace(/\s/g, ''))}"><div class="item-main"><div class="item-title">${esc(c.name)}</div><div class="item-sub">${esc(c.role || '')}</div></div><div class="item-end" style="color:var(--blue)">${esc(c.phone)}</div></a>`).join('') : '<div class="empty">No contacts for this site.</div>'}
      <button class="btn btn-ghost btn-block" data-dismiss style="margin-top:14px">Close</button>`);
  }

  function sheetScan() {
    const hasCam = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
    const hasNfc = 'NDEFReader' in window;
    const root = openSheet(`<h2>QR / NFC</h2>
      ${hasCam ? '<div class="scanner"><video id="scan-video" playsinline muted></video></div>' : '<p class="small muted">Camera scanning isn\'t supported in this browser. Type the site code printed under the QR code instead.</p>'}
      ${hasNfc ? `<button type="button" class="btn btn-dark btn-block" id="nfc-btn" style="margin-bottom:12px">Tap an NFC tag</button>` : ''}
      <form class="form"><div class="field"><label>Site code</label><input class="input" name="code" placeholder="e.g. VWG-NG01" autocapitalize="characters"></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Submit Code</button></form>`, (d) => handleCode(d.code, 'qr'));
    if (hasCam) {
      let stream = null; let stopped = false;
      scanStop = () => { stopped = true; if (stream) stream.getTracks().forEach((t) => t.stop()); };
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async (s) => {
        stream = s; if (stopped) { scanStop(); return; }
        const v = root.querySelector('#scan-video'); v.srcObject = s; await v.play();
        const det = new BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
          if (stopped) return;
          try { const codes = await det.detect(v); if (codes.length) { const err = handleCode(codes[0].rawValue, 'qr'); if (!err) { closeSheet(); return; } toast(err); } } catch (e) { /* keep scanning */ }
          setTimeout(loop, 400);
        };
        loop();
      }).catch(() => toast('Camera permission denied — type the code instead'));
    }
    if (hasNfc) {
      root.querySelector('#nfc-btn').addEventListener('click', async () => {
        try {
          const reader = new NDEFReader(); await reader.scan(); toast('Hold your phone near the tag');
          reader.onreading = (ev) => {
            let text = ev.serialNumber;
            for (const r of ev.message.records) if (r.recordType === 'text') text = new TextDecoder(r.encoding || 'utf-8').decode(r.data);
            const err = handleCode(text, 'nfc'); if (err) toast(err); else closeSheet();
          };
        } catch (e) { toast('NFC unavailable: ' + e.message); }
      });
    }
  }
  function handleCode(raw, method) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return 'Enter a site code';
    const site = db.sites.find((s) => s.code.toUpperCase() === code);
    if (!site) return 'Code not recognised';
    if (!openEntry(db.session)) { clockIn({ siteId: site.id, method }); return null; }
    addOccurrence(`Checkpoint scanned (${method.toUpperCase()})`, 'checkpoint', site.id); save(); render();
    toast(`Checkpoint logged · ${site.name}`);
    return null;
  }

  function staffOptions(sel, allowOpen) {
    return (allowOpen ? `<option value="">— Open shift (offer to all) —</option>` : '') + db.staff.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  }
  function sheetShift(s, preset = {}) {
    const isNew = !s;
    s = s || { staffId: preset.staffId || '', siteId: db.sites[0]?.id, date: preset.date || ymd(addDays(startOfWeek(new Date()), ui.weekOffset * 7)), start: '07:00', end: '19:00', notes: '', status: 'confirmed' };
    openSheet(`<h2>${isNew ? 'Add Shift' : 'Edit Shift'}</h2><form class="form">
      <div class="field"><label>Staff member</label><select class="input" name="staffId">${staffOptions(s.staffId, true)}</select></div>
      <div class="field"><label>Site</label><select class="input" name="siteId" required>${db.sites.map((x) => `<option value="${x.id}" ${x.id === s.siteId ? 'selected' : ''}>${esc(x.customer)} · ${esc(x.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${s.date}" required></div>
      <div class="row"><div class="field"><label>Start</label><input class="input" type="time" name="start" value="${s.start}" required></div><div class="field"><label>End</label><input class="input" type="time" name="end" value="${s.end}" required></div></div>
      <div class="field"><label>Status</label><select class="input" name="status">${['confirmed', 'pending', 'cancelled'].map((x) => `<option value="${x}" ${x === s.status ? 'selected' : ''}>${cap(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Notes</label><input class="input" name="notes" value="${esc(s.notes)}"></div>
      ${isNew ? '<div class="field"><label>Repeat</label><select class="input" name="repeat"><option value="1">This day only</option><option value="5">Next 5 days</option><option value="7">Next 7 days</option></select></div>' : ''}
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save Shift</button>
      ${isNew ? '' : `<button type="button" class="btn btn-ghost btn-block" style="color:var(--red)" data-action="shift-delete" data-id="${s.id}">${ic(I.trash, 18)}Delete Shift</button>`}</form>`, (d) => {
      if (!db.sites.length) return 'Add a site first';
      const base = { staffId: d.staffId || null, siteId: d.siteId, start: d.start, end: d.end, notes: d.notes.trim(), status: d.staffId ? d.status : 'offered' };
      if (isNew) { const n = Number(d.repeat) || 1; for (let i = 0; i < n; i++) db.shifts.push({ id: uid(), ...base, date: ymd(addDays(parseYmd(d.date), i)) }); }
      else Object.assign(db.shifts.find((x) => x.id === s.id), base, { date: d.date });
      save(); render(); toast('Shift saved');
    });
  }
  function sheetSite(s) {
    const isNew = !s;
    s = s || { customer: '', name: '', address: '', city: '', region: '', country: 'UNITED KINGDOM', code: 'VWG-' + uid().slice(0, 4).toUpperCase(), contacts: [] };
    const contacts = s.contacts.map((c) => [c.name, c.role, c.phone].join(' | ')).join('\n');
    openSheet(`<h2>${isNew ? 'Add Site' : 'Edit Site'}</h2><form class="form">
      <div class="field"><label>Customer</label><input class="input" name="customer" value="${esc(s.customer)}" required></div>
      <div class="field"><label>Site name</label><input class="input" name="name" value="${esc(s.name)}" required></div>
      <div class="field"><label>Address</label><input class="input" name="address" value="${esc(s.address)}"></div>
      <div class="row"><div class="field"><label>City</label><input class="input" name="city" value="${esc(s.city)}"></div><div class="field"><label>State / County</label><input class="input" name="region" value="${esc(s.region)}"></div></div>
      <div class="row"><div class="field"><label>Country</label><input class="input" name="country" value="${esc(s.country)}"></div><div class="field"><label>QR / NFC code</label><input class="input" name="code" value="${esc(s.code)}" required></div></div>
      <div class="field"><label>Map position (latitude, longitude)</label><input class="input" name="pos" id="site-pos" value="${s.lat != null ? `${s.lat}, ${s.lng}` : ''}" placeholder="e.g. 52.48620, -1.89040" autocomplete="off">
        <span class="small muted">In Google Maps, right-click the site and click the numbers to copy them. Or stand on site and <button type="button" class="link" data-action="site-here" style="color:var(--gold);font-weight:600">use my location</button>.</span></div>
      <div class="field"><label>Allowed distance for clocking on/off (metres)</label><input class="input" type="number" name="radius" min="50" max="5000" step="10" value="${s.radius || CONFIG.siteRadiusMetres}"></div>
      <div class="field"><label>Contacts (one per line: Name | Role | Phone)</label><textarea class="input" name="contacts">${esc(contacts)}</textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save Site</button></form>`, (d) => {
      const code = d.code.trim().toUpperCase();
      if (db.sites.some((x) => x.code.toUpperCase() === code && x.id !== s.id)) return 'Another site already uses that code';
      let lat = null, lng = null;
      if (d.pos.trim()) {
        const m = d.pos.match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
        if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return 'Map position should look like 52.48620, -1.89040';
        lat = +(+m[1]).toFixed(5); lng = +(+m[2]).toFixed(5);
      }
      const radius = Math.round(Number(d.radius)) || CONFIG.siteRadiusMetres;
      const data = { customer: d.customer.trim(), name: d.name.trim(), address: d.address.trim(), city: d.city.trim(), region: d.region.trim(), country: d.country.trim(), code, lat, lng, radius,
        contacts: d.contacts.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([name, role = '', phone = '']) => ({ name, role, phone })) };
      if (isNew) db.sites.push({ id: uid(), ...data }); else Object.assign(siteById(s.id), data);
      save(); render(); toast('Site saved');
    });
  }
  function nextEmpNo() { return 'VWG' + String(db.staff.reduce((m, s) => Math.max(m, parseInt(s.empNo.replace(/\D/g, ''), 10) || 0), 0) + 1).padStart(3, '0'); }
  function sheetStaff(s) {
    const isNew = !s;
    s = s || { licence: '', leaveAllowance: 28, name: '', empNo: nextEmpNo(), email: '', role: 'Security Officer', dept: 'Security', phone: '', startDate: ymd(new Date()), rate: 0, isAdmin: false, active: true };
    openSheet(`<h2>${isNew ? 'Add Staff Member' : 'Edit Staff Member'}</h2><form class="form">
      <div class="field"><label>Full name</label><input class="input" name="name" value="${esc(s.name)}" required></div>
      <div class="field"><label>Email (used to sign in)</label><input class="input" type="email" name="email" value="${esc(s.email)}" required></div>
      <div class="row"><div class="field"><label>Employee no.</label><input class="input" name="empNo" value="${esc(s.empNo)}" required></div><div class="field"><label>Start date</label><input class="input" type="date" name="startDate" value="${esc(s.startDate)}"></div></div>
      <div class="row"><div class="field"><label>Role</label><input class="input" name="role" value="${esc(s.role)}"></div><div class="field"><label>Department</label><input class="input" name="dept" value="${esc(s.dept)}"></div></div>
      <div class="row"><div class="field"><label>Phone</label><input class="input" type="tel" name="phone" value="${esc(s.phone)}"></div><div class="field"><label>Hourly rate (${CONFIG.currency})</label><input class="input" type="number" min="0" step="0.01" name="rate" value="${esc(s.rate)}"></div></div>
      <div class="row"><div class="field"><label>SIA licence no.</label><input class="input" name="licence" value="${esc(s.licence || '')}" inputmode="numeric"></div><div class="field"><label>Leave allowance (days)</label><input class="input" type="number" min="0" step="0.5" name="leaveAllowance" value="${esc(s.leaveAllowance ?? 28)}"></div></div>
      ${CLOUD ? `<p class="small muted" style="margin:0">${isNew ? 'After saving, they open the app, tap <b>Forgot Password → New staff</b> and create their own password.' : ''}</p>
        ${isNew ? '' : `<button type="button" class="btn btn-ghost btn-block" data-action="send-reset" data-id="${s.id}">Email them a password reset link</button>`}`
      : `<div class="field"><label>${isNew ? 'Password' : 'New password (leave blank to keep)'}</label><input class="input" name="password" minlength="8" ${isNew ? 'required' : ''} placeholder="At least 8 characters"></div>`}
      <label class="check"><input type="checkbox" name="isAdmin" ${s.isAdmin ? 'checked' : ''}>Admin access</label>
      <label class="check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}>Active (can sign in)</label>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save</button>
      ${!isNew && s.id !== db.session ? `<button type="button" class="btn btn-ghost btn-block" style="color:var(--red)" data-action="staff-delete" data-id="${s.id}">${ic(I.trash, 18)}Delete Staff Member</button>` : ''}</form>`, async (d) => {
      const email = d.email.trim().toLowerCase(); const empNo = d.empNo.trim().toUpperCase();
      if (db.staff.some((x) => x.email.toLowerCase() === email && x.id !== s.id)) return 'That email is already in use';
      if (db.staff.some((x) => x.empNo === empNo && x.id !== s.id)) return 'That employee number is already in use';
      if (s.id === db.session && (!d.isAdmin || !d.active)) return 'You cannot remove your own admin access';
      const target = isNew ? { id: uid(), color: COLORS[db.staff.length % COLORS.length], photo: null, emergency: '', address: '', pin: randomPin(), compliance: {} } : staffById(s.id);
      Object.assign(target, { name: d.name.trim(), email, empNo, role: d.role.trim(), dept: d.dept.trim(), phone: d.phone.trim(), startDate: d.startDate, rate: Number(d.rate) || 0, licence: d.licence.trim(), leaveAllowance: Number(d.leaveAllowance) || 0, isAdmin: !!d.isAdmin, active: !!d.active });
      if (!CLOUD && d.password) { target.salt = uid(); target.pwHash = await hashPassword(d.password, target.salt); }
      if (isNew) db.staff.push(target);
      save(); render(); toast('Saved');
    });
  }
  function sheetChangePw() {
    openSheet(`<h2>Change Password</h2><form class="form">
      <div class="field"><label>Current password</label><input class="input" type="password" name="old" required></div>
      <div class="field"><label>New password</label><input class="input" type="password" name="pw" minlength="8" required></div>
      <div class="field"><label>Confirm new password</label><input class="input" type="password" name="pw2" required></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Update Password</button></form>`, async (d) => {
      const u = me();
      if (d.pw.length < 8) return 'Use at least 8 characters';
      if (d.pw !== d.pw2) return 'Passwords do not match';
      if (CLOUD) {
        const check = await cloud.sb.auth.signInWithPassword({ email: u.email, password: d.old });
        if (check.error) return 'Current password is incorrect';
        const { error } = await cloud.sb.auth.updateUser({ password: d.pw });
        if (error) return error.message;
        toast('Password changed'); return;
      }
      if (await hashPassword(d.old, u.salt) !== u.pwHash) return 'Current password is incorrect';
      u.salt = uid(); u.pwHash = await hashPassword(d.pw, u.salt); save(); toast('Password changed');
    });
  }

  // ---------- Clock ----------
  // maxAge: how old a remembered position may be. Clock on/off ask for a fresh one.
  function getGeo(maxAge = 60000) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }), () => resolve(null), { timeout: 8000, maximumAge: maxAge, enableHighAccuracy: maxAge === 0 });
    });
  }
  // Where a clock on/off happened compared with the site: 'ok', 'off' (too far away),
  // 'none' (location not shared), 'nosite' (site has no map position) or '' (not known yet).
  function distanceM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
  }
  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${m} m`;
  function geoCheck(e, out = false) {
    const g = out ? e.geoOut : e.geo; const site = siteById(e.siteId);
    if (!g) return { state: (out ? e.noGeoOut : e.noGeo) ? 'none' : '' };
    if (!site || site.lat == null || site.lng == null) return { state: 'nosite', g };
    const dist = distanceM(g, site); const radius = site.radius || CONFIG.siteRadiusMetres;
    // Give the benefit of the doubt for the phone's stated accuracy (capped, so a vague fix can't hide a long way off).
    return { state: dist - Math.min(g.acc || 0, 150) > radius ? 'off' : 'ok', g, dist };
  }
  function geoBadge(e, out = false) {
    const c = geoCheck(e, out); const map = c.g ? ` <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${c.g.lat},${c.g.lng}">Map</a>` : '';
    if (c.state === 'off') return `<span class="geo-flag off">⚠ Off site · ${fmtDist(c.dist)} away</span>${map}`;
    if (c.state === 'none') return '<span class="geo-flag off">⚠ No location</span>';
    if (c.state === 'ok') return `<span class="geo-flag ok">✓ On site</span>${map}`;
    if (c.state === 'nosite') return `<span class="geo-flag">📍 Located</span>${map}`;
    return '';
  }
  const geoIssue = (e) => ['off', 'none'].includes(geoCheck(e).state) || (e.clockOut && ['off', 'none'].includes(geoCheck(e, true).state));
  async function clockIn({ shiftId = null, siteId = null, method = 'app' } = {}) {
    const u = me(); if (openEntry(u.id)) return;
    const today = ymd(new Date());
    let shift = shiftId ? db.shifts.find((s) => s.id === shiftId) : null;
    if (!shift) shift = db.shifts.filter((s) => s.staffId === u.id && s.date === today && (!siteId || s.siteId === siteId)).sort(byStart)[0];
    const entry = { id: uid(), staffId: u.id, shiftId: shift?.id || null, siteId: siteId || shift?.siteId || null, clockIn: new Date().toISOString(), clockOut: null, breaks: [], geo: null, method };
    db.entries.push(entry);
    addOccurrence(`Clocked in${method !== 'app' ? ' via ' + method.toUpperCase() : ''}`, 'clock', entry.siteId);
    save(); ui.drawer = false; render(); toast(`Clocked in at ${fmtTime(new Date())}`);
    const geo = await getGeo(0);
    if (!openEntry(u.id) || entry.clockOut) return;
    if (geo) entry.geo = geo; else { entry.noGeo = true; toast('Location not shared: turn on location for this app'); }
    save();
  }
  function clockOut(approval = null, geo = null) {
    const e = openEntry(db.session); if (!e) return;
    const now = new Date().toISOString();
    e.breaks.forEach((b) => { if (!b.end) b.end = now; });
    // Saved in the same change as the clock-out time: a finished record can't be edited by staff afterwards.
    if (geo) e.geoOut = geo; else e.noGeoOut = true;
    e.clockOut = now;
    if (approval) e.approval = { ...approval, time: now };
    addOccurrence(`Clocked out · ${fmtDur(entryWorkedMs(e))} worked${approval ? ` · approved by ${approval.name}` : ''}`, 'clock', e.siteId);
    save(); ui.drawer = false; render(); toast(`Clocked out · ${fmtDur(entryWorkedMs(e))} worked`);
  }
  function sheetClockOut() {
    const e = openEntry(db.session); if (!e) return;
    const site = siteById(e.siteId);
    let signed = false;
    const geoP = getGeo(0); // start now, while the customer signs
    const root = openSheet(`<h2>Clock Out</h2>
      <p style="margin-top:0">Worked <b>${fmtDur(entryWorkedMs(e))}</b> since ${fmtTime(new Date(e.clockIn))}${site ? ` at ${esc(site.name)}` : ''}.</p>
      <form class="form">
        <h3 style="margin:4px 0 0">Customer Approval <span class="small muted" style="font-weight:400">(optional)</span></h3>
        <div class="field"><label>Customer name</label><input class="input" name="name" autocomplete="off" placeholder="Name of person approving"></div>
        <div class="field"><label>Signature</label><canvas class="sig" id="sig" aria-label="Signature pad"></canvas>
          <button type="button" class="small muted" id="sig-clear" style="align-self:flex-end;text-decoration:underline">Clear signature</button></div>
        <div class="error"></div>
        <button class="btn btn-red btn-block" type="submit">Clock Out</button>
        <button class="btn btn-ghost btn-block" type="button" data-dismiss>Cancel</button>
      </form>`, async (d) => {
      const name = d.name.trim();
      if (signed && !name) return 'Enter the customer\'s name, or clear the signature';
      if (name && !signed) return 'Ask the customer to sign, or clear their name';
      const btn = root.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Getting location…';
      const geo = await geoP;
      clockOut(name ? { name, signature: canvas.toDataURL('image/png') } : null, geo);
    });
    const canvas = root.querySelector('#sig'); const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
    let drawing = false;
    const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (ev) => { drawing = true; canvas.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.moveTo(...pos(ev)); });
    canvas.addEventListener('pointermove', (ev) => { if (!drawing) return; ctx.lineTo(...pos(ev)); ctx.stroke(); signed = true; });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    root.querySelector('#sig-clear').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); signed = false; });
  }
  function sheetApproval(id) {
    const e = db.entries.find((x) => x.id === id); if (!e?.approval) return;
    openSheet(`<h2>Customer Approval</h2><p style="margin-top:0">Approved by <b>${esc(e.approval.name)}</b> on ${fmtStamp(e.approval.time)}</p>
      <img src="${e.approval.signature}" alt="Signature of ${esc(e.approval.name)}" style="width:100%;border:1px solid var(--line);border-radius:8px;background:#fff">
      <button class="btn btn-ghost btn-block" data-dismiss style="margin-top:14px">Close</button>`);
  }

  // ---------- Files ----------
  function download(name, text, type = 'text/csv') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const toCsv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const GEO_LABEL = { ok: 'On site', off: 'OFF SITE', none: 'No location', nosite: 'Site has no map position', '': '' };
  function timesheetCsv(entries) {
    const rows = [['Employee no', 'Name', 'Date', 'Site', 'Clock in', 'Clock out', 'Break (min)', 'Worked (h)', 'Method', 'Customer approval', 'In latitude', 'In longitude', 'In distance from site (m)', 'In location check', 'Out latitude', 'Out longitude', 'Out distance from site (m)', 'Out location check']];
    entries.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn)).forEach((e) => {
      const s = staffById(e.staffId) || {}; const cin = new Date(e.clockIn);
      rows.push([s.empNo, s.name, dmy(cin), siteById(e.siteId)?.name, fmtTime(cin), e.clockOut ? fmtTime(new Date(e.clockOut)) : '', Math.round(entryBreakMs(e) / 60000), hours(entryWorkedMs(e)).toFixed(2), e.method, e.approval ? `${e.approval.name} (${fmtStamp(e.approval.time)})` : '', ...[false, true].flatMap((out) => { const c = geoCheck(e, out); const g = c.g; return out && !e.clockOut ? ['', '', '', ''] : [g?.lat, g?.lng, c.dist ?? '', GEO_LABEL[c.state]]; })]);
    });
    return toCsv(rows);
  }
  function resizePhoto(file, size = 256, square = true) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement('canvas'); const ctx = c.getContext('2d');
        if (square) {
          c.width = c.height = size;
          const k = Math.max(size / img.width, size / img.height); const w = img.width * k; const h = img.height * k;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        } else {
          const k = Math.min(1, size / Math.max(img.width, img.height));
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          ctx.drawImage(img, 0, 0, c.width, c.height);
        }
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject; img.src = url;
    });
  }

  // ---------- Shared database (Supabase) ----------
  // With CONFIG.supabaseUrl/supabaseAnonKey set, every change is saved to one shared
  // database and other phones receive it within seconds. Each record is a row in the
  // `records` table (see supabase/schema.sql), which also enforces who may change what.
  // The copy in localStorage keeps the app usable offline; unsent changes are retried.
  const SYNCED = ['staff', 'sites', 'shifts', 'entries', 'leave', 'incidents', 'occurrences', 'documents',
    'docReads', 'messages', 'register', 'welfare', 'trainingDone', 'training', 'support', 'staffDocs'];
  const SYNCED_KEY = STORE_KEY + '-synced';
  const cloud = { sb: null, synced: {}, pushTimer: null, pushing: null, renderWanted: false, channel: null };
  try { cloud.synced = JSON.parse(localStorage.getItem(SYNCED_KEY) || '{}'); } catch (e) { cloud.synced = {}; }

  // Password hashes are only used on-device; Supabase handles passwords in cloud mode.
  const rowData = (c, item) => { if (c !== 'staff') return item; const { salt, pwHash, ...rest } = item; return rest; };
  const persistSynced = () => { try { localStorage.setItem(SYNCED_KEY, JSON.stringify(cloud.synced)); } catch (e) { /* cache only */ } };
  const isNetworkError = (err) => !err?.code || /fetch|network|timeout/i.test(err.message || '');

  async function cloudInit() {
    try {
      const createClient = window.VWG_TEST_SUPABASE || (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient;
      const auth = { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true };
      if (HQ) auth.storageKey = 'vwg-hq-auth';
      cloud.sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth });
    } catch (e) {
      toast('Offline — showing the last saved copy');
      return;
    }
    cloud.sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setTimeout(sheetNewPassword, 300); });
    window.addEventListener('online', () => cloudPush());
    setInterval(() => { if (cloudDirty()) cloudPush(); }, 30000);
    const { data } = await cloud.sb.auth.getSession();
    if (data?.session) {
      const err = await cloudAfterSignIn(data.session.user.email);
      if (err) toast(err);
    } else {
      db.session = null;
    }
  }

  // Rows that differ from what the server last confirmed.
  function cloudChanges() {
    const upserts = []; const deletes = [];
    SYNCED.forEach((c) => {
      const prev = cloud.synced[c] || {}; const seen = new Set();
      (db[c] || []).forEach((item) => {
        if (!item.id) item.id = uid();
        seen.add(item.id);
        const json = JSON.stringify(rowData(c, item));
        if (prev[item.id] !== json) upserts.push({ c, id: item.id, json });
      });
      Object.keys(prev).forEach((id) => { if (!seen.has(id)) deletes.push({ c, id }); });
    });
    return { upserts, deletes };
  }
  const cloudDirty = () => { const { upserts, deletes } = cloudChanges(); return upserts.length + deletes.length > 0; };

  function cloudSchedulePush() {
    if (!cloud.sb) return;
    clearTimeout(cloud.pushTimer);
    cloud.pushTimer = setTimeout(cloudPush, 400);
  }

  async function cloudPush() {
    if (!cloud.sb || !db.session) return;
    if (cloud.pushing) { await cloud.pushing; }
    cloud.pushing = (async () => {
      const { upserts, deletes } = cloudChanges();
      if (!upserts.length && !deletes.length) return;
      let rejected = null;
      // Staff first, so a brand-new manager exists before the rest of their records.
      const order = (c) => (c === 'staff' ? 0 : 1);
      const byCollection = {};
      upserts.sort((a, b) => order(a.c) - order(b.c)).forEach((u) => { (byCollection[u.c] = byCollection[u.c] || []).push(u); });
      for (const [c, rows] of Object.entries(byCollection)) {
        const { error } = await cloud.sb.from('records').upsert(rows.map((r) => ({ collection: c, id: r.id, data: JSON.parse(r.json) })));
        if (error) { if (isNetworkError(error)) return; rejected = error; continue; }
        cloud.synced[c] = cloud.synced[c] || {};
        rows.forEach((r) => { cloud.synced[c][r.id] = r.json; });
      }
      for (const d of deletes) {
        const { error } = await cloud.sb.from('records').delete().match({ collection: d.c, id: d.id });
        if (error) { if (isNetworkError(error)) return; rejected = error; continue; }
        delete cloud.synced[d.c][d.id];
      }
      persistSynced();
      if (rejected) {
        // The server refused a change (not allowed for this user): go back to the server's copy.
        toast(`Not saved: ${rejected.message}`);
        await cloudPull();
        render();
      }
    })();
    try { await cloud.pushing; } finally { cloud.pushing = null; }
  }

  async function cloudPull() {
    const all = Object.fromEntries(SYNCED.map((c) => [c, []]));
    for (let from = 0; ; from += 1000) {
      const { data, error } = await cloud.sb.from('records').select('collection,id,data').order('collection').order('id').range(from, from + 999);
      if (error) throw error;
      data.forEach((r) => { if (all[r.collection]) all[r.collection].push(r.data); });
      if (data.length < 1000) break;
    }
    SYNCED.forEach((c) => {
      db[c] = all[c];
      cloud.synced[c] = Object.fromEntries(all[c].map((x) => [x.id, JSON.stringify(x)]));
    });
    persistSynced(); localSave();
  }

  function cloudSubscribe() {
    if (cloud.channel) return;
    cloud.channel = cloud.sb.channel('vwg-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, onRemoteChange)
      .subscribe((status) => { const was = cloud.status; cloud.status = status; if (HQ && was !== status) requestRender(); });
  }

  function onRemoteChange(p) {
    const row = p.eventType === 'DELETE' ? p.old : p.new;
    const c = row?.collection; if (!SYNCED.includes(c)) return;
    const list = db[c]; const idx = list.findIndex((x) => x.id === row.id);
    const synced = (cloud.synced[c] = cloud.synced[c] || {});
    // A change made on this phone that hasn't reached the server yet wins; it will be sent next.
    if (idx >= 0 && JSON.stringify(rowData(c, list[idx])) !== synced[row.id]) return;
    if (p.eventType === 'DELETE') {
      if (idx >= 0) list.splice(idx, 1);
      delete synced[row.id];
    } else {
      if (idx >= 0) list[idx] = row.data; else list.push(row.data);
      synced[row.id] = JSON.stringify(row.data);
    }
    persistSynced(); localSave();
    if (HQ && c === 'welfare') hqCheckAlerts();
    if (c === 'staff' && !me()?.active) { cloudSignOut('Your account has been deactivated.'); return; }
    requestRender();
  }

  // Re-draw with new data, but never under someone who is typing or has a form open.
  function requestRender() {
    const busy = $('#sheet-root').children.length || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (busy) cloud.renderWanted = true; else render();
  }

  async function cloudSignIn(email, password) {
    const { error } = await cloud.sb.auth.signInWithPassword({ email, password });
    if (error) return /confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox for the link.' : 'Incorrect email address or password';
    return cloudAfterSignIn(email);
  }

  async function cloudAfterSignIn(email) {
    try {
      await cloudPush();
      await cloudPull();
    } catch (e) {
      if (!db.staff.length) return 'Could not reach the server. Check your connection and try again.';
    }
    let u = db.staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (!u && !db.staff.length) u = await cloudBootstrap(email);
    if (!u || !u.active || (HQ && !u.isAdmin)) {
      await cloud.sb.auth.signOut();
      db.session = null; localSave();
      return u?.active ? HQ_ONLY : "This email isn't set up as a staff member yet. Ask your manager to add you.";
    }
    db.session = u.id; localSave();
    cloudSubscribe();
    return null;
  }

  // The very first person to sign in to an empty database becomes the manager.
  async function cloudBootstrap(email) {
    const name = (prompt(`Welcome! You're the first person to sign in, so you'll be the manager.\n\nYour full name:`) || '').trim() || email.split('@')[0];
    const u = {
      id: uid(), empNo: 'VWG001', name, email: email.toLowerCase(), role: 'Manager', dept: 'Management', isAdmin: true, active: true,
      rate: 0, phone: '', startDate: ymd(new Date()), color: COLORS[0], photo: null, emergency: '', address: '',
      leaveAllowance: 28, pin: randomPin(), licence: '', compliance: {},
    };
    db.staff.push(u);
    db.session = u.id;
    if (!db.training.length) db.training = defaultTraining();
    await cloudPush();
    return u;
  }

  async function cloudSignOut(message) {
    try { await cloudPush(); } catch (e) { /* best effort */ }
    try { await cloud.sb.auth.signOut(); } catch (e) { /* already signed out */ }
    if (cloud.channel) { cloud.sb.removeChannel(cloud.channel); cloud.channel = null; }
    // Don't leave company data on a shared phone after signing out.
    db = Object.assign(emptyDb(), { onboarded: true });
    cloud.synced = {}; persistSynced(); localSave();
    ui.drawer = false; ui.stack = []; ui.route = CONFIG.startPage;
    render();
    if (message) toast(message);
  }

  function sheetNewPassword() {
    openSheet(`<h2>Set a New Password</h2><form class="form">
      <div class="field"><label>New password</label><input class="input" type="password" name="pw" minlength="8" required autocomplete="new-password"></div>
      <div class="field"><label>Confirm new password</label><input class="input" type="password" name="pw2" required autocomplete="new-password"></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save Password</button></form>`, async (d) => {
      if (d.pw.length < 8) return 'Use at least 8 characters';
      if (d.pw !== d.pw2) return 'Passwords do not match';
      const { data, error } = await cloud.sb.auth.updateUser({ password: d.pw });
      if (error) return error.message;
      history.replaceState(null, '', location.pathname);
      const err = await cloudAfterSignIn(data.user.email);
      render(); toast(err || 'Password saved — you are signed in');
    });
  }

  function sheetForgotCloud() {
    const email = esc($('#email')?.value || '');
    openSheet(`<h2>Forgot Password</h2>
      <div class="seg"><button class="on" type="button" data-pwtab="reset">Reset password</button><button type="button" data-pwtab="new">New staff</button></div>
      <form class="form" id="pw-reset"><p class="muted" style="margin:0">We'll email you a link to choose a new password.</p>
        <div class="field"><label>Email Address</label><input class="input" type="email" name="email" value="${email}" required></div>
        <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Send Reset Link</button></form>
      <form class="form" id="pw-new" hidden><p class="muted" style="margin:0">First time using the app? Once your manager has added you, create your password here.</p>
        <div class="field"><label>Work email</label><input class="input" type="email" name="email" value="${email}" required></div>
        <div class="field"><label>Choose a password</label><input class="input" type="password" name="pw" minlength="8" required autocomplete="new-password"></div>
        <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Create My Account</button></form>`);
    const root = $('#sheet-root');
    root.querySelectorAll('[data-pwtab]').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('[data-pwtab]').forEach((x) => x.classList.toggle('on', x === b));
      root.querySelector('#pw-reset').hidden = b.dataset.pwtab !== 'reset';
      root.querySelector('#pw-new').hidden = b.dataset.pwtab !== 'new';
    }));
    const redirectTo = location.origin + location.pathname;
    root.querySelector('#pw-reset').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target;
      const { error } = await cloud.sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo });
      if (error) { f.querySelector('.error').textContent = error.message; return; }
      closeSheet(); toast('Check your email for the reset link');
    });
    root.querySelector('#pw-new').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target;
      if (f.pw.value.length < 8) { f.querySelector('.error').textContent = 'Use at least 8 characters'; return; }
      const { data, error } = await cloud.sb.auth.signUp({ email: f.email.value.trim(), password: f.pw.value, options: { emailRedirectTo: redirectTo } });
      if (error) { f.querySelector('.error').textContent = /staff list|Database error/i.test(error.message) ? 'This email is not on the staff list yet. Ask your manager to add you first.' : error.message; return; }
      closeSheet();
      if (data.session) { const err = await cloudAfterSignIn(f.email.value.trim()); render(); toast(err || 'Account created — welcome!'); }
      else toast('Nearly done! Check your email and tap the confirmation link.');
    });
  }

  // ---------- Render ----------
  // ---------- HQ desktop console (hq.html) ----------
  // Managers only. Uses the same data as the phones, and updates live in shared mode.
  const HQ_NAV = [
    ['Monitor', [['hq', 'Live Overview', I.home], ['hq-requests', 'Requests', I.log], ['occurrence', 'Occurrence Log', I.clock], ['register', 'Sign On Register', I.qr]]],
    ['Operations', [['hq-roster', 'Roster', I.cal], ['hq-staff', 'Staff', I.user], ['hq-sites', 'Sites', I.shield], ['forms', 'Incident / Forms', I.log]]],
    ['Team', [['messages', 'Team Message', I.chat], ['docs', 'Document Library', I.log], ['training', 'Training', I.heart]]],
    ['Reports', [['hq-reports', 'Hours & Exports', I.download]]],
  ];
  // Detail pages light up their parent in the sidebar.
  const HQ_PARENT = { doc: 'docs', module: 'training', thread: 'messages' };
  const HQ_ROUTES = ['hq', 'hq-requests', 'hq-roster', 'hq-staff', 'hq-sites', 'hq-reports', 'occurrence', 'register', 'forms', 'messages', 'thread', 'docs', 'doc', 'training', 'module'];
  const hq = { alertsOn: false, seenHelp: null, refreshAt: 0 };
  const LATE_GRACE_MIN = 5;
  const shiftStart = (s) => { const d = parseYmd(s.date); const [h, m] = s.start.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
  const shiftEnd = (s) => new Date(shiftStart(s).getTime() + shiftMinutes(s) * 60000);
  const clockedInFor = (s) => db.entries.some((e) => e.staffId === s.staffId && (e.shiftId === s.id || (!e.clockOut && !e.shiftId) || ymd(new Date(e.clockIn)) === s.date));
  const helpAlerts = () => db.welfare.filter((w) => w.status === 'help' && !w.ack && Date.now() - new Date(w.time).getTime() < 86400000).sort((a, b) => b.time.localeCompare(a.time));
  const pendingCount = () => db.leave.filter((l) => l.status === 'pending').length + db.shifts.filter((s) => s.status === 'pending' && s.staffId).length + db.resetRequests.filter((r) => !r.done).length + db.incidents.filter((i) => i.status === 'open').length;

  function hqToday() {
    const now = new Date(); const today = ymd(now);
    const rostered = db.shifts.filter((s) => s.date === today && s.staffId && s.status !== 'cancelled').sort(byStart);
    const live = db.entries.filter((e) => !e.clockOut).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    const notIn = rostered.filter((s) => !openEntry(s.staffId) && !clockedInFor(s) && shiftEnd(s) > now);
    const late = notIn.filter((s) => now - shiftStart(s) > LATE_GRACE_MIN * 60000);
    const due = notIn.filter((s) => !late.includes(s));
    const overdue = live.filter((e) => welfareDue(e.staffId));
    return { now, today, rostered, live, late, due, overdue };
  }

  function hqNav() {
    const active = HQ_PARENT[ui.route] || ui.route;
    const badge = { hq: helpAlerts().length, 'hq-requests': pendingCount() };
    return HQ_NAV.map(([group, items]) => `<div class="hq-group">${group}</div>${items.map(([r, label, icon]) => `<button class="hq-link ${active === r ? 'on' : ''}" data-nav="${r}">${ic(icon, 18)}<span>${label}</span>${badge[r] ? `<em class="${r === 'hq' ? 'alert' : ''}">${badge[r]}</em>` : ''}</button>`).join('')}`).join('');
  }

  function hqShell(content) {
    const u = me();
    const title = { hq: 'Live Overview', 'hq-requests': 'Requests', 'hq-roster': 'Roster', 'hq-staff': 'Staff', 'hq-sites': 'Sites', 'hq-reports': 'Hours & Exports' }[ui.route];
    const sync = !CLOUD ? ['demo', 'Demo data on this computer'] : !navigator.onLine ? ['off', 'Offline: showing the last saved copy'] : cloud.status === 'SUBSCRIBED' ? ['on', 'Live'] : ['wait', 'Connecting…'];
    return `<div class="hq">
      <aside class="hq-side">
        <div class="hq-brand">${logoImg(150)}<span>HQ Console</span></div>
        <nav class="hq-nav">${hqNav()}</nav>
        <div class="hq-me"><div class="avatar" style="background:${u.color}">${u.photo ? `<img src="${u.photo}" alt="">` : initials(u.name)}</div><div><b>${esc(u.name)}</b><span>${esc(u.role)}</span></div></div>
        <div class="hq-side-foot"><a href="index.html" target="_blank" rel="noopener">Open staff app</a><button data-action="logout">Sign out</button></div>
      </aside>
      <main class="hq-main">
        <header class="hq-top">
          <h1>${title ? esc(title) : ''}</h1>
          <div class="hq-top-right">
            <span class="hq-sync ${sync[0]}" title="${sync[1]}"><i></i>${sync[1]}</span>
            <span class="hq-clock"><b id="live-time">${fmtTime(new Date())}</b> ${dmy(new Date())}</span>
            <button class="btn btn-ghost btn-sm" data-action="hq-alerts" title="Desktop pop-up and sound when someone asks for help">${hq.alertsOn ? '🔔 Alerts on' : '🔕 Turn on alerts'}</button>
            <button class="btn btn-ghost btn-sm" data-action="refresh">${ic(I.refresh, 16, 2.4)}Refresh</button>
          </div>
        </header>
        <div class="hq-content ${title ? '' : 'hq-mobile'}">${content}</div>
      </main>
    </div>`;
  }

  const hqTable = (head, rows, empty) => rows.length
    ? `<div class="hq-table-wrap"><table class="hq-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : `<div class="empty">${empty}</div>`;
  const who = (s) => s ? `<div class="hq-who">${avatar(s)}<div><b>${esc(s.name)}</b><span>${esc(s.empNo)} · ${esc(s.role)}</span></div></div>` : '<span class="muted">Unknown</span>';
  const telLink = (s) => s?.phone ? `<a class="link" href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : '<span class="muted">—</span>';
  const mapLink = (g) => g ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${g.lat},${g.lng}">Map</a>` : '';

  function viewHq() {
    const t = hqToday(); const help = helpAlerts();
    const kpi = (n, label, tone = '', nav = '') => `<${nav ? `button data-nav="${nav}"` : 'div'} class="hq-kpi ${n && tone ? tone : ''}"><b>${n}</b><span>${label}</span></${nav ? 'button' : 'div'}>`;
    const alerts = help.map((w) => { const s = staffById(w.staffId); const e = openEntry(w.staffId); const site = siteById(e?.siteId); return `<div class="hq-alert" role="alert"><span class="hq-alert-icon">!</span><div><b>${esc(s?.name || 'Unknown')} needs help</b><span>${fmtStamp(w.time)}${site ? ' · ' + esc(site.name) : ''} · ${telLink(s)} ${mapLink(w.geo)}</span></div><button class="btn btn-sm" data-action="hq-ack" data-id="${w.id}">Acknowledge</button></div>`; }).join('');

    const liveRows = t.live.map((e) => {
      const s = staffById(e.staffId); const site = siteById(e.siteId); const lw = lastWelfare(e.staffId);
      const state = onBreak(e) ? '<span class="status st-pending">On break</span>' : welfareDue(e.staffId) ? '<span class="status st-high">⚠ Welfare overdue</span>' : '<span class="status st-on-site">✓ On site</span>';
      return `<tr><td>${who(s)}</td><td>${esc(site?.name || '—')}<span class="sub">${esc(site?.customer || '')}</span></td><td class="nw">${fmtTime(new Date(e.clockIn))}<span class="sub">${e.method !== 'app' ? e.method.toUpperCase() : 'App'}</span></td><td class="nw">${geoBadge(e) || '<span class="muted small">Waiting…</span>'}</td><td class="num">${fmtDur(entryWorkedMs(e))}</td><td>${lw ? fmtTime(new Date(lw.time)) : '<span class="muted">None yet</span>'}</td><td>${state}</td><td>${telLink(s)}</td></tr>`;
    });
    const missRows = [...t.late, ...t.due].map((s) => {
      const p = staffById(s.staffId); const site = siteById(s.siteId); const mins = Math.round((t.now - shiftStart(s)) / 60000);
      return `<tr><td>${who(p)}</td><td class="nw">${s.start} - ${s.end}</td><td>${esc(site?.name || '—')}</td><td>${mins > LATE_GRACE_MIN ? `<span class="status st-high">⚠ Late ${fmtDur(mins * 60000)}</span>` : `<span class="status st-low">Starts ${s.start}</span>`}</td><td>${telLink(p)}</td></tr>`;
    });
    const sites = db.sites.map((site) => {
      const on = t.live.filter((e) => e.siteId === site.id).length;
      const need = t.rostered.filter((s) => s.siteId === site.id && shiftStart(s) <= t.now && shiftEnd(s) > t.now).length;
      const visitors = db.register.filter((r) => r.siteId === site.id && !r.outAt).length;
      const incidents = db.incidents.filter((i) => i.siteId === site.id && i.status === 'open').length;
      const short = on < need;
      return `<div class="hq-site ${short ? 'short' : ''}"><div class="hq-site-head"><b>${esc(site.name)}</b>${short ? '<span class="status st-high">⚠ Short</span>' : on ? '<span class="status st-on-site">✓ Covered</span>' : '<span class="status st-low">Closed</span>'}</div>
        <span class="sub">${esc(site.customer)} · ${esc(site.city)}</span>
        <dl><div><dt>On site</dt><dd>${on}${need ? ` / ${need}` : ''}</dd></div><div><dt>Visitors</dt><dd>${visitors}</dd></div><div><dt>Open incidents</dt><dd>${incidents}</dd></div></dl></div>`;
    }).join('');
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const geoRows = db.entries.filter((e) => e.clockIn >= weekAgo && geoIssue(e)).sort((a, b) => b.clockIn.localeCompare(a.clockIn)).slice(0, 30).map((e) => {
      const s = staffById(e.staffId); const site = siteById(e.siteId); const cin = new Date(e.clockIn); const bad = (out) => ['off', 'none'].includes(geoCheck(e, out).state);
      return `<tr><td>${who(s)}</td><td class="nw">${DAYS[cin.getDay()].slice(0, 3)} ${dmy(cin)}</td><td>${esc(site?.name || '—')}</td><td>${fmtTime(cin)} ${bad(false) ? geoBadge(e) : '<span class="muted small">OK</span>'}</td><td>${e.clockOut ? `${fmtTime(new Date(e.clockOut))} ${bad(true) ? geoBadge(e, true) : '<span class="muted small">OK</span>'}` : '<span class="muted small">On shift</span>'}</td></tr>`;
    });
    const noPos = db.sites.filter((x) => x.lat == null).length;
    const feed = db.occurrences.slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 14).map((o) => { const s = staffById(o.staffId); const site = siteById(o.siteId); return `<li class="k-${o.kind}"><time>${fmtTime(new Date(o.time))}<span>${dmy(new Date(o.time)).slice(0, 5)}</span></time><div><b>${esc(o.text)}</b><span>${esc(s?.name || '')}${site ? ' · ' + esc(site.name) : ''}</span></div></li>`; }).join('');

    return `${alerts ? `<div class="hq-alerts">${alerts}</div>` : ''}
      <div class="hq-kpis">
        ${kpi(t.live.length, 'On shift now')}
        ${kpi(t.rostered.length, 'Rostered today')}
        ${kpi(t.late.length, 'Late / not clocked in', 'bad')}
        ${kpi(t.overdue.length, 'Welfare overdue', 'warn')}
        ${kpi(help.length, 'Help alerts', 'bad')}
        ${kpi(pendingCount(), 'Requests to review', 'warn', 'hq-requests')}
      </div>
      <div class="hq-grid">
        <section class="hq-panel span-3"><div class="hq-panel-head"><h2>On shift now</h2><span class="muted small">Welfare check every ${CONFIG.welfareMinutes} min</span></div>
          ${hqTable(['Staff', 'Site', 'Clocked in', 'Location', 'Worked', 'Last welfare', 'Status', 'Phone'], liveRows, 'Nobody is clocked in right now.')}</section>
        <section class="hq-panel span-2"><div class="hq-panel-head"><h2>Not clocked in yet</h2><span class="muted small">Late after ${LATE_GRACE_MIN} min</span></div>
          ${hqTable(['Staff', 'Shift', 'Site', 'Status', 'Phone'], missRows, 'Everyone rostered so far is accounted for.')}</section>
        <section class="hq-panel"><div class="hq-panel-head"><h2>Sites now</h2><button class="link small" data-nav="hq-sites">Manage</button></div>
          ${sites ? `<div class="hq-sites">${sites}</div>` : '<div class="empty">No sites yet.</div>'}</section>
        <section class="hq-panel span-2"><div class="hq-panel-head"><h2>Location checks, last 7 days</h2><span class="muted small">Clock on/off away from the site or without location${noPos ? ` · <button class="link" data-nav="hq-sites" style="color:var(--amber);font-weight:600">${noPos} site${noPos > 1 ? 's have' : ' has'} no map position</button>` : ''}</span></div>
          ${hqTable(['Staff', 'Day', 'Site', 'Clock on', 'Clock off'], geoRows, 'All clock-ons and clock-offs were on site.')}</section>
        <section class="hq-panel"><div class="hq-panel-head"><h2>Activity</h2><button class="link small" data-nav="occurrence">Full log</button></div>
          ${feed ? `<ul class="hq-feed">${feed}</ul>` : '<div class="empty">No activity yet.</div>'}</section>
        <section class="hq-panel span-3"><div class="hq-panel-head"><h2>Hours worked, last 14 days</h2><button class="link small" data-nav="hq-reports">Reports</button></div>${hqHoursChart(14)}</section>
      </div>`;
  }

  // One series (hours per day): a single gold bar colour, no legend; hover shows the value.
  function hqHoursChart(n) {
    const end = addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1);
    const days = Array.from({ length: n }, (_, i) => addDays(end, i - n));
    const vals = days.map((d) => hours(db.entries.filter((e) => { const c = new Date(e.clockIn); return c >= d && c < addDays(d, 1); }).reduce((t, e) => t + entryWorkedMs(e), 0)));
    const max = Math.max(8, ...vals); const step = max > 80 ? 20 : max > 40 ? 10 : max > 16 ? 5 : 2; const top = Math.ceil(max / step) * step;
    const W = 960, H = 240, L = 40, R = 8, T = 12, B = 34; const pw = W - L - R, ph = H - T - B; const bw = pw / n;
    const y = (v) => T + ph - (v / top) * ph;
    let grid = ''; for (let v = 0; v <= top; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${v ? 'g' : 'base'}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}h</text>`;
    const bars = vals.map((v, i) => {
      const x = L + i * bw + 1; const w = Math.max(2, bw - 2); const h = Math.max(0, (v / top) * ph); const r = Math.min(4, h, w / 2);
      const path = h ? `M${x},${T + ph} V${T + ph - h + r} Q${x},${T + ph - h} ${x + r},${T + ph - h} H${x + w - r} Q${x + w},${T + ph - h} ${x + w},${T + ph - h + r} V${T + ph} Z` : '';
      const d = days[i]; const tip = `${DAYS[d.getDay()].slice(0, 3)} ${dmy(d)}: ${fmtDur(v * 3600000)}`;
      return `<g class="bar" data-tip="${tip}"><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph}"/>${path ? `<path d="${path}"/>` : ''}<text x="${L + i * bw + bw / 2}" y="${H - 14}" text-anchor="middle">${pad(d.getDate())}/${pad(d.getMonth() + 1)}</text></g>`;
    }).join('');
    const total = vals.reduce((a, b) => a + b, 0);
    return `<div class="hq-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours worked per day for the last ${n} days, ${fmtDur(total * 3600000)} in total">${grid}${bars}</svg><div class="hq-tip" hidden></div></div>
      <details class="hq-chart-table"><summary>Show as table · total ${fmtDur(total * 3600000)}</summary>${hqTable(['Day', 'Hours'], days.map((d, i) => `<tr><td>${DAYS[d.getDay()]} ${dmy(d)}</td><td class="num">${fmtDur(vals[i] * 3600000)}</td></tr>`).reverse(), '')}</details>`;
  }

  function viewHqRoster() {
    const [from] = weekRange(); const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(from, i))); const today = ymd(new Date());
    const people = db.staff.filter((s) => s.active || db.shifts.some((x) => x.staffId === s.id && days.includes(x.date))).sort((a, b) => a.name.localeCompare(b.name));
    const chip = (s) => { const site = siteById(s.siteId); return `<button class="hq-chip st-${slug(s.status)}" data-action="shift-edit" data-id="${s.id}" title="${esc(site?.customer || '')} · ${esc(site?.name || '')}"><b>${s.start}-${s.end}</b><span>${esc(site?.name || '')}</span></button>`; };
    const cell = (list, d, staffId) => `<td class="${d === today ? 'today' : ''}">${list.sort(byStart).map(chip).join('')}<button class="hq-add" data-action="shift-new" data-date="${d}" data-staff="${staffId}" aria-label="Add shift">+</button></td>`;
    const row = (label, staffId, filter) => `<tr><th>${label}</th>${days.map((d) => cell(db.shifts.filter((x) => x.date === d && filter(x)), d, staffId)).join('')}<td class="num">${fmtDur(db.shifts.filter((x) => days.includes(x.date) && filter(x) && x.status !== 'cancelled').reduce((t, x) => t + shiftMinutes(x) * 60000, 0))}</td></tr>`;
    return `<div class="hq-toolbar">${weekNav()}<div class="hq-legend"><span class="status st-confirmed">Confirmed</span><span class="status st-pending">Awaiting OK</span><span class="status st-offered">Open / offered</span><span class="status st-cancelled">Cancelled</span></div><button class="btn btn-gold btn-sm" data-action="shift-new">${ic(I.plus, 16)}Add Shift</button></div>
      <section class="hq-panel"><div class="hq-table-wrap"><table class="hq-table hq-roster"><thead><tr><th>Staff</th>${days.map((d) => { const x = parseYmd(d); return `<th class="${d === today ? 'today' : ''}">${DAYS[x.getDay()].slice(0, 3)} ${pad(x.getDate())}/${pad(x.getMonth() + 1)}</th>`; }).join('')}<th>Hours</th></tr></thead>
      <tbody>${row('<span class="muted">Open shifts</span>', '', (x) => !x.staffId)}${people.map((p) => row(who(p), p.id, (x) => x.staffId === p.id)).join('')}</tbody></table></div></section>`;
  }

  function viewHqStaff() {
    const from = startOfWeek(new Date()); const to = addDays(from, 7); const mods = db.training.filter((t) => t.q).length;
    const rows = db.staff.slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name)).map((s) => {
      const e = openEntry(s.id); const issues = s.isAdmin ? 0 : complianceIssues(s); const done = db.training.filter((t) => t.q && db.trainingDone.some((x) => x.moduleId === t.id && x.staffId === s.id)).length;
      return `<tr class="${s.active ? '' : 'inactive'}"><td>${who(s)}</td><td>${esc(s.dept || '')}${s.isAdmin ? '<span class="sub">Admin</span>' : ''}</td><td>${telLink(s)}<span class="sub">${esc(s.email)}</span></td>
        <td>${!s.active ? '<span class="status st-low">Inactive</span>' : e ? `<span class="status st-on-site">✓ On shift</span><span class="sub">${esc(siteById(e.siteId)?.name || '')}</span>` : '<span class="muted">Off</span>'}</td>
        <td class="num">${fmtDur(workedBetween(s.id, from, to))}</td><td>${s.isAdmin ? '<span class="muted">—</span>' : issues ? `<span class="status st-expired">⚠ ${issues} issue${issues > 1 ? 's' : ''}</span>` : '<span class="status st-valid">✓ OK</span>'}</td>
        <td>${mods ? `${done} / ${mods}` : '—'}</td><td><button class="btn btn-ghost btn-sm" data-action="staff-edit" data-id="${s.id}">Edit</button>${CLOUD ? ` <button class="btn btn-ghost btn-sm" data-action="send-reset" data-id="${s.id}" title="Email a password reset link">Reset password</button>` : ''}</td></tr>`;
    });
    return `<div class="hq-toolbar"><div class="muted">${db.staff.filter((s) => s.active).length} active staff</div><button class="btn btn-gold btn-sm" data-action="staff-new">${ic(I.plus, 16)}Add Staff Member</button></div>
      <section class="hq-panel">${hqTable(['Staff', 'Department', 'Contact', 'Now', 'Hours this week', 'Compliance', 'Training', ''], rows, 'No staff yet.')}</section>`;
  }

  const viewHqSites = () => `<div class="hq-narrow">${adminBody('sites')}</div>`;
  const viewHqRequests = () => `<div class="hq-columns">${adminBody('requests')}</div>`;
  const viewHqReports = () => `<section class="hq-panel"><div class="hq-panel-head"><h2>Hours worked, last 28 days</h2></div>${hqHoursChart(28)}</section><div class="hq-narrow">${adminBody('reports')}</div>`;

  function hqTooltips() {
    document.querySelectorAll('.hq-chart').forEach((box) => {
      const tip = box.querySelector('.hq-tip');
      box.addEventListener('mousemove', (ev) => {
        const g = ev.target.closest('.bar'); box.querySelectorAll('.bar.on').forEach((x) => x !== g && x.classList.remove('on'));
        if (!g) { tip.hidden = true; return; }
        g.classList.add('on'); tip.textContent = g.dataset.tip; tip.hidden = false;
        const r = box.getBoundingClientRect(); tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, ev.clientX - r.left - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - 44) + 'px';
      });
      box.addEventListener('mouseleave', () => { tip.hidden = true; box.querySelectorAll('.bar.on').forEach((x) => x.classList.remove('on')); });
    });
  }

  // Desktop pop-up + beep when a new help request arrives while HQ is open.
  function hqCheckAlerts() {
    const ids = helpAlerts().map((w) => w.id);
    if (hq.seenHelp === null) { hq.seenHelp = new Set(ids); return; }
    const fresh = ids.filter((id) => !hq.seenHelp.has(id)); ids.forEach((id) => hq.seenHelp.add(id));
    if (!fresh.length || !hq.alertsOn) return;
    fresh.forEach((id) => { const w = db.welfare.find((x) => x.id === id); const s = staffById(w?.staffId); try { new Notification('HELP requested', { body: `${s?.name || 'A staff member'} pressed I NEED HELP at ${fmtTime(new Date(w.time))}`, icon: 'icon-192.png', requireInteraction: true }); } catch (e) { /* not allowed */ } });
    try { const ac = new AudioContext(); [0, 0.35, 0.7].forEach((t) => { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2); }); } catch (e) { /* no audio */ }
  }

  function viewHqLogin() {
    return `<div class="hq-login backdrop-art"><form class="hq-login-card" id="login-form" autocomplete="on">
      ${logoImg(220)}<h1>HQ Console</h1><p>Live monitoring for ${esc(CONFIG.company)} managers</p>
      <label class="pill-input">${ic(I.mail, 20)}<input id="email" type="email" placeholder="Email Address" autocomplete="username" required></label>
      <label class="pill-input">${ic(I.lock, 20)}<input id="password" type="${ui.showPw ? 'text' : 'password'}" placeholder="Password" autocomplete="current-password" required><button type="button" class="eye" data-action="toggle-pw" aria-label="Show password">${ic(ui.showPw ? I.eyeOff : I.eye, 20)}</button></label>
      <div class="error" id="login-error"></div>
      <button class="btn-pill" type="submit">Sign In</button>
      <button type="button" class="forgot" data-action="forgot">Forgot Password</button>
      ${CLOUD ? '' : '<div class="demo-hint">Demo: <b>jack@${CONFIG.domain}</b> / <b>Password1</b></div>'}
      <a class="hq-login-alt" href="index.html">Staff member? Open the staff app</a>
    </form></div>`;
  }

  function renderHQ() {
    const app = $('#app'); const u = me();
    document.body.classList.add('hq-body');
    if (u && u.active && !u.isAdmin) { if (CLOUD) { cloudSignOut(HQ_ONLY); return; } db.session = null; save(); }
    if (!u || !u.active || !u.isAdmin) { db.session = null; app.innerHTML = viewHqLogin(); bindLogin(); document.title = 'VWG HQ Console'; return; }
    if (!HQ_ROUTES.includes(ui.route)) ui.route = 'hq';
    const y = window.scrollY;
    app.innerHTML = hqShell((VIEWS[ui.route] || viewHq)());
    window.scrollTo(0, y); // live refreshes keep your place; go() scrolls new pages to the top
    bindPage(); hqTooltips(); hqCheckAlerts();
    const n = helpAlerts().length; document.title = `${n ? `(${n}) HELP · ` : ''}VWG HQ Console`;
    hq.refreshAt = Date.now() + 30000;
    ticker = setInterval(tick, 1000);
  }

  const VIEWS = { hq: viewHq, 'hq-roster': viewHqRoster, 'hq-staff': viewHqStaff, 'hq-sites': viewHqSites, 'hq-requests': viewHqRequests, 'hq-reports': viewHqReports, home: viewHome, shifts: viewShifts, offered: viewOffered, shift: viewShift, occurrence: viewOccurrence, leave: viewLeave, forms: viewForms, docs: viewDocs, doc: viewDoc, messages: viewMessages, thread: viewThread, register: viewRegister, welfare: viewWelfare, support: viewSupport, profile: viewProfile, training: viewTraining, module: viewModule, mydocs: viewMyDocs, compliance: viewCompliance, companycompliance: viewCompanyCompliance, timesheet: viewTimesheet, admin: viewAdmin };
  function render() {
    clearInterval(ticker);
    if (HQ) { renderHQ(); return; }
    const app = $('#app');
    if (!db.onboarded) { app.innerHTML = viewOnboarding(); bindSwipe(); return; }
    const u = me();
    if (!u || !u.active) { db.session = null; app.innerHTML = viewLogin(); bindLogin(); return; }
    if (ui.route === 'admin' && !u.isAdmin) ui.route = 'home';
    app.innerHTML = (VIEWS[ui.route] || viewHome)() + (ui.drawer ? drawer() : '');
    bindPage();
    ticker = setInterval(tick, 1000);
  }
  function tick() {
    if (CLOUD && cloud.renderWanted && !$('#sheet-root').children.length && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { cloud.renderWanted = false; render(); return; }
    const t = $('#live-time'); if (t) t.textContent = fmtTime(new Date());
    // HQ: refresh worked times, late lists and welfare timers every 30 seconds.
    if (HQ && Date.now() > hq.refreshAt && !$('#sheet-root').children.length && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !document.querySelector('.hq-chart:hover, details[open]')) { render(); return; }
    const e = openEntry(db.session); if (!e) return;
    for (const id of ['elapsed', 'drawer-elapsed']) { const el = document.getElementById(id); if (el) el.textContent = fmtClock(entryWorkedMs(e)); }
  }

  function bindLogin() {
    $('#login-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = $('#email').value.trim().toLowerCase(); const pw = $('#password').value;
      if (CLOUD) {
        if (!cloud.sb) { $('#login-error').textContent = 'Could not reach the server. Check your connection.'; return; }
        const btn = ev.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Signing in…';
        const err = await cloudSignIn(email, pw);
        if (err) { btn.disabled = false; btn.textContent = 'Sign In'; $('#login-error').textContent = err; return; }
        ui.showPw = false; go(CONFIG.startPage, {}, false); toast(`Welcome, ${me().name.split(' ')[0]}`);
        return;
      }
      const u = db.staff.find((s) => s.email.toLowerCase() === email);
      if (!u || !u.active || await hashPassword(pw, u.salt) !== u.pwHash) { $('#login-error').textContent = 'Incorrect email address or password'; return; }
      if (HQ && !u.isAdmin) { $('#login-error').textContent = HQ_ONLY; return; }
      db.session = u.id; save(); ui.showPw = false; go(CONFIG.startPage, {}, false); toast(`Welcome, ${u.name.split(' ')[0]}`);
    });
  }
  function bindSwipe() {
    const el = $('#slides'); let x0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return; ui.slide = Math.max(0, Math.min(SLIDES.length - 1, ui.slide + (dx < 0 ? 1 : -1))); render();
    });
  }
  function bindPage() {
    const live = (id, key, listId) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('input', () => { ui[key] = el.value; const tmp = document.createElement('div'); tmp.innerHTML = VIEWS[ui.route](); document.getElementById(listId).innerHTML = tmp.querySelector('#' + listId).innerHTML; });
    };
    live('form-q', 'formQ', 'form-list'); live('doc-q', 'docQ', 'doc-list'); live('msg-q', 'msgQ', 'msg-list');
    const cf = $('#composer');
    if (cf) {
      const chat = $('#chat'); window.scrollTo(0, document.body.scrollHeight); if (chat) chat.scrollIntoView(false);
      cf.addEventListener('submit', (ev) => {
        ev.preventDefault(); const text = cf.text.value.trim(); if (!text) return;
        db.messages.push({ id: uid(), thread: ui.params.id || 'all', staffId: db.session, text, time: new Date().toISOString() }); save(); render();
        const inp = $('#composer input'); if (inp) inp.focus();
      });
    }
    const pf = $('#profile-form');
    if (pf) pf.addEventListener('submit', (ev) => {
      ev.preventDefault(); const d = Object.fromEntries(new FormData(pf).entries()); const u = me(); const err = $('#profile-error');
      const email = d.email.trim().toLowerCase(); const name = `${d.first.trim()} ${d.last.trim()}`.trim();
      if (!name) { err.textContent = 'Enter your name'; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Enter a valid email address'; return; }
      if (db.staff.some((x) => x.email.toLowerCase() === email && x.id !== u.id)) { err.textContent = 'That email is already used by another account'; return; }
      if (!/^\d{4}$/.test(d.pin)) { err.textContent = 'PIN must be 4 digits'; return; }
      Object.assign(u, { name, email, phone: d.phone.trim(), pin: d.pin }); save(); render(); toast('Changes saved');
    });
    const sf = $('#support-form');
    if (sf) {
      const body = $('#sp-body'); if (body) body.scrollTop = body.scrollHeight;
      sf.addEventListener('submit', (ev) => { ev.preventDefault(); const text = sf.text.value.trim(); if (!text) return; sendSupport(text); const inp = $('#support-form input[name=text]'); if (inp) inp.focus(); });
    }
    const qz = $('#quiz');
    if (qz) qz.addEventListener('submit', (ev) => {
      ev.preventDefault(); const t = db.training.find((x) => x.id === ui.params.id); if (!t) return;
      const a = Number(new FormData(qz).get('a'));
      if (a !== t.answer) { qz.querySelector('.error').textContent = 'Not quite — read the module again and retry.'; return; }
      db.trainingDone = db.trainingDone.filter((x) => !(x.moduleId === t.id && x.staffId === db.session));
      db.trainingDone.push({ id: uid(), moduleId: t.id, staffId: db.session, date: new Date().toISOString() }); save(); render(); toast('Module completed ✓');
    });
  }

  document.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (ev.target.id === 'support-file' && file) {
      try { sendSupport('', await resizePhoto(file, 900, false)); } catch (e) { toast('Could not read that image'); }
      return;
    }
    if (ev.target.id === 'mydoc-file' && file) {
      const isImg = file.type.startsWith('image/');
      if (!isImg && file.size > 1024 * 1024) { toast('PDFs must be under 1 MB on this device'); return; }
      const name = prompt('Document name (e.g. Passport, SIA licence card):', file.name.replace(/\.[^.]+$/, ''));
      if (name === null) return;
      try {
        const data = isImg ? await resizePhoto(file, 1400, false) : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        db.staffDocs.push({ id: uid(), staffId: db.session, name: name.trim() || file.name, kind: isImg ? 'Image' : 'PDF', fileName: isImg ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name, data, date: new Date().toISOString() });
        save(); render(); toast('Document uploaded');
      } catch (e) { toast('Could not read that file'); }
      return;
    }
    if (ev.target.id !== 'photo-input' || !file) return;
    try { me().photo = await resizePhoto(ev.target.files[0]); save(); render(); toast('Photo updated'); } catch (e) { toast('Could not read that image'); }
  });

  document.addEventListener('click', async (ev) => {
    const nav = ev.target.closest('[data-nav]');
    // Detail pages get a Back button; top-level pages reset history and show the menu button.
    if (nav) { closeSheet(); go(nav.dataset.nav, { id: nav.dataset.id }, ['shift', 'doc', 'module', 'thread', 'mydocs', 'compliance', 'companycompliance'].includes(nav.dataset.nav)); return; }
    const ts = ev.target.closest('[data-ts]'); if (ts) { ui.tsRange = ts.dataset.ts; render(); return; }
    const at = ev.target.closest('[data-admin]'); if (at) { ui.adminTab = at.dataset.admin; render(); return; }
    const dt = ev.target.closest('[data-doctab]'); if (dt) { ui.docTab = dt.dataset.doctab; render(); return; }
    const rd = ev.target.closest('[data-regday]'); if (rd) { ui.regDay = rd.dataset.regday; render(); return; }
    const btn = ev.target.closest('[data-action]'); if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'next-slide': ui.slide = Math.min(SLIDES.length - 1, ui.slide + 1); render(); break;
      case 'finish-onboard': db.onboarded = true; ui.slide = 0; save(); render(); break;
      case 'replay-intro': db.onboarded = false; save(); render(); break;
      case 'toggle-pw': { const v = $('#password').value; const e = $('#email').value; ui.showPw = !ui.showPw; render(); $('#password').value = v; $('#email').value = e; break; }
      case 'forgot':
        if (CLOUD) { if (cloud.sb) sheetForgotCloud(); else toast('You are offline'); break; }
        openSheet(`<h2>Forgot Password</h2><p class="muted" style="margin-top:0">Enter your work email. Your manager will be asked to reset your password.</p><form class="form">
          <div class="field"><label>Email Address</label><input class="input" type="email" name="email" value="${esc($('#email')?.value || '')}" required></div>
          <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Request Reset</button></form>`, (d) => {
          db.resetRequests.push({ id: uid(), email: d.email.trim().toLowerCase(), time: new Date().toISOString(), done: false }); save();
          toast('Request sent — your manager will contact you');
        });
        break;
      case 'domain-login':
        openSheet(`<h2>Log In with Domain</h2><form class="form"><div class="field"><label>Company domain</label><input class="input" name="domain" placeholder="${CONFIG.domain}" autocapitalize="off" required></div>
          <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Continue</button></form>`, (d) => {
          const dom = d.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
          if (dom !== CONFIG.domain) return 'Domain not recognised';
          setTimeout(() => { const e = $('#email'); if (e) { e.value = '@' + dom; e.focus(); e.setSelectionRange(0, 0); } }, 50);
          toast(`Connected to ${CONFIG.company}`);
        });
        break;
      case 'open-drawer': ui.drawer = true; render(); break;
      case 'close-drawer': ui.drawer = false; render(); break;
      case 'back': back(); break;
      case 'refresh': if (CLOUD && cloud.sb) { try { await cloudPush(); await cloudPull(); } catch (e) { toast('Offline — showing saved copy'); break; } } render(); toast('Updated'); break;
      case 'send-reset': { const st = staffById(id); if (!st || !cloud.sb) break; const { error } = await cloud.sb.auth.resetPasswordForEmail(st.email, { redirectTo: location.origin + location.pathname }); toast(error ? error.message : `Reset link sent to ${st.email}`); break; }
      case 'week-prev': ui.weekOffset--; render(); break;
      case 'week-next': ui.weekOffset++; render(); break;
      case 'clock-in': await clockIn({ shiftId: id || null }); break;
      case 'clock-out': ui.drawer = false; render(); sheetClockOut(); break;
      case 'view-approval': sheetApproval(id); break;
      case 'break-start': { const e = openEntry(db.session); if (e && !onBreak(e)) { e.breaks.push({ start: new Date().toISOString(), end: null }); save(); render(); toast('Break started'); } break; }
      case 'break-end': { const b = openEntry(db.session)?.breaks.find((x) => !x.end); if (b) { b.end = new Date().toISOString(); save(); render(); toast('Break ended'); } break; }
      case 'scan': ui.drawer = false; render(); sheetScan(); break;
      case 'contacts': sheetContacts(siteById(id)); break;
      case 'accept-shift': { const s = db.shifts.find((x) => x.id === id); if (s && !s.staffId) { s.staffId = db.session; s.status = 'pending'; save(); render(); toast('Shift accepted — awaiting confirmation'); } break; }
      case 'release-shift': { const s = db.shifts.find((x) => x.id === id); if (s && confirm('Offer this shift to other staff? It will be removed from your roster.')) { s.staffId = null; s.status = 'offered'; save(); back(); toast('Shift offered for cover'); } break; }
      case 'occ-new':
        openSheet(`<h2>New Occurrence</h2><form class="form"><div class="field"><label>Site</label><select class="input" name="siteId">${siteOptions(openEntry(db.session)?.siteId)}</select></div>
          <div class="field"><label>Entry</label><textarea class="input" name="text" required placeholder="What happened?"></textarea></div><div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save Entry</button></form>`, (d) => {
          addOccurrence(d.text.trim(), 'note', d.siteId || null); save(); render(); toast('Entry saved');
        });
        break;
      case 'form-pick': sheetFormPick(); break;
      case 'form-new': closeSheet(); sheetForm(btn.dataset.type); break;
      case 'month-prev': ui.leaveMonth--; render(); break;
      case 'month-next': ui.leaveMonth++; render(); break;
      case 'leave-day': sheetLeave(btn.dataset.date); break;
      case 'leave-cancel': db.leave = db.leave.filter((l) => l.id !== id); save(); closeSheet(); render(); toast('Leave request cancelled'); break;
      case 'register-share': shareRegister(); break;
      case 'register-site':
        openSheet(`<h2>Select Site</h2>${db.sites.map((x) => `<button class="menu-item" data-action="register-pick" data-id="${x.id}"><span>${esc(x.name)}<br><span class="small muted">${esc(x.customer)}</span></span></button>`).join('')}`);
        break;
      case 'register-pick': ui.regSite = id; closeSheet(); render(); break;
      case 'doc-new': sheetDocNew(); break;
      case 'doc-read': db.docReads.push({ id: uid(), docId: id, staffId: db.session, time: new Date().toISOString() }); save(); render(); toast('Thanks — recorded'); break;
      case 'doc-delete': if (confirm('Delete this document?')) { db.documents = db.documents.filter((d) => d.id !== id); save(); back(); } break;
      case 'visitor-new':
        openSheet(`<h2>Sign In Visitor</h2><form class="form"><div class="field"><label>Full name</label><input class="input" name="name" required></div>
          <div class="field"><label>Company</label><input class="input" name="company"></div><div class="field"><label>Purpose of visit</label><input class="input" name="purpose" required></div>
          <div class="row"><div class="field"><label>Vehicle reg</label><input class="input" name="vehicle" autocapitalize="characters"></div><div class="field"><label>Site</label><select class="input" name="siteId">${siteOptions(registerSite())}</select></div></div>
          <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Sign In</button></form>`, (d) => {
          db.register.push({ id: uid(), name: d.name.trim(), company: d.company.trim(), purpose: d.purpose.trim(), vehicle: d.vehicle.trim().toUpperCase(), siteId: d.siteId || null, inAt: new Date().toISOString(), outAt: null, byStaff: db.session });
          addOccurrence(`Visitor signed in: ${d.name.trim()}`, 'note', d.siteId || null); save(); render(); toast('Visitor signed in');
        });
        break;
      case 'visitor-out': { const r = db.register.find((x) => x.id === id); if (r) { r.outAt = new Date().toISOString(); addOccurrence(`Visitor signed out: ${r.name}`, 'note', r.siteId); save(); render(); toast('Visitor signed out'); } break; }
      case 'welfare-ok': case 'welfare-help': {
        const help = btn.dataset.action === 'welfare-help';
        if (help && !confirm(`Send a help alert to managers and call ${CONFIG.emergencyPhone}?`)) break;
        const w = { id: uid(), staffId: db.session, time: new Date().toISOString(), status: help ? 'help' : 'ok', geo: null };
        db.welfare.push(w); addOccurrence(help ? 'HELP requested (welfare)' : 'Welfare check: OK', 'welfare'); save(); render();
        toast(help ? 'Help alert raised' : 'Welfare check recorded');
        if (help) location.href = `tel:${CONFIG.emergencyPhone}`;
        getGeo().then((g) => { if (g) { w.geo = g; save(); } });
        break;
      }
      case 'compliance-edit': sheetCompliance(id); break;
      case 'mydoc-delete': if (confirm('Delete this document?')) { db.staffDocs = db.staffDocs.filter((d) => d.id !== id); save(); render(); } break;
      case 'module-new': sheetModuleNew(); break;
      case 'module-done': db.trainingDone.push({ id: uid(), moduleId: id, staffId: db.session, date: new Date().toISOString() }); save(); render(); toast('Marked as watched ✓'); break;
      case 'module-delete': if (confirm('Delete this training module?')) { db.training = db.training.filter((t) => t.id !== id); save(); back(); } break;
      case 'support-reply': sheetSupportReply(id); break;
      case 'change-pw': sheetChangePw(); break;
      case 'export-mine': download(`timesheet-${me().empNo}-${ymd(new Date())}.csv`, timesheetCsv(db.entries.filter((e) => e.staffId === db.session))); break;
      case 'export-all': download(`timesheets-${ymd(new Date())}.csv`, timesheetCsv(db.entries)); break;
      case 'export-register': download(`visitors-${ymd(new Date())}.csv`, toCsv([['Name', 'Company', 'Purpose', 'Vehicle', 'Site', 'In', 'Out'], ...db.register.map((r) => [r.name, r.company, r.purpose, r.vehicle, siteById(r.siteId)?.name, fmtStamp(r.inAt), r.outAt ? fmtStamp(r.outAt) : ''])])); break;
      case 'backup': download(`vwg-staff-backup-${ymd(new Date())}.json`, JSON.stringify(db, null, 2), 'application/json'); break;
      case 'restore': {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.onchange = async () => {
          try { const data = JSON.parse(await inp.files[0].text()); if (!Array.isArray(data.staff) || !Array.isArray(data.sites)) throw new Error('bad');
            const keep = me();
            db = Object.assign(emptyDb(), data, { session: db.session, onboarded: true });
            // Always keep the manager doing the restore, so they can't lock themselves out.
            let mine = db.staff.find((x) => x.email.toLowerCase() === keep.email.toLowerCase());
            if (!mine) { mine = keep; db.staff.push(keep); }
            mine.isAdmin = true; mine.active = true; db.session = mine.id;
            save(); render(); toast('Data restored');
          } catch (e) { toast('That is not a valid backup file'); }
        };
        inp.click(); break;
      }
      case 'staff-new': sheetStaff(null); break;
      case 'staff-edit': sheetStaff(staffById(id)); break;
      case 'staff-delete': if (confirm('Delete this staff member? Their future shifts become open shifts; history is kept.')) { db.staff = db.staff.filter((s) => s.id !== id); db.shifts.forEach((s) => { if (s.staffId === id) { s.staffId = null; s.status = 'offered'; } }); save(); closeSheet(); render(); toast('Staff member deleted'); } break;
      case 'site-new': sheetSite(null); break;
      case 'site-here': {
        const inp = $('#site-pos'); btn.textContent = 'finding you…';
        const g = await getGeo(); btn.textContent = 'use my location';
        if (!g) { toast('Could not get your location'); break; }
        inp.value = `${g.lat}, ${g.lng}`; toast(`Location set (accurate to ${g.acc} m)`);
        break;
      }
      case 'site-edit': sheetSite(siteById(id)); break;
      case 'shift-new': sheetShift(null, { date: btn.dataset.date, staffId: btn.dataset.staff }); break;
      case 'hq-ack': { const w = db.welfare.find((x) => x.id === id); if (w) { w.ack = { by: db.session, time: new Date().toISOString() }; addOccurrence(`Help alert for ${staffById(w.staffId)?.name || 'staff'} acknowledged by HQ`, 'welfare'); save(); render(); toast('Alert acknowledged'); } break; }
      case 'hq-alerts':
        if (hq.alertsOn) { hq.alertsOn = false; render(); break; }
        if (!('Notification' in window)) { toast('This browser cannot show alerts'); break; }
        if (await Notification.requestPermission() !== 'granted') { toast('Allow notifications for this site to get alerts'); break; }
        hq.alertsOn = true; render(); toast('You will get a pop-up and sound when someone needs help');
        break;
      case 'shift-edit': sheetShift(db.shifts.find((s) => s.id === id)); break;
      case 'shift-delete': db.shifts = db.shifts.filter((s) => s.id !== id); save(); closeSheet(); render(); toast('Shift deleted'); break;
      case 'shift-approve': case 'shift-decline': {
        const s = db.shifts.find((x) => x.id === id); if (!s) break;
        if (btn.dataset.action === 'shift-approve') s.status = 'confirmed'; else { s.staffId = null; s.status = 'offered'; }
        save(); render(); toast(s.status === 'confirmed' ? 'Shift confirmed' : 'Shift returned to offered'); break;
      }
      case 'leave-approve': case 'leave-decline': { const l = db.leave.find((x) => x.id === id); if (l) { l.status = btn.dataset.action === 'leave-approve' ? 'approved' : 'declined'; save(); render(); toast(`Leave ${l.status}`); } break; }
      case 'incident-resolve': { const i = db.incidents.find((x) => x.id === id); if (i) { i.status = 'resolved'; save(); render(); } break; }
      case 'reset-do': {
        const r = db.resetRequests.find((x) => x.id === id); if (!r) break;
        const s = db.staff.find((x) => x.email.toLowerCase() === r.email);
        if (!s) { r.done = true; save(); render(); toast('No staff member with that email — request cleared'); break; }
        const temp = 'Temp' + Math.floor(1000 + Math.random() * 9000) + '!';
        s.salt = uid(); s.pwHash = await hashPassword(temp, s.salt); r.done = true; save(); render();
        alert(`Temporary password for ${s.name}:\n\n${temp}\n\nGive this to them and ask them to change it under My Profile.`);
        break;
      }
      case 'logout': if (CLOUD) { cloudSignOut(); break; } db.session = null; save(); ui.drawer = false; ui.stack = []; ui.route = CONFIG.startPage; render(); break;
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    if (CONFIG.loginBackground) document.documentElement.style.setProperty('--bg-photo', `url('${CONFIG.loginBackground}')`);
    if (CLOUD) await cloudInit(); else await seed();
    if (HQ) ['online', 'offline'].forEach((ev) => window.addEventListener(ev, () => requestRender()));
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
