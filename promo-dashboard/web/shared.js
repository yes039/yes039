// 首頁、日常發文、專案頁共用的小元件
import { useState } from 'preact/hooks';
import { html, V } from './ui.js';
import { md, fmt } from './format.js';
import { OUTCOME_TYPES } from '../src/metrics.js';

export function outcomeKeys(project) {
  return OUTCOME_TYPES.filter((t) => t !== 'refund' && project.metrics[t]?.enabled);
}

export function sourceUsed(project, kind) {
  if (kind === 'ads') return true;
  const map = { inquiry: ['inquiry'], claim: ['claim'], lead: ['lead', 'valid_lead'], enroll: ['enroll'], payment: ['payment', 'refund'] };
  return (map[kind] || []).some((t) => project.metrics[t]?.enabled);
}

/** 最新日期與完整度分開寫：「更新至 10/14・缺 10/12」 */
export function freshText(src, missing) {
  if (!src?.connected) return '尚未接入';
  const parts = [`更新至 ${md(src.covered_through)}`];
  if (missing?.length) parts.push(`缺 ${missing.slice(0, 3).map(md).join('、')}${missing.length > 3 ? ` 等 ${missing.length} 天` : ''}`);
  return parts.join('・');
}

const POST_STATUS_CLASS = { 待製作: 'st-todo', 待審核: 'st-review', 待發布: 'st-ready', 已發布: 'st-done', 取消: 'st-cancel', 逾期: 'st-late' };
export function PostStatus({ status, late }) {
  const s = late ? '逾期' : status;
  return html`<span class=${'pstat ' + (POST_STATUS_CLASS[s] || '')}>${late ? '⚠ 逾期・' + status : status}</span>`;
}

/** 依發布主體或位置的發文表；手機上互動欄位收到第二行 */
export function OrganicTable({ rows, first, linkOf, total }) {
  const cell = (r) => html`
    <td class="num">${fmt.int(r.counts.planned)}</td>
    <td class="num">${fmt.int(r.counts.published)}</td>
    <td class="num">${fmt.int(r.counts.pending)}${r.counts.overdue ? html`<div class="late small">逾期 ${r.counts.overdue}</div>` : null}</td>
    <td class="num hide-sm"><${V} m=${r.likes} compact showNA /></td>
    <td class="num hide-sm"><${V} m=${r.comments} compact showNA /></td>
    <td class="num hide-sm"><${V} m=${r.shares} compact showNA /></td>`;
  return html`<div class="tbl"><table class="data organic">
    <thead><tr><th>${first}</th><th class="num">預計發文</th><th class="num">已發文</th><th class="num">待發文</th><th class="num hide-sm">按讚</th><th class="num hide-sm">留言</th><th class="num hide-sm">分享</th></tr></thead>
    <tbody>
      ${rows.map((r) => html`<tr>
        <td><a href=${linkOf(r)}><b>${r.label}</b></a>${r.sub ? html`<div class="muted small">${r.sub}</div>` : null}
          <div class="show-sm small muted">讚 <${V} m=${r.likes} compact showNA />・留言 <${V} m=${r.comments} compact showNA />・分享 <${V} m=${r.shares} compact showNA /></div></td>
        ${cell(r)}
      </tr>`)}
      ${total ? html`<tr class="total"><td><b>合計</b><div class="show-sm small muted">讚 <${V} m=${total.likes} compact showNA />・留言 <${V} m=${total.comments} compact showNA />・分享 <${V} m=${total.shares} compact showNA /></div></td>${cell(total)}</tr>` : null}
    </tbody>
  </table></div>`;
}

export function CountRules() {
  return html`<details class="rules-box">
    <summary>計數與互動口徑</summary>
    <ul>
      <li><b>預計發文</b>：預定日期在期間內、狀態不是「取消」。</li>
      <li><b>已發文</b>：實際發布日期在期間內（不論預定哪天），所以可能包含期外預定的貼文。</li>
      <li><b>待發文</b>：預定日期在期間內、尚未發布、未取消；預定日已過者另標「逾期」。</li>
      <li><b>取消</b>：預定在期間內但取消，不算入預計。</li>
      <li>同一題材發到不同位置，每個位置各算一筆。</li>
      <li><b>互動</b>：期間內實際發布的貼文，到各篇「統計截至」時間為止的累計數字（人工登錄），不是期間內新增的互動。尚未登錄的貼文不以 0 計。</li>
    </ul>
  </details>`;
}

