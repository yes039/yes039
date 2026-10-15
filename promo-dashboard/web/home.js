// 宣傳總覽：A 日常 FB 發文、B 付費廣告專案、集中待辦、資料更新狀態
import { html, api, useApi, V, Kpi, Badge, Loading } from './ui.js';
import { fmt, md, rangeText } from './format.js';
import { OrganicTable, CountRules, TodoTable, outcomeKeys, freshText, sourceUsed, NO_PAID_LABEL } from './shared.js';
import { SOURCE_KINDS } from '../src/metrics.js';

export function Home({ q }) {
  const st = useApi('/home?' + q);
  return html`<${Loading} state=${st}>${(d) => {
    const testOnly = d.projects.every((p) => p.project.is_test);
    const o = d.organic;
    return html`<main class="page">
      ${testOnly ? html`<div class="test-banner" role="note"><b>測試資料</b> 目前畫面上的貼文、專案與數字都是標示【測試】的程式產生資料，不是實際營運資料。</div>` : null}
      <div class="page-head">
        <div><h1>宣傳總覽</h1>
          <p class="sub">${rangeText(d.range)}・廣告與成果統計到 ${md(d.range.to)}（今天的資料隔天才完整）</p></div>
      </div>

      ${o ? html`<section class="zone" aria-labelledby="h-a">
        <div class="zone-head">
          <h2 id="h-a"><span class="zone-tag a">A</span> 日常 FB 發文</h2>
          <div class="zone-links"><a class="btn small" href="#/organic?view=calendar">發文日曆</a><a class="btn small" href="#/organic?view=list">貼文清單</a></div>
        </div>
        <div class="kpis compact">
          <${Kpi} label="預計發文"><span class="val">${fmt.int(o.total.counts.planned)}</span></${Kpi}>
          <${Kpi} label="已發文"><span class="val">${fmt.int(o.total.counts.published)}</span></${Kpi}>
          <${Kpi} label="待發文" sub=${o.total.counts.overdue ? html`<span class="late">其中逾期 ${o.total.counts.overdue}</span>` : '沒有逾期'}><span class="val">${fmt.int(o.total.counts.pending)}</span></${Kpi}>
          <${Kpi} label="按讚" m=${o.total.likes} sub="已發布貼文累計" />
          <${Kpi} label="留言" m=${o.total.comments} sub="已發布貼文累計" />
          <${Kpi} label="分享" m=${o.total.shares} sub=${o.total.metricsAsOf ? '最早統計截至 ' + o.total.metricsAsOf.slice(5).replace('-', '/') : '人工登錄'} />
        </div>
        <${OrganicTable} first="發布主體" rows=${o.bySubject.map((s) => ({ ...s, sub: `${s.outlets} 個帳號或社團` }))} total=${o.total} linkOf=${(r) => '#/organic?type=' + r.type} />
        <p class="note">${o.definition}。取消 ${o.total.counts.cancelled} 篇不計入預計。</p>
        <${CountRules} />
      </section>` : html`<section class="zone"><p class="muted">日常發文只開放系統管理者查看。</p></section>`}

      <section class="zone" aria-labelledby="h-b">
        <div class="zone-head">
          <h2 id="h-b"><span class="zone-tag b">B</span> 付費廣告專案</h2>
          ${d.user.isAdmin ? html`<div class="zone-links"><a class="btn small" href="#/new">＋ 新增專案</a></div>` : null}
        </div>
        <div class="proj-grid">${d.projects.map((p) => html`<${ProjectCard} p=${p} range=${d.range} />`)}</div>
        <p class="note">花費、曝光、點擊是平台數字；名單、報名、付款由各專案自行定義，總覽不跨專案加總。</p>
      </section>

      <section class="zone" aria-labelledby="h-todo">
        <div class="zone-head"><h2 id="h-todo">待辦與異常</h2></div>
        <${TodoTable} items=${d.todos} onDone=${async (t) => { await api('PUT', '/todos/' + t.id, { done: true }); st.reload(); }} />
      </section>

      <section class="zone" aria-labelledby="h-src">
        <div class="zone-head"><h2 id="h-src">資料來源與更新</h2></div>
        <div class="tbl"><table class="data">
          <thead><tr><th>來源</th><th class="hide-sm">取得方式</th><th>最新與完整度</th></tr></thead>
          <tbody>
            ${o ? html`<tr><td>日常發文互動<div class="show-sm small muted">人工登錄（每篇貼文）</div></td><td class="hide-sm">人工登錄（每篇貼文）</td><td>${o.total.metricsAsOf ? '最早統計截至 ' + o.total.metricsAsOf : '尚未登錄'}${o.total.likes.s === 'incomplete' ? '・' + o.total.likes.r : ''}</td></tr>` : null}
            ${d.projects.flatMap((p) => Object.entries(SOURCE_KINDS).filter(([k]) => (k === 'ads' ? p.paidCreatives > 0 : sourceUsed(p.project, k))).map(([k, label]) => html`<tr>
              <td><span class="proj-code">${p.project.code}</span> ${label}<div class="show-sm small muted">${k === 'ads' ? 'Meta 匯出 CSV／人工登錄' : 'CSV 匯入／人工登錄'}</div></td>
              <td class="small hide-sm">${k === 'ads' ? 'Meta 匯出 CSV／人工登錄（API 待串接）' : 'CSV 匯入／人工登錄'}</td>
              <td>${freshText(p.sources[k], k === 'ads' ? p.missingAdDates : null)}</td></tr>`))}
          </tbody>
        </table></div>
      </section>
    </main>`;
  }}</${Loading}>`;
}

