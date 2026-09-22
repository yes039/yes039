# AI 獵客系統｜全網兵器搜索報告

> 基準樣本：**OpenOutFind / OpenOutSend / OpenOutreach**（eracle）
> 搜索日期：2026-09-22
> 立場：**收器 → 看器 → 判器**，不設計產品，只拆零件。

---

## 資料可信度聲明

- 所有 Stars / License / 能力描述皆來自該日實際抓取的 GitHub 頁面或官方文件，並附原始連結。
- **「最近更新」欄位**：GitHub 頁面上常只顯示 commit 總數而非日期，凡未能取得確切日期者一律標記 **待驗證**，不做推測。
- 星數為抓取當下快照，會變動。
- 凡標 **待驗證** 者，代表該欄位我沒有拿到第一手證據，請勿直接引用。
- 本報告不含任何虛構的 repo、星數、授權或功能。

---

# 第一部分：候選兵器清單（42 支）

分級定義：
- **A級**＝開源 + Self-host + Agent-native + 可組裝
- **B級**＝開源，但重度依賴外部 API / Data Provider
- **C級**＝閉源或半閉源，但方法／架構值得借鑑
- **D級**＝Demo / 新專案 / 研究，但有特殊能力值得拆解

---

## 【基準樣本】

### 00. OpenOutreach（含 OpenOutFind / OpenOutSend）

- **專案名稱**：OpenOutreach
- **GitHub**：https://github.com/eracle/OpenOutreach
- **Stars**：3.1k（forks 561）
- **最近更新**：main 分支 1,043 commits；確切日期 **待驗證**
- **開源授權**：GNU GPLv3
- **Self-host**：✅ 一行安裝 CLI
- **Local-first**：✅ 設定與資料存 `~/.openoutreach`
- **使用技術**：Python、Django registry（雙 app 編排）、UV、JSON Lines 作為 process 間通訊
- **需要外部 API**：LLM（OpenAI / Anthropic / OpenAI-compatible）、**BetterContact**（lead 探索 + email 解析，付費信用點）、SMTP（Gmail Workspace 等）
- **資料來源**：BetterContact 授權資料庫

**核心能力（管線）**：`Discover → qualify → gate → resolve → write → send`
1. 產品描述 → LLM 生成搜尋關鍵字
2. 授權來源撈 profile（免費，無 email）
3. LLM 依 ICP 判定，**Gaussian Process 從判決中學習**
4. 信心門檻過了才觸發付費 email 解析（1 credit / 1 驗證信箱）
5. Outreach agent 寫開場白，send guard 控送信

**覆蓋段落**：
✅找公司 ✅找人 ✅ICP判斷 ✅Enrichment ✅Email Finder ✅個人化文案 ✅Email Outreach ✅CRM(CSV/自帶)
⬜找市場 ⬜Buying Signal ⬜公司研究 ⬜個人研究 ⬜LinkedIn ⬜Follow-up ⬜Reply判讀 ⬜Analytics
🔺自我學習（有 GP learner，但官方 README 自承「尚未證明勝過隨機挑選」）

**可否拆成 Skill**：✅ 已有 `skills/find-leads/SKILL.md`，Markdown 規格、任何 agent 可讀
**可否接 Agent**：✅ Claude Code plugin `/plugin install openoutreach@openoutreach`
**可否接 MCP**：❌ 官方未提供
**CLI**：✅ `openoutreach run 5` / `find 10` / `find 10 emails` / `send` / `status`
**API**：🔺 CLI + JSONL，無 HTTP API

**已知限制（官方自述）**：輸出無 score 欄位、被拒 lead 不匯出、無內建去重、學習迴路未證明有效。

- **原始來源**：https://github.com/eracle/OpenOutreach ｜ https://pypi.org/project/openoutfind/0.1.14/ ｜ https://pypi.org/project/openoutreach/0.1.55/

---

## 【A級：開源 + Self-host + Agent-native + 可組裝】

### 01. YALC — the GTM Operating System

- **官方/GitHub**：https://github.com/Othmane-Khadri/YALC-the-GTM-operating-system
- **Stars**：311｜**授權**：MIT
- **最近更新**：main 330 commits，活躍；確切日期 **待驗證**
- **Self-host**：✅ 本機執行｜**Local-first**：✅ `~/.gtm-os/` + `./data/`
- **技術**：TypeScript、Node 20+、pnpm、SQLite/Turso + Drizzle、Anthropic SDK、MCP、Playwright(選)
- **外部 API**：Unipile、Crustdata、Firecrawl、Notion、FullEnrich、Instantly、Anthropic、Voyage（+ PeopleDataLabs / HubSpot / Brevo / Vercel 宣告式）
- **關鍵**：**在 Claude Code 模式下，Anthropic 與 Firecrawl 變成可選**——母 session 提供 LLM 與 web fetch

**覆蓋**：✅找公司 ✅找人 ✅ICP ✅Enrichment ✅Lead Scoring ✅個人化 ✅Email ✅LinkedIn ✅Follow-up ✅CRM ✅Analytics ✅自我學習

**最值得借**：
1. **Intelligence Store**——每次 campaign 結果回寫，狀態機 `hypothesis → validated → proven`。這是真正的 Learning Loop 實作。
2. **Outbound Validation**——送出前硬擋違規訊息（不是提醒，是 block）。
3. **DB-backed token bucket 速率限制**（LinkedIn / email 都走同一個閘）。
4. **24 顆原子級 orchestration skill + 一顆旗艦 `campaign-from-ICP`**——「一句話 → 5 分鐘 → 一個暫停狀態的 campaign」。這個「原子 skill + 旗艦 skill」的切法直接可抄。
5. **chi-squared A/B 測試**內建在 7 道 qualification gate 裡。

**Skill**：✅ `.claude/skills/`｜**Agent**：✅｜**MCP**：✅（email provider 可換）｜**CLI**：✅ `yalc-gtm`｜**API**：🔺 本機 dashboard :3847

**vs OpenOutFind**：多了 Learning Loop、多通道、CRM 雙向、速率限制、合規閘、MCP 可插拔；少了 OpenOutFind 的「單一供應商、一行跑完」的極簡。**獨門武器：Intelligence Store + outbound validation。**

---

### 02. OneShot GTM

- **GitHub**：https://github.com/oneshot-agent/oneshot-gtm
- **Stars**：697（forks 15）｜**授權**：MIT
- **最近更新**：main 508 commits，活躍；日期 **待驗證**
- **Self-host / Local-first**：✅✅ SQLite ledger 全在本機
- **技術**：Bun 1.3+、TypeScript 6、Vite + React 19 + TanStack、bun:sqlite、Vitest（4,245 測試 / 335 檔）、Turborepo
- **外部 API**：OneShot SDK（閉源）抽象 **50 家資料供應商**；LLM 自帶（OpenRouter/OpenAI/Anthropic）

**覆蓋**：✅找市場 ✅找公司 ✅找人 ✅ICP ✅Buying Signal ✅Enrichment ✅Email Finder ✅個人化 ✅Email ✅實體信 ✅Follow-up ✅Reply triage ✅Analytics

**最值得借**：
1. **簽章收據（signed receipts）**——每個動作產生密碼學簽章紀錄：為什麼做（memo）、決策脈絡、goal ID、結果歸因。可以算出**真實 CAC / RoCS**，不是估的。這是全場唯一一個把「成本可稽核」當一級公民的設計。
2. **15 個 Finder**：Show HN、募資、GitHub、活動……各自是獨立尋客源，可單獨拆。
3. **ICP Gate 擺在付費 call 之前**——省錢的架構位置。
4. **AI Writing Lint**：擋禁用詞、em-dash、諂媚語氣（對照 Wikipedia canon）。這是「讓 AI 文案不像 AI」的規則化實作。
5. **Pre-PMF 軟閘**：訊號不足時擋住 scale 動作，要 `--force` 才過。
6. **Founder Voice + 一個真實讓步（true concession）** 寫進每封信。

**Skill**：❌ 未提供｜**MCP**：❌｜**CLI**：✅ **73 個指令**｜**API**：🔺 本機 UI

**vs OpenOutFind**：多了收據帳本、15 個免費尋客源、reply triage、實體信、weekly review；少了 MCP / Skill 化（它是 CLI 帝國，不是 agent-native）。**獨門武器：signed receipts 成本歸因帳本。**

---

### 03. Harvey — Autonomous AI sales agent powered by Claude Code

- **GitHub**：https://github.com/ethanplusai/harvey
- **Stars**：68｜**授權**：MIT｜**版本**：0.2.0
- **Self-host / Local-first**：✅✅ SQLite `data/harvey.db`，資料不出機器
- **技術**：Python 3.11+、SQLite、FastAPI（dashboard JSON API）、純 HTML/CSS/JS 前端、**Claude CLI headless 模式**
- **外部 API**：OpenStreetMap/Overpass（免費無限）、DataForSEO（$0.37/1000 商家）、Serper；Gmail API / SMTP+IMAP / Instantly

**覆蓋**：✅找公司 ✅找人 ✅ICP ✅Buying Signal ✅Enrichment ✅Email Finder ✅Lead Scoring ✅公司研究 ✅個人化 ✅Email ✅Follow-up ✅**Reply判讀** ✅Analytics 🔺自我學習

**最值得借**：
1. **用 Claude Pro/Max 訂閱跑 agent，不走 per-token API 計費**——`claude` CLI headless。這一招直接改變 agent 經濟學：可以讓 agent 反覆推理、塞滿 context，成本不爆。
2. **「23 個訊號」人工確認機制**：系統提出 23 個 signal，你 approve/skip/reject，**通過的 cohort 直接變成 SQL query**。邏輯透明可稽核，不是黑箱分數。
3. **五個專職 agent**：Scout(評分/個人化)、Writer(3 封序列)、Sender(合併變數/節流)、**Handler(讀回信、分類意圖、偵測退信、處理異議)**、Analyst(閒置時跑統計)。
4. **可編輯 Markdown 技能庫取代微調**：AIDA/PAS/BAB/QVC/3Ps 郵件框架、LAARC 異議處理迴圈、BANT/MEDDIC、`harvey train <url>` 生成產品知識。**改檔案，下一個 heartbeat 就生效，不用重啟。**
5. **確定性保險絲**：pre-send gate（完全不經過模型）、退信 kill-switch、安靜時段、每日花費上限、審批佇列。
6. **誠實地標記 email 是 verified 還是 guessed**。

**Skill**：✅ Markdown skill 檔｜**Agent**：✅ 本身就是 Claude Code 驅動｜**MCP**：❌｜**CLI**：✅｜**API**：✅ FastAPI

**vs OpenOutFind**：多了 Reply 判讀、Follow-up、訂閱制成本模型、可編輯技能庫、確定性送信閘；少了 OpenOutFind 的大型 B2B 資料庫（Harvey 專攻 5–50 人本地小商家）。**獨門武器：訂閱制 agent 經濟學 + 人工確認訊號轉 SQL cohort。**

---

### 04. OpenLeads

- **GitHub**：https://github.com/Samyrrrrrr990/openleads
- **Stars**：24｜**授權**：**PolyForm Noncommercial 1.0.0**（商用需另外授權，注意！）
- **最近更新**：main 46 commits；日期 **待驗證**
- **Self-host / Local-first**：✅✅ 全本機，SQLite 在 `~/.openleads`，無 hosted backend、無帳號、無追蹤
- **外部 API**：**零**（keyless）

**資料來源（聯邦式，全免費公開源）**：OpenStreetMap/Overpass（本地商家）、**Y Combinator 創辦人**、Hacker News 公司、Wikidata 公司、**SEC EDGAR**（美國上市公司）、GitHub 開發者、**OpenAlex 研究者**、**NPI Registry**（美國醫療從業者）、ProductHunt、網域 email 探索（Hunter 式）

**覆蓋**：✅找市場 ✅找公司 ✅找人 ✅Enrichment ✅Email Finder 🔺Lead Scoring ✅Email Outreach（內建 mailbox）
⬜Buying Signal ⬜LinkedIn ⬜CRM

**最值得借**：
1. **「聯邦式公開資料尋客」架構**——10 個免費來源各自是一個 adapter。這是最乾淨的 M3 尋客模組骨架。
2. **七訊號 email 送達共識（seven-signal deliverability consensus）**，而且**大部分不需要 port 25**。對不能開 25 埠的雲端環境是救命設計。
3. 輸出帶 0–100 信心百分比 + 三層驗證等級（safe / risky / bad）。
4. `openleads run "50 fintech founders, verified only" --live` ——自然語言直接變查詢。

**CLI**：✅｜**Skill/MCP**：❌｜**API**：🔺 CSV/JSON 輸出

**vs OpenOutFind**：多了完全免金鑰、10 個公開資料源、七訊號驗證共識；少了 LLM ICP 推理與「為什麼值得聯絡」的理由生成。**獨門武器：零金鑰聯邦尋客 + 無 port 25 的驗證共識。**
⚠️ **授權陷阱：非商用授權，商用要談。**

---

### 05. FORGE / DataForge

- **GitHub**：https://github.com/Nuclear-Marmalade/dataforge
- **Stars**：54（forks 13）｜**授權**：MIT
- **最近更新**：main 28 commits；日期 **待驗證**
- **Self-host / Local-first**：✅✅ 本機 + **Ollama 本地 AI**，無 API 成本
- **技術**：Python + PostgreSQL + Ollama + async 爬蟲（Claude API 只用於 audit）

**核心能力**：
- **Email 偵測 6 層**：mailto 連結 → regex → **Cloudflare 解碼** → JSON-LD → 混淆解碼 → 聯絡頁爬取
- **技術棧偵測 30+**（WordPress、React、Shopify、Stripe…）
- **政府資料**：FCC 電信紀錄、NPI 醫療登記、**SAM.gov 聯邦承包商**
- SMTP 驗證（不送信）、SSL 狀態、網站速度
- **本地 AI 富化**：商業摘要、產業分類、健康分數、痛點——**零 API 成本**

**覆蓋**：✅找公司 ✅Enrichment ✅Email Finder ✅公司研究 🔺Lead Scoring（health score / pain points）

**最值得借**：
1. **6 層 email 偵測瀑布**——尤其是 Cloudflare 混淆解碼與 JSON-LD 抽取，這是很多爬蟲漏掉的兩層。
2. **政府開放資料當 enrichment 源**（FCC / NPI / SAM.gov）——這是別人沒有的冷門彈藥。
3. **Ollama 本地 LLM 做分類與痛點抽取**——把「判客」成本壓到零。
4. Checkpoint 續跑與 rollback。

**Skill**：❌｜**MCP**：✅ 有 MCP server 供 Claude 使用｜**CLI**：✅ `enrich` / `discover` / `dashboard`｜**API**：🔺 Web dashboard

**vs OpenOutFind**：多了免金鑰富化、政府資料、技術棧偵測、本地 LLM；少了 outreach 與 ICP 語意判斷。**獨門武器：政府資料庫 + 6 層 email 偵測 + Ollama 零成本富化。**

---

### 06. email-sleuth

- **GitHub**：https://github.com/buyukakyuz/email-sleuth
- **Stars**：425｜**授權**：MIT｜**語言**：**Rust**
- **最近更新**：main 13 commits；日期 **待驗證**
- **Self-host / Local-first**：✅✅｜**外部 API**：核心功能**不需要**（DNS/SMTP 自幹），進階模式可選 ChromeDriver

**三種模式**：basic（DNS+SMTP）→ enhanced（+API 驗證）→ comprehensive（+無頭瀏覽器）

**覆蓋**：✅Email Finder ✅Enrichment（email 面）

**最值得借**：
1. **自動偵測 SMTP port 25 被封鎖並切換驗證策略**——這是全場最實用的一個小刀。雲端環境 99% 封 25 埠。
2. 0–10 信心分數 + 每個聯絡人的詳細驗證日誌（可稽核）。
3. Rust 單檔 CLI，`es "John Doe" example.com`，批次 `es -m comprehensive -i contacts.json -o results.json`；還有 service 模式（start/stop/restart）可當常駐服務被 agent 呼叫。

**Skill**：🔺 可包｜**MCP**：❌｜**CLI**：✅｜**API**：✅ service 模式

**vs OpenOutFind**：這是一把純粹的專用刀。OpenOutFind 的 email 解析是付費的 BetterContact，**email-sleuth 可以當它的免費前置瀑布層**（先自己找，找不到才付錢）。**獨門武器：port 25 封鎖自適應。**

---

### 07. BuildRadar（reddit-intel-agent-mcp）

