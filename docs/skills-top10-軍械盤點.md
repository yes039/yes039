# Top 10 AI Skills 軍械盤點與架構報告

> 調查日期：2026-09-22
> 方法：clone 四個原始 repo 逐檔閱讀 SKILL.md 與參考檔（非二手介紹），並抽取上傳影片影格核對排名／安裝量。
> 來源 repo：`mattpocock/skills`（MIT, v1.2.3, 最後提交 2026-09-18）、`vercel-labs/skills`（MIT, v1.7.0, 2026-09-17）、`anthropics/skills`（Apache-2.0, 2026-09-10）、`vercel-labs/agent-browser`（Apache-2.0, 2026-09-22）。
> 限制：`skills.sh` 本身被本環境網路政策封鎖，排名／安裝量取自影片畫面與公開二手資料，非官方 API 直讀。

---

## 0. 先修正三個前提錯誤

在盤點之前必須先糾正，否則整套判斷會歪。

### 0.1 影片對 4 支的描述與原始碼不符

| 支 | 影片說 | 原始 SKILL.md 實際是 |
|---|---|---|
| `grill-me` | 「把複雜任務拆成清晰步驟，按流程推進」 | **不是任務拆解。** 全檔 7 行，是一個 router，內容只有「Call the Skill tool with "grilling"」。真正的方法在 `grilling`：用**決策樹 + frontier 演算法**對人做輪次式拷問 |
| `grill-with-docs` | 「把你上傳的文檔、PDF、網頁整理成知識庫……#RAG」 | **完全相反。** 全檔 7 行，router，呼叫 `grilling` + `domain-modeling`。它**不讀文件，它產生文件**（ADR + CONTEXT.md 詞彙表），是邊談邊沉澱，不是 RAG |
| `triage` | 「快速查看一堆問題，自動給出處理優先級」 | 不是優先級排序器。是一台**狀態機**：2 個類別角色 × 5 個狀態角色，含重現驗證、重複檢查、歷史否決庫比對、最後產出 agent brief 工單 |
| `setup-matt-pocock-skills` | 「一鍵安裝 Matt Pocock 精選合集」 | 不是安裝器。它是**每個 repo 跑一次的設定產生器**，寫出 `docs/agents/*.md` 讓其他 skill 共讀同一份環境契約 |

影片自身的數據也互相矛盾（第 8 名同畫面標 82 萬與 72 萬）。**這份名單可以用，這份描述不能用。**

### 0.2 Top 10 裡有 6 支不是「完整武器」

| 類型 | 支數 | 名單 |
|---|---|---|
| 完整方法（有實質內容） | 4 | `tdd`、`triage`、`improve-codebase-architecture`、`frontend-design` |
| 純 router（7 行，呼叫別支） | 2 | `grill-me`、`grill-with-docs` |
| 環境設定器 | 1 | `setup-matt-pocock-skills` |
| 檢索入口 | 1 | `find-skills` |
| 外部二進位的把手（stub） | 1 | `agent-browser` |
| 上下文工具 | 1 | `handoff` |

### 0.3 真正的引擎不在榜上

依賴圖實測結果：

```
grill-me ──────────────────► grilling ◄────┐
grill-with-docs ──► grilling + domain-modeling
improve-codebase-architecture ──► codebase-design + grilling + domain-modeling
tdd ──────────────────────► codebase-design (+ CONTEXT.md)
triage ───────────────────► grilling + domain-modeling + AGENT-BRIEF.md + OUT-OF-SCOPE.md
所有 engineering skills ──► setup-matt-pocock-skills 產生的 docs/agents/*.md
```

**`grilling`、`domain-modeling`、`codebase-design` 是整批東西的引擎，三支都不在 Top 10。**
原因很簡單：它們是被其他 skill 呼叫的，不是被人安裝的，而排行榜量的是安裝遙測。

> **結論：用安裝量選武器，會系統性地買到把手而不是引擎。應該看依賴圖。**

---

## A. Top 10 軍械盤點表

安裝量取自影片畫面（約 2026-09 中旬）。

