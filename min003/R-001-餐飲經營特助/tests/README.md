# R-001 自動測試

需要 Node.js 與 Playwright（Chromium）。

```bash
cd min003/R-001-餐飲經營特助
./build.sh                         # 由 app.html 產生 index.html
node tests/run-tests.js 測試截圖    # 43 項；第二個參數可省略（不輸出截圖）
```

輸出 JSON：`pass === total` 時結束碼為 0。測試涵蓋 T01–T08 與回歸，對象是 `../index.html`（模擬資料，不連網）。

V1.2 既有測試在 `min003/tests/`，請另外執行確認沒有回歸。
