// 統計期間：日期一律用 YYYY-MM-DD 字串（台灣時間），避免時區誤差

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
}

/** 台灣時間的今天 */
export function todayTW(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * period：r7（近 7 天）、r30（近 30 天）、month（曆月，需 m=YYYY-MM）、all（全部期間）
 * 近 N 天結束日預設為昨天；曆月尚未結束時算到昨天並標示進行中。
 */
export function resolvePeriod({ period = 'r30', end, m, today }) {
  const yesterday = addDays(today, -1);
  if (period === 'r7' || period === 'r30') {
    const n = period === 'r7' ? 7 : 30;
    const to = end && end <= yesterday ? end : yesterday;
    return { period, from: addDays(to, -(n - 1)), to, label: `近 ${n} 天`, inProgress: false };
  }
  if (period === 'month') {
    const ym = /^\d{4}-\d{2}$/.test(m || '') ? m : today.slice(0, 7);
    const from = ym + '-01';
    const last = lastDayOfMonth(ym);
    const inProgress = last >= today;
    const to = inProgress ? yesterday : last;
    return { period, from, to: to < from ? from : to, label: `曆月 ${ym}`, inProgress, empty: to < from };
  }
  return { period: 'all', from: '2000-01-01', to: yesterday, label: '全部期間', inProgress: false };
}

export function datesInRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function overlap(aFrom, aTo, bFrom, bTo) {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to = aTo < bTo ? aTo : bTo;
  return from <= to ? { from, to } : null;
}
