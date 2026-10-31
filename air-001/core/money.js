// 金額工具：所有金額以「整數美分」運算與儲存。
// 固定四捨五入規則：ROUND_HALF_AWAY_FROM_ZERO（0.5 美分一律遠離零進位）。

export const DEFAULT_COMMISSION_BPS = 1500; // 15.00%，以 basis points 儲存（1 bp = 0.01%）

export function assertCents(v, name = 'amount') {
  if (!Number.isInteger(v)) throw new AppError(`${name} 必須是整數美分`, 'INVALID_AMOUNT');
  if (Math.abs(v) > 100_000_000_00) throw new AppError(`${name} 超出允許範圍`, 'INVALID_AMOUNT');
  return v;
}

/** 依比例（bps）計算，四捨五入至整數美分：half away from zero */
export function applyBps(cents, bps) {
  assertCents(cents);
  const sign = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents) * bps; // 仍為整數，不會有浮點誤差
  return sign * Math.floor((abs + 5000) / 10000);
}

/** 佣金與司機分成：佣金四捨五入，司機分成＝基礎－佣金（保證兩者加總等於基礎，不產生 1 美分漂移） */
export function splitCommission(baseCents, bps = DEFAULT_COMMISSION_BPS) {
  const commission = applyBps(baseCents, bps);
  return { commission, driverShare: baseCents - commission };
}

/** "12.34" / "$1,234.5" / 12.34 → 1234（字串解析，避免浮點） */
export function parseDollars(input) {
  if (input === null || input === undefined || input === '') return 0;
  if (typeof input === 'number') input = String(input);
  const s = String(input).replace(/[$,\s]/g, '');
  const m = /^(-)?(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) throw new AppError(`金額格式錯誤：「${input}」（最多兩位小數）`, 'INVALID_AMOUNT');
  const cents = parseInt(m[2], 10) * 100 + parseInt((m[3] || '').padEnd(2, '0') || '0', 10);
  return m[1] ? -cents : cents;
}

/** 1234 → "$12.34"；負數 → "-$12.34" */
export function fmtUSD(cents) {
  const n = Number(cents || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

export function centsToInput(cents) {
  const n = Number(cents || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export class AppError extends Error {
  constructor(message, code = 'BAD_REQUEST', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
