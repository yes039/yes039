// AIR-001 業務核心：伺服器（node:sqlite）與瀏覽器展示模式（sql.js）共用同一份程式。
// db 介面：run(sql, params) → {changes, id}; get(sql, params); all(sql, params); exec(sql); tx(fn)
// env 介面：now() → ms；hashPassword(pw)；verifyPassword(pw, hash)；randomToken()
import { SCHEMA, SCHEMA_VERSION, ROLES } from './schema.js';
import { AppError, assertCents, splitCommission, applyBps, DEFAULT_COMMISSION_BPS } from './money.js';
import { localToUtc, utcToLocal, todayLocal, addDays, weekRange, monthRange } from './time.js';

const CHARGE_TYPES = ['FARE', 'TIP', 'EXTRA', 'FARE_ADJUST'];
const ACTIVE_DISPATCH = ['ASSIGNED', 'ACCEPTED', 'COMPLETED'];
const ENUMS = {
  channel: ['PHONE', 'LINE', 'WECHAT', 'REFERRAL', 'REPEAT', 'OTHER'],
  source: ['PHONE', 'LINE', 'REPEAT', 'REFERRAL', 'OTHER'],
  trip: ['ARRIVAL', 'DEPARTURE', 'OTHER'],
  airport: ['LAX', 'SNA', 'ONT', 'BUR', 'LGB'],
  vehicle: ['SEDAN', 'SUV', 'VAN', 'LUXURY'],
  collector: ['COMPANY', 'DRIVER'],
  method: ['CASH', 'ZELLE', 'VENMO', 'CARD', 'CHECK', 'OTHER'],
};

export function hasPerm(user, perm) {
  if (!user) return false;
  const perms = ROLES[user.role_code]?.perms || [];
  return perms.includes('*') || perms.includes(perm);
}

