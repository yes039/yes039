import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html, api, useApi, V, Kpi, Judge, AlertItem, Badge, Empty, Modal, Form, Field, Tabs, Copy, Loading } from './ui.js';
import { DailyBars, Funnel, InlineBar } from './charts.js';
import { fmt, md, ymd, rangeText } from './format.js';
import { CHANNELS, FORMATS, UTM_SOURCES, UTM_MEDIUMS, suggestCampaignCode, suggestCreativeCode, suggestClaimCode } from '../src/tracking.js';
import { SOURCE_KINDS, OUTCOME_TYPES } from '../src/metrics.js';

const AD_LABEL = { spend: '花費', impressions: '曝光', link_clicks: '連結點擊' };
const STATUS = ['規劃中', '進行中', '暫停', '已結束'];
const KINDS = ['合作', '自有課程', '客戶', '自有品牌'];
const ACCOUNT_TYPES = [['fb_page', 'FB 粉專'], ['ad_account', '廣告帳號'], ['line_oa', 'LINE 官方帳號'], ['landing', '落地頁'], ['enroll', '報名系統'], ['payment', '收款'], ['other', '其他']];

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

function loadPeriod() {
  try { return JSON.parse(localStorage.getItem('promo-period')) || { period: 'r30' }; } catch { return { period: 'r30' }; }
}
function periodQuery(p) {
  return p.period === 'month' ? `period=month&m=${p.m}` : `period=${p.period}`;
}