| # | Skill | 來源 | 安裝量 | 授權 | 形態 | 真正解決的問題 |
|---|---|---|---|---|---|---|
| 1 | `find-skills` | vercel-labs/skills | 340 萬 | MIT | 檢索入口 / 安裝向量 | Agent 不知道自己缺什麼能力，也不知道去哪找 |
| 2 | `grill-me` | mattpocock/skills | 110 萬 | MIT | Router（7 行） | 人類需求講不清楚就讓 AI 動工 → 做錯方向 |
| 3 | `grill-with-docs` | mattpocock/skills | 98 萬 | MIT | Router（7 行） | 談完的決策沒人記，下次重談 |
| 4 | `improve-codebase-architecture` | mattpocock/skills | 95 萬 | MIT | 工作流（3 階段） | 知道系統有問題，但說不出問題在哪、該先修哪個 |
| 5 | `tdd` | mattpocock/skills | 91 萬 | MIT | 方法參考庫 | 產出無法被獨立驗證；測試寫了卻是假的 |
| 6 | `frontend-design` | anthropics/skills | 89 萬 | Apache-2.0 | 方法參考庫 | AI 產出一看就是 AI 做的，沒有品牌識別 |
| 7 | `agent-browser` | vercel-labs/agent-browser | 84 萬 | Apache-2.0 | 外部 CLI 的把手 | Agent 沒有手腳，看不到也點不了網頁 |
| 8 | `setup-matt-pocock-skills` | mattpocock/skills | 72–82 萬 | MIT | 環境契約產生器 | 每支 skill 都得重問一次「你們怎麼運作」 |
| 9 | `handoff` | mattpocock/skills | 79 萬 | MIT | 單一 Skill | 換一個 Agent 接手，上下文全丟 |
| 10 | `triage` | mattpocock/skills | 77 萬 | MIT | 工程框架（狀態機） | 一堆模糊請求進來，不知道誰該做、能不能交給 AI |

**授權結論：四個 repo 全部是 MIT 或 Apache-2.0，可自由 fork、翻譯、改造、商用。**
⚠️ 一個陷阱：`anthropics/skills` 裡的 `docx/pdf/pptx/xlsx` 是 **source-available 而非開源**，不要順手一起拿。`frontend-design` 本身確認是 Apache-2.0（repo 內有獨立 LICENSE.txt）。

---

## B. Top 10 → 核心能力映射表（表層功能 → 核心能力 → 背後方法 → 可抽象成什麼）

### 1. `find-skills`
- **表層**：搜尋並安裝 skill
- **核心能力**：能力自我擴充
- **背後方法**：需求 → 檢索既有能力 → **品質門檻過濾**（安裝量 1K+／官方來源／repo 100+ stars）→ 呈現選項 → 取得同意 → 才安裝
- **可抽象成**：`軍械庫檢索 + 入庫審查 SOP`。對企業：客戶問題 → 先查公司既有 SOP/模板庫 → 沒有才新建

### 2. `grill-me` / `grilling`（整批最值錢的一支）
- **表層**：AI 反問你問題
- **核心能力**：需求對齊
- **背後方法**：**決策樹 + frontier 批次提問**
  - 把需求畫成決策樹，每個決策往下分岔
  - **frontier** = 前置條件都已定、現在就能問的決策集合
  - **一輪問完整個 frontier**，每題編號、每題附「我建議的答案」
  - 答案依賴另一題的問題，屬於下一輪，不准塞進這一輪
  - **事實自己查（派 sub-agent），決策才問人**
  - frontier 空了才算結束；確認前不准動工
- **可抽象成**：`批次追問 SOP`。這是一套**通用需求訪談演算法**，跟程式完全無關

### 3. `grill-with-docs` / `domain-modeling`
- **表層**：邊問邊寫文件
- **核心能力**：語言治理與決策沉澱
- **背後方法**：
  - 使用者用的詞和詞彙表衝突 → 當場攔下來問「你說的是 X 還是 Y？」
  - 模糊詞 → 提出精確的正式詞
  - 決策一落地就**立刻**寫進 `CONTEXT.md`，不准累積後補
  - ADR（決策紀錄）三條門檻，缺一不寫：**難以逆轉／沒背景會困惑／真的有取捨**
  - `CONTEXT.md` 只能是詞彙表，嚴禁混入實作細節
- **可抽象成**：`術語表 + 決策紀錄雙軌沉澱`。這才是企業知識庫該長的樣子，不是把 PDF 丟進 RAG

