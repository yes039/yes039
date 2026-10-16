// 宣傳戰情室 API：所有查詢先確認使用者可看的專案，再依專案過濾
import { getUser } from './auth.js';
import { resolvePeriod, todayTW, addDays, overlap, datesInRange } from './periods.js';
import {
  computeScope, countOutcomes, strictCost, enrollLifecycle, judge, anomaliesFor, metricDefs, defaultMetrics, DEFAULT_SETTINGS, OUTCOME_TYPES,
  SOURCE_OF_TYPE, SOURCE_KINDS, ratio, primaryOutcome,
} from './metrics.js';
import {
  validProjectCode, validClaimPrefix, validCampaignCode, validCreativeCode, validClaimCode,
  normalizeClaimCode, buildTrackingUrl, CHANNELS, FORMATS, toHalfWidth,
} from './tracking.js';
import { mapMetaRows, mapOutcomeRows, parseDate, personRef, OUTCOME_COLUMNS } from './csv.js';
import { SUBJECTS, POST_STATUS, INTERACTION_DEF, classify, summarize, postTodos } from './organic.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

class HttpError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const run = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

function int(v, field, { allowNull = true, min = 0 } = {}) {
  if (v === '' || v == null) { if (allowNull) return null; throw new HttpError(`${field}必填`); }
  const n = Number(toHalfWidth(String(v)).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < min) throw new HttpError(`${field}需為 ${min} 以上的數字`);
  return Math.round(n);
}
function date(v, field, allowNull = true) {
  if (!v) { if (allowNull) return null; throw new HttpError(`${field}必填`); }
  const d = parseDate(v);
  if (!d) throw new HttpError(`${field}日期格式不正確`);
  return d;
}
const str = (v, max = 500) => toHalfWidth(v ?? '').slice(0, max);

async function audit(db, who, action, projectId, detail) {
  await run(db, 'INSERT INTO audit_log (id, who, action, project_id, detail, at) VALUES (?,?,?,?,?,?)', uid(), who, action, projectId, JSON.stringify(detail).slice(0, 2000), now());
}

// ---------- 權限 ----------
async function visibleProjects(db, user) {
  if (user.isAdmin) return all(db, 'SELECT * FROM projects ORDER BY is_test, created_at');
  return all(db, `SELECT p.*, m.role AS my_role FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.email = ? ORDER BY p.is_test, p.created_at`, user.email);
}
async function projectFor(db, user, id, needEdit = false) {
  const p = await first(db, 'SELECT * FROM projects WHERE id = ?', id);
  if (!p) throw new HttpError('找不到專案', 404);
  if (user.isAdmin) return p;
  const m = await first(db, 'SELECT role FROM project_members WHERE project_id = ? AND email = ?', id, user.email);
  if (!m) throw new HttpError('找不到專案', 404); // 不透露其他專案是否存在
  if (needEdit && m.role !== 'editor') throw new HttpError('你沒有編輯這個專案的權限', 403);
  return p;
}
async function campaignFor(db, user, id, needEdit = false) {
  const c = await first(db, 'SELECT * FROM campaigns WHERE id = ?', id);
  if (!c) throw new HttpError('找不到活動', 404);
  const p = await projectFor(db, user, c.project_id, needEdit);
  return { c, p };
}

// ---------- 計算 ----------
async function loadSources(db, projectId) {
  const rows = await all(db, 'SELECT * FROM sources WHERE project_id = ?', projectId);
  const map = {};
  for (const k of Object.keys(SOURCE_KINDS)) map[k] = { kind: k, connected: 0, covered_through: null, updated_at: null, note: '' };
  for (const r of rows) map[r.kind] = r;
  return map;
}

/** 每則付費素材應有廣告資料的日子：依投放紀錄期間；沒有投放紀錄時依波次期間 */
function expectedDays(cr, campaign, placements, range, yesterday) {
  if (!cr.paid || cr.status === '規劃中') return [];
  const periods = placements.length
    ? placements.filter((p) => p.status !== '規劃中').map((p) => [p.start_date, p.end_date])
    : [[campaign.start_date, campaign.end_date]];
  const days = new Set();
  for (const [s, e] of periods) {
    if (!s) continue;
    const ov = overlap(range.from, range.to, s, e && e < yesterday ? e : yesterday);
    if (ov) for (const d of datesInRange(ov.from, ov.to)) days.add(d);
  }
  return [...days];
}