- **GitHub**：https://github.com/Houseofmvps/reddit-intel-agent-mcp
- **Stars**：2｜**授權**：MIT｜**最近更新**：main 98 commits；日期 **待驗證**
- **Self-host**：✅ Docker / Railway / Node.js｜**Local-first**：✅
- **外部 API**：**零**（「No signup. No API keys.」Reddit 匿名 10 req/min，認證可選）

**14 個工具（3 類）**：
- 擷取(5)：`browse_subreddit` `search_reddit` `post_details` `user_profile` `reddit_explain`
- 情報(6)：`find_pain_points` `detect_workarounds` `score_opportunity` `monitor_competitors` `extract_feature_gaps` `track_pricing_objections`
- 獲客(3)：**`find_buyer_intent`** **`build_icp`** **`export_evidence_pack`**

**覆蓋**：✅找市場 ✅ICP判斷 ✅**Buying Signal** ✅個人研究 🔺個人化文案（evidence pack）

**最值得借**：
1. **7 維機會評分（0–100）**：痛點頻率、嚴重度、替代方案普及率、競品弱點、時效性、subreddit 品質、噪音懲罰。這是我看過最細的「公開討論 → 商業機會」量化模型。
2. **`export_evidence_pack`**——把證據打包輸出。這正是「為什麼這個人值得聯絡」的原料。
3. **MCP + REST 雙協議**：MCP(stdio/StreamableHTTP/SSE) 給 AI IDE，REST 給任何 HTTP client。**這是最乾淨的「一份能力、兩種接法」範本。**
4. `track_pricing_objections` 與 `detect_workarounds` 是罕見能力：直接抓「客戶現在用什麼土法煉鋼」。

**Skill**：🔺｜**Agent**：✅ Claude Desktop/Code、Cursor、Windsurf、ChatGPT GPTs、Gemini｜**MCP**：✅✅｜**CLI**：🔺｜**API**：✅ REST

**vs OpenOutFind**：完全不同軸線。OpenOutFind 從 firmographic 找人，BuildRadar **從公開抱怨找需求**。**獨門武器：7 維機會評分 + evidence pack + 零金鑰。**

---

### 08. sales-signals

- **GitHub**：https://github.com/jaime-cervera/sales-signals
- **Stars**：0（極新）｜**授權**：MIT｜**最近更新**：main 1 commit
- **Self-host / Local-first**：✅✅ 檔案式 CRM（Markdown 表格）
- **外部 API**：Unipile（LinkedIn Jobs + Sales Navigator）、**零 token 的 ATS feed（Greenhouse / Ashby / Lever）**、WebSearch + Playwright

**核心洞見**：**公司在招什麼職位 = 它在建什麼 = 它需要買什麼。**
> 一家公司在招「LLMOps Engineer」＝它正在蓋 LLM 基礎設施＝可觀測性廠商的高意向訊號。

**覆蓋**：✅找公司 ✅ICP ✅**Buying Signal** ✅找人（決策者抽取）✅Lead Scoring（5 維）✅CRM（檔案式）🔺個人化（只起草不自動送）

**最值得借**：
1. **職缺即意圖（hiring-as-intent）的向量化**：把公司所有開缺 roll-up 成 account 級訊號強度分數。
2. **零 token ATS feed**——Greenhouse/Ashby/Lever 的公開 JSON，完全免費，這是最被低估的意圖資料源。
3. **多 ICP 隔離**：每個客群一條獨立 pipeline，各有自己的 signal 與權重。做代理／多產品線時必要。
4. **Playwright liveness 驗證**——確認訊號「現在還活著」（職缺沒下架）。訊號時效性驗證，別人幾乎都沒做。
5. **append-only 檔案式 CRM + 去重/合併/完整性檢查**——不需要資料庫。

**Skill**：✅ slash command（`/career-ops scan`）｜**Agent**：✅ Claude Code / OpenCode / Gemini CLI｜**MCP**：🔺｜**CLI**：✅

**vs OpenOutFind**：多了完整 buying signal 層、多 ICP、時效驗證；少了成熟度（1 commit）與寄信能力。**獨門武器：ATS 職缺零成本意圖源 + liveness 驗證。**
⚠️ D級成熟度，但概念值 A級。

---

### 09. sales-intelligence-agent（Maha-Jr10）

- **GitHub**：https://github.com/Maha-Jr10/sales-intelligence-agent
- **Stars**：0｜**授權**：MIT｜**最近更新**：master 140 commits，活躍；日期 **待驗證**
- **Self-host**：✅ **跑在 GitHub Actions 免費層**｜**外部 API**：嚴格來說**零**（GitHub Token 只為提高 rate limit 60→5000/hr；Slack webhook、Hunter/Apollo/Clay 皆選配）

**7 個公開訊號源**：公司 RSS/blog、Google News + Yahoo News、結構化職缺板（Greenhouse/Lever/Ashby）、GitHub 組織公開活動、Product Hunt 上架、Indeed + HN 徵才、網站技術棧爬取

**覆蓋**：✅找公司 ✅**Buying Signal** ✅公司研究 ✅Lead Scoring ✅Analytics ✅個人化（簡報）

**最值得借**：
1. **六種具名的「多訊號共振 pattern」**，帶時間窗與加權：
   - `triple-signal-conviction`（30 天窗，+25 分）
   - `post-funding-leadership`（90 天窗，+22 分）
   - `leadership-driven-evaluation`（45 天窗，+20 分）
   **這是把「訊號」升級成「訊號組合」的具體實作——單一訊號是噪音，共振才是意圖。**
2. **可讀的 explainability trace + buying narrative**：每個 pattern 命中會產生人類可讀的解釋。這就是「為什麼這個人值得聯絡」。
3. **三層分離架構**：Markdown SOP 指導 Claude 推理 / Python 腳本做確定性執行 / agent 做判斷與綜合。**這是 agent 系統架構的教科書分法。**
4. **整套跑在 GitHub Actions 免費額度**：每日 06:00 UTC 掃描、每週一 07:00 報告、手動深研。**零基礎設施成本的 always-on 雷達。**

**Skill**：✅ Markdown SOP｜**Agent**：✅｜**MCP**：❌｜**CLI**：✅｜**API**：🔺 輸出 Markdown + JSON + Slack

**vs OpenOutFind**：多了訊號共振、可解釋 trace、零成本排程；少了找人與寄信。**獨門武器：多訊號共振 pattern + GitHub Actions 當 cron。**

---

### 10. OpenProspector

- **GitHub**：https://github.com/clawnify/OpenProspector
- **Stars**：9｜**授權**：MIT｜**最近更新**：main 26 commits；日期 **待驗證**
- **Self-host**：✅｜**外部 API**：**19 家供應商，全部自帶金鑰**

**瀑布式供應商清單**：
- Email：Findymail、LeadMagic、Anymail Finder、Hunter、Skrapp、Tomba、Datagma、Snov.io、Surfe、Prospeo、Wiza、RocketReach、Apollo、People Data Labs、ContactOut、Forager、Dropcontact、Kaspr、Zeliq
- Phone：Forager、PDL、Datagma、Surfe、RocketReach、Kaspr、LeadMagic、Wiza、ContactOut、Prospeo、Apollo、Zeliq
- Company：Apollo、Hunter、Wiza、RocketReach、PDL、Prospeo、LeadMagic、Datagma、Tomba、Forager、Findymail、ContactOut、Surfe、Snov.io

**覆蓋**：✅Enrichment ✅Email Finder ✅公司研究 ✅Analytics（成本歸因）

**最值得借**：
1. **瀑布編排邏輯**：先查快取 → 跳過缺輸入的供應商 → 優先 verified 結果 → **記錄所有嘗試以供歸因**。「first verified result wins」避免重複付費。
2. **append-only 成本帳本 + 每欄位歸因**——哪個供應商產出了哪個欄位，一目了然。可算真實單位成本（約 $0.02/verified email vs SaaS 的 $0.12–0.15）。
3. **deferred vendor 機制**：Dropcontact / Zeliq / Apollo phone 是非同步的，系統會把 lead 掛起等 webhook 回呼。**這是做多供應商整合時最常翻車的地方，他們解了。**
4. **每欄位可設定各自的瀑布順序**。
5. Agent-native sourcing：agent 可直接驅動搜尋。

**Skill**：🔺｜**MCP**：❌｜**CLI**：✅｜**API**：✅ 完整 OpenAPI `/api/openapi.json`

**vs OpenOutFind**：OpenOutFind 綁死 BetterContact 一家；**OpenProspector 是可以直接接在它下面的供應商抽象層**。**獨門武器：19 家瀑布 + 歸因帳本 + deferred webhook 處理。**

---

### 11. lead-finder（maledadams）

- **GitHub**：https://github.com/maledadams/lead-finder
- **Stars**：1｜**授權**：MIT｜**最近更新**：main 63 commits；日期 **待驗證**
- **Self-host**：✅ 跑在自己的 Cloudflare Workers + D1，**無任何外部服務相依**
- **外部 API**：**無第三方 LLM key**（用 Cloudflare Workers AI）

**覆蓋**：✅找公司 ✅Lead Scoring ✅個人化文案 ✅Email Outreach（審批後）✅**自我學習**

**最值得借**：
1. **「口味學習迴路」**——這是全場最漂亮的一招：
   > 「你的 skip 理由會變成規則，而且**凌駕模型自己的判斷**。」
   你拒絕一個 lead 並寫理由 → 系統把理由轉成規則 → 未來評分時規則優先於模型。**不用微調、不用 embedding，純規則沉澱。**
2. **成本分層**：「先跑便宜的確定性規則，只對已經掙到資格的候選做一次 AI 呼叫。」文案不是生成而是**從抓到的證據組裝**——寫作成本歸零。
3. **四個冷門尋客源**：OpenStreetMap 商家、**Certificate Transparency logs（新網域！）**、獨立品牌間的連結圖、Wikipedia 關鍵字採集。
   → **CT log 當「新公司剛成立」訊號，這招非常兇。**
4. 每封信都進審批面板。

**Skill**：❌｜**MCP**：❌｜**CLI**：🔺｜**API**：🔺 Workers

**vs OpenOutFind**：多了學習迴路、CT log 訊號源、零 LLM 金鑰；少了 B2B 資料庫規模。**獨門武器：skip reason → rule 的口味沉澱 + Certificate Transparency 新網域偵測。**

---

### 12. warmbly

- **GitHub**：https://github.com/warmbly/warmbly
- **Stars**：310｜**授權**：Apache-2.0｜**最近更新**：main 2,785 commits，活躍；日期 **待驗證**
- **Self-host**：✅ Docker Compose 一行、兩分鐘；**不需要 AWS/GCP/Stripe/Kafka**
- **技術**：Go 1.25、PostgreSQL、Redis、TypeScript 前端、iOS app、REST API

**覆蓋**：✅Email Outreach ✅Follow-up ✅**送達率基建** 🔺Reply（visual reply playbook）

**最值得借**：
1. **「一池被監控的信箱，不是拋棄式帳號」**的 warmup 設計哲學。
2. **送達率工具組**：退信與客訴追蹤、抑制名單、**inbox placement 監測**、每信箱寄送上限與間隔。
3. **visual reply playbook**——把回信處理做成可視化流程圖 + AI 步驟。
4. REST API + webhook，文件齊全（docs.warmbly.com/api/）。

**Skill/MCP**：❌｜**CLI**：🔺｜**API**：✅✅

**vs OpenOutFind**：OpenOutFind 只有 SMTP + send guard，**完全沒有 warmup 與送達率監控**。這是它最大的基建缺口。**獨門武器：開源 warmup 池 + inbox placement 監測。**

---

### 13. opengtm

- **GitHub**：https://github.com/buildingopen/opengtm
- **Stars**：43（forks 9）｜**授權**：MIT (© 2026 Federico De Ponte)
- **Self-host**：✅ 本機跑，**只需要一把 Gemini API key**
- **技術**：Python 3.10+、Gemini 2.0 Flash + **Google Search grounding**、Google Sheets（Apps Script webhook）

**ICP 評分（6 維 / 0–100）**：公司規模 20、產業契合 25、數位成熟度 15、**痛點訊號 20**、營收訊號 10、聯絡品質 10 → Hot(70-100) / Warm(45-69) / Cold(0-44)

**覆蓋**：✅找公司 ✅ICP ✅Lead Scoring ✅公司研究 ✅個人化 ✅Email ✅CRM（webhook）✅Analytics（AEO）

**最值得借**：
1. **6 維加權 ICP 評分表**——權重明確、可直接抄成 M8 的 baseline rubric。
2. **Google Search grounding 做事實驗證**——用搜尋結果錨定 LLM 判斷，降低幻覺。
3. **AEO（Answer Engine Optimization）健康檢查**：爬對方網站做技術 SEO/AEO 分析 → 這本身就是「給對方的免費價值」＝最強的開場白素材。

**Skill**：🔺 支援 Claude Code 整合｜**MCP**：❌｜**CLI**：✅ `opengtm discover` / `analytics`｜**API**：✅ Python API

**vs OpenOutFind**：多了明碼標價的評分權重、AEO 分析、極低相依（一把 key）；少了大型 B2B 資料庫。**獨門武器：6 維評分表 + AEO 健檢當開場白素材。**

---

### 14. CompanyScope MCP

- **GitHub**：https://github.com/Stewyboy1990/companyscope-mcp
- **Stars**：4｜**授權**：MIT｜**最近更新**：**2026-04-25（已封存 archived）**
- **Self-host**：✅ npm 本機安裝無限次｜**Keyless**：✅（免費層 25 calls/day via Cloudflare Workers）

**11 個工具**：`lookup_company` `get_tech_stack` `get_key_people` `get_company_news` `get_corporate_registry` `get_financials` `get_competitors` `get_patents` `get_domain_intel` `get_job_postings` `get_social_presence`

**12 個免費資料源**：Wikipedia、Wikidata、GitHub API、**SEC EDGAR**、**OpenCorporates**、RDAP、DNS(Cloudflare)、Brave Search、**Google Patents**、網頁爬取、徵才頁、網域註冊商

**覆蓋**：✅找公司 ✅公司研究 ✅找人（key people）✅Buying Signal（job postings）✅Enrichment ✅競品

**最值得借**：
1. **「一次 tool call 拿到完整公司檔案」的聚合器模式**——11 個工具、12 個源、帶信心分數。這是 M5 公司情報模組的現成骨架。
2. **專利資料（Google Patents）與公司登記（OpenCorporates 140+ 司法管轄區）當 enrichment 源**——冷門但對高單價 B2B 極有用。
3. **RDAP + DNS 當公司技術/規模代理指標**。

**MCP**：✅✅ Claude / ChatGPT / Cursor / Windsurf / Cline｜**CLI**：🔺 npm

**vs OpenOutFind**：多了完整公司研究層（OpenOutFind 幾乎沒有 company research）。
⚠️ **已封存（archived, 2026-04-25），要用得 fork。**

---

### 15. b2b-sdr-agent-template（PulseAgent）

- **GitHub**：https://github.com/iPythoning/b2b-sdr-agent-template
- **官方**：https://pulseagent.io/open-source
- **Stars**：186｜**授權**：MIT｜**最近更新**：**2026-06-12**（OpenClaw v2026.6.6 release）
- **Self-host**：✅ Docker Compose 或裸機，5 分鐘
- **技術**：JavaScript/Node 18+、Shell 部署腳本、建構在 **OpenClaw** 之上｜相關：`iPythoning/b2b-sdr-hermes-skill`

**10 階段管線**：Lead Capture → BANT 資格 → CRM 建檔 → 研究與富化 → 報價 → 議價 → 回報 → 培育 → Email 觸達 → 多通道編排

**覆蓋**：✅找公司 ✅ICP/BANT ✅Enrichment ✅個人化 ✅Email ✅**WhatsApp/Telegram** ✅Follow-up ✅**Reply判讀** ✅CRM ✅Analytics

**最值得借**：
1. **4 層「抗失憶」記憶體架構**——這是全場最完整的 agent 記憶設計：
   - **L1 MemOS**：結構化記憶注入 + BANT 抽取
   - **L2 主動摘要**：context 用到 **65%** 時觸發壓縮
   - **L3 ChromaDB**：每回合向量儲存，**客戶隔離**
   - **L4 CRM 快照**：每日備份以供災難復原
   **→ 宣稱可跨 100+ 回合與系統重啟不失憶。這就是 M13 CRM Memory 的參考實作。**
2. **14 個 cron job 的排程設計**：即時 lead 進件、每 30 分鐘掃 Gmail、每日 09:00 pipeline 報告、每日 10:00 尋客、每日 15:00 **停滯 lead 偵測**、每週競品情報、每日**記憶健康檢查**。
3. WhatsApp / Telegram 通道（歐美以外市場關鍵）。

**Skill**：✅ Hermes skill 版本｜**Agent**：✅ OpenClaw｜**MCP**：🔺｜**CLI**：✅

