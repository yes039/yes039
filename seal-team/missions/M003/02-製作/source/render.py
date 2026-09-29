# M003 成片畫面：PIL 逐格繪製 1080×1920 / 30fps，直接 pipe 給 ffmpeg
# 用法：python3 render.py [輸出.mp4] [音訊.wav]      （只要單格預覽：python3 render.py --still 秒數 out.jpg）
import sys, math, subprocess, functools
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1080, 1920, 30, 30.0
SRC = '../../00-素材/'
FONT_B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
TC = 3  # ttc 內的繁中字面

YELLOW = (255, 214, 77); WHITE = (255, 255, 255); INK = (40, 36, 34)
ORANGE = (240, 122, 46); BLUE = (46, 110, 230)

# ── 片尾課程資訊：只放已確定的事實。日期／時間／地點／報名方式拿到後填進 INFO_LINES（每行一筆）
PRICE = '費用 500 元'
INFO_LINES = []                       # 例：['10/18（六）14:00–16:00', '○○社區活動中心']（勿自行杜撰）
INFO_FALLBACK = '上課時間・地點・報名方式請看貼文說明'

@functools.lru_cache(None)
def font(size, bold=True):
    return ImageFont.truetype(FONT_B if bold else FONT_R, size, index=TC)

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_io(x): x = clamp(x); return x * x * (3 - 2 * x)
def back_out(x, k=1.7):
    x = clamp(x); x -= 1; return 1 + x * x * ((k + 1) * x + k)

# ── 照片底圖 ──────────────────────────────────────────────
def load(name): return Image.open(SRC + name).convert('RGB')

def cover_9x16(im):
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; return im.crop((x, 0, x + W, H)), s, x

def fit_width(im, top):
    """3:4 照片：寬度撐滿，上下用同一張照片的模糊放大版補滿，不裁掉任何人物或『AI生成』標示"""
    bg, _, _ = cover_9x16(im)
    bg = bg.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * .55))
    s = W / im.width
    fg = im.resize((W, round(im.height * s)), Image.LANCZOS)
    bg.paste(fg, (0, top)); return bg, s

A01, s01 = fit_width(load('A01-獨自看手機AI.jpg'), 300)
A02, s02, _ = cover_9x16(load('A02-朋友圍看手機驚呼.jpg'))
A03, s03, _ = cover_9x16(load('A03-你也會用AI了.jpg'))
A04, s04, _ = cover_9x16(load('A04-咖啡廳三人一起玩.jpg'))
A05, s05, _ = cover_9x16(load('A05-拍一桌家常菜.jpg'))
# 素材左上角原有「AI生成」標示；以它為縮放錨點，推鏡時標示永遠完整留在畫面內
LBL01 = (80 * s01, 300 + 48 * s01)
LBL = (80 * s02, 48 * s02)

def kenburns(base, t, z0, z1, anchor):
    z = z0 + (z1 - z0) * ease_io(t)
    ax, ay = anchor
    return base.transform((W, H), Image.AFFINE, (1 / z, 0, ax * (1 - 1 / z), 0, 1 / z, ay * (1 - 1 / z)),
                          resample=Image.BICUBIC)

@functools.lru_cache(None)
def gradient(top_a, bot_a):
    """上下壓暗，讓字幕在任何照片上都讀得清楚"""
    g = Image.new('L', (1, H))
    for y in range(H):
        a = 0
        if y < 520: a = top_a * (1 - y / 520) ** 1.6
        if y > 900: a = max(a, bot_a * ((y - 900) / (H - 900)) ** 1.3)
        g.putpixel((0, y), int(a))
    g = g.resize((W, H)); blk = Image.new('RGBA', (W, H), (0, 0, 0, 255)); blk.putalpha(g); return blk

