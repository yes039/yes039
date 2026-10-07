"""A｜一把鏟子，35 年 —— 逐格合成畫面（1080x1920, 30fps），輸出 JPEG 序列。

用法：python3 render.py <素材資料夾> <工作資料夾> [只算某幾格: start end]
素材資料夾＝repo 根目錄（原始照片與影片所在處）。
"""
import os, sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC, WORK = sys.argv[1], sys.argv[2]
W, H, FPS = 1080, 1920, 30
SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
SERIF_R = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
TC = 3  # Noto Serif CJK TC

def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def lerp(a, b, t):
    return a + (b - a) * t

# ---------- 照片：可推拉搖的「鏡頭」 ----------
class Photo:
    def __init__(self, path, pad=1.0):
        im = Image.open(path).convert('RGB')
        self.w, self.h = im.size
        # 外圍用自身模糊、壓暗的版本填滿，鏡頭拉出邊界時不會露黑
        P = int(max(self.w, self.h) * pad)
        bg = im.resize((self.w + 2 * P, self.h + 2 * P), Image.BILINEAR)
        bg = bg.filter(ImageFilter.GaussianBlur(40))
        bg = Image.eval(bg, lambda v: int(v * 0.45))
        bg.paste(im, (P, P))
        self.canvas, self.P = bg, P

    def view(self, cx, cy, vh, clamp=True):
        """以影像座標 (cx, cy) 為中心、可見高度 vh（影像像素）取景。"""
        vw = vh * W / H
        if clamp:  # 盡量不拍出照片邊界
            if vw <= self.w: cx = min(max(cx, vw / 2), self.w - vw / 2)
            if vh <= self.h: cy = min(max(cy, vh / 2), self.h - vh / 2)
        x0, y0 = cx - vw / 2 + self.P, cy - vh / 2 + self.P
        return self.canvas.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + vw, y0 + vh))

# ---------- 影片：預先抽成 1080x1920 JPEG ----------
def clip_frames(name, start, dur):
    out = os.path.join(WORK, 'clips', f'{name}_{start:.2f}')
    if not os.path.isdir(out):
        os.makedirs(out)
        subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-i', os.path.join(SRC, name + '.mp4'),
                        '-t', str(dur + 0.2), '-vf', f'fps={FPS},scale={W}:{H}:flags=lanczos',
                        '-q:v', '2', os.path.join(out, 'f%04d.jpg')], check=True)
    files = sorted(os.listdir(out))
    return [os.path.join(out, f) for f in files]

# ---------- 字 ----------
_font_cache = {}
def font(size, bold=True):
    k = (size, bold)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(SERIF if bold else SERIF_R, size, index=TC)
    return _font_cache[k]

