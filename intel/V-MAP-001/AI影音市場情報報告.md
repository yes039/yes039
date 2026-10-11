# V-MAP 001｜AI 影音製作市場情報報告

> 調查總管：C（Claude）　｜　調查日期：2026-10-11　｜　性質：市場情報，**未安裝、未部署、未開發、未改動既有系統**
> 用途：供 Shen 決定是否進入實測。本報告**不以宣傳資料判定實際品質**，凡涉及品質的結論一律標為「需實測」。

---

## 0. 先讀這裡：調查方法與可信度

### 0.1 查證標記

| 標記 | 意義 |
|---|---|
| ✅ 已核實 | 至少兩個獨立來源一致，或官方網域頁面（如 dreamina.capcut.com、workspace.google.com、helpx.adobe.com、huggingface.co 授權檔）直接出現在搜尋結果中 |
| 🟡 待查證 | 只有單一來源、來源互相矛盾，或來源是經銷商／競品部落格 |
| 🧪 需實測 | 只能靠實際生成判斷（畫質、中文口型、台灣腔、商品穩定度、失敗率） |

### 0.2 本次調查的限制（必須先講清楚）

1. **官網無法直接開啟**：本工作環境的網路政策擋下對 Google、HeyGen、Kling、Runway 等官網的直接連線（HTTP 403）。所有資料來自搜尋引擎索引的頁面，**多數價格是二手來源**。簽約或採購前，一律以官網結帳頁為準。
2. **價格波動大**：同一工具常見 2～3 種價格（首月優惠、年繳、App 內購、地區價差）。本報告列出區間並標示來源性質。
3. **匯率假設**：換算台幣時一律以 **1 USD ≈ NT$31** 估算（假設值，未查當日匯率）。
4. **品質判斷**：網路上的「最佳排行」多數由賣家或聚合平台撰寫，有利益關係。本報告只把它們當「值得測的理由」，**不當作品質結論**。

### 0.3 本季三則重大市場異動（影響選器）

| 異動 | 狀態 | 對我們的影響 |
|---|---|---|
| **OpenAI 宣布結束 Sora App**（2026-03-24 宣布） | ✅ 宣布屬實；App 停止日 4/26、API 停止日 9/24 僅單一來源 🟡 | **Sora 不列入候選**。新工作流程不應依賴它。 |
| **Google 推出 Gemini Omni Flash**（I/O 2026，5 月；6/30 開放 API） | ✅ | 支援對話式修改影片，已整合進 Google Vids、YouTube Shorts。Veo 3.1 仍保留在延長片長、首尾幀控制等用途。 |
| **Kling 4.0** 早鳥（Flash 版 9/28 起限 Ultra 年繳） | 🟡 完整版與 API「預計 10 月」，尚未確認上線 | 實測時以 Kling 3.0 為準，4.0 列入觀察。 |

---

## 一、AI 影音武器市場清單（共 22 款）

### 1A. 雲端生成模型（文生影片／圖生影片）

