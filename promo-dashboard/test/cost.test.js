import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

const P = 'test-proj-jsn';
const get = async (call, q) => (await call('GET', `/projects/${P}?${q}`)).data;

test('廣告成本只用付費可歸因成果：免費與來源不明不進分母（修正 3,266 ÷ 8 的錯誤）', async () => {
  const { call } = await setup();
  // 10/06–10/11：第二波期間、廣告資料完整，且有免費 LINE 有效名單
  const j = await get(call, 'period=custom&from=2026-10-06&to=2026-10-11');
  const m = j.metrics;
  const g = j.groups;
  assert.equal(m.spend.s, 'value');
  assert.ok(g.paid.valid_lead.v > 0);
  assert.ok(g.free.valid_lead.v > 0, '免費 LINE 應有有效名單');
  assert.ok(m.valid_lead.v > g.paid.valid_lead.v, '專案合計含免費名單');
  assert.equal(m.cost_primary.n, m.spend.v);
  assert.equal(m.cost_primary.d, g.paid.valid_lead.v, '分母只能是付費廣告有效名單');
  assert.notEqual(m.cost_primary.d, m.valid_lead.v);
  // 各波次同樣只用付費素材成果
  for (const c of j.campaigns.filter((x) => x.metrics.cost_primary.v != null)) {
    assert.equal(c.metrics.cost_primary.d, c.metrics.paid.valid_lead.v);
  }
});

test('三組成果分開：付費、免費、來源不明（含只對應到波次）', async () => {
  const { call } = await setup();
  const j = await get(call, 'period=month');
  const g = j.groups;
  for (const k of ['paid', 'free', 'unknown', 'campaignOnly', 'noCampaign']) assert.ok(g[k].enroll, k);
  assert.equal(g.unknown.enroll.v, g.campaignOnly.enroll.v + g.noCampaign.enroll.v);
  assert.ok(g.unknown.enroll.v > 0);
  assert.ok(j.metrics.enroll.v <= g.paid.enroll.v + g.free.enroll.v + g.unknown.enroll.v, '合計以人去重');
});

test('廣告缺資料：正式成本暫不計算、花費標已知小計；累計花費與預算使用率不當成完整總額', async () => {
  const { call } = await setup();
  const j = await get(call, 'period=week'); // 10/12–10/14，缺 10/12
  assert.equal(j.metrics.spend.s, 'incomplete');
  assert.match(j.metrics.spend.r, /^已知小計/);
  assert.equal(j.metrics.cost_primary.v, null);
  assert.equal(j.metrics.cost_primary.s, 'not_computed');
  assert.equal(j.metrics.cost_primary.r, '廣告資料不完整');
  assert.equal(j.cumulative.spend.s, 'incomplete');
  assert.match(j.cumulative.spend.r, /^已知小計/);
  assert.equal(j.budget.used.s, 'incomplete');
  assert.equal(j.cumulative.cost_primary.s, 'not_computed');
  // 選一段完整的期間，累計仍然不完整（累計看的是專案開始至今）
  const ok = await get(call, 'period=custom&from=2026-10-06&to=2026-10-11');
  assert.equal(ok.cumulative.spend.s, 'incomplete');

  // 補登缺的那天後，累計花費與預算使用率變為完整
  const c2 = j.campaigns.find((c) => c.status === '進行中');
  for (const cr of c2.creatives.filter((x) => x.paid && x.status !== '規劃中')) {
    const r = await call('POST', `/projects/${P}/ad-daily`, { creative_id: cr.id, date: '2026-10-12', spend: 500, impressions: 5000, link_clicks: 50, coveredThrough: '2026-10-14' });
    assert.equal(r.status, 201);
  }
  const after = await get(call, 'period=week');
  assert.equal(after.metrics.spend.s, 'value');
  assert.equal(after.cumulative.spend.s, 'value');
  assert.equal(after.budget.used.s, 'value');
  assert.equal(after.budget.used.n, after.cumulative.spend.v);
});

test('本期新增與累計招生進度分開：累計不隨期間改變', async () => {
  const { call } = await setup();
  const w = await get(call, 'period=week');
  const mo = await get(call, 'period=month');
  assert.deepEqual(w.cumulative.enrollProgress, mo.cumulative.enrollProgress);
  assert.equal(w.cumulative.enrollProgress.d, w.project.target_enroll);
  assert.equal(w.cumulative.enrollProgress.n, w.cumulative.all.enroll.v);
  assert.ok(w.cumulative.all.enroll.v >= mo.metrics.enroll.v);
  assert.ok(mo.metrics.enroll.v >= w.metrics.enroll.v);
});

test('玉欣珍沒有付費素材：花費與成本不計算，首頁可標示尚未啟用付費廣告', async () => {
  const { call } = await setup();
  const h = (await call('GET', '/home')).data;
  const y = h.projects.find((p) => p.project.id === 'test-proj-yxz');
  assert.equal(y.paidCreatives, 0);
  assert.equal(y.cumulative.spend.s, 'not_computed');
  assert.equal(y.metrics.spend.s, 'not_computed');
});
