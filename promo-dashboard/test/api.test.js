import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

const P = 'period=r30';

test('總覽：跨專案只加總平台定義的廣告數字，轉換率用合計分子分母', async () => {
  const { call, drv } = await setup();
  const { status, data } = await call('GET', '/overview?' + P);
  assert.equal(status, 200);
  assert.equal(data.range.from, '2026-09-15');
  assert.equal(data.range.to, '2026-10-14');
  const t = data.totals.find((x) => x.currency === 'TWD');
  const sums = drv.all("SELECT SUM(spend) s, SUM(impressions) i, SUM(link_clicks) c FROM ad_daily WHERE date BETWEEN '2026-09-15' AND '2026-10-14'", [])[0];
  assert.equal(Math.round(t.spend.v), Math.round(sums.s));
  assert.equal(t.ctr.v, sums.c / sums.i);
  // 第二波缺 10/12，總花費標示資料不完整
  assert.equal(t.spend.s, 'incomplete');
  assert.equal(data.projects.length, 2);
  // 成果不跨專案加總：總覽 totals 沒有成果欄位
  assert.equal(t.lead, undefined);
});

test('專案隔離：成員只看得到自己的專案，其他專案回 404', async () => {
  const { call } = await setup();
  const list = await call('GET', '/projects', null, 'viewer@test.local');
  assert.deepEqual(list.data.map((p) => p.code), ['TJSN']);
  const ov = await call('GET', '/overview?' + P, null, 'viewer@test.local');
  assert.equal(ov.data.projects.length, 1);
  assert.ok(ov.data.anomalies.every((a) => a.project === 'TJSN'));
  const other = await call('GET', '/projects/test-proj-yxz?' + P, null, 'viewer@test.local');
  assert.equal(other.status, 404);
  const stranger = await call('GET', '/projects', null, 'nobody@test.local');
  assert.equal(stranger.data.length, 0);
  // 檢視者不能寫入
  const w = await call('POST', '/projects/test-proj-jsn/todos', { title: 'x' }, 'viewer@test.local');
  assert.equal(w.status, 403);
  // 非管理者不能新增專案
  const np = await call('POST', '/projects', { code: 'ABC', claim_prefix: 'A', name: 'x' }, 'viewer@test.local');
  assert.equal(np.status, 403);
});

test('數字狀態：資料不完整、尚未接入、暫不計算、已確認為零各自呈現', async () => {
  const { call } = await setup();
  const j = (await call('GET', '/projects/test-proj-jsn?' + P)).data;
  assert.equal(j.metrics.enroll.s, 'incomplete'); // 報名只更新到 10/13
  assert.match(j.metrics.enroll.r, /10\/13/);
  const c2 = j.campaigns.find((c) => c.code === 'TJSN-2610-01');
  assert.equal(c2.metrics.spend.s, 'incomplete');
  assert.deepEqual(c2.metrics.missingAdDates, ['2026-10-12']);
  const y = (await call('GET', '/projects/test-proj-yxz?' + P)).data;
  assert.equal(y.metrics.lead.s, 'not_computed'); // 玉欣珍未定義成果指標
  assert.equal(y.metrics.spend.s, 'not_computed'); // 沒有付費渠道
  // 已確認為零：曆月 2026-08 期間完整但沒有資料
  const aug = (await call('GET', '/projects/test-proj-jsn?period=month&m=2026-08')).data;
  assert.equal(aug.metrics.claim.s, 'zero');
});

test('名單以人去重：專案合計 ≤ 各活動加總，付款用筆數', async () => {
  const { call, drv } = await setup();
  const j = (await call('GET', '/projects/test-proj-jsn?period=all')).data;
  const persons = drv.all("SELECT COUNT(DISTINCT person_ref) n FROM conversions WHERE project_id='test-proj-jsn' AND type='lead'", [])[0].n;
  assert.equal(j.metrics.lead.v, persons);
  const pays = drv.all("SELECT COUNT(*) n, SUM(amount) a FROM conversions WHERE project_id='test-proj-jsn' AND type='payment'", [])[0];
  assert.equal(j.metrics.payment.v, pays.n);
  const refund = drv.all("SELECT SUM(amount) a FROM conversions WHERE project_id='test-proj-jsn' AND type='refund'", [])[0].a;
  assert.equal(j.metrics.net_amount.v, pays.a - refund);
  assert.equal(j.unknown.enroll, 2);
});

