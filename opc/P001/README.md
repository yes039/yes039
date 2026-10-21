# OPC-P001｜AI 產品競品壓力測試 V0.1

> 任務：檢查 Gemini 10 月 20 日新功能對我們現有 AI 產品造成哪些影響。
> 狀態：**規格與工具已就緒，實測待執行**（本環境沒有 Claude／Gemini API 金鑰，見〈測試紀錄〉）。
> 日期：2026-10-21

## 執行限制遵守狀況

| 限制 | 狀況 |
|---|---|
| 不得修改現有 V4.2 | ✅ 沒碰。V4.2（`fb-content-generator_v4.2.html`）存在店主的 Mac 本機，不在本 repo；本任務只新增 `opc/P001/` |
| 不得接入未授權的客戶資料 | ✅ 測試素材只用：虛構店家、我們自製的 M002 影片、本 repo 的自有文件。repo 根目錄的鐵板燒照片／影片（宜大鐵板燒）**不列入測試**，除非店家書面同意 |
| 不得直接更改正式產品價格 | ✅ 只做成本推算，沒有任何價格建議被套用 |
| 不得因新功能發布就切換主力模型 | ✅ 結論是「不換」，並寫明換器要過哪些門檻（第 5 節） |
| 先測試，再判斷 | ⚠️ 第 1、4、5 節是**依公開資料做的初判**，標了「待 T1–T3 驗證」的地方要等實測才能定案 |

---

## 0. 被測的「現有產品」是什麼

| 產品 | 我知道的事 | 資料來源 |
|---|---|---|
| **FB 四主體內容產生器 V4.2** | 本機 HTML 單檔；選「發文主體／貼文目標／主要 CTA」產生 FB 文案；**只產生文案，不自動發文**；每篇顯示 token 數與 NT$ 成本；有月累計（2026 年 10 月：7 篇、NT$7.98） | Drive 截圖 2026-10-10 21.45 |
| V4.2 使用的模型 | 推測為 **Claude Opus 5.5**：單篇輸入 1,878／輸出 1,413 tokens 顯示 NT$1.14，用 Opus 5.5 牌價（$4／$20 每百萬 tokens，匯率 32）算出來是 NT$1.145；7 篇推算 NT$8.01，與畫面上的 NT$7.98 相符。**請打開 V4.2 原始碼確認 model 字串** | 推算 |
| FB 內容工作室 V5 | Cloudflare Workers 部署中（fb-content-studio），有表單、隱私權政策頁 | Drive 截圖 2026-10-11 00.17 |
| 短影音海豹小隊 MVP | 企劃兵→製片兵→戰果兵＋人工核可節點；Gemini 已列為「看影片」備援器 | `seal-team/` |
| M002「60+ 學 AI」招生短片 | 本機全自動產出 30 秒 9:16 影片（插畫動畫＋TTS＋配樂） | `seal-team/missions/M002/` |

---

## 1. Google 10/20 前後新功能 × 現有產品能力對照

「10 月 20 日」在台灣時間涵蓋美國 10/19–10/20 的發布。查到的項目如下：

| # | Google 新功能 | 發布／狀態 | 碰到哪個產品 | 重疊程度 | 初判影響 |
|---|---|---|---|---|---|
| G1 | **Gemini Notebook（原 NotebookLM）簡報／影片總覽「共創」流程**：產生前先看並修改大綱（簡報的 outline notes、影片的 producer notes），可指定內容、視覺風格、格式，之後才算圖 | 10/19 公告，全球分批上線；有消息說 Help Center 寫的是只開放給 AI Ultra，**要用我們自己的帳號確認** | M002 招生短片、60+ 學 AI 課程教材、製片兵 | **高**（教學說明類影片／簡報） | 「先審大綱再產出」這一步，跟我們 H2 作戰令核可、剪輯單的作用一樣。**教材類**可以直接借用；**招生廣告類**要看 T3 結果（品牌、配樂、口吻、9:16 控制） |
| G2 | Gemini Notebook 既有能力（9 月）：約 60 秒直式影片、70+ 語言、簡報可匯出 PPTX | 9 月起，Pro／Ultra | 同上 | 中 | 跟 G1 一起算：60 秒直式影片已經接近短影音格式 |
| G3 | Android 訊息防詐「強化保護模式」（雲端 Gemini 判斷可疑訊息、Gemini Nano 檢查連結） | 10/19–20 公告，需自行開啟 | 無直接重疊 | 無 | **可以當成 60+ 學 AI 的課程題材**（長輩防詐），不影響產品 |
| G4 | Android Auto／車用 Gemini 個人化（接 Gmail、日曆、相簿） | 10/20 起陸續上線 | 無 | 無 | 不影響 |
| G5 | **Gemini 2.5 Pro／Flash／Flash-Lite 在 Google Cloud 於 10/20 退役**，建議改用 3.8 Flash／3.5 Flash | 10/20 生效 | 武器配置表的 Gemini 備援器 | 低～中 | 如果有任何腳本或 Gem 寫死 `gemini-2.5-*`，現在會失效。**要檢查**（V4.2、V5、備援 Prompt） |
| G6 | 價格參考：Gemini 3.8 Flash 推廣價 $0.75／$3.75（2027/1/1 起漲到 $1.5／$7.5）；Gemini 4 Argon 推廣價 $2／$10（12/1 起 $4／$20，和 Opus 5.5 同價） | 第三方整理，**Google 官方價目表還沒核對** | V4.2 成本 | 中 | 每篇差距不到 NT$1，見第 3 節 |

