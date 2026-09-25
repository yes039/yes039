# 夯Bar串燒 宣傳影片（9:16 直式，30 秒）

成品：`out/huobar-promo.mp4`（結尾「歡迎來電下單」）、`out/huobar-promo-takeout.mp4`（結尾「歡迎點餐外帶」）（1080×1920、30fps，背景音樂為 `music.py` 合成的原創台客搖滾（150 BPM，破音電吉他＋推弦主奏＋搖滾鼓），無版權問題）

| 秒數 | 畫面 | 文字 |
|---|---|---|
| 0–3 | 烤台影片 | 夯 Bar 串燒（開場） |
| 3–5.4 | 串燒特寫影片 | 炭火直烤／香到犯規 |
| 5.4–7.6 | 備料照片 | 新鮮備料 |
| 7.6–9.7 | 蔥肉捲／時蔬／豆皮快剪 | 串串任你挑 |
| 9.7–14.1 | 整盤串燒、烤台照片 | 一串一串／現點現烤／用心顧火 |
| 14.1–18.6 | 招牌影片 | 這裡有酒有菜 🍻 |
| 18.6–21.8 | 烤台影片／串燒特寫／烤台影片 | 下班後／來一串／配一杯 |
| 21.8–25.1 | 店面夜景 | 今晚，夯一下！／平價串燒．碳烤現做 |
| 25.1–30 | 結尾 | 地址、訂購專線、手機、歡迎來電下單／歡迎點餐外帶 |

## 素材
`media/`：iPhone HDR 影片已轉成 SDR 1080×1920（`grill`、`closeup`、`banner`），照片縮到 1296 寬。
鏡頭順序與文字都寫在 `scene.html` 的 `SHOTS`、`TEXTS`。

## 重新渲染
```bash
pip install imageio-ffmpeg numpy  # ffmpeg 與配樂合成
NODE_PATH=$(npm root -g) node promo/render.mjs   # 需要 playwright
CTA=歡迎點餐外帶 NODE_PATH=$(npm root -g) node promo/render.mjs promo/out/huobar-promo-takeout.mp4
```

## 背景音樂版本
| 版本 | 腳本 | 風格 | 影片 |
|---|---|---|---|
| 第一版 | `music.py` | 台客搖滾，E 大調，150 BPM，破音吉他＋推弦主奏 | `huobar-promo.mp4`、`huobar-promo-takeout.mp4` |
| 第二版 | `music_v2.py` | 台客搖滾＋那卡西，A 小調（Am–F–G–E），155 BPM，電子琴「蹦恰」＋吉他與嗩吶對答 | `huobar-promo-v2.mp4`、`huobar-promo-takeout-v2.mp4` |

第二版渲染：`BGM=v2 NODE_PATH=$(npm root -g) node promo/render.mjs promo/out/huobar-promo-v2.mp4`
