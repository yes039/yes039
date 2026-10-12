# MPT-001 場景 B 實測：執行紀錄

- 依據：Shen 有條件核准（旁白選 A 無旁白；成片不進 repo；取得 Key 前不執行需要金鑰的步驟）
- 受測版本：MoneyPrinterTurbo `bd6939b`（鎖定）
- 目前狀態：**Pexels 官方暫停核發新的 API Key（Shen 2026-10-12 確認），改走本地合法素材，見 [本地素材可行性.md](本地素材可行性.md)。「自動素材搜尋」記為本次無法驗證。**
- 以下第一～四節是 Pexels 路線的原始紀錄，保留作為證據。

本資料夾只放**可重現的輸入與腳本**。成片、抽格圖、日誌一律不進 repo。

| 檔案 | 內容 |
|---|---|
| `script.txt` | C 撰寫的字幕稿（99 個中文字，MPT 估算 28.86 秒） |
| `run_args.txt` | 出片參數（英文搜尋關鍵字、9:16、無旁白、自製配樂、文泉驛字型） |
| `bgm.py` | 本次新寫的原創配樂產生器（numpy 合成，不取樣；跟 UZI-01 的程式無關） |
| `run_mpt001.sh` | 一鍵執行：Pexels 連線預檢 → 隔離安裝 → 防護 → 配樂 → 出片 → 驗片 |

---

## 一、Pexels 申請與授權條件（已確認）

| 項目 | 內容 | 來源 |
|---|---|---|
| 費用 | API 完全免費 | Pexels Help Center〈Is the Pexels API free to use〉 |
| 申請 | 登入 Pexels 帳號後在 API 頁面申請，**立即核發**，不需審核 | Pexels API 頁 |
| 免費額度 | 每把 Key 預設**每小時 200 次、每月 20,000 次**。本次預計 ≤ 10 次搜尋 | Pexels API 文件 |
| 額度回應標頭 | 成功回應帶 `X-Ratelimit-Remaining`，可記錄實際用量 | Pexels API 文件 |
| API 使用規範 | 呼叫 API 的地方要明顯連結 Pexels，可行時標示攝影者（建議寫法：「Video by ○○ on Pexels」）；不得規避額度限制，違者停權 | Pexels API 文件 |
| 素材商用 | 可免費商用、可修改，**不強制**標示出處 | Pexels License |
| 素材禁止事項 | ① 不得暗示畫面中的人物、品牌或機構為你或你的商品背書 ② 不得把可辨識的人物用在負面或冒犯的情境 ③ 不得原封不動販售素材，或拿去做成競爭性圖庫 ④ 有人物或商標的素材不得用於政治宣傳 ⑤ 畫面中的商標或品牌不得商用於商品 | Pexels License／Terms of Service／Help Center |

**對本次實測的影響**：
- 成片若用於宣傳，畫面中的人物不能被呈現成「我們的老闆或客人」。字幕寫的是一般性教學，不指涉畫面中的人，符合條件。
- 交片時附上每段素材的 Pexels 來源與作者（MPT 會記錄在任務檔），發布說明可寫「影片素材：Pexels」。
- 我沒辦法直接開啟 pexels.com 原文頁面（見下一節，網路被擋），以上內容取自搜尋結果中的 Pexels 官方頁面摘要。**Shen 申請時請以頁面上的條款原文為準。**

## 二、網路權限（已實測）

| 主機 | 結果 | 用途 |
|---|---|---|
| `pypi.org`、`files.pythonhosted.org` | ✅ 可連 | 安裝套件 |
| `github.com` | ✅ 可連 | 下載 MPT |
| **`api.pexels.com`** | ❌ **被環境網路政策擋下（403）** | 搜尋影片 |
| **`videos.pexels.com`** | ❌ **被擋（403）** | 下載影片（MPT 讀取 API 回傳的 `video_files[].link`，通常在這個網域） |
| `www.pexels.com` | ❌ 被擋（403） | 本次不需要 |

**需要 Shen 在環境設定開放兩個網域**：`api.pexels.com`、`videos.pexels.com`。
（工作階段標題列的環境選單 → Edit → Network access → Allowed domains，並保留勾選 Allow package managers。說明：https://code.claude.com/docs/en/cloud-environments#network-access）

## 三、已完成（不需金鑰）

| 步驟 | 結果 | 耗時 | 依據 |
|---|---|---|---|
| 隔離安裝（uv＋MPT `bd6939b`＋依賴） | ✅ 成功。用容器內建的 Python 3.11.17，沒有另外下載 Python；venv 1.1 GB | 冷快取 **7 分 21 秒**（預演實測）；第一次另有快取，約 22 秒 | `timings.txt`、`time` |
| 防護 | ✅ 刪除內建 29 首配樂與 3 套授權不明字型；設定檔所有付費 key 留空；`upload_post_enabled = false` | 數秒 | 檔案清單 |
| 原創配樂 | ✅ 34 秒，C 大調 112 BPM | 0.6 秒 | `time` |
| 寫稿與片長試算 | ✅ 調整 1 次：26.61 秒 → **28.86 秒**，落在 28–32 秒內 | 約 2 分鐘 | MPT `estimate_no_voice_duration` |
| 字幕預演（`--stop-at subtitle`） | ✅ 產生 14 句字幕，最後一句在 28.86 秒結束。沒有呼叫 LLM、TTS 或任何網路服務 | 2.2 秒 | `subtitle.srt`、日誌 |
| 一鍵腳本預演 | ✅ 從空資料夾跑到字幕階段，字幕與手動版完全一致 | 7 分 25 秒（主要是安裝） | `timings.txt` |
| 外部費用 | **0 元** | — | 沒有任何付費 key |
| 人工介入 | 0 次（Shen 的核准訊息不計） | — | — |

**已發現的品質風險**（出片時要確認）：第 6、8 句各 15–16 字，字級 64 時可能折成兩行。

## 四、接下來要做的（Shen）

1. 依第一節申請 Pexels Key（免費、立即核發）。
2. 在環境設定新增 Network secret（或環境變數）`MPT_PEXELS_API_KEY`。**不要貼在對話裡。**
3. 在同一個環境設定開放 `api.pexels.com`、`videos.pexels.com`。
4. **開一個新的工作階段**（新設定只有新工作階段讀得到），請 C 執行：

```bash
bash seal-team/武器評估/MPT-001-實測/run_mpt001.sh <工作階段暫存區>/mpt001
```

腳本會先用 Key 打一次 Pexels 預檢，不通就停下回報，不會硬做。成片會放在暫存區，交給 Shen 驗收，不會 commit 進 repo。

## 五、出片後的驗收報告會記錄

- 能否由 C 指揮完成主題成片、MP4 能否播放（ffprobe 規格、響度、抽格總表）
- 製作時間（`timings.txt` 各階段時間戳）
- 實際成本（外部費用、Pexels 實際請求次數、Claude 用量換算）
- 人工介入次數與時間
- 授權來源（每段 Pexels 素材的頁面與作者）
- 品質問題：畫面和字幕貼不貼、有無外國面孔或不像台灣小店的畫面、字幕有無折行或被切斷、是否達到商業宣傳品質
- 是否適合交給小店老闆自主操作
