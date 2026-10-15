// 指標計算：所有數字都回傳 { v, s, r }
//   v：數值（無法給數值時為 null）
//   s：狀態 value／incomplete／zero／not_connected／not_computed／not_provided／below_threshold／unverified
//   r：原因說明（給畫面顯示）
// 轉換率一律用「合計分子 ÷ 合計分母」，不平均各列比率。

import { datesInRange, overlap, addDays } from './periods.js';

export const STATE_LABEL = {
  value: '',
  incomplete: '資料不完整',
  zero: '已確認為零',
  not_connected: '尚未接入',
  not_computed: '暫不計算',
  not_provided: '平台未提供',
  below_threshold: '低於統計門檻',
  unverified: '待查證',
  not_entered: '尚未登錄',
};

export const OUTCOME_TYPES = ['inquiry', 'claim', 'lead', 'valid_lead', 'enroll', 'payment', 'refund'];
export const SOURCE_OF_TYPE = { inquiry: 'inquiry', claim: 'claim', lead: 'lead', valid_lead: 'lead', enroll: 'enroll', payment: 'payment', refund: 'payment' };
export const SOURCE_KINDS = {
  ads: 'FB 廣告數字', inquiry: '詢問', claim: '電子書／內容領取', lead: '名單', enroll: '報名', payment: '付款與退款',
};

export function defaultMetrics() {
  return [
    { key: 'inquiry', label: '詢問', enabled: true, def: '可確認來自本專案廣告或連結的私訊、留言詢問' },
    { key: 'claim', label: '電子書領取', enabled: true, def: '' },
    { key: 'lead', label: '名單', enabled: true, def: '' },
    { key: 'valid_lead', label: '有效名單', enabled: true, def: '待定義' },
    { key: 'enroll', label: '報名', enabled: true, def: '' },
    { key: 'payment', label: '付款', enabled: true, def: '實收金額' },
    { key: 'refund', label: '退款', enabled: true, def: '' },
  ];
}

export const DEFAULT_SETTINGS = { minClicks: 100, minSpend: 3000, adjustRatio: 1.5, quietDays: 3, staleDays: 2, unknownShare: 0.3 };

const val = (v, s = 'value', r = '') => ({ v, s, r });
const fmtMD = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

function finalize(v, incompleteReason) {
  if (incompleteReason) return val(v, 'incomplete', incompleteReason);
  return v === 0 ? val(0, 'zero', '資料完整，數值為零') : val(v);
}

/** 比率：合計分子 ÷ 合計分母 */
export function ratio(num, den) {
  for (const x of [num, den]) {
    if (x.s === 'not_connected' || x.s === 'not_computed' || x.v == null) {
      return val(null, 'not_computed', x === num ? `分子${STATE_LABEL[x.s] || '無資料'}` : `分母${STATE_LABEL[x.s] || '無資料'}`);
    }
  }
  if (den.v === 0) return val(null, 'not_computed', '分母為 0');
  const v = num.v / den.v;
  const inc = [num, den].find((x) => x.s === 'incomplete');
  const out = inc ? val(v, 'incomplete', inc.r) : val(v);
  out.n = num.v; out.d = den.v; // 給畫面顯示「分子 ÷ 分母」
  return out;
}

export function metricDefs(project) {
  const list = JSON.parse(project.metrics_json || '[]');
  const map = {};
  for (const m of list) map[m.key] = m;
  return map;
}

export function primaryOutcome(defs) {
  return ['valid_lead', 'lead', 'claim', 'enroll'].find((k) => defs[k]?.enabled) || null;
}

/**
 * 計算一個範圍（整個專案、某活動或某素材）的指標。
 * ctx：{ project, defs, sources, range, today, campaigns }（campaigns 只含此範圍的活動）
 * ads：此範圍內、期間內的廣告列；conv：此範圍內、期間內的成果列
 * paidCampaignIds：此範圍內有付費渠道的活動 id（用來判斷廣告資料是否缺日）
 */
