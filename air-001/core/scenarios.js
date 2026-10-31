// 模擬資料與測試情境：同一份腳本同時用於「建立展示資料」與「自動化測試報告」。
// 全部為虛構資料（電話使用 555 虛構號段），不含真實客戶個資。
import { fmtUSD } from './money.js';
import { todayLocal, addDays } from './time.js';
import { AppError } from './money.js';

export const DEMO_ACCOUNTS = [
  { username: 'owner', password: 'owner123', display_name: '老闆（示範）', role_code: 'OWNER' },
  { username: 'dispatch', password: 'dispatch123', display_name: '調度員 Amy', role_code: 'DISPATCHER' },
  { username: 'account', password: 'account123', display_name: '會計 Grace', role_code: 'ACCOUNTANT' },
  { username: 'driver1', password: 'driver123', display_name: '司機 王大明', role_code: 'DRIVER', driver_no: 'D001' },
  { username: 'driver4', password: 'driver123', display_name: '司機 Carlos', role_code: 'DRIVER', driver_no: 'D004' },
];

const DRIVERS = [
  { name: '王大明', phone: '626-555-0101', license_no: 'CA-D1234567', payout_method: 'Zelle', vehicle: { plate_no: '8ABC101', make_model: 'Toyota Sienna 2023', vehicle_type: 'VAN', seats: 7, luggage_capacity: 6 } },
  { name: '李志強', phone: '626-555-0102', license_no: 'CA-D2234567', payout_method: 'Zelle', vehicle: { plate_no: '8ABC102', make_model: 'Toyota Camry 2022', vehicle_type: 'SEDAN', seats: 4, luggage_capacity: 3 } },
  { name: '陳美玲', phone: '626-555-0103', license_no: 'CA-D3234567', payout_method: 'Check', vehicle: { plate_no: '8ABC103', make_model: 'Tesla Model Y 2024', vehicle_type: 'SUV', seats: 5, luggage_capacity: 4 } },
  { name: 'Carlos Ramirez', phone: '213-555-0104', license_no: 'CA-D4234567', payout_method: 'Zelle', vehicle: { plate_no: '8ABC104', make_model: 'Chevrolet Suburban 2023', vehicle_type: 'SUV', seats: 7, luggage_capacity: 7 } },
  { name: '張建國', phone: '626-555-0105', license_no: 'CA-D5234567', payout_method: 'Zelle', vehicle: { plate_no: '8ABC105', make_model: 'Mercedes-Benz S580 2024', vehicle_type: 'LUXURY', seats: 4, luggage_capacity: 3 } },
];

const CUSTOMERS = [
  { name: '林雅婷', phone: '626-555-0201', contact_channel: 'LINE', line_id: 'yating.lin', addresses: ['18 Yorba, Irvine, CA'], notes: '常搭華航，偏好中文司機' },
  { name: '黃國華', phone: '909-555-0202', contact_channel: 'PHONE', addresses: ['1200 Diamond Bar Blvd, Diamond Bar, CA'] },
  { name: '吳佩珊', phone: '626-555-0203', contact_channel: 'REPEAT', addresses: ['88 E Main St, Alhambra, CA'], notes: '熟客，需兒童座椅' },
  { name: 'David Chen', phone: '310-555-0204', contact_channel: 'PHONE', email: 'david.chen@example.com', addresses: ['500 Wilshire Blvd, Santa Monica, CA'] },
  { name: '蔡宗翰', phone: '626-555-0205', contact_channel: 'LINE', line_id: 'tsai.th', addresses: ['21 Huntington Dr, Arcadia, CA'] },
  { name: '鄭淑芬', phone: '626-555-0206', contact_channel: 'REFERRAL', addresses: ['150 S Atlantic Blvd, Monterey Park, CA'], notes: '由林雅婷介紹' },
  { name: 'Kevin Liu', phone: '949-555-0207', contact_channel: 'PHONE', addresses: ['3 Park Plaza, Irvine, CA'] },
  { name: '許志明', phone: '626-555-0208', contact_channel: 'WECHAT', addresses: ['1 Fairplex Dr, Pomona, CA'] },
  { name: '周怡君', phone: '626-555-0209', contact_channel: 'LINE', line_id: 'yijun.chou', addresses: ['400 S Baldwin Ave, Arcadia, CA'] },
  { name: '旅行社 Sunrise Travel', phone: '213-555-0210', contact_channel: 'OTHER', addresses: ['800 W 6th St, Los Angeles, CA'], notes: '團體客，月結（待確認規則）' },
];

