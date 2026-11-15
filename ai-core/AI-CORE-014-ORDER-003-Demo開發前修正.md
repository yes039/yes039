# AI-CORE-014-ORDER-003｜Demo 開發前修正回報

- 主責：Claude Code（CC）
- 回報日期：2026-11-15
- 狀態：**修正完成，等待總指揮核准帳號建立與開發**
- 執行聲明：本次仍**未**建立任何帳號、**未**部署、**未**寫任何產品程式碼、**未**使用真實個資。
- 範圍：單店預約 Demo；不做金流、不做多店家、不用真實個資（沿用初審決議）。

> **查證方法說明（第 5 項必讀）**：本環境的網路政策封鎖直接開啟 vercel.com、supabase.com、developers.line.biz、tw.linebiz.com 官方網頁（DNS 解析被拒）。因此查證改用搜尋引擎讀取**官方頁面的索引內容**，並逐條附上官方網址。第 5 節以「✅ 官方來源確認／⚠️ 僅第三方來源／❓ 未能確認」標示可信度。標 ⚠️ 或 ❓ 的項目，帳號建立當天由人工登入官網再核對一次（列在第 5.4 節）。

---

## 1. 三天規劃：必要功能與選配功能分離

### 1.1 原則
- **主線 A（必要）**：獨立預約核心，**完全不依賴 LINE**。五項驗收門檻全部由主線 A 達成。
- **支線 B（選配）**：LINE 登入與通知。限時 **4 小時**，只能在主線 A 當日目標完成後才開始。
- 支線 B 卡關 → 停止投入，標記「**LINE 待驗**」，**不得宣稱通過**，不影響 Demo 驗收。

### 1.2 功能分級

| 分級 | 功能 | 驗收門檻對應 |
|---|---|---|
| 🔴 必要 | 資料表、RLS、假資料匯入 | 門檻 2、3 |
| 🔴 必要 | 時段查詢（只回傳時間，不回傳他人資料） | 門檻 2 |
| 🔴 必要 | 建立預約 RPC + 資料庫排他約束（防重疊） | 門檻 1 |
| 🔴 必要 | 示範模式登入（Supabase 匿名登入，見第 2 節） | 門檻 4 |
| 🔴 必要 | 我的預約：查詢、取消 | 門檻 2、4 |
| 🔴 必要 | 後台：管理員登入、預約列表、標記到店／爽約 | 門檻 3 |
| 🔴 必要 | 自動化測試：並發、RLS、後台授權 | 門檻 1–3 |
| 🔴 必要 | 手機實測（iOS、Android 各 1 台）+ 工時／成本／問題清單 | 門檻 4、5 |
| 🟡 選配 | LINE 登入（第 3 節流程） | 不列入門檻 |
| 🟡 選配 | LINE 預約成功／取消通知 | 不列入門檻 |
| 🟡 選配 | 後台「手動發送提醒」 | 不列入門檻 |
| ⚪ 不做 | 改期、排班介面、自動排程提醒、Email／SMS、金流、多店 | — |

### 1.3 修正後三天排程

| 天 | 主線 A（必要） | 當日關卡 | 支線 B（選配，限時） |
|---|---|---|---|
| D1 | 專案骨架、資料表、RLS、假資料；時段查詢；建立預約 RPC + 排他約束；**並發測試** | 門檻 1 通過才進 D2 | 不做 |
| D2 | 示範模式登入；我的預約（查詢、取消）；顧客端畫面手機版；**RLS 越權測試** | 門檻 2 通過 | 主線完成後：LINE 登入 + Token 驗證，**上限 4 h** |
| D3 | 後台登入與列表；到店／爽約；**後台授權測試**；手機實測；預覽部署（第 4 節）；工時／成本／問題清單 | 門檻 3、4、5 | 若 D2 LINE 登入成功：LINE 通知，上限 2 h；否則不做 |