**vs OpenOutFind**：多了記憶體架構、議價/報價階段、即時通訊通道、停滯偵測；少了大型資料庫尋客。**獨門武器：4 層抗失憶記憶體 + 65% context 壓縮觸發。**

---

### 16. autonomous-sdr（RodricDib06）

- **GitHub**：https://github.com/RodricDib06/autonomous-sdr
- **Stars**：0｜**授權**：MIT｜**最近更新**：**待驗證**
- **Self-host**：✅ 跑在自己 VPC，Docker Compose
- **技術**：**LangGraph 0.2**、FastAPI 0.136、PostgreSQL 16、Redis、APScheduler、React 18 + TS + Vite
- **AI**：Groq（預設，免費層 6000 req/hr）、Ollama、Anthropic｜研究：Tavily、DuckDuckGo
- **外部 API**：全部可選、多數有 mock（Hunter.io、PDL、Crunchbase、Twilio、HubSpot、Cal.com）

**6 個進件通道**：網站表單、廣告、inbound email、LinkedIn 訊號、活動/會議報名、通用 webhook（Zapier/Make/Typeform）

**10 節點 LangGraph**：`orchestrate → enrich → research → score_intent → analyse → validate`，再依判決條件路由到 booking / outreach / CRM sync / **human handoff**

**覆蓋**：✅ICP ✅Buying Signal ✅Enrichment ✅Lead Scoring ✅公司研究 ✅個人化 ✅多步觸達 ✅**約會預約** ✅CRM ✅**Human Handoff** ✅**自我學習**

**最值得借**：
1. **自優化 BANT 評分**：權重是可設定的 float，**learning rate 0.3**，每 N 個 lead 從轉換結果重平衡權重。這是 M14 Learning Loop 的最小可行實作。
2. **HubSpot 雙向同步**：判決推出去變 contact；**lifecycle 與 deal-stage webhook 回流進評分模型**。閉環的最後一哩。
3. **10 節點狀態機的節點切法**（orchestrate/enrich/research/score_intent/analyse/validate + 條件路由）——直接可抄的 LangGraph 骨架。
4. **6 通道進件抽象**（inbound + outbound 統一入口）。
5. 零付費 key 可跑（Groq 免費層 + mock）。

**Skill**：❌｜**MCP**：❌｜**CLI**：🔺｜**API**：✅ FastAPI

**vs OpenOutFind**：多了 inbound 通道、human handoff、約會預約、CRM 回流、自優化權重；少了社群驗證（0 star，未經實戰檢驗）。**獨門武器：conversion → BANT 權重回饋迴路。**
⚠️ 0 star，**D級成熟度**，但架構值得拆。

---

### 17. smart-trade-ai

- **GitHub**：https://github.com/chefroger/smart-trade-ai
- **Stars**：78｜**授權**：**AGPL-3.0**（注意傳染性）｜**最近更新**：main 607 commits，活躍
- **Self-host / Local-first**：✅✅ 資料存 `~/.trade/`，不上傳
- **技術**：建構在 **Hermes Agent**（MIT）｜LLM：OpenAI / Anthropic / DeepSeek / MiniMax / **Ollama 本地**｜搜尋：Tavily（免費 1000 次/月）

**38 個 B2B 技能**，橫跨：客戶開發（多通道搜尋、冷觸達生成、詢盤回覆、議價支援）、**盡職調查**（email 平台偵測、WHOIS、**制裁名單篩查**、技術棧分析、LinkedIn 驗證）、內容行銷、文件（合約/PI/報價單生成、技術圖分析、翻譯審校）、營運、**合規**（文化敏感度檢查、貿易術語、出口文件、平台政策）、分析（市場情報、客戶分群、pipeline 預測、每日簡報）

**覆蓋**：✅找市場 ✅找公司 ✅找人 ✅ICP ✅Enrichment ✅公司研究 ✅個人化 ✅Email ✅社群 ✅Follow-up(30天)✅Reply ✅CRM ✅Analytics

**最值得借**：
1. **「盡職調查」這整個維度**——制裁名單篩查、WHOIS、email 平台偵測。**其他所有專案都沒有「這個客戶能不能做」的風控層。**
2. **合規技能組**：文化敏感度、平台政策審查。做跨國觸達時這是免死金牌。
3. **5 階段客戶旅程 + 30 天追蹤 + KPI dashboard**。
4. 38 個技能的**命名與切分粒度**本身就是一份 skill 設計範本。

**Skill**：✅✅ 38 個｜**Agent**：✅ Hermes｜**MCP**：🔺｜**CLI**：✅

**vs OpenOutFind**：多了風控/合規/盡調、文件生成、議價；少了自動化尋客規模。**獨門武器：制裁篩查 + 合規審查層。**
⚠️ **AGPL-3.0，商用需留意傳染性。**

---

### 18. Sales-Cadence（Acumen）

- **GitHub**：https://github.com/Acumen-org/Sales-Cadence
- **Stars**：0｜**授權**：**待驗證**（頁面未顯示）｜**最近更新**：main 143 commits
- **Self-host**：✅ 多使用者，與自架 **Twenty CRM** 並存
- **技術**：TypeScript、Node 20+、Next.js 15（App Router + server actions）、Postgres 18、Prisma 6、Tailwind 3、Vitest 4、Playwright、Docker Compose

**覆蓋**：✅Follow-up ✅多通道排程 ✅Reply-stop ✅CRM 同步 ✅**Human Handoff（全人工執行）**

**最值得借**：
1. **「Twenty 是 system of record，Cadence 是 execution layer」的分層**——每 60 秒同步 + 每夜對帳。這是「CRM 記憶」與「每日動作」分離的乾淨架構。
2. **預設 23 天序列**：email / LinkedIn / call 分散在工作日；nurture 模式會依間隔重複，直到回覆、退訂或符合其他退出條件。**這是可以直接抄的 cadence 骨架。**
3. **Reply 自動關單**：webhook 進件 + Twenty activity 監測 → 「replies close open tasks」。`dnd` 同意欄位管退訂。
4. **刻意的反自動化立場**：
   > 「Cadence 從不寄信、從不自動化 LinkedIn。每一次觸達都由人執行。」
   **這是一個值得嚴肅對待的設計選擇——它把 AI 放在「決定今天碰誰、用哪個通道」，把執行留給人。**

**Skill/MCP**：❌｜**CLI**：🔺｜**API**：🔺

**vs OpenOutFind**：多了完整 cadence 引擎、多人團隊、reply-stop、CRM 分層；少了尋客。**獨門武器：23 天序列骨架 + reply-stop 自動關單 + 人機分工立場。**

---

### 19. Twenty CRM

- **官方**：https://twenty.com/ ｜**GitHub**：https://github.com/twentyhq/twenty
- **Stars**：56k+（forks 8.9k）｜**授權**：AGPL-3.0｜**最近更新**：**2026-09**（近期 push）
- **Self-host**：✅ Docker Compose + PostgreSQL + Redis
- **關鍵**：**Twenty 2.0 出貨了原生 MCP server**——Claude / ChatGPT / Cursor 可直接連進 CRM，**建立 deal、更新 pipeline、跑 workflow**

**覆蓋**：✅CRM ✅Analytics ✅workflow ✅權限
**最值得借**：
1. **原生 MCP CRM**——這是目前「agent 可寫入的開源 CRM」最成熟的選擇。M13 的預設答案。
2. **runtime 或 as-code 的 TypeScript 擴充框架**：objects / views / workflows / permissions / agents 都可擴充。
3. GraphQL API。

**MCP**：✅✅｜**API**：✅ GraphQL + REST｜**CLI**：🔺

**vs OpenOutFind**：OpenOutFind 的「CRM」只是 CSV。**Twenty 是它缺的那顆腦。**

---

### 20. DeskcommCRM

- **GitHub**：https://github.com/melgarafael/DeskcommCRM
- **Stars**：3.4k｜**授權**：MIT｜**最近更新**：main 6,540 commits，活躍
- **Self-host**：✅ Docker + `install.sh` 一行、自動 HTTPS、UI 內更新與自動備份
- **技術**：Next.js 16、React 19、TS、Supabase（Postgres + RLS + **pgvector RAG**）、Vercel AI SDK（OpenRouter/Anthropic/OpenAI/Google）、WAHA Plus / Meta Cloud API

**覆蓋**：✅Reply判讀 ✅Follow-up ✅CRM ✅Human Handoff ✅Analytics ✅**WhatsApp 全通道**

**最值得借**：
1. **MCP-ready server 暴露 CRM 操作給外部 agent**。
2. **RAG 組織記憶 + 情緒分析 + 自動轉真人**——這是 M11/M12 的成品級實作。
3. **多業態詞彙系統**：電商的「won」＝「已付款」、診所＝「已預約」、房仲＝「已成交」。**同一套引擎換一層詞彙就換一個行業。這個抽象非常聰明。**
4. **WHEN/IF/THEN 無程式碼 webhook 自動化框架**。
5. **反封號節流的可視化理由說明 + 風險雷達**——告訴你「為什麼現在慢下來」。
6. 多租戶 + LGPD 合規（RLS 隔離、稽核日誌、遮罩 worker）。

**MCP**：✅｜**API**：✅｜**CLI**：🔺

**vs OpenOutFind**：多了整個 inbound / 對話 / 客服 / 轉真人層。**獨門武器：多業態詞彙抽象 + 反封號可解釋節流。**

---

### 21. bricks（本地版 Clay）

- **GitHub**：https://github.com/BraaMohammed/bricks
- **Stars**：67｜**授權**：**待驗證**（頁面未顯示）｜**最近更新**：main 79 commits
- **技術**：React 18 + Vite + Zustand + Tailwind + shadcn/ui；Next.js 15 App Router 後端；**自建 Puppeteer browser pool**；Vercel AI SDK Core
- **外部 API**：OpenAI / Gemini / Groq（選）；搜尋 Serper / Tavily / DuckDuckGo(fallback)；email 驗證 Hunter / MillionVerifier / QuickEmailVerification

**覆蓋**：✅找公司 ✅Enrichment ✅Email Finder ✅公司研究 ✅個人化文案

**最值得借**：
1. **「免費 AI 瀑布閘道」跨 6 家供應商**：Ollama、Nvidia NIM、Cloudflare、OpenRouter、Google AI Studio……自動降級。**這是把 LLM 成本壓到接近零的工程手法。**
2. **雙 agent 觸達迴圈：writer + prospect critique**——一個寫、一個扮演收件人批評，反覆磨。**這是「個人化文案」品質的關鍵機制，OpenOutFind 沒有。**
3. **Formula editor**：欄位可以是 JavaScript、AI 呼叫、或網頁爬取——Clay 的核心抽象被複刻了。
4. 自建 Puppeteer pool 處理 JS 重的網站。
5. 後端提供 **OpenAI-compatible API** (`/api/ai/v1`)。

**Skill/MCP/CLI**：❌（純 Web UI + API）

**vs OpenOutFind**：多了 formula 抽象、雙 agent 文案迴圈、免費 LLM 瀑布；少了 CLI/agent 化。**獨門武器：writer↔critic 雙 agent 文案迴圈 + 免費 LLM 瀑布。**

---

### 22. Scout（kiryano）

- **GitHub**：https://github.com/kiryano/Scout
- **Stars**：645｜**授權**：MIT｜**最近更新**：main 16 commits；日期 **待驗證**
- **Keyless**：✅ 大部分免驗證（IG / TikTok / GitHub / YouTube / Twitch / Pinterest 免認證；LinkedIn 需 session cookie）

**平台**：Instagram、TikTok、LinkedIn、GitHub、YouTube、Twitch、Pinterest、**Linktree**
**抓取**：profile、bio、粉絲數、email、電話、連結、headline、網站、公司網域

**覆蓋**：✅找人 ✅個人研究 ✅Enrichment ✅Email Finder

**最值得借**：
1. **從 headline 反推公司網域 → 生成 email 候選 → SMTP 驗證**，全程不付費 API。
2. **Linktree 當聯絡資訊金礦**——創作者把所有連結都放那，很多人忽略這個源。
3. 八平台統一抽取器介面。

**CLI**：✅｜**Skill/MCP**：❌

**vs OpenOutFind**：多了社群/創作者軸線（B2C、KOL、個人品牌）；OpenOutFind 完全是 B2B firmographic。**獨門武器：跨 8 社群平台的免金鑰個人資料抽取。**

---

### 23. StaffSpy

- **GitHub**：https://github.com/cullenwatson/StaffSpy
- **Stars**：336｜**授權**：**WTFPL**（等同無限制）｜**最近更新**：main 178 commits
- **方法**：瀏覽器 session cookie / 帳密登入（需關 2FA）/ webdriver；可接 CapSolver 或 2Captcha

**能抓**：姓名、地點、bio、推估年齡、現職、職稱、學歷與證照、完整經歷、技能與背書、粉絲/人脈/共同好友數、**推斷的 email 與電話**、頭像與 banner
**方法**：`scrape_staff()` `scrape_users()` `scrape_comments()` `scrape_companies()` `scrape_connections()` → Pandas DataFrame / CSV

**覆蓋**：✅找人 ✅個人研究 ✅Enrichment ✅決策者定位

**最值得借**：
1. **`scrape_staff(company)` ——給一間公司，撈出全體員工**。這是「決策者定位」最直接的原料，而且是免費的（相對 Sales Navigator）。
2. **`scrape_comments()`**——抓貼文留言者。**留言 = 輕度意圖訊號**，這是被嚴重低估的獲客源。
3. 輸出直接是 DataFrame，好接後續 pipeline。

**限制與風險（官方自述）**：單次搜尋上限 1000 筆（LinkedIn 限制）、可能被限流、**有封號風險**（官方稱無紀錄案例）、新帳號看到的隱藏 profile 較多。

**CLI**：🔺 Python lib｜**API**：✅ Python

**vs OpenOutFind**：多了「整間公司的人」與留言者訊號；少了合法授權（這是灰區工具）。**獨門武器：公司全員撈取 + 留言者訊號。**
⚠️ **合規風險高，自行評估 ToS。**

---

### 24. ProspectOS

- **GitHub**：https://github.com/nando0x/ProspectOS
- **Stars**：225｜**授權**：MIT｜**最近更新**：v2.0.0
- **Self-host**：✅ 完全自架｜⚠️ **僅 Windows**
- **技術**：Python 3.11+ / Flask 3.1 / SQLite；React 19 + TS + Vite 8 + Tailwind 4；instagrapi、gosom/google-maps-scraper、fpdf2、keyring
- **AI**：Gemini / Groq / NVIDIA Build **三家免費自動降級**

**覆蓋**：✅找公司 ✅Enrichment ✅Lead Scoring ✅公司研究 ✅個人化 ✅Follow-up ✅CRM ✅Analytics

**最值得借**：
1. **網站健檢當 ICP 訊號**：偵測「沒網站 / 安全性差 / 速度慢 / 非行動優先」——
   > **「爛掉的網站也是 lead。」**
   把「對方的缺陷」直接變成「我們的切入點」，這是最強的 signal→pitch 轉換。
2. **生成 PDF 診斷報告丟 WhatsApp**——把觸達從「請你買」變成「這是你的免費體檢」。
3. **Instagram 貼文留言者 → profile 富化**（與 StaffSpy 的留言訊號同源思路）。
4. 視覺化 kanban 漏斗 + 遞增節奏的 follow-up 任務。
5. 三家免費 AI 自動降級。

**CLI/MCP/Skill**：❌

**vs OpenOutFind**：多了「缺陷偵測 → 診斷報告」的價值前置觸達模式。**獨門武器：網站健檢 PDF 當開場禮。**

---

### 25. google-maps-scraper（omkarcloud）

- **GitHub**：https://github.com/omkarcloud/google-maps-scraper
- **Stars**：3.5k｜**授權**：MIT｜**最近更新**：master 210 commits
- **抓取**：**50+ 資料點**——名稱、分類、地址、電話、網站、email、社群檔案、評分、評論數
- **免費額度**：200 搜尋/月免信用卡；官方宣稱可產出 20,000+ 免費 lead/月（**此數字為官方行銷語，待驗證**）

**覆蓋**：✅找公司（本地商家）✅Enrichment ✅Email Finder
**最值得借**：本地商家/實體店家的規模化抽取；內建 API + npm 套件 + Python lib，可 AWS/GCP VM 部署。
**CLI/API**：✅｜相關：`omkarcloud/google-maps-reviews-scraper`（184★）——**評論內容是最直接的痛點來源**。

---

### 26. influencer-discovery（tigerless-labs）

