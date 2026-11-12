#!/usr/bin/env python3
"""SEAL-01 短影音合成器：真人片段 + 手繪動畫 + 字幕 + 配音 → 1080x1920 MP4。

用法：python3 render.py storyboard.json out.mp4
分鏡檔格式見 storyboard.sample.json。素材路徑相對於分鏡檔所在資料夾。
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
# 版型區塊（px）
TITLE = (0, 360)
CONTENT = (360, 1480)
BRAND = (1480, 1680)
# 色票
CREAM = (245, 237, 224)
MILKTEA = (230, 213, 190)
COFFEE = (107, 74, 51)
DARK = (58, 42, 31)
DARKER = (40, 29, 21)
GOLD = (201, 161, 90)
BRIGHT_GOLD = (235, 201, 122)


def font(path, size):
    return ImageFont.truetype(path, size)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def audio_dur(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", path])
    return float(out)


def draw_text_center(d, cx, y, text, f, fill, stroke=0, stroke_fill=None):
    w = d.textlength(text, font=f)
    d.text((cx - w / 2, y), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


class Renderer:
    def __init__(self, sb, base):
        self.sb, self.base = sb, base
        fd = sb["fonts"]
        self.f_black = lambda s: font(os.path.join(base, fd["black"]), s)
        self.f_bold = lambda s: font(os.path.join(base, fd["bold"]), s)
        self.tempo = sb.get("voice_tempo", 1.0)
        self.build_timeline()
        self.build_static()
        self.load_hand()
        self.load_icons()

    # ---------- 時間軸 ----------
    def build_timeline(self):
        t = 0.0
        gap = self.sb.get("gap", 0.25)
        self.segments = []
        for seg in self.sb["segments"]:
            vo = os.path.join(self.base, seg["voice"])
            d = audio_dur(vo) / self.tempo
            seg = dict(seg, start=t, dur=d, voice_path=vo)
            self.segments.append(seg)
            t += d + gap
        self.total = t + self.sb.get("tail", 0.6)
        self.board_start = next(s["start"] for s in self.segments if s["type"] == "draw") - gap / 2

    # ---------- 固定版型 ----------
    def build_static(self):
        sb = self.sb
        frame = Image.new("RGB", (W, H), DARKER)
        d = ImageDraw.Draw(frame)
        d.rectangle([0, TITLE[0], W, TITLE[1]], fill=DARK)
        d.rectangle([0, TITLE[1] - 6, W, TITLE[1]], fill=GOLD)
        draw_text_center(d, W / 2, 70, sb["title"][0], self.f_black(92), BRIGHT_GOLD)
        draw_text_center(d, W / 2, 190, sb["title"][1], self.f_black(104), CREAM)
        d.rectangle([0, BRAND[0], W, BRAND[1]], fill=DARK)
        d.rectangle([0, BRAND[0], W, BRAND[0] + 4], fill=GOLD)
        name, role = sb["brand"]
        fn, fr = self.f_black(78), self.f_bold(46)
        wn, wr = d.textlength(name, font=fn), d.textlength(role, font=fr)
        x = (W - (wn + 36 + wr)) / 2
        d.text((x, BRAND[0] + 50), name, font=fn, fill=BRIGHT_GOLD)
        d.line([x + wn + 18, BRAND[0] + 62, x + wn + 18, BRAND[0] + 140], fill=GOLD, width=3)
        d.text((x + wn + 36, BRAND[0] + 70), role, font=fr, fill=CREAM)
        if sb.get("brand_tagline"):
            draw_text_center(d, W / 2, BRAND[1] + 40, sb["brand_tagline"], self.f_bold(34), GOLD)
        self.chrome = frame
        self.board_bg = Image.new("RGB", (W, CONTENT[1] - CONTENT[0]), CREAM)

    # ---------- 持筆手 ----------
    def load_hand(self):
        h = self.sb["hand"]
        im = Image.open(os.path.join(self.base, h["image"])).convert("RGBA")
        s = h["height"] / im.height
        self.hand = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        self.hand_tip = (h["tip"][0] * s, h["tip"][1] * s)

    # ---------- 圖示：線稿層 + 上色層 ----------
    def load_icons(self):
        size = self.sb.get("icon_size", 400)
        self.icons = {}
        for seg in self.segments:
            if seg["type"] != "draw":
                continue
            im = Image.open(os.path.join(self.base, seg["icon"])).convert("RGBA")
            bb = im.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
            im = im.crop(bb)
            im.thumbnail((size, size), Image.LANCZOS)
            a = np.asarray(im).astype(np.float32)
            lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
            line = ((lum < 125) & (a[..., 3] > 100)).astype(np.uint8) * 255
            line = Image.fromarray(line).filter(ImageFilter.MaxFilter(3))
            line_rgba = Image.new("RGBA", im.size, COFFEE + (0,))
            line_rgba.putalpha(line)
            # 掃描路徑：之字形分帶，每帶取線條像素的中位 y 作為筆尖高度
            bands = 6
            L = np.asarray(line) > 0
            bh = im.height / bands
            path = []
            for b in range(bands):
                y0, y1 = int(b * bh), int((b + 1) * bh)
                rows = L[y0:y1]
                ys, xs = np.nonzero(rows)
                yc = (y0 + np.median(ys)) if len(ys) else (y0 + y1) / 2
                xl = xs.min() if len(xs) else 0
                xr = xs.max() if len(xs) else im.width
                path.append((y0, y1, yc, xl, xr, b % 2 == 1))
            self.icons[seg["id"]] = dict(color=im, line=line_rgba, path=path)

    def icon_pos(self, seg, im):
        cx, cy = seg["pos"]
        return int(cx - im.width / 2), int(cy - im.height / 2)

    def draw_icon(self, canvas, seg, t):
        """回傳筆尖位置（canvas 座標）或 None。"""
        ic = self.icons[seg["id"]]
        line, color, path = ic["line"], ic["color"], ic["path"]
        x0, y0 = self.icon_pos(seg, color)
        local = t - seg["start"]
        sketch_d = seg["dur"] * 0.62
        p = local / sketch_d
        tip = None
        if p >= 1:
            canvas.alpha_composite(line, (x0, y0))
        elif p > 0:
            bands = len(path)
            pos = p * bands
            bi = int(pos)
            frac = pos - bi
            mask = Image.new("L", line.size, 0)
            md = ImageDraw.Draw(mask)
            for b in range(bi):
                md.rectangle([0, path[b][0], line.width, path[b][1]], fill=255)
            if bi < bands:
                by0, by1, yc, xl, xr, rev = path[bi]
                xf = xl + (xr - xl) * frac
                if rev:
                    xf = xr - (xr - xl) * frac
                    md.rectangle([xf, by0, line.width, by1], fill=255)
                else:
                    md.rectangle([0, by0, xf, by1], fill=255)
                tip = (x0 + xf, y0 + yc + math.sin(local * 40) * 6)
            a = Image.fromarray(np.minimum(np.asarray(line.split()[3]), np.asarray(mask)))
            part = line.copy()
            part.putalpha(a)
            canvas.alpha_composite(part, (x0, y0))
        # 上色淡入
        cf = ease((local - sketch_d) / (seg["dur"] * 0.3))
        if cf > 0:
            c = color.copy()
            c.putalpha(Image.fromarray((np.asarray(color.split()[3]) * cf).astype(np.uint8)))
            canvas.alpha_composite(c, (x0, y0))
            if seg.get("label"):
                lf = self.f_black(44)
                d = ImageDraw.Draw(canvas)
                lw = d.textlength(seg["label"], font=lf)
                lx = seg["pos"][0] - lw / 2
                ly = y0 + color.height + 14
                d.rounded_rectangle([lx - 18, ly - 6, lx + lw + 18, ly + 58], 14,
                                    fill=MILKTEA + (int(255 * cf),))
                d.text((lx, ly), seg["label"], font=lf, fill=DARK + (int(255 * cf),))
        return tip

    # ---------- 單格畫面 ----------
    def frame(self, t):
        out = self.chrome.copy()
        ch = CONTENT[1] - CONTENT[0]
        # 真人段
        live = self.live_frame(t)
        board = self.board_frame(t)
        if t < self.board_start:
            content = live
        else:
            k = ease((t - self.board_start) / 0.4)
            content = live.copy()
            content.paste(board, (int(W * (1 - k)), 0))
        out.paste(content, (0, CONTENT[0]))
        self.draw_subtitle(out, t)
        return out

    def live_frame(self, t):
        ch = CONTENT[1] - CONTENT[0]
        live = self.sb.get("live_placeholder", {})
        if not hasattr(self, "_live"):
            self._live = None
            vid = live.get("video")
            if vid and os.path.exists(os.path.join(self.base, vid)):
                self._live = os.path.join(self.base, vid)
            # 預留畫面
            ph = Image.new("RGB", (W, ch), (92, 70, 54))
            d = ImageDraw.Draw(ph)
            for i in range(ch):
                v = int(30 * i / ch)
                d.line([0, i, W, i], fill=(92 - v, 70 - v, 54 - v))
            d.ellipse([W / 2 - 150, 200, W / 2 + 150, 500], fill=(150, 120, 96))
            d.rounded_rectangle([W / 2 - 260, 520, W / 2 + 260, 900], 120, fill=(150, 120, 96))
            draw_text_center(d, W / 2, 610, live.get("text", "真人片段"), self.f_black(56), CREAM)
            draw_text_center(d, W / 2, 690, live.get("note", ""), self.f_bold(36), MILKTEA)
            if live.get("chip"):
                cf = self.f_black(46)
                cw = d.textlength(live["chip"], font=cf)
                d.rounded_rectangle([W / 2 - cw / 2 - 30, 60, W / 2 + cw / 2 + 30, 140], 40, fill=GOLD)
                draw_text_center(d, W / 2, 72, live["chip"], cf, DARK)
            self._ph = ph
        if self._live:
            return self.video_frame(self._live, t, (W, ch))
        z = 1 + 0.04 * min(t / 5, 1)
        im = self._ph.resize((int(W * z), int(ch * z)), Image.BILINEAR)
        return im.crop(((im.width - W) // 2, (im.height - ch) // 2,
                        (im.width - W) // 2 + W, (im.height - ch) // 2 + ch))

    def video_frame(self, path, t, size):
        if not hasattr(self, "_vf"):
            raw = subprocess.check_output([
                "ffmpeg", "-v", "error", "-i", path, "-vf",
                f"fps={FPS},scale={size[0]}:{size[1]}:force_original_aspect_ratio=increase,crop={size[0]}:{size[1]}",
                "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
            n = len(raw) // (size[0] * size[1] * 3)
            self._vf = np.frombuffer(raw, np.uint8).reshape(n, size[1], size[0], 3)
        i = min(int(t * FPS), len(self._vf) - 1)
        return Image.fromarray(self._vf[i])

    def board_frame(self, t):
        canvas = self.board_bg.convert("RGBA")
        tip = None
        for seg in self.segments:
            if seg["type"] == "draw" and t >= seg["start"]:
                r = self.draw_icon(canvas, seg, t)
                if r:
                    tip = r
        # 手：作畫時跟著筆尖，空檔時移到畫面右下
        rest = (W * 0.86, canvas.height * 0.93)
        if tip is None:
            if not hasattr(self, "_last_tip"):
                self._last_tip = rest
            lt = self._last_tip
            self._last_tip = (lt[0] + (rest[0] - lt[0]) * 0.18, lt[1] + (rest[1] - lt[1]) * 0.18)
            tip = self._last_tip
        else:
            self._last_tip = tip
        hx, hy = int(tip[0] - self.hand_tip[0]), int(tip[1] - self.hand_tip[1])
        canvas.alpha_composite(self.hand, (max(hx, -self.hand.width), max(hy, -self.hand.height))) \
            if hx < W and hy < canvas.height else None
        return canvas.convert("RGB")

    def draw_subtitle(self, out, t):
        for seg in self.segments:
            if seg["start"] - 0.05 <= t < seg["start"] + seg["dur"] + 0.15:
                # 字幕可為字串或多句清單；多句依字數比例分配時間
                lines = seg["subtitle"] if isinstance(seg["subtitle"], list) else [seg["subtitle"]]
                total = sum(len(s) for s in lines)
                acc, text = seg["start"], lines[-1]
                for s in lines:
                    acc += seg["dur"] * len(s) / total
                    if t < acc:
                        text = s
                        break
                d = ImageDraw.Draw(out)
                f = self.f_black(66)
                y = CONTENT[1] - 150
                draw_text_center(d, W / 2, y, text, f, DARK, stroke=9, stroke_fill=CREAM)
                return

    # ---------- 音訊 ----------
    def build_audio(self, path):
        inputs, filt = [], []
        for i, s in enumerate(self.segments):
            inputs += ["-i", s["voice_path"]]
            ms = int(s["start"] * 1000)
            filt.append(f"[{i}:a]atempo={self.tempo},adelay={ms}|{ms},apad[a{i}]")
        n = len(self.segments)
        filt.append("".join(f"[a{i}]" for i in range(n)) +
                    f"amix=inputs={n}:normalize=0,atrim=0:{self.total:.3f},loudnorm=I=-16:TP=-1.5[out]")
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt),
                               "-map", "[out]", "-ar", "48000", path])

    def render(self, out_path):
        wav = out_path + ".wav"
        self.build_audio(wav)
        n = int(self.total * FPS)
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                              "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
                              "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                              "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
                              out_path], stdin=subprocess.PIPE)
        for i in range(n):
            p.stdin.write(self.frame(i / FPS).tobytes())
        p.stdin.close()
        p.wait()
        os.remove(wav)
        print(f"done: {out_path}  {self.total:.2f}s  {n} frames")
        for s in self.segments:
            print(f"  {s['start']:5.2f}-{s['start'] + s['dur']:5.2f}  {s['subtitle']}")


if __name__ == "__main__":
    sb_path, out = sys.argv[1], sys.argv[2]
    sb = json.load(open(sb_path, encoding="utf-8"))
    Renderer(sb, os.path.dirname(os.path.abspath(sb_path))).render(out)
