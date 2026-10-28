# 原型自動測試

需要 Node.js 與 Playwright（Chromium）。

```bash
node permission-matrix.test.js   # 三種角色權限、參數設定，共 34 項
node mobile.test.js              # 11 個畫面在 390×844 手機寬度的操作與版面
```

輸出為 JSON；`R[].pass`、`out[].ok` 全為 true 且 `errs` 為空即通過。測試對象是 `../prototype/MIN003獲客戰情室.html`（模擬資料）。
