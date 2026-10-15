-- 宣傳戰情室 資料表（Cloudflare D1 / SQLite）
-- 四層：專案 → 活動 → 素材／渠道；總覽由各專案彙總。
-- 每張業務資料表都帶 project_id，查詢一律先依專案過濾，不跨專案混算。

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,            -- 專案代碼，例如 JSN
  claim_prefix TEXT NOT NULL UNIQUE,    -- LINE 領取碼字首，例如 J
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '合作',     -- 合作／自有課程／客戶／自有品牌
  partner TEXT NOT NULL DEFAULT '',     -- 合作對象或客戶
  owner TEXT NOT NULL DEFAULT '',       -- 我方負責人
  goal TEXT NOT NULL DEFAULT '',        -- 專案目標（文字）
  budget INTEGER,                       -- 專案總預算（元），未定為 NULL
  currency TEXT NOT NULL DEFAULT 'TWD',
  status TEXT NOT NULL DEFAULT '規劃中', -- 規劃中／進行中／暫停／已結束
  metrics_json TEXT NOT NULL,           -- 本專案的成果指標定義（各專案自訂）
  settings_json TEXT NOT NULL DEFAULT '{}', -- 判斷門檻等
  data_scope TEXT NOT NULL DEFAULT '',  -- 資料使用範圍
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 專案成員（系統管理者另由環境變數 ADMIN_EMAILS 指定，可看全部專案）
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',  -- viewer／editor
  PRIMARY KEY (project_id, email)
);

-- 專案使用的帳號與入口（粉專、廣告帳號、LINE、落地頁、報名系統、收款）
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,                   -- fb_page／ad_account／line_oa／landing／enroll／payment／other
  name TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',       -- 帳號歸屬
  payer TEXT NOT NULL DEFAULT '',       -- 付款方
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_project ON accounts (project_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,            -- 專案代碼-YYMM-NN
  name TEXT NOT NULL,
  offer TEXT NOT NULL DEFAULT '',       -- 推廣什麼
  audience TEXT NOT NULL DEFAULT '',    -- 對誰
  destination TEXT NOT NULL DEFAULT '', -- 導向哪裡
  flow TEXT NOT NULL DEFAULT '',        -- 領取流程：甲／乙／丙／不適用
  start_date TEXT,
  end_date TEXT,
  budget INTEGER,
  target_cpl INTEGER,                   -- 目標每筆有效名單成本
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '規劃中',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS campaigns_project ON campaigns (project_id);

-- 素材／渠道：FB 廣告、免費貼文、LINE 訊息、QR、合作方渠道等
CREATE TABLE IF NOT EXISTS creatives (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,            -- 活動代碼-格式碼NN-vN
  name TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,                -- fb_ad／fb_post／line／qr／partner／other
  paid INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '規劃中',
  platform_ref TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS creatives_campaign ON creatives (campaign_id);

CREATE TABLE IF NOT EXISTS tracking_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  creative_id TEXT,
  base_url TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_term TEXT NOT NULL DEFAULT '',
  full_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, full_url)
);

CREATE TABLE IF NOT EXISTS claim_codes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  creative_id TEXT,
  code TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, code)
);

-- 廣告每日數字（Meta 匯出 CSV 或人工登錄）
CREATE TABLE IF NOT EXISTS ad_daily (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  campaign_id TEXT,                     -- 對應不到時為 NULL，列為待辦
  creative_id TEXT,
  ad_name TEXT NOT NULL DEFAULT '',
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  link_clicks INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual', -- manual／csv
  batch_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, date, ad_name)
);
CREATE INDEX IF NOT EXISTS ad_daily_project_date ON ad_daily (project_id, date);

-- 成果事件：電子書領取、名單、有效名單、報名、付款、退款
-- 一列一件事；person_ref 是電話或 Email 的雜湊（不存原文），用來在同一專案內去重
CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,                   -- claim／lead／valid_lead／enroll／payment／refund
  date TEXT NOT NULL,
  campaign_id TEXT,                     -- NULL ＝ 來源不明
  creative_id TEXT,
  claim_code TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  amount REAL NOT NULL DEFAULT 0,
  person_ref TEXT,
  external_ref TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  batch_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS conversions_project_date ON conversions (project_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS conversions_external ON conversions (project_id, type, external_ref) WHERE external_ref IS NOT NULL;

-- 各專案的資料來源狀態
CREATE TABLE IF NOT EXISTS sources (
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,                   -- ads／claim／lead／enroll／payment
  connected INTEGER NOT NULL DEFAULT 0,
  covered_through TEXT,                 -- 資料已更新到哪一天（含）
  updated_at TEXT,
  note TEXT NOT NULL DEFAULT '',        -- 缺漏原因
  PRIMARY KEY (project_id, kind)
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,                   -- ads／outcomes
  filename TEXT NOT NULL DEFAULT '',
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  who TEXT NOT NULL,
  action TEXT NOT NULL,
  project_id TEXT,
  detail TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
