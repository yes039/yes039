# Mobile UI — stable candidate

兩種閱讀模式：

1. **掌上戰情（快速決策層）**：`mobile-spike.html` 首頁摘要卡，10 秒掌握戰況。
   只有三種 badge：戰役總狀態、真正卡點、交貨後的下一棒；前線與執行部隊的狀態以文字呈現。
2. **完整兵陣（深度看局層）**：「查看完整兵陣」展開／收起；維持原始兵陣尺寸，手機左右滑動查看。

- DRILL SCRIPT／DEV 預設隱藏，網址加 `#dev` 才顯示。
- 配色：`spike/mobile/tone-bright.css`（深暖灰底，頁面 < 作戰區 < 節點／面板）。
- 驗收：`NODE_PATH=$(npm root -g) node war-room/spike/mobile/final-check.js <輸出資料夾>`（iPhone 390×844 @3x，14 項）。
- 未改引擎、Config、V3.1 邏輯與兵陣 layout。
