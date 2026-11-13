# AI-CORE-012｜現成系統技術驗證報告（v2：G-001 技術複審版）

| 項目 | 內容 |
|---|---|
| 發令 | Shen｜總指揮 |
| 執行 | CC｜Claude 作戰中心 |
| 技術審查 | G-001｜GPT 五角大廈 |
| 版本 | v2，2026-11-13。依〈G-001 技術複審令〉修訂；v1 留在 git 歷史中 |
| 定位 | 只做技術查證。**沒有部署、沒有付費、沒有使用真實客戶資料，也沒有開發。** |

---

## 0. 結論（BLUF）

| 標的 | 判定 | 一句話理由 |
|---|---|---|
| **Frappe CRM** | **有條件 GO** | 核心需求已在原始碼中確認：AGPL-3.0、不按人頭計費、REST API、外送 Webhook、手機版 PWA、CSV／Excel 匯出。但它**沒有原生 LINE 支援，也沒有內建 AI**，這兩項要自己補。 |
| **ERPNext** | **NO-GO（現階段）** | GPL-3.0，可以商用，但功能遠超接案雷達的需要。等出現開立報價、收款、發票的需求時再重新評估。 |
| **oc8** | **無法評估** | 查不到這個產品。依複審令「未知項不得猜測」，所有欄位都標「未知」。 |

**定位更正（依複審令第 5 點）：**
- **接案雷達**＝**PRO360 的內部工具**，給「店面美學研究所」自己追蹤 PRO360 案件。v1 曾寫成「賣給同業的 SaaS」，那是錯的，已刪除。
- **SEAL-02**＝**AI 經營儀表板**，和接案雷達是兩回事。本報告**不把接案雷達列為 SEAL-02**，也不評估 SEAL-02 的選型。只在 §7 記一點：Frappe CRM 的資料之後可以透過 API 提供給 SEAL-02 使用。

**v1 的錯誤更正：**
1. v1 說 Frappe CRM「沒有原生 FB 整合」。這不精確：它**有原生 Facebook Lead Ads 名單同步**，但**沒有 Messenger 對話整合**。
2. v1 把 ERPNext 授權寫成「憑記憶」。現在已查證：GPL-3.0。
3. v1 把「賣給同業的首月 NT$990 驗證」寫成 30 天計畫。因為定位改成內部工具，這部分已刪除，改成內部試用驗證（見 §6）。

---

## 1. 查證方法與證據等級

| 等級 | 說明 |
|---|---|
| **A｜原始碼** | 直接 shallow clone 官方 GitHub repo（本機只讀，沒有執行），讀 LICENSE 與程式碼 |
| **B｜官方文件（間接）** | docs.frappe.io／frappe.io 的內容，經網路搜尋摘錄取得。**本次環境無法直接開啟這兩個網站**（已申請放行 frappe.io、docs.frappe.io、frappecloud.com，但抓取工具仍然無法解析網址）。所以價格類資料都是 B 級，**付費前要有人親自打開官網核對** |
| **C｜第三方** | 部落格與比較站，只當參考，不作為決策依據 |

**A 級證據的版本（皆為 2026-11-13 取得的預設分支）：**

| Repo | Commit | 版本字串 |
|---|---|---|
| frappe/crm | `73ec05a` | `2.0.0-dev`（develop 分支；穩定版是 main 分支 v1.x） |
| frappe/erpnext | `0993447` | `17.0.0-dev` |
| frappe/frappe | `70931d9` | —（只取部分檔案：webhook、api、data_export、backups） |

> 注意：A 級證據取自 develop 分支。正式導入要用 **main（v1.x）穩定版**。上線前要在 main 分支重新確認同一批檔案。

---

## 2. 授權與商用限制（複審令第 1 點）

