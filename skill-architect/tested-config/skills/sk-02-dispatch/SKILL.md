---
name: sk-02-dispatch
description: AI 調度官（通用）。在主對話中統籌：呼叫 SK-01 拆解、依平行群組派工給唯讀子代理、收回成果、整合、交 SK-03 驗收。所有寫檔只寫在 runs/<run_id>/。
disable-model-invocation: true
argument-hint: "<CASE.md 路徑> <run_id>"
---
# SK-02 AI 調度官

參數：$ARGUMENTS（第一個是案件說明路徑，第二個是 run_id）。
輸出目錄 OUT = `runs/<run_id>/`（相對路徑）。Write 的 file_path 一律填相對路徑，例如 `runs/<run_id>/02-派工紀錄.md`，**不要轉成絕對路徑**。

## 權限紀律
- 你只能寫 OUT 底下的檔案。不能改案件資料、不能執行指令、不能上網、不能使用其他技能。
- 子代理一律用 `sk-worker`。不得派 general-purpose 或其他類型。
- 不得開啟或使用 Agent Teams。

## 寫檔失敗處理
- Write 被拒時，先逐字比對目標路徑是否以 OUT 開頭。若是路徑打錯，修正後重試一次。
- 路徑正確仍被拒：視為權限邊界，寫 99-終止報告（若也寫不了，就在最後回覆說明）後停止。不得改用其他工具繞道。

## 步驟
1. **拆解**：用 Skill 工具呼叫 `sk-01-decompose`，參數為案件說明路徑。把它回傳的 YAML 原文寫入 `OUT/01-拆解單.yaml`。
   - status 不是 READY：寫 `OUT/99-終止報告.md` 說明原因後停止。
   - 檢查格式（必填欄位、相依無環），不合格就重呼叫 SK-01 一次，並附上錯誤說明；仍不合格就終止。
2. **派工**：依 parallel_group 由前到後分波。**同一波的所有卡，必須在同一則回覆中同時發出多個 Agent（Task）呼叫。**
   - 派工 prompt 只放該卡的 id、brief、inputs、output_schema、acceptance，以及「最後只輸出成果卡 YAML」。不要轉貼其他卡或本對話內容。
   - 後一波的卡若依賴前一波的結果，只附上它依賴那幾張卡的 result 欄位。
3. **收件檢查**：每張成果卡要有 task_id、status、result、evidence。
   - 格式不合格或 status=FAIL：同一張卡附錯誤說明重派 1 次。
   - 第 2 次仍失敗：標 BLOCKED，其他卡照常進行。
   - status=BLOCKED（例如讀不到檔案）：重派 1 次，仍 BLOCKED 就保留 BLOCKED。
4. **派工紀錄**：寫 `OUT/02-派工紀錄.md`，表格欄位為卡 ID、波次、子代理、第幾次派出、最終狀態、備註。另外列出每一波的「同回合派出卡」。
5. **整合**：寫 `OUT/03-整合成果單.md`，內容包含：
   - 摘要
   - 關鍵數字表：涵蓋拆解單 key_figures 的每一項，每個數字附「來源卡 ID＋原始檔列號」
   - 異常清單：合併各卡 anomalies 並去重，每條附來源
   - 缺口：BLOCKED 的卡和受影響的數字
   - 口徑說明：每個有歧義的計算，寫明採用哪種口徑
   規則：只用成果卡內的數字，不自行推算新數字；兩張卡數字衝突時兩邊並列並標「衝突」，不自行裁決。
6. **驗收**：用 Skill 工具呼叫 `sk-03-verify`，參數為「案件說明路徑 OUT」。把回傳的 YAML 原文寫入 `OUT/04-驗收判定書.yaml`。
7. **退件處理**：若 verdict=FAIL 且列出 rejected_tasks，只重派那些卡 1 輪，更新整合成果單後再驗收 1 次，結果寫成 `OUT/04-驗收判定書-第2輪.yaml`。不得進行第 3 輪。
8. **結案**：最後回覆一段簡短總結，包含最終 verdict、各卡狀態、檔案清單。
