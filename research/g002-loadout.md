# G-002 配器卡｜6,000 元影音 AI 員工獲客戰役

> 可複製版線上頁面：https://claude.ai/artifact/79JokPxGs1yMEEefoKvria
> 完整 42 支兵器深度報告：[`research/ai-lead-gen-arsenal.md`](./ai-lead-gen-arsenal.md)
> 資料抓取日：2026-09-22

**戰役** G-002 ｜ **客單** NT$6,000 ｜ **對象** 台灣實體店／中小商家 ｜ **配器原則** 小・輕・借

星數、授權與能力描述皆取自 2026-09-22 當日實際抓取的 GitHub 頁面；未能取得確切日期的
「最近更新」一律標「待驗證」。第一週的轉換數字全部是假設，跑完請用真值覆蓋。

---

## 目錄

01. 戰役簡報
02. 斷層分析：為什麼 42 支裡大多數不能用
03. 主器：Harvey 當底盤
04. 短影音體檢 Rubric（唯一要自己造的）
05. 最小可行編組（五件）
06. 觸達設計：樣片鉤子 + 意圖三級
07. 開打前驗證 + 第一週數字
08. 42 支兵器清單
09. M1–M14 模組對照

---

<!-- ===== 01 戰役簡報 ===== -->

## G-002｜6,000 元影音 AI 員工獲客戰役

**賣什麼**
NT$6,000。不是代做幾支影片，而是幫老闆建立一個「自己的影音 AI 員工」：老闆把商品、服務、活動或素材交給 AI，協助完成短影音的題材、腳本、文案與影音內容製作。

核心價值：讓「知道短影音重要，但沒時間、不會做、做不動」的老闆，也能持續產出影音內容。

**賣給誰**
第一階段鎖定實體店／中小商家老闆。優先訊號：
- 有經營 FB／IG 等社群
- 有商品或服務適合影音呈現
- 知道社群行銷重要
- 目前影片少、更新慢或品質普通
- 沒有完整影音團隊
- 老闆自己做內容很吃力
- 競爭者已經開始大量使用短影音

行業暫不鎖死（餐飲、美業、零售、旅宿、健身、汽車服務等），讓第一輪實戰反過來告訴我們哪個行業最好打。

**AI 的三個任務**
1. 尋客：自動找到符合條件的潛在客戶
2. 給資訊：主動提供與該店家有關、真正有用的資訊，找出有興趣的人
3. 回報：判斷對方有明確興趣就轉人工，由人工締結成交

**配器原則**
小・輕・借。能用現成的就不自己造；能一支主器解決就不組複雜系統；缺什麼才補什麼。

---

<!-- ===== 02 斷層分析：為什麼 42 支裡大多數不能用 ===== -->

## 這場戰役與現成兵器之間的三道斷層

**① 客單 6,000 → 單客獲取成本必須壓在兩位數台幣**
BetterContact、Explorium、Apollo、Clay 這類付費資料源全部出局。只能用免費／公開資料源。

**② 台灣實體店 → 主流 B2B 訊號全部失效**
LinkedIn、ATS 職缺（Greenhouse/Ashby/Lever）、SEC EDGAR、競品 stargazer 全部出局。
能用的資料源只剩兩個：**Google Maps** 和 **店家自己的 IG／FB**。

**③ 通道是 IG DM／FB／LINE，不是 email**
warmbly、postal、listmonk、email 瀑布那一整套這一戰用不到，省掉一週工。

---

### 但斷層裡藏著一個極大的便宜

> 別人要花錢買 buying signal，你的 signal 就攤在目標本人的 IG 上，
> 而且**訊號和證據是同一份東西**。
>
> 「他 47 天沒發影片、Reels 只佔 8%、隔壁同業一週三支」
> —— 這既是篩選條件，也是你私訊第一句話的內容。

**結論：這一戰不需要獨立的意圖模組。尋客 = 判客 = 給資訊，三件事共用同一次掃描。**

---

<!-- ===== 03 主器：Harvey 當底盤 ===== -->

## 主器：Harvey 當底盤

