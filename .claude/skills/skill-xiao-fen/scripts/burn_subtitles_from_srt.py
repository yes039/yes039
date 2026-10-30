#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 HeyGen 回傳的 SRT 字幕燒進數字人影片（黃字黑邊，你的公司固定樣式）。

用法：
    python burn_subtitles_from_srt.py 原始.mp4 字幕.srt 輸出.mp4

為什麼不用 ffmpeg 的 subtitles/drawtext：
    這台 Mac 的 ffmpeg 沒有編進 libass 也沒有 drawtext（實測 2026-09-25，
    只有 overlay）。所以走你的公司慣例：PIL 算圖 → PNG → ffmpeg overlay。

為什麼吃 SRT 不吃純文字稿：
    HeyGen 產片時一定會附 subtitle_url，時間碼跟實際配音完全對齊，
    比「照字數比例分配時間」準得多，開頭暖機變慢也不會跑掉。
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
FONT_INDEX = 0                # .ttc 裡第幾個字重（換字型時才需要動）
FILL = (255, 215, 0)          # #FFD700
STROKE = (0, 0, 0)
STROKE_W = 7
Y_RATIO = 0.82                # 字幕中心位於畫面高度 82%，避開臉
FONT_RATIO = 0.0667           # 1080 寬 → 72pt
# 以上五項都可以用 CLI 覆寫（--font / --font-index / --font-ratio / --stroke / --y），
# 不帶參數時維持原本的樣式，舊的呼叫方式不受影響。
SIDE_MARGIN = 0.08            # 左右各留 8%，太長就自動降級
MAX_CHARS = 14                # 一行超過就依標點再切
# 🚨 想把字放大,只調 FONT_RATIO 沒用 —— render() 會因為一行太寬而自動縮回來。
#    真正的上限是 畫面可用寬度 ÷ 每行字數,所以放大時一定要同時把 MAX_CHARS 調小。
#    例：1920 寬、左右各留 8% → 可用 1613px;一行 14 字最多 115pt,一行 10 字可以到 161pt。

_SANE = {"・": "‧", "･": "‧"}


def sane(t):
    for a, b in _SANE.items():
        t = t.replace(a, b)
    return t


def parse_srt(path):
    """回傳 [(start_sec, end_sec, text), ...]"""
    raw = open(path, encoding="utf-8-sig").read().strip()
    out = []
    for block in re.split(r"\n\s*\n", raw):
        lines = [l for l in block.strip().split("\n") if l.strip()]
        if len(lines) < 2:
            continue
        tc = next((l for l in lines if "-->" in l), None)
        if not tc:
            continue
        a, b = [x.strip() for x in tc.split("-->")]

        def sec(s):
            s = s.replace(",", ".")
            h, m, rest = s.split(":")
            return int(h) * 3600 + int(m) * 60 + float(rest)

        text = " ".join(lines[lines.index(tc) + 1:]).strip()
        if text:
            out.append((sec(a), sec(b), text))
    return out


