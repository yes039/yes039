"""產生 CapCut 母片用的格位佔位圖（1080×1920）。
每張標出格號、秒數、要放什麼，以及字卡安全區。建母片時匯入，之後逐格「取代」成店家素材。
用法：python3 make_placeholders.py <輸出資料夾> <字型檔>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
SLOTS = {
    "A": [
        ("1", "0–3 秒", "開場", "最吸睛的一張"),
        ("2", "3–6.5 秒", "內容", "招牌菜特寫"),
        ("3", "6.5–10 秒", "內容", "製作過程"),
        ("4", "10–13.5 秒", "內容", "第二道菜"),
        ("5", "13.5–17 秒", "內容", "師傅的手"),
        ("6", "17–20.5 秒", "內容", "第三道菜"),
        ("7", "20.5–24 秒", "內容", "店內氣氛"),
        ("8", "24–30 秒", "片尾", "店門口"),
    ],
    "B": [
        ("1", "0–3 秒", "開場", "聲音最大的一段"),
        ("2", "3–5.5 秒", "快剪", "下鍋"),
        ("3", "5.5–8 秒", "快剪", "大火"),
        ("4", "8–10.5 秒", "快剪", "翻炒"),
        ("5", "10.5–13 秒", "快剪", "調味"),
        ("6", "13–15.5 秒", "快剪", "盛盤"),
        ("7", "15.5–18 秒", "快剪", "上桌"),
        ("8", "18–20.5 秒", "快剪", "拿起來吃"),
        ("9", "20.5–23 秒", "快剪", "店內"),
        ("10", "23–30 秒", "片尾", "店門口"),
    ],
}
COLORS = {"開場": (196, 92, 52), "內容": (70, 110, 150), "快剪": (70, 130, 100), "片尾": (110, 80, 140)}


def draw(tpl, slot, secs, kind, hint, font_path, out):
    img = Image.new("RGB", (W, H), COLORS[kind])
    d = ImageDraw.Draw(img)
    big = ImageFont.truetype(font_path, 220)
    mid = ImageFont.truetype(font_path, 90)
    small = ImageFont.truetype(font_path, 54)
    # 平台介面會蓋住的區域（上 10%、下 20%）畫斜線提醒
    for y0, y1 in ((0, int(H * 0.10)), (int(H * 0.80), H)):
        d.rectangle([0, y0, W, y1], fill=tuple(int(c * 0.6) for c in COLORS[kind]))
    d.text((W / 2, H * 0.05), "這裡會被平台按鈕蓋住，不放字", font=small, fill="white", anchor="mm")
    d.text((W / 2, H * 0.90), "這裡會被平台按鈕蓋住，不放字", font=small, fill="white", anchor="mm")
    # 字卡安全區
    d.rectangle([80, int(H * 0.55), W - 80, int(H * 0.75)], outline="white", width=6)
    d.text((W / 2, H * 0.65), "字卡放在這個框裡", font=small, fill="white", anchor="mm")
    d.text((W / 2, H * 0.22), f"模板 {tpl}｜格 {slot}", font=mid, fill="white", anchor="mm")
    d.text((W / 2, H * 0.34), secs, font=big if len(secs) < 7 else mid, fill="white", anchor="mm")
    d.text((W / 2, H * 0.46), f"{kind}：{hint}", font=mid, fill="white", anchor="mm")
    img.save(out, quality=88)


if __name__ == "__main__":
    out, font = sys.argv[1], sys.argv[2]
    for tpl, slots in SLOTS.items():
        folder = os.path.join(out, f"佔位圖-模板{tpl}")
        os.makedirs(folder, exist_ok=True)
        for slot, secs, kind, hint in slots:
            draw(tpl, slot, secs, kind, hint, font, os.path.join(folder, f"{tpl}{int(slot):02d}.jpg"))
