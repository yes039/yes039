// CSV 解析與兩種匯入格式：Meta 廣告報表、成果紀錄
import { toHalfWidth, creativeCodeFromAdName, normalizeClaimCode } from './tracking.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (h) => toHalfWidth(h).replace(/\s+/g, '').toLowerCase();

function findCol(header, aliases) {
  const H = header.map(norm);
  for (const a of aliases) {
    const i = H.indexOf(norm(a));
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = H.findIndex((h) => h.startsWith(norm(a)));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseDate(v) {
  const s = toHalfWidth(v).replace(/\//g, '-');
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) {
    const roc = /^(\d{2,3})-(\d{1,2})-(\d{1,2})$/.exec(s); // 民國年
    if (roc) m = [null, String(Number(roc[1]) + 1911), roc[2], roc[3]];
  }
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(iso + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function parseNumber(v) {
  const s = toHalfWidth(v).replace(/[,\s$元NT]/g, '');
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Meta 廣告管理員匯出欄位（中英文介面）；實際欄名待以真實匯出檔核對
export const META_ALIASES = {
  start: ['報告開始日期', 'Reporting starts', '日期', 'Day'],
  end: ['報告結束日期', 'Reporting ends'],
  adName: ['廣告名稱', 'Ad name'],
  spend: ['花費金額 (TWD)', 'Amount spent (TWD)', '花費金額', 'Amount spent'],
  impressions: ['曝光次數', 'Impressions'],
  clicks: ['連結點擊次數', 'Link clicks'],
};

/**
 * Meta 廣告 CSV → 每日每則廣告一列。
 * creativesByCode：本專案的素材（code → creative）
 */
export function mapMetaRows(text, creativesByCode, placementsByCode = new Map()) {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ['檔案沒有資料列'] };
  const header = table[0];
  const col = Object.fromEntries(Object.entries(META_ALIASES).map(([k, a]) => [k, findCol(header, a)]));
  const missing = ['start', 'adName', 'spend', 'impressions', 'clicks'].filter((k) => col[k] < 0);
  if (missing.length) {
    const names = { start: '報告開始日期', adName: '廣告名稱', spend: '花費金額', impressions: '曝光次數', clicks: '連結點擊次數' };
    return { rows: [], errors: [`缺少必要欄位：${missing.map((k) => names[k]).join('、')}`] };
  }
  const rows = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const adName = toHalfWidth(r[col.adName] || '');
    if (/^(總計|合計|total|results)/i.test(adName) || adName === '') {
      rows.push({ line, status: 'skip', message: '總計列或空白列，略過' });
      return;
    }
    const date = parseDate(r[col.start]);
    const end = col.end >= 0 ? parseDate(r[col.end]) : date;
    const spend = parseNumber(r[col.spend]);
    const impressions = parseNumber(r[col.impressions]);
    const clicks = parseNumber(r[col.clicks]);
    const base = { line, adName, date, spend, impressions, link_clicks: clicks };
    if (!date) return rows.push({ ...base, status: 'error', message: '日期無法辨識' });
    if (end && end !== date) return rows.push({ ...base, status: 'error', message: '這一列跨多天；匯出時請選「依天」細分' });
    if ([spend, impressions, clicks].some((n) => Number.isNaN(n))) return rows.push({ ...base, status: 'error', message: '數字欄位無法辨識' });
    const code = creativeCodeFromAdName(adName);
    const cr = code ? creativesByCode.get(code) : null;
    if (!cr) {
      rows.push({ ...base, status: 'unmatched', message: code ? `素材代碼 ${code} 不屬於本專案或尚未建立` : '廣告名稱開頭沒有素材代碼', creative_id: null, campaign_id: null });
      return;
    }
    const pm = new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-A\\d{2}').exec(adName);
    const pl = pm ? placementsByCode.get(pm[0]) : null;
    if (pm && !pl) return rows.push({ ...base, status: 'error', message: `投放紀錄 ${pm[0]} 尚未建立` });
    rows.push({ ...base, status: 'ok', creative_id: cr.id, campaign_id: cr.campaign_id, placement_id: pl?.id || null, creativeCode: code, placementCode: pl?.code || '' });
  });
  return { rows, errors: [] };
}

export const OUTCOME_TYPE_ALIASES = {
  claim: ['電子書領取', '領取', 'claim'],
  lead: ['名單', 'lead'],
  valid_lead: ['有效名單', 'valid_lead'],
  enroll: ['報名', 'enroll'],
  payment: ['付款', 'payment'],
  refund: ['退款', 'refund'],
  cancel: ['取消報名', '取消', 'cancel'],
};

export const OUTCOME_COLUMNS = ['類型', '日期', '活動代碼', '素材代碼', '領取碼', '數量', '金額', '外部編號', '電話', 'Email', '備註'];

export function normalizePhone(v) {
  let d = toHalfWidth(v).replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.startsWith('886')) return '+' + d;
  if (d.startsWith('09') && d.length === 10) return '+886' + d.slice(1);
  return d;
}
export function normalizeEmail(v) {
  return toHalfWidth(v).toLowerCase();
}

export async function personRef(phone, email, salt) {
  const p = normalizePhone(phone);
  const e = normalizeEmail(email);
  const key = p ? 'p:' + p : e ? 'e:' + e : '';
  if (!key) return null;
  const data = new TextEncoder().encode(salt + '|' + key);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * 成果 CSV → 成果列。lookups：本專案的 campaignsByCode、creativesByCode、claimCodes(code→{campaign_id, creative_id})、defs
 */
export async function mapOutcomeRows(text, lookups, salt) {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ['檔案沒有資料列'] };
  const header = table[0];
  const col = {};
  for (const name of OUTCOME_COLUMNS) col[name] = findCol(header, [name]);
  const missing = ['類型', '日期'].filter((k) => col[k] < 0);
  if (missing.length) return { rows: [], errors: [`缺少必要欄位：${missing.join('、')}`] };
  const get = (r, k) => (col[k] >= 0 ? toHalfWidth(r[col[k]] ?? '') : '');
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const line = i + 1;
    const typeRaw = get(r, '類型');
    const type = Object.entries(OUTCOME_TYPE_ALIASES).find(([, a]) => a.some((x) => norm(x) === norm(typeRaw)))?.[0];
    const date = parseDate(get(r, '日期'));
    const qty = get(r, '數量') === '' ? 1 : parseNumber(get(r, '數量'));
    const amount = parseNumber(get(r, '金額'));
    const external = get(r, '外部編號') || null;
    const base = { line, type, typeRaw, date, qty, amount, external_ref: external, note: get(r, '備註') };
    if (!type) { rows.push({ ...base, status: 'error', message: `類型「${typeRaw}」無法辨識` }); continue; }
    if (!lookups.defs[type === 'cancel' ? 'enroll' : type]?.enabled) { rows.push({ ...base, status: 'error', message: `本專案未定義「${typeRaw}」這個指標` }); continue; }
    if (!date) { rows.push({ ...base, status: 'error', message: '日期無法辨識' }); continue; }
    if (!Number.isInteger(qty) || qty < 1) { rows.push({ ...base, status: 'error', message: '數量必須是正整數' }); continue; }
    if (Number.isNaN(amount) || amount < 0) { rows.push({ ...base, status: 'error', message: '金額無法辨識' }); continue; }
    if ((type === 'payment' || type === 'refund') && !(amount > 0)) { rows.push({ ...base, status: 'error', message: '付款與退款需要金額' }); continue; }

    let campaign_id = null; let creative_id = null; let via = '';
    const cCode = get(r, '活動代碼').toUpperCase();
    const crCode = get(r, '素材代碼');
    const claim = normalizeClaimCode(get(r, '領取碼'));
    if (cCode) {
      const c = lookups.campaignsByCode.get(cCode);
      if (!c) { rows.push({ ...base, status: 'error', message: `活動代碼 ${cCode} 不屬於本專案或尚未建立` }); continue; }
      campaign_id = c.id; via = '活動代碼';
    }
    if (crCode) {
      const cr = lookups.creativesByCode.get(crCode);
      if (!cr) { rows.push({ ...base, status: 'error', message: `素材代碼 ${crCode} 不屬於本專案或尚未建立` }); continue; }
      if (campaign_id && cr.campaign_id !== campaign_id) { rows.push({ ...base, status: 'error', message: '素材代碼與活動代碼不一致' }); continue; }
      creative_id = cr.id; campaign_id = cr.campaign_id; via = via || '素材代碼';
    }
    if (claim) {
      const cc = lookups.claimCodes.get(claim);
      if (!cc) { rows.push({ ...base, status: 'error', message: `領取碼 ${claim} 不屬於本專案` }); continue; }
      if (campaign_id && cc.campaign_id !== campaign_id) { rows.push({ ...base, status: 'error', message: '領取碼與活動代碼不一致' }); continue; }
      campaign_id = cc.campaign_id; creative_id = creative_id || cc.creative_id; via = via || '領取碼';
    }
    const person_ref = await personRef(get(r, '電話'), get(r, 'Email'), salt);
    if (type === 'cancel' && !person_ref) { rows.push({ ...base, status: 'error', message: '取消報名需要電話或 Email，才能對應到報名的人' }); continue; }
    if (type === 'cancel' && !base.note) { rows.push({ ...base, status: 'error', message: '取消報名請在備註填寫原因' }); continue; }
    if (type === 'cancel' && qty !== 1) { rows.push({ ...base, status: 'error', message: '取消報名一列只能一人' }); continue; }
    rows.push({ ...base, status: 'ok', campaign_id, creative_id, claim_code: claim, person_ref, via: via || '來源不明' });
  }
  return { rows, errors: [] };
}
