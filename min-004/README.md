# MIN-004｜百業 AI 行銷員工・G1 互動 Demo

令號：C-001-ORDER-MIN004-G1-001｜階段：G1 互動 Demo 與個人化體驗原型

**手機版 Demo：** https://claude.ai/artifact/FjDGJfSRk5ViTroqt7e9E2
（目前為私人連結，要給其他人測試請從頁面右上角 Share 開啟分享）

直接開某一店型：連結後面加 `#salon`、`#nail` 或 `#cafe`。

## 交付清單

| 交付項目 | 位置 |
|---|---|
| 可操作的手機版 Demo | 上方連結；原始碼在 [demo/](demo/) |
| 三種店型的個人化體驗 | [demo/js/industries/](demo/js/industries/)（美髮沙龍、美甲工作室、咖啡廳） |
| 九宮格功能與工作流 | [demo/js/core.js](demo/js/core.js) |
| 每種店型一個完整示範案例 | 頁面中段「完整示範案例」（7 步驟） |
| 套餐服務展示 | [demo/js/plans.js](demo/js/plans.js)、頁面底部「三種合作方式」 |
| 技術架構與未完成項目 | [docs/G1-交付報告.md](docs/G1-交付報告.md) |
| G2 真實 AI 與平台串接建議 | [docs/G1-交付報告.md](docs/G1-交付報告.md) 第 5 節 |
| MIN-003 V1.2 整合方案（提案，未修改 V1.2） | [docs/G1-交付報告.md](docs/G1-交付報告.md) 第 6 節 |
| 測試報告及驗收清單 | [docs/G1-測試報告與驗收清單.md](docs/G1-測試報告與驗收清單.md) |

## 本機執行

不需要安裝套件。用任何靜態伺服器開 `demo/`：

```bash
cd min-004/demo && python3 -m http.server 8080
# 手機或瀏覽器開 http://localhost:8080/#salon
```

## 測試

```bash
node min-004/tests/e2e.js            # 需要 Playwright
node min-004/tests/e2e.js ./shots    # 同時輸出截圖
```

## 新增一個產業

1. 複製 `demo/js/industries/salon.js` 成新檔，改 `id`、`name`、示範店、痛點、目標，以及 9 個模組的內容。
2. 在 `demo/index.html` 底部加一行 `<script src="js/industries/新檔.js"></script>`。
3. 底座（九宮格、工作流、成果卡、轉換、事件）不用改。
