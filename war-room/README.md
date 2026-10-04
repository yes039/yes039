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
- **4 種節點狀態**：`SKIPPED`（虛線、變暗、連線停流）、`WAITING`（黃框、連線變慢）、`ALERT`（閃爍）、`FAILED`（紅框、刪除線、連線停流）。
- **連線**：同一段內是側向連線，往下游是垂直曲線，回到上游的連線從右側繞回去。
- **底部 7 格面板**：EVENT LOG、SIGNALS、DECISIONS、HEAT MAP、REACH、ROSTER、STATUS。STATUS 由母體自動統計各狀態節點數。
- **驗證**：Config 寫錯時（例如 stage 名稱打錯、連線指向不存在的節點、每段超過 6 個節點），畫面直接列出錯誤，不會畫出半套。

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
| `nodes` | `{id, stage, title, tag?, sub?, state?}`；`stage` 必須是 7 段之一，`state` 必須是 4 種狀態之一 |
| `edges` | `[from, to]` |
| `route` | 依序亮起的節點（可省略；預設依 7 段順序，跳過 SKIPPED／FAILED） |
| `events` | EVENT LOG 輪播文字（可省略；預設由節點名稱產生） |
| `panels` | 各面板標題與文字：`log`、`signals.labels`（最多 7 個）、`decisions.caption/a/b`、`heat`、`reach.caption/loops/foot`、`roster.items`（最多 4 個 `[名稱, 說明]`）、`status` |
| `footer` | `[左, 右]` 頁尾文字 |

目前面板上的數字是動畫用的隨機值，尚未接真實資料。
