"""玉尊宮 天公廟祈福 消災 補運法會 — 30 秒直式短影片產生器

用法: pip install pillow numpy imageio-ffmpeg && python3 make_video.py
輸出: yuzun_blessing_30s.mp4 (1080x1920, 30fps, 30 秒)
"""
import os
import subprocess
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, DUR = 1080, 1920, 30, 30.0
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
GOLD = (255, 214, 102)
RED = (150, 10, 10)

# (照片, 起點/終點取景 (cx, cy, zoom), 主標, 副標)
SCENES = [
    ("1_hall.jpg", (0.5, 0.45, 1.0), (0.5, 0.35, 1.18), "宜蘭天公廟", "草湖 玉尊宮"),
    ("2_plaque.jpg", (0.5, 0.40, 1.20), (0.5, 0.30, 1.0), "玉皇上帝 天公祖", "神恩浩蕩 庇佑眾生"),
    ("3_offerings.jpg", (0.5, 0.55, 1.0), (0.5, 0.65, 1.2), "祈福 · 消災", "誠心供奉 金紙鮮果"),
    ("4_rice.jpg", (0.5, 0.70, 1.2), (0.5, 0.55, 1.0), "補運法會", "米糕桂圓 好運圓滿"),
    ("5_incense.jpg", (0.45, 0.55, 1.0), (0.55, 0.50, 1.15), "國泰民安", "闔家平安 事事順心"),
]
SEG = DUR / len(SCENES)  # 每幕 6 秒
XF = 0.8  # 轉場秒數
OVS = 1.25  # 取景用超取樣倍率，避免放大模糊


def font(size):
    return ImageFont.truetype(FONT, size)


def cover(img):
    """放大到可覆蓋 9:16 並保留 zoom 空間。"""
    s = max(W / img.width, H / img.height) * OVS
    return img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS), s


def frame_of(base, a, b, t):
    e = t * t * (3 - 2 * t)
    cx, cy, z = (a[i] + (b[i] - a[i]) * e for i in range(3))
    cw, ch = W * OVS / z, H * OVS / z
    x0 = min(max(cx * base.width - cw / 2, 0), base.width - cw)
    y0 = min(max(cy * base.height - ch / 2, 0), base.height - ch)
    return base.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def text_layer(title, sub):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ft, fs = font(132), font(64)
    y = 1330
    for txt, f, fill, sw, yy in ((title, ft, GOLD, 8, y), (sub, fs, (255, 255, 255), 5, y + 190)):
        tw = d.textlength(txt, font=f)
        d.text(((W - tw) / 2, yy), txt, font=f, fill=fill, stroke_width=sw, stroke_fill=RED)
    glow = layer.filter(ImageFilter.GaussianBlur(14))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(layer)
    return out


def static_overlay():
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W), np.float32)
    ys = np.arange(H, dtype=np.float32)
    a += np.clip((ys - 1100) / 820, 0, 1)[:, None] * 190  # 底部暗化
    a += np.clip((320 - ys) / 320, 0, 1)[:, None] * 150  # 頂部暗化
    ov.putalpha(Image.fromarray(a.astype(np.uint8)))
    d = ImageDraw.Draw(ov)
    # 頂部活動名稱
    f = font(58)
    txt = "玉尊宮 天公廟祈福 消災補運法會"
    tw = d.textlength(txt, font=f)
    d.rounded_rectangle(((W - tw) / 2 - 36, 90, (W + tw) / 2 + 36, 190), 50, fill=(160, 16, 16, 215), outline=GOLD + (255,), width=4)
    d.text(((W - tw) / 2, 108), txt, font=f, fill=GOLD)
    # 邊框
    d.rectangle((24, 24, W - 25, H - 25), outline=GOLD + (170,), width=3)
    return ov


def ending_layer():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for txt, size, y, fill in (("歡迎善信大德", 76, 740, (255, 255, 255)), ("蒞臨參拜 共沐神恩", 76, 850, (255, 255, 255)),
                               ("宜蘭天公廟 草湖玉尊宮", 64, 1010, GOLD)):
        f = font(size)
        tw = d.textlength(txt, font=f)
        d.text(((W - tw) / 2, y), txt, font=f, fill=fill, stroke_width=5, stroke_fill=RED)
    return layer