| 項目 | Frappe CRM | ERPNext | Frappe Framework | oc8 |
|---|---|---|---|---|
| 授權 | **AGPL-3.0**（`crm/LICENSE` 首行是 "GNU AFFERO GENERAL PUBLIC LICENSE Version 3"）[A] | **GPL-3.0**（`erpnext/license.txt` 首行是 "GNU GENERAL PUBLIC LICENSE Version 3"）[A] | **MIT**（`frappe/LICENSE`）[A] | 未知 |
| 不一致之處 | `crm/package.json` 寫 `"license": "GPL-3.0"`，和 LICENSE 檔不同。**以 LICENSE 檔（AGPL）為準**，但建議向 Frappe 確認 [A] | `erpnext/package.json` 也寫 GPL-3.0，兩處一致 [A] | — | 未知 |
| 可以商用嗎 | 可以。AGPL 不禁止商用 | 可以 | 可以 | 未知 |
| 主要義務 | 如果**修改**程式碼，並讓**第三方透過網路使用**，就要提供修改後的原始碼 | 散布修改版時要公開原始碼；只透過網路提供服務則不觸發 | 保留著作權聲明 | 未知 |
| 對接案雷達的影響 | **低**。這是內部工具，而且只用官方版本、不改核心，客製功能放在獨立的 app 或 n8n | 現階段不用 | — | — |
| 商標 | 未查到 CRM 專屬的商標政策 | `TRADEMARK_POLICY.md`：未經許可，不能把「ERPNext」用在產品、服務、公司或網域名稱，也**不能用在廣告**（含 AdWords）[A] | — | 未知 |

**建議：** 接案雷達不能取名為「ERPNext／Frappe ○○」。如果將來要對外銷售，或修改 CRM 核心，要請法務確認 AGPL 義務。

---

## 3. 功能查證（複審令第 2 點）

| 功能 | Frappe CRM | 證據 | ERPNext | oc8 |
|---|---|---|---|---|
| **原生 AI** | **沒有**。原始碼中找不到 OpenAI、Anthropic、LLM 的呼叫。`domain_enrichment` 模組是**規則式**網站爬取，README 明寫「rule-based」，不是 AI | A | 沒有查證 | 未知 |
| **AI 對接管道** | Frappe Framework **v16 起內建 MCP server**（`/api/v2/mcp`，新網站預設啟用）。CRM main 分支支援 Frappe v15／v16，所以**要用 v16 才有**。CRM repo 也附了一份 `skills/frappe-crm/SKILL.md`，供 AI agent 操作 Lead 和 Deal | B（MCP）／A（SKILL.md） | 同一個框架 | 未知 |
| **REST API** | 有。`/api/resource/...`（v1）與 `/api/v2/document/<doctype>`（v2）[A：`frappe/api/v2.py`]，用 API key 驗證 | A | 同 | 未知 |
| **外送 Webhook** | 有。Frappe 的 `Webhook` DocType 可以在 `after_insert`、`on_update`、`on_change`、`workflow_transition` 等事件觸發，可設條件與自訂 Header [A：`webhook.json`] | A | 同 | 未知 |
| **接收 Webhook** | 可以用 whitelisted method 當接收端（CRM 的 Twilio、Exotel 就是這樣做的）。**接 LINE 需要另外寫程式或用 n8n** | A | 同 | 未知 |
| **LINE Messaging API** | **沒有原生支援**。原始碼中沒有 `api.line.me` 或 LINE channel 相關的程式碼 | A | 沒有 | 未知 |
| **Facebook** | **Lead Ads 名單同步：有原生支援**。`lead_syncing` 模組含 `Facebook Page`、`Facebook Lead Form` 等 DocType，透過 `graph.facebook.com` 拉取 leadgen 表單，同步失敗會留紀錄 [A]。**Messenger 對話：沒有** | A | 沒有 | 未知 |
| **WhatsApp** | 要另外裝社群 app `shridarpatil/frappe_whatsapp`。`crm/api/whatsapp.py` 是它的對接層 | A（README） | — | 未知 |
| **電話** | Twilio、Exotel 內建 | A | — | 未知 |

