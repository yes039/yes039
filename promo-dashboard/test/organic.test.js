import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { classify, summarize } from '../src/organic.js';
import { resolvePeriod } from '../src/periods.js';

const TODAY = '2026-10-15';

test('發文計數口徑：預計依預定日、已發依發布日、待發含逾期、取消不算預計', () => {
  const range = resolvePeriod({ period: 'week', today: TODAY }); // 10/12–10/18
  const posts = [
    { status: '已發布', planned_date: '2026-10-13', published_date: '2026-10-13' },  // 預計＋已發
    { status: '已發布', planned_date: '2026-10-11', published_date: '2026-10-12' },  // 期外預定、期內發布：只算已發
    { status: '已發布', planned_date: '2026-10-16', published_date: '2026-10-09' },  // 期內預定、期外提前發布：只算預計
    { status: '待發布', planned_date: '2026-10-14' },                                 // 預計＋待發＋逾期
    { status: '待製作', planned_date: '2026-10-17' },                                 // 預計＋待發
    { status: '取消', planned_date: '2026-10-15' },                                   // 只算取消
    { status: '待製作', planned_date: '2026-10-25' },                                 // 期外
    { status: '已發布', planned_date: null, published_date: '2026-10-14' },           // 臨時加發：只算已發
  ];
  const s = summarize(posts, range, TODAY);
  assert.deepEqual(s.counts, { planned: 4, published: 3, pending: 2, overdue: 1, cancelled: 1, onPlan: 1, crossIn: 1, extra: 1, plannedOut: 1 });
  // 核對：預計＝依期＋期外發布＋待發；已發＝依期＋跨期補發＋臨時加發
  assert.equal(s.counts.planned, s.counts.onPlan + s.counts.plannedOut + s.counts.pending);
  assert.equal(s.counts.published, s.counts.onPlan + s.counts.crossIn + s.counts.extra);
  assert.equal(classify(posts[2], range, TODAY).pending, false); // 已提前發布，不是待發
});

test('互動口徑：只算期間內已發布貼文；未登錄不以 0 計', () => {
  const range = resolvePeriod({ period: 'week', today: TODAY });
  const a = { status: '已發布', planned_date: '2026-10-13', published_date: '2026-10-13', likes: 10, comments: 2, shares: 1, metrics_as_of: '2026-10-14 21:00' };
  const b = { status: '已發布', planned_date: '2026-10-13', published_date: '2026-10-14', likes: null };
  assert.equal(summarize([a], range, TODAY).likes.s, 'value');
  const both = summarize([a, b], range, TODAY);
  assert.equal(both.likes.v, 10);
  assert.equal(both.likes.s, 'incomplete');
  assert.equal(summarize([b], range, TODAY).likes.s, 'not_entered');
  assert.equal(summarize([{ status: '待製作', planned_date: '2026-10-16' }], range, TODAY).likes.s, 'not_computed');
});

test('切換期間與主體：日常發文頁與首頁數字一致；主體篩選等於首頁該列', async () => {
  const { call } = await setup();
  for (const period of ['week', 'month&m=2026-10', 'custom&from=2026-10-01&to=2026-10-20']) {
    const home = (await call('GET', '/home?period=' + period)).data.organic;
    const org = (await call('GET', '/organic?period=' + period)).data;
    assert.deepEqual(org.total.counts, home.total.counts, period);
    assert.equal(org.total.likes.v, home.total.likes.v, period);
    for (const row of home.bySubject) {
      const one = (await call('GET', `/organic?period=${period}&type=${row.type}`)).data;
      assert.deepEqual(one.total.counts, row.counts, `${period} ${row.label}`);
      const outletSum = one.byOutlet.reduce((a, o) => a + o.counts.planned, 0);
      assert.equal(outletSum, row.counts.planned, `${period} ${row.label} 各位置加總`);
    }
  }
});

