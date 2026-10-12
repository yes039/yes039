# MPT-001｜場景 B 最小實測方案（待 Shen 核准）

- 狀態：**提案。尚未安裝、尚未執行、尚未連線任何第三方服務。**
- 測試題目：「小店老闆如何用 AI 做短影音」，30 秒 9:16，**只做 1 支**
- 測試目的：判斷 MPT 有沒有值得加進現有影音 AI 員工的零件，**不是導入一套新系統**
- 受測版本：MoneyPrinterTurbo `main` @ `bd6939b`（鎖定，不跟著上游更新）

---

## 一、要驗證的問題（只驗這三件）

| # | 問題 | 對應零件 |
|---|---|---|
| Q1 | 只給英文關鍵字，Pexels 找到的直式畫面，能不能撐起一支「台灣小店」主題的解說片？ | 圖庫找片＋自動剪接（`material.py`、`combine_videos`） |
| Q2 | 片長能不能控制在 30 秒左右？ | 依稿子字數控制片長 |
| Q3 | 燒入字幕的版面、斷句、時間軸可不可用？ | 字幕產生與疊字（`subtitle.py`、`generate_video`） |

**刻意不驗的**：LLM 寫稿（由 C 寫，不呼叫外部 LLM）、Edge TTS（授權不明，排除）、AI 影片生成、AI 配樂、自動發布。

---

## 二、環境

| 項目 | 內容 |
|---|---|
| 機器 | 本 Claude Code 雲端容器（Linux、隔離、對話結束後回收） |
| 位置 | 只用暫存區的獨立資料夾 `mpt-test/`，**不放進 repo、不碰其他分支** |
| 不碰的東西 | UZI-01 各分支、M002、`武器配置表.md`、系統 Python（3.13）、系統套件 |
| 使用方式 | C 直接呼叫 MPT 的 `cli.py`。**不載入官方 Skill**（它規定安裝前不要徵求確認，與本令衝突，而且不支援 Linux） |
| 不啟動 | WebUI、API 伺服器、Docker |

---

## 三、安裝項目（全部裝在 `mpt-test/` 裡）

| # | 項目 | 來源 | 授權 | 估計大小 | 說明 |
|---|---|---|---|---|---|
| 1 | uv | PyPI | MIT／Apache-2.0 | 約 40 MB | 用 `pip install --target` 裝進測試資料夾，不裝進系統 |
| 2 | Python 3.11 | python-build-standalone（GitHub） | PSF | 約 100 MB | 由 uv 下載；`UV_PYTHON_INSTALL_DIR` 指向測試資料夾 |
| 3 | MPT 原始碼 | `git clone` 後 checkout `bd6939b` | MIT | 約 60 MB | 鎖定版本 |
| 4 | MPT 依賴套件 | PyPI，`uv sync --frozen`（依 `uv.lock`） | 各套件自有授權（MoviePy MIT、faster-whisper MIT 等） | 約 1–2 GB（估計） | `UV_CACHE_DIR` 也指向測試資料夾 |

**不另外安裝的**：ffmpeg（用容器現有的 6.1.1）、字型（用容器現有的文泉驛正黑，UZI-01 也是用它）。

**安裝後在測試副本裡做的防護**（只改 `mpt-test/` 裡的副本）：
1. 刪除 `resource/songs/`（29 首授權不明的配樂）→ 任何隨機選曲都會落空。
2. 刪除 `resource/fonts/` 裡的微軟雅黑與華文黑體 → 換成文泉驛正黑。
3. `config.toml` 只填 Pexels key；LLM、TTS、影片生成、Upload-Post 等欄位全部留空。萬一誤觸，會因為沒有 key 而失敗，不會產生費用。
4. 字幕模式維持 `edge`（只用時間戳，**不會**下載 Whisper 模型）。

---

## 四、網路連線

| 用途 | 主機 | 何時連 | 有沒有帳號或費用 |
|---|---|---|---|
| 安裝 uv 與 Python 套件 | `pypi.org`、`files.pythonhosted.org` | 安裝時 | 無 |
| 下載 Python 3.11、clone MPT | `github.com`、`objects.githubusercontent.com` | 安裝時 | 無 |
| 搜尋 Pexels 影片 | `api.pexels.com` | 出片時，預計 ≤ 10 次請求 | 免費 key |
| 下載 Pexels 影片 | 依 API 回傳的網址（通常是 `videos.pexels.com`） | 出片時，預計 ≤ 15 支 | 無 |