- **GitHub**：https://github.com/tigerless-labs/influencer-discovery
- **Stars**：208｜**授權**：**待驗證**｜**最近更新**：**待驗證**
- **技術**：**純 Python 標準函式庫，零第三方套件**（≥3.11）；Google Sheets 走 service account token impersonation

**15 個通道**：X/Twitter、Instagram、TikTok、Threads、YouTube、Reddit、Mastodon｜DEV.to、Hashnode、WordPress.com、Micro.blog｜自架 blog、電子報、Podcast｜freeCodeCamp News、HackerNoon

**覆蓋**：✅找人 ✅個人研究 ✅Enrichment（公開聯絡資訊）

**最值得借**：
1. **明確的篩選準則：「自帶受眾的人」，排除純產品開發者。**這個 ICP 定義方式本身就是一課。
2. **以 (person, platform) 為 key 的去重**，避免同站身分碰撞。
3. **零依賴**——最容易移植成 skill 的一支。
4. 15 通道分 tier 的來源分層法。

---

## 【Skill / MCP 層：可直接拆進 Claude Code / Codex 的兵器】

### 27. ai-sales-team-claude

- **GitHub**：https://github.com/zubair-trabzada/ai-sales-team-claude
- **Stars**：**1.4k**｜**授權**：MIT｜**最近更新**：main 4 commits（新）
- **安裝**：Claude Code plugin，`install.sh`；選配 Python（reportlab / bs4 / requests）

**14 個技能**：`sales`(編排) `sales-prospect` `sales-research` `sales-qualify` `sales-contacts` `sales-outreach` `sales-followup` `sales-prep` `sales-proposal` `sales-objections` `sales-icp` `sales-competitors` `sales-report` `sales-report-pdf`

**5 個並行 agent（帶權重）**：公司研究(fit scoring, 25%)、聯絡人探索(決策者地圖, 20%)、機會評估(BANT, 20%)、競品情報(定位, 15%)、觸達策略(訊息與通道, 20%)

**覆蓋**：✅找公司 ✅找人 ✅ICP ✅BANT/MEDDIC ✅公司研究 ✅個人化 ✅Follow-up ✅競品 ✅提案 ✅異議處理 ✅報告

**最值得借**：
1. **5 個 agent 的加權合成分數（0–100）**——不是單一 LLM 打分，是五路並行再加權。**這個結構直接可抄成 M8。**
2. **14 個技能的命名規範（`sales-*` 前綴 + 動詞）**——skill 命名與切分的最佳範例之一。
3. `sales-objections` 與 `sales-proposal` 把管線延伸到「成交」段，多數專案止步於寄信。
4. PDF pipeline report 輸出。

**Skill**：✅✅｜**Agent**：✅｜**MCP**：❌｜**CLI**：✅

**vs OpenOutFind**：多了整個中後段（qualify → prep → proposal → objections → report）；少了真實資料供應商（靠公開資料與 LLM）。**獨門武器：5 路並行加權評分 + 完整 sales skill 分類法。**

---

### 28. explorium gtm-skills + vibeprospecting-mcp

- **GitHub**：https://github.com/explorium-ai/gtm-skills （66★, MIT, main 20 commits）
- **GitHub**：https://github.com/explorium-ai/vibeprospecting-mcp （32★）
- **MCP endpoint**：`https://vibeprospecting.explorium.ai/mcp`
- **資料**：Explorium，**150M+ 公司、700M+ 聯絡人**，含即時 buying signal、firmographic、technographic、funding、workforce
- **認證**：**瀏覽器 OAuth，不用複製貼 API key**

**18 個技能**：`list-builder` `lead-gen-tool-builder` `browser-extension-builder` `enrich-company` `enrich-contact` **`account-fit-rank`** `score-leads` `account-research` `account-contact-shortlist` **`decision-makers-map`** `personalize-email` `competitor-research` **`lookalike-accounts`** **`market-sizing`** `meeting-prep` `clean-data` `abm-campaign`

**Agent 相容**：Claude Code (`claude install explorium-ai/gtm-skills`)、Codex、Grok Build/Bot、Hermes-Agent、OpenClaw、Claude Cowork；n8n 部分支援（走 MCP）

**最值得借**：
1. **18 個技能的切分法本身就是一張獲客能力地圖**——尤其 `market-sizing`（TAM/SAM）、`lookalike-accounts`（相似公司擴張）、`decision-makers-map`（買方委員會）、`clean-data`（去重與實體匹配），**這四個是 OpenOutFind 完全沒有的段落**。
2. **MCP 先給 5–10 列預覽，明確要求才處理全量並扣點**——「探索與消費分離」。這個 UX 模式應該抄進所有付費資料源整合。
3. OAuth 取代 API key 的 agent 認證流程。

**Skill**：✅✅｜**MCP**：✅✅｜**CLI**：✅

**vs OpenOutFind**：多了市場層(TAM)、lookalike、買方委員會地圖、資料清洗；資料量級也高一個檔次。**獨門武器：market-sizing + lookalike + 預覽/匯出分離。**
（B級：依賴 Explorium 專有資料）

---

### 29. gtm-pipeline-skills

- **GitHub**：https://github.com/keinsaasforever/gtm-pipeline-skills
- **Stars**：69｜**授權**：MIT｜**最近更新**：main 27 commits
- **宣稱**：「Clay 品質的資料，10–20% 的價格」
- **資料源**：Sales Navigator、**Parallel FindAll**、Firecrawl、web search + 9 個外部 API（Pipe0、FullEnrich、SerpAPI、Parallel、Firecrawl、Apify、OpenRouter、PhantomBuster、BetterContact）

**10 個技能**：`setup` `pipeline`(編排) `company-search` `company-enrichment` **`signal-search`** `people-search` **`contact-filter`** `people-enrichment` `outreach` `demo`

**最值得借**：
1. **兩條工作流的對照**：
   - **company-first**：search → enrichment → ICP scoring → signals → people → filter → enrich
   - **signal-first**：先用 buying intent 找到公司，再往下
   **→ 這兩條路線的分岔點，是整個獵客系統的架構選擇題。**
2. **`contact-filter` 獨立成一個技能**——ICP-based contact ranking 0–100。把「找到人」與「該聯絡哪個人」拆開，是對的。
3. **模組化：不需要一開始就備齊所有 API**，可單獨用任一技能。
4. 透過 MCP 接 PhantomBuster agent。

**Skill**：✅✅｜**MCP**：🔺｜**CLI**：✅（slash command）

---

### 30. markster-os

- **GitHub**：https://github.com/markster/markster-os
- **Stars**：64｜**授權**：MIT（ScaleOS 方法論為商標）｜**最近更新**：master 76 commits
- **安裝目標**：**Claude Code / GPT-Codex / Gemini CLI / OpenClaw 四個都支援**

**7 個預設技能**：`/markster-os`(診斷操作員) `/cold-email` `/events` `/content` `/sales` `/fundraising` `/research`；另有 30+ 擴充技能庫
**GOD Engine 9 塊磚**：地基 F1-F4（定位、商業模式、組織、財務架構）；執行（Find / Warm(內容+活動) / Book(email+LinkedIn) / Operate / Deliver）

**最值得借**：
1. **「先地基後執行」的順序強制**——定位／商業模式沒填好，執行技能不給跑（deterministic, prerequisite-checked）。**這是把「策略」變成 agent 前置條件的做法，很少見。**
2. **Warm 階段（內容 + 活動）夾在 Find 與 Book 中間**——多數獵客系統直接 Find→Book，這裡多了一層「先變熟」。
3. **Company context folder 當「正典身分」＋ learning loop 存「已核准的業務知識」**——記憶分成「不變的身分」與「累積的知識」兩層。
4. 無 dashboard、無 SaaS 費用，完全跑在既有 AI 環境內。

**Skill**：✅✅｜**Agent**：✅ 四種 CLI｜**MCP**：❌｜**CLI**：✅

**vs OpenOutFind**：多了策略地基層、Warm 階段、跨四種 agent CLI 相容；少了資料供應商。**獨門武器：prerequisite-gated 技能執行 + Warm 階段。**

---

### 31. OneWave claude-skills

- **GitHub**：https://github.com/OneWave-AI/claude-skills
- **Stars**：301｜**授權**：MIT｜**最近更新**：main 39 commits
- **相容**：遵循 Agent Skills 開放標準，**在 Claude Code / OpenAI Codex CLI / Gemini CLI / Cursor 等 30+ 工具中原封不動可用**

**與獵客相關的技能**：`deal-closer-playbook`（買方委員會地圖）、`expansion-revenue-finder`（增購/交叉銷售）、`cold-email-sequence-generator`、`champion-identifier`（內部擁護者）、**`lead-scoring-model`（從歷史資料建自訂評分模型）**、`inbound-lead-qualifier`（ICP fit + intent）、`pricing-change-strategist`、**`prospect-panel-simulator`（發送前壓測訊息）**

**最值得借**：
1. **`prospect-panel-simulator`**——**在寄出之前，模擬一組潛在客戶來批評你的訊息**。這是「個人化文案」的品管閘，與 bricks 的 writer↔critic 是同一家族但更成建制。
2. **`champion-identifier`**——找內部擁護者，不只是找決策者。B2B 複雜銷售的關鍵。
3. **`lead-scoring-model` 從歷史資料生成模型**——不是手刻權重。
4. `agent-army`：平行部署 3–50+ 個獨立 Claude agent，各有 1M context。（用於大規模掃描）

**Skill**：✅✅ 200+｜**Agent**：✅ 30+ 工具

---

### 32. Linked API skills + linkedapi-mcp

- **GitHub**：https://github.com/Linked-API/linkedin-skills （69★, MIT, main 28 commits）
- **GitHub**：https://github.com/Linked-API/linkedapi-mcp （68★）
- **方法**：走 **Linked API 雲端服務**（app.linkedapi.io token）+ `@linkedapi/linkedin-cli`，**不是瀏覽器外掛**
- **相容**：Claude Code / Codex / Cursor / Windsurf，統一安裝器自動偵測

**兩個技能**：`linkedin`（profile 抓取、人/公司搜尋、發訊息、人脈管理、發文）、**`linkedin-growth`**（lead pipeline：匯入 → ICP 資格判定 → **跨多帳號排程發邀請**）

**最值得借**：
1. **`linkedin-growth` 的兩階段 pipeline**：import → ICP qualify → scheduled invite，**且支援多帳號並行**。這是 LinkedIn 觸達規模化的正解（分散風險）。
2. **把 LinkedIn 動作做成託管服務而非本機自動化**——降低封號風險的架構選擇（另有 `gtm-api/linkedin-mcp` 90★ 宣稱 20,000+ 帳號、<1% 封號率，**此數字為廠商自述，待驗證**）。

**Skill**：✅｜**MCP**：✅｜**CLI**：✅

**vs OpenOutFind**：OpenOutFind **完全沒有 LinkedIn 觸達**。這是它最明顯的通道缺口。

---

### 33. Scrollport sales-prospecting-skills

- **GitHub**：https://github.com/Scrollport/sales-prospecting-skills
- **Stars**：0（新）｜**授權**：MIT｜**最近更新**：main 13 commits，最近驗證日 **2026-09-07**
- **技能**：`sales-qualified-accounts`（ICP → 排序後、可人工複核的「帳戶＋聯絡人」清單，附已驗證工作信箱）；`sales-prospecting-to-crm`（草稿，未開放安裝）

**最值得借**：
1. **「Evidence-backed」的定義非常嚴格，值得整條抄成規範**：
   > 「每一項硬性 fit 主張都保留來源；弱的列保持不完整或被拒絕。」
   **→ 寧可留空，不可編造。這應該寫進我們的 M8/M9 憲法。**
2. **每間通過的公司只選「一個核准的買方角色 + 一個已驗證工作信箱」**——品質優先於數量的極端版本。
3. 單一連線 + 單一錢包的計量工具，不必訂閱多家。

**Skill**：✅ `/plugin install`

---

### 34. signal-prospecting-kit

- **GitHub**：https://github.com/cismontane-harris2642/signal-prospecting-kit
- **Stars**：0｜**授權**：**待驗證**｜**最近更新**：**待驗證**
- **6 個 Claude Code 技能**：訊號偵測（全網掃目標帳戶提及）→ 公司研究（firmographic）→ 觸達起草（用訊號脈絡）→ **語氣調整（對齊品牌聲音）** → CRM 同步 → 週報
- **訊號源**：新職缺、**領導層異動**、募資輪
- **最值得借**：**「語氣調整」獨立成一個技能**——把「寫什麼」與「用什麼口吻寫」拆開，是很好的 skill 切分。所有草稿進資料夾等人審，不自動寄。

---

## 【B級：開源但重度依賴外部 API / Data Provider】

### 35. sales-outreach-automation-langgraph（kaymen99）

- **GitHub**：https://github.com/kaymen99/sales-outreach-automation-langgraph
- **Stars**：390｜**授權**：**待驗證**｜**最近更新**：main 30 commits
- **外部 API**：Google Gemini（LLM + embeddings）、**RapidAPI LinkedIn Profile Data**、Serper、Google（Docs/Sheets/Gmail）、HubSpot 或 Airtable

**LangGraph 節點**：Lead Fetching → Research & Analysis（多源）→ Qualification → Outreach Generation → CRM Update
**研究源**：LinkedIn profile、公司網站與 blog、社群動態、近期新聞、跨平台數位足跡
**CRM**：HubSpot / Airtable / Google Sheets，且有 base class 可擴充自訂 CRM

**最值得借**：
1. **個人化的做法不是「寫一封好信」，而是「產出一份客製稽核報告」**，然後 email 裡嵌報告連結。**價值前置，不是請求。**
2. **SPIN 方法論的訪談腳本自動生成**。
3. **RAG 抽取 case study 參考**——從自家案例庫撈最相關的來配。
4. CRM base class 的可擴充抽象。

**Skill/MCP**：❌｜**CLI**：✅

**vs OpenOutFind**：多了深度研究與稽核報告、SPIN 腳本、RAG 案例配對、多 CRM；少了資料庫尋客（它是「給我 lead，我來研究」）。**獨門武器：稽核報告當個人化載體 + RAG 案例配對。**

---

### 36. brightdata/ai-sdr-bdr-agent

- **GitHub**：https://github.com/brightdata/ai-sdr-bdr-agent
- **Stars**：17｜**授權**：MIT｜**最近更新**：main 5 commits
- **外部 API**：OpenAI GPT-4、**Bright Data MCP**、HubSpot

**5 個 agent**：Company Discovery → **Trigger Detection** → Contact Research → Message Generation → Pipeline Manager
**Trigger**：擴編招聘、募資公告、領導層異動、成長指標
**最值得借**：**Bright Data MCP 當即時網頁情報層**（爬取、LinkedIn 公司情報、新聞稿、聯絡資訊）——一個 MCP 換掉一整排爬蟲。HubSpot 寫入含自訂屬性與 lead score 同步。
**相關**：`brightdata/ai-lead-generator`（Streamlit UI，逐 lead 送 OpenAI 評分/摘要/建議最佳觸達通道）

---

### 37. sales-team-ai-agents（Getting-Automated）

- **GitHub**：https://github.com/Getting-Automated/sales-team-ai-agents
- **Stars**：30｜**授權**：**待驗證**｜**最近更新**：**待驗證**
- **框架**：**CrewAI 階層式**——Sales Manager Agent 管 7 個專職 agent
- **外部 API**：ProxyCurl(LinkedIn)、Perplexity(市場研究)、OpenAI、Reddit、Airtable

**ICP 加權評分（明碼）**：
- 公司：產業 25% / 規模 25% / 地點 25% / 成長階段 25%
- 個人：角色匹配 30% / **決策權 30%** / 部門 20% / 技能 20%

**最值得借**：
1. **公司分數與個人分數分開算**——這是對的。一間好公司裡的錯的人，等於零。
2. **「決策權(Authority)」佔個人分 30%**——權重配置本身是 domain knowledge。
3. **階層式 manager agent 模式**（vs 平行），適合需要 delegation 的場景。
4. Perplexity 當市場研究層。

---

### 38. langgraph-lead-qualification（EmpoweredHouse）

- **GitHub**：https://github.com/EmpoweredHouse/langgraph-lead-qualification
- **Stars**：4｜**授權**：MIT｜**最近更新**：**待驗證**
- **架構**：三個 agent——Lead Qualification Agent（主評分）、Company Researcher、People Researcher（後兩者改自 Langchain-AI 官方版）
- **方法**：**BANT + SPIN** 對照 ICP 與 buyer persona，給分並附理由
- **最值得借**：**「從技術研討會議程爬取相關人與公司」**——會議講者/參加者名單當尋客源。這是很少人做的冷門高品質源。

---

### 39. scrapehubai（ScrapeGraphAI）

