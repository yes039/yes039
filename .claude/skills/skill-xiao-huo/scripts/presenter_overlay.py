#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小貨 · 模式 B：主播介紹版（主播口播片 ＋ 講到哪個商品就跳出哪個小窗 ＋ 字幕）

前置：在 HeyGen 生好主播口播片，生片時開字幕檔（caption），下載 mp4 和 srt。
用法：
    python3 presenter_overlay.py 主播.json

主播.json 欄位見 templates/主播_範例.json。重點：
- cards[].word：口播稿裡的關鍵字，講到這個字的那一刻跳出小窗，維持到下一張小窗
- cards[].after：同一個字出現兩次時，用「在某個字之後」指定第二次
- crops：從商品圖裁哪一塊（像素座標 [左, 上, 右, 下]），也可以直接給一張圖 "file"
- 小窗高度 card_h、中心位置 card_cy（0～1，主播臉在上半部時放 0.6 左右＝胸前）

🚨 字幕時間來自 HeyGen 的 srt，同一段內照字數線性內插，誤差約 0.3 秒內。
🚨 srt 段落開頭常黏著上一句的「，」「。」→ 腳本會自動清掉。
"""
import sys, json, re, pathlib, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = ("/System/Library/Fonts/STHeiti Medium.ttc", "C:/Windows/Fonts/msjhbd.ttc", "C:/Windows/Fonts/msjh.ttc",
         "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc")


def font(size):
    for p in FONTS:
        if pathlib.Path(p).exists():
            return ImageFont.truetype(p, size)
    sys.exit("❌ 找不到中文字型（Mac：STHeiti／Windows：微軟正黑體）")


def ts(x):
    return int(x[:2]) * 3600 + int(x[3:5]) * 60 + float(x[6:].replace(",", "."))


def read_srt(p):
    cues = []
    for b in pathlib.Path(p).read_text(encoding="utf-8").strip().split("\n\n"):
        l = b.strip().split("\n")
        if len(l) < 3:
            continue
        a, c = l[1].split(" --> ")
        txt = re.sub(r"^[，。、！？；：,.!?]+", "", "".join(l[2:]).strip())
        cues.append((ts(a.strip()), ts(c.strip()), txt))
    return cues


def split_lines(cues, max_chars=14):
    """把一段 srt 依標點切成短句，時間照字數分配。"""
    out = []
    for s, e, t in cues:
        parts = [p for p in re.split(r"(?<=[，。！？；：、])", t) if p.strip()]
        merged, buf = [], ""
        for p in parts:
            if len(buf) + len(p) <= max_chars:
                buf += p
            else:
                if buf:
                    merged.append(buf)
                buf = p
        if buf:
            merged.append(buf)
        n = sum(len(m) for m in merged) or 1
        t0 = s
        for m in merged:
            t1 = t0 + (e - s) * len(m) / n
            out.append((t0, t1, m.rstrip("，、；：")))
            t0 = t1
    return out


def when(cues, word, after=0.0):
    for s, e, t in cues:
        i = t.find(word)
        while i >= 0:
            tt = s + (e - s) * i / max(1, len(t))
            if tt >= after:
                return tt
            i = t.find(word, i + 1)
    sys.exit(f"❌ 字幕裡找不到「{word}」→ 檢查 cards[].word 是不是跟口播稿一字不差")


def ease(t):
    t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3


def make_card(img, h, label, maxw):
    r = h / img.height
    im = img.resize((max(1, int(img.width * r)), int(h)), Image.LANCZOS)
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    pad, lh = 14, (70 if label else 0)
    c = Image.new("RGBA", (im.width + pad * 2 + 60, im.height + pad * 2 + lh + 60), (0, 0, 0, 0))
    sh = Image.new("RGBA", c.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((30, 40, c.width - 30, c.height - 20), 36, fill=(0, 0, 0, 70))
    c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((30, 30, c.width - 30, c.height - 30), 36, fill=(255, 255, 255, 255))
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 26, fill=255)
    c.paste(im.convert("RGB"), (30 + pad, 30 + pad), m)
    if label:
        f = font(46); w = d.textlength(label, font=f)
        d.text(((c.width - w) / 2, 30 + pad + im.height + 8), label, font=f, fill=(60, 55, 50, 255))
    return c


def main():
    cfg_path = pathlib.Path(sys.argv[1]).resolve(); root = cfg_path.parent
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    video = root / cfg["video"]
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height,r_frame_rate", "-of", "csv=p=0", str(video)],
                           capture_output=True, text=True, check=True).stdout.strip().split(",")
    W, H = int(probe[0]), int(probe[1]); num, den = probe[2].split("/"); FPS = float(num) / float(den)
    DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                str(video)], capture_output=True, text=True).stdout)
    cues = read_srt(root / cfg["srt"])
    subs = split_lines(cues, cfg.get("sub_chars", 14)) if cfg.get("subtitle", True) else []

    # 小窗素材
    base = Image.open(root / cfg["product_image"]).convert("RGB") if cfg.get("product_image") else None
    def crop_img(key):
        c = cfg["crops"][key]
        if isinstance(c, dict) and c.get("file"):
            return Image.open(root / c["file"]).convert("RGB")
        if isinstance(c, dict) and c.get("pair"):   # 兩張並排
            a, b = crop_img(c["pair"][0]), crop_img(c["pair"][1])
            hh = max(a.height, b.height); bg = base.getpixel((5, base.height - 5)) if base else (240, 240, 240)
            out = Image.new("RGB", (a.width + b.width + 20, hh), bg); out.paste(a, (0, 0)); out.paste(b, (a.width + 20, 0))
            return out
        return base.crop(tuple(c))

    times, prev = [], 0.0
    for cd in cfg["cards"]:
        aft = when(cues, cd["after"]) if cd.get("after") else prev
        t = when(cues, cd["word"], aft); times.append(t); prev = t
    SHOW = []
    for i, cd in enumerate(cfg["cards"]):
        end = times[i + 1] if i + 1 < len(times) else DUR
        img = crop_img(cd["crop"])
        h = cd.get("h", cfg.get("card_h", 560))
        SHOW.append((times[i], end, make_card(img, h, cd.get("label", ""), int(W * 0.87))))
        print(f"{times[i]:6.2f}–{end:6.2f}  {cd.get('label') or cd['crop']}")
    CY = H * cfg.get("card_cy", 0.615)

    # 固定圖層：AI 標示＋logo
    fixed = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(fixed)
    tag = cfg.get("tag", "AI 生成")
    if tag:
        f = font(32); w = d.textlength(tag, font=f)
        d.rounded_rectangle((30, 60, 74 + w, 112), 26, fill=(0, 0, 0, 110)); d.text((52, 68), tag, font=f, fill=(255, 255, 255, 235))
    if cfg.get("logo"):
        lg = Image.open(root / cfg["logo"]).convert("RGBA"); r = 120 / max(lg.size)
        lg = lg.resize((int(lg.width * r), int(lg.height * r))); fixed.alpha_composite(lg, (W - lg.width - 40, 50))

    # 字幕圖層快取
    sub_font = font(int(W * 0.0667)); sub_cache = {}
    def sub_layer(txt):
        if txt not in sub_cache:
            im = Image.new("RGBA", (W, 200), (0, 0, 0, 0)); dd = ImageDraw.Draw(im); f = sub_font
            while dd.textlength(txt, font=f) > W * 0.84 and f.size > 36:
                f = font(f.size - 4)
            w = dd.textlength(txt, font=f)
            dd.text(((W - w) / 2, 40), txt, font=f, fill=(255, 215, 0, 255), stroke_width=7, stroke_fill=(0, 0, 0, 255))
            sub_cache[txt] = im
        return sub_cache[txt]
    SUB_Y = int(H * cfg.get("sub_y", 0.82)) - 100

    out = root / cfg.get("out", "主播介紹_9比16.mp4")
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", f"{FPS}", "-i", "-", "-i", str(video), "-map", "0:v", "-map", "1:a?",
                            "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(out)],
                           stdin=subprocess.PIPE)
    n = 0
    while True:
        raw = dec.stdout.read(W * H * 3)
        if len(raw) < W * H * 3:
            break
        t = n / FPS; fr = Image.frombytes("RGB", (W, H), raw).convert("RGBA")
        for s, e, c in SHOW:
            if s <= t < e:
                k = ease((t - s) / 0.25); o = ease((e - t) / 0.2) if e < DUR else 1
                sc = 0.85 + 0.15 * k; a = min(k, o)
                cc = c.resize((int(c.width * sc), int(c.height * sc)), Image.LANCZOS)
                if a < 1:
                    cc.putalpha(cc.split()[3].point(lambda v: int(v * a)))
                fr.alpha_composite(cc, (int(W / 2 - cc.width / 2), int(CY - cc.height / 2)))
        for s, e, txt in subs:
            if s <= t < e:
                fr.alpha_composite(sub_layer(txt), (0, SUB_Y)); break
        fr.alpha_composite(fixed)
        enc.stdin.write(fr.convert("RGB").tobytes()); n += 1
    enc.stdin.close(); enc.wait()
    print(f"✅ {out}（{n} 格）→ 抽幀看：小窗有沒有壓到臉、字幕跟聲音對不對得上")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main()
