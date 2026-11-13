# AI-CORE-012｜現成系統技術驗證報告

| 項目 | 內容 |
|---|---|
| 發令 | Shen｜總指揮 |
| 執行 | CC｜Claude 作戰中心 |
| 技術審查 | G-001｜GPT 五角大廈 |
| 日期 | 2026-11-13 |
| 狀態 | **初稿，待 G-001 審查**。本次沒有部署、沒有購買服務，也沒有使用真實客戶資料。 |

---

## 0. 結論先講（BLUF）

1. **建議採用 Frappe CRM（Frappe Cloud 託管）做 PRO360 接案管線的最小商業產品。** 原因：不按人頭計費、開源（AGPL-3.0），可以先用最便宜的共享方案驗證，不必先綁長約。
2. **ERPNext 先不用。** 它是完整的 ERP（會計、庫存、採購），超過 30 天驗證需要的範圍，導入成本高。等「有人付錢」之後，需要開報價單、收款、發票時再評估。
3. **「oc8」查不到是什麼。** 我用中英文做了公開搜尋（包含 CRM、AI 客服、LINE 等關鍵字），都沒有找到叫 oc8 的產品。**請 Shen 提供 oc8 的全名或官網網址**，我再補完第 3 欄。目前表格裡 oc8 的欄位都標「待確認」，不做猜測。
4. **三套都沒有原生 LINE 整合。** LINE 是台灣主力管道，無論選哪一套，都需要自己串接 LINE Messaging API（webhook → CRM API），可以用 n8n 或寫一個小型 Frappe app。這是驗證期唯一要開發的部分。
5. **AI 部分建議放在系統外面**（n8n／小服務呼叫 Claude API），不要綁死在某套系統的內建 AI 上。這樣換 CRM 時，AI 流程可以帶走。

---

## 1. 名詞與假設（請 Shen 確認）

| 名詞 | 我的理解 | 依據 | 需要確認嗎 |
|---|---|---|---|
| PRO360 | 台灣的 PRO360 達人網接案平台。「店面美學研究所」在上面接案（詢價 → 報價 → 成交）。 | 現有的「小單」接單 Skill | 否 |
| SEAL-02 | 本 repo 只有 `seal-team/`（短影音海豹小隊 MVP），**沒有任何 SEAL-02 的定義**。我暫時把它理解為「把短影音小隊服務產品化，賣給小店」的第二支部隊。 | `seal-team/README.md` | **要** |
| oc8 | 無法辨識。可能是內部代號、拼寫差異，或某個未公開的產品。 | 搜尋不到 | **要** |

---

## 2. 技術比較

> 價格會變動，以下以官方頁面為準。Frappe Cloud 官方文件也說 frappe.io/cloud/pricing 才是唯一準確來源，各來源數字不一致的地方我都有標出來。

| 維度 | Frappe CRM | ERPNext | oc8 |
|---|---|---|---|
| 定位 | 輕量銷售 CRM（Lead → Deal 管線、看板、聯絡人、活動紀錄） | 完整 ERP（CRM 模組＋報價、銷售訂單、會計、庫存、HR） | 待確認 |
| 適合 PRO360 嗎 | ✅ 剛好對應「詢價 → 報價 → 成交 → 追蹤」 | ⚠️ 功能過重。不過報價單、收款功能以後可能用得到 | 待確認 |
| 適合 SEAL-02 嗎 | ✅ 可以管理短影音客戶的名單與案件階段 | ❌ 驗證期用不到 | 待確認 |
| 授權 | AGPL-3.0（開源）。修改後透過網路提供給第三方使用，就要公開原始碼。只在內部使用的義務範圍，各來源說法不同，**商用前建議請法務確認**。 | GPL-3.0（Frappe 框架為 MIT）。⚠️ 這點是我依記憶寫的，請 G-001 核對 GitHub LICENSE。 | 待確認 |
| 計價方式 | 不按人頭計費，leads、deals、使用者都不限量 | 同樣用 Frappe Cloud，按運算量計價 | 待確認 |
| 託管成本（Frappe Cloud） | 共享站台方案約 **US$5–10／月起**。各來源寫的起價有 $5、$10、$50 三種，要以官方頁面為準 | 正式環境估計 **US$25–200／月**（第三方估算）；含官方支援約 $50／月起（2023 年公告） | 待確認 |
| 自架成本 | 軟體免費；VPS 約 US$10–20／月，另外要算維運人力 | 同左，但資源需求較高（建議 4GB RAM 以上） | 待確認 |
| Demo 可行性 | 高：Frappe Cloud 有試用；也可以本機用 Docker 跑沙盒 | 中：官方有 demo 站，但要設定很多項目才能展示接案流程 | 待確認 |
| LINE | ❌ 沒有原生支援，要自己串 LINE Messaging API | ❌ 同左 | 待確認 |
| Facebook Messenger | ❌ 沒有原生支援，只有第三方 no-code 連接器（例如 viaSocket） | ❌ 同左 | 待確認 |
| WhatsApp | ⚠️ 要另外安裝社群 app「Frappe WhatsApp」 | 同左 | 待確認 |
| AI | ⚠️ 本次沒有查證是否有內建 AI。建議從外部用 API 呼叫 Claude | 同左 | 待確認 |
| API／擴充 | ✅ REST API 與 webhook 齊全，Frappe 框架可以寫自訂 app | ✅ 同左 | 待確認 |
| 繁體中文／台灣在地化 | ⚠️ 介面有社群翻譯，品質要實測 | ⚠️ 不支援台灣電子發票，要另外找服務或自己開發（待驗證） | 待確認 |