| # | 工具（最新版本） | 開發商 | 最擅長 | 價格（2026/10 搜尋所見） | 商用授權 | API | 查證 |
|---|---|---|---|---|---|---|---|
| 1 | **Google Veo 3.1**（Standard / Fast / Lite） | Google DeepMind | 電影感寫實鏡頭、原生 9:16 直式、Ingredients（多參考圖）、首尾幀、原生音效 | API 每秒：Standard US$0.40（720p/1080p）、0.60（4K）；Fast US$0.10～0.30；Lite US$0.05～0.08；無免費額度。消費端：Google AI Pro 約 US$19.99／月，含 1,000 Flow 點數 | 付費使用可商用；輸出內嵌 SynthID 浮水印 | ✅ Gemini API／Vertex AI | 價格 ✅（benchlm、wavespeed 一致；另有一個賣點數網站寫 US$0.75，判定為離群值）；台灣 Flow 可用性 🟡 |
| 2 | **Gemini Omni Flash**（stable 1.1） | Google DeepMind | 用對話方式改影片，跨回合保持角色與場景一致 | 消費端含在 Google AI Plus／Pro／Ultra；API 價格 🟡 | 同 Google 條款，帶 SynthID | ✅ 2026-06-30 開放 | 上線 ✅；規格（720p、4～10 秒）🟡 |
| 3 | **Kling 3.0／3.0 Omni**（4.0 Flash 早鳥） | 快手 | 人物動作、商品穩定度、多鏡頭（最多 6 鏡）、單段最長 15 秒、可編修既有影片 | 會員方案約 US$6.99～127.99／月（首訂價；另一來源列 US$10～180）；API 約 US$0.08～0.42／秒（依模式） | **免費版不可商用**，付費版（Standard 以上）可商用 | ✅（官方資源包；也可透過 fal 等平台使用） | 版本 ✅；價格 🟡（多個版本） |
| 4 | **Seedance 2.0／2.5**（Dreamina／即夢、CapCut、BytePlus） | 字節跳動 | 多參考素材（最多 9 圖＋3 影片＋3 音訊）、多鏡頭敘事、2.5 版單段 30 秒含音訊 | Dreamina 官方頁：2.5 版促銷 US$0.035／秒（首月）、年繳 Super 約 US$0.047／秒；Standard US$36／月、Advanced US$159／月 | 依 Dreamina／CapCut 條款 🟡 | BytePlus ModelArk（約 US$0.231／秒 @720p，🟡） | 價格 ✅（官方網域）；規格 🟡 |
| 5 | **Runway Gen-4.5**（含 Aleph 影片編修） | Runway | 廣告與行銷素材、影片轉影片編修、創作者生態 | Standard 約 US$12／月（年繳）、Pro US$35／月、Max US$95／月（Unlimited 方案已改為 Max） | 付費方案可商用、去浮水印；**非企業版預設會拿資料訓練模型** 🟡 | ✅ | 價格 ✅（兩個來源一致）；授權細節 🟡 |
| 6 | **Luma Ray3**（Dream Machine） | Luma AI | 寫實光影、HDR，平台內也能用第三方模型 | Plus US$30、Pro US$90、Ultra US$300／月；沒有長期免費方案 | **所有付費方案都可商用** | 有，但 Ray3 API 價格未公開 🟡 | 訂閱 ✅；API 🟡 |
| 7 | **Hailuo 2.3／MiniMax H3** | MiniMax | 低成本圖生影片、動作表現 | 依付費使用頁：2.3-Fast 768P 6 秒 US$0.19、10 秒 US$0.32；1080P 6 秒 US$0.33（2.3 已列為舊版 V1） | 🟡 | ✅ | 價格 🟡（非官方網站轉述） |
| 8 | **Vidu Q3**（Pro／Turbo） | 生數科技 | **動漫風格**、首尾幀轉場、原生音訊 | Krea API：540p US$0.0735／秒、720p 或 1080p US$0.1617／秒；Turbo 約便宜 50～60% | 🟡 | ✅（Krea、Civitai 等平台） | 🟡 |
| 9 | **PixVerse V6** | 愛詩科技 | 一鍵特效模板、動漫／3D 風格、單段 15 秒 1080p、原生音訊 | 消費端約 US$10／月起；官方 API 月費 US$100 起；第三方平台約 US$0.025／秒起 | 🟡 | ✅ | 功能 ✅；價格 🟡 |
| 10 | **Midjourney Video** | Midjourney | 藝術風格圖片轉動態（**只能圖生影片**） | 跟著 MJ 方案 US$10／30／60／120 每月，使用 GPU 時數；5 秒起，可延長到 21 秒 | 付費可商用（年營收超過 100 萬美元的公司需 Pro 以上，🟡） | ❌ 沒有公開 API | ✅ |

### 1B. 平台型／剪輯整合（多模型聚合＋剪輯）

| # | 工具 | 最擅長 | 價格 | 商用 | 查證 |
|---|---|---|---|---|---|
| 11 | **CapCut／剪映** | 剪輯中樞：自動字幕、模板、卡點；Pro 版內建 Seedance | 2026 年初改版：Standard 約 US$9.99、Pro 約 US$19.99／月（App 內購較貴）；Pro 含 550 AI 點數 | 標示 Pro 的素材，未訂閱會加浮水印；**音樂與模板的商用範圍沒有權威來源** 🟡 | 價格 🟡；商用條款 🟡（高風險項目） |
| 12 | **Adobe Firefly**（含合作模型） | 自家模型強調「商業安全」；平台內可用 Veo 3.1、Ray3、Gen-4.5、Kling 等合作模型 | Standard US$9.99／Pro 19.99／Pro Plus 49.99／Premium 199.99 每月 | **只有 Adobe 自家模型有商業安全定位；合作模型各自適用自己的條款** | 價格 ✅；合作模型清單 🟡 |
| 13 | **Canva**（Magic Studio，內建 Veo） | 店家自己就會用、模板多 | Pro 約 US$14.99／月 | 🟡 | 片長、點數上限 🟡（有來源說 Pro 每月共用 50 點、每段 4～8 秒） |
| 14 | **Higgsfield**（Marketing Studio） | 商品廣告：貼上商品網址即可生成廣告、1,500 個以上模板、UGC 風格 | 約 US$19～129／月（各來源不一） | 免費版不可商用，付費版可商用 | 🟡；第三方估計**平均要生成 3～5 次才有一段可用** |

### 1C. 數位人口播

| # | 工具 | 最擅長 | 價格 | API | 查證 |
|---|---|---|---|---|---|
| 15 | **HeyGen**（Avatar IV） | 一張照片就能做口播、聲音複製、175 種以上語言翻譯對嘴、有繁中介面 | Creator 約 US$29、Pro 約 US$99（另一來源寫 49）、Business US$149 起；Avatar IV 每分鐘約 20 點 | ✅ 與訂閱分開計費：Avatar IV 約 US$3～6／分鐘；儲值 US$5 即可開始 | 功能 ✅；價格 🟡；**台灣腔中文 🧪（找不到任何獨立評測）** |
| 16 | **Synthesia**（Express-2） | 企業教育訓練、多人協作、資安 | Starter 約 US$19～29、Creator 約 US$89／月（API 從 Creator 方案開始） | ✅ | 價格 🟡；**每位編輯需要各自訂閱** |
| 17 | **D-ID** | 讓照片開口說話、價格低 | Lite 約 US$4.7（不可商用）；商用從 Pro 約 US$16 起 | ✅（另外計費） | 🟡 |
| 18 | **Creatify** | 電商 UGC 風格廣告、商品網址轉影片 | 免費版有浮水印；Starter US$19、Pro US$49 | ✅ | 🟡（來源多為自家部落格） |