**最壞情況**：LINE 完全未完成，Demo 仍以「示範模式」交付全部五項門檻，LINE 列為待驗並寫明卡在哪一步。

---

## 2. 示範模式：假資料隔離、不得取得管理員權限

### 2.1 機制
- 示範顧客使用 **Supabase 匿名登入**：每位訪客取得一個真實但匿名的使用者身分（JWT 帶 `is_anonymous = true`）。不需要 Email、電話或 LINE，因此**不產生任何個資**。
- 所有權限判斷都以 `auth.uid()` 為準，示範顧客只能看到自己建立的預約。

### 2.2 資料隔離

| 措施 | 內容 |
|---|---|
| 資料標記 | `bookings.data_scope`：`demo`（示範模式）／`line_test`（LINE 測試者），由伺服器端函式依登入方式寫入，**用戶端無法指定** |
| 讀取隔離 | RLS：`select` 僅限 `customer_id = auth.uid()`；示範顧客看不到任何其他預約（包括其他示範顧客） |
| 時段可見性 | 他人預約只透過 `get_available_slots()` 函式以「可預約時間」呈現，不回傳姓名、ID、備註 |
| 寫入隔離 | 顧客對 `bookings` **沒有直接 insert/update/delete 權限**；只能呼叫 `create_booking()`、`cancel_booking()`，函式內檢查擁有者與狀態 |
| 定期清除 | `demo` 資料每日清除重建；`line_test` 資料於 Demo 結束後 7 天內刪除 |
| 濫用防護 | 匿名登入開啟 CAPTCHA（Supabase 支援 Cloudflare Turnstile／hCaptcha，免費）+ 每位匿名用戶未完成預約上限 3 筆 |

### 2.3 示範模式不可能成為管理員（多重防線）
1. 管理員身分**只**來自 `admin_users` 資料表，該表對 `anon`、`authenticated` 角色**無任何寫入權限**，只能由資料庫擁有者手動新增。
2. 所有後台函式與 RLS 規則同時檢查：`auth.uid()` 在 `admin_users` 中 **且** `is_anonymous = false`。
3. 管理員帳號以 Email + 密碼登入，**關閉公開註冊**；管理員帳號由人工在 Supabase 後台建立。
4. Next.js 後台路由在伺服器端以 `supabase.auth.getUser()` 向 Supabase 驗證身分（不只讀取瀏覽器 cookie 內容），失敗一律 403。
5. 驗收測試必含：匿名用戶呼叫每一個後台函式與後台 API，全部須被拒絕（第 6 節 T3）。

---

## 3. LINE Token 伺服器驗證、登入狀態與權限檢查

### 3.1 安全原則（依 LINE 官方文件）
- **伺服器不信任用戶端傳來的 userId 或個人資料**。LINE 官方說明惡意用戶端可偽造任意 userId 冒充他人，應傳送原始 ID Token，由伺服器驗證後取得 userId。
- 伺服器以 `POST https://api.line.me/oauth2/v2.1/verify`（參數 `id_token`、`client_id`）驗證；該端點會檢查簽章、發行者、受眾、有效期限與 nonce，成功回應中的 `sub` 即 LINE userId。
- 若改用 Access Token，則以 `GET /oauth2/v2.1/verify?access_token=` 驗證，並**檢查 `client_id` 為本 channel、`expires_in` > 0**。

### 3.2 方案 A（優先）：Supabase 自訂 OIDC Provider
Supabase 官方已支援自訂 OAuth/OIDC Provider（識別碼前綴 `custom:`，Free 方案最多 3 個；可設定 `email_optional`，因 LINE 不一定提供 Email）。

