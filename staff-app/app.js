/* Van Wyngaardt Global — Staff app
 * Single-page, offline-first. All data is stored in this device's localStorage.
 */
(function () {
  'use strict';

  const CONFIG = {
    company: 'Van Wyngaardt Global',
    shortName: 'VWG Staff',
    domain: 'vanwyngaardtglobal.com',
    version: 'v1.1.0(2)',
    currency: '£',
    supportPhone: '+44 0000 000000',
    supportEmail: 'support@vanwyngaardtglobal.com',
    emergencyPhone: '999',
    welfareMinutes: 60,
  };
  const STORE_KEY = 'vwg-staff-v2';
  const COLORS = ['#16263f', '#0b6e0b', '#b86e00', '#6b3fa0', '#b5461b', '#0e7490', '#a3195b', '#4d7c0f'];

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
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

  function logoSvg(size = 190) {
    return `<svg class="logo-ring" style="width:${size}px;height:${size}px" viewBox="0 0 240 240" role="img" aria-label="${CONFIG.company}">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2cc8a"/><stop offset="0.5" stop-color="#b09244"/><stop offset="1" stop-color="#d9bf7a"/></linearGradient>
        <mask id="band"><rect width="240" height="240" fill="#fff"/><rect x="0" y="100" width="240" height="40" fill="#000"/></mask>
      </defs>
      <g mask="url(#band)">
        <circle cx="120" cy="120" r="100" fill="none" stroke="url(#lg)" stroke-width="16"/>
        <path d="M58 62 A84 84 0 0 1 188 72" fill="none" stroke="url(#lg)" stroke-width="3"/>
        <path d="M182 178 A84 84 0 0 1 52 168" fill="none" stroke="url(#lg)" stroke-width="3"/>
      </g>
      <text x="120" y="129" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="25" fill="url(#lg)" textLength="226" lengthAdjust="spacingAndGlyphs">VAN WYNGAARDT</text>
      <text x="120" y="160" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="14" letter-spacing="6" fill="url(#lg)">GLOBAL</text>
    </svg>`;
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
  const TRAINING = [
    { id: 't1', title: 'Company Induction', mins: 10, body: `Welcome to ${CONFIG.company}.\n\n• Always arrive 10 minutes before your shift.\n• Clock in using the app or by scanning the site QR code.\n• Wear full uniform and your ID badge at all times.\n• Report every incident, however small, using Incident / Forms.`, q: 'When should you arrive for your shift?', options: ['On the minute', '10 minutes early', '30 minutes late'], answer: 1 },
    { id: 't2', title: 'Health & Safety Basics', mins: 15, body: 'Identify hazards, assess the risk, and report them.\n\n• Know where fire exits and assembly points are on every site.\n• Never block fire doors.\n• Use the Near Miss form for anything that could have caused harm.', q: 'Which form do you use for something that nearly caused harm?', options: ['Near Miss', 'Vehicle Check', 'Lost Property'], answer: 0 },
    { id: 't3', title: 'Lone Worker & Welfare Checks', mins: 8, body: `When working alone you must complete a Welfare Check at least every ${CONFIG.welfareMinutes} minutes.\n\nIf you are in danger, press "I need help" and call ${CONFIG.emergencyPhone}.`, q: 'How often must you complete a welfare check when alone?', options: ['Once a shift', `Every ${CONFIG.welfareMinutes} minutes`, 'Never'], answer: 1 },
    { id: 't4', title: 'Visitor Sign-On Procedure', mins: 6, body: 'Every visitor must be signed in on the Electronic Sign On Register with their name, company and purpose of visit, and signed out when they leave.', q: 'Where do you record visitors?', options: ['Occurrence Log', 'Electronic Sign On Register', 'Team Message'], answer: 1 },
    { id: 't5', title: 'Data Protection (GDPR)', mins: 12, body: 'Only collect the personal information you need. Never share visitor or staff details outside the company. Report any data breach to your manager immediately.', q: 'Who do you report a data breach to?', options: ['Nobody', 'Your manager', 'Social media'], answer: 1 },
  ];
  const SLIDES = [
    { icon: I.clock, title: 'Clock in & out', text: 'Start and finish your shift with one tap, or scan the site QR / NFC tag.' },
    { icon: I.cal, title: 'My Shifts', text: 'See your roster week by week, with site address, maps and contacts.' },
    { icon: I.log, title: 'Logs & forms', text: 'Record occurrences, report incidents and sign visitors on site.' },
    { icon: I.heart, title: 'Stay safe', text: 'Welfare checks keep lone workers safe. Help is one tap away.' },
  ];

  // ---------- Data ----------
  const emptyDb = () => ({
    version: 2, staff: [], sites: [], shifts: [], entries: [], leave: [], incidents: [], occurrences: [],
    documents: [], docReads: [], messages: [], register: [], welfare: [], trainingDone: [], resetRequests: [],
    session: null, onboarded: false,
  });
  let db = load();
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return Object.assign(emptyDb(), JSON.parse(raw)); } catch (e) { /* fresh */ }
    return emptyDb();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { toast('Could not save on this device'); } }

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
        photo: null, emergency: '', address: '',
      });
    }
    db.sites = [
      { id: uid(), customer: 'Northgate Logistics', name: 'Northgate Distribution Centre', address: 'Unit 4 Northgate Way', city: 'Birmingham', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-NG01',
        contacts: [{ name: 'Control Room', role: '24/7', phone: '0121 000 0001' }, { name: 'Mark Evans', role: 'Site Manager', phone: '0121 000 0002' }] },
      { id: uid(), customer: 'Harbour Retail Park', name: 'Harbour Gatehouse', address: '1 Harbour Road', city: 'Manchester', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-HR01',
        contacts: [{ name: 'Gatehouse', role: 'Front desk', phone: '0161 000 0001' }] },
      { id: uid(), customer: 'Crestwood Estates', name: 'Crestwood Tower Reception', address: '22 Crest Street', city: 'London', region: 'England', country: 'UNITED KINGDOM', code: 'VWG-CT01',
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
    db.documents = [
      { id: uid(), title: 'Code of Conduct', category: 'Policy', date: now, body: 'All staff must act with honesty, integrity and professionalism.\n\n1. Treat customers, visitors and colleagues with respect.\n2. Follow all lawful instructions from supervisors.\n3. Never consume alcohol or drugs before or during a shift.\n4. Keep all site information confidential.' },
      { id: uid(), title: 'Uniform & Appearance', category: 'Policy', date: now, body: 'Full company uniform must be worn on every shift, including your ID badge and hi-vis where required. Uniform must be clean and in good repair.' },
      { id: uid(), title: 'Emergency Procedures', category: 'Safety', date: now, body: `In an emergency:\n\n1. Make yourself safe.\n2. Call ${CONFIG.emergencyPhone}.\n3. Inform the site control room.\n4. Record everything in the Occurrence Log as soon as it is safe to do so.` },
      { id: uid(), title: 'Assignment Instructions — Northgate', category: 'Site', date: now, body: 'Patrol the perimeter every 2 hours, scanning each checkpoint QR code. Gate 2 is locked from 22:00 to 06:00. All vehicles must be logged on the sign-on register.' },
    ];
    db.messages.push({ id: uid(), staffId: db.staff[1].id, text: `Morning team 👋 Welcome to the new ${CONFIG.shortName} app. Please check your shifts for the next two weeks.`, time: now });
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
  const ui = { route: 'home', params: {}, stack: [], drawer: false, slide: 0, weekOffset: 0, tsRange: 'week', adminTab: 'live', regTab: 'on', showPw: false };
  let ticker = null;
  let scanStop = null;

  function go(route, params = {}, push = true) {
    if (push) ui.stack.push({ route: ui.route, params: ui.params });
    else ui.stack = [];
    ui.route = route; ui.params = params; ui.drawer = false;
    render(); window.scrollTo(0, 0);
  }
  function back() {
    const prev = ui.stack.pop() || { route: 'home', params: {} };
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
  function closeSheet() { if (scanStop) { scanStop(); scanStop = null; } $('#sheet-root').innerHTML = ''; }

  // ---------- Chrome ----------
  function topbar(title, { left = 'menu', right = '' } = {}) {
    const l = left === 'back'
      ? `<button class="tb-btn" data-action="back">${ic(I.back, 24)}Back</button>`
      : `<button class="tb-btn" data-action="open-drawer" aria-label="Menu">${ic(I.menu, 26)}</button>`;
    return `<header class="topbar"><div class="topbar-inner">${l}<h1>${esc(title)}</h1><div class="tb-right">${right}</div></div></header>`;
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
    ['home', 'Home'], ['occurrence', 'Occurrence Log'], ['shifts', 'My Shifts'], ['offered', 'Offered Shifts'],
    ['leave', 'Submit Leave'], ['forms', 'Incident / Forms'], ['docs', 'Document Library'], ['messages', 'Team Message'],
    ['register', 'Electronic Sign On Register'], ['welfare', 'Welfare Check'], ['support', 'VWG Support'],
    ['profile', 'My Profile'], ['training', 'Training Module'], ['timesheet', 'My Timesheet'],
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
        <div class="menu-version">${CONFIG.version} - ${esc(CONFIG.company)}</div>
      </nav>
    </div></div>`;
  }

  // ---------- Pre-login screens ----------
  function viewOnboarding() {
    const last = ui.slide === SLIDES.length - 1;
    return `<div class="onboard backdrop-art">
      <div class="onboard-top"><button class="skip" data-action="finish-onboard">Skip</button></div>
      <div class="slides" id="slides"><div class="slides-track" style="transform:translateX(-${ui.slide * 100}%)">
        ${SLIDES.map((s, i) => `<div class="slide">${i === 0 ? logoSvg(170) : `<div class="slide-art">${ic(s.icon, 76, 1.6)}</div>`}<h2 style="margin-top:${i === 0 ? 34 : 0}px">${s.title}</h2><p>${s.text}</p></div>`).join('')}
      </div></div>
      <div class="dots">${SLIDES.map((_, i) => `<span class="dot ${i === ui.slide ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn-pill" data-action="${last ? 'finish-onboard' : 'next-slide'}">${last ? 'Get Started' : 'Next'}</button>
    </div>`;
  }

  function viewLogin() {
    return `<div class="login backdrop-art">
      ${logoSvg(190)}
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
      <div class="demo-hint">Demo: <b>jack@${CONFIG.domain}</b> (admin) or <b>emma@${CONFIG.domain}</b> · password <b>Password1</b></div>
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
    return topbar('Home') + `<div class="page">
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
  function viewLeave() {
    const mine = db.leave.filter((l) => l.staffId === db.session).sort((a, b) => b.from.localeCompare(a.from));
    const today = ymd(new Date());
    return topbar('Submit Leave') + `<div class="page"><div class="pad">
      <div class="card"><form class="form" id="leave-form">
        <div class="field"><label>Leave type</label><select class="input" name="type"><option>Annual Leave</option><option>Sick Leave</option><option>Compassionate Leave</option><option>Unpaid Leave</option><option>Training</option></select></div>
        <div class="row"><div class="field"><label>From</label><input class="input" type="date" name="from" value="${today}" required></div>
        <div class="field"><label>To</label><input class="input" type="date" name="to" value="${today}" required></div></div>
        <div class="field"><label>Reason</label><textarea class="input" name="reason" placeholder="Optional"></textarea></div>
        <div class="error"></div>
        <button class="btn btn-gold btn-block" type="submit">Submit Leave</button>
      </form></div>
      <div class="card"><h3>My Requests</h3>${mine.length ? mine.map((l) => leaveRow(l)).join('') : '<div class="empty">No leave requests</div>'}</div>
    </div></div>`;
  }
  function leaveRow(l, admin = false) {
    const who = admin ? staffById(l.staffId) : null;
    const days = Math.round((parseYmd(l.to) - parseYmd(l.from)) / 86400000) + 1;
    return `<div class="item"><div class="item-main"><div class="item-title">${who ? esc(who.name) + ' · ' : ''}${esc(l.type)} · ${days} day${days > 1 ? 's' : ''}</div>
      <div class="item-sub">${dmy(parseYmd(l.from))} - ${dmy(parseYmd(l.to))}${l.reason ? ' · ' + esc(l.reason) : ''}</div></div>
      ${admin && l.status === 'pending' ? approveBtns('leave', l.id) : statusPill(l.status)}</div>`;
  }
  const approveBtns = (kind, id) => `<div class="row" style="flex:0 0 auto;gap:6px"><button class="btn btn-green btn-sm" data-action="${kind}-approve" data-id="${id}">✓</button><button class="btn btn-red btn-sm" data-action="${kind}-decline" data-id="${id}">✕</button></div>`;

  // ---------- Forms ----------
  function viewForms() {
    const mine = db.incidents.filter((i) => i.staffId === db.session).sort((a, b) => b.time.localeCompare(a.time));
    return topbar('Incident / Forms') + `<div class="page white">
      ${FORM_TYPES.map((t) => `<button class="menu-item" data-action="form-new" data-type="${esc(t)}"><span>${esc(t)}</span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>`).join('')}
      <div class="pad"><h3 style="margin:10px 4px">My Submissions</h3>
      ${mine.length ? `<div class="card">${mine.map((i) => incidentRow(i)).join('')}</div>` : '<div class="empty">Nothing submitted yet.</div>'}</div>
    </div>`;
  }
  function incidentRow(i, admin = false) {
    const site = siteById(i.siteId); const who = admin ? staffById(i.staffId) : null;
    return `<div class="item"><div class="item-main"><div class="item-title">${esc(i.form)} · ${esc(i.title)}</div>
      <div class="item-sub">${fmtStamp(i.time)}${site ? ' · ' + esc(site.name) : ''}${who ? ' · ' + esc(who.name) : ''} · ${esc(cap(i.severity))} priority</div>
      <div class="small" style="margin-top:4px">${esc(i.details)}</div></div>
      ${admin && i.status === 'open' ? `<button class="btn btn-green btn-sm" data-action="incident-resolve" data-id="${i.id}">Resolve</button>` : statusPill(i.status)}</div>`;
  }
  const siteOptions = (sel) => `<option value="">— None —</option>` + db.sites.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
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
      db.incidents.push({ id: uid(), staffId: db.session, form: type, siteId: d.siteId || null, time, title: d.title.trim(), severity: d.severity, details: d.details.trim(), status: 'open' });
      addOccurrence(`${type} submitted: ${d.title.trim()}`, 'form', d.siteId || null);
      save(); render(); toast(`${type} submitted`);
    });
  }

  // ---------- Documents ----------
  function viewDocs() {
    const u = me();
    const read = (d) => db.docReads.some((r) => r.docId === d.id && r.staffId === u.id);
    return topbar('Document Library') + `<div class="page white">
      ${u.isAdmin ? `<div class="pad"><button class="btn btn-gold btn-block" data-action="doc-new">${ic(I.plus, 18)}Add Document</button></div>` : ''}
      ${db.documents.length ? db.documents.map((d) => `<button class="menu-item" style="height:auto;padding:12px 16px" data-nav="doc" data-id="${d.id}"><span><b>${esc(d.title)}</b><br><span class="small muted">${esc(d.category)} · ${read(d) ? '✓ Read' : 'Unread'}</span></span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>`).join('') : '<div class="empty-state">No documents yet.</div>'}
    </div>`;
  }
  function viewDoc() {
    const d = db.documents.find((x) => x.id === ui.params.id);
    if (!d) return topbar('Document', { left: 'back' }) + '<div class="page white"><div class="empty-state">Document not found.</div></div>';
    const u = me();
    const r = db.docReads.find((x) => x.docId === d.id && x.staffId === u.id);
    return topbar('Document', { left: 'back' }) + `<div class="page white"><div class="pad">
      <h2 style="margin:6px 0 2px">${esc(d.title)}</h2><div class="small muted" style="margin-bottom:14px">${esc(d.category)} · updated ${dmy(new Date(d.date))}</div>
      <div class="doc-body">${esc(d.body)}</div>
      <div style="margin-top:24px">${r ? `<div class="muted small">✓ You confirmed you read this on ${fmtStamp(r.time)}</div>` : `<button class="btn btn-gold btn-block" data-action="doc-read" data-id="${d.id}">I have read and understood</button>`}</div>
      ${u.isAdmin ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;color:var(--red)" data-action="doc-delete" data-id="${d.id}">${ic(I.trash, 18)}Delete document</button>` : ''}
    </div></div>`;
  }

  // ---------- Team message ----------
  function viewMessages() {
    const u = me();
    const list = db.messages.slice().sort((a, b) => a.time.localeCompare(b.time)).slice(-200);
    return topbar('Team Message') + `<div class="page"><div class="chat" id="chat">
      ${list.length ? list.map((m) => { const s = staffById(m.staffId); const mine = m.staffId === u.id; return `<div class="bubble ${mine ? 'me' : ''}">${mine ? '' : `<div class="who">${esc(s?.name || 'Former staff')}</div>`}${esc(m.text)}<div class="when">${fmtStamp(m.time)}</div></div>`; }).join('') : '<div class="empty">No messages yet. Say hello!</div>'}
    </div></div>
    <form class="composer" id="composer"><input name="text" placeholder="Type a message" autocomplete="off" aria-label="Message"><button type="submit" aria-label="Send">${ic(I.send, 20)}</button></form>`;
  }

  // ---------- Sign on register ----------
  function viewRegister() {
    const today = ymd(new Date());
    const list = db.register.filter((r) => ui.regTab === 'on' ? !r.outAt : ymd(new Date(r.inAt)) === today)
      .sort((a, b) => b.inAt.localeCompare(a.inAt));
    return topbar('Sign On Register') + `<div class="page"><div class="pad">
      <button class="btn btn-gold btn-block" data-action="visitor-new" style="margin-bottom:12px">${ic(I.plus, 18)}Sign In Visitor</button>
      <div class="seg"><button class="${ui.regTab === 'on' ? 'on' : ''}" data-reg="on">On Site (${db.register.filter((r) => !r.outAt).length})</button><button class="${ui.regTab === 'today' ? 'on' : ''}" data-reg="today">Today</button></div>
      ${list.length ? `<div class="card">${list.map((r) => { const site = siteById(r.siteId); return `<div class="item"><div class="item-main"><div class="item-title">${esc(r.name)}${r.company ? ' · ' + esc(r.company) : ''}</div>
        <div class="item-sub">${esc(r.purpose || '')}${r.vehicle ? ' · 🚗 ' + esc(r.vehicle) : ''}${site ? ' · ' + esc(site.name) : ''}</div>
        <div class="item-sub">In ${fmtTime(new Date(r.inAt))}${r.outAt ? ' · Out ' + fmtTime(new Date(r.outAt)) : ''}</div></div>
        ${r.outAt ? statusPill('signed out') : `<button class="btn btn-navy btn-sm" data-action="visitor-out" data-id="${r.id}">Sign Out</button>`}</div>`; }).join('')}</div>` : `<div class="empty">${ui.regTab === 'on' ? 'Nobody is signed in.' : 'No visitors today.'}</div>`}
    </div></div>`;
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

  // ---------- Support ----------
  function viewSupport() {
    const faq = [
      ['I forgot my password', 'Tap "Forgot Password" on the sign-in screen. A manager will reset it and give you a temporary password.'],
      ['I forgot to clock out', 'Tell your supervisor, who can correct the time from the Admin Dashboard. Add a note in the Occurrence Log too.'],
      ['The QR code won\'t scan', 'Make sure the camera has permission, or type the site code printed under the QR code instead.'],
      ['How do I pick up extra shifts?', 'Open Offered Shifts, choose a shift and tap Accept Shift. A manager will confirm it.'],
    ];
    return topbar(`VWG Support`) + `<div class="page white">
      <a class="section" href="tel:${CONFIG.supportPhone.replace(/\s/g, '')}"><div class="body"><h3>Call Support</h3><p>${esc(CONFIG.supportPhone)}</p></div><span class="chev">${ic(I.right, 28, 1.6)}</span></a>
      <a class="section" href="mailto:${CONFIG.supportEmail}"><div class="body"><h3>Email Support</h3><p>${esc(CONFIG.supportEmail)}</p></div><span class="chev">${ic(I.right, 28, 1.6)}</span></a>
      <a class="section" href="tel:${CONFIG.emergencyPhone}"><div class="body"><h3 style="color:var(--red)">Emergency</h3><p>Call ${esc(CONFIG.emergencyPhone)}</p></div><span class="chev">${ic(I.right, 28, 1.6)}</span></a>
      <div class="pad"><h3 style="margin:10px 4px">FAQ</h3>${faq.map(([q, a]) => `<details class="card"><summary><b>${esc(q)}</b></summary><p class="small" style="margin:8px 0 0">${esc(a)}</p></details>`).join('')}</div>
    </div>`;
  }

  // ---------- Profile ----------
  function viewProfile() {
    const u = me();
    return topbar('My Profile', { right: `<button class="tb-btn" data-action="edit-me">Edit</button>` }) + `<div class="page">
      <div class="drawer-head backdrop-art" style="padding-top:26px">
        <div class="avatar-wrap"><div class="avatar-big">${avatarImg(u)}</div>
          <label class="cam" aria-label="Change photo">${ic(I.camera, 18)}<input type="file" accept="image/*" id="photo-input" hidden></label></div>
        <div style="color:#fff;font-size:20px;font-weight:600">${esc(u.name)}</div>
        <div style="color:rgba(255,255,255,0.75)">${esc(u.role)}${u.isAdmin ? ' · Admin' : ''}</div>
      </div>
      <div class="pad"><div class="card"><div class="info-grid">
        <div><span>Employee no.</span><b>${esc(u.empNo)}</b></div><div><span>Department</span><b>${esc(u.dept || '-')}</b></div>
        <div><span>Email</span><b>${esc(u.email)}</b></div><div><span>Phone</span><b>${esc(u.phone || '-')}</b></div>
        <div><span>Start date</span><b>${u.startDate ? dmy(parseYmd(u.startDate)) : '-'}</b></div><div><span>Emergency contact</span><b>${esc(u.emergency || '-')}</b></div>
        <div style="grid-column:1/-1"><span>Address</span><b>${esc(u.address || '-')}</b></div>
      </div></div>
      <button class="btn btn-ghost btn-block" data-action="change-pw" style="margin-bottom:10px">Change Password</button>
      <button class="btn btn-ghost btn-block" data-action="replay-intro" style="margin-bottom:10px">Replay Intro Slides</button>
      <button class="btn btn-red btn-block" data-action="logout">Sign Out</button></div>
    </div>`;
  }

  // ---------- Training ----------
  function viewTraining() {
    const done = (t) => db.trainingDone.find((x) => x.moduleId === t.id && x.staffId === db.session);
    const n = TRAINING.filter(done).length;
    return topbar('Training Module') + `<div class="page white"><div class="pad">
      <div style="display:flex;justify-content:space-between;margin:6px 2px"><b>Your progress</b><span>${n} / ${TRAINING.length}</span></div>
      <div class="progress" style="margin-bottom:10px"><div style="width:${(n / TRAINING.length) * 100}%"></div></div></div>
      ${TRAINING.map((t) => `<button class="menu-item" style="height:auto;padding:12px 16px" data-nav="module" data-id="${t.id}"><span><b>${esc(t.title)}</b><br><span class="small muted">${t.mins} min · ${done(t) ? '✓ Completed ' + dmy(new Date(done(t).date)) : 'Not started'}</span></span><span class="chev" style="flex:0">${ic(I.right, 22)}</span></button>`).join('')}
    </div>`;
  }
  function viewModule() {
    const t = TRAINING.find((x) => x.id === ui.params.id) || TRAINING[0];
    const done = db.trainingDone.find((x) => x.moduleId === t.id && x.staffId === db.session);
    return topbar('Training', { left: 'back' }) + `<div class="page white"><div class="pad">
      <h2 style="margin:6px 0 2px">${esc(t.title)}</h2><div class="small muted" style="margin-bottom:14px">${t.mins} minutes</div>
      <div class="doc-body">${esc(t.body)}</div>
      <div class="card" style="margin-top:20px"><h3>Quick check</h3><p style="margin-top:0">${esc(t.q)}</p>
        <form id="quiz" class="form">${t.options.map((o, i) => `<label class="check" style="font-weight:400"><input type="radio" name="a" value="${i}" required>${esc(o)}</label>`).join('')}
        <div class="error"></div><button class="btn btn-gold btn-block" type="submit">${done ? 'Retake' : 'Submit answer'}</button></form>
        ${done ? `<div class="small muted" style="margin-top:8px">✓ Completed on ${dmy(new Date(done.date))}</div>` : ''}</div>
    </div></div>`;
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
  function entryRow(e, who = false) {
    const cin = new Date(e.clockIn); const site = siteById(e.siteId); const s = who ? staffById(e.staffId) : null;
    return `<div class="item"><div class="item-main"><div class="item-title">${s ? esc(s.name) + ' · ' : ''}${DAYS[cin.getDay()].slice(0, 3)} ${dmy(cin)}</div>
      <div class="item-sub">${fmtTime(cin)} - ${e.clockOut ? fmtTime(new Date(e.clockOut)) : 'now'}${site ? ' · ' + esc(site.name) : ''}${e.breaks.length ? ' · breaks ' + fmtDur(entryBreakMs(e)) : ''}${e.method !== 'app' ? ' · ' + e.method.toUpperCase() : ''}${e.geo ? ' · 📍' : ''}</div></div>
      <div class="item-end">${e.clockOut ? fmtDur(entryWorkedMs(e)) : statusPill('on site')}</div></div>`;
  }

  // ---------- Admin ----------
  function viewAdmin() {
    const tab = ui.adminTab;
    const t = (k, label) => `<button class="${tab === k ? 'on' : ''}" data-admin="${k}">${label}</button>`;
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
        <div class="card">${db.staff.slice().sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<button class="item" data-action="staff-edit" data-id="${s.id}">${avatar(s)}<div class="item-main"><div class="item-title">${esc(s.name)}${s.active ? '' : ' <span class="small muted">(inactive)</span>'}</div><div class="item-sub">${esc(s.empNo)} · ${esc(s.role)}${s.isAdmin ? ' · Admin' : ''}</div></div><span class="chev">${ic(I.right, 20)}</span></button>`).join('')}</div>`;
    } else if (tab === 'sites') {
      body = `<button class="btn btn-gold btn-block" data-action="site-new" style="margin-bottom:12px">${ic(I.plus, 18)}Add Site</button>
        <div class="card">${db.sites.map((s) => `<button class="item" data-action="site-edit" data-id="${s.id}"><div class="item-main"><div class="item-title">${esc(s.name)}</div><div class="item-sub">${esc(s.customer)} · ${esc(s.city)} · QR/NFC code <b>${esc(s.code)}</b></div></div><span class="chev">${ic(I.right, 20)}</span></button>`).join('') || '<div class="empty">No sites yet.</div>'}</div>`;
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
      body = `${resets.length ? `<div class="card"><h3>Password resets</h3>${resets.map((r) => `<div class="item"><div class="item-main"><div class="item-title">${esc(r.email)}</div><div class="item-sub">${fmtStamp(r.time)}</div></div><button class="btn btn-navy btn-sm" data-action="reset-do" data-id="${r.id}">Reset</button></div>`).join('')}</div>` : ''}
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
      ${hasNfc ? `<button type="button" class="btn btn-navy btn-block" id="nfc-btn" style="margin-bottom:12px">Tap an NFC tag</button>` : ''}
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
  function sheetShift(s) {
    const isNew = !s;
    s = s || { staffId: '', siteId: db.sites[0]?.id, date: ymd(addDays(startOfWeek(new Date()), ui.weekOffset * 7)), start: '07:00', end: '19:00', notes: '', status: 'confirmed' };
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
      <div class="field"><label>Contacts (one per line: Name | Role | Phone)</label><textarea class="input" name="contacts">${esc(contacts)}</textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save Site</button></form>`, (d) => {
      const code = d.code.trim().toUpperCase();
      if (db.sites.some((x) => x.code.toUpperCase() === code && x.id !== s.id)) return 'Another site already uses that code';
      const data = { customer: d.customer.trim(), name: d.name.trim(), address: d.address.trim(), city: d.city.trim(), region: d.region.trim(), country: d.country.trim(), code,
        contacts: d.contacts.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([name, role = '', phone = '']) => ({ name, role, phone })) };
      if (isNew) db.sites.push({ id: uid(), ...data }); else Object.assign(siteById(s.id), data);
      save(); render(); toast('Site saved');
    });
  }
  function nextEmpNo() { return 'VWG' + String(db.staff.reduce((m, s) => Math.max(m, parseInt(s.empNo.replace(/\D/g, ''), 10) || 0), 0) + 1).padStart(3, '0'); }
  function sheetStaff(s) {
    const isNew = !s;
    s = s || { name: '', empNo: nextEmpNo(), email: '', role: 'Security Officer', dept: 'Security', phone: '', startDate: ymd(new Date()), rate: 0, isAdmin: false, active: true };
    openSheet(`<h2>${isNew ? 'Add Staff Member' : 'Edit Staff Member'}</h2><form class="form">
      <div class="field"><label>Full name</label><input class="input" name="name" value="${esc(s.name)}" required></div>
      <div class="field"><label>Email (used to sign in)</label><input class="input" type="email" name="email" value="${esc(s.email)}" required></div>
      <div class="row"><div class="field"><label>Employee no.</label><input class="input" name="empNo" value="${esc(s.empNo)}" required></div><div class="field"><label>Start date</label><input class="input" type="date" name="startDate" value="${esc(s.startDate)}"></div></div>
      <div class="row"><div class="field"><label>Role</label><input class="input" name="role" value="${esc(s.role)}"></div><div class="field"><label>Department</label><input class="input" name="dept" value="${esc(s.dept)}"></div></div>
      <div class="row"><div class="field"><label>Phone</label><input class="input" type="tel" name="phone" value="${esc(s.phone)}"></div><div class="field"><label>Hourly rate (${CONFIG.currency})</label><input class="input" type="number" min="0" step="0.01" name="rate" value="${esc(s.rate)}"></div></div>
      <div class="field"><label>${isNew ? 'Password' : 'New password (leave blank to keep)'}</label><input class="input" name="password" minlength="8" ${isNew ? 'required' : ''} placeholder="At least 8 characters"></div>
      <label class="check"><input type="checkbox" name="isAdmin" ${s.isAdmin ? 'checked' : ''}>Admin access</label>
      <label class="check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}>Active (can sign in)</label>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save</button>
      ${!isNew && s.id !== db.session ? `<button type="button" class="btn btn-ghost btn-block" style="color:var(--red)" data-action="staff-delete" data-id="${s.id}">${ic(I.trash, 18)}Delete Staff Member</button>` : ''}</form>`, async (d) => {
      const email = d.email.trim().toLowerCase(); const empNo = d.empNo.trim().toUpperCase();
      if (db.staff.some((x) => x.email.toLowerCase() === email && x.id !== s.id)) return 'That email is already in use';
      if (db.staff.some((x) => x.empNo === empNo && x.id !== s.id)) return 'That employee number is already in use';
      if (s.id === db.session && (!d.isAdmin || !d.active)) return 'You cannot remove your own admin access';
      const target = isNew ? { id: uid(), color: COLORS[db.staff.length % COLORS.length], photo: null, emergency: '', address: '' } : staffById(s.id);
      Object.assign(target, { name: d.name.trim(), email, empNo, role: d.role.trim(), dept: d.dept.trim(), phone: d.phone.trim(), startDate: d.startDate, rate: Number(d.rate) || 0, isAdmin: !!d.isAdmin, active: !!d.active });
      if (d.password) { target.salt = uid(); target.pwHash = await hashPassword(d.password, target.salt); }
      if (isNew) db.staff.push(target);
      save(); render(); toast('Saved');
    });
  }
  function sheetEditMe() {
    const u = me();
    openSheet(`<h2>Edit My Details</h2><form class="form">
      <div class="field"><label>Phone</label><input class="input" type="tel" name="phone" value="${esc(u.phone)}"></div>
      <div class="field"><label>Emergency contact</label><input class="input" name="emergency" value="${esc(u.emergency)}" placeholder="Name & number"></div>
      <div class="field"><label>Address</label><textarea class="input" name="address">${esc(u.address)}</textarea></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Save</button></form>`, (d) => {
      Object.assign(u, { phone: d.phone.trim(), emergency: d.emergency.trim(), address: d.address.trim() }); save(); render(); toast('Details updated');
    });
  }
  function sheetChangePw() {
    openSheet(`<h2>Change Password</h2><form class="form">
      <div class="field"><label>Current password</label><input class="input" type="password" name="old" required></div>
      <div class="field"><label>New password</label><input class="input" type="password" name="pw" minlength="8" required></div>
      <div class="field"><label>Confirm new password</label><input class="input" type="password" name="pw2" required></div>
      <div class="error"></div><button class="btn btn-gold btn-block" type="submit">Update Password</button></form>`, async (d) => {
      const u = me();
      if (await hashPassword(d.old, u.salt) !== u.pwHash) return 'Current password is incorrect';
      if (d.pw.length < 8) return 'Use at least 8 characters';
      if (d.pw !== d.pw2) return 'Passwords do not match';
      u.salt = uid(); u.pwHash = await hashPassword(d.pw, u.salt); save(); toast('Password changed');
    });
  }

  // ---------- Clock ----------
  function getGeo() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }), () => resolve(null), { timeout: 6000, maximumAge: 60000 });
    });
  }
  async function clockIn({ shiftId = null, siteId = null, method = 'app' } = {}) {
    const u = me(); if (openEntry(u.id)) return;
    const today = ymd(new Date());
    let shift = shiftId ? db.shifts.find((s) => s.id === shiftId) : null;
    if (!shift) shift = db.shifts.filter((s) => s.staffId === u.id && s.date === today && (!siteId || s.siteId === siteId)).sort(byStart)[0];
    const entry = { id: uid(), staffId: u.id, shiftId: shift?.id || null, siteId: siteId || shift?.siteId || null, clockIn: new Date().toISOString(), clockOut: null, breaks: [], geo: null, method };
    db.entries.push(entry);
    addOccurrence(`Clocked in${method !== 'app' ? ' via ' + method.toUpperCase() : ''}`, 'clock', entry.siteId);
    save(); ui.drawer = false; render(); toast(`Clocked in at ${fmtTime(new Date())}`);
    const geo = await getGeo(); if (geo) { entry.geo = geo; save(); }
  }
  function clockOut() {
    const e = openEntry(db.session); if (!e) return;
    const now = new Date().toISOString();
    e.breaks.forEach((b) => { if (!b.end) b.end = now; });
    e.clockOut = now;
    addOccurrence(`Clocked out · ${fmtDur(entryWorkedMs(e))} worked`, 'clock', e.siteId);
    save(); ui.drawer = false; render(); toast(`Clocked out · ${fmtDur(entryWorkedMs(e))} worked`);
  }

  // ---------- Files ----------
  function download(name, text, type = 'text/csv') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const toCsv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  function timesheetCsv(entries) {
    const rows = [['Employee no', 'Name', 'Date', 'Site', 'Clock in', 'Clock out', 'Break (min)', 'Worked (h)', 'Method', 'Latitude', 'Longitude']];
    entries.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn)).forEach((e) => {
      const s = staffById(e.staffId) || {}; const cin = new Date(e.clockIn);
      rows.push([s.empNo, s.name, dmy(cin), siteById(e.siteId)?.name, fmtTime(cin), e.clockOut ? fmtTime(new Date(e.clockOut)) : '', Math.round(entryBreakMs(e) / 60000), hours(entryWorkedMs(e)).toFixed(2), e.method, e.geo?.lat, e.geo?.lng]);
    });
    return toCsv(rows);
  }
  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const size = 256; const c = document.createElement('canvas'); c.width = c.height = size;
        const k = Math.max(size / img.width, size / img.height); const w = img.width * k; const h = img.height * k;
        c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject; img.src = url;
    });
  }

  // ---------- Render ----------
  const VIEWS = { home: viewHome, shifts: viewShifts, offered: viewOffered, shift: viewShift, occurrence: viewOccurrence, leave: viewLeave, forms: viewForms, docs: viewDocs, doc: viewDoc, messages: viewMessages, register: viewRegister, welfare: viewWelfare, support: viewSupport, profile: viewProfile, training: viewTraining, module: viewModule, timesheet: viewTimesheet, admin: viewAdmin };
  function render() {
    clearInterval(ticker);
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
    const t = $('#live-time'); if (t) t.textContent = fmtTime(new Date());
    const e = openEntry(db.session); if (!e) return;
    for (const id of ['elapsed', 'drawer-elapsed']) { const el = document.getElementById(id); if (el) el.textContent = fmtClock(entryWorkedMs(e)); }
  }

  function bindLogin() {
    $('#login-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = $('#email').value.trim().toLowerCase(); const pw = $('#password').value;
      const u = db.staff.find((s) => s.email.toLowerCase() === email);
      if (!u || !u.active || await hashPassword(pw, u.salt) !== u.pwHash) { $('#login-error').textContent = 'Incorrect email address or password'; return; }
      db.session = u.id; save(); ui.showPw = false; go('home', {}, false); toast(`Welcome, ${u.name.split(' ')[0]}`);
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
    const lf = $('#leave-form');
    if (lf) lf.addEventListener('submit', (ev) => {
      ev.preventDefault(); const d = Object.fromEntries(new FormData(lf).entries());
      if (d.to < d.from) { lf.querySelector('.error').textContent = 'End date is before start date'; return; }
      db.leave.push({ id: uid(), staffId: db.session, type: d.type, from: d.from, to: d.to, reason: d.reason.trim(), status: 'pending', created: new Date().toISOString() });
      save(); render(); toast('Leave request submitted');
    });
    const cf = $('#composer');
    if (cf) {
      const chat = $('#chat'); window.scrollTo(0, document.body.scrollHeight); if (chat) chat.scrollIntoView(false);
      cf.addEventListener('submit', (ev) => {
        ev.preventDefault(); const text = cf.text.value.trim(); if (!text) return;
        db.messages.push({ id: uid(), staffId: db.session, text, time: new Date().toISOString() }); save(); render();
        const inp = $('#composer input'); if (inp) inp.focus();
      });
    }
    const qz = $('#quiz');
    if (qz) qz.addEventListener('submit', (ev) => {
      ev.preventDefault(); const t = TRAINING.find((x) => x.id === ui.params.id) || TRAINING[0];
      const a = Number(new FormData(qz).get('a'));
      if (a !== t.answer) { qz.querySelector('.error').textContent = 'Not quite — read the module again and retry.'; return; }
      db.trainingDone = db.trainingDone.filter((x) => !(x.moduleId === t.id && x.staffId === db.session));
      db.trainingDone.push({ moduleId: t.id, staffId: db.session, date: new Date().toISOString() }); save(); render(); toast('Module completed ✓');
    });
  }

  document.addEventListener('change', async (ev) => {
    if (ev.target.id !== 'photo-input' || !ev.target.files[0]) return;
    try { me().photo = await resizePhoto(ev.target.files[0]); save(); render(); toast('Photo updated'); } catch (e) { toast('Could not read that image'); }
  });

  document.addEventListener('click', async (ev) => {
    const nav = ev.target.closest('[data-nav]');
    // Detail pages get a Back button; top-level pages reset history and show the menu button.
    if (nav) { closeSheet(); go(nav.dataset.nav, { id: nav.dataset.id }, ['shift', 'doc', 'module'].includes(nav.dataset.nav)); return; }
    const ts = ev.target.closest('[data-ts]'); if (ts) { ui.tsRange = ts.dataset.ts; render(); return; }
    const at = ev.target.closest('[data-admin]'); if (at) { ui.adminTab = at.dataset.admin; render(); return; }
    const rg = ev.target.closest('[data-reg]'); if (rg) { ui.regTab = rg.dataset.reg; render(); return; }
    const btn = ev.target.closest('[data-action]'); if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'next-slide': ui.slide = Math.min(SLIDES.length - 1, ui.slide + 1); render(); break;
      case 'finish-onboard': db.onboarded = true; ui.slide = 0; save(); render(); break;
      case 'replay-intro': db.onboarded = false; save(); render(); break;
      case 'toggle-pw': { const v = $('#password').value; const e = $('#email').value; ui.showPw = !ui.showPw; render(); $('#password').value = v; $('#email').value = e; break; }
      case 'forgot':
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
      case 'refresh': render(); toast('Updated'); break;
      case 'week-prev': ui.weekOffset--; render(); break;
      case 'week-next': ui.weekOffset++; render(); break;
      case 'clock-in': await clockIn({ shiftId: id || null }); break;
      case 'clock-out': if (confirm('Clock out now?')) clockOut(); break;
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
      case 'form-new': sheetForm(btn.dataset.type); break;
      case 'doc-new':
        openSheet(`<h2>Add Document</h2><form class="form"><div class="field"><label>Title</label><input class="input" name="title" required></div>
          <div class="field"><label>Category</label><select class="input" name="category"><option>Policy</option><option>Safety</option><option>Site</option><option>HR</option></select></div>
          <div class="field"><label>Content</label><textarea class="input" name="body" style="height:180px" required></textarea></div><div class="error"></div><button class="btn btn-gold btn-block" type="submit">Publish</button></form>`, (d) => {
          db.documents.unshift({ id: uid(), title: d.title.trim(), category: d.category, body: d.body, date: new Date().toISOString() }); save(); render(); toast('Document published');
        });
        break;
      case 'doc-read': db.docReads.push({ docId: id, staffId: db.session, time: new Date().toISOString() }); save(); render(); toast('Thanks — recorded'); break;
      case 'doc-delete': if (confirm('Delete this document?')) { db.documents = db.documents.filter((d) => d.id !== id); save(); back(); } break;
      case 'visitor-new':
        openSheet(`<h2>Sign In Visitor</h2><form class="form"><div class="field"><label>Full name</label><input class="input" name="name" required></div>
          <div class="field"><label>Company</label><input class="input" name="company"></div><div class="field"><label>Purpose of visit</label><input class="input" name="purpose" required></div>
          <div class="row"><div class="field"><label>Vehicle reg</label><input class="input" name="vehicle" autocapitalize="characters"></div><div class="field"><label>Site</label><select class="input" name="siteId">${siteOptions(openEntry(db.session)?.siteId)}</select></div></div>
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
      case 'edit-me': sheetEditMe(); break;
      case 'change-pw': sheetChangePw(); break;
      case 'export-mine': download(`timesheet-${me().empNo}-${ymd(new Date())}.csv`, timesheetCsv(db.entries.filter((e) => e.staffId === db.session))); break;
      case 'export-all': download(`timesheets-${ymd(new Date())}.csv`, timesheetCsv(db.entries)); break;
      case 'export-register': download(`visitors-${ymd(new Date())}.csv`, toCsv([['Name', 'Company', 'Purpose', 'Vehicle', 'Site', 'In', 'Out'], ...db.register.map((r) => [r.name, r.company, r.purpose, r.vehicle, siteById(r.siteId)?.name, fmtStamp(r.inAt), r.outAt ? fmtStamp(r.outAt) : ''])])); break;
      case 'backup': download(`vwg-staff-backup-${ymd(new Date())}.json`, JSON.stringify(db, null, 2), 'application/json'); break;
      case 'restore': {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.onchange = async () => {
          try { const data = JSON.parse(await inp.files[0].text()); if (!Array.isArray(data.staff) || !Array.isArray(data.sites)) throw new Error('bad');
            db = Object.assign(emptyDb(), data, { session: db.session, onboarded: true }); save(); render(); toast('Data restored');
          } catch (e) { toast('That is not a valid backup file'); }
        };
        inp.click(); break;
      }
      case 'staff-new': sheetStaff(null); break;
      case 'staff-edit': sheetStaff(staffById(id)); break;
      case 'staff-delete': if (confirm('Delete this staff member? Their future shifts become open shifts; history is kept.')) { db.staff = db.staff.filter((s) => s.id !== id); db.shifts.forEach((s) => { if (s.staffId === id) { s.staffId = null; s.status = 'offered'; } }); save(); closeSheet(); render(); toast('Staff member deleted'); } break;
      case 'site-new': sheetSite(null); break;
      case 'site-edit': sheetSite(siteById(id)); break;
      case 'shift-new': sheetShift(null); break;
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
      case 'logout': db.session = null; save(); ui.drawer = false; ui.stack = []; ui.route = 'home'; render(); break;
    }
  });

  // ---------- Boot ----------
  (async function boot() {
    await seed();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