export function computeScope(ctx, { ads, conv, hasPaid, expected = [], keyField = 'campaign_id' }) {
  const { defs, sources, range } = ctx;
  const out = {};
  const noDays = range.to < range.from;

  // ---- 廣告數字 ----
  // expected：這個範圍應該有廣告資料的 { key, date }（key 為活動、素材或投放紀錄 id）
  const adsSource = sources.ads;
  let adState = null;
  if (!hasPaid && ads.length === 0) adState = val(null, 'not_computed', '無付費渠道');
  else if (noDays) adState = val(null, 'not_computed', '本期還沒有已結束的日子');
  else if (!adsSource?.connected) adState = val(null, 'not_connected', adsSource?.note || 'FB 廣告數字尚未匯入');
  let missing = [];
  if (!adState) {
    const have = new Set(ads.map((r) => r[keyField] + '|' + r.date));
    missing = [...new Set(expected.filter((e) => !have.has(e.key + '|' + e.date)).map((e) => e.date))].sort();
  }
  const adIncomplete = missing.length ? `缺 ${missing.length} 天廣告資料（${missing.slice(0, 3).map(fmtMD).join('、')}${missing.length > 3 ? '…' : ''}）` : '';
  const sum = (k) => ads.reduce((a, r) => a + Number(r[k] || 0), 0);
  for (const k of ['spend', 'impressions', 'link_clicks']) {
    out[k] = adState || finalize(sum(k), adIncomplete);
  }
  out.missingAdDates = missing;
  out.ctr = ratio(out.link_clicks, out.impressions);
  out.cpc = ratio(out.spend, out.link_clicks);

  // ---- 成果 ----
  for (const t of OUTCOME_TYPES) {
    const def = defs[t];
    if (!def || !def.enabled) { out[t] = val(null, 'not_computed', '本專案未定義此指標'); continue; }
    const src = sources[SOURCE_OF_TYPE[t]];
    if (!src?.connected) { out[t] = val(null, 'not_connected', src?.note || `${SOURCE_KINDS[SOURCE_OF_TYPE[t]]}尚未接入`); continue; }
    if (noDays) { out[t] = val(null, 'not_computed', '本期還沒有已結束的日子'); continue; }
    const rows = conv.filter((r) => r.type === t);
    let n;
    if (t === 'payment' || t === 'refund') n = rows.reduce((a, r) => a + Number(r.qty || 1), 0);
    else {
      const persons = new Set();
      let anon = 0;
      for (const r of rows) { if (r.person_ref) persons.add(r.person_ref); else anon += Number(r.qty || 1); }
      n = persons.size + anon;
    }
    const inc = src.covered_through && src.covered_through < range.to ? `資料只更新到 ${fmtMD(src.covered_through)}` : '';
    out[t] = finalize(n, inc);
    if (t === 'payment' || t === 'refund') {
      const amt = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
      out[t + '_amount'] = finalize(amt, inc);
    }
  }
  if (out.payment_amount && out.refund_amount && out.payment_amount.v != null) {
    const refund = out.refund_amount.v ?? 0;
    const inc = [out.payment_amount, out.refund_amount].find((x) => x.s === 'incomplete');
    out.net_amount = inc ? val(out.payment_amount.v - refund, 'incomplete', inc.r) : finalize(out.payment_amount.v - refund, '');
  } else out.net_amount = out.payment_amount || val(null, 'not_computed', '本專案未定義付款');

  // ---- 成本與轉換 ----
  const primary = primaryOutcome(defs);
  out.primaryKey = primary;
  if (primary) out.cost_primary = ratio(out.spend, out[primary]);
  if (defs.enroll?.enabled) out.cost_enroll = ratio(out.spend, out.enroll);
  if (defs.payment?.enabled) out.return_on_spend = ratio(out.net_amount, out.spend);
  return out;
}

/**
 * 依目標成本與最小樣本，給出「持續／觀察／調整」建議（只對付費範圍）。
 * 關鍵資料（花費、點擊、主要成果）不完整時一律不給「持續」，並列出依據。
 */
export function judge(m, settings, targetCpl, hasPaid, defs) {
  if (!hasPaid) return { label: '—', reason: '免費渠道不計成本', basis: [] };
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const label = (k) => defs?.[k]?.label || { spend: '花費', link_clicks: '連結點擊' }[k] || k;
  const keys = ['spend', 'link_clicks', m.primaryKey].filter(Boolean);
  const basis = keys.map((k) => `${label(k)}：${m[k].v == null ? STATE_LABEL[m[k].s] : Math.round(m[k].v).toLocaleString('zh-TW')}${m[k].s === 'incomplete' ? '（資料不完整）' : ''}`);
  const missing = keys.filter((k) => m[k].v == null);
  if (missing.length) return { label: '觀察', reason: `${missing.map(label).join('、')}${STATE_LABEL[m[missing[0]].s]}，暫不判斷`, basis };
  const inc = keys.filter((k) => m[k].s === 'incomplete');
  if (m.spend.v < s.minSpend && m.link_clicks.v < s.minClicks) {
    return { label: '觀察', reason: `樣本不足（點擊 < ${s.minClicks} 且花費 < ${s.minSpend}）`, basis };
  }
  const p = m[m.primaryKey];
  const cpl = p.v > 0 ? m.spend.v / p.v : null;
  if (inc.length) {
    // 資料不完整：只允許「觀察」或明確的「調整」（花費已遠超目標時），不給「持續」
    if (p.v === 0 && !inc.includes(m.primaryKey)) return { label: '調整', reason: `有花費但沒有${label(m.primaryKey)}（${m[inc[0]].r}）`, basis };
    return { label: '觀察', reason: `資料不完整（${m[inc[0]].r}），暫不判斷`, basis };
  }
  if (p.v === 0) return { label: '調整', reason: `有花費但沒有${label(m.primaryKey)}`, basis };
  if (!targetCpl) return { label: '觀察', reason: '未設定目標成本', basis };
  if (cpl <= targetCpl) return { label: '持續', reason: `每筆${label(m.primaryKey)}成本 ${Math.round(cpl)} ≤ 目標 ${targetCpl}`, basis };
  if (cpl > targetCpl * s.adjustRatio) return { label: '調整', reason: `每筆成本 ${Math.round(cpl)} 高於目標 ${s.adjustRatio} 倍`, basis };
  return { label: '觀察', reason: `每筆成本 ${Math.round(cpl)} 略高於目標 ${targetCpl}`, basis };
}