export function createService(db, env) {
  const now = () => new Date(env.now()).toISOString();
  const get = (sql, ...p) => db.get(sql, p);
  const all = (sql, ...p) => db.all(sql, p);
  const run = (sql, ...p) => db.run(sql, p);

  // ---------- 基礎 ----------
  function need(ctx, perm) {
    if (!hasPerm(ctx, perm)) throw new AppError('權限不足：' + perm, 'FORBIDDEN', 403);
  }
  function isDriver(ctx) { return ctx?.role_code === 'DRIVER'; }
  function req(v, name) {
    if (v === undefined || v === null || String(v).trim() === '') throw new AppError(`${name}為必填`, 'VALIDATION');
    return typeof v === 'string' ? v.trim() : v;
  }
  function oneOf(v, list, name) {
    if (!list.includes(v)) throw new AppError(`${name}不在允許值內：${v}`, 'VALIDATION');
    return v;
  }
  function int(v, name, min = 0) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min) throw new AppError(`${name}必須是 ≥ ${min} 的整數`, 'VALIDATION');
    return n;
  }
  function cents(v, name, { allowNeg = false, allowZero = true } = {}) {
    const n = Number(v);
    assertCents(n, name);
    if (!allowNeg && n < 0) throw new AppError(`${name}不可為負數`, 'VALIDATION');
    if (!allowZero && n === 0) throw new AppError(`${name}不可為 0`, 'VALIDATION');
    return n;
  }
  function audit(ctx, action, entityType, entityId, summary, before = null, after = null, reason = null) {
    run(`INSERT INTO audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json, reason, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ctx?.id ?? null, ctx?.display_name ?? 'system', action, entityType, entityId ?? null, summary ?? null,
    before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, reason, now());
  }
  function nextNo(table, col, prefix, width = 3) {
    const row = get(`SELECT ${col} AS no FROM ${table} WHERE ${col} LIKE ? ORDER BY ${col} DESC LIMIT 1`, prefix + '%');
    const n = row ? parseInt(row.no.slice(prefix.length), 10) + 1 : 1;
    return prefix + String(n).padStart(width, '0');
  }
  const ymd = (d) => d.replace(/-/g, '').slice(2);
  const normPhone = (p) => (p || '').replace(/\D/g, '') || null;

  // ---------- 初始化 ----------
  function init() {
    db.exec(SCHEMA);
    for (const [code, r] of Object.entries(ROLES)) {
      run(`INSERT INTO roles (code, name_zh, name_en, permissions) VALUES (?,?,?,?)
           ON CONFLICT(code) DO UPDATE SET permissions=excluded.permissions`, code, r.zh, r.en, JSON.stringify(r.perms));
    }
    run(`INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', ?)`, String(SCHEMA_VERSION));
  }
  function isEmpty() { return !get('SELECT 1 AS x FROM users LIMIT 1'); }

  // ---------- 使用者與登入 ----------
  function createUser(ctx, { username, display_name, role_code, password, driver_id = null }) {
    oneOf(role_code, Object.keys(ROLES), '角色');
    if (role_code === 'DRIVER' && !driver_id) throw new AppError('司機帳號必須綁定司機資料', 'VALIDATION');
    const r = run(`INSERT INTO users (username, display_name, role_code, driver_id, password_hash, created_at) VALUES (?,?,?,?,?,?)`,
      req(username, '帳號'), req(display_name, '名稱'), role_code, driver_id, env.hashPassword(req(password, '密碼')), now());
    audit(ctx, 'user.create', 'user', r.id, `建立帳號 ${username}（${role_code}）`);
    return r.id;
  }
  function login({ username, password }) {
    const u = get('SELECT * FROM users WHERE username = ? AND is_active = 1', username || '');
    if (!u || !env.verifyPassword(password || '', u.password_hash)) {
      audit(null, 'auth.login_failed', 'user', u?.id, `登入失敗：${username}`);
      throw new AppError('帳號或密碼錯誤', 'AUTH_FAILED', 401);
    }
    const token = env.randomToken();
    run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, u.id, now(),
      new Date(env.now() + 12 * 3600e3).toISOString());
    audit(publicUser(u), 'auth.login', 'user', u.id, `${u.display_name} 登入`);
    return { token, user: publicUser(u) };
  }
  function publicUser(u) {
    return { id: u.id, username: u.username, display_name: u.display_name, role_code: u.role_code, driver_id: u.driver_id,
      role_name: ROLES[u.role_code]?.zh, permissions: ROLES[u.role_code]?.perms };
  }
  function userByToken(token) {
    if (!token) return null;
    const u = get(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1`, token, now());
    return u ? publicUser(u) : null;
  }
  function logout(token) { run('DELETE FROM sessions WHERE token = ?', token); }

  // ---------- 客戶 CRM ----------
  function customerTotals(id) {
    return get(`SELECT
        (SELECT COUNT(*) FROM orders WHERE customer_id = ? AND status <> 'CANCELLED') AS order_count,
        (SELECT COALESCE(SUM(l.amount_cents),0) FROM order_ledger l JOIN orders o ON o.id = l.order_id
           WHERE o.customer_id = ? AND l.entry_type IN ('FARE','FARE_ADJUST','EXTRA')) AS total_fare_cents,
        (SELECT MAX(pickup_local_date) FROM orders WHERE customer_id = ? AND status <> 'CANCELLED') AS last_order_date`, id, id, id);
  }
  function listCustomers(ctx, { q = '' } = {}) {
    need(ctx, 'customer.read');
    const like = `%${q.trim()}%`;
    const digits = normPhone(q);
    const rows = all(`SELECT * FROM customers WHERE is_active = 1 AND (name LIKE ? OR customer_no LIKE ? OR COALESCE(line_id,'') LIKE ?
                      OR COALESCE(email,'') LIKE ? ${digits ? 'OR phone_normalized LIKE ?' : ''}) ORDER BY customer_no`,
    ...[like, like, like, like, ...(digits ? [`%${digits}%`] : [])]);
    return rows.map((c) => ({ ...c, addresses: JSON.parse(c.addresses), ...customerTotals(c.id) }));
  }
  function getCustomer(ctx, id) {
    need(ctx, 'customer.read');
    const c = get('SELECT * FROM customers WHERE id = ?', id);
    if (!c) throw new AppError('找不到客戶', 'NOT_FOUND', 404);
    const orders = all(`SELECT id, order_no, pickup_local_date, pickup_local_time, trip_type, airport, area, fare_cents, tip_cents, status
                        FROM orders WHERE customer_id = ? ORDER BY pickup_at_utc DESC`, id);
    return { ...c, addresses: JSON.parse(c.addresses), ...customerTotals(id), orders };
  }
  function customerInput(d) {
    const addresses = Array.isArray(d.addresses) ? d.addresses : String(d.addresses || '').split('\n');
    return {
      name: req(d.name, '客戶姓名'),
      phone: d.phone?.trim() || null,
      contact_channel: oneOf(d.contact_channel || 'PHONE', ENUMS.channel, '聯絡管道'),
      line_id: d.line_id?.trim() || null,
      email: d.email?.trim() || null,
      addresses: JSON.stringify(addresses.map((a) => a.trim()).filter(Boolean)),
      notes: d.notes?.trim() || null,
    };
  }
  function assertPhoneFree(phone, exceptId = 0) {
    const n = normPhone(phone);
    if (!n) return;
    const dup = get('SELECT customer_no, name FROM customers WHERE phone_normalized = ? AND id <> ?', n, exceptId);
    if (dup) throw new AppError(`電話已存在：${dup.customer_no} ${dup.name}`, 'DUPLICATE_PHONE', 409);
  }
  function createCustomer(ctx, d) {
    need(ctx, 'customer.write');
    const c = customerInput(d);
    assertPhoneFree(c.phone);
    const no = nextNo('customers', 'customer_no', 'C', 4);
    const r = run(`INSERT INTO customers (customer_no, name, phone, phone_normalized, contact_channel, line_id, email, addresses, notes, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`, no, c.name, c.phone, normPhone(c.phone), c.contact_channel, c.line_id, c.email, c.addresses, c.notes, now(), now());
    audit(ctx, 'customer.create', 'customer', r.id, `新增客戶 ${no} ${c.name}`, null, c);
    return getCustomer(ctx, r.id);
  }
  function updateCustomer(ctx, id, d) {
    need(ctx, 'customer.write');
    const before = get('SELECT * FROM customers WHERE id = ?', id);
    if (!before) throw new AppError('找不到客戶', 'NOT_FOUND', 404);
    const c = customerInput(d);
    assertPhoneFree(c.phone, id);
    run(`UPDATE customers SET name=?, phone=?, phone_normalized=?, contact_channel=?, line_id=?, email=?, addresses=?, notes=?, updated_at=? WHERE id=?`,
      c.name, c.phone, normPhone(c.phone), c.contact_channel, c.line_id, c.email, c.addresses, c.notes, now(), id);
    audit(ctx, 'customer.update', 'customer', id, `修改客戶 ${before.customer_no}`, before, c);
    return getCustomer(ctx, id);
  }

  // ---------- 司機與車輛 ----------
  function listDrivers(ctx, { includeInactive = false } = {}) {
    if (!hasPerm(ctx, 'driver.read') && !hasPerm(ctx, 'dispatch.manage')) need(ctx, 'driver.read');
    const rows = all(`SELECT * FROM drivers ${includeInactive ? '' : "WHERE status = 'ACTIVE'"} ORDER BY driver_no`);
    return rows.map((d) => ({
      ...d,
      vehicles: all('SELECT * FROM vehicles WHERE driver_id = ? AND is_active = 1', d.id),
      ...get(`SELECT COUNT(*) AS active_jobs FROM dispatches WHERE driver_id = ? AND status IN ('ASSIGNED','ACCEPTED')`, d.id),
      ...driverBalance(d.id),
    }));
  }
  function driverInput(d) {
    return { name: req(d.name, '司機姓名'), phone: req(d.phone, '司機電話'), license_no: d.license_no?.trim() || null,
      status: oneOf(d.status || 'ACTIVE', ['ACTIVE', 'INACTIVE'], '狀態'), payout_method: d.payout_method?.trim() || null, notes: d.notes?.trim() || null };
  }
  function createDriver(ctx, d) {
    need(ctx, 'dispatch.manage');
    const x = driverInput(d);
    const no = nextNo('drivers', 'driver_no', 'D', 3);
    const r = run(`INSERT INTO drivers (driver_no, name, phone, license_no, status, payout_method, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      no, x.name, x.phone, x.license_no, x.status, x.payout_method, x.notes, now(), now());
    audit(ctx, 'driver.create', 'driver', r.id, `新增司機 ${no} ${x.name}`, null, x);
    if (d.vehicle?.plate_no) createVehicle(ctx, { ...d.vehicle, driver_id: r.id });
    return r.id;
  }
  function updateDriver(ctx, id, d) {
    need(ctx, 'dispatch.manage');
    const before = get('SELECT * FROM drivers WHERE id = ?', id);
    if (!before) throw new AppError('找不到司機', 'NOT_FOUND', 404);
    const x = driverInput(d);
    run('UPDATE drivers SET name=?, phone=?, license_no=?, status=?, payout_method=?, notes=?, updated_at=? WHERE id=?',
      x.name, x.phone, x.license_no, x.status, x.payout_method, x.notes, now(), id);
    audit(ctx, 'driver.update', 'driver', id, `修改司機 ${before.driver_no}`, before, x);
  }
  function createVehicle(ctx, d) {
    need(ctx, 'dispatch.manage');
    const r = run(`INSERT INTO vehicles (driver_id, plate_no, make_model, vehicle_type, seats, luggage_capacity, created_at) VALUES (?,?,?,?,?,?,?)`,
      d.driver_id || null, req(d.plate_no, '車牌').toUpperCase(), req(d.make_model, '車款'), oneOf(d.vehicle_type, ENUMS.vehicle, '車型'),
      int(d.seats, '座位數', 1), int(d.luggage_capacity || 0, '行李容量'), now());
    audit(ctx, 'vehicle.create', 'vehicle', r.id, `新增車輛 ${d.plate_no}`);
    return r.id;
  }

  // ---------- 訂單 ----------
  function orderInput(d, existing = null) {
    const fare = cents(d.fare_cents ?? existing?.fare_cents, '車資');
    const base = d.commission_base_cents === undefined || d.commission_base_cents === null || d.commission_base_cents === ''
      ? (existing && existing.commission_base_cents !== existing.fare_cents ? existing.commission_base_cents : fare)
      : cents(d.commission_base_cents, '佣金計算基礎');
    if (base > fare) throw new AppError('佣金計算基礎不可大於車資', 'VALIDATION');
    const date = req(d.pickup_local_date, '接送日期');
    const time = req(d.pickup_local_time, '接送時間');
    const t = localToUtc(date, time, d.dst_choice === 'later' ? 'later' : 'earlier');
    const passengers = int(d.passengers ?? 1, '人數', 1);
    return {
      contact_name: d.contact_name?.trim() || null,
      contact_phone: d.contact_phone?.trim() || null,
      source: oneOf(d.source || 'PHONE', ENUMS.source, '訂單來源'),
      trip_type: oneOf(d.trip_type || 'ARRIVAL', ENUMS.trip, '接送類型'),
      airport: oneOf(d.airport || 'LAX', ENUMS.airport, '機場'),
      flight_no: d.flight_no?.trim().toUpperCase() || null,
      pickup_local_date: date, pickup_local_time: time,
      pickup_at_utc: t.utc, pickup_utc_offset: t.offset, dst_ambiguous: t.ambiguous ? 1 : 0,
      pickup_address: req(d.pickup_address, '上車地址'),
      dropoff_address: req(d.dropoff_address, '下車地址'),
      area: req(d.area, '區域／城市'),
      passengers, luggage: int(d.luggage ?? 0, '行李數'),
      vehicle_type: oneOf(d.vehicle_type || 'SEDAN', ENUMS.vehicle, '車型'),
      fare_cents: fare, tip_cents: cents(d.tip_cents ?? 0, '小費'), commission_base_cents: base,
      collector: oneOf(d.collector || 'COMPANY', ENUMS.collector, '收款方'),
      payment_method: oneOf(d.payment_method || 'ZELLE', ENUMS.method, '收款方式'),
      notes: d.notes?.trim() || null,
    };
  }
  function createOrder(ctx, d) {
    need(ctx, 'order.write');
    return db.tx(() => {
      let customerId = d.customer_id ? Number(d.customer_id) : null;
      if (!customerId) {
        const existing = normPhone(d.new_customer_phone || d.contact_phone)
          && get('SELECT id FROM customers WHERE phone_normalized = ?', normPhone(d.new_customer_phone || d.contact_phone));
        if (existing) customerId = existing.id;
      }
      if (!customerId) {
        const c = createCustomer(ctx, { name: d.new_customer_name || d.contact_name, phone: d.new_customer_phone || d.contact_phone,
          contact_channel: d.source === 'LINE' ? 'LINE' : 'PHONE', addresses: [d.trip_type === 'DEPARTURE' ? d.pickup_address : d.dropoff_address] });
        customerId = c.id;
      }
      const cust = get('SELECT * FROM customers WHERE id = ?', customerId);
      if (!cust) throw new AppError('找不到客戶', 'NOT_FOUND', 404);
      const o = orderInput(d);
      o.contact_name ||= cust.name;
      o.contact_phone ||= cust.phone;
      const no = nextNo('orders', 'order_no', `AIR-${ymd(o.pickup_local_date)}-`, 3);
      const rate = d.commission_rate_bps ? int(d.commission_rate_bps, '費率', 0) : DEFAULT_COMMISSION_BPS;
      const r = run(`INSERT INTO orders (order_no, customer_id, contact_name, contact_phone, source, trip_type, airport, flight_no,
          pickup_local_date, pickup_local_time, pickup_at_utc, pickup_utc_offset, dst_ambiguous, pickup_address, dropoff_address, area,
          passengers, luggage, vehicle_type, fare_cents, tip_cents, commission_base_cents, commission_rate_bps, collector, payment_method,
          notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      no, customerId, o.contact_name, o.contact_phone, o.source, o.trip_type, o.airport, o.flight_no,
      o.pickup_local_date, o.pickup_local_time, o.pickup_at_utc, o.pickup_utc_offset, o.dst_ambiguous, o.pickup_address, o.dropoff_address, o.area,
      o.passengers, o.luggage, o.vehicle_type, o.fare_cents, o.tip_cents, o.commission_base_cents, rate, o.collector, o.payment_method,
      o.notes, ctx.id, now(), now());
      audit(ctx, 'order.create', 'order', r.id, `建立訂單 ${no}${o.dst_ambiguous ? '（夏令時間重疊時段，已標記待確認）' : ''}`, null, o);
      return getOrder(ctx, r.id);
    });
  }
  const FIN_FIELDS = ['fare_cents', 'tip_cents', 'commission_base_cents', 'collector', 'payment_method'];
  function updateOrder(ctx, id, d) {
    need(ctx, 'order.write');
    return db.tx(() => {
      const before = get('SELECT * FROM orders WHERE id = ?', id);
      if (!before) throw new AppError('找不到訂單', 'NOT_FOUND', 404);
      if (d.version !== undefined && Number(d.version) !== before.version) throw new AppError('訂單已被他人修改，請重新整理後再編輯', 'VERSION_CONFLICT', 409);
      if (['COMPLETED', 'CANCELLED'].includes(before.status)) throw new AppError('已完成或已取消的訂單不可直接修改；帳務請至帳本以調整分錄處理', 'ORDER_LOCKED', 409);
      const o = orderInput(d, before);
      const finChanged = FIN_FIELDS.filter((f) => String(o[f]) !== String(before[f]));
      if (finChanged.length && !d.reason?.trim()) throw new AppError('修改帳務欄位（' + finChanged.join(', ') + '）必須填寫原因', 'REASON_REQUIRED');
      if (finChanged.includes('collector') && before.current_driver_id) {
        const bal = get(`SELECT COALESCE(SUM(driver_bal_delta),0) AS b FROM order_ledger WHERE order_id = ?`, id).b;
        if (bal !== 0) throw new AppError('司機已有此訂單收款紀錄，不可直接變更收款方', 'ORDER_LOCKED', 409);
      }
      run(`UPDATE orders SET contact_name=?, contact_phone=?, source=?, trip_type=?, airport=?, flight_no=?, pickup_local_date=?, pickup_local_time=?,
           pickup_at_utc=?, pickup_utc_offset=?, dst_ambiguous=?, pickup_address=?, dropoff_address=?, area=?, passengers=?, luggage=?, vehicle_type=?,
           fare_cents=?, tip_cents=?, commission_base_cents=?, collector=?, payment_method=?, notes=?, version=version+1, updated_at=? WHERE id=?`,
      o.contact_name || before.contact_name, o.contact_phone, o.source, o.trip_type, o.airport, o.flight_no, o.pickup_local_date, o.pickup_local_time,
      o.pickup_at_utc, o.pickup_utc_offset, o.dst_ambiguous, o.pickup_address, o.dropoff_address, o.area, o.passengers, o.luggage, o.vehicle_type,
      o.fare_cents, o.tip_cents, o.commission_base_cents, o.collector, o.payment_method, o.notes, now(), id);
      const changed = Object.keys(o).filter((k) => String(o[k] ?? '') !== String(before[k] ?? ''));
      audit(ctx, finChanged.length ? 'order.update_financial' : 'order.update', 'order', id,
        `修改訂單 ${before.order_no}：${changed.join(', ') || '無變更'}`,
        Object.fromEntries(changed.map((k) => [k, before[k]])), Object.fromEntries(changed.map((k) => [k, o[k]])), d.reason || null);
      return getOrder(ctx, id);
    });
  }
  function orderFinance(orderId) {
    const s = get(`SELECT
        COALESCE(SUM(CASE WHEN entry_type IN ('FARE','TIP','EXTRA','FARE_ADJUST') THEN customer_due_delta END),0) AS charges,
        COALESCE(SUM(CASE WHEN entry_type IN ('FARE','EXTRA','FARE_ADJUST') THEN amount_cents END),0) AS fare_posted,
        COALESCE(SUM(CASE WHEN entry_type = 'TIP' THEN amount_cents END),0) AS tip_posted,
        COALESCE(SUM(CASE WHEN commissionable = 1 THEN amount_cents END),0) AS commission_base_posted,
        COALESCE(SUM(CASE WHEN entry_type = 'COMMISSION' THEN amount_cents END),0) AS commission,
        COALESCE(SUM(revenue_delta),0) AS revenue,
        COALESCE(SUM(customer_due_delta),0) AS customer_due,
        COALESCE(SUM(driver_bal_delta),0) AS driver_balance,
        COALESCE(SUM(CASE WHEN entry_type IN ('CUSTOMER_PAYMENT','CUSTOMER_REFUND') OR (entry_type='REVERSAL' AND payment_id IS NOT NULL AND settlement_id IS NULL)
                     THEN -customer_due_delta END),0) AS paid_net,
        COALESCE(SUM(CASE WHEN (entry_type IN ('CUSTOMER_PAYMENT','CUSTOMER_REFUND') OR (entry_type='REVERSAL' AND payment_id IS NOT NULL AND settlement_id IS NULL)) AND party='COMPANY'
                     THEN -customer_due_delta END),0) AS paid_company,
        COALESCE(SUM(CASE WHEN (entry_type IN ('CUSTOMER_PAYMENT','CUSTOMER_REFUND') OR (entry_type='REVERSAL' AND payment_id IS NOT NULL AND settlement_id IS NULL)) AND party='DRIVER'
                     THEN -customer_due_delta END),0) AS paid_driver,
        COALESCE(SUM(CASE WHEN entry_type = 'CUSTOMER_REFUND' THEN amount_cents END),0) AS refunded
      FROM order_ledger WHERE order_id = ?`, orderId);
    const pending = get(`SELECT COALESCE(SUM(amount_cents),0) AS p FROM payment_records WHERE order_id = ? AND status = 'PENDING' AND kind = 'CUSTOMER_PAYMENT'`, orderId).p;
    return { ...s, pending_payments: pending };
  }
  function paymentStatus(o, f) {
    const target = o.status === 'COMPLETED' ? f.charges : o.status === 'CANCELLED' ? f.charges : o.fare_cents + o.tip_cents;
    if (o.status === 'CANCELLED' && f.refunded > 0 && f.paid_net === f.charges) return 'REFUNDED';
    if (f.paid_net === 0 && target === 0) return o.status === 'CANCELLED' ? 'NONE' : 'UNPAID';
    if (f.paid_net <= 0) return 'UNPAID';
    if (f.paid_net < target) return 'PARTIAL';
    if (f.paid_net === target) return 'PAID';
    return 'OVERPAID';
  }
  function decorateOrder(o) {
    const f = orderFinance(o.id);
    const split = splitCommission(o.commission_base_cents, o.commission_rate_bps);
    return { ...o, finance: f, payment_status: paymentStatus(o, f),
      expected_commission_cents: split.commission,
      expected_driver_cents: o.fare_cents - split.commission + o.tip_cents };
  }
  function listOrders(ctx, f = {}) {
    if (!hasPerm(ctx, 'order.read')) need(ctx, 'order.read.own');
    const where = []; const p = [];
    if (isDriver(ctx) || (!hasPerm(ctx, 'order.read'))) { where.push('o.current_driver_id = ?'); p.push(ctx.driver_id ?? -1); }
    if (f.q) {
      where.push(`(o.order_no LIKE ? OR o.contact_name LIKE ? OR COALESCE(o.contact_phone,'') LIKE ? OR COALESCE(o.flight_no,'') LIKE ?
                   OR o.pickup_address LIKE ? OR o.dropoff_address LIKE ? OR c.name LIKE ? OR o.area LIKE ?)`);
      const like = `%${f.q.trim()}%`; p.push(like, like, like, like, like, like, like, like);
    }
    if (f.status) { const st = String(f.status).split(','); where.push(`o.status IN (${st.map(() => '?').join(',')})`); p.push(...st); }
    if (f.date_from) { where.push('o.pickup_local_date >= ?'); p.push(f.date_from); }
    if (f.date_to) { where.push('o.pickup_local_date <= ?'); p.push(f.date_to); }
    if (f.collector) { where.push('o.collector = ?'); p.push(f.collector); }
    if (f.driver_id) { where.push('o.current_driver_id = ?'); p.push(Number(f.driver_id)); }
    if (f.customer_id) { where.push('o.customer_id = ?'); p.push(Number(f.customer_id)); }
    if (f.airport) { where.push('o.airport = ?'); p.push(f.airport); }
    const rows = all(`SELECT o.*, c.customer_no, c.name AS customer_name, d.name AS driver_name, d.driver_no
                      FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN drivers d ON d.id = o.current_driver_id
                      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                      ORDER BY o.pickup_at_utc ${f.sort === 'desc' ? 'DESC' : 'ASC'} LIMIT 500`, ...p);
    let out = rows.map(decorateOrder);
    if (f.payment_status) out = out.filter((o) => o.payment_status === f.payment_status);
    return out;
  }
  function getOrder(ctx, id) {
    const o = get(`SELECT o.*, c.customer_no, c.name AS customer_name, c.phone AS customer_phone, d.name AS driver_name, d.driver_no
                   FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN drivers d ON d.id = o.current_driver_id WHERE o.id = ?`, id);
    if (!o) throw new AppError('找不到訂單', 'NOT_FOUND', 404);
    if (!hasPerm(ctx, 'order.read')) {
      need(ctx, 'order.read.own');
      const mine = get('SELECT 1 AS x FROM dispatches WHERE order_id = ? AND driver_id = ?', id, ctx.driver_id ?? -1);
      if (!mine) throw new AppError('只能查看自己的訂單', 'FORBIDDEN', 403);
    }
    return {
      ...decorateOrder(o),
      dispatches: dispatchHistory(ctx, { order_id: id }),
      ledger: all(`SELECT l.*, u.display_name AS created_by_name, d.name AS driver_name FROM order_ledger l
                   LEFT JOIN users u ON u.id = l.created_by LEFT JOIN drivers d ON d.id = l.driver_id WHERE l.order_id = ? ORDER BY l.id`, id),
      payments: all(`SELECT p.*, u.display_name AS recorded_by_name FROM payment_records p LEFT JOIN users u ON u.id = p.recorded_by
                     WHERE p.order_id = ? ORDER BY p.id`, id),
      audit: hasPerm(ctx, 'audit.read') ? all(`SELECT * FROM audit_logs WHERE entity_type = 'order' AND entity_id = ? ORDER BY id DESC`, id) : [],
    };
  }

  // ---------- 派車 ----------
  function activeDispatch(orderId) {
    return get(`SELECT * FROM dispatches WHERE order_id = ? AND status IN ('ASSIGNED','ACCEPTED','COMPLETED')`, orderId);
  }
  function loadOrder(id) {
    const o = get('SELECT * FROM orders WHERE id = ?', id);
    if (!o) throw new AppError('找不到訂單', 'NOT_FOUND', 404);
    return o;
  }
  function assign(ctx, orderId, { driver_id, vehicle_id = null, note = null, force = false }) {
    need(ctx, 'dispatch.manage');
    return db.tx(() => {
      const o = loadOrder(orderId);
      if (o.status !== 'PENDING_DISPATCH') throw new AppError(`訂單目前狀態為 ${o.status}，不可指派；若要改派請使用「改派」`, 'INVALID_STATE', 409);
      const existing = activeDispatch(orderId);
      if (existing) throw new AppError('此訂單已有有效派車，不得重複指派', 'DUPLICATE_ACTIVE_DISPATCH', 409);
      const drv = get('SELECT * FROM drivers WHERE id = ?', Number(driver_id));
      if (!drv || drv.status !== 'ACTIVE') throw new AppError('司機不存在或已停用', 'VALIDATION');
      let veh = null;
      if (vehicle_id) {
        veh = get('SELECT * FROM vehicles WHERE id = ? AND is_active = 1', Number(vehicle_id));
        if (!veh) throw new AppError('車輛不存在', 'VALIDATION');
        if (veh.driver_id && veh.driver_id !== drv.id) throw new AppError('此車輛不屬於該司機', 'VALIDATION');
        if (veh.seats < o.passengers) throw new AppError(`車輛座位 ${veh.seats} 少於乘客 ${o.passengers} 人`, 'VALIDATION');
      }
      const conflicts = all(`SELECT o2.order_no, o2.pickup_local_time FROM dispatches d JOIN orders o2 ON o2.id = d.order_id
          WHERE d.driver_id = ? AND d.status IN ('ASSIGNED','ACCEPTED') AND o2.id <> ?
          AND ABS(julianday(o2.pickup_at_utc) - julianday(?)) * 24 < 2`, drv.id, orderId, o.pickup_at_utc);
      if (conflicts.length && !force) {
        throw new AppError(`司機 ${drv.name} 在前後 2 小時內已有任務（${conflicts.map((c) => c.order_no + ' ' + c.pickup_local_time).join('、')}），確認仍要指派請勾選「忽略時間衝突」`, 'SCHEDULE_CONFLICT', 409);
      }
      const r = run(`INSERT INTO dispatches (order_id, driver_id, vehicle_id, status, assigned_by, assigned_at, note) VALUES (?,?,?,?,?,?,?)`,
        orderId, drv.id, veh?.id ?? null, 'ASSIGNED', ctx.id, now(), note);
      run(`UPDATE orders SET status='ASSIGNED', current_driver_id=?, version=version+1, updated_at=? WHERE id=?`, drv.id, now(), orderId);
      audit(ctx, 'dispatch.assign', 'order', orderId, `${o.order_no} 指派給 ${drv.driver_no} ${drv.name}${conflicts.length ? '（忽略時間衝突）' : ''}`, null, { dispatch_id: r.id, driver_id: drv.id, vehicle_id: veh?.id });
      return r.id;
    });
  }
  function loadDispatchFor(ctx, dispatchId) {
    const d = get('SELECT * FROM dispatches WHERE id = ?', dispatchId);
    if (!d) throw new AppError('找不到派車紀錄', 'NOT_FOUND', 404);
    if (hasPerm(ctx, 'dispatch.manage')) return d;
    need(ctx, 'dispatch.respond');
    if (d.driver_id !== ctx.driver_id) throw new AppError('只能回覆指派給自己的任務', 'FORBIDDEN', 403);
    return d;
  }
  function acceptDispatch(ctx, dispatchId) {
    return db.tx(() => {
      const d = loadDispatchFor(ctx, dispatchId);
      if (d.status !== 'ASSIGNED') throw new AppError('此派車目前不可確認（狀態：' + d.status + '）', 'INVALID_STATE', 409);
      run(`UPDATE dispatches SET status='ACCEPTED', responded_at=?, responded_by=? WHERE id=?`, now(), ctx.id, dispatchId);
      run(`UPDATE orders SET status='ACCEPTED', version=version+1, updated_at=? WHERE id=?`, now(), d.order_id);
      audit(ctx, 'dispatch.accept', 'order', d.order_id, `司機確認接單${isDriver(ctx) ? '' : '（由 ' + ctx.display_name + ' 代為確認）'}`, null, { dispatch_id: dispatchId });
    });
  }
  function rejectDispatch(ctx, dispatchId, { reason }) {
    return db.tx(() => {
      const d = loadDispatchFor(ctx, dispatchId);
      if (!['ASSIGNED', 'ACCEPTED'].includes(d.status)) throw new AppError('此派車目前不可拒單', 'INVALID_STATE', 409);
      req(reason, '拒單原因');
      run(`UPDATE dispatches SET status='REJECTED', responded_at=?, responded_by=?, ended_at=?, reason=? WHERE id=?`, now(), ctx.id, now(), reason, dispatchId);
      run(`UPDATE orders SET status='PENDING_DISPATCH', current_driver_id=NULL, version=version+1, updated_at=? WHERE id=?`, now(), d.order_id);
      audit(ctx, 'dispatch.reject', 'order', d.order_id, '司機拒單，訂單回到待派車', null, { dispatch_id: dispatchId }, reason);
    });
  }
  function cancelDispatch(ctx, dispatchId, { reason }) {
    need(ctx, 'dispatch.manage');
    return db.tx(() => {
      const d = get('SELECT * FROM dispatches WHERE id = ?', dispatchId);
      if (!d || !['ASSIGNED', 'ACCEPTED'].includes(d.status)) throw new AppError('此派車目前不可撤回', 'INVALID_STATE', 409);
      req(reason, '撤回原因');
      const held = get(`SELECT COALESCE(SUM(driver_bal_delta),0) AS b FROM order_ledger WHERE order_id = ? AND driver_id = ?`, d.order_id, d.driver_id).b;
      if (held !== 0) throw new AppError('此司機已有此訂單的收款紀錄，請先處理帳務再改派', 'DRIVER_HOLDS_FUNDS', 409);
      run(`UPDATE dispatches SET status='CANCELLED', ended_at=?, reason=? WHERE id=?`, now(), reason, dispatchId);
      run(`UPDATE orders SET status='PENDING_DISPATCH', current_driver_id=NULL, version=version+1, updated_at=? WHERE id=?`, now(), d.order_id);
      audit(ctx, 'dispatch.cancel', 'order', d.order_id, '撤回派車，訂單回到待派車', null, { dispatch_id: dispatchId }, reason);
    });
  }
  function reassign(ctx, orderId, { driver_id, vehicle_id, reason, force }) {
    need(ctx, 'dispatch.manage');
    return db.tx(() => {
      const d = activeDispatch(orderId);
      if (d) {
        if (d.status === 'COMPLETED') throw new AppError('已完成的訂單不可改派', 'INVALID_STATE', 409);
        cancelDispatch(ctx, d.id, { reason: '改派：' + req(reason, '改派原因') });
      }
      return assign(ctx, orderId, { driver_id, vehicle_id, note: '改派：' + reason, force });
    });
  }
  function dispatchHistory(ctx, f = {}) {
    const where = []; const p = [];
    if (!hasPerm(ctx, 'dispatch.manage') && !hasPerm(ctx, 'order.read')) { where.push('d.driver_id = ?'); p.push(ctx.driver_id ?? -1); }
    if (f.order_id) { where.push('d.order_id = ?'); p.push(Number(f.order_id)); }
    if (f.driver_id) { where.push('d.driver_id = ?'); p.push(Number(f.driver_id)); }
    if (f.status) { where.push('d.status = ?'); p.push(f.status); }
    if (f.date_from) { where.push('o.pickup_local_date >= ?'); p.push(f.date_from); }
    if (f.date_to) { where.push('o.pickup_local_date <= ?'); p.push(f.date_to); }
    return all(`SELECT d.*, o.order_no, o.pickup_local_date, o.pickup_local_time, o.airport, o.area, o.trip_type, o.status AS order_status,
                dr.name AS driver_name, dr.driver_no, v.plate_no, ua.display_name AS assigned_by_name, ur.display_name AS responded_by_name
                FROM dispatches d JOIN orders o ON o.id = d.order_id JOIN drivers dr ON dr.id = d.driver_id
                LEFT JOIN vehicles v ON v.id = d.vehicle_id LEFT JOIN users ua ON ua.id = d.assigned_by LEFT JOIN users ur ON ur.id = d.responded_by
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.id DESC LIMIT 500`, ...p);
  }

  // ---------- 帳本 ----------
  function post(ctx, order, e) {
    const r = run(`INSERT INTO order_ledger (order_id, driver_id, entry_type, amount_cents, commissionable, customer_due_delta, driver_bal_delta,
                   revenue_delta, party, payment_id, settlement_id, reversal_of, memo, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    order.id, e.driver_id !== undefined ? e.driver_id : order.current_driver_id, e.type, e.amount, e.commissionable ? 1 : 0,
    e.cd || 0, e.od || 0, e.rev || 0, e.party || null, e.payment_id || null, e.settlement_id || null, e.reversal_of || null, e.memo || null,
    ctx?.id ?? null, now());
    return r.id;
  }
  /** 依「已入帳的佣金計算基礎總額」重算應有佣金，只補差額，確保佣金＝round(總基礎×費率) */
  function recomputeCommission(ctx, order, memo) {
    const f = orderFinance(order.id);
    const target = applyBps(f.commission_base_posted, order.commission_rate_bps);
    const diff = target - f.commission;
    if (diff !== 0) {
      post(ctx, order, { type: 'COMMISSION', amount: diff, od: -diff, rev: diff,
        memo: memo || `平台佣金 ${order.commission_rate_bps / 100}% × 基礎 ${(f.commission_base_posted / 100).toFixed(2)}` });
    }
  }
  function completeOrder(ctx, orderId, d = {}) {
    return db.tx(() => {
      const o = loadOrder(orderId);
      const disp = activeDispatch(orderId);
      if (!disp) throw new AppError('訂單尚未派車', 'INVALID_STATE', 409);
      loadDispatchFor(ctx, disp.id);
      if (o.status !== 'ACCEPTED' || disp.status !== 'ACCEPTED') throw new AppError('司機確認接單後才能回報完成', 'INVALID_STATE', 409);
      const fare = d.fare_cents === undefined || d.fare_cents === '' ? o.fare_cents : cents(d.fare_cents, '實收車資');
      const tip = d.tip_cents === undefined || d.tip_cents === '' ? o.tip_cents : cents(d.tip_cents, '小費');
      let base = o.commission_base_cents;
      if (fare !== o.fare_cents) {
        req(d.reason, '車資與報價不同的原因');
        base = o.commission_base_cents === o.fare_cents ? fare : Math.min(o.commission_base_cents, fare);
      }
      const ord = { ...o, current_driver_id: disp.driver_id };
      post(ctx, ord, { type: 'FARE', amount: base, commissionable: 1, cd: base, od: base, memo: '車資（抽佣基礎）' });
      if (fare - base > 0) post(ctx, ord, { type: 'FARE', amount: fare - base, commissionable: 0, cd: fare - base, od: fare - base, memo: '車資（不抽佣部分）' });
      if (tip > 0) post(ctx, ord, { type: 'TIP', amount: tip, cd: tip, od: tip, memo: '小費 100% 歸司機' });
      recomputeCommission(ctx, ord);
      run(`UPDATE dispatches SET status='COMPLETED', ended_at=? WHERE id=?`, now(), disp.id);
      run(`UPDATE orders SET status='COMPLETED', fare_cents=?, tip_cents=?, commission_base_cents=?, completed_at=?, version=version+1, updated_at=? WHERE id=?`,
        fare, tip, base, now(), now(), orderId);
      audit(ctx, 'order.complete', 'order', orderId, `完成接送 ${o.order_no}：車資 ${fare / 100}、小費 ${tip / 100}`,
        { fare_cents: o.fare_cents, tip_cents: o.tip_cents }, { fare_cents: fare, tip_cents: tip, commission_base_cents: base }, d.reason || null);
      const collected = d.driver_collected_cents ? cents(d.driver_collected_cents, '司機現場收款') : 0;
      if (collected > 0) {
        recordCustomerPayment(ctx, orderId, { party: 'DRIVER', method: d.method || o.payment_method, amount_cents: collected,
          status: 'CONFIRMED', note: '司機完成回報時登錄現場收款' }, true);
      }
      return getOrder(ctx, orderId);
    });
  }
  function cancelOrder(ctx, orderId, { reason }) {
    need(ctx, 'order.write');
    return db.tx(() => {
      const o = loadOrder(orderId);
      if (['COMPLETED', 'CANCELLED'].includes(o.status)) throw new AppError('已完成或已取消的訂單不可取消', 'INVALID_STATE', 409);
      req(reason, '取消原因');
      const d = activeDispatch(orderId);
      if (d) run(`UPDATE dispatches SET status='CANCELLED', ended_at=?, reason=? WHERE id=?`, now(), '訂單取消：' + reason, d.id);
      run(`UPDATE orders SET status='CANCELLED', cancelled_at=?, cancel_reason=?, version=version+1, updated_at=? WHERE id=?`, now(), reason, now(), orderId);
      audit(ctx, 'order.cancel', 'order', orderId, `取消訂單 ${o.order_no}`, { status: o.status }, { status: 'CANCELLED' }, reason);
      const f = orderFinance(orderId);
      return { order: getOrder(ctx, orderId), needs_refund_cents: Math.max(0, f.paid_net - f.charges) };
    });
  }

  function recordCustomerPayment(ctx, orderId, d, internal = false) {
    if (!internal) need(ctx, 'payment.customer');
    return db.tx(() => {
      const o = loadOrder(orderId);
      const party = oneOf(d.party || o.collector, ENUMS.collector, '收款方');
      const status = oneOf(d.status || 'CONFIRMED', ['PENDING', 'CONFIRMED'], '款項狀態');
      const amount = cents(d.amount_cents, '收款金額', { allowZero: false });
      if (party === 'DRIVER' && !o.current_driver_id) throw new AppError('訂單尚未有司機，不能登錄司機收款', 'VALIDATION');
      const method = oneOf(d.method || o.payment_method, ENUMS.method, '收款方式');
      // 不得把未收到的款項標示為已收：無「確認到帳」權限者登錄的非現金款項一律先存為「待確認」
      const finalStatus = (!internal && status === 'CONFIRMED' && !hasPerm(ctx, 'payment.confirm') && method !== 'CASH') ? 'PENDING' : status;
      const no = nextNo('payment_records', 'payment_no', 'PAY-', 6);
      const r = run(`INSERT INTO payment_records (payment_no, kind, order_id, driver_id, party, method, amount_cents, status, reference, note,
                     confirmed_at, confirmed_by, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      no, 'CUSTOMER_PAYMENT', orderId, party === 'DRIVER' ? o.current_driver_id : null, party, method,
      amount, finalStatus, d.reference || null, d.note || null, finalStatus === 'CONFIRMED' ? now() : null, finalStatus === 'CONFIRMED' ? ctx.id : null, ctx.id, now());
      if (finalStatus === 'CONFIRMED') postCustomerPayment(ctx, o, r.id);
      audit(ctx, 'payment.record', 'order', orderId, `登錄客戶付款 ${no} $${(amount / 100).toFixed(2)}（${party === 'DRIVER' ? '司機收' : '公司收'}，${finalStatus === 'PENDING' ? '待確認到帳，不計入已收' : '已確認'}）`, null, { payment_id: r.id, amount, party, status: finalStatus });
      return r.id;
    });
  }
  function postCustomerPayment(ctx, o, paymentId) {
    const p = get('SELECT * FROM payment_records WHERE id = ?', paymentId);
    post(ctx, o, { type: 'CUSTOMER_PAYMENT', amount: p.amount_cents, cd: -p.amount_cents, od: p.party === 'DRIVER' ? -p.amount_cents : 0,
      party: p.party, payment_id: p.id, driver_id: p.party === 'DRIVER' ? p.driver_id : o.current_driver_id,
      memo: p.party === 'DRIVER' ? '客戶付款（司機代收，需繳回公司部分）' : '客戶付款（公司收）' });
  }
  function confirmPayment(ctx, paymentId) {
    need(ctx, 'payment.confirm');
    return db.tx(() => {
      const p = get('SELECT * FROM payment_records WHERE id = ?', paymentId);
      if (!p || p.status !== 'PENDING') throw new AppError('只有「待確認」款項可以確認到帳', 'INVALID_STATE', 409);
      run(`UPDATE payment_records SET status='CONFIRMED', confirmed_at=?, confirmed_by=? WHERE id=?`, now(), ctx.id, paymentId);
      postCustomerPayment(ctx, loadOrder(p.order_id), paymentId);
      audit(ctx, 'payment.confirm', 'order', p.order_id, `確認到帳 ${p.payment_no} $${(p.amount_cents / 100).toFixed(2)}`, { status: 'PENDING' }, { status: 'CONFIRMED' });
    });
  }
  function voidPayment(ctx, paymentId, { reason }) {
    need(ctx, 'payment.confirm');
    return db.tx(() => {
      const p = get('SELECT * FROM payment_records WHERE id = ?', paymentId);
      if (!p || p.status === 'VOID') throw new AppError('款項不存在或已作廢', 'INVALID_STATE', 409);
      if (!p.order_id) throw new AppError('結算付款請至結算中心處理', 'INVALID_STATE', 409);
      req(reason, '作廢原因');
      if (p.status === 'CONFIRMED') {
        const o = loadOrder(p.order_id);
        for (const e of all('SELECT * FROM order_ledger WHERE payment_id = ? AND entry_type <> ?', paymentId, 'REVERSAL')) {
          post(ctx, o, { type: 'REVERSAL', amount: -e.amount_cents, cd: -e.customer_due_delta, od: -e.driver_bal_delta, rev: -e.revenue_delta,
            party: e.party, payment_id: paymentId, reversal_of: e.id, driver_id: e.driver_id, memo: '作廢沖回：' + reason });
        }
      }
      run(`UPDATE payment_records SET status='VOID', voided_at=?, void_reason=? WHERE id=?`, now(), reason, paymentId);
      audit(ctx, 'payment.void', 'order', p.order_id, `作廢款項 ${p.payment_no}`, { status: p.status }, { status: 'VOID' }, reason);
    });
  }
  function refund(ctx, orderId, d) {
    need(ctx, 'payment.confirm');
    return db.tx(() => {
      const o = loadOrder(orderId);
      const party = oneOf(d.party || 'COMPANY', ENUMS.collector, '退款方');
      const amount = cents(d.amount_cents, '退款金額', { allowZero: false });
      req(d.reason, '退款原因');
      const f = orderFinance(orderId);
      const held = party === 'COMPANY' ? f.paid_company : f.paid_driver;
      if (amount > held) throw new AppError(`${party === 'COMPANY' ? '公司' : '司機'}在此訂單的已收淨額只有 $${(held / 100).toFixed(2)}，退款不可超過`, 'REFUND_EXCEEDS', 409);
      const reduce = !!d.reduce_fare;
      if (reduce && o.status !== 'COMPLETED') throw new AppError('只有已完成訂單可同時沖減車資', 'INVALID_STATE', 409);
      if (reduce && amount > f.fare_posted) throw new AppError('沖減金額超過已入帳車資', 'VALIDATION');
      const no = nextNo('payment_records', 'payment_no', 'PAY-', 6);
      const driverId = party === 'DRIVER' ? (get(`SELECT driver_id FROM order_ledger WHERE order_id=? AND party='DRIVER' ORDER BY id DESC LIMIT 1`, orderId)?.driver_id ?? o.current_driver_id) : null;
      const r = run(`INSERT INTO payment_records (payment_no, kind, order_id, driver_id, party, method, amount_cents, status, reference, note,
                     confirmed_at, confirmed_by, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      no, 'CUSTOMER_REFUND', orderId, driverId, party, oneOf(d.method || o.payment_method, ENUMS.method, '退款方式'), amount, 'CONFIRMED',
      d.reference || null, d.reason, now(), ctx.id, ctx.id, now());
      post(ctx, o, { type: 'CUSTOMER_REFUND', amount, cd: amount, od: party === 'DRIVER' ? amount : 0, party, payment_id: r.id,
        driver_id: party === 'DRIVER' ? driverId : o.current_driver_id, memo: '退款：' + d.reason });
      if (reduce) {
        post(ctx, o, { type: 'FARE_ADJUST', amount: -amount, commissionable: 1, cd: -amount, od: -amount, memo: '退款沖減車資：' + d.reason });
        recomputeCommission(ctx, o, '車資沖減後重算佣金');
      }
      audit(ctx, 'payment.refund', 'order', orderId, `退款 ${no} $${(amount / 100).toFixed(2)}（${party === 'DRIVER' ? '司機' : '公司'}退${reduce ? '，沖減車資' : ''}）`, null, { amount, party, reduce }, d.reason);
      return r.id;
    });
  }
  function addLedgerEntry(ctx, orderId, d) {
    need(ctx, 'ledger.adjust');
    return db.tx(() => {
      const o = loadOrder(orderId);
      const type = oneOf(d.type, ['EXTRA', 'FARE_ADJUST', 'ADJUSTMENT'], '分錄類型');
      const amount = cents(d.amount_cents, '金額', { allowNeg: type !== 'EXTRA', allowZero: false });
      const reason = req(d.reason, '原因');
      if (d.confirm !== true) throw new AppError('帳務調整需勾選確認', 'CONFIRM_REQUIRED');
      if (type === 'FARE_ADJUST' && o.status !== 'COMPLETED') throw new AppError('車資調整只適用於已完成訂單；未完成請直接修改訂單報價', 'INVALID_STATE', 409);
      if (type === 'EXTRA' && !['COMPLETED', 'CANCELLED'].includes(o.status)) throw new AppError('額外費用於完成（或取消）後入帳；未完成前請修改訂單報價', 'INVALID_STATE', 409);
      if (type === 'ADJUSTMENT' && !o.current_driver_id) throw new AppError('沒有司機的訂單不能做司機帳務調整', 'VALIDATION');
      let id;
      if (type === 'ADJUSTMENT') {
        id = post(ctx, o, { type, amount, od: amount, memo: '帳務調整：' + reason });
      } else if (type === 'EXTRA' && !o.current_driver_id) {
        id = post(ctx, o, { type, amount, cd: amount, rev: amount, driver_id: null, memo: '額外費用（無司機，全額歸公司）：' + reason });
      } else {
        const commissionable = type === 'FARE_ADJUST' ? 1 : (d.commissionable ? 1 : 0);
        id = post(ctx, o, { type, amount, commissionable, cd: amount, od: amount, memo: (type === 'EXTRA' ? '額外費用' : '車資調整') + (commissionable ? '（抽佣）' : '（不抽佣）') + '：' + reason });
        if (commissionable) recomputeCommission(ctx, o);
      }
      audit(ctx, 'ledger.' + type.toLowerCase(), 'order', orderId, `${o.order_no} 新增分錄 ${type} $${(amount / 100).toFixed(2)}`, null, { ledger_id: id, amount, commissionable: !!d.commissionable }, reason);
      return id;
    });
  }
  function listLedger(ctx, f = {}) {
    need(ctx, 'ledger.read');
    const where = []; const p = [];
    if (f.order_id) { where.push('l.order_id = ?'); p.push(Number(f.order_id)); }
    if (f.driver_id) { where.push('l.driver_id = ?'); p.push(Number(f.driver_id)); }
    if (f.type) { where.push('l.entry_type = ?'); p.push(f.type); }
    if (f.date_from) { where.push('o.pickup_local_date >= ?'); p.push(f.date_from); }
    if (f.date_to) { where.push('o.pickup_local_date <= ?'); p.push(f.date_to); }
    if (f.q) { where.push('(o.order_no LIKE ? OR l.memo LIKE ?)'); p.push(`%${f.q}%`, `%${f.q}%`); }
    return all(`SELECT l.*, o.order_no, o.pickup_local_date, o.collector, d.name AS driver_name, u.display_name AS created_by_name
                FROM order_ledger l JOIN orders o ON o.id = l.order_id LEFT JOIN drivers d ON d.id = l.driver_id LEFT JOIN users u ON u.id = l.created_by
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.id DESC LIMIT 1000`, ...p);
  }
  function ledgerSummary(ctx, f = {}) {
    need(ctx, 'ledger.read');
    const orders = listOrders(ctx, { date_from: f.date_from, date_to: f.date_to, sort: 'desc' })
      .filter((o) => o.status === 'COMPLETED' || o.finance.paid_net !== 0 || o.finance.pending_payments > 0 || o.finance.charges !== 0);
    const pending = all(`SELECT p.*, o.order_no FROM payment_records p JOIN orders o ON o.id = p.order_id WHERE p.status = 'PENDING' ORDER BY p.id`);
    return { orders, pending_payments: pending };
  }

  // ---------- 司機餘額與結算 ----------
  function driverBalance(driverId) {
    const rows = all(`SELECT order_id, SUM(driver_bal_delta) AS bal FROM order_ledger WHERE driver_id = ? GROUP BY order_id HAVING bal <> 0`, driverId);
    return {
      payable_cents: rows.filter((r) => r.bal > 0).reduce((s, r) => s + r.bal, 0),
      receivable_cents: rows.filter((r) => r.bal < 0).reduce((s, r) => s - r.bal, 0),
    };
  }
  function openItems(ctx, { driver_id, date_from, date_to }) {
    if (!hasPerm(ctx, 'settlement.read')) {
      need(ctx, 'settlement.read.own');
      driver_id = ctx.driver_id;
    }
    const where = ['l.driver_id = ?']; const p = [Number(req(driver_id, '司機'))];
    if (date_from) { where.push('o.pickup_local_date >= ?'); p.push(date_from); }
    if (date_to) { where.push('o.pickup_local_date <= ?'); p.push(date_to); }
    const rows = all(`SELECT o.id AS order_id, o.order_no, o.pickup_local_date, o.pickup_local_time, o.collector, o.status, o.area, o.airport,
                      SUM(l.driver_bal_delta) AS balance
                      FROM order_ledger l JOIN orders o ON o.id = l.order_id WHERE ${where.join(' AND ')}
                      GROUP BY o.id HAVING balance <> 0 ORDER BY o.pickup_at_utc`, ...p);
    return rows.map((r) => {
      const f = orderFinance(r.order_id);
      const inOpen = get(`SELECT s.settlement_no, i.amount_due_cents - i.settled_cents AS remaining FROM settlement_items i JOIN driver_settlements s ON s.id = i.settlement_id
                          WHERE i.order_id = ? AND i.driver_id = ? AND i.status = 'OPEN'`, r.order_id, Number(driver_id));
      return { ...r, direction: r.balance > 0 ? 'PAYABLE' : 'RECEIVABLE', amount_cents: Math.abs(r.balance),
        customer_outstanding_cents: Math.max(0, f.customer_due), fare_cents: f.fare_posted, tip_cents: f.tip_posted, commission_cents: f.commission,
        in_settlement: inOpen?.settlement_no || null };
    });
  }
  function settlementTotals(sid) {
    const s = get('SELECT * FROM driver_settlements WHERE id = ?', sid);
    const items = all('SELECT * FROM settlement_items WHERE settlement_id = ? AND status <> ?', sid, 'VOID');
    const done = items.every((i) => i.settled_cents === i.amount_due_cents);
    const any = items.some((i) => i.settled_cents > 0);
    const status = s.status === 'VOID' ? 'VOID' : done ? 'SETTLED' : any ? 'PARTIAL' : 'OPEN';
    run('UPDATE driver_settlements SET status = ?, closed_at = ? WHERE id = ?', status, status === 'SETTLED' ? (s.closed_at || now()) : null, sid);
    return status;
  }
  function settleItem(ctx, s, item, amount, type, extra = {}) {
    const o = loadOrder(item.order_id);
    const od = item.direction === 'PAYABLE' ? -amount : amount;
    post(ctx, o, { type, amount: type === 'SETTLEMENT_OFFSET' ? od : amount, od, driver_id: s.driver_id, settlement_id: s.id, ...extra });
    const settled = item.settled_cents + amount;
    run(`UPDATE settlement_items SET settled_cents = ?, offset_cents = offset_cents + ?, status = ? WHERE id = ?`,
      settled, type === 'SETTLEMENT_OFFSET' ? amount : 0, settled === item.amount_due_cents ? 'SETTLED' : 'OPEN', item.id);
    item.settled_cents = settled;
  }
  function createSettlement(ctx, d) {
    need(ctx, 'settlement.write');
    return db.tx(() => {
      const driverId = Number(req(d.driver_id, '司機'));
      const drv = get('SELECT * FROM drivers WHERE id = ?', driverId);
      if (!drv) throw new AppError('找不到司機', 'NOT_FOUND', 404);
      const ids = (d.order_ids || []).map(Number);
      if (!ids.length) throw new AppError('請至少選擇一筆待結算訂單', 'VALIDATION');
      const avail = new Map(openItems(ctx, { driver_id: driverId, date_from: d.date_from, date_to: d.date_to }).map((r) => [r.order_id, r]));
      const chosen = ids.map((id) => {
        const it = avail.get(id);
        if (!it) throw new AppError(`訂單 #${id} 不在此司機/期間的未結清項目中`, 'VALIDATION');
        if (it.in_settlement) throw new AppError(`${it.order_no} 已在未結清結算單 ${it.in_settlement} 中`, 'DUPLICATE_SETTLEMENT_ITEM', 409);
        return it;
      });
      const payable = chosen.filter((c) => c.direction === 'PAYABLE').reduce((s, c) => s + c.amount_cents, 0);
      const receivable = chosen.filter((c) => c.direction === 'RECEIVABLE').reduce((s, c) => s + c.amount_cents, 0);
      const wantOffset = !!d.offset?.enabled;
      if (wantOffset) {
        need(ctx, 'settlement.offset_authorize');
        if (d.offset.authorize !== true) throw new AppError('淨額抵銷需勾選明確授權', 'OFFSET_NOT_AUTHORIZED', 403);
        req(d.offset.note, '抵銷授權說明');
        if (!payable || !receivable) throw new AppError('所選項目只有單一方向，無需抵銷', 'VALIDATION');
      }
      const no = nextNo('driver_settlements', 'settlement_no', `ST-${ymd(todayLocal(env.now()))}-`, 3);
      const offset = wantOffset ? Math.min(payable, receivable) : 0;
      const r = run(`INSERT INTO driver_settlements (settlement_no, driver_id, period_from, period_to, payable_cents, receivable_cents, offset_cents,
                     offset_authorized_by, offset_authorized_at, offset_note, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      no, driverId, d.date_from || chosen[0].pickup_local_date, d.date_to || chosen.at(-1).pickup_local_date, payable, receivable, offset,
      wantOffset ? ctx.id : null, wantOffset ? now() : null, wantOffset ? d.offset.note : null, d.note || null, ctx.id, now());
      const s = get('SELECT * FROM driver_settlements WHERE id = ?', r.id);
      const items = chosen.map((c) => {
        const ir = run(`INSERT INTO settlement_items (settlement_id, order_id, driver_id, direction, amount_due_cents) VALUES (?,?,?,?,?)`,
          r.id, c.order_id, driverId, c.direction, c.amount_cents);
        return get('SELECT * FROM settlement_items WHERE id = ?', ir.id);
      });
      if (offset > 0) {
        for (const dir of ['PAYABLE', 'RECEIVABLE']) {
          let left = offset;
          for (const it of items.filter((i) => i.direction === dir)) {
            if (!left) break;
            const x = Math.min(left, it.amount_due_cents - it.settled_cents);
            settleItem(ctx, s, it, x, 'SETTLEMENT_OFFSET', { memo: `經授權淨額抵銷（${no}）：${d.offset.note}` });
            left -= x;
          }
        }
      }
      settlementTotals(r.id);
      audit(ctx, 'settlement.create', 'settlement', r.id,
        `建立結算單 ${no}（${drv.name}）：公司應付 $${(payable / 100).toFixed(2)}、司機應繳 $${(receivable / 100).toFixed(2)}${offset ? `、授權抵銷 $${(offset / 100).toFixed(2)}` : '、不抵銷'}`,
        null, { order_ids: ids, payable, receivable, offset }, wantOffset ? d.offset.note : null);
      return getSettlement(ctx, r.id);
    });
  }
  function settlementPayment(ctx, sid, d) {
    need(ctx, 'settlement.write');
    return db.tx(() => {
      const s = get('SELECT * FROM driver_settlements WHERE id = ?', sid);
      if (!s || ['VOID', 'SETTLED'].includes(s.status)) throw new AppError('結算單不存在或已結清', 'INVALID_STATE', 409);
      const dir = oneOf(d.direction, ['PAYOUT', 'REMIT'], '付款方向');
      const itemDir = dir === 'PAYOUT' ? 'PAYABLE' : 'RECEIVABLE';
      const only = d.order_ids?.length ? d.order_ids.map(Number) : null;
      const items = all(`SELECT i.* FROM settlement_items i JOIN orders o ON o.id = i.order_id WHERE i.settlement_id = ? AND i.direction = ? AND i.status = 'OPEN'
                         ORDER BY o.pickup_at_utc`, sid, itemDir).filter((i) => !only || only.includes(i.order_id));
      const outstanding = items.reduce((t, i) => t + i.amount_due_cents - i.settled_cents, 0);
      const amount = cents(d.amount_cents, '付款金額', { allowZero: false });
      if (!outstanding) throw new AppError('此方向沒有未結金額', 'VALIDATION');
      if (amount > outstanding) throw new AppError(`金額超過未結餘額 $${(outstanding / 100).toFixed(2)}`, 'OVERPAYMENT', 409);
      if (d.confirm !== true) throw new AppError('結算付款需勾選確認', 'CONFIRM_REQUIRED');
      const no = nextNo('payment_records', 'payment_no', 'PAY-', 6);
      const pr = run(`INSERT INTO payment_records (payment_no, kind, settlement_id, driver_id, party, method, amount_cents, status, reference, note,
                      confirmed_at, confirmed_by, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      no, dir === 'PAYOUT' ? 'DRIVER_PAYOUT' : 'DRIVER_REMIT', sid, s.driver_id, 'COMPANY', oneOf(d.method || 'ZELLE', ENUMS.method, '付款方式'),
      amount, 'CONFIRMED', d.reference || null, d.note || null, now(), ctx.id, ctx.id, now());
      let left = amount;
      for (const it of items) {
        if (!left) break;
        const x = Math.min(left, it.amount_due_cents - it.settled_cents);
        settleItem(ctx, s, it, x, dir === 'PAYOUT' ? 'SETTLEMENT_PAYOUT' : 'SETTLEMENT_REMIT',
          { payment_id: pr.id, memo: `${dir === 'PAYOUT' ? '公司付司機' : '司機繳公司'}（${s.settlement_no} / ${no}）` });
        left -= x;
      }
      run(`UPDATE driver_settlements SET ${dir === 'PAYOUT' ? 'paid_to_driver_cents' : 'received_from_driver_cents'} = ${dir === 'PAYOUT' ? 'paid_to_driver_cents' : 'received_from_driver_cents'} + ? WHERE id = ?`, amount, sid);
      const st = settlementTotals(sid);
      audit(ctx, 'settlement.payment', 'settlement', sid, `${s.settlement_no} ${dir === 'PAYOUT' ? '公司付司機' : '司機繳公司'} $${(amount / 100).toFixed(2)}（${no}）→ ${st}`, null, { payment_id: pr.id, amount, direction: dir });
      return getSettlement(ctx, sid);
    });
  }
  function voidSettlement(ctx, sid, { reason }) {
    need(ctx, 'settlement.write');
    return db.tx(() => {
      const s = get('SELECT * FROM driver_settlements WHERE id = ?', sid);
      if (!s || s.status === 'VOID') throw new AppError('結算單不存在或已作廢', 'INVALID_STATE', 409);
      if (s.paid_to_driver_cents || s.received_from_driver_cents || s.offset_cents) throw new AppError('已有付款或抵銷的結算單不可作廢', 'INVALID_STATE', 409);
      req(reason, '作廢原因');
      run(`UPDATE settlement_items SET status='VOID' WHERE settlement_id = ?`, sid);
      run(`UPDATE driver_settlements SET status='VOID', closed_at=? WHERE id = ?`, now(), sid);
      audit(ctx, 'settlement.void', 'settlement', sid, `作廢結算單 ${s.settlement_no}`, null, null, reason);
    });
  }
  function listSettlements(ctx, f = {}) {
    if (!hasPerm(ctx, 'settlement.read')) { need(ctx, 'settlement.read.own'); f.driver_id = ctx.driver_id; }
    const where = []; const p = [];
    if (f.driver_id) { where.push('s.driver_id = ?'); p.push(Number(f.driver_id)); }
    if (f.status) { where.push('s.status = ?'); p.push(f.status); }
    if (f.date_from) { where.push('s.period_to >= ?'); p.push(f.date_from); }
    if (f.date_to) { where.push('s.period_from <= ?'); p.push(f.date_to); }
    return all(`SELECT s.*, d.name AS driver_name, d.driver_no, u.display_name AS offset_authorized_by_name,
                (SELECT COUNT(*) FROM settlement_items i WHERE i.settlement_id = s.id) AS item_count
                FROM driver_settlements s JOIN drivers d ON d.id = s.driver_id LEFT JOIN users u ON u.id = s.offset_authorized_by
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.id DESC`, ...p);
  }
  function getSettlement(ctx, sid) {
    const s = listSettlements(ctx, {}).find((x) => x.id === Number(sid));
    if (!s) throw new AppError('找不到結算單', 'NOT_FOUND', 404);
    return {
      ...s,
      items: all(`SELECT i.*, o.order_no, o.pickup_local_date, o.collector, o.area, o.airport FROM settlement_items i JOIN orders o ON o.id = i.order_id
                  WHERE i.settlement_id = ? ORDER BY o.pickup_at_utc`, sid),
      payments: all(`SELECT p.*, u.display_name AS recorded_by_name FROM payment_records p LEFT JOIN users u ON u.id = p.recorded_by WHERE p.settlement_id = ? ORDER BY p.id`, sid),
      audit: hasPerm(ctx, 'audit.read') ? all(`SELECT * FROM audit_logs WHERE entity_type='settlement' AND entity_id=? ORDER BY id DESC`, sid) : [],
    };
  }

  // ---------- 戰情室 ----------
  function dashboard(ctx, { period = 'today', date } = {}) {
    need(ctx, 'dashboard.view');
    const today = date || todayLocal(env.now());
    const ranges = { today: { from: today, to: today }, week: weekRange(today), month: monthRange(today) };
    const range = ranges[period] || ranges.today;
    const count = (r) => get(`SELECT COUNT(*) AS n FROM orders WHERE status <> 'CANCELLED' AND pickup_local_date BETWEEN ? AND ?`, r.from, r.to).n;
    const fin = get(`SELECT
        COALESCE(SUM(CASE WHEN l.entry_type IN ('FARE','EXTRA','FARE_ADJUST') THEN l.amount_cents END),0) AS fare_posted,
        COALESCE(SUM(CASE WHEN l.entry_type = 'TIP' THEN l.amount_cents END),0) AS tip_posted,
        COALESCE(SUM(l.revenue_delta),0) AS commission,
        COALESCE(SUM(CASE WHEN l.entry_type IN ('CUSTOMER_PAYMENT','CUSTOMER_REFUND') OR (l.entry_type='REVERSAL' AND l.payment_id IS NOT NULL AND l.settlement_id IS NULL) THEN -l.customer_due_delta END),0) AS received
      FROM order_ledger l JOIN orders o ON o.id = l.order_id WHERE o.pickup_local_date BETWEEN ? AND ?`, range.from, range.to);
    const outstanding = all(`SELECT o.id, SUM(l.customer_due_delta) AS due FROM orders o JOIN order_ledger l ON l.order_id = o.id
        WHERE o.status IN ('COMPLETED','CANCELLED') AND o.pickup_local_date BETWEEN ? AND ? GROUP BY o.id HAVING due > 0`, range.from, range.to)
      .reduce((s, r) => s + r.due, 0);
    const bookedRows = all(`SELECT fare_cents, commission_base_cents, commission_rate_bps FROM orders
        WHERE status IN ('PENDING_DISPATCH','ASSIGNED','ACCEPTED') AND pickup_local_date BETWEEN ? AND ?`, range.from, range.to);
    const booked = { fare: bookedRows.reduce((t, r) => t + r.fare_cents, 0), n: bookedRows.length,
      est_comm: bookedRows.reduce((t, r) => t + applyBps(r.commission_base_cents, r.commission_rate_bps), 0) };
    const pendingPay = get(`SELECT COALESCE(SUM(p.amount_cents),0) AS s FROM payment_records p JOIN orders o ON o.id = p.order_id
        WHERE p.status='PENDING' AND o.pickup_local_date BETWEEN ? AND ?`, range.from, range.to).s;
    const bal = all(`SELECT driver_id, order_id, SUM(driver_bal_delta) AS b FROM order_ledger WHERE driver_id IS NOT NULL GROUP BY driver_id, order_id HAVING b <> 0`);
    const tomorrow = addDays(today, 1);
    const orderBrief = (where, ...p) => all(`SELECT o.id, o.order_no, o.pickup_local_date, o.pickup_local_time, o.trip_type, o.airport, o.area, o.flight_no,
        o.passengers, o.vehicle_type, o.status, o.contact_name, d.name AS driver_name FROM orders o LEFT JOIN drivers d ON d.id = o.current_driver_id
        WHERE ${where} ORDER BY o.pickup_at_utc`, ...p);
    const drivers = all(`SELECT d.id, d.driver_no, d.name,
        (SELECT COUNT(*) FROM orders o WHERE o.current_driver_id = d.id AND o.status <> 'CANCELLED' AND o.pickup_local_date BETWEEN ? AND ?) AS orders,
        (SELECT COUNT(*) FROM orders o WHERE o.current_driver_id = d.id AND o.status = 'COMPLETED' AND o.pickup_local_date BETWEEN ? AND ?) AS completed,
        (SELECT COALESCE(SUM(l.revenue_delta),0) FROM order_ledger l JOIN orders o ON o.id = l.order_id WHERE l.driver_id = d.id AND o.pickup_local_date BETWEEN ? AND ?) AS commission,
        (SELECT COUNT(*) FROM dispatches x JOIN orders o ON o.id = x.order_id WHERE x.driver_id = d.id AND x.status = 'REJECTED' AND o.pickup_local_date BETWEEN ? AND ?) AS rejected
        FROM drivers d WHERE d.status = 'ACTIVE' ORDER BY commission DESC, orders DESC`, range.from, range.to, range.from, range.to, range.from, range.to, range.from, range.to);
    const routes = all(`SELECT airport, area, trip_type, COUNT(*) AS n, SUM(fare_cents) AS fare FROM orders WHERE status <> 'CANCELLED'
        AND pickup_local_date BETWEEN ? AND ? GROUP BY airport, area ORDER BY n DESC, fare DESC LIMIT 5`, range.from, range.to);
    const cust = get(`SELECT COUNT(*) AS buyers, SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) AS repeaters FROM
        (SELECT customer_id, COUNT(*) AS n FROM orders WHERE status <> 'CANCELLED' GROUP BY customer_id)`);
    const topRepeat = all(`SELECT c.id, c.customer_no, c.name, COUNT(o.id) AS n, MAX(o.pickup_local_date) AS last_date FROM customers c JOIN orders o ON o.customer_id = c.id
        WHERE o.status <> 'CANCELLED' GROUP BY c.id HAVING n >= 2 ORDER BY n DESC, last_date DESC LIMIT 5`);
    return {
      today, period, range,
      counts: { today: count(ranges.today), week: count(ranges.week), month: count(ranges.month) },
      fare_posted_cents: fin.fare_posted, tip_posted_cents: fin.tip_posted, commission_cents: fin.commission,
      received_cents: fin.received, outstanding_cents: outstanding, pending_payment_cents: pendingPay,
      booked_fare_cents: booked.fare, booked_commission_est_cents: booked.est_comm, booked_count: booked.n,
      company_owes_drivers_cents: bal.filter((b) => b.b > 0).reduce((s, b) => s + b.b, 0),
      drivers_owe_company_cents: bal.filter((b) => b.b < 0).reduce((s, b) => s - b.b, 0),
      pending_dispatch: orderBrief(`o.status = 'PENDING_DISPATCH' AND o.pickup_local_date >= ?`, today),
      awaiting_confirm: orderBrief(`o.status = 'ASSIGNED' AND o.pickup_local_date >= ?`, today),
      tomorrow: orderBrief(`o.status <> 'CANCELLED' AND o.pickup_local_date = ?`, tomorrow),
      drivers, routes,
      repurchase: { buyers: cust.buyers || 0, repeaters: cust.repeaters || 0, rate: cust.buyers ? (cust.repeaters || 0) / cust.buyers : 0, top: topRepeat },
    };
  }

  function auditLogs(ctx, f = {}) {
    need(ctx, 'audit.read');
    const where = []; const p = [];
    if (f.entity_type) { where.push('entity_type = ?'); p.push(f.entity_type); }
    if (f.entity_id) { where.push('entity_id = ?'); p.push(Number(f.entity_id)); }
    if (f.action) { where.push('action LIKE ?'); p.push(f.action + '%'); }
    if (f.q) { where.push('(summary LIKE ? OR reason LIKE ? OR actor_name LIKE ?)'); p.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`); }
    return all(`SELECT * FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${Number(f.limit) || 300}`, ...p);
  }

  /** 全系統對帳恆等式：公司現金 − 公司應付司機淨額 ＝ 佣金收入 − 客戶未付 − 帳務調整 */
  function reconcile() {
    const t = get(`SELECT
        COALESCE(SUM(customer_due_delta),0) AS customer_due, COALESCE(SUM(driver_bal_delta),0) AS driver_bal, COALESCE(SUM(revenue_delta),0) AS revenue,
        COALESCE(SUM(CASE WHEN entry_type='ADJUSTMENT' THEN amount_cents WHEN entry_type='REVERSAL' AND reversal_of IN (SELECT id FROM order_ledger WHERE entry_type='ADJUSTMENT') THEN amount_cents END),0) AS adjustments
      FROM order_ledger`);
    const cash = get(`SELECT
        COALESCE(SUM(CASE WHEN kind='CUSTOMER_PAYMENT' AND party='COMPANY' THEN amount_cents
                          WHEN kind='CUSTOMER_REFUND' AND party='COMPANY' THEN -amount_cents
                          WHEN kind='DRIVER_PAYOUT' THEN -amount_cents WHEN kind='DRIVER_REMIT' THEN amount_cents END),0) AS company_cash
      FROM payment_records WHERE status = 'CONFIRMED'`).company_cash;
    const lhs = cash - t.driver_bal;
    const rhs = t.revenue - t.customer_due - t.adjustments;
    return { company_cash: cash, ...t, lhs, rhs, balanced: lhs === rhs };
  }

  return {
    init, isEmpty, login, logout, userByToken, createUser,
    listCustomers, getCustomer, createCustomer, updateCustomer,
    listDrivers, createDriver, updateDriver, createVehicle,
    listOrders, getOrder, createOrder, updateOrder, cancelOrder, completeOrder,
    assign, acceptDispatch, rejectDispatch, cancelDispatch, reassign, dispatchHistory,
    recordCustomerPayment, confirmPayment, voidPayment, refund, addLedgerEntry, listLedger, ledgerSummary, orderFinance,
    openItems, createSettlement, settlementPayment, voidSettlement, listSettlements, getSettlement, driverBalance,
    dashboard, auditLogs, reconcile, enums: ENUMS, utcToLocal,
    // 測試用：繞過業務邏輯直接寫入，用以驗證資料庫層限制
    _rawInsertDispatch(orderId, driverId) {
      run(`INSERT INTO dispatches (order_id, driver_id, status, assigned_at) VALUES (?,?,?,?)`, orderId, driverId, 'ASSIGNED', now());
    },
    _countDuplicateActiveDispatch() {
      return get(`SELECT COUNT(*) AS n FROM (SELECT order_id FROM dispatches WHERE status IN ('ASSIGNED','ACCEPTED','COMPLETED') GROUP BY order_id HAVING COUNT(*) > 1)`).n;
    },
  };
}