const KIND_ORDER = ['全部', '內容', '回覆', '廣告異常', '預算', '資料', '人工待辦'];
const LEVEL_TAG = { critical: ['嚴重', '■'], serious: ['注意', '▲'], warning: ['提醒', '●'], manual: ['待辦', '□'] };

/** 集中待辦：類型、事項、負責人、期限、狀態、處理入口；需人工的項目標示 */
export function TodoTable({ items, limit = 5, showProject = true, onDone, scope }) {
  const [kind, setKind] = useState('全部');
  const [all, setAll] = useState(false);
  const kinds = KIND_ORDER.filter((k) => k === '全部' || items.some((i) => i.kind === k));
  const list = items.filter((i) => kind === '全部' || i.kind === kind);
  const shown = all ? list : list.slice(0, limit);
  return html`<div>
    ${scope ? html`<p class="todo-scope"><b>範圍：</b>${scope}</p>` : null}
    <div class="chips" role="group" aria-label="待辦類型">${kinds.map((k) => html`<button type="button" class=${'chip' + (k === kind ? ' on' : '')} aria-pressed=${k === kind} onClick=${() => { setKind(k); setAll(false); }}>
      ${k}${k !== '全部' ? ` ${items.filter((i) => i.kind === k).length}` : ` ${items.length}`}</button>`)}</div>
    ${list.length > limit ? html`<p class="small muted">依逾期、急迫程度、期限排序；目前顯示 ${shown.length}／${list.length} 則</p>` : null}
    ${shown.length ? html`<div class="tbl"><table class="data todo">
      <thead><tr><th>事項</th><th class="hide-sm">類型</th><th class="hide-sm">負責人</th><th class="hide-sm">期限</th><th class="hide-sm">狀態</th><th></th></tr></thead>
      <tbody>${shown.map((t) => {
        const [lv, icon] = LEVEL_TAG[t.level] || LEVEL_TAG.warning;
        return html`<tr class=${'lv-row lv-' + t.level}>
          <td><span class="lv-tag" title=${lv}><span aria-hidden="true">${icon}</span> ${lv}</span> ${showProject ? html`<span class="proj-code">${t.project}</span> ` : null}${t.overdue ? html`<span class="late small">逾期</span> ` : null}<b>${t.title}</b>
            ${t.detail ? html`<div class="muted small">${t.detail}</div>` : null}
            ${t.manual ? html`<span class="tag-manual">需人工登錄或處理</span>` : null}
            <div class="show-sm small muted">負責人 ${t.owner || '待指派'}・期限 ${t.due ? md(t.due) : '—'}・${t.status}</div></td>
          <td class="hide-sm small">${t.kind}</td>
          <td class="small hide-sm">${t.owner || '待指派'}</td>
          <td class="small nowrap hide-sm">${t.due ? md(t.due) : '—'}</td>
          <td class="hide-sm small">${t.status}</td>
          <td class="nowrap">${t.link ? html`<a class="btn tiny" href=${t.link}>處理</a>` : null}${t.manual && t.id && onDone ? html` <button class="btn tiny ghost" onClick=${() => onDone(t)}>完成</button>` : null}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    ${list.length > limit ? html`<button class="btn small ghost more" onClick=${() => setAll(!all)}>${all ? `收合，只看前 ${limit} 則` : `查看全部 ${list.length} 則`}</button>` : null}` : html`<p class="muted">沒有待辦。</p>`}
  </div>`;
}

/** 付費廣告成果／免費引流成果／來源不明分開列；專案合計以人去重，不等於各列相加 */
export function OutcomeGroups({ project, groups, total, caption }) {
  const keys = outcomeKeys(project).filter((k) => k !== 'payment');
  const pay = project.metrics.payment?.enabled;
  const rows = [
    ['付費廣告成果', '可歸因至付費廣告素材', groups.paid, 'paid'],
    ['免費引流成果', 'LINE、自然貼文等免費渠道（不計廣告成本）', groups.free, 'free'],
    ['來源不明', '沒有素材代碼；不分配給任何素材', groups.unknown, 'unknown'],
    ['└ 只對應到波次', '有波次代碼、沒有素材代碼', groups.campaignOnly, 'sub'],
    ['└ 完全無法辨識', '沒有波次與素材代碼', groups.noCampaign, 'sub'],
  ];
  return html`<div class="tbl"><table class="data groups">
    ${caption ? html`<caption class="small muted">${caption}</caption>` : null}
    <thead><tr><th>成果來源</th>${keys.map((k) => html`<th class="num">${project.metrics[k].label}</th>`)}${pay ? html`<th class="num">付款淨額</th>` : null}</tr></thead>
    <tbody>
      ${rows.map(([label, sub, g, kind]) => html`<tr class=${'g-' + kind}>
        <td><b>${label}</b><div class="muted small hide-sm">${sub}</div></td>
        ${keys.map((k) => html`<td class="num"><${V} m=${g[k]} compact /></td>`)}
        ${pay ? html`<td class="num"><${V} m=${g.net_amount} f="money" compact /></td>` : null}
      </tr>`)}
      <tr class="total"><td><b>專案合計</b><div class="muted small">以人去重，可能小於各列相加</div></td>
        ${keys.map((k) => html`<td class="num"><${V} m=${total[k]} compact /></td>`)}
        ${pay ? html`<td class="num"><${V} m=${total.net_amount} f="money" compact /></td>` : null}</tr>
    </tbody>
  </table></div>`;
}

/** 玉欣珍這類還沒有付費素材的專案：明確標示，不讓空白看起來像 0 */
export const NO_PAID_LABEL = '規劃中／尚未啟用付費廣告';

/** 發文數核對：每個數字都能點進清單看是哪幾篇 */
export function Reconcile({ c, linkOf }) {
  const L = ({ k, children }) => (c[k] ? html`<a class="rc-n" href=${linkOf(k)}>${children}</a>` : html`<span class="rc-n zero">${children}</span>`);
  return html`<div class="reconcile" aria-label="發文數核對">
    <div class="rc-row"><b>預計 <${L} k="planned">${c.planned}</${L}></b> ＝ 依期發布 <${L} k="onPlan">${c.onPlan}</${L}>
      ＋ 期內預定、期外發布 <${L} k="plannedOut">${c.plannedOut}</${L}> ＋ 待發 <${L} k="pending">${c.pending}</${L}>${c.overdue ? html`（含逾期 <${L} k="overdue">${c.overdue}</${L}>）` : ''}</div>
    <div class="rc-row"><b>已發 <${L} k="published">${c.published}</${L}></b> ＝ 依期發布 <${L} k="onPlan">${c.onPlan}</${L}>
      ＋ 跨期補發 <${L} k="crossIn">${c.crossIn}</${L}> ＋ 臨時加發 <${L} k="extra">${c.extra}</${L}></div>
    <div class="rc-row muted">取消 <${L} k="cancelled">${c.cancelled}</${L}>（預定在期間內但取消，不算入預計）</div>
    <div class="rc-row small muted">所以「已發＋待發」不一定等於「預計」：跨期補發與臨時加發只算已發；期外發布只算預計。點數字看明細。</div>
  </div>`;
}

/**
 * 累計招生進度：資料完整才顯示達成率與進度條；不完整時只寫「已知累計報名 N 人／目標 M 人」並註明達成率暫不計算。
 * 首頁與專案頁共用，確保同一規則。
 */
export function EnrollProgress({ prog, cum, compact }) {
  const e = cum.enrollment;
  const known = prog.n != null;
  return html`<div class=${'enroll-prog' + (compact ? ' compact' : '')}>
    <div>${known ? html`${prog.v == null ? '已知' : ''}有效報名 <b>${fmt.int(prog.n)} 人</b>` : html`有效報名 <${V} m=${e.valid} compact showNA why />`}
      ${prog.d ? html`／目標 <b>${prog.d} 人</b>` : html`／目標<span class="tbd">待填</span>`}
      ${prog.v != null ? html`・達成 <b>${fmt.pct(prog.v)}</b>` : null}</div>
    ${prog.v != null ? html`<div class="budget-bar${compact ? '' : ' big'}" role="img" aria-label=${'累計招生達成 ' + fmt.pct(prog.v)}><span style=${`width:${Math.min(100, prog.v * 100)}%`}></span></div>`
      : prog.known ? html`<div class="prog-hold"><span class="state s-not_computed sm">資料不完整，達成率暫不計算</span> <span class="small muted">${e.valid?.r || ''}</span></div>` : null}
    <div class="small muted">有效報名＝累計報名 ${e.ever.v ?? '—'} − 目前取消 ${e.cancelled.v ?? '—'}（以人去重；恢復報名不重複計）・累計至 ${md(cum.to)}，不隨所選週／月改變</div>
  </div>`;
}
