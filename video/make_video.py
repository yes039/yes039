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
DATE = "2026年9月27日（日）農曆八月十七"

# 每幕: (秒數, 素材, 起點取景, 終點取景, 主標, 副標)
# 素材為照片檔名，或 ("clip", 影片檔名, 起始秒)；取景為 (cx, cy, zoom)
SCENES = [
    (3.6, "9_exterior.jpg", (0.5, 0.45, 1.0), (0.5, 0.38, 1.10), "宜蘭天公廟", "草湖 玉尊宮"),
    (3.8, "11_deity.jpg", (0.5, 0.45, 1.12), (0.5, 0.40, 1.0), "玉皇上帝 天公祖", "至尊至聖 庇佑萬民"),
    (3.0, "3_offerings.jpg", (0.5, 0.55, 1.0), (0.5, 0.62, 1.10), "祈福 · 消災", "金紙鮮果 誠心供奉"),
    (3.0, "4_rice.jpg", (0.5, 0.68, 1.12), (0.5, 0.58, 1.0), "補運法會", "米糕桂圓 好運圓滿"),
    (3.6, ("clip", "clip1_worship.mp4", 2.0), (0.5, 0.5, 1.0), (0.5, 0.5, 1.05), "祈福法會", "信眾虔誠 持香祈福"),
    (3.0, "10_censer.jpg", (0.5, 0.50, 1.0), (0.5, 0.55, 1.10), "香火鼎盛", "心香一炷 上達天聽"),
    (2.2, ("clip", "clip3_divination.mp4", 0.05), (0.5, 0.5, 1.0), (0.5, 0.5, 1.04), "擲筊請示", "恭請神明 指點迷津"),
    (3.0, "12_furnace.jpg", (0.5, 0.55, 1.10), (0.5, 0.50, 1.0), "焚化金紙", "功德圓滿"),
    (4.8, "5_incense.jpg", (0.45, 0.55, 1.0), (0.52, 0.50, 1.10), None, None),
]
STARTS = [sum(s[0] for s in SCENES[:i]) for i in range(len(SCENES))]
assert abs(sum(s[0] for s in SCENES) - DUR) < 1e-6
XF = 0.8  # 轉場秒數
OVS = 1.25  # 取景用超取樣倍率，避免放大模糊
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


