# Pixabay × MPT-001｜最小整合可行性審查

- 性質：技術審查＋整合方案。**沒有修改 MPT、沒有申請 Key、沒有連線 Pixabay、沒有安裝新東西。**
- 受測版本：MoneyPrinterTurbo `bd6939b`（與先前相同的隔離測試環境）
- 審查日期：2026-10-12

> **結論：不需要寫適配層。MPT 已經內建 Pixabay 影片搜尋，搜尋、24 小時快取、下載到本地、來源與作者紀錄都有，第一次實測可以「零程式修改」。**
> 真正的卡點只有兩個，都要 Shen 處理：① 申請 Pixabay Key ② 雲端網路開放 `pixabay.com`、`cdn.pixabay.com`（目前都被擋）。
> 最大的技術風險是**直式素材可能不夠**（MPT 對 9:16 只收直式、寬度 ≥ 1080 的影片）。只有在實測真的不夠時，才提一個約 15 行的修改給 Shen 核准。

---

## 一、MPT 現有程式：Pixabay 已經內建

| 功能 | 位置 | 狀態 |
|---|---|---|
| 搜尋 `search_videos_pixabay()` | `app/services/material.py:445-583` | ✅ 已有 |
| CLI 開關 `--video-source pixabay` | `cli.py`、`docs/skill/mpt_agent.py:32` | ✅ 已有 |
| 設定欄位 `pixabay_api_keys = []` | `config.example.toml:88` | ✅ 已有 |
| 24 小時搜尋快取 | `material_cache.py:24`（`MATERIAL_SEARCH_CACHE_TTL_SECONDS = 24*60*60`）；`material.py:1826` 三個圖庫共用 | ✅ 已有 |
| 空結果不快取（避免把暫時故障存一天） | `material.py:1836-1838` 註解 | ✅ 已有 |
| 下載到本地、不直接外連（不 hotlink） | `material.py:1142 save_video()` | ✅ 已有 |
| 只下載夠用的量（湊滿片長就停） | `material.py:2111 _select_materials_until_duration()` | ✅ 已有 |
| 下載並行數 | 預設 1（`material.py:44`），上限 8 | ✅ 保守 |
| 來源紀錄：素材頁網址、作者名稱與 ID、素材 ID、使用的畫質 | `material.py:554-572`，寫入任務檔 `material_sources`（`material.py:155`） | ✅ 可直接產生署名清單 |
| 錯誤處理：429 限流、Cloudflare 驗證頁、非 JSON 回應、Key 不寫進日誌 | `material.py:473-508、239` | ✅ 已有 |

**離線單元測試**（本次在測試環境實跑，沒有連網）：
- Pixabay 相關 8 項：全部通過（另有 1 個測試檔需要 pytest，沒裝，所以沒跑）
- `test_material` ＋ `test_material_cache` 共 **91 項：全部通過**

---

## 二、Pexels 與 Pixabay 比較（MPT 實作層面）

| 項目 | Pexels（`material.py:339`） | Pixabay（`material.py:445`） |
|---|---|---|
| 端點 | `api.pexels.com/v1/videos/search` | `pixabay.com/api/videos/` |
| Key 放哪裡 | HTTP 標頭 `Authorization` | 網址參數 `key=`（MPT 已處理日誌遮罩） |
| 每次筆數 | 20 | 50 |
| 方向參數 | 有 `orientation=portrait` | **MPT 沒有送方向參數**，回來後才自己過濾（Pixabay 影片 API 有沒有方向參數，因官方文件頁被網路擋住**未能確認**） |
| 其他參數 | — | `video_type=all`。**沒有送 `safesearch`** |
| 回傳格式 | `videos[].video_files[]`（陣列，各畫質有 `link`／`width`／`height`） | `hits[].videos{large, medium, small, tiny}`（物件，各有 `url`／`width`／`height`／`size`） |
| 選畫質邏輯 | 挑「夠填滿畫面的**最小**檔」 | 依 large → medium → small → tiny 順序，挑**第一個**符合的（通常是最大檔） |
| 9:16 的收件條件 | 直式，且寬 ≥ 1080、高 ≥ 1920 | 直式，且寬 ≥ 1080（`material.py:546-549`） |
| 下載網域 | `videos.pexels.com` | `cdn.pixabay.com`（依回傳網址，實測確認） |
| 預設額度 | 每小時 200 次、每月 20,000 次 | 每 60 秒 100 次（第三方整理，官方頁未能直接讀取） |
| 新 Key | **官方暫停核發**（Shen 已確認） | 依第三方資料：登入後在 API 文件頁直接顯示，不需審核。**是否仍開放，需 Shen 登入確認** |
| 雲端網路 | `api.pexels.com`、`videos.pexels.com` 被擋 | **`pixabay.com`、`cdn.pixabay.com` 也被擋（403，已實測）** |

