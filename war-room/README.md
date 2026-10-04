# 作戰室母體（War Room）

一套母體，多支部隊。母體程式不動，只換一份 Config，就能裝入另一支 AI 部隊。

```
war-room/
├── index.html            # 裝填架：列出 Config、切換（一鍵裝填）、用 #網址 記住選擇
├── core/                 # 母體（不放任何業務名稱）
│   ├── war-room.js       # 7 段骨架、4 種狀態、自動排版、連線、動畫、事件流、7 格面板、Config 驗證
│   └── war-room.css
└── configs/              # 部隊（每支部隊一份）
    ├── empty.js          # EMPTY／母體展示，也是新部隊的起手模板
    └── seal-team.js      # SEAL TEAM／海豹小隊，第一個裝填案例
```

打開方式：`index.html#empty`、`index.html#seal-team`，或按畫面上方的按鈕切換。

## 母體固定的部分

- **7 段流程**：`INPUT → DISCOVER → JUDGE → ROUTE → RUN → VERIFY → SAVE`。每段一列，節點由母體自動平均排版，Config 不寫座標。
- **每個節點有自己的狀態，只由指名它的 Event 改變**：`IDLE`、`READY`、`ACTIVE`、`WAITING`、`DONE`、`FAILED`。
- **連線**：同一段內是側向連線，往下游是垂直曲線，回到上游的連線從右側繞回去。
- **底部 7 格面板**：EVENT LOG 與 STATUS 只反映真實事件；SIGNALS、DECISIONS、HEAT MAP、REACH 是標示 `MOCK` 的展示數據，不讀也不寫流程狀態。ROSTER 是 Config 靜態文字。
- **驗證**：Config 寫錯時（例如 stage 名稱打錯、連線指向不存在的節點、每段超過 6 個節點），畫面直接列出錯誤，不會畫出半套。

## Event Engine V2

三條鐵律：**每個節點有自己的狀態；路過 ≠ 完成；異常可以原地恢復。**

```js
WarRoom.emit({type: "TASK_CREATED"})                                  // 開戰：全部重置
WarRoom.emit({type: "WAITING", node: "mat", note: "素材不足，等補件"})   // 其餘事件都必須指名 node
// 接受 → {ok: true, campaign, node, state, edges}；拒絕 → {ok: false, reason, campaign, node}
WarRoom.getState()   // {started, startedAt, endedAt, nodes: {id: state}, log: [...]}
```

| 狀態 | 意思 |
|---|---|
| IDLE | 上游尚未完成，還不能開始 |
| READY | 任一條進來的連線，其來源節點已 DONE（沒有進來連線的節點開戰即 READY） |
| ACTIVE | 進行中 |
| WAITING | 卡住等外部（補件、審核），原地等待 |
| DONE | 只有收到自己的 `DONE` 或 `APPROVED` 才會 DONE |
| FAILED | 失敗，可以原地再 `STARTED` 重試 |

| 事件 | 只接受節點目前是 | 之後 |
|---|---|---|
| TASK_CREATED | （不指名節點） | 全部 IDLE，沒有上游的節點 READY |
| STARTED | READY、FAILED | ACTIVE |
| WAITING | ACTIVE | WAITING |
| RESUMED | WAITING | ACTIVE |
| APPROVED | WAITING | DONE（人工核可＝完成） |
| DONE | ACTIVE | DONE；下游符合條件的節點變 READY |
| FAILED | ACTIVE、WAITING | FAILED |

- 光流只跑「這次事件影響的那一段連線」一次，只代表訊號傳遞，不改變任何節點狀態。
- 戰役狀態（右上 STATUS）：有 FAILED → FAILED；有 WAITING → WAITING；SAVE 段節點全部 DONE → COMPLETE；其他 → RUNNING。
- 不合法的事件被拒絕，狀態不變，EVENT LOG 留一筆 ✕ 與原因。
- `index.html` 的 TEST CONSOLE 可以人工指名節點、逐一送出事件。

## 新增一支部隊

1. 複製 `configs/empty.js`，改名，例如 `configs/sales-team.js`。
2. 改 `id`、`name`，以及節點、連線、面板文字。
3. 在 `index.html` 的 Config 區加一行 `<script src="configs/sales-team.js"></script>`。

`core/` 不需要改。

## Config 欄位

| 欄位 | 說明 |
|---|---|
| `id` / `name` | 識別碼（用在 #網址）／切換按鈕上的名稱 |
| `header.title` / `tagline` / `flowLabel` | 左上大標、副標、紅色 LIVE 標語 |
| `header.stats` | 最多 3 格 `{label, value}`。TIME 與 STATUS 由母體提供 |
| `loopLabel` | 麵包屑右側，例如 `ONE LOOP / 7D` |
| `stageLabels` | 7 段的在地名稱，例如 `{INPUT: "素材"}`（可省略） |
| `nodes` | `{id, stage, title, tag?, sub?}`；`stage` 必須是 7 段之一。**不可寫 `state`**，狀態只能由 Event 決定 |
| `edges` | `[from, to]`；同時也是「誰要等誰完成」的依據 |
| `eventMap` | V0.1 欄位，V2 不再使用（事件一律指名節點）；寫了不會報錯 |
| `panels` | 各面板標題與文字：`log`、`signals.labels`（最多 7 個）、`decisions.caption/a/b`、`heat`、`reach.caption/loops/foot`、`roster.items`（最多 4 個 `[名稱, 說明]`）、`status` |
| `footer` | `[左, 右]` 頁尾文字 |

舊欄位 `route`、`events` 已移除，寫了會裝填失敗（流程只能由 Event 推進）。目前沒有接任何真實資料或外部系統。