### 2.1 LINE 整合架構（三套都適用）

```
客人 ──LINE OA──▶ LINE Messaging API webhook
                        │
                        ▼
                n8n（或小型 Frappe app）
                 ├─ 用 Claude API 判斷意圖、摘要、產生建議回覆
                 ├─ 用 Frappe REST API 建立／更新 Lead，並寫入對話紀錄
                 └─ 用 LINE Reply API 回覆（初期由人審核後才送出）
```

- LINE 不允許匯入聯絡人，客人要先加好友或主動傳訊息，才會成為可以追蹤的聯絡人。
- LINE OA 回覆訊息（Reply）免費，主動推播（Push）要算月額度。台灣方案請以 LINE for Business 官方公告為準。
- PRO360 沒有公開 API，案件要**人工貼進 CRM**，或寫一個表單快速建檔。不建議用爬蟲，避免違反平台條款。

---

## 3. 選擇：最小商業產品（MVP）

**產品名稱（暫定）：「接案雷達」— PRO360 接案管線＋LINE AI 追單助手**

| 模組 | 內容 | 工具 |
|---|---|---|
| ① 案件管線 | PRO360 詢價建成 Lead，看板分成「新案／已報價／追蹤中／成交／流失」 | Frappe CRM |
| ② 報價草稿 | 依照「小單」Skill 的規則產生報價與提案草稿，人工審核後送出 | Claude（外部） |
| ③ LINE 追單 | 客人轉到 LINE 後，對話自動掛到對應的 Lead，AI 提醒「第 3 天要追」 | n8n＋LINE API＋Claude |
| ④ 週報 | 每週統計：詢價數、報價數、成交率、平均回覆時間 | Frappe CRM 報表 |

**為什麼先做 PRO360，不先做 SEAL-02：** PRO360 已經有真實的詢價在流動，金流和痛點（漏追、回覆太慢）都看得到。SEAL-02 的定義還沒確定。同一套 CRM 之後也可以直接拿來管 SEAL-02 的客戶。

**刻意不做：** 會計、發票、庫存、多管道整合收件匣（FB／IG 先不接）、自動送出 AI 回覆。

---

## 4. Demo 可行性

| 階段 | 做法 | 需要核准嗎 | 預估時間 |
|---|---|---|---|
| D0 本機沙盒 | 用 Docker（frappe_docker）在本機或雲端開發容器跑 Frappe CRM，只灌**假資料**（虛構的 10 筆 PRO360 詢價） | 否（不算正式部署） | 0.5 天 |
| D1 流程展示 | 設定看板階段與欄位（PRO360 案號、預算、地區、服務類型） | 否 | 0.5 天 |
| D2 LINE 測試 | 開一個**測試用** LINE OA＋本機 n8n，只對內部測試帳號收發訊息 | ⚠️ 需要申請 LINE 測試帳號（免費），請 Shen 確認 | 1 天 |
| D3 AI 串接 | n8n 呼叫 Claude API 做摘要與建議回覆，只用假對話 | ⚠️ 會產生 API 用量費用，要先核准 | 0.5 天 |
| D4 Frappe Cloud 試用 | 開託管試用站給 G-001／Shen 實際操作 | ⚠️ 屬於使用外部服務，要先核准 | 0.5 天 |

本次執行的環境有 Docker，但**我沒有實際啟動 D0**：映像檔有好幾 GB，而且這道命令只要求「技術驗證與建議」。如果要跑，請 Shen 下令，我會用假資料做 D0–D1。

---

## 5. 30 天付費驗證建議

**驗證假設：** 在 PRO360 接案的小型服務商，願意每月付 NT$990–1,990，換取「不漏追、回覆更快、提案更快」。

