# 02｜資料庫 ERD 與欄位規格

原型實作：`core/schema.js`（SQLite 方言）。正式版建議移植 PostgreSQL，型別對照見文末。

## 設計原則

| 原則 | 做法 |
|---|---|
| 金額精度 | 全部 `INTEGER` 美分（`*_cents`），禁止浮點。費率以 basis points 儲存（1500 = 15.00%）。 |
| 時間 | 時間點存 UTC ISO-8601（`*_at`、`pickup_at_utc`）；營運分組另存洛杉磯當地日期 `pickup_local_date`／時間 `pickup_local_time` 與當時偏移 `pickup_utc_offset`（-420=PDT、-480=PST）。 |
| 帳本不可改 | `order_ledger` 只新增不修改、不刪除；更正以 `REVERSAL` 或調整分錄處理。 |
| 一單一有效派車 | `dispatches` 部分唯一索引 `ux_dispatch_one_active`（status ∈ ASSIGNED/ACCEPTED/COMPLETED）。程式與資料庫雙層保護，測試情境 8 驗證繞過程式直接寫入也會被擋。 |
| 未收到不算已收 | `payment_records.status`：PENDING（已登錄未到帳）不入帳；只有 CONFIRMED 才寫入帳本。 |
| 抵銷需授權 | `driver_settlements` CHECK：`offset_cents = 0 OR offset_authorized_by IS NOT NULL`。 |
| 可追溯 | 所有寫入動作都寫 `audit_logs`（前後值 JSON、原因、操作人、時間）。 |
| 併發 | `orders.version` 樂觀鎖；交易使用 `BEGIN IMMEDIATE` 與 SAVEPOINT。 |

## ERD

```mermaid
erDiagram
  roles ||--o{ users : "role_code"
  drivers ||--o| users : "driver 帳號綁定"
  users ||--o{ sessions : ""
  customers ||--o{ orders : "customer_id"
  drivers ||--o{ vehicles : "driver_id"
  orders ||--o{ dispatches : "派車歷史（最多 1 筆有效）"
  drivers ||--o{ dispatches : ""
  vehicles ||--o{ dispatches : ""
  drivers ||--o{ orders : "current_driver_id"
  orders ||--o{ payment_records : "客戶付款/退款"
  orders ||--o{ order_ledger : "分錄"
  payment_records ||--o{ order_ledger : "payment_id"
  drivers ||--o{ driver_settlements : ""
  driver_settlements ||--o{ settlement_items : ""
  orders ||--o{ settlement_items : ""
  driver_settlements ||--o{ payment_records : "結算付款"
  driver_settlements ||--o{ order_ledger : "settlement_id"
  users ||--o{ audit_logs : "actor"

  customers { int id PK; text customer_no UK; text name; text phone; text phone_normalized UK; text contact_channel; text line_id; text addresses; text notes }
  drivers { int id PK; text driver_no UK; text name; text phone; text license_no; text status; text payout_method }
  vehicles { int id PK; int driver_id FK; text plate_no UK; text vehicle_type; int seats; int luggage_capacity }
  orders { int id PK; text order_no UK; int customer_id FK; text pickup_local_date; text pickup_at_utc; int fare_cents; int tip_cents; int commission_base_cents; int commission_rate_bps; text collector; text status; int current_driver_id FK; int version }
  dispatches { int id PK; int order_id FK; int driver_id FK; int vehicle_id FK; text status; text reason }
  payment_records { int id PK; text payment_no UK; text kind; int order_id FK; int settlement_id FK; text party; int amount_cents; text status }
  order_ledger { int id PK; int order_id FK; int driver_id FK; text entry_type; int amount_cents; int customer_due_delta; int driver_bal_delta; int revenue_delta; int reversal_of FK }
  driver_settlements { int id PK; text settlement_no UK; int driver_id FK; int payable_cents; int receivable_cents; int offset_cents; int offset_authorized_by FK; text status }
  settlement_items { int id PK; int settlement_id FK; int order_id FK; int driver_id FK; text direction; int amount_due_cents; int settled_cents; text status }
  audit_logs { int id PK; int actor_user_id FK; text action; text entity_type; int entity_id; text before_json; text after_json; text reason }
  users { int id PK; text username UK; text role_code FK; int driver_id FK; text password_hash }
  roles { text code PK; text permissions }
  sessions { text token PK; int user_id FK; text expires_at }
```

## 資料表欄位規格