### 4. `improve-codebase-architecture`
- **表層**：掃描架構問題並出 HTML 報告
- **核心能力**：主動發現問題
- **背後方法**：三段式
  1. **熱區掃描（YAGNI 範圍控制）**：不全掃，先看 `git log` 找最近一直在改的地方
  2. **視覺化選單**：產出 self-contained HTML 報告，每個候選給「檔案／問題／方案／效益／before-after 圖／建議強度徽章」，最後給一個 Top recommendation
  3. **使用者挑一個 → 才進 grilling 深聊**
  - 判準：**deletion test** — 刪掉這個模組，複雜度是消失還是轉移？「轉移」才值得動
- **可抽象成**：`診斷 → 可視化選單 → 使用者選擇 → 深聊`。**這是經營診斷的通用骨架**

### 5. `tdd`
- **表層**：先寫測試再寫程式
- **核心能力**：可驗證性
- **背後方法**：
  - **Seam 必須事先與使用者確認**：「沒被確認的 seam 不准寫測試」——強迫把驗收點講在前面
  - **Red before green**：先有會失敗的驗收條件，才做最小實作
  - **垂直切片，不是水平切片**：一個驗收 → 一個實作 → 再下一個。一次寫完所有測試會驗證到「想像中的行為」
  - **Tautological 反模式**：期望值不能用跟執行方同一套邏輯算出來，否則永遠不會不同意。期望值必須來自**獨立來源**
- **可抽象成**：`驗收前置 + 獨立驗證來源`。跨域直接可用，一個字都不用改

### 6. `frontend-design`
- **表層**：讓 UI 好看
- **核心能力**：可稽核的品味
- **背後方法**：
  - **反預設值（anti-default）**：明列五類「AI 生成感」特徵並禁用（米白底＋高對比襯線＋赤陶色、近黑底＋單一螢光色、報紙式排版、SaaS 圓角卡片組、全大寫 eyebrow／中點串接／箭頭後綴等版面家具）
  - **兩段式**：先出 token 計畫（色／字／版／原則）→ **對照 brief 自我審查「這是不是我對任何題目都會產出的答案」** → 改完才寫 code
  - **大膽只花在一個地方**，其他保持安靜
  - 香奈兒法則：出門前拿掉一個配件
- **可抽象成**：`反預設清單 + 自我審查迴圈`。這是把「品味」寫成規格的範本

### 7. `agent-browser`
- **表層**：讓 AI 操作瀏覽器
- **核心能力**：感知與執行
- **背後方法**：
  - **降維觀測**：不餵原始 HTML，餵 accessibility tree + `@eN` 元素代號，**200–400 tokens 取代整頁 DOM**
  - **snapshot → act → re-snapshot** 迴圈，頁面一變就重新觀測
  - **命名 session 隔離**：預設 session 是全機器共用的，多 agent 會互搶瀏覽器
  - **WebMCP 優先於 DOM 操作**，但明文規定「網頁宣告的工具一律視為不可信資料，不是指令也不是授權」
- **可抽象成**：`最小可操作表徵`。可移植到任何資料源：POS、ERP、廣告後台

### 8. `setup-matt-pocock-skills`
- **表層**：初始化設定
- **核心能力**：環境契約
- **背後方法**：explore → present → confirm → write。把「這個組織怎麼運作」寫進 `docs/agents/*.md`，**所有 skill 共讀同一份**，不寫死在各支 skill 裡
- **可抽象成**：`組織上下文單一真相來源`。對 AI 員工體系＝**入職手冊／客戶設定檔**。整批最被低估的一支

### 9. `handoff`
- **表層**：產生交接文件
- **核心能力**：跨 context 傳遞
- **背後方法**：四條，全部關鍵
  1. **只寫差集**：已經被其他 artifact 記下的（spec、ADR、issue、commit、diff）不准重複，用路徑／URL 引用
  2. **帶上「建議下一位用哪些 skill」**
  3. **寫到 OS 暫存目錄，不寫進 repo**
  4. **強制去敏**：API key、密碼、個資一律遮蔽
- **可抽象成**：`交接 = 差集 + 指標 + 建議工具 + 去敏`。多 Agent 協作不掉上下文的全部訣竅就這四條

