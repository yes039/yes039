# CAD-001｜Claude Code × AutoCAD 技術驗證

> 狀態：**離線驗證完成；AutoCAD 實機測試尚未執行。**
> 本資料夾的成果都是在 Linux 雲端容器內產生的，這台機器上沒有 Windows，也沒有 AutoCAD。
> DWG、AutoCAD 輸出的 PDF 和 AutoCAD 截圖，必須依照下面的步驟在實機上產生。

| 檔案 | 用途 |
|---|---|
| [`lsp/CAD001_ROOM.lsp`](lsp/CAD001_ROOM.lsp) | **主交付物**。指令 `CAD001_ROOM`／`CAD001_CHECK`／`CAD001_ENV` |
| [`docs/CAD001_技術驗證報告_V1.0.md`](docs/CAD001_技術驗證報告_V1.0.md) | 驗證報告與下一階段建議 |
| [`docs/CAD001_實機測試紀錄表.md`](docs/CAD001_實機測試紀錄表.md) | 實機測試時逐項填寫的紀錄表 |
| [`tools/CAD001_recon.ps1`](tools/CAD001_recon.ps1) | 第一階段 Windows 環境偵查（唯讀） |
| [`tools/alisp_sim.py`](tools/alisp_sim.py) | AutoLISP 子集直譯器＋AutoCAD ActiveX 模擬，用來離線執行 LSP |
| [`tools/verify_and_render.py`](tools/verify_and_render.py) | 13 項幾何檢查，並用 ezdxf 產生參考 DXF／PNG |
| [`tools/run_all_tests.sh`](tools/run_all_tests.sh) | 一鍵執行全部離線測試（含 5 項突變測試） |
| `evidence/` | 離線測試證據（console log、JSON、參考圖） |

## 實機操作步驟（Windows＋AutoCAD 完整版）

**前置**：使用測試用的新空白 DWG，**不要開啟任何正式工程圖**。

1. **環境偵查**：在 PowerShell 執行
   `powershell -ExecutionPolicy Bypass -File .\CAD001_recon.ps1`，
   保存產生的 `CAD001_recon_result.txt`。
   這個腳本只讀取資訊，唯一的寫入是在「文件」資料夾建立 `CAD001_TEST` 測試資料夾。
2. 把 `CAD001_ROOM.lsp` 複製到 `文件\CAD001_TEST\`。
3. 開啟 AutoCAD，執行 `NEW` 並選 `acadiso.dwt`（公制樣板）。用 `INSUNITS` 確認值為 `4`（mm）。
4. 輸入 `APPLOAD`，選取 `CAD001_ROOM.lsp`，按「載入」。
   - 如果跳出「安全性 – 未簽署的執行檔」警告，請選 **「載入一次」**。
     **不要**把資料夾加入 TRUSTEDPATHS，也不要修改 SECURELOAD，這兩項屬於全域安全設定。
   - 預期指令列會出現：`[CAD001] CAD001_ROOM.lsp v1.0 loaded. Commands: CAD001_ROOM, CAD001_CHECK, CAD001_ENV`
5. 輸入 `CAD001_ENV`，把整段輸出複製到紀錄表（記錄版本、LISPSYS、SECURELOAD）。
6. 輸入 `CAD001_ROOM`。出現基準點提示時直接按 Enter，基準點即為 0,0。
   預期最後一行：`done: 26 objects added ...`
7. 輸入 `ZOOM` → `E`，截圖。
8. 輸入 `CAD001_CHECK`，預期結果：
   ```
   A-WALL / AcDbPolyline : 2
   A-DOOR / AcDbPolyline : 1
   A-DOOR / AcDbArc : 1
   A-DOOR / AcDbText : 1
   A-GLAZ / AcDbLine : 4
   A-GLAZ / AcDbText : 1
   A-ANNO-DIMS / AcDbRotatedDimension : 16
   values: 300 900 2800 4000 2250 1500 2250 6000 150 4000 150 4300 150 6000 150 6300
   ```
   按 F2 開啟文字視窗，截圖。
9. 抽查：`LIST` 一條牆、`DIST` 量門洞（應為 900）、`LAYER` 檢查四個圖層，各截一張圖。
10. 輸出檔案：
    - `SAVEAS` → `CAD001_ROOM_test.dwg`
    - `PLOT` → 印表機選「DWG To PDF.pc3」，紙張 A3，範圍選「實際範圍」，比例 1:50（或「佈滿圖紙」），存成 `CAD001_ROOM_test.pdf`
11. 安全性抽查：先畫一條線，再執行 `CAD001_ROOM` 並指定 `10000,0` 為基準點。執行後確認原本那條線沒有任何改變；再按一次 `U`，確認新產生的 26 個物件全部消失。

把 DWG、PDF、截圖和填好的紀錄表放回 `evidence/real-autocad/`，就完成第三階段的實機驗收。

## 離線測試（Linux／macOS／Windows 都能執行）

```bash
pip install ezdxf matplotlib
bash tools/run_all_tests.sh
```
