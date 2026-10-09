"""羅東城隍廟 9:16 一分鐘短片：Ken Burns 推移 + 交叉淡化 + 標題 / 字幕。

逐格以 PIL 合成，原始 RGB 串流給 ffmpeg 編碼。
用法：python3 video.py <photos_dir> <music.wav> <out.mp4>
"""
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H, FPS = 1080, 1920, 30
TOTAL = 60.0
XF = 0.5  # 交叉淡化秒數
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

# (照片編號, 字幕, 運鏡)  運鏡：in 推近 / out 拉遠 / left / right 平移
SHOTS = [
    ("10", "", "in"),
    ("07", "千盞紅燈　國泰民安", "out"),
    ("06", "香火綿延　庇佑一方", "in"),
    ("04", "雕梁畫棟　古韻猶存", "right"),
    ("12", "城隍令旗　威靈顯赫", "left"),
    ("23", "恩威並濟　澤被群生", "in"),
    ("03", "肅靜迴避　神威莊嚴", "out"),
    ("18", "國泰民安　風調雨順", "right"),
    ("21", "古鐘聲聲　警醒人心", "in"),
    ("19", "法鼓悠悠　歲月見證", "left"),
    ("13", "謝將軍　七爺守護", "in"),
    ("16", "范將軍　八爺巡察", "in"),
    ("22", "大眾爺　護佑眾生", "out"),
    ("20", "註生娘娘　祈子求安", "out"),
    ("02", "誠心求籤　指點迷津", "in"),
    ("15", "擲筊問神　聖意自明", "right"),
    ("01", "百格籤櫃　歲月留痕", "out"),
    ("17", "備妥金紙　敬奉神明", "left"),
    ("05", "金亭焚香　心意上達", "in"),
    ("11", "", "out"),
]
N = len(SHOTS)
CLIP = (TOTAL + (N - 1) * XF) / N  # 每段長度（含重疊）


def font(size):
    return ImageFont.truetype(FONT, size)


def load(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    # 先放大到覆蓋 9:16 再留 18% 餘裕供運鏡
    s = max(W / im.width, H / im.height) * 1.18
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def frame_of(im, move, p):
    """p: 0→1 進度。回傳 W×H 畫面（仿射取樣，子像素平滑）。"""
    p = p * p * (3 - 2 * p)  # smoothstep
    iw, ih = im.size
    base = max(W / iw, H / ih)  # 剛好覆蓋時的取樣比例
    zoom = {"in": 1.0 + 0.12 * p, "out": 1.12 - 0.12 * p}.get(move, 1.06)
    vw, vh = W / (base * zoom * iw) * iw, H / (base * zoom * ih) * ih
    cx, cy = iw / 2, ih / 2
    if move in ("left", "right"):
        span = (iw - vw) / 2 * 0.9
        cx += span * (2 * p - 1) * (1 if move == "right" else -1)
    x0, y0 = cx - vw / 2, cy - vh / 2
    sx = vw / W
    return im.transform((W, H), Image.AFFINE, (sx, 0, x0, 0, sx, y0), Image.BICUBIC)


def text_layer(lines, y, sizes, fill, stroke=6, band=True):
    """回傳 RGBA 文字層（含柔和底帶）。lines 與 sizes 等長。"""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    boxes, yy = [], y
    for line, sz in zip(lines, sizes):
        f = font(sz)
        bw = d.textlength(line, font=f)
        boxes.append((line, f, (W - bw) / 2, yy))
        yy += sz * 1.35
    if band:
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(b).rounded_rectangle((60, y - 40, W - 60, yy + 10), 40, fill=(0, 0, 0, 120))
        layer = Image.alpha_composite(b.filter(ImageFilter.GaussianBlur(18)), layer)
        d = ImageDraw.Draw(layer)
    for line, f, x, ty in boxes:
        d.text((x, ty), line, font=f, fill=fill, stroke_width=stroke, stroke_fill=(40, 10, 0))
    return layer


GOLD = (255, 214, 120)
WHITE = (255, 248, 235)


def overlays():
    out = []
    for i, (_, cap, _) in enumerate(SHOTS):
        if i == 0:
            out.append(text_layer(["羅東城隍廟", "宜蘭 · 羅東"], 260, [150, 64], GOLD, 8))
        elif i == N - 1:
            out.append(text_layer(["羅東城隍廟", "祈願平安　闔家吉祥"], 760, [130, 70], GOLD, 8))
        else:
            out.append(text_layer([cap], 1430, [78], WHITE, 5))
    return out


def alpha_at(t_local, last=False):
    """字幕在每段內淡入淡出；片尾字卡不淡出，交給整體淡黑。"""
    a = min(1, max(0, (t_local - 0.35) / 0.4))
    return a if last else min(a, max(0, (CLIP - 0.25 - t_local) / 0.4))


def main(photos, music, out):
    imgs = [load(f"{photos}/{s[0]}.jpg") for s in SHOTS]
    texts = overlays()
    ff = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-", "-i", music, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium",
        "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
        "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    step = CLIP - XF
    total_frames = int(TOTAL * FPS)
    for fi in range(total_frames):
        t = fi / FPS
        k = min(N - 1, int(t // step))
        layers = []
        for j in (k - 1, k, k + 1):
            if 0 <= j < N:
                tl = t - j * step
                if 0 <= tl < CLIP:
                    layers.append((j, tl))
        canvas = None
        for j, tl in layers:
            fr = frame_of(imgs[j], SHOTS[j][2], tl / CLIP).convert("RGBA")
            a = alpha_at(tl, j == N - 1)
            if a > 0:
                tx = texts[j]
                if a < 1:
                    tx = tx.copy()
                    tx.putalpha(tx.getchannel("A").point(lambda v, a=a: int(v * a)))
                fr = Image.alpha_composite(fr, tx)
            if canvas is None:
                canvas = fr
            else:
                mix = min(1, tl / XF)  # 新段淡入
                canvas = Image.blend(canvas, fr, mix)
        # 片尾淡出黑
        if t > TOTAL - 0.6:
            canvas = Image.blend(canvas, Image.new("RGBA", (W, H), (0, 0, 0, 255)), (t - (TOTAL - 0.6)) / 0.6)
        ff.stdin.write(canvas.convert("RGB").tobytes())
        if fi % 300 == 0:
            print(f"frame {fi}/{total_frames}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("done", out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
