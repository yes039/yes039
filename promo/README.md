# 夯Bar串燒 宣傳影片（9:16 直式，30 秒）

成品：`out/huobar-promo.mp4`（1080×1920、30fps，背景音為烤台原聲）

| 秒數 | 畫面 | 文字 |
|---|---|---|
| 0–3 | 烤台影片 | 夯 Bar 串燒（開場） |
| 3–5.4 | 串燒特寫影片 | 炭火直烤／香到犯規 |
| 5.4–7.6 | 備料照片 | 新鮮備料 |
| 7.6–12 | 烤串照片×2 | 一串一串／現點現烤／用心顧火 |
| 12–16.5 | 招牌影片 | 這裡有酒有菜 🍻 |
| 16.5–19.7 | 烤台影片 | 下班後／來一串／配一杯 |
| 19.7–23 | 店面夜景 | 今晚，夯一下！ |
| 23–30 | 結尾 | 地址、訂位專線、手機、歡迎訂位 |

## 素材
`media/`：iPhone HDR 影片已轉成 SDR 1080×1920（`grill`、`closeup`、`banner`），照片縮到 1296 寬。
鏡頭順序與文字都寫在 `scene.html` 的 `SHOTS`、`TEXTS`。

## 重新渲染
```bash
pip install imageio-ffmpeg        # 取得 ffmpeg
NODE_PATH=$(npm root -g) node promo/render.mjs   # 需要 playwright
```