**LINE 整合可行性：可行，但要自己做。** 做法：LINE webhook → n8n（或自寫小型 Frappe app）→ 呼叫 Frappe REST API 寫入 Lead 或留言；反方向由 Frappe Webhook 通知 n8n → 呼叫 LINE Reply／Push API。限制：LINE 不能匯入聯絡人，客人要主動加好友或傳訊息才會出現。**PRO360 沒有公開 API，案件要人工建檔。**

**FB 整合可行性：** 如果用 FB／IG 名單型廣告，可以直接用原生 Lead Ads 同步。Messenger 對話則和 LINE 一樣，要自己串 Meta Graph API，複雜度更高（需要通過 App 審查），**建議先不做**。

---

## 4. 手機體驗、匯出、備份（複審令第 4 點）

| 項目 | 查證結果 | 證據 |
|---|---|---|
| 手機版介面 | 有專門的手機版版面 `MobileLayout.vue`，以及 `MobileLead`、`MobileDeal`、`MobileContact`、`MobileOrganization`、`MobileNotification` 頁面。螢幕寬度小於 768px 時自動切換（`isMobileView`） | A |
| 安裝成 App | 有 PWA（`vite-plugin-pwa` 與 manifest），可以從手機瀏覽器「加入主畫面」。**沒有原生 iOS／Android App** | A |
| 手機實際好不好用 | **沒有實測**（沒有部署）。D0 沙盒建好後要用手機實測，見 §6 | — |
| 繁體中文 | 有 `zh_TW.po`。約 2,330 條 msgstr 中有 330 條是空的，**翻譯涵蓋率約 86%** | A（大略統計） |
| 資料匯出 | 列表頁有「Export」，格式 **Excel／CSV**，可以勾選「Export all N records」匯出全部 [A：`ViewControls.vue`]。另外有 Frappe 的 Data Export 工具，也可以用 REST API 全量拉取 | A |
| 資料匯入 | 有匯入功能（`SetupImport.vue`、`LegacyDataImport.vue`） | A |
| 備份（自架） | Frappe 內建備份：`bench backup`，備份資料庫與檔案，**可以設定加密備份**（`encrypt_backup`）[A：`frappe/utils/backups.py`] | A |
| 備份（Frappe Cloud） | 每 24 小時自動備份，無法調整頻率。**自動備份與異地備份（AWS S3）只有 US$25 以上的方案才有**。可以隨時手動備份；只有標示 offsite 的備份能從主控台下載。保留份數兩份官方頁面說法不同，一份寫 7 日、4 週、12 月、10 年 | B |

**關鍵發現：US$5／10 的方案沒有自動備份。只要放真實資料，至少要用 US$25 方案，或者自架並自己排程備份。**

---

## 5. 三方比較總表（複審令第 3 點）

| 維度 | Frappe CRM | ERPNext | oc8 |
|---|---|---|---|
| 定位 | 輕量銷售 CRM | 完整 ERP | **未知** |
| 授權 | AGPL-3.0 [A] | GPL-3.0 [A] | **未知** |
| 按人頭計費 | 不按人頭 [B] | 不按人頭 [B] | **未知** |
| 原生 AI | 沒有 [A] | 沒有查證 | **未知** |
| MCP／AI 接口 | Frappe v16 以上 [B] | 同 | **未知** |
| REST API／Webhook | 有 [A] | 有 [A] | **未知** |
| LINE | 沒有 [A] | 沒有 | **未知** |
| FB | 只有 Lead Ads [A] | 沒有 | **未知** |
| 手機 | RWD＋PWA [A] | 沒有查證 | **未知** |
| 匯出 | CSV／Excel [A] | 同框架 | **未知** |
| 備份 | 內建＋可加密 [A]；雲端 US$25 起 [B] | 同 | **未知** |
| 適合接案雷達 | ✅ | ❌ 太重 | **未知** |

**oc8 補件需求：** 請 Shen 提供全名、官網或 repo 網址。拿到之後，用同一張表、同樣的 A／B／C 證據等級補上。

---