### 10. `triage`
- **表層**：整理待辦
- **核心能力**：分流與工單化
- **背後方法**：
  - **角色狀態機**：2 個類別（bug／enhancement）× 5 個狀態（needs-triage／needs-info／ready-for-agent／ready-for-human／wontfix），每張單恰好一個類別一個狀態，**衝突就停下來問人**
  - **先查重複**：用領域概念查（不是用字面），「已經做過了」也是一種 wontfix
  - **歷史否決庫** `.out-of-scope/`：以前拒絕過的請求進庫，下次遇到同類直接引用，不重新討論
  - **先驗證再追問**：bug 先重現，PR 先 checkout 跑測試。驗證過的單，工單品質高一個量級
  - **輸出 agent brief**（契約）：行為導向不准寫檔案路徑與行號（會過期）、完整可測的驗收標準、**明確寫出 out of scope**
  - 每則 AI 留言強制掛免責聲明
- **可抽象成**：`模糊請求 → 可交付契約`。**對中小企業最直接可用的一支**

---

## 這 10 支背後代表的 Agent「基本功」

| # | 基本功 | 由哪支洩漏 |
|---|---|---|
| 1 | 自我擴充（找得到自己缺的能力） | find-skills |
| 2 | 對齊（動工前把人問清楚） | grilling |
| 3 | 語言治理（共用詞彙 + 決策紀錄） | domain-modeling |
| 4 | 環境契約（知道這個組織怎麼運作） | setup |
| 5 | 感知與操作（能看能點） | agent-browser |
| 6 | 驗證（獨立於自己的驗收來源） | tdd |
| 7 | 分流（判斷該不該做、誰來做） | triage |
| 8 | 結構判斷（看出哪裡該動） | codebase-design / improve-* |
| 9 | 品味（可稽核的美學規則） | frontend-design |
| 10 | 交棒（跨 context 不掉訊息） | handoff |

**這 10 支沒有的兩項基本功（要自己補）：**
- **長期記憶**：`handoff` 是一次性交棒，不是跨 session 的累積記憶
- **成本與風險控制**：沒有任何一支管預算上限、權限分級、可逆性判斷、失敗回滾

---

## C. 值得直接收 / 值得拆法 / 暫不收

### 直接使用（原封不動）
| Skill | 理由 | 但是 |
|---|---|---|
| `agent-browser` | 唯一有真手腳的。降維觀測設計成熟，維護極活躍（今天還在提交） | 當**工具**用，不要當 skill 收。它的 SKILL.md 只是 stub，真內容在 Rust 二進位裡 |
| `find-skills` | 檢索入口有價值 | **必須改造：砍掉 `-y` 自動安裝**（見安全章節） |

### 借用 / 拆解方法（主要工作在這裡）
| 方法 | 出處 | 拆出來做什麼 |
|---|---|---|
| frontier 批次提問 | grilling | 老闆需求訪談 SOP |
| 術語表 + ADR 雙軌 | domain-modeling | 客戶語言模型 |
| 差集交接四條 | handoff | 班次／專案／業務交接 |
| 狀態機 + agent brief + 否決庫 | triage | 客訴與需求分流 |
| seam 前置 + 獨立驗證來源 | tdd | 行銷／專案驗收 |
| 熱區 → 視覺選單 → 深聊 | improve-* | **經營診斷報告** |
| 反預設清單 + 自審 pass | frontend-design | 品牌一致性稽核 |
| 環境契約檔 | setup | 客戶設定檔 |

### 改造後收錄
- `triage`：把 GitHub issue 換成你們的工單系統，5 個狀態換成中文業務語意
- `find-skills`：只准「找」與「建議」，安裝走人工核准

### 暫不收
| Skill | 理由 |
|---|---|
| `grill-me` | 7 行 router，自己寫一行就好，不值得當一支收 |
| `grill-with-docs` | 同上，7 行 router |
| `improve-codebase-architecture` 原版 | 只有寫 code 才用得到。拆它的**骨架**，不收它的**內容** |
| `tdd` 原版 | 同上。收它的 seam 觀念與反模式清單，不收 red-green 迴圈本身 |
| `setup-matt-pocock-skills` 原版 | 抄它的設計，寫你們自己的客戶設定檔 |

### 功能重疊檢查
- `grill-me` 與 `grill-with-docs` **重疊 100%**（後者＝前者＋domain-modeling）。榜上第 2、3 名其實是同一支的兩個入口
- `triage` 的「grill 階段」與 `grill-me` 重疊 → 收 triage 就自動得到 grilling
- `improve-codebase-architecture` 的第 3 階段與 `grill-me` 重疊
- **實際獨立能力只有 7 個，不是 10 個**

