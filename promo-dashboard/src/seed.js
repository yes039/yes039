// 測試資料：專案代碼 TJSN、TYXZ，名稱都標【測試】。數字由固定亂數產生，不是任何真實營運資料。
import { personRef } from './csv.js';
import { defaultMetrics } from './metrics.js';
import { addDays, datesInRange } from './periods.js';
import { buildTrackingUrl } from './tracking.js';

const TABLES = ['accounts', 'campaigns', 'creatives', 'tracking_links', 'claim_codes', 'ad_daily', 'conversions', 'sources', 'imports', 'todos', 'project_members'];

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

export async function clearTestData(db) {
  const ids = (await db.prepare('SELECT id FROM projects WHERE is_test = 1').all()).results.map((r) => r.id);
  for (const id of ids) {
    for (const t of TABLES) await db.prepare(`DELETE FROM ${t} WHERE project_id = ?`).bind(id).run();
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
  }
}

export async function resetTestData(db, today, salt) {
  await clearTestData(db);
  const t = new Date().toISOString();
  const yesterday = addDays(today, -1);
  const R = rng(20261015);
  const between = (a, b) => a + R() * (b - a);
  const stmts = [];
  const add = (sql, ...args) => stmts.push(db.prepare(sql).bind(...args));

  // ---- 專案 ----
  const jsn = 'test-proj-jsn';
  const yxz = 'test-proj-yxz';
  const jMetrics = defaultMetrics().map((m) => (m.key === 'valid_lead' ? { ...m, def: '【測試定義】已加 LINE 未封鎖、已領取電子書，並留下電話' } : m.key === 'payment' ? { ...m, def: '【測試定義】實收金額，不扣平台手續費' } : m));
  add(`INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope, is_test, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`, jsn, 'TJSN', 'T', '【測試】Jason 合作招生', '合作', 'Jason 老師（測試）', '待填', '【測試】電子書引流到課程報名', 50000, 'TWD', '進行中',
  JSON.stringify(jMetrics), '{}', '【測試】名單只用於本專案招生', t, t);
  const yMetrics = defaultMetrics().map((m) => ({ ...m, enabled: false, def: '活化目的待確認，尚未定義' }));
  add(`INSERT INTO projects (id, code, claim_prefix, name, kind, partner, owner, goal, budget, currency, status, metrics_json, settings_json, data_scope, is_test, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`, yxz, 'TYXZ', 'U', '【測試】玉欣珍會員活化', '自有品牌', '', '待填', '活化目的待確認', null, 'TWD', '規劃中',
  JSON.stringify(yMetrics), '{}', '會員資料只用於本專案', t, t);
  add('INSERT INTO project_members (project_id, email, role) VALUES (?,?,?)', jsn, 'viewer@test.local', 'viewer');

  for (const [id, pid, type, name, owner, payer] of [
    ['test-acc-1', jsn, 'fb_page', '【測試】合作粉專', '待填', ''],
    ['test-acc-2', jsn, 'ad_account', 'act_TEST0001', '待填', '待填'],
    ['test-acc-3', jsn, 'line_oa', '【測試】招生 LINE', '待填', ''],
    ['test-acc-4', yxz, 'line_oa', '【測試】玉欣珍 LINE', '玉欣珍', ''],
  ]) add('INSERT INTO accounts (id, project_id, type, name, external_id, owner, payer, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, pid, type, name, '', owner, payer, '測試資料', t);

  // ---- 活動與素材 ----
  const c1 = { id: 'test-c1', code: 'TJSN-2609-01', name: '【測試】電子書第一波', start: '2026-09-20', end: '2026-10-05', budget: 15000, target: 250, status: '已結束', flow: '丙', dest: '落地頁 → 加 LINE 輸入領取碼領書（方案丙）' };
  const c2 = { id: 'test-c2', code: 'TJSN-2610-01', name: '【測試】電子書第二波', start: '2026-10-06', end: '2026-10-31', budget: 20000, target: 250, status: '進行中', flow: '甲', dest: '落地頁表單 → 下載電子書 → 邀請加 LINE（方案甲）' };
  const c3 = { id: 'test-c3', code: 'TYXZ-2610-01', name: '【測試】會員活化測試（目的待定）', start: null, end: null, budget: null, target: null, status: '規劃中', flow: '不適用', dest: '待定' };
  for (const [c, pid] of [[c1, jsn], [c2, jsn], [c3, yxz]]) {
    add(`INSERT INTO campaigns (id, project_id, code, name, offer, audience, destination, flow, start_date, end_date, budget, target_cpl, owner, status, note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, c.id, pid, c.code, c.name, pid === jsn ? '免費電子書《測試書名》→ 課程' : '待定', pid === jsn ? 'aud01 測試受眾' : '玉欣珍 LINE 會員（範圍待定）',
    c.dest, c.flow, c.start, c.end, c.budget, c.target, '待填', c.status, '測試資料', t, t);
  }
  const cr = [
    { id: 'test-cr1', c: c1, code: 'TJSN-2609-01-VD01-v1', name: '短影音：三分鐘看懂', channel: 'fb_ad', paid: 1, base: [650, 900], ctr: 0.018, conv: 0.30 },
    { id: 'test-cr2', c: c1, code: 'TJSN-2609-01-IM01-v1', name: '圖片：書封＋重點', channel: 'fb_ad', paid: 1, base: [400, 600], ctr: 0.011, conv: 0.18 },
    { id: 'test-cr3', c: c1, code: 'TJSN-2609-01-TX01-v1', name: '粉專貼文：作者介紹', channel: 'fb_post', paid: 0 },
    { id: 'test-cr4', c: c2, code: 'TJSN-2610-01-VD01-v1', name: '短影音：學員心得', channel: 'fb_ad', paid: 1, base: [700, 1000], ctr: 0.016, conv: 0.22 },
    { id: 'test-cr5', c: c2, code: 'TJSN-2610-01-CA01-v1', name: '輪播：五個 AI 小技巧', channel: 'fb_ad', paid: 1, base: [500, 700], ctr: 0.013, conv: 0.12 },
    { id: 'test-cr6', c: c2, code: 'TJSN-2610-01-LM01-v1', name: '合作方 LINE 訊息', channel: 'line', paid: 0 },
    { id: 'test-cr7', c: c3, code: 'TYXZ-2610-01-LM01-v1', name: '活化訊息（內容待定）', channel: 'line', paid: 0 },
  ];
  for (const x of cr) {
    const pid = x.c === c3 ? yxz : jsn;
    const status = x.c.status === '進行中' ? '進行中' : x.c.status === '已結束' ? '已結束' : '規劃中';
    add('INSERT INTO creatives (id, project_id, campaign_id, code, name, channel, paid, format, status, platform_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      x.id, pid, x.c.id, x.code, x.name, x.channel, x.paid, x.code.split('-')[3].slice(0, 2), status, '', t, t);
  }
  const base = 'https://example.com/test-ebook';
  for (const [i, x, src, med] of [[1, cr[0], 'facebook', 'paid_social'], [2, cr[1], 'facebook', 'paid_social'], [3, cr[2], 'facebook', 'organic_social'], [4, cr[3], 'facebook', 'paid_social'], [5, cr[4], 'facebook', 'paid_social']]) {
    const url = buildTrackingUrl({ baseUrl: base, source: src, medium: med, campaignCode: x.c.code, creativeCode: x.code, term: 'aud01' });
    add('INSERT INTO tracking_links (id, project_id, campaign_id, creative_id, base_url, utm_source, utm_medium, utm_term, full_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      'test-link-' + i, jsn, x.c.id, x.id, base, src, med, 'aud01', url, t);
  }
  for (const [code, x, ch] of [['T101', cr[0], 'FB 付費廣告'], ['T102', cr[2], 'FB 免費貼文'], ['T201', cr[5], '合作方 LINE']]) {
    add('INSERT INTO claim_codes (id, project_id, campaign_id, creative_id, code, channel, note, created_at) VALUES (?,?,?,?,?,?,?,?)', 'test-code-' + code, jsn, x.c.id, x.id, code, ch, '測試資料', t);
  }

  // ---- 廣告每日數字（第二波刻意缺 10/12，示範「資料不完整」）----
  const conv = [];
  let phone = 0;
  const nextPerson = async () => personRef('0900' + String(++phone).padStart(6, '0'), '', salt);
  for (const x of cr.filter((c) => c.paid)) {
    const to = x.c.end < yesterday ? x.c.end : yesterday;
    for (const d of datesInRange(x.c.start, to)) {
      const spend = Math.round(between(...x.base));
      const impressions = Math.round(spend * between(9, 13));
      const clicks = Math.round(impressions * x.ctr * between(0.8, 1.2));
      if (!(x.c === c2 && d === '2026-10-12')) {
        add(`INSERT INTO ad_daily (id, project_id, date, campaign_id, creative_id, ad_name, spend, impressions, link_clicks, source, batch_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,'csv','test-batch',?)`,
          `test-ad-${x.id}-${d}`, jsn, d, x.c.id, x.id, `${x.code}｜測試廣告`, spend, impressions, clicks, t);
      }
      // 第二波最後 3 天沒有有效名單（示範「有花費沒有成果」警示）
      const quiet = x.c === c2 && d >= addDays(yesterday, -2);
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
  // 免費貼文與合作方 LINE 的少量領取
  for (const [x, n] of [[cr[2], 14], [cr[5], 9]]) {
    for (let k = 0; k < n; k++) {
      const to = x.c.end < yesterday ? x.c.end : yesterday;
      const d = addDays(x.c.start, Math.floor(R() * (Date.parse(to) - Date.parse(x.c.start)) / 86400000));
      const person = await nextPerson();
      conv.push({ type: 'claim', date: d, x, person });
      conv.push({ type: 'lead', date: d, x, person });
      if (R() < 0.5) conv.push({ type: 'valid_lead', date: d, x, person });
    }
  }
  // 來源不明的報名與付款
  for (const d of ['2026-10-02', '2026-10-09']) {
    const person = await nextPerson();
    conv.push({ type: 'enroll', date: d, x: null, person });
    conv.push({ type: 'payment', date: d, x: null, person, amount: 3980 });
  }
  const firstPay = conv.find((c) => c.type === 'payment' && c.x);
  if (firstPay) conv.push({ type: 'refund', date: addDays(firstPay.date, 3), x: firstPay.x, person: firstPay.person, amount: 3980 });

  let n = 0;
  for (const c of conv) {
    add(`INSERT INTO conversions (id, project_id, type, date, campaign_id, creative_id, claim_code, qty, amount, person_ref, external_ref, source, batch_id, note, created_at)
      VALUES (?,?,?,?,?,?,?,1,?,?,?,'csv','test-batch','測試資料',?)`, `test-cv-${++n}`, jsn, c.type, c.date, c.x?.c.id ?? null, c.x?.id ?? null, '', c.amount || 0, c.person,
    c.type === 'enroll' || c.type === 'payment' || c.type === 'refund' ? `TEST-${c.type}-${n}` : null, t);
  }

  // ---- 資料來源（報名只更新到前天，示範「資料不完整」）----
  for (const [kind, covered] of [['ads', yesterday], ['claim', yesterday], ['lead', yesterday], ['enroll', addDays(yesterday, -1)], ['payment', yesterday]]) {
    add('INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,1,?,?,?)', jsn, kind, covered, t, '測試資料');
  }
  add('INSERT INTO sources (project_id, kind, connected, covered_through, updated_at, note) VALUES (?,?,0,NULL,?,?)', yxz, 'ads', t, '本專案目前沒有付費廣告');
  add(`INSERT INTO imports (id, project_id, kind, filename, rows_total, rows_inserted, rows_updated, rows_skipped, messages_json, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    'test-batch', jsn, 'ads', '測試資料（程式產生）', 0, 0, 0, 0, '[]', 'seed', t);
  add('INSERT INTO todos (id, project_id, title, due, done, created_by, created_at) VALUES (?,?,?,?,0,?,?)', 'test-todo-1', jsn, '【測試】向合作方確認報名名單提供頻率', addDays(today, 3), 'seed', t);
  add('INSERT INTO todos (id, project_id, title, due, done, created_by, created_at) VALUES (?,?,?,?,0,?,?)', 'test-todo-2', yxz, '【測試】確認活化目的與成果指標', null, 'seed', t);

  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200));
  return { conversions: conv.length };
}