/**
 * 付費專案的異常與待辦。每則：{ level, kind, title, detail, link, project, owner, due, status, manual }
 *   kind：廣告異常／預算／內容／資料；manual＝需要人工登錄或處理才會消失
 */
export function anomaliesFor({ project, defs, settings, campaigns, creatives, campaignMetrics, projectMetrics, adsUnmatched, unknownConv, links, sources, today }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const items = [];
  const todos = [];
  const yesterday = addDays(today, -1);
  const add = (list, level, kind, title, detail, link, extra = {}) =>
    list.push({ level, kind, title, detail, link, project: project.code, project_id: project.id, owner: '', due: null, status: '待處理', manual: false, ...extra });

  for (const c of campaigns) {
    const m = campaignMetrics[c.id];
    const link = `#/c/${c.id}`;
    const owner = c.owner || '';
    if (c.budget && m.spendAll != null) {
      if (m.spendAll > c.budget) add(items, 'critical', '預算', `${c.code} 累計花費超過活動預算`, `活動累計 ${Math.round(m.spendAll)}／預算 ${c.budget}`, link, { owner, due: today });
      else if (m.spendAll > c.budget * 0.9) add(items, 'warning', '預算', `${c.code} 活動預算即將用完`, `已用 ${Math.round((m.spendAll / c.budget) * 100)}%`, link, { owner });
    }
    if (m.missingAdDates?.length) add(items, 'serious', '資料', `${c.code} 廣告資料缺漏`, m.spend.r + '，請補登或重新匯入', link, { owner, manual: true });
    if (c.status === '進行中' && c.end_date && c.end_date < today) add(todos, 'warning', '資料', `${c.code} 已過結束日，狀態仍為進行中`, `結束日 ${c.end_date}`, link, { owner, manual: true });
    const recent = m.recent;
    if (recent && recent.spend > 0 && recent.outcome === 0) {
      add(items, 'serious', '廣告異常', `${c.code} 近 ${s.quietDays} 天有花費、沒有${defs[m.primaryKey]?.label || '成果'}`, `近 ${s.quietDays} 天花費 ${Math.round(recent.spend)}`, link, { owner, due: today });
    }
  }
  for (const cr of creatives) {
    const link = `#/p/${project.id}/creatives`;
    if (cr.prod_status === '製作中') add(todos, 'warning', '內容', `待製作：${cr.code}`, cr.name || '', link, { owner: cr.owner, status: '製作中' });
    if (cr.prod_status === '待審核') add(todos, 'warning', '內容', `待審核：${cr.code}`, cr.name || '', link, { owner: cr.owner, status: '待審核' });
    if (cr.status === '進行中' && !links.some((l) => l.creative_id === cr.id)) {
      add(todos, 'warning', '資料', `${cr.code} 沒有追蹤連結`, cr.channel === 'fb_ad' ? '請把追蹤連結貼到廣告網址，成果才能對應到素材' : '沒有追蹤連結就無法辨識來源', link, { owner: cr.owner, manual: true });
    }
  }
  if (adsUnmatched > 0) add(todos, 'serious', '資料', `${adsUnmatched} 筆廣告花費對應不到素材`, '廣告名稱需以素材代碼開頭；請到匯入紀錄檢查', `#/p/${project.id}/entry`, { manual: true });
  for (const [kind, label] of Object.entries(SOURCE_KINDS)) {
    const src = sources[kind];
    if (!src?.connected) continue;
    if (kind !== 'ads' && OUTCOME_TYPES.every((t) => SOURCE_OF_TYPE[t] !== kind || !defs[t]?.enabled)) continue;
    if (src.covered_through && src.covered_through < addDays(yesterday, -(s.staleDays - 1))) {
      add(todos, 'warning', '資料', `${label}待更新`, `只更新到 ${fmtMD(src.covered_through)}（人工登錄或匯入）`, `#/p/${project.id}/sources`, { manual: true });
    }
  }
  for (const t of ['enroll', 'payment']) {
    const total = projectMetrics[t];
    const unk = unknownConv[t] || 0;
    if (defs[t]?.enabled && total?.v > 0 && unk / total.v > s.unknownShare) {
      add(items, 'warning', '資料', `${defs[t].label}來源不明比例偏高`, `${unk}／${total.v} 筆無法確認來源`, `#/p/${project.id}`);
    }
  }
  const order = { critical: 0, serious: 1, warning: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  todos.sort((a, b) => order[a.level] - order[b.level]);
  return { anomalies: items, autoTodos: todos };
}