- **GitHub**：https://github.com/scrapegraphai/scrapehubai
- **Stars**：13｜**授權**：MIT｜**最近更新**：**待驗證**
- **技術**：LangGraph + Streamlit + OpenRouter + ScrapeGraphAI API｜需要 GitHub PAT
- **管線**：抓某 repo 的 **stargazer** → 從 profile / org membership 追公司 → 爬公司補資料 → 依技術相關性/產業/規模/資料處理指標評分排序

**最值得借**：
> **「誰 star 了我的競品 / 相關工具 = 誰對這個問題有興趣。」**
1. **Stargazer → 公司 → 評分** 的完整鏈路。對開發者工具、AI infra 這類產品，**這是轉換率最高的免費尋客源，而且完全合法公開。**
2. 可延伸：watcher、fork 者、issue 提問者、PR 貢獻者——**同一套邏輯可以套用到整個 GitHub 社交圖。**

**vs OpenOutFind**：**這是 OpenOutFind 完全沒有的一整個尋客軸線。**

---

### 40. SalesGPT

- **GitHub**：https://github.com/filip-michalsky/SalesGPT
- **Stars**：2.6k｜**授權**：**待驗證**｜**最近更新**：**待驗證**（有 releases 頁）
- **能力**：context-aware 銷售對話 agent，**能判斷自己處在銷售對話的哪個階段**（資格確認 / 異議處理 / 成交）並調整回應；接產品知識庫（降幻覺）；跨語音、email、簡訊（SMS/WhatsApp/WeChat/Weibo/Telegram）；可自動生成 Stripe 付款連結

**最值得借**：
1. **「銷售階段機（sales stage machine）」**——這是 Reply Intelligence 的核心：不是分類回信，是**判斷對話走到哪一格，然後決定下一步**。
2. **產品知識庫工具接入以抑制幻覺**——報價、規格不能編。
3. Stripe 付款連結自動生成＝把「成交」真的納入 agent 動作空間。

---

### 41. lead_agent（kandarpa02, OpenAI Agents SDK）

- **GitHub**：https://github.com/kandarpa02/lead_agent
- **Stars / 授權 / 更新**：**待驗證**
- **技術**：**Ollama 後端 + OpenAI Agents SDK**
- **最值得借**：**確定性 8 因子資格矩陣**——經營歷史、客戶佐證、產品力、營運活躍度、社群存在感、**社群機會缺口**、付款能力、成長潛力。
  → 「社群機會缺口」（他們社群做得爛＝我們有切入點）跟 ProspectOS 的「爛網站也是 lead」是同一招的不同器官。

---

### 42. Reply / Inbox 智能層（一組小刀）

- **sales-inbox-agent** — https://github.com/kanikadhaundiyal13/sales-inbox-agent ｜0★｜授權待驗證｜Gmail API + **Groq** + Python + **guardrail 驗證層**｜讀信 → 判斷是否真 lead → 抽取需求 → **建議下一步動作** → 起草個人化回覆待人審。
- **jevmail** — https://github.com/fazlerocks/jevmail ｜開源 Gmail AI 分流，分成 Needs reply / Updates / Promos / **Sales** / Spam；**唯讀、本機跑、1000 封約 1 分鐘、約 3 美分**。
- **Auto-Email-Reply-Agent** — https://github.com/Asad-jatt-477/Auto-Email-Reply-Agent ｜**自動處理 80%、刻意把敏感或模糊的 20% 路由給人**；分類：sales_inquiry / complaint / support_request / meeting_request / invoice_payment / general_query。
- **Apache Camel Email Triage Agent** — https://camel.apache.org/blog/2026/04/email-triage-agent/ ｜企業級 email 分流 + 標籤 + 智能草稿的參考實作。

**最值得借**：**「80/20 路由」原則**（自動處理多數，刻意升級少數給人）＋ **guardrail 驗證層**（agent 決策前的硬檢查）＋ 成本標竿（3 美分 / 1000 封，這是判斷你的 reply 層有沒有做貴的基準線）。

---

## 【零件庫：不是獵客系統，但是獵客系統的器官】

這些是從 `Awesome-Sales-Intelligence` 與 `Awesome-Lead-Enrichment-Platform` 交叉出來的基礎零件，全部開源、可自架：

**OSINT / 找人**
- `sherlock-project/sherlock` — 跨 **400+** 平台以 username 獵取社群帳號
- `soxoj/maigret` — 跨 **3000+** 網站建立人物檔案
- `smicallef/spiderfoot` — 自動化 OSINT，**100+** 公開資料源
- `laramies/theHarvester` — email / 子網域 / 員工姓名採集
- `megadose/holehe` — 檢查某 email 在 **120+** 網站是否註冊過（**不通知對方**）
- `mxrch/GHunt` — Google 帳號調查
- `sundowndev/phoneinfoga` — 電話號碼情報
- `lanmaster53/recon-ng` — 模組化偵查框架

**爬取 / 網頁 → LLM**
- `mendableai/firecrawl`、`unclecode/crawl4ai`、`apify/crawlee`、`scrapy/scrapy`、`browser-use/browser-use`、`microsoft/playwright`(+`playwright-mcp`)、`adbar/trafilatura`、`searxng/searxng`（70+ 引擎聚合、隱私友善）

**Email 基建**
- `aftership/email-verifier`（Go，**不寄信驗證**：MX / SMTP / 語法 / 拋棄式網域）
- `FGRibreau/mailchecker`、`JoshData/python-email-validator`
- `postalserver/postal`（自架交易信，SendGrid 替代，含 DKIM/SPF）
- `knadh/listmonk`（自架名單與電子報，多執行緒 SMTP）
- `axllent/mailpit`（本機 email 沙箱測試）

**CRM / 自動化 / 編排**
- `twentyhq/twenty`（**原生 MCP**）、`espocrm/espocrm`(3.4k)、`SuiteCRM/SuiteCRM`、`frappe/crm`、`odoo/odoo`、`Dolibarr/dolibarr`、`nocodb/nocodb`
- `mautic/mautic`（行銷自動化，**視覺化 cadence + lead scoring**）
- `n8n-io/n8n`（**n8n 官方模板庫 lead-generation 分類有 881 個工作流，sales 分類 1,849 個**）
- `Activepieces/activepieces`、`node-red/node-red`、`temporalio/temporal`、`kestra-io/kestra`、`windmill-labs/windmill`

**MCP 生態（銷售向）**
- CRM：`shinzo-labs/hubspot-mcp`、`tsmztech/mcp-server-salesforce`、`mhenry3164/twenty-crm-mcp-server`、`WillDent/pipedrive-mcp-server`
- Email：`shinzo-labs/gmail-mcp`、`resend/resend-mcp`、`codefuturist/email-mcp`（IMAP/SMTP 多帳號 + 排程 + AI 分流）、`ryaker/outlook-mcp`
- 爬取：`firecrawl/firecrawl-mcp-server`、`microsoft/playwright-mcp`、`ScrapeGraphAI/scrapegraph-mcp`、`tavily-ai/tavily-mcp`、`exa-labs/exa-mcp-server`（**AI 原生搜尋 + LinkedIn/公司搜尋**）
- 公司登記/財報：`stefanoamorelli/sec-edgar-mcp`、`sareegpt/edgartools-mcp`、`pipeworx-io/mcp-open-corporates`
- OSINT MCP 清單：`soxoj/awesome-osint-mcp-servers`
- 框架：`lastmile-ai/mcp-agent`

**其他值得記一筆**
- `Madi-S/Lead-Generation`(661★)、`superryeti/Email-Crawler-Lead-Generator`(192★)、`asiifdev/business-leads-ai-automation`(198★)、`FarzamHejaziK/claude-linkedin-assistant`(220★)、`Awaisali36/50k-lead-generation-system`(94★)、`weilun88313/B2B-Playbook`(117★，B2B 獲客戰術手冊)、`mizcausevic-dev/showing-followup-orchestrator`（房仲 follow-up 引擎，**依近期性/揭露/二次看房/財務準備度/異議決定節奏**）
- ⚠️ `feder-cr/aihawk_mcp_server` 在 lead-generation topic 下顯示 **31.6k★**，但其描述為「反偵測隱身瀏覽器」，與獵客的關聯性與星數歸屬 **待驗證**。

---

# 第二部分：十支最值得深入研究的兵器（不排名）

選擇標準：**它有一刀是別人沒有的，而且那一刀可以單獨拆下來用。**

---

### ① OneShot GTM — 「簽章收據」
https://github.com/oneshot-agent/oneshot-gtm ｜697★ MIT

**獨門能力：把每一個 agent 動作變成可稽核的密碼學收據。**
每次呼叫都記錄「為什麼做 / 決策脈絡 / 歸屬哪個 goal / 結果是什麼」，於是 CAC 與 RoCS 是**算出來的**，不是估的。
**可拆回來的東西**：這不是功能，是**帳本層**。任何 agent 系統只要加上「動作 → 簽章收據 → 結果歸因」，就從黑箱變成可管理的資產。另外 15 個 Finder 與 AI Writing Lint 也可獨立拆用。

---

### ② YALC — 「Intelligence Store」
https://github.com/Othmane-Khadri/YALC-the-GTM-operating-system ｜311★ MIT

**獨門能力：假設狀態機 `hypothesis → validated → proven`。**
每次 campaign 的結果回寫進 Intelligence Store，配 chi-squared A/B 檢定，讓「我們相信 X 客群會買」這件事有生命週期。
**可拆回來的東西**：M14 Learning Loop 的**資料模型**。再加上「24 顆原子 skill + 1 顆旗艦 skill」的切法、送出前硬擋的 outbound validation、DB-backed token bucket 速率閘。

---

### ③ Harvey — 「訂閱制 agent 經濟學 + 訊號轉 SQL」
https://github.com/ethanplusai/harvey ｜68★ MIT

**獨門能力（兩把）**：
1. 走 `claude` CLI headless，用 **Pro/Max 訂閱**而非 per-token API 計費 → agent 可以反覆深思而不燒錢。
2. **23 個候選訊號讓人 approve/skip/reject，通過的直接編譯成 SQL query 成為 cohort。**
**可拆回來的東西**：AI 判斷 → 人類確認 → **固化成確定性查詢**的三段式。這解決了「LLM 評分不可複現」的根本問題。加上可編輯 Markdown 技能庫（改檔即生效）與五 agent 分工（Scout/Writer/Sender/Handler/Analyst）。

---

### ④ OpenLeads — 「零金鑰聯邦尋客 + 無 port 25 驗證」
https://github.com/Samyrrrrrr990/openleads ｜24★ **PolyForm 非商用**

**獨門能力：10 個免費公開資料源的聯邦查詢（OSM / YC / HN / Wikidata / SEC EDGAR / GitHub / OpenAlex / NPI / ProductHunt / 網域），加上七訊號 email 送達共識，且大部分不需要 port 25。**
**可拆回來的東西**：**adapter 架構**（每個公開源一個 adapter）＋ **七訊號共識演算法**。這兩件事都是純演算法，抄概念不涉授權。
⚠️ 程式碼本身是非商用授權，**要抄想法不要抄 code**。

---

### ⑤ BuildRadar — 「7 維機會評分 + evidence pack」
https://github.com/Houseofmvps/reddit-intel-agent-mcp ｜2★ MIT

**獨門能力：把公開抱怨量化成 0–100 的商業機會分數**（痛點頻率、嚴重度、替代方案普及率、競品弱點、時效性、社群品質、噪音懲罰），並能 `export_evidence_pack` 把佐證打包。
**可拆回來的東西**：**7 維評分公式**（可換資料源：換成 HN / Discord / X / 論壇都成立）＋ **evidence pack 這個輸出型別**（這就是「為什麼值得聯絡」的容器）＋ **MCP + REST 雙協議的同構暴露方式**。

---

### ⑥ sales-signals — 「職缺即意圖」
https://github.com/jaime-cervera/sales-signals ｜0★ MIT（極新）

**獨門能力：把 ATS 公開職缺（Greenhouse / Ashby / Lever，零 token）當成高保真買方意圖訊號，並用 Playwright 驗證訊號「現在還活著」。**
**可拆回來的東西**：
- **「招什麼人 ＝ 建什麼 ＝ 買什麼」的訊號映射表**（這是要自己建的 domain asset）
- **帳戶級訊號強度 roll-up**（單一職缺是噪音，多個同向職缺才是訊號）
- **liveness 驗證**——幾乎沒有人做訊號的時效驗證
- **多 ICP 隔離的 pipeline 設計**

---

### ⑦ sales-intelligence-agent — 「多訊號共振」
https://github.com/Maha-Jr10/sales-intelligence-agent ｜0★ MIT

**獨門能力：六個具名的訊號共振 pattern，帶時間窗與加分**（`triple-signal-conviction` 30天 +25、`post-funding-leadership` 90天 +22、`leadership-driven-evaluation` 45天 +20），每次命中產生**人類可讀的 explainability trace 與 buying narrative**。
**可拆回來的東西**：
- **共振 pattern 的定義格式**（訊號組合 + 時間窗 + 權重 + 敘事模板）——這是 M4 的核心資料結構
- **三層分離架構**：Markdown SOP（指導推理）/ Python（確定性執行）/ Agent（判斷與綜合）
- **GitHub Actions 當免費 always-on cron**

---

### ⑧ OpenProspector — 「19 家瀑布 + 歸因帳本」
https://github.com/clawnify/OpenProspector ｜9★ MIT

**獨門能力：19 家資料供應商的瀑布編排，每欄位可獨立設定順序，append-only 帳本記錄每個欄位由哪家產出、花多少。**
**可拆回來的東西**：
- **瀑布規則**：快取優先 → 跳過缺輸入者 → verified 優先 → first verified wins → 全程記錄
- **deferred vendor 的 webhook 掛起機制**（非同步供應商的正確處理方式，最常翻車的地方）
- **完整 OpenAPI** — 可以直接當 M7 的服務層

---

### ⑨ b2b-sdr-agent-template / PulseAgent — 「4 層抗失憶記憶體」
https://github.com/iPythoning/b2b-sdr-agent-template ｜186★ MIT｜2026-06-12

**獨門能力：L1 MemOS（結構化注入 + BANT 抽取）/ L2 主動摘要（context 達 65% 觸發壓縮）/ L3 ChromaDB（每回合向量儲存 + 客戶隔離）/ L4 CRM 每日快照。**
**可拆回來的東西**：**長程對話 agent 的記憶分層規範**。這是 M13 最完整的參考實作——尤其「65% 觸發壓縮」這個具體閾值與「客戶隔離」的向量儲存策略。加上 14 個 cron job 的排程清單（含**停滯 lead 偵測**與**記憶健康檢查**兩個很少人做的排程）。

---

### ⑩ Sales-Cadence (Acumen) — 「CRM 是記錄、Cadence 是執行」
https://github.com/Acumen-org/Sales-Cadence ｜0★｜授權待驗證

**獨門能力：明確的雙層架構（Twenty CRM = system of record，Cadence = execution layer，60 秒同步 + 每夜對帳），23 天多通道序列骨架，reply 自動關單，且刻意不自動寄信——每一次觸達都由人執行。**
**可拆回來的東西**：
- **23 天序列的節奏骨架**（email / LinkedIn / call 分佈在工作日 + nurture 循環 + 退出條件）
- **reply-stop 的實作方式**（webhook + activity 監測 → 自動關閉未完成任務）
- **「AI 決定碰誰，人負責碰」的分工立場**——這是對抗大規模低品質觸達的一個嚴肅答案，值得認真對待而非略過

---

### 【另外五支只差一點就進榜的，一併記下】

| 專案 | 那一刀 |
|---|---|
| **lead-finder** https://github.com/maledadams/lead-finder | skip 理由 → 規則，且**凌駕模型判斷**；Certificate Transparency log 抓新網域 |
| **FORGE/DataForge** https://github.com/Nuclear-Marmalade/dataforge | 6 層 email 偵測（含 Cloudflare 解碼）+ FCC/NPI/SAM.gov 政府資料 + Ollama 零成本富化 |
| **scrapehubai** https://github.com/scrapegraphai/scrapehubai | **競品的 stargazer 就是你的 lead** |
| **bricks** https://github.com/BraaMohammed/bricks | **writer ↔ prospect-critic 雙 agent 文案磨合迴圈** |
| **explorium gtm-skills** https://github.com/explorium-ai/gtm-skills | `market-sizing` / `lookalike-accounts` / `decision-makers-map` / `clean-data` 四個 OpenOutFind 完全沒有的段落；MCP 預覽/匯出分離 |

---

# 第三部分：AI 獵客能力地圖