/** 計算單一專案在某期間的全部指標（波次、素材、投放紀錄、渠道、來源不明、異常、待辦） */
export async function computeProject(db, project, range, today) {
  const defs = metricDefs(project);
  const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(project.settings_json || '{}') };
  const sources = await loadSources(db, project.id);
  const campaigns = await all(db, 'SELECT * FROM campaigns WHERE project_id = ? ORDER BY start_date DESC, code', project.id);
  const creatives = await all(db, 'SELECT cr.* FROM creatives cr LEFT JOIN campaigns c ON c.id = cr.campaign_id WHERE cr.project_id = ? ORDER BY c.start_date, cr.created_at, cr.code', project.id);
  const placements = await all(db, 'SELECT * FROM placements WHERE project_id = ? ORDER BY code', project.id);
  const links = await all(db, 'SELECT * FROM tracking_links WHERE project_id = ? ORDER BY created_at', project.id);
  const yesterday = addDays(today, -1);
  const recentFrom = addDays(yesterday, -(settings.quietDays - 1));
  const fetchFrom = range.from < recentFrom ? range.from : recentFrom;
  const fetchTo = range.to > yesterday ? range.to : yesterday;
  const adsAll = await all(db, 'SELECT * FROM ad_daily WHERE project_id = ? AND date BETWEEN ? AND ?', project.id, fetchFrom, fetchTo);
  const convAll = await all(db, 'SELECT * FROM conversions WHERE project_id = ? AND date BETWEEN ? AND ?', project.id, fetchFrom, fetchTo);
  const inRange = (r) => r.date >= range.from && r.date <= range.to;
  const ads = adsAll.filter(inRange);
  const conv = convAll.filter(inRange);
  // 累計花費（不受所選期間影響）：專案、波次、素材、投放紀錄
  const cum = await all(db, 'SELECT campaign_id, creative_id, placement_id, SUM(spend) AS s FROM ad_daily WHERE project_id = ? GROUP BY campaign_id, creative_id, placement_id', project.id);
  const cumBy = (field, id) => cum.filter((r) => r[field] === id).reduce((a, r) => a + r.s, 0);
  const spentAll = cum.reduce((a, r) => a + r.s, 0);
  const adDaysAll = new Set((await all(db, 'SELECT DISTINCT creative_id, date FROM ad_daily WHERE project_id = ? AND creative_id IS NOT NULL', project.id)).map((r) => r.creative_id + '|' + r.date));

  const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const expectedByCreative = {};
  for (const cr of creatives) {
    const c = campaignById[cr.campaign_id];
    expectedByCreative[cr.id] = expectedDays(cr, c, placements.filter((p) => p.creative_id === cr.id), range, yesterday).map((date) => ({ key: cr.id, date }));
  }
  const paidIds = new Set(creatives.filter((c) => c.paid).map((c) => c.id));
  // 報名生命週期（全部期間的報名與取消報名，依人重播）
  const lifeRows = await all(db, "SELECT id, type, date, person_ref, qty, created_at, creative_id, campaign_id, note FROM conversions WHERE project_id = ? AND type IN ('enroll','cancel')", project.id);
  const life = enrollLifecycle(lifeRows);
  const ctx = { project, defs, sources, range, today, paidIds, firstEnroll: life.firstIds };
  const lcVal = (n, to, from) => {
    if (!defs.enroll?.enabled) return { v: null, s: 'not_computed', r: '本專案未定義報名' };
    const src = sources.enroll;
    if (!src?.connected) return { v: null, s: 'not_connected', r: src?.note || '報名尚未接入' };
    if (from && to < from) return { v: null, s: 'not_computed', r: '本期還沒有已結束的日子' };
    if (src.covered_through && src.covered_through < to) return { v: n, s: 'incomplete', r: `資料只更新到 ${Number(src.covered_through.slice(5, 7))}/${Number(src.covered_through.slice(8, 10))}` };
    return n === 0 ? { v: 0, s: 'zero', r: '資料完整，數值為零' } : { v: n, s: 'value', r: '' };
  };
  // 累計花費（專案開始至昨天）也要檢查完整度：缺日時只能稱「已知小計」
  const allRange = { from: '0000-01-01', to: yesterday };
  const missingAllOf = (crs) => [...new Set(crs.flatMap((cr) => expectedDays(cr, campaignById[cr.campaign_id], placements.filter((p) => p.creative_id === cr.id), allRange, yesterday)
    .filter((d) => !adDaysAll.has(cr.id + '|' + d))))].sort();
  const cumSpend = (crs, v) => {
    if (!crs.some((x) => x.paid) && !v) return { v: null, s: 'not_computed', r: '無付費渠道' };
    if (!sources.ads?.connected) return { v: null, s: 'not_connected', r: 'FB 廣告數字尚未匯入' };
    const miss = missingAllOf(crs);
    if (miss.length) return { v, s: 'incomplete', r: `已知小計・缺 ${miss.length} 天廣告資料（${miss.slice(0, 3).map((x) => `${Number(x.slice(5, 7))}/${Number(x.slice(8, 10))}`).join('、')}${miss.length > 3 ? '…' : ''}）`, missing: miss };
    return v === 0 ? { v: 0, s: 'zero', r: '資料完整，數值為零' } : { v, s: 'value', r: '' };
  };
  const scope = (crs, a, c) => computeScope(ctx, {
    ads: a, conv: c, hasPaid: crs.some((x) => x.paid), expected: crs.flatMap((x) => expectedByCreative[x.id]), keyField: 'creative_id',
  });

  const projectMetrics = scope(creatives, ads, conv);
  const primary = primaryOutcome(defs);
  const campaignMetrics = {};
  const outCampaigns = [];
  const outCreatives = [];
  for (const c of campaigns) {
    const crsRaw = creatives.filter((x) => x.campaign_id === c.id);
    const paid = crsRaw.some((x) => x.paid);
    const m = scope(crsRaw, ads.filter((r) => r.campaign_id === c.id), conv.filter((r) => r.campaign_id === c.id));
    m.spendAll = cumBy('campaign_id', c.id);
    m.spendCum = cumSpend(crsRaw, m.spendAll);
    const campEnded = c.status === '已結束' || (!!c.end_date && c.end_date < today);
    const campLive = crsRaw.some((x) => expectedByCreative[x.id].length) || ads.some((r) => r.campaign_id === c.id);
    if (paid && !campLive) for (const k of ['spend', 'impressions', 'link_clicks', 'ctr', 'cpc', 'cost_primary', 'cost_enroll', 'return_on_spend']) m[k] = { v: null, s: 'not_computed', r: '本期未投放' };
    const src = primary ? sources[SOURCE_OF_TYPE[primary]] : null;
    if (c.status === '進行中' && primary && src?.connected && src.covered_through >= yesterday && paid) {
      m.recent = {
        spend: adsAll.filter((r) => r.campaign_id === c.id && r.date >= recentFrom && r.date <= yesterday).reduce((a, r) => a + r.spend, 0),
        outcome: convAll.filter((r) => r.campaign_id === c.id && paidIds.has(r.creative_id) && r.type === primary && r.date >= recentFrom && r.date <= yesterday).length,
      };
    }
    campaignMetrics[c.id] = m;
    const crs = crsRaw.map((cr) => {
      const cm = scope([cr], ads.filter((r) => r.creative_id === cr.id), conv.filter((r) => r.creative_id === cr.id));
      cm.spendAll = cumBy('creative_id', cr.id);
      cm.spendCum = cr.paid && cr.status === '規劃中' && !cm.spendAll ? { v: null, s: 'not_computed', r: '尚未投放' } : cumSpend([cr], cm.spendAll);
      const hasAds = ads.some((r) => r.creative_id === cr.id);
      const notLive = cr.paid && !hasAds && (cr.status === '規劃中' || !expectedByCreative[cr.id].length);
      const why = cr.status === '規劃中' ? '尚未投放' : '本期未投放';
      const crEnded = cr.status === '已結束' || campEnded;
      if (notLive) for (const k of ['spend', 'impressions', 'link_clicks', 'ctr', 'cpc', 'cost_primary', 'cost_enroll', 'return_on_spend']) cm[k] = { v: null, s: 'not_computed', r: why };
      const pls = placements.filter((p) => p.creative_id === cr.id).map((pl) => {
        const exp = expectedDays(cr, c, [pl], range, yesterday).map((date) => ({ key: pl.id, date }));
        const pm = computeScope(ctx, { ads: ads.filter((r) => r.placement_id === pl.id), conv: [], hasPaid: !!cr.paid, expected: exp, keyField: 'placement_id' });
        for (const t of OUTCOME_TYPES) pm[t] = { v: null, s: 'not_computed', r: '成果只追蹤到素材層，不分投放紀錄' };
        pm.spendAll = cumBy('placement_id', pl.id);
        return { ...pl, metrics: pm };
      });
      const noPlacement = pls.length ? ads.filter((r) => r.creative_id === cr.id && !r.placement_id) : [];
      const item = {
        ...cr, campaign_code: c.code, metrics: cm, placements: pls,
        unplacedSpend: noPlacement.reduce((a, r) => a + r.spend, 0),
        ended: crEnded,
        judgement: cr.paid && crEnded ? judge(cm, settings, c.target_cpl, true, defs, { ended: true }) : notLive ? { label: '—', reason: why, basis: [] } : judge(cm, settings, c.target_cpl, !!cr.paid, defs), links: links.filter((l) => l.creative_id === cr.id).length,
      };
      outCreatives.push(item);
      return item;
    });
    outCampaigns.push({ ...c, paid, ended: campEnded, metrics: m, judgement: paid && campEnded ? judge(m, settings, c.target_cpl, true, defs, { ended: true }) : paid && !campLive ? { label: '—', reason: '本期未投放', basis: [] } : judge(m, settings, c.target_cpl, paid, defs), creatives: crs });
  }

  // 素材依波次開始日、建立順序排列，畫面上的「素材 1、2、3」才穩定
  const order = new Map(creatives.map((c, i) => [c.id, i]));
  outCreatives.sort((a, b) => order.get(a.id) - order.get(b.id));

  // 依渠道比較（同一專案內，合計分子 ÷ 合計分母）
  const byChannel = Object.keys(CHANNELS).map((ch) => {
    const crs = creatives.filter((c) => c.channel === ch);
    if (!crs.length) return null;
    const ids = new Set(crs.map((c) => c.id));
    const m = scope(crs, ads.filter((r) => ids.has(r.creative_id)), conv.filter((r) => ids.has(r.creative_id)));
    return { channel: ch, label: CHANNELS[ch], paid: crs.some((c) => c.paid), creatives: ids.size, metrics: m };
  }).filter(Boolean);

  // 來源不明：沒有波次的成果；只對應到波次、沒對應到素材的另列，不分配給任何素材
  const bucket = (rows) => {
    const out = {};
    for (const t of OUTCOME_TYPES) {
      const rs = rows.filter((r) => r.type === t);
      out[t] = rs.reduce((a, r) => a + r.qty, 0);
      if (t === 'payment' || t === 'refund') out[t + '_amount'] = rs.reduce((a, r) => a + r.amount, 0);
    }
    return out;
  };
  const unknown = bucket(conv.filter((r) => !r.campaign_id));
  const campaignOnly = bucket(conv.filter((r) => r.campaign_id && !r.creative_id));
  const adsUnmatched = ads.filter((r) => !r.creative_id).length;

  // 成果分三組：付費廣告成果／免費引流成果／來源不明（含只對應到波次）；專案合計以人去重，不等於三組相加
  const freeIds = new Set(creatives.filter((c) => !c.paid).map((c) => c.id));
  const groupsOf = (gctx, rows) => ({
    paid: countOutcomes(gctx, rows.filter((r) => paidIds.has(r.creative_id))),
    free: countOutcomes(gctx, rows.filter((r) => freeIds.has(r.creative_id))),
    unknown: countOutcomes(gctx, rows.filter((r) => !r.creative_id)),
    campaignOnly: countOutcomes(gctx, rows.filter((r) => r.campaign_id && !r.creative_id)),
    noCampaign: countOutcomes(gctx, rows.filter((r) => !r.campaign_id)),
  });
  const groups = groupsOf(ctx, conv);

  // 累計（專案開始至昨天）：與所選期間無關
  const startDate = campaigns.map((c) => c.start_date).filter(Boolean).sort()[0] || null;
  const cumRange = { from: startDate || yesterday, to: yesterday };
  const convCum = await all(db, 'SELECT * FROM conversions WHERE project_id = ? AND date <= ?', project.id, yesterday);
  const cumCtx = { ...ctx, range: cumRange };
  const cumAll = countOutcomes(cumCtx, convCum);
  const cumGroups = groupsOf(cumCtx, convCum);
  const spendCum = cumSpend(creatives, spentAll);
  const lcP = life.stats(range.from, range.to);
  const lcC = life.stats('0000-01-01', yesterday);
  const enrollment = {
    period: { new: lcVal(lcP.newIn, range.to, range.from), cancel: lcVal(lcP.cancelIn, range.to, range.from), restore: lcVal(lcP.restoreIn, range.to, range.from) },
    cumulative: { ever: lcVal(lcC.ever, yesterday), cancelled: lcVal(lcC.cancelledNow, yesterday), restored: lcVal(lcC.restoredNow, yesterday), valid: lcVal(lcC.valid, yesterday) },
    cancels: defs.enroll?.enabled ? lifeRows.filter((r) => r.type === 'cancel').sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20).map((r) => {
      const after = lifeRows.some((x) => x.type === 'enroll' && x.person_ref === r.person_ref && (x.date > r.date || (x.date === r.date && x.created_at > r.created_at)));
      return { id: r.id, date: r.date, recorded_at: r.created_at, reason: r.note, creative: creatives.find((c) => c.id === r.creative_id)?.code || '', status: after ? '已恢復報名' : '仍為取消' };
    }) : [],
  };
  const enrollCum = enrollment.cumulative.valid; // 達成率用有效報名
  const cumulative = {
    from: startDate, to: yesterday, spend: spendCum, all: cumAll, groups: cumGroups, enrollment: enrollment.cumulative,
    cost_primary: primary && paidIds.size ? strictCost(spendCum, cumGroups.paid[primary]) : null,
    // 累計報名資料不完整時不給確定的達成率；保留已知人數與目標供畫面顯示
    enrollProgress: !defs.enroll?.enabled ? { v: null, s: 'not_computed', r: '本專案未定義報名' }
      : !project.target_enroll ? { v: null, s: 'not_computed', r: '招生目標待填', n: enrollCum.v }
        : enrollCum.v == null ? { v: null, s: 'not_computed', r: enrollCum.r, d: project.target_enroll }
          : enrollCum.s === 'incomplete' ? { v: null, s: 'not_computed', r: `資料不完整（${enrollCum.r}），達成率暫不計算`, n: enrollCum.v, d: project.target_enroll, known: true }
            : { v: enrollCum.v / project.target_enroll, s: 'value', r: '', n: enrollCum.v, d: project.target_enroll },
  };
  const budgetUse = !project.budget ? { v: null, s: 'not_computed', r: '總預算待填' }
    : spendCum.v == null ? { v: null, s: spendCum.s, r: spendCum.r }
      : { v: spendCum.v / project.budget, s: spendCum.s === 'incomplete' ? 'incomplete' : 'value', r: spendCum.s === 'incomplete' ? '累計花費缺資料，實際使用率至少此數' : '', n: spendCum.v, d: project.budget };
  const { anomalies, autoTodos } = anomaliesFor({
    project, defs, settings, campaigns, creatives, campaignMetrics, projectMetrics, adsUnmatched,
    unknownConv: unknown, links, sources, today, range,
  });
  const manualTodos = await all(db, "SELECT * FROM todos WHERE project_id = ? AND done = 0 ORDER BY due IS NULL, due", project.id);
  const periodDates = campaigns.filter((c) => c.start_date);
  return {
    project: { ...project, metrics: defs, settings },
    sources, campaigns: outCampaigns, creatives: outCreatives, byChannel, metrics: projectMetrics, unknown, campaignOnly, adsUnmatched, groups, cumulative, enrollment,
    anomalies,
    todos: [...autoTodos, ...manualTodos.map((t) => ({ ...t, level: 'manual', kind: '人工待辦', manual: true, project: project.code, project_id: project.id, link: `#/p/${project.id}/sources` }))],
    budget: { total: project.budget, spentAll, spend: spendCum, used: budgetUse },
    flight: periodDates.length ? { from: periodDates.map((c) => c.start_date).sort()[0], to: periodDates.map((c) => c.end_date || c.start_date).sort().at(-1) } : null,
  };
}

