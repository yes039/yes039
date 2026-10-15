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
};

export const OUTCOME_TYPES = ['claim', 'lead', 'valid_lead', 'enroll', 'payment', 'refund'];
export const SOURCE_OF_TYPE = { claim: 'claim', lead: 'lead', valid_lead: 'lead', enroll: 'enroll', payment: 'payment', refund: 'payment' };
export const SOURCE_KINDS = {
  ads: 'FB 廣告數字', claim: '電子書／內容領取', lead: '名單', enroll: '報名', payment: '付款與退款',
};

export function defaultMetrics() {
  return [
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
  return inc ? val(v, 'incomplete', inc.r) : val(v);
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
export function computeScope(ctx, { ads, conv, paidCampaignIds, hasPaid, adDatesByCampaign }) {
  const { defs, sources, range, today } = ctx;
  const out = {};
  const yesterday = addDays(today, -1);

  // ---- 廣告數字 ----
  const adsSource = sources.ads;
  let adState = null;
  if (!hasPaid && ads.length === 0) adState = val(null, 'not_computed', '無付費渠道');
  else if (!adsSource?.connected) adState = val(null, 'not_connected', adsSource?.note || 'FB 廣告數字尚未匯入');
  let missing = [];
  if (!adState) {
    for (const c of ctx.campaigns) {
      if (!paidCampaignIds.has(c.id) || !c.start_date) continue;
      const ov = overlap(range.from, range.to, c.start_date, (c.end_date && c.end_date < yesterday) ? c.end_date : yesterday);
      if (!ov) continue;
      const have = adDatesByCampaign.get(c.id) || new Set();
      for (const d of datesInRange(ov.from, ov.to)) if (!have.has(d)) missing.push(d);
    }
    missing = [...new Set(missing)].sort();
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

/** 依目標成本與最小樣本，給出「持續／觀察／調整」建議（只對付費範圍） */
export function judge(m, settings, targetCpl, hasPaid) {
  if (!hasPaid) return { label: '—', reason: '免費渠道不計成本' };
  const s = { ...DEFAULT_SETTINGS, ...settings };
  if (m.spend.v == null || m.link_clicks.v == null) return { label: '觀察', reason: '廣告數字未齊' };
  if (m.link_clicks.v < s.minClicks && m.spend.v < s.minSpend) {
    return { label: '觀察', reason: `樣本不足（點擊 < ${s.minClicks} 且花費 < ${s.minSpend}）` };
  }
  const p = m.primaryKey ? m[m.primaryKey] : null;
  if (!p || p.v == null) return { label: '觀察', reason: '成果資料未齊' };
  if (p.v === 0) return { label: '調整', reason: '有花費但沒有成果' };
  if (!targetCpl) return { label: '觀察', reason: '未設定目標成本' };
  const cpl = m.spend.v / p.v;
  if (cpl <= targetCpl) return { label: '持續', reason: `每筆成本 ${Math.round(cpl)} ≤ 目標 ${targetCpl}` };
  if (cpl > targetCpl * s.adjustRatio) return { label: '調整', reason: `每筆成本 ${Math.round(cpl)} 高於目標 ${s.adjustRatio} 倍` };
  return { label: '觀察', reason: `每筆成本 ${Math.round(cpl)} 略高於目標 ${targetCpl}` };
}

/** 依活動期間與今天推得的實際狀態提醒 */
export function anomaliesFor({ project, defs, settings, campaigns, creatives, campaignMetrics, projectMetrics, adsUnmatched, unknownConv, links, sources, today, range }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const items = [];
  const todos = [];
  const yesterday = addDays(today, -1);
  const add = (list, level, title, detail, link) => list.push({ level, title, detail, link, project: project.code });

  for (const c of campaigns) {
    const m = campaignMetrics[c.id];
    const link = `#/c/${c.id}`;
    if (c.budget && m.spend.v != null) {
      if (m.spend.v > c.budget) add(items, 'critical', `${c.code} 花費超過預算`, `已花 ${Math.round(m.spend.v)}／預算 ${c.budget}`, link);
      else if (m.spend.v > c.budget * 0.9) add(items, 'warning', `${c.code} 預算即將用完`, `已用 ${Math.round((m.spend.v / c.budget) * 100)}%`, link);
    }
    if (m.missingAdDates?.length) add(items, 'serious', `${c.code} 廣告資料缺漏`, m.spend.r, link);
    if (c.status === '進行中' && c.end_date && c.end_date < today) add(todos, 'warning', `${c.code} 已過結束日，狀態仍為進行中`, `結束日 ${c.end_date}`, link);
    const recent = m.recent;
    if (recent && recent.spend > 0 && recent.outcome === 0) {
      add(items, 'serious', `${c.code} 近 ${s.quietDays} 天有花費、沒有${defs[m.primaryKey]?.label || '成果'}`, `近 ${s.quietDays} 天花費 ${Math.round(recent.spend)}`, link);
    }
  }
  for (const cr of creatives) {
    if (cr.status === '進行中' && !links.some((l) => l.creative_id === cr.id) && cr.channel !== 'fb_ad') {
      add(todos, 'warning', `${cr.code} 沒有追蹤連結`, '免費貼文與其他渠道需要追蹤連結才能辨識來源', `#/c/${cr.campaign_id}`);
    }
    if (cr.status === '進行中' && cr.channel === 'fb_ad' && !links.some((l) => l.creative_id === cr.id)) {
      add(todos, 'warning', `${cr.code} 沒有追蹤連結`, '請把追蹤連結貼到廣告的網址', `#/c/${cr.campaign_id}`);
    }
  }
  if (adsUnmatched > 0) add(todos, 'serious', `${adsUnmatched} 筆廣告花費對應不到素材`, '廣告名稱需以素材代碼開頭；可在匯入紀錄檢查', `#/p/${project.id}/sources`);
  for (const [kind, label] of Object.entries(SOURCE_KINDS)) {
    const src = sources[kind];
    if (!src?.connected) continue;
    if (kind !== 'ads' && OUTCOME_TYPES.every((t) => SOURCE_OF_TYPE[t] !== kind || !defs[t]?.enabled)) continue;
    if (src.covered_through && src.covered_through < addDays(yesterday, -(s.staleDays - 1))) {
      add(todos, 'warning', `${label}資料未更新`, `只更新到 ${src.covered_through}`, `#/p/${project.id}/sources`);
    }
  }
  for (const t of ['enroll', 'payment']) {
    const total = projectMetrics[t];
    const unk = unknownConv[t] || 0;
    if (total?.v > 0 && unk / total.v > s.unknownShare) {
      add(items, 'warning', `${defs[t].label}來源不明比例偏高`, `${unk}／${total.v} 筆沒有活動來源`, `#/p/${project.id}`);
    }
  }
  const order = { critical: 0, serious: 1, warning: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  todos.sort((a, b) => order[a.level] - order[b.level]);
  return { anomalies: items, autoTodos: todos };
}
