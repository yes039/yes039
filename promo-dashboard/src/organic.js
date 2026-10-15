// 日常 FB 發文：計數口徑與互動彙總
//
// 計數口徑（同一篇在同一欄最多算一次）：
//   預計發文：預定日期在期間內，且狀態不是「取消」
//   已發文：實際發布日期在期間內（不論預定日期是哪天）
//   待發文：預定日期在期間內、尚未發布、未取消；其中預定日期已過今天者另計「逾期」
//   取消：預定日期在期間內且狀態為「取消」，不算入預計
// 互動口徑（第一版）：期間內「實際發布」的貼文，到各篇統計截至時間為止的累計互動；不是期間內新增的互動。
import { addDays } from './periods.js';

export const SUBJECTS = { personal: '個人帳號', page: '粉專', own_group: '自有社團', other_group: '他人社團' };
export const POST_STATUS = ['待製作', '待審核', '待發布', '已發布', '取消'];
export const INTERACTION_DEF = '期間內實際發布的貼文，至各篇「統計截至」時間的累計互動（不是期間內新增的互動）';
export const METRIC_KEYS = ['likes', 'comments', 'shares', 'inquiries', 'conversions'];
export const METRIC_LABEL = { likes: '按讚', comments: '留言', shares: '分享', inquiries: '可確認詢問', conversions: '可確認轉換' };

const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function classify(post, range, today) {
  const inPlan = !!post.planned_date && post.planned_date >= range.from && post.planned_date <= range.fullTo;
  const cancelled = post.status === '取消';
  const isPublished = post.status === '已發布' && !!post.published_date;
  const published = isPublished && post.published_date >= range.from && post.published_date <= range.fullTo;
  const planned = inPlan && !cancelled;
  const pending = planned && !isPublished;
  return { planned, published, pending, overdue: pending && post.planned_date < today, cancelled: inPlan && cancelled };
}

/** 彙總一組貼文；互動只算期間內已發布的貼文 */
export function summarize(posts, range, today) {
  const c = { planned: 0, published: 0, pending: 0, overdue: 0, cancelled: 0 };
  const pub = [];
  for (const p of posts) {
    const k = classify(p, range, today);
    for (const key of Object.keys(c)) if (k[key]) c[key]++;
    if (k.published) pub.push(p);
  }
  const out = { counts: c, publishedPosts: pub.length };
  let asOf = null;
  for (const key of METRIC_KEYS) {
    if (!pub.length) { out[key] = { v: null, s: 'not_computed', r: '本期沒有已發布的貼文' }; continue; }
    const entered = pub.filter((p) => p[key] != null);
    if (!entered.length) { out[key] = { v: null, s: 'not_entered', r: `${pub.length} 篇已發布貼文都還沒登錄${METRIC_LABEL[key]}（人工登錄）` }; continue; }
    const v = entered.reduce((a, p) => a + Number(p[key]), 0);
    const miss = pub.length - entered.length;
    if (miss) out[key] = { v, s: 'incomplete', r: `${miss} 篇已發布貼文尚未登錄${METRIC_LABEL[key]}` };
    else out[key] = v === 0 ? { v: 0, s: 'zero', r: '已登錄，數值為零' } : { v, s: 'value', r: '' };
  }
  for (const p of pub) if (p.metrics_as_of && (!asOf || p.metrics_as_of < asOf)) asOf = p.metrics_as_of;
  out.metricsAsOf = asOf; // 最早的統計截至時間（最舊的一筆）
  return out;
}

/** 日常發文的待辦：待製作／待審核／待發布、待回覆、待更新成效 */
export function postTodos(posts, outletsById, today, horizonDays = 7) {
  const items = [];
  const horizon = addDays(today, horizonDays);
  const yesterday = addDays(today, -1);
  for (const p of posts) {
    const o = outletsById[p.outlet_id];
    const where = o ? `${SUBJECTS[o.type]}・${o.name}` : '';
    const base = { project: '日常發文', project_id: null, owner: p.owner, link: `#/post/${p.id}`, manual: false };
    if (['待製作', '待審核', '待發布'].includes(p.status) && p.planned_date && p.planned_date <= horizon) {
      const overdue = p.planned_date < today;
      items.push({ ...base, level: overdue ? 'serious' : 'warning', kind: '內容', title: `${p.status}：${p.title}`, detail: `${where}・預定 ${md(p.planned_date)}${overdue ? '（已逾期）' : ''}`, due: p.planned_date, status: overdue ? '逾期' : p.status });
    }
    if (p.pending_replies > 0) {
      items.push({ ...base, level: 'warning', kind: '回覆', title: `待回覆 ${p.pending_replies} 則：${p.title}`, detail: where + '（數量為人工登錄）', due: today, status: '待處理', manual: true });
    }
    if (p.status === '已發布' && p.published_date && p.published_date <= yesterday) {
      const missing = METRIC_KEYS.slice(0, 3).some((k) => p[k] == null);
      const stale = p.metrics_as_of && p.metrics_as_of.slice(0, 10) < addDays(today, -3) && p.published_date >= addDays(today, -14);
      if (missing || stale) {
        items.push({ ...base, level: 'warning', kind: '資料', title: `${missing ? '待登錄成效' : '待更新成效'}：${p.title}`, detail: `${where}・${missing ? '尚未登錄按讚、留言、分享' : '統計截至 ' + md(p.metrics_as_of.slice(0, 10))}（人工登錄）`, due: today, status: '待處理', manual: true });
      }
    }
  }
  return items;
}