/** 建立帳號、司機、車輛、客戶 */
export function seedBase(svc) {
  const system = { id: null, display_name: 'system-seed', role_code: 'OWNER' };
  const drv = {};
  for (const d of DRIVERS) {
    const id = svc.createDriver(system, d);
    drv[d.name] = id;
  }
  const driverIds = Object.values(drv);
  const cust = [];
  for (const c of CUSTOMERS) cust.push(svc.createCustomer(system, c).id);
  const users = {};
  for (const a of DEMO_ACCOUNTS) {
    const driver_id = a.driver_no ? driverIds[Number(a.driver_no.slice(1)) - 1] : null;
    const id = svc.createUser(system, { ...a, driver_id });
    users[a.username] = { id, username: a.username, display_name: a.display_name, role_code: a.role_code, driver_id };
  }
  const vehicles = {};
  for (const id of driverIds) vehicles[id] = svc.listDrivers(users.owner).find((x) => x.id === id).vehicles[0].id;
  return { users, drivers: driverIds, vehicles, customers: cust };
}

/** 執行十大情境，回傳逐項檢核結果 */
export function runScenarios(svc, base, { today: todayArg, now } = {}) {
  const today = todayArg || todayLocal(now ? now() : Date.now());
  const { users: U, drivers: D, vehicles: V, customers: C } = base;
  const owner = U.owner, disp = U.dispatch, acct = U.account;
  const results = [];
  const usd = (c) => fmtUSD(c);
  const check = (cs, title, ref, item, expected, actual, fmt = String) => {
    results.push({ case: cs, title, ref, item, expected: fmt(expected), actual: fmt(actual), pass: expected === actual });
  };
  const expectError = (cs, title, ref, item, code, fn) => {
    let actual = '未發生錯誤';
    try { fn(); } catch (e) { actual = e instanceof AppError ? e.code : (/UNIQUE|constraint/i.test(e.message) ? 'DB_CONSTRAINT' : e.message); }
    results.push({ case: cs, title, ref, item, expected: '拒絕：' + code, actual: '拒絕：' + actual, pass: actual === code });
  };
  const day = (n) => addDays(today, n);
  const ADDR = { LAX: 'LAX Terminal B (Tom Bradley)', SNA: 'SNA John Wayne Airport', ONT: 'ONT Terminal 4' };
  // 客戶分配：部分熟客多次下單、部分只下單一次（回購率才有意義）
  const SEQ = [0, 1, 2, 0, 4, 1, 2, 0, 9, 9, 4, 2, 0, 1, 9, 4, 3, 5, 6, 7, 8, 0, 2, 4];
  let ci = 0;
  const mk = (o) => {
    const cid = o.customer_id || C[SEQ[ci++ % SEQ.length]];
    const area = o.area || 'Irvine';
    const trip = o.trip_type || 'ARRIVAL';
    const airport = o.airport || 'LAX';
    const home = o.home || `${100 + ci} Main St, ${area}, CA`;
    return svc.createOrder(disp, {
      customer_id: cid, source: o.source || 'PHONE', trip_type: trip, airport, flight_no: o.flight_no || 'CI' + (6 + ci),
      pickup_local_date: o.date, pickup_local_time: o.time || '10:00', dst_choice: o.dst_choice,
      pickup_address: trip === 'ARRIVAL' ? ADDR[airport] : home, dropoff_address: trip === 'ARRIVAL' ? home : ADDR[airport],
      area, passengers: o.passengers || 2, luggage: o.luggage ?? 2, vehicle_type: o.vehicle_type || 'SEDAN',
      fare_cents: o.fare, tip_cents: o.tip || 0, commission_base_cents: o.base, collector: o.collector || 'COMPANY',
      payment_method: o.method || (o.collector === 'DRIVER' ? 'CASH' : 'ZELLE'), notes: o.notes,
    });
  };
  const driverCtx = (driverId) => Object.values(U).find((u) => u.driver_id === driverId) || owner;
  const dispatchAndAccept = (order, driverId) => {
    svc.assign(disp, order.id, { driver_id: driverId, vehicle_id: V[driverId], force: true });
    const d = svc.dispatchHistory(owner, { order_id: order.id }).find((x) => x.status === 'ASSIGNED');
    svc.acceptDispatch(driverCtx(driverId), d.id);
  };
  const complete = (order, driverId, opts = {}) => {
    dispatchAndAccept(order, driverId);
    return svc.completeOrder(driverCtx(driverId), order.id, opts);
  };
  const fin = (id) => svc.orderFinance(id);
  const ord = (id) => svc.getOrder(owner, id);

  // ===== 情境 1：公司收款，無小費 =====
  {
    const T = '公司收款，無小費';
    const o1 = mk({ date: day(-5), time: '09:30', fare: 8500, area: 'Irvine', notes: '情境1-基本' });
    complete(o1, D[1]);
    svc.recordCustomerPayment(acct, o1.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 8500, status: 'CONFIRMED', reference: 'ZL-1001' });
    let f = fin(o1.id);
    check(1, T, o1.order_no, '平台佣金 15%', 1275, f.commission, usd);
    check(1, T, o1.order_no, '公司應付司機（85%）', 7225, f.driver_balance, usd);
    check(1, T, o1.order_no, '客戶未付餘額', 0, f.customer_due, usd);
    check(1, T, o1.order_no, '收款狀態', 'PAID', ord(o1.id).payment_status);

    const o2 = mk({ date: day(-4), time: '14:10', fare: 9999, area: 'Arcadia', notes: '情境1-四捨五入 $14.9985' });
    complete(o2, D[1]);
    svc.recordCustomerPayment(acct, o2.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 9999, status: 'CONFIRMED' });
    f = fin(o2.id);
    check(1, T, o2.order_no, '佣金四捨五入 $99.99×15%=$14.9985→$15.00', 1500, f.commission, usd);
    check(1, T, o2.order_no, '司機分成＝車資−佣金', 8499, f.driver_balance, usd);

    const o3 = mk({ date: day(-3), time: '07:45', fare: 13000, base: 12000, area: 'Santa Monica', notes: '情境1-含 $10 代墊停車費，不抽佣' });
    complete(o3, D[1]);
    svc.recordCustomerPayment(acct, o3.id, { party: 'COMPANY', method: 'CARD', amount_cents: 13000, status: 'CONFIRMED' });
    f = fin(o3.id);
    check(1, T, o3.order_no, '以訂單確認佣金基礎 $120 計算佣金', 1800, f.commission, usd);
    check(1, T, o3.order_no, '公司應付司機＝$130−$18', 11200, f.driver_balance, usd);
  }

  // ===== 情境 2：公司收款，含小費 =====
  {
    const T = '公司收款，含小費';
    const o4 = mk({ date: day(-5), time: '16:20', fare: 12000, tip: 2000, method: 'CARD', area: 'Diamond Bar' });
    complete(o4, D[2]);
    svc.recordCustomerPayment(acct, o4.id, { party: 'COMPANY', method: 'CARD', amount_cents: 14000, status: 'CONFIRMED' });
    let f = fin(o4.id);
    check(2, T, o4.order_no, '佣金只算車資（小費不抽佣）', 1800, f.commission, usd);
    check(2, T, o4.order_no, '公司應付司機＝85%車資＋代收小費', 12200, f.driver_balance, usd);
    check(2, T, o4.order_no, '已收款', 14000, f.paid_net, usd);

    const o5 = mk({ date: day(-2), time: '05:30', fare: 6550, tip: 1000, area: 'Alhambra', trip_type: 'DEPARTURE' });
    complete(o5, D[2]);
    svc.recordCustomerPayment(acct, o5.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 7550, status: 'CONFIRMED' });
    f = fin(o5.id);
    check(2, T, o5.order_no, '佣金 $65.50×15%=$9.825→$9.83（半位進位）', 983, f.commission, usd);
    check(2, T, o5.order_no, '公司應付司機＝$65.50−$9.83＋$10', 6567, f.driver_balance, usd);
  }

  // ===== 情境 3：司機收款，無小費 =====
  {
    const T = '司機收款，無小費';
    const o6 = mk({ date: day(-4), time: '11:00', fare: 9500, collector: 'DRIVER', area: 'Pasadena' });
    complete(o6, D[0], { driver_collected_cents: 9500, method: 'CASH' });
    let f = fin(o6.id);
    check(3, T, o6.order_no, '司機應繳公司＝車資 15%', -1425, f.driver_balance, usd);
    check(3, T, o6.order_no, '客戶未付餘額', 0, f.customer_due, usd);
    check(3, T, o6.order_no, '由司機收取金額', 9500, f.paid_driver, usd);

    const o7 = mk({ date: day(-1), time: '13:15', fare: 7050, collector: 'DRIVER', area: 'Monterey Park' });
    complete(o7, D[0], { driver_collected_cents: 7050, method: 'CASH' });
    f = fin(o7.id);
    check(3, T, o7.order_no, '司機應繳 $70.50×15%=$10.575→$10.58', -1058, f.driver_balance, usd);
  }

  // ===== 情境 4：司機收款，含小費 =====
  {
    const T = '司機收款，含小費';
    const o8 = mk({ date: day(-3), time: '18:40', fare: 15000, tip: 3000, collector: 'DRIVER', vehicle_type: 'VAN', passengers: 5, area: 'Irvine' });
    complete(o8, D[0], { driver_collected_cents: 18000, method: 'CASH' });
    let f = fin(o8.id);
    check(4, T, o8.order_no, '司機應繳公司＝車資 15%（小費不抽）', -2250, f.driver_balance, usd);
    check(4, T, o8.order_no, '司機實得＝$180−$22.50', 15750, f.paid_driver + f.driver_balance, usd);

    const o9 = mk({ date: day(-2), time: '20:05', fare: 8800, tip: 1200, collector: 'DRIVER', method: 'VENMO', area: 'Rowland Heights' });
    complete(o9, D[0], { driver_collected_cents: 10000, method: 'VENMO' });
    f = fin(o9.id);
    check(4, T, o9.order_no, '司機應繳公司 $88×15%', -1320, f.driver_balance, usd);
  }

  // ===== 情境 5：客戶部分付款 =====
  {
    const T = '客戶部分付款';
    const o10 = mk({ date: day(-1), time: '08:00', fare: 20000, vehicle_type: 'LUXURY', area: 'Beverly Hills', notes: '情境5-分兩次付款' });
    complete(o10, D[4]);
    svc.recordCustomerPayment(acct, o10.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 8000, status: 'CONFIRMED', reference: 'ZL-2001' });
    const pid = svc.recordCustomerPayment(disp, o10.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 12000, status: 'CONFIRMED', reference: 'ZL-2002 客戶稱已轉帳' });
    let f = fin(o10.id);
    check(5, T, o10.order_no, '調度員登錄的 Zelle 款自動列為「待確認」', 12000, f.pending_payments, usd);
    check(5, T, o10.order_no, '待確認款不計入已收', 8000, f.paid_net, usd);
    check(5, T, o10.order_no, '客戶未付餘額', 12000, f.customer_due, usd);
    check(5, T, o10.order_no, '收款狀態', 'PARTIAL', ord(o10.id).payment_status);
    check(5, T, o10.order_no, '公司應付司機（服務完成即認列）', 17000, f.driver_balance, usd);

    const o11 = mk({ date: day(0), time: '06:30', fare: 6000, area: 'Torrance', trip_type: 'DEPARTURE', notes: '情境5-訂金＋尾款' });
    svc.recordCustomerPayment(acct, o11.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 2000, status: 'CONFIRMED', reference: '訂金' });
    check(5, T, o11.order_no, '完成前預收訂金：收款狀態', 'PARTIAL', ord(o11.id).payment_status);
    complete(o11, D[4]);
    f = fin(o11.id);
    check(5, T, o11.order_no, '完成後客戶未付＝$60−$20 訂金', 4000, f.customer_due, usd);
    const p2 = svc.recordCustomerPayment(disp, o11.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 4000, reference: '尾款' });
    svc.confirmPayment(acct, p2);
    check(5, T, o11.order_no, '會計確認尾款後收款狀態', 'PAID', ord(o11.id).payment_status);
    void pid;
  }

  // ===== 情境 6：司機部分繳款 =====
  {
    const T = '司機部分繳款';
    const o12 = mk({ date: day(-2), time: '10:30', fare: 18000, collector: 'DRIVER', area: 'Pomona', airport: 'ONT' });
    complete(o12, D[2], { driver_collected_cents: 18000, method: 'CASH' });
    const st = svc.createSettlement(acct, { driver_id: D[2], date_from: day(-2), date_to: day(-2), order_ids: [o12.id] });
    check(6, T, st.settlement_no, '結算單：司機應繳', 2700, st.receivable_cents, usd);
    const st2 = svc.settlementPayment(acct, st.id, { direction: 'REMIT', amount_cents: 2000, method: 'CASH', confirm: true, reference: '現金先繳 $20' });
    check(6, T, st.settlement_no, '部分繳款後結算單狀態', 'PARTIAL', st2.status);
    check(6, T, o12.order_no, '剩餘司機應繳', -700, fin(o12.id).driver_balance, usd);
    expectError(6, T, st.settlement_no, '繳款超過未結餘額需拒絕', 'OVERPAYMENT',
      () => svc.settlementPayment(acct, st.id, { direction: 'REMIT', amount_cents: 701, method: 'CASH', confirm: true }));
  }

  // ===== 情境 7：訂單取消與退款 =====
  {
    const T = '訂單取消與退款';
    const o13 = mk({ date: day(1), time: '15:00', fare: 9000, area: 'Arcadia', notes: '情境7-預付訂金後取消' });
    svc.recordCustomerPayment(acct, o13.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 4500, status: 'CONFIRMED', reference: '訂金' });
    const c = svc.cancelOrder(disp, o13.id, { reason: '客戶行程取消' });
    check(7, T, o13.order_no, '取消後系統提示應退金額', 4500, c.needs_refund_cents, usd);
    expectError(7, T, o13.order_no, '退款不可超過已收金額', 'REFUND_EXCEEDS',
      () => svc.refund(acct, o13.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 9000, reason: '測試超額' }));
    svc.refund(acct, o13.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 4500, reason: '取消全額退訂金' });
    let f = fin(o13.id);
    check(7, T, o13.order_no, '退款後淨收款', 0, f.paid_net, usd);
    check(7, T, o13.order_no, '取消訂單佣金', 0, f.commission, usd);
    check(7, T, o13.order_no, '收款狀態', 'REFUNDED', ord(o13.id).payment_status);

    const o14 = mk({ date: day(-6), time: '12:00', fare: 10000, area: 'Irvine', notes: '情境7-完成後客訴部分退款' });
    complete(o14, D[1]);
    svc.recordCustomerPayment(acct, o14.id, { party: 'COMPANY', method: 'CARD', amount_cents: 10000, status: 'CONFIRMED' });
    svc.refund(acct, o14.id, { party: 'COMPANY', method: 'CARD', amount_cents: 2000, reduce_fare: true, reason: '接機延誤 40 分鐘，退 $20' });
    f = fin(o14.id);
    check(7, T, o14.order_no, '沖減後車資', 8000, f.fare_posted, usd);
    check(7, T, o14.order_no, '佣金依新基礎重算 $80×15%', 1200, f.commission, usd);
    check(7, T, o14.order_no, '公司應付司機', 6800, f.driver_balance, usd);
    check(7, T, o14.order_no, '收款狀態', 'PAID', ord(o14.id).payment_status);
  }

  // ===== 情境 8：司機拒單及重新派車 =====
  {
    const T = '司機拒單及重新派車';
    const o15 = mk({ date: day(-1), time: '22:30', fare: 11000, area: 'Arcadia', vehicle_type: 'SUV', notes: '情境8' });
    svc.assign(disp, o15.id, { driver_id: D[2], vehicle_id: V[D[2]], force: true });
    const d1 = svc.dispatchHistory(owner, { order_id: o15.id })[0];
    svc.rejectDispatch(owner, d1.id, { reason: '車輛臨時維修' });
    check(8, T, o15.order_no, '拒單後訂單回到待派車', 'PENDING_DISPATCH', ord(o15.id).status);
    svc.assign(disp, o15.id, { driver_id: D[3], vehicle_id: V[D[3]], force: true });
    expectError(8, T, o15.order_no, '同一訂單重複指派需拒絕', 'INVALID_STATE',
      () => svc.assign(disp, o15.id, { driver_id: D[4], force: true }));
    expectError(8, T, o15.order_no, '繞過程式直接寫入第二筆有效派車，資料庫唯一索引仍需阻擋', 'DB_CONSTRAINT',
      () => svc._rawInsertDispatch(o15.id, D[4]));
    svc.acceptDispatch(driverCtx(D[3]), svc.dispatchHistory(owner, { order_id: o15.id }).find((x) => x.status === 'ASSIGNED').id);
    svc.reassign(disp, o15.id, { driver_id: D[4], vehicle_id: V[D[4]], reason: 'Carlos 前一趟延誤', force: true });
    svc.acceptDispatch(owner, svc.dispatchHistory(owner, { order_id: o15.id }).find((x) => x.status === 'ASSIGNED').id);
    svc.completeOrder(owner, o15.id, {});
    svc.recordCustomerPayment(acct, o15.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 11000, status: 'CONFIRMED' });
    const hist = svc.dispatchHistory(owner, { order_id: o15.id }).reverse();
    check(8, T, o15.order_no, '派單歷史（依序）', 'REJECTED→CANCELLED→COMPLETED', hist.map((h) => h.status).join('→'));
    check(8, T, o15.order_no, '有效派車筆數', 1, hist.filter((h) => ['ASSIGNED', 'ACCEPTED', 'COMPLETED'].includes(h.status)).length);
    const o = ord(o15.id);
    check(8, T, o15.order_no, '最終司機', '張建國', o.driver_name);
    check(8, T, o15.order_no, '帳本只認列最終司機', 'D005', [...new Set(o.ledger.filter((l) => l.driver_id).map((l) => 'D00' + (D.indexOf(l.driver_id) + 1)))].join(','));
    check(8, T, o15.order_no, '公司應付最終司機', 9350, fin(o15.id).driver_balance, usd);
  }

  // ===== 情境 9：同一司機多筆訂單週結 =====
  {
    const T = '同一司機多筆訂單週結';
    const drv = D[3]; // Carlos
    const o16 = mk({ date: day(-6), time: '09:00', fare: 9000, area: 'Irvine', airport: 'SNA' });
    const o17 = mk({ date: day(-5), time: '19:30', fare: 7000, tip: 1000, area: 'Long Beach' });
    const o18 = mk({ date: day(-3), time: '06:15', fare: 12000, collector: 'DRIVER', area: 'Pasadena', trip_type: 'DEPARTURE' });
    const o19 = mk({ date: day(-1), time: '17:45', fare: 8000, tip: 500, collector: 'DRIVER', area: 'Arcadia' });
    complete(o16, drv); svc.recordCustomerPayment(acct, o16.id, { party: 'COMPANY', method: 'ZELLE', amount_cents: 9000, status: 'CONFIRMED' });
    complete(o17, drv); svc.recordCustomerPayment(acct, o17.id, { party: 'COMPANY', method: 'CARD', amount_cents: 8000, status: 'CONFIRMED' });
    complete(o18, drv, { driver_collected_cents: 12000, method: 'CASH' });
    complete(o19, drv, { driver_collected_cents: 8500, method: 'CASH' });
    const ids = [o16.id, o17.id, o18.id, o19.id];
    const range = { date_from: day(-6), date_to: day(0) };
    const items = svc.openItems(acct, { driver_id: drv, ...range }).filter((i) => ids.includes(i.order_id));
    check(9, T, 'Carlos 週結', '本週公司應付司機（毛額）', 14600, items.filter((i) => i.direction === 'PAYABLE').reduce((s, i) => s + i.amount_cents, 0), usd);
    check(9, T, 'Carlos 週結', '本週司機應繳公司（毛額）', 3000, items.filter((i) => i.direction === 'RECEIVABLE').reduce((s, i) => s + i.amount_cents, 0), usd);
    expectError(9, T, 'Carlos 週結', '會計無權授權淨額抵銷', 'FORBIDDEN',
      () => svc.createSettlement(acct, { driver_id: drv, ...range, order_ids: ids, offset: { enabled: true, authorize: true, note: 'x' } }));
    expectError(9, T, 'Carlos 週結', '老闆未勾選授權不得抵銷', 'OFFSET_NOT_AUTHORIZED',
      () => svc.createSettlement(owner, { driver_id: drv, ...range, order_ids: ids, offset: { enabled: true, authorize: false, note: 'x' } }));
    const plain = svc.createSettlement(acct, { driver_id: drv, ...range, order_ids: ids });
    check(9, T, plain.settlement_no, '未授權時不自動抵銷', 0, plain.offset_cents, usd);
    expectError(9, T, plain.settlement_no, '同一訂單不可同時在兩張未結清結算單', 'DUPLICATE_SETTLEMENT_ITEM',
      () => svc.createSettlement(acct, { driver_id: drv, ...range, order_ids: [o16.id] }));
    svc.voidSettlement(acct, plain.id, { reason: '改由老闆授權抵銷後重開' });
    const net = svc.createSettlement(owner, { driver_id: drv, ...range, order_ids: ids, offset: { enabled: true, authorize: true, note: '司機 Carlos 書面同意 10/31 週結互抵' } });
    check(9, T, net.settlement_no, '經授權抵銷金額', 3000, net.offset_cents, usd);
    const done = svc.settlementPayment(acct, net.id, { direction: 'PAYOUT', amount_cents: 11600, method: 'ZELLE', confirm: true, reference: 'ZL-PAY-9001' });
    check(9, T, net.settlement_no, '淨額付款 $146−$30 後狀態', 'SETTLED', done.status);
    check(9, T, net.settlement_no, '週結後四筆訂單司機餘額', 0, ids.reduce((s, id) => s + fin(id).driver_balance, 0), usd);
  }

  // ===== 情境 10：洛杉磯夏令時間切換 =====
  {
    const T = '洛杉磯夏令時間切換';
    const o20 = mk({ date: '2026-11-01', time: '01:30', fare: 9500, area: 'Irvine', flight_no: 'BR12', notes: '情境10-秋季撥慢重疊時段（較早 PDT）' });
    check(10, T, o20.order_no, '2026-11-01 01:30（第一次，PDT）→ UTC', '2026-11-01T08:30:00.000Z', o20.pickup_at_utc);
    check(10, T, o20.order_no, '重疊時段標記待確認', 1, o20.dst_ambiguous);
    const o21 = mk({ date: '2026-11-01', time: '01:30', dst_choice: 'later', fare: 9500, area: 'Irvine', flight_no: 'CX880', notes: '情境10-秋季撥慢重疊時段（較晚 PST）' });
    check(10, T, o21.order_no, '2026-11-01 01:30（第二次，PST）→ UTC', '2026-11-01T09:30:00.000Z', o21.pickup_at_utc);
    const o22 = mk({ date: '2026-11-01', time: '10:00', fare: 8000, area: 'Arcadia', notes: '情境10-切換後 PST' });
    check(10, T, o22.order_no, '2026-11-01 10:00 PST → UTC', '2026-11-01T18:00:00.000Z', o22.pickup_at_utc);
    check(10, T, o22.order_no, '01:30 PDT 至 10:00 PST 實際間隔 9.5 小時', 9.5, (Date.parse(o22.pickup_at_utc) - Date.parse(o20.pickup_at_utc)) / 36e5);
    expectError(10, T, '—', '2027-03-14 02:30 不存在（春季撥快）需拒絕', 'DST_NONEXISTENT_TIME',
      () => mk({ date: '2027-03-14', time: '02:30', fare: 9000 }));
    const o23 = mk({ date: '2027-03-14', time: '03:30', fare: 9000, area: 'Pasadena', notes: '情境10-春季撥快後 PDT' });
    check(10, T, o23.order_no, '2027-03-14 03:30 PDT → UTC', '2027-03-14T10:30:00.000Z', o23.pickup_at_utc);
    const o24 = mk({ date: '2026-10-31', time: '23:30', fare: 8500, area: 'Torrance', notes: '情境10-UTC 已跨日' });
    check(10, T, o24.order_no, '10/31 23:30 PDT 的 UTC 已是 11/01', '2026-11-01T06:30:00.000Z', o24.pickup_at_utc);
    const nov1 = svc.listOrders(owner, { date_from: '2026-11-01', date_to: '2026-11-01' }).map((o) => o.order_no);
    check(10, T, '11/01 報表', '依洛杉磯當地日期分組：11/01 含 3 筆、不含 10/31 23:30', 'true',
      String(nov1.includes(o20.order_no) && nov1.includes(o21.order_no) && nov1.includes(o22.order_no) && !nov1.includes(o24.order_no)));
  }

  return results;
}

