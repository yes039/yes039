# 普宜精舍 20 週年・梁皇寶懺法會 68 秒直式影片（1080×1920、30fps）
# 用法：python3 render.py <素材資料夾> <music.wav> <輸出.mp4>
import sys, subprocess, numpy as np
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 68.0
XF = 0.8  # 溶接秒數
SERIF_B = ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc", 3)
SERIF_R = ("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 3)
GOLD, CREAM = (236, 196, 112), (255, 246, 228)
SRC = sys.argv[1] if len(sys.argv) > 1 else "../../00-素材"

def font(spec, size): return ImageFont.truetype(spec[0], size, index=spec[1])

# (素材, 開始, 長度, 模式, 運鏡(起點 cx,cy,zoom → 終點), 主字幕, 副字幕)
SHOTS = [
    ("01", 0.0, 7.0, "cover", ((0.55, 0.42, 1.18), (0.52, 0.36, 1.02)), None, None),
    ("02", 7.0, 6.0, "cover", ((0.50, 0.55, 1.00), (0.50, 0.50, 1.10)), "法門無量誓願學", "眾生無邊誓願度"),
    ("03", 13.0, 6.0, "cover", ((0.50, 0.40, 1.12), (0.50, 0.36, 1.00)), "彌勒菩薩", "笑迎十方善信"),
    ("09", 19.0, 6.0, "cover", ((0.45, 0.62, 1.00), (0.43, 0.38, 1.10)), "觀音慈悲", "千處祈求千處應"),
    ("05", 25.0, 7.0, "cover", ((0.60, 0.40, 1.10), (0.45, 0.42, 1.00)), "大雄寶殿", "大眾雲集・虔誠禮懺"),
    ("06", 32.0, 8.0, "fit",   ((0.55, 0.36, 1.00), (0.58, 0.48, 1.22)), "梁皇寶懺", "千年慈悲的召喚・諸懺中之王"),
    ("10", 40.0, 7.0, "fit",   ((0.50, 0.30, 1.00), (0.50, 0.40, 1.15)), "十事供養", "香 花 燈 塗 果 茶 食 寶 珠 衣"),
    ("07", 47.0, 5.0, "cover", ((0.45, 0.50, 1.12), (0.50, 0.45, 1.00)), "花供養", "處世如花・見者歡喜"),
    ("04", 52.0, 5.0, "cover", ((0.55, 0.40, 1.00), (0.50, 0.42, 1.10)), "身心清淨", "業障消除・善根增長"),
    ("08", 57.0, 5.5, "cover", ((0.50, 0.55, 1.00), (0.50, 0.40, 1.10)), "點燈祈福", "祈求闔府平安・為至親延壽禳災"),
    ("02", 62.5, 5.5, "end",   ((0.50, 0.50, 1.10), (0.50, 0.50, 1.00)), None, None),
]

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)

def vignette():
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W * 0.75)) ** 2 + ((y - H / 2) / (H * 0.7)) ** 2)
    return np.clip(1 - 0.45 * d ** 2.2, 0.45, 1)[..., None].astype(np.float32)

def bottom_shade():
    y = np.arange(H) / H
    a = np.clip((y - 0.62) / 0.38, 0, 1) ** 1.3 * 0.78
    return a[:, None, None].astype(np.float32)