## 6. 成本試算（接案雷達，內部使用，1–3 位使用者）

> 標「B」的數字經搜尋摘錄取得，付費前要親自打開官網核對。標「估」的是 CC 的估算，**不是報價**。匯率暫用 1 USD ≈ 32 TWD（估）。

### 方案 A：Frappe Cloud 託管（建議）

| 項目 | 月費 | 證據 |
|---|---|---|
| Frappe Cloud 共享站台，**US$25 方案**（含自動與異地備份） | US$25 ≈ NT$800 | B（「$25 以上才有自動備份」來自官方文件摘錄；方案階梯 $5／$10／$25／$38／$50 來自 C 級第三方） |
| 試用 | 14 天，附 US$10 額度 | B |
| LINE 官方帳號 | 輕用量 NT$0（200 則）／中用量 NT$800（3,000 則，未稅）。**回覆訊息（Reply）不計入則數** | C（Omnichat 等；2026-11 起有改版，**要看 LINE 官方公告**） |
| n8n | 自架 NT$0（另需主機）／雲端方案 | 未查證，不填數字 |
| Claude API（摘要與回覆草稿，低用量） | 估 US$5–20 | 估 |
| **合計（不含 n8n）** | **約 NT$1,000–2,400／月** | 估 |

### 方案 B：自架

| 項目 | 月費 | 證據 |
|---|---|---|
| 軟體授權 | NT$0 | A |
| VPS 主機 | **未查證**（看供應商與規格） | — |
| 維運人力（更新、備份檢查、資安） | 估每月 2–4 小時 | 估 |

**判斷：** 內部只有 1–3 人使用，維運人力是自架最大的隱性成本，所以**選方案 A**。測試階段（只用假資料）可以先用 14 天試用或 D0 本機沙盒，**不必付費**。

---

## 7. 30 天內部驗證（取代 v1 的對外付費驗證）

**驗證假設：** 店面美學研究所的 PRO360 案件改用接案雷達追蹤後，「漏追率」與「首次回覆時間」都會改善。

| 週 | 行動 | 資料 | 需要核准 |
|---|---|---|---|
| W1 | D0 本機沙盒（Docker）＋設定看板與欄位＋**手機實測**（PWA、zh_TW） | 假資料 | ✅ 需要（建置沙盒） |
| W2 | Frappe Cloud 14 天試用＋測試用 LINE OA＋n8n，打通 LINE → Lead 流程 | 假資料、內部測試帳號 | ✅ 需要（使用外部服務） |
| W3–W4 | 改成實際案件追蹤。**用真實資料前要先升級到 US$25 方案（為了備份），並完成個資告知** | 真實資料 | ✅ 需要（付費＋使用真實資料） |

**第 30 天的判準：**

| 指標 | 繼續 | 停止 |
|---|---|---|
| PRO360 案件建檔率 | ≥ 90% | < 50% |
| 首次回覆中位數 | 比導入前快 | 沒有改善 |
| 每日實際開啟（手機或電腦） | ≥ 5 天／週 | ≤ 2 天／週 |

**和 SEAL-02 的關係：** 接案雷達的 Lead 與 Deal 資料可以透過 REST API 或 MCP，提供給 SEAL-02（AI 經營儀表板）當資料來源之一。**SEAL-02 本身的選型不在本報告範圍。**

---

## 8. 風險