https://github.com/ethanplusai/harvey ｜ 68★ ｜ MIT ｜ Python + SQLite ｜ v0.2.0

### 選它的四個理由

1. **全場唯一為「5–50 人本地小商家」設計的** — 其他 41 支都在打 B2B SaaS。
2. **跑在 Claude 訂閱上，不走 per-token API** — 6,000 元客單只有這種成本結構撐得住反覆掃描與重寫。
3. **技能是可編輯的 Markdown，改檔下個 heartbeat 就生效** — 它的 PROFILE 階段本來做「網站老化偵測」，我們換成「影音停更偵測」，這正是它設計好的擴充點。
4. **已有 Handler（讀回信／分意圖／偵測退信）與 Analyst（統計意圖分佈）** — 任務 3「回報人工」和「哪個行業最好打」現成就有位置放。

### 直接對應目標的一招

Harvey 的「23 個訊號讓人 approve / skip / reject，通過的編譯成 SQL cohort」。
第一輪跑完，「哪個行業最好打」不是感覺，是一句 SQL。

### 彈藥抄 ProspectOS 的打法（不裝本體）

https://github.com/nando0x/ProspectOS ｜ 225★ ｜ MIT ｜ ⚠️ Windows-only，所以只抄方法不裝本體

抄三件：
- Google Maps 依「行業 + 地區」撈店
- **缺陷即訊號**（原話：「爛掉的網站也是 lead」）
- **診斷報告當開場禮，而不是推銷**

---

<!-- ===== 04 短影音體檢 Rubric（唯一要自己造的） ===== -->

## 短影音體檢 Rubric

**這是整場戰役唯一要自己造的東西，也是唯一的護城河。**
規範抄 Scrollport 的 evidence-backed 原則：**沒有來源就留空，不准編**。

| # | 項目 | 看什麼 | 判讀 | 角色 |
|---|---|---|---|---|
| ① | 停更天數 | 最近一則貼文／Reels 距今幾天 | > 30 天 = 做不動了 | 篩選器 |
| ② | 影音佔比 | Reels 數 ÷ 總貼文數 | < 15% = 知道重要但沒開始 | 篩選器 |
| ③ | 影音效能 | Reels 平均觀看 ÷ 粉絲數 | < 0.3 = 發了也沒被推 | 篩選器 |
| ④ | 製作門檻徵候 | 有無字幕／封面是否統一／是否用圖片輪播冒充影音 | 直接證明「沒團隊」 | 篩選器 |
| ⑤ | **商圈對照** | 同區同業前三名的發片頻率與觀看 | **最痛的一擊，最難忽略的一句話** | **鉤子** |
| ⑥ | 素材充足度 | 有無菜單／作品／空間／流程可立刻影音化 | 決定 AI 員工能不能明天開工 | 報價底氣 |

### 使用規則

- **分數越痛，越該聯絡。** 排序取最痛的 200 家。
- ①②③④ 是篩選器，⑤ 是鉤子，⑥ 是報價底氣。
- 每一項都必須附證據（截圖或數字）。拿不到就留空，標記為「未取得」，不得推測填補。
- 體檢結果同時就是「為什麼這個人值得聯絡」的理由欄。

### 淘汰規則（先過濾再體檢，省算力）

- 沒有 IG／FB 連結 → 淘汰
- 連鎖品牌（總部統一經營社群）→ 淘汰
- 評論數 < 20 或 > 500 → 暫時淘汰（太小沒預算／太大有團隊）
- 影音已經做得好（①②③ 全部健康）→ 淘汰，不是我們的客戶

---

<!-- ===== 05 最小可行編組（五件） ===== -->

## 最小可行編組

五件，不要更多。