```
LINE 內開啟 → 點「LINE 登入」→ Supabase Auth 導向 LINE 授權（OIDC）
→ LINE 回傳授權碼給 Supabase → Supabase 在伺服器端換取並驗證 ID Token
→ Supabase 建立 session（httpOnly cookie，透過 @supabase/ssr）
```
- 優點：Token 交換與驗證由 Supabase 在伺服器端完成，**不需自行簽發 JWT**，RLS 直接以 `auth.uid()` 運作。
- 待驗：LINE 的 OIDC discovery 是否與 Supabase 相容、LINE App 內瀏覽器的導向是否順暢、Email 選填設定是否有效。

### 3.3 方案 B（備援）：LIFF ID Token → 自有 API 驗證
```
liff.init() → liff.getIDToken() → POST /api/auth/line { idToken }
→ 伺服器呼叫 LINE verify 端點（client_id = LINE Login Channel ID）
→ 驗證成功：取得 sub → 查 line_identities(sub → user_id)，不存在則建立
→ 以 Supabase Admin API 為該使用者建立 session → 設定 httpOnly、Secure、SameSite=Lax cookie
```
- 用戶端**只傳 ID Token**，不傳 userId、名稱、頭像。
- 伺服器拒絕：驗證失敗、`aud` 不符、已過期、同一 Token 重複使用（記錄 Token 雜湊 10 分鐘內拒絕重放）。
- 風險：建立 session 的方式較複雜，需用 service role key，必須確認該金鑰只存在伺服器環境變數。
- LIFF 是否支援 nonce 尚未確認，若不支援，以「短效 + 防重放紀錄」補足。

### 3.4 登入狀態

| 項目 | 設計 |
|---|---|
| Session 儲存 | Supabase session，以 httpOnly cookie 保存（不放 localStorage） |
| 有效期 | Access Token 依 Supabase 預設（約 1 小時）自動以 Refresh Token 換新；登出時撤銷 |
| 伺服器端判斷 | 每個 Server Action／API 以 `supabase.auth.getUser()` 驗證，不使用未驗證的 cookie 內容判斷身分 |
| 登出 | 清除 Supabase session；LINE 登入者另呼叫 `liff.logout()` |

### 3.5 權限矩陣

| 動作 | 未登入 | 示範顧客（匿名） | LINE 顧客 | 管理員 |
|---|---|---|---|---|
| 看店家、服務、可預約時段 | ✅ | ✅ | ✅ | ✅ |
| 建立預約 | ❌ | ✅（`demo`） | ✅（`line_test`） | ✅（代客建立） |
| 查詢預約 | ❌ | 僅自己 | 僅自己 | 全部 |
| 取消預約 | ❌ | 僅自己、狀態為已預約 | 僅自己、狀態為已預約 | 全部 |
| 標記到店／爽約 | ❌ | ❌ | ❌ | ✅ |
| 進入 `/admin` | ❌ | ❌ | ❌ | ✅ |
| 修改服務、營業時間 | ❌ | ❌ | ❌ | Demo 不開放（直接改資料） |

每一格都會寫成自動化測試（第 6 節）。

---

## 4. 預覽部署存取保護

### 4.1 官方查證結論
- Vercel Hobby **沒有** Password Protection（Pro 才有，每個專案每月 US$20）→ 本來就不能、也不採用「簡易密碼」。
- Hobby **有** Vercel Authentication：只有 Vercel 團隊成員、被個別授權的使用者、Shareable Link 持有者可開啟。Hobby 限制：**同一時間只能有 1 位外部使用者**、**只能有 1 個 Shareable Link**。
- Shareable Link 本質上是「拿到網址就能進」，因此**不能作為唯一防線**。

### 4.2 三層保護設計

| 層 | 機制 | 擋住誰 |
|---|---|---|
| 第 1 層：平台 | Vercel Authentication 開啟於所有部署；審查方以「個別授權」方式開通（Hobby 限 1 人）；Shareable Link **預設不建立**，若需要給第 2 位審查者才建立，審查結束立即撤銷 | 一般網路訪客、搜尋引擎、掃描程式 |
| 第 2 層：應用程式 | 真正的身分驗證：後台需管理員帳號（關閉註冊、人工建立）；顧客功能需 Supabase session；所有資料受 RLS 保護 | 即使拿到網址的人，也無法進後台或看他人資料 |
| 第 3 層：資料 | 全部為假資料；`line_test` 資料 7 天內刪除；頁面標示「Demo／測試用」；`noindex` | 即使前兩層失效，也沒有真實個資可外洩 |

