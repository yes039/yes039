# 交付四｜Claude AI 資料分析技術架構與成本比較

## 1. 四條資料取得路線比較

| 構面 | **A 手動匯出 Excel／CSV** | B 排程匯出 | C 廠商 API／唯讀介接 | D 既有報表轉換 |
|---|---|---|---|---|
| 方法 | 在後台開報表，按匯出 | 系統每日自動產出檔案 | 廠商提供 API 或唯讀檢視表 | 把報表列印成 PDF（或截圖），再轉成表格 |
| 手冊證據 | **D**（只有列印） | **D** | **D**（手冊未提及，**不得假設存在**） | C（Windows 系統通常可用「列印到 PDF」） |
| 技術可行性 | 取決於 G1 實測 | 取決於廠商 | 取決於廠商與授權 | **高**（最低保證） |
| 資料完整性 | 中高（報表粒度） | 高 | **最高**（可取得逐筆資料） | 中（只有報表粒度，可能有轉換誤差） |
| 建置成本 | 幾乎為 0 | 低至中（廠商費用不明） | 中至高（廠商報價不明，需資安評估） | 低（轉換腳本約 1–2 天） |
| 維護成本 | 人力：每週約 15–30 分鐘 | 低 | 中（版本升級可能中斷） | 中（報表格式一變，解析就要調整） |
| 操作難度 | 低（照截圖步驟操作） | 無 | 無 | 低 |
| 更新頻率 | 每週（建議） | 每日 | 每日或即時 | 每週 |
| 資安與權限 | 檔案經人手；**送出前需先去除個資** | 檔案落在店內電腦 | 需唯讀帳號、最小權限、廠商同意 | 同 A |
| **結論** | **G1 優先驗證** | 等廠商回覆 | 只在 B 無法達成、且確有逐筆需求時評估 | **A 失敗時的保底** |

**禁止事項重申**：不直接連線正式 POS 資料庫；不使用「手動傳輸、總部匯出、全面下傳」功能來取資料；不安裝任何第三方工具到 POS 電腦。

## 2. 分析架構

```
WISE POS 後台（總部帳號，只看報表）
   │  ① 人工匯出（路線 A）或列印成 PDF（路線 D）
   ▼
raw/ 原始檔（不修改，保留做稽核）
   │  ② 去除個資，並將員工、會員代碼改為雜湊值（店內電腦執行）
   ▼
clean/ 標準化 CSV（依下方資料字典）＋ 外部 X1–X5
   │  ③ 驗證、去重、對帳（不通過就停止）
   ▼
Claude 分析（Project 內固定提示詞與資料字典）
   │  ④ 產出四張報表
   ▼
A 經營總覽｜B 採購成本｜C 三增方案追蹤｜D 人力貢獻
   │  ⑤ 改善建議（每條附數據來源）
   ▼
六週 KPI 追蹤表（口徑見交付三 E 節）
```

## 3. 建議匯出的原始檔案清單

| 檔號 | 來源報表 | 期間 | 頻率 | 用途 |
|---|---|---|---|---|
| F01 | R02 日銷售統計表 | 基準 4 週＋每週 | 每週 | A、KPI |
| F02 | R01 營業總表 | 同上 | 每週 | 對帳總數 |
| F03 | R03 收銀時段分析表 | 同上 | 每週 | 每小時、三增時段 |
| F04 | R04 班別銷售統計表 | 同上 | 每週 | D |
| F05 | R06 銷售方式分析表 | 同上 | 每週 | 內用、外帶、外送 |
| F06 | R07 商品銷售明細表 | 同上 | 每週 | 品項、理論耗用 |
| F07 | R11 類別銷售統計表 | 同上 | 每週 | 品類 |
| F08 | R14 商品單品組合銷售分析表 | 同上 | 每週 | 合菜、家庭餐 |
| F09 | R16＋R18 折扣報表 | 同上 | 每週 | 折扣率 |
| F10 | R19＋R21＋R20 銷退、退廚房、招待 | 同上 | 每週 | 異常 |
| F11 | R22 付款方式統計表 | 同上 | 每週 | 對帳 |
| F12 | R12 商品銷售毛利分析表 | 同上 | 每週 | **先驗證成本是否有效** |
| F13 | 商品主檔（類別、售價、庫存屬性） | 一次 | 異動時更新 | 維度表 |
| F14 | 逐筆交易（若 A、B、C 任一路線可行） | 基準 4 週 | 每週 | 客單價分布、每小時 |

## 4. 資料字典（標準化後的欄位）

