# Claude Code 技能架構｜SK-01／SK-02／SK-03 規格書（草案 v0.1，待核准）

> 狀態：**規格草案，未安裝、未修改、未部署。** 本文件只放在 `skill-architect/`，不放進 `.claude/skills/` 或 `.claude/agents/`，所以 Claude Code 不會載入。
> 查核日：2026-10-17。依據：code.claude.com 官方文件 Skills、Subagents、Agent Teams、Hooks 四頁（見文末來源）。

---

## 0. 一頁結論

| 項目 | 結論 |
|---|---|
| 六項能力能否用原生功能做到 | 可以，五項有原生支撐。**「集中指揮驗收」的判準要自訂**：原生只提供關卡（Hooks、主對話統籌），不提供「什麼算合格」。 |
| MVP 用哪一套 | **Skills＋Subagents**（穩定功能）。**Agent Teams 先不用**：官方標示實驗功能、預設關閉，且無法恢復 session、不能巢狀、token 成本高。 |
| 三個技能的定位 | SK-01 拆解（唯讀、獨立上下文）→ SK-02 調度（在主對話執行，負責派工、平行、整合）→ SK-03 驗收（唯讀、獨立上下文，只判定不修補）。 |
| 案例 | 玉欣珍（員林肉圓）營運資料：營收表＋「小購」採購單據 OCR 流程。實測只用**本機快照**，不碰線上試算表與 Manus 站台。 |
| 需要你核准的事 | 見 §7：資料快照方式、是否建立 `.claude/` 檔案、實測執行位置。 |

---

## 1. 六項能力 × 官方機制對照（原生 vs 自訂）

### 1.1 官方機制現況（2026-10-17 查核）