- 自動化測試使用 Vercel「Protection Bypass for Automation」密鑰（全方案可用），密鑰只存在 CI 環境變數。
- 待驗：Hobby 的 Vercel Authentication 是否也保護正式網域（`<專案>.vercel.app`）。若不保護，Demo **只使用 Preview 部署，不推正式網域**。

### 4.3 需總指揮決定：Vercel 商用條款灰色地帶
- 官方條款：Hobby 限個人、非商業使用；社群引用的定義為「部署用於任何參與者的經濟利益」即屬商業用途。
- 本 Demo 是內部技術驗證、不收費，但目的是評估未來產品，**可能被認定為商業用途**。
- 選項：
  - **(a) 本機 Demo（建議第一選擇）**：不部署，以本機執行 + 手機連線測試、錄影與截圖給審查方。零條款風險、零費用。缺點：審查方無法自行操作。
  - **(b) Vercel Hobby 預覽部署**：接受灰色地帶風險，限內部審查期間，結束即刪除。
  - **(c) Vercel Pro**：無條款風險，但每月 US$20，**違反本階段不付費限制**，需另案核准。

---

## 5. 免費方案、商用條款與用量限制查證

### 5.1 Vercel Hobby

| 項目 | 查證結果 | 可信度 | 官方來源 |
|---|---|---|---|
| 商用限制 | 限個人、非商業使用；所有商業用途需 Pro 或 Enterprise | ✅ | https://vercel.com/docs/limits/fair-use-guidelines 、https://vercel.com/docs/plans/hobby |
| 商業用途定義 | 「部署用於任何參與者的經濟利益」 | ⚠️ 社群引用條文 | https://community.vercel.com/t/fair-use-of-the-hobby-plan/2725 |
| 超量處理 | 超過用量上限須等 30 天才能再使用該功能（不扣款） | ✅ | https://vercel.com/docs/limits 、https://vercel.com/docs/plans/hobby |
| 函式執行時間 | 預設與上限 300 秒 | ✅ | https://vercel.com/docs/functions/limitations |
| 函式呼叫次數 | 每月 100 萬次（未啟用 Fluid compute 的舊專案可能為 10 萬） | ✅／⚠️ | https://vercel.com/docs/functions/usage-and-pricing |
| 流量 | Fast Data Transfer 每月 100 GB | ✅ | https://vercel.com/docs/limits/fair-use-guidelines |
| Cron | Hobby 每日最多 1 次，且可能在指定小時內任意時間觸發；新版 Schedules 規則不同 | ✅ | https://vercel.com/docs/cron-jobs/usage-and-pricing 、https://vercel.com/docs/schedules |
| Password Protection | Hobby 不提供；Pro 每專案每月 US$20 | ✅ | https://vercel.com/docs/deployment-protection/usage-and-pricing |
| Vercel Authentication | 全方案可用；Hobby 同時僅 1 位外部使用者、1 個 Shareable Link | ✅ | https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication 、https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection |
| 自動化測試繞過 | Protection Bypass for Automation 全方案可用 | ✅ | https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection |
| 是否需綁信用卡 | 未查到明確說明 | ❓ | — |

### 5.2 Supabase Free