/** 跨專案加總：只加總口徑一致（平台定義、同幣別）的數字 */
function sumAcross(list) {
  const used = list.filter((x) => x.s !== 'not_computed');
  if (!used.length) return { v: null, s: 'not_computed', r: '沒有付費渠道' };
  const withValue = used.filter((x) => x.v != null);
  if (!withValue.length) return { v: null, s: 'not_connected', r: '各專案皆尚未接入' };
  const v = withValue.reduce((a, x) => a + x.v, 0);
  const bad = used.filter((x) => x.s === 'not_connected' || x.s === 'incomplete');
  if (bad.length) return { v, s: 'incomplete', r: `${bad.length} 個專案資料未齊` };
  return v === 0 ? { v: 0, s: 'zero', r: '資料完整，數值為零' } : { v, s: 'value', r: '' };
}

async function organicData(db, range, today, filters = {}) {
  const outlets = await all(db, 'SELECT * FROM outlets ORDER BY type, name');
  const outletsById = Object.fromEntries(outlets.map((o) => [o.id, o]));
  // 期間內預定或發布的貼文，加上預定在近期（待辦用）的貼文
  const posts = await all(db, `SELECT * FROM posts WHERE (planned_date BETWEEN ? AND ?) OR (published_date BETWEEN ? AND ?) OR (status IN ('待製作','待審核','待發布') AND planned_date <= ?)
    OR (status = '已發布' AND published_date >= ?) OR pending_replies > 0 ORDER BY COALESCE(published_date, planned_date)`,
  range.from, range.fullTo, range.from, range.fullTo, addDays(today, 7), addDays(today, -14));
  const projects = await all(db, 'SELECT id, code, name FROM projects');
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const decorate = (p) => ({ ...p, outlet: outletsById[p.outlet_id], project: p.project_id ? projById[p.project_id] : null, flags: classify(p, range, today) });
  let scoped = posts.map(decorate);
  const todos = postTodos(posts, outletsById, today);
  if (filters.type) scoped = scoped.filter((p) => p.outlet?.type === filters.type);
  if (filters.outlet) scoped = scoped.filter((p) => p.outlet_id === filters.outlet);
  if (filters.project === 'none') scoped = scoped.filter((p) => !p.project_id);
  else if (filters.project) scoped = scoped.filter((p) => p.project_id === filters.project);
  const inPeriod = scoped.filter((p) => p.flags.planned || p.flags.published || p.flags.cancelled);
  const bySubject = Object.entries(SUBJECTS).map(([type, label]) => ({
    type, label, outlets: outlets.filter((o) => o.type === type).length,
    ...summarize(inPeriod.filter((p) => p.outlet?.type === type), range, today),
  }));
  const byOutlet = outlets.filter((o) => !filters.type || o.type === filters.type).map((o) => ({ ...o, label: SUBJECTS[o.type], ...summarize(inPeriod.filter((p) => p.outlet_id === o.id), range, today) }));
  return { outlets, bySubject, byOutlet, total: summarize(inPeriod, range, today), posts: inPeriod, todos, definition: INTERACTION_DEF };
}

async function home(db, user, range, today) {
  const projects = await visibleProjects(db, user);
  const results = [];
  for (const p of projects) results.push(await computeProject(db, p, range, today));
  const organic = user.isAdmin ? await organicData(db, range, today) : null;
  const manualOrganic = user.isAdmin ? await all(db, 'SELECT * FROM todos WHERE project_id IS NULL AND done = 0 ORDER BY due IS NULL, due') : [];
  const levelOrder = { critical: 0, serious: 1, warning: 2, manual: 3 };
  const todos = [
    ...(organic ? organic.todos : []),
    ...manualOrganic.map((t) => ({ ...t, level: 'manual', kind: '人工待辦', manual: true, project: '日常發文', link: '#/organic' })),
    ...results.flatMap((r) => [...r.anomalies, ...r.todos]),
  ].map((t) => ({ ...t, overdue: t.status === '逾期' || (!!t.due && t.due < today) }))
    // 排序：逾期優先 → 急迫程度 → 期限（無期限排最後）
    .sort((a, b) => (b.overdue - a.overdue) || (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9) || String(a.due || '9').localeCompare(String(b.due || '9')));
  return {
    range, today, user,
    organic: organic && { bySubject: organic.bySubject, total: organic.total, definition: organic.definition, outlets: organic.outlets.length },
    projects: results.map((r) => ({
      project: r.project, metrics: r.metrics, unknown: r.unknown, budget: r.budget, sources: r.sources, flight: r.flight, groups: r.groups, cumulative: r.cumulative, enrollment: r.enrollment,
      active: r.campaigns.filter((c) => c.status === '進行中').map((c) => ({ id: c.id, code: c.code, name: c.name, offer: c.offer, judgement: c.judgement })),
      paidCreatives: r.creatives.filter((c) => c.paid).length,
      missingAdDates: r.metrics.missingAdDates,
      anomalies: r.anomalies.length, todos: r.todos.length,
    })),
    todos,
  };
}

