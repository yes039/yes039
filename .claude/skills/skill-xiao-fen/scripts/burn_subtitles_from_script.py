#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把純文字字幕稿燒進數字人影片（黃字黑邊，你的公司固定樣式）。

用法：
    python burn_subtitles_from_script.py 原始.mp4 字幕稿.txt 輸出.mp4

字幕稿格式：一行一段，5-14 字最好讀（空行與 # 開頭會被忽略）。

時間怎麼算（重點）：
    不是「總長 ÷ 句數」平均分，那樣遇到停頓就會整支漂掉。
    做法是先用 ffmpeg silencedetect 找出所有「有在講話」的區間，
    把這些區間接成一條「語音時間軸」，再照每句字數在這條軸上配時，
    最後換算回真實時間。停頓自動被跳過，開頭暖機變慢也不會累積誤差。
    每句的顯示時間會延伸到下一句開始，字幕不會在停頓時閃掉。

為什麼不用 ffmpeg 的 subtitles/drawtext：
    這台 Mac 的 ffmpeg 沒編進 libass、也沒有 drawtext（實測 2026-09-25，
    只有 overlay）。所以走你的公司慣例：PIL 算圖 → PNG → ffmpeg overlay。

若 HeyGen 產片時有開 caption（回傳 subtitle_url），優先用
burn_subtitles_from_srt.py，時間碼更準。
"""
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

# ── 固定樣式（沿用舊版 welcome.mp4 與 Shorts 規格）─────────────
def _find_font():
    """跨平台找中文字型（Mac → Windows），找不到就報錯，不默默用預設字。"""
    import glob
    cands = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
        "C:/Windows/Fonts/msjhbd.ttc",
        "C:/Windows/Fonts/msjh.ttc",
    ] + glob.glob("/System/Library/AssetsV2/**/PingFang*.ttc", recursive=True)
    for p in cands:
        if os.path.exists(p):
            return p
    raise SystemExit("找不到中文字型，請把字型路徑寫進 FONT_PATH")


FONT_PATH = _find_font()
FILL = (255, 215, 0)          # #FFD700
STROKE = (0, 0, 0)
STROKE_W = 7
Y_RATIO = 0.82                # 字幕中心位於畫面高度 82%，避開臉
FONT_RATIO = 0.0667           # 1080 寬 → 72pt
SIDE_MARGIN = 0.08            # 左右各留 8%，太長自動降字級

MIN_DUR = 0.95                # 每句最短顯示秒數，太短看不完
WEIGHT_FLOOR = 6              # 短句的字數下限，避免只分到零點幾秒

NOISE_DB = "-32dB"
MIN_SIL = "0.20"

_SANE = {"・": "‧", "･": "‧"}


def sane(t):
    for a, b in _SANE.items():
        t = t.replace(a, b)
    return t


def probe_size(src):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", src],
        capture_output=True, text=True, check=True).stdout.strip()
    return [int(x) for x in out.split("x")[:2]]


def probe_dur(src):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", src],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def speech_spans(src, total):
    """回傳 [(start, end), ...]：有在講話的區間。"""
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", src, "-af",
         f"silencedetect=noise={NOISE_DB}:d={MIN_SIL}", "-f", "null", "-"],
        capture_output=True, text=True)
    log = p.stderr
    sils, cur = [], None
    for m in re.finditer(r"silence_(start|end|duration):\s*(-?[\d.]+)", log):
        k, v = m.group(1), float(m.group(2))
        if k == "start":
            cur = v
        elif k == "duration" and cur is not None:
            sils.append((cur, cur + v))
            cur = None
    sils.sort()
    spans, t = [], 0.0
    for s, e in sils:
        if s > t + 0.01:
            spans.append((t, min(s, total)))
        t = max(t, e)
    if t < total - 0.01:
        spans.append((t, total))
    return [(a, b) for a, b in spans if b - a > 0.05]


def to_wall(spans, x):
    """語音時間軸上的 x 秒 → 真實時間。"""
    acc = 0.0
    for a, b in spans:
        d = b - a
        if x <= acc + d:
            return a + (x - acc)
        acc += d
    return spans[-1][1]


def render(text, W, H, tmp, idx):
    size = int(W * FONT_RATIO)
    maxw = W * (1 - SIDE_MARGIN * 2)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    while size > 20 and d.textlength(text, font=ImageFont.truetype(FONT_PATH, size)) > maxw:
        size -= 2
    f = ImageFont.truetype(FONT_PATH, size)
    d.text((W / 2, H * Y_RATIO), text, font=f, fill=FILL,
           anchor="mm", stroke_width=STROKE_W, stroke_fill=STROKE)
    p = os.path.join(tmp, f"sub{idx:03d}.png")
    im.save(p)
    return p


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    src, script, dst = sys.argv[1:4]

    lines = [sane(l.strip()) for l in open(script, encoding="utf-8")
             if l.strip() and not l.lstrip().startswith("#")]
    if not lines:
        sys.exit("字幕稿是空的")

    W, H = probe_size(src)
    total = probe_dur(src)
    spans = speech_spans(src, total)
    speech = sum(b - a for a, b in spans)
    print(f"影片 {W}x{H} / {total:.2f}s，語音 {len(spans)} 段共 {speech:.2f}s，字幕 {len(lines)} 句")

    weights = [max(len(l), WEIGHT_FLOOR) for l in lines]
    tot_w = sum(weights)
    cues, acc = [], 0.0
    for i, (ln, w) in enumerate(zip(lines, weights)):
        s = to_wall(spans, speech * acc / tot_w)
        acc += w
        e = total if i == len(lines) - 1 else to_wall(spans, speech * acc / tot_w)
        cues.append((s, e, ln))
    # 每句延伸到下一句開始，停頓時字幕不閃掉
    for i in range(len(cues) - 1):
        cues[i] = (cues[i][0], cues[i + 1][0], cues[i][2])
    # 太短的句子向前借時間（從前一句尾巴拿，前一句至少保留 MIN_DUR）
    for i in range(len(cues) - 1, 0, -1):
        s0, e0, t0 = cues[i]
        if e0 - s0 >= MIN_DUR:
            continue
        ps, pe, pt = cues[i - 1]
        new_s = max(ps + MIN_DUR, e0 - MIN_DUR)
        if new_s < s0:
            cues[i] = (new_s, e0, t0)
            cues[i - 1] = (ps, new_s, pt)

    tmp = tempfile.mkdtemp(prefix="subs_")
    pngs = [render(t, W, H, tmp, i) for i, (_, _, t) in enumerate(cues)]

    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src]
    for p in pngs:
        cmd += ["-i", p]
    chain, last = [], "0:v"
    for i, (s, e, _) in enumerate(cues):
        lbl = f"v{i}"
        chain.append(f"[{last}][{i+1}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[{lbl}]")
        last = lbl
    cmd += ["-filter_complex", ";".join(chain),
            "-map", f"[{last}]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", dst]
    subprocess.run(cmd, check=True)
    print(f"✅ {dst}")
    for s, e, t in cues:
        print(f"   {s:6.2f}–{e:6.2f}  {t}")


if __name__ == "__main__":
    main()
