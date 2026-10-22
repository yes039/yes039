# DECISION-012｜LibTV 雙路線連線操作卡

- 依據：M-003-DECISION-012（Shen｜總指揮）
- 驗收目標：取得**至少一次 LibTV MCP 真實工具回應**，並保留可核對的紀錄
- 本階段範圍：只做**零點數連線**與**唯讀查詢**。不生成、不購買點數、不修改既有專案

---

## 路線 A｜Claude 自訂 MCP 連接器＋官方 OAuth（優先）

### 總指揮操作（約 5 分鐘）

1. 打開 <https://claude.ai/customize/connectors>，選「新增自訂連接器」。
2. 名稱填 `LibTV`，網址填 `https://mcp.liblib.tv/mcp`，按「新增」。
3. 按「連接」，在 LibTV 官方登入頁用**測試帳號**登入並同意授權。
4. **新開一個 Claude Code 工作階段**，倉庫選 `yes039/yes039`。連接器只在工作階段開始時載入，現有工作階段看不到它。
5. 在新工作階段第一句話貼上：

   > 執行 DECISION-012 路線 A：依 `seal-team/research/C-001-ORDER-007-LibTV/ORDER-012-實測/DECISION-012-雙路線連線操作卡.md` 跑唯讀步驟 R0–R5，只用不扣點的工具，結果寫進紀錄並推上分支 `claude/libtv-integration-research-gvwhp2`。

### 判定為「A 無法連接」的情況（改走 B）

| 情況 | 請截圖保留 |
|---|---|
| 第 3 步出現錯誤（例如不允許註冊用戶端、redirect URI 不符） | 錯誤畫面 |
| 授權成功，但新工作階段看不到 LibTV 工具 | 連接器設定頁、工作階段連接器清單 |
| 工具看得到，但每次呼叫都失敗 | C-001 會記錄錯誤原文 |

---

## 路線 B｜Mac 本機（A 失敗時）

二選一。**官方只保證 Codex**；Claude Code 是標準 MCP 用戶端，能否成功也是驗證的一部分。

### B-1 Claude Code（推薦，紀錄格式與 A 相同）

```bash
cd ~/yes039                      # 本 repo 的本機副本；沒有就先 git clone
git fetch origin claude/libtv-integration-research-gvwhp2
git checkout claude/libtv-integration-research-gvwhp2
claude mcp add --transport http libtv https://mcp.liblib.tv/mcp
claude                           # 啟動後輸入 /mcp → 選 libtv → 瀏覽器登入授權
```

授權後，在同一個 Claude Code 中貼上路線 A 第 5 步那段話（把「路線 A」改成「路線 B-1」）。

### B-2 Codex（官方路徑）

```bash
codex plugin marketplace add https://github.com/liblib-ai/marketplace.git --ref main
codex plugin add libtv@libtv
# 新建 Codex 任務 → 在 MCP 連線管理對 libtv 完成 LibTV 登入
```

在 Codex 任務中依下方 R0–R5 執行，把每一步的工具名稱、輸入與回應原文存成 `紀錄/R-紀錄-codex.md`，再交回 repo。

### 先做的檢查（任一路線都可，不需登入）

```bash
python3 seal-team/research/C-001-ORDER-007-LibTV/MVP素材/source/probe_mcp_public.py > probe-結果.json
```

預期：`/mcp` 回 `401`＋`WWW-Authenticate: Bearer`，OAuth metadata 端點回 `200`。這一步能證明「這台電腦連得到 LibTV」，**但不算 MCP 工具回應**。

---

## 唯讀步驟 R0–R5（連上後由 C-001 執行）

**守則**：每次呼叫前，先讀工具說明確認它是唯讀。說明裡出現「生成」「執行」「重試」「購買」「刪除」「更新」「上傳」等字眼的工具，本階段**一律不呼叫**。看不出是否扣點的工具也不呼叫。

| 步 | 動作 | 驗收證據 |
|---|---|---|
| R0 | 列出 LibTV 伺服器提供的全部工具名稱與說明（只讀 schema，不呼叫） | `紀錄/mcp-tools.md`：工具名稱、說明、輸入欄位；每個工具標「唯讀／寫入不扣點／可能扣點／不明」 |
| R1 | 呼叫能力或狀態檢查工具（官方技能提到的 `get_capabilities`、doctor 類） | **第一次真實工具回應**：呼叫時間、工具名、輸入、回應原文 |
| R2 | 讀取帳號資訊與點數餘額（若有唯讀工具） | 餘額數字。後續每一步都以此對照，確認沒有扣點 |
| R3 | 列出可存取的專案，找到 `f91644ef7f604ff79fd47a9272a75ff3` | 專案清單節錄 |
| R4 | 唯讀讀取節點 `v-p4tvutpb69y5`：模型、秒數、比例、解析度、原生音訊、狀態、點數、輸出網址 | 節點資料原文，與總指揮人工實測（Seedance 2.0 Mini、5 秒、9:16、480P、40 點）逐項核對 |
| R5 | 再讀一次點數餘額 | 與 R2 相同＝本階段零扣點 |

### 紀錄格式（`紀錄/R-紀錄-{路線}.md`）

| 時間（UTC） | 步驟 | 工具名稱 | 輸入（遮去帳號個資） | 回應原文（節錄） | 唯讀？ | 餘額 |
|---|---|---|---|---|---|---|

- 回應原文要保留**可核對的欄位**：專案 ID、節點 ID、時間戳記、餘額。
- **不記錄**任何 Token、Cookie、授權碼、帳號 email 或手機號；回應中若出現，先遮蔽再存檔。

### 本階段完成條件

- [ ] R1 取得至少一次 LibTV MCP 真實工具回應（＝本決策的驗收目標）
- [ ] R4 讀到既有影片節點，並完成 40 點的核對
- [ ] R2 與 R5 的餘額相同
- [ ] 紀錄已推上分支

完成後才進入節點控制研究（ORDER-012 第二階段 T01–T08），且仍須在**新建的測試專案**中進行。
