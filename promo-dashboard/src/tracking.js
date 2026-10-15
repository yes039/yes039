// 活動代碼、素材代碼、追蹤連結、領取碼的規則（前後端共用）

export const FORMATS = {
  IM: '圖片', VD: '影片', CA: '輪播', TX: '純文字貼文', LM: 'LINE 訊息',
  RM: '圖文選單', LP: '落地頁', QR: '實體 QR Code',
};
export const CHANNELS = {
  fb_ad: 'FB 付費廣告', fb_post: 'FB 免費貼文', line: 'LINE', qr: 'QR Code',
  partner: '合作方渠道', other: '其他',
};
export const UTM_SOURCES = ['facebook', 'instagram', 'line', 'messenger', 'qr', 'partner'];
export const UTM_MEDIUMS = ['paid_social', 'organic_social', 'line_message', 'line_richmenu', 'qr', 'referral'];

/** 全形英數轉半形、去前後空白 */
export function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .trim();
}

export function validProjectCode(code) {
  return /^[A-Z]{2,5}$/.test(code);
}

export function validClaimPrefix(p) {
  return /^[A-Z]$/.test(p);
}

/** 活動代碼：專案代碼-YYMM-NN */
export function validCampaignCode(code, projectCode) {
  const m = /^([A-Z]{2,5})-(\d{2})(\d{2})-(\d{2})$/.exec(code);
  if (!m || m[1] !== projectCode) return false;
  const month = Number(m[3]);
  return month >= 1 && month <= 12 && m[4] !== '00';
}

export function suggestCampaignCode(projectCode, date, existing) {
  const ym = date.slice(2, 4) + date.slice(5, 7);
  for (let n = 1; n < 100; n++) {
    const code = `${projectCode}-${ym}-${String(n).padStart(2, '0')}`;
    if (!existing.includes(code)) return code;
  }
  return null;
}

/** 素材代碼：活動代碼-格式碼NN-vN */
export function validCreativeCode(code, campaignCode) {
  if (!code.startsWith(campaignCode + '-')) return false;
  const rest = code.slice(campaignCode.length + 1);
  const m = /^([A-Z]{2})(\d{2})-v(\d{1,2})$/.exec(rest);
  return !!m && m[1] in FORMATS && m[2] !== '00' && Number(m[3]) >= 1;
}

export function suggestCreativeCode(campaignCode, format, existing) {
  for (let n = 1; n < 100; n++) {
    const code = `${campaignCode}-${format}${String(n).padStart(2, '0')}-v1`;
    if (!existing.includes(code)) return code;
  }
  return null;
}

/** 領取碼：字首＋3 位數；比對前先轉半形與大寫 */
export function normalizeClaimCode(code) {
  return toHalfWidth(code).toUpperCase();
}

export function validClaimCode(code, prefix) {
  return new RegExp(`^${prefix}\\d{3}$`).test(normalizeClaimCode(code));
}

export function suggestClaimCode(prefix, existing) {
  const used = new Set(existing.map(normalizeClaimCode));
  for (let n = 101; n < 1000; n++) {
    const code = `${prefix}${n}`;
    if (!used.has(code)) return code;
  }
  return null;
}

/** 組追蹤連結；UTM 值一律小寫。網址錯誤時拋出錯誤訊息 */
export function buildTrackingUrl({ baseUrl, source, medium, campaignCode, creativeCode, term }) {
  let url;
  try {
    url = new URL(toHalfWidth(baseUrl));
  } catch {
    throw new Error('導向網址格式不正確，請包含 https://');
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error('導向網址必須是 http 或 https');
  if (!UTM_SOURCES.includes(source)) throw new Error('utm_source 不在清單內');
  if (!UTM_MEDIUMS.includes(medium)) throw new Error('utm_medium 不在清單內');
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) url.searchParams.delete(k);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaignCode.toLowerCase());
  if (creativeCode) url.searchParams.set('utm_content', creativeCode.toLowerCase());
  if (term) url.searchParams.set('utm_term', toHalfWidth(term).toLowerCase());
  return url.toString();
}

/** 廣告名稱開頭的素材代碼（Meta 廣告命名規則：素材代碼｜說明） */
export function creativeCodeFromAdName(adName) {
  const m = /^([A-Z]{2,5}-\d{4}-\d{2}-[A-Z]{2}\d{2}-v\d{1,2})/.exec(toHalfWidth(adName));
  return m ? m[1] : null;
}
