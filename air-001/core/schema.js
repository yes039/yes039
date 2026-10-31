// AIR-001 資料模型（SQLite 方言；正式版移植 PostgreSQL，見 docs/02-資料庫ERD與欄位規格.md）
// 原則：金額 INTEGER 美分；時間點 TEXT UTC ISO-8601；營運日期另存洛杉磯當地日期。
export const SCHEMA_VERSION = 1;

export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  code          TEXT PRIMARY KEY,                -- OWNER / DISPATCHER / ACCOUNTANT / DRIVER
  name_zh       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  permissions   TEXT NOT NULL                    -- JSON 陣列
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  role_code     TEXT NOT NULL REFERENCES roles(code),
  driver_id     INTEGER REFERENCES drivers(id),  -- 司機帳號綁定司機資料
  password_hash TEXT NOT NULL,                   -- scrypt$salt$hash（原型）；正式版交由身分服務
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id               INTEGER PRIMARY KEY,
  customer_no      TEXT NOT NULL UNIQUE,         -- C0001
  name             TEXT NOT NULL,
  phone            TEXT,
  phone_normalized TEXT,                         -- 只留數字，用於查重
  contact_channel  TEXT NOT NULL DEFAULT 'PHONE' CHECK (contact_channel IN ('PHONE','LINE','WECHAT','REFERRAL','REPEAT','OTHER')),
  line_id          TEXT,
  email            TEXT,
  addresses        TEXT NOT NULL DEFAULT '[]',   -- JSON 陣列：常用地址（正式版拆 customer_addresses）
  notes            TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone ON customers(phone_normalized) WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';
CREATE INDEX IF NOT EXISTS ix_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS drivers (
  id            INTEGER PRIMARY KEY,
  driver_no     TEXT NOT NULL UNIQUE,            -- D001
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  license_no    TEXT,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  payout_method TEXT,                            -- Zelle / Check ...（僅記錄，不串金流）
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id            INTEGER PRIMARY KEY,
  driver_id     INTEGER REFERENCES drivers(id),
  plate_no      TEXT NOT NULL UNIQUE,
  make_model    TEXT NOT NULL,
  vehicle_type  TEXT NOT NULL CHECK (vehicle_type IN ('SEDAN','SUV','VAN','LUXURY')),
  seats         INTEGER NOT NULL CHECK (seats > 0),
  luggage_capacity INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_vehicles_driver ON vehicles(driver_id);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY,
  order_no           TEXT NOT NULL UNIQUE,       -- AIR-YYMMDD-NNN
  customer_id        INTEGER NOT NULL REFERENCES customers(id),
  contact_name       TEXT NOT NULL,              -- 下單時聯絡人快照
  contact_phone      TEXT,
  source             TEXT NOT NULL CHECK (source IN ('PHONE','LINE','REPEAT','REFERRAL','OTHER')),
  trip_type          TEXT NOT NULL CHECK (trip_type IN ('ARRIVAL','DEPARTURE','OTHER')), -- 接機/送機/其他
  airport            TEXT NOT NULL,              -- LAX/SNA/ONT/BUR/LGB
  flight_no          TEXT,
  pickup_local_date  TEXT NOT NULL,              -- 洛杉磯當地日期（報表分組依據）
  pickup_local_time  TEXT NOT NULL,
  pickup_at_utc      TEXT NOT NULL,              -- 精確時間點
  pickup_utc_offset  INTEGER NOT NULL,           -- 分鐘，-420=PDT, -480=PST
  dst_ambiguous      INTEGER NOT NULL DEFAULT 0,
  pickup_address     TEXT NOT NULL,
  dropoff_address    TEXT NOT NULL,
  area               TEXT NOT NULL,              -- 非機場端城市，用於熱門路線
  passengers         INTEGER NOT NULL CHECK (passengers BETWEEN 1 AND 20),
  luggage            INTEGER NOT NULL DEFAULT 0 CHECK (luggage >= 0),
  vehicle_type       TEXT NOT NULL CHECK (vehicle_type IN ('SEDAN','SUV','VAN','LUXURY')),
  fare_cents         INTEGER NOT NULL CHECK (fare_cents >= 0),          -- 報價車資
  tip_cents          INTEGER NOT NULL DEFAULT 0 CHECK (tip_cents >= 0), -- 預計小費
  commission_base_cents INTEGER NOT NULL CHECK (commission_base_cents >= 0), -- 訂單確認的佣金計算基礎
  commission_rate_bps   INTEGER NOT NULL DEFAULT 1500,                  -- 下單當時費率快照
  collector          TEXT NOT NULL CHECK (collector IN ('COMPANY','DRIVER')),  -- 收款方
  payment_method     TEXT NOT NULL CHECK (payment_method IN ('CASH','ZELLE','VENMO','CARD','CHECK','OTHER')),
  status             TEXT NOT NULL DEFAULT 'PENDING_DISPATCH'
                     CHECK (status IN ('PENDING_DISPATCH','ASSIGNED','ACCEPTED','COMPLETED','CANCELLED')),
  current_driver_id  INTEGER REFERENCES drivers(id),
  notes              TEXT,
  completed_at       TEXT,
  cancelled_at       TEXT,
  cancel_reason      TEXT,
  version            INTEGER NOT NULL DEFAULT 1, -- 樂觀鎖
  created_by         INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_orders_pickup ON orders(pickup_local_date, pickup_local_time);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status, pickup_local_date);