/** 展示用額外資料：待派車、待確認、明日接送、熟客回購 */
export function seedExtras(svc, base, { today: todayArg, now } = {}) {
  const today = todayArg || todayLocal(now ? now() : Date.now());
  const { users: U, drivers: D, vehicles: V, customers: C } = base;
  const disp = U.dispatch;
  const mk = (o) => svc.createOrder(disp, {
    source: 'LINE', trip_type: 'ARRIVAL', airport: 'LAX', passengers: 2, luggage: 2, vehicle_type: 'SEDAN', collector: 'COMPANY',
    payment_method: 'ZELLE', pickup_address: 'LAX Terminal B (Tom Bradley)', ...o });
  const a = mk({ customer_id: C[0], pickup_local_date: addDays(today, 1), pickup_local_time: '06:40', flight_no: 'BR16', dropoff_address: '18 Yorba, Irvine, CA', area: 'Irvine', fare_cents: 9500, notes: '待派車示範' });
  mk({ customer_id: C[2], pickup_local_date: addDays(today, 1), pickup_local_time: '21:15', flight_no: 'CI8', dropoff_address: '88 E Main St, Alhambra, CA', area: 'Alhambra', fare_cents: 7500, passengers: 4, luggage: 5, vehicle_type: 'VAN', notes: '需兒童座椅' });
  mk({ customer_id: C[6], trip_type: 'DEPARTURE', airport: 'SNA', pickup_local_date: addDays(today, 2), pickup_local_time: '05:00', pickup_address: '3 Park Plaza, Irvine, CA', dropoff_address: 'SNA John Wayne Airport', area: 'Irvine', fare_cents: 6500, collector: 'DRIVER', payment_method: 'CASH' });
  const b = mk({ customer_id: C[4], pickup_local_date: addDays(today, 2), pickup_local_time: '13:20', flight_no: 'JL62', dropoff_address: '21 Huntington Dr, Arcadia, CA', area: 'Arcadia', fare_cents: 8500 });
  svc.assign(disp, b.id, { driver_id: D[0], vehicle_id: V[D[0]], force: true });
  const c = mk({ customer_id: C[0], trip_type: 'DEPARTURE', pickup_local_date: addDays(today, 3), pickup_local_time: '22:00', pickup_address: '18 Yorba, Irvine, CA', dropoff_address: 'LAX Terminal B (Tom Bradley)', area: 'Irvine', fare_cents: 9500, tip_cents: 1000 });
  svc.assign(disp, c.id, { driver_id: D[1], vehicle_id: V[D[1]], force: true });
  const cd = svc.dispatchHistory(U.owner, { order_id: c.id })[0];
  svc.acceptDispatch(U.owner, cd.id);
  void a;
}

