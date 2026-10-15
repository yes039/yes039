// 顯示格式與數字狀態
export const STATE_LABEL = {
  value: '', incomplete: '資料不完整', zero: '已確認為零', not_connected: '尚未接入',
  not_computed: '暫不計算', not_provided: '平台未提供', below_threshold: '低於統計門檻', unverified: '待查證',
};

const nf = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
export const fmt = {
  money: (v) => 'NT$' + nf.format(Math.round(v)),
  int: (v) => nf.format(Math.round(v)),
  pct: (v) => (v * 100).toFixed(v < 0.1 ? 2 : 1) + '%',
  ratio: (v) => v.toFixed(2) + ' 倍',
  num: (v) => nf.format(v),
};

export function md(iso) {
  if (!iso) return '—';
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}
export function ymd(iso) {
  return iso ? iso.replace(/-/g, '/') : '—';
}
export function rangeText(r) {
  if (!r) return '';
  if (r.period === 'all') return `全部期間（至 ${ymd(r.to)}）`;
  return `${r.label}｜${ymd(r.from)}–${md(r.to)}${r.inProgress ? '（進行中）' : ''}`;
}