def text_layer(lines):
    """lines: [(文字, 字型, 大小, 顏色, y, 字距)] → RGBA 圖層（含柔和陰影）"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(img), ImageDraw.Draw(sh)
    for txt, spec, size, col, y, sp in lines:
        f = font(spec, size)
        widths = [d.textlength(c, font=f) for c in txt]
        total = sum(widths) + sp * (len(txt) - 1)
        x = (W - total) / 2
        for c, w in zip(txt, widths):
            ds.text((x + 3, y + 4), c, font=f, fill=(0, 0, 0, 200))
            d.text((x, y), c, font=f, fill=col + (255,))
            x += w + sp
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(sh, img)

def deco_line(img, y, half=150):
    d = ImageDraw.Draw(img)
    cx = W // 2
    d.line([(cx - half, y), (cx - 22, y)], fill=GOLD + (230,), width=3)
    d.line([(cx + 22, y), (cx + half, y)], fill=GOLD + (230,), width=3)
    d.regular_polygon((cx, y, 10), 4, fill=GOLD + (255,))
    return img

def caption(main, sub):
    lay = text_layer([(main, SERIF_B, 92, CREAM, 1530, 14), (sub, SERIF_R, 50, GOLD, 1695, 6)])
    return deco_line(lay, 1665)

def title_card():
    lay = text_layer([
        ("普宜精舍", SERIF_B, 120, CREAM, 1260, 24),
        ("二十週年", SERIF_R, 62, GOLD, 1430, 30),
        ("啟建 梁皇寶懺法會", SERIF_B, 84, CREAM, 1580, 10),
    ])
    return deco_line(lay, 1545, 200)

def end_card():
    lay = text_layer([
        ("普宜精舍", SERIF_B, 132, CREAM, 560, 26),
        ("二十週年", SERIF_R, 66, GOLD, 745, 34),
        ("梁皇寶懺法會", SERIF_B, 104, CREAM, 900, 14),
        ("冥陽兩利 法雨均霑", SERIF_R, 58, GOLD, 1110, 12),
        ("隨喜參加 功德無量", SERIF_R, 58, CREAM, 1210, 12),
        ("洽詢電話 (03) 933-4423", SERIF_R, 46, (230, 220, 200), 1440, 2),
    ])
    deco_line(lay, 1065, 220)
    return lay

class Shot:
    def __init__(self, spec):
        self.key, self.t0, self.dur, self.mode, self.move, main, sub = spec
        src = Image.open(f"{SRC}/{self.key}.jpg").convert("RGB")
        if self.mode == "cover":
            s = H * 1.25 / src.height
            self.img = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
            self.bg = None
        else:
            # 背景：模糊壓暗的全幅；前景：整張照片置中（看得到完整看板）
            s = H / src.height
            bg = src.resize((round(src.width * s), H), Image.LANCZOS)
            bg = bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H)).filter(ImageFilter.GaussianBlur(40))
            k = 0.55 if self.mode == "end" else 0.6
            self.bg = Image.eval(bg, lambda v: int(v * k))
            if self.mode == "fit":
                fw = 1000; fh = round(src.height * fw / src.width)
                self.img = src.resize((round(fw * 1.25), round(fh * 1.25)), Image.LANCZOS)
                self.fit = (fw, fh)
        if self.key == "01" and self.t0 == 0:
            self.overlay = title_card()
        elif self.mode == "end":
            self.overlay = end_card()
        else:
            self.overlay = caption(main, sub) if main else None

    def frame(self, t):
        p = ease((t - self.t0 + XF / 2) / (self.dur + XF))
        (ax, ay, az), (bx, by, bz) = self.move
        cx, cy, z = ax + (bx - ax) * p, ay + (by - ay) * p, az + (bz - az) * p
        if self.mode == "cover":
            iw, ih = self.img.size
            base = max(W / iw, H / ih)
            cw, ch = W / (base * z), H / (base * z)
            x0 = min(max(cx * iw - cw / 2, 0), iw - cw); y0 = min(max(cy * ih - ch / 2, 0), ih - ch)
            out = self.img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)
        elif self.mode == "fit":
            fw, fh = self.fit
            out = self.bg.copy()
            iw, ih = self.img.size
            # 前景框高度上限 1500，超過就以縮放＋平移呈現
            vw, vh = fw, min(fh, 1460)
            cw, ch = iw * vw / fw / z, ih * vh / fh / z
            x0 = min(max(cx * iw - cw / 2, 0), iw - cw); y0 = min(max(cy * ih - ch / 2, 0), ih - ch)
            fg = self.img.transform((vw, vh), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)
            px, py = (W - vw) // 2, 70
            shadow = Image.new("L", (W, H), 0)
            ImageDraw.Draw(shadow).rectangle((px - 6, py - 6, px + vw + 6, py + vh + 6), fill=170)
            out.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
            out.paste(fg, (px, py))
            ImageDraw.Draw(out).rectangle((px - 4, py - 4, px + vw + 3, py + vh + 3), outline=GOLD, width=3)
        else:  # end
            out = self.bg
        return np.asarray(out, dtype=np.float32)

    def text_alpha(self, t):
        a = ease((t - self.t0 - 0.35) / 0.7)
        if self.mode != "end":
            a *= ease((self.t0 + self.dur - 0.2 - t) / 0.5)
        return a

def init():
    global shots, VIG, SHADE, OV
    shots = [Shot(s) for s in SHOTS]
    VIG, SHADE = vignette(), bottom_shade()
    OV = [None if s.overlay is None else np.asarray(s.overlay, dtype=np.float32) / 255 for s in shots]

def render(fi):
    t = fi / FPS
    acc = np.zeros((H, W, 3), np.float32)
    total = 0.0
    for i, s in enumerate(shots):
        a0 = ease((t - (s.t0 - XF / 2)) / XF) if i > 0 else 1.0
        a1 = ease(((s.t0 + s.dur + XF / 2) - t) / XF) if i < len(shots) - 1 else 1.0
        w = min(a0, a1)
        if w <= 0: continue
        f = s.frame(t) * VIG
        if s.overlay is not None or s.mode == "end":
            ta = s.text_alpha(t)
            if s.mode != "end": f = f * (1 - SHADE * max(ta, 0.55))
            if OV[i] is not None and ta > 0:
                al = OV[i][..., 3:4] * ta
                f = f * (1 - al) + OV[i][..., :3] * 255 * al
        acc += f * w; total += w
    acc /= max(total, 1e-6)
    # 開頭淡入、結尾淡出
    acc *= min(1, t / 0.8, (DUR - t) / 1.2)
    grain = np.random.default_rng(fi).normal(0, 1.2, (H, W, 1)).astype(np.float32)
    return np.clip(acc + grain, 0, 255).astype(np.uint8).tobytes()

if __name__ == "__main__":
    music, out = sys.argv[2], sys.argv[3]
    n = int(DUR * FPS)
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-", "-i", music, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
        "-t", str(DUR), "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    with Pool(4, initializer=init) as pool:
        for k, buf in enumerate(pool.imap(render, range(n), chunksize=8)):
            ff.stdin.write(buf)
            if k % 300 == 0: print(f"{k}/{n}", flush=True)
    ff.stdin.close(); ff.wait()
