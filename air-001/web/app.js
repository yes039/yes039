// AIR-001 前端（原生 ES Modules，無建置步驟）
// 伺服器模式：呼叫 /api（node:sqlite 檔案資料庫）
// 展示模式：找不到伺服器時，於瀏覽器記憶體以 sql.js 執行同一份業務核心（重新整理即重置）
import { fmtUSD, parseDollars, centsToInput, splitCommission } from './core/money.js';
import { todayLocal, addDays, weekRange, localToUtc, fmtLocalDateTime, utcToLocal } from './core/time.js';
import { t, toggleLang } from './i18n.js';

const app = document.getElementById('app');
const S = { mode: null, token: null, user: null, demoAccounts: [], drivers: null };
const ui = {
  period: 'today',
  orders: { q: '', status: '', date_from: '', date_to: '', collector: '', payment_status: '' },
  dispatchTab: 'pending', history: { driver_id: '', status: '' },
  customers: { q: '' },
  ledgerTab: 'orders', ledger: { date_from: '', date_to: '', type: '' },
  settle: { driver_id: '', date_from: '', date_to: '', tab: 'new', status: '', listAll: true },
};

// ---------- 小工具 ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const usd = (c) => `<span class="money">${fmtUSD(c)}</span>`;
const signed = (c) => `<span class="money ${c < 0 ? 'neg' : c > 0 ? 'pos' : ''}">${fmtUSD(c)}</span>`;
const can = (p) => S.user && (S.user.permissions.includes('*') || S.user.permissions.includes(p));
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const wd = (d) => WD[new Date(d + 'T12:00:00Z').getUTCDay()];
const md = (d) => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}（${wd(d)}）` : '';
const statusChip = (s) => `<span class="chip ${{ PENDING_DISPATCH: 'bad', ASSIGNED: 'warn', ACCEPTED: 'info', COMPLETED: 'ok', CANCELLED: '', REJECTED: 'bad' }[s] ?? ''}">${t('st.' + s, s)}</span>`;
const payChip = (s) => `<span class="chip ${{ UNPAID: 'warn', PARTIAL: 'warn', PAID: 'ok', OVERPAID: 'bad', REFUNDED: 'info', NONE: '' }[s] ?? ''}">${t('ps.' + s, s)}</span>`;
const sstChip = (s) => `<span class="chip ${{ OPEN: 'warn', PARTIAL: 'info', SETTLED: 'ok', VOID: '' }[s] ?? ''}">${t('sst.' + s, s)}</span>`;
const opt = (list, sel, prefix) => list.map((v) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(prefix ? t(prefix + v, v) : v)}</option>`).join('');
const tz = (iso) => { const l = utcToLocal(iso); return l.offset === -420 ? 'PDT' : 'PST'; };
const ENUM = {
  source: ['PHONE', 'LINE', 'REPEAT', 'REFERRAL', 'OTHER'], channel: ['PHONE', 'LINE', 'WECHAT', 'REFERRAL', 'REPEAT', 'OTHER'],
  trip: ['ARRIVAL', 'DEPARTURE', 'OTHER'], airport: ['LAX', 'SNA', 'ONT', 'BUR', 'LGB'], vehicle: ['SEDAN', 'SUV', 'VAN', 'LUXURY'],
  collector: ['COMPANY', 'DRIVER'], method: ['CASH', 'ZELLE', 'VENMO', 'CARD', 'CHECK', 'OTHER'],
};
function store(k, v) { try { v === undefined ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* 便利功能 */ } }
function load(k) { try { return sessionStorage.getItem(k); } catch { return null; } }

// ---------- 後端連線 ----------
let backend;
async function initBackend() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/health', { signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok && (await r.json()).mode === 'server') {
      S.mode = 'server';
      backend = async (method, path, opts) => {
        const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== '' && v != null)) : '';
        const res = await fetch(path + qs, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
          body: ['POST', 'PUT'].includes(method) ? JSON.stringify(opts.body || {}) : undefined });
        return { status: res.status, body: await res.json() };
      };
      return;
    }
  } catch { /* 沒有伺服器 → 展示模式 */ }
  S.mode = 'demo';
  app.innerHTML = '<div class="loading">展示模式：正在瀏覽器中建立 SQLite 模擬資料庫…</div>';
  const [{ openBrowserDb, browserEnv }, { createService }, { createRouter }, { buildDemo, runTestSuite }] = await Promise.all([
    import('./db-browser.js'), import('./core/service.js'), import('./core/router.js'), import('./core/demo.js')]);
  const env = browserEnv();
  let handle;
  async function boot() {
    const db = await openBrowserDb();
    const svc = createService(db, env);
    svc.init();
    db.tx(() => buildDemo(svc));
    handle = createRouter(svc, { runTests: () => runTestSuite(openBrowserDb, env), resetDemo: boot });
  }
  await boot();
  backend = async (method, path, opts) => {
    const r = await handle(method, path, JSON.parse(JSON.stringify({ query: opts.query || {}, body: opts.body || {}, token: S.token })));
    return { status: r.status, body: JSON.parse(JSON.stringify(r.body)) };
  };
}
async function api(method, path, opts = {}) {
  const query = opts.query ? Object.fromEntries(Object.entries(opts.query).filter(([, v]) => v !== '' && v != null)) : undefined;
  const r = await backend(method, path, { ...opts, query });
  if (r.status === 401 && path !== '/api/login') { S.token = null; S.user = null; store('air001.token'); renderLogin('登入逾時，請重新登入'); throw new Error('請先登入'); }
  if (r.status >= 400) { const e = new Error(r.body?.error || '發生錯誤'); e.code = r.body?.code; throw e; }
  return r.body;
}
const GET = (p, query) => api('GET', p, { query });
const POST = (p, body) => api('POST', p, { body });
const PUT = (p, body) => api('PUT', p, { body });

// ---------- 共用 UI ----------
function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), bad ? 4500 : 2600);
}
function openSheet({ title, body, foot = '', narrow = false, onMount }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h3>${title}</h3><button class="x" aria-label="關閉">×</button></div>
    <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  $('.x', ov).onclick = close;
  document.body.appendChild(ov);
  onMount?.(ov, close);
  const first = $('input:not([type=hidden]), select, textarea', ov);
  first?.focus({ preventScroll: true });
  return close;
}
function confirmDialog({ title = '請確認', message, confirmText = '確認', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      title, narrow: true, body: `<div>${message}</div>`,
      foot: `<button class="btn" data-no>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmText)}</button>`,
      onMount: (el, c) => {
        $('[data-no]', el).onclick = () => { done = true; c(); resolve(false); };
        $('[data-yes]', el).onclick = () => { done = true; c(); resolve(true); };
      },
    });
    void close; void done;
  });
}
/** 表單抽屜：submit(formData, el) 回傳 truthy 即關閉；錯誤顯示於表單上方 */
function formSheet({ title, fields, submitText = t('save'), narrow = true, onMount, submit, danger = false }) {
  openSheet({
    title, narrow,
    body: `<div class="err" hidden data-err></div><form class="form" id="sheet-form" novalidate>${fields}</form>`,
    foot: `<button class="btn" data-cancel>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-submit>${esc(submitText)}</button>`,
    onMount: (el, close) => {
      const form = $('#sheet-form', el);
      const errBox = $('[data-err]', el);
      const go = async (e) => {
        e?.preventDefault();
        errBox.hidden = true;
        const btn = $('[data-submit]', el);
        btn.disabled = true;
        try {
          const fd = Object.fromEntries(new FormData(form).entries());
          $$('input[type=checkbox]', form).forEach((c) => { fd[c.name] = c.checked; });
          const ok = await submit(fd, el);
          if (ok !== false) close();
        } catch (err) {
          errBox.textContent = err.message; errBox.hidden = false; errBox.scrollIntoView({ block: 'nearest' });
          if (err.code === 'SCHEDULE_CONFLICT') { const f = $('[data-force]', el); if (f) f.hidden = false; }
        } finally { btn.disabled = false; }
      };
      form.addEventListener('submit', go);
      $('[data-submit]', el).onclick = go;
      $('[data-cancel]', el).onclick = close;
      onMount?.(el, close);
    },
  });
}
const field = (label, input, { req = false, full = false, hint = '' } = {}) =>
  `<label class="f ${full ? 'full' : ''}"><span>${label}${req ? ' <b>*</b>' : ''}</span>${input}${hint ? `<span class="small muted">${hint}</span>` : ''}</label>`;
const money = (name, val, attrs = '') => `<input name="${name}" id="f-${name}" inputmode="decimal" placeholder="0.00" value="${val === undefined || val === null ? '' : esc(centsToInput(val))}" ${attrs}>`;
const toCents = (v) => parseDollars(v);

function downloadCsv(filename, rows) {
  const csv = '﻿' + rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  if (S.mode === 'server') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    toast('已匯出 ' + filename);
    return;
  }
  openSheet({
    title: 'CSV 匯出：' + esc(filename),
    body: `<div class="infobox">展示模式下瀏覽器禁止直接下載。請按「複製」後貼到 Excel / Google 試算表；伺服器模式會直接下載檔案。</div>
      <textarea id="csv-out" rows="12" readonly style="font-family: var(--font-num); font-size: 12px">${esc(csv.slice(1))}</textarea>`,
    foot: '<button class="btn primary" data-copy>複製 CSV</button>',
    onMount: (el) => {
      $('[data-copy]', el).onclick = async () => {
        const ta = $('#csv-out', el);
        try { await navigator.clipboard.writeText(ta.value); toast('已複製'); } catch { ta.select(); toast('請按 Ctrl/⌘+C 複製'); }
      };
    },
  });
}