### 1D. 開源／可自行架設（**本階段不安裝**，只列出授權風險）

| # | 模型 | 授權 | 商用限制 | 查證 |
|---|---|---|---|---|
| 19 | **Wan 2.2**（阿里） | Apache 2.0 | 可自由商用。**2.5、2.6、2.7 版沒有開源，只能透過 API 使用**（部分網站誤寫成開源） | 🟡（主要依據單一詳細來源） |
| 20 | **LTX-2／2.3**（Lightricks） | LTX-2 社群授權（自訂條款，**不是**開源授權） | 年營收低於 1,000 萬美元可免費商用；可生成 20 秒、4K、含音訊 | ✅（Hugging Face 授權檔＋新聞報導） |
| 21 | **HunyuanVideo 1.5**（騰訊） | 騰訊混元社群授權 | 不適用於歐盟、英國、南韓（台灣不在排除範圍）；月活躍用戶超過 1 億需另外授權；**禁止用輸出內容訓練競品模型** | 🟡（引用的是舊版授權） |

### 1E. Skill／Agent 工具鏈（跟我們現有的 Claude 工作流程有關）

| # | 名稱 | 用途 | 查證 |
|---|---|---|---|
| 22 | **Remotion Agent Skills**（官方，`npx skills add remotion`） | 讓 Claude Code 用程式產生動態字卡、字幕動畫並輸出成片。性質跟我們 M002 自己寫的 HTML+ffmpeg 流程相同 | ✅ 存在；技能數量各來源不同（12 或 28） |
| — | **OpenMontage**（calesthio，81 個技能） | Agent 統一呼叫 Seedance、Runway、Higgsfield 等生成 API | 🟡 社群專案，安裝數為自行公布 |

### 1F. 已退出／不建議

| 工具 | 原因 |
|---|---|
| Sora 2 | OpenAI 已宣布結束（見 0.3） |
| Pika | 本次搜尋中已不在主流比較名單，沒有足夠的 2026 資料，**不列入**（🟡 如需要可補查） |

---

## 二、影片製作分類與分級表

### 2.1 L1～L4 商業交付品質評級（內部標準草案）

| 等級 | 名稱 | 驗收標準（全部符合才算） | 典型用途 | 可接受的 AI 痕跡 |
|---|---|---|---|---|
| **L1** | 社群日常級 | ① 沒有明顯 AI 錯誤（手指變形、文字亂碼、物體融化）② 字幕零錯字 ③ 9:16、聲音不破音 | 店家自己帳號的日常貼文 | 可以看出 AI 動態，但不突兀 |
| **L2** | 商用投放級 | L1 全部＋④ 店名、Logo、商品、價格**與實物一致** ⑤ 音樂與素材授權清楚 ⑥ 前 3 秒有鉤子、結尾有 CTA ⑦ 不構成不實廣告（**菜色不能用 AI 生成或美化成跟實物不同**） | IG／FB 付費投放、Google 商家檔案 | 只能出現在背景或轉場，不能出現在主商品上 |
| **L3** | 品牌形象級 | L2 全部＋⑧ 跨鏡頭角色與商品一致 ⑨ 統一調色 ⑩ 自然配音或真人聲 ⑪ 有人工精修 | 品牌形象片、官網首頁、連鎖店、展店 | 一般觀眾看不出來 |
| **L4** | 廣播／大螢幕級 | L3 全部＋⑫ 4K 或 HDR ⑬ 法務與肖像授權審查 ⑭ 專業後製與混音 | 電視、戶外大螢幕、影展 | 不可察覺；必要時依法揭露 AI 使用 |

> L2 第 ⑦ 點是台灣餐飲業的紅線：公平會已經在 2026 年把「使用 AI 技術的廣告」納入監測範圍，也已經查到違法案件（✅ 科技新報 2026-04-23）。台灣目前**還沒有**強制標示 AI 的法規，但韓國（2026 年初）和歐盟（AI 法案第 50 條，2026-08-02 起）已經上路。

### 2.2 六大影片類型 × 難度 × 成本 × 適用客戶

