# 最後一輪紀錄：掌上戰情減法 → Mobile UI stable candidate

- 分支：`claude/seal-war-room-dashboard`（未 merge main）
- Commit：`92fb9f4` Mobile UI stable candidate: trim duplicate WAITING badges, hide DEV
- 手機頁：https://claude.ai/artifact/8Yc1DKkS6kWAQLpRnU4DQQ（網址加 `#dev` 才顯示演練控制）

---

## 一、指令（原文）

> C，已用實際 iPhone 查看。手機架構確認成立，不再調整完整兵陣比例。
>
> 正式確立兩種閱讀模式：
>
> 1｜掌上戰情＝快速決策層
> 目標是 10 秒掌握戰況。
>
> 2｜完整兵陣＝深度看局層
> 保持目前原始兵陣尺寸，手機用左右滑動查看，不再嘗試把整張圖縮進螢幕。
>
> 這輪只做最後資訊減法：
>
> 掌上戰情的 WAITING 太重複。保留「戰役總狀態 WAITING」與真正卡點「製片兵 WAITING」即可；「目前前線」「執行部隊」不要再重複顯示 WAITING badge，以文字層級呈現。
>
> DRILL SCRIPT / DEV 在正式手機檢視預設隱藏；開發模式才顯示。
>
> 「查看完整兵陣」維持展開／收起，完整兵陣保持可左右滑動。
>
> 不改引擎、不改 Config、不改 V3.1 邏輯、不再調兵陣 layout。
>
> 完成後做 iPhone 實機尺寸最後驗收即可。若通過，將 Mobile UI 標記為 stable candidate，停止 UI 迭代。

---

## 二、處理過程

1. **只修改 `war-room/mobile-spike.html`**
   - 「目前前線」：拿掉狀態 badge，改成小字「海豹小隊 M003 執行 · WAITING」。
   - 「執行部隊」：拿掉部隊狀態與主要兵兩個 badge，改成文字「承接 製片 · 小隊 WAITING」「目前主要兵：製片兵 WAITING」。
   - 交貨後：「✓ 已交貨」旁的紅色 RUNNING badge 改成文字「小隊收尾中（RUNNING），不影響戰役」。
   - DRILL SCRIPT／DEV：預設 `hidden`，網址為 `#dev` 時才顯示。
   - 修改後摘要卡只剩三種 badge：戰役總狀態、真正卡點、交貨後的下一棒。

2. **新增最後驗收腳本 `war-room/spike/mobile/final-check.js`**
   - iPhone 直式：390×844、deviceScaleFactor 3、isMobile、hasTouch、iPhone User-Agent。
   - 第一次跑 12/14：兩項文字比對失敗。檢查後確認畫面內容正確，是腳本用 `textContent`（去掉換行）比對造成；改用畫面實際顯示的 `innerText` 後 14/14。

3. **確認未改動範圍**
   - `git diff` 對 `core/`、`configs/`、`spike/v3/`、`drill-spike.html`：無變更。

4. **存檔與發布**
   - 截圖與說明存入 `war-room/docs/mobile-stable/`。
   - Commit `92fb9f4` 推上分支；手機頁 Artifact 更新為 Version 2。

---

## 三、修改前後對照

| 項目 | 之前 | 現在 |
|---|---|---|
| WAITING badge（海豹受阻時） | 5 個（戰役、卡點、前線、執行部隊、主要兵） | **2 個**（戰役總狀態、卡點製片兵） |
| 目前前線 | 製片＋WAITING badge | 文字：「製片 / 海豹小隊 M003 執行 · WAITING」 |
| 執行部隊 | 兩個 badge | 文字：「承接 製片 · 小隊 WAITING」「目前主要兵：製片兵 WAITING」 |
| 交貨後 | 「✓ 已交貨」旁紅色 RUNNING badge | 文字：「小隊收尾中（RUNNING），不影響戰役」；下一棒保留「審核 READY」badge |
| DRILL SCRIPT / DEV | 預設顯示 | 預設隱藏，`#dev` 才顯示 |
| 完整兵陣 | — | 維持展開／收起、原始比例、左右滑動 |

---

## 四、最後驗收結果（14/14 PASS）

```
PASS  DEV 預設隱藏
PASS  A badge 只剩必要的 — RUNNING
PASS  B badge 只剩必要的 — WAITING / WAITING
PASS  B 戰役總狀態與卡點各一個 WAITING
PASS  B 前線、執行部隊改以文字呈現狀態
PASS  B 頁面無左右捲動
PASS  展開完整兵陣，可左右滑動 — 收起完整兵陣 ▴
PASS  展開後頁面本身無左右捲動
PASS  收起完整兵陣
PASS  C badge 只剩必要的 — RUNNING
PASS  D badge 只剩必要的 — RUNNING / READY
PASS  D 交貨後：已交貨＋小隊收尾以文字呈現＋下一棒
PASS  #dev 才顯示 DEV
PASS  無頁面錯誤

14/14 PASS
```

摘要卡實際顯示內容（驗收時擷取）：

- **B 受阻**：
  `卡點 | 製片兵 | 海豹小隊 M003 | WAITING | 原因：素材不足，等補件`
  `目前前線 | 製片 | 海豹小隊 M003 執行 · WAITING`
  `執行部隊 | 海豹小隊 M003 | 承接 製片 · 小隊 WAITING | 目前主要兵：製片兵 WAITING | 交貨進度 | 5/8`
- **D 交貨後**：
  `目前前線 | 審核 | 司令部 · READY`
  `執行部隊 | 海豹小隊 M003 | 承接 製片 | ✓ 已交貨 → 製片 | 小隊收尾中（RUNNING），不影響戰役 | 交貨進度 | 8/8 ✓`
  `下一棒 | → 審核 READY | 製片 已交貨，戰役由此接手`

---

## 五、檔案

| 檔案 | 說明 |
|---|---|
| `war-room/mobile-spike.html` | 掌上戰情室（本輪唯一修改的頁面） |
| `war-room/spike/mobile/final-check.js` | iPhone 直式最後驗收腳本（新增） |
| `war-room/docs/mobile-stable/1-summary-blocked.png` | 截圖：海豹受阻時的掌上戰情 |
| `war-room/docs/mobile-stable/2-full-graph.png` | 截圖：展開完整兵陣（可左右滑動） |
| `war-room/docs/mobile-stable/3-summary-delivered.png` | 截圖：交貨後的掌上戰情 |
| `war-room/docs/mobile-stable/README.md` | Mobile UI stable candidate 說明 |

重跑驗收：

```bash
NODE_PATH=$(npm root -g) node war-room/spike/mobile/final-check.js <輸出資料夾>
```

---

## 六、結論

- Mobile UI 標記為 **stable candidate**，UI 迭代停止。
- 未改引擎、Config、V3.1 邏輯與兵陣 layout。
- 未 merge main，等待下一道指令。