### customers｜客戶
| 欄位 | 型別 | 限制 | 說明 |
|---|---|---|---|
| id | INTEGER | PK | |
| customer_no | TEXT | NOT NULL, UNIQUE | `C0001` 起編 |
| name | TEXT | NOT NULL | |
| phone / phone_normalized | TEXT | 正規化電話部分唯一索引 | 只留數字查重，避免重複建檔 |
| contact_channel | TEXT | CHECK PHONE/LINE/WECHAT/REFERRAL/REPEAT/OTHER | 聯絡管道 |
| line_id, email | TEXT | | |
| addresses | TEXT(JSON) | 預設 `[]` | 常用地址；正式版拆 `customer_addresses` 表 |
| notes | TEXT | | |
| 歷史訂單、累計車資 | — | 查詢計算 | 累計車資＝已入帳 FARE＋FARE_ADJUST＋EXTRA，不存冗餘欄位 |

索引：`ux_customers_phone`、`ix_customers_name`。

### drivers｜司機、vehicles｜車輛
| 欄位 | 說明 |
|---|---|
| drivers.driver_no | `D001`，UNIQUE |
| drivers.status | ACTIVE / INACTIVE（停用司機不可被指派） |
| drivers.payout_method | 僅記錄（Zelle/Check），不串金流 |
| vehicles.plate_no | UNIQUE |
| vehicles.vehicle_type | SEDAN/SUV/VAN/LUXURY |
| vehicles.seats | 指派時檢查 ≥ 乘客數 |

### orders｜訂單
| 欄位 | 型別 | 說明 |
|---|---|---|
| order_no | TEXT UNIQUE | `AIR-YYMMDD-NNN`（依接送日期） |
| customer_id | FK customers | |
| contact_name / contact_phone | TEXT | 下單當時聯絡人快照 |
| source | CHECK | PHONE/LINE/REPEAT/REFERRAL/OTHER |
| trip_type | CHECK | ARRIVAL 接機 / DEPARTURE 送機 / OTHER |
| airport, flight_no | TEXT | LAX/SNA/ONT/BUR/LGB |
| pickup_local_date / pickup_local_time | TEXT | 洛杉磯當地日期時間（報表分組依據） |
| pickup_at_utc / pickup_utc_offset | TEXT / INT | 精確時間點與當時偏移 |
| dst_ambiguous | 0/1 | 秋季撥慢重疊時段，需人工確認 |
| pickup_address / dropoff_address / area | TEXT | area＝非機場端城市（熱門路線） |
| passengers / luggage / vehicle_type | | 人數 1–20 |
| fare_cents | INT ≥ 0 | 車資（完成時以實收車資覆寫，並記錄原因） |
| tip_cents | INT ≥ 0 | 小費 |
| commission_base_cents | INT ≥ 0 | **訂單確認的佣金計算基礎**（預設＝車資，≤ 車資） |
| commission_rate_bps | INT | 下單時費率快照，預設 1500 |
| collector | CHECK | COMPANY 公司收款 / DRIVER 司機收款 |
| payment_method | CHECK | CASH/ZELLE/VENMO/CARD/CHECK/OTHER |
| status | CHECK | PENDING_DISPATCH → ASSIGNED → ACCEPTED → COMPLETED；任一未完成狀態可 → CANCELLED |
| current_driver_id | FK drivers | 目前有效派車司機（冗餘，便於查詢） |
| version | INT | 樂觀鎖 |

索引：`ix_orders_pickup(pickup_local_date, pickup_local_time)`、`ix_orders_status(status, pickup_local_date)`、`ix_orders_customer`、`ix_orders_driver`。

### dispatches｜派車歷史
| 欄位 | 說明 |
|---|---|
| status | ASSIGNED 已指派 / ACCEPTED 司機確認 / REJECTED 拒單 / CANCELLED 撤回或改派 / COMPLETED 完成 |
| assigned_by / assigned_at / responded_by / responded_at / ended_at | 每一步的人與時間 |
| reason / note | 拒單、改派、取消原因 |

**唯一性**：`ux_dispatch_one_active ON dispatches(order_id) WHERE status IN ('ASSIGNED','ACCEPTED','COMPLETED')`。拒單、改派不刪除舊紀錄，只改狀態。

### payment_records｜收付款紀錄
| 欄位 | 說明 |
|---|---|
| kind | CUSTOMER_PAYMENT 客戶付款 / CUSTOMER_REFUND 退款 / DRIVER_PAYOUT 公司付司機 / DRIVER_REMIT 司機繳公司 |
| order_id / settlement_id | 至少一個非空（CHECK） |
| party | 客戶款由誰收／退：COMPANY / DRIVER |
| amount_cents | > 0（方向由 kind 決定） |
| status | PENDING（不入帳）/ CONFIRMED（入帳）/ VOID（作廢，已入帳者寫反向分錄） |
| confirmed_by / confirmed_at / voided_at / void_reason | 稽核 |

### order_ledger｜訂單帳本（append-only）
每筆分錄同時記錄對三個餘額的影響：

| 欄位 | 意義 |
|---|---|
| customer_due_delta | 客戶應付餘額變動（＋＝客戶多欠，−＝客戶已付） |
| driver_bal_delta | 「公司應付司機」變動（負值＝司機應繳公司） |
| revenue_delta | 平台佣金收入變動 |