// ---------- 登入 ----------
const DEMO = [
  ['owner', 'owner123', '老闆', '全部功能、授權抵銷'], ['dispatch', 'dispatch123', '調度員', '接單、派車、客戶'],
  ['account', 'account123', '會計', '收款確認、帳本、結算'], ['driver1', 'driver123', '司機 王大明', '我的任務、接單回報'],
];
function renderLogin(msg = '') {
  app.innerHTML = `<div class="login"><form class="login-card" id="login">
    <div><div class="seal">AIR-001 · LOS ANGELES</div><h1>機場接送營運系統</h1>
    <div class="small muted">G1 可操作原型｜${S.mode === 'server' ? '伺服器模式（SQLite 檔案資料庫）' : '展示模式（瀏覽器記憶體，重新整理即重置）'}｜全部為模擬資料</div></div>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
    <div class="demo-accounts">${DEMO.map(([u, p, n, d]) => `<button type="button" data-u="${u}" data-p="${p}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>
    ${field('帳號', '<input name="username" id="login-u" autocomplete="username" required>')}
    ${field('密碼', '<input name="password" id="login-p" type="password" autocomplete="current-password" required>')}
    <button class="btn primary" type="submit">登入</button>
    <div class="small muted">示範帳號：owner/owner123、dispatch/dispatch123、account/account123、driver1/driver123</div>
  </form></div>`;
  const form = $('#login');
  const doLogin = async (username, password) => {
    try {
      const r = await POST('/api/login', { username, password });
      S.token = r.token; S.user = r.user; store('air001.token', r.token);
      S.drivers = null;
      location.hash = S.user.role_code === 'DRIVER' ? 'dispatch' : 'dashboard';
      renderShell();
    } catch (e) { renderLogin(e.message); }
  };
  $$('[data-u]', form).forEach((b) => { b.onclick = () => doLogin(b.dataset.u, b.dataset.p); });
  form.onsubmit = (e) => { e.preventDefault(); doLogin($('#login-u').value, $('#login-p').value); };
}

// ---------- 外框與導覽 ----------
const ICONS = {
  dashboard: '<path d="M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z" fill="currentColor"/>',
  orders: '<path d="M7 3h10l3 3v15H4V3zm0 5h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  dispatch: '<path d="M5 16l1.5-6A2 2 0 0 1 8.4 8.5h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3H4zM7 19v1.5M17 19v1.5" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="7.5" cy="16.8" r="1" fill="currentColor"/><circle cx="16.5" cy="16.8" r="1" fill="currentColor"/>',
  customers: '<circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.6.7 2.6 2.4 3 5.2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  ledger: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm0 14a2 2 0 0 1 2-2h12M9 8h6M9 11h4" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  settlements: '<path d="M4 7h13l-3-3M20 17H7l3 3" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  tests: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  audit: '<path d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" stroke="currentColor" stroke-width="1.8" fill="none"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
function navItems() {
  if (S.user.role_code === 'DRIVER') return [['dispatch', t('nav.mytasks')], ['settlements', t('nav.settlements')]];
  const items = [];
  if (can('dashboard.view')) items.push(['dashboard', t('nav.dashboard')]);
  items.push(['orders', t('nav.orders')], ['dispatch', t('nav.dispatch')], ['customers', t('nav.customers')]);
  if (can('ledger.read')) items.push(['ledger', t('nav.ledger')]);
  if (can('settlement.read')) items.push(['settlements', t('nav.settlements')]);
  return items;
}
let pendingCount = 0;
function renderShell() {
  const items = navItems();
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><b>AIR-001</b><span class="seal">LAX · OPS</span></div>
      <div class="spacer"></div>
      <div class="who"><div>${esc(S.user.display_name)}<span class="role">・${esc(S.user.role_name)}</span></div>
        <div class="mode">${S.mode === 'server' ? '伺服器模式' : '展示模式'}・洛杉磯 ${todayLocal().slice(5).replace('-', '/')} ${tz(new Date().toISOString())}</div></div>
      <button class="icon-btn" id="menu-btn" aria-haspopup="true" aria-label="選單">☰</button>
    </header>
    <div class="shell">
      <nav class="nav" style="grid-template-columns: repeat(${items.length}, 1fr)">
        ${items.map(([k, label]) => `<a href="#${k}" data-nav="${k}">${icon(k)}<span>${label}</span>${k === 'dispatch' && S.user.role_code !== 'DRIVER' ? '<span class="badge" data-pending hidden></span>' : ''}</a>`).join('')}
        ${S.user.role_code !== 'DRIVER' ? `<hr class="nav-extra"><a class="nav-extra" href="#tests" data-nav="tests">${icon('tests')}<span>${t('nav.tests')}</span></a>
        ${can('audit.read') ? `<a class="nav-extra" href="#audit" data-nav="audit">${icon('audit')}<span>${t('nav.audit')}</span></a>` : ''}` : ''}
      </nav>
      <main class="main" id="main"></main>
    </div>`;
  $('#menu-btn').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
  route();
}
function toggleMenu() {
  const old = $('.menu');
  if (old) { old.remove(); return; }
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = `
    ${S.user.role_code !== 'DRIVER' ? `<a href="#tests">${t('nav.tests')}</a>` : ''}
    ${can('audit.read') ? `<a href="#audit">${t('nav.audit')}</a>` : ''}
    <button data-lang>${t('lang')}</button>
    ${S.user.role_code === 'OWNER' ? '<button data-reset>重置模擬資料</button>' : ''}
    <button data-logout>${t('logout')}</button>`;
  document.body.appendChild(m);
  const off = () => { m.remove(); document.removeEventListener('click', off); };
  setTimeout(() => document.addEventListener('click', off));
  $('[data-lang]', m).onclick = () => { toggleLang(); renderShell(); };
  $('[data-logout]', m).onclick = async () => { try { await POST('/api/logout'); } catch { /* ignore */ } S.token = null; S.user = null; store('air001.token'); renderLogin(); };
  const r = $('[data-reset]', m);
  if (r) r.onclick = () => formSheet({
    title: '重置模擬資料', danger: true, submitText: '重置',
    fields: `<div class="warnbox full">將刪除所有資料並重新建立模擬資料，重置後需重新登入。</div>${field('請輸入 RESET 確認', '<input name="confirm" id="f-reset">', { full: true })}`,
    submit: async (fd) => { await POST('/api/admin/reset-demo', { confirm: fd.confirm }); S.token = null; store('air001.token'); renderLogin('已重置模擬資料，請重新登入'); },
  });
}
const VIEWS = {};
async function route() {
  const main = $('#main');
  if (!main) return;
  let name = (location.hash || '').slice(1) || (S.user.role_code === 'DRIVER' ? 'dispatch' : 'dashboard');
  if (!VIEWS[name] || !navItems().some(([k]) => k === name) && !['tests', 'audit'].includes(name)) name = navItems()[0][0];
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  $('.menu')?.remove();
  main.innerHTML = '<div class="loading">載入中…</div>';
  try { await VIEWS[name](main); } catch (e) { main.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  refreshBadge();
}
async function refreshBadge() {
  if (!can('dispatch.manage')) return;
  try {
    const list = await GET('/api/orders', { status: 'PENDING_DISPATCH', date_from: todayLocal() });
    pendingCount = list.length;
    $$('[data-pending]').forEach((b) => { b.textContent = pendingCount; b.hidden = !pendingCount; });
  } catch { /* ignore */ }
}
window.addEventListener('hashchange', () => { if (S.user) route(); });
const refresh = () => route();
const head = (code, title, actions = '') => `<div class="page-head"><div><span class="code">${code}</span><h1>${title}</h1></div><div class="actions">${actions}</div></div>`;

// =====================================================================
// P01 老闆營運戰情室
// =====================================================================
VIEWS.dashboard = async (main) => {
  const d = await GET('/api/dashboard', { period: ui.period });
  const maxComm = Math.max(1, ...d.drivers.map((x) => x.commission));
  const maxRoute = Math.max(1, ...d.routes.map((x) => x.n));
  const brief = (o, actions = true) => `<div class="row" data-order="${o.id}">
      <div class="l1"><span class="when">${md(o.pickup_local_date)} ${o.pickup_local_time}</span>${statusChip(o.status)}<span class="chip">${t('trip.' + o.trip_type)} ${o.airport}</span><span class="no small">${o.order_no}</span></div>
      <div class="l2"><span>${esc(o.contact_name)}</span><span>${esc(o.area)}</span><span>${o.flight_no ? '航班 ' + esc(o.flight_no) : ''}</span><span>${o.passengers} 人・${t('veh.' + o.vehicle_type)}</span>${o.driver_name ? `<span>司機 ${esc(o.driver_name)}</span>` : ''}</div>
      ${actions && o.status === 'PENDING_DISPATCH' && can('dispatch.manage') ? `<div class="acts"><button class="btn small primary" data-assign="${o.id}">立即派車</button></div>` : ''}
    </div>`;
  main.innerHTML = `
    ${head('P01', t('p01'), `<div class="seg" role="tablist">${['today', 'week', 'month'].map((p) => `<button class="${ui.period === p ? 'on' : ''}" data-period="${p}">${t(p)}</button>`).join('')}</div>`)}
    <div class="small muted" style="margin:-6px 0 12px">統計區間（洛杉磯當地日期）：${d.range.from === d.range.to ? d.range.from : d.range.from + ' ～ ' + d.range.to}</div>
    <div class="alert-strip">
      <button class="alert-tile ${d.pending_dispatch.length ? 'hot' : ''}" data-go="pending"><span class="lbl">${t('pending')}</span><span class="n">${d.pending_dispatch.length}</span><span class="sub">點此直接派車</span></button>
      <button class="alert-tile" data-go="awaiting"><span class="lbl">${t('awaiting')}</span><span class="n">${d.awaiting_confirm.length}</span><span class="sub">已指派未確認</span></button>
      <button class="alert-tile" data-go="tomorrow"><span class="lbl">${t('tomorrow')}</span><span class="n">${d.tomorrow.length}</span><span class="sub">${md(addDays(d.today, 1))}</span></button>
      <button class="alert-tile" data-go="ledger"><span class="lbl">待確認到帳</span><span class="n money" style="font-size:20px">${fmtUSD(d.pending_payment_cents)}</span><span class="sub">未計入已收</span></button>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">${t('k.orders')}</div><div class="val">${d.counts[ui.period]}</div><div class="hint">今 ${d.counts.today}・週 ${d.counts.week}・月 ${d.counts.month}</div></div>
      <div class="kpi"><div class="lbl">${t('k.fare')}</div><div class="val">${fmtUSD(d.fare_posted_cents)}</div><div class="hint">另小費 ${fmtUSD(d.tip_posted_cents)}（歸司機）</div></div>
      <div class="kpi accent"><div class="lbl">${t('k.commission')}</div><div class="val">${fmtUSD(d.commission_cents)}</div><div class="hint">已入帳，15% 抽佣</div></div>
      <div class="kpi"><div class="lbl">${t('k.booked')}</div><div class="val">${fmtUSD(d.booked_fare_cents)}</div><div class="hint">${d.booked_count} 筆未完成・預估佣金 ${fmtUSD(d.booked_commission_est_cents)}</div></div>
      <div class="kpi"><div class="lbl">${t('k.received')}</div><div class="val">${fmtUSD(d.received_cents)}</div><div class="hint">僅計已確認到帳</div></div>
      <div class="kpi ${d.outstanding_cents ? 'bad' : ''}"><div class="lbl">${t('k.outstanding')}</div><div class="val">${fmtUSD(d.outstanding_cents)}</div><div class="hint">已完成訂單客戶未付</div></div>
      <div class="kpi"><div class="lbl">${t('k.owes')}</div><div class="val">${fmtUSD(d.company_owes_drivers_cents)}</div><div class="hint">目前全部未結（不抵銷）</div></div>
      <div class="kpi"><div class="lbl">${t('k.remit')}</div><div class="val">${fmtUSD(d.drivers_owe_company_cents)}</div><div class="hint">目前全部未結（不抵銷）</div></div>
    </div>
    <div class="grid two">
      <section class="card" id="sec-pending"><h2>${t('pending')} <span class="badge">${d.pending_dispatch.length}</span><a class="more" href="#dispatch">派遣中心 →</a></h2>
        <div class="list">${d.pending_dispatch.slice(0, 5).map((o) => brief(o)).join('') || '<div class="empty">目前沒有待派車訂單</div>'}${d.pending_dispatch.length > 5 ? `<a class="btn" href="#dispatch">查看其餘 ${d.pending_dispatch.length - 5} 筆待派車 →</a>` : ''}</div></section>
      <section class="card" id="sec-tomorrow"><h2>${t('tomorrow')}・${md(addDays(d.today, 1))}<a class="more" href="#orders">全部訂單 →</a></h2>
        <div class="list">${d.tomorrow.map((o) => brief(o, false)).join('') || '<div class="empty">明日尚無接送</div>'}</div></section>
      <section class="card"><h2>司機接單數與佣金貢獻<span class="more muted">${t(ui.period)}</span></h2>
        <div class="table-wrap"><table><thead><tr><th>司機</th><th class="r">接單</th><th class="r">完成</th><th class="r">拒單</th><th class="r">佣金貢獻</th><th style="width:28%"></th></tr></thead><tbody>
        ${d.drivers.map((x) => `<tr><td>${esc(x.name)} <span class="muted small">${x.driver_no}</span></td><td class="r num">${x.orders}</td><td class="r num">${x.completed}</td><td class="r num">${x.rejected}</td><td class="r money">${fmtUSD(x.commission)}</td><td><div class="bar"><i style="width:${(x.commission / maxComm) * 100}%"></i></div></td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card"><h2>熱門路線<span class="more muted">${t(ui.period)}・依筆數</span></h2>
        ${d.routes.length ? `<div class="list">${d.routes.map((r) => `<div style="display:grid;gap:4px"><div style="display:flex;gap:8px"><b>${r.airport} ⇄ ${esc(r.area)}</b><span class="muted small">${r.n} 筆</span><span class="money" style="margin-left:auto">${fmtUSD(r.fare)}</span></div><div class="bar"><i style="width:${(r.n / maxRoute) * 100}%"></i></div></div>`).join('')}</div>` : '<div class="empty">此區間沒有訂單</div>'}
        <h2 style="margin-top:16px">客戶回購<span class="more muted">全期間</span></h2>
        <div class="fin"><div><div class="lbl">回購率</div><div class="money">${(d.repurchase.rate * 100).toFixed(1)}%</div></div><div><div class="lbl">回購客戶 / 下單客戶</div><div class="money">${d.repurchase.repeaters} / ${d.repurchase.buyers}</div></div></div>
        <div class="list" style="margin-top:8px">${d.repurchase.top.map((c) => `<div style="display:flex;gap:8px;font-size:14px"><span>${esc(c.name)}</span><span class="muted small">${c.customer_no}</span><span style="margin-left:auto" class="num">${c.n} 筆・最近 ${md(c.last_date)}</span></div>`).join('')}</div>
      </section>
    </div>`;
  $$('[data-period]', main).forEach((b) => { b.onclick = () => { ui.period = b.dataset.period; refresh(); }; });
  $$('[data-go]', main).forEach((b) => {
    b.onclick = () => {
      const g = b.dataset.go;
      if (g === 'pending' || g === 'awaiting') { ui.dispatchTab = g; location.hash = 'dispatch'; }
      else if (g === 'tomorrow') $('#sec-tomorrow').scrollIntoView({ behavior: 'smooth' });
      else { ui.ledgerTab = 'pending'; location.hash = 'ledger'; }
    };
  });
  bindOrderRows(main);
};

function bindOrderRows(root) {
  $$('[data-assign]', root).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); assignSheet(+b.dataset.assign); }; });
  $$('[data-order]', root).forEach((r) => { r.onclick = () => orderDetail(+r.dataset.order); });
}

// =====================================================================
// P03 訂單管理
// =====================================================================
const orderRow = (o) => `<div class="row" data-order="${o.id}" role="button" tabindex="0">
  <div class="l1"><span class="when">${md(o.pickup_local_date)} ${o.pickup_local_time} <span class="small muted">${o.pickup_utc_offset === -420 ? 'PDT' : 'PST'}</span></span>
    ${statusChip(o.status)} ${payChip(o.payment_status)} <span class="chip ${o.collector === 'DRIVER' ? 'gold' : ''}">${t('col.' + o.collector)}</span>
    ${o.dst_ambiguous ? '<span class="chip warn">夏令時間重疊・待確認</span>' : ''}
    <span class="amt">${fmtUSD(o.fare_cents)}${o.tip_cents ? ` <span class="small muted">+小費 ${fmtUSD(o.tip_cents)}</span>` : ''}</span></div>
  <div class="l2"><span class="no">${o.order_no}</span><span>${esc(o.customer_name)}</span><span>${t('trip.' + o.trip_type)} ${o.airport}${o.flight_no ? ' ' + esc(o.flight_no) : ''} ⇄ ${esc(o.area)}</span>
    <span>${o.passengers} 人・${o.luggage} 件・${t('veh.' + o.vehicle_type)}</span>${o.driver_name ? `<span>司機 ${esc(o.driver_name)}</span>` : ''}</div>
</div>`;
VIEWS.orders = async (main) => {
  const f = ui.orders;
  const list = await GET('/api/orders', { ...f, sort: 'desc' });
  const STS = ['', 'PENDING_DISPATCH', 'ASSIGNED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'];
  main.innerHTML = `
    ${head('P03', t('p03'), can('order.write') ? `<button class="btn gold" id="new-order">＋ ${t('new.order')}</button>` : '')}
    <div class="toolbar"><input type="search" id="o-q" placeholder="搜尋單號、客戶、電話、航班、地址" value="${esc(f.q)}"></div>
    <div class="toolbar"><div class="chips-filter">${STS.map((s) => `<button class="${f.status === s ? 'on' : ''}" data-st="${s}">${s ? t('st.' + s) : '全部'}</button>`).join('')}</div></div>
    <div class="toolbar">
      <label class="small muted">日期 <input type="date" id="o-from" value="${f.date_from}"></label><label class="small muted">至 <input type="date" id="o-to" value="${f.date_to}"></label>
      <select id="o-col" aria-label="收款方"><option value="">全部收款方</option>${opt(ENUM.collector, f.collector, 'col.')}</select>
      <select id="o-ps" aria-label="付款狀態"><option value="">全部付款狀態</option>${opt(['UNPAID', 'PARTIAL', 'PAID', 'OVERPAID', 'REFUNDED'], f.payment_status, 'ps.')}</select>
      <button class="btn small ghost" id="o-clear">清除篩選</button>
    </div>
    <div class="small muted" style="margin-bottom:8px">共 ${list.length} 筆（依接送時間新到舊）</div>
    <div class="list">${list.map(orderRow).join('') || '<div class="empty">沒有符合條件的訂單</div>'}</div>`;
  let timer;
  $('#o-q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value; refresh().then(() => { const q = $('#o-q'); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }); }, 300); };
  $$('[data-st]', main).forEach((b) => { b.onclick = () => { f.status = b.dataset.st; refresh(); }; });
  $('#o-from').onchange = (e) => { f.date_from = e.target.value; refresh(); };
  $('#o-to').onchange = (e) => { f.date_to = e.target.value; refresh(); };
  $('#o-col').onchange = (e) => { f.collector = e.target.value; refresh(); };
  $('#o-ps').onchange = (e) => { f.payment_status = e.target.value; refresh(); };
  $('#o-clear').onclick = () => { Object.assign(f, { q: '', status: '', date_from: '', date_to: '', collector: '', payment_status: '' }); refresh(); };
  $('#new-order')?.addEventListener('click', () => orderForm());
  bindOrderRows(main);
};

async function orderForm(existing = null) {
  const customers = await GET('/api/customers');
  const o = existing || { trip_type: 'ARRIVAL', airport: 'LAX', source: 'PHONE', passengers: 2, luggage: 2, vehicle_type: 'SEDAN', collector: 'COMPANY', payment_method: 'ZELLE', pickup_local_date: addDays(todayLocal(), 1), pickup_local_time: '10:00', tip_cents: 0 };
  const custLabel = (c) => `${c.customer_no} ${c.name}${c.phone ? ' ' + c.phone : ''}`;
  const cur = existing ? customers.find((c) => c.id === existing.customer_id) : null;
  formSheet({
    title: existing ? `編輯訂單 ${existing.order_no}` : t('new.order'), narrow: false,
    submitText: existing ? '儲存變更' : '建立訂單',
    fields: `
      <fieldset><legend>客戶與聯絡</legend>
        ${field('客戶（輸入姓名或電話搜尋；找不到即建立新客戶）', `<input name="cust" id="f-cust" list="cust-list" value="${esc(cur ? custLabel(cur) : '')}" ${existing ? 'disabled' : ''} autocomplete="off"><datalist id="cust-list">${customers.map((c) => `<option value="${esc(custLabel(c))}">`).join('')}</datalist>`, { req: true, full: true })}
        <div class="small muted full" id="cust-hint"></div>
        ${field('聯絡人', `<input name="contact_name" id="f-contact_name" value="${esc(o.contact_name || '')}">`)}
        ${field('聯絡電話', `<input name="contact_phone" id="f-contact_phone" inputmode="tel" value="${esc(o.contact_phone || '')}">`)}
        ${field('訂單來源', `<select name="source" id="f-source">${opt(ENUM.source, o.source, 'src.')}</select>`)}
      </fieldset>
      <fieldset><legend>行程（洛杉磯當地時間）</legend>
        ${field('類型', `<select name="trip_type" id="f-trip_type">${opt(ENUM.trip, o.trip_type, 'trip.')}</select>`)}
        ${field('機場', `<select name="airport" id="f-airport">${opt(ENUM.airport, o.airport)}</select>`)}
        ${field('航班', `<input name="flight_no" id="f-flight_no" value="${esc(o.flight_no || '')}" placeholder="BR12">`)}
        ${field('接送日期', `<input type="date" name="pickup_local_date" id="f-date" value="${o.pickup_local_date}">`, { req: true })}
        ${field('接送時間', `<input type="time" name="pickup_local_time" id="f-time" value="${o.pickup_local_time}">`, { req: true })}
        ${field('重疊時段取', `<select name="dst_choice" id="f-dst"><option value="earlier">較早（PDT）</option><option value="later" ${existing && existing.dst_ambiguous && existing.pickup_utc_offset === -480 ? 'selected' : ''}>較晚（PST）</option></select>`, { hint: '僅秋季撥慢 01:00–01:59 有作用' })}
        <div class="full small" id="tz-preview"></div>
        ${field('上車地址', `<input name="pickup_address" id="f-pickup_address" value="${esc(o.pickup_address || '')}">`, { req: true, full: true })}
        ${field('下車地址', `<input name="dropoff_address" id="f-dropoff_address" value="${esc(o.dropoff_address || '')}">`, { req: true, full: true })}
        ${field('區域／城市（熱門路線用）', `<input name="area" id="f-area" value="${esc(o.area || '')}" placeholder="Irvine">`, { req: true })}
        ${field('人數', `<input name="passengers" id="f-passengers" type="number" min="1" max="20" value="${o.passengers}">`)}
        ${field('行李', `<input name="luggage" id="f-luggage" type="number" min="0" value="${o.luggage}">`)}
        ${field('車型', `<select name="vehicle_type" id="f-vehicle_type">${opt(ENUM.vehicle, o.vehicle_type, 'veh.')}</select>`)}
      </fieldset>
      <fieldset><legend>車資與收款（USD）</legend>
        ${field('車資', money('fare', o.fare_cents), { req: true })}
        ${field('小費（預計）', money('tip', o.tip_cents))}
        ${field('佣金計算基礎', money('base', existing && existing.commission_base_cents !== existing.fare_cents ? existing.commission_base_cents : null), { hint: '空白＝等於車資；代墊停車費等不抽佣項目可在此扣除' })}
        ${field('收款方', `<select name="collector" id="f-collector">${opt(ENUM.collector, o.collector, 'col.')}</select>`)}
        ${field('收款方式', `<select name="payment_method" id="f-payment_method">${opt(ENUM.method, o.payment_method, 'm.')}</select>`)}
        <div class="calc" id="calc"></div>
      </fieldset>
      ${field('備註', `<textarea name="notes" id="f-notes">${esc(o.notes || '')}</textarea>`, { full: true })}
      ${existing ? field('修改原因（變更車資、小費、收款方時必填）', '<input name="reason" id="f-reason">', { full: true }) : ''}`,
    onMount: (el) => {
      const custInput = $('#f-cust', el);
      const hint = $('#cust-hint', el);
      const findCust = () => customers.find((c) => custLabel(c) === custInput.value);
      const onCust = () => {
        const c = findCust();
        if (c) {
          hint.textContent = `既有客戶 ${c.customer_no}・歷史 ${c.order_count} 筆・累計車資 ${fmtUSD(c.total_fare_cents)}`;
          if (!$('#f-contact_name', el).value) $('#f-contact_name', el).value = c.name;
          if (!$('#f-contact_phone', el).value) $('#f-contact_phone', el).value = c.phone || '';
          if (!$('#f-dropoff_address', el).value && c.addresses[0]) $('#f-dropoff_address', el).value = c.addresses[0];
        } else hint.textContent = custInput.value ? '找不到此客戶 → 送出時以「聯絡人／電話」建立新客戶（電話相同者自動併入既有客戶）' : '';
      };
      if (!existing) custInput.oninput = onCust;
      const preview = () => {
        const box = $('#tz-preview', el);
        try {
          const r = localToUtc($('#f-date', el).value, $('#f-time', el).value, $('#f-dst', el).value);
          box.innerHTML = r.ambiguous
            ? `<div class="warnbox">此時間在夏令時間結束當天出現兩次：較早 ${fmtLocalDateTime(r.candidates[0])}、較晚 ${fmtLocalDateTime(r.candidates[1])}。目前選擇：${fmtLocalDateTime(r.utc)}（UTC ${r.utc.slice(11, 16)}）。訂單將標記待確認。</div>`
            : `<span class="muted">洛杉磯 ${fmtLocalDateTime(r.utc)} ＝ UTC ${r.utc.replace('T', ' ').slice(0, 16)}</span>`;
        } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      };
      const calc = () => {
        let fare = 0; let tip = 0; let base = 0;
        try { fare = toCents($('#f-fare', el).value); tip = toCents($('#f-tip', el).value); base = $('#f-base', el).value ? toCents($('#f-base', el).value) : fare; } catch { $('#calc', el).innerHTML = '<span class="neg">金額格式錯誤（最多兩位小數）</span>'; return; }
        const s = splitCommission(base, 1500);
        const drv = fare - s.commission + tip;
        const col = $('#f-collector', el).value;
        $('#calc', el).innerHTML = `<div>佣金 15% × ${fmtUSD(base)} ＝ ${usd(s.commission)}（四捨五入至美分）</div>
          <div>司機應得 ＝ 車資 ${fmtUSD(fare)} − 佣金 ${fmtUSD(s.commission)} ＋ 小費 ${fmtUSD(tip)} ＝ ${usd(drv)}</div>
          <div><b>${col === 'COMPANY' ? `公司收款 → 公司應付司機 ${fmtUSD(drv)}` : `司機收款 → 司機應繳公司 ${fmtUSD(s.commission)}`}</b></div>`;
      };
      ['#f-date', '#f-time', '#f-dst'].forEach((s) => $(s, el).addEventListener('input', preview));
      ['#f-fare', '#f-tip', '#f-base', '#f-collector'].forEach((s) => $(s, el).addEventListener('input', calc));
      preview(); calc();
    },
    submit: async (fd) => {
      const body = {
        ...fd, passengers: +fd.passengers, luggage: +fd.luggage, fare_cents: toCents(fd.fare), tip_cents: toCents(fd.tip),
        commission_base_cents: fd.base ? toCents(fd.base) : null,
      };
      if (existing) {
        body.version = existing.version;
        const r = await PUT('/api/orders/' + existing.id, body);
        toast('已更新 ' + r.order_no);
        refresh(); orderDetail(r.id);
        return;
      }
      const c = customers.find((x) => custLabel(x) === fd.cust);
      if (c) body.customer_id = c.id;
      else {
        if (!fd.contact_name && !fd.cust) throw new Error('請輸入客戶姓名');
        body.new_customer_name = fd.contact_name || fd.cust;
        body.new_customer_phone = fd.contact_phone;
      }
      const r = await POST('/api/orders', body);
      toast(`已建立 ${r.order_no}${r.dst_ambiguous ? '（夏令時間重疊，請確認）' : ''}`);
      refresh();
    },
  });
}

async function orderDetail(id, tab = 'dispatch') {
  const o = await GET('/api/orders/' + id);
  const f = o.finance;
  const done = o.status === 'COMPLETED';
  const active = o.dispatches.find((d) => ['ASSIGNED', 'ACCEPTED'].includes(d.status));
  const acts = [];
  if (can('order.write') && !['COMPLETED', 'CANCELLED'].includes(o.status)) acts.push(['edit', '編輯訂單', '']);
  if (can('dispatch.manage') && o.status === 'PENDING_DISPATCH') acts.push(['assign', '派車', 'primary']);
  if (active && active.status === 'ASSIGNED' && (can('dispatch.manage') || active.driver_id === S.user.driver_id)) acts.push(['accept', S.user.role_code === 'DRIVER' ? '確認接單' : '司機確認（代登錄）', 'primary']);
  if (active && (can('dispatch.manage') || active.driver_id === S.user.driver_id)) acts.push(['reject', '司機拒單', 'danger']);
  if (active && can('dispatch.manage')) acts.push(['reassign', '改派', '']);
  if (active && active.status === 'ACCEPTED' && (can('dispatch.manage') || active.driver_id === S.user.driver_id)) acts.push(['complete', '回報完成', 'gold']);
  if (can('payment.customer') && o.status !== 'CANCELLED') acts.push(['pay', '登錄客戶付款', '']);
  if (can('payment.confirm') && (f.paid_company > 0 || f.paid_driver > 0)) acts.push(['refund', '退款', '']);
  if (can('ledger.adjust') && ['COMPLETED', 'CANCELLED'].includes(o.status)) acts.push(['adjust', '帳務調整', '']);
  if (can('order.write') && !['COMPLETED', 'CANCELLED'].includes(o.status)) acts.push(['cancel', '取消訂單', 'danger']);
  const commission = done ? f.commission : o.expected_commission_cents;
  const drvShare = done ? f.fare_posted - f.commission + f.tip_posted : o.expected_driver_cents;
  const TABS = [['dispatch', `派車歷史 (${o.dispatches.length})`], ['ledger', `帳本分錄 (${o.ledger.length})`], ['payments', `收付款 (${o.payments.length})`], ...(o.audit.length ? [['audit', `操作紀錄 (${o.audit.length})`]] : [])];
  const tabBody = {
    dispatch: o.dispatches.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>司機</th><th>車輛</th><th>狀態</th><th>指派</th><th>回覆</th><th>原因／備註</th></tr></thead><tbody>
      ${o.dispatches.map((d) => `<tr><td class="num">${d.id}</td><td>${esc(d.driver_name)}</td><td class="small">${esc(d.plate_no || '—')}</td><td>${statusChip(d.status)}</td>
      <td class="small">${fmtLocalDateTime(d.assigned_at)}<br>${esc(d.assigned_by_name || '')}</td><td class="small">${d.responded_at ? fmtLocalDateTime(d.responded_at) + '<br>' + esc(d.responded_by_name || '') : '—'}</td><td class="small">${esc(d.reason || d.note || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">尚未派車</div>',
    ledger: o.ledger.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>類型</th><th class="r">金額</th><th class="r">客戶應付Δ</th><th class="r">公司應付司機Δ</th><th class="r">佣金Δ</th><th>司機</th><th>說明</th><th>時間／人員</th></tr></thead><tbody>
      ${o.ledger.map((l) => `<tr><td class="num">${l.id}</td><td>${t('le.' + l.entry_type)}${l.commissionable ? ' <span class="chip gold">抽佣</span>' : ''}</td><td class="r">${signed(l.amount_cents)}</td><td class="r">${signed(l.customer_due_delta)}</td><td class="r">${signed(l.driver_bal_delta)}</td><td class="r">${signed(l.revenue_delta)}</td><td class="small">${esc(l.driver_name || '—')}</td><td class="small">${esc(l.memo || '')}</td><td class="small">${fmtLocalDateTime(l.created_at)}<br>${esc(l.created_by_name || 'system')}</td></tr>`).join('')}
      <tr><td></td><td><b>合計</b></td><td></td><td class="r"><b>${signed(f.customer_due)}</b></td><td class="r"><b>${signed(f.driver_balance)}</b></td><td class="r"><b>${signed(f.revenue)}</b></td><td colspan="3"></td></tr>
      </tbody></table></div><div class="small muted">帳本只增不改；更正以「沖回」或調整分錄處理。公司應付司機Δ 為負值＝司機應繳公司。</div>` : '<div class="empty">尚無分錄（完成接送後自動入帳車資、小費與佣金）</div>',
    payments: o.payments.length ? `<div class="table-wrap"><table><thead><tr><th>單號</th><th>類型</th><th>收/退方</th><th>方式</th><th class="r">金額</th><th>狀態</th><th>參考</th><th></th></tr></thead><tbody>
      ${o.payments.map((p) => `<tr><td class="num small">${p.payment_no}</td><td>${p.kind === 'CUSTOMER_REFUND' ? '退款' : '付款'}</td><td>${p.party === 'DRIVER' ? '司機' : '公司'}</td><td>${t('m.' + p.method)}</td><td class="r">${usd(p.amount_cents)}</td>
        <td><span class="chip ${{ PENDING: 'warn', CONFIRMED: 'ok', VOID: '' }[p.status]}">${t('pay.' + p.status)}</span></td><td class="small">${esc(p.reference || p.note || '')}${p.void_reason ? '<br>作廢：' + esc(p.void_reason) : ''}</td>
        <td>${can('payment.confirm') && p.status === 'PENDING' ? `<button class="btn small primary" data-confirm-pay="${p.id}">確認到帳</button>` : ''} ${can('payment.confirm') && p.status !== 'VOID' && p.kind === 'CUSTOMER_PAYMENT' ? `<button class="btn small danger" data-void-pay="${p.id}" data-no="${p.payment_no}">作廢</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">尚無收付款紀錄</div>',
    audit: `<div class="list">${o.audit.map(auditRow).join('')}</div>`,
  };
  const close = openSheet({
    title: `${o.order_no}`,
    body: `
      <div style="display:flex;flex-wrap:wrap;gap:6px">${statusChip(o.status)} ${payChip(o.payment_status)} <span class="chip ${o.collector === 'DRIVER' ? 'gold' : ''}">${t('col.' + o.collector)}・${t('m.' + o.payment_method)}</span></div>
      ${o.dst_ambiguous ? `<div class="warnbox">此訂單時間落在夏令時間結束的重疊時段（01:00–01:59 出現兩次），目前認定為 ${o.pickup_utc_offset === -420 ? '較早一次（PDT）' : '較晚一次（PST）'}，請與客戶確認航班時間。</div>` : ''}
      ${o.status === 'CANCELLED' ? `<div class="infobox">已取消：${esc(o.cancel_reason || '')}</div>` : ''}
      <dl class="kv">
        <dt>接送時間</dt><dd><b>${o.pickup_local_date} ${o.pickup_local_time} ${o.pickup_utc_offset === -420 ? 'PDT' : 'PST'}</b> <span class="small muted">（UTC ${o.pickup_at_utc.slice(0, 16).replace('T', ' ')}）</span></dd>
        <dt>客戶</dt><dd>${esc(o.customer_name)} <span class="muted small">${o.customer_no}</span></dd>
        <dt>聯絡</dt><dd>${esc(o.contact_name)} ${esc(o.contact_phone || '')}・來源 ${t('src.' + o.source)}</dd>
        <dt>行程</dt><dd>${t('trip.' + o.trip_type)}・${o.airport}${o.flight_no ? '・航班 ' + esc(o.flight_no) : ''}</dd>
        <dt>上車</dt><dd>${esc(o.pickup_address)}</dd><dt>下車</dt><dd>${esc(o.dropoff_address)}</dd>
        <dt>人數／行李</dt><dd>${o.passengers} 人・${o.luggage} 件・${t('veh.' + o.vehicle_type)}</dd>
        <dt>司機</dt><dd>${o.driver_name ? esc(o.driver_name) + ' ' + o.driver_no : '—'}</dd>
        ${o.notes ? `<dt>備註</dt><dd>${esc(o.notes)}</dd>` : ''}
      </dl>
      <div class="fin">
        <div><div class="lbl">${done ? '入帳車資' : '報價車資'}</div>${usd(done ? f.fare_posted : o.fare_cents)}</div>
        <div><div class="lbl">小費（100% 歸司機）</div>${usd(done ? f.tip_posted : o.tip_cents)}</div>
        <div><div class="lbl">平台佣金 ${o.commission_rate_bps / 100}%${done ? '' : '（預估）'}</div>${usd(commission)}</div>
        <div><div class="lbl">司機應得</div>${usd(drvShare)}</div>
        <div><div class="lbl">已收款（已確認）</div>${usd(f.paid_net)}</div>
        <div><div class="lbl">${f.customer_due < 0 ? '預收（尚未入帳車資）' : '客戶未付'}</div>${usd(Math.abs(f.customer_due))}</div>
        ${f.pending_payments ? `<div><div class="lbl">待確認到帳</div>${usd(f.pending_payments)}</div>` : ''}
        <div><div class="lbl">${f.driver_balance >= 0 ? '公司應付司機' : '司機應繳公司'}</div>${usd(Math.abs(f.driver_balance))}</div>
      </div>
      ${o.commission_base_cents !== o.fare_cents ? `<div class="small muted">佣金計算基礎：${fmtUSD(o.commission_base_cents)}（車資中 ${fmtUSD(o.fare_cents - o.commission_base_cents)} 不抽佣）</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px">${acts.map(([k, label, cls]) => `<button class="btn ${cls}" data-act="${k}">${label}</button>`).join('')}</div>
      <div class="tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tab-body">${tabBody[tab]}</div>`,
    onMount: (el, closeIt) => {
      const reopen = (tb) => { closeIt(); refresh(); orderDetail(id, tb); };
      $$('[data-tab]', el).forEach((b) => { b.onclick = () => { $$('[data-tab]', el).forEach((x) => x.classList.toggle('on', x === b)); $('#tab-body', el).innerHTML = tabBody[b.dataset.tab]; bindTab(); }; });
      const bindTab = () => {
        $$('[data-confirm-pay]', el).forEach((b) => { b.onclick = async () => { if (await confirmDialog({ message: '確認此筆款項<b>已實際到帳</b>？確認後計入已收並寫入帳本。', confirmText: '確認到帳' })) { try { await POST(`/api/payments/${b.dataset.confirmPay}/confirm`); toast('已確認到帳'); reopen('payments'); } catch (e) { toast(e.message, true); } } }; });
        $$('[data-void-pay]', el).forEach((b) => { b.onclick = () => formSheet({ title: '作廢款項 ' + b.dataset.no, danger: true, submitText: '作廢', fields: `<div class="warnbox full">已確認的款項作廢時，系統會寫入反向「沖回」分錄，原分錄保留。</div>${field('作廢原因', '<input name="reason" id="f-void-reason">', { req: true, full: true })}`, submit: async (fd) => { await POST(`/api/payments/${b.dataset.voidPay}/void`, fd); toast('已作廢'); reopen('payments'); } }); });
      };
      bindTab();
      const H = {
        edit: () => { closeIt(); orderForm(o); },
        assign: () => { closeIt(); assignSheet(id); },
        accept: async () => { if (await confirmDialog({ message: `確認 ${esc(active.driver_name)} 已接受 ${o.order_no}？${S.user.role_code === 'DRIVER' ? '' : '<br><span class="small muted">將記錄為由您代為登錄。</span>'}`, confirmText: '確認接單' })) { try { await POST(`/api/dispatches/${active.id}/accept`); toast('已確認接單'); reopen('dispatch'); } catch (e) { toast(e.message, true); } } },
        reject: () => formSheet({ title: `拒單：${o.order_no}`, danger: true, submitText: '確認拒單', fields: `<div class="infobox full">拒單後訂單回到「待派車」，派車歷史會保留這筆紀錄。</div>${field('拒單原因', '<input name="reason" id="f-rej" placeholder="例：車輛維修、時間衝突">', { req: true, full: true })}`, submit: async (fd) => { await POST(`/api/dispatches/${active.id}/reject`, fd); toast('已登錄拒單，訂單回到待派車'); reopen('dispatch'); } }),
        reassign: () => { closeIt(); assignSheet(id, true); },
        complete: () => completeSheet(o, () => reopen('ledger')),
        pay: () => paymentSheet(o, () => reopen('payments')),
        refund: () => refundSheet(o, () => reopen('payments')),
        adjust: () => adjustSheet(o, () => reopen('ledger')),
        cancel: () => formSheet({ title: `取消訂單 ${o.order_no}`, danger: true, submitText: '確認取消', fields: `<div class="warnbox full">取消後無法復原；有效派車會一併取消。若客戶已預付，系統會提示應退金額，退款需由會計執行。</div>${field('取消原因', '<input name="reason" id="f-cancel-reason">', { req: true, full: true })}`, submit: async (fd) => { const r = await POST(`/api/orders/${id}/cancel`, fd); toast(r.needs_refund_cents ? `已取消，應退客戶 ${fmtUSD(r.needs_refund_cents)}` : '已取消訂單'); reopen('payments'); } }),
      };
      $$('[data-act]', el).forEach((b) => { b.onclick = () => H[b.dataset.act](); });
    },
  });
  void close;
}

function completeSheet(o, after) {
  const col = o.collector === 'DRIVER';
  formSheet({
    title: `回報完成：${o.order_no}`, submitText: '確認完成並入帳',
    fields: `
      <div class="infobox full">完成後系統自動寫入：車資、小費（100% 歸司機）、平台佣金 15%。完成後的金額更正請改用「帳務調整」。</div>
      ${field('實收車資', money('fare', o.fare_cents), { req: true })}
      ${field('小費', money('tip', o.tip_cents))}
      ${field('車資與報價不同的原因', '<input name="reason" id="f-c-reason">', { full: true, hint: '車資與報價相同時免填' })}
      ${col ? `<fieldset><legend>司機現場收款</legend>
        ${field('司機實際向客戶收取', money('collected', null), { hint: '只填實際收到的金額；未收到請留空' })}
        ${field('方式', `<select name="method" id="f-c-method">${opt(ENUM.method, o.payment_method, 'm.')}</select>`)}
        <button type="button" class="btn small" id="fill-full">填入全額 ${fmtUSD(o.fare_cents + o.tip_cents)}</button></fieldset>` : ''}
      <label class="check full"><input type="checkbox" name="confirm" id="f-c-confirm"> 我確認接送已完成，金額正確</label>`,
    onMount: (el) => { const b = $('#fill-full', el); if (b) b.onclick = () => { $('#f-collected', el).value = centsToInput(toCents($('#f-fare', el).value) + toCents($('#f-tip', el).value)); }; },
    submit: async (fd) => {
      if (!fd.confirm) throw new Error('請勾選確認');
      await POST(`/api/orders/${o.id}/complete`, { fare_cents: toCents(fd.fare), tip_cents: toCents(fd.tip), reason: fd.reason, driver_collected_cents: fd.collected ? toCents(fd.collected) : 0, method: fd.method });
      toast('已完成並入帳'); after();
    },
  });
}
function paymentSheet(o, after) {
  const f = o.finance;
  const due = o.status === 'COMPLETED' ? f.customer_due : o.fare_cents + o.tip_cents - f.paid_net;
  formSheet({
    title: `登錄客戶付款：${o.order_no}`, submitText: '登錄付款',
    fields: `
      <div class="infobox full">應收餘額 ${fmtUSD(Math.max(0, due))}。只登錄<b>實際收到</b>的款項；尚未到帳的轉帳請選「待確認到帳」，不會計入已收。${can('payment.confirm') ? '' : '<br>您的角色登錄非現金款項時，系統會自動列為待確認，由會計確認到帳。'}</div>
      ${field('收款方', `<select name="party" id="f-p-party">${opt(o.current_driver_id ? ENUM.collector : ['COMPANY'], o.collector, 'col.')}</select>`)}
      ${field('方式', `<select name="method" id="f-p-method">${opt(ENUM.method, o.payment_method, 'm.')}</select>`)}
      ${field('金額', money('amount', due > 0 ? due : null), { req: true })}
      ${field('款項狀態', `<select name="status" id="f-p-status"><option value="CONFIRMED">已實際收到</option><option value="PENDING">待確認到帳</option></select>`)}
      ${field('參考號／備註', '<input name="reference" id="f-p-ref" placeholder="Zelle 交易碼、收據號">', { full: true })}`,
    submit: async (fd) => {
      await POST(`/api/orders/${o.id}/payments`, { party: fd.party, method: fd.method, amount_cents: toCents(fd.amount), status: fd.status, reference: fd.reference });
      toast('已登錄付款'); after();
    },
  });
}
function refundSheet(o, after) {
  const f = o.finance;
  formSheet({
    title: `退款：${o.order_no}`, danger: true, submitText: '執行退款',
    fields: `
      <div class="warnbox full">已收淨額：公司 ${fmtUSD(f.paid_company)}、司機 ${fmtUSD(f.paid_driver)}。退款不可超過該方已收金額。原型不串接金流，此處僅登錄已執行的退款。</div>
      ${field('退款方', `<select name="party" id="f-r-party">${opt(ENUM.collector.filter((c) => (c === 'COMPANY' ? f.paid_company : f.paid_driver) > 0), 'COMPANY', 'col.')}</select>`)}
      ${field('方式', `<select name="method" id="f-r-method">${opt(ENUM.method, o.payment_method, 'm.')}</select>`)}
      ${field('退款金額', money('amount', null), { req: true })}
      ${field('退款原因', '<input name="reason" id="f-r-reason">', { req: true, full: true })}
      ${o.status === 'COMPLETED' ? '<label class="check full"><input type="checkbox" name="reduce_fare" id="f-r-reduce" checked> 同時沖減車資（佣金依新車資重算；不勾＝只退款、車資不變）</label>' : ''}
      <label class="check full"><input type="checkbox" name="ok" id="f-r-ok"> 我確認款項已實際退回客戶</label>`,
    submit: async (fd) => {
      if (!fd.ok) throw new Error('請勾選確認');
      await POST(`/api/orders/${o.id}/refunds`, { party: fd.party, method: fd.method, amount_cents: toCents(fd.amount), reason: fd.reason, reduce_fare: !!fd.reduce_fare });
      toast('已登錄退款'); after();
    },
  });
}
function adjustSheet(o, after) {
  formSheet({
    title: `帳務調整：${o.order_no}`, submitText: '寫入分錄',
    fields: `
      ${field('類型', `<select name="type" id="f-a-type"><option value="EXTRA">額外費用（向客戶加收）</option><option value="FARE_ADJUST">車資調整（可正可負，抽佣）</option><option value="ADJUSTMENT">司機帳務調整（公司↔司機）</option></select>`, { full: true })}
      ${field('金額', money('amount', null), { req: true, hint: '負數請加「-」，例如 -5.00' })}
      <label class="check" id="comm-wrap"><input type="checkbox" name="commissionable" id="f-a-comm"> 額外費用需抽佣 15%</label>
      ${field('原因', '<input name="reason" id="f-a-reason" placeholder="例：等候 30 分鐘、代墊停車費">', { req: true, full: true })}
      <div class="small muted full">分錄寫入後不可修改或刪除，更正需再做一筆反向調整；所有調整會記錄在操作紀錄。</div>
      <label class="check full"><input type="checkbox" name="confirm" id="f-a-confirm"> 我確認此筆帳務調整正確</label>`,
    onMount: (el) => { const s = $('#f-a-type', el); const w = $('#comm-wrap', el); s.onchange = () => { w.hidden = s.value !== 'EXTRA'; }; },
    submit: async (fd) => {
      await POST(`/api/orders/${o.id}/ledger`, { type: fd.type, amount_cents: toCents(fd.amount), commissionable: !!fd.commissionable, reason: fd.reason, confirm: !!fd.confirm });
      toast('已寫入帳本'); after();
    },
  });
}

// =====================================================================
// P04 司機派遣中心
// =====================================================================
async function drivers(force = false) {
  if (!S.drivers || force) S.drivers = await GET('/api/drivers', { all: '1' });
  return S.drivers;
}
async function assignSheet(orderId, reassign = false) {
  const [o, ds] = await Promise.all([GET('/api/orders/' + orderId), drivers(true)]);
  const active = ds.filter((d) => d.status === 'ACTIVE' && d.id !== o.current_driver_id);
  const prev = o.dispatches.filter((d) => d.status === 'REJECTED').map((d) => d.driver_id);
  formSheet({
    title: `${reassign ? '改派' : '派車'}：${o.order_no}`, submitText: reassign ? '確認改派' : '指派司機',
    fields: `
      <div class="infobox full"><b>${md(o.pickup_local_date)} ${o.pickup_local_time}</b>・${t('trip.' + o.trip_type)} ${o.airport}${o.flight_no ? ' ' + esc(o.flight_no) : ''} ⇄ ${esc(o.area)}・${o.passengers} 人 ${o.luggage} 件・需 ${t('veh.' + o.vehicle_type)}</div>
      ${reassign ? `<div class="warnbox full">目前司機 ${esc(o.driver_name || '')} 的派車將標記為「已取消（改派）」，歷史保留。</div>` : ''}
      ${field('司機', `<select name="driver_id" id="f-d-driver">${active.map((d) => `<option value="${d.id}">${esc(d.name)}（${d.driver_no}）${d.vehicles[0] ? '・' + t('veh.' + d.vehicles[0].vehicle_type) + ' ' + d.vehicles[0].seats + '座' : ''}・進行中 ${d.active_jobs}${prev.includes(d.id) ? '・曾拒此單' : ''}</option>`).join('')}</select>`, { req: true, full: true })}
      ${field('車輛', '<select name="vehicle_id" id="f-d-vehicle"></select>', { full: true })}
      ${field(reassign ? '改派原因' : '派車備註', `<input name="${reassign ? 'reason' : 'note'}" id="f-d-note">`, { req: reassign, full: true })}
      <label class="check full" data-force hidden><input type="checkbox" name="force" id="f-d-force"> 忽略時間衝突，仍要指派</label>`,
    onMount: (el) => {
      const sel = $('#f-d-driver', el);
      const vs = $('#f-d-vehicle', el);
      const fill = () => { const d = active.find((x) => x.id === +sel.value); vs.innerHTML = (d?.vehicles || []).map((v) => `<option value="${v.id}">${esc(v.plate_no)} ${esc(v.make_model)}（${v.seats} 座／行李 ${v.luggage_capacity}）</option>`).join('') + '<option value="">不指定車輛</option>'; };
      sel.onchange = fill; fill();
    },
    submit: async (fd) => {
      const body = { driver_id: +fd.driver_id, vehicle_id: fd.vehicle_id ? +fd.vehicle_id : null, note: fd.note, reason: fd.reason, force: !!fd.force };
      await POST(`/api/orders/${orderId}/${reassign ? 'reassign' : 'assign'}`, body);
      toast(reassign ? '已改派，等待新司機確認' : '已指派，等待司機確認');
      refresh();
    },
  });
}
VIEWS.dispatch = async (main) => {
  if (S.user.role_code === 'DRIVER') return myTasks(main);
  const tab = ui.dispatchTab;
  const TABS = [['pending', t('pending')], ['awaiting', t('awaiting')], ['accepted', '已接單・待完成'], ['drivers', '司機資料庫'], ['history', '派單歷史']];
  let body = '';
  const today = todayLocal();
  if (['pending', 'awaiting', 'accepted'].includes(tab)) {
    const status = { pending: 'PENDING_DISPATCH', awaiting: 'ASSIGNED', accepted: 'ACCEPTED' }[tab];
    const list = await GET('/api/orders', { status, date_from: tab === 'accepted' ? '' : today });
    const hist = tab === 'pending' ? [] : await GET('/api/dispatches', { status: tab === 'awaiting' ? 'ASSIGNED' : 'ACCEPTED' });
    body = `<div class="list">${list.map((o) => {
      const d = hist.find((h) => h.order_id === o.id);
      return `<div class="row" data-order="${o.id}">
        <div class="l1"><span class="when">${md(o.pickup_local_date)} ${o.pickup_local_time}</span>${statusChip(o.status)}<span class="chip">${t('trip.' + o.trip_type)} ${o.airport}${o.flight_no ? ' ' + esc(o.flight_no) : ''}</span>${o.dst_ambiguous ? '<span class="chip warn">DST 待確認</span>' : ''}<span class="amt">${fmtUSD(o.fare_cents)}</span></div>
        <div class="l2"><span class="no">${o.order_no}</span><span>${esc(o.customer_name)}</span><span>⇄ ${esc(o.area)}</span><span>${o.passengers} 人・${o.luggage} 件・${t('veh.' + o.vehicle_type)}</span><span>${t('col.' + o.collector)}</span>${o.driver_name ? `<span>司機 <b>${esc(o.driver_name)}</b></span>` : ''}</div>
        <div class="acts">
          ${tab === 'pending' ? `<button class="btn small primary" data-assign="${o.id}">派車</button>` : ''}
          ${tab === 'awaiting' && d ? `<button class="btn small primary" data-accept="${d.id}">司機確認（代登錄）</button><button class="btn small danger" data-reject="${d.id}">拒單</button><button class="btn small" data-reassign="${o.id}">改派</button>` : ''}
          ${tab === 'accepted' && d ? `<button class="btn small gold" data-complete="${o.id}">回報完成</button><button class="btn small" data-reassign="${o.id}">改派</button><button class="btn small danger" data-reject="${d.id}">司機退單</button>` : ''}
        </div></div>`;
    }).join('') || '<div class="empty">沒有訂單</div>'}</div>`;
  } else if (tab === 'drivers') {
    const ds = await drivers(true);
    body = `<div class="toolbar"><button class="btn gold" id="new-driver">＋ 新增司機</button></div>
      <div class="table-wrap"><table><thead><tr><th>司機</th><th>電話</th><th>車輛</th><th class="r">進行中</th><th class="r">公司應付司機</th><th class="r">司機應繳公司</th><th>狀態</th><th></th></tr></thead><tbody>
      ${ds.map((d) => `<tr><td><b>${esc(d.name)}</b> <span class="muted small">${d.driver_no}</span></td><td class="small">${esc(d.phone)}</td><td class="small">${d.vehicles.map((v) => `${esc(v.plate_no)} ${esc(v.make_model)}・${t('veh.' + v.vehicle_type)} ${v.seats}座`).join('<br>') || '—'}</td>
      <td class="r num">${d.active_jobs}</td><td class="r money">${fmtUSD(d.payable_cents)}</td><td class="r money">${fmtUSD(d.receivable_cents)}</td><td>${d.status === 'ACTIVE' ? '<span class="chip ok">在職</span>' : '<span class="chip">停用</span>'}</td>
      <td><button class="btn small" data-edit-driver="${d.id}">編輯</button></td></tr>`).join('')}</tbody></table></div>`;
  } else {
    const ds = await drivers();
    const h = ui.history;
    const list = await GET('/api/dispatches', h);
    body = `<div class="toolbar"><select id="h-driver"><option value="">全部司機</option>${ds.map((d) => `<option value="${d.id}" ${String(d.id) === h.driver_id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
      <select id="h-status"><option value="">全部狀態</option>${opt(['ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'], h.status, 'st.')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>訂單</th><th>接送</th><th>司機</th><th>狀態</th><th>指派時間／人員</th><th>原因</th></tr></thead><tbody>
      ${list.map((d) => `<tr class="click" data-order="${d.order_id}"><td class="num">${d.id}</td><td class="num">${d.order_no}</td><td class="small">${md(d.pickup_local_date)} ${d.pickup_local_time}<br>${d.airport} ⇄ ${esc(d.area)}</td><td>${esc(d.driver_name)}</td><td>${statusChip(d.status)}</td><td class="small">${fmtLocalDateTime(d.assigned_at)}<br>${esc(d.assigned_by_name || '')}</td><td class="small">${esc(d.reason || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">沒有紀錄</td></tr>'}
      </tbody></table></div>`;
  }
  main.innerHTML = `${head('P04', t('p04'))}<div class="tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-dtab="${k}">${l}</button>`).join('')}</div>${body}`;
  $$('[data-dtab]', main).forEach((b) => { b.onclick = () => { ui.dispatchTab = b.dataset.dtab; refresh(); }; });
  bindOrderRows(main);
  bindDispatchButtons(main);
  $('#new-driver', main)?.addEventListener('click', () => driverForm());
  $$('[data-edit-driver]', main).forEach((b) => { b.onclick = () => driverForm(S.drivers.find((d) => d.id === +b.dataset.editDriver)); });
  $('#h-driver', main)?.addEventListener('change', (e) => { ui.history.driver_id = e.target.value; refresh(); });
  $('#h-status', main)?.addEventListener('change', (e) => { ui.history.status = e.target.value; refresh(); });
};
function bindDispatchButtons(main) {
  $$('[data-accept]', main).forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); if (await confirmDialog({ message: '確認司機已接受此任務？', confirmText: '確認接單' })) { try { await POST(`/api/dispatches/${b.dataset.accept}/accept`); toast('已確認接單'); refresh(); } catch (er) { toast(er.message, true); } } }; });
  $$('[data-reject]', main).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); formSheet({ title: '拒單／退單', danger: true, submitText: '確認', fields: `<div class="infobox full">訂單會回到「待派車」，此筆派車保留在歷史紀錄。</div>${field('原因', '<input name="reason" id="f-rej2">', { req: true, full: true })}`, submit: async (fd) => { await POST(`/api/dispatches/${b.dataset.reject}/reject`, fd); toast('已登錄，訂單回到待派車'); refresh(); } }); }; });
  $$('[data-reassign]', main).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); assignSheet(+b.dataset.reassign, true); }; });
  $$('[data-complete]', main).forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); const o = await GET('/api/orders/' + b.dataset.complete); completeSheet(o, refresh); }; });
}
async function myTasks(main) {
  const list = await GET('/api/dispatches', {});
  const live = list.filter((d) => ['ASSIGNED', 'ACCEPTED'].includes(d.status));
  const past = list.filter((d) => !['ASSIGNED', 'ACCEPTED'].includes(d.status)).slice(0, 20);
  const card = (d) => `<div class="row" data-order="${d.order_id}"><div class="l1"><span class="when">${md(d.pickup_local_date)} ${d.pickup_local_time}</span>${statusChip(d.status)}<span class="chip">${t('trip.' + d.trip_type)} ${d.airport}</span><span class="no small">${d.order_no}</span></div>
    <div class="l2"><span>⇄ ${esc(d.area)}</span><span>${esc(d.plate_no || '')}</span></div>
    <div class="acts">${d.status === 'ASSIGNED' ? `<button class="btn small primary" data-accept="${d.id}">確認接單</button><button class="btn small danger" data-reject="${d.id}">拒單</button>` : ''}${d.status === 'ACCEPTED' ? `<button class="btn small gold" data-complete="${d.order_id}">回報完成</button>` : ''}</div></div>`;
  main.innerHTML = `${head('P04', t('nav.mytasks'))}<section class="card"><h2>進行中任務</h2><div class="list">${live.map(card).join('') || '<div class="empty">目前沒有指派給您的任務</div>'}</div></section>
    <section class="card" style="margin-top:12px"><h2>歷史任務</h2><div class="list">${past.map(card).join('') || '<div class="empty">尚無紀錄</div>'}</div></section>`;
  bindOrderRows(main);
  bindDispatchButtons(main);
}
function driverForm(d = null) {
  formSheet({
    title: d ? `編輯司機 ${d.driver_no}` : '新增司機',
    fields: `${field('姓名', `<input name="name" id="f-dr-name" value="${esc(d?.name || '')}">`, { req: true })}
      ${field('電話', `<input name="phone" id="f-dr-phone" inputmode="tel" value="${esc(d?.phone || '')}">`, { req: true })}
      ${field('駕照號碼', `<input name="license_no" id="f-dr-lic" value="${esc(d?.license_no || '')}">`)}
      ${field('收款方式', `<input name="payout_method" id="f-dr-pay" value="${esc(d?.payout_method || '')}" placeholder="Zelle / Check">`)}
      ${d ? field('狀態', `<select name="status" id="f-dr-status">${opt(['ACTIVE', 'INACTIVE'], d.status)}</select>`) : ''}
      ${field('備註', `<input name="notes" id="f-dr-notes" value="${esc(d?.notes || '')}">`, { full: true })}
      ${d ? '' : `<fieldset><legend>車輛</legend>${field('車牌', '<input name="plate_no" id="f-v-plate">')}${field('車款', '<input name="make_model" id="f-v-model" placeholder="Toyota Sienna 2023">')}
        ${field('車型', `<select name="vehicle_type" id="f-v-type">${opt(ENUM.vehicle, 'SEDAN', 'veh.')}</select>`)}${field('座位', '<input name="seats" id="f-v-seats" type="number" value="4">')}${field('行李容量', '<input name="luggage_capacity" id="f-v-lug" type="number" value="3">')}</fieldset>`}`,
    submit: async (fd) => {
      if (d) await PUT('/api/drivers/' + d.id, fd);
      else await POST('/api/drivers', { ...fd, vehicle: fd.plate_no ? { plate_no: fd.plate_no, make_model: fd.make_model, vehicle_type: fd.vehicle_type, seats: +fd.seats, luggage_capacity: +fd.luggage_capacity } : null });
      toast('已儲存司機資料'); S.drivers = null; refresh();
    },
  });
}

