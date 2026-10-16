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
  assert.equal(w.cumulative.enrollProgress.n, w.cumulative.enrollment.valid.v);
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

test('累計報名資料不完整：不給確定達成率，只保留已知人數與目標', async () => {
  const { call } = await setup();
  const j = await get(call, 'period=week');
  const pr = j.cumulative.enrollProgress;
  assert.equal(j.cumulative.all.enroll.s, 'incomplete'); // 報名只更新到前天
  assert.equal(pr.v, null);
  assert.equal(pr.s, 'not_computed');
  assert.ok(pr.known);
  assert.equal(pr.n, j.cumulative.enrollment.valid.v);
  assert.equal(pr.d, 60);
  assert.match(pr.r, /達成率暫不計算/);
  const h = (await call('GET', '/home')).data;
  assert.deepEqual(h.projects.find((p) => p.project.id === P).cumulative.enrollProgress, pr, '首頁與專案頁同一規則');
  // 補齊報名資料後才有確定的達成率
  assert.equal((await call('PUT', `/projects/${P}/sources/enroll`, { connected: true, covered_through: '2026-10-14' })).status, 200);
  const after = await get(call, 'period=week');
  assert.equal(after.cumulative.all.enroll.s, 'value');
  assert.equal(after.cumulative.enrollProgress.v, after.cumulative.enrollProgress.n / 60);
});

test('已結束的素材與波次：顯示「已結束」與歷史成效，不給投放建議；進行中但資料不足時暫不判斷', async () => {
  const { call } = await setup();
  for (const q of ['period=week', 'period=month', 'period=all']) {
    const j = await get(call, q);
    for (const c of [...j.creatives.filter((x) => x.paid), ...j.campaigns]) {
      if (c.ended) {
        assert.equal(c.judgement.label, '已結束', `${q} ${c.code}`);
        assert.match(c.judgement.reason, /不提供投放建議/);
      } else assert.notEqual(c.judgement.label, '已結束');
      const bad = ['spend', 'link_clicks'].some((k) => c.metrics[k].s === 'incomplete' || c.metrics[k].v == null);
      if (!c.ended && bad && c.judgement.label !== '—') assert.equal(c.judgement.label, '暫不判斷', `${q} ${c.code}`);
    }
  }
  const m = await get(call, 'period=month');
  const ended = m.creatives.filter((c) => c.paid && c.ended);
  assert.equal(ended.length, 2, '第一波的素材 1、2 已結束');
  assert.ok(ended.every((c) => c.judgement.label !== '持續'));
});

test('素材檔：影片可播放、只有封面要標示、沒有檔案、測試標記、落地頁', async () => {
  const { call } = await setup();
  const j = await get(call, 'period=all');
  const by = (code) => j.creatives.find((c) => c.code === code);
  const v1 = by('TJSN-2609-01-VD01-v1');
  assert.match(v1.video_url, /^data:video\/webm/);
  assert.equal(v1.asset_status, '測試');
  const v3 = by('TJSN-2610-01-VD01-v1');
  assert.ok(v3.preview_url && !v3.video_url, '只有封面');
  const im2 = by('TJSN-2610-01-IM02-v1');
  assert.equal(im2.preview_url, '');
  assert.equal(im2.asset_status, '測試');
  assert.match(v1.landing_url, /^https:\/\//);
  // 落地頁、影片只接受 https；換成真實檔案後不再標測試示意
  assert.equal((await call('PUT', '/creatives/' + v3.id, { landing_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('PUT', '/creatives/' + v3.id, { video_url: 'http://x/a.mp4' })).status, 400);
  assert.equal((await call('PUT', '/creatives/' + v3.id, { video_url: 'https://cdn.example.com/a.mp4' })).status, 200);
  const after = (await get(call, 'period=all')).creatives.find((c) => c.id === v3.id);
  assert.equal(after.video_url, 'https://cdn.example.com/a.mp4');
  assert.equal(after.asset_status, '測試', '換成 https 網址不會自動移除測試標記');
});

test('首頁待辦：逾期優先，再依急迫程度與期限排序', async () => {
  const { call } = await setup();
  const t = (await call('GET', '/home')).data.todos;
  const firstNotOverdue = t.findIndex((x) => !x.overdue);
  assert.ok(t.slice(firstNotOverdue).every((x) => !x.overdue), '逾期都排在前面');
  assert.ok(t.length > 5);
});

test('素材測試／正式：新素材預設測試，要明確確認才改正式；換檔退回測試；測試專案仍標測試', async () => {
  const { call } = await setup();
  const j = await get(call, 'period=all');
  const c2 = j.campaigns.find((c) => c.code === 'TJSN-2610-01');
  const created = await call('POST', `/campaigns/${c2.id}/creatives`, { code: 'TJSN-2610-01-IM03-v1', name: '新素材', channel: 'fb_ad', preview_url: 'https://cdn.example.com/real.jpg' });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const find = async () => (await get(call, 'period=all')).creatives.find((c) => c.id === id);
  assert.equal((await find()).asset_status, '測試', '新素材預設測試，即使是 https 網址');
  // 一般編輯帶 asset_status 也不會改
  await call('PUT', '/creatives/' + id, { asset_status: '正式', name: '新素材' });
  assert.equal((await find()).asset_status, '測試');
  // 沒有明確確認不能改
  const noConfirm = await call('POST', `/creatives/${id}/asset-status`, { status: '正式' });
  assert.equal(noConfirm.status, 400);
  assert.equal((await call('POST', `/creatives/${id}/asset-status`, { status: '正式', confirm: true })).status, 200);
  const off = await find();
  assert.equal(off.asset_status, '正式');
  assert.equal(off.asset_confirmed_by, 'admin@test.local');
  assert.ok(off.asset_confirmed_at);
  // 測試專案仍是測試
  const pj = await get(call, 'period=all');
  assert.equal(pj.project.is_test, 1);
  // 只改文案不影響；換圖片退回測試
  await call('PUT', '/creatives/' + id, { headline: '新標題' });
  assert.equal((await find()).asset_status, '正式');
  await call('PUT', '/creatives/' + id, { preview_url: 'https://cdn.example.com/real-v2.jpg' });
  assert.equal((await find()).asset_status, '測試', '換檔後要重新確認');
  // 只能看的成員不能改
  assert.equal((await call('POST', `/creatives/${id}/asset-status`, { status: '正式', confirm: true }, 'viewer@test.local')).status >= 400, true);
});