| 位置 | 用什麼 | 借哪一刀 |
|---|---|---|
| **尋客** | [omkarcloud/google-maps-scraper](https://github.com/omkarcloud/google-maps-scraper) ｜3.5k★ MIT | 依行業+地區撈店，50+ 欄位含**社群連結**、評分、評論數 |
| **體檢** | **自己寫**（六項 rubric）+ [opengtm](https://github.com/buildingopen/opengtm) 的健檢輸出格式 | 缺陷即訊號 |
| **文案** | Harvey 的框架庫 + [OneShot](https://github.com/oneshot-agent/oneshot-gtm) 的 AI Writing Lint | 擋禁用詞／破折號／諂媚腔，讓訊息不像 AI 寫的 |
| **CRM** | [sales-signals](https://github.com/jaime-cervera/sales-signals) 的 append-only Markdown 檔案式 CRM | 200–600 筆不需要資料庫。第一週別碰 Twenty。 |
| **學習** | [lead-finder](https://github.com/maledadams/lead-finder) 的 skip reason → rule | 每拒絕一家就寫一句理由，理由直接變規則、**凌駕模型判斷** |

### 流程三句話

```
Google Maps 撈
  → 體檢打分排序
    → 人工發 DM（附樣片）
      → 回覆分三級
        → 問價／問問題轉人工締結
```

### 刻意不做的事

- 不做 email warmup／送達率基建（這一戰不走 email）
- 不接付費資料源（客單撐不住）
- 不自動化 IG DM（違反 ToS + 封號風險）
- 不建正式 CRM（第一週用 Markdown 檔）
- 不做獨立意圖模組（體檢本身就是意圖判讀）

---

<!-- ===== 06 觸達設計：樣片鉤子 + 意圖三級 ===== -->

## 觸達設計

### 最強的觸達素材，是產品本身的產出

你賣的是影音 AI 員工，所以：

> **不要只附體檢報告。直接附一支用他店裡現成素材做好的 15 秒樣片。**

體檢報告是**說服的骨架**，樣片才是**鉤子**。它同時完成三件事：
1. 證明你懂他的問題
2. 證明產品真的能跑
3. 把「要不要買」變成「這支我可以用嗎」

6,000 元的決策門檻，一支樣片就跨過去了。

### 訊息結構（不推銷）

1. 一句商圈對照（體檢第 ⑤ 項）—— 具體、有數字、不評價
2. 三項體檢結果 —— 純陳述，附證據
3. 「我用你 IG 上現成的素材做了一支 15 秒的，你看看」—— 附樣片
4. **不要問要不要買。** 問「這支可以用嗎」或「要不要我再做兩支不同風格的」

### 觸達通道與合規

沒有安全的開源 IG DM 自動化，自動私訊違反 ToS 且封號風險高。
採用 [Sales-Cadence](https://github.com/Acumen-org/Sales-Cadence) 的立場：**AI 決定碰誰、碰什麼，人負責碰。**
第一戰 200–300 個目標，人工一天 20–30 則完全跑得動，而且回覆率遠高於自動化。

### 回報標準：用意圖等級，不是「有沒有回」

抄 [Auto-Email-Reply-Agent](https://github.com/Asad-jatt-477/Auto-Email-Reply-Agent) 的 80/20 路由：

| 等級 | 訊號 | 處置 |
|---|---|---|
| **L1** | 禮貌回應、按讚、已讀 | AI 繼續 follow-up |
| **L2** | **問問題**（「這怎麼做？」「要多久？」「還能做什麼？」） | **轉人工** |
| **L3** | **問價／問流程／要看更多樣片** | **立刻轉人工** |

**L2 就轉，不要等 L3。低客單的窗口關得快。**

轉人工時必須附完整 context 包：體檢結果 + 樣片 + 對話紀錄 + 建議下一步。人不該再查一次。

### 「哪個行業最好打」要在第一天就埋進資料結構

每一筆 lead 從 Maps 撈出來就打 **niche tag**，全程帶著走。
一週後看的是 `niche × 體檢分數 × 回覆率 × 意圖等級` 的交叉表 —— 這比任何直覺可靠。

---

<!-- ===== 07 開打前驗證 + 第一週數字 ===== -->

## 開打前先花 30 分鐘驗一件事

**誠實說：沒有任何一支現成主器能在台灣開箱即用。**
Harvey 的尋客走 OpenStreetMap，台灣店家覆蓋率遠不如 Google Maps；ProspectOS 只跑 Windows。
整個編組的成敗壓在同一個假設上：

> **Google Maps 在你的目標行業，能不能撈到足夠多「帶 IG 連結」的店？**

### 驗證方法

拿一個行業一個區（例如「台中西區 美甲」）跑一次 scraper，數三個數字：

1. 撈到幾家
2. 幾家有 IG 連結
3. 幾家 IG 明顯停更或無影音

### 兩條分支

| 帶 IG 比例 | 行動 |
|---|---|
| **> 40%** | 整組照配器方案上，直接開打 |
| **< 20%** | 改從 **IG 地標／hashtag 反查**（例如 `#台中美甲`）當主尋客源，Maps 退居補資料。**只換「尋客」那一格，其餘四格不動** |

**這 30 分鐘不做，後面可能白做一週。**

---

## 第一週的數字

⚠️ **全部是假設，跑完就用真值覆蓋。**

| 階段 | 量 | 備註 |
|---|---|---|
| Google Maps 撈 | 600–1,000 家 | 單一行業 × 2–3 個行政區 |
| 過濾（有 IG、非連鎖、評論 20–500） | 剩 250–350 | |
| 體檢排序，取最痛的 | 200 | |
| 人工 DM（20–30／天） | 7–10 天 | 附樣片 |
| 回覆率（假設 15%） | 30 則 | 價值前置 + 樣片，遠高於冷 email 的 1–3% |
| L2／L3 明確興趣（回覆的 1/3） | **約 10 個** | 轉人工締結 |

**一週 10 個有興趣的 6,000 元客戶，就是第一場戰役該有的產出。**

### 要盯的三個真值

1. **帶 IG 比例** —— 決定尋客那一格要不要換
2. **回覆率** —— 決定訊息結構要不要改（低於 5% 就是訊息問題，不是名單問題）
3. **niche × 意圖等級交叉表** —— 決定第二戰打哪個行業

---

<!-- ===== 08 42 支兵器清單 ===== -->

## 42 支兵器清單（2026-09-22 抓取快照）

分級：**A** = 開源+Self-host+Agent-native+可組裝｜**B** = 開源但依賴外部 API｜**C/D** = 值得拆解的方法或新專案

### 基準樣本

| 專案 | ★ | 授權 | 那一刀 | 連結 |
|---|---|---|---|---|
| OpenOutreach（含 OpenOutFind／OpenOutSend） | 3.1k | GPLv3 | 一句產品描述當唯一輸入；信心閘擋在付費呼叫前；`reason` 欄位當一級公民 | https://github.com/eracle/OpenOutreach |

### A 級

| 專案 | ★ | 授權 | 那一刀 | 連結 |
|---|---|---|---|---|
| OneShot GTM | 697 | MIT | **簽章收據 → 真實 CAC/RoCS**；15 個 Finder；AI Writing Lint | https://github.com/oneshot-agent/oneshot-gtm |
| YALC GTM OS | 311 | MIT | **Intelligence Store**（hypothesis→validated→proven）；outbound validation 硬擋；24 原子 skill + 1 旗艦 | https://github.com/Othmane-Khadri/YALC-the-GTM-operating-system |
| **Harvey** | 68 | MIT | **訂閱制 agent 經濟學**；23 訊號人工確認→SQL cohort；專攻本地小商家 | https://github.com/ethanplusai/harvey |
| warmbly | 310 | Apache-2.0 | 開源 email warmup 池 + inbox placement 監測 | https://github.com/warmbly/warmbly |
| email-sleuth | 425 | MIT | Rust；**port 25 封鎖自適應**；0–10 信心分 | https://github.com/buyukakyuz/email-sleuth |
| FORGE / DataForge | 54 | MIT | **6 層 email 偵測**（含 Cloudflare 解碼）；FCC/NPI/SAM.gov 政府資料；Ollama 零成本富化 | https://github.com/Nuclear-Marmalade/dataforge |
| OpenLeads | 24 | ⚠️ PolyForm **非商用** | **零金鑰聯邦尋客**（OSM/YC/HN/Wikidata/SEC/GitHub/OpenAlex/NPI/PH）；七訊號送達共識 | https://github.com/Samyrrrrrr990/openleads |
| opengtm | 43 | MIT | 明碼 6 維 ICP 權重；**AEO 健檢當開場禮** | https://github.com/buildingopen/opengtm |
| OpenProspector | 9 | MIT | **19 家供應商瀑布 + append-only 歸因帳本 + deferred webhook** | https://github.com/clawnify/OpenProspector |
| BuildRadar（reddit-intel-agent-mcp） | 2 | MIT | **7 維機會評分**；`export_evidence_pack`；MCP+REST 雙協議；零金鑰 | https://github.com/Houseofmvps/reddit-intel-agent-mcp |
| sales-signals | 0 | MIT | **ATS 職缺零 token 意圖源**；Playwright liveness 驗證；多 ICP 隔離；檔案式 CRM | https://github.com/jaime-cervera/sales-signals |
| sales-intelligence-agent | 0 | MIT | **6 種訊號共振 pattern**（時間窗+加權+敘事）；GitHub Actions 當免費 cron | https://github.com/Maha-Jr10/sales-intelligence-agent |
| lead-finder | 1 | MIT | **skip reason → 凌駕模型的規則**；Certificate Transparency 抓新網域 | https://github.com/maledadams/lead-finder |
| CompanyScope MCP | 4 | MIT ⚠️已封存 | 一次 call 拿完整公司檔案；11 工具／12 免費源 | https://github.com/Stewyboy1990/companyscope-mcp |
| b2b-sdr-agent-template（PulseAgent） | 186 | MIT | **4 層抗失憶記憶體**（65% context 觸發壓縮）；WhatsApp+Telegram | https://github.com/iPythoning/b2b-sdr-agent-template |
| autonomous-sdr | 0 | MIT | **自優化 BANT（lr 0.3）**；CRM webhook 回流；6 通道進件；human handoff | https://github.com/RodricDib06/autonomous-sdr |
| smart-trade-ai | 78 | ⚠️ AGPL-3.0 | **制裁篩查／WHOIS／合規審查層**；38 個 B2B 技能 | https://github.com/chefroger/smart-trade-ai |
| Sales-Cadence (Acumen) | 0 | 待驗證 | **23 天序列骨架 + reply-stop 自動關單**；「AI 排程、人執行」立場 | https://github.com/Acumen-org/Sales-Cadence |
| Twenty CRM | 56k | AGPL-3.0 | **原生 MCP**，agent 可直接建 deal／更新 pipeline | https://github.com/twentyhq/twenty |
| DeskcommCRM | 3.4k | MIT | **多業態詞彙抽象**；反封號可解釋節流；pgvector RAG 記憶 | https://github.com/melgarafael/DeskcommCRM |
| **ProspectOS** | 225 | MIT ⚠️Windows | **網站健檢 PDF 當開場禮**；Google Maps + IG 留言者；三家免費 AI 降級 | https://github.com/nando0x/ProspectOS |
| bricks | 67 | 待驗證 | **writer ↔ prospect-critic 雙 agent 文案迴圈**；免費 LLM 六家瀑布 | https://github.com/BraaMohammed/bricks |
| Scout | 645 | MIT | 8 社群平台免金鑰抽取；headline→網域→pattern→SMTP 驗證 | https://github.com/kiryano/Scout |
| StaffSpy | 336 | WTFPL ⚠️灰區 | `scrape_staff()` 撈全公司員工；**`scrape_comments()` 留言者訊號** | https://github.com/cullenwatson/StaffSpy |
| **google-maps-scraper** | 3.5k | MIT | **50+ 資料點含社群連結**；本地商家規模化抽取 | https://github.com/omkarcloud/google-maps-scraper |
| influencer-discovery | 208 | 待驗證 | 15 通道創作者探索；**零第三方依賴**；(person,platform) 去重 | https://github.com/tigerless-labs/influencer-discovery |

### Skill / MCP 層

| 專案 | ★ | 授權 | 那一刀 | 連結 |
|---|---|---|---|---|
| ai-sales-team-claude | 1.4k | MIT | **5 路並行 agent 加權評分**；14 個 `sales-*` 技能分類法 | https://github.com/zubair-trabzada/ai-sales-team-claude |
| OneWave claude-skills | 301 | MIT | **`prospect-panel-simulator`：發送前模擬客戶小組壓測**；`champion-identifier` | https://github.com/OneWave-AI/claude-skills |
| explorium gtm-skills | 66 | MIT | `market-sizing`／`lookalike-accounts`／`decision-makers-map`／`clean-data` | https://github.com/explorium-ai/gtm-skills |
| vibeprospecting-mcp | 32 | Explorium ToS | **預覽 5–10 列，明確要求才扣點匯出** | https://github.com/explorium-ai/vibeprospecting-mcp |
| gtm-pipeline-skills | 69 | MIT | company-first vs signal-first 兩條路線對照；`contact-filter` 獨立成技能 | https://github.com/keinsaasforever/gtm-pipeline-skills |
| markster-os | 64 | MIT | **prerequisite-gated 技能執行**；Find 與 Book 之間插入 Warm 階段 | https://github.com/markster/markster-os |
| Linked API linkedin-skills | 69 | MIT | LinkedIn **多帳號排程邀請**；託管而非本機自動化 | https://github.com/Linked-API/linkedin-skills |
| Scrollport sales-prospecting-skills | 0 | MIT | **evidence-backed 規範：無來源就留空，不准編** | https://github.com/Scrollport/sales-prospecting-skills |
| signal-prospecting-kit | 0 | 待驗證 | **語氣調整獨立成一個技能** | https://github.com/cismontane-harris2642/signal-prospecting-kit |

### B 級

| 專案 | ★ | 授權 | 那一刀 | 連結 |
|---|---|---|---|---|
| sales-outreach-automation-langgraph | 390 | 待驗證 | **稽核報告當個人化載體**；RAG 案例配對；SPIN 腳本 | https://github.com/kaymen99/sales-outreach-automation-langgraph |
| SalesGPT | 2.6k | 待驗證 | **銷售階段機**：判斷對話在哪一格再決定下一步 | https://github.com/filip-michalsky/SalesGPT |
| ai-company-researcher | 214 | 待驗證 ⚠️已封存 | LangGraph + Firecrawl + human-in-the-loop 反覆修訂 | https://github.com/mayooear/ai-company-researcher |
| sales-team-ai-agents | 30 | 待驗證 | **公司分與個人分分離**；個人分中「決策權 30%」 | https://github.com/Getting-Automated/sales-team-ai-agents |
| brightdata ai-sdr-bdr-agent | 17 | MIT | Bright Data MCP 當即時網頁情報層；trigger 四分類 | https://github.com/brightdata/ai-sdr-bdr-agent |
| scrapehubai | 13 | MIT | **競品 repo 的 stargazer 就是你的 lead** | https://github.com/scrapegraphai/scrapehubai |
| langgraph-lead-qualification | 4 | MIT | **技術研討會議程爬取當尋客源** | https://github.com/EmpoweredHouse/langgraph-lead-qualification |
| lead_agent | 待驗證 | 待驗證 | 確定性 8 因子矩陣（含「社群機會缺口」） | https://github.com/kandarpa02/lead_agent |
| b2b-intent-intelligence | 0 | 待驗證 | 意圖基礎分表（購買請求85／推薦80／招聘75／挑戰70） | https://github.com/vinnykumar206/b2b-intent-intelligence |
| sales-inbox-agent | 0 | 待驗證 | 讀信→判真 lead→抽需求→建議下一步（+ guardrail 層） | https://github.com/kanikadhaundiyal13/sales-inbox-agent |
| jevmail | 待驗證 | 待驗證 | 本機唯讀分流；**1000 封 ≈ 3 美分**（成本標竿） | https://github.com/fazlerocks/jevmail |
| Auto-Email-Reply-Agent | 待驗證 | 待驗證 | **80% 自動／20% 刻意升級給人**的路由原則 | https://github.com/Asad-jatt-477/Auto-Email-Reply-Agent |

---

<!-- ===== 09 M1–M14 模組對照 ===== -->

## M1–M14 模組對照（含本戰役取捨）

| 模組 | 借誰 | G-002 是否啟用 |
|---|---|---|
| **M1 市場雷達** | BuildRadar 7 維評分；sales-intelligence-agent 的 GitHub Actions cron | ❌ 第一戰不用 |
| **M2 ICP 分析** | BuildRadar `build_icp`（bottom-up）；opengtm 6 維權重；sales-signals 多 ICP 隔離 | ⚠️ 簡化：只用「六項體檢 + 四條淘汰規則」 |
| **M3 尋客** | OpenLeads 聯邦架構；lead-finder CT log；scrapehubai stargazer；**google-maps-scraper** | ✅ **Google Maps 單一來源** |
| **M4 意圖訊號** | sales-signals ATS；sales-intelligence-agent 共振 pattern；ProspectOS 缺陷即訊號 | ✅ **併入體檢，不獨立** |
| **M5 公司情報** | CompanyScope 11 工具聚合；FORGE 技術棧；opengtm AEO 健檢 | ✅ **只做 IG／FB 影音面** |
| **M6 決策者情報** | StaffSpy 全員撈取；explorium `decision-makers-map`；OneWave `champion-identifier` | ❌ 實體店老闆 = 決策者本人 |
| **M7 Enrichment** | OpenProspector 19 家瀑布；email-sleuth；FORGE 6 層偵測；Harvey 誠實四級標記 | ❌ 不需要 email，走 IG DM |
| **M8 Lead Scoring** | ai-sales-team 5 路加權；autonomous-sdr 自優化 BANT；opengtm 6 維 | ✅ **體檢六項即評分** |
| **M9 Outreach** | bricks writer↔critic；OneWave panel simulator；OneShot writing lint；ProspectOS PDF 報告 | ✅ **體檢報告 + 15 秒樣片** |
| **M10 Follow-up** | Sales-Cadence 23 天序列；Harvey 3 封+節流；b2b-sdr 停滯偵測 | ⚠️ 簡化：L1 才 follow-up，最多 2 次 |
| **M11 Reply Intelligence** | SalesGPT 階段機；Harvey Handler；Auto-Email-Reply-Agent 80/20 | ✅ **三級意圖分類** |
| **M12 Human Handoff** | Sales-Cadence「AI 排程、人執行」；Harvey 審批佇列 | ✅ **L2 就轉，附完整 context 包** |
| **M13 CRM Memory** | Twenty 原生 MCP；b2b-sdr 4 層記憶；sales-signals 檔案式 CRM | ✅ **Markdown 檔案式 CRM** |
| **M14 Learning Loop** | OneShot 簽章收據；YALC Intelligence Store；**lead-finder skip reason → rule** | ✅ **skip reason + niche 交叉表** |

### 啟用 8 個、簡化 3 個、關掉 3 個

關掉的（M1／M6／M7）不是不重要，是**這一戰用不到**。
第二戰如果改打 B2B 或改走 email，再開回來。

---

### 從 OpenOutreach 的失敗反推的四條設計要求

OpenOutreach 作者自己在 README 寫下：輸出無 score 欄位、**被拒 lead 永不匯出**、學習迴路**「尚未證明勝過隨機挑選」**、無內建去重。

連起來讀就是因果診斷：
> 丟掉負樣本 + 分數不外露 + fit 與 timing 混算 + 沒有結果回流 = 學習迴路必然學不動。

所以本戰役的四條鐵律：
1. **保留被拒 lead 與拒絕理由**（負樣本是一半的訓練資料）
2. **體檢分數必須可拆解**（六項各自的分數都要存）
3. **回報標準用意圖等級，不是回不回**（結果要能回流）
4. **去重從第一天就做**（Maps 會重複撈到同一家）

---