| 項目 | 查證結果 | 可信度 | 官方來源 |
|---|---|---|---|
| 費用 | Free 方案不會被收費；超量改為限制服務 | ✅ | https://supabase.com/docs/guides/platform/cost-control |
| 專案數 | 2 個啟用中的專案（暫停的不計） | ✅ | https://supabase.com/pricing 、https://supabase.com/kb/faqs/platform/free-project-pausing |
| 暫停 | 一週低活動量即暫停；暫停前約一週寄信通知；資料保留、可從後台恢復 | ✅ | https://supabase.com/kb/faqs/platform/free-project-pausing 、https://supabase.com/docs/guides/deployment/going-into-prod |
| 備份 | Free 無自動備份可下載；官方建議用 CLI `db dump` 自行備份；Pro 保留 7 天 | ✅ | https://supabase.com/kb/faqs/platform/free-plan-backups 、https://supabase.com/docs/guides/platform/backups |
| 容量 | 資料庫 500 MB、檔案 1 GB、流量 5 GB、MAU 5 萬 | ⚠️ 多為第三方整理，官方定價頁需人工核對 | https://supabase.com/pricing |
| 自訂 OIDC Provider | 支援；Free 最多 3 個；可設 `email_optional` | ✅ | https://supabase.com/docs/guides/auth/custom-oauth-providers |
| 內建 LINE Provider | 無（內建清單不含 LINE） | ✅ | https://supabase.com/docs/guides/auth/social-login |
| 商用限制 | 未查到 Free 方案禁止商用的條文 | ❓ | — |
| 是否需綁信用卡 | 未查到明確說明 | ❓ | — |

### 5.3 LINE

| 項目 | 查證結果 | 可信度 | 官方來源 |
|---|---|---|---|
| ID Token 伺服器驗證 | `POST https://api.line.me/oauth2/v2.1/verify`，參數 `id_token`、`client_id`（選填 `nonce`） | ✅ | https://developers.line.biz/en/reference/line-login/ 、https://developers.line.biz/en/docs/line-login/verify-id-token/ |
| LIFF 傳送使用者資料 | 傳 ID Token 給伺服器驗證，不傳解碼後的個人資料 | ✅ | https://developers.line.biz/en/docs/liff/using-user-profile/ |
| 不信任用戶端 userId | 惡意用戶端可偽造 userId，應傳原始 ID Token | ✅ | https://developers.line.biz/en/docs/line-login-sdks/android-sdk/managing-users/ |
| Reply 訊息 | 不計入方案則數 | ✅ | https://developers.line.biz/en/faq/ 、https://developers.line.biz/en/tips/2026/05/28/how-to-count-messages/ |
| Push 訊息 | 依「請求次數 × 收訊人數」計算；超量時回傳錯誤、不送出（不扣款） | ✅ | https://developers.line.biz/en/docs/messaging-api/pricing/ |
| 台灣方案 2026-11-01 調整 | 官方有公告台灣方案於 2026-11-01 調整 | ✅（有公告，細節未讀到） | https://developers.line.biz/en/news/2026/ |
| 台灣新價格 | 輕用量 NT$0／200 則（不變）；中用量 NT$1,000／3,000 則；高用量 NT$1,400／6,000 則；輕、中用量不能加購 | ⚠️ 多家第三方一致，未讀到官方原文 | 第三方：https://timezone.com.tw/insight/line-oa-price-2026-11/ 、https://www.omago.ai/zh-tw/blog/line-official-account-costs-taiwan |
| LINE Login、LIFF 費用 | 未查到收費說明 | ❓ | — |

> **修正前報告**：原始報告與補充報告中的中用量 NT$800、高用量 NT$1,200 已過時，應更新為 NT$1,000、NT$1,400（2026-11-01 起，⚠️ 待官方核對）。Demo 只用輕用量免費方案，不受影響。

### 5.4 帳號建立當天的人工核對清單
1. Vercel 註冊流程是否要求信用卡（要求即停止回報）。
2. Supabase 註冊流程是否要求信用卡；定價頁 Free 容量數字。
3. Supabase Free 是否有商用限制條文。
4. LINE 官方帳號後台顯示的台灣方案價格。
5. Vercel Hobby 的 Vercel Authentication 是否保護正式網域。
6. Supabase 匿名登入的 CAPTCHA 設定位置。