# ── 文字 ────────────────────────────────────────────────
@functools.lru_cache(None)
def text_layer(segs, size, bold=True, shadow=True, stroke=0):
    """segs: ((文字, 顏色), ...) 同一行多色。回傳 RGBA 圖層"""
    f = font(size, bold)
    widths = [f.getlength(s) for s, _ in segs]
    tw = int(sum(widths)); asc, desc = f.getmetrics(); th = asc + desc
    pad = 40
    im = Image.new('RGBA', (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh); x = pad
        for (s, _), w in zip(segs, widths):
            d.text((x, pad + 4), s, font=f, fill=(0, 0, 0, 200), stroke_width=max(stroke, 3), stroke_fill=(0, 0, 0, 200)); x += w
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(9)))
    d = ImageDraw.Draw(im); x = pad
    for (s, c), w in zip(segs, widths):
        d.text((x, pad), s, font=f, fill=c, stroke_width=stroke, stroke_fill=(30, 26, 24)); x += w
    return im

def S(*a):
    """S('一般', ('重點', YELLOW), '一般')"""
    return tuple((x, WHITE) if isinstance(x, str) else x for x in a)

def paste(canvas, layer, cx, cy, alpha=1.0, scale=1.0):
    if alpha <= 0.01: return
    L = layer
    if abs(scale - 1) > 0.005:
        L = L.resize((max(1, int(L.width * scale)), max(1, int(L.height * scale))), Image.BICUBIC)
    if alpha < 0.999:
        L = L.copy(); L.putalpha(L.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.alpha_composite(L, (int(cx - L.width / 2), int(cy - L.height / 2)))

def caption(canvas, t, segs, size, cx, cy, t0, t1, pop=True, stroke=0):
    """t0 進場、t1 退場；進場帶一點彈性放大"""
    if t < t0 or t > t1: return
    a = min(ease_out((t - t0) / .25), ease_out((t1 - t) / .2)) if t1 - t0 > .45 else 1
    sc = (0.86 + 0.14 * back_out((t - t0) / .35)) if pop else 1
    paste(canvas, text_layer(segs, size, True, True, stroke), cx, cy + (1 - ease_out((t - t0) / .3)) * 18, a, sc)

def rrect(d, box, r, fill, outline=None, width=0):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)

# ── 場景 ────────────────────────────────────────────────
# 剪輯點對齊 100 BPM 小節（2.4 s）：0 | 4.8 | 12.0 | 16.8 | 21.6 | 25.2 | 30
def sc1(t):   # Hook：肯定他本來就會用手機 → 丟出問題
    lt = t / 4.8
    c = kenburns(A01, lt, 1.0, 1.06, LBL01).convert('RGBA')
    c.alpha_composite(gradient(150, 190))
    caption(c, t, S('手機，你早就很會用了'), 68, W / 2, 175, .25, 4.8)
    caption(c, t, S('那 ', ('AI', YELLOW), ' 呢？'), 150, W / 2, 1330, 1.55, 4.8, stroke=2)
    caption(c, t, S('聽過很多次，但跟我有什麼關係？'), 52, W / 2, 1490, 2.9, 4.8, pop=False)
    return c

AI_LINES = ['今天自己下廚，清蒸魚、炒青菜⋯', '滿滿一桌家常味。', '吃飯，就是最簡單的幸福！']
US_LINES = ['幫我把今天煮的菜，', '寫成一段臉書分享']

def reveal(lines, n):
    out = []
    for l in lines:
        if n <= 0: break
        out.append(l[:n]); n -= len(l)
    return out

def wrap(text, f, maxw):
    lines, cur = [], ''
    for ch in text:
        if f.getlength(cur + ch) > maxw and cur:
            if ch in '，。！、⋯': cur += ch; lines.append(cur); cur = ''; continue
            lines.append(cur); cur = ch
        else: cur += ch
    if cur: lines.append(cur)
    return lines