| 機制 | 狀態 | 關鍵事實（官方文件） |
|---|---|---|
| **Skills** | 正式 | `SKILL.md` 放在 `.claude/skills/<名稱>/`（專案）或 `~/.claude/skills/`（個人）。只有 `description` 常駐上下文，內容在觸發時才載入（漸進揭露）。觸發方式有兩種：Claude 依 `description` 自動判斷，或使用者輸入 `/名稱`。`disable-model-invocation: true` 會關閉自動觸發；`context: fork`＋`agent:` 讓技能在子代理裡執行；`background: false` 讓呼叫端等結果回來；`allowed-tools` 和 `disallowed-tools` 控制工具。舊的 `.claude/commands/` 已併入 Skills。 |
| **Subagents** | 正式 | 定義檔放在 `.claude/agents/*.md`，只有 `name` 和 `description` 必填。可用欄位：`tools`、`disallowedTools`、`model`、`permissionMode`、`skills`、`hooks`、`isolation: worktree`、`maxTurns`、`background`、`effort`。**每個子代理有全新的上下文**，只把最終摘要交回主對話（fork 例外，會繼承完整對話）。預設最多同時 20 個，巢狀最多 3 層。內建子代理有 Explore（唯讀）、Plan（唯讀）、general-purpose。 |
| **Agent Teams** | **實驗** | 需設定 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`，架構是 lead＋teammates＋共享任務清單＋mailbox。限制：每個 session 一個 team、不能巢狀、`/resume` 不會恢復 teammates、任務狀態可能延遲，非互動模式（`-p`）不能用。開啟後，Claude 具名派出的子代理會變成 teammate。 |
| **Hooks** | 正式 | 驗收相關事件有 `SubagentStop`、`TaskCreated`、`TaskCompleted`、`TeammateIdle`、`PreToolUse`。exit code 2 會阻擋動作，例如 `TaskCompleted` 回 2 會拒絕完成，`PreToolUse` 回 2 會擋下工具呼叫。 |
| **Task 工具** | 正式 | `TaskCreate`、`TaskUpdate`、`TaskList`，在主對話追蹤任務狀態（pending／in_progress／completed）。 |
| **Plan mode** | 正式 | 唯讀規劃模式，先出計畫再動手。 |

### 1.2 六項能力對照

| 能力 | 原生功能（直接用） | 自訂工作流（本規格補上） |
|---|---|---|
| ① 任務拆解 | Plan 子代理、Plan mode、`context: fork` 技能 | **SK-01**：拆解規則（相依、平行、粒度）和「任務卡」格式 |
| ② 子代理派工 | Agent 工具＋`.claude/agents/` 定義＋`tools` 白名單 | **SK-02**：派工表（任務卡對應到哪個子代理、權限、輸出格式） |
| ③ 平行執行 | 同一回合多個 Agent 呼叫、背景子代理（上限 20） | SK-02 的分波規則：只有沒有相依、沒有共同寫入目標的任務才放同一波 |
| ④ 上下文隔離 | 子代理天生獨立上下文；`isolation: worktree` 隔離檔案 | 任務卡必須自足（子代理看不到主對話），派工 prompt 不夾帶多餘資料 |
| ⑤ 成果整合 | 子代理摘要自動回到主對話 | SK-02 的整合規則：統一「成果單」格式、衝突時以來源資料為準 |
| ⑥ 集中指揮驗收 | 主對話是唯一指揮點；Hooks 可設關卡 | **SK-03**：驗收判準（對帳、抽查、格式），只出判定、不修補 |

**刻意不用的原生功能**：Agent Teams，原因見 §0。等到出現「子代理之間需要互相質疑、討論」的任務，例如多假設除錯，再評估升級。

---

## 2. 案例背景：玉欣珍戰情儀表板（已查到的部分）

**來源**：Google Drive「未玉欣珍_AI店東_001_營運資料＃命名的試算表」，加上「玉欣珍｜輔導工作日誌」。
**查不到的部分**：儀表板前端程式與網址。表內記錄的 `yuxinops-n2sopt7t.manus.space` 目前 DNS 解析失敗，本 repo 也沒有儀表板程式碼。**以下以試算表作為儀表板的資料層來設計；請補上儀表板本體位置（見 §7）。**

| 工作表 | 內容 | 列數（2026-10-17 讀取時） |
|---|---|---|
| 工作表1 | 日期／營收／訂單數／退款 | 1 列（9/3：59,942 元、220 單、退款 0） |
| 小購_暫存單據_V01 | LINE 上傳單據 → Gemini OCR → 狀態（待確認、已確認、已入帳、已作廢） | 7 列 |
| 小購_測試資料_V01 | 測試列 | 1 列 |
| 小購_採購主表_V02 | 已入帳明細（廠商、品類、品名、數量、單價、稅、實付） | 3 列 |

**已觀察到的資料品質問題**（正好拿來當驗收考題，詳見實測計畫）：

1. 工作表1 的日期和金額是**全形數字**（`２０２６／０９／０３`、`５９９４２`），程式加總會失敗或得到 0。
2. 採購主表第 3、4 列是同一張單據拆成兩列，稅金和實付只寫在第一列。逐列加總「總價＋稅」與加總「實付」的口徑不同，容易重複計算或漏算。
3. 暫存單據裡混有測試列（`R-TEST-*`、`測試食品行`），會污染統計。
4. OCR 把買方誤讀成「王欣珍」（正確為玉欣珍），而且這張單把品項讀成「炸」，類別標為 human。
5. 3 張「待確認」單據（共 5,700 元）沒有進主表，屬於應追蹤的積壓。
6. 主表第 2 列「品類」是空白。

**可對帳的不變式**：採購主表「實付」合計 18,450 元，應等於暫存單據中「已入帳」兩張的 `total_amount`（3,900＋14,550）。

---

## 3. SK-01 任務拆解官

| 欄位 | 規格 |
|---|---|
| **定位** | 把一個戰情需求拆成可派工的「任務卡」清單。只拆不做。 |
| **觸發條件** | (a) 使用者輸入 `/sk-01-decompose <需求>`；(b) SK-02 收到沒拆過的需求時先呼叫 SK-01。**不開放自動觸發**（`disable-model-invocation: true`），避免一般對話被誤拆。 |
| **輸入** | 1. 需求原文（一句到一段）；2. 資料來源清單（本機快照路徑、工作表名稱）；3. 限制（截止時間、可用子代理種類、禁止事項）。缺 1 或 2 就退回。 |
| **執行步驟** | 1. 重述目標並定義「完成」（可驗收的產出）。2. 盤點資料來源，標出每個來源的負責任務。3. 依「一個任務只碰一組資料、只產一份成果」拆分，粒度為一個子代理 5–15 分鐘可完成。4. 標註相依（`depends_on`），沒有相依、沒有共同寫入目標的才標 `parallel_group` 同一組。5. 為每張卡寫自足的 `brief`：子代理看不到主對話，所以 brief 要包含路徑、欄位名稱和判斷規則。6. 為每張卡寫驗收條件，讓 SK-03 能直接拿去用。7. 自檢：沒有循環相依、每個資料來源都有人負責、卡片數 ≤ 8。 |
| **輸出格式** | `任務拆解單`（YAML，格式見 §6.1）：`goal`、`definition_of_done`、`tasks[]`（`id`、`title`、`brief`、`inputs`、`output_schema`、`depends_on`、`parallel_group`、`acceptance`、`suggested_agent`、`tools_allowed`）、`risks[]`、`open_questions[]`。 |
| **權限邊界** | 只讀：`Read`、`Glob`、`Grep`。**禁止** `Write`、`Edit`、`Bash`、`Agent`，也禁止所有 Google Drive 寫入類工具。在獨立上下文執行（`context: fork`、`agent: Plan`、`background: false`）。 |
| **失敗處理** | 需求不明確：不猜，在 `open_questions` 列出問題後停止，狀態 `NEEDS_INPUT`。資料來源讀不到：標 `BLOCKED` 並寫明是哪個來源。卡片超過 8 張：合併或改成分階段，並在 `risks` 說明。偵測到循環相依：重拆一次，仍失敗就交回人工。 |
| **驗收標準** | ① 輸出能通過格式檢查（必填欄位齊全）。② 每張卡的 `brief` 單獨交給一個新開的子代理就能執行，不需回問。③ 相依圖無環。④ 每張卡都有可判定的 `acceptance`，不能寫「做好」這類模糊詞。⑤ 同一 `parallel_group` 內沒有共同寫入目標。 |

**擬定的 frontmatter（僅草案，未安裝）**

```yaml
---
name: sk-01-decompose
description: 任務拆解官。把戰情或營運分析需求拆成可平行派工的任務卡（YAML）。只拆解、不執行。
disable-model-invocation: true
context: fork
agent: Plan
background: false
allowed-tools: Read, Glob, Grep
disallowed-tools: Write, Edit, Bash, Agent
argument-hint: "[需求描述]"
---
```

---

## 4. SK-02 AI 調度官

| 欄位 | 規格 |
|---|---|
| **定位** | 主對話的指揮者：拿到任務卡後派工、控制平行、收成果、整合，最後交給 SK-03 驗收。**必須在主對話執行**（不設 `context: fork`），因為派工、追蹤和整合都需要主對話。 |
| **觸發條件** | 使用者輸入 `/sk-02-dispatch <任務拆解單路徑或需求>`。如果輸入是需求而非拆解單，先呼叫 SK-01。不開放自動觸發。 |
| **輸入** | SK-01 的 `任務拆解單`（必須是 `READY` 狀態）、子代理派工表（§4.1）、本次的權限上限。 |
| **執行步驟** | 1. 檢查拆解單（格式、相依無環），不合格就退回 SK-01。2. 用 `TaskCreate` 為每張卡建立任務，方便追蹤。3. 依 `parallel_group` 分波：同一波的任務在**同一回合**一起派出，下一波要等上一波全部回來。4. 派工 prompt 只放該卡的 `brief`、`inputs` 和 `output_schema`，不轉貼主對話內容（上下文隔離）。5. 收到每份成果後先做格式檢查，不合格就用同一 brief 加上錯誤說明重派一次。6. 全部到齊後整合成 `整合成果單`：數字一律引用子代理成果中的來源列，衝突時兩邊並列並標記，不自行裁決。7. 交 SK-03 驗收。8. 依驗收結果做最終回報，退件的卡最多重派一輪。 |
| **輸出格式** | `派工紀錄`（每張卡的子代理類型、派出和回收時間、重派次數、狀態）＋`整合成果單`（Markdown：摘要、KPI 表、異常清單、每個數字的來源卡 ID）＋SK-03 的 `驗收判定書`。 |
| **權限邊界** | 主對話可用 `Agent`、`TaskCreate`、`TaskUpdate`、`TaskList`、`Read`，`Write` **只限** `skill-architect/runs/<run-id>/` 輸出夾（實測時改用 scratchpad）。子代理一律唯讀（Explore，或 `tools: Read, Grep, Glob` 的自訂子代理）。**禁止**：Google Drive／Sheets 寫入、`git push`、部署指令、修改儀表板程式、開啟 Agent Teams。同時在場的子代理 ≤ 4。 |
| **失敗處理** | 子代理逾時或報錯：重派 1 次，第 2 次失敗就把該卡標 `BLOCKED`，其他卡照常進行，整合單上標明缺口。成果格式錯誤：附錯誤說明重派 1 次。子代理越權（試圖寫入）：由權限設定擋下，該卡判 `FAIL` 並回報，不換更高權限重試。上游拆解有缺陷：退回 SK-01，不自行改卡。驗收退件：只重派被點名的卡，最多 1 輪，仍不過就交回人工。 |
| **驗收標準** | ① 同一 `parallel_group` 的任務實際在同一回合派出（看派工紀錄的時間戳）。② 主對話沒有出現子代理的原始中間資料，只有摘要（上下文隔離）。③ 整合單每個數字都有來源卡 ID。④ 全程沒有寫入允許輸出夾以外的位置（檢查 `git status` 和 Drive `modifiedTime`）。⑤ 每張卡的最終狀態都是 DONE、BLOCKED、FAIL 其中之一，不能停在 pending。 |

### 4.1 子代理派工表（草案）

| 任務類型 | 子代理 | 工具 | 理由 |
|---|---|---|---|
| 讀表彙整（營收、採購） | 內建 `Explore` 或自訂 `yx-reader` | Read, Grep, Glob | 只讀，不需要寫入 |
| 資料品質稽核 | 自訂 `yx-auditor` | Read, Grep, Glob | 只回報異常，不修正 |
| 需要計算 | 自訂 `yx-calc`（`isolation: worktree`） | Read, Bash（僅 python3 讀檔計算） | 計算在獨立 worktree 內，不污染主目錄 |
| 驗收 | `sk03-verifier`（見 §5） | Read, Grep, Glob, Bash（僅重算） | 與執行者分離 |

```yaml
# .claude/agents/yx-reader.md（草案，未建立）
---
name: yx-reader
description: 讀取玉欣珍營運資料快照並依任務卡產出結構化摘要。唯讀。
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
```

---

## 5. SK-03 成果驗收官

| 欄位 | 規格 |
|---|---|
| **定位** | 獨立驗收者：用 SK-01 寫好的驗收條件和資料不變式，判定 SK-02 的整合成果。**只判定、不修補。**執行者和驗收者分開，避免球員兼裁判。 |
| **觸發條件** | (a) SK-02 整合完成後自動呼叫；(b) 使用者輸入 `/sk-03-verify <整合成果單路徑>`；(c) 選配：`TaskCompleted` hook 要求任務附驗收結果（屬自訂，MVP 不啟用）。 |
| **輸入** | `任務拆解單`（含每卡的 `acceptance`）、`整合成果單`、`派工紀錄`、原始資料快照（用來重算）。 |
| **執行步驟** | 1. **格式關**：必填欄位、每個數字附來源。2. **對帳關**：用原始快照獨立重算關鍵數字，例如主表實付合計要等於暫存單據已入帳合計，營收要把全形數字正規化後比對。3. **抽查關**：隨機抽 ≥ 2 個明細數字，回到原始列核對。4. **異常關**：檢查已知的資料品質陷阱有沒有被報出（全形數字、拆列稅金、測試列混入、OCR 誤讀、待確認積壓、空白品類）。5. **紀律關**：檢查派工紀錄與權限（沒有越權寫入、平行確實同回合派出）。6. 逐卡給判定，再給總判定。 |
| **輸出格式** | `驗收判定書`（YAML）：`verdict`（`PASS`、`PASS_WITH_NOTES`、`FAIL`）、`checks[]`（`gate`、`item`、`expected`、`actual`、`result`、`evidence`）、`rejected_tasks[]`（卡 ID＋退件理由）、`notes[]`。 |
| **權限邊界** | 獨立上下文（`context: fork`、`agent: sk03-verifier`、`background: false`）。工具限 `Read`、`Grep`、`Glob`，`Bash` 只用來跑 python3 重算唯讀快照。**禁止** `Write`、`Edit`、`Agent`、所有寫入或部署動作。不能改成果、不能代替執行者補資料。 |
| **失敗處理** | 缺原始快照：判定 `FAIL`，理由「無法獨立驗證」，不採信子代理的數字。重算結果和成果單不一致：該卡判 `FAIL`，附雙方數字和證據列。驗收條件本身寫得模糊、無法判定：標 `UNVERIFIABLE`，回饋給 SK-01 修卡。SK-03 自己執行失敗：回報 `VERIFIER_ERROR`，SK-02 不得把它當成 PASS。 |
| **驗收標準（驗驗收官）** | ① 在實測中注入的 6 個已知陷阱，至少抓到 5 個（≥ 83%）。② 刻意寫錯一個數字的成果單必須判 `FAIL`（不能放水）。③ 正確的成果單不能被誤判 `FAIL`（不能誤殺）。④ 每個 FAIL 都附原始列證據。⑤ 全程沒有寫入動作。 |

```yaml
# .claude/skills/sk-03-verify/SKILL.md（草案，未建立）
---
name: sk-03-verify
description: 成果驗收官。依任務卡驗收條件與原始資料獨立重算，判定整合成果 PASS/FAIL。只判定、不修補。
disable-model-invocation: true
context: fork
agent: sk03-verifier
background: false
---
```

---

## 6. 交接格式

### 6.1 任務卡（SK-01 → SK-02）

```yaml
run_id: YX-2026W42-01
status: READY            # READY | NEEDS_INPUT | BLOCKED
goal: 產出玉欣珍 9/1–9/9 戰情摘要（營收、採購支出、單據積壓、資料品質）
definition_of_done: 一份整合成果單，每個數字可追溯到快照列，並通過 SK-03
tasks:
  - id: T1
    title: 營收彙整
    brief: 讀取 fixtures/工作表1.csv，先把全形數字轉成半形，再輸出每日營收、訂單數、客單價
    inputs: [fixtures/工作表1.csv]
    output_schema: {date: str, revenue: int, orders: int, aov: float, source_rows: [int]}
    depends_on: []
    parallel_group: A
    acceptance: revenue 必須是整數；aov = revenue / orders，四捨五入到小數 2 位
    suggested_agent: yx-reader
    tools_allowed: [Read, Grep, Glob]