CREATE INDEX IF NOT EXISTS ix_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS ix_orders_driver ON orders(current_driver_id, pickup_local_date);

CREATE TABLE IF NOT EXISTS dispatches (
  id              INTEGER PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  driver_id       INTEGER NOT NULL REFERENCES drivers(id),
  vehicle_id      INTEGER REFERENCES vehicles(id),
  status          TEXT NOT NULL CHECK (status IN ('ASSIGNED','ACCEPTED','REJECTED','CANCELLED','COMPLETED')),
  assigned_by     INTEGER REFERENCES users(id),
  assigned_at     TEXT NOT NULL,
  responded_at    TEXT,
  responded_by    INTEGER REFERENCES users(id),
  ended_at        TEXT,
  reason          TEXT,                          -- 拒單／取消／改派原因
  note            TEXT
);
-- 核心限制：同一訂單只能有一筆「有效派車」
CREATE UNIQUE INDEX IF NOT EXISTS ux_dispatch_one_active ON dispatches(order_id) WHERE status IN ('ASSIGNED','ACCEPTED','COMPLETED');
CREATE INDEX IF NOT EXISTS ix_dispatch_driver ON dispatches(driver_id, assigned_at);

CREATE TABLE IF NOT EXISTS driver_settlements (
  id                    INTEGER PRIMARY KEY,
  settlement_no         TEXT NOT NULL UNIQUE,     -- ST-YYMMDD-NNN
  driver_id             INTEGER NOT NULL REFERENCES drivers(id),
  period_from           TEXT NOT NULL,            -- 洛杉磯當地日期
  period_to             TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','SETTLED','VOID')),
  payable_cents         INTEGER NOT NULL DEFAULT 0,  -- 公司應付司機（毛額）
  receivable_cents      INTEGER NOT NULL DEFAULT 0,  -- 司機應繳公司（毛額）
  offset_cents          INTEGER NOT NULL DEFAULT 0,  -- 經授權的淨額抵銷
  offset_authorized_by  INTEGER REFERENCES users(id),
  offset_authorized_at  TEXT,
  offset_note           TEXT,
  paid_to_driver_cents  INTEGER NOT NULL DEFAULT 0,
  received_from_driver_cents INTEGER NOT NULL DEFAULT 0,
  note                  TEXT,
  created_by            INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL,
  closed_at             TEXT,
  CHECK (offset_cents = 0 OR offset_authorized_by IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_settlement_driver ON driver_settlements(driver_id, status);

CREATE TABLE IF NOT EXISTS settlement_items (
  id                 INTEGER PRIMARY KEY,
  settlement_id      INTEGER NOT NULL REFERENCES driver_settlements(id),
  order_id           INTEGER NOT NULL REFERENCES orders(id),
  driver_id          INTEGER NOT NULL REFERENCES drivers(id),
  direction          TEXT NOT NULL CHECK (direction IN ('PAYABLE','RECEIVABLE')), -- PAYABLE=公司付司機
  amount_due_cents   INTEGER NOT NULL CHECK (amount_due_cents > 0),   -- 建立時快照
  offset_cents       INTEGER NOT NULL DEFAULT 0,
  settled_cents      INTEGER NOT NULL DEFAULT 0,  -- 含抵銷與付款
  status             TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SETTLED','VOID')),
  CHECK (settled_cents <= amount_due_cents)
);
-- 同一訂單同時只能在一張未結清的結算單中
CREATE UNIQUE INDEX IF NOT EXISTS ux_settlement_item_open ON settlement_items(order_id, driver_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS ix_settlement_items_settlement ON settlement_items(settlement_id);

CREATE TABLE IF NOT EXISTS payment_records (
  id              INTEGER PRIMARY KEY,
  payment_no      TEXT NOT NULL UNIQUE,           -- PAY-NNNNNN
  kind            TEXT NOT NULL CHECK (kind IN ('CUSTOMER_PAYMENT','CUSTOMER_REFUND','DRIVER_PAYOUT','DRIVER_REMIT')),
  order_id        INTEGER REFERENCES orders(id),
  settlement_id   INTEGER REFERENCES driver_settlements(id),
  driver_id       INTEGER REFERENCES drivers(id),
  party           TEXT NOT NULL CHECK (party IN ('COMPANY','DRIVER')), -- 客戶款：由誰收/退；結算款：COMPANY
  method          TEXT NOT NULL CHECK (method IN ('CASH','ZELLE','VENMO','CARD','CHECK','OTHER')),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  status          TEXT NOT NULL CHECK (status IN ('PENDING','CONFIRMED','VOID')), -- 只有 CONFIRMED（確認到帳/已執行）才入帳
  reference       TEXT,
  note            TEXT,
  confirmed_at    TEXT,
  confirmed_by    INTEGER REFERENCES users(id),
  recorded_by     INTEGER REFERENCES users(id),
  recorded_at     TEXT NOT NULL,
  voided_at       TEXT,
  void_reason     TEXT,
  CHECK (order_id IS NOT NULL OR settlement_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_payments_order ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS ix_payments_settlement ON payment_records(settlement_id);

-- 訂單帳本：只增不改（append-only），更正一律以反向分錄處理
CREATE TABLE IF NOT EXISTS order_ledger (
  id                  INTEGER PRIMARY KEY,
  order_id            INTEGER NOT NULL REFERENCES orders(id),
  driver_id           INTEGER REFERENCES drivers(id),
  entry_type          TEXT NOT NULL CHECK (entry_type IN (
                        'FARE','TIP','EXTRA','FARE_ADJUST','COMMISSION',
                        'CUSTOMER_PAYMENT','CUSTOMER_REFUND','ADJUSTMENT',
                        'SETTLEMENT_PAYOUT','SETTLEMENT_REMIT','SETTLEMENT_OFFSET','REVERSAL')),
  amount_cents        INTEGER NOT NULL,           -- 分錄金額（帶正負）
  commissionable      INTEGER NOT NULL DEFAULT 0,
  customer_due_delta  INTEGER NOT NULL DEFAULT 0, -- 對「客戶應付餘額」的影響
  driver_bal_delta    INTEGER NOT NULL DEFAULT 0, -- 對「公司應付司機」的影響（負值＝司機應繳公司）
  revenue_delta       INTEGER NOT NULL DEFAULT 0, -- 對「平台佣金收入」的影響
  party               TEXT,                       -- 收/付款方 COMPANY/DRIVER
  payment_id          INTEGER REFERENCES payment_records(id),
  settlement_id       INTEGER REFERENCES driver_settlements(id),
  reversal_of         INTEGER REFERENCES order_ledger(id),
  memo                TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ledger_order ON order_ledger(order_id);
CREATE INDEX IF NOT EXISTS ix_ledger_driver ON order_ledger(driver_id, created_at);
CREATE INDEX IF NOT EXISTS ix_ledger_type ON order_ledger(entry_type, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  actor_name    TEXT NOT NULL,
  action        TEXT NOT NULL,                   -- 例：order.create / dispatch.reject / payment.void
  entity_type   TEXT NOT NULL,
  entity_id     INTEGER,
  summary       TEXT,
  before_json   TEXT,
  after_json    TEXT,
  reason        TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_time ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export const ROLES = {
  OWNER: { zh: '老闆／總管理', en: 'Owner', perms: ['*'] },
  DISPATCHER: {
    zh: '調度員', en: 'Dispatcher',
    perms: ['dashboard.view', 'customer.read', 'customer.write', 'order.read', 'order.write', 'dispatch.manage',
      'ledger.read', 'payment.customer', 'driver.read', 'audit.read'],
  },
  ACCOUNTANT: {
    zh: '會計', en: 'Accountant',
    perms: ['dashboard.view', 'customer.read', 'order.read', 'driver.read', 'ledger.read', 'payment.customer',
      'payment.confirm', 'ledger.adjust', 'settlement.read', 'settlement.write', 'audit.read'],
  },
  DRIVER: { zh: '司機', en: 'Driver', perms: ['dispatch.respond', 'order.read.own', 'settlement.read.own'] },
};
