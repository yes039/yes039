// 測試資料：全部標【測試】。付費專案代碼 TJSN、TYXZ；日常發文的位置、題材、貼文都標 is_test。
// 數字由固定亂數產生，日期相對於「今天」，不是任何真實營運資料。
import { MOCK_VIDEO } from './seed-media.js';
import { personRef } from './csv.js';
import { defaultMetrics } from './metrics.js';
import { addDays, datesInRange } from './periods.js';
import { buildTrackingUrl } from './tracking.js';

const TABLES = ['accounts', 'campaigns', 'creatives', 'placements', 'tracking_links', 'claim_codes', 'ad_daily', 'conversions', 'sources', 'imports', 'todos', 'project_members'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 測試用素材預覽圖（SVG），畫面上清楚標示「測試素材」 */
function preview(label, sub, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="${color}"/>`
    + `<rect x="16" y="16" width="130" height="30" rx="6" fill="#ffffff" opacity=".9"/><text x="81" y="37" font-size="16" text-anchor="middle" fill="#333" font-family="sans-serif">測試示意圖</text>`
    + `<text x="160" y="170" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${label}</text>`
    + `<text x="160" y="210" font-size="18" text-anchor="middle" fill="#fff" font-family="sans-serif">${sub}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export async function clearTestData(db) {
  const ids = (await db.prepare('SELECT id FROM projects WHERE is_test = 1').all()).results.map((r) => r.id);
  for (const id of ids) {
    for (const t of TABLES) await db.prepare(`DELETE FROM ${t} WHERE project_id = ?`).bind(id).run();
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
  }
  for (const t of ['posts', 'topics', 'outlets']) await db.prepare(`DELETE FROM ${t} WHERE is_test = 1`).run();
  await db.prepare("DELETE FROM todos WHERE project_id IS NULL AND created_by = 'seed'").run();
}

export async function resetTestData(db, today, salt) {
  await clearTestData(db);
  const t = new Date().toISOString();
  const yesterday = addDays(today, -1);
  const R = rng(20261015);
  const between = (a, b) => a + R() * (b - a);
  const stmts = [];
  const add = (sql, ...args) => stmts.push(db.prepare(sql).bind(...args));
  const D = (n) => addDays(today, n);

  // ================= B. 付費廣告專案 =================
  const jsn = 'test-proj-jsn';
  const yxz = 'test-proj-yxz';
  const jMetrics = defaultMetrics().map((m) => ({
    ...m,
    def: { inquiry: '【測試定義】可確認來自本專案廣告或連結的私訊、留言詢問', valid_lead: '【測試定義】已加 LINE 未封鎖、已領取電子書，並留下電話', payment: '【測試定義】實收金額，不扣平台手續費' }[m.key] ?? m.def,
  }));
  add(`INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope,
    audience, course_info, course_dates, price_info, target_enroll, is_test, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
  jsn, 'TJSN', 'T', '【測試】Jason 老師合作招生', '合作', 'Jason 老師（測試）', '待填', '【測試】電子書引流到課程報名', 50000, 'TWD', '進行中',
  JSON.stringify(jMetrics), '{}', '【測試】名單只用於本專案招生', '待填', '待填', '待填', '待填', 60, t, t);
  const yMetrics = defaultMetrics().map((m) => ({ ...m, enabled: false, def: '活化目的待確認，尚未定義' }));
  add(`INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope,
    audience, course_info, course_dates, price_info, target_enroll, is_test, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
  yxz, 'TYXZ', 'U', '【測試】玉欣珍會員活化', '自有品牌', '', '待填', '活化目的待確認', null, 'TWD', '規劃中',
  JSON.stringify(yMetrics), '{}', '會員資料只用於本專案', '玉欣珍 LINE 會員（範圍待定）', '不適用', '', '', null, t, t);
  add('INSERT INTO project_members (project_id, email, role) VALUES (?,?,?)', jsn, 'viewer@test.local', 'viewer');
  for (const [id, pid, type, name, owner, payer] of [
    ['test-acc-1', jsn, 'fb_page', '【測試】合作粉專', '待填', ''],
    ['test-acc-2', jsn, 'ad_account', 'act_TEST0001', '待填', '待填'],
    ['test-acc-3', jsn, 'line_oa', '【測試】招生 LINE', '待填', ''],
    ['test-acc-4', yxz, 'line_oa', '【測試】玉欣珍 LINE', '玉欣珍', ''],
  ]) add('INSERT INTO accounts (id, project_id, type, name, external_id, owner, payer, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, pid, type, name, '', owner, payer, '測試資料', t);

  // 投放波次
  const c1 = { id: 'test-c1', code: 'TJSN-2609-01', name: '【測試】電子書第一波', start: D(-25), end: D(-10), budget: 22000, target: 250, status: '已結束' };
  const c2 = { id: 'test-c2', code: 'TJSN-2610-01', name: '【測試】電子書第二波', start: D(-9), end: D(16), budget: 30000, target: 250, status: '進行中' };
  const c3 = { id: 'test-c3', code: 'TYXZ-2610-01', name: '【測試】會員活化測試（目的待定）', start: null, end: null, budget: null, target: null, status: '規劃中' };
  for (const [c, pid] of [[c1, jsn], [c2, jsn], [c3, yxz]]) {
    add(`INSERT INTO campaigns (id, project_id, code, name, offer, audience, destination, flow, start_date, end_date, budget, target_cpl, owner, status, note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, c.id, pid, c.code, c.name, pid === jsn ? '免費電子書《測試書名》→ 課程' : '待定',
    pid === jsn ? '【測試】30–50 歲小店老闆' : '玉欣珍 LINE 會員（範圍待定）', pid === jsn ? '落地頁表單 → 下載電子書 → 邀請加 LINE' : '待定',
    pid === jsn ? '甲' : '不適用', c.start, c.end, c.budget, c.target, pid === jsn ? '小編A（測試）' : '待填', c.status, '測試資料', t, t);
  }

  // 專用廣告素材（不綁自然貼文）
  const cr = [
    { id: 'test-cr1', c: c1, code: 'TJSN-2609-01-VD01-v1', name: '三分鐘看懂', paid: 1, channel: 'fb_ad', prod: '已核可', base: [700, 950], ctr: 0.018, conv: 0.30,
      headline: '三分鐘看懂 AI 記帳', copy: '【測試文案】每天收攤後還要記帳？這本電子書教你用 AI 三步驟搞定。', cta: '下載', appeal: '省時間', color: '#2a78d6' },
    { id: 'test-cr2', c: c1, code: 'TJSN-2609-01-IM01-v1', name: '書封＋重點', paid: 1, channel: 'fb_ad', prod: '已核可', base: [450, 650], ctr: 0.011, conv: 0.18,
      headline: '免費電子書：會算帳的 AI 員工', copy: '【測試文案】小店老闆必讀，免費領取。', cta: '了解詳情', appeal: '免費資源', color: '#7a5bd6' },
    { id: 'test-cr4', c: c2, code: 'TJSN-2610-01-VD01-v1', name: '學員心得', paid: 1, channel: 'fb_ad', prod: '已核可', base: [380, 520], ctr: 0.016, conv: 0.22,
      headline: '學員：我終於不用熬夜對帳', copy: '【測試文案】看看第一期學員怎麼用 AI 員工省下每天一小時。', cta: '立即報名', appeal: '真實見證', color: '#1baf7a', placements: true },
    { id: 'test-cr5', c: c2, code: 'TJSN-2610-01-CA01-v1', name: '五個 AI 小技巧', paid: 1, channel: 'fb_ad', prod: '已核可', base: [500, 700], ctr: 0.013, conv: 0.12,
      headline: '五個馬上能用的 AI 小技巧', copy: '【測試文案】滑完這組輪播，今天就能開始用。', cta: '下載', appeal: '立即可用', color: '#eb6834' },
    { id: 'test-cr8', c: c2, code: 'TJSN-2610-01-IM02-v1', name: '限時優惠', paid: 1, channel: 'fb_ad', prod: '待審核', status: '規劃中',
      headline: '早鳥優惠倒數', copy: '【測試文案】早鳥名額有限。', cta: '立即報名', appeal: '限時', color: '#888888' },
    { id: 'test-cr6', c: c2, code: 'TJSN-2610-01-LM01-v1', name: '合作方 LINE 訊息', paid: 0, channel: 'line', prod: '已核可', headline: '', copy: '【測試】合作方 LINE 推播', cta: '', appeal: '既有好友', color: '#06c755' },
    { id: 'test-cr7', c: c3, code: 'TYXZ-2610-01-LM01-v1', name: '活化訊息（內容待定）', paid: 0, channel: 'line', prod: '製作中', status: '規劃中', headline: '', copy: '', cta: '', appeal: '', color: '#999999' },
  ];
  for (const x of cr) {
    const pid = x.c === c3 ? yxz : jsn;
    const status = x.status || (x.c.status === '進行中' ? '進行中' : x.c.status === '已結束' ? '已結束' : '規劃中');
    x.status = status;
    // 測試示意素材：素材 1 有封面＋示意影片；素材 3 只有封面；未核可的素材還沒有檔案
    const fmt = x.code.split('-')[3];
    const hasFile = pid === jsn && x.prod === '已核可';
    const cover = hasFile ? preview(fmt, x.code.split('-')[4], x.color) : '';
    const video = x.id === 'test-cr1' ? MOCK_VIDEO : '';
    add(`INSERT INTO creatives (id, project_id, campaign_id, code, name, channel, paid, format, status, platform_ref, prod_status, owner, headline, copy_text, cta, appeal, destination,
      preview_url, video_url, landing_url, asset_mock, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    x.id, pid, x.c.id, x.code, x.name, x.channel, x.paid, fmt.slice(0, 2), status, '',
    x.prod, pid === jsn ? '小編A（測試）' : '待填', x.headline, x.copy, x.cta, x.appeal, pid === jsn ? '落地頁表單（測試網址）' : '待定',
    cover, video, pid === jsn && x.paid ? 'https://example.com/test-ebook' : '', cover ? 1 : 0, t, t);
  }
  // 素材 3 用在兩組受眾：各一筆投放紀錄
  const pls = [
    { id: 'test-pl1', cr: cr[2], code: 'TJSN-2610-01-VD01-v1-A01', audience: '【測試】30–50 歲小店老闆', setting: '動態版位・最低成本', share: 0.6 },
    { id: 'test-pl2', cr: cr[2], code: 'TJSN-2610-01-VD01-v1-A02', audience: '【測試】類似受眾（既有名單 1%）', setting: '動態版位・最低成本', share: 0.4 },
  ];
  for (const p of pls) {
    add('INSERT INTO placements (id, project_id, creative_id, code, audience, setting, start_date, end_date, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      p.id, jsn, p.cr.id, p.code, p.audience, p.setting, c2.start, c2.end, '進行中', t);
  }
  const base = 'https://example.com/test-ebook';
  cr.filter((x) => x.paid && x.c !== c3 && x.status !== '規劃中').forEach((x, i) => {
    const url = buildTrackingUrl({ baseUrl: base, source: 'facebook', medium: 'paid_social', campaignCode: x.c.code, creativeCode: x.code });
    add('INSERT INTO tracking_links (id, project_id, campaign_id, creative_id, base_url, utm_source, utm_medium, utm_term, full_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      'test-link-' + i, jsn, x.c.id, x.id, base, 'facebook', 'paid_social', '', url, t);
  });
  for (const [code, x, ch] of [['T101', cr[0], 'FB 付費廣告'], ['T201', cr[5], '合作方 LINE']]) {
    add('INSERT INTO claim_codes (id, project_id, campaign_id, creative_id, code, channel, note, created_at) VALUES (?,?,?,?,?,?,?,?)', 'test-code-' + code, jsn, x.c.id, x.id, code, ch, '測試資料', t);
  }

  // 廣告每日數字（第二波刻意缺「前天」的資料，示範「資料不完整」）
  const gap = D(-3);
  const conv = [];
  let phone = 0;
  const nextPerson = async () => personRef('0900' + String(++phone).padStart(6, '0'), '', salt);
  for (const x of cr.filter((c) => c.paid && c.status !== '規劃中')) {
    const to = x.c.end < yesterday ? x.c.end : yesterday;
    for (const d of datesInRange(x.c.start, to)) {
      const spend = Math.round(between(...x.base));
      const impressions = Math.round(spend * between(9, 13));
      const clicks = Math.round(impressions * x.ctr * between(0.8, 1.2));
      if (!(x.c === c2 && d === gap)) {
        const rows = x.placements ? pls.map((p) => ({ pl: p, f: p.share })) : [{ pl: null, f: 1 }];
        for (const { pl, f } of rows) {
          add(`INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, placement_id, ad_name, spend, impressions, link_clicks, source, batch_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'csv','test-batch',?)`,
            `test-ad-${(pl || x).code}-${d}`, jsn, d, x.c.id, x.id, pl?.id ?? null, `${(pl || x).code}｜測試廣告`, Math.round(spend * f), Math.round(impressions * f), Math.round(clicks * f), t);
        }
      }
      const quiet = x.c === c2 && d >= D(-3); // 第二波最近幾天沒有有效名單（示範警示）
      if (R() < 0.35) conv.push({ type: 'inquiry', date: d, x, person: await nextPerson() });
      const claims = Math.round(clicks * x.conv * between(0.7, 1.3));
      for (let k = 0; k < claims; k++) {
        const person = await nextPerson();
        conv.push({ type: 'claim', date: d, x, person });
        if (R() < 0.62) {
          conv.push({ type: 'lead', date: d, x, person });
          if (!quiet && R() < 0.5) {
            conv.push({ type: 'valid_lead', date: d, x, person });
            if (R() < 0.09) {
              const ed = addDays(d, Math.floor(between(1, 5)));
              if (ed <= addDays(yesterday, -1)) {
                conv.push({ type: 'enroll', date: ed, x, person });
                if (R() < 0.8) conv.push({ type: 'payment', date: ed, x, person, amount: 3980 });
              }
            }
          }
        }
      }
    }
  }
  for (let k = 0; k < 9; k++) {
    const d = addDays(c2.start, Math.floor(R() * 6));
    const person = await nextPerson();
    conv.push({ type: 'claim', date: d, x: cr[5], person });
    conv.push({ type: 'lead', date: d, x: cr[5], person });
    if (R() < 0.5) conv.push({ type: 'valid_lead', date: d, x: cr[5], person });
  }
  // 來源不明：無法確認來自哪份素材或波次
  for (const d of [D(-13), D(-6)]) {
    const person = await nextPerson();
    conv.push({ type: 'inquiry', date: d, x: null, person });
    conv.push({ type: 'enroll', date: d, x: null, person });
    conv.push({ type: 'payment', date: d, x: null, person, amount: 3980 });
  }
  const firstPay = conv.find((c) => c.type === 'payment' && c.x);
  if (firstPay) conv.push({ type: 'refund', date: addDays(firstPay.date, 3), x: firstPay.x, person: firstPay.person, amount: 3980 });
  let n = 0;
  for (const c of conv) {
    add(`INSERT INTO conversions (id, project_id, type, date, campaign_id, creative_id, claim_code, qty, amount, person_ref, external_ref, source, batch_id, note, created_at)
      VALUES (?,?,?,?,?,?,?,1,?,?,?,'csv','test-batch','測試資料',?)`, `test-cv-${++n}`, jsn, c.type, c.date, c.x?.c.id ?? null, c.x?.id ?? null, '', c.amount || 0, c.person,
    ['enroll', 'payment', 'refund'].includes(c.type) ? `TEST-${c.type}-${n}` : null, t);
  }
  // 資料來源：報名只更新到前天（示範「更新至…」與完整度分開）
  for (const [kind, covered] of [['ads', yesterday], ['inquiry', yesterday], ['claim', yesterday], ['lead', yesterday], ['enroll', D(-2)], ['payment', yesterday]]) {
    add('INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,1,?,?,?)', jsn, kind, covered, t, '測試資料（CSV 匯入）');
  }
  add('INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,0,NULL,?,?)', yxz, 'ads', t, '本專案目前沒有付費廣告');
  add(`INSERT INTO imports (id, project_id, kind, filename, rows_total, rows_inserted, rows_updated, rows_skipped, messages_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    'test-batch', jsn, 'ads', '測試資料（程式產生）', 0, 0, 0, 0, '[]', 'seed', t);
  add('INSERT INTO todos (id, project_id, title, owner, due, status, done, created_by, created_at) VALUES (?,?,?,?,?,?,0,?,?)', 'test-todo-1', jsn, '【測試】向合作方確認報名名單提供頻率', 'Shen', D(3), '待處理', 'seed', t);
  add('INSERT INTO todos (id, project_id, title, owner, due, status, done, created_by, created_at) VALUES (?,?,?,?,?,?,0,?,?)', 'test-todo-2', yxz, '【測試】確認活化目的與成果指標', 'Shen', null, '待處理', 'seed', t);

  // ================= A. 日常 FB 發文 =================
  const outlets = [
    ['test-o1', 'personal', '【測試】Shen 個人帳號', 'Shen'],
    ['test-o2', 'page', '【測試】AI 小店幫手粉專', '小編A（測試）'],
    ['test-o3', 'own_group', '【測試】AI 學習社團（自有）', '小編A（測試）'],
    ['test-o4', 'other_group', '【測試】在地美食交流社團', '小編B（測試）'],
    ['test-o5', 'other_group', '【測試】小老闆創業社團', '小編B（測試）'],
  ];
  for (const [id, type, name, owner] of outlets) {
    add('INSERT INTO outlets (id, type, name, url, owner, active, is_test, created_at) VALUES (?,?,?,?,?,1,1,?)', id, type, name, 'https://example.com/' + id, owner, t);
  }
  const topics = [['test-t1', 'AI 記帳三步驟'], ['test-t2', '電子書搶先看'], ['test-t3', '店家日常：今日特餐'], ['test-t4', '學員心得分享'], ['test-t5', '每週 AI 小技巧'], ['test-t6', '課程問答直播預告']];
  for (const [id, title] of topics) add('INSERT INTO topics (id, title, note, is_test, created_at) VALUES (?,?,?,1,?)', id, '【測試】' + title, '測試題材', t);
  const asOf = (d) => `${d} 21:00`;
  // [預定偏移, 發布偏移, 狀態, 位置, 題材, 支援專案, 讚, 留言, 分享, 詢問, 待回覆, 統計截至偏移]
  const P = [
    [-16, -16, '已發布', 'test-o2', 'test-t1', null, 86, 12, 9, 1, 0, -14],
    [-16, -15, '已發布', 'test-o3', 'test-t1', null, 41, 18, 2, 2, 0, -14],
    [-14, -14, '已發布', 'test-o4', 'test-t1', null, 23, 6, 1, 0, 0, -1],
    [-12, -12, '已發布', 'test-o1', 'test-t3', null, 64, 9, 0, 0, 0, -10],
    [-10, -10, '已發布', 'test-o2', 'test-t2', jsn, 120, 25, 14, 4, 0, -1],
    [-10, -9, '已發布', 'test-o3', 'test-t2', jsn, 58, 31, 3, 6, 0, -1],
    [-9, -9, '已發布', 'test-o5', 'test-t2', jsn, 35, 11, 2, 2, 0, -1],
    [-7, -7, '已發布', 'test-o2', 'test-t5', null, 77, 8, 6, 0, 0, -1],
    [-6, -6, '已發布', 'test-o1', 'test-t5', null, 52, 7, 1, 0, 0, -1],
    [-5, null, '取消', 'test-o4', 'test-t3', null],
    [-4, -4, '已發布', 'test-o2', 'test-t4', jsn, 95, 22, 11, 5, 2, -1],
    [-4, -3, '已發布', 'test-o3', 'test-t4', jsn, 44, 27, 1, 3, 1, -1],
    [-3, -3, '已發布', 'test-o1', 'test-t3', null, 38, 4, 0, 0, 0, -1],
    [-3, -2, '已發布', 'test-o5', 'test-t4', jsn],             // 已發布、尚未登錄互動
    [-2, -2, '已發布', 'test-o2', 'test-t5', null],             // 已發布、尚未登錄互動
    [-1, null, '待發布', 'test-o4', 'test-t5', null],           // 逾期
    [0, null, '待發布', 'test-o3', 'test-t5', null],
    [1, -1, '已發布', 'test-o1', 'test-t6', jsn, 29, 6, 2, 1, 0, -1], // 提前發布
    [1, null, '待審核', 'test-o2', 'test-t6', jsn],
    [2, null, '待製作', 'test-o3', 'test-t6', jsn],
    [3, null, '待製作', 'test-o2', 'test-t3', null],
    [5, null, '待製作', 'test-o5', 'test-t5', null],
    [9, null, '待製作', 'test-o2', 'test-t2', jsn],
    [null, -2, '已發布', 'test-o4', 'test-t3', null, 17, 3, 0, 0, 0, -1], // 臨時加發（沒有預定日期）
  ];
  const owners = { 'test-o1': 'Shen', 'test-o2': '小編A（測試）', 'test-o3': '小編A（測試）', 'test-o4': '小編B（測試）', 'test-o5': '小編B（測試）' };
  P.forEach((r, i) => {
    const [po, pubo, status, outlet, topic, project, likes, comments, shares, inq, pend, asof] = r;
    const title = '【測試】' + topics.find((x) => x[0] === topic)[1];
    const hasM = likes != null;
    add(`INSERT INTO posts (id, topic_id, outlet_id, project_id, planned_date, published_date, title, content, asset, owner, status, url, purpose, destination,
      likes, comments, shares, inquiries, conversions, pending_replies, metrics_source, metrics_as_of, metrics_updated_at, is_test, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
    `test-post-${i + 1}`, topic, outlet, project, po == null ? null : D(po), pubo == null ? null : D(pubo), title, '【測試內容】' + title + '，內容摘要。', '測試圖片 1 張', owners[outlet], status,
    status === '已發布' ? `https://example.com/test-post-${i + 1}` : '', project ? '支援招生：導流到電子書' : '經營互動', project ? '電子書落地頁（測試網址）' : '粉專／社團互動',
    hasM ? likes : null, hasM ? comments : null, hasM ? shares : null, hasM ? inq : null, hasM ? 0 : null, pend ?? null,
    hasM ? '人工登錄' : '', hasM ? asOf(D(asof)) : null, hasM ? t : null, t, t);
  });
  add("INSERT INTO todos (id, project_id, title, owner, due, status, done, created_by, created_at) VALUES (?,NULL,?,?,?,?,0,'seed',?)", 'test-todo-3', '【測試】整理下週發文主題', '小編A（測試）', D(2), '處理中', t);

  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200));
  return { conversions: conv.length, posts: P.length };
}