test('異常：第二波近 3 天有花費但沒有有效名單；缺追蹤連結列為待辦', async () => {
  const { call } = await setup();
  const j = (await call('GET', '/projects/test-proj-jsn?' + P)).data;
  assert.ok(j.anomalies.some((a) => a.title.includes('TJSN-2610-01') && a.title.includes('沒有有效名單')));
  assert.ok(j.anomalies.some((a) => a.title.includes('廣告資料缺漏')));
  assert.ok(j.todos.some((t) => t.title.includes('TJSN-2610-01-LM01-v1') && t.title.includes('追蹤連結')));
});

test('建立專案、活動、素材、連結、領取碼：代碼規則與重複檢查', async () => {
  const { call } = await setup({ seed: false });
  let r = await call('POST', '/projects', { code: 'jsn', claim_prefix: 'j', name: 'Jason 合作招生' });
  assert.equal(r.status, 201);
  const pid = r.data.id;
  assert.equal((await call('POST', '/projects', { code: 'JSN', claim_prefix: 'K', name: 'x' })).status, 400);
  assert.equal((await call('POST', '/projects', { code: 'ABC', claim_prefix: 'J', name: 'x' })).status, 400);
  r = await call('POST', `/projects/${pid}/campaigns`, { code: 'ABC-2610-01', name: 'x' });
  assert.match(r.data.error, /JSN-年月-序號/);
  r = await call('POST', `/projects/${pid}/campaigns`, { code: 'JSN-2610-01', name: '第一波', start_date: '2026/10/20', end_date: '2026-11-10', budget: '20,000' });
  assert.equal(r.status, 201);
  const cid = r.data.id;
  r = await call('POST', `/campaigns/${cid}/creatives`, { code: 'JSN-2610-01-XX01-v1', channel: 'fb_ad' });
  assert.equal(r.status, 400);
  r = await call('POST', `/campaigns/${cid}/creatives`, { code: 'JSN-2610-01-VD01-v1', channel: 'fb_ad', name: '影片' });
  assert.equal(r.status, 201);
  const crid = r.data.id;
  r = await call('POST', `/campaigns/${cid}/links`, { creative_id: crid, base_url: 'https://example.com/lp?ref=1', utm_source: 'facebook', utm_medium: 'paid_social' });
  assert.equal(r.data.url, 'https://example.com/lp?ref=1&utm_source=facebook&utm_medium=paid_social&utm_campaign=jsn-2610-01&utm_content=jsn-2610-01-vd01-v1');
  r = await call('POST', `/campaigns/${cid}/links`, { creative_id: crid, base_url: 'https://example.com/lp?ref=1', utm_source: 'facebook', utm_medium: 'paid_social' });
  assert.equal(r.status, 400);
  assert.equal((await call('POST', `/campaigns/${cid}/claim-codes`, { code: 'Ｊ１０１' })).status, 201); // 全形自動轉半形
  assert.equal((await call('POST', `/campaigns/${cid}/claim-codes`, { code: 'j101' })).status, 400); // 重複
  assert.equal((await call('POST', `/campaigns/${cid}/claim-codes`, { code: 'K101' })).status, 400); // 字首不符
});

test('Meta CSV 匯入：依素材代碼對應、跨天列拒絕、重複匯入覆蓋不重算', async () => {
  const { call } = await setup();
  const csv = [
    '報告開始日期,報告結束日期,廣告名稱,花費金額 (TWD),曝光次數,連結點擊次數',
    '2026-10-12,2026-10-12,TJSN-2610-01-VD01-v1｜補資料,"1,000",12000,180',
    '2026-10-12,2026-10-12,TJSN-2610-01-CA01-v1｜補資料,600,7000,90',
    '2026-10-12,2026-10-13,TJSN-2610-01-CA01-v1｜跨天,600,7000,90',
    '2026-10-12,2026-10-12,TYXZ-2610-01-LM01-v1｜別的專案,100,1000,10',
    '總計,,,2300,27000,370',
  ].join('\n');
  const pv = await call('POST', '/projects/test-proj-jsn/import/preview', { kind: 'ads', text: csv });
  const st = pv.data.rows.map((r) => r.status);
  assert.deepEqual(st, ['ok', 'ok', 'error', 'unmatched', 'skip']);
  assert.equal(pv.data.rows[0].spend, 1000);
  const bad = await call('POST', '/projects/test-proj-jsn/import/commit', { kind: 'ads', text: csv });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/projects/test-proj-jsn/import/commit', { kind: 'ads', text: csv, skipErrors: true, filename: 't.csv' });
  assert.equal(ok.data.inserted, 3);
  const again = await call('POST', '/projects/test-proj-jsn/import/commit', { kind: 'ads', text: csv, skipErrors: true });
  assert.equal(again.data.updated, 3);
  const j = (await call('GET', '/projects/test-proj-jsn?period=r30')).data;
  const c2 = j.campaigns.find((c) => c.code === 'TJSN-2610-01');
  assert.deepEqual(c2.metrics.missingAdDates, []);
  assert.ok(j.todos.some((t) => t.title.includes('對應不到素材')));
});

