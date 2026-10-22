# C-001｜Agent-Reach 技術實測報告

目標：驗證 [Agent-Reach](https://github.com/Panniantong/Agent-Reach) 能不能當 AI 情報官的資料採集工具。
版本：v1.5.0（commit `94f06c1`）｜日期：2026-10-22｜執行原則：先研究、再測試、後部署；**沒有使用正式帳號憑證，也沒有做系統安裝或授權。**

## 一句話結論

**有條件可行。** Agent-Reach 本體安全、可以拿來當「採集工具清單＋健檢」，但真正有用的只有幾條免登入的公開路徑（網站、YouTube、GitHub、RSS）。FB/IG 必須用瀏覽器登入態，條款和封號風險都高，**MVP 不採用**。建議用「Agent-Reach 選好的上游工具＋自己的轉換腳本＋Airtable CSV 匯入」先跑起來。

## 驗收對照

| # | 驗收重點 | 結果 | 文件 |
|---|---|---|---|
| 1 | GitHub 專案與安裝安全性審查 | ✅ 完成。程式碼沒有後門或回傳資料、預設唯讀；找到 8 項安裝風險（最重要的是 PyPI 同名套件、安裝版本跟著 main 跑、OpenCLI 會操控瀏覽器） | [01-安全審查.md](01-安全審查.md) |
| 2 | 公開網站、YouTube、GitHub 讀取實測 | ⚠️ **部分完成**。GitHub ✅（git／raw 免登入；`gh` 要登入）。網站、YouTube 被**測試環境的網路政策**擋下，未取得資料，已附重測腳本 | [02-讀取實測.md](02-讀取實測.md) |
| 3 | FB、IG 登入需求與權限限制 | ✅ 完成（只研究、沒登入）。必須用 Chrome 登入態、只能在桌機用、工具含發文按讚等寫入能力、違反 Meta 條款 | [03-FB-IG評估.md](03-FB-IG評估.md) |
| 4 | 情報能否整理成 Airtable 紀錄 | ✅ 格式可行，用真實 GitHub 資料產出 2 筆；⚠️ 還沒實際寫進 Airtable（沒建 Token，網路也不通） | [04-Airtable紀錄.md](04-Airtable紀錄.md) |
| 5 | 可行性、成本、風險、MVP 建議 | ✅ 見下方 | 本檔 |

## 可行性

| 來源 | 可行性 | 需要登入 | 備註 |
|---|---|---|---|
| 公開網站 | 高（待重測） | 否 | Jina Reader；內容會經過第三方 |
| YouTube | 中高（待重測） | 否 | yt-dlp；機房 IP 容易被要求機器人驗證，建議在本機或家用網路跑 |
| GitHub | 高（已實測） | 單一 repo 不用；搜尋要 Token | 用 git／raw 就夠 |
| RSS | 高 | 否 | doctor 顯示可用（feedparser） |
| Facebook／Instagram | **低** | **要** | 只能在桌機用、條款風險高；自己的帳號改走官方 Graph API |
| Airtable 整理 | 高 | Airtable Token（MVP 用 CSV 匯入就不需要） | 欄位對應已完成 |

## 成本（每月估算）

| 項目 | 費用 | 說明 |
|---|---|---|
| Agent-Reach、yt-dlp、gh、feedparser | 0 | 開源 |
| Jina Reader | 0（免費額度） | 量大要申請 key，依用量計費 |
| Airtable | 0（Free）～ Team 方案每人每月約 US$20 | Free 方案的紀錄數和 API 呼叫數有上限，以官方定價頁為準 |
| AI 摘要（Claude） | 依用量 | 一筆情報約幾千 token；每天 20 筆的成本很低 |
| 代理（選用） | 約 US$1 | 只有在網路被封鎖時才需要 |
| **人力** | **最大的成本** | 首次設定約半天；之後每週維護約 1 小時（上游工具常改版） |

## 風險（前五名）

1. **FB/IG 自動化**：違反條款、封號，而且工具能用你的身分發文按讚 → MVP 不碰。
2. **供應鏈**：`pip install agent-reach` 會裝到別人的同名套件；官方安裝跟著 main 分支跑 → 一律從 GitHub 安裝並鎖 commit。
3. **讓 Agent 讀遠端安裝文件自己裝** → 不採用，由人執行固定指令。
4. **資料外流到第三方**：網址和內容會經過 Jina → 只讀公開資訊。
5. **穩定度**：專案只有 8 個月、改得很快，上游各平台也常擋爬蟲 → 鎖版本、每週跑一次 `run_live_tests.sh` 當監控。

## MVP 建議（2 週）

**範圍**：只做 公開網站＋YouTube＋GitHub（＋RSS），手動觸發，紀錄先用 CSV 匯入 Airtable。

| 步驟 | 內容 | 產出 | 需要的核准 |
|---|---|---|---|
| 1 | 在允許 `r.jina.ai`、`youtube.com` 的機器（建議店家或負責人的電腦）跑 `scripts/run_live_tests.sh`，補完 T1／T2 | 三項實測全綠 | 無（不帶憑證） |
| 2 | 在 Airtable 建 `情報` 表（欄位見 04） | 空表 | 用負責人自己的 Airtable 帳號 |
| 3 | 每天：AI 情報官依任務挑 5～20 個網址 → 採集 → `to_airtable.py` → 匯入 CSV | 每天的情報列 | 無 |
| 4 | Claude 讀「待審」紀錄寫摘要，人工審核後改狀態 | 已審情報 | 無 |
| 5 | 2 週後檢討：量夠不夠、哪個來源常失敗、要不要改成 API 自動寫入 | 決策 | 核准後才建專用 Airtable Token |

**刻意不做**：FB/IG 自動化、OpenCLI、`--system` 安裝、排程背景爬取、任何正式帳號登入。

## 檔案

```
intel-officer/C-001-agent-reach/
├── README.md               # 本報告
├── 01-安全審查.md
├── 02-讀取實測.md
├── 03-FB-IG評估.md
├── 04-Airtable紀錄.md
├── scripts/
│   ├── run_live_tests.sh   # 三項讀取實測重跑（隔離、不帶憑證）
│   ├── to_airtable.py      # 上游工具輸出 → Airtable CSV / API 批次檔
│   └── test_to_airtable.py
└── evidence/               # 本次實測原始紀錄
```