/** 全系統不變量檢核 */
export function invariantChecks(svc, base) {
  const owner = base.users.owner;
  const results = [];
  const rec = svc.reconcile();
  results.push({ case: '全域', title: '帳務一致性', ref: '全系統', item: '對帳恆等式：公司現金−應付司機淨額＝佣金−客戶未付−調整', expected: fmtUSD(rec.rhs), actual: fmtUSD(rec.lhs), pass: rec.balanced });
  const orders = svc.listOrders(owner, {});
  const bad = orders.filter((o) => o.status === 'COMPLETED' && o.finance.commission !== Math.sign(o.finance.commission_base_posted) * Math.floor((Math.abs(o.finance.commission_base_posted) * o.commission_rate_bps + 5000) / 10000));
  results.push({ case: '全域', title: '帳務一致性', ref: `${orders.length} 筆訂單`, item: '每筆已完成訂單佣金＝round(入帳基礎×15%)', expected: '0 筆不符', actual: `${bad.length} 筆不符`, pass: bad.length === 0 });
  const dup = svc._countDuplicateActiveDispatch();
  results.push({ case: '全域', title: '派車完整性', ref: '全系統', item: '同一訂單有效派車 > 1 的筆數', expected: '0', actual: String(dup), pass: dup === 0 });
  return results;
}