risks: []
open_questions: []
```

### 6.2 成果卡（子代理 → SK-02）

```yaml
task_id: T1
status: DONE             # DONE | BLOCKED | FAIL
result: {...依 output_schema...}
evidence: ["工作表1.csv 第2列"]
anomalies: ["日期與金額為全形數字，已正規化"]
```

---

## 7. 待核准事項（核准前不動作）

1. **儀表板本體位置**：Manus 站台目前無法解析，請提供儀表板目前的網址或程式碼位置。若儀表板只有試算表，就以試算表為準。
2. **資料快照方式**：建議由我**唯讀**下載試算表內容，轉成 CSV 存到 session scratchpad（不進 repo、不寫回 Drive）。是否同意？
3. **是否建立 `.claude/skills/` 與 `.claude/agents/` 檔案**：實測需要。建議放在獨立分支，或只在 scratchpad 模擬目錄執行，核准後才建立。
4. **實測範圍**：只做 《最小實測計畫.md》的 T1–T5，不接 LINE、不呼叫 OCR、不部署。

---

## 來源

- Skills：https://code.claude.com/docs/en/skills
- Subagents：https://code.claude.com/docs/en/sub-agents
- Agent Teams：https://code.claude.com/docs/en/agent-teams
- Hooks：https://code.claude.com/docs/en/hooks
