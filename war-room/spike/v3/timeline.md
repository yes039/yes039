# V3 Engine Spike：雙層時間線（C001 ⇄ SEAL TEAM M003）

- 時間為**模擬時鐘**（每個事件 +1 分），不是真實時間。
- 層：C001＝司令部（Campaign 引擎），M003＝海豹小隊任務（Mission 引擎），HQ＝出兵指令。
- 「C001.製片」欄是委派節點的狀態，只由 M003 交貨範圍推算：成片核可、成片輸出、製片兵、選哪個器？、隊長核可、企劃兵、值得拍嗎？、店家素材（交貨點：成片核可 h4）。

| # | 時間 | 層 | 事件 | 結果 | C001 狀態變化 | M003 狀態變化 | C001.製片 | C001 | M003 | 說明 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 09:00 | C001 | TASK_CREATED | ✓ | 招生目標 IDLE→READY |  | IDLE | RUNNING | — | 司令部開戰 |
| 2 | 09:01 | C001 | STARTED 招生目標 | ✓ | 招生目標 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 3 | 09:02 | C001 | DONE 招生目標 | ✓ | 招生目標 ACTIVE→DONE；受眾 IDLE→READY |  | IDLE | RUNNING | — |  |
| 4 | 09:03 | C001 | STARTED 受眾 | ✓ | 受眾 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 5 | 09:04 | C001 | DONE 受眾 | ✓ | 受眾 ACTIVE→DONE；策略 IDLE→READY |  | IDLE | RUNNING | — |  |
| 6 | 09:05 | C001 | STARTED 策略 | ✓ | 策略 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 7 | 09:06 | C001 | DONE 策略 | ✓ | 策略 ACTIVE→DONE；企劃 IDLE→READY |  | IDLE | RUNNING | — |  |
| 8 | 09:07 | C001 | STARTED 企劃 | ✓ | 企劃 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 9 | 09:08 | C001 | DONE 企劃 | ✓ | 企劃 ACTIVE→DONE；配兵 IDLE→READY |  | IDLE | RUNNING | — |  |
| 10 | 09:09 | C001 | STARTED 配兵 | ✓ | 配兵 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 11 | 09:10 | C001 | DONE 配兵 | ✓ | 配兵 ACTIVE→DONE；素材 IDLE→READY |  | IDLE | RUNNING | — |  |
| 12 | 09:11 | HQ | MISSION_OPENED 製片 → M003 | ✕ 製片 目前是 IDLE，必須 READY 才能出兵 |  |  | IDLE | RUNNING | — | 素材未完成就想出兵 |
| 13 | 09:12 | C001 | STARTED 素材 | ✓ | 素材 READY→ACTIVE |  | IDLE | RUNNING | — |  |
| 14 | 09:13 | C001 | DONE 素材 | ✓ | 素材 ACTIVE→DONE；製片 IDLE→READY |  | READY | RUNNING | — |  |
| 15 | 09:14 | C001 | DONE 製片 | ✕ 製片 是委派節點（seal-team），只能由 Mission 交貨推動 |  |  | READY | RUNNING | — | 假交貨：直接報製片完成 |
| 16 | 09:15 | C001 | STARTED 製片 | ✕ 製片 是委派節點（seal-team），只能由 Mission 交貨推動 |  |  | READY | RUNNING | — | 繞過海豹直接開工 |
| 17 | 09:16 | HQ | MISSION_OPENED 製片 → M003 | ✓ | 製片 READY→ACTIVE | 開戰：店家素材 READY | ACTIVE | RUNNING | RUNNING | 司令部下令：製片委派海豹，建立 M003 |
| 18 | 09:17 | M003 | STARTED 店家素材 | ✓ |  | 店家素材 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 19 | 09:18 | M003 | DONE 店家素材 | ✓ |  | 店家素材 ACTIVE→DONE；值得拍嗎？ IDLE→READY | ACTIVE | RUNNING | RUNNING |  |
| 20 | 09:19 | M003 | STARTED 值得拍嗎？ | ✓ |  | 值得拍嗎？ READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 21 | 09:20 | M003 | DONE 值得拍嗎？ | ✓ |  | 退回 IDLE→READY；值得拍嗎？ ACTIVE→DONE；企劃兵 IDLE→READY | ACTIVE | RUNNING | RUNNING |  |
| 22 | 09:21 | M003 | STARTED 退回 | ✓ |  | 退回 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 23 | 09:22 | M003 | WAITING 退回 | ✓ |  | 退回 ACTIVE→WAITING | ACTIVE | RUNNING | WAITING | 範圍外節點（退回）卡住 |
| 24 | 09:23 | M003 | RESUMED 退回 | ✓ |  | 退回 WAITING→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 25 | 09:24 | M003 | DONE 退回 | ✓ |  | 退回 ACTIVE→DONE | ACTIVE | RUNNING | RUNNING |  |
| 26 | 09:25 | M003 | STARTED 企劃兵 | ✓ |  | 企劃兵 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 27 | 09:26 | M003 | DONE 企劃兵 | ✓ |  | 企劃兵 ACTIVE→DONE；隊長核可 IDLE→READY | ACTIVE | RUNNING | RUNNING |  |
| 28 | 09:27 | M003 | STARTED 隊長核可 | ✓ |  | 隊長核可 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 29 | 09:28 | M003 | WAITING 隊長核可 | ✓ | 製片 ACTIVE→WAITING | 隊長核可 ACTIVE→WAITING | WAITING | WAITING | WAITING | 海豹 H2：作戰令等隊長核可 |
| 30 | 09:29 | M003 | APPROVED 隊長核可 | ✓ | 製片 WAITING→ACTIVE | 隊長核可 WAITING→DONE；選哪個器？ IDLE→READY | ACTIVE | RUNNING | RUNNING | 隊長核可作戰令（非交貨點） |
| 31 | 09:30 | M003 | STARTED 選哪個器？ | ✓ |  | 選哪個器？ READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 32 | 09:31 | M003 | DONE 選哪個器？ | ✓ |  | 選哪個器？ ACTIVE→DONE；製片兵 IDLE→READY；戰果兵 IDLE→READY | ACTIVE | RUNNING | RUNNING |  |
| 33 | 09:32 | M003 | STARTED 製片兵 | ✓ |  | 製片兵 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 34 | 09:33 | M003 | WAITING 製片兵 | ✓ | 製片 ACTIVE→WAITING | 製片兵 ACTIVE→WAITING | WAITING | WAITING | WAITING | 海豹受阻：素材不足，等補件 |
| 35 | 09:34 | M003 | RESUMED 製片兵 | ✓ | 製片 WAITING→ACTIVE | 製片兵 WAITING→ACTIVE | ACTIVE | RUNNING | RUNNING | 補件完成，恢復 |
| 36 | 09:35 | M003 | DONE 製片兵 | ✓ |  | 製片兵 ACTIVE→DONE；成片輸出 IDLE→READY | ACTIVE | RUNNING | RUNNING | 製片兵完成（非交貨點） |
| 37 | 09:36 | M003 | STARTED 成片輸出 | ✓ |  | 成片輸出 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 38 | 09:37 | M003 | FAILED 成片輸出 | ✓ | 製片 ACTIVE→FAILED | 成片輸出 ACTIVE→FAILED | FAILED | FAILED | FAILED | 海豹受阻：成片輸出失敗 |
| 39 | 09:38 | M003 | STARTED 成片輸出 | ✓ | 製片 FAILED→ACTIVE | 成片輸出 FAILED→ACTIVE | ACTIVE | RUNNING | RUNNING | 原地重試 |
| 40 | 09:39 | M003 | DONE 成片輸出 | ✓ |  | 成片輸出 ACTIVE→DONE；成片核可 IDLE→READY | ACTIVE | RUNNING | RUNNING | 成片輸出完成（非交貨點） |
| 41 | 09:40 | HQ | MISSION_OPENED 製片 → M004 | ✕ 製片 已委派給 M003（本版不做多 Mission） |  |  | ACTIVE | RUNNING | RUNNING | 重複出兵 |
| 42 | 09:41 | M003 | DONE 成片核可 | ✕ 成片核可 目前是 READY，不接受 DONE |  |  | ACTIVE | RUNNING | RUNNING | 交貨點未開工就報完成 |
| 43 | 09:42 | M003 | STARTED 成片核可 | ✓ |  | 成片核可 READY→ACTIVE | ACTIVE | RUNNING | RUNNING |  |
| 44 | 09:43 | M003 | WAITING 成片核可 | ✓ | 製片 ACTIVE→WAITING | 成片核可 ACTIVE→WAITING | WAITING | WAITING | WAITING | 成片送隊長 H4 核可 |
| 45 | 09:44 | M003 | APPROVED 成片核可 | ✓ | 製片 WAITING→DONE；審核 IDLE→READY | 發布 IDLE→READY；成片核可 WAITING→DONE | DONE | RUNNING | RUNNING | H4 核可＝交貨 |
| 46 | 09:45 | C001 | STARTED 審核 | ✓ | 審核 READY→ACTIVE |  | DONE | RUNNING | RUNNING |  |
| 47 | 09:46 | C001 | WAITING 審核 | ✓ | 審核 ACTIVE→WAITING |  | DONE | WAITING | RUNNING | 司令部審核：成片＋報名資訊 |
| 48 | 09:47 | C001 | APPROVED 審核 | ✓ | 發布／投放 IDLE→READY；審核 WAITING→DONE |  | DONE | RUNNING | RUNNING | 司令部核可，繼續推進 |
| 49 | 09:48 | M003 | STARTED 發布 | ✓ |  | 發布 READY→ACTIVE | DONE | RUNNING | RUNNING |  |
| 50 | 09:49 | M003 | DONE 發布 | ✓ |  | 發布 ACTIVE→DONE；讀數據 IDLE→READY | DONE | RUNNING | RUNNING |  |
| 51 | 09:50 | M003 | STARTED 讀數據 | ✓ |  | 讀數據 READY→ACTIVE | DONE | RUNNING | RUNNING |  |
| 52 | 09:51 | M003 | FAILED 讀數據 | ✓ |  | 讀數據 ACTIVE→FAILED | DONE | RUNNING | FAILED | 交貨後：海豹讀數據失敗 |
| 53 | 09:52 | M003 | STARTED 讀數據 | ✓ |  | 讀數據 FAILED→ACTIVE | DONE | RUNNING | RUNNING |  |
| 54 | 09:53 | M003 | DONE 讀數據 | ✓ |  | 讀數據 ACTIVE→DONE | DONE | RUNNING | RUNNING |  |
| 55 | 09:54 | M003 | STARTED 戰果兵 | ✓ |  | 戰果兵 READY→ACTIVE | DONE | RUNNING | RUNNING |  |
| 56 | 09:55 | M003 | DONE 戰果兵 | ✓ |  | 戰果兵 ACTIVE→DONE；戰果單 IDLE→READY | DONE | RUNNING | RUNNING |  |
| 57 | 09:56 | M003 | STARTED 戰果單 | ✓ |  | 戰果單 READY→ACTIVE | DONE | RUNNING | RUNNING |  |
| 58 | 09:57 | M003 | DONE 戰果單 | ✓ |  | 戰果單 ACTIVE→DONE；戰果庫 IDLE→READY | DONE | RUNNING | RUNNING |  |
| 59 | 09:58 | C001 | STARTED 發布／投放 | ✓ | 發布／投放 READY→ACTIVE |  | DONE | RUNNING | RUNNING |  |
| 60 | 09:59 | C001 | DONE 發布／投放 | ✓ | 發布／投放 ACTIVE→DONE；名單／報名 IDLE→READY |  | DONE | RUNNING | RUNNING |  |
| 61 | 10:00 | C001 | STARTED 名單／報名 | ✓ | 名單／報名 READY→ACTIVE |  | DONE | RUNNING | RUNNING |  |
| 62 | 10:01 | C001 | DONE 名單／報名 | ✓ | 名單／報名 ACTIVE→DONE；戰果 IDLE→READY |  | DONE | RUNNING | RUNNING |  |
| 63 | 10:02 | C001 | STARTED 戰果 | ✓ | 戰果 READY→ACTIVE |  | DONE | RUNNING | RUNNING |  |
| 64 | 10:03 | C001 | DONE 戰果 | ✓ | 戰果 ACTIVE→DONE；寫回戰果庫 IDLE→READY |  | DONE | RUNNING | RUNNING |  |
| 65 | 10:04 | C001 | STARTED 寫回戰果庫 | ✓ | 寫回戰果庫 READY→ACTIVE |  | DONE | RUNNING | RUNNING |  |
| 66 | 10:05 | C001 | DONE 寫回戰果庫 | ✓ | 寫回戰果庫 ACTIVE→DONE |  | DONE | COMPLETE | RUNNING |  |