把所有兵器放到獲客流程的位置上。**同一支工具會出現在多格——那正是拆零件的意義。**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ①市場情報 → ②ICP → ③尋客 → ④意圖訊號 → ⑤公司情報 → ⑥決策者          │
│      → ⑦Enrichment → ⑧Scoring → ⑨判客+理由 → ⑩個人化 → ⑪觸達         │
│      → ⑫Follow-up → ⑬Reply → ⑭轉真人 → ⑮成交 → ⑯回饋 → 回到②        │
└──────────────────────────────────────────────────────────────────────────┘
```

### ① 市場情報 / TAM
| 工具 | 提供什麼 |
|---|---|
| explorium `market-sizing` | 對照 150M 公司資料集算 TAM/SAM |
| BuildRadar `find_pain_points` `extract_feature_gaps` `track_pricing_objections` | 從公開討論反推市場痛點與競品弱點 |
| markster-os F1-F4 | 定位 / 商業模式 / 財務架構當執行前置條件 |
| OneShot `advise` `weekly-review` | Pre-PMF 訊號判斷與軟閘 |
| smart-trade-ai 市場情報技能 | 國際貿易市場分析 |

### ② ICP 定義
| 工具 | 提供什麼 |
|---|---|
| **BuildRadar `build_icp`** | 從真實使用者抱怨反推 ICP（bottom-up，不是拍腦袋） |
| OpenOutreach | 一句產品描述 → LLM 推 ICP → GP 從判決學習 |
| opengtm | 明碼 6 維權重（規模20/產業25/數位成熟15/痛點20/營收10/聯絡品質10） |
| sales-team-ai-agents | 公司分（產業25/規模25/地點25/階段25）與個人分（角色30/**決策權30**/部門20/技能20）分離 |
| sales-signals | **多 ICP 隔離**，每個客群獨立 pipeline 與權重 |
| ai-sales-team-claude `sales-icp` | ICP skill 化 |

### ③ 尋客（找公司 / 找人）
| 工具 | 資料源特色 |
|---|---|
| **OpenLeads** | OSM / YC / HN / Wikidata / SEC EDGAR / GitHub / OpenAlex / NPI / ProductHunt（**全免費**） |
| **OneShot 15 Finders** | Show HN / 募資 / GitHub / 活動…… |
| **lead-finder** | OSM / **Certificate Transparency（新網域）** / 品牌連結圖 / Wikipedia 關鍵字 |
| **scrapehubai** | **競品 repo 的 stargazer → 公司** |
| Harvey | OpenStreetMap（免費無限）/ DataForSEO / Serper，專攻 5–50 人本地商家 |
| google-maps-scraper | 本地商家 50+ 資料點 |
| Scout | IG / TikTok / LinkedIn / GitHub / YouTube / Twitch / Pinterest / **Linktree** |
| StaffSpy | **給公司撈全員** + **抓貼文留言者** |
| influencer-discovery | 15 個創作者通道，篩「自帶受眾的人」 |
| langgraph-lead-qualification | **技術研討會議程爬取** |
| explorium `list-builder` `lookalike-accounts` | 150M 公司 / 700M 聯絡人 + 相似公司擴張 |
| OpenOutreach | BetterContact 授權資料庫 |

### ④ 意圖訊號 / Buying Signal
| 工具 | 訊號類型 |
|---|---|
| **sales-signals** | **ATS 職缺（Greenhouse/Ashby/Lever，零 token）→ 帳戶級 roll-up → Playwright liveness 驗證** |
| **sales-intelligence-agent** | 7 源 + **6 種共振 pattern**（含時間窗與敘事） |
| **BuildRadar `find_buyer_intent`** | Reddit 緊迫性 / 預算暗示 / 購買準備度 |
| brightdata ai-sdr-bdr | 擴編 / 募資 / 領導層異動 / 成長指標 |
| signal-prospecting-kit | 職缺 / 領導層異動 / 募資 |
| b2b-intent-intelligence | 意圖基礎分：購買請求85 / 推薦80 / 招聘75 / 商業挑戰70 / 一般討論30 |
| ProspectOS + lead_agent | **缺陷即訊號**：爛網站、社群缺口 |
| CompanyScope `get_job_postings` | 徵才頁聚合 |
| explorium `account-fit-rank` | 即時 buying signal + intent data |

### ⑤ 公司情報
| 工具 | 特色 |
|---|---|
| **CompanyScope MCP** | 一次 call，11 工具 / 12 免費源（Wikipedia、SEC EDGAR、OpenCorporates、Google Patents、RDAP、DNS…） |
| **FORGE** | 技術棧 30+ / FCC / NPI / **SAM.gov 聯邦承包商** / SSL / 站速 |
| ai-company-researcher | LangGraph + Firecrawl + **human-in-the-loop 反覆修訂**（⚠️ 已封存 2026-03-27） |
| opengtm | **AEO / 技術 SEO 健檢** |
| explorium `account-research` `competitor-research` | 情報簡報 + battlecard |
| smart-trade-ai 盡調組 | **WHOIS / 制裁名單 / email 平台偵測 / LinkedIn 驗證** |
| kaymen99 | 網站 + blog + 社群 + 新聞多源合成 → **稽核報告** |

### ⑥ 決策者定位
| 工具 | 特色 |
|---|---|
| **StaffSpy** | `scrape_staff()` 撈全公司員工 + 經歷 + 技能 |
| **explorium `decision-makers-map`** | 買方委員會地圖 |
| **OneWave `champion-identifier`** | 找**內部擁護者**（不只決策者） |
| gtm-pipeline `contact-filter` | ICP-based 聯絡人排序 0–100 |
| ai-sales-team-claude（agent 2） | 決策者地圖，佔總分 20% |
| sales-signals | 訊號帳戶中抽取決策者 |
| Scrollport | **每間公司只選一個核准角色 + 一個已驗證信箱** |

### ⑦ Enrichment / Email Finder
| 工具 | 特色 |
|---|---|
| **OpenProspector** | **19 家瀑布 + 每欄位歸因 + deferred webhook** |
| **email-sleuth** | Rust、**port 25 封鎖自適應**、0-10 信心分 |
| **FORGE** | **6 層 email 偵測**（含 Cloudflare 解碼 / JSON-LD） |
| **OpenLeads** | **七訊號送達共識**，多數不需 port 25 |
| Scout | headline → 公司網域 → pattern → SMTP 驗證（免費） |
| Harvey | pattern-first + SMTP 探測，**誠實標記 verified/risky/guess/invalid** |
| aftership/email-verifier | Go 函式庫：MX / SMTP / 語法 / 拋棄式網域 |
| bricks | Hunter / MillionVerifier / QuickEmailVerification 三選一 |
| explorium `enrich-company` `enrich-contact` | 瀑布式最大化填充率 |
| OpenOutreach | BetterContact（付費，1 credit / 驗證信箱） |

### ⑧ Lead Scoring
| 工具 | 方法 |
|---|---|
| **ai-sales-team-claude** | **5 個 agent 並行加權合成 0-100**（25/20/20/15/20） |
| **autonomous-sdr** | **自優化 BANT，learning rate 0.3，從轉換結果重平衡權重** |
| **BuildRadar `score_opportunity`** | 7 維機會分 |
| opengtm | 6 維 → Hot/Warm/Cold |
| lead_agent | 確定性 8 因子矩陣 |
| OneWave `lead-scoring-model` | **從歷史資料生成自訂模型** |
| YALC | 7 道 gate + chi-squared A/B |
| OpenOutreach | Gaussian Process（官方自承未證明勝過隨機） |
| ML 參考：LeadSense / ML-Based-Lead-Scoring-Platform | sklearn + FastAPI + MLOps 回訓流程 |

### ⑨ 判客 + 理由（Explainability）
| 工具 | 特色 |
|---|---|
| **sales-intelligence-agent** | **explainability trace + buying narrative** |
| **BuildRadar `export_evidence_pack`** | 證據打包 |
| **Scrollport** | **「每項硬性主張保留來源；弱的列保持不完整或被拒絕」** |
| Harvey | **訊號人工確認 → 編譯成 SQL cohort**（完全可稽核） |
| OpenOutreach | `reason` 欄位隨 CSV 輸出 |
| OneShot | signed receipt 的 `memo` 欄位記錄「為什麼」 |

### ⑩ 個人化文案
| 工具 | 特色 |
|---|---|
| **bricks** | **writer ↔ prospect-critic 雙 agent 迴圈** |
| **OneWave `prospect-panel-simulator`** | **發送前模擬客戶小組壓測訊息** |
| **OneShot AI Writing Lint** | 擋禁用詞 / em-dash / 諂媚語氣 |
| **kaymen99** | **產出客製稽核報告，email 只是報告的連結** |
| **ProspectOS** | **PDF 網站診斷報告丟 WhatsApp** |
| lead-finder | **不生成，從抓到的證據組裝**（成本歸零） |
| Harvey | AIDA / PAS / BAB / QVC / 3Ps 框架 + 禁 AI 腔 + 字數上限 |
| signal-prospecting-kit | **語氣調整獨立成技能** |
| OneShot | Founder Voice + 一個真實讓步 |
| explorium `personalize-email` | signal pack 組裝 |

### ⑪ 觸達（Email / LinkedIn / 社群 / 即時通訊）
| 工具 | 通道 |
|---|---|
| **warmbly** | **Email warmup 池 + inbox placement 監測 + 抑制名單 + 每信箱上限** |
| postal / listmonk | 自架寄送基建 |
| **Linked API skills / linkedapi-mcp** | **LinkedIn 多帳號排程邀請** |
| gtm-api/linkedin-mcp | 託管 LinkedIn MCP |
| b2b-sdr-agent-template | **WhatsApp + Telegram + Email** |
| DeskcommCRM | **WhatsApp（WAHA + Meta Cloud API）+ 反封號可解釋節流** |
| Harvey | Gmail API / SMTP+IMAP / Instantly；**pre-send gate 完全不經模型** |
| YALC | Instantly + **MCP 可換 provider** + token bucket |
| SalesGPT | 語音 / SMS / WhatsApp / WeChat / Telegram + Stripe 連結 |
| Voice-Marketing-Agent | 低延遲外撥語音 |

### ⑫ Follow-up / Cadence
| 工具 | 特色 |
|---|---|
| **Sales-Cadence** | **23 天多通道序列 + nurture 循環 + reply-stop 自動關單 + `dnd` 退訂欄** |
| Harvey | 3 封序列 + 節流 + 安靜時段 + 每日上限 |
| b2b-sdr-agent-template | 14 個 cron，含**每日 15:00 停滯 lead 偵測** |
| showing-followup-orchestrator | **依近期性 / 揭露 / 二次接觸 / 財務準備度 / 異議來選節奏** |
| mautic | 視覺化 cadence |
| ProspectOS | **遞增節奏**的 follow-up 任務 |

### ⑬ Reply Intelligence
| 工具 | 特色 |
|---|---|
| **Harvey Handler** | 分類意圖 / 偵測退信 / 處理異議 / **LAARC 異議迴圈** |
| **SalesGPT** | **銷售階段機**：判斷對話在哪一格，決定下一步 |
| sales-inbox-agent | 是否真 lead → 抽取需求 → 建議下一步 → 起草（+ guardrail 層） |
| Auto-Email-Reply-Agent | **80% 自動 / 20% 刻意升級給人** |
| jevmail | 本機唯讀分流，**1000 封 ≈ 3 美分**（成本標竿） |
| OneShot `triage-replies` | 回信分流指令 |
| warmbly | visual reply playbook |
| DeskcommCRM | 情緒分析 + 自動路由 |
| b2b-sdr-agent-template | 每 30 分鐘掃 Gmail |

### ⑭ Human Handoff
| 工具 | 特色 |
|---|---|
| **Sales-Cadence** | **極端立場：所有觸達由人執行，AI 只排程** |
| **DeskcommCRM** | 情緒分析 → 轉真人 |
| autonomous-sdr | 10 節點狀態機的條件路由之一就是 human handoff |
| sales-signals / signal-prospecting-kit / Scrollport | **只起草，不自動寄** |
| Harvey / lead-finder | 審批佇列 |
| ai-company-researcher | human-in-the-loop 反覆修訂 |

### ⑮ CRM / Memory
| 工具 | 特色 |
|---|---|
| **Twenty CRM** | **原生 MCP**，agent 可建 deal / 更新 pipeline / 跑 workflow；AGPL-3.0；56k★ |
| **b2b-sdr-agent-template** | **4 層抗失憶記憶體（MemOS / 主動摘要 / ChromaDB / 每日快照）** |
| DeskcommCRM | pgvector RAG 組織記憶 + 多業態詞彙 + MCP-ready |
| sales-signals | **append-only Markdown 檔案式 CRM**（無需資料庫） |
| OneShot | SQLite ledger + 多 workspace 共享 person cache |
| espocrm / SuiteCRM / frappe-crm / odoo / nocodb | 自架 CRM 選項 |
| MCP：hubspot-mcp / mcp-server-salesforce / twenty-crm-mcp / pipedrive-mcp | agent 接 CRM |

### ⑯ Analytics + Learning Loop
| 工具 | 特色 |
|---|---|
| **OneShot** | **signed receipt → 真實 CAC / RoCS** |
| **YALC Intelligence Store** | hypothesis → validated → proven + chi-squared |
| **lead-finder** | **skip reason → rule，凌駕模型判斷** |
| **autonomous-sdr** | HubSpot lifecycle/deal-stage webhook 回流 → **BANT 權重重平衡（lr 0.3）** |
| Harvey Analyst | 閒置週期跑 pipeline 統計與意圖分佈 |
| markster-os | learning loop 存「已核准的業務知識」 |
| OpenOutreach | Gaussian Process（**官方自承尚未證明有效**） |
| OneWave `lead-scoring-model` | 從歷史資料回訓 |


---

# 第四部分：OpenOutFind / OpenOutreach 尚未覆蓋、但別人已經做到的能力

OpenOutreach 的管線是 `Discover → qualify → gate → resolve → write → send`。
**它的強項很清楚：一句話進，合格 lead + 理由 + 寄出的信出來，一行安裝。**
以下是它**沒有**、但其他專案**已經跑起來**的能力，按缺口嚴重度排。

### 🔴 級缺口（閉環斷點，不補就不是閉環）

| # | 缺的能力 | 誰已經做到 | 缺口代價 |
|---|---|---|---|
| 1 | **Reply 判讀** | Harvey Handler、SalesGPT 階段機、sales-inbox-agent、Auto-Email-Reply-Agent | 信寄出去就結束了。**沒有回饋就沒有閉環。** |
| 2 | **Follow-up / Cadence** | Sales-Cadence（23天序列+reply-stop）、Harvey（3封）、b2b-sdr（停滯偵測） | 單封冷信轉換率極低，多數回覆發生在第 2–4 touch |
| 3 | **Learning Loop（可運作的）** | YALC Intelligence Store、lead-finder（skip→rule）、autonomous-sdr（lr 0.3 重平衡）、OneShot（收據歸因） | OpenOutreach 有 GP，但**官方自承未證明勝過隨機**。這是它最誠實也最致命的一句。 |
| 4 | **Buying Signal / 意圖層** | sales-signals（ATS）、sales-intelligence-agent（共振）、BuildRadar（Reddit）、brightdata（trigger） | 它只判斷「像不像我的客戶」，不判斷「他現在要不要買」。**Fit ≠ Timing。** |
| 5 | **Human Handoff** | Sales-Cadence、DeskcommCRM、autonomous-sdr 條件路由 | 高意向回覆沒有交棒機制 |
| 6 | **真 CRM / 記憶** | Twenty（原生 MCP）、b2b-sdr（4層記憶）、DeskcommCRM（pgvector RAG） | 目前輸出是 CSV，**且官方自承沒有去重** |

### 🟠 級缺口（能力面明顯缺失）

| # | 缺的能力 | 誰已經做到 |
|---|---|---|
| 7 | **公司研究** | CompanyScope（11工具/12源）、FORGE（技術棧+政府資料）、opengtm（AEO健檢）、kaymen99（稽核報告） |
| 8 | **個人研究** | StaffSpy（全員+經歷+技能）、Scout（8社群）、influencer-discovery（15通道） |
| 9 | **LinkedIn 觸達** | Linked API skills（多帳號排程）、YALC（Unipile）、linkedapi-mcp |
| 10 | **Email warmup / 送達率** | warmbly（warmup 池 + inbox placement + 抑制名單） |
| 11 | **顯性 Lead Score** | 官方明說「輸出無 score 欄位」。opengtm(6維)、ai-sales-team(5agent加權)、lead_agent(8因子) 都有 |
| 12 | **去重** | 官方明說「無內建去重，要靠 sequencer 匯入去重」。explorium `clean-data`、OpenProspector 快取、influencer-discovery (person,platform) key |
| 13 | **市場層 / TAM** | explorium `market-sizing`、BuildRadar 市場訊號、markster F1-F4 |
| 14 | **Lookalike 擴張** | explorium `lookalike-accounts` |
| 15 | **買方委員會 / 擁護者** | explorium `decision-makers-map`、OneWave `champion-identifier` |
| 16 | **被拒 lead 的資料保留** | 官方明說「被拒 lead 永不匯出」——**負樣本全丟了，這正是 learning loop 失效的原因之一** |

### 🟡 級缺口（架構/工程面）

| # | 缺的能力 | 誰已經做到 |
|---|---|---|
| 17 | **MCP server** | FORGE、BuildRadar（MCP+REST）、Twenty、DeskcommCRM、explorium vibeprospecting |
| 18 | **多供應商瀑布**（它綁死 BetterContact） | OpenProspector（19家 + 歸因）、bricks、gtm-pipeline（9 API） |
| 19 | **免金鑰 / 零成本選項** | OpenLeads、FORGE、BuildRadar、lead-finder、Scout、companyscope |
| 20 | **成本可稽核** | OneShot（簽章收據 → 真實 CAC）、OpenProspector（append-only 帳本） |
| 21 | **送出前品管閘** | OneWave `prospect-panel-simulator`、bricks writer↔critic、OneShot AI writing lint |
| 22 | **合規 / 風控 / 盡調** | smart-trade-ai（制裁篩查、WHOIS、平台政策）、YALC（outbound validation 硬擋）、DeskcommCRM（LGPD/稽核日誌） |
| 23 | **多通道（WhatsApp/Telegram/語音）** | b2b-sdr-agent-template、DeskcommCRM、SalesGPT、Voice-Marketing-Agent |
| 24 | **多 ICP / 多產品線隔離** | sales-signals、OneShot multi-workspace |
| 25 | **inbound 進件通道** | autonomous-sdr（6 通道：表單/廣告/email/LinkedIn/活動/webhook） |
| 26 | **訊號時效驗證** | sales-signals（Playwright liveness）——**全場只有它做** |

### ✅ OpenOutreach 自己的獨門優勢（不要弄丟）

1. **「一句產品描述」當唯一輸入**——不用上傳名單。這個 UX 門檻低到非常罕見。
2. **信心閘擋在付費呼叫之前**——架構上正確的省錢位置（OneShot 的 ICP gate 是同一招）。
3. **`reason` 欄位當一級公民**，隨 CSV 輸出並可 merge 進模板。
4. **OpenOutFind / OpenOutSend 拆分乾淨**——find 與 send 各自可獨立使用，這個切分本身就是好設計。
5. **3.1k star + Claude Code plugin + SKILL.md**——生態成熟度在同類開源專案中屬前段。

---

# 第五部分：可重新組裝的 14 個模組（M1–M14）

每個模組：**要什麼能力 → 借誰 → 借哪一刀 → 介面形態**。

---

## M1 市場雷達

**職責**：持續掃描市場，回答「現在哪裡有需求在冒出來」。

| 借 | 借什麼 |
|---|---|
| BuildRadar `find_pain_points` / `extract_feature_gaps` / `track_pricing_objections` | 7 維機會評分公式（可換資料源） |
| sales-intelligence-agent | 7 源掃描 + **GitHub Actions 免費 cron** |
| explorium `market-sizing` | TAM/SAM 計算法 |
| BuildRadar `detect_workarounds` | 「客戶現在用什麼土法煉鋼」 |
| markster-os F1-F4 | 策略地基當執行前置條件 |
| searxng / exa-mcp / tavily-mcp | 搜尋底層 |

**介面**：MCP server（讀）+ 排程輸出 Markdown 日報
**實作起點**：BuildRadar 的 7 維評分 + sales-intelligence-agent 的 GitHub Actions 骨架

---

## M2 ICP 分析

**職責**：把「我們賣什麼」變成可執行的篩選規則與權重。

| 借 | 借什麼 |
|---|---|
| **BuildRadar `build_icp`** | **從真實抱怨 bottom-up 推 ICP**（而非拍腦袋 top-down） |
| opengtm | 明碼 6 維權重表當 baseline rubric |
| sales-team-ai-agents | **公司分與個人分分離**；個人分中「決策權 30%」 |
| sales-signals | **多 ICP 隔離**：每客群獨立 pipeline + 權重 |
| OpenOutreach | 一句話 → LLM 推 ICP 的 prompt 設計 |
| OneWave `lead-scoring-model` | 從歷史資料生成而非手刻 |

**介面**：Skill（對話式定義）+ 版本化 YAML/JSON 規則檔
**設計要求**：ICP 必須是**可版本化的檔案**，不是 prompt 裡的一段話——才能 A/B 與回溯。

---

## M3 尋客（Discovery）

**職責**：從零產生候選名單。**架構要求：每個資料源一個 adapter，可插拔。**

| Adapter | 借 |
|---|---|
| 免費公開源聯邦 | **OpenLeads**（OSM/YC/HN/Wikidata/SEC EDGAR/GitHub/OpenAlex/NPI/PH）——**借架構，code 是非商用授權** |
| 新網域偵測 | **lead-finder（Certificate Transparency logs）** |
| 社交圖尋客 | **scrapehubai（競品 stargazer → 公司）**，可延伸 watcher/fork/issue/PR |
| 本地商家 | Harvey（Overpass 免費）、google-maps-scraper、ProspectOS |
| 社群個人 | Scout（8平台）、influencer-discovery（15通道）、StaffSpy（`scrape_comments` 留言者） |
| 會議/活動 | langgraph-lead-qualification（研討會議程）、OneShot（活動 finder） |
| 付費資料庫 | explorium `list-builder`、BetterContact（OpenOutFind 現況） |
| 15 種綜合 | OneShot 的 15 Finders 清單 |

**介面**：CLI + MCP tool（`discover(source, query, limit)`）
**設計要求**：**免費源先跑，付費源最後跑**，且付費呼叫必須被 M8 的信心閘擋住（抄 OpenOutreach + OneShot 的 gate 位置）。

---

## M4 意圖訊號

**職責**：判斷「現在」要不要買。**這是 OpenOutFind 最大的缺口，也是最高價值的新增模組。**

| 借 | 借什麼 |
|---|---|
| **sales-signals** | **ATS 職缺（Greenhouse/Ashby/Lever）零 token 意圖源 + 帳戶級 roll-up + Playwright liveness 驗證** |
| **sales-intelligence-agent** | **6 種共振 pattern 的定義格式**（訊號組合 + 時間窗 + 加權 + 敘事模板） |
| BuildRadar `find_buyer_intent` | 緊迫性 / 預算暗示 / 準備度 |
| b2b-intent-intelligence | 意圖基礎分表（購買請求85 / 推薦80 / 招聘75 / 挑戰70 / 一般30）+ **signal convergence** |
| brightdata ai-sdr-bdr | 擴編/募資/領導異動/成長 4 類 trigger |
| ProspectOS + lead_agent | **缺陷即訊號**（爛網站、社群缺口） |
| lead-finder | CT log 新網域 |

**介面**：MCP server + 排程 worker
**核心資產（要自己建）**：**「訊號 → 需求」映射表**。例如「招 LLMOps Engineer → 在蓋 LLM infra → 需要可觀測性」。**這張表是整個系統最難複製的護城河，別人的 code 借得到，這張表借不到。**

---

## M5 公司情報

| 借 | 借什麼 |
|---|---|
| **CompanyScope MCP** | **11 工具 / 12 免費源的聚合器骨架**（⚠️ 已封存，要 fork） |
| **FORGE** | 技術棧 30+ / FCC / NPI / **SAM.gov** / SSL / 站速 |
| opengtm | **AEO / 技術 SEO 健檢 → 當開場禮** |
| ProspectOS | **網站缺陷偵測 → PDF 診斷報告** |
| kaymen99 | 多源合成 → **客製稽核報告** |
| explorium `account-research` `competitor-research` | 情報簡報 + battlecard |
| smart-trade-ai 盡調組 | **WHOIS / 制裁名單 / email 平台偵測** |
| sec-edgar-mcp / mcp-open-corporates | 財報與登記資料 |
| firecrawl / crawl4ai / trafilatura | 爬取底層 |

**介面**：MCP server（`research_company(domain) → dossier`）
**設計要求**：輸出必須是**帶來源的 dossier**（抄 Scrollport 的 evidence-backed 規範）。

---

## M6 決策者情報

| 借 | 借什麼 |
|---|---|
| **StaffSpy** | `scrape_staff(company)` 全員撈取 + 經歷 + 技能（⚠️ ToS 灰區） |
| **explorium `decision-makers-map`** | 買方委員會結構 |
| **OneWave `champion-identifier`** | **內部擁護者 ≠ 決策者** |
| gtm-pipeline `contact-filter` | ICP-based 聯絡人排序 0–100 |
| sales-team-ai-agents | 個人分維度（角色30/決策權30/部門20/技能20） |
| Scrollport | **每公司只取一個核准角色 + 一個已驗證信箱** |
| Scout | headline → 公司網域推斷 |

**介面**：MCP tool + Skill
**設計要求**：區分三種角色——**決策者 / 擁護者 / 守門人**，各自有不同的觸達腳本。

---

## M7 Enrichment

| 借 | 借什麼 |
|---|---|
| **OpenProspector** | **19 家瀑布編排 + 每欄位順序 + append-only 歸因帳本 + deferred webhook** |
| **email-sleuth** | **port 25 封鎖自適應** + 0-10 信心分 + service 模式 |
| **FORGE** | **6 層 email 偵測**（mailto/regex/Cloudflare解碼/JSON-LD/混淆解碼/聯絡頁） |
| **OpenLeads** | **七訊號送達共識**（多數免 port 25） |
| Harvey | **誠實四級標記**：verified / risky / guess / invalid |
| aftership/email-verifier | Go 驗證庫（MX/SMTP/語法/拋棄式） |
| explorium `enrich-contact` | 付費瀑布層 |

**介面**：OpenAPI HTTP 服務（抄 OpenProspector）+ MCP wrapper
**設計要求（三條鐵律）**：
1. **免費層先跑**（FORGE 6 層 + email-sleuth + Scout pattern），付費層只對通過信心閘的跑
2. **每個欄位記錄來源與成本**（append-only 帳本）
3. **誠實標記信心等級，寧可留空不可編造**

---

## M8 Lead Scoring

| 借 | 借什麼 |
|---|---|
| **ai-sales-team-claude** | **5 路並行 agent 加權合成 0-100**（公司研究25/聯絡人20/BANT20/競品15/觸達策略20） |
| **autonomous-sdr** | **自優化 BANT：float 權重 + lr 0.3 + 每 N 個 lead 從轉換結果重平衡** |
| opengtm | 6 維明碼權重 + Hot/Warm/Cold 分層 |
| lead_agent | 確定性 8 因子矩陣（含**社群機會缺口**） |
| YALC | **7 道 gate + chi-squared A/B** |
| sales-intelligence-agent | **共振 pattern 加分**（+25/+22/+20） |
| OneWave `lead-scoring-model` | 從歷史資料生成 |
| LeadSense / ML-Based-Lead-Scoring-Platform | sklearn + FastAPI + MLOps 回訓 |

**介面**：純函式服務 `score(lead, icp, signals) → {score, breakdown, reasons[]}`
**設計要求**：
- 分數必須**可拆解**（breakdown 顯示每維得分）
- **Fit 分與 Timing 分要分開**（OpenOutFind 把兩者混在一起，這是它 learning loop 失效的結構性原因之一）
- **保留被拒 lead 當負樣本**（OpenOutFind 明說被拒 lead 永不匯出——這等於丟掉一半訓練資料）

---

## M9 Outreach / 個人化

| 借 | 借什麼 |
|---|---|
| **bricks** | **writer ↔ prospect-critic 雙 agent 磨合迴圈** |
| **OneWave `prospect-panel-simulator`** | **發送前模擬客戶小組壓測** |
| **OneShot AI Writing Lint** | **擋禁用詞 / em-dash / 諂媚語氣**（對照 Wikipedia canon） |
| **lead-finder** | **不生成，從證據組裝** |
| **kaymen99 / ProspectOS / opengtm** | **價值前置：稽核報告 / PDF 健檢 / AEO 報告當開場禮** |
| Harvey | AIDA/PAS/BAB/QVC/3Ps 框架 + 字數上限 + 禁 AI 腔 |
| signal-prospecting-kit | **語氣調整獨立成技能** |
| OneShot | Founder Voice + **一個真實讓步（true concession）** |
| YALC | **outbound validation 硬擋違規訊息** |
| Scrollport | evidence-backed：無來源不得主張 |

**介面**：Skill（`draft_outreach(lead, dossier, signals, voice)`）
**設計要求**：**三道閘**——(1) evidence 檢查（每個主張有來源嗎）(2) writing lint（像不像人寫的）(3) compliance validation（會不會違規）。三道都過才進送信佇列。

---

## M10 Follow-up

| 借 | 借什麼 |
|---|---|
| **Sales-Cadence** | **23 天多通道序列骨架 + nurture 循環 + 退出條件 + reply-stop 自動關單 + `dnd` 欄位** |
| **b2b-sdr-agent-template** | **每日 15:00 停滯 lead 偵測 cron** |
| showing-followup-orchestrator | **依近期性/揭露/二次接觸/財務準備度/異議選節奏** |
| Harvey | 3 封序列 + 節流 + 安靜時段 + 每日上限 + **退信 kill-switch** |
| ProspectOS | 遞增節奏任務 |
| YALC | **DB-backed token bucket 速率閘** |
| warmbly | 每信箱上限與間隔 |
| mautic | 視覺化 cadence |

**介面**：排程 worker + 狀態機
**設計要求**：**reply / 退訂 / 退信 三者都必須能即時停掉整條序列**。這是合規底線，不是功能。

---

## M11 Reply Intelligence

| 借 | 借什麼 |
|---|---|
| **SalesGPT** | **銷售階段機**：判斷對話在哪一格 → 決定下一步（不只是分類） |
| **Harvey Handler** | 意圖分類 + 退信偵測 + **LAARC 異議處理迴圈** |
| **Auto-Email-Reply-Agent** | **80% 自動 / 20% 刻意升級給人**；分類法：sales_inquiry / complaint / support / meeting_request / invoice / general |
| sales-inbox-agent | 是否真 lead → 抽需求 → 建議下一步 → 起草（+ **guardrail 驗證層**） |
| jevmail | 本機唯讀、**1000 封 ≈ 3 美分**（成本標竿） |
| DeskcommCRM | 情緒分析 → 路由 |
| warmbly | visual reply playbook |
| OneShot `triage-replies` | CLI 分流 |

**介面**：MCP tool + worker（每 30 分鐘掃信箱，抄 b2b-sdr）
**設計要求**：輸出不是 label，是 **`{stage, intent, extracted_requirements, next_action, confidence, escalate?}`**。

---

## M12 Human Handoff

| 借 | 借什麼 |
|---|---|
| **Sales-Cadence** | **極端版：AI 決定碰誰、用哪個通道；人執行每一次觸達** |
| **Auto-Email-Reply-Agent** | 80/20 路由門檻設計 |
| autonomous-sdr | 10 節點狀態機中的 human handoff 條件路由 |
| DeskcommCRM | 情緒觸發轉真人 |
| Harvey / lead-finder / Scrollport / sales-signals | **審批佇列 / 只起草不自動寄** |
| ai-company-researcher | human-in-the-loop 反覆修訂 |

**介面**：審批 UI（web）+ 通知（Slack/Telegram）
**設計要求**：Handoff 時必須附**完整 context 包**——dossier + 訊號 + 評分 breakdown + 對話歷史 + 建議下一步。人不該再查一次。

---

## M13 CRM Memory

| 借 | 借什麼 |
|---|---|
| **Twenty CRM** | **原生 MCP server**——agent 可直接建 deal / 更新 pipeline / 跑 workflow（AGPL-3.0） |
| **b2b-sdr-agent-template** | **4 層抗失憶：L1 MemOS 結構化注入+BANT抽取 / L2 context 65% 觸發壓縮 / L3 ChromaDB 客戶隔離 / L4 每日快照** |
| DeskcommCRM | pgvector RAG + **多業態詞彙抽象** + MCP-ready |
| sales-signals | **append-only Markdown 檔案式 CRM**（輕量起步選項） |
| OneShot | SQLite ledger + 多 workspace 共享 person cache |
| Sales-Cadence | **system of record 與 execution layer 分離** |
| markster-os | **身分記憶（company context）與知識記憶（learning loop）分層** |

**介面**：MCP（Twenty）+ 本地 SQLite ledger
**設計要求**：**去重是一級功能**（OpenOutFind 沒有，吃過虧）。person cache 跨 workspace 共享。

---

## M14 Learning Loop

**職責**：讓下一輪比這一輪準。**這是全場最多人做不好的模組，也是差異化的終點。**

| 借 | 借什麼 |
|---|---|
| **OneShot** | **簽章收據 → 動作/成本/結果三向歸因 → 真實 CAC / RoCS** |
| **YALC Intelligence Store** | **hypothesis → validated → proven 狀態機 + chi-squared A/B** |
| **lead-finder** | **skip reason → rule，且規則凌駕模型判斷**（最輕量有效的一招） |
| **autonomous-sdr** | **CRM lifecycle/deal-stage webhook 回流 → BANT 權重重平衡（lr 0.3）** |
| **Harvey** | **人工確認訊號 → 編譯成 SQL cohort**（把 LLM 判斷固化成確定性查詢） |
| OneWave `lead-scoring-model` | 歷史資料回訓 |
| markster-os | learning loop 只存「已核准」的知識 |
| OpenOutreach（反面教材） | GP learner + **官方自承未證明勝過隨機** → 警惕：**把 learning 建在「只有正樣本、fit 與 timing 混算、無結果回流」上，一定學不動** |

**介面**：事件流（每個動作/結果都是事件）+ 週期性重平衡 job
**設計要求（從 OpenOutreach 的失敗反推）**：
1. **保留負樣本**——被拒的 lead 與理由必須存
2. **Fit / Timing / Message 三個分數分開學**——混在一起無法歸因
3. **結果必須從 CRM 回流**（成交/未成交），不能只有「回信/沒回信」
4. **人的 skip reason 是最高品質的訓練訊號**（lead-finder 的洞見）
5. **先做規則沉澱，再做模型**——規則可解釋、可除錯、立刻生效

---

# 第六部分：我們這次到底撿到了哪些槍？

不設計產品。只清點。

---

## 一、撿到了六把「別人沒有的刀」

這六件事在 42 支裡各自只有一兩家做到，而且都可以單獨拆下來：

1. **簽章收據帳本**（OneShot）— 讓 agent 的每一個動作可稽核、可算真實 CAC。這不是功能，是**帳本層**，任何 agent 系統都能加。
2. **訊號人工確認 → SQL cohort**（Harvey）— 把不可複現的 LLM 判斷，固化成可複現的確定性查詢。這解了 agent 系統最根本的可靠性問題。
3. **skip reason → 凌駕模型的規則**（lead-finder）— 最輕量的學習迴路。不用微調、不用 embedding、不用回訓，人拒絕的理由直接變成規則，而且贏過模型。
4. **訊號共振 pattern**（sales-intelligence-agent）— 單一訊號是噪音，**組合 + 時間窗 + 敘事**才是意圖。六個具名 pattern 是可以直接抄的資料結構。
5. **訊號 liveness 驗證**（sales-signals）— 全場唯一一個問「這個訊號現在還活著嗎」的。
6. **writer ↔ critic 雙 agent 文案迴圈 / 客戶小組壓測**（bricks / OneWave）— 在寄出前讓 AI 先扮演收件人罵一遍。

---

## 二、撿到了三條「成本結構的路」

這三條路各自能把某一段成本砍到接近零：

| 路 | 誰 | 怎麼做 |
|---|---|---|
| **訂閱制取代 per-token** | Harvey | `claude` CLI headless 跑在 Pro/Max 訂閱上 → agent 可以深思，不燒 API |
| **免費源聯邦 + 免費 LLM 瀑布** | OpenLeads / FORGE / bricks / lead-finder | 10 個公開資料源 + Ollama 本地 + 6 家免費 LLM 自動降級 |
| **閘門擺在付費呼叫之前** | OpenOutreach / OneShot / lead-finder | 確定性規則先篩 → 只對掙到資格的做付費 call / AI call |

另外撿到兩個**成本標竿數字**，之後用來判斷自己做貴了沒有：
- Reply 分流：**1000 封 ≈ 3 美分**（jevmail）
- Email 富化：自帶金鑰 **≈ $0.02/verified email** vs SaaS **$0.12–0.15**（OpenProspector）

---

## 三、撿到了四個「冷門但兇的資料源」

別人都在搶 LinkedIn 和 Apollo 的時候，這四個幾乎沒人用：

1. **ATS 公開職缺 JSON**（Greenhouse / Ashby / Lever）— 零 token、零成本、高保真意圖。*「招什麼人 = 建什麼 = 買什麼」*
2. **Certificate Transparency logs** — 新網域註冊 = 新公司/新產品線剛啟動
3. **競品 repo 的 stargazer** — 對開發者工具而言，轉換率最高的免費源，且完全合法公開
4. **政府開放資料**（SEC EDGAR / OpenCorporates / FCC / NPI / SAM.gov / OpenAlex / Google Patents）— 高可信、零成本、幾乎沒有競爭

外加一個被低估的：**貼文留言者**（StaffSpy `scrape_comments` / ProspectOS Instagram）— 留言是輕度意圖，比按讚重、比私訊輕。

---

## 四、撿到了三套「架構分法」

不是零件，是把零件擺對位置的方法：

1. **三層分離**（sales-intelligence-agent）：
   `Markdown SOP 指導推理` / `Python 腳本做確定性執行` / `Agent 做判斷與綜合`
   → 這是 agent 系統該有的分工。凡是能確定性做的，就不要讓模型做。

2. **System of record 與 execution layer 分離**（Sales-Cadence + Twenty）：
   CRM 存真相，Cadence 決定今天做什麼。60 秒同步 + 每夜對帳。

3. **原子 skill + 旗艦 skill**（YALC：24 顆原子 + 1 顆 `campaign-from-ICP`）：
   細粒度技能保證可組裝，旗艦技能保證「一句話能跑完」。兩者都要。

還有一個記憶架構值得單獨列：**4 層抗失憶**（b2b-sdr-agent-template）——結構化注入 / 65% 觸發壓縮 / 向量儲存客戶隔離 / 每日快照。

---

## 五、撿到了兩個「該被嚴肅對待的立場」

這兩個不是技術，是選擇。但它們會決定整支隊伍的形狀：

1. **「AI 決定碰誰，人負責碰」**（Sales-Cadence 明文寫著「Cadence 從不寄信、從不自動化 LinkedIn」）
   — 在大規模冷觸達品質崩壞的今天，這可能不是保守，是正解。

2. **「Evidence-backed：每項硬性主張保留來源；弱的列保持不完整或被拒絕」**（Scrollport）
   — 寧可留空，不可編造。這應該直接寫進我們的 M8/M9 憲法。

配套的還有兩個防呆立場：**80/20 路由**（自動處理多數，刻意升級少數給人）與 **誠實四級標記**（verified / risky / guess / invalid，Harvey）。

---

## 六、也撿到了一份「別人踩過的坑」

OpenOutreach 官方自己在 README 寫下的四句話，價值不輸任何功能：

> - 輸出無 score 欄位
> - **被拒 lead 永不匯出**
> - **學習迴路「尚未證明勝過隨機挑選」**
> - 無內建去重

把這四句連起來讀，就是一份因果診斷：
**丟掉負樣本 + 分數不外露 + fit 與 timing 混算 + 沒有結果回流 = 學習迴路必然學不動。**

這是全場最有價值的一份失敗報告，而且是專案作者自己誠實寫下來的。**M8 與 M14 的設計要求全部從這四句反推而來。**

---

## 七、還沒撿到的（下一輪要補的空缺）

誠實列出本輪沒找到滿意答案的：

| 空缺 | 現況 |
|---|---|
| **成熟的開源 Reply Intelligence** | 只找到 Harvey Handler、SalesGPT 階段機和幾支小 demo。沒有一支是「生產級、可獨立部署」的。**這是整個生態最薄的一環。** |
| **可驗證有效的 Learning Loop** | YALC / autonomous-sdr / lead-finder 都有設計，但**沒有任何一支提供了效果數據**。全部待驗證。 |
| **繁體中文 / 亞太市場的資料源** | 42 支全部是歐美資料源。台灣、東南亞的公司登記、職缺、社群訊號源**完全空白**。 |
| **語音觸達的開源選項** | 只找到 Voice-Marketing-Agent 與 SalesGPT+Twilio，深度不足，未及細查。 |
| **合規 / 反騷擾的系統性做法** | 只有 YALC 的 outbound validation、DeskcommCRM 的節流、smart-trade-ai 的制裁篩查三點。沒有整套。 |
| **Hugging Face 生態** | `huggingface.co` 被本環境的 egress proxy 擋住，該站的「Top 30 開源獲客專案」整理文**未能取得**。**待補查**：https://huggingface.co/blog/samihalawa/automating-lead-generation-with-ai |
| **n8n 模板細節** | 已確認 n8n 官方模板庫 lead-generation 分類 **881 個**、sales 分類 **1,849 個**工作流，但**未逐一檢視**。這是一座還沒進去的礦。 |

---

## 結語：這次撿到的是什麼

不是一支能直接用的產品。

是 **42 支拆解過的兵器**、**6 把別人沒有的刀**、**3 條成本路線**、**4 個冷門資料源**、**3 套架構分法**、**2 個立場**，以及 **1 份誠實的失敗報告**。

拼起來看，現在手上有的是：
- **M3 尋客**：免費源已經夠用（OpenLeads 架構 + CT log + stargazer + ATS）
- **M4 意圖**：有現成 pattern 可抄，但**核心的「訊號 → 需求」映射表必須自己建**——這是唯一借不到的東西，也因此是唯一的護城河
- **M7 Enrichment**：瀑布與歸因都有成熟參考（OpenProspector + email-sleuth + FORGE）
- **M8 Scoring**：有多套權重表與一份失敗診斷
- **M9 文案**：有三道閘的完整設計（evidence / lint / compliance）
- **M11 Reply**：**最薄的一環，要自己做**
- **M13 記憶**：Twenty MCP + 4 層記憶架構，答案很清楚
- **M14 學習**：有三種做法，但**全部待驗證**——從最輕的 `skip reason → rule` 開始最合理

**先收器，已收。**
**看器、判器，本報告即是。**
**編隊，下一輪再說。**

---

## 附錄：全部原始來源連結

### 基準
- OpenOutreach — https://github.com/eracle/OpenOutreach
- OpenOutFind (PyPI) — https://pypi.org/project/openoutfind/0.1.14/
- OpenOutreach (PyPI) — https://pypi.org/project/openoutreach/0.1.55/

### A 級
- YALC — https://github.com/Othmane-Khadri/YALC-the-GTM-operating-system
- OneShot GTM — https://github.com/oneshot-agent/oneshot-gtm
- Harvey — https://github.com/ethanplusai/harvey
- OpenLeads — https://github.com/Samyrrrrrr990/openleads
- FORGE / DataForge — https://github.com/Nuclear-Marmalade/dataforge
- email-sleuth — https://github.com/buyukakyuz/email-sleuth
- BuildRadar — https://github.com/Houseofmvps/reddit-intel-agent-mcp
- sales-signals — https://github.com/jaime-cervera/sales-signals
- sales-intelligence-agent — https://github.com/Maha-Jr10/sales-intelligence-agent
- OpenProspector — https://github.com/clawnify/OpenProspector
- lead-finder — https://github.com/maledadams/lead-finder
- warmbly — https://github.com/warmbly/warmbly
- opengtm — https://github.com/buildingopen/opengtm
- CompanyScope MCP — https://github.com/Stewyboy1990/companyscope-mcp
- b2b-sdr-agent-template — https://github.com/iPythoning/b2b-sdr-agent-template ｜ https://pulseagent.io/open-source
- b2b-sdr-hermes-skill — https://github.com/iPythoning/b2b-sdr-hermes-skill
- autonomous-sdr — https://github.com/RodricDib06/autonomous-sdr
- smart-trade-ai — https://github.com/chefroger/smart-trade-ai
- Sales-Cadence — https://github.com/Acumen-org/Sales-Cadence
- Twenty CRM — https://github.com/twentyhq/twenty ｜ https://twenty.com/
- DeskcommCRM — https://github.com/melgarafael/DeskcommCRM
- bricks — https://github.com/BraaMohammed/bricks
- Scout — https://github.com/kiryano/Scout
- StaffSpy — https://github.com/cullenwatson/StaffSpy
- ProspectOS — https://github.com/nando0x/ProspectOS
- google-maps-scraper — https://github.com/omkarcloud/google-maps-scraper
- google-maps-reviews-scraper — https://github.com/omkarcloud/google-maps-reviews-scraper
- influencer-discovery — https://github.com/tigerless-labs/influencer-discovery

### Skill / MCP 層
- ai-sales-team-claude — https://github.com/zubair-trabzada/ai-sales-team-claude
- explorium gtm-skills — https://github.com/explorium-ai/gtm-skills
- vibeprospecting-mcp — https://github.com/explorium-ai/vibeprospecting-mcp
- gtm-pipeline-skills — https://github.com/keinsaasforever/gtm-pipeline-skills
- markster-os — https://github.com/markster/markster-os
- OneWave claude-skills — https://github.com/OneWave-AI/claude-skills
- Linked API linkedin-skills — https://github.com/Linked-API/linkedin-skills
- linkedapi-mcp — https://github.com/Linked-API/linkedapi-mcp
- gtm-api linkedin-mcp — https://github.com/gtm-api/linkedin-mcp
- Scrollport sales-prospecting-skills — https://github.com/Scrollport/sales-prospecting-skills
- signal-prospecting-kit — https://github.com/cismontane-harris2642/signal-prospecting-kit
- sales-skills-for-codex-list-builder — https://github.com/haroExplorium/sales-skills-for-codex-list-builder

### B 級
- sales-outreach-automation-langgraph — https://github.com/kaymen99/sales-outreach-automation-langgraph
- brightdata ai-sdr-bdr-agent — https://github.com/brightdata/ai-sdr-bdr-agent
- brightdata ai-lead-generator — https://github.com/brightdata/ai-lead-generator
- sales-team-ai-agents — https://github.com/Getting-Automated/sales-team-ai-agents
- langgraph-lead-qualification — https://github.com/EmpoweredHouse/langgraph-lead-qualification
- scrapehubai — https://github.com/scrapegraphai/scrapehubai
- ai-company-researcher — https://github.com/mayooear/ai-company-researcher
- SalesGPT — https://github.com/filip-michalsky/SalesGPT
- lead_agent — https://github.com/kandarpa02/lead_agent
- AI-Lead-Generation-Agent — https://github.com/GURPREETKAURJETHRA/AI-Lead-Generation-Agent
- b2b-intent-intelligence — https://github.com/vinnykumar206/b2b-intent-intelligence
- Sales-Multi-Agent-AI — https://github.com/RaviKunapareddy/Sales-Multi-Agent-AI
- crm-ai-agent-system — https://github.com/manjunadh-3177/crm-ai-agent-system

### Reply / Inbox
- sales-inbox-agent — https://github.com/kanikadhaundiyal13/sales-inbox-agent
- jevmail — https://github.com/fazlerocks/jevmail
- Auto-Email-Reply-Agent — https://github.com/Asad-jatt-477/Auto-Email-Reply-Agent
- Apache Camel Email Triage — https://camel.apache.org/blog/2026/04/email-triage-agent/

### 清單 / 目錄
- awesome-sales-automation-skills — https://github.com/sujayjayjay/awesome-sales-automation-skills
- VipinMI2024-awesome-mcp-servers — https://github.com/stsqit/VipinMI2024-awesome-mcp-servers
- Awesome-Lead-Enrichment-Platform — https://github.com/ishandutta2007/Awesome-Lead-Enrichment-Platform
- Awesome-Sales-Intelligence — https://github.com/ishandutta2007/Awesome-Sales-Intelligence
- awesome-ai-lead-generation — https://github.com/toofast1/awesome-ai-lead-generation
- awesome-ai-agents-for-sales — https://github.com/Salesably/awesome-ai-agents-for-sales
- awesome-osint-mcp-servers — https://github.com/soxoj/awesome-osint-mcp-servers
- GitHub topics — https://github.com/topics/lead-generation ｜ https://github.com/topics/sales-automation ｜ https://github.com/topics/b2b-prospecting ｜ https://github.com/topics/cold-email ｜ https://github.com/topics/sales-prospecting
- n8n 模板 — https://n8n.io/workflows/categories/lead-generation/ ｜ https://n8n.io/workflows/categories/sales/

### 待補查（本次未能取得）
- Hugging Face「Top 30 開源獲客專案」（egress proxy 封鎖）— https://huggingface.co/blog/samihalawa/automating-lead-generation-with-ai
