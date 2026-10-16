// 付費廣告專案：專案總覽、廣告素材比較、投放波次、登錄與匯入、代碼與連結、資料來源、設定；以及波次頁
import { useState } from 'preact/hooks';
import { html, api, useApi, V, Kpi, Judge, AlertItem, Badge, Empty, Modal, Form, Field, Tabs, Copy, Loading } from './ui.js';
import { DailyBars, Funnel, InlineBar } from './charts.js';
import { fmt, md, ymd, rangeText } from './format.js';
import { CHANNELS, FORMATS, UTM_SOURCES, UTM_MEDIUMS, suggestCampaignCode, suggestCreativeCode, suggestClaimCode } from '../src/tracking.js';
import { SOURCE_KINDS, OUTCOME_TYPES } from '../src/metrics.js';
import { outcomeKeys, sourceUsed, freshText, TodoTable, OrganicSummary, OutcomeGroups, NO_PAID_LABEL, EnrollProgress } from './shared.js';

const STATUS = ['規劃中', '進行中', '暫停', '已結束'];
const KINDS = ['合作', '自有課程', '客戶', '自有品牌'];
const ACCOUNT_TYPES = [['fb_page', 'FB 粉專'], ['ad_account', '廣告帳號'], ['line_oa', 'LINE 官方帳號'], ['landing', '落地頁'], ['enroll', '報名系統'], ['payment', '收款'], ['other', '其他']];

const PROJECT_TABS = [['overview', '專案總覽'], ['creatives', '廣告素材比較'], ['campaigns', '投放波次'], ['entry', '登錄與匯入'], ['tracking', '代碼與連結'], ['sources', '資料來源'], ['settings', '專案設定']];