def mic(d, cx, cy, s, col):
    d.rounded_rectangle((cx - 9 * s, cy - 20 * s, cx + 9 * s, cy + 6 * s), 9 * s, fill=col)
    d.arc((cx - 15 * s, cy - 10 * s, cx + 15 * s, cy + 14 * s), 0, 180, fill=col, width=int(3.5 * s))
    d.line((cx, cy + 14 * s, cx, cy + 22 * s), fill=col, width=int(3.5 * s))

def chat_card(c, t):
    """示意用的通用 AI 對話畫面（不指涉任何品牌 App）"""
    t0 = 6.0
    if t < t0: return
    k = ease_out((t - t0) / .4)
    card = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
    x0, x1, y0 = 60, W - 60, 1040 + (1 - k) * 160
    f = font(46); fr = font(44, False)
    # 高度先算好
    ai_lines = AI_LINES; us_lines = US_LINES
    lh = 64
    h = 36 + 64 + 26 + (len(us_lines) * lh + 44) + 26 + (len(ai_lines) * lh + 44) + 36
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 16, x1, y0 + h + 16), 46, fill=(0, 0, 0, 120))
    card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    rrect(d, (x0, y0, x1, y0 + h), 46, (255, 253, 248, 250))
    # 標題列：麥克風＋「不用打字，用說的就好」
    y = y0 + 36
    d.ellipse((x0 + 36, y, x0 + 36 + 64, y + 64), fill=ORANGE); mic(d, x0 + 68, y + 32, 1.05, WHITE)
    d.text((x0 + 120, y + 30), '不用打字，用說的就好', font=f, fill=ORANGE, anchor='lm')
    y += 64 + 26
    # 使用者語音泡泡（右）
    ts = t - 6.35
    shown = reveal(US_LINES, int(sum(map(len, US_LINES)) * clamp(ts / 1.4)))
    bh = len(us_lines) * lh + 44
    bw = max((fr.getlength(l) for l in us_lines)) + 60
    bx1 = x1 - 36; bx0 = bx1 - bw
    if ts > 0:
        rrect(d, (bx0, y, bx1, y + bh), 34, (255, 232, 204))
        if ts < 1.5:   # 聲波
            for i in range(9):
                amp = (0.35 + 0.65 * abs(math.sin(t * 9 + i * 1.3))) * 26
                xx = bx0 - 40 - i * 14
                d.line((xx, y + bh / 2 - amp, xx, y + bh / 2 + amp), fill=ORANGE, width=6)
        for i, l in enumerate(shown):
            d.text((bx0 + 30, y + 22 + i * lh + 4), l, font=fr, fill=INK)
    y += bh + 26
    # AI 回覆泡泡（左）
    ta = t - 7.95
    if ta > 0:
        ax = x0 + 36
        d.ellipse((ax, y, ax + 64, y + 64), fill=BLUE)
        d.text((ax + 32, y + 32), 'AI', font=font(30), fill=WHITE, anchor='mm')
        bx0 = ax + 84; bh = len(ai_lines) * lh + 44
        rrect(d, (bx0, y, x1 - 36, y + bh), 34, (236, 241, 250))
        if ta < .55:   # 思考中的三個點
            for i in range(3):
                yy = y + 50 - 8 * max(0, math.sin(ta * 14 - i * .9))
                d.ellipse((bx0 + 34 + i * 34, yy - 9, bx0 + 52 + i * 34, yy + 9), fill=(150, 160, 180))
        else:
            n = int(sum(map(len, AI_LINES)) * clamp((ta - .55) / 2.1))
            for i, l in enumerate(reveal(AI_LINES, n)):
                d.text((bx0 + 30, y + 22 + i * lh + 4), l, font=fr, fill=INK)
    if k < 1: card.putalpha(card.getchannel('A').point(lambda v: int(v * k)))
    c.alpha_composite(card)