| 週次 | 行動 | 產出 | 關卡 |
|---|---|---|---|
| W1 | 完成 D0–D3 沙盒 Demo，錄一支 90 秒展示影片（交給 SEAL 小隊製作） | Demo 影片、一頁式提案 | G-001 技術審查通過 |
| W2 | 自己先當第一個使用者：店面美學研究所的 PRO360 案件全部改用 CRM 追蹤。**要用真實案件資料，必須先經 Shen 核准** | 自用數據：回覆時間、追單次數 | Shen 核准使用真實資料 |
| W3 | 對 10–15 家 PRO360 上的同業（設計、裝修、攝影）提出「首月 NT$990 試用」 | 報名名單 | 至少 3 家同意 |
| W4 | 為付費者開帳號（每家一個站台或一個團隊），每週一次回訪 | 付費數、使用頻率、續約意願 | 決策會議 |

**成功／失敗判準（第 30 天）：**

| 指標 | 繼續 | 調整 | 停止 |
|---|---|---|---|
| 付費客戶數 | ≥ 3 | 1–2 | 0 |
| 每週活躍使用 | ≥ 3 天／週 | 1–2 天 | 沒有使用 |
| 自用的成交率變化 | 提升 | 持平 | — |
| 願意續約第 2 個月 | ≥ 2 家 | 1 家 | 0 |

**預算上限（需要 Shen 核准才能動用）：**

| 項目 | 月費估計 |
|---|---|
| Frappe Cloud 共享站台 ×1–4 | US$5–40 |
| n8n（自架或雲端入門方案） | US$0–24 |
| Claude API（低用量） | US$10–30 |
| LINE OA | 免費方案起（Reply 不計費） |
| **合計** | **約 US$15–95／月（約 NT$500–3,000）** |

---

## 6. 風險

| 風險 | 影響 | 緩解方式 |
|---|---|---|
| AGPL 義務 | 修改後的 CRM 以 SaaS 方式提供給客戶，要公開修改的原始碼 | 不改核心程式碼，客製功能放在獨立 app 或 n8n；商用前請法務確認 |
| 每家客戶都要整合 LINE | 開發成本高 | 把 n8n 流程模板化，一家客戶一份設定檔 |
| PRO360 沒有 API | 要人工建檔 | 用表單或 LINE 指令快速建檔；不使用爬蟲 |
| 個資（個資法） | 客戶姓名與電話會存在海外雲端 | 驗證期只用假資料；正式上線前要寫好隱私權告知與同意流程 |
| AI 回覆出錯 | 傷害客戶關係 | 初期只產生草稿，由人審核後才送出 |
| oc8 和 SEAL-02 尚未定義 | 比較不完整 | 等 Shen 補充資料後再補 |

---

## 7. 待 Shen 決定

1. oc8 的全名或官網網址是什麼？
2. SEAL-02 的定義是什麼？
3. 是否核准 D0–D1 本機沙盒 Demo？（只用假資料，不花錢）
4. 是否核准 D2–D4（測試用 LINE OA、Claude API 用量、Frappe Cloud 試用）？預算上限多少？

---

## 來源

- [Frappe CRM 定價](https://frappe.io/crm/pricing)
- [Frappe Cloud 定價說明（官方文件）](https://docs.frappe.io/customer-guide/pricing/frappe-cloud-pricing)
- [Frappe Cloud 定價 FAQ](https://docs.frappe.io/customer-guide/pricing/pricing-faq)
- [Frappe Cloud 共享主機](https://frappe.io/cloud/shared-hosting)
- [ERPNext 支援方案公告（Frappe 官方部落格）](https://frappe.io/blog/announcements/introducing-erpnext-support-for-frappe-cloud)
- [ERPNext 價格說明 2026（第三方）](https://ecosire.com/es/blog/erpnext-pricing-explained-2026)
- [Frappe CRM WhatsApp 文件](https://docs.frappe.io/crm/whatsapp)
- [Frappe CRM 整合列表](https://frappe.io/crm/integrations)
- [Frappe CRM 授權與功能整理（第三方）](https://unsubbed.pages.dev/tools/frappe-crm/)
- [ERPNext CRM 擴充研究（第三方）](https://solanasis-docs.pages.dev/erp-crm-plugins-research)
- [viaSocket：Facebook Messenger × Frappe](https://viasocket.com/integrations/facebook_messenger/frappe)
- [respond.io：LINE CRM 指南](https://respond.io/tw/blog/line-crm)
- [LINE OA 與客服系統比較（台灣）](https://simular.co/blog/post/line-oa-and-customer-service-platforms)