export function ProjectPage({ id, tab = 'overview', q, me, reloadNav }) {
  const st = useApi(`/projects/${id}?${q}`);
  return html`<${Loading} state=${st}>${(d) => {
    const p = d.project;
    return html`<main class="page">
      ${p.is_test ? html`<div class="test-banner" role="note"><b>測試資料</b> 這是測試專案，數字由程式產生，不是實際營運資料。</div>` : null}
      <div class="page-head">
        <div>
          <div class="crumb"><a href="#/">宣傳總覽</a> ／ 專案</div>
          <h1>${p.name}</h1>
          <p class="sub"><span class="proj-code">${p.code}</span>・${p.kind}${p.partner ? '・' + p.partner : ''}・負責人 ${p.owner || '待填'}・<${Badge} kind="status">${p.status}</${Badge}>${!d.creatives.some((c) => c.paid) ? html` <span class="pstat st-todo">${NO_PAID_LABEL}</span>` : null}</p>
          <p class="sub">${rangeText(d.range)}・廣告與成果統計到 ${md(d.range.to)}</p>
        </div>
        ${window.__PREVIEW__ ? null : html`<a class="btn ghost small" href=${`/api/projects/${id}/export.csv?${q}`} download>匯出本專案 CSV</a>`}
      </div>
      <${Tabs} tabs=${PROJECT_TABS} active=${tab} base=${'#/p/' + id} />
      ${tab === 'overview' ? html`<${ProjectOverview} d=${d} reload=${st.reload} />` : null}
      ${tab === 'creatives' ? html`<${ProjectCreatives} d=${d} reload=${st.reload} />` : null}
      ${tab === 'campaigns' ? html`<${ProjectCampaigns} d=${d} reload=${st.reload} />` : null}
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
    <${Kpi} label="本期花費" m=${m.spend} f="money" sub=${m.spendCum ? html`累計 <${V} m=${m.spendCum} f="money" compact incLabel="已知小計" />` : null} />
    <${Kpi} label="曝光" m=${m.impressions} />
    <${Kpi} label="連結點擊" m=${m.link_clicks} sub=${html`點擊率 <${V} m=${m.ctr} f="pct" compact />（點擊 ÷ 曝光）`} />
    ${keys.map((k) => html`<${Kpi} label=${project.metrics[k].label} m=${m[k]}
      sub=${k === pk ? html`付費廣告 <${V} m=${m.paid[k]} compact />・每筆成本 <${V} m=${m.cost_primary} f="money" compact why />` : k === 'enroll' ? html`付費廣告 <${V} m=${m.paid.enroll} compact />・每筆成本 <${V} m=${m.cost_enroll} f="money" compact why />` : null} />`)}
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
    <section class="panel">
      <div class="sec-row"><h2 class="sec">投放波次</h2><button class="btn primary small" onClick=${() => setEdit({})}>＋ 新增波次</button></div>
      ${d.campaigns.length ? html`<div class="tbl"><table class="data">
        <thead><tr><th>波次</th><th>狀態</th><th>期間</th><th class="num">本期花費</th><th class="num">點擊</th>
          ${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}
          ${d.metrics.primaryKey ? html`<th class="num">付費廣告每筆${p.metrics[d.metrics.primaryKey].label}成本</th>` : null}
          ${p.metrics.payment?.enabled ? html`<th class="num">付款淨額</th>` : null}<th>判斷</th></tr></thead>
        <tbody>
          ${d.campaigns.map((c) => html`<tr>
            <td><a href=${'#/c/' + c.id}><b>${c.name}</b></a><div class="muted small">${c.code}・${c.offer || '推廣內容待填'}</div></td>
            <td><${Badge} kind="status">${c.status}</${Badge}></td>
            <td class="nowrap small">${c.start_date ? md(c.start_date) + '–' + md(c.end_date) : '待填'}</td>
            <td class="num"><${V} m=${c.metrics.spend} f="money" compact /><${InlineBar} v=${c.metrics.spend.v} max=${maxSpend} /><div class="muted small">波次累計 <${V} m=${c.metrics.spendCum} f="money" compact incLabel="已知小計" />${c.budget ? '／預算 ' + fmt.money(c.budget) : ''}</div></td>
            <td class="num"><${V} m=${c.metrics.link_clicks} compact /></td>
            ${keys.map((k) => html`<td class="num"><${V} m=${c.metrics[k]} compact /></td>`)}
            ${d.metrics.primaryKey ? html`<td class="num"><${V} m=${c.metrics.cost_primary} f="money" compact why />${c.target_cpl ? html`<div class="muted small">目標 ${fmt.money(c.target_cpl)}</div>` : null}</td>` : null}
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
      <p class="note">專案合計以人去重，可能小於各活動相加。成本＝本期付費花費 ÷ 同期可歸因至付費廣告的成果，免費渠道與來源不明不進分母；花費或成果資料不完整時暫不計算。「!」表示資料不完整，滑鼠移上去看原因。</p>`
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

// ---------- 登錄與匯入 ----------
function ProjectEntry({ d, reload }) {
  const p = d.project;
  const creatives = d.creatives;
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
            <${Field} label="投放紀錄（選填）" name="placement_id" options=${[['', '不分投放紀錄'], ...paidCreatives.flatMap((c) => (c.placements || []).map((pl) => [pl.id, pl.code]))]} hint="選了投放紀錄時以它所屬的素材為準" />
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
            <${Field} label="類型" name="type" options=${[...enabled.map((t) => [t, p.metrics[t].label]), ...(p.metrics.enroll?.enabled ? [['cancel', '取消報名']] : [])]} hint="取消報名需填電話或 Email 與原因；恢復報名請登錄一筆新的「報名」" />
            <${Field} label="日期" name="date" type="date" value=${today} required />
            <${Field} label="來源（素材）" name="creative_id" options=${[['', '不指定素材'], ...creatives.map((c) => [c.id, c.code])]} />
            <${Field} label="或只指定活動" name="campaign_id" options=${[['', '來源不明'], ...d.campaigns.map((c) => [c.id, c.code])]} hint="指定素材時以素材為準" />
            <${Field} label="數量" name="qty" type="number" min="1" value="1" />
            <${Field} label="金額（付款、退款）" name="amount" type="number" min="0" />
            <${Field} label="電話（選填，用於去重）" name="phone" hint="只存雜湊值，不存原文" />
            <${Field} label="Email（選填）" name="email" type="email" />
            <${Field} label="這類資料已更新到" name="coveredThrough" type="date" />
            <${Field} label="備註（取消報名請填原因）" name="note" />
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
      <${TodoTable} items=${[...d.anomalies, ...d.todos]} showProject=${false} scope="本專案全部未完成事項（含跨期，不受所選週／月影響）" onDone=${async (t) => { await api('PUT', '/todos/' + t.id, { done: true }); reload(); }} />
      <${Form} submitLabel="新增待辦" onSubmit=${async (f, el) => { await api('POST', `/projects/${p.id}/todos`, f); el.reset(); reload(); }}>
        <div class="grid3"><${Field} label="待辦內容" name="title" required /><${Field} label="負責人" name="owner" /><${Field} label="期限" name="due" type="date" /></div>
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
  const defaults = [['inquiry', '詢問'], ['claim', '電子書領取'], ['lead', '名單'], ['valid_lead', '有效名單'], ['enroll', '報名'], ['payment', '付款'], ['refund', '退款']];
  const s = p?.settings || {};
  return html`<${Form} submitLabel=${p ? '儲存專案' : '建立專案'} onSubmit=${async (f) => {
    const m = defaults.map(([k]) => ({ key: k, label: f['m_label_' + k], enabled: f['m_on_' + k], def: f['m_def_' + k] }));
    const body = {
      code: f.code, claim_prefix: f.claim_prefix, name: f.name, kind: f.kind, partner: f.partner, owner: f.owner, goal: f.goal,
      audience: f.audience, course_info: f.course_info, course_dates: f.course_dates, price_info: f.price_info, target_enroll: f.target_enroll,
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
      <${Field} label="推廣目標" name="goal" value=${p?.goal} />
      <${Field} label="對象" name="audience" value=${p?.audience} placeholder="待填" />
      <${Field} label="課程或產品資訊" name="course_info" value=${p?.course_info} placeholder="待填" />
      <${Field} label="開課日期" name="course_dates" value=${p?.course_dates} placeholder="待填" />
      <${Field} label="價格與優惠" name="price_info" value=${p?.price_info} placeholder="待填" />
      <${Field} label="招生目標（人）" name="target_enroll" type="number" min="0" value=${p?.target_enroll} />
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

export function NewProject({ reloadNav }) {
  return html`<main class="page">
    <div class="page-head"><div><div class="crumb"><a href="#/">宣傳總覽</a> ／ 新增專案</div><h1>新增專案</h1>
      <p class="sub">每個專案獨立管理合作對象、目標、帳號、預算、名單與成果，不與其他專案混算。</p></div></div>
    <section class="panel"><${ProjectForm} onDone=${(id) => { reloadNav(); location.hash = '#/p/' + id + '/settings'; }} /></section>
  </main>`;
}

// ---------- 活動 ----------
export function CampaignPage({ id, q }) {
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

function CreativeForm({ c, campaigns, cr, onClose, onDone }) {
  const list = campaigns || [c];
  const [campId, setCampId] = useState(cr?.campaign_id || c?.id || list[0]?.id);
  const [format, setFormat] = useState('VD');
  const camp = list.find((x) => x.id === campId) || c;
  const existing = (camp?.creatives || []).map((x) => x.code);
  return html`<${Modal} title=${cr ? '編輯素材' : '新增素材'} onClose=${onClose} wide>
    <${Form} onCancel=${onClose} onSubmit=${async (f) => {
      if (!f.preview_url && cr?.preview_url) delete f.preview_url;
      if (!f.video_url && cr?.video_url) delete f.video_url;
      if (cr) await api('PUT', '/creatives/' + cr.id, f); else await api('POST', `/campaigns/${campId}/creatives`, f);
      onDone();
    }}>
      <div class="grid2">
        ${cr ? null : html`<div class="field"><label for="f-camp">投放波次</label><select id="f-camp" value=${campId} onChange=${(e) => setCampId(e.target.value)}>${list.map((x) => html`<option value=${x.id}>${x.code}｜${x.name}</option>`)}</select></div>
          <div class="field"><label for="f-format">格式</label><select id="f-format" value=${format} onChange=${(e) => setFormat(e.target.value)}>${Object.entries(FORMATS).map(([k, v]) => html`<option value=${k}>${k} ${v}</option>`)}</select></div>`}
        <${Field} label="素材代碼（含版本）" name="code" value=${cr?.code || suggestCreativeCode(camp.code, format, existing)} disabled=${!!cr} required hint="建立後不能改；內容修改請新增新版本（v2）" />
        <${Field} label="素材名稱" name="name" value=${cr?.name} />
        <${Field} label="渠道" name="channel" value=${cr?.channel || 'fb_ad'} options=${Object.entries(CHANNELS)} hint="FB 付費廣告一律計為付費" />
        <${Field} label="負責人" name="owner" value=${cr?.owner} />
        <${Field} label="製作與審核" name="prod_status" value=${cr?.prod_status || '製作中'} options=${['製作中', '待審核', '已核可']} />
        <${Field} label="投放狀態" name="status" value=${cr?.status || '規劃中'} options=${STATUS} hint="未核可前不能設為進行中" />
        <${Field} label="標題" name="headline" value=${cr?.headline} />
        <${Field} label="行動按鈕" name="cta" value=${cr?.cta} placeholder="例：了解詳情、立即報名" />
        <${Field} label="廣告文案" name="copy_text" type="textarea" value=${cr?.copy_text} wide />
        <${Field} label="訴求" name="appeal" value=${cr?.appeal} />
        <${Field} label="導向位置" name="destination" value=${cr?.destination} />
        <${Field} label="圖片或影片封面網址" name="preview_url" value=${cr?.preview_url?.startsWith('data:') ? '' : cr?.preview_url} placeholder="https://..." hint=${cr?.preview_url?.startsWith('data:') ? '目前是測試示意圖；留空會保留' : '第一版只存網址，上傳檔案待後續'} wide />
        <${Field} label="影片網址" name="video_url" value=${cr?.video_url?.startsWith('data:') ? '' : cr?.video_url} placeholder="https://...（.mp4／.webm）" hint=${cr?.video_url?.startsWith('data:') ? '目前是測試示意影片；留空會保留' : '影片素材只填封面時，畫面會標「僅封面，尚未提供影片」'} wide />
        <${Field} label="實際落地頁網址" name="landing_url" value=${cr?.landing_url} placeholder="https://..." wide />
        <${Field} label="平台 ID（廣告 ID）" name="platform_ref" value=${cr?.platform_ref} />
      </div>
      <label class="check"><input type="checkbox" name="paid" checked=${!!cr?.paid} /> 其他渠道也有付費</label>
    </${Form}>
  </${Modal}>`;
}

// ---------- App ----------

// ---------- 專案總覽 ----------
function Info({ label, v }) {
  return html`<div><span>${label}</span><b>${v && v !== '待填' ? v : html`<span class="tbd">待填</span>`}</b></div>`;
}

function ProjectOverview({ d, reload }) {
  const p = d.project;
  const m = d.metrics;
  const has = (k) => p.metrics[k]?.enabled;
  const rel = d.relatedPosts;
  const cum = d.cumulative;
  const pk = m.primaryKey;
  const pkLabel = pk ? p.metrics[pk].label : '成果';
  const hasPaid = d.creatives.some((c) => c.paid);
  const used = d.budget.used;
  const prog = cum.enrollProgress;
  return html`<div class="stack">
    <section class="facts" aria-label="專案資料">
      <${Info} label="推廣目標" v=${p.goal} />
      <${Info} label="對象" v=${p.audience} />
      <${Info} label="課程資訊" v=${p.course_info} />
      <${Info} label="開課日期" v=${p.course_dates} />
      <${Info} label="價格與優惠" v=${p.price_info} />
      <${Info} label="招生目標" v=${p.target_enroll ? p.target_enroll + ' 人' : ''} />
      <${Info} label="合作對象" v=${p.partner} />
      <${Info} label="投放期間" v=${d.flight ? `${ymd(d.flight.from)} – ${ymd(d.flight.to)}` : ''} />
    </section>

    <section class="panel">
      <h2 class="sec">預算與花費</h2>
      ${hasPaid ? null : html`<p class="sec-note"><span class="pstat st-todo">${NO_PAID_LABEL}</span> 本專案還沒有付費素材，花費與廣告成本不計算。</p>`}
      <div class="kpis compact">
        <${Kpi} label="總預算"><span class="val">${p.budget ? fmt.money(p.budget) : html`<span class="tbd">待填</span>`}</span></${Kpi}>
        <${Kpi} label="本期花費" sub=${'所選期間；' + freshText(d.sources.ads, m.missingAdDates)}><${V} m=${m.spend} f="money" incLabel="已知小計" showNA why /></${Kpi}>
        <${Kpi} label="專案累計花費" sub=${cum.from ? `${md(cum.from)} 起至 ${md(cum.to)}${cum.spend.s === 'incomplete' ? '；' + cum.spend.r : ''}` : '尚未開始投放'}><${V} m=${cum.spend} f="money" incLabel="已知小計" showNA why /></${Kpi}>
        <${Kpi} label="預算使用率" sub=${used.s === 'incomplete' ? '累計花費缺資料，實際使用率不低於此數' : used.v != null ? '專案累計花費 ÷ 總預算' : null}><${V} m=${used} f="pct" incLabel="缺資料" prefix="至少" showNA why /></${Kpi}>
      </div>
      ${used.v != null ? html`<div class="budget-bar big" role="img" aria-label=${(used.s === 'incomplete' ? '預算使用至少 ' : '預算使用 ') + fmt.pct(used.v)}><span style=${`width:${Math.min(100, used.v * 100)}%`} class=${(used.v > 1 ? 'over' : used.v > 0.9 ? 'near' : '') + (used.s === 'incomplete' ? ' partial' : '')}></span></div>
        <p class="note">計算：專案累計花費${used.s === 'incomplete' ? '（已知小計）' : ''} ${fmt.money(used.n)} ÷ 總預算 ${fmt.money(used.d)}${used.s === 'incomplete' ? '；缺資料的日子補齊後數字只會增加' : ''}。本期花費只算所選期間，波次累計見「投放波次」。</p>` : null}
    </section>

    <section class="panel" aria-labelledby="h-period">
      <h2 class="sec" id="h-period">本期成果 <span class="sec-sub">${rangeText(d.range)}</span></h2>
      ${outcomeKeys(p).length ? html`
        <${OutcomeGroups} project=${p} groups=${d.groups} total=${m} />
        ${hasPaid && pk ? html`<div class="kpis compact cost-cards">
          <${Kpi} label=${`付費廣告每筆${pkLabel}成本`} sub=${m.cost_primary.v != null ? `本期付費花費 ÷ 付費廣告${pkLabel}` : `本期付費花費 ÷ 付費廣告${pkLabel}；免費名單不進分母`}><${V} m=${m.cost_primary} f="money" showNA why /></${Kpi}>
          ${has('enroll') ? html`<${Kpi} label="付費廣告每筆報名成本" sub="本期付費花費 ÷ 付費廣告報名"><${V} m=${m.cost_enroll} f="money" showNA why /></${Kpi}>` : null}
          <${Kpi} label="已知花費" sub=${m.spend.s === 'incomplete' ? m.spend.r : '所選期間'}><${V} m=${m.spend} f="money" incLabel="已知小計" showNA why /></${Kpi}>
        </div>
        <p class="note">付費廣告成本只用「同期間、可歸因至付費廣告素材」的成果當分母；免費引流（例如 LINE）與來源不明另列，不進分母。花費或成果資料不完整時，正式成本顯示「暫不計算」，已知花費標「已知小計」。</p>` : null}`
      : html`<${Kpi} label="成果指標" m=${{ v: null, s: 'not_computed', r: '本專案尚未定義成果指標，請到「專案設定」定義' }} />`}
    </section>

    ${has('enroll') ? html`<section class="panel" aria-labelledby="h-prog">
      <h2 class="sec" id="h-prog">招生進度</h2>
      <div class="kpis compact">
        <${Kpi} label="本期新增報名" sub=${'第一次報名在 ' + rangeText(d.range)}><${V} m=${d.enrollment.period.new} showNA why /></${Kpi}>
        <${Kpi} label="累計有效報名" sub="累計報名 − 目前取消"><${V} m=${cum.enrollment.valid} showNA why /></${Kpi}>
        <${Kpi} label="招生目標"><span class="val">${p.target_enroll ? p.target_enroll + ' 人' : html`<span class="tbd">待填</span>`}</span></${Kpi}>
      </div>
      <${EnrollProgress} prog=${prog} cum=${cum} />
      <div class="tbl"><table class="data enroll-tbl">
        <thead><tr><th>報名狀態（以人去重）</th><th class="num">本期<div class="small muted">${rangeText(d.range)}</div></th><th class="num">累計<div class="small muted">至 ${md(cum.to)}</div></th></tr></thead>
        <tbody>
          <tr><td><b>報名</b><div class="small muted">本期：第一次報名在期間內；累計：曾完成報名</div></td><td class="num"><${V} m=${d.enrollment.period.new} compact /></td><td class="num"><${V} m=${cum.enrollment.ever} compact /></td></tr>
          <tr><td><b>取消報名</b><div class="small muted">本期：期間內取消的人；累計：目前仍為取消的人</div></td><td class="num"><${V} m=${d.enrollment.period.cancel} compact /></td><td class="num"><${V} m=${cum.enrollment.cancelled} compact /></td></tr>
          <tr><td><b>恢復報名</b><div class="small muted">取消後再報名，不重複計人</div></td><td class="num"><${V} m=${d.enrollment.period.restore} compact /></td><td class="num"><${V} m=${cum.enrollment.restored} compact /></td></tr>
          <tr class="total"><td><b>有效報名</b><div class="small muted">累計報名 − 目前取消；用於招生達成率</div></td><td class="num">—</td><td class="num"><${V} m=${cum.enrollment.valid} compact /></td></tr>
        </tbody></table></div>
      <p class="note">累計報名中：付費廣告 ${fmt.int(cum.groups.paid.enroll.v ?? 0)}、免費引流 ${fmt.int(cum.groups.free.enroll.v ?? 0)}、來源不明 ${fmt.int(cum.groups.unknown.enroll.v ?? 0)} 人（以第一次報名的來源計，三者相加可能大於合計）。</p>
      ${d.enrollment.cancels.length ? html`<details class="rules-box"><summary>取消報名紀錄（${d.enrollment.cancels.length}）</summary>
        <div class="tbl"><table class="data"><thead><tr><th>取消日期</th><th>原因</th><th class="hide-sm">來源素材</th><th>目前狀態</th><th class="hide-sm">登錄時間</th></tr></thead>
        <tbody>${d.enrollment.cancels.map((c) => html`<tr><td class="nowrap">${md(c.date)}</td><td>${c.reason || '—'}</td><td class="small hide-sm">${c.creative || '來源不明'}</td><td class="small">${c.status}</td><td class="small nowrap hide-sm">${String(c.recorded_at).slice(0, 16).replace('T', ' ')}</td></tr>`)}</tbody></table></div>
        <p class="note">個人資料只存電話或 Email 的雜湊值，這裡不顯示個人身分。</p></details>` : null}
      <details class="rules-box"><summary>報名、取消、退款怎麼算</summary><ul>
        <li><b>累計報名</b>：曾完成報名的人數，同一電話或 Email 只算一人。</li>
        <li><b>取消報名</b>：獨立紀錄，保存取消日期、原因與登錄時間；必須能對應到已報名的人，已取消的人不能重複取消。</li>
        <li><b>有效報名</b>：累計報名扣除目前仍為取消的人；取消後再報名＝恢復，不重複計人。招生達成率＝有效報名 ÷ 招生目標。</li>
        <li><b>退款</b>：獨立處理，不視為取消報名，只用在「付款淨額＝付款金額 − 退款金額」（含部分退款）。</li>
        <li>報名資料沒有更新到昨天時，只寫「已知有效報名」，達成率暫不計算。</li>
      </ul></details>
      ${has('payment') ? html`<div class="tbl"><table class="data pay">
        <thead><tr><th></th><th class="num">付款筆數</th><th class="num">付款金額</th><th class="num">退款筆數</th><th class="num">退款金額</th><th class="num">付款淨額</th></tr></thead>
        <tbody>
          <tr><td><b>本期</b></td><td class="num"><${V} m=${m.payment} compact /></td><td class="num"><${V} m=${m.payment_amount} f="money" compact /></td><td class="num"><${V} m=${m.refund} compact /></td><td class="num"><${V} m=${m.refund_amount} f="money" compact /></td><td class="num"><${V} m=${m.net_amount} f="money" compact /></td></tr>
          <tr><td><b>累計</b></td><td class="num"><${V} m=${cum.all.payment} compact /></td><td class="num"><${V} m=${cum.all.payment_amount} f="money" compact /></td><td class="num"><${V} m=${cum.all.refund} compact /></td><td class="num"><${V} m=${cum.all.refund_amount} f="money" compact /></td><td class="num"><${V} m=${cum.all.net_amount} f="money" compact /></td></tr>
        </tbody></table></div>` : null}
      ${hasPaid && cum.cost_primary ? html`<p class="note">專案累計付費廣告每筆${pkLabel}成本：<${V} m=${cum.cost_primary} f="money" compact why /></p>` : null}
    </section>` : null}

    <div class="two">
      <section class="panel">
        <div class="sec-row"><h2 class="sec">專用付費廣告</h2><a class="btn small" href=${'#/p/' + p.id + '/creatives'}>素材比較 →</a></div>
        ${d.creatives.filter((c) => c.paid).length ? html`<ul class="mini-list">${d.creatives.filter((c) => c.paid).map((c) => html`<li>
          <a href=${'#/p/' + p.id + '/creatives'}><b>${c.name || c.code}</b></a> <${Judge} j=${c.judgement} />
          <div class="muted small">${c.code}・本期花費 <${V} m=${c.metrics.spend} f="money" compact showNA />・${p.metrics[m.primaryKey]?.label || '成果'} <${V} m=${c.metrics[m.primaryKey]} compact /></div></li>`)}</ul>` : html`<p class="muted">沒有付費廣告素材。</p>`}
      </section>
      <section class="panel">
        <h2 class="sec">相關自然貼文</h2>
        ${rel.visible ? html`
          <p class="sec-note">日常貼文中選填「支援本專案」的貼文。互動與詢問為人工登錄，<b>不與廣告成果相加</b>，按讚多不代表招生有效。</p>
          <div class="kpis compact">
            <${Kpi} label="已發文"><span class="val">${rel.summary.counts.published}</span></${Kpi}>
            <${Kpi} label="待發文"><span class="val">${rel.summary.counts.pending}</span></${Kpi}>
            <${Kpi} label="按讚" m=${rel.summary.likes} />
            <${Kpi} label="可確認詢問" m=${rel.summary.inquiries} />
          </div>
          ${rel.posts.length ? html`<ul class="mini-list">${rel.posts.map((x) => html`<li><a href=${'#/post/' + x.id}>${x.title}</a>
            <div class="muted small">${x.outlet_name}・${x.published_date ? '發布 ' + md(x.published_date) : '預定 ' + md(x.planned_date)}・${x.status}</div></li>`)}</ul>` : html`<p class="muted">這段期間沒有相關貼文。</p>`}`
          : html`<p class="muted">自然貼文只開放系統管理者查看。</p>`}
      </section>
    </div>

    <section class="panel">
      <h2 class="sec">本專案的異常與待辦</h2>
      <${TodoTable} items=${[...d.anomalies, ...d.todos]} showProject=${false} scope="本專案全部未完成事項（含跨期，不受所選週／月影響）" onDone=${async (t) => { await api('PUT', '/todos/' + t.id, { done: true }); reload(); }} />
    </section>
  </div>`;
}

// ---------- 廣告素材比較 ----------
const PROD_CLASS = { 製作中: 'st-todo', 待審核: 'st-review', 已核可: 'st-done' };

/** 素材分組：進行中 → 待審核／製作中／規劃中／暫停 → 已結束（預設收起）。素材編號依建立順序固定，不因分組改變 */
function creativeGroups(paid) {
  const numbered = paid.map((c, i) => ({ ...c, n: i + 1 }));
  return {
    live: numbered.filter((c) => !c.ended && c.status === '進行中'),
    upcoming: numbered.filter((c) => !c.ended && c.status !== '進行中'),
    ended: numbered.filter((c) => c.ended),
  };
}
const version = (c) => c.code.split('-').at(-1);

/** 素材檔：圖片可點擊放大、影片可播放；沒有檔案或只有封面時明確標示；測試示意圖另外標示 */
function Media({ c, onZoom, big }) {
  const mock = html`<${AssetTag} c=${c} />`;
  if (c.video_url) {
    return html`<div class=${'media' + (big ? ' big' : '')}>
      <video controls preload="metadata" playsinline poster=${c.preview_url || undefined} src=${c.video_url} aria-label=${'素材影片：' + (c.name || c.code)}></video>
      ${mock}</div>`;
  }
  if (c.preview_url) {
    return html`<div class=${'media' + (big ? ' big' : '')}>
      <button type="button" class="zoom" onClick=${onZoom} aria-label=${'放大圖片：' + (c.name || c.code)}><img src=${c.preview_url} alt=${'素材預覽：' + (c.name || c.code)} loading="lazy" /><span class="zoom-hint" aria-hidden="true">⤢ 放大</span></button>
      ${c.format === 'VD' ? html`<span class="media-flag">僅封面，尚未提供影片</span>` : null}
      ${mock}</div>`;
  }
  return html`<div class=${'media none' + (big ? ' big' : '')}><span>尚未提供素材</span></div>`;
}

/** 測試／正式標記（明確欄位）；與缺檔案、僅封面等狀態分開顯示 */
function AssetTag({ c }) {
  return c.asset_status === '正式'
    ? html`<span class="asset-tag official" title=${`由 ${c.asset_confirmed_by || '—'} 於 ${String(c.asset_confirmed_at || '').slice(0, 16).replace('T', ' ')} 確認`}>正式素材</span>`
    : html`<span class="asset-tag test">測試素材・未確認為正式</span>`;
}

function AssetStatusBox({ c, isTestProject, onChanged }) {
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const set = async (status) => {
    setErr('');
    try { await api('POST', `/creatives/${c.id}/asset-status`, { status, confirm: status === '正式' ? ok : undefined }); onChanged(); } catch (x) { setErr(x.message); }
  };
  return html`<div class="asset-box">
    <div><b>素材標記：</b><${AssetTag} c=${c} />
      ${c.asset_status === '正式' ? html` <span class="small muted">由 ${c.asset_confirmed_by} 於 ${String(c.asset_confirmed_at || '').slice(0, 16).replace('T', ' ')} 確認</span>` : null}</div>
    ${isTestProject ? html`<div class="small muted">本專案是測試專案：即使素材標為正式，整個專案的數字仍是測試資料。</div>` : null}
    ${c.asset_status === '正式'
      ? html`<button type="button" class="btn small" onClick=${() => set('測試')}>改回測試</button>`
      : html`<label class="check"><input type="checkbox" checked=${ok} onChange=${(e) => setOk(e.currentTarget.checked)} /> 我已確認這份素材的圖片、影片與文案是可對外使用的正式版本</label>
        <button type="button" class="btn small primary" disabled=${!ok} onClick=${() => set('正式')}>確認為正式素材</button>
        <div class="small muted">新素材一律預設「測試」；更換圖片或影片後會退回「測試」，需要再確認一次。</div>`}
    ${err ? html`<p class="form-err" role="alert">${err}</p>` : null}
  </div>`;
}

function Lightbox({ c, onClose }) {
  return html`<${Modal} title=${`放大檢視：素材 ${c.n}・${c.name || c.code}`} onClose=${onClose} wide>
    <div class="lightbox"><img src=${c.preview_url} alt=${'素材圖片：' + (c.name || c.code)} /></div>
    <p class="note"><${AssetTag} c=${c} /></p>
    ${c.format === 'VD' && !c.video_url ? html`<p class="note">僅封面，尚未提供影片。</p>` : null}
  </${Modal}>`;
}

function LandingLink({ c }) {
  return c.landing_url
    ? html`<a href=${c.landing_url} target="_blank" rel="noopener noreferrer" class="landing">開啟落地頁 ↗</a>${/example\.com/.test(c.landing_url) ? html` <span class="small muted">（測試網址）</span>` : null}`
    : html`<span class="tbd">尚未提供落地頁</span>`;
}

function CreativeDetail({ c, p, d, keys, onClose, onZoom, onEdit, onChanged }) {
  const m = c.metrics;
  return html`<${Modal} title=${`素材 ${c.n}・${c.name || '未命名'}`} onClose=${onClose} wide>
    <div class="cr-detail">
      <${Media} c=${c} big onZoom=${onZoom} />
      <dl class="cr-facts">
        <div><dt>素材編號</dt><dd>素材 ${c.n}・<code>${c.code}</code></dd></div>
        <div><dt>版本</dt><dd>${version(c)}</dd></div>
        <div><dt>波次</dt><dd>${c.campaign_code}</dd></div>
        <div><dt>負責人</dt><dd>${c.owner || '待指派'}</dd></div>
        <div><dt>製作與審核</dt><dd><span class=${'pstat ' + (PROD_CLASS[c.prod_status] || '')}>${c.prod_status}</span></dd></div>
        <div><dt>投放狀態</dt><dd>${c.ended ? '已結束' : c.status}</dd></div>
        <div class="wide"><dt>標題</dt><dd>${c.headline || html`<span class="tbd">待填</span>`}</dd></div>
        <div class="wide"><dt>文案</dt><dd class="copy-full">${c.copy_text || html`<span class="tbd">待填</span>`}</dd></div>
        <div><dt>行動按鈕（CTA）</dt><dd>${c.cta || html`<span class="tbd">待填</span>`}</dd></div>
        <div><dt>訴求</dt><dd>${c.appeal || '—'}</dd></div>
        <div><dt>導向</dt><dd>${c.destination || '—'}</dd></div>
        <div><dt>實際落地頁</dt><dd><${LandingLink} c=${c} /></dd></div>
      </dl>
    </div>
    <${AssetStatusBox} c=${c} isTestProject=${!!p.is_test} onChanged=${onChanged} />
    <h3 class="sub-sec">各受眾投放紀錄</h3>
    ${c.placements.length ? html`<div class="tbl"><table class="data"><thead><tr><th>受眾／設定</th><th>期間</th><th>狀態</th><th class="num">本期花費</th><th class="num">累計花費</th><th class="num">點擊率</th></tr></thead>
      <tbody>${c.placements.map((pl) => html`<tr><td><b>${pl.audience || '未填受眾'}</b><div class="muted small">${pl.code}・${pl.setting || ''}</div></td>
        <td class="small nowrap">${md(pl.start_date)}–${md(pl.end_date)}</td><td class="small">${pl.status}</td>
        <td class="num"><${V} m=${pl.metrics.spend} f="money" compact showNA /></td><td class="num">${fmt.money(pl.metrics.spendAll || 0)}</td><td class="num"><${V} m=${pl.metrics.ctr} f="pct" compact /></td></tr>`)}</tbody></table></div>
      <p class="note">投放紀錄只分廣告數字；成果只追蹤到素材層。</p>`
      : html`<p class="muted small">沒有分受眾的投放紀錄，花費記在素材本身。</p>`}
    <h3 class="sub-sec">${c.ended ? '歷史成效' : '本期成效'}</h3>
    ${c.ended && m.spend.s === 'not_computed' ? html`<p class="small muted">所選期間沒有投放；上方期間改選「全部」可看這份素材的完整歷史成效。</p>` : null}
    <dl class="mini">
      <div><dt>本期花費</dt><dd><${V} m=${m.spend} f="money" compact showNA incLabel="已知小計" /></dd></div>
      <div><dt>累計花費</dt><dd><${V} m=${m.spendCum} f="money" compact incLabel="已知小計" /></dd></div>
      <div><dt>曝光</dt><dd><${V} m=${m.impressions} compact /></dd></div>
      <div><dt>連結點擊</dt><dd><${V} m=${m.link_clicks} compact /></dd></div>
      ${keys.map((k) => html`<div><dt>${p.metrics[k].label}</dt><dd><${V} m=${m[k]} compact /></dd></div>`)}
      ${m.primaryKey ? html`<div><dt>每筆${p.metrics[m.primaryKey].label}成本</dt><dd><${V} m=${m.cost_primary} f="money" compact why /></dd></div>` : null}
    </dl>
    <div class="judge-box"><${Judge} j=${c.judgement} /> <span class="small">${c.judgement.reason}</span>
      ${c.judgement.basis?.length ? html`<div class="muted small">依據：${c.judgement.basis.join('；')}</div>` : null}</div>
    <div class="form-actions"><button class="btn" onClick=${onEdit}>編輯素材</button><button class="btn primary" onClick=${onClose}>關閉</button></div>
  </${Modal}>`;
}

function ProjectCreatives({ d, reload }) {
  const p = d.project;
  const [modal, setModal] = useState(null);
  const [showEnded, setShowEnded] = useState(false);
  const keys = ['inquiry', 'valid_lead', 'enroll'].filter((k) => p.metrics[k]?.enabled);
  const pk = d.metrics.primaryKey;
  const paid = d.creatives.filter((c) => c.paid);
  const free = d.creatives.filter((c) => !c.paid);
  const g = creativeGroups(paid);
  const close = () => setModal(null);
  const done = () => { setModal(null); reload(); };
  const open = (c) => setModal({ type: 'detail', id: c.id });
  const numbered = [...g.live, ...g.upcoming, ...g.ended];
  const zoom = (c) => setModal({ type: 'zoom', cr: c });
  const row = (c) => html`<tr class=${c.ended ? 'ended' : ''}><td><button type="button" class="linklike" onClick=${() => open(c)}><b>素材 ${c.n}</b>・${c.name}</button><div class="muted small">${c.code}・${c.ended ? '已結束' : c.status}・${c.prod_status}・${c.asset_status === '正式' ? '正式素材' : '測試素材'}</div></td>
    <td class="num"><${V} m=${c.metrics.spend} f="money" compact showNA incLabel="已知小計" /></td><td class="num hide-sm"><${V} m=${c.metrics.impressions} compact /></td>
    <td class="num"><${V} m=${c.metrics.ctr} f="pct" compact /></td>
    ${keys.map((k) => html`<td class="num"><${V} m=${c.metrics[k]} compact /></td>`)}
    ${pk ? html`<td class="num"><${V} m=${c.metrics.cost_primary} f="money" compact why /></td>` : null}
    <td><${Judge} j=${c.judgement} /></td></tr>`;
  const cols = 5 + keys.length + (pk ? 1 : 0);
  const cards = (list) => html`<div class="cr-grid">${list.map((c) => html`<${CreativeCard} c=${c} p=${p} d=${d} keys=${keys} onOpen=${() => open(c)} onZoom=${() => zoom(c)} onEdit=${() => setModal({ type: 'creative', cr: c })} onPlacement=${(pl) => setModal({ type: 'placement', cr: c, pl })} />`)}</div>`;
  return html`<div class="stack">
    <div class="sec-row"><p class="sec-note">先看比較表，點素材名稱看完整圖片、影片與文案。素材編號依建立順序固定；已結束的素材預設收起。</p>
      <button class="btn primary small" onClick=${() => setModal({ type: 'creative' })} disabled=${!d.campaigns.length}>＋ 新增素材</button></div>
    <section class="panel" aria-labelledby="h-cmp">
      <h2 class="sec" id="h-cmp">素材比較表</h2>
      <div class="tbl"><table class="data cmp">
        <thead><tr><th>素材</th><th class="num">本期花費</th><th class="num hide-sm">曝光</th><th class="num">點擊率</th>
          ${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}${pk ? html`<th class="num">每筆${p.metrics[pk].label}成本</th>` : null}<th>判斷</th></tr></thead>
        <tbody>
          ${g.live.length ? html`<tr class="grp"><td colspan=${cols}>投放中（${g.live.length}）</td></tr>${g.live.map(row)}` : null}
          ${g.upcoming.length ? html`<tr class="grp"><td colspan=${cols}>待審核／製作中／未開始（${g.upcoming.length}）</td></tr>${g.upcoming.map(row)}` : null}
          ${g.ended.length ? html`<tr class="grp"><td colspan=${cols}><button type="button" class="linklike" aria-expanded=${showEnded} onClick=${() => setShowEnded(!showEnded)}>${showEnded ? '▾' : '▸'} 已結束（${g.ended.length}）：${showEnded ? '收起' : '展開看歷史成效'}</button></td></tr>${showEnded ? g.ended.map(row) : null}` : null}
          ${keys.length ? html`<tr class="unknown"><td><b>只對應到波次</b><div class="muted small">有波次代碼、沒有素材代碼</div></td><td class="num">—</td><td class="num hide-sm">—</td><td class="num">—</td>
            ${keys.map((k) => html`<td class="num">${fmt.int(d.campaignOnly[k] || 0)}</td>`)}${pk ? html`<td></td>` : null}<td></td></tr>
          <tr class="unknown"><td><b>來源不明</b><div class="muted small">無法確認來自哪份素材或波次</div></td><td class="num">—</td><td class="num hide-sm">—</td><td class="num">—</td>
            ${keys.map((k) => html`<td class="num">${fmt.int(d.unknown[k] || 0)}</td>`)}${pk ? html`<td></td>` : null}<td></td></tr>` : null}
        </tbody>
      </table></div>
      <p class="note">點擊率＝連結點擊 ÷ 曝光；每筆成本＝該素材本期花費 ÷ 該素材可歸因的成果。已結束的素材只顯示歷史成效，不給投放建議；投放中的素材在資料完整且達到樣本門檻後才給「持續／觀察／調整」，否則顯示「暫不判斷」。</p>
    </section>
    ${g.live.length || g.upcoming.length ? html`<section aria-labelledby="h-cards"><h2 class="sec" id="h-cards">素材卡</h2>${cards([...g.live, ...g.upcoming])}</section>` : null}
    ${g.ended.length ? html`<details class="ended-box" open=${showEnded} onToggle=${(e) => setShowEnded(e.currentTarget.open)}><summary>已結束的素材 ${g.ended.length} 份（歷史成效）</summary>${cards(g.ended)}</details>` : null}
    ${free.length ? html`<section class="panel"><h2 class="sec">其他免費引流渠道</h2>
      <div class="tbl"><table class="data"><thead><tr><th>渠道</th>${keys.map((k) => html`<th class="num">${p.metrics[k].label}</th>`)}</tr></thead>
        <tbody>${free.map((c) => html`<tr><td><b>${c.name}</b><div class="muted small">${c.code}・${CHANNELS[c.channel]}</div></td>${keys.map((k) => html`<td class="num"><${V} m=${c.metrics[k]} compact /></td>`)}</tr>`)}</tbody></table></div>
      <p class="note">免費渠道不計廣告成本。</p></section>` : null}
    ${modal?.type === 'detail' ? (() => { const cr = numbered.find((x) => x.id === modal.id); return cr ? html`<${CreativeDetail} c=${cr} p=${p} d=${d} keys=${keys} onClose=${close} onZoom=${() => zoom(cr)} onEdit=${() => setModal({ type: 'creative', cr })} onChanged=${reload} />` : null; })() : null}
    ${modal?.type === 'zoom' ? html`<${Lightbox} c=${modal.cr} onClose=${close} />` : null}
    ${modal?.type === 'creative' ? html`<${CreativeForm} campaigns=${d.campaigns} cr=${modal.cr} onClose=${close} onDone=${done} />` : null}
    ${modal?.type === 'placement' ? html`<${PlacementForm} cr=${modal.cr} pl=${modal.pl} onClose=${close} onDone=${done} />` : null}
  </div>`;
}

function CreativeCard({ c, p, d, keys, onOpen, onZoom, onEdit, onPlacement }) {
  const m = c.metrics;
  return html`<article class=${'cr-card' + (c.ended ? ' ended' : '')}>
    <div class="cr-top">
      <${Media} c=${c} onZoom=${onZoom} />
      <div class="cr-head">
        <div class="small muted">素材 ${c.n}・${c.code}</div>
        <h3>${c.name || '未命名'}</h3>
        <div class="cr-tags"><span class=${'pstat ' + (PROD_CLASS[c.prod_status] || '')}>${c.prod_status}</span><${Badge} kind="status">投放：${c.ended ? '已結束' : c.status}</${Badge}></div>
        <div class="small muted">${version(c)}・負責人 ${c.owner || '待指派'}</div>
      </div>
    </div>
    <dl class="cr-copy">
      <div><dt>標題</dt><dd>${c.headline || html`<span class="tbd">待填</span>`}</dd></div>
      <div><dt>文案</dt><dd class="clamp">${c.copy_text || html`<span class="tbd">待填</span>`}</dd></div>
      <div><dt>行動按鈕</dt><dd>${c.cta || '—'}</dd></div>
      <div><dt>落地頁</dt><dd><${LandingLink} c=${c} /></dd></div>
    </dl>
    <dl class="mini">
      <div><dt>本期花費</dt><dd><${V} m=${m.spend} f="money" compact showNA incLabel="已知小計" /></dd></div>
      <div><dt>累計花費</dt><dd><${V} m=${m.spendCum} f="money" compact incLabel="已知小計" /></dd></div>
      <div><dt>連結點擊</dt><dd><${V} m=${m.link_clicks} compact /></dd></div>
      ${keys.map((k) => html`<div><dt>${p.metrics[k].label}</dt><dd><${V} m=${m[k]} compact /></dd></div>`)}
    </dl>
    <div class="small muted">廣告數字：${m.spend.s === 'not_computed' ? m.spend.r : freshText(d.sources.ads, m.missingAdDates)}</div>
    <div class="judge-box"><${Judge} j=${c.judgement} /> <span class="small">${c.judgement.reason}</span>
      ${c.judgement.basis?.length ? html`<div class="muted small">依據：${c.judgement.basis.join('；')}</div>` : null}</div>
    <details class="pl">
      <summary>各受眾投放紀錄 ${c.placements.length ? `（${c.placements.length} 組）` : '（未分組，花費記在素材）'}</summary>
      ${c.placements.length ? html`<div class="tbl"><table class="data"><thead><tr><th>受眾／設定</th><th>期間</th><th class="num">本期花費</th><th class="num">點擊率</th><th></th></tr></thead>
        <tbody>${c.placements.map((pl) => html`<tr><td><b>${pl.audience || '未填受眾'}</b><div class="muted small">${pl.code}・${pl.setting || ''}</div></td>
          <td class="small nowrap">${md(pl.start_date)}–${md(pl.end_date)}</td><td class="num"><${V} m=${pl.metrics.spend} f="money" compact /></td><td class="num"><${V} m=${pl.metrics.ctr} f="pct" compact /></td>
          <td><button class="btn tiny" onClick=${() => onPlacement(pl)}>編輯</button></td></tr>`)}</tbody></table></div>
        <p class="note">投放紀錄只分廣告數字；成果只追蹤到素材層。${c.unplacedSpend ? `另有 ${fmt.money(c.unplacedSpend)} 未對應投放紀錄。` : ''}</p>` : null}
      <button class="btn tiny" onClick=${() => onPlacement(null)}>＋ 新增投放紀錄</button>
    </details>
    <div class="cr-foot"><button class="btn small primary" onClick=${onOpen}>看完整素材</button> <button class="btn small" onClick=${onEdit}>編輯素材</button></div>
  </article>`;
}

function PlacementForm({ cr, pl, onClose, onDone }) {
  const n = String((cr.placements?.length || 0) + 1).padStart(2, '0');
  return html`<${Modal} title=${pl ? '編輯投放紀錄' : '新增投放紀錄'} onClose=${onClose}>
    <${Form} onCancel=${onClose} onSubmit=${async (f) => { if (pl) await api('PUT', '/placements/' + pl.id, f); else await api('POST', `/creatives/${cr.id}/placements`, f); onDone(); }}>
      <${Field} label="投放紀錄代碼" name="code" value=${pl?.code || `${cr.code}-A${n}`} disabled=${!!pl} hint="廣告名稱以這個代碼開頭，匯入時會對應到這組投放" />
      <${Field} label="受眾" name="audience" value=${pl?.audience} />
      <${Field} label="投放設定" name="setting" value=${pl?.setting} placeholder="版位、出價方式等" />
      <div class="grid2"><${Field} label="開始日" name="start_date" type="date" value=${pl?.start_date} /><${Field} label="結束日" name="end_date" type="date" value=${pl?.end_date} /></div>
      <${Field} label="狀態" name="status" value=${pl?.status || '規劃中'} options=${STATUS} />
    </${Form}>
  </${Modal}>`;
}