test('成果 CSV 匯入：外部編號去重、領取碼對應活動、他專案代碼拒絕、未定義指標拒絕', async () => {
  const { call } = await setup();
  const csv = [
    '類型,日期,活動代碼,素材代碼,領取碼,數量,金額,外部編號,電話,Email,備註',
    '報名,2026/10/14,TJSN-2610-01,,,1,,E-001,0912-345-678,,',
    '付款,2026-10-14,,,t201,1,3980,P-001,0912345678,,',
    '有效名單,2026-10-14,TYXZ-2610-01,,,1,,,,,',
    '名單,2026-10-14,,,,1,,,,a@b.com,',
    '付款,2026-10-14,,,,1,,P-002,,,',
  ].join('\n');
  const pv = await call('POST', '/projects/test-proj-jsn/import/preview', { kind: 'outcomes', text: csv });
  const rows = pv.data.rows;
  assert.equal(rows[0].status, 'ok');
  assert.equal(rows[1].via, '領取碼');
  assert.equal(rows[0].person_ref, rows[1].person_ref); // 電話標準化後同一人
  assert.equal(rows[2].status, 'error');
  assert.equal(rows[3].via, '來源不明');
  assert.equal(rows[4].status, 'error'); // 付款沒有金額
  const c = await call('POST', '/projects/test-proj-jsn/import/commit', { kind: 'outcomes', text: csv, skipErrors: true });
  assert.equal(c.data.inserted, 3);
  const again = await call('POST', '/projects/test-proj-jsn/import/commit', { kind: 'outcomes', text: csv, skipErrors: true });
  assert.equal(again.data.updated, 2); // 有外部編號的兩列覆蓋
  // 玉欣珍專案未定義成果指標：不接受成果
  const y = await call('POST', '/projects/test-proj-yxz/import/preview', { kind: 'outcomes', text: csv });
  assert.ok(y.data.rows.every((r) => r.status === 'error'));
});

test('人工登錄：成果標記資料來源，付費素材才能登錄廣告數字', async () => {
  const { call } = await setup({ seed: false });
  const p = (await call('POST', '/projects', { code: 'ABC', claim_prefix: 'A', name: '自有課程' })).data.id;
  const c = (await call('POST', `/projects/${p}/campaigns`, { code: 'ABC-2610-01', name: 'x', start_date: '2026-10-10', end_date: '2026-10-20' })).data.id;
  const free = (await call('POST', `/campaigns/${c}/creatives`, { code: 'ABC-2610-01-TX01-v1', channel: 'fb_post' })).data.id;
  const paid = (await call('POST', `/campaigns/${c}/creatives`, { code: 'ABC-2610-01-IM01-v1', channel: 'fb_ad' })).data.id;
  let before = (await call('GET', `/projects/${p}?period=r30`)).data;
  assert.equal(before.metrics.lead.s, 'not_connected');
  assert.equal(before.metrics.spend.s, 'not_connected');
  assert.equal((await call('POST', `/projects/${p}/ad-daily`, { creative_id: free, date: '2026-10-10', spend: 1, impressions: 1, link_clicks: 0 })).status, 400);
  assert.equal((await call('POST', `/projects/${p}/ad-daily`, { creative_id: paid, date: '2026-10-10', spend: 500, impressions: 5000, link_clicks: 50, coveredThrough: '2026-10-14' })).status, 201);
  assert.equal((await call('POST', `/projects/${p}/conversions`, { type: 'lead', date: '2026-10-11', creative_id: free, qty: 3, coveredThrough: '2026-10-14' })).status, 201);
  const after = (await call('GET', `/projects/${p}?period=r30`)).data;
  assert.equal(after.metrics.lead.v, 3);
  assert.equal(after.metrics.spend.v, 500);
  assert.equal(after.metrics.spend.s, 'incomplete'); // 10/11–10/14 沒有廣告資料
  assert.equal(after.metrics.claim.s, 'not_connected'); // 領取尚未接入
});