**不會連的**：Edge TTS（`speech.platform.bing.com`）、Hugging Face（Whisper 模型）、任何 LLM、影片生成、配樂供應商、`api.upload-post.com`、GitHub 版本檢查（只有 WebUI 會連，本次不啟動）。

若容器的網路政策擋住上述任一主機，我會**停下來回報被擋的主機名稱**，請 Shen 在環境設定的 Network access 加入，不會繞路。

---

## 五、第三方服務與授權

| 項目 | 本次做法 | 授權 |
|---|---|---|
| 畫面 | Pexels 圖庫影片 | Pexels License：免費、可商用、不強制標示出處；不得暗示畫面中的人或品牌背書。API 條款要求在可行處標示來源 → 測試片的貼文說明寫「影片素材：Pexels」 |
| 旁白 | **見第七節「待 Shen 選擇」** | — |
| 配樂 | **C 用 numpy 現寫一段原創配樂**（不取樣、不用內建曲），以 `--bgm-file` 餵給 MPT | 自製，沒有授權疑慮。這只是輸入檔，不會改動 UZI-01 的任何程式 |
| 字型 | 文泉驛正黑（容器內建） | GPL v2 加字型例外（UZI-01 也用它；條款未逐條查證，與 UZI-01 同等級） |
| 腳本 | C 撰寫，用 `--video-script` 直接餵入 | 自寫 |
| 關鍵字 | C 撰寫英文關鍵字，用 `--video-terms` 餵入 | 自寫 |
| 自動發布 | **不啟用** | — |

---

## 六、費用

| 項目 | 預估 | 說明 |
|---|---|---|
| 外部 API | **0 元** | 不呼叫 LLM、TTS、影片生成；Pexels 免費 |
| Pexels | 0 元 | 免費方案（請求額度以申請頁面為準，本次用量極小） |
| 運算 | 0 元另計 | 用現有雲端容器 |
| Claude 用量 | 依工作階段紀錄換算（UZI-01 單支片約 US$2.5–2.7 定價換算） | 驗收報告會記錄實際數字，並註明是定價換算還是實際帳單 |
| 付費開關 | MPT 的付費供應商都要加 `--confirm-*-charge` 才會扣款；**本次一律不加，也不填 key** | — |

---

## 七、待 Shen 決定的兩件事

### 決定 1：旁白（Edge TTS 已因授權不明排除）

| 選項 | 做法 | 優點 | 代價 |
|---|---|---|---|
| **A 無旁白（建議）** | `--voice-name none`，只有燒入字幕＋配樂 | 零人工、零額外下載；片長可以事先算準（MPT 依每秒約 4.2 個中文字估算） | 解說片沒有聲音，說服力較弱；字幕時間是估算，無法真正驗證 Q3 的對時能力 |
| B Shen 自錄旁白 | Shen 用手機錄約 30 秒，C 以 `--custom-audio-file` 餵入，字幕改用 Whisper 轉寫 | 聲音授權最乾淨；片長＝錄音長度；能驗證字幕對時 | 多 1 次人工；要另外下載 Whisper 模型約 1.6 GB（Hugging Face，MIT 授權）；網路清單多一個 `huggingface.co` |

Azure TTS 雖是正式授權的服務，但需要開 Azure 帳戶（綁信用卡），屬於「付費 API」範圍，本次不列入。

### 決定 2：Pexels API Key

**申請方式（由 Shen 本人申請，C 不會代為申請）：**

1. 到 `https://www.pexels.com/join` 免費註冊帳號。
2. 登入後到 `https://www.pexels.com/api/`，按「Get Started」或「Your API Key」。
3. 填寫用途說明，例如：「Internal test: generating one short explainer video for a small business」，同意條款後送出。通常立即核發。
4. **不要把 key 貼在對話裡。** 請到本雲端環境的設定（工作階段標題列的環境選單 → Edit），在 Network secrets（或環境變數）新增：
   - 名稱：`MPT_PEXELS_API_KEY`
   - 值：剛拿到的 key