| 檔案 | 欄位（型別） | 主鍵 |
|---|---|---|
| fact_daily（F01） | store_id（文字）、biz_date（日期）、net_sales（數值）、order_cnt（整數）、service_fee（數值）、discount_amt（數值） | store_id + biz_date |
| fact_hourly（F03） | store_id、biz_date、hour_slot（時段起，例 "21:00"）、net_sales、order_cnt | store_id + biz_date + hour_slot |
| fact_shift（F04） | store_id、biz_date、shift_code、net_sales、order_cnt | store_id + biz_date + shift_code |
| fact_channel（F05） | store_id、biz_date、sales_mode（內用、外帶、外送、平台名）、net_sales、order_cnt | store_id + biz_date + sales_mode |
| fact_item（F06） | store_id、period_start、period_end、item_id、qty、gross_amt、discount_amt、net_amt | store_id + period + item_id |
| fact_txn（F14） | store_id、txn_id（單據編號）、txn_datetime、checkout_datetime、pos_no（機號）、sales_mode、status、net_sales、service_fee、round_off、staff_hash、member_hash、orig_txn_id | store_id + txn_id |
| fact_txn_line（F14） | store_id、txn_id、line_no、item_id、qty、unit_price、discount_amt、subtotal、addon_text | store_id + txn_id + line_no |
| dim_item（F13） | item_id、item_name、category_id、category_name、stock_attr（不扣、扣自身、扣配方）、list_price、is_new_offer（標記三增商品） | item_id |
| ext_purchase（X1） | date、supplier_id、ing_id、spec、unit、qty、unit_cost、amount、doc_no | doc_no + ing_id |
| ext_stock（X2） | count_date、ing_id、qty_end、unit_cost、waste_qty、waste_reason | count_date + ing_id |
| ext_recipe（X3） | item_id、ing_id、qty_per_unit、unit、loss_rate | item_id + ing_id |
| ext_roster（X4） | work_date、staff_hash、role、shift_code、clock_in、clock_out、break_min | work_date + staff_hash + clock_in |
| ext_payroll（X5） | month、staff_hash、pay_type、rate、ot_pay、employer_cost | month + staff_hash |

**關聯鍵**：
- `item_id` 連接 fact_item、fact_txn_line、dim_item、ext_recipe（ext_recipe 再以 `ing_id` 連到 ext_purchase、ext_stock）。
- `biz_date` 加上 `shift_code` 連接 fact_shift 與 ext_roster。
- `staff_hash` 連接 ext_roster 與 ext_payroll。
- `txn_id` 連接 fact_txn 與 fact_txn_line；`orig_txn_id` 指向原單，用來處理銷退。

## 5. 驗證、去重、對帳規則

| # | 規則 | 不通過時 |
|---|---|---|
| V1 | Σ fact_daily.net_sales（期間）= 營業總表（F02）總額，誤差 ≤ 1 元 | 停止，回頭檢查匯出 |
| V2 | Σ fact_hourly = Σ fact_shift = Σ fact_channel = fact_daily（同日） | 標示差異，查明是否含作廢、服務費 |
| V3 | Σ 付款方式（F11）= 營業額 ± 溢收、找零、贈券 | 列出差異 |
| V4 | 主鍵唯一；重複時保留最後一次匯出的版本 | 自動去重並記錄 |
| V5 | 日期連續，不缺日；公休日要有紀錄 | 補匯出 |
| V6 | fact_txn：status 為作廢者不計入營收；銷退以 orig_txn_id 沖銷原單 | — |
| V7 | fact_txn_line 小計總和 − 折價 = 單頭實銷金額 | 列出異常單 |
| V8 | 掃描個資：電話格式、身分證格式、Email、姓名欄位出現就攔截 | **不得送進 Claude** |
| V9 | 傳輸日誌（T06）中，該期間每日都要有成功紀錄 | 該日標示「資料不完整」 |
| V10 | 毛利報表成本為 0 或空值的比例 > 5% | 毛利改用 X3 計算 |

## 6. Claude 分析工作流程（每週一次）

1. 店內人員依交付五匯出 F01–F13，放進 `raw/週次/`。
2. 在店內電腦執行去識別與標準化腳本（G1 核准後才開發），產出 `clean/`、驗證報告與 PII 掃描結果。
3. 驗證全部通過後，把 `clean/` 上傳到 Claude Project。Project 中固定放資料字典、KPI 口徑與歷週結論。
4. Claude 產出四張報表＋改善建議。每一條建議都要附「數據 → 判斷 → 行動 → 預期影響 → 下週驗證指標」。
5. 總指揮核可後，更新 KPI 追蹤表。

## 7. 自動化升級路徑

| 階段 | 內容 | 前提 |
|---|---|---|
| L0（G1） | 人工匯出＋人工上傳＋Claude 分析 | 路線 A 或 D 可行 |
| L1 | 店內腳本一鍵完成清洗、驗證、去識別，並產生 Excel 或 HTML 儀表板 | L0 跑順 2 週 |
| L2 | 排程匯出（B）＋資料夾監看，自動執行清洗；週報自動產出、人工審核 | 廠商確認可排程匯出 |
| L3 | 廠商唯讀介接（C）＋每日更新儀表板 | 廠商書面同意、唯讀帳號、資安評估、總指揮核准 |

## 8. 成本比較（估算，未含廠商報價）

| 項目 | L0／L1 | L2 | L3 |
|---|---|---|---|
| 軟體 | Claude 付費方案（依實際方案計價，需另行核價） | 同左 | 同左＋可能的 API 用量費 |
| 廠商費用 | 0 | **待報價** | **待報價** |
| 建置人力 | 清洗腳本約 2–3 人天 | 再加約 2 人天 | 約 5–10 人天 |
| 店內人力／週 | 約 30 分鐘 | 約 5 分鐘 | 約 0 |
| 風險 | 人為漏匯 | 廠商依賴 | 廠商依賴、資安 |

> 金額未列者，一律標示「待報價」或「需核價」。本表不做任何未經證實的承諾。