### 畫質

- Pixabay 影片分 large／medium／small／tiny 四級。各級的實際解析度，第三方資料說法不一致（有說 large 為 1920×1080，也有提到 4K），官方頁面無法讀取，**列為實測項目**。
- MPT 對 9:16 只收「直式且寬 ≥ 1080」，等於最少 1080×1920。這保證了畫質，但會讓可用素材變少（見第五節風險 1）。

---

## 三、Pixabay 規範與 MPT 的對照

| 規範 | 依據 | MPT 是否符合 | 本次做法 |
|---|---|---|---|
| 搜尋結果**快取 24 小時** | Pixabay API 文件（第三方引述：「requests must be cached for 24 hours」） | ✅ 內建 24 小時快取 | 不改 |
| **禁止系統性大量下載**；API 用於真人觸發的請求 | 同上（「Systematic mass downloads are not allowed」） | ✅ 只下載湊滿片長所需（約 8–12 支），並行數 1 | 只做 1 支片，預計搜尋 ≤ 6 次 |
| **不得 hotlink**，要先下載到自己的伺服器 | Pixabay API 文件（第三方引述，主要講圖片） | ✅ 一律下載到本地再合成 | 不改 |
| **顯示來源**：顯示搜尋結果時要讓使用者知道內容來自 Pixabay | Pixabay API 文件 | ✅ 我們不對外顯示搜尋結果；MPT 有紀錄每段素材的頁面與作者 | 交片時附「素材來源清單」，貼文說明寫「影片素材：Pixabay」 |
| 額度：每 60 秒 100 次 | Pixabay API 文件（第三方引述） | ✅ 用量遠低於上限；429 有處理 | — |

### 素材授權（Pixabay Content License 摘要）

| 允許 | 不允許 |
|---|---|
| 免費使用、可商用、可修改；**不強制**標示出處 | ① 原封不動販售或散布（沒有加入創作就單獨賣素材） ② 含可辨識商標、標誌、品牌的素材，不得用於相關商品或服務的商業用途 ③ 不得當作商標、商號、品牌名稱使用 ④ 欺騙或誤導用途 ⑤ 含可辨識人物時，不得用於不道德、違法或冒犯的用途 |

- 摘要本身聲明「不具法律效力，以完整 Content License 為準」。另外部分素材可能另有肖像、隱私、財產等權利。
- 對本片的意思：MPT 合成時有加字幕與配樂，不是原樣轉售；字幕是一般教學，不把畫面中的人說成店家或客人。**避開畫面中有明顯品牌商標的片段**，交片時逐段標記。
- 第一～三節的條款內容取自搜尋結果裡的 Pixabay 官方頁面摘要與第三方引述，因為 `pixabay.com` 在本環境被擋，無法直接讀原文。**Shen 申請 Key 時請以官方頁面原文為準。**

---

## 四、最小修改範圍

### 方案 0：零程式修改（建議先走這條）

MPT 不動。只改**測試腳本**（`run_mpt001.sh`、`run_args.txt`，屬於本次測試工具，不是 MPT）的三處：

| 檔案 | 改什麼 |
|---|---|
| `run_args.txt` | `--video-source pexels` → `pixabay` |
| `run_mpt001.sh` 預檢 | 改打 `pixabay.com/api/videos/?key=…&q=cafe&per_page=3`，確認 HTTP 200 才繼續 |
| `run_mpt001.sh` 設定 | 從環境變數 `MPT_PIXABAY_API_KEY` 寫入 `pixabay_api_keys`（不印出） |

### 方案 1：只在實測證明「直式素材不夠」時才提（需 Shen 另行核准）

| 修改 | 位置 | 規模 | 目的 |
|---|---|---|---|
| 9:16 時，也接受**高度 ≥ 1920 的橫式**影片（例如 4K 3840×2160），由合成階段中央裁成直式（裁完約 1215×2160，仍高於 1080×1920） | `search_videos_pixabay()` 收件條件，以及快取過濾 `_filter_materials_by_aspect()` 對 Pixabay 的判斷 | 約 10–15 行＋2 個單元測試 | 增加可用素材，又不降畫質 |
| 搜尋加上 `safesearch=true` | `search_videos_pixabay()` 參數 | 1 行＋1 個測試 | 商用片避開不當內容（本次關鍵字都很一般，屬於加分項） |

