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
- **節點狀態只由 Event 改變**：`IDLE`、`ACTIVE`、`DONE`、`WAITING`、`FAILED`。（`SKIPPED`／`ALERT` 樣式保留，V0.1 沒有事件會觸發。）
- **連線**：同一段內是側向連線，往下游是垂直曲線，回到上游的連線從右側繞回去。
- **底部 7 格面板**：EVENT LOG 與 STATUS 只反映真實事件；SIGNALS、DECISIONS、HEAT MAP、REACH 是標示 `MOCK` 的展示數據，不讀也不寫流程狀態。ROSTER 是 Config 靜態文字。
- **驗證**：Config 寫錯時（例如 stage 名稱打錯、連線指向不存在的節點、每段超過 6 個節點），畫面直接列出錯誤，不會畫出半套。

## Event Engine V0.1

**沒有 Event，流程不前進。** 唯一入口：

```js
WarRoom.emit({type: "RUNNING", node: "make", note: "選填"})   // node 選填，省略時用 Config 的 eventMap
// 回傳 {ok: true, phase, node, edges} 或 {ok: false, reason, phase}
WarRoom.getState()   // {phase, cursor, startedAt, endedAt, nodes: {id: state}, log: [...]}
```

| 事件 | 只在這些階段接受 | 之後階段 | 目標節點 |
|---|---|---|---|
| TASK_CREATED | IDLE / COMPLETE / FAILED | CREATED | INPUT（重置全部節點） |
| SIGNAL_FOUND | CREATED | SIGNAL | DISCOVER |
| JUDGED | SIGNAL | JUDGED | JUDGE |
| ROUTED | JUDGED | ROUTED | ROUTE |
| RUNNING | ROUTED / RUNNING | RUNNING | RUN |
| WAITING_APPROVAL | RUNNING | WAITING | 核可節點（eventMap 指定，可在任一段） |
| APPROVED | WAITING | APPROVED | 正在等待的節點 |
| VERIFIED | APPROVED | VERIFIED | VERIFY |
| SAVED | VERIFIED | COMPLETE | SAVE |
| FAILED | CREATED～VERIFIED | FAILED | 目前節點，或事件指定的節點 |

每次接受事件：沿 Config 連線找出從目前節點到目標節點的路徑 → 只在這條路徑跑一次光流 → 途經節點標 DONE、目標節點標 ACTIVE／WAITING／FAILED → 寫入 EVENT LOG → 更新右上 STATUS、進度條與底部 STATUS 計數。
不符合順序的事件會被拒絕，狀態不變，EVENT LOG 留一筆 ✕ 紀錄。

`index.html` 的 **TEST CONSOLE** 可以人工逐一送出這 10 種事件。

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
| `edges` | `[from, to]`；事件光流沿這些連線找路徑 |
| `eventMap` | 哪個節點接哪種事件，例如 `{RUNNING: "make", WAITING_APPROVAL: "h4"}`。省略的事件預設用該段第一個節點。APPROVED／FAILED 不需設定 |
| `panels` | 各面板標題與文字：`log`、`signals.labels`（最多 7 個）、`decisions.caption/a/b`、`heat`、`reach.caption/loops/foot`、`roster.items`（最多 4 個 `[名稱, 說明]`）、`status` |
| `footer` | `[左, 右]` 頁尾文字 |

舊欄位 `route`、`events` 已移除，寫了會裝填失敗（流程只能由 Event 推進）。目前沒有接任何真實資料或外部系統。