## 驗收結果

| # | 項目 | 結果 | 依據 |
|---|---|---|---|
| 3 | 不允許提前出兵 | ✅ PASS | 製片 目前是 IDLE，必須 READY 才能出兵 |
| 2 | 不允許假交貨 | ✅ PASS | 製片 是委派節點（seal-team），只能由 Mission 交貨推動 |
| 1 | 兩個 Engine 同時存在、互不覆蓋 | ✅ PASS | C001.plan(企劃)=DONE；M003.plan(企劃兵)=ACTIVE |
| 4 | 子任務軍情往上反映 | ✅ PASS | H2 等核可→WAITING，核可→ACTIVE；make WAITING→WAITING（C001 WAITING），RESUMED→ACTIVE；rend FAILED→FAILED（C001 FAILED），重試→ACTIVE |
| 5 | 只有交貨點能完成委派 | ✅ PASS | 範圍外「退回」WAITING 時製片=ACTIVE；make DONE 後製片=ACTIVE、rend DONE 後=ACTIVE、h2 APPROVED 後=ACTIVE；h4 未開工 DONE 被拒；H4 APPROVED 後製片=DONE |
| 6 | 交貨之後兩層脫鉤 | ✅ PASS | 交貨當下 審核=READY；交貨後 M003.h7 FAILED 時 製片=DONE、C001=RUNNING |
| S | 交貨範圍不含下游 | ✅ PASS | 範圍：成片核可、成片輸出、製片兵、選哪個器？、隊長核可、企劃兵、值得拍嗎？、店家素材 |
| H2 | SEAL H2 死路已修 | ✅ PASS | 企劃兵 DONE 後、H2 核可前，選器=IDLE |

## 最終狀態

- C001：COMPLETE｜招生目標=DONE、戰果庫=RESOURCE、受眾=DONE、策略=DONE、企劃=DONE、配兵=DONE、素材=DONE、製片=DONE、發布／投放=DONE、審核=DONE、名單／報名=DONE、戰果=DONE、寫回戰果庫=DONE
- M003：RUNNING｜店家素材=DONE、戰果庫=RESOURCE、平台洞察=RESOURCE、退回=DONE、值得拍嗎？=DONE、企劃兵=DONE、隊長核可=DONE、選哪個器？=DONE、製片兵=DONE、成片輸出=DONE、發布=DONE、成片核可=DONE、讀數據=DONE、戰果兵=DONE、戰果單=DONE、戰果庫=READY、下一場=IDLE
