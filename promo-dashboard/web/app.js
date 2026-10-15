import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html, api } from './ui.js';
import { Home } from './home.js';
import { OrganicPage, PostPage } from './organic.js';
import { ProjectPage, NewProject, CampaignPage } from './project.js';

// ---------- 路由與期間 ----------
function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => { setHash(location.hash || '#/'); scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return hash;
}

const todayTW = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

function loadPeriod() {
  try { return JSON.parse(localStorage.getItem('promo-period-v2')) || { period: 'week' }; } catch { return { period: 'week' }; }
}
function periodQuery(p) {
  if (p.period === 'month') return `period=month&m=${p.m || todayTW().slice(0, 7)}`;
  if (p.period === 'custom') return `period=custom&from=${p.from}&to=${p.to}`;
  return `period=${p.period}`;
}

function PeriodPicker({ value, onChange }) {
  const thisMonth = todayTW().slice(0, 7);
  const months = [];
  for (let i = 1; i < 12; i++) {
    const d = new Date(thisMonth + '-01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const sel = value.period === 'month' ? (value.m === thisMonth || !value.m ? 'month' : 'm:' + value.m) : value.period;
  const [from, setFrom] = useState(value.from || todayTW().slice(0, 8) + '01');
  const [to, setTo] = useState(value.to || todayTW());
  return html`<div class="period">
    <label><span class="sr">統計期間</span>
      <select id="period-select" value=${sel} onChange=${(e) => {
        const v = e.target.value;
        if (v === 'custom') onChange({ period: 'custom', from, to });
        else if (v === 'month') onChange({ period: 'month', m: thisMonth });
        else onChange(v.startsWith('m:') ? { period: 'month', m: v.slice(2) } : { period: v });
      }}>
        <option value="week">本週</option>
        <option value="month">本月</option>
        <option value="custom">自訂</option>
        <option value="r7">近 7 天</option>
        <option value="r30">近 30 天</option>
        ${months.map((m) => html`<option value=${'m:' + m}>曆月 ${m}</option>`)}
        <option value="all">全部期間</option>
      </select></label>
    ${value.period === 'custom' ? html`<span class="custom-range">
      <input type="date" id="custom-from" aria-label="自訂開始日" value=${from} onChange=${(e) => { setFrom(e.target.value); if (e.target.value <= to) onChange({ period: 'custom', from: e.target.value, to }); }} />
      <span aria-hidden="true">–</span>
      <input type="date" id="custom-to" aria-label="自訂結束日" value=${to} onChange=${(e) => { setTo(e.target.value); if (from <= e.target.value) onChange({ period: 'custom', from, to: e.target.value }); }} />
    </span>` : null}
  </div>`;
}

function TopBar({ period, setPeriod, projects, current, me }) {
  return html`<header class="topbar">
    <div class="topbar-in">
      <a href="#/" class="brand"><span class="logo" aria-hidden="true">宣</span><span>宣傳戰情室</span></a>
      <nav class="mainnav" aria-label="主要">
        <a href="#/">總覽</a>
        ${me?.isAdmin ? html`<a href="#/organic">日常發文</a>` : null}
        <label class="switch"><span class="sr">付費廣告專案</span>
          <select id="project-switch" value=${current || ''} onChange=${(e) => { location.hash = e.target.value ? '#/p/' + e.target.value : '#/'; }}>
            <option value="">付費廣告專案…</option>
            ${(projects || []).map((p) => html`<option value=${p.id}>${p.is_test ? '［測試］' : ''}${p.code}｜${p.name}</option>`)}
          </select>
        </label>
      </nav>
      <div class="spacer"></div>
      <${PeriodPicker} value=${period} onChange=${setPeriod} />
    </div>
  </header>`;
}

function parseHash(hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { parts: path.split('/').filter(Boolean), params };
}

function App() {
  const hash = useHash();
  const [period, setPeriodState] = useState(loadPeriod);
  const [nav, setNav] = useState({ projects: [], me: null });
  const [navTick, setNavTick] = useState(0);
  useEffect(() => {
    Promise.all([api('GET', '/projects'), api('GET', '/me')]).then(([projects, me]) => setNav({ projects, me })).catch(() => {});
  }, [navTick]);
  const setPeriod = (p) => { setPeriodState(p); try { localStorage.setItem('promo-period-v2', JSON.stringify(p)); } catch { /* 無法儲存時只保留在畫面上 */ } };
  const q = periodQuery(period);
  const { parts, params } = parseHash(hash);
  let page; let current = '';
  const reloadNav = () => setNavTick((t) => t + 1);
  if (parts[0] === 'p' && parts[1]) { current = parts[1]; page = html`<${ProjectPage} id=${parts[1]} tab=${parts[2] || 'overview'} q=${q} me=${nav.me} reloadNav=${reloadNav} />`; }
  else if (parts[0] === 'c' && parts[1]) page = html`<${CampaignPage} id=${parts[1]} q=${q} />`;
  else if (parts[0] === 'organic') page = html`<${OrganicPage} q=${q} params=${params} />`;
  else if (parts[0] === 'post' && parts[1]) page = html`<${PostPage} id=${parts[1]} />`;
  else if (parts[0] === 'new') page = html`<${NewProject} reloadNav=${reloadNav} />`;
  else page = html`<${Home} q=${q} />`;
  return html`<div>
    ${window.__PREVIEW__ ? html`<div class="preview-bar">預覽版：資料只存在這個瀏覽器分頁，重新整理就恢復成測試資料。<button class="btn tiny" onClick=${() => window.__RESET__ && window.__RESET__()}>重設測試資料</button></div>` : null}
    <${TopBar} period=${period} setPeriod=${setPeriod} projects=${nav.projects} current=${current} me=${nav.me} />
    ${page}
    <footer class="foot">宣傳戰情室 v0.2・開發測試版・人工登錄與 CSV 匯入・API 自動串接待後續${nav.me ? '・登入：' + nav.me.email : ''}</footer>
  </div>`;
}

export function mount() {
  render(html`<${App} />`, document.getElementById('app'));
}