---

## 安全、權限、依賴、鎖定風險

| 風險等級 | Skill | 具體風險 | 對策 |
|---|---|---|---|
| 🔴 高 | `find-skills` | 教 Agent 跑 `npx skills add <pkg> -g -y`（**全域安裝＋跳過確認**），來源是一個**無審查流程**、排名純靠安裝遙測的登錄檔。自帶防護只是「1K+ 安裝／官方來源／100+ stars」這種軟啟發式，而安裝量正是最容易刷的指標 | 絕不給 Bash 自動核准；fork 版移除 `-y`；建白名單來源 |
| 🔴 高 | `agent-browser` | 真 Chrome + profile ＝ 活的 cookie 與登入態；**預設 session 全機器共用**，多 agent 會互相劫持頁面；auth vault 存憑證；WebMCP 是 prompt injection 面（skill 自己有警告） | 強制命名 session；廣告後台／金流一律獨立 profile；不可逆動作要人核准 |
| 🟡 中 | `triage` | 對外寫入：留言、關單。需要 GitHub write scope | 強制免責聲明（原版已有）；關單前要人確認 |
| 🟡 中 | `handoff` | 寫到 OS 暫存目錄 ＝ 企業環境無稽核軌跡 | 改寫到受控目錄並留存 |
| 🟢 低 | mattpocock 全系列 | 純 markdown、MIT、明文宣告 model-agnostic | — |

**生態成熟度警訊**：`mattpocock/skills` v1.2.3（2026-09-18）才剛補上 `diagnosing-bugs` 的密鑰遮蔽——也就是說，在那之前它會把含密鑰的指令與輸出貼出來。**這個生態的安全成熟度約等於 2015 年的 npm。**

**Vendor lock-in 排序**：`agent-browser`（Rust 二進位＋Vercel Sandbox／AWS AgentCore 雲端模式）＞ `find-skills`（硬編碼 skills.sh 為索引，並優先推薦註冊表擁有者自家的 skill）＞ `frontend-design`（純文字，但寫死 Anthropic 視角）＞ mattpocock 全系列（最低，純 markdown）

**跨 agent 相容性（加分）**：mattpocock 每支 skill 附 `agents/openai.yaml`（Codex 用），且 CHANGELOG 顯示他們正在**主動移除 Claude Code 專屬的工具名稱**以保持可攜。如果你們會同時跑多個 harness，這批是目前最安全的選擇。

---

## D. 三組小隊

### 小隊 A｜經營診斷小隊 — 打「新客戶第一次診斷」

| 角色 | 由誰擔任 | 做什麼 |
|---|---|---|
| **入口** | `triage`（改造版） | 老闆丟來一堆抱怨 → 分類（營運問題／成長需求）、定狀態 |
| **判斷** | `improve-*` 的三段骨架 | 熱區掃描（近 90 天營收／毛利／退貨／客訴的變動熱區）→ 出 HTML 診斷報告，每個候選附 before/after 與建議強度 |
| **深聊** | `grilling` | 老闆挑一個 → frontier 批次提問，每題附建議答案 |
| **沉澱** | `domain-modeling` | 當場寫下這家店的術語表（「翻桌率」老闆與店長講的是不是同一件事）+ 決策紀錄 |
| **驗證** | `tdd` 的 seam 約定 | 動工前講好用什麼指標驗收，且期望值來自獨立來源 |
| **交棒** | `handoff` | 交給執行小隊，只寫差集 + 建議工具 |

順序：`triage → improve-*(診斷) → grilling → domain-modeling → tdd(定 seam) → handoff`
**最適合的戰役**：初次諮詢、可收費的診斷報告、續約前的體檢

---

### 小隊 B｜獲客內容小隊 — 打「官網 + 短影音 + 廣告素材」

| 角色 | 由誰擔任 | 做什麼 |
|---|---|---|
| **入口** | `grill-me`(grilling) | 把 brief 問清楚：客群、價位帶、主打賣點、通路、預算 |
| **偵察** | `agent-browser` | 去看競品官網、廣告資料庫、平台後台數據，截圖存證 |
| **執行** | `frontend-design` | 兩段式：先出 token 計畫 → 對照反預設清單自審 → 才產出 |
| **驗證** | `agent-browser`（dogfood 模式）+ frontend-design 自我批判 | 自己去點一遍、截圖、檢查行動版與鍵盤焦點 |
| **沉澱** | `domain-modeling` | 品牌詞彙表 ＝ 之後所有素材的一致性依據 |
| **交棒** | `handoff` | 交給投放／客服小隊 |

