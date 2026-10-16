import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

const P = 'test-proj-jsn';
const get = async (call, q = 'period=custom&from=2026-10-01&to=2026-10-14') => (await call('GET', `/projects/${P}?${q}`)).data;
const snap = (j) => ({
  ever: j.cumulative.enrollment.ever.v, cancelled: j.cumulative.enrollment.cancelled.v, valid: j.cumulative.enrollment.valid.v, restored: j.cumulative.enrollment.restored.v,
  newIn: j.enrollment.period.new.v, cancelIn: j.enrollment.period.cancel.v, restoreIn: j.enrollment.period.restore.v,
  net: j.cumulative.all.net_amount.v, refund: j.cumulative.all.refund_amount.v,
});
const conv = (call, b) => call('POST', `/projects/${P}/conversions`, b);

async function fresh() {
  const ctx = await setup();
  // 報名資料補到昨天，避免「資料不完整」干擾數字比對
  await ctx.call('PUT', `/projects/${P}/sources/enroll`, { connected: true, covered_through: '2026-10-14' });
  return ctx;
}

test('報名、取消、恢復：累計報名不變，有效報名扣除取消，恢復不重複計人', async () => {
  const { call } = await fresh();
  const b = snap(await get(call));
  const A = '0911000001';
  assert.equal((await conv(call, { type: 'enroll', date: '2026-10-05', phone: A })).status, 201);
  assert.equal((await conv(call, { type: 'enroll', date: '2026-10-06', phone: A })).status, 201); // 重複報名
  let s = snap(await get(call));
  assert.equal(s.ever, b.ever + 1, '重複報名只算一人');
  assert.equal(s.valid, b.valid + 1);
  assert.equal(s.newIn, b.newIn + 1);

  assert.equal((await conv(call, { type: 'cancel', date: '2026-10-07', phone: A, note: '時間無法配合' })).status, 201);
  s = snap(await get(call));
  assert.equal(s.ever, b.ever + 1, '累計報名不因取消減少');
  assert.equal(s.valid, b.valid, '有效報名扣除取消');
  assert.equal(s.cancelled, b.cancelled + 1);
  assert.equal(s.cancelIn, b.cancelIn + 1);

  const again = await conv(call, { type: 'cancel', date: '2026-10-08', phone: A, note: '重複送出' });
  assert.equal(again.status, 400);
  assert.match(again.data.error, /已是取消狀態/);

  assert.equal((await conv(call, { type: 'enroll', date: '2026-10-09', phone: A, note: '恢復報名' })).status, 201);
  s = snap(await get(call));
  assert.equal(s.ever, b.ever + 1, '恢復報名不重複計人');
  assert.equal(s.valid, b.valid + 1);
  assert.equal(s.cancelled, b.cancelled);
  assert.equal(s.restored, b.restored + 1);
  assert.equal(s.newIn, b.newIn + 1, '恢復不算本期新增');
  assert.equal(s.restoreIn, b.restoreIn + 1);

  // 達成率＝有效報名 ÷ 目標
  const j = await get(call);
  assert.equal(j.cumulative.enrollProgress.n, s.valid);
  assert.equal(j.cumulative.enrollProgress.v, s.valid / 60);
  // 取消紀錄保存日期、原因、登錄時間與後續狀態
  const rec = j.enrollment.cancels.find((c) => c.date === '2026-10-07');
  assert.equal(rec.reason, '時間無法配合');
  assert.ok(rec.recorded_at);
  assert.equal(rec.status, '已恢復報名');
});

test('取消報名必須對應到人、要有原因、要先有報名', async () => {
  const { call } = await fresh();
  assert.match((await conv(call, { type: 'cancel', date: '2026-10-07', note: '無' })).data.error, /電話或 Email/);
  assert.match((await conv(call, { type: 'cancel', date: '2026-10-07', phone: '0911000009' })).data.error, /原因/);
  assert.match((await conv(call, { type: 'cancel', date: '2026-10-07', phone: '0911000009', note: '測試' })).data.error, /找不到/);
  await conv(call, { type: 'enroll', date: '2026-10-10', phone: '0911000009' });
  assert.match((await conv(call, { type: 'cancel', date: '2026-10-09', phone: '0911000009', note: '日期早於報名' })).data.error, /找不到/);
});

