# 04｜情報整理成 Airtable 紀錄

結論：**可以。** Agent-Reach 上游工具的輸出（Jina 的 Markdown、yt-dlp 的 JSON、git 中繼資料）都能穩定對應到 Airtable 欄位。本次用實際讀到的 GitHub 資料產出 2 筆紀錄。
限制：測試環境連不到 `api.airtable.com`，而且依原則**沒有建立或使用 Airtable Token**，所以「寫入 Airtable」這一步**還沒實際執行**，目前只產出「可以直接匯入／直接 POST」的檔案。

## 1. 表結構：`情報`

| 欄位 | Airtable 類型 | 由誰填 | 說明 |
|---|---|---|---|
| 標題 | Single line text（主欄位） | 採集腳本 | |
| 來源平台 | Single select | 採集腳本 | 網站／YouTube／GitHub／FB／IG／其他 |
| 來源網址 | URL | 採集腳本 | |
| 作者或頻道 | Single line text | 採集腳本 | |
| 發布時間 | Date（含時間） | 採集腳本 | |
| 採集時間 | Date（含時間） | 採集腳本 | UTC |
| 原文節錄 | Long text | 採集腳本 | 最多 2,000 字；全文另存檔案 |
| 摘要 | Long text | AI 情報官 | 留空，交給 Claude 寫 |
| 標籤 | Multiple select | 腳本／AI | YouTube 會帶入影片標籤 |
| 採集工具 | Single line text | 採集腳本 | 例如 `Agent-Reach/yt-dlp 2026.07.04`，方便追溯來源 |
| 狀態 | Single select | 人工 | 待審 → 已審 → 已採用／捨棄 |
| 去重鍵 | Single line text | 採集腳本 | 網址正規化後的 SHA-256 前 16 碼，避免重複寫入 |

## 2. 轉換工具

[`scripts/to_airtable.py`](scripts/to_airtable.py)：純本機轉換，不連網、不需要 Token，同時輸出兩種格式：

- `airtable_import.csv`：在 Airtable 介面「Import → CSV」直接匯入，**完全不需要 API 金鑰**（MVP 推薦）。
- `airtable_batch_N.json`：符合 Airtable REST API `POST /v0/{baseId}/{table}` 的請求本文（每批 10 筆、`typecast: true`）。

```bash
python3 scripts/to_airtable.py web     page.md                         -o out
python3 scripts/to_airtable.py youtube video.json                      -o out
python3 scripts/to_airtable.py github  ./repo --url https://github.com/o/r -o out
```

測試：[`scripts/test_to_airtable.py`](scripts/test_to_airtable.py) 4/4 通過（web、YouTube 用的是**格式樣本**，只驗證欄位對應是否正確，不算實測）。

## 3. 實測產出（GitHub，真實資料）

[evidence/airtable_batch_github_實測.json](evidence/airtable_batch_github_實測.json)（原文節錄已縮短）：

| 標題 | 來源平台 | 作者 | 發布時間 | 狀態 |
|---|---|---|---|---|
| yt-dlp/yt-dlp（最新提交 43a45ae：[docs] Add changelog entries…） | GitHub | bashonly | 2026-10-21T22:17:41Z | 待審 |
| Panniantong/Agent-Reach（最新提交 94f06c1：Merge pull request #787…） | GitHub | Pnant | 2026-10-08T01:17:26+08:00 | 待審 |

## 4. 之後接上 API 寫入時（需要另外核准）

1. 建一個**專用的 Personal Access Token**：權限只開 `data.records:write`（＋需要讀時開 `data.records:read`），範圍**只限情報 base**。
2. Token 放在環境變數 `AIRTABLE_TOKEN`，不寫進 repo。
3. 寫入：`curl -X POST https://api.airtable.com/v0/$BASE/情報 -H "Authorization: Bearer $AIRTABLE_TOKEN" -H "Content-Type: application/json" --data @airtable_batch_1.json`
4. 注意限制：每個 base 每秒最多 5 個請求；免費方案的紀錄數與每月 API 呼叫數都有上限（以 Airtable 官方定價頁為準），量大要升級方案或改成每天批次匯入。
