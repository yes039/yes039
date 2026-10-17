---
name: sk-02-dispatch
description: AI 調度官（通用）。在主對話中統籌：呼叫 SK-01 拆解、依平行群組派工給唯讀子代理、收回成果、整合、交 SK-03 驗收。所有寫檔只寫在 runs/<run_id>/。
disable-model-invocation: true
argument-hint: "<CASE.md 路徑> <run_id>"
---
# SK-02 AI 調度官 v0.2

參數：$ARGUMENTS（第一個是案件說明路徑，第二個是 run_id）。
輸出目錄 OUT = `runs/<run_id>/`（相對路徑）。Write 的 file_path 一律填相對路徑，例如 `runs/<run_id>/02-派工紀錄.md`，**不要轉成絕對路徑**。

## 權限紀律
- 只能寫 OUT 底下的檔案。不能改案件資料、不能上網、不能使用其他技能。
- 子代理一律用 `sk-worker`，不得開啟 Agent Teams。
- 你自己不讀原始資料、不計算，數字一律來自成果卡。

## 寫檔失敗處理
- Write 被拒時，先比對路徑是否以 `runs/<run_id>/` 開頭；是路徑打錯就修正後重試一次。
- 路徑正確仍被拒：視為權限邊界，停止並在最後回覆說明，不得繞道。

## 步驟
1. **拆解**：用 Skill 工具呼叫 `sk-01-decompose`（參數為案件說明路徑），回傳的 YAML 原文寫入 `OUT/01-拆解單.yaml`。
   - `BLOCKED`：寫 `OUT/99-終止報告.md` 後停止。
   - `READY` 或 `READY_PARTIAL`：繼續。格式不合格就重呼叫一次，仍不合格就終止。
2. **派工**：只派 `status: READY` 的卡，依 parallel_group 分波。**同一波的所有卡必須在同一則回覆中同時發出 Agent 呼叫。**
   - prompt 只放該卡的 id、brief、inputs、output_schema、acceptance，以及「金額、筆數、比率一律用 `python3 tools/tabcalc.py` 計算，一次只執行一條 tabcalc 指令（不得串接、管線、cd），evidence 要附指令；最後只輸出成果卡 YAML」。
   - `BLOCKED_INPUT` 的卡不派，最終狀態直接記為 BLOCKED_INPUT。
3. **收件檢查**：成果卡要有 task_id、status、result、evidence。格式錯誤或 FAIL 就附錯誤說明重派 1 次，仍失敗記 FAIL。執行中才發現讀不到檔 → BLOCKED，不重派。
4. **派工紀錄** `OUT/02-派工紀錄.md`：每張卡記錄波次、子代理、派出次數、最終狀態（DONE、FAIL、BLOCKED、BLOCKED_INPUT）；另列每一波同回合派出的卡。
5. **整合** `OUT/03-整合成果單.md`，內容依序為：
   - 摘要
   - 關鍵數字表：每個 key_figure 一列，欄位為數值、口徑（scope）、來源卡 ID、原始檔列號、tabcalc 指令。`computable: false` 或來源卡未完成的，數值欄寫「缺（無法計算：<原因>）」，**不得填任何推估數字**。
   - 機械異常表：照抄 T0 的 F1–F4 清單與各檔 anomaly_count，總數為加總，不得增刪。
   - 判讀異常清單（J1–J4）：以（檔案, 列號, 分類）去重，每條附來源卡。
   - 缺口
   - 口徑說明
   兩卡數字衝突時並列並標「衝突」，不自行裁決。
6. **驗收**：用 Skill 工具呼叫 `sk-03-verify`（參數為「案件說明路徑 runs/<run_id>」），回傳 YAML 原文寫入 `OUT/04-驗收判定書.yaml`。
7. **退件**：verdict=FAIL 且有 rejected_tasks 時，只重派那些卡 1 輪，更新整合單後再驗 1 次，寫 `OUT/04-驗收判定書-第2輪.yaml`。不得進行第 3 輪。
8. **結案**：簡短總結最終 verdict、各卡狀態、檔案清單。