// =====================================================================
// P02 客戶管理 CRM
// =====================================================================
VIEWS.customers = async (main) => {
  const list = await GET('/api/customers', ui.customers);
  main.innerHTML = `${head('P02', t('p02'), can('customer.write') ? `<button class="btn gold" id="new-cust">＋ ${t('new.customer')}</button>` : '')}
    <div class="toolbar"><input type="search" id="c-q" placeholder="搜尋姓名、電話、客戶編號、LINE ID" value="${esc(ui.customers.q)}"></div>
    <div class="small muted" style="margin-bottom:8px">共 ${list.length} 位客戶</div>
    <div class="table-wrap"><table><thead><tr><th>編號</th><th>姓名</th><th>電話</th><th>聯絡管道</th><th>常用地址</th><th class="r">訂單</th><th class="r">累計車資</th><th>最近</th></tr></thead><tbody>
    ${list.map((c) => `<tr class="click" data-cust="${c.id}"><td class="num">${c.customer_no}</td><td><b>${esc(c.name)}</b>${c.notes ? `<div class="small muted">${esc(c.notes)}</div>` : ''}</td><td class="num">${esc(c.phone || '')}</td>
      <td>${t('src.' + c.contact_channel, c.contact_channel)}${c.line_id ? `<div class="small muted">LINE ${esc(c.line_id)}</div>` : ''}</td><td class="small">${esc(c.addresses[0] || '')}${c.addresses.length > 1 ? ` <span class="muted">+${c.addresses.length - 1}</span>` : ''}</td>
      <td class="r num">${c.order_count}${c.order_count >= 2 ? ' <span class="chip gold">回購</span>' : ''}</td><td class="r money">${fmtUSD(c.total_fare_cents)}</td><td class="small">${c.last_order_date ? md(c.last_order_date) : '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">找不到客戶</td></tr>'}
    </tbody></table></div>`;
  let timer;
  $('#c-q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { ui.customers.q = e.target.value; refresh().then(() => { const q = $('#c-q'); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }); }, 300); };
  $('#new-cust', main)?.addEventListener('click', () => customerForm());
  $$('[data-cust]', main).forEach((r) => { r.onclick = () => customerDetail(+r.dataset.cust); });
};
function customerForm(c = null) {
  formSheet({
    title: c ? `編輯客戶 ${c.customer_no}` : t('new.customer'),
    fields: `${field('姓名', `<input name="name" id="f-cu-name" value="${esc(c?.name || '')}">`, { req: true })}
      ${field('電話', `<input name="phone" id="f-cu-phone" inputmode="tel" value="${esc(c?.phone || '')}">`, { hint: '電話不可與其他客戶重複' })}
      ${field('聯絡管道', `<select name="contact_channel" id="f-cu-ch">${opt(ENUM.channel, c?.contact_channel || 'PHONE', 'src.')}</select>`)}
      ${field('LINE ID', `<input name="line_id" id="f-cu-line" value="${esc(c?.line_id || '')}">`)}
      ${field('Email', `<input name="email" id="f-cu-email" type="email" value="${esc(c?.email || '')}">`)}
      ${field('常用地址（一行一個）', `<textarea name="addresses" id="f-cu-addr">${esc((c?.addresses || []).join('\n'))}</textarea>`, { full: true })}
      ${field('備註', `<textarea name="notes" id="f-cu-notes">${esc(c?.notes || '')}</textarea>`, { full: true })}`,
    submit: async (fd) => {
      const r = c ? await PUT('/api/customers/' + c.id, fd) : await POST('/api/customers', fd);
      toast(`已儲存 ${r.customer_no} ${r.name}`); refresh();
    },
  });
}
async function customerDetail(id) {
  const c = await GET('/api/customers/' + id);
  openSheet({
    title: `${esc(c.name)}・${c.customer_no}`,
    body: `<dl class="kv"><dt>電話</dt><dd>${esc(c.phone || '—')}</dd><dt>聯絡管道</dt><dd>${t('src.' + c.contact_channel, c.contact_channel)}${c.line_id ? '・LINE ' + esc(c.line_id) : ''}</dd>
      ${c.email ? `<dt>Email</dt><dd>${esc(c.email)}</dd>` : ''}<dt>常用地址</dt><dd>${c.addresses.map(esc).join('<br>') || '—'}</dd><dt>備註</dt><dd>${esc(c.notes || '—')}</dd></dl>
      <div class="fin"><div><div class="lbl">有效訂單</div><div class="money">${c.order_count}</div></div><div><div class="lbl">累計車資（已入帳）</div>${usd(c.total_fare_cents)}</div><div><div class="lbl">最近接送</div><div class="money">${c.last_order_date || '—'}</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${can('customer.write') ? '<button class="btn" data-edit>編輯客戶</button>' : ''}${can('order.write') ? '<button class="btn gold" data-new>為此客戶建立訂單</button>' : ''}</div>
      <h3 style="font-size:15px">歷史訂單</h3>
      <div class="table-wrap"><table><thead><tr><th>單號</th><th>日期</th><th>行程</th><th class="r">車資</th><th>狀態</th></tr></thead><tbody>
      ${c.orders.map((o) => `<tr class="click" data-order="${o.id}"><td class="num">${o.order_no}</td><td class="small">${o.pickup_local_date} ${o.pickup_local_time}</td><td class="small">${t('trip.' + o.trip_type)} ${o.airport} ⇄ ${esc(o.area)}</td><td class="r money">${fmtUSD(o.fare_cents)}</td><td>${statusChip(o.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">尚無訂單</td></tr>'}
      </tbody></table></div>`,
    onMount: (el, close) => {
      $('[data-edit]', el)?.addEventListener('click', () => { close(); customerForm(c); });
      $('[data-new]', el)?.addEventListener('click', () => { close(); orderForm(null).then(() => { const i = $('#f-cust'); if (i) { i.value = `${c.customer_no} ${c.name}${c.phone ? ' ' + c.phone : ''}`; i.dispatchEvent(new Event('input')); } }); });
      $$('[data-order]', el).forEach((r) => { r.onclick = () => { close(); orderDetail(+r.dataset.order); }; });
    },
  });
}