_text_cache = {}
def text_layer(txt, size, bold=True, spacing=0, color=(250, 244, 232)):
    k = (txt, size, bold, spacing)
    if k in _text_cache:
        return _text_cache[k]
    f = font(size, bold)
    # 逐字排，可加字距
    chars = list(txt)
    widths = [f.getlength(c) for c in chars]
    tw = int(sum(widths) + spacing * (len(chars) - 1))
    pad = 40
    lay = Image.new('RGBA', (tw + 2 * pad, size + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('L', lay.size, 0)
    d, ds = ImageDraw.Draw(lay), ImageDraw.Draw(shadow)
    x = pad
    for c, w in zip(chars, widths):
        d.text((x, pad), c, font=f, fill=color + (255,), anchor='la')
        ds.text((x, pad), c, font=f, fill=200, anchor='la')
        x += w + spacing
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    out = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    out.paste((0, 0, 0, 255), (0, 0), shadow)
    out = Image.alpha_composite(out, lay)
    _text_cache[k] = out
    return out

def put_text(frame, txt, size, cy, alpha, bold=True, spacing=0, dy=0, cx=W // 2):
    if alpha <= 0:
        return
    lay = text_layer(txt, size, bold, spacing)
    if alpha < 1:
        a = lay.getchannel('A').point(lambda v: int(v * alpha))
        lay = lay.copy(); lay.putalpha(a)
    x = int(cx - lay.width / 2)
    y = int(cy - lay.height / 2 + dy)
    frame.paste(lay, (x, y), lay)

def fade_in_out(t, t0, t1, fin=0.5, fout=0.5):
    """t0 進場、t1 出場，回傳 0..1。"""
    if t < t0 or t > t1:
        return 0.0
    return min(1.0, (t - t0) / fin if fin else 1.0, (t1 - t) / fout if fout else 1.0)

_band = None
def band(frame, cy, alpha, strength=0.38):
    """字幕後方一條柔和壓暗帶，讓字在雜亂畫面上也讀得清楚。"""
    global _band
    if _band is None:
        y = np.linspace(-1, 1, 360)[:, None]
        x = np.linspace(-1, 1, W)[None, :]
        m = np.exp(-(y / 0.55) ** 2) * (1 - 0.35 * x ** 2)
        _band = (m * 255).astype(np.uint8)
    if alpha <= 0:
        return
    m = Image.fromarray((_band * (alpha * strength)).astype(np.uint8))
    frame.paste((0, 0, 0), (0, int(cy - 180)), m)

def caption(frame, t, txt, t0, t1, cy, size=74, spacing=6, cx=W // 2):
    a = fade_in_out(t, t0, t1, 0.6, 0.5)
    band(frame, cy, a)
    rise = (1 - ease((t - t0) / 0.8)) * 18 if t >= t0 else 0
    put_text(frame, txt, size, cy, a, spacing=spacing, dy=rise, cx=cx)

# ---------- 調色、暗角、顆粒 ----------
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
VIGNETTE = (1 - 0.42 * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None].astype(np.float32)
WARM = np.array([1.035, 1.0, 0.93], np.float32)
rng = np.random.default_rng(7)

def grade(img, warm=1.0, dark=1.0):
    a = np.asarray(img, np.float32)
    a = a * (1 + (WARM - 1) * warm) * VIGNETTE * dark
    a += rng.normal(0, 3.2, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

# ---------- 素材 ----------
wall = Photo(os.path.join(SRC, 'S__2015262_0.jpg'))
room = Photo(os.path.join(SRC, 'S__94625898_0.jpg'))
front = Photo(os.path.join(SRC, 'S__2015260_0.jpg'))

# 牆上十把鏟子的中心（影像座標，依 S__2015262 量測），依年份排序
# 座標＝鏟面（寫年份處）中心
SPATULAS = [
    ('1991 — 1993', 115, 665), ('1994 — 1997', 290, 660), ('1998 — 2000', 465, 665),
    ('2001 — 2003', 635, 675), ('2004 — 2007', 790, 675), ('2008 — 2011', 130, 925),
    ('2012 — 2015', 330, 930), ('2016 — 2019', 535, 925), ('2020 — 2022', 745, 925),
    ('2023 — 2024', 215, 1185),
]
LIFT = 60     # 鏡頭中心比鏟面低一點，讓鏟面落在畫面中上、下方留給字
TIGHT = 640   # 單把鏟子特寫的可見高度

# ---------- 時間軸（秒） ----------
T_S1, T_S2, T_S3, T_S4, T_S5, T_S6, T_S7, T_END = 0.0, 3.5, 10.5, 13.5, 20.6, 26.1, 29.6, 34.6
STEP = (T_S3 - T_S2) / 9  # 9 次移動：1994 … 2023

S4_CLIPS = [('813081980.331421', 0.0, 3.6), ('813081979.197960', 0.3, 3.5)]
S5_CLIPS = [('813070630.558495', 2.0, 3.0), ('813070630.183335', 0.8, 2.5)]
clipcache = {}
def clip_at(clips, t_local):
    acc = 0.0
    for name, st, du in clips:
        if t_local < acc + du or (name, st, du) == clips[-1]:
            k = (name, st)
            if k not in clipcache:
                clipcache[k] = clip_frames(name, st, du)
            fr = clipcache[k]
            i = min(int((t_local - acc) * FPS), len(fr) - 1)
            return Image.open(fr[i]).convert('RGB'), t_local - acc, du
        acc += du

def frame_at(t):
    # S1：1991 那把鏟子，緩慢推近
    if t < T_S2:
        k = ease(t / (T_S2 - T_S1))
        _, cx, cy = SPATULAS[0]
        img = wall.view(cx, cy + LIFT, lerp(TIGHT * 1.12, TIGHT, k))
        img = grade(img)
        caption(img, t, '這面牆上，', 0.5, T_S2 + 0.05, 1180)
        caption(img, t, '掛著 35 年。', 1.5, T_S2 + 0.05, 1290)
        return img, min(1.0, t / 0.6)  # 黑場淡入
    # S2：沿年份一把一把滑過去
    if t < T_S3:
        u = (t - T_S2) / STEP
        i = min(int(u), 8)
        k = ease((u - i) / 0.72)  # 每段 72% 時間移動，其餘停留
        _, x0, y0 = SPATULAS[i]
        _, x1, y1 = SPATULAS[i + 1]
        cx, cy = lerp(x0, x1, k), lerp(y0, y1, k)
        img = grade(wall.view(cx, cy + LIFT, TIGHT))
        label = SPATULAS[i + 1][0] if k > 0.5 else SPATULAS[i][0]
        put_text(img, label, 92, 1300, 1.0, bold=False, spacing=2)
        return img, 1.0
    # S3：拉開，看見整面牆與「創店 1991」
    if t < T_S4:
        k = ease((t - T_S3) / 2.2)
        _, x0, y0 = SPATULAS[-1]
        cx, cy = lerp(x0, 480, k), lerp(y0 + LIFT, 738, k)
        img = grade(wall.view(cx, cy, lerp(TIGHT, 1477, k)))
        # 字放右下，避開左下 2023 那把
        caption(img, t, '十把鏟子，', T_S3 + 0.5, T_S4, 1420, 68, cx=650)
        caption(img, t, '從 1991 排到 2024。', T_S3 + 1.1, T_S4, 1520, 68, cx=650)
        return img, 1.0
    # S4：現場——現在這一把
    if t < T_S5:
        img, tl, du = clip_at(S4_CLIPS, t - T_S4)
        img = grade(img, warm=0.6)
        caption(img, t, '現在這一把，', T_S4 + 1.2, T_S5 - 0.2, 1180)
        caption(img, t, '還在鐵板上。', T_S4 + 2.0, T_S5 - 0.2, 1290)
        return img, 1.0
    # S5：上桌
    if t < T_S6:
        img, tl, du = clip_at(S5_CLIPS, t - T_S5)
        img = grade(img, warm=0.6)
        caption(img, t, '老滋老味，', T_S5 + 1.6, T_S6 + 0.4, 1240, 80, 10)
        return img, 1.0
    # S6：店內
    if t < T_S7:
        k = ease((t - T_S6) / (T_S7 - T_S6))
        img = grade(room.view(lerp(470, 430, k), lerp(900, 930, k), lerp(1700, 1520, k)))
        caption(img, t, '老滋老味，', T_S6 - 0.1, T_S7, 1240, 80, 10)
        caption(img, t, '老吃老想。', T_S6 + 0.4, T_S7, 1350, 80, 10)
        return img, 1.0
    # S7：夜晚店門口＋結尾卡
    k = ease((t - T_S7) / (T_END - T_S7))
    img = grade(front.view(lerp(560, 580, k), lerp(738, 700, k), lerp(1477, 1380, k)), dark=0.9)
    a = fade_in_out(t, T_S7 + 0.9, T_END + 1, 0.9, 0.1)
    band(img, 1400, a, 0.55); band(img, 1500, a, 0.45)
    put_text(img, '宜大鐵板燒', 116, 1400, a, spacing=18)
    put_text(img, '創店 1991', 56, 1530, fade_in_out(t, T_S7 + 1.5, T_END + 1, 0.8, 0.1), bold=False, spacing=12)
    fade_out = min(1.0, (T_END - t) / 0.8)
    return img, fade_out

def main():
    n = int(round(T_END * FPS))
    a, b = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, n)
    out = os.path.join(WORK, 'frames')
    os.makedirs(out, exist_ok=True)
    for i in range(a, b):
        t = i / FPS
        img, lum = frame_at(t)
        if lum < 1:
            img = Image.eval(img, lambda v, l=max(lum, 0): int(v * l))
        img.save(os.path.join(out, f'f{i:04d}.jpg'), quality=93)

if __name__ == '__main__':
    main()