| 類型 | 定義 | 實際可達等級（推估，🧪） | 製作難度 | AI 直接成本（每支 15 秒成片，估算） | 人工時間（估） | 適用客戶 |
|---|---|---|---|---|---|---|
| **A 照片轉影片** | 店家提供真實照片 → 圖生影片加入動態 → 加字幕與音樂 | L1～L2 | ★★☆☆☆ | 約 NT$30～250（Seedance／Kling／Veo Fast，含重抽 3～5 次） | 0.5～1 小時 | 美甲作品、餐飲菜單、民宿房間、寵物美容前後對比 |
| **B 照片＋實拍混剪** | 手機實拍為主，AI 補空鏡、轉場、開場 | L2（實拍是品質的保證） | ★★★☆☆ | 約 NT$50～300 | 1～2 小時 | 餐飲現場（例如鐵板燒）、美甲過程、寵物互動 |
| **C 動漫／動畫** | 把真實寵物、店長、招牌菜轉成動漫角色或做成 2D 動畫 | L1～L2 | ★★★☆☆（角色一致性難） | 約 NT$100～400 | 1～3 小時 | 寵物店（毛孩動漫化）、親子餐廳、文創商品 |
| **D AI 生成影片** | 文字或參考圖從零生成整支情境片 | L1～L3（重抽次數多） | ★★★★☆ | 約 NT$200～1,500（Veo Standard 每 10 秒約 US$4，乘上重抽次數） | 2～6 小時 | 民宿意象片、節慶活動、概念型廣告；**不適合菜色本體** |
| **E 數位人口播** | 店長分身或虛擬主持人講解 | L1～L2（中文口型 🧪） | ★★☆☆☆（建模完成後） | 每分鐘約 NT$90～190（HeyGen API） | 0.5 小時／支 | 菜單更新、民宿入住說明、多語觀光客、課程招生 |
| **F 混合型商業廣告** | 實拍＋AI 生成＋數位人＋動態字卡 | L2～L3 | ★★★★★ | NT$500～3,000 | 4～12 小時 | 有投放預算的店家、連鎖或展店、品牌活動 |

> 成本估算依據：第一節的每秒價格 × 15 秒 × 3～5 次重抽（重抽倍數為第三方估計，🧪）。不含訂閱月費攤提與人工成本。

---

## 三、武器 × 場景交叉矩陣

### 3.1 總矩陣（● 主力候選　○ 可用　－ 不適合　？ 需實測）

| 武器 ＼ 類型 | A 照片轉影片 | B 混剪 | C 動漫 | D AI 生成 | E 數位人 | F 混合廣告 | 成本 | 品質上限（宣傳＋評測，🧪） | 商用條件 |
|---|---|---|---|---|---|---|---|---|---|
| Veo 3.1 | ● | ○ | ○ | ● | － | ● | 中～高 | 高 | 付費、SynthID |
| Gemini Omni Flash | ○ | ○ | ？ | ○ | － | ○ | 中 | ？ | 同 Google |
| Kling 3.0（4.0） | ● | ●（Omni 可編修實拍） | ○ | ● | ○（對嘴） | ● | 低～中 | 高 | 付費版才可商用 |
| Seedance 2.x | ● | ○ | ○ | ● | ○ | ○ | **最低** | 高（多參考素材） | 🟡 |
| Runway Gen-4.5／Aleph | ○ | ● | ○ | ○ | － | ● | 中 | 高 | 付費可商用 |
| Luma Ray3 | ○ | ○ | － | ○ | － | ○ | 中～高 | 中高 | 付費可商用 |
| Hailuo 2.3／H3 | ○ | － | ○ | ○ | － | － | 低 | 中 | 🟡 |
| Vidu Q3 | ○ | － | ● | ○ | － | － | 低～中 | 中高（動漫） | 🟡 |
| PixVerse V6 | ○ | － | ● | ○ | － | － | 低 | 中 | 🟡 |
| Midjourney Video | ○ | － | ● | － | － | － | 低（已有 MJ 訂閱時） | 中（藝術風格） | 付費可商用 |
| CapCut／剪映 | ○（模板） | ●（剪輯中樞） | ○ | － | ○ | ● | 低 | 視操作者而定 | **音樂與模板授權 🟡** |
| Adobe Firefly | ○ | ○ | － | ○ | － | ● | 中 | 高（可接合作模型） | 只有自家模型有商業安全定位 |
| Canva | ○ | ○ | － | ○ | － | ○ | 低 | 中 | 🟡 |
| Higgsfield | ○ | － | － | ○ | ○ | ● | 中 | ？ | 付費可商用 |
| HeyGen | － | ○ | － | － | ● | ● | 中 | 高（英文）／？（台灣腔） | API 另計 |
| Synthesia | － | － | － | － | ● | ○ | 高 | 高 | 每位編輯需各自訂閱 |
| D-ID | ○ | － | － | － | ○ | － | 低 | 中 | 商用要 Pro |
| Creatify | － | － | － | － | ● | ○ | 低～中 | ？ | 免費版有浮水印 |
| Claude＋ffmpeg／Remotion | ○（Ken Burns 鏡頭推移） | ●（M002 已驗證可行） | ○（2D 動態字卡） | － | － | ○ | 近乎零 | 中（字卡、版面穩定） | 自製 |
| LTX-2.3／Wan 2.2（開源） | ○ | － | ○ | ○ | － | － | 只需 GPU 成本 | 中～高 | 依授權條件；**本階段不安裝** |

### 3.2 每類三款候選與選擇理由

> 理由只根據「可查證的規格、價格、授權」。品質一律留到實測再判斷。

**A 照片轉影片**
1. **Kling 3.0**：有第三方商品照測試指出 Kling 能保持商品形狀不變，Veo 和 Seedance 則傾向「加戲」（例如自己添加咖啡）。這對 L2 的「與實物一致」最關鍵。付費版可商用的規定很明確。
2. **Seedance 2.x（Dreamina／CapCut）**：每秒成本最低（US$0.035～0.047），而且與 CapCut 剪輯流程同一個生態系。
3. **Veo 3.1 Fast／Lite**：原生 9:16 直式、可放多張參考圖、每秒 US$0.05～0.12；有 SynthID 可作為「AI 使用證明」。

