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
 * period：week（本週，週一至週日）、month（曆月，m=YYYY-MM，預設本月）、r7、r30（近 N 天）、custom（from、to）、all
 * 回傳兩個結束日：
 *   to     ＝ 已發生資料的結束日（不超過昨天；廣告與成果用這個）
 *   fullTo ＝ 期間完整結束日（可能在未來；發文排程的「預計」用這個）
 */
export function resolvePeriod({ period = 'week', end, m, from: cFrom, to: cTo, today }) {
  const yesterday = addDays(today, -1);
  const cap = (d) => (d > yesterday ? yesterday : d);
  if (period === 'r7' || period === 'r30') {
    const n = period === 'r7' ? 7 : 30;
    const to = end && end <= yesterday ? end : yesterday;
    return { period, from: addDays(to, -(n - 1)), to, fullTo: to, label: `近 ${n} 天`, inProgress: false };
  }
  if (period === 'week') {
    const wd = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7; // 週一＝0
    const from = addDays(today, -wd);
    const fullTo = addDays(from, 6);
    return { period, from, to: cap(fullTo), fullTo, label: '本週', inProgress: true, noDataYet: from > yesterday };
  }
  if (period === 'month') {
    const ym = /^\d{4}-\d{2}$/.test(m || '') ? m : today.slice(0, 7);
    const from = ym + '-01';
    const fullTo = lastDayOfMonth(ym);
    const inProgress = fullTo >= today;
    return { period, m: ym, from, to: cap(fullTo), fullTo, label: ym === today.slice(0, 7) ? `本月 ${ym}` : `曆月 ${ym}`, inProgress, noDataYet: from > yesterday };
  }
  if (period === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(cFrom || '') && /^\d{4}-\d{2}-\d{2}$/.test(cTo || '') && cFrom <= cTo) {
    return { period, from: cFrom, to: cap(cTo), fullTo: cTo, label: '自訂', inProgress: cTo >= today, noDataYet: cFrom > yesterday };
  }
  return { period: 'all', from: '2000-01-01', to: yesterday, fullTo: '2099-12-31', label: '全部期間', inProgress: false };
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
