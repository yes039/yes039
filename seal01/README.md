# SEAL-01 短影音製作系統

把真人片段、手繪動畫、Demo 錄影、資訊卡、字幕和配音合成一支 1080×1920 的 FB 短影音。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `render.py` | 合成器：讀分鏡檔（JSON）輸出 MP4 |
| `transcribe.py` | 本機語音辨識（faster-whisper）→ 繁體中文 SRT，校對後交給 `render.py` |
| `test_assets.py` | 產生流程驗證用的測試素材（程式繪製圖示、模擬 Demo 錄影、合成音樂） |
| `storyboard.sample.json` | 60 秒測試版分鏡範例 |
| `sample/` | 樣片與辨識出的字幕 |

## 環境需求

- Python 3、ffmpeg、Pillow、numpy
- 語音辨識：`pip install faster-whisper opencc-python-reimplemented`，模型 `Systran/faster-whisper-medium`（Hugging Face 下載，本機執行）
- 測試素材的模擬錄影需要 Playwright（Chromium）
- 字型：思源黑體 Noto Sans TC Black／Bold（OFL 授權）

## 流程

1. 真人片段 → `python3 transcribe.py 片段.mp4 片段.srt` → **人工校對 SRT**
2. 寫分鏡檔：每段一個 segment（`live`／`draw`／`pip`／`card`），欄位說明見 `render.py` 開頭註解
3. `python3 render.py 分鏡.json 輸出.mp4`
4. 檢查畫面：標題與字幕必須落在 y 285–1250（FB 安全區）

## 版型規則

- Reels 上 14%、下 35% 會被介面蓋住；動態消息裁成 4:5 只剩 y 285–1635。
- 標題、字幕放在交集 y 285–1250；品牌條在 1250–1390；其餘區域以畫面模糊放大填滿。
- AI 生成的真人片段用 `"fit": "contain"` 完整保留原畫面與平台加上的 AI 標識，並以 `ai_label` 加上自己的「AI 生成」角標。
- 背景音樂自動標準化到 -28 LUFS，人聲出現時再壓低約 13–15 dB。