// ---------- 寫入 ----------
async function createProject(db, user, b) {
  if (!user.isAdmin) throw new HttpError('只有系統管理者可以新增專案', 403);
  const code = str(b.code).toUpperCase();
  const prefix = str(b.claim_prefix).toUpperCase();
  if (!validProjectCode(code)) throw new HttpError('專案代碼需為 2～5 個大寫英文字母');
  if (!validClaimPrefix(prefix)) throw new HttpError('領取碼字首需為 1 個大寫英文字母');
  if (!str(b.name)) throw new HttpError('專案名稱必填');
  if (await first(db, 'SELECT id FROM projects WHERE code = ?', code)) throw new HttpError('專案代碼已被使用');
  if (await first(db, 'SELECT id FROM projects WHERE claim_prefix = ?', prefix)) throw new HttpError('領取碼字首已被其他專案使用');
  const id = uid();
  const t = now();
  await run(db, `INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope,
    audience, course_info, course_dates, price_info, target_enroll, is_test, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, code, prefix, str(b.name, 100), str(b.kind || '合作', 20), str(b.partner, 100), str(b.owner, 100), str(b.goal, 1000),
  int(b.budget, '專案預算'), 'TWD', str(b.status || '規劃中', 10), JSON.stringify(sanitizeMetrics(b.metrics) || defaultMetrics()), JSON.stringify(sanitizeSettings(b.settings)),
  str(b.data_scope, 1000), str(b.audience, 500), str(b.course_info, 1000), str(b.course_dates, 200), str(b.price_info, 300), int(b.target_enroll, '招生目標'), b.is_test ? 1 : 0, t, t);
  await audit(db, user.email, 'project.create', id, { code });
  return { id };
}

function sanitizeMetrics(list) {
  if (!Array.isArray(list)) return null;
  const base = defaultMetrics();
  return base.map((d) => {
    const m = list.find((x) => x.key === d.key) || {};
    return { key: d.key, label: str(m.label || d.label, 20), enabled: !!m.enabled, def: str(m.def ?? d.def, 300) };
  });
}
function sanitizeSettings(s) {
  const out = {};
  if (!s) return out;
  for (const k of ['minClicks', 'minSpend', 'quietDays', 'staleDays']) if (s[k] != null && s[k] !== '') out[k] = int(s[k], k, { min: 0 });
  if (s.adjustRatio) out.adjustRatio = Math.max(1, Number(s.adjustRatio) || 1.5);
  if (s.unknownShare) out.unknownShare = Math.min(1, Math.max(0, Number(s.unknownShare) || 0.3));
  return out;
}

async function updateProject(db, user, p, b) {
  const metrics = sanitizeMetrics(b.metrics) || JSON.parse(p.metrics_json);
  const keep = (k, max) => str(b[k] ?? p[k], max);
  await run(db, `UPDATE projects SET name=?, kind=?, partner=?, owner=?, goal=?, budget=?, status=?, metrics_json=?, settings_json=?, data_scope=?,
    audience=?, course_info=?, course_dates=?, price_info=?, target_enroll=?, updated_at=? WHERE id=?`,
    keep('name', 100) || p.name, keep('kind', 20), keep('partner', 100), keep('owner', 100), keep('goal', 1000),
    'budget' in b ? int(b.budget, '專案預算') : p.budget, keep('status', 10), JSON.stringify(metrics),
    JSON.stringify(b.settings ? sanitizeSettings(b.settings) : JSON.parse(p.settings_json || '{}')), keep('data_scope', 1000),
    keep('audience', 500), keep('course_info', 1000), keep('course_dates', 200), keep('price_info', 300),
    'target_enroll' in b ? int(b.target_enroll, '招生目標') : p.target_enroll, now(), p.id);
  await audit(db, user.email, 'project.update', p.id, { fields: Object.keys(b) });
}

async function saveCampaign(db, user, p, b, existing) {
  const code = str(b.code ?? existing?.code).toUpperCase();
  if (!existing) {
    if (!validCampaignCode(code, p.code)) throw new HttpError(`活動代碼格式需為 ${p.code}-年月-序號，例如 ${p.code}-2610-01`);
    if (await first(db, 'SELECT id FROM campaigns WHERE code = ?', code)) throw new HttpError('活動代碼已存在');
  }
  const start = date(b.start_date, '開始日');
  const end = date(b.end_date, '結束日');
  if (start && end && end < start) throw new HttpError('結束日不能早於開始日');
  if (!str(b.name ?? existing?.name)) throw new HttpError('活動名稱必填');
  const vals = [str(b.name ?? existing?.name, 100), str(b.offer, 300), str(b.audience, 300), str(b.destination, 300), str(b.flow, 20), start, end,
    int(b.budget, '預算'), int(b.target_cpl, '目標成本'), str(b.owner, 100), str(b.status || '規劃中', 10), str(b.note, 1000)];
  if (existing) {
    await run(db, `UPDATE campaigns SET name=?, offer=?, audience=?, destination=?, flow=?, start_date=?, end_date=?, budget=?, target_cpl=?, owner=?, status=?, note=?, updated_at=? WHERE id=?`, ...vals, now(), existing.id);
    await audit(db, user.email, 'campaign.update', p.id, { code: existing.code });
    return { id: existing.id };
  }
  const id = uid();
  await run(db, `INSERT INTO campaigns (id, project_id, code, name, offer, audience, destination, flow, start_date, end_date, budget, target_cpl, owner, status, note, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, p.id, code, ...vals, now(), now());
  await audit(db, user.email, 'campaign.create', p.id, { code });
  return { id };
}

async function saveCreative(db, user, c, b, existing) {
  const channel = b.channel ?? existing?.channel;
  if (!(channel in CHANNELS)) throw new HttpError('渠道不正確');
  const code = existing ? existing.code : str(b.code);
  if (!existing) {
    if (!validCreativeCode(code, c.code)) throw new HttpError(`素材代碼格式需為 ${c.code}-格式碼序號-v版本，例如 ${c.code}-VD01-v1`);
    if (await first(db, 'SELECT id FROM creatives WHERE code = ?', code)) throw new HttpError('素材代碼已存在');
  }
  const format = code.slice(c.code.length + 1, c.code.length + 3);
  const paid = channel === 'fb_ad' ? 1 : (b.paid ? 1 : 0);
  const preview = str(b.preview_url ?? existing?.preview_url, 200000);
  if (preview && !/^https:\/\//.test(preview) && !/^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/.test(preview)) throw new HttpError('預覽需為 https 網址或圖片');
  const video = str(b.video_url ?? existing?.video_url, 1000);
  if (video && !/^https:\/\//.test(video)) throw new HttpError('影片需為 https 網址');
  const landing = str(b.landing_url ?? existing?.landing_url, 1000);
  if (landing && !/^https:\/\//.test(landing)) throw new HttpError('落地頁需為 https 網址');
  const prod = b.prod_status ?? existing?.prod_status ?? '製作中';
  if (!['製作中', '待審核', '已核可'].includes(prod)) throw new HttpError('製作狀態不正確');
  const keep = (k, max) => str(b[k] ?? existing?.[k], max);
  const vals = [keep('name', 200), channel, paid, format in FORMATS ? format : '', str(b.status || existing?.status || '規劃中', 10), keep('platform_ref', 200),
    prod, keep('owner', 100), keep('headline', 200), keep('copy_text', 3000), keep('cta', 50), keep('appeal', 300), keep('destination', 300), preview, video, landing];
  if (prod !== '已核可' && ['進行中'].includes(vals[4])) throw new HttpError('素材未核可前不能設為投放中');
  if (existing) {
    await run(db, 'UPDATE creatives SET name=?, channel=?, paid=?, format=?, status=?, platform_ref=?, prod_status=?, owner=?, headline=?, copy_text=?, cta=?, appeal=?, destination=?, preview_url=?, video_url=?, landing_url=?, updated_at=? WHERE id=?', ...vals, now(), existing.id);
    // 正式素材換了圖片或影片：退回「測試」，要再確認一次（反方向絕不自動變正式）
    if (existing.asset_status === '正式' && (preview !== existing.preview_url || video !== existing.video_url)) {
      await run(db, "UPDATE creatives SET asset_status='測試', asset_confirmed_by='', asset_confirmed_at=NULL WHERE id=?", existing.id);
      await audit(db, user.email, 'creative.asset_status', c.project_id, { code, from: '正式', to: '測試', why: '更換素材檔案' });
    }
    await audit(db, user.email, 'creative.update', c.project_id, { code });
    return { id: existing.id };
  }
  const id = uid();
  await run(db, `INSERT INTO creatives (id, project_id, campaign_id, code, name, channel, paid, format, status, platform_ref, prod_status, owner, headline, copy_text, cta, appeal, destination, preview_url, video_url, landing_url, asset_status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'測試',?,?)`, id, c.project_id, c.id, code, ...vals, now(), now());
  await audit(db, user.email, 'creative.create', c.project_id, { code });
  return { id };
}

async function markSource(db, projectId, kind, coveredThrough) {
  const cur = await first(db, 'SELECT * FROM sources WHERE project_id = ? AND kind = ?', projectId, kind);
  const covered = cur?.covered_through && coveredThrough && cur.covered_through > coveredThrough ? cur.covered_through : (coveredThrough || cur?.covered_through || null);
  await run(db, `INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,1,?,?,?)
    ON CONFLICT(project_id, kind) DO UPDATE SET connected=1, covered_through=excluded.covered_through, updated_at=excluded.updated_at`, projectId, kind, covered, now(), cur?.note || '');
}

async function lookups(db, p) {
  const campaigns = await all(db, 'SELECT * FROM campaigns WHERE project_id = ?', p.id);
  const creatives = await all(db, 'SELECT * FROM creatives WHERE project_id = ?', p.id);
  const codes = await all(db, 'SELECT * FROM claim_codes WHERE project_id = ?', p.id);
  const placements = await all(db, 'SELECT * FROM placements WHERE project_id = ?', p.id);
  return {
    placementsByCode: new Map(placements.map((x) => [x.code, x])),
    defs: metricDefs(p),
    campaignsByCode: new Map(campaigns.map((c) => [c.code, c])),
    creativesByCode: new Map(creatives.map((c) => [c.code, c])),
    claimCodes: new Map(codes.map((c) => [normalizeClaimCode(c.code), c])),
  };
}

/**
 * 檢查取消報名是否能成立：依時間重播同一人的報名／取消。
 * 取消前必須是「有效報名」狀態；已取消的人不能再取消一次（避免重複扣人）。
 * existing：資料庫裡的報名與取消紀錄；incoming：要新增的紀錄（依日期處理）。回傳每筆的錯誤訊息（沒有錯誤為空字串）。
 */
function checkCancels(existing, incoming) {
  const events = existing.map((r) => ({ ...r, _old: true }));
  const errors = new Map();
  const sorted = [...incoming].sort((a, b) => a.date.localeCompare(b.date) || (a.line || 0) - (b.line || 0));
  for (const r of sorted) {
    if (r.type !== 'cancel' && r.type !== 'enroll') continue;
    if (r.type === 'cancel') {
      const mine = events.filter((e) => e.person_ref === r.person_ref && e.date <= r.date)
        .sort((a, b) => a.date.localeCompare(b.date) || (a._old === b._old ? String(a.created_at || '~').localeCompare(String(b.created_at || '~')) : a._old ? -1 : 1));
      let enrolled = false;
      for (const e of mine) enrolled = e.type === 'enroll' ? true : false;
      if (!mine.some((e) => e.type === 'enroll')) { errors.set(r, '找不到這個人在取消日期之前的報名紀錄'); continue; }
      if (!enrolled) { errors.set(r, '這個人目前已是取消狀態，不能重複取消'); continue; }
    }
    if (r.person_ref) events.push(r);
  }
  return errors;
}

async function importPreview(db, p, b, env) {
  const kind = b.kind;
  const text = String(b.text || '');
  if (text.length > 2_000_000) throw new HttpError('檔案太大（上限約 2MB）');
  const lk = await lookups(db, p);
  if (kind === 'ads') {
    const { rows, errors } = mapMetaRows(text, lk.creativesByCode, lk.placementsByCode);
    for (const r of rows) {
      if (r.status !== 'ok' && r.status !== 'unmatched') continue;
      const ex = await first(db, 'SELECT id FROM ad_daily WHERE project_id = ? AND date = ? AND ad_name = ?', p.id, r.date, r.adName);
      r.action = ex ? 'update' : 'insert';
    }
    return { kind, rows, errors };
  }
  if (kind === 'outcomes') {
    const { rows, errors } = await mapOutcomeRows(text, lk, env.HASH_SALT || 'dev-salt');
    const seen = new Set();
    for (const r of rows) {
      if (r.status !== 'ok') continue;
      if (r.external_ref) {
        const key = r.type + '|' + r.external_ref;
        if (seen.has(key)) { r.status = 'error'; r.message = '檔案內外部編號重複'; continue; }
        seen.add(key);
        const ex = await first(db, 'SELECT id FROM conversions WHERE project_id = ? AND type = ? AND external_ref = ?', p.id, r.type, r.external_ref);
        r.action = ex ? 'update' : 'insert';
      } else r.action = 'insert';
    }
    // 取消報名要對應到有效報名；同一檔案內先報名後取消、取消後恢復都可以
    const existing = (await all(db, "SELECT id, type, date, person_ref, external_ref, created_at FROM conversions WHERE project_id = ? AND type IN ('enroll','cancel') AND person_ref IS NOT NULL", p.id))
      .filter((e) => !rows.some((r) => r.status === 'ok' && r.action === 'update' && r.type === e.type && r.external_ref === e.external_ref));
    const cErr = checkCancels(existing, rows.filter((r) => r.status === 'ok'));
    for (const [r, msg] of cErr) { r.status = 'error'; r.message = msg; }
    return { kind, rows, errors };
  }
  throw new HttpError('不支援的匯入類型');
}

async function importCommit(db, user, p, b, env) {
  const preview = await importPreview(db, p, b, env);
  if (preview.errors.length) throw new HttpError(preview.errors.join('；'));
  const bad = preview.rows.filter((r) => r.status === 'error');
  if (bad.length && !b.skipErrors) throw new HttpError(`有 ${bad.length} 列錯誤；修正後再匯入，或勾選「略過錯誤列」`);
  const batch = uid();
  let inserted = 0; let updated = 0; let maxDate = null;
  const stmts = [];
  for (const r of preview.rows) {
    if (r.status === 'error' || r.status === 'skip') continue;
    if (!maxDate || r.date > maxDate) maxDate = r.date;
    if (preview.kind === 'ads') {
      stmts.push(db.prepare(`INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, placement_id, ad_name, spend, impressions, link_clicks, source, batch_id, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'csv',?,?) ON CONFLICT(project_id, date, ad_name) DO UPDATE SET spend=excluded.spend, impressions=excluded.impressions,
        link_clicks=excluded.link_clicks, campaign_id=excluded.campaign_id, creative_id=excluded.creative_id, placement_id=excluded.placement_id, batch_id=excluded.batch_id`)
        .bind(uid(), p.id, r.date, r.campaign_id, r.creative_id, r.placement_id || null, r.adName, r.spend, r.impressions, r.link_clicks, batch, now()));
    } else if (r.action === 'update') {
      stmts.push(db.prepare(`UPDATE conversions SET date=?, campaign_id=?, creative_id=?, claim_code=?, qty=?, amount=?, person_ref=?, note=?, batch_id=?, source='csv'
        WHERE project_id=? AND type=? AND external_ref=?`).bind(r.date, r.campaign_id, r.creative_id, r.claim_code, r.qty, r.amount, r.person_ref, r.note, batch, p.id, r.type, r.external_ref));
    } else {
      stmts.push(db.prepare(`INSERT INTO conversions (id, project_id, type, date, campaign_id, creative_id, claim_code, qty, amount, person_ref, external_ref, source, batch_id, note, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'csv',?,?,?)`).bind(uid(), p.id, r.type, r.date, r.campaign_id, r.creative_id, r.claim_code, r.qty, r.amount, r.person_ref, r.external_ref, batch, r.note, now()));
    }
    if (r.action === 'update') updated++; else inserted++;
  }
  if (stmts.length) await db.batch(stmts);
  const covered = b.coveredThrough ? date(b.coveredThrough, '資料更新到') : maxDate;
  if (preview.kind === 'ads') { if (stmts.length) await markSource(db, p.id, 'ads', covered); }
  else {
    const kinds = new Set(preview.rows.filter((r) => r.status === 'ok').map((r) => SOURCE_OF_TYPE[r.type]));
    for (const k of b.sourceKinds || []) if (k in SOURCE_KINDS) kinds.add(k);
    for (const k of kinds) await markSource(db, p.id, k, covered);
  }
  const skipped = preview.rows.length - inserted - updated;
  await run(db, `INSERT INTO imports (id, project_id, kind, filename, rows_total, rows_inserted, rows_updated, rows_skipped, messages_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    batch, p.id, preview.kind, str(b.filename, 200), preview.rows.length, inserted, updated, skipped,
    JSON.stringify(preview.rows.filter((r) => r.status !== 'ok').map((r) => `第 ${r.line} 列：${r.message}`).slice(0, 200)), user.email, now());
  await audit(db, user.email, 'import', p.id, { kind: preview.kind, inserted, updated, skipped });
  return { batch, inserted, updated, skipped, covered };
}

async function exportCsv(db, p, range, today) {
  const r = await computeProject(db, p, range, today);
  const cell = (x) => (x.v == null ? `[${x.s}]` : Math.round(x.v * 100) / 100);
  const keys = ['spend', 'impressions', 'link_clicks', ...OUTCOME_TYPES.filter((t) => r.project.metrics[t]?.enabled)];
  const head = ['專案', '期間', '層級', '代碼', '名稱', '渠道', ...keys.map((k) => r.project.metrics[k]?.label || { spend: '花費', impressions: '曝光', link_clicks: '連結點擊' }[k]), '判斷'];
  const lines = [head];
  for (const c of r.campaigns) {
    lines.push([p.code, `${range.from}~${range.to}`, '活動', c.code, c.name, c.paid ? '含付費' : '免費', ...keys.map((k) => cell(c.metrics[k])), c.judgement.label]);
    for (const cr of c.creatives) lines.push([p.code, `${range.from}~${range.to}`, '素材', cr.code, cr.name, CHANNELS[cr.channel], ...keys.map((k) => cell(cr.metrics[k])), cr.judgement.label]);
  }
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return '﻿' + lines.map((l) => l.map(esc).join(',')).join('\r\n');
}

// ---------- 日常發文 ----------
function requireAdmin(user) {
  if (!user.isAdmin) throw new HttpError('日常發文只開放系統管理者', 403);
}
const optInt = (v, field) => (v === '' || v == null ? null : int(v, field));

async function savePost(db, user, b, existing) {
  requireAdmin(user);
  const keep = (k, max) => str(b[k] ?? existing?.[k], max);
  const outletId = b.outlet_id ?? existing?.outlet_id;
  if (!outletId || !(await first(db, 'SELECT id FROM outlets WHERE id = ?', outletId))) throw new HttpError('請選擇發布位置');
  const title = keep('title', 200);
  if (!title) throw new HttpError('主題必填');
  const status = b.status ?? existing?.status ?? '待製作';
  if (!POST_STATUS.includes(status)) throw new HttpError('狀態不正確');
  const planned = date(b.planned_date ?? existing?.planned_date, '預定日期');
  const published = date(b.published_date ?? existing?.published_date, '實際發布日期');
  if (status === '已發布' && !published) throw new HttpError('狀態為已發布時，請填實際發布日期');
  if (published && status !== '已發布') throw new HttpError('填了實際發布日期，狀態需為「已發布」');
  if (!planned && !published) throw new HttpError('預定日期或實際發布日期至少填一個');
  let projectId = 'project_id' in b ? (b.project_id || null) : existing?.project_id ?? null;
  if (projectId && !(await first(db, 'SELECT id FROM projects WHERE id = ?', projectId))) throw new HttpError('支援專案不存在');
  let topicId = 'topic_id' in b ? (b.topic_id || null) : existing?.topic_id ?? null;
  if (str(b.new_topic)) {
    topicId = uid();
    await run(db, 'INSERT INTO topics (id, title, note, is_test, created_at) VALUES (?,?,?,0,?)', topicId, str(b.new_topic, 200), '', now());
  }
  const url = keep('url', 500);
  if (url && !/^https:\/\//.test(url)) throw new HttpError('貼文連結需為 https 網址');
  const m = {};
  let metricsChanged = false;
  for (const k of ['likes', 'comments', 'shares', 'inquiries', 'conversions', 'pending_replies']) {
    m[k] = k in b ? optInt(b[k], k) : existing?.[k] ?? null;
    if (k in b && m[k] !== (existing?.[k] ?? null)) metricsChanged = true;
  }
  const hasMetric = ['likes', 'comments', 'shares'].some((k) => m[k] != null);
  if (hasMetric && status !== '已發布') throw new HttpError('尚未發布的貼文不能登錄互動數字');
  let asOf = b.metrics_as_of ?? existing?.metrics_as_of ?? null;
  if (asOf) asOf = String(asOf).replace('T', ' ').slice(0, 16);
  if (hasMetric && !asOf) throw new HttpError('登錄互動數字時請填「統計截至」時間');
  const vals = [b.topic_id === undefined && !str(b.new_topic) ? existing?.topic_id ?? null : topicId, outletId, projectId, planned, published, title,
    keep('content', 5000), keep('asset', 500), keep('owner', 100), status, url, keep('purpose', 300), keep('destination', 300),
    m.likes, m.comments, m.shares, m.inquiries, m.conversions, m.pending_replies,
    hasMetric ? (keep('metrics_source', 50) || '人工登錄') : keep('metrics_source', 50), asOf,
    metricsChanged ? now() : existing?.metrics_updated_at ?? null];
  if (existing) {
    await run(db, `UPDATE posts SET topic_id=?, outlet_id=?, project_id=?, planned_date=?, published_date=?, title=?, content=?, asset=?, owner=?, status=?, url=?, purpose=?, destination=?,
      likes=?, comments=?, shares=?, inquiries=?, conversions=?, pending_replies=?, metrics_source=?, metrics_as_of=?, metrics_updated_at=?, updated_at=? WHERE id=?`, ...vals, now(), existing.id);
    await audit(db, user.email, 'post.update', projectId, { id: existing.id });
    return { id: existing.id };
  }
  const id = uid();
  await run(db, `INSERT INTO posts (id, topic_id, outlet_id, project_id, planned_date, published_date, title, content, asset, owner, status, url, purpose, destination,
    likes, comments, shares, inquiries, conversions, pending_replies, metrics_source, metrics_as_of, metrics_updated_at, is_test, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`, id, ...vals, now(), now());
  await audit(db, user.email, 'post.create', projectId, { id });
  return { id };
}

async function savePlacement(db, user, cr, b, existing) {
  const code = existing ? existing.code : str(b.code);
  if (!existing) {
    if (!code.startsWith(cr.code + '-A') || !/^\d{2}$/.test(code.slice(cr.code.length + 2)) || code.endsWith('-A00')) throw new HttpError(`投放紀錄代碼需為 ${cr.code}-A01 這種格式`);
    if (await first(db, 'SELECT id FROM placements WHERE code = ?', code)) throw new HttpError('投放紀錄代碼已存在');
  }
  const start = date(b.start_date ?? existing?.start_date, '開始日');
  const end = date(b.end_date ?? existing?.end_date, '結束日');
  if (start && end && end < start) throw new HttpError('結束日不能早於開始日');
  const vals = [str(b.audience ?? existing?.audience, 300), str(b.setting ?? existing?.setting, 300), start, end, str(b.status || existing?.status || '規劃中', 10)];
  if (existing) {
    await run(db, 'UPDATE placements SET audience=?, setting=?, start_date=?, end_date=?, status=? WHERE id=?', ...vals, existing.id);
    return { id: existing.id };
  }
  const id = uid();
  await run(db, 'INSERT INTO placements (id, project_id, creative_id, code, audience, setting, start_date, end_date, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, cr.project_id, cr.id, code, ...vals, now());
  await audit(db, user.email, 'placement.create', cr.project_id, { code });
  return { id };
}

// ---------- 路由 ----------
export async function handleApi(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;
  const user = await getUser(request, env);
  if (user.error) return fail(user.error, user.status);
  const today = env.TODAY || todayTW();
  const qp = (k) => url.searchParams.get(k);
  const range = resolvePeriod({ period: qp('period') || 'week', end: qp('end'), m: qp('m'), from: qp('from'), to: qp('to'), today });
  let body = {};
  if (method !== 'GET' && method !== 'DELETE') {
    try { body = await request.json(); } catch { return fail('資料格式錯誤'); }
  }
  const seg = path.split('/').filter(Boolean);
  try {
    if (method === 'GET' && path === '/me') return json(user);
    if (method === 'GET' && (path === '/home' || path === '/overview')) return json(await home(db, user, range, today));
    if (method === 'GET' && path === '/organic') {
      requireAdmin(user);
      const d = await organicData(db, range, today, { type: qp('type'), outlet: qp('outlet'), project: qp('project') });
      const topics = await all(db, 'SELECT * FROM topics ORDER BY created_at DESC');
      const projects = (await visibleProjects(db, user)).map((p) => ({ id: p.id, code: p.code, name: p.name }));
      return json({ ...d, todos: undefined, range, today, topics, projects, subjects: SUBJECTS });
    }
    if (path === '/posts' && method === 'POST') return json(await savePost(db, user, body), 201);
    if (seg[0] === 'posts' && seg[1]) {
      requireAdmin(user);
      const post = await first(db, 'SELECT * FROM posts WHERE id = ?', seg[1]);
      if (!post) throw new HttpError('找不到貼文', 404);
      if (method === 'PUT') return json(await savePost(db, user, body, post));
      if (method === 'GET') {
        const outlet = await first(db, 'SELECT * FROM outlets WHERE id = ?', post.outlet_id);
        const topic = post.topic_id ? await first(db, 'SELECT * FROM topics WHERE id = ?', post.topic_id) : null;
        const siblings = post.topic_id ? await all(db, `SELECT p.id, p.status, p.planned_date, p.published_date, p.likes, p.comments, p.shares, o.name AS outlet_name, o.type AS outlet_type
          FROM posts p JOIN outlets o ON o.id = p.outlet_id WHERE p.topic_id = ? AND p.id <> ? ORDER BY COALESCE(p.published_date, p.planned_date)`, post.topic_id, post.id) : [];
        const project = post.project_id ? await first(db, 'SELECT id, code, name FROM projects WHERE id = ?', post.project_id) : null;
        const outlets = await all(db, 'SELECT * FROM outlets ORDER BY type, name');
        const topics = await all(db, 'SELECT * FROM topics ORDER BY created_at DESC');
        const projects = (await visibleProjects(db, user)).map((p) => ({ id: p.id, code: p.code, name: p.name }));
        return json({ post, outlet, topic, siblings, project, outlets, topics, projects, subjects: SUBJECTS, today, definition: INTERACTION_DEF });
      }
    }
    if (path === '/outlets' && method === 'POST') {
      requireAdmin(user);
      if (!(body.type in SUBJECTS)) throw new HttpError('發布主體不正確');
      if (!str(body.name)) throw new HttpError('名稱必填');
      const id = uid();
      await run(db, 'INSERT INTO outlets (id, type, name, url, owner, active, is_test, created_at) VALUES (?,?,?,?,?,1,0,?)', id, body.type, str(body.name, 100), str(body.url, 300), str(body.owner, 100), now());
      return json({ id }, 201);
    }
    if (path === '/todos' && method === 'POST') {
      requireAdmin(user);
      if (!str(body.title)) throw new HttpError('待辦內容必填');
      await run(db, 'INSERT INTO todos (id, project_id, title, owner, due, status, done, created_by, created_at) VALUES (?,NULL,?,?,?,?,0,?,?)', uid(), str(body.title, 200), str(body.owner, 100), date(body.due, '期限'), '待處理', user.email, now());
      return json({ ok: true }, 201);
    }
    if (path === '/projects') {
      if (method === 'GET') return json((await visibleProjects(db, user)).map((p) => ({ id: p.id, code: p.code, name: p.name, is_test: p.is_test, status: p.status })));
      if (method === 'POST') return json(await createProject(db, user, body), 201);
    }
    if (seg[0] === 'projects' && seg[1]) {
      const write = method !== 'GET';
      const p = await projectFor(db, user, seg[1], write);
      const sub = seg[2];
      if (!sub) {
        if (method === 'GET') {
          const r = await computeProject(db, p, range, today);
          r.accounts = await all(db, 'SELECT * FROM accounts WHERE project_id = ? ORDER BY created_at', p.id);
          r.imports = await all(db, 'SELECT * FROM imports WHERE project_id = ? ORDER BY created_at DESC LIMIT 20', p.id);
          r.claimCodes = await all(db, 'SELECT * FROM claim_codes WHERE project_id = ? ORDER BY code', p.id);
          r.links = await all(db, 'SELECT * FROM tracking_links WHERE project_id = ? ORDER BY created_at', p.id);
          r.range = range; r.today = today;
          // 支援本專案的自然貼文（與付費廣告分開呈現、不相加）
          const rel = await all(db, `SELECT p.*, o.name AS outlet_name, o.type AS outlet_type FROM posts p JOIN outlets o ON o.id = p.outlet_id WHERE p.project_id = ?
            AND ((p.planned_date BETWEEN ? AND ?) OR (p.published_date BETWEEN ? AND ?)) ORDER BY COALESCE(p.published_date, p.planned_date)`, p.id, range.from, range.fullTo, range.from, range.fullTo);
          r.relatedPosts = { posts: rel.map((x) => ({ ...x, flags: classify(x, range, today) })), summary: summarize(rel, range, today), definition: INTERACTION_DEF, visible: user.isAdmin };
          if (!user.isAdmin) r.relatedPosts.posts = [];
          return json(r);
        }
        if (method === 'PUT') { await updateProject(db, user, p, body); return json({ ok: true }); }
      }
      if (sub === 'accounts' && method === 'POST') {
        const types = ['fb_page', 'ad_account', 'line_oa', 'landing', 'enroll', 'payment', 'other'];
        if (!types.includes(body.type)) throw new HttpError('帳號類型不正確');
        const id = uid();
        await run(db, 'INSERT INTO accounts (id, project_id, type, name, external_id, owner, payer, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
          id, p.id, body.type, str(body.name, 100), str(body.external_id, 100), str(body.owner, 100), str(body.payer, 100), str(body.note, 300), now());
        return json({ id }, 201);
      }
      if (sub === 'campaigns' && method === 'POST') return json(await saveCampaign(db, user, p, body), 201);
      if (sub === 'ad-daily' && method === 'POST') {
        let cr = await first(db, 'SELECT * FROM creatives WHERE id = ? AND project_id = ?', body.creative_id, p.id);
        let pl = null;
        if (body.placement_id) {
          pl = await first(db, 'SELECT * FROM placements WHERE id = ? AND project_id = ?', body.placement_id, p.id);
          if (!pl) throw new HttpError('投放紀錄不屬於本專案');
          cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', pl.creative_id);
        }
        if (!cr || !cr.paid) throw new HttpError('請選擇本專案的付費素材');
        const d = date(body.date, '日期', false);
        await run(db, `INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, placement_id, ad_name, spend, impressions, link_clicks, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'manual',?)
          ON CONFLICT(project_id, date, ad_name) DO UPDATE SET spend=excluded.spend, impressions=excluded.impressions, link_clicks=excluded.link_clicks`,
        uid(), p.id, d, cr.campaign_id, cr.id, pl?.id || null, (pl ? pl.code : cr.code) + '｜人工登錄', int(body.spend, '花費', { allowNull: false }), int(body.impressions, '曝光', { allowNull: false }), int(body.link_clicks, '連結點擊', { allowNull: false }), now());
        await markSource(db, p.id, 'ads', body.coveredThrough ? date(body.coveredThrough, '資料更新到') : d);
        await audit(db, user.email, 'ad_daily.manual', p.id, { date: d, creative: cr.code });
        return json({ ok: true }, 201);
      }
      if (sub === 'conversions' && method === 'POST') {
        const defs = metricDefs(p);
        const isCancel = body.type === 'cancel';
        if (isCancel ? !defs.enroll?.enabled : (!OUTCOME_TYPES.includes(body.type) || !defs[body.type]?.enabled)) throw new HttpError('本專案未定義這個成果指標');
        const d = date(body.date, '日期', false);
        let campaign_id = null; let creative_id = null;
        if (body.creative_id) {
          const cr = await first(db, 'SELECT * FROM creatives WHERE id = ? AND project_id = ?', body.creative_id, p.id);
          if (!cr) throw new HttpError('素材不屬於本專案');
          creative_id = cr.id; campaign_id = cr.campaign_id;
        } else if (body.campaign_id) {
          const c = await first(db, 'SELECT * FROM campaigns WHERE id = ? AND project_id = ?', body.campaign_id, p.id);
          if (!c) throw new HttpError('活動不屬於本專案');
          campaign_id = c.id;
        }
        const qty = int(body.qty || 1, '數量', { allowNull: false, min: 1 });
        const amount = int(body.amount || 0, '金額');
        if ((body.type === 'payment' || body.type === 'refund') && !(amount > 0)) throw new HttpError('付款與退款需要金額');
        const person = await personRef(body.phone, body.email, env.HASH_SALT || 'dev-salt');
        if (person && qty !== 1) throw new HttpError('填了電話或 Email 時數量只能是 1');
        if (isCancel) {
          if (!person) throw new HttpError('取消報名需要電話或 Email，才能對應到報名的人');
          if (!str(body.note)) throw new HttpError('請填寫取消原因');
          const existing = await all(db, "SELECT id, type, date, person_ref, created_at FROM conversions WHERE project_id = ? AND type IN ('enroll','cancel') AND person_ref = ?", p.id, person);
          const msg = checkCancels(existing, [{ type: 'cancel', date: d, person_ref: person }]).values().next().value;
          if (msg) throw new HttpError(msg);
        }
        await run(db, `INSERT INTO conversions (id, project_id, type, date, campaign_id, creative_id, claim_code, qty, amount, person_ref, external_ref, source, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,'manual',?,?)`,
          uid(), p.id, body.type, d, campaign_id, creative_id, '', qty, amount, person, str(body.note, 300), now());
        await markSource(db, p.id, SOURCE_OF_TYPE[body.type], body.coveredThrough ? date(body.coveredThrough, '資料更新到') : null);
        await audit(db, user.email, isCancel ? 'enroll.cancel' : 'conversion.manual', p.id, { type: body.type, qty, date: d });
        return json({ ok: true }, 201);
      }
      if (sub === 'import' && seg[3] === 'preview' && method === 'POST') return json(await importPreview(db, p, body, env));
      if (sub === 'import' && seg[3] === 'commit' && method === 'POST') return json(await importCommit(db, user, p, body, env));
      if (sub === 'sources' && seg[3] && method === 'PUT') {
        if (!(seg[3] in SOURCE_KINDS)) throw new HttpError('資料來源不正確');
        await run(db, `INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,?,?,?,?)
          ON CONFLICT(project_id, kind) DO UPDATE SET connected=excluded.connected, covered_through=excluded.covered_through, updated_at=excluded.updated_at, note=excluded.note`,
        p.id, seg[3], body.connected ? 1 : 0, date(body.covered_through, '資料更新到'), now(), str(body.note, 300));
        await audit(db, user.email, 'source.update', p.id, { kind: seg[3] });
        return json({ ok: true });
      }
      if (sub === 'todos' && method === 'POST') {
        if (!str(body.title)) throw new HttpError('待辦內容必填');
        await run(db, 'INSERT INTO todos (id, project_id, title, owner, due, status, done, created_by, created_at) VALUES (?,?,?,?,?,?,0,?,?)', uid(), p.id, str(body.title, 200), str(body.owner, 100), date(body.due, '期限'), '待處理', user.email, now());
        return json({ ok: true }, 201);
      }
      if (sub === 'export.csv' && method === 'GET') {
        return new Response(await exportCsv(db, p, range, today), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${p.code}-${range.from}-${range.to}.csv"` } });
      }
    }
    if (seg[0] === 'campaigns' && seg[1]) {
      const { c, p } = await campaignFor(db, user, seg[1], method !== 'GET');
      if (!seg[2] && method === 'GET') {
        const r = await computeProject(db, p, range, today);
        const camp = r.campaigns.find((x) => x.id === c.id);
        const ads = await all(db, 'SELECT date, SUM(spend) AS spend, SUM(link_clicks) AS clicks FROM ad_daily WHERE campaign_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date', c.id, range.from, range.to);
        const pk = primaryOutcome(r.project.metrics);
        const conv = pk ? await all(db, 'SELECT date, SUM(qty) AS n FROM conversions WHERE campaign_id = ? AND type = ? AND date BETWEEN ? AND ? GROUP BY date', c.id, pk, range.from, range.to) : [];
        return json({
          project: r.project, campaign: camp, sources: r.sources, range, today,
          daily: { ads, conv, primary: pk },
          links: await all(db, 'SELECT * FROM tracking_links WHERE campaign_id = ? ORDER BY created_at', c.id),
          claimCodes: await all(db, 'SELECT * FROM claim_codes WHERE campaign_id = ? ORDER BY code', c.id),
          anomalies: r.anomalies.filter((a) => a.link === `#/c/${c.id}`),
          todos: r.todos.filter((a) => a.link === `#/c/${c.id}`),
        });
      }
      if (!seg[2] && method === 'PUT') return json(await saveCampaign(db, user, p, body, c));
      if (seg[2] === 'creatives' && method === 'POST') return json(await saveCreative(db, user, c, body), 201);
      if (seg[2] === 'links' && method === 'POST') {
        let creative = null;
        if (body.creative_id) {
          creative = await first(db, 'SELECT * FROM creatives WHERE id = ? AND campaign_id = ?', body.creative_id, c.id);
          if (!creative) throw new HttpError('素材不屬於這個活動');
        }
        let full;
        try { full = buildTrackingUrl({ baseUrl: body.base_url, source: body.utm_source, medium: body.utm_medium, campaignCode: c.code, creativeCode: creative?.code, term: body.utm_term }); }
        catch (e) { throw new HttpError(e.message); }
        if (await first(db, 'SELECT id FROM tracking_links WHERE project_id = ? AND full_url = ?', p.id, full)) throw new HttpError('相同的追蹤連結已存在');
        await run(db, 'INSERT INTO tracking_links (id, project_id, campaign_id, creative_id, base_url, utm_source, utm_medium, utm_term, full_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          uid(), p.id, c.id, creative?.id || null, str(body.base_url, 500), body.utm_source, body.utm_medium, str(body.utm_term, 50).toLowerCase(), full, now());
        return json({ url: full }, 201);
      }
      if (seg[2] === 'claim-codes' && method === 'POST') {
        const code = normalizeClaimCode(body.code);
        if (!validClaimCode(code, p.claim_prefix)) throw new HttpError(`領取碼需為 ${p.claim_prefix} 加 3 位數，例如 ${p.claim_prefix}101`);
        if (await first(db, 'SELECT id FROM claim_codes WHERE project_id = ? AND code = ?', p.id, code)) throw new HttpError('領取碼已存在');
        let creativeId = null;
        if (body.creative_id) {
          const cr = await first(db, 'SELECT id FROM creatives WHERE id = ? AND campaign_id = ?', body.creative_id, c.id);
          if (!cr) throw new HttpError('素材不屬於這個活動');
          creativeId = cr.id;
        }
        await run(db, 'INSERT INTO claim_codes (id, project_id, campaign_id, creative_id, code, channel, note, created_at) VALUES (?,?,?,?,?,?,?,?)', uid(), p.id, c.id, creativeId, code, str(body.channel, 30), str(body.note, 200), now());
        return json({ code }, 201);
      }
    }
    if (seg[0] === 'creatives' && seg[1] && seg[2] === 'placements' && method === 'POST') {
      const cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', seg[1]);
      if (!cr) throw new HttpError('找不到素材', 404);
      await projectFor(db, user, cr.project_id, true);
      return json(await savePlacement(db, user, cr, body), 201);
    }
    if (seg[0] === 'placements' && seg[1] && method === 'PUT') {
      const pl = await first(db, 'SELECT * FROM placements WHERE id = ?', seg[1]);
      if (!pl) throw new HttpError('找不到投放紀錄', 404);
      const cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', pl.creative_id);
      await projectFor(db, user, pl.project_id, true);
      return json(await savePlacement(db, user, cr, body, pl));
    }
    // 素材的測試／正式：只能由人明確確認，一般編輯不會改到
    if (seg[0] === 'creatives' && seg[1] && seg[2] === 'asset-status' && method === 'POST') {
      const cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', seg[1]);
      if (!cr) throw new HttpError('找不到素材', 404);
      await campaignFor(db, user, cr.campaign_id, true);
      if (!['測試', '正式'].includes(body.status)) throw new HttpError('狀態只能是「測試」或「正式」');
      if (body.status === '正式' && body.confirm !== true) throw new HttpError('改為正式素材需要明確確認');
      const official = body.status === '正式';
      await run(db, 'UPDATE creatives SET asset_status=?, asset_confirmed_by=?, asset_confirmed_at=?, updated_at=? WHERE id=?',
        body.status, official ? user.email : '', official ? now() : null, now(), cr.id);
      await audit(db, user.email, 'creative.asset_status', cr.project_id, { code: cr.code, from: cr.asset_status, to: body.status });
      return json({ ok: true, status: body.status });
    }
    if (seg[0] === 'creatives' && seg[1] && method === 'PUT') {
      const cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', seg[1]);
      if (!cr) throw new HttpError('找不到素材', 404);
      const { c } = await campaignFor(db, user, cr.campaign_id, true);
      return json(await saveCreative(db, user, c, body, cr));
    }
    if (seg[0] === 'todos' && seg[1] && method === 'PUT') {
      const t = await first(db, 'SELECT * FROM todos WHERE id = ?', seg[1]);
      if (!t) throw new HttpError('找不到待辦', 404);
      if (t.project_id) await projectFor(db, user, t.project_id, true); else requireAdmin(user);
      const status = body.done ? '完成' : (['待處理', '處理中', '完成'].includes(body.status) ? body.status : t.status);
      await run(db, 'UPDATE todos SET done = ?, status = ? WHERE id = ?', status === '完成' ? 1 : 0, status, t.id);
      return json({ ok: true });
    }
    for (const [name, table] of [['links', 'tracking_links'], ['claim-codes', 'claim_codes'], ['accounts', 'accounts']]) {
      if (seg[0] === name && seg[1] && method === 'DELETE') {
        const row = await first(db, `SELECT * FROM ${table} WHERE id = ?`, seg[1]);
        if (!row) throw new HttpError('找不到資料', 404);
        await projectFor(db, user, row.project_id, true);
        await run(db, `DELETE FROM ${table} WHERE id = ?`, row.id);
        await audit(db, user.email, `${name}.delete`, row.project_id, { id: row.id });
        return json({ ok: true });
      }
    }
    if (method === 'GET' && path === '/templates/outcomes.csv') {
      return new Response('﻿' + OUTCOME_COLUMNS.join(',') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8' } });
    }
    if (path === '/dev/reset' && method === 'POST') {
      if (env.DEV_MODE !== '1' || !user.isAdmin) throw new HttpError('只在開發模式提供', 403);
      const { resetTestData } = await import('./seed.js');
      await resetTestData(db, today, env.HASH_SALT || 'dev-salt');
      return json({ ok: true });
    }
    return fail('找不到這個功能', 404);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    if (/UNIQUE constraint/.test(String(e.message))) return fail('資料重複，未寫入', 409);
    console.error(e);
    return fail('系統錯誤：' + e.message, 500);
  }
}