function ProjectCard({ p }) {
  const { project, metrics: m, cumulative: cum, groups: g } = p;
  const budget = project.budget;
  const used = p.budget.used;
  const hasPaid = p.paidCreatives > 0;
  const pk = m.primaryKey;
  const pkLabel = pk ? project.metrics[pk].label : null;
  const has = (k) => project.metrics[k]?.enabled;
  const prog = cum.enrollProgress;
  return html`<article class="proj-card">
    <a class="proj-card-head" href=${'#/p/' + project.id}>
      <div><span class="proj-code">${project.code}</span> ${project.is_test ? html`<${Badge} kind="test">測試</${Badge}>` : null} <${Badge} kind="status">${project.status}</${Badge}></div>
      <h3>${project.name}</h3>
      ${hasPaid ? null : html`<div class="no-paid"><span class="pstat st-todo">${NO_PAID_LABEL}</span></div>`}
      <div class="muted small">推廣目標：${project.goal || '待填'}</div>
      <div class="muted small">投放期間：${p.flight ? `${md(p.flight.from)}–${md(p.flight.to)}` : '待填'}${p.active.length ? `・進行中 ${p.active.length} 波` : ''}</div>
    </a>
    ${hasPaid ? html`<dl class="mini">
      <div><dt>本期花費</dt><dd><${V} m=${m.spend} f="money" compact showNA incLabel="已知小計" /></dd></div>
      <div><dt>專案累計花費</dt><dd><${V} m=${cum.spend} f="money" compact showNA incLabel="已知小計" /></dd></div>
      <div><dt>總預算</dt><dd>${budget ? fmt.money(budget) : html`<span class="muted small">待填</span>`}</dd></div>
      ${pk ? html`<div><dt>本期付費廣告${pkLabel}</dt><dd><${V} m=${g.paid[pk]} compact /></dd></div>
        <div><dt>本期免費引流${pkLabel}</dt><dd><${V} m=${g.free[pk]} compact /></dd></div>
        <div><dt>本期來源不明${pkLabel}</dt><dd><${V} m=${g.unknown[pk]} compact /></dd></div>
        <div class="wide"><dt>付費廣告每筆${pkLabel}成本</dt><dd><${V} m=${m.cost_primary} f="money" compact why /></dd></div>` : null}
    </dl>` : html`<dl class="mini">
      <div><dt>總預算</dt><dd>${budget ? fmt.money(budget) : html`<span class="muted small">待填</span>`}</dd></div>
      <div class="wide"><dt>廣告花費與成本</dt><dd><span class="state s-not_computed sm">尚未啟用付費廣告，不計算</span></dd></div>
      ${!outcomeKeys(project).length ? html`<div class="wide"><dt>成果</dt><dd><span class="state s-not_computed sm">本專案尚未定義成果指標</span></dd></div>` : null}
    </dl>`}
    ${has('enroll') ? html`<div class="prog small">
      <div>本期新增報名 <b><${V} m=${m.enroll} compact /></b>・累計報名 <b><${V} m=${cum.all.enroll} compact /></b>${project.target_enroll ? ` ÷ 目標 ${project.target_enroll}` : html`・目標<span class="tbd">待填</span>`}${prog.v != null ? html`＝<${V} m=${prog} f="pct" compact />` : null}</div>
      ${prog.v != null ? html`<div class="budget-bar" role="img" aria-label=${'累計招生達成 ' + fmt.pct(prog.v)}><span style=${`width:${Math.min(100, prog.v * 100)}%`}></span></div>` : null}
      <div class="muted">累計：專案開始至 ${md(cum.to)}，不隨期間改變</div>
    </div>` : null}
    ${budget && used.v != null ? html`<div class="budget"><div class="budget-bar" role="img" aria-label=${(used.s === 'incomplete' ? '預算使用至少 ' : '預算使用 ') + fmt.pct(used.v)}><span style=${`width:${Math.min(100, used.v * 100)}%`} class=${(used.v > 1 ? 'over' : used.v > 0.9 ? 'near' : '') + (used.s === 'incomplete' ? ' partial' : '')}></span></div>
      <div class="small muted">預算使用 ${used.s === 'incomplete' ? '至少 ' : ''}${fmt.pct(used.v)}：累計${used.s === 'incomplete' ? '已知小計' : ''} ${fmt.money(used.n)} ÷ 總預算 ${fmt.money(budget)}</div></div>` : null}
    ${hasPaid ? html`<div class="small muted">廣告數字：${freshText(p.sources.ads, p.missingAdDates)}</div>` : null}
    <div class="card-foot small">${p.anomalies ? html`<span class="lv-text serious">▲ 異常 ${p.anomalies}</span>` : null}<span>□ 待辦 ${p.todos}</span><a href=${'#/p/' + project.id}>查看專案 →</a></div>
  </article>`;
}