**不做的**：不加新的素材供應商、不改合成流程、不改快取機制、不碰 UZI-01。

---

## 五、風險

| # | 風險 | 可能性 | 影響 | 對策 |
|---|---|---|---|---|
| 1 | **直式且 ≥ 1080 寬的素材太少**：Pixabay 以橫式為主，MPT 又不送方向參數 | 中～高 | 某些關鍵字 0 筆，素材不夠會重播或失敗 | 先換通用關鍵字（例：`phone`、`cooking`、`shop`）。仍不足就記錄為限制，再提方案 1 |
| 2 | **雲端 IP 被 Cloudflare 擋**：MPT 程式裡特別處理了「Pixabay 搜尋被 Cloudflare 驗證頁擋下」（`material.py:478-483`），表示伺服器環境曾發生 | 中 | 搜尋拿不到結果 | 預檢就會發現。發生就停，記錄原因，不繞路 |
| 3 | Pixabay **新 Key 是否仍開放**未經官方確認 | 低～中 | 跟 Pexels 一樣卡住 | Shen 登入 pixabay.com/api/docs 確認 |
| 4 | **網路**：`pixabay.com`、`cdn.pixabay.com` 目前被擋 | 確定 | 無法執行 | Shen 在環境設定開放；開新工作階段才生效 |
| 5 | 下載的是最大畫質檔，可能每支數十 MB | 中 | 下載較慢、佔磁碟 | 只約 10 支，可接受；實測記錄總流量 |
| 6 | 畫面是外國或通用場景 | 高 | 「台灣小店」感不足 | 交片時逐段評估，列入品質判定 |
| 7 | 條款原文未能直接讀取 | — | 細節可能與摘要不同 | Shen 申請時看原文 |

---

## 六、測試步驟（核准後才做）

| 步驟 | 內容 | 需要 Key | 驗收對象 |
|---|---|---|---|
| T0 | 離線單元測試 | 否 | **已完成**：Pixabay 8 項、material 91 項全部通過 |
| T1 | 預檢：用 Key 打 1 次搜尋，確認 HTTP 200、不是 Cloudflare 驗證頁 | 是 | 網路／Key |
| T2 | `--stop-at materials`：只搜尋並下載素材，不合成。記錄每個關鍵字的命中數、通過直式過濾的數量、下載檔的解析度與大小、來源紀錄 | 是 | **B 自動素材搜尋** |
| T3 | 若 T2 素材足夠：跑完整出片（沿用稿子、字幕、原創配樂，並修正先前發現的折行與響度問題） | 是 | **A 主題成片流程** |
| T4 | 驗片：ffprobe、響度、抽格總表、逐段素材來源與授權檢查 | 否 | 品質與授權 |

A、B 分開判定：T2 失敗就只記 B 失敗，不用其他素材硬湊；T3 才判 A。

---

## 七、預估工時

| 項目 | 誰 | 時間 |
|---|---|---|
| 確認 Key 並放入環境設定、開放兩個網域 | Shen | 10–15 分鐘 |
| 修改測試腳本（方案 0） | C | 約 10 分鐘 |
| 新工作階段：安裝（冷快取實測 7 分 21 秒）＋ T1、T2 | C | 約 15 分鐘 |
| T3 出片＋T4 驗片 | C | 約 10–15 分鐘 |
| 驗收報告 | C | 約 15 分鐘 |
| **方案 0 合計** | | **Shen 約 15 分鐘；C 約 1 小時** |
| 方案 1（只有需要時） | C | 再加 1–2 小時（含單元測試，須另行核准） |

---

## 八、需要 Shen 做的事

1. 登入 `https://pixabay.com/api/docs/`，確認頁面有顯示你的 API Key（沒有顯示或寫暫停，就告訴 C，本案改走本地素材）。
2. 在雲端環境設定（工作階段標題列的環境選單 → Edit）：
   - Network secret（或環境變數）新增 `MPT_PIXABAY_API_KEY`。**不要貼在對話裡。**
   - Network access 的 Allowed domains 加入 `pixabay.com`、`cdn.pixabay.com`（保留勾選 Allow package managers）。
   - 之前為 Pexels 加的 `MPT_PEXELS_API_KEY` 或 Pexels 網域如果有加，可以移除。
3. 核准「方案 0」，然後開新工作階段，請 C 執行 T1～T4。