| entry_type | customer_due | driver_bal | revenue | 何時產生 |
|---|---|---|---|---|
| FARE（commissionable=1 為抽佣部分） | +車資 | +車資 | 0 | 完成接送 |
| TIP | +小費 | +小費 | 0 | 完成接送 |
| COMMISSION | 0 | −佣金 | +佣金 | 完成接送／基礎變動時補差額 |
| EXTRA | +金額 | +金額（無司機則 0） | 0（無司機則 +金額） | 額外費用 |
| FARE_ADJUST | ±金額 | ±金額 | 0（另觸發 COMMISSION 差額） | 完成後車資調整、退款沖減 |
| CUSTOMER_PAYMENT | −金額 | 司機收：−金額；公司收：0 | 0 | 款項 CONFIRMED |
| CUSTOMER_REFUND | +金額 | 司機退：+金額；公司退：0 | 0 | 退款 |
| ADJUSTMENT | 0 | ±金額 | 0 | 公司↔司機帳務調整 |
| SETTLEMENT_PAYOUT | 0 | −金額 | 0 | 公司付司機 |
| SETTLEMENT_REMIT | 0 | +金額 | 0 | 司機繳公司 |
| SETTLEMENT_OFFSET | 0 | 應付方 −x／應繳方 +x | 0 | 經授權抵銷 |
| REVERSAL | 原分錄取負 | 原分錄取負 | 原分錄取負 | 作廢款項 |

### driver_settlements / settlement_items｜司機結算
| 欄位 | 說明 |
|---|---|
| settlement_no | `ST-YYMMDD-NNN` |
| period_from / period_to | 洛杉磯當地日期範圍 |
| payable_cents / receivable_cents | 公司應付司機、司機應繳公司（**毛額，分開記**） |
| offset_cents + offset_authorized_by/at/note | 授權抵銷；CHECK 無授權人不得 > 0 |
| paid_to_driver_cents / received_from_driver_cents | 累計付款 |
| status | OPEN / PARTIAL / SETTLED / VOID |
| items.direction | PAYABLE 公司付司機 / RECEIVABLE 司機繳公司 |
| items.amount_due_cents / offset_cents / settled_cents | 建立時快照、抵銷、已結（含抵銷）；CHECK settled ≤ due |

唯一性：`ux_settlement_item_open ON settlement_items(order_id, driver_id) WHERE status='OPEN'`：同一訂單不能同時在兩張未結清的結算單裡。

### audit_logs｜操作紀錄
`action`（如 `order.update_financial`、`dispatch.reject`、`payment.void`、`settlement.create`）、`entity_type/entity_id`、`summary`、`before_json/after_json`、`reason`、`actor_user_id/actor_name`、`created_at`。登入失敗也會記錄。

### users / roles / sessions｜登入與權限
| 角色 | 權限重點 |
|---|---|
| OWNER 老闆 | 全部（`*`），唯一可授權淨額抵銷、重置資料 |
| DISPATCHER 調度員 | 客戶、訂單、派車、登錄客戶付款（非現金自動「待確認」）、查帳本 |
| ACCOUNTANT 會計 | 確認到帳、作廢、退款、帳務調整、建立結算單與付款（不可抵銷） |
| DRIVER 司機 | 只看自己的任務；接單／拒單／回報完成；查自己的結算 |

權限在伺服器端檢查（`core/service.js` 的 `need()`），前端隱藏按鈕只是介面便利。

## 原型持久化方式

| 模式 | 儲存 | 定位 |
|---|---|---|
| 伺服器模式 `npm start` | `data/air001.db`（node:sqlite，WAL） | 原型的單一資料來源，可重啟保留、可備份檔案 |
| 展示模式（Artifact／無伺服器） | 瀏覽器記憶體中的 sql.js，同一份 schema 與業務程式 | **只供展示**，重新整理即重建；不寫 localStorage |

兩種模式都**不是正式財務帳本**。瀏覽器只存語言偏好與伺服器模式的登入 token（sessionStorage），不存任何帳務資料。

## PostgreSQL 移植對照
| SQLite 原型 | PostgreSQL 正式版 |
|---|---|
| INTEGER 美分 | `BIGINT`（或 `NUMERIC(14,0)`） |
| TEXT ISO 時間 | `TIMESTAMPTZ`；當地日期 `DATE` |
| TEXT + CHECK 列舉 | `ENUM` 型別或參照表 |
| addresses JSON | `customer_addresses` 表 |
| 部分唯一索引 | 相同語法 `CREATE UNIQUE INDEX ... WHERE` |
| 帳本 append-only | 加 `REVOKE UPDATE, DELETE` 與觸發器阻擋修改 |
| app_meta.schema_version | 改用 migration 工具（Prisma Migrate / Drizzle / Flyway） |