test('同題材多位置：每個位置一筆，發文數依實際筆數計算', async () => {
  const { call } = await setup();
  const post = (await call('GET', '/posts/test-post-5')).data;
  assert.equal(post.topic.title, '【測試】電子書搶先看');
  assert.equal(post.siblings.length, 3); // 另外兩個已發布位置＋一個預定中的位置
  const org = (await call('GET', '/organic?period=month&m=2026-10')).data;
  const sameTopic = org.posts.filter((p) => p.topic_id === 'test-t2' && p.flags.published);
  assert.equal(sameTopic.length, 3);
});

test('自然貼文：可不掛專案，也可支援專案；專案頁分區顯示、不與廣告成果相加', async () => {
  const { call } = await setup();
  const none = (await call('GET', '/organic?period=month&m=2026-10&project=none')).data;
  const jsn = (await call('GET', '/organic?period=month&m=2026-10&project=test-proj-jsn')).data;
  const allp = (await call('GET', '/organic?period=month&m=2026-10')).data;
  assert.ok(none.posts.length > 0 && jsn.posts.length > 0);
  assert.equal(none.posts.length + jsn.posts.length, allp.posts.length);
  const pj = (await call('GET', '/projects/test-proj-jsn?period=month&m=2026-10')).data;
  assert.equal(pj.relatedPosts.posts.length, jsn.posts.length);
  // 專案的詢問只來自成果紀錄，不含貼文上登錄的詢問
  const postInquiries = jsn.total.inquiries.v;
  assert.ok(postInquiries > 0);
  assert.ok(pj.metrics.inquiry.v != null);
  const created = await call('POST', '/posts', { outlet_id: 'test-o2', title: '獨立貼文', planned_date: '2026-10-20', status: '待製作' });
  assert.equal(created.status, 201);
  assert.equal((await call('GET', '/posts/' + created.data.id)).data.post.project_id, null);
});

test('貼文驗證：已發布要有發布日；登錄互動要有統計截至；未發布不能登錄互動', async () => {
  const { call } = await setup();
  const base = { outlet_id: 'test-o1', title: 't', planned_date: '2026-10-16' };
  assert.match((await call('POST', '/posts', { ...base, status: '已發布' })).data.error, /實際發布日期/);
  assert.match((await call('POST', '/posts', { ...base, status: '待發布', published_date: '2026-10-14' })).data.error, /已發布/);
  assert.match((await call('POST', '/posts', { ...base, status: '已發布', published_date: '2026-10-14', likes: 3 })).data.error, /統計截至/);
  assert.match((await call('POST', '/posts', { ...base, status: '待發布', likes: 3 })).data.error, /尚未發布/);
  const ok = await call('POST', '/posts', { ...base, status: '已發布', published_date: '2026-10-14', likes: 3, comments: 0, shares: 0, metrics_as_of: '2026-10-14T22:00' });
  assert.equal(ok.status, 201);
  const p = (await call('GET', '/posts/' + ok.data.id)).data.post;
  assert.equal(p.metrics_as_of, '2026-10-14 22:00');
  assert.equal(p.metrics_source, '人工登錄');
});

test('素材比較：至少兩份素材各自有成效；投放紀錄加總回素材；來源不明不分配', async () => {
  const { call, drv } = await setup();
  const pj = (await call('GET', '/projects/test-proj-jsn?period=all')).data;
  const paid = pj.creatives.filter((c) => c.paid && c.metrics.spend.v > 0);
  assert.ok(paid.length >= 2);
  const vd = pj.creatives.find((c) => c.code === 'TJSN-2610-01-VD01-v1');
  assert.equal(vd.placements.length, 2);
  const plSum = vd.placements.reduce((a, p) => a + p.metrics.spend.v, 0);
  assert.equal(plSum + vd.unplacedSpend, vd.metrics.spend.v);
  const unknownDb = drv.all("SELECT SUM(qty) n FROM conversions WHERE project_id='test-proj-jsn' AND type='enroll' AND campaign_id IS NULL", [])[0].n;
  assert.equal(pj.unknown.enroll, unknownDb);
  const creativeEnroll = pj.creatives.reduce((a, c) => a + (c.metrics.enroll.v || 0), 0);
  // 專案合計以人去重，不會大於各分項相加；來源不明與只對到波次的成果不計入任何素材
  assert.ok(pj.metrics.enroll.v <= creativeEnroll + pj.unknown.enroll + pj.campaignOnly.enroll);
  assert.ok(pj.unknown.enroll > 0);
});