def make_audio(path):
    sr = 44100
    t = np.arange(int(sr * DUR)) / sr
    # 低沉的五聲音階持續音
    drone = sum(np.sin(2 * np.pi * f * t) * g for f, g in ((110, .25), (164.8, .15), (220, .10), (329.6, .05)))
    drone *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * t)
    out = drone * 0.35
    # 每幕開頭敲一聲銅鐘/磬
    for k in range(len(SCENES) + 1):
        st = int(k * SEG * sr) if k < len(SCENES) else int((DUR - 3.5) * sr)
        n = len(t) - st
        tt = np.arange(n) / sr
        bell = sum(np.sin(2 * np.pi * 523.25 * r * tt) * g * np.exp(-tt * d)
                   for r, g, d in ((1, .5, 1.2), (2.76, .25, 2.5), (5.4, .12, 4), (0.5, .3, 0.8)))
        out[st:] += bell * 0.5
    # 五聲旋律 (宮商角徵羽)
    notes = [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440]
    for i in range(int(DUR / 1.5)):
        st = int((0.75 + i * 1.5) * sr)
        n = min(int(1.4 * sr), len(t) - st)
        if n <= 0:
            break
        tt = np.arange(n) / sr
        f = notes[i % len(notes)] * (0.5 if i % 4 == 3 else 1)
        env = np.minimum(tt / 0.02, 1) * np.exp(-tt * 3)
        out[st:st + n] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * env * 0.18
    fade = np.minimum(1, np.minimum(t / 1.0, (DUR - t) / 2.0))
    out = out * fade
    out = out / np.abs(out).max() * 0.8
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    out_mp4 = os.path.join(HERE, "yuzun_blessing_30s.mp4")
    wav = os.path.join(HERE, "_audio.wav")
    make_audio(wav)

    bases = [cover(Image.open(os.path.join(HERE, "photos", s[0])).convert("RGB"))[0] for s in SCENES]
    texts = [text_layer(s[3], s[4]) for s in SCENES]
    over = static_overlay()
    ending = ending_layer()

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "22",
                             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
                             out_mp4], stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for fi in range(total):
        tsec = fi / FPS
        i = min(int(tsec / SEG), len(SCENES) - 1)

        def shot(j):
            # 每幕實際顯示 SEG+XF 秒，讓轉場時兩張都在動
            lt = (tsec - j * SEG + XF / 2) / (SEG + XF)
            return frame_of(bases[j], SCENES[j][1], SCENES[j][2], min(max(lt, 0), 1)).convert("RGBA")

        img = shot(i)
        local = tsec - i * SEG
        if i + 1 < len(SCENES) and local > SEG - XF / 2:
            a = (local - (SEG - XF / 2)) / XF
            img = Image.blend(img, shot(i + 1), a)
        elif i > 0 and local < XF / 2:
            a = 0.5 + local / XF
            img = Image.blend(shot(i - 1), img, a)
        img.alpha_composite(over)

        # 主標題淡入、上浮，幕尾淡出
        ta = min(1, max(0, (local - 0.4) / 0.7)) * min(1, max(0, (SEG - 0.3 - local) / 0.5))
        is_last = i == len(SCENES) - 1
        if is_last and local > 3.0:
            ta *= max(0, 1 - (local - 3.0) / 0.5)
        if ta > 0:
            dy = int((1 - ta) * 40)
            tl = texts[i].copy()
            tl.putalpha(tl.getchannel("A").point(lambda v: int(v * ta)))
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            layer.paste(tl, (0, dy))
            img.alpha_composite(layer)
        if is_last and local > 3.2:
            ea = min(1, (local - 3.2) / 0.8)
            dim = Image.new("RGBA", (W, H), (60, 0, 0, int(120 * ea)))
            img.alpha_composite(dim)
            el = ending.copy()
            el.putalpha(el.getchannel("A").point(lambda v: int(v * ea)))
            img.alpha_composite(el)
        # 開頭與結尾淡入淡出
        g = min(1, tsec / 0.6, (DUR - tsec) / 0.8)
        rgb = img.convert("RGB")
        if g < 1:
            rgb = Image.blend(Image.new("RGB", (W, H)), rgb, max(g, 0))
        proc.stdin.write(rgb.tobytes())
        if fi % 150 == 0:
            print(f"frame {fi}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(wav)
    print("done:", out_mp4)


if __name__ == "__main__":
    main()