順序：`grill-me → agent-browser(偵察) → frontend-design(出方案+自審) → 產出 → agent-browser(驗收) → domain-modeling → handoff`
**最適合的戰役**：新店開幕、新品上市、季節檔期、品牌改版

---

### 小隊 C｜客服與知識小隊 — 打「客訴分流 + 知識庫自我成長」

| 角色 | 由誰擔任 | 做什麼 |
|---|---|---|
| **入口** | `triage` | 分類（客訴／需求／詢問）+ 定狀態 |
| **判斷** | `triage` 的重複檢查 + `.out-of-scope` 比對 | 「這題我們回答過嗎？」「這件事我們是不是已經決定不做？」 |
| **追問** | `grilling` | 資訊不足時**一輪問完**，不要一題一題騷擾客人 |
| **執行** | AI 員工照 agent brief 回覆 | 契約式工單，有明確 out of scope |
| **驗證** | `tdd` 的驗收標準 | 每張單的完成條件可獨立查核 |
| **沉澱** | `domain-modeling` + `.out-of-scope` | 新說法進詞彙表；拒絕理由進否決庫 |
| **交棒** | `handoff` | 轉真人客服時帶完整脈絡 |

**這隊最會隨時間變強**，因為它有兩個知識回饋迴路（詞彙表 + 否決庫）。
**最適合的戰役**：餐飲訂位客訴、電商退換貨、加盟主提問、長期客服成本壓縮

---

## E. 最小黃金組合（3 / 5 / 7）

判準不是下載排名，是「**最少 Skill，形成最大完整工作閉環**」。

### 3 支：`grilling` + `triage` + `handoff`
- **閉環**：分流 → 對齊 → 交棒。進得來、談得清、傳得下去
- **為什麼不含第一名 `find-skills`**：找工具是採購行為，不是工作閉環的一環
- **斷在哪**：❌ **沒有驗證**。你會有一個能接單、能問清楚、能交接，但**不知道自己做得對不對**的組織。做完沒人確認做對了，錯誤會一路傳下去

### 5 支：+ `tdd`（驗收）+ `domain-modeling`（記憶）
- **閉環**：分流 → 對齊 → 定驗收 → 執行 → 驗證 → 沉澱 → 交棒 ✅ **這才是真正完整的最小閉環**
- `tdd` 補上「獨立驗證來源」，`domain-modeling` 是那個讓組織**會變強**的零件——沒有它，每次都從零開始談
- ⚠️ 注意我做了什麼：我把**不在 Top 10** 的 `domain-modeling` 放進 5 支，把 **Top 1** 的 `find-skills` 排除。這是刻意的
- **斷在哪**：❌ **沒有手腳**。全是嘴上功夫，不能實際去操作系統、看後台、抓資料。所有「執行」都得靠人

### 7 支：+ `agent-browser`（感官／執行器）+ `improve-*` 的診斷骨架（改成 business-diagnosis）
- `agent-browser` 補上手腳
- **診斷骨架補上最關鍵的一件事：自己找到戰場**。前面 5 支都要「有人先告訴你問題」才會啟動；加上它，軍團才會主動發現問題
- **為什麼不是 `frontend-design`**：它是交付品質，不是閉環零件。排第 8 支
- **7 支之後仍然缺**：長期記憶、成本控制、真人審批關卡 → 這三樣市面上沒有，必須自己做

---

## F. 對中小企業最值得移植的 5 個能力

### 1. frontier 批次提問 → 老闆需求訪談
老闆最討厭 AI 一題一題問。frontier 演算法的價值就在這裡：**一輪問完所有現在就能問的，而且每題附建議答案**，老闆可以用一個字回覆。

> 新品上市 brief，第一輪：`Q1 客群 ➡️ 建議 25–35 女性上班族` / `Q2 價位帶 ➡️ 建議 180–260` / `Q3 主打賣點` / `Q4 通路` / `Q5 預算上限`。
> 老闆回「2、照你建議、其他都可以」。第二輪才問素材風格、投放平台、KPI——因為這些要等價位帶定了才有意義。