def split_long(cues):
    """HeyGen 常把兩三句塞成一格；依標點再切，時間按字數比例分。"""
    out = []
    for s, e, t in cues:
        t = sane(t).strip()
        if len(t) <= MAX_CHARS:
            out.append((s, e, t))
            continue
        parts = [p for p in re.split(r"(?<=[。！？，、!?,])", t) if p.strip()]
        # 把碎片黏回 MAX_CHARS 以內
        merged, cur = [], ""
        for p in parts:
            if len(cur) + len(p) <= MAX_CHARS or not cur:
                cur += p
            else:
                merged.append(cur)
                cur = p
        if cur:
            merged.append(cur)
        # 沒有標點可切的長句（例如「我在接案平台PRO360接到一個六千八的案子。」）
        # 原本會整段留著,再被 render() 自動縮小,等於放大設定白設。硬切成等長段。
        hard = []
        for m in merged:
            while len(m) > MAX_CHARS:
                # 🚨 不能直接砍在第 MAX_CHARS 個字：會把 PRO360、ChatGPT 這種
                #    英數字串攔腰切斷（實測切成「…平台PRO3」+「60接到…」）。
                #    往回找到前後都不是英數字的位置再切。
                cut = MAX_CHARS
                while cut > 2 and (m[cut-1].isalnum() and m[cut].isalnum()
                                   and m[cut-1].isascii() and m[cut].isascii()):
                    cut -= 1
                hard.append(m[:cut]); m = m[cut:]
            if m:
                hard.append(m)
        # 只剩一兩個字的尾巴（例如「掉。」）併回上一行,不要單獨一行
        if len(hard) > 1:
            fixed = [hard[0]]
            for x in hard[1:]:
                if len(x) <= 2 and len(fixed[-1]) + len(x) <= MAX_CHARS + 2:
                    fixed[-1] += x
                else:
                    fixed.append(x)
            hard = fixed
        merged = hard
        total = sum(len(m) for m in merged) or 1
        t0 = s
        for m in merged:
            dur = (e - s) * len(m) / total
            out.append((t0, t0 + dur, m.strip("，、 ")))
            t0 += dur
    return out


def render(text, W, H, tmp, idx):
    size = int(W * FONT_RATIO)
    maxw = W * (1 - SIDE_MARGIN * 2)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    while size > 20:
        f = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
        if d.textlength(text, font=f) <= maxw:
            break
        size -= 2
    f = ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)
    d.text((W / 2, H * Y_RATIO), text, font=f, fill=FILL,
           anchor="mm", stroke_width=STROKE_W, stroke_fill=STROKE)
    p = os.path.join(tmp, f"sub{idx:03d}.png")
    im.save(p)
    return p


def main():
    global FONT_PATH, FONT_INDEX, FONT_RATIO, STROKE_W, Y_RATIO, MAX_CHARS, FILL
    import argparse
    ap = argparse.ArgumentParser(description="把 SRT 燒進影片（PIL 算圖 → ffmpeg overlay）")
    ap.add_argument("src"); ap.add_argument("srt"); ap.add_argument("dst")
    ap.add_argument("--font", default=None, help="字型檔路徑")
    ap.add_argument("--font-index", type=int, default=None, help=".ttc 的字重索引；Hiragino Sans GB：0＝W3、1＝W3 介面版、2＝W6（粗體要用 2）")
    ap.add_argument("--font-ratio", type=float, default=None,
                    help=f"字級佔畫面寬度的比例（預設 {FONT_RATIO}，加大就調高）")
    ap.add_argument("--stroke", type=int, default=None,
                    help=f"黑邊粗細（預設 {STROKE_W}，字大了要跟著加粗才撐得住）")
    ap.add_argument("--y", type=float, default=None, help=f"字幕中心高度比例（預設 {Y_RATIO}）")
    ap.add_argument("--max-chars", type=int, default=None,
                    help=f"一行最多幾個字（預設 {MAX_CHARS}）。放大字級一定要一起調小,否則會被自動縮回去")
    ap.add_argument("--color", default=None, help="字色，十六進位（預設 FFD700 黃字；白字給 FFFFFF）")
    a = ap.parse_args()
    src, srt, dst = a.src, a.srt, a.dst
    if a.color:                  FILL = tuple(int(a.color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    if a.font is not None:       FONT_PATH = a.font
    if a.font_index is not None: FONT_INDEX = a.font_index
    if a.font_ratio is not None: FONT_RATIO = a.font_ratio
    if a.stroke is not None:     STROKE_W = a.stroke
    if a.y is not None:          Y_RATIO = a.y
    if a.max_chars is not None:  MAX_CHARS = a.max_chars

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", src],
        capture_output=True, text=True, check=True).stdout.strip()
    W, H = [int(x) for x in probe.split("x")[:2]]

    cues = split_long(parse_srt(srt))
    if not cues:
        sys.exit("SRT 解析不到任何字幕")
    print(f"影片 {W}x{H}，字幕 {len(cues)} 段")

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
    for _, _, t in cues:
        print("   ", t)


if __name__ == "__main__":
    main()