**B 照片＋實拍混剪**
1. **CapCut**：店家與剪輯師都熟悉，自動字幕支援中文；海豹小隊既定的剪輯主器。
2. **Kling 3.0 Omni**：2026-06 升級的重點就是「高保真編修既有影片」，可以只修實拍片段，不必整支重生。
3. **Claude＋ffmpeg（M002 流程）**：已經在本 repo 實戰產出 30 秒成片，成本接近零、可重複執行；Remotion Skill 是它的標準化版本（目前**只列入觀察，不開發**）。

**C 動漫／動畫**
1. **Vidu Q3**：API 平台明確標示「擅長動漫」，支援首尾幀，可做「真實寵物變成動漫」的轉場。
2. **PixVerse V6**：有一鍵動漫與 3D 特效模板，以次數計費，適合大量製作、價格低的產品。
3. **Midjourney Video**：如果已經有 MJ 訂閱，風格化圖片可以直接轉成動態；缺點是沒有 API、只能圖生影片。

**D AI 生成影片**
1. **Veo 3.1**：多篇評比把它排在綜合第一；有大型品牌實例（Popeyes 3 天完成的快速反應廣告、Hill's 寵物食品導入後出片快 4～6 倍，🟡 屬業者自述）。
2. **Seedance 2.5**：單段 30 秒含音訊、支援多參考素材，成本最低。
3. **Kling 3.0 → 4.0**：單段 15 秒、多鏡頭；4.0 宣稱 30 秒、10 張關鍵幀（🟡 尚未正式上線）。

**E 數位人口播**
1. **HeyGen**：繁中介面、照片即可生成分身、API 按用量計費（US$5 起），最適合小量測試。**台灣腔是最大未知數 🧪**。
2. **Synthesia**：企業級穩定；對小店來說太貴，作為品質對照組。
3. **Creatify**：UGC 風格廣告加商品網址轉影片，比較接近「網紅推薦」的感覺。

**F 混合型商業廣告**
1. **Adobe Firefly**：一個訂閱就能用多家模型，自家模型有商業安全定位，適合需要授權保證的客戶。
2. **Higgsfield**：商品網址轉廣告、1,500 個以上模板；但每次需要多抽幾次，成本要實測。
3. **Runway Gen-4.5／Aleph**：多篇評比認為最適合行銷用途，也能做影片轉影片。

---

## 四、商業應用：台灣實體小店

### 4.1 市場行情（**市場查證資料**，非我方定價）

| 服務 | 台灣行情 | 來源性質 |
|---|---|---|
| 純代剪（客戶提供素材） | 每支 NT$1,000～3,000；個人接案最低有 NT$280／分鐘 | 工作室部落格＋Threads 徵才貼文 🟡 |
| 剪輯＋企劃腳本 | 每支 NT$3,500～8,000 | 多家工作室部落格一致 ✅ |
| 拍攝＋剪輯（含企劃） | 每支 NT$5,000～15,000 | 多家一致 ✅ |
| 社群代操月費 | NT$5,000～50,000（PRO360）／NT$25,000～60,000 起（工作室） | 🟡 區間很大 |
| 實際需求案例 | 美甲業者「沒有預算」；IG 小編代操預算每月 1～2 萬；洗衣店期望 8,000～15,000 | PRO360 發案紀錄（個案） |
| 餐飲網紅口碑訂閱 | Influenxio 每月 NT$2,450，含 3 篇網紅 IG 貼文（雙北） | 數位時代報導 ✅ |

**市場訊號**
- 台灣社群使用者 1,810 萬人，占人口 78.4%（DataReportal Digital 2026 ✅）。2024 年數發部調查：最常用平台為 Facebook 44%、Instagram 21%，Threads 持續成長。
- **三分之一消費者表示，品牌使用 AI 廣告反而會降低購買意願**（2026 社群趨勢報告，經自由時報引述 🟡）。→ 對小店而言，「**真實素材＋AI 加工**」比「全 AI 生成」安全。
- 地方政府已經在推動「AI 剪輯＋短影音」協助商圈小店（桃園後站 2026 案例 ✅），代表市場教育已經開始，但店家多半只參加工作坊，缺少持續產出的能力。

### 4.2 各行業影音需求

| 行業 | 主要需求 | 素材特性 | 最適類型 | 紅線 |
|---|---|---|---|---|
| 餐飲 | 新菜上市、現場製作、氣氛、排隊感 | 現場實拍豐富（本 repo 已有一家鐵板燒店家的 25 張照片與 8 支影片） | B 混剪 > A 照片轉影片 | **菜色不能用 AI 生成或改變外觀**（不實廣告） |
| 美甲 | 作品集、季節款、過程影片 | 大量作品近拍照 | A 照片轉影片（作品輪播＋動態） | 作品必須是本店真實作品 |
| 寵物（美容、旅館、用品） | 美容前後對比、毛孩日常、節慶 | 照片多、毛孩不配合拍攝 | A＋C（毛孩動漫化很容易引起分享） | 不可以讓寵物出現危險或痛苦的畫面 |
| 民宿 | 房型介紹、周邊景點、入住說明、外國旅客 | 房間照片＋景點 | A＋D（意象鏡頭）＋E（多語入住說明） | 房間與景觀不能 AI 美化（訂房糾紛） |
| 其他服務（美髮、健身、補習、課程） | 師資介紹、成果、招生 | 人物為主 | E 數位人＋B 混剪 | 數位人必須取得本人同意 |