// =====================================================================
// P05 雙向交易帳本
// =====================================================================
VIEWS.ledger = async (main) => {
  const f = ui.ledger;
  const tab = ui.ledgerTab;
  const [sum, rec] = await Promise.all([GET('/api/ledger/summary', f), GET('/api/reconcile')]);
  const orders = sum.orders;
  const tot = orders.reduce((a, o) => {
    a.charges += o.finance.charges; a.paid += o.finance.paid_net; a.due += Math.max(0, o.status === 'COMPLETED' || o.status === 'CANCELLED' ? o.finance.customer_due : 0);
    a.comm += o.finance.revenue; a.pay += Math.max(0, o.finance.driver_balance); a.rem += Math.max(0, -o.finance.driver_balance); return a;
  }, { charges: 0, paid: 0, due: 0, comm: 0, pay: 0, rem: 0 });
  let body = '';
  if (tab === 'orders') {
    body = `<div class="table-wrap"><table><thead><tr><th>訂單</th><th>日期</th><th>收款方</th><th class="r">應收(車資+小費+費用)</th><th class="r">已收</th><th class="r">客戶未付</th><th class="r">佣金</th><th class="r">公司應付司機</th><th class="r">司機應繳公司</th><th>付款</th></tr></thead><tbody>
      ${orders.map((o) => `<tr class="click" data-order="${o.id}" data-tab="ledger"><td class="num">${o.order_no}<div class="small muted">${esc(o.customer_name)}</div></td><td class="small">${o.pickup_local_date}</td><td>${t('col.' + o.collector)}</td>
        <td class="r money">${fmtUSD(o.finance.charges)}</td><td class="r money">${fmtUSD(o.finance.paid_net)}</td><td class="r money ${o.finance.customer_due > 0 ? 'neg' : ''}">${fmtUSD(Math.max(0, o.finance.customer_due))}</td>
        <td class="r money">${fmtUSD(o.finance.revenue)}</td><td class="r money">${fmtUSD(Math.max(0, o.finance.driver_balance))}</td><td class="r money">${fmtUSD(Math.max(0, -o.finance.driver_balance))}</td><td>${payChip(o.payment_status)}${o.finance.pending_payments ? ' <span class="chip warn">待確認</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">此區間沒有帳務</td></tr>'}
      </tbody></table></div>`;
  } else if (tab === 'pending') {
    body = sum.pending_payments.length ? `<div class="infobox" style="margin-bottom:10px">以下款項已登錄但<b>尚未確認到帳</b>，不計入已收款。請核對銀行／Zelle 紀錄後確認。</div>
      <div class="table-wrap"><table><thead><tr><th>款項</th><th>訂單</th><th>收款方</th><th>方式</th><th class="r">金額</th><th>參考</th><th>登錄時間</th><th></th></tr></thead><tbody>
      ${sum.pending_payments.map((p) => `<tr><td class="num">${p.payment_no}</td><td class="num click" data-order="${p.order_id}" style="cursor:pointer;text-decoration:underline">${p.order_no}</td><td>${p.party === 'DRIVER' ? '司機' : '公司'}</td><td>${t('m.' + p.method)}</td><td class="r money">${fmtUSD(p.amount_cents)}</td><td class="small">${esc(p.reference || '')}</td><td class="small">${fmtLocalDateTime(p.recorded_at)}</td>
        <td>${can('payment.confirm') ? `<button class="btn small primary" data-cp="${p.id}">確認到帳</button>` : '<span class="small muted">需會計確認</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">沒有待確認款項</div>';
  } else {
    const lines = await GET('/api/ledger', f);
    body = `<div class="toolbar"><select id="l-type"><option value="">全部類型</option>${opt(['FARE', 'TIP', 'EXTRA', 'FARE_ADJUST', 'COMMISSION', 'CUSTOMER_PAYMENT', 'CUSTOMER_REFUND', 'ADJUSTMENT', 'SETTLEMENT_PAYOUT', 'SETTLEMENT_REMIT', 'SETTLEMENT_OFFSET', 'REVERSAL'], f.type, 'le.')}</select>
      <button class="btn small" id="l-csv">匯出 CSV</button></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>訂單</th><th>類型</th><th class="r">金額</th><th class="r">客戶應付Δ</th><th class="r">公司應付司機Δ</th><th class="r">佣金Δ</th><th>司機</th><th>說明</th><th>時間／人員</th></tr></thead><tbody>
      ${lines.map((l) => `<tr class="click" data-order="${l.order_id}" data-tab="ledger"><td class="num">${l.id}</td><td class="num">${l.order_no}</td><td>${t('le.' + l.entry_type)}</td><td class="r">${signed(l.amount_cents)}</td><td class="r">${signed(l.customer_due_delta)}</td><td class="r">${signed(l.driver_bal_delta)}</td><td class="r">${signed(l.revenue_delta)}</td><td class="small">${esc(l.driver_name || '—')}</td><td class="small">${esc(l.memo || '')}</td><td class="small">${fmtLocalDateTime(l.created_at)}<br>${esc(l.created_by_name || 'system')}</td></tr>`).join('')}
      </tbody></table></div>`;
    main.dataset.lines = '';
    VIEWS.ledger.lines = lines;
  }
  main.innerHTML = `${head('P05', t('p05'))}
    <div class="toolbar"><label class="small muted">接送日期 <input type="date" id="l-from" value="${f.date_from}"></label><label class="small muted">至 <input type="date" id="l-to" value="${f.date_to}"></label>
      <button class="btn small ghost" id="l-month">本月</button><button class="btn small ghost" id="l-all">全部</button>
      <span class="chip ${rec.balanced ? 'ok' : 'bad'}" title="公司現金 − 公司應付司機淨額 ＝ 佣金收入 − 客戶未付 − 帳務調整">全系統對帳 ${rec.balanced ? '平衡' : '不平衡'}</span></div>
    <div class="kpis">
      <div class="kpi"><div class="lbl">應收（已入帳）</div><div class="val">${fmtUSD(tot.charges)}</div></div>
      <div class="kpi"><div class="lbl">已收（已確認）</div><div class="val">${fmtUSD(tot.paid)}</div></div>
      <div class="kpi ${tot.due ? 'bad' : ''}"><div class="lbl">客戶未付</div><div class="val">${fmtUSD(tot.due)}</div></div>
      <div class="kpi accent"><div class="lbl">平台佣金</div><div class="val">${fmtUSD(tot.comm)}</div></div>
      <div class="kpi"><div class="lbl">公司應付司機</div><div class="val">${fmtUSD(tot.pay)}</div><div class="hint">公司收款：車資 85%＋代收小費</div></div>
      <div class="kpi"><div class="lbl">司機應繳公司</div><div class="val">${fmtUSD(tot.rem)}</div><div class="hint">司機收款：車資 15%</div></div>
      <div class="kpi"><div class="lbl">待確認到帳</div><div class="val">${fmtUSD(sum.pending_payments.reduce((s, p) => s + p.amount_cents, 0))}</div><div class="hint">${sum.pending_payments.length} 筆，不計入已收</div></div>
      <div class="kpi"><div class="lbl">金額規則</div><div class="val" style="font-size:15px">整數美分・四捨五入</div><div class="hint">0.5 美分遠離零進位</div></div>
    </div>
    <div class="tabs">${[['orders', '訂單帳務'], ['pending', `待確認款項 (${sum.pending_payments.length})`], ['lines', '分錄明細']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-ltab="${k}">${l}</button>`).join('')}</div>
    ${body}`;
  $$('[data-ltab]', main).forEach((b) => { b.onclick = () => { ui.ledgerTab = b.dataset.ltab; refresh(); }; });
  $('#l-from').onchange = (e) => { f.date_from = e.target.value; refresh(); };
  $('#l-to').onchange = (e) => { f.date_to = e.target.value; refresh(); };
  $('#l-month').onclick = () => { const td = todayLocal(); f.date_from = td.slice(0, 8) + '01'; f.date_to = td; refresh(); };
  $('#l-all').onclick = () => { f.date_from = ''; f.date_to = ''; refresh(); };
  $('#l-type', main)?.addEventListener('change', (e) => { f.type = e.target.value; refresh(); });
  $('#l-csv', main)?.addEventListener('click', () => downloadCsv(`ledger-${todayLocal()}.csv`, [['id', 'order_no', 'pickup_date', 'type', 'amount_usd', 'customer_due_delta', 'company_owes_driver_delta', 'commission_delta', 'driver', 'memo', 'created_at_utc'],
    ...VIEWS.ledger.lines.map((l) => [l.id, l.order_no, l.pickup_local_date, l.entry_type, centsToInput(l.amount_cents), centsToInput(l.customer_due_delta), centsToInput(l.driver_bal_delta), centsToInput(l.revenue_delta), l.driver_name || '', l.memo || '', l.created_at])]));
  $$('[data-cp]', main).forEach((b) => { b.onclick = async () => { if (await confirmDialog({ message: '確認此筆款項<b>已實際到帳</b>？', confirmText: '確認到帳' })) { try { await POST(`/api/payments/${b.dataset.cp}/confirm`); toast('已確認到帳'); refresh(); } catch (e) { toast(e.message, true); } } }; });
  $$('[data-order]', main).forEach((r) => { r.onclick = () => orderDetail(+r.dataset.order, r.dataset.tab || 'payments'); });
};

// =====================================================================
// P06 司機結算中心
// =====================================================================
VIEWS.settlements = async (main) => {
  const s = ui.settle;
  const isDriver = S.user.role_code === 'DRIVER';
  const ds = isDriver ? [] : await drivers();
  if (!s.date_from) { const w = weekRange(todayLocal()); s.date_from = addDays(w.from, -7); s.date_to = todayLocal(); }
  if (isDriver) { s.driver_id = String(S.user.driver_id); s.tab = s.tab === 'new' ? 'open' : s.tab; }
  if (!s.driver_id && ds.length) s.driver_id = String(ds[0].id);
  const tab = s.tab;
  let body = '';
  if (tab === 'new' || tab === 'open') {
    const items = await GET('/api/settlements/open-items', { driver_id: s.driver_id, date_from: s.date_from, date_to: s.date_to });
    const sel = new Set(items.filter((i) => !i.in_settlement && !i.customer_outstanding_cents).map((i) => i.order_id));
    const canWrite = can('settlement.write') && tab === 'new';
    body = `
      <div class="small muted" style="margin-bottom:8px">依接送日期列出此司機尚未結清的訂單。<b>不會自動抵銷</b>：公司應付與司機應繳分開計算，需老闆明確授權才可淨額抵銷。客戶未付清的訂單預設不勾選。</div>
      <div class="table-wrap"><table><thead><tr>${canWrite ? '<th><input type="checkbox" id="sel-all" aria-label="全選"></th>' : ''}<th>訂單</th><th>日期</th><th>收款方</th><th class="r">車資</th><th class="r">小費</th><th class="r">佣金</th><th>方向</th><th class="r">金額</th><th>備註</th></tr></thead><tbody>
      ${items.map((i) => `<tr>${canWrite ? `<td><input type="checkbox" data-item="${i.order_id}" ${sel.has(i.order_id) ? 'checked' : ''} ${i.in_settlement ? 'disabled' : ''} aria-label="選取 ${i.order_no}"></td>` : ''}
        <td class="num">${i.order_no}</td><td class="small">${i.pickup_local_date}</td><td>${t('col.' + i.collector)}</td><td class="r money">${fmtUSD(i.fare_cents)}</td><td class="r money">${fmtUSD(i.tip_cents)}</td><td class="r money">${fmtUSD(i.commission_cents)}</td>
        <td>${i.direction === 'PAYABLE' ? '<span class="chip info">公司付司機</span>' : '<span class="chip gold">司機繳公司</span>'}</td><td class="r money" data-amt="${i.order_id}" data-dir="${i.direction}" data-v="${i.amount_cents}">${fmtUSD(i.amount_cents)}</td>
        <td class="small">${i.in_settlement ? `已在 ${i.in_settlement}` : ''}${i.customer_outstanding_cents ? `<span class="chip warn">客戶未付 ${fmtUSD(i.customer_outstanding_cents)}</span>` : ''}</td></tr>`).join('') || `<tr><td colspan="10" class="muted">此司機在此期間沒有未結清項目</td></tr>`}
      </tbody></table></div>
      ${canWrite && items.length ? `<div class="card" style="margin-top:12px;display:grid;gap:10px">
        <div class="fin" id="sel-sum"></div>
        ${can('settlement.offset_authorize') ? `<label class="check"><input type="checkbox" id="off-on"> 啟用淨額抵銷（公司應付與司機應繳互抵，只付差額）</label>
        <div id="off-box" hidden style="display:grid;gap:8px"><div class="warnbox">抵銷會在雙方訂單上寫入「授權抵銷」分錄，並記錄授權人與說明。</div>
          ${field('授權說明（例：司機書面／LINE 同意本週互抵）', '<input id="off-note">')}
          <label class="check"><input type="checkbox" id="off-auth"> 我以老闆身分明確授權本結算單的淨額抵銷</label></div>` : '<div class="small muted">淨額抵銷需老闆授權；會計只能建立不抵銷的結算單。</div>'}
        <div><button class="btn primary" id="mk-settle">建立結算單</button> <button class="btn" id="open-csv">匯出未結清清單 CSV</button></div></div>` : ''}`;
    VIEWS.settlements.items = items;
  } else {
    const list = await GET('/api/settlements', { driver_id: isDriver ? '' : (s.listAll ? '' : s.driver_id), status: s.status });
    body = `<div class="toolbar"><select id="s-status"><option value="">全部狀態</option>${opt(['OPEN', 'PARTIAL', 'SETTLED', 'VOID'], s.status, 'sst.')}</select>
      ${isDriver ? '' : `<label class="check"><input type="checkbox" id="s-all" ${s.listAll ? 'checked' : ''}> 顯示全部司機</label>`}<button class="btn small" id="s-csv">匯出 CSV</button></div>
      <div class="table-wrap"><table><thead><tr><th>結算單</th><th>司機</th><th>期間</th><th class="r">公司應付</th><th class="r">司機應繳</th><th class="r">授權抵銷</th><th class="r">已付司機</th><th class="r">已收司機</th><th>狀態</th></tr></thead><tbody>
      ${list.map((x) => `<tr class="click" data-st="${x.id}"><td class="num">${x.settlement_no}<div class="small muted">${x.item_count} 筆</div></td><td>${esc(x.driver_name)}</td><td class="small">${x.period_from}<br>～${x.period_to}</td><td class="r money">${fmtUSD(x.payable_cents)}</td><td class="r money">${fmtUSD(x.receivable_cents)}</td><td class="r money">${fmtUSD(x.offset_cents)}</td><td class="r money">${fmtUSD(x.paid_to_driver_cents)}</td><td class="r money">${fmtUSD(x.received_from_driver_cents)}</td><td>${sstChip(x.status)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">沒有結算單</td></tr>'}
      </tbody></table></div>`;
    VIEWS.settlements.list = list;
  }
  const TABS = isDriver ? [['open', '我的未結清'], ['list', '我的結算單']] : [['new', '產生結算清單'], ['list', '結算單查詢']];
  main.innerHTML = `${head('P06', t('p06'))}
    <div class="toolbar">${isDriver ? '' : `<select id="s-driver" aria-label="司機">${ds.map((d) => `<option value="${d.id}" ${String(d.id) === s.driver_id ? 'selected' : ''}>${esc(d.name)}・應付 ${fmtUSD(d.payable_cents)}／應繳 ${fmtUSD(d.receivable_cents)}</option>`).join('')}</select>`}
      <label class="small muted">接送日期 <input type="date" id="s-from" value="${s.date_from}"></label><label class="small muted">至 <input type="date" id="s-to" value="${s.date_to}"></label>
      <button class="btn small ghost" id="s-week">本週</button><button class="btn small ghost" id="s-lastweek">上週</button></div>
    <div class="tabs">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-stab="${k}">${l}</button>`).join('')}</div>${body}`;
  $$('[data-stab]', main).forEach((b) => { b.onclick = () => { s.tab = b.dataset.stab; refresh(); }; });
  $('#s-driver', main)?.addEventListener('change', (e) => { s.driver_id = e.target.value; refresh(); });
  $('#s-from').onchange = (e) => { s.date_from = e.target.value; refresh(); };
  $('#s-to').onchange = (e) => { s.date_to = e.target.value; refresh(); };
  $('#s-week').onclick = () => { const w = weekRange(todayLocal()); s.date_from = w.from; s.date_to = w.to; refresh(); };
  $('#s-lastweek').onclick = () => { const w = weekRange(addDays(todayLocal(), -7)); s.date_from = w.from; s.date_to = w.to; refresh(); };
  $('#s-status', main)?.addEventListener('change', (e) => { s.status = e.target.value; refresh(); });
  $('#s-all', main)?.addEventListener('change', (e) => { s.listAll = e.target.checked; refresh(); });
  $$('[data-st]', main).forEach((r) => { r.onclick = () => settlementDetail(+r.dataset.st); });
  $('#s-csv', main)?.addEventListener('click', () => downloadCsv(`settlements-${todayLocal()}.csv`, [['settlement_no', 'driver', 'period_from', 'period_to', 'payable_usd', 'receivable_usd', 'offset_usd', 'paid_to_driver_usd', 'received_from_driver_usd', 'status'],
    ...VIEWS.settlements.list.map((x) => [x.settlement_no, x.driver_name, x.period_from, x.period_to, centsToInput(x.payable_cents), centsToInput(x.receivable_cents), centsToInput(x.offset_cents), centsToInput(x.paid_to_driver_cents), centsToInput(x.received_from_driver_cents), x.status])]));
  $('#open-csv', main)?.addEventListener('click', () => downloadCsv(`open-items-${s.date_from}_${s.date_to}.csv`, [['order_no', 'pickup_date', 'collector', 'fare_usd', 'tip_usd', 'commission_usd', 'direction', 'amount_usd', 'customer_outstanding_usd', 'in_settlement'],
    ...VIEWS.settlements.items.map((i) => [i.order_no, i.pickup_local_date, i.collector, centsToInput(i.fare_cents), centsToInput(i.tip_cents), centsToInput(i.commission_cents), i.direction === 'PAYABLE' ? 'COMPANY_TO_DRIVER' : 'DRIVER_TO_COMPANY', centsToInput(i.amount_cents), centsToInput(i.customer_outstanding_cents), i.in_settlement || ''])]));
  const sumBox = $('#sel-sum', main);
  if (sumBox) {
    const update = () => {
      const chosen = $$('[data-item]:checked', main).map((c) => +c.dataset.item);
      let pay = 0; let rem = 0;
      for (const c of chosen) { const cell = $(`[data-amt="${c}"]`, main); if (cell.dataset.dir === 'PAYABLE') pay += +cell.dataset.v; else rem += +cell.dataset.v; }
      const off = $('#off-on', main)?.checked ? Math.min(pay, rem) : 0;
      sumBox.innerHTML = `<div><div class="lbl">已選 ${chosen.length} 筆・公司應付司機</div>${usd(pay)}</div><div><div class="lbl">司機應繳公司</div>${usd(rem)}</div>
        <div><div class="lbl">授權抵銷</div>${usd(off)}</div><div><div class="lbl">${off ? '抵銷後淨額' : '需分別收付'}</div><div class="money">${off ? (pay - off > 0 ? '公司付 ' + fmtUSD(pay - off) : '司機繳 ' + fmtUSD(rem - off)) : `付 ${fmtUSD(pay)}／收 ${fmtUSD(rem)}`}</div></div>`;
    };
    $$('[data-item]', main).forEach((c) => { c.onchange = update; });
    $('#sel-all', main).onchange = (e) => { $$('[data-item]:not(:disabled)', main).forEach((c) => { c.checked = e.target.checked; }); update(); };
    $('#off-on', main)?.addEventListener('change', (e) => { $('#off-box', main).hidden = !e.target.checked; update(); });
    update();
    $('#mk-settle', main).onclick = async () => {
      const ids = $$('[data-item]:checked', main).map((c) => +c.dataset.item);
      if (!ids.length) { toast('請至少勾選一筆', true); return; }
      const off = $('#off-on', main)?.checked;
      const unpaid = VIEWS.settlements.items.filter((i) => ids.includes(i.order_id) && i.customer_outstanding_cents);
      const ok = await confirmDialog({
        title: '建立結算單',
        message: `將為 <b>${esc(ds.find((d) => String(d.id) === s.driver_id)?.name)}</b> 建立 ${ids.length} 筆的結算單。${off ? '<br><b>含淨額抵銷（已授權）</b>' : '<br>不抵銷，公司應付與司機應繳分開收付。'}${unpaid.length ? `<div class="warnbox" style="margin-top:8px">其中 ${unpaid.length} 筆客戶尚未付清，公司可能先墊付司機。</div>` : ''}`,
        confirmText: '建立',
      });
      if (!ok) return;
      try {
        const r = await POST('/api/settlements', { driver_id: +s.driver_id, date_from: s.date_from, date_to: s.date_to, order_ids: ids,
          offset: off ? { enabled: true, authorize: $('#off-auth', main).checked, note: $('#off-note', main).value } : undefined });
        toast('已建立 ' + r.settlement_no); s.tab = 'list'; await refresh(); settlementDetail(r.id);
      } catch (e) { toast(e.message, true); }
    };
  }
};
async function settlementDetail(id) {
  const x = await GET('/api/settlements/' + id);
  const remain = (dir) => x.items.filter((i) => i.direction === dir && i.status !== 'VOID').reduce((s, i) => s + i.amount_due_cents - i.settled_cents, 0);
  const rp = remain('PAYABLE'); const rr = remain('RECEIVABLE');
  const writable = can('settlement.write') && !['SETTLED', 'VOID'].includes(x.status);
  openSheet({
    title: `結算單 ${x.settlement_no}`,
    body: `<div style="display:flex;gap:6px;flex-wrap:wrap">${sstChip(x.status)}<span class="chip">${esc(x.driver_name)} ${x.driver_no}</span><span class="chip">${x.period_from} ～ ${x.period_to}</span></div>
      <div class="fin"><div><div class="lbl">公司應付司機（毛額）</div>${usd(x.payable_cents)}</div><div><div class="lbl">司機應繳公司（毛額）</div>${usd(x.receivable_cents)}</div>
        <div><div class="lbl">授權抵銷</div>${usd(x.offset_cents)}</div><div><div class="lbl">已付司機／已收司機</div><div class="money">${fmtUSD(x.paid_to_driver_cents)}／${fmtUSD(x.received_from_driver_cents)}</div></div>
        <div><div class="lbl">尚需付司機</div>${usd(rp)}</div><div><div class="lbl">尚需向司機收</div>${usd(rr)}</div></div>
      ${x.offset_cents ? `<div class="infobox">抵銷授權：${esc(x.offset_authorized_by_name || '')}・${fmtLocalDateTime(x.offset_authorized_at)}・${esc(x.offset_note || '')}</div>` : ''}
      ${writable ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${rp ? `<button class="btn primary" data-pay="PAYOUT">登錄公司付司機</button>` : ''}${rr ? `<button class="btn gold" data-pay="REMIT">登錄司機繳款</button>` : ''}${!x.paid_to_driver_cents && !x.received_from_driver_cents && !x.offset_cents ? '<button class="btn danger" data-void>作廢結算單</button>' : ''}</div>` : ''}
      <div class="table-wrap"><table><thead><tr><th>訂單</th><th>日期</th><th>方向</th><th class="r">應結</th><th class="r">抵銷</th><th class="r">已結</th><th class="r">未結</th><th>狀態</th>${writable ? '<th></th>' : ''}</tr></thead><tbody>
      ${x.items.map((i) => `<tr><td class="num">${i.order_no}</td><td class="small">${i.pickup_local_date}</td><td>${i.direction === 'PAYABLE' ? '公司付司機' : '司機繳公司'}</td><td class="r money">${fmtUSD(i.amount_due_cents)}</td><td class="r money">${fmtUSD(i.offset_cents)}</td><td class="r money">${fmtUSD(i.settled_cents)}</td><td class="r money">${fmtUSD(i.amount_due_cents - i.settled_cents)}</td><td>${sstChip(i.status === 'OPEN' ? (i.settled_cents ? 'PARTIAL' : 'OPEN') : i.status)}</td>
        ${writable ? `<td>${i.status === 'OPEN' ? `<button class="btn small" data-one="${i.order_id}" data-dir="${i.direction}" data-left="${i.amount_due_cents - i.settled_cents}">逐筆結清</button>` : ''}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>
      <h3 style="font-size:15px">付款紀錄</h3>
      <div class="table-wrap"><table><thead><tr><th>款項</th><th>方向</th><th>方式</th><th class="r">金額</th><th>參考</th><th>時間／人員</th></tr></thead><tbody>
      ${x.payments.map((p) => `<tr><td class="num">${p.payment_no}</td><td>${p.kind === 'DRIVER_PAYOUT' ? '公司付司機' : '司機繳公司'}</td><td>${t('m.' + p.method)}</td><td class="r money">${fmtUSD(p.amount_cents)}</td><td class="small">${esc(p.reference || '')}</td><td class="small">${fmtLocalDateTime(p.recorded_at)}<br>${esc(p.recorded_by_name || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">尚無付款</td></tr>'}
      </tbody></table></div>
      <div><button class="btn small" data-csv>匯出此結算單 CSV</button></div>
      ${x.audit.length ? `<h3 style="font-size:15px">操作紀錄</h3><div class="list">${x.audit.map(auditRow).join('')}</div>` : ''}`,
    onMount: (el, close) => {
      const again = () => { close(); refresh(); settlementDetail(id); };
      const paySheet = (dir, left, only) => formSheet({
        title: `${dir === 'PAYOUT' ? '公司付司機' : '司機繳公司'}・${x.settlement_no}`, submitText: '登錄付款',
        fields: `<div class="infobox full">${only ? '逐筆結清單一訂單。' : '依接送時間先後分配到各筆訂單。'}未結餘額 ${fmtUSD(left)}；可部分付款，不可超過餘額。原型不串接金流，僅登錄已實際完成的付款。</div>
          ${field('金額', money('amount', left), { req: true })}${field('方式', `<select name="method" id="f-sp-method">${opt(ENUM.method, 'ZELLE', 'm.')}</select>`)}
          ${field('參考號', '<input name="reference" id="f-sp-ref" placeholder="Zelle 交易碼／收據號">', { full: true })}
          <label class="check full"><input type="checkbox" name="confirm" id="f-sp-confirm"> 我確認款項已實際${dir === 'PAYOUT' ? '付給司機' : '收到司機繳款'}</label>`,
        submit: async (fd) => { await POST(`/api/settlements/${id}/payments`, { direction: dir, amount_cents: toCents(fd.amount), method: fd.method, reference: fd.reference, confirm: !!fd.confirm, order_ids: only ? [only] : undefined }); toast('已登錄付款'); again(); },
      });
      $$('[data-pay]', el).forEach((b) => { b.onclick = () => paySheet(b.dataset.pay, b.dataset.pay === 'PAYOUT' ? rp : rr); });
      $$('[data-one]', el).forEach((b) => { b.onclick = () => paySheet(b.dataset.dir === 'PAYABLE' ? 'PAYOUT' : 'REMIT', +b.dataset.left, +b.dataset.one); });
      $('[data-void]', el)?.addEventListener('click', () => formSheet({ title: '作廢結算單', danger: true, submitText: '作廢', fields: field('作廢原因', '<input name="reason" id="f-sv-reason">', { req: true, full: true }), submit: async (fd) => { await POST(`/api/settlements/${id}/void`, fd); toast('已作廢'); close(); refresh(); } }));
      $('[data-csv]', el).onclick = () => downloadCsv(`${x.settlement_no}.csv`, [['settlement_no', 'driver', 'order_no', 'pickup_date', 'direction', 'amount_due_usd', 'offset_usd', 'settled_usd', 'remaining_usd', 'status'],
        ...x.items.map((i) => [x.settlement_no, x.driver_name, i.order_no, i.pickup_local_date, i.direction === 'PAYABLE' ? 'COMPANY_TO_DRIVER' : 'DRIVER_TO_COMPANY', centsToInput(i.amount_due_cents), centsToInput(i.offset_cents), centsToInput(i.settled_cents), centsToInput(i.amount_due_cents - i.settled_cents), i.status])]);
    },
  });
}

// =====================================================================
// 測試報告、操作紀錄
// =====================================================================
VIEWS.tests = async (main) => {
  main.innerHTML = `${head('QA', t('nav.tests'))}<div class="loading">正在全新資料庫中執行 10 大情境測試…</div>`;
  const r = await GET('/api/tests');
  const groups = {};
  for (const x of r.results) (groups[x.case] ||= { title: x.title, rows: [] }).rows.push(x);
  main.innerHTML = `${head('QA', t('nav.tests'), '<button class="btn" id="rerun">重新執行</button>')}
    <div class="kpis"><div class="kpi ${r.failed ? 'bad' : 'accent'}"><div class="lbl">結果</div><div class="val">${r.failed ? r.failed + ' 項失敗' : '全部通過'}</div></div>
      <div class="kpi"><div class="lbl">檢核項目</div><div class="val">${r.passed} / ${r.total}</div></div><div class="kpi"><div class="lbl">模擬訂單</div><div class="val">${r.order_count} 筆</div></div>
      <div class="kpi"><div class="lbl">執行時間</div><div class="val" style="font-size:15px">${fmtLocalDateTime(r.ran_at)}</div><div class="hint">${r.duration_ms} ms・獨立記憶體資料庫</div></div></div>
    ${Object.entries(groups).map(([k, g]) => `<section class="card" style="margin-bottom:10px"><h2>情境 ${k}｜${esc(g.title)} ${g.rows.every((x) => x.pass) ? '<span class="chip ok">通過</span>' : '<span class="chip bad">失敗</span>'}</h2>
      <div class="table-wrap"><table><thead><tr><th>單號</th><th>檢核項目</th><th class="r">預期值</th><th class="r">實際值</th><th>狀態</th></tr></thead><tbody>
      ${g.rows.map((x) => `<tr><td class="num small">${esc(x.ref)}</td><td>${esc(x.item)}</td><td class="r num">${esc(x.expected)}</td><td class="r num">${esc(x.actual)}</td><td>${x.pass ? '<span class="chip ok">PASS</span>' : '<span class="chip bad">FAIL</span>'}</td></tr>`).join('')}
      </tbody></table></div></section>`).join('')}`;
  $('#rerun').onclick = refresh;
};
const auditRow = (a) => `<div style="display:grid;gap:2px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px">
  <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip">${esc(a.action)}</span><b>${esc(a.actor_name)}</b><span class="muted small">${fmtLocalDateTime(a.created_at)}</span></div>
  <div>${esc(a.summary || '')}</div>${a.reason ? `<div class="small">原因：${esc(a.reason)}</div>` : ''}
  ${a.before_json || a.after_json ? `<details class="small muted"><summary>變更內容</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0">${a.before_json ? '前：' + esc(a.before_json) + '\n' : ''}${a.after_json ? '後：' + esc(a.after_json) : ''}</pre></details>` : ''}</div>`;
VIEWS.audit = async (main) => {
  ui.audit ||= { q: '', entity_type: '' };
  const list = await GET('/api/audit', ui.audit);
  main.innerHTML = `${head('LOG', t('nav.audit'))}
    <div class="toolbar"><input type="search" id="a-q" placeholder="搜尋內容、原因、操作人" value="${esc(ui.audit.q)}">
    <select id="a-type"><option value="">全部對象</option>${opt(['order', 'customer', 'driver', 'settlement', 'user', 'vehicle'], ui.audit.entity_type)}</select></div>
    <div class="card">${list.map(auditRow).join('') || '<div class="empty">沒有紀錄</div>'}</div>`;
  let timer;
  $('#a-q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { ui.audit.q = e.target.value; refresh(); }, 400); };
  $('#a-type').onchange = (e) => { ui.audit.entity_type = e.target.value; refresh(); };
};

// ---------- 啟動 ----------
(async () => {
  try {
    await initBackend();
    const tok = S.mode === 'server' ? load('air001.token') : null;
    if (tok) {
      S.token = tok;
      try { S.user = await GET('/api/me'); renderShell(); return; } catch { S.token = null; }
    }
    renderLogin();
  } catch (e) {
    app.innerHTML = `<div class="login"><div class="login-card"><h1>無法啟動</h1><div class="err">${esc(e.message)}</div><div class="small muted">請以 <code>npm start</code> 啟動伺服器模式，或確認網路可載入 sql.js。</div></div></div>`;
  }
})();