def sc2(t):   # 拍菜 → 用說的 → AI 寫好分享
    lt = (t - 4.8) / 7.2
    c = kenburns(A05, lt, 1.0, 1.08, LBL).convert('RGBA')
    c.alpha_composite(gradient(170, 120))
    caption(c, t, S('拍下今天煮的菜'), 76, W / 2, 250, 4.95, 10.75)
    caption(c, t, S('一段生活分享，', ('就寫好了！', YELLOW)), 76, W / 2, 250, 10.8, 12.0)
    chat_card(c, t)
    if t < 5.05:   # 快門閃光
        fl = Image.new('RGBA', (W, H), (255, 255, 255, int(255 * (1 - (t - 4.8) / .25))))
        c.alpha_composite(fl)
    return c

CHIPS = [('旅行照片', '寫成遊記'), ('老照片', '說出家的故事'), ('腦袋裡的想法', '幫你整理成文字')]

@functools.lru_cache(None)
def chip_layer(a, b):
    fa, fb = font(50), font(50)
    w = int(fa.getlength(a) + fb.getlength('  →  ') + fb.getlength(b)) + 100
    im = Image.new('RGBA', (w + 60, 150), (0, 0, 0, 0))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((30, 36, 30 + w, 36 + 96), 48, fill=(0, 0, 0, 110))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im); rrect(d, (30, 26, 30 + w, 26 + 96), 48, (255, 253, 248, 245))
    x = 80
    d.text((x, 74), a, font=fa, fill=INK, anchor='lm'); x += fa.getlength(a)
    d.text((x, 74), '  →  ', font=fb, fill=ORANGE, anchor='lm'); x += fb.getlength('  →  ')
    d.text((x, 74), b, font=fb, fill=ORANGE, anchor='lm')
    return im

def sc3(t):   # 還能這樣玩 → 好像沒那麼難
    lt = (t - 12.0) / 4.8
    c = kenburns(A04, lt, 1.07, 1.0, LBL).convert('RGBA')
    c.alpha_composite(gradient(170, 200))
    caption(c, t, S('還能這樣玩'), 80, W / 2, 250, 12.1, 14.55)
    for i, (a, b) in enumerate(CHIPS):
        t0 = 12.3 + i * .6
        if t0 <= t <= 14.6:
            k = back_out((t - t0) / .4); al = min(ease_out((t - t0) / .2), ease_out((14.6 - t) / .2))
            paste(c, chip_layer(a, b), W / 2 + (1 - ease_out((t - t0) / .4)) * 120, 1110 + i * 150, al, .8 + .2 * k)
    caption(c, t, S('好像⋯'), 80, W / 2, 1180, 14.6, 16.8)
    caption(c, t, S(('沒有想像中那麼難', YELLOW), '耶！'), 86, W / 2, 1320, 14.95, 16.8, stroke=2)
    return c

def sc4(t):   # 做出來 → 傳給朋友（素材本身就有「你也會用 AI 了？」）
    lt = (t - 16.8) / 4.8
    c = kenburns(A03, lt, 1.0, 1.06, LBL).convert('RGBA')
    c.alpha_composite(gradient(120, 190))
    caption(c, t, S('自己做的，', ('傳給朋友看', YELLOW)), 80, W / 2, 1480, 17.05, 21.6, stroke=2)
    return c

def sparkle(d, x, y, r, a):
    col = (255, 236, 150, int(255 * a))
    d.polygon([(x, y - r), (x + r * .22, y - r * .22), (x + r, y), (x + r * .22, y + r * .22), (x, y + r),
               (x - r * .22, y + r * .22), (x - r, y), (x - r * .22, y - r * .22)], fill=col)

SPARK = [(150, 560, 30, 0), (930, 470, 38, .15), (820, 900, 24, .3), (240, 980, 26, .45), (560, 380, 22, .2),
         (980, 760, 20, .5), (90, 780, 18, .35)]