test('部分退款不視為取消：有效報名不變，付款淨額扣除退款', async () => {
  const { call } = await fresh();
  const B = '0911000002';
  await conv(call, { type: 'enroll', date: '2026-10-05', phone: B });
  await conv(call, { type: 'payment', date: '2026-10-05', phone: B, amount: 3980 });
  const b = snap(await get(call));
  assert.equal((await conv(call, { type: 'refund', date: '2026-10-08', phone: B, amount: 1000, note: '部分退款' })).status, 201);
  const s = snap(await get(call));
  assert.equal(s.valid, b.valid, '退款不扣報名');
  assert.equal(s.cancelled, b.cancelled);
  assert.equal(s.refund, b.refund + 1000);
  assert.equal(s.net, b.net - 1000);
});

test('重複匯入：同一檔案匯入兩次不重複計算；檔案內可先報名、取消再恢復', async () => {
  const { call } = await fresh();
  const b = snap(await get(call));
  const csv = [
    '類型,日期,活動代碼,素材代碼,領取碼,數量,金額,外部編號,電話,Email,備註',
    '報名,2026-10-03,,,,1,,EN-C1,0922000001,,',
    '報名,2026-10-03,,,,1,,EN-D1,0922000002,,',
    '取消報名,2026-10-05,,,,1,,CX-D1,0922000002,,改期',
    '報名,2026-10-08,,,,1,,EN-D2,0922000002,,恢復',
    '付款,2026-10-03,,,,1,3980,PY-C1,0922000001,,',
    '退款,2026-10-06,,,,1,500,RF-C1,0922000001,,部分退款',
  ].join('\n');
  const body = { kind: 'outcomes', text: csv, filename: 'enroll.csv', coveredThrough: '2026-10-14' };
  const r1 = await call('POST', `/projects/${P}/import/commit`, body);
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.equal(r1.data.inserted, 6);
  const s1 = snap(await get(call));
  assert.equal(s1.ever, b.ever + 2);
  assert.equal(s1.valid, b.valid + 2);
  assert.equal(s1.restored, b.restored + 1);
  assert.equal(s1.net, b.net + 3980 - 500);

  const r2 = await call('POST', `/projects/${P}/import/commit`, body);
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  assert.equal(r2.data.inserted, 0);
  assert.equal(r2.data.updated, 6);
  assert.deepEqual(snap(await get(call)), s1, '重複匯入數字不變');

  // 檔案內重複取消會被擋下
  const bad = csv + '\n取消報名,2026-10-04,,,,1,,CX-C1,0922000001,,一\n取消報名,2026-10-05,,,,1,,CX-C2,0922000001,,二';
  const pv = (await call('POST', `/projects/${P}/import/preview`, { kind: 'outcomes', text: bad })).data;
  const errs = pv.rows.filter((r) => r.status === 'error');
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /已是取消狀態/);
});

test('同一天報名、取消、再取消：依登錄順序判斷，重複取消被擋', async () => {
  const { call } = await fresh();
  const X = '0933000222';
  assert.equal((await conv(call, { type: 'enroll', date: '2026-10-14', phone: X })).status, 201);
  assert.equal((await conv(call, { type: 'cancel', date: '2026-10-14', phone: X, note: '同日取消' })).status, 201);
  assert.match((await conv(call, { type: 'cancel', date: '2026-10-14', phone: X, note: '再取消' })).data.error, /已是取消狀態/);
  assert.equal((await conv(call, { type: 'enroll', date: '2026-10-14', phone: X, note: '同日恢復' })).status, 201);
  assert.equal((await conv(call, { type: 'cancel', date: '2026-10-14', phone: X, note: '恢復後又取消' })).status, 201);
});