test('判斷規則：關鍵資料不完整時不給「持續」，並列出依據', async () => {
  const { call } = await setup();
  for (const period of ['week', 'r30', 'month&m=2026-10', 'all']) {
    const pj = (await call('GET', '/projects/test-proj-jsn?period=' + period)).data;
    for (const c of [...pj.creatives, ...pj.campaigns]) {
      const pk = pj.metrics.primaryKey;
      const incomplete = ['spend', 'link_clicks', pk].some((k) => c.metrics[k].s === 'incomplete' || c.metrics[k].v == null);
      if (incomplete) assert.notEqual(c.judgement.label, '持續', `${period} ${c.code} ${c.judgement.reason}`);
      if (c.judgement.label === '持續') assert.ok(c.judgement.basis.length >= 3);
    }
  }
  const pj = (await call('GET', '/projects/test-proj-jsn?period=r30')).data;
  const vd = pj.creatives.find((c) => c.code === 'TJSN-2610-01-VD01-v1');
  assert.equal(vd.metrics.spend.s, 'incomplete');
  assert.equal(vd.judgement.label, '暫不判斷');
  assert.match(vd.judgement.reason, /^待補資料/);
});

test('花費分開標示：本期、波次累計、專案累計、預算', async () => {
  const { call, drv } = await setup();
  const pj = (await call('GET', '/projects/test-proj-jsn?period=week')).data;
  const total = drv.all("SELECT SUM(spend) s FROM ad_daily WHERE project_id='test-proj-jsn'", [])[0].s;
  assert.equal(pj.budget.spentAll, total);
  const c2 = pj.campaigns.find((c) => c.code === 'TJSN-2610-01');
  const c2all = drv.all("SELECT SUM(spend) s FROM ad_daily WHERE campaign_id='test-c2'", [])[0].s;
  assert.equal(c2.metrics.spendAll, c2all);
  assert.ok(c2.metrics.spend.v < c2.metrics.spendAll);
  const c1 = pj.campaigns.find((c) => c.code === 'TJSN-2609-01');
  assert.equal(c1.metrics.spend.s, 'not_computed'); // 本週沒有投放
  assert.equal(c1.judgement.label, '已結束'); // 已結束的波次只看歷史成效
});

test('發文數可由明細核對：各期間的預計、已發都等於分項相加，且等於清單筆數', async () => {
  const { call } = await setup();
  for (const q of ['period=week', 'period=month', 'period=r30', 'period=month&m=2026-09']) {
    const o = (await call('GET', '/organic?' + q)).data;
    const c = o.total.counts;
    assert.equal(c.planned, c.onPlan + c.plannedOut + c.pending, q);
    assert.equal(c.published, c.onPlan + c.crossIn + c.extra, q);
    for (const k of ['planned', 'published', 'pending', 'overdue', 'cancelled', 'onPlan', 'crossIn', 'extra', 'plannedOut']) {
      assert.equal(o.posts.filter((p) => p.flags[k]).length, c[k], `${q} ${k}`);
    }
  }
  const m = (await call('GET', '/organic?period=month')).data.total.counts;
  const w = (await call('GET', '/organic?period=week')).data.total.counts;
  assert.ok(m.extra >= 1 && w.crossIn >= 1 && m.cancelled >= 1, '測試資料含臨時加發、跨期補發、取消');
});