**V4.2 能力 vs Gemini 現成能力**

| 能力 | V4.2 | Gemini app／Notebook 現成 | 差距 |
|---|---|---|---|
| 依「發文主體」切換口吻（四主體） | ✅ 內建 | ⚠️ 要自己建 Gem 或每次貼 Prompt | 我們領先：流程固定 |
| 貼文目標＋主要 CTA 結構化輸入 | ✅ | ❌ 自由對話 | 我們領先 |
| 單篇／月累計成本透明 | ✅ NT$ 顯示 | ❌（訂閱制看不到單篇成本） | 我們領先（對客戶是賣點） |
| 只產文、不自動發文（人工把關） | ✅ | — | 平手（這是我們的政策選擇） |
| 從多份資料產簡報／說明影片 | ❌ | ✅ G1／G2 | **Google 領先** |
| 看影片素材 | ❌（截圖替代） | ✅ | Google 領先（已列為備援器） |
| 戰果回填→下一篇更好（戰果庫） | ✅（海豹小隊流程） | ❌ | 我們領先 |

---

## 2. 三項實際工作測試規格

詳見 [測試規格.md](測試規格.md)。摘要：

| 編號 | 工作 | 對應產品 | 比什麼 |
|---|---|---|---|
| **T1** | 同一份 brief 產出 FB 貼文（4 個發文主體 × 2 個目標 = 8 篇） | V4.2 | Claude Opus 5.5（V4.2 現行）vs Gemini 3.8 Flash vs Gemini 4 Argon：品質評分、改稿時間、單篇成本 |
| **T2** | 從自有影片素材產出《素材清單》＋《剪輯單》 | 製片兵 | Claude（3 張截圖）vs Gemini（直接讀影片）：描述正確率、時間碼可用率 |
| **T3** | 用 Gemini Notebook 共創流程做「60+ 學 AI」教材簡報＋60 秒說明影片 | M002／課程教材 | Gemini Notebook vs 我們現行流程：可控性、品牌一致、改稿輪數、工時 |

---

## 3. Claude／Gemini 測試紀錄與成本比較

詳見 [測試紀錄.md](測試紀錄.md)。現階段只有**牌價推算**，沒有實測。

以 V4.2 實際一篇的用量（輸入 1,878／輸出 1,413 tokens，匯率 32）推算：

| 模型 | 單篇 NT$ | 每月 7 篇 | 每月 100 篇 | 備註 |
|---|---|---|---|---|
| Claude Opus 5.5（V4.2 推測現行） | 1.15 | 8.0 | 115 | 與 V4.2 畫面 NT$1.14 吻合 |
| Claude Sonnet 5.5 | 0.57 | 4.0 | 57 | |
| Claude Haiku 5.5 | 0.03 | 0.2 | 3 | |
| Gemini 3.8 Flash（推廣價） | 0.21 | 1.5 | 21 | 2027/1/1 起約 0.43；**沒算思考 tokens** |
| Gemini 4 Argon（推廣價，到 11/30） | 0.57 | 4.0 | 57 | 12/1 起 1.15，與 Opus 5.5 相同 |

**初判**：每篇成本最大差距約 NT$1.1，一個月 100 篇也只差約 NT$100，比店家改一篇稿的工時便宜得多。**光看成本不構成換模型的理由**，要看 T1 的「改稿時間」和「可直接發布率」。另外 Gemini 兩個便宜價都是推廣價，長期成本優勢會縮小。

---

## 4. 可直接借用 vs 仍須自建