5. 新開的工作階段才讀得到這個變數；C 只會把它寫進測試資料夾的 `config.toml`，不會印出來。

測試結束後，若不再使用，可以到 Pexels 帳號頁面刪除或重新產生 key，並從環境設定移除該變數。

---

## 八、執行步驟（核准後才做）

| # | 步驟 | 預估時間 | 停止條件 |
|---|---|---|---|
| 0 | 確認網路可達（只對清單內主機發出連線） | 1 分鐘 | 有主機被擋 → 停，回報主機名 |
| 1 | 安裝（第三節 1–4）＋防護（刪配樂、刪字型、清空 key） | 10–20 分鐘 | 安裝失敗，且無法在測試資料夾內解決 → 停 |
| 2 | C 寫稿：約 115–125 字，台灣口語；同時寫 5–8 組英文關鍵字 | 5 分鐘 | — |
| 3 | 片長試算：用 MPT 自己的估算函式算出秒數，必要時調整字數（選項 A） | 2 分鐘 | 調 2 次仍不在 28–32 秒 → 記錄為限制，**不硬湊** |
| 4 | C 產生原創配樂 wav | 2 分鐘 | — |
| 5 | 執行 `cli.py`：`--video-source pexels --video-aspect 9:16 --video-script … --video-terms … --voice-name none（或自錄檔）--bgm-file <自製> --font-name wqy-zenhei.ttc --video-concat-mode sequential --match-materials-to-script` | 5–15 分鐘（估計） | 出錯 → 依錯誤修 1 次；第 2 次仍失敗 → 停，記錄失敗原因 |
| 6 | 驗片：ffprobe 規格、響度、抽 10 格檢查、逐鏡記錄畫面內容 | 5 分鐘 | — |
| 7 | 交付：成片給 Shen 看；驗收報告 commit 到本分支 | 5 分鐘 | — |

全程只做 **1 支**。不做第二版、不做 A／B 比較。

---

## 九、回復方式

| 要回復的東西 | 怎麼做 |
|---|---|
| 安裝的所有東西 | 刪除 `mpt-test/` 整個資料夾（uv、Python、MPT、套件、快取都在裡面） |
| 容器本身 | 對話結束後自動回收，不會留到下一個工作階段 |
| repo | 只新增 1 份驗收報告（成片是否 commit，請 Shen 決定，見下方）；不改任何既有檔案。要撤回時 revert 該 commit |
| Pexels key | 到 Pexels 帳號頁面刪除或重新產生；從環境設定移除 `MPT_PEXELS_API_KEY` |
| 網路允許清單 | 若為此測試新增了主機，測試後可以從環境設定移除 |

成片檔（預估 10–30 MB）：(a) 只傳給 Shen、不進 repo，或 (b) commit 到本分支。**預設 (a)**。

---

## 十、驗收報告格式（測試完成後交付）

| 欄位 | 內容 |
|---|---|
| 實際成本 | 外部費用（預期 0）、Claude 用量（工作階段紀錄，註明是定價換算還是帳單）、下載流量 |
| 製作時間 | 安裝、寫稿、試算、出片、驗片，各段分開計時（`time` 實測或檔案時間，註明依據） |
| 人工介入 | 每一次 Shen 介入的時間點與內容；預期是核准、申請 key、看片，選項 B 再加錄音 |
| 成片品質 | 規格（ffprobe）、片長是否落在 28–32 秒、響度（LUFS）、字幕有無錯字或被切斷、**逐鏡記錄 Pexels 畫面與旁白的貼合度**、有無外國臉孔或不合台灣小店情境的畫面、Shen 主觀評分 |
| 失敗原因 | 每次失敗的階段、錯誤摘要、是否修復 |
| 零件判定 | Q1–Q3 各給「可收編／需改造／不收」，並說明要怎麼掛進現有架構（C 為大腦，零件只當工具） |

---

## 十一、需要 Shen 回覆

1. 核准本方案？（核准後 C 才開始第八節的步驟 0）
2. 旁白：**A 無旁白**，還是 **B 自錄**？
3. Pexels key：申請好、放進環境設定後通知 C。
4. 成片要不要 commit 進 repo？（預設不進）