---

## 6. 驗收測試設計

| 編號 | 門檻 | 測試方法 | 通過標準 |
|---|---|---|---|
| T1 | 20 筆同時搶同一時段 | 測試腳本同時送出 20 個 `create_booking()`（20 個不同匿名用戶，同一人員、同一時段）；連續執行 5 輪 | 每輪恰好 1 筆成功、19 筆回傳「時段已被預約」；資料庫該時段恰 1 筆 |
| T2 | 顧客不能讀取或修改他人預約 | 用戶 A、B 各建 1 筆；B 嘗試：直接查表、以 A 的預約 ID 查詢、`cancel_booking(A 的 ID)`、直接 update/delete | 全部回傳 0 筆或權限錯誤；A 的預約不變 |
| T3 | 未授權者不能操作後台 | 未登入、匿名用戶、LINE 顧客分別：開 `/admin`、呼叫後台 API、呼叫後台資料庫函式、直接改 `admin_users` | 頁面 403／導向登入；API 401/403；函式與資料表權限錯誤 |
| T4 | 手機可預約、查詢、取消 | 自動化手機模擬（iPhone、Pixel）+ 真機 iOS 1 台、Android 1 台，各跑完整流程 | 4 種環境全部通過，附截圖 |
| T5 | 交付工時、成本、問題清單 | 第 7 節表格 | 三份表格完整、每日更新 |
| T6（選配） | LINE 登入 | 偽造 userId、竄改 ID Token、過期 Token、他 channel 的 Token | 全部被拒；正常 Token 登入成功。未完成 → 標記「待驗」 |

---

## 7. 工時、成本與問題紀錄

工作紀錄表範本：`ai-core/AI-CORE-014-工時紀錄表.csv`

### 7.1 工時分類定義

| 類別 | 定義 | 記錄者 |
|---|---|---|
| AI 產碼 | Claude Code 產生或修改程式碼的時間（含 CC 自行執行測試） | CC |
| 人工設定 | 人在平台後台操作：建帳號、LINE Channel、環境變數、部署保護、真機安裝 | 人 |
| 測試 | 執行驗收測試、真機操作、檢查結果 | CC／人分別記 |
| 修正 | 測試失敗後的除錯與修改（區分於初次產碼，用於估算重工比例） | CC／人分別記 |
| 審查 | 人閱讀、確認 AI 產出的程式碼與設計 | 人 |
| 等待 | 等待審核、DNS、平台處理等不可控時間（不計入開發工時，但要記錄） | 人 |

### 7.2 每日回報欄位
- 工時：依 WBS 項目與類別加總，對照補充報告的估計值（預約 41–63 h，3 天 Demo 範圍較小，預估 18–26 h）。
- 成本：各平台當日用量截圖或數字、累計費用（目標 NT$0）。
- 問題清單：編號、發生時間、描述、嚴重度、狀態（未解／已解／待驗）、影響的門檻。

---

## 8. 待總指揮核准事項

| # | 事項 | CC 建議 |
|---|---|---|
| 1 | 核准修正後的三天計畫（主線 A 必要、支線 B 限時選配） | 核准 |
| 2 | 核准建立免費帳號：Supabase Free、LINE Developers、LINE 官方帳號（輕用量）、GitHub Private repo；全部**不綁信用卡** | 核准 |
| 3 | 部署方式：(a) 本機 Demo／(b) Vercel Hobby 預覽部署／(c) Vercel Pro | **(a)**；若審查方需要自行操作再改 (b) |
| 4 | 若選 (b)，是否接受 Vercel 商用條款灰色地帶風險 | 需總指揮判斷 |
| 5 | 指定 LINE 測試人員 1–2 名、團隊註冊信箱 | 請提供 |
