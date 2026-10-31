// 時區工具：營運時區固定 America/Los_Angeles。
// 資料庫存 UTC ISO 字串（精確時間點）＋洛杉磯當地日期/時間（營運報表分組用）。
// 夏令時間處理：
//  - 不存在的時間（春季撥快，如 2027-03-14 02:30）→ 拒絕，要求重新輸入。
//  - 重複的時間（秋季撥慢，如 2026-11-01 01:30 出現兩次）→ 預設取「較早」那次（PDT），
//    可由使用者指定 'later'（PST），並在訂單上標記 dst_ambiguous 供人工確認。
import { AppError } from './money.js';

export const TZ = 'America/Los_Angeles';

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function partsAt(ms) {
  const p = {};
  for (const { type, value } of dtf.formatToParts(new Date(ms))) p[type] = value;
  return p;
}

/** 某 UTC 時間點在洛杉磯的 UTC 偏移（分鐘，例：PDT=-420, PST=-480） */
export function offsetMinutesAt(ms) {
  const p = partsAt(ms);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** 洛杉磯 UTC 時間點 → { date:'YYYY-MM-DD', time:'HH:MM', offset } */
export function utcToLocal(isoOrMs) {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  const p = partsAt(ms);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, offset: offsetMinutesAt(ms) };
}

/**
 * 洛杉磯當地日期時間 → UTC
 * @returns {{ utc: string, offset: number, ambiguous: boolean, candidates: string[] }}
 */
export function localToUtc(date, time, disambiguation = 'earlier') {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const tm = /^(\d{2}):(\d{2})$/.exec(time || '');
  if (!dm || !tm) throw new AppError('日期或時間格式錯誤（YYYY-MM-DD / HH:MM）', 'INVALID_DATETIME');
  const naive = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
  const offsets = new Set([offsetMinutesAt(naive - 36e5 * 30), offsetMinutesAt(naive + 36e5 * 30), offsetMinutesAt(naive)]);
  const valid = [];
  for (const off of offsets) {
    const utc = naive - off * 60000;
    const back = utcToLocal(utc);
    if (back.date === date && back.time === time) valid.push({ utc, off });
  }
  valid.sort((a, b) => a.utc - b.utc);
  if (valid.length === 0) {
    throw new AppError(`洛杉磯當地時間 ${date} ${time} 因夏令時間撥快而不存在，請改選其他時間（例如 03:00 之後）`, 'DST_NONEXISTENT_TIME');
  }
  const pick = valid.length > 1 && disambiguation === 'later' ? valid[valid.length - 1] : valid[0];
  return {
    utc: new Date(pick.utc).toISOString(),
    offset: pick.off,
    ambiguous: valid.length > 1,
    candidates: valid.map((v) => new Date(v.utc).toISOString()),
  };
}

export function todayLocal(nowMs = Date.now()) { return utcToLocal(nowMs).date; }

/** 'YYYY-MM-DD' 加減天數（純日曆運算，不受 DST 影響） */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 週一為一週起始 */
export function weekRange(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const start = addDays(date, -((dow + 6) % 7));
  return { from: start, to: addDays(start, 6) };
}

export function monthRange(date) {
  const [y, m] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}

export function fmtOffset(off) {
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** 顯示用：UTC ISO → 'YYYY-MM-DD HH:MM PDT/PST' */
export function fmtLocalDateTime(iso) {
  if (!iso) return '';
  const l = utcToLocal(iso);
  return `${l.date} ${l.time} ${l.offset === -420 ? 'PDT' : l.offset === -480 ? 'PST' : fmtOffset(l.offset)}`;
}

export function nowIso(nowMs = Date.now()) { return new Date(nowMs).toISOString(); }
