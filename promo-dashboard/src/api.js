// 宣傳戰情室 API：所有查詢先確認使用者可看的專案，再依專案過濾
import { getUser } from './auth.js';
import { resolvePeriod, todayTW, addDays } from './periods.js';
import {
  computeScope, judge, anomaliesFor, metricDefs, defaultMetrics, DEFAULT_SETTINGS, OUTCOME_TYPES,
  SOURCE_OF_TYPE, SOURCE_KINDS, ratio, primaryOutcome,
} from './metrics.js';
import {
  validProjectCode, validClaimPrefix, validCampaignCode, validCreativeCode, validClaimCode,
  normalizeClaimCode, buildTrackingUrl, CHANNELS, FORMATS, toHalfWidth,
} from './tracking.js';
import { mapMetaRows, mapOutcomeRows, parseDate, personRef, OUTCOME_COLUMNS } from './csv.js';

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

/** 計算單一專案在某期間的全部指標（活動、素材、渠道、來源不明、異常、待辦） */
export async function computeProject(db, project, range, today) {
  const defs = metricDefs(project);
  const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(project.settings_json || '{}') };
  const sources = await loadSources(db, project.id);
  const campaigns = await all(db, 'SELECT * FROM campaigns WHERE project_id = ? ORDER BY start_date DESC, code', project.id);
  const creatives = await all(db, 'SELECT * FROM creatives WHERE project_id = ? ORDER BY code', project.id);
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

  const paidByCampaign = new Set(creatives.filter((c) => c.paid).map((c) => c.campaign_id));
  const adDatesByCampaign = new Map();
  for (const r of ads) {
    if (!r.campaign_id) continue;
    if (!adDatesByCampaign.has(r.campaign_id)) adDatesByCampaign.set(r.campaign_id, new Set());
    adDatesByCampaign.get(r.campaign_id).add(r.date);
  }
  const ctxBase = { project, defs, sources, range, today };
  const scope = (camps, a, c, extraPaid) => computeScope({ ...ctxBase, campaigns: camps }, {
    ads: a, conv: c, paidCampaignIds: paidByCampaign, hasPaid: extraPaid ?? camps.some((x) => paidByCampaign.has(x.id)), adDatesByCampaign,
  });

  const projectMetrics = scope(campaigns, ads, conv);
  const primary = primaryOutcome(defs);
  const campaignMetrics = {};
  const outCampaigns = [];
  for (const c of campaigns) {
    const m = scope([c], ads.filter((r) => r.campaign_id === c.id), conv.filter((r) => r.campaign_id === c.id));
    const recentAds = adsAll.filter((r) => r.campaign_id === c.id && r.date >= recentFrom && r.date <= yesterday);
    const src = primary ? sources[SOURCE_OF_TYPE[primary]] : null;
    if (c.status === '進行中' && primary && src?.connected && src.covered_through >= yesterday && paidByCampaign.has(c.id)) {
      m.recent = {
        spend: recentAds.reduce((a, r) => a + r.spend, 0),
        outcome: convAll.filter((r) => r.campaign_id === c.id && r.type === primary && r.date >= recentFrom && r.date <= yesterday).length,
      };
    }
    campaignMetrics[c.id] = m;
    const crs = creatives.filter((x) => x.campaign_id === c.id).map((cr) => {
      const cm = computeScope({ ...ctxBase, campaigns: [c] }, {
        ads: ads.filter((r) => r.creative_id === cr.id), conv: conv.filter((r) => r.creative_id === cr.id),
        paidCampaignIds: new Set(), hasPaid: !!cr.paid, adDatesByCampaign,
      });
      // 素材層不判斷缺日（缺日在活動層判斷）
      return { ...cr, metrics: cm, judgement: judge(cm, settings, c.target_cpl, !!cr.paid), links: links.filter((l) => l.creative_id === cr.id).length };
    });
    outCampaigns.push({ ...c, paid: paidByCampaign.has(c.id), metrics: m, judgement: judge(m, settings, c.target_cpl, paidByCampaign.has(c.id)), creatives: crs });
  }

  // 依渠道比較（同一專案內，合計分子 ÷ 合計分母）
  const byChannel = Object.keys(CHANNELS).map((ch) => {
    const ids = new Set(creatives.filter((c) => c.channel === ch).map((c) => c.id));
    if (!ids.size) return null;
    const isPaid = creatives.some((c) => c.channel === ch && c.paid);
    const m = computeScope({ ...ctxBase, campaigns: [] }, {
      ads: ads.filter((r) => ids.has(r.creative_id)), conv: conv.filter((r) => ids.has(r.creative_id)),
      paidCampaignIds: new Set(), hasPaid: isPaid, adDatesByCampaign,
    });
    return { channel: ch, label: CHANNELS[ch], paid: isPaid, creatives: ids.size, metrics: m };
  }).filter(Boolean);

  // 來源不明：沒有活動的成果
  const unknown = {};
  for (const t of OUTCOME_TYPES) {
    const rows = conv.filter((r) => r.type === t && !r.campaign_id);
    unknown[t] = rows.reduce((a, r) => a + r.qty, 0);
    if (t === 'payment' || t === 'refund') unknown[t + '_amount'] = rows.reduce((a, r) => a + r.amount, 0);
  }
  // 有成果但只對到活動、沒對到素材
  const campaignOnly = conv.filter((r) => r.campaign_id && !r.creative_id).length;
  const adsUnmatched = ads.filter((r) => !r.campaign_id).length;
  const { anomalies, autoTodos } = anomaliesFor({
    project, defs, settings, campaigns, creatives, campaignMetrics, projectMetrics, adsUnmatched,
    unknownConv: unknown, links, sources, today, range,
  });
  const manualTodos = await all(db, 'SELECT * FROM todos WHERE project_id = ? AND done = 0 ORDER BY due IS NULL, due', project.id);
  const spentAll = await first(db, 'SELECT COALESCE(SUM(spend),0) AS s FROM ad_daily WHERE project_id = ?', project.id);

  return {
    project: { ...project, metrics: defs, settings },
    sources, campaigns: outCampaigns, byChannel, metrics: projectMetrics, unknown, campaignOnly, adsUnmatched,
    anomalies, todos: [...autoTodos, ...manualTodos.map((t) => ({ ...t, level: 'manual', manual: true, project: project.code }))],
    budget: { total: project.budget, spentAll: spentAll.s },
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

async function overview(db, user, range, today) {
  const projects = await visibleProjects(db, user);
  const results = [];
  for (const p of projects) results.push(await computeProject(db, p, range, today));
  const byCurrency = {};
  for (const r of results) (byCurrency[r.project.currency] ||= []).push(r);
  const totals = Object.entries(byCurrency).map(([currency, rs]) => {
    const t = { currency, projects: rs.length };
    for (const k of ['spend', 'impressions', 'link_clicks']) t[k] = sumAcross(rs.map((r) => r.metrics[k]));
    t.ctr = ratio(t.link_clicks, t.impressions);
    t.cpc = ratio(t.spend, t.link_clicks);
    return t;
  });
  return {
    range, today, user,
    totals,
    activeCampaigns: results.reduce((a, r) => a + r.campaigns.filter((c) => c.status === '進行中').length, 0),
    projects: results.map((r) => ({
      project: r.project, metrics: r.metrics, unknown: r.unknown, budget: r.budget, sources: r.sources,
      active: r.campaigns.filter((c) => c.status === '進行中').map((c) => ({ id: c.id, code: c.code, name: c.name, offer: c.offer, audience: c.audience, destination: c.destination, judgement: c.judgement, paid: c.paid })),
      anomalies: r.anomalies.length, todos: r.todos.length,
    })),
    anomalies: results.flatMap((r) => r.anomalies),
    todos: results.flatMap((r) => r.todos),
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
  await run(db, `INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope, is_test, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, code, prefix, str(b.name, 100), str(b.kind || '合作', 20), str(b.partner, 100), str(b.owner, 100), str(b.goal, 1000),
  int(b.budget, '專案預算'), 'TWD', str(b.status || '規劃中', 10), JSON.stringify(sanitizeMetrics(b.metrics) || defaultMetrics()), JSON.stringify(sanitizeSettings(b.settings)),
  str(b.data_scope, 1000), b.is_test ? 1 : 0, t, t);
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
  await run(db, `UPDATE projects SET name=?, kind=?, partner=?, owner=?, goal=?, budget=?, status=?, metrics_json=?, settings_json=?, data_scope=?, updated_at=? WHERE id=?`,
    str(b.name ?? p.name, 100) || p.name, str(b.kind ?? p.kind, 20), str(b.partner ?? p.partner, 100), str(b.owner ?? p.owner, 100), str(b.goal ?? p.goal, 1000),
    'budget' in b ? int(b.budget, '專案預算') : p.budget, str(b.status ?? p.status, 10), JSON.stringify(metrics),
    JSON.stringify(b.settings ? sanitizeSettings(b.settings) : JSON.parse(p.settings_json || '{}')), str(b.data_scope ?? p.data_scope, 1000), now(), p.id);
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
  const vals = [str(b.name ?? existing?.name, 200), channel, paid, format in FORMATS ? format : '', str(b.status || existing?.status || '規劃中', 10), str(b.platform_ref ?? existing?.platform_ref, 200)];
  if (existing) {
    await run(db, 'UPDATE creatives SET name=?, channel=?, paid=?, format=?, status=?, platform_ref=?, updated_at=? WHERE id=?', ...vals, now(), existing.id);
    await audit(db, user.email, 'creative.update', c.project_id, { code });
    return { id: existing.id };
  }
  const id = uid();
  await run(db, 'INSERT INTO creatives (id, project_id, campaign_id, code, name, channel, paid, format, status, platform_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    id, c.project_id, c.id, code, ...vals, now(), now());
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
  return {
    defs: metricDefs(p),
    campaignsByCode: new Map(campaigns.map((c) => [c.code, c])),
    creativesByCode: new Map(creatives.map((c) => [c.code, c])),
    claimCodes: new Map(codes.map((c) => [normalizeClaimCode(c.code), c])),
  };
}

async function importPreview(db, p, b, env) {
  const kind = b.kind;
  const text = String(b.text || '');
  if (text.length > 2_000_000) throw new HttpError('檔案太大（上限約 2MB）');
  const lk = await lookups(db, p);
  if (kind === 'ads') {
    const { rows, errors } = mapMetaRows(text, lk.creativesByCode);
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
      stmts.push(db.prepare(`INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, ad_name, spend, impressions, link_clicks, source, batch_id, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,'csv',?,?) ON CONFLICT(project_id, date, ad_name) DO UPDATE SET spend=excluded.spend, impressions=excluded.impressions,
        link_clicks=excluded.link_clicks, campaign_id=excluded.campaign_id, creative_id=excluded.creative_id, batch_id=excluded.batch_id`)
        .bind(uid(), p.id, r.date, r.campaign_id, r.creative_id, r.adName, r.spend, r.impressions, r.link_clicks, batch, now()));
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

// ---------- 路由 ----------
export async function handleApi(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;
  const user = await getUser(request, env);
  if (user.error) return fail(user.error, user.status);
  const today = env.TODAY || todayTW();
  const range = resolvePeriod({ period: url.searchParams.get('period') || 'r30', end: url.searchParams.get('end'), m: url.searchParams.get('m'), today });
  let body = {};
  if (method !== 'GET' && method !== 'DELETE') {
    try { body = await request.json(); } catch { return fail('資料格式錯誤'); }
  }
  const seg = path.split('/').filter(Boolean);
  try {
    if (method === 'GET' && path === '/me') return json(user);
    if (method === 'GET' && path === '/overview') return json(await overview(db, user, range, today));
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
        const cr = await first(db, 'SELECT * FROM creatives WHERE id = ? AND project_id = ?', body.creative_id, p.id);
        if (!cr || !cr.paid) throw new HttpError('請選擇本專案的付費素材');
        const d = date(body.date, '日期', false);
        await run(db, `INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, ad_name, spend, impressions, link_clicks, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,'manual',?)
          ON CONFLICT(project_id, date, ad_name) DO UPDATE SET spend=excluded.spend, impressions=excluded.impressions, link_clicks=excluded.link_clicks`,
        uid(), p.id, d, cr.campaign_id, cr.id, cr.code + '｜人工登錄', int(body.spend, '花費', { allowNull: false }), int(body.impressions, '曝光', { allowNull: false }), int(body.link_clicks, '連結點擊', { allowNull: false }), now());
        await markSource(db, p.id, 'ads', body.coveredThrough ? date(body.coveredThrough, '資料更新到') : d);
        await audit(db, user.email, 'ad_daily.manual', p.id, { date: d, creative: cr.code });
        return json({ ok: true }, 201);
      }
      if (sub === 'conversions' && method === 'POST') {
        const defs = metricDefs(p);
        if (!OUTCOME_TYPES.includes(body.type) || !defs[body.type]?.enabled) throw new HttpError('本專案未定義這個成果指標');
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
        await run(db, `INSERT INTO conversions (id, project_id, type, date, campaign_id, creative_id, claim_code, qty, amount, person_ref, external_ref, source, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,'manual',?,?)`,
          uid(), p.id, body.type, d, campaign_id, creative_id, '', qty, amount, person, str(body.note, 300), now());
        await markSource(db, p.id, SOURCE_OF_TYPE[body.type], body.coveredThrough ? date(body.coveredThrough, '資料更新到') : null);
        await audit(db, user.email, 'conversion.manual', p.id, { type: body.type, qty });
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
        await run(db, 'INSERT INTO todos (id, project_id, title, due, done, created_by, created_at) VALUES (?,?,?,?,0,?,?)', uid(), p.id, str(body.title, 200), date(body.due, '期限'), user.email, now());
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
    if (seg[0] === 'creatives' && seg[1] && method === 'PUT') {
      const cr = await first(db, 'SELECT * FROM creatives WHERE id = ?', seg[1]);
      if (!cr) throw new HttpError('找不到素材', 404);
      const { c } = await campaignFor(db, user, cr.campaign_id, true);
      return json(await saveCreative(db, user, c, body, cr));
    }
    if (seg[0] === 'todos' && seg[1] && method === 'PUT') {
      const t = await first(db, 'SELECT * FROM todos WHERE id = ?', seg[1]);
      if (!t) throw new HttpError('找不到待辦', 404);
      await projectFor(db, user, t.project_id, true);
      await run(db, 'UPDATE todos SET done = ? WHERE id = ?', body.done ? 1 : 0, t.id);
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