class Clip:
    """依時間順序逐格讀取影片（已轉正、1080x1920）。"""

    def __init__(self, name, offset):
        self.path = os.path.join(HERE, "clips", name)
        self.offset = offset
        self.proc = subprocess.Popen([FFMPEG, "-loglevel", "error", "-ss", str(offset), "-i", self.path,
                                      "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}",
                                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.idx, self.img = -1, None

    def get(self, sec):
        want = max(0, int(sec * FPS))
        while self.idx < want:
            buf = self.proc.stdout.read(W * H * 3)
            if len(buf) < W * H * 3:
                break
            self.img = Image.frombytes("RGB", (W, H), buf)
            self.idx += 1
        return self.img

def font(size):
    return ImageFont.truetype(FONT, size)


def cover(img):
    """放大到可覆蓋 9:16 並保留 zoom 空間。"""
    s = max(W / img.width, H / img.height) * OVS
    return img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS), s


def frame_of(base, a, b, t, ovs=OVS):
    e = t * t * (3 - 2 * t)
    cx, cy, z = (a[i] + (b[i] - a[i]) * e for i in range(3))
    cw, ch = W * ovs / z, H * ovs / z
    x0 = min(max(cx * base.width - cw / 2, 0), base.width - cw)
    y0 = min(max(cy * base.height - ch / 2, 0), base.height - ch)
    return base.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def text_layer(title, sub):
    if title is None:
        return None
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
    f = font(46)
    tw = d.textlength(DATE, font=f)
    d.text(((W - tw) / 2, 212), DATE, font=f, fill=(255, 255, 255), stroke_width=4, stroke_fill=RED)
    # 邊框
    d.rectangle((24, 24, W - 25, H - 25), outline=GOLD + (170,), width=3)
    return ov


def ending_layer():
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for txt, size, y, fill in (("歡迎善信大德", 76, 740, (255, 255, 255)), ("蒞臨參拜 共沐神恩", 76, 850, (255, 255, 255)),
                               ("宜蘭天公廟 草湖玉尊宮", 64, 1010, GOLD), (DATE, 50, 1110, GOLD)):
        f = font(size)
        tw = d.textlength(txt, font=f)
        d.text(((W - tw) / 2, y), txt, font=f, fill=fill, stroke_width=5, stroke_fill=RED)
    return layer


CHANT_START = 4.0  # 從去雜音後的誦經錄音第 4 秒起取 30 秒


CHANT_MIX = 0.35  # 現場誦經聲疊在背景音樂下的比例


def read_wav(name):
    with wave.open(os.path.join(HERE, "audio", name)) as w:
        return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def make_audio(path):
    """背景音樂 (audio/music.wav，由 make_music.py 產生) 疊上輕聲的現場誦經 (audio/chant_clean.wav)。"""
    sr, music = read_wav("music.wav")
    sr2, chant = read_wav("chant_clean.wav")
    assert sr == sr2
    n = int(DUR * sr)
    music = np.pad(music, (0, max(0, n - len(music))))[:n]
    chant = chant[int(CHANT_START * sr):][:n]
    chant = np.pad(chant, (0, n - len(chant)))
    chant = chant / (np.sqrt((chant ** 2).mean()) + 1e-9) * np.sqrt((music ** 2).mean()) * CHANT_MIX
    out = music + chant
    t = np.arange(n) / sr
    out = out * np.minimum(1, np.minimum(t / 1.0, (DUR - t) / 2.5))
    out = out / np.abs(out).max() * 0.9
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((out * 32767).astype(np.int16).tobytes())


def main():
    out_mp4 = os.path.join(HERE, "yuzun_blessing_30s.mp4")
    wav = os.path.join(HERE, "_audio.wav")
    make_audio(wav)

    sources = []
    for sc in SCENES:
        if isinstance(sc[1], tuple):
            sources.append(Clip(sc[1][1], sc[1][2]))
        else:
            sources.append(cover(Image.open(os.path.join(HERE, "photos", sc[1])).convert("RGB"))[0])
    texts = [text_layer(sc[4], sc[5]) for sc in SCENES]
    over = static_overlay()
    ending = ending_layer()

    proc = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "23",
                             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
                             out_mp4], stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for fi in range(total):
        tsec = fi / FPS
        i = max(k for k in range(len(SCENES)) if STARTS[k] <= tsec + 1e-9)
        dur = SCENES[i][0]
        local = tsec - STARTS[i]

        def shot(j):
            # 每幕實際顯示 秒數+XF，讓轉場時兩邊都在動
            span = SCENES[j][0] + XF
            since = tsec - STARTS[j] + XF / 2
            lt = min(max(since / span, 0), 1)
            src = sources[j]
            if isinstance(src, Clip):
                return frame_of(src.get(since), SCENES[j][2], SCENES[j][3], lt, ovs=1.0).convert("RGBA")
            return frame_of(src, SCENES[j][2], SCENES[j][3], lt).convert("RGBA")

        img = shot(i)
        if i + 1 < len(SCENES) and local > dur - XF / 2:
            img = Image.blend(img, shot(i + 1), (local - (dur - XF / 2)) / XF)
        elif i > 0 and local < XF / 2:
            img = Image.blend(shot(i - 1), img, 0.5 + local / XF)
        img.alpha_composite(over)

        # 標題淡入、上浮，幕尾淡出
        ta = min(1, max(0, (local - 0.3) / 0.7)) * min(1, max(0, (dur - 0.3 - local) / 0.5))
        if texts[i] is not None and ta > 0:
            dy = int((1 - ta) * 25)
            tl = texts[i].copy()
            tl.putalpha(tl.getchannel("A").point(lambda v: int(v * ta)))
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            layer.paste(tl, (0, dy))
            img.alpha_composite(layer)
        if i == len(SCENES) - 1 and local > 0.5:
            ea = min(1, (local - 0.5) / 1.2)
            img.alpha_composite(Image.new("RGBA", (W, H), (60, 0, 0, int(120 * ea))))
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
    for src in sources:
        if isinstance(src, Clip):
            src.proc.kill()
            src.proc.wait()
    os.remove(wav)
    print("done:", out_mp4)


if __name__ == "__main__":
    main()