### 4.3 三個優先切入的影片產品

> 「內部建議售價」是 C 依市場行情與成本推算的**提案**，尚未經市場驗證，需由 Shen 決定。

#### 產品 ①「照片變短影音」月包（類型 A）

- **內容**：店家每月上傳 10～20 張照片 → 每月 4 支 15 秒 9:16 短影音（動態、字幕、音樂、封面），附發文文案。
- **為什麼優先**：門檻最低（店家不需要拍影片）、AI 成本最低、最符合「真實素材」原則；美甲、民宿、寵物美容、餐飲都能用。
- **成本推估**：AI 費用每支約 NT$30～250＋人工 0.5～1 小時。
- **市場對照**：純代剪每支 NT$1,000～3,000（而且需要店家先拍好影片）。
- **內部建議售價**：單支 NT$990～1,500；**月包 4 支 NT$3,600～4,800**；首月試用 2 支 NT$1,500。

#### 產品 ②「實拍＋AI 補鏡」作戰包（類型 B，接續海豹小隊既有流程）

- **內容**：店家用手機實拍 → 企劃兵寫作戰令 → AI 補開場、空鏡、轉場 → 成片 → 戰果兵判讀數據並提出下一支建議。
- **為什麼優先**：品質最容易達到 L2；本 repo 的 M002 已經驗證「Claude 產出剪輯規格＋自動化出片」可行；**數據判讀與迭代是一般代剪沒有提供的差異化服務**。
- **市場對照**：剪輯＋企劃每支 NT$3,500～8,000；代操月費 NT$1～2 萬（真實需求）。
- **內部建議售價**：單支 NT$2,500～3,500；**月包 3 支＋戰果月報 NT$7,800～9,800**。

#### 產品 ③「店長分身」口播（類型 E）

- **內容**：一次性建立店長的數位分身與聲音（需簽署本人同意書）→ 每週一支 30～60 秒口播（新品、公告、入住說明），可加英、日、韓多語版本。
- **為什麼優先**：店長最缺的是「上鏡時間」；民宿可以用多語版本服務外國旅客，補習與課程業能用來招生。
- **風險**：台灣腔中文與口型品質尚未驗證 🧪；消費者對 AI 廣告的接受度有疑慮 → 定位為「資訊型內容」，不做情感型廣告。
- **內部建議售價**：建模費 NT$3,000～5,000（一次）；每支 NT$800～1,200；多語版本每增加一種語言 +NT$400～600。

**候補 ④**：寵物動漫化（類型 C），每支 NT$500～800。容易被分享但較難持續回購，建議當作產品 ① 的加購項目。

### 4.4 收費模式總覽

| 模式 | 適用 | 備註 |
|---|---|---|
| 單支計價 | 首次合作、測試期 | 把價格定在市場行情的低端，換取試用 |
| 月包（3～4 支） | 主力 | 對標代操月費的低端（NT$5,000～10,000） |
| 建模費＋單支計價 | 數位人 | 建模費可以篩掉不認真的客戶 |
| 加購（多語、動漫版、投放版尺寸） | 全部 | 提高客單價 |

---

## 五、後續實測建議與候選排序

### 5.1 實測原則

1. **同一份素材測所有工具**：使用本 repo 已有的鐵板燒店家 25 張照片與 8 支影片（真實台灣小店素材，可以避免宣傳片偏差）。
2. **盲測**：成片去掉檔名，由 Shen 與 2～3 位非團隊人員依 L1～L4 標準評分。
3. **記錄失敗率**：每個工具抽 5 次，記錄「可用次數÷總次數」，算出**每支可用成片的真實成本**。
4. **授權實查**：實測期間逐一打開各工具的服務條款，確認商用、浮水印、資料訓練、音樂授權。這次因為網路限制無法完成這一步。

### 5.2 候選排序（建議實測順序）

| 順序 | 工具 | 對應產品 | 要回答的問題 | 預估實測成本 |
|---|---|---|---|---|
| 1 | **Kling 3.0**（Standard 月費） | ① ② | 菜色與商品是否保持不變？15 秒直式畫質能否達到 L2？ | 約 US$7～10 |
| 2 | **Seedance 2.x**（經 CapCut Pro 或 Dreamina） | ① ② | 最低價方案的品質夠不夠？CapCut 內一站完成的效率如何？ | 約 US$20～36 |
| 3 | **Veo 3.1 Fast**（Gemini API 或 Google AI Pro） | ① ③ | 原生 9:16＋參考圖能否同時保持店面與菜色？台灣能不能用 Flow？ | 約 US$20 |
| 4 | **HeyGen**（API 儲值） | ③ | **台灣腔中文與口型是否能接受？**（決定產品 ③ 生死） | 約 US$5～29 |
| 5 | **CapCut Pro 商用條款實查** | ① ② | 音樂與模板能不能用在客戶的商業影片？ | 不用錢，只需閱讀條款 |
| 6 | Vidu Q3／PixVerse V6 | 候補 ④ | 寵物動漫化時角色是否一致？ | 約 US$10 |
| 7 | Kling 4.0（正式上線後） | ① ② | 30 秒、多關鍵幀是否明顯優於 3.0？ | 觀察 |
| — | 開源（LTX-2.3、Wan 2.2） | — | 量大時才評估自建 GPU；**現階段不測** | — |