| 項目 | 判斷 | 理由 |
|---|---|---|
| 60+ 學 AI **課程教材**簡報、說明影片 | **借用** Gemini Notebook（G1/G2） | 素材是我們自己的教材，不涉客戶資料；共創大綱步驟省掉我們自建簡報流程 |
| 製片兵「看影片寫素材描述」 | **借用** Gemini（已是備援器）→ T2 通過就升為主器 | 武器配置表原本就有換器條件：「素材以影片為主而截圖描述常出錯 → 改由 Gemini」 |
| 長輩防詐題材 | **借用**當內容（G3） | 拿來當課程單元或貼文主題 |
| FB 四主體口吻、目標／CTA 結構 | **自建（保留 V4.2）** | Gemini 沒有現成對應功能，這是產品核心 |
| 單篇成本透明、月累計 | **自建** | 訂閱制工具沒有，是對客戶說明時的賣點 |
| 戰果庫回饋迴路、人工核可節點 H1–H7 | **自建** | 跨工具的流程與紀錄，任何單一模型都不提供 |
| **招生／廣告型**短影音（品牌、配樂、口吻、9:16、CTA 卡） | **暫時自建（M002 流程），等 T3 結果** | Notebook 是說明型影片，廣告控制度還沒驗證 |
| 店家實拍素材的分析 | **自建流程＋取得授權後才用任何外部模型** | 客戶資料限制 |

---

## 5. 差異化與交付建議

**我們的差異化（Google 這次沒有追上的部分）**
1. **流程，不是工具**：作戰令→製作→戰果→復盤的閉環，加上人工核可節點。Google 給的是更強的單點工具。
2. **發文主體口吻固定化**：四主體設定讓非技術店家不用學 Prompt。
3. **成本透明**：每篇 NT$ 顯示，對小店與長輩學員都是信任感來源。
4. **在地／長輩情境**：「60+ 學 AI」的教法和陪伴感，Google 不做。

**交付建議（全部不動 V4.2、不改價、不換主力模型）**

| 時程 | 動作 | 負責 |
|---|---|---|
| 本週 | 打開 V4.2 原始碼確認 model 字串；檢查 V4.2、V5、備援 Prompt 有沒有寫死 `gemini-2.5-*`（G5） | 隊長 |
| 本週 | 用自己的金鑰跑 `harness/run_test.py` 完成 T1、T2；用自己的 Google 帳號確認 G1 是否已開通，並做 T3 | 隊長＋Claude |
| T1–T3 完成後 | 依〈測試規格〉的判定門檻填結論。**只有某一項同時符合「品質不輸＋改稿時間少 ≥30%＋武器配置表換器條件已觸發」，才把該兵位的換器提案寫進復盤** | 隊長 |
| 之後 | 課程教材改用 Gemini Notebook 製作（若 T3 通過）；FB 文案維持 V4.2；V5 規劃時再評估「模型可切換」，不在 V4.2 上改 | — |

**不建議做的事**：因為 Gemini 4 Argon 推廣價就把 V4.2 換掉。推廣價 11/30 結束，之後跟 Opus 5.5 同價。

---

## 資料來源

- Gemini Notebook 共創流程：[ppc.land](https://ppc.land/gemini-notebook-adds-review-step-before-rendering-slides-and-videos/)、[androidpure](https://www.androidpure.com/gemini-notebook-slides-video-review/)、[superpowerdaily](https://superpowerdaily.com/posts/google-adds-outline-review-before-gemini-notebook-generates-slides-and-videos)、[scalevise](https://scalevise.com/resources/gemini-notebook-co-create-slide-decks-video-overviews/)
- Notebook 60 秒影片／語言：[alternativeto](https://alternativeto.net/news/2026/9/gemini-notebook-adds-short-video-overviews-in-70-languages/)、[newsbytes](https://www.newsbytesapp.com/news/science/gemini-notebook-adds-70-languages-and-around-60-seconds-videos/tldr)
- Android 防詐：[Deccan Herald](https://www.deccanherald.com/technology/artificial-intelligence/google-announces-new-gemini-ai-powered-anti-fraud-features-for-android-phones-4188060)
- 車用 Gemini：[Phandroid](https://phandroid.com/2026/10/20/gemini-ai-arrives-for-cars-new-update-reads-your-emails-photos-on-the-go)
- 2.5 退役：[Google Cloud 模型生命週期](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)
- Gemini 3.8 Flash 價格：[apidog](https://apidog.com/blog/gemini-3-8-flash-pricing/)、[OpenRouter](https://openrouter.ai/google/gemini-3.8-flash)
- Gemini 4 Argon 價格：[eesel](https://www.eesel.ai/blog/gemini-4-argon-pricing)、[activepieces](https://www.activepieces.com/blog/gemini-4-argon-api-pricing-tokens-and-search-2026.md)
- Claude 價格：Anthropic 官方價目（Claude API skill，2026-10-06 快取）