### 2. 狀態機 + 否決庫 → 客訴與需求分流
2 類別（客訴／需求）× 5 狀態（待判定／待補資料／可交 AI 員工／需真人／不處理）。

`.out-of-scope/` 換成「**我們不做的事**」知識庫：「不接單客製化蛋糕，理由是產線切換成本，2026-03 決定，相關詢問 12 筆」。下次同樣請求直接引用，**不用每次重新討論**。這一條對餐飲／電商省最多人力。

### 3. 熱區掃描 → 視覺化選單 → 深聊 → **經營診斷**（最能變現）
- `git log` 熱區 → 近 90 天營收／毛利／退貨／客訴的**變動熱區**
- deletion test → 「這個品項／這個流程如果砍掉，複雜度會消失還是轉移到別處？」轉移的才值得動
- 輸出一份 self-contained HTML 診斷報告，每個候選附 before/after 圖與建議強度徽章，最後給 Top recommendation
- 老闆點一個 → 才進 grilling 深聊

**這是整份報告裡最能直接開發票的一條。**

### 4. seam 前置 + 獨立驗證來源 → 行銷與專案驗收
做任何活動前先跟老闆確認「**我們在哪個點量測**」——是到店人數？加購率？還是總營收？（seam 選錯，後面全錯）

而且期望值**必須來自獨立來源**（去年同期、對照組、同商圈基準），不能用跟執行同一套邏輯算出來。這就是 `tdd` 的 tautological 反模式，直接解掉「行銷成效自己說自己好」。

### 5. 反預設清單 + 自審 pass → 品牌一致性稽核
把「**我們家不要什麼**」寫成清單（不要純白底＋襯線大字、不要 emoji 開頭、不要「限時優惠！」、不要箭頭後綴）。AI 先出方案 → 對照清單自審 →「這是不是我對任何客戶都會產出的東西」→ 才產出。適用官網、短影音封面、菜單、廣告素材。

**加碼第 6 條**：`handoff` 的差集交接四條，直接就是班次交接／業務交接／專案交接的規格。

---

## G. 三個你沒問到、但更重要的洞察

### 洞察 1：排行榜系統性低估「母器」
`skills.sh` 排名＝安裝遙測，而安裝量獎勵的是**入口與路由器**，不是**方法**。`grilling` 和 `domain-modeling` 是整批東西的引擎，卻因為是「被呼叫」而非「被安裝」，完全不在榜上。第 2 名和第 3 名加起來只有 14 行程式碼，兩支都是 router。

**推論：任何以安裝量選武器的策略，都會系統性地買到把手而不是引擎。你要看的是依賴圖。**

### 洞察 2：第一名本身是一個供應鏈攻擊面
`find-skills`（340 萬安裝）教 Agent 執行 `npx skills add <package> -g -y`——**全域安裝、跳過確認**——從一個**沒有提交審查流程**、排名純靠安裝遙測的登錄檔取件。它自帶的防護是「1K+ 安裝／官方來源／100+ stars」這種軟啟發式，而**安裝量恰好是三者中最容易刷的**。

這個生態現在的位置：一個人人都裝、會自動安裝其他東西、判斷依據是可刷指標的入口。建議：**find-skills 只准找和建議，安裝一律人工核准，fork 版移除 `-y`。**

### 洞察 3：10 支裡沒有一支管「錢、權限、回滾」
沒有預算上限、沒有權限分級、沒有可逆性判斷、沒有失敗回滾。對只寫 code 的人這還好（`git revert` 兜得住）。對要碰**廣告投放後台、金流、對外客服**的中小企業，這是致命缺口。

**你們必須自己補第 11 支：`guardrail`** — 每個動作標記 reversible / irreversible，不可逆的一律停下來要人核准。這支市面上沒有，而且它是你們做 B2B 時唯一能讓老闆放心的東西。

### 加碼洞察 4：「編隊」的第一個真實工程代價
`agent-browser` 的預設 session 是**全機器共用**的。它的官方文件明寫：在預設 session 工作會「劫持另一個 agent 正在操作的頁面，或把人類留著的分頁導航走」。

你們一旦要跑「軍團」（多 agent 併行），這就是第一個會出事的地方。多 Agent 不是把 Agent 數量加上去，是**資源隔離**。這件事在你的「器 → Skill → 員工 → 小隊」框架裡完全沒有位置。