| # | 風險 | 等級 | 緩解方式 |
|---|---|---|---|
| R1 | 價格只有 B／C 級證據，官網沒有直接核對 | 中 | 付費前由人親自核對 frappe.io/cloud/pricing，並截圖存證 |
| R2 | US$5／10 方案沒有自動備份 | 高 | 用真實資料就要升到 US$25，或自架並排程加密備份 |
| R3 | A 級證據取自 develop 分支，不是 main 穩定版 | 中 | 導入前在 main 分支重新確認 LICENSE、Webhook、匯出 |
| R4 | `package.json` 與 LICENSE 的授權標示不一致 | 低 | 以 LICENSE 為準；不修改核心 |
| R5 | LINE、AI 都要自己整合，會增加維護負擔 | 中 | 只在 n8n 寫一條流程；AI 只產生草稿，由人審核後送出 |
| R6 | MCP 需要 Frappe v16；Frappe Cloud 實際提供的版本沒有確認 | 低 | 開試用站時確認版本 |
| R7 | 個資存放在海外雲端（個資法） | 高 | 驗證期只用假資料；上線前完成告知與同意 |
| R8 | PRO360 沒有 API，要人工建檔 | 中 | 用 LINE 指令或簡易表單快速建檔；不使用爬蟲 |
| R9 | 繁中翻譯約 86%，有部分英文 | 低 | 手機實測時列出缺漏的字串，自行補翻 |
| R10 | oc8 無法評估，比較不完整 | 中 | 等 Shen 補件 |

---

## 9. Go／No-Go

| 決策點 | 建議 | 前提 |
|---|---|---|
| Frappe CRM 進入 D0 本機沙盒（假資料、不花錢） | **GO** | 總指揮核准 |
| Frappe Cloud 14 天試用＋測試 LINE OA | **GO** | 總指揮核准；只用假資料 |
| 用真實客戶資料上線 | **暫緩** | 要先完成 R1（核價）、R2（US$25 備份）、R7（個資） |
| ERPNext | **NO-GO** | 出現報價、發票需求時再評估 |
| oc8 | **無法判定** | 補件後再評估 |

---

## 10. 來源

**A 級（原始碼，2026-11-13）**
- [frappe/crm](https://github.com/frappe/crm) @ `73ec05a`：`LICENSE`、`package.json`、`pyproject.toml`、`README.md`、`crm/lead_syncing/`、`crm/domain_enrichment/README.md`、`frontend/vite.config.js`、`frontend/src/components/Layouts/MobileLayout.vue`、`frontend/src/composables/settings.js`、`frontend/src/components/ViewControls.vue`、`crm/locale/zh_TW.po`、`skills/frappe-crm/SKILL.md`
- [frappe/erpnext](https://github.com/frappe/erpnext) @ `0993447`：`license.txt`、`TRADEMARK_POLICY.md`
- [frappe/frappe](https://github.com/frappe/frappe) @ `70931d9`：`LICENSE`、`frappe/integrations/doctype/webhook/webhook.json`、`frappe/api/v2.py`、`frappe/utils/backups.py`

**B 級（官方文件，經搜尋摘錄）**
- [Frappe Cloud 備份](https://docs.frappe.io/cloud/sites/backups)、[frappecloud.com 備份鏡像](https://frappecloud.com/docs/sites/backups)、[Customer Guide：備份與復原](https://docs.frappe.io/customer-guide/security/backups-recovery)
- [Frappe Cloud 定價](https://frappe.io/cloud/pricing)、[Frappe Cloud 定價說明](https://docs.frappe.io/customer-guide/pricing/frappe-cloud-pricing)、[定價 FAQ](https://docs.frappe.io/customer-guide/pricing/pricing-faq)、[Frappe CRM 定價](https://frappe.io/crm/pricing)
- [Frappe MCP 指南](https://docs.frappe.io/framework/guides-integration/mcp)、[frappe/mcp（已封存）](https://github.com/frappe/mcp)
- [Frappe CRM WhatsApp](https://docs.frappe.io/crm/whatsapp)

**C 級（第三方，只當參考）**
- [Softwr：Frappe 方案比較](https://www.softwr.com/pricing/frappe)
- [ERPNext Pricing Explained 2026](https://ecosire.com/blog/erpnext-pricing-explained-2026)
- [Omnichat：LINE OA 費用 2026](https://blog.omnichat.ai/tw/line-2-0-official-account-pricing/amp/)、[Omnichat：2026 年 9 月方案調整](https://blog.omnichat.ai/tw/line-pricing-sep2026-zh/)
- [respond.io：LINE CRM](https://respond.io/tw/blog/line-crm)