def sc5(t):   # 情緒高點：欸，我自己真的會了
    lt = (t - 21.6) / 3.6
    c = kenburns(A02, lt, 1.0, 1.07, LBL).convert('RGBA')
    c.alpha_composite(gradient(120, 215))
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for x, y, r, dl in SPARK:
        u = (t - 21.7 - dl) / 1.2
        if 0 < u < 1: sparkle(d, x, y - u * 40, r * (0.5 + math.sin(u * math.pi)), math.sin(u * math.pi))
    c.alpha_composite(lay)
    caption(c, t, S('欸，'), 84, W / 2 - 250, 1225, 21.75, 25.2)
    caption(c, t, S('我自己', ('真的會了！', YELLOW)), 116, W / 2, 1360, 22.0, 25.2, stroke=3)
    caption(c, t, S('學會了，還能教朋友一起玩'), 56, W / 2, 1505, 23.1, 25.2, pop=False)
    return c

@functools.lru_cache(None)
def end_bg():
    bg = A04.filter(ImageFilter.GaussianBlur(26)).convert('RGBA')
    bg.alpha_composite(Image.new('RGBA', (W, H), (38, 24, 14, 175)))
    return bg

def sc6(t):   # 片尾：課程名＋已確定資訊
    c = end_bg().copy(); d = ImageDraw.Draw(c)
    u = t - 25.2
    caption(c, t, S('給 60+ 的你'), 56, W / 2, 470, 25.3, 30.5, pop=False)
    caption(c, t, S(('AI 生活體驗課', YELLOW)), 118, W / 2, 620, 25.45, 30.5, stroke=2)
    caption(c, t, S('不是電腦課・是親手操作'), 54, W / 2, 780, 25.8, 30.5, pop=False)
    caption(c, t, S('第一次把 AI 用進生活'), 54, W / 2, 860, 25.95, 30.5, pop=False)
    if u > 1.0:   # 費用徽章
        k = back_out((u - 1.0) / .45)
        b = Image.new('RGBA', (620, 170), (0, 0, 0, 0)); bd = ImageDraw.Draw(b)
        rrect(bd, (10, 10, 610, 160), 80, ORANGE)
        bd.text((310, 85), PRICE, font=font(78), fill=WHITE, anchor='mm')
        paste(c, b, W / 2, 1070, ease_out((u - 1.0) / .2), .7 + .3 * k)
    lines = INFO_LINES or [INFO_FALLBACK]
    for i, l in enumerate(lines):
        caption(c, t, S(l), 48 if INFO_LINES else 46, W / 2, 1245 + i * 72, 26.8 + i * .12, 30.5, pop=False)
    if not INFO_LINES and u > 1.8:   # 往下指向貼文
        yy = 1350 + 10 * math.sin(u * 6)
        d.polygon([(W / 2 - 30, yy), (W / 2 + 30, yy), (W / 2, yy + 34)], fill=YELLOW)
    d.text((40, 60), '照片為 AI 生成示意', font=font(28, False), fill=(255, 255, 255, 150))
    if u < .45:   # 由上一景溶接
        return c, 1 - ease_io(u / .45)
    return c, 0

def frame(t):
    if t < 4.8: return sc1(t)
    if t < 12.0: return sc2(t)
    if t < 16.8:
        c = sc3(t)
        if t > 16.55:   # 溶接到下一景
            n = sc4(16.8); return Image.blend(c, n, ease_io((t - 16.55) / .25))
        return c
    if t < 21.6: return sc4(t)
    if t < 25.2: return sc5(t)
    c, mix = sc6(t)
    if mix > 0: return Image.blend(c, sc5(25.19), mix)
    return c

if __name__ == '__main__':
    if sys.argv[1] == '--still':
        frame(float(sys.argv[2])).convert('RGB').save(sys.argv[3], quality=92); sys.exit()
    out = sys.argv[1]; aud = sys.argv[2]
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                          '-r', str(FPS), '-i', '-', '-i', aud, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
                          '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '192k',
                          '-movflags', '+faststart', '-shortest', out], stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)):
        p.stdin.write(frame(i / FPS).convert('RGB').tobytes())
        if i % 90 == 0: print('frame', i, flush=True)
    p.stdin.close(); p.wait(); print('done', out)