---

## 最後：如果我是這套 AI 軍團的總工程師

### 先說你的框架哪裡有問題

你的架構是：`器 → Skill → AI 員工 → 小隊 → 專案/戰役 → 市場變現`。方向對，但有三個結構問題。

**問題 1：「器」和「Skill」之間缺一層——契約層。**
`setup-matt-pocock-skills` 存在的唯一理由就是這個。沒有這層，每支 skill 都要自己重問一次「你們用什麼工具追蹤問題」。對你們更嚴重——**每家客戶的 POS、金流、平台都不一樣**。
應該是：`器 → 契約 → Skill → …`。這層我建議叫**客戶設定檔**（`CLIENT.md` + `GLOSSARY.md` + `不做清單.md`）。

**問題 2：「AI 員工」可能是錯的抽象層級。**
這 10 支裡**沒有任何一支是「員工」**，它們全部是**方法**，不是**角色**。
把方法包成「員工」的後果是：每個員工都要重複裝備同樣的基本功（每個都要會問、會驗、會交接）。正確的做法是**基本功是全員共用的底層，專業才是員工的差異**。
建議改成：`器 → 契約 → 方法(Skill) → 基本功層(全員必備) → 職能包(員工) → 小隊 → 戰役 → 變現`。

**問題 3：「變現」不該掛在鏈條末端，應該倒著設計。**
這 10 支之所以是 Top 10，不是因為它們最好，是因為它們**在採用漏斗的最前面**（find-skills 是第一個裝的、setup 是裝完必跑的、grill 是最容易立刻看到效果的）。
同樣的道理：**你們的變現點決定該收哪些器**，而不是收完器再想變現。對餐飲／電商老闆，最早能收錢的是「經營診斷報告」和「客訴分流」——那就反推：`triage` + 診斷骨架 + `grilling` 要先做到能賣的品質，其他全部可以晚。

**最直接的反對意見：「收器」這個動作本身價值很低。**
這 10 支全是 MIT / Apache-2.0 的純文字，一個下午可以全部讀完、重寫成中文版。護城河不在收藏，在三件事的**累積**：
1. 客戶設定檔（每家店的語言、規則、禁忌）
2. 否決庫（「我們不做的事」及其理由）
3. 驗收 seam（每類專案該量哪個指標，以及獨立基準從哪來）

**這三樣別人抄不走。Skill 誰都能抄。**

### 我會怎麼收、煉、用、組

**收（3 支就好，不收 10 支）**
- 直接用：`agent-browser`（當工具不當 skill）、`find-skills`（砍掉自動安裝）
- 其餘一律不「收」，只「拆」

**煉（這是主要工作量）**
拆解重寫成中文版的 7 個方法：frontier 批次提問、術語表+ADR 雙軌、差集交接四條、狀態機+agent brief+否決庫、seam 前置+獨立驗證來源、熱區→視覺選單→深聊、反預設清單+自審 pass。
自己補 2 支市面上沒有的：`guardrail`（可逆/不可逆判斷）、`client-context`（客戶設定檔）。

**用（跨域移植優先序）**
經營診斷 > 客訴分流 > 需求訪談 > 行銷驗收 > 品牌稽核。前兩個能直接開發票，先做。

**組（第一個 90 天只打一場戰役）**
用 5 支黃金組合（`triage` + `grilling` + `tdd-seam` + `domain-modeling` + `handoff`），只打「經營診斷報告」這一場，把 **20 個客戶的設定檔和否決庫跑出來**。

第 91 天，你手上的資產不是 10 支 skill——是 **20 份別人沒有的客戶語言模型**。那才是變現的東西。

---

## 參考來源

- [mattpocock/skills](https://github.com/mattpocock/skills)（MIT，逐檔閱讀）
- [vercel-labs/skills](https://github.com/vercel-labs/skills)（MIT，`skills/find-skills/SKILL.md`）
- [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)（Apache-2.0，`skills/agent-browser/SKILL.md` 與 `skill-data/core/SKILL.md`）
- [anthropics/skills](https://github.com/anthropics/skills)（Apache-2.0，`skills/frontend-design/SKILL.md`）
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)（比對用，`frontend-design` 不在此 repo）
- [skills.sh（本環境無法直連）](https://skills.sh/)
- 安裝量：使用者提供之影片畫面（2026-09），另參考公開二手報導