function PeriodPicker({ value, onChange }) {
  const thisMonth = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(thisMonth + '-01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const sel = value.period === 'month' ? 'm:' + value.m : value.period;
  return html`<label class="period"><span class="sr">統計期間</span>
    <select id="period-select" value=${sel} onChange=${(e) => {
      const v = e.target.value;
      onChange(v.startsWith('m:') ? { period: 'month', m: v.slice(2) } : { period: v });
    }}>
      <option value="r7">近 7 天</option>
      <option value="r30">近 30 天</option>
      ${months.map((m) => html`<option value=${'m:' + m}>曆月 ${m}</option>`)}
      <option value="all">全部期間</option>
    </select>
  </label>`;
}

function TopBar({ period, setPeriod, projects, current, me }) {
  return html`<header class="topbar">
    <div class="topbar-in">
      <a href="#/" class="brand"><span class="logo" aria-hidden="true">宣</span><span>宣傳戰情室</span></a>
      <label class="switch"><span class="sr">切換專案</span>
        <select id="project-switch" value=${current || ''} onChange=${(e) => { location.hash = e.target.value ? '#/p/' + e.target.value : '#/'; }}>
          <option value="">宣傳總覽（全部專案）</option>
          ${(projects || []).map((p) => html`<option value=${p.id}>${p.is_test ? '［測試］' : ''}${p.code}｜${p.name}</option>`)}
        </select>
      </label>
      <div class="spacer"></div>
      <${PeriodPicker} value=${period} onChange=${setPeriod} />
      ${me?.isAdmin ? html`<a class="btn primary small" href="#/new">＋ 新增專案</a>` : null}
    </div>
  </header>`;
}

// ---------- 宣傳總覽 ----------
function Overview({ q }) {
  const st = useApi('/overview?' + q);
  return html`<${Loading} state=${st}>${(d) => {
    const t = d.totals.find((x) => x.currency === 'TWD') || d.totals[0];
    const testOnly = d.projects.length > 0 && d.projects.every((p) => p.project.is_test);
    return html`<main class="page">
      ${testOnly ? html`<div class="test-banner" role="note"><b>測試資料</b> 目前只有測試專案（代碼 T 開頭、名稱標【測試】），所有數字都是程式產生的，不是實際營運資料。</div>` : null}
      <div class="page-head">
        <div><h1>宣傳總覽</h1><p class="sub">${rangeText(d.range)}・你可查看 ${d.projects.length} 個專案</p></div>
      </div>
      ${d.projects.length === 0 ? html`<${Empty} title="你目前沒有可查看的專案">請管理者把你加入專案。</${Empty}>` : html`
      <section class="kpis" aria-label="關鍵數字">
        <${Kpi} label="進行中活動"><span class="val">${fmt.int(d.activeCampaigns)}</span></${Kpi}>
        <${Kpi} label="廣告花費（全部專案）" m=${t?.spend} f="money" sub="平台數字，同幣別才加總" />
        <${Kpi} label="連結點擊" m=${t?.link_clicks} sub=${html`點擊率 <${V} m=${t?.ctr} f="pct" compact />`} />
        <${Kpi} label="異常／待辦"><span class="val">${d.anomalies.length}<small> ／ </small>${d.todos.length}</span></${Kpi}>
      </section>

      <section aria-labelledby="h-now">
        <h2 id="h-now" class="sec">正在推什麼、帶來什麼成果</h2>
        <p class="sec-note">各專案的成果指標由專案自行定義，總覽不跨專案加總名單、報名與付款。</p>
        <div class="proj-grid">${d.projects.map((p) => html`<${ProjectCard} p=${p} />`)}</div>
      </section>

      <div class="two">
        <section aria-labelledby="h-alerts" class="panel">
          <h2 id="h-alerts" class="sec">異常 <span class="count">${d.anomalies.length}</span></h2>
          ${d.anomalies.length ? html`<ul class="alerts">${d.anomalies.map((a) => html`<${AlertItem} a=${a} showProject />`)}</ul>` : html`<p class="muted">目前沒有異常。</p>`}
        </section>
        <section aria-labelledby="h-todos" class="panel">
          <h2 id="h-todos" class="sec">待辦 <span class="count">${d.todos.length}</span></h2>
          ${d.todos.length ? html`<ul class="alerts">${d.todos.map((a) => html`<${AlertItem} a=${{ ...a, link: a.link || '#/p/' + a.project_id + '/sources' }} showProject />`)}</ul>` : html`<p class="muted">目前沒有待辦。</p>`}
        </section>
      </div>

      <section aria-labelledby="h-src" class="panel">
        <h2 id="h-src" class="sec">資料更新狀態</h2>
        <div class="tbl"><table>
          <thead><tr><th>專案</th>${Object.values(SOURCE_KINDS).map((l) => html`<th>${l}</th>`)}</tr></thead>
          <tbody>${d.projects.map((p) => html`<tr>
            <td><a href=${'#/p/' + p.project.id + '/sources'}>${p.project.code}</a></td>
            ${Object.keys(SOURCE_KINDS).map((k) => html`<td><${SourceCell} s=${p.sources[k]} used=${k === 'ads' ? p.metrics.spend.s !== 'not_computed' : sourceUsed(p.project, k)} /></td>`)}
          </tr>`)}</tbody>
        </table></div>
      </section>`}
    </main>`;
  }}</${Loading}>`;
}

function sourceUsed(project, kind) {
  if (kind === 'ads') return true;
  const map = { claim: ['claim'], lead: ['lead', 'valid_lead'], enroll: ['enroll'], payment: ['payment', 'refund'] };
  return map[kind].some((t) => project.metrics[t]?.enabled);
}

function SourceCell({ s, used }) {
  if (!used) return html`<span class="state s-not_computed sm">未使用</span>`;
  if (!s?.connected) return html`<span class="state s-not_connected sm" title=${s?.note}>尚未接入</span>`;
  return html`<span>更新到 ${md(s.covered_through)}</span>`;
}

function outcomeKeys(project) {
  return OUTCOME_TYPES.filter((t) => t !== 'refund' && project.metrics[t]?.enabled);
}

function ProjectCard({ p }) {
  const { project, metrics: m } = p;
  const keys = outcomeKeys(project);
  const budget = project.budget;
  const used = budget ? p.budget.spentAll / budget : null;
  return html`<article class="proj-card">
    <a class="proj-card-head" href=${'#/p/' + project.id}>
      <div><span class="proj-code">${project.code}</span> ${project.is_test ? html`<${Badge} kind="test">測試</${Badge}>` : null} <${Badge} kind="status">${project.status}</${Badge}></div>
      <h3>${project.name}</h3>
      <div class="muted small">${project.kind}${project.partner ? '・' + project.partner : ''}</div>
    </a>
    <div class="active-list">
      <div class="lbl">正在推（${p.active.length}）</div>
      ${p.active.length ? p.active.map((c) => html`<a class="active-item" href=${'#/c/' + c.id}>
        <div><b>${c.offer || c.name}</b> <${Judge} j=${c.judgement} /></div>
        <div class="muted small">${c.code}・對 ${c.audience || '待填'} → ${c.destination || '待填'}</div>
      </a>`) : html`<div class="muted small">沒有進行中的活動</div>`}
    </div>
    <dl class="mini">
      <div><dt>花費</dt><dd><${V} m=${m.spend} f="money" compact showNA /></dd></div>
      ${keys.map((k) => html`<div><dt>${project.metrics[k].label}</dt><dd><${V} m=${m[k]} compact /></dd></div>`)}
      ${project.metrics.payment?.enabled ? html`<div><dt>付款淨額</dt><dd><${V} m=${m.net_amount} f="money" compact /></dd></div>` : null}
      ${!keys.length ? html`<div class="wide"><dt>成果指標</dt><dd><span class="state s-not_computed sm">本專案尚未定義</span></dd></div>` : null}
    </dl>
    ${budget ? html`<div class="budget"><div class="budget-bar"><span style=${`width:${Math.min(100, used * 100)}%`} class=${used > 1 ? 'over' : used > 0.9 ? 'near' : ''}></span></div>
      <div class="small muted">專案預算 ${fmt.money(budget)}・累計已花 ${fmt.money(p.budget.spentAll)}（${fmt.pct(used)}）</div></div>` : html`<div class="small muted">專案預算：待填</div>`}
    <div class="card-foot small">${p.anomalies ? html`<span class="lv-text serious">▲ 異常 ${p.anomalies}</span>` : null}${p.todos ? html`<span>□ 待辦 ${p.todos}</span>` : null}<a href=${'#/p/' + project.id}>查看專案 →</a></div>
  </article>`;
}

// ---------- 專案 ----------
const PROJECT_TABS = [['campaigns', '活動'], ['compare', '比較'], ['entry', '登錄與匯入'], ['tracking', '代碼與連結'], ['sources', '資料來源'], ['settings', '專案設定']];

function ProjectPage({ id, tab = 'campaigns', q, me, reloadNav }) {
  const st = useApi(`/projects/${id}?${q}`);
  return html`<${Loading} state=${st}>${(d) => {
    const p = d.project;
    return html`<main class="page">
      ${p.is_test ? html`<div class="test-banner" role="note"><b>測試資料</b> 這是測試專案，數字由程式產生，不是實際營運資料。</div>` : null}
      <div class="page-head">
        <div>
          <div class="crumb"><a href="#/">宣傳總覽</a> ／ 專案</div>
          <h1>${p.name}</h1>
          <p class="sub"><span class="proj-code">${p.code}</span>・${p.kind}${p.partner ? '・' + p.partner : ''}・負責人 ${p.owner || '待填'}・<${Badge} kind="status">${p.status}</${Badge}></p>
          <p class="sub">${rangeText(d.range)}${p.goal ? '・目標：' + p.goal : ''}</p>
        </div>
        ${window.__PREVIEW__ ? null : html`<a class="btn ghost small" href=${`/api/projects/${id}/export.csv?${q}`} download>匯出本專案 CSV</a>`}
      </div>
      <${Tabs} tabs=${PROJECT_TABS} active=${tab} base=${'#/p/' + id} />
      ${tab === 'campaigns' ? html`<${ProjectCampaigns} d=${d} reload=${st.reload} />` : null}
      ${tab === 'compare' ? html`<${ProjectCompare} d=${d} />` : null}
      ${tab === 'entry' ? html`<${ProjectEntry} d=${d} reload=${st.reload} />` : null}
      ${tab === 'tracking' ? html`<${ProjectTracking} d=${d} reload=${st.reload} />` : null}
      ${tab === 'sources' ? html`<${ProjectSources} d=${d} reload=${st.reload} />` : null}
      ${tab === 'settings' ? html`<${ProjectSettings} d=${d} reload=${() => { st.reload(); reloadNav(); }} me=${me} />` : null}
    </main>`;
  }}</${Loading}>`;
}

function MetricKpis({ m, project }) {
  const keys = outcomeKeys(project);
  const pk = m.primaryKey;
  return html`<section class="kpis" aria-label="關鍵數字">
    <${Kpi} label="花費" m=${m.spend} f="money" />
    <${Kpi} label="曝光" m=${m.impressions} />
    <${Kpi} label="連結點擊" m=${m.link_clicks} sub=${html`點擊率 <${V} m=${m.ctr} f="pct" compact />・每次點擊 <${V} m=${m.cpc} f="money" compact />`} />
    ${keys.map((k) => html`<${Kpi} label=${project.metrics[k].label} m=${m[k]}
      sub=${k === pk ? html`每筆成本 <${V} m=${m.cost_primary} f="money" compact />` : k === 'enroll' ? html`每筆報名成本 <${V} m=${m.cost_enroll} f="money" compact />` : null} />`)}
    ${project.metrics.payment?.enabled ? html`<${Kpi} label="付款淨額" m=${m.net_amount} f="money" sub=${html`付款 <${V} m=${m.payment} compact /> 筆・退款 <${V} m=${m.refund_amount} f="money" compact />`} />` : null}
    ${!keys.length ? html`<${Kpi} label="成果指標" m=${{ v: null, s: 'not_computed', r: '本專案尚未定義成果指標，請到「專案設定」定義' }} />` : null}
  </section>`;
}

function ProjectCampaigns({ d, reload }) {
  const p = d.project;
  const [edit, setEdit] = useState(null);
  const keys = outcomeKeys(p);
  const maxSpend = Math.max(0, ...d.campaigns.map((c) => c.metrics.spend.v || 0));
  return html`<div class="stack">
    <${MetricKpis} m=${d.metrics} project=${p} />
    ${d.anomalies.length || d.todos.length ? html`<div class="two">
      <section class="panel"><h2 class="sec">異常 <span class="count">${d.anomalies.length}</span></h2>${d.anomalies.length ? html`<ul class="alerts">${d.anomalies.map((a) => html`<${AlertItem} a=${a} />`)}</ul>` : html`<p class="muted">沒有異常。</p>`}</section>
      <section class="panel"><h2 class="sec">待辦 <span class="count">${d.todos.length}</span></h2>${d.todos.length ? html`<ul class="alerts">${d.todos.map((a) => html`<${AlertItem} a=${a} />`)}</ul>` : html`<p class="muted">沒有待辦。</p>`}</section>
    </div>` : null}
    <section class="panel">
      <div class="sec-row"><h2 class="sec">活動</h2><button class="btn primary small" onClick=${() => setEdit({})}>＋ 新增活動</button></div>
      ${d.campaigns.length ? html`<div class="tbl"><table class="data">
        <thead><tr><th>活動</th><th>狀態</th><th>期間</th><th class="num">花費</th><th class="num">點擊</th>
          ${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}
          ${d.metrics.primaryKey ? html`<th class="num">每筆${p.metrics[d.metrics.primaryKey].label}成本</th>` : null}
          ${p.metrics.payment?.enabled ? html`<th class="num">付款淨額</th>` : null}<th>判斷</th></tr></thead>
        <tbody>
          ${d.campaigns.map((c) => html`<tr>
            <td><a href=${'#/c/' + c.id}><b>${c.name}</b></a><div class="muted small">${c.code}・${c.offer || '推廣內容待填'}</div></td>
            <td><${Badge} kind="status">${c.status}</${Badge}></td>
            <td class="nowrap small">${c.start_date ? md(c.start_date) + '–' + md(c.end_date) : '待填'}</td>
            <td class="num"><${V} m=${c.metrics.spend} f="money" compact /><${InlineBar} v=${c.metrics.spend.v} max=${maxSpend} />${c.budget ? html`<div class="muted small">預算 ${fmt.money(c.budget)}</div>` : null}</td>
            <td class="num"><${V} m=${c.metrics.link_clicks} compact /></td>
            ${keys.map((k) => html`<td class="num"><${V} m=${c.metrics[k]} compact /></td>`)}
            ${d.metrics.primaryKey ? html`<td class="num"><${V} m=${c.metrics.cost_primary} f="money" compact />${c.target_cpl ? html`<div class="muted small">目標 ${fmt.money(c.target_cpl)}</div>` : null}</td>` : null}
            ${p.metrics.payment?.enabled ? html`<td class="num"><${V} m=${c.metrics.net_amount} f="money" compact /></td>` : null}
            <td><${Judge} j=${c.judgement} /><div class="muted small">${c.judgement.reason}</div></td>
          </tr>`)}
          ${keys.length ? html`<tr class="unknown">
            <td><b>來源不明</b><div class="muted small">沒有活動代碼、素材代碼或領取碼的成果</div></td><td></td><td></td><td class="num">—</td><td class="num">—</td>
            ${keys.map((k) => html`<td class="num">${fmt.int(d.unknown[k] || 0)}</td>`)}
            ${d.metrics.primaryKey ? html`<td></td>` : null}
            ${p.metrics.payment?.enabled ? html`<td class="num">${fmt.money((d.unknown.payment_amount || 0) - (d.unknown.refund_amount || 0))}</td>` : null}<td></td>
          </tr>` : null}
        </tbody>
      </table></div>
      <p class="note">專案合計以人去重，可能小於各活動相加；成本與轉換率都用合計分子 ÷ 合計分母。「!」表示資料不完整，滑鼠移上去看原因。</p>`
      : html`<${Empty} title="還沒有活動">按「新增活動」建立第一波宣傳。</${Empty}>`}
    </section>
    ${edit ? html`<${CampaignForm} project=${p} campaigns=${d.campaigns} onClose=${() => setEdit(null)} onDone=${(id) => { setEdit(null); location.hash = '#/c/' + id; }} />` : null}
  </div>`;
}

function CampaignForm({ project, campaigns, c, onClose, onDone }) {
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const code = c?.code || suggestCampaignCode(project.code, today, campaigns.map((x) => x.code));
  return html`<${Modal} title=${c ? '編輯活動' : '新增活動'} onClose=${onClose} wide>
    <${Form} onCancel=${onClose} onSubmit=${async (f) => {
      const r = c ? await api('PUT', '/campaigns/' + c.id, f) : await api('POST', `/projects/${project.id}/campaigns`, f);
      onDone(r.id);
    }}>
      <div class="grid2">
        <${Field} label="活動代碼" name="code" value=${code} required disabled=${!!c} hint=${`格式 ${project.code}-年月-序號，建立後不能改`} />
        <${Field} label="活動名稱" name="name" value=${c?.name} required />
        <${Field} label="推廣什麼" name="offer" value=${c?.offer} placeholder="例：免費電子書 → 課程" wide />
        <${Field} label="對誰（受眾）" name="audience" value=${c?.audience} placeholder="受眾代碼與描述，例：aud01 ..." />
        <${Field} label="導向哪裡" name="destination" value=${c?.destination} placeholder="落地頁、LINE、報名頁…" />
        <${Field} label="領取流程" name="flow" value=${c?.flow} options=${[['', '未定'], ['甲', '甲：先表單'], ['乙', '乙：先 LINE'], ['丙', '丙：混合'], ['不適用', '不適用']]} />
        <${Field} label="狀態" name="status" value=${c?.status || '規劃中'} options=${STATUS} />
        <${Field} label="開始日" name="start_date" type="date" value=${c?.start_date} />
        <${Field} label="結束日" name="end_date" type="date" value=${c?.end_date} />
        <${Field} label="預算（元）" name="budget" type="number" min="0" value=${c?.budget} />
        <${Field} label="目標每筆成本（元）" name="target_cpl" type="number" min="0" value=${c?.target_cpl} hint="用於持續／觀察／調整建議" />
        <${Field} label="負責人" name="owner" value=${c?.owner} />
        <${Field} label="備註" name="note" type="textarea" value=${c?.note} wide />
      </div>
    </${Form}>
  </${Modal}>`;
}

function ProjectCompare({ d }) {
  const p = d.project;
  const keys = outcomeKeys(p);
  const pk = d.metrics.primaryKey;
  const creatives = d.campaigns.flatMap((c) => c.creatives.map((cr) => ({ ...cr, campaign: c })));
  const paid = d.byChannel.filter((c) => c.paid);
  const free = d.byChannel.filter((c) => !c.paid);
  const row = (label, m, extra) => html`<tr>
    <td>${label}</td>
    <td class="num"><${V} m=${m.spend} f="money" compact /></td>
    <td class="num"><${V} m=${m.impressions} compact /></td>
    <td class="num"><${V} m=${m.link_clicks} compact /></td>
    <td class="num"><${V} m=${m.ctr} f="pct" compact /></td>
    ${keys.map((k) => html`<td class="num"><${V} m=${m[k]} compact /></td>`)}
    ${pk ? html`<td class="num"><${V} m=${m.cost_primary} f="money" compact /></td>` : null}
    ${extra}
  </tr>`;
  const head = (first, extra) => html`<thead><tr><th>${first}</th><th class="num">花費</th><th class="num">曝光</th><th class="num">點擊</th><th class="num">點擊率</th>
    ${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}${pk ? html`<th class="num">每筆${p.metrics[pk].label}成本</th>` : null}${extra}</tr></thead>`;
  return html`<div class="stack">
    <section class="panel">
      <h2 class="sec">付費廣告與免費宣傳</h2>
      <p class="sec-note">付費與免費分開列；免費渠道不計廣告成本。比率都用合計分子 ÷ 合計分母。</p>
      <h3 class="sub-h">付費</h3>
      ${paid.length ? html`<div class="tbl"><table class="data">${head('渠道')}<tbody>${paid.map((c) => row(c.label + `（${c.creatives} 則）`, c.metrics))}</tbody></table></div>` : html`<p class="muted">沒有付費渠道。</p>`}
      <h3 class="sub-h">免費</h3>
      ${free.length ? html`<div class="tbl"><table class="data">${head('渠道')}<tbody>${free.map((c) => row(c.label + `（${c.creatives} 則）`, c.metrics))}</tbody></table></div>` : html`<p class="muted">沒有免費渠道。</p>`}
    </section>
    <section class="panel">
      <h2 class="sec">活動比較</h2>
      <div class="tbl"><table class="data">${head('活動', html`<th>判斷</th>`)}<tbody>${d.campaigns.map((c) => row(html`<a href=${'#/c/' + c.id}>${c.code}</a><div class="muted small">${c.name}</div>`, c.metrics, html`<td><${Judge} j=${c.judgement} /></td>`))}</tbody></table></div>
    </section>
    <section class="panel">
      <h2 class="sec">素材比較</h2>
      <div class="tbl"><table class="data">${head('素材', html`<th>判斷</th>`)}<tbody>${creatives.map((cr) => row(html`<a href=${'#/c/' + cr.campaign.id}>${cr.code}</a><div class="muted small">${CHANNELS[cr.channel]}・${cr.name || '未命名'}</div>`, cr.metrics, html`<td><${Judge} j=${cr.judgement} /><div class="muted small">${cr.judgement.reason}</div></td>`))}</tbody></table></div>
      <p class="note">素材層的成果只計算有對應到素材的紀錄；只對應到活動（例如只有活動代碼）的有 ${d.campaignOnly} 筆，計入活動但不計入素材。</p>
    </section>
  </div>`;
}

// ---------- 登錄與匯入 ----------
function ProjectEntry({ d, reload }) {
  const p = d.project;
  const creatives = d.campaigns.flatMap((c) => c.creatives.map((cr) => ({ ...cr, campaign: c })));
  const paidCreatives = creatives.filter((c) => c.paid);
  const enabled = OUTCOME_TYPES.filter((t) => p.metrics[t]?.enabled);
  const [msg, setMsg] = useState('');
  const today = d.today;
  return html`<div class="stack">
    ${msg ? html`<div class="ok-box" role="status">${msg}</div>` : null}
    <div class="two">
      <section class="panel">
        <h2 class="sec">人工登錄：FB 廣告數字</h2>
        ${paidCreatives.length ? html`<${Form} submitLabel="登錄" onSubmit=${async (f, el) => { await api('POST', `/projects/${p.id}/ad-daily`, f); el.reset(); setMsg('已登錄廣告數字'); reload(); }}>
          <div class="grid2">
            <${Field} label="素材（付費）" name="creative_id" options=${paidCreatives.map((c) => [c.id, c.code])} />
            <${Field} label="日期" name="date" type="date" value=${today} required />
            <${Field} label="花費（元）" name="spend" type="number" min="0" required />
            <${Field} label="曝光" name="impressions" type="number" min="0" required />
            <${Field} label="連結點擊" name="link_clicks" type="number" min="0" required />
            <${Field} label="廣告資料已更新到" name="coveredThrough" type="date" hint="留空＝登錄的日期" />
          </div>
        </${Form}>` : html`<p class="muted">本專案還沒有付費素材。</p>`}
      </section>
      <section class="panel">
        <h2 class="sec">人工登錄：成果</h2>
        ${enabled.length ? html`<${Form} submitLabel="登錄" onSubmit=${async (f, el) => { await api('POST', `/projects/${p.id}/conversions`, f); el.reset(); setMsg('已登錄成果'); reload(); }}>
          <div class="grid2">
            <${Field} label="類型" name="type" options=${enabled.map((t) => [t, p.metrics[t].label])} />
            <${Field} label="日期" name="date" type="date" value=${today} required />
            <${Field} label="來源（素材）" name="creative_id" options=${[['', '不指定素材'], ...creatives.map((c) => [c.id, c.code])]} />
            <${Field} label="或只指定活動" name="campaign_id" options=${[['', '來源不明'], ...d.campaigns.map((c) => [c.id, c.code])]} hint="指定素材時以素材為準" />
            <${Field} label="數量" name="qty" type="number" min="1" value="1" />
            <${Field} label="金額（付款、退款）" name="amount" type="number" min="0" />
            <${Field} label="電話（選填，用於去重）" name="phone" hint="只存雜湊值，不存原文" />
            <${Field} label="Email（選填）" name="email" type="email" />
            <${Field} label="這類資料已更新到" name="coveredThrough" type="date" />
            <${Field} label="備註" name="note" />
          </div>
        </${Form}>` : html`<p class="muted">本專案尚未定義成果指標，請先到「專案設定」定義。</p>`}
      </section>
    </div>
    <${ImportPanel} p=${p} reload=${reload} />
    <section class="panel">
      <h2 class="sec">匯入紀錄</h2>
      ${d.imports.length ? html`<div class="tbl"><table class="data"><thead><tr><th>時間</th><th>類型</th><th>檔名</th><th class="num">新增</th><th class="num">更新</th><th class="num">略過</th><th>訊息</th></tr></thead>
        <tbody>${d.imports.map((i) => html`<tr><td class="nowrap small">${i.created_at.slice(0, 16).replace('T', ' ')}</td><td>${i.kind === 'ads' ? 'FB 廣告' : '成果'}</td><td>${i.filename}</td>
          <td class="num">${i.rows_inserted}</td><td class="num">${i.rows_updated}</td><td class="num">${i.rows_skipped}</td>
          <td class="small">${JSON.parse(i.messages_json).slice(0, 3).join('；')}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">還沒有匯入紀錄。</p>`}
    </section>
  </div>`;
}

const STATUS_TEXT = { ok: '可匯入', unmatched: '對應不到素材（仍會記錄花費）', error: '錯誤', skip: '略過' };
function ImportPanel({ p, reload }) {
  const [kind, setKind] = useState('ads');
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [skip, setSkip] = useState(false);
  const [covered, setCovered] = useState('');
  const load = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFilename(f.name);
    setText(await f.text());
    setPreview(null); setDone('');
  };
  const doPreview = async () => {
    setErr(''); setDone('');
    try { setPreview(await api('POST', `/projects/${p.id}/import/preview`, { kind, text })); } catch (x) { setErr(x.message); }
  };
  const commit = async () => {
    setErr('');
    try {
      const r = await api('POST', `/projects/${p.id}/import/commit`, { kind, text, filename, skipErrors: skip, coveredThrough: covered || undefined });
      setDone(`已匯入：新增 ${r.inserted}、更新 ${r.updated}、略過 ${r.skipped}；資料更新到 ${r.covered || '—'}`);
      setPreview(null); setText(''); reload();
    } catch (x) { setErr(x.message); }
  };
  const counts = preview ? preview.rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}) : {};
  return html`<section class="panel">
    <h2 class="sec">CSV 匯入</h2>
    <div class="import-row">
      <label class="field"><span>匯入類型</span>
        <select id="import-kind" value=${kind} onChange=${(e) => { setKind(e.target.value); setPreview(null); }}>
          <option value="ads">FB 廣告報表（Meta 廣告管理員匯出，依天細分）</option>
          <option value="outcomes">成果紀錄（領取、名單、報名、付款、退款）</option>
        </select></label>
      <label class="field"><span>選擇檔案</span><input id="import-file" type="file" accept=".csv,text/csv,.tsv,text/plain" onChange=${load} /></label>
    </div>
    <p class="hint">${kind === 'ads'
      ? '必要欄位：報告開始日期、廣告名稱、花費金額、曝光次數、連結點擊次數（中英文欄名皆可，實際欄名待以真實匯出檔核對）。廣告名稱須以素材代碼開頭。'
      : html`必要欄位：類型、日期；選填：活動代碼、素材代碼、領取碼、數量、金額、外部編號、電話、Email、備註。${window.__PREVIEW__ ? '欄位順序如上' : html`<a href="/api/templates/outcomes.csv" download>下載空白範本</a>`}。電話與 Email 只存雜湊值。`}</p>
    <label class="field"><span>或直接貼上 CSV 內容</span><textarea id="import-text" rows="5" value=${text} onInput=${(e) => { setText(e.target.value); setPreview(null); }}></textarea></label>
    <div class="form-actions left"><button class="btn" onClick=${doPreview} disabled=${!text}>預覽與檢查</button></div>
    ${err ? html`<p class="form-err" role="alert">${err}</p>` : null}
    ${done ? html`<div class="ok-box" role="status">${done}</div>` : null}
    ${preview ? html`<div class="preview">
      ${preview.errors.length ? html`<p class="form-err">${preview.errors.join('；')}</p>` : html`
      <p><b>檢查結果：</b>${Object.entries(counts).map(([k, n]) => `${STATUS_TEXT[k]} ${n} 列`).join('、')}</p>
      <div class="tbl tall"><table class="data"><thead><tr><th>列</th><th>狀態</th>${kind === 'ads' ? html`<th>日期</th><th>廣告名稱</th><th class="num">花費</th><th class="num">曝光</th><th class="num">點擊</th>` : html`<th>類型</th><th>日期</th><th>對應依據</th><th class="num">數量</th><th class="num">金額</th>`}<th>說明</th></tr></thead>
        <tbody>${preview.rows.map((r) => html`<tr class=${'r-' + r.status}><td>${r.line}</td><td>${STATUS_TEXT[r.status]}${r.action === 'update' ? '（更新）' : ''}</td>
          ${kind === 'ads' ? html`<td>${r.date || ''}</td><td class="small">${r.adName || ''}</td><td class="num">${r.spend ?? ''}</td><td class="num">${r.impressions ?? ''}</td><td class="num">${r.link_clicks ?? ''}</td>`
            : html`<td>${r.typeRaw}</td><td>${r.date || ''}</td><td>${r.via || ''}</td><td class="num">${r.qty}</td><td class="num">${r.amount || ''}</td>`}
          <td class="small">${r.message || ''}</td></tr>`)}</tbody></table></div>
      <div class="import-row">
        <label class="check"><input type="checkbox" id="import-skip" checked=${skip} onChange=${(e) => setSkip(e.target.checked)} /> 略過錯誤列</label>
        <label class="field"><span>資料已更新到（留空＝檔案最後日期）</span><input id="import-covered" type="date" value=${covered} onInput=${(e) => setCovered(e.target.value)} /></label>
      </div>
      <div class="form-actions left"><button class="btn primary" onClick=${commit}>確認匯入</button></div>`}
    </div>` : null}
  </section>`;
}

// ---------- 代碼與連結 ----------
function ProjectTracking({ d, reload }) {
  const p = d.project;
  const byCampaign = Object.fromEntries(d.campaigns.map((c) => [c.id, c]));
  const crById = Object.fromEntries(d.campaigns.flatMap((c) => c.creatives).map((c) => [c.id, c]));
  const del = async (kind, id) => { await api('DELETE', `/${kind}/${id}`); reload(); };
  return html`<div class="stack">
    <section class="panel">
      <h2 class="sec">代碼規則</h2>
      <ul class="rules">
        <li>活動代碼：<code>${p.code}-年月-序號</code>，例如 <code>${p.code}-2610-01</code></li>
        <li>素材代碼：<code>活動代碼-格式碼序號-v版本</code>；格式碼 ${Object.entries(FORMATS).map(([k, v]) => `${k} ${v}`).join('、')}</li>
        <li>FB 廣告名稱以素材代碼開頭，匯入報表時才能對應</li>
        <li>LINE 領取碼：<code>${p.claim_prefix}</code> 加 3 位數，只在本專案有效</li>
        <li>追蹤連結的 UTM 值一律小寫；新增連結與領取碼請到各活動頁</li>
      </ul>
    </section>
    <section class="panel">
      <h2 class="sec">追蹤連結 <span class="count">${d.links.length}</span></h2>
      ${d.links.length ? html`<div class="tbl"><table class="data"><thead><tr><th>活動／素材</th><th>來源／媒介</th><th>連結</th><th></th></tr></thead><tbody>
        ${d.links.map((l) => html`<tr><td class="small"><a href=${'#/c/' + l.campaign_id}>${byCampaign[l.campaign_id]?.code}</a><div class="muted">${crById[l.creative_id]?.code || '（活動層級）'}</div></td>
          <td class="small">${l.utm_source}／${l.utm_medium}</td><td><${Copy} text=${l.full_url} /></td>
          <td><button class="btn tiny ghost" onClick=${() => del('links', l.id)}>刪除</button></td></tr>`)}
      </tbody></table></div>` : html`<p class="muted">還沒有追蹤連結。</p>`}
    </section>
    <section class="panel">
      <h2 class="sec">LINE 領取碼 <span class="count">${d.claimCodes.length}</span></h2>
      ${d.claimCodes.length ? html`<div class="tbl"><table class="data"><thead><tr><th>領取碼</th><th>活動</th><th>素材</th><th>渠道</th><th></th></tr></thead><tbody>
        ${d.claimCodes.map((c) => html`<tr><td><code class="big">${c.code}</code></td><td><a href=${'#/c/' + c.campaign_id}>${byCampaign[c.campaign_id]?.code}</a></td><td class="small">${crById[c.creative_id]?.code || '—'}</td><td>${c.channel}</td>
          <td><button class="btn tiny ghost" onClick=${() => del('claim-codes', c.id)}>刪除</button></td></tr>`)}
      </tbody></table></div>` : html`<p class="muted">還沒有領取碼。</p>`}
    </section>
  </div>`;
}

// ---------- 資料來源 ----------
function ProjectSources({ d, reload }) {
  const p = d.project;
  const [edit, setEdit] = useState(null);
  return html`<div class="stack">
    <section class="panel">
      <h2 class="sec">資料來源</h2>
      <p class="sec-note">「資料已更新到」決定期間內的數字是否完整；超過這天的數字會標示「資料不完整」。</p>
      <div class="tbl"><table class="data"><thead><tr><th>來源</th><th>狀態</th><th>資料已更新到</th><th>最後異動</th><th>缺漏原因／備註</th><th></th></tr></thead>
        <tbody>${Object.entries(SOURCE_KINDS).map(([k, label]) => {
          const s = d.sources[k];
          const used = sourceUsed(p, k);
          return html`<tr><td>${label}</td>
            <td>${!used ? html`<span class="state s-not_computed sm">本專案未使用</span>` : s.connected ? html`<span class="state s-ok sm">已接入（人工／CSV）</span>` : html`<span class="state s-not_connected sm">尚未接入</span>`}</td>
            <td>${s.covered_through ? ymd(s.covered_through) : '—'}</td><td class="small">${s.updated_at ? s.updated_at.slice(0, 16).replace('T', ' ') : '—'}</td>
            <td class="small">${s.note || ''}</td><td><button class="btn tiny" onClick=${() => setEdit([k, label, s])}>編輯</button></td></tr>`;
        })}</tbody></table></div>
      <p class="note">第一版只支援人工登錄與 CSV 匯入；Meta 與 LINE 的 API 自動串接列為後續階段。</p>
    </section>
    <section class="panel">
      <div class="sec-row"><h2 class="sec">待辦</h2></div>
      ${d.todos.length ? html`<ul class="alerts">${d.todos.map((t) => html`<li class=${'alert lv-' + t.level}>
        <span class="alert-tag">${t.manual ? '□ 待辦' : '● 提醒'}</span>
        <div class="alert-body">${t.manual ? t.title : html`<a href=${t.link}>${t.title}</a>`}${t.detail || t.due ? html`<div class="alert-detail">${t.detail || '期限 ' + t.due}</div>` : null}</div>
        ${t.manual ? html`<button class="btn tiny" onClick=${async () => { await api('PUT', '/todos/' + t.id, { done: true }); reload(); }}>完成</button>` : null}
      </li>`)}</ul>` : html`<p class="muted">沒有待辦。</p>`}
      <${Form} submitLabel="新增待辦" onSubmit=${async (f, el) => { await api('POST', `/projects/${p.id}/todos`, f); el.reset(); reload(); }}>
        <div class="grid2"><${Field} label="待辦內容" name="title" required /><${Field} label="期限" name="due" type="date" /></div>
      </${Form}>
    </section>
    ${edit ? html`<${Modal} title=${'編輯資料來源：' + edit[1]} onClose=${() => setEdit(null)}>
      <${Form} onCancel=${() => setEdit(null)} onSubmit=${async (f) => { await api('PUT', `/projects/${p.id}/sources/${edit[0]}`, f); setEdit(null); reload(); }}>
        <label class="check"><input type="checkbox" name="connected" checked=${!!edit[2].connected} /> 已接入</label>
        <${Field} label="資料已更新到" name="covered_through" type="date" value=${edit[2].covered_through} />
        <${Field} label="缺漏原因／備註" name="note" value=${edit[2].note} type="textarea" />
      </${Form}>
    </${Modal}>` : null}
  </div>`;
}

// ---------- 專案設定 ----------
function ProjectSettings({ d, reload }) {
  const p = d.project;
  const [msg, setMsg] = useState('');
  return html`<div class="stack">
    ${msg ? html`<div class="ok-box" role="status">${msg}</div>` : null}
    <section class="panel">
      <h2 class="sec">專案資料與成果指標</h2>
      <${ProjectForm} p=${p} onDone=${() => { setMsg('已儲存'); reload(); }} />
    </section>
    <section class="panel">
      <h2 class="sec">帳號與入口</h2>
      ${d.accounts.length ? html`<div class="tbl"><table class="data"><thead><tr><th>類型</th><th>名稱</th><th>ID</th><th>歸屬</th><th>付款方</th><th>備註</th><th></th></tr></thead><tbody>
        ${d.accounts.map((a) => html`<tr><td>${Object.fromEntries(ACCOUNT_TYPES)[a.type]}</td><td>${a.name}</td><td class="small">${a.external_id || '—'}</td><td>${a.owner || '待填'}</td><td>${a.payer || '—'}</td><td class="small">${a.note}</td>
          <td><button class="btn tiny ghost" onClick=${async () => { await api('DELETE', '/accounts/' + a.id); reload(); }}>刪除</button></td></tr>`)}
      </tbody></table></div>` : html`<p class="muted">尚未登記帳號。</p>`}
      <${Form} submitLabel="新增帳號" onSubmit=${async (f, el) => { await api('POST', `/projects/${p.id}/accounts`, f); el.reset(); reload(); }}>
        <div class="grid3">
          <${Field} label="類型" name="type" options=${ACCOUNT_TYPES} />
          <${Field} label="名稱" name="name" />
          <${Field} label="帳號 ID" name="external_id" />
          <${Field} label="帳號歸屬" name="owner" placeholder="待填" />
          <${Field} label="付款方" name="payer" />
          <${Field} label="備註" name="note" />
        </div>
      </${Form}>
    </section>
  </div>`;
}

function ProjectForm({ p, onDone }) {
  const metrics = p ? Object.values(p.metrics) : null;
  const defaults = [['claim', '電子書領取'], ['lead', '名單'], ['valid_lead', '有效名單'], ['enroll', '報名'], ['payment', '付款'], ['refund', '退款']];
  const s = p?.settings || {};
  return html`<${Form} submitLabel=${p ? '儲存專案' : '建立專案'} onSubmit=${async (f) => {
    const m = defaults.map(([k]) => ({ key: k, label: f['m_label_' + k], enabled: f['m_on_' + k], def: f['m_def_' + k] }));
    const body = {
      code: f.code, claim_prefix: f.claim_prefix, name: f.name, kind: f.kind, partner: f.partner, owner: f.owner, goal: f.goal,
      budget: f.budget, status: f.status, data_scope: f.data_scope, metrics: m, is_test: f.is_test,
      settings: { minClicks: f.minClicks, minSpend: f.minSpend, adjustRatio: f.adjustRatio, quietDays: f.quietDays },
    };
    const r = p ? await api('PUT', '/projects/' + p.id, body) : await api('POST', '/projects', body);
    onDone(r.id || p.id);
  }}>
    <div class="grid3">
      <${Field} label="專案代碼" name="code" value=${p?.code} required disabled=${!!p} hint="2～5 個大寫英文字母，建立後不能改" />
      <${Field} label="領取碼字首" name="claim_prefix" value=${p?.claim_prefix} required disabled=${!!p} hint="1 個大寫英文字母，各專案不同" />
      <${Field} label="專案名稱" name="name" value=${p?.name} required />
      <${Field} label="類型" name="kind" value=${p?.kind || '合作'} options=${KINDS} />
      <${Field} label="合作對象／客戶" name="partner" value=${p?.partner} />
      <${Field} label="我方負責人" name="owner" value=${p?.owner} />
      <${Field} label="狀態" name="status" value=${p?.status || '規劃中'} options=${STATUS} />
      <${Field} label="專案總預算（元）" name="budget" type="number" min="0" value=${p?.budget} />
      <${Field} label="目標" name="goal" value=${p?.goal} />
      <${Field} label="資料使用範圍" name="data_scope" type="textarea" value=${p?.data_scope} wide />
    </div>
    ${p ? null : html`<label class="check"><input type="checkbox" name="is_test" id="f-is_test" /> 這是測試專案（畫面會標示「測試」，數字不當作實際營運資料）</label>`}
    <fieldset class="metrics-def">
      <legend>成果指標（本專案自行定義；未勾選的指標不計算、不接受匯入）</legend>
      <div class="tbl"><table class="data"><thead><tr><th>使用</th><th>名稱</th><th>定義</th></tr></thead><tbody>
        ${defaults.map(([k, l]) => {
          const m = metrics?.find((x) => x.key === k);
          return html`<tr><td><input type="checkbox" name=${'m_on_' + k} id=${'m_on_' + k} checked=${m ? m.enabled : true} aria-label=${'使用' + l} /></td>
            <td><input name=${'m_label_' + k} id=${'m_label_' + k} value=${m?.label || l} aria-label=${l + '名稱'} /></td>
            <td><input name=${'m_def_' + k} id=${'m_def_' + k} value=${m?.def || ''} placeholder="例：已加 LINE 且留下電話" aria-label=${l + '定義'} class="wide-input" /></td></tr>`;
        })}
      </tbody></table></div>
    </fieldset>
    <fieldset class="metrics-def">
      <legend>判斷門檻（持續／觀察／調整）</legend>
      <div class="grid3">
        <${Field} label="最少點擊數" name="minClicks" type="number" value=${s.minClicks ?? 100} />
        <${Field} label="最少花費（元）" name="minSpend" type="number" value=${s.minSpend ?? 3000} hint="點擊與花費都未達時只標「觀察」" />
        <${Field} label="成本高於目標幾倍要調整" name="adjustRatio" type="number" step="0.1" value=${s.adjustRatio ?? 1.5} />
        <${Field} label="幾天沒有成果要提醒" name="quietDays" type="number" value=${s.quietDays ?? 3} />
      </div>
    </fieldset>
  </${Form}>`;
}

function NewProject({ reloadNav }) {
  return html`<main class="page">
    <div class="page-head"><div><div class="crumb"><a href="#/">宣傳總覽</a> ／ 新增專案</div><h1>新增專案</h1>
      <p class="sub">每個專案獨立管理合作對象、目標、帳號、預算、名單與成果，不與其他專案混算。</p></div></div>
    <section class="panel"><${ProjectForm} onDone=${(id) => { reloadNav(); location.hash = '#/p/' + id + '/settings'; }} /></section>
  </main>`;
}

// ---------- 活動 ----------
function CampaignPage({ id, q }) {
  const st = useApi(`/campaigns/${id}?${q}`);
  const [modal, setModal] = useState(null);
  return html`<${Loading} state=${st}>${(d) => {
    const p = d.project; const c = d.campaign; const m = c.metrics;
    const keys = outcomeKeys(p);
    const close = () => setModal(null);
    const done = () => { setModal(null); st.reload(); };
    const days = [];
    if (c.start_date) {
      const from = c.start_date > d.range.from ? c.start_date : d.range.from;
      const endCap = c.end_date && c.end_date < d.range.to ? c.end_date : d.range.to;
      for (let x = from; x <= endCap; x = new Date(Date.parse(x) + 86400000).toISOString().slice(0, 10)) days.push(x);
    }
    const adBy = Object.fromEntries(d.daily.ads.map((r) => [r.date, r]));
    const convBy = Object.fromEntries(d.daily.conv.map((r) => [r.date, r.n]));
    const funnelSteps = [
      { label: '曝光', m: m.impressions }, { label: '連結點擊', m: m.link_clicks },
      ...keys.filter((k) => k !== 'payment').map((k) => ({ label: p.metrics[k].label, m: m[k] })),
      ...(p.metrics.payment?.enabled ? [{ label: p.metrics.payment.label + '（筆）', m: m.payment }] : []),
    ].filter((s) => s.m && s.m.s !== 'not_computed');
    return html`<main class="page">
      ${p.is_test ? html`<div class="test-banner" role="note"><b>測試資料</b> 這是測試專案的活動，數字由程式產生。</div>` : null}
      <div class="page-head">
        <div>
          <div class="crumb"><a href="#/">宣傳總覽</a> ／ <a href=${'#/p/' + p.id}>${p.code}</a> ／ 活動</div>
          <h1>${c.name}</h1>
          <p class="sub"><span class="proj-code">${c.code}</span>・<${Badge} kind="status">${c.status}</${Badge}>・${c.start_date ? ymd(c.start_date) + ' – ' + ymd(c.end_date) : '期間待填'}・負責人 ${c.owner || '待填'}</p>
          <p class="sub">${rangeText(d.range)}</p>
        </div>
        <div class="head-actions"><button class="btn small" onClick=${() => setModal('edit')}>編輯活動</button></div>
      </div>
      <section class="facts">
        <div><span>推廣什麼</span><b>${c.offer || '待填'}</b></div>
        <div><span>對誰</span><b>${c.audience || '待填'}</b></div>
        <div><span>導向哪裡</span><b>${c.destination || '待填'}</b></div>
        <div><span>領取流程</span><b>${c.flow || '未定'}</b></div>
        <div><span>預算</span><b>${c.budget ? fmt.money(c.budget) : '待填'}</b></div>
        <div><span>目標每筆成本</span><b>${c.target_cpl ? fmt.money(c.target_cpl) : '待填'}</b></div>
        <div><span>建議</span><b><${Judge} j=${c.judgement} /> <span class="muted small">${c.judgement.reason}</span></b></div>
      </section>
      ${d.anomalies.length || d.todos.length ? html`<section class="panel"><ul class="alerts">${[...d.anomalies, ...d.todos].map((a) => html`<${AlertItem} a=${a} />`)}</ul></section>` : null}
      <${MetricKpis} m=${m} project=${p} />
      <div class="two">
        <section class="panel"><h2 class="sec">漏斗</h2>${funnelSteps.length ? html`<${Funnel} steps=${funnelSteps} />` : html`<p class="muted">本專案尚未定義成果指標。</p>`}</section>
        <section class="panel">
          <h2 class="sec">每日趨勢</h2>
          ${days.length ? html`
            <${DailyBars} title="每日花費（元）" f="money" data=${days.map((x) => ({ date: x, v: adBy[x] ? adBy[x].spend : (c.paid ? null : 0) }))} missingLabel="沒有廣告資料" />
            ${d.daily.primary ? html`<${DailyBars} title=${'每日' + p.metrics[d.daily.primary].label} color="var(--series-3)" data=${days.map((x) => ({ date: x, v: convBy[x] || 0 }))} />` : null}
            <p class="note">斜線底的日子沒有廣告資料。成果圖的 0 只代表沒有紀錄；資料是否完整見上方指標。</p>`
            : html`<p class="muted">活動期間未設定或不在目前統計期間內。</p>`}
        </section>
      </div>
      <section class="panel">
        <div class="sec-row"><h2 class="sec">素材與渠道</h2><button class="btn primary small" onClick=${() => setModal('creative')}>＋ 新增素材／渠道</button></div>
        ${c.creatives.length ? html`<div class="tbl"><table class="data"><thead><tr><th>素材</th><th>渠道</th><th>狀態</th><th class="num">花費</th><th class="num">點擊</th><th class="num">點擊率</th>
          ${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}${m.primaryKey ? html`<th class="num">每筆${p.metrics[m.primaryKey].label}成本</th>` : null}<th>判斷</th><th></th></tr></thead>
          <tbody>${c.creatives.map((cr) => html`<tr>
            <td><b>${cr.code}</b><div class="muted small">${cr.name || '未命名'}${cr.links ? '' : '・⚠ 沒有追蹤連結'}</div></td>
            <td>${CHANNELS[cr.channel]}<div class="muted small">${cr.paid ? '付費' : '免費'}</div></td>
            <td><${Badge} kind="status">${cr.status}</${Badge}></td>
            <td class="num"><${V} m=${cr.metrics.spend} f="money" compact /></td><td class="num"><${V} m=${cr.metrics.link_clicks} compact /></td><td class="num"><${V} m=${cr.metrics.ctr} f="pct" compact /></td>
            ${keys.map((k) => html`<td class="num"><${V} m=${cr.metrics[k]} compact /></td>`)}
            ${m.primaryKey ? html`<td class="num"><${V} m=${cr.metrics.cost_primary} f="money" compact /></td>` : null}
            <td><${Judge} j=${cr.judgement} /></td>
            <td><button class="btn tiny" onClick=${() => setModal({ creative: cr })}>編輯</button></td>
          </tr>`)}</tbody></table></div>` : html`<${Empty} title="還沒有素材">新增 FB 廣告、免費貼文或其他引流渠道。</${Empty}>`}
      </section>
      <div class="two">
        <section class="panel">
          <div class="sec-row"><h2 class="sec">追蹤連結</h2><button class="btn small" onClick=${() => setModal('link')}>＋ 產生連結</button></div>
          ${d.links.length ? html`<ul class="link-list">${d.links.map((l) => html`<li><div class="small muted">${c.creatives.find((x) => x.id === l.creative_id)?.code || '活動層級'}・${l.utm_source}／${l.utm_medium}</div><${Copy} text=${l.full_url} /></li>`)}</ul>` : html`<p class="muted">還沒有追蹤連結。</p>`}
        </section>
        <section class="panel">
          <div class="sec-row"><h2 class="sec">LINE 領取碼</h2><button class="btn small" onClick=${() => setModal('code')}>＋ 新增領取碼</button></div>
          ${d.claimCodes.length ? html`<ul class="link-list">${d.claimCodes.map((x) => html`<li><code class="big">${x.code}</code> <span class="small muted">${x.channel}${x.creative_id ? '・' + (c.creatives.find((y) => y.id === x.creative_id)?.code || '') : ''}</span></li>`)}</ul>` : html`<p class="muted">還沒有領取碼。</p>`}
        </section>
      </div>
      ${modal === 'edit' ? html`<${CampaignForm} project=${p} campaigns=${[]} c=${c} onClose=${close} onDone=${done} />` : null}
      ${modal === 'creative' || modal?.creative ? html`<${CreativeForm} c=${c} cr=${modal.creative} onClose=${close} onDone=${done} />` : null}
      ${modal === 'link' ? html`<${Modal} title="產生追蹤連結" onClose=${close}>
        <${Form} submitLabel="產生" onCancel=${close} onSubmit=${async (f) => { await api('POST', `/campaigns/${c.id}/links`, f); done(); }}>
          <${Field} label="素材" name="creative_id" options=${[['', '活動層級（不指定素材）'], ...c.creatives.map((x) => [x.id, x.code])]} />
          <${Field} label="導向網址" name="base_url" placeholder="https://..." required hint="落地頁或表單網址；系統會加上 UTM 參數" />
          <div class="grid2">
            <${Field} label="utm_source" name="utm_source" options=${UTM_SOURCES} />
            <${Field} label="utm_medium" name="utm_medium" options=${UTM_MEDIUMS} />
          </div>
          <${Field} label="utm_term（選填，受眾代碼）" name="utm_term" placeholder="aud01" />
        </${Form}>
      </${Modal}>` : null}
      ${modal === 'code' ? html`<${Modal} title="新增 LINE 領取碼" onClose=${close}>
        <${Form} onCancel=${close} onSubmit=${async (f) => { await api('POST', `/campaigns/${c.id}/claim-codes`, f); done(); }}>
          <${Field} label="領取碼" name="code" value=${suggestClaimCode(p.claim_prefix, d.claimCodes.map((x) => x.code).concat(['']))} required hint=${`${p.claim_prefix} 加 3 位數；不可與本專案其他領取碼重複`} />
          <${Field} label="素材" name="creative_id" options=${[['', '不指定'], ...c.creatives.map((x) => [x.id, x.code])]} />
          <${Field} label="渠道說明" name="channel" placeholder="例：FB 付費廣告" />
        </${Form}>
      </${Modal}>` : null}
    </main>`;
  }}</${Loading}>`;
}

function CreativeForm({ c, cr, onClose, onDone }) {
  const [format, setFormat] = useState('VD');
  const existing = c.creatives.map((x) => x.code);
  return html`<${Modal} title=${cr ? '編輯素材／渠道' : '新增素材／渠道'} onClose=${onClose}>
    <${Form} onCancel=${onClose} onSubmit=${async (f) => {
      if (cr) await api('PUT', '/creatives/' + cr.id, f); else await api('POST', `/campaigns/${c.id}/creatives`, f);
      onDone();
    }}>
      ${cr ? null : html`<div class="field"><label for="f-format">格式</label><select id="f-format" value=${format} onChange=${(e) => setFormat(e.target.value)}>
        ${Object.entries(FORMATS).map(([k, v]) => html`<option value=${k}>${k} ${v}</option>`)}</select></div>`}
      <${Field} label="素材代碼" name="code" value=${cr?.code || suggestCreativeCode(c.code, format, existing)} disabled=${!!cr} required hint="建立後不能改；內容修改請新增新版本（v2）" />
      <${Field} label="名稱" name="name" value=${cr?.name} />
      <${Field} label="渠道" name="channel" value=${cr?.channel || 'fb_ad'} options=${Object.entries(CHANNELS)} hint="FB 付費廣告一律計為付費" />
      <label class="check"><input type="checkbox" name="paid" checked=${!!cr?.paid} /> 其他渠道也有付費（例如合作方收費曝光）</label>
      <${Field} label="狀態" name="status" value=${cr?.status || '規劃中'} options=${STATUS} />
      <${Field} label="平台 ID（廣告 ID、貼文 ID）" name="platform_ref" value=${cr?.platform_ref} />
    </${Form}>
  </${Modal}>`;
}

// ---------- App ----------
function App() {
  const hash = useHash();
  const [period, setPeriodState] = useState(loadPeriod);
  const [nav, setNav] = useState({ projects: [], me: null });
  const [navTick, setNavTick] = useState(0);
  useEffect(() => {
    Promise.all([api('GET', '/projects'), api('GET', '/me')]).then(([projects, me]) => setNav({ projects, me })).catch(() => {});
  }, [navTick]);
  const setPeriod = (p) => { setPeriodState(p); try { localStorage.setItem('promo-period', JSON.stringify(p)); } catch { /* 無法儲存時只保留在畫面上 */ } };
  const q = periodQuery(period);
  const parts = hash.replace(/^#\/?/, '').split('/');
  let page; let current = '';
  const reloadNav = () => setNavTick((t) => t + 1);
  if (parts[0] === 'p' && parts[1]) { current = parts[1]; page = html`<${ProjectPage} id=${parts[1]} tab=${parts[2] || 'campaigns'} q=${q} me=${nav.me} reloadNav=${reloadNav} />`; }
  else if (parts[0] === 'c' && parts[1]) page = html`<${CampaignPage} id=${parts[1]} q=${q} />`;
  else if (parts[0] === 'new') page = html`<${NewProject} reloadNav=${reloadNav} />`;
  else page = html`<${Overview} q=${q} />`;
  return html`<div>
    ${window.__PREVIEW__ ? html`<div class="preview-bar">預覽版：資料只存在這個瀏覽器分頁，重新整理就恢復成測試資料。<button class="btn tiny" onClick=${() => window.__RESET__ && window.__RESET__()}>重設測試資料</button></div>` : null}
    <${TopBar} period=${period} setPeriod=${setPeriod} projects=${nav.projects} current=${current} me=${nav.me} />
    ${page}
    <footer class="foot">宣傳戰情室 v0.1・開發測試版・人工登錄與 CSV 匯入${nav.me ? '・登入：' + nav.me.email : ''}</footer>
  </div>`;
}

export function mount() {
  render(html`<${App} />`, document.getElementById('app'));
}