**第一輪實測總預算估計：約 US$80～130（約 NT$2,500～4,000）**，範圍為第 1～6 項，每項只付一個月。

### 5.3 給 Shen 的決策點

| # | 決策 | C 的建議 |
|---|---|---|
| D1 | 是否進入實測？ | 建議進入，只做 5.2 的第 1～5 項 |
| D2 | 主攻產品 | 先做 ①＋②（風險最低，接得上現有海豹小隊流程）；③ 等 HeyGen 台灣腔測完再決定 |
| D3 | 是否允許「全 AI 生成」的菜色畫面 | **建議禁止**（公平會監測不實廣告＋消費者對 AI 廣告的疑慮） |
| D4 | 是否主動標示「本片使用 AI」 | 建議在 L2 以上的影片主動標示（台灣尚未強制，但歐盟與韓國已上路，提早做可以建立信任） |

---

## 附錄：主要來源

> 以下都是本次搜尋實際看到的頁面。**標註「官方」的才是第一手來源**，其他都是二手來源。

**市場總覽與版本**
- [Best AI Video Generators 2026 – aimlapi](https://aimlapi.com/blog/best-ai-video-generators-2026-veo-3-1-kling-sora-2-seedance-more-compared)／[tech-insider](https://tech-insider.org/best-ai-video-generator-2026/)／[getaiperks](https://www.getaiperks.com/en/blogs/44-best-ai-video-generators-2026)
- Sora 結束：[9to5mac](https://9to5mac.com/2026/03/24/openai-just-killed-its-sora-ai-video-creation-app/)、[alternativeto](https://alternativeto.net/news/2026/3/openai-is-shutting-down-sora-its-ai-video-slop-app-less-than-six-months-after-launch)、[zilliz（時程）](https://zilliz.com/ai-faq/what-is-the-sora-shutdown-timeline)
- Gemini Omni Flash：[Google Workspace 官方](https://workspace.google.com/blog/product-announcements/introducing-gemini-omni-flash-in-google-vids)、[The Next Web](https://thenextweb.com/news/google-gemini-omni-flash-video-model-io-2026)
- Veo 3.1：[benchlm 價格](https://benchlm.ai/media-pricing/veo)、[wavespeed](https://wavespeed.ai/blog/cost-and-billing/google-veo-3-pricing/)、[直式影片報導 storyboard18](https://www.storyboard18.com/how-it-works/google-expands-veo-3-1-with-vertical-video-support-and-youtube-integration-87665.htm)
- Kling：[Yahoo Finance 3.0 發布](https://finance.yahoo.com/news/kling-ai-launches-3-0-080000425.html)、[wavespeed 4.0 狀態](https://wavespeed.ai/blog/ai-news/kling-4-0-release-date/)、[eesel 價格](https://eesel.ai/blog/kling-ai-pricing)、[crepal 商用](https://crepal.ai/blog/aivideo/is-kling-ai-free-pricing/)
- Seedance：[Dreamina 官方 2.5 價格](https://dreamina.capcut.com/seedance/seedance-2-5-pricing-2026)、[Dreamina 官方 2.5](https://dreamina.capcut.com/seedance/seedance-2-5)、[datacamp 2.0](https://www.datacamp.com/blog/seedance-2-0)
- Runway：[creatify 價格](https://creatify.ai/blog/runway-pricing-(2026)-plans-credits-and-what-you-ll-actually-pay)、[magichour](https://magichour.ai/blog/runway-gen-45-pricing)、[terms.law 條款解讀](https://terms.law/ai-output-rights/runway/)
- Luma：[magichour](https://magichour.ai/blog/luma-dream-machine-pricing)、[hooked](https://www.hooked.so/compare/luma-ai-pricing)
- Hailuo：[OpenRouter](https://openrouter.ai/minimax/hailuo-2.3-20260420)、[minimax-ai.chat](https://minimax-ai.chat/models/minimax-hailuo-23-fast/)
- Vidu：[Krea API 文件](https://www.krea.ai/docs/api-reference/video/vidu-q3.md)、[Civitai](https://developer.civitai.com/orchestration/recipes/vidu)
- PixVerse：[fast.io 評測](https://fast.io/resources/pixverse-ai-review-2026/)、[Segmind](https://www.segmind.com/models/pixverse-v6/pricing)
- Midjourney：[eesel](https://eesel.ai/blog/midjourney-pricing)、[krea](https://www.krea.ai/blog/is-midjourney-free-pricing-video-and-free-alternatives-in-2026)

**平台、數位人、開源、Skill**
- CapCut：[vidpros](https://vidpros.com/capcut-pro-vs-free/)、[bigvu](https://www.bigvu.tv/blog/capcut-pricing-2026-free-vs-pro-included-alternatives)
- Adobe Firefly：[Adobe 官方合作模型說明](https://helpx.adobe.com/my_ms/creative-cloud/apps/generative-ai/non-adobe-models-in-adobe-products.html)、[saascrmreview](https://saascrmreview.com/adobe-firefly-pricing/)
- Canva：[TechRadar](https://www.techradar.com/computing/artificial-intelligence/googles-veo-3-is-coming-to-canva-as-the-graphic-design-giant-claims-ai-doesnt-need-to-mean-we-have-to-stop-being-creative)、[fluxnote](https://fluxnote.io/guides/canva-ai-video-generator-review)
- Higgsfield：[creatify 評測](https://creatify.ai/blog/higgsfield-ai-review-(2026)-is-it-worth-it)、[eesel](https://www.eesel.ai/blog/higgsfield-ai)
- HeyGen：[官方繁中 FAQ](https://www.heygen.com/zh-tw/faq)、[官方中文 TTS 頁](https://www.heygen.com/zh-tw/text-to-speech/chinese)、[creatify 價格](https://creatify.ai/blog/heygen-pricing-(2026)-plans-and-what-you-ll-actually-pay)、[diyai API 價格](https://diyai.io/ai-tools/video-generation/heygen-pricing/)
- Synthesia：[creatify](https://creatify.ai/blog/synthesia-pricing-(2026)-plans-credits-and-what-you-ll-actually-pay)、[eesel](https://eesel.ai/blog/synthesia-pricing)
- D-ID／Creatify：[argil](https://www.argil.ai/blog/d-id-pricing-5be73)、[creatify UGC](https://creatify.ai/blog/the-8-best-ai-ugc-ad-tools-in-2026)
- 開源：[LTX-2.3 授權（Hugging Face 官方）](https://huggingface.co/Lightricks/LTX-2.3/blob/main/LICENSE)、[LTX-2 開源新聞](https://www.artificialintelligence-news.com/news/open-source-ai-video-from-lightricks-offers-4k-sound-and-faster-rendering/)、[Wan 系列授權整理 howaiworks](https://howaiworks.ai/models/wan)、[HunyuanVideo 授權 chatforest](https://chatforest.com/reviews/hunyuanvideo-tencent-open-source-video-generation/)
- Skill：[Claude Code Video Toolkit](https://github.com/wilwaldon/Claude-Code-Video-Toolkit)、[Remotion for coding agents](https://motionbox.io/blog/remotion-for-coding-agents)、[OpenMontage Seedance skill](https://www.skills.sh/calesthio/openmontage/seedance-2-0)

**品牌案例（官方展示與真實影片線索）**
- [Superside：2026 AI 行銷案例（Popeyes、Hill's）](https://www.superside.com/blog/ai-marketing-campaigns)
- [thatworksmedia：2026 AI 廣告範例（含 Veo 製作的電視廣告）](https://thatworksmedia.com/en/the-best-ai-generated-commercials/)
- [contentbeta：30 支以上的 AI 廣告範例](https://www.contentbeta.com/blog/best-ai-video-ad-examples/)
- [Kling 官方首頁（作品展示、坎城入圍作品）](https://kling.ai/)：屬廠商自述
- [Masonry：Kling 與 Veo、Seedance 的商品照實測比較](https://masonry.so/blog/best-ai-video-model-for-product-ads)

**台灣市場與法規**
- 報價：[嶼嶼創意](https://yuyu-creative.tw/short-video-pricing)、[幕創行銷](https://beingmovestrong.com/short-video-price-quote/)、[Lightwork](https://lightwork.tw/short-video-management/)、[twfirst](https://twfirst.com.tw/digital-marketing/2026reelspm/)、[二榆影像](https://www.2yufilm.productions/blog/video-editing-outsourcing-price-guide-market-rates-quote-template-factors)、[PRO360 社群行銷價格](https://www.pro360.com.tw/price/social_marketing)、[數位時代 Influenxio](https://www.bnext.com.tw/article/65674/influenxio-restaurant-kol-services)
- 社群使用：[eliteasia（DataReportal 2026 摘要）](https://eliteasia.co/digital-and-social-media-trends-in-taiwan-in-2026)、[自由時報（數發部調查）](https://news.ltn.com.tw/news/focus/breakingnews/4928690)
- 小店案例與消費者態度：[工商時報](https://www.ctee.com.tw/news/20260806700342-439901)、[自由時報](https://news.ltn.com.tw/news/life/breakingnews/5446664)
- 法規：[科技新報：公平會納入 AI 廣告監測](https://technews.tw/2026/04/23/ftc-to-assess-mandatory-disclosure-rules-for-ai-ads/)、[INSIDE：歐盟 AI 法案第 50 條](https://www.inside.com.tw/article/41991-eu-ai-act-article-50-content-labelling-august-2026)、[Nemko：韓國 AI 廣告標示](https://www.nemko.com/zh-hant/blog/韓國強制要求ai生成的廣告需加標注)
