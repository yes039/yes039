#!/usr/bin/env python3
"""SEAL-01 短影音合成器 v2：真人／手繪／Demo 子母畫面／資訊卡 → 1080x1920 MP4。

用法：python3 render.py storyboard.json out.mp4
分鏡檔格式見 storyboard.sample.json；素材路徑相對於分鏡檔所在資料夾。

段落類型（segments[].type）
  live  真人片段：video + clip=[起,迄]，聲音用影片原音；srt 匯入字幕；ai_label 加 AI 生成角標
  draw  手繪圖示：icon + pos + label；board 相同者畫在同一張畫板，換 board 即換新畫板
  pip   Demo 子母畫面：screen（螢幕錄影）+ pip（真人小窗影片）
  card  程式繪製資訊卡：kind=info（rows 表格）或 kind=cta（按鈕）
段落時長：有 video 用影片長度；有 voice 用配音長度；否則用 dur。
字幕：subtitle（字串或多句清單，依字數分配時間）或 srt（時間相對於該段起點，live 段相對於 clip 起點）。
"""
import json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
# 版型區塊（px）。依 FB 安全區：Reels 上 14%／下 35% 會被介面蓋住，
# 動態消息裁成 4:5 只剩 y 285–1635；標題與字幕須落在交集 285–1250。分鏡檔可用 "layout" 覆寫。
TITLE, CONTENT, BRAND = (285, 470), (470, 1250), (1250, 1390)
CREAM = (245, 237, 224)
MILKTEA = (230, 213, 190)
COFFEE = (107, 74, 51)
DARK = (58, 42, 31)
DARKER = (40, 29, 21)
GOLD = (201, 161, 90)
BRIGHT_GOLD = (235, 201, 122)
TRANSITION = 0.4


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def media_dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", path]))


def parse_srt(path):
    def ts(s):
        h, m, rest = s.split(":")
        sec, ms = rest.split(",")
        return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000
    rows = []
    for block in re.split(r"\n\s*\n", open(path, encoding="utf-8").read().strip()):
        lines = block.strip().splitlines()
        if len(lines) >= 3 and "-->" in lines[1]:
            a, b = [x.strip() for x in lines[1].split("-->")]
            rows.append((ts(a), ts(b), " ".join(lines[2:]).strip()))
    return rows


class VideoReader:
    """逐格讀取影片（依時間遞增請求），避免整段解碼佔用記憶體。loop=True 時播完重頭。"""

    def __init__(self, path, a, b, size, focus=0.5, mode="cover", loop=False, crop=None):
        self.args = (path, a, b, size, focus, mode)
        self.crop = crop
        self.loop, self.n_read, self.frame, self.proc = loop, -1, None, None
        self.length = max(1, int((b - a) * FPS))

    def _open(self):
        path, a, b, (w, h), focus, mode = self.args
        pre = f"crop={self.crop[2]}:{self.crop[3]}:{self.crop[0]}:{self.crop[1]}," if self.crop else ""
        if mode == "cover":
            self.out_size = (w, h)
            vf = (f"{pre}fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,"
                  f"crop={w}:{h}:(iw-{w})/2:(ih-{h})*{focus}")
        else:  # contain：先算好確切尺寸再交給 ffmpeg，避免四捨五入不一致造成畫面錯位
            probe = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                             "stream=width,height", "-of", "csv=p=0", path]).decode().strip()
            iw, ih = map(int, probe.split(",")[:2])
            if self.crop:
                iw, ih = self.crop[2], self.crop[3]
            s = min(w / iw, h / ih)
            self.out_size = (int(iw * s) // 2 * 2, int(ih * s) // 2 * 2)
            vf = f"{pre}fps={FPS},scale={self.out_size[0]}:{self.out_size[1]}"
        if self.proc:
            self.proc.kill()
        self.proc = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", path,
                                      "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.n_read = -1

    def get(self, t):
        idx = int(t * FPS)
        idx = idx % self.length if self.loop else min(idx, self.length - 1)
        if self.proc is None or idx < self.n_read:
            self._open()
        fw, fh = self.out_size
        while self.n_read < idx:
            raw = self.proc.stdout.read(fw * fh * 3)
            if len(raw) < fw * fh * 3:
                break
            self.frame = Image.frombytes("RGB", (fw, fh), raw)
            self.n_read += 1
        return self.frame if self.frame is not None else Image.new("RGB", (fw, fh), DARKER)


class Renderer:
    def __init__(self, sb, base):
        global TITLE, CONTENT, BRAND
        self.sb, self.base = sb, base
        lay = sb.get("layout", {})
        TITLE = tuple(lay.get("title", TITLE))
        CONTENT = tuple(lay.get("content", CONTENT))
        BRAND = tuple(lay.get("brand", BRAND))
        self.CW, self.CH = W, CONTENT[1] - CONTENT[0]
        fd = sb["fonts"]
        self._fonts = {}
        self.font_path = {"black": self.p(fd["black"]), "bold": self.p(fd["bold"])}
        self.tempo = sb.get("voice_tempo", 1.0)
        self.build_timeline()
        self.build_static()
        self.load_hand()
        self.load_icons()
        self.readers = {}
        self.boards = {}

    def p(self, rel):
        return os.path.join(self.base, rel)

    def f(self, kind, size):
        key = (kind, size)
        if key not in self._fonts:
            self._fonts[key] = ImageFont.truetype(self.font_path[kind], size)
        return self._fonts[key]

    # ---------- 時間軸 ----------
    def build_timeline(self):
        t, gap = 0.0, self.sb.get("gap", 0.25)
        self.segments, self.scenes = [], []
        for raw in self.sb["segments"]:
            seg = dict(raw)
            if seg.get("video"):
                vp = self.p(seg["video"])
                a, b = seg.get("clip", [0, media_dur(vp)])
                seg.update(video_path=vp, clip=[a, b], dur=b - a)
            elif seg.get("voice"):
                seg.update(voice_path=self.p(seg["voice"]), dur=media_dur(self.p(seg["voice"])) / self.tempo)
            else:
                seg["dur"] = float(seg["dur"])
            seg["start"] = t
            if seg.get("srt"):
                off = seg["clip"][0] if seg.get("video") else 0
                seg["srt_rows"] = [(a - off, b - off, x) for a, b, x in parse_srt(self.p(seg["srt"]))]
            seg["scene"] = f"board:{seg.get('board', 1)}" if seg["type"] == "draw" else f"{seg['type']}:{seg['id']}"
            if not self.scenes or self.scenes[-1]["key"] != seg["scene"]:
                self.scenes.append({"key": seg["scene"], "start": t, "segs": []})
            self.scenes[-1]["segs"].append(seg)
            self.segments.append(seg)
            t += seg["dur"] + gap
        self.total = t - gap + self.sb.get("tail", 0.6)

    # ---------- 固定版型（RGBA，上下區塊透明，背景另外填） ----------
    def build_static(self):
        sb = self.sb
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        th = TITLE[1] - TITLE[0]
        d.rectangle([0, TITLE[0], W, TITLE[1]], fill=DARK)
        d.rectangle([0, TITLE[0], W, TITLE[0] + 3], fill=GOLD)
        d.rectangle([0, TITLE[1] - 6, W, TITLE[1]], fill=GOLD)
        d.text((W / 2, TITLE[0] + th * 0.29), sb["title"][0], font=self.f("black", int(th * 0.40)),
               fill=BRIGHT_GOLD, anchor="mm")
        d.text((W / 2, TITLE[0] + th * 0.71), sb["title"][1], font=self.f("black", int(th * 0.46)),
               fill=CREAM, anchor="mm")
        bh, cy = BRAND[1] - BRAND[0], (BRAND[0] + BRAND[1]) / 2
        d.rectangle([0, BRAND[0], W, BRAND[1]], fill=DARK)
        d.rectangle([0, BRAND[0], W, BRAND[0] + 4], fill=GOLD)
        name, role = sb["brand"]
        fn, fr = self.f("black", int(bh * 0.46)), self.f("bold", int(bh * 0.29))
        wn, wr = d.textlength(name, font=fn), d.textlength(role, font=fr)
        x = (W - (wn + 36 + wr)) / 2
        d.text((x, cy), name, font=fn, fill=BRIGHT_GOLD, anchor="lm")
        d.line([x + wn + 18, cy - bh * 0.25, x + wn + 18, cy + bh * 0.25], fill=GOLD, width=3)
        d.text((x + wn + 36, cy), role, font=fr, fill=CREAM, anchor="lm")
        self.chrome = frame

    # ---------- 持筆手 ----------
    def load_hand(self):
        h = self.sb["hand"]
        im = Image.open(self.p(h["image"])).convert("RGBA")
        s = h["height"] / im.height
        self.hand = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        self.hand_tip = (h["tip"][0] * s, h["tip"][1] * s)

    # ---------- 圖示：線稿層 + 上色層 + 之字形描線路徑 ----------
    def load_icons(self):
        self.icons = {}
        for seg in self.segments:
            if seg["type"] != "draw":
                continue
            size = seg.get("size", self.sb.get("icon_size", 240))
            im = Image.open(self.p(seg["icon"])).convert("RGBA")
            im = im.crop(im.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox())
            im.thumbnail((size, size), Image.LANCZOS)
            a = np.asarray(im).astype(np.float32)
            lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
            line = Image.fromarray(((lum < 125) & (a[..., 3] > 100)).astype(np.uint8) * 255)
            line = line.filter(ImageFilter.MaxFilter(3))
            line_rgba = Image.new("RGBA", im.size, COFFEE + (0,))
            line_rgba.putalpha(line)
            L, bands, path = np.asarray(line) > 0, 6, []
            bh = im.height / bands
            for b in range(bands):
                y0, y1 = int(b * bh), int((b + 1) * bh)
                ys, xs = np.nonzero(L[y0:y1])
                path.append((y0, y1, (y0 + np.median(ys)) if len(ys) else (y0 + y1) / 2,
                             xs.min() if len(xs) else 0, xs.max() if len(xs) else im.width, b % 2 == 1))
            self.icons[seg["id"]] = dict(color=im, line=line_rgba, path=path)

    def draw_icon(self, canvas, seg, t):
        ic = self.icons[seg["id"]]
        line, color, path = ic["line"], ic["color"], ic["path"]
        x0, y0 = int(seg["pos"][0] - color.width / 2), int(seg["pos"][1] - color.height / 2)
        local, sketch_d = t - seg["start"], min(seg["dur"] * 0.62, 2.4)
        p, tip = local / sketch_d, None
        if p >= 1:
            canvas.alpha_composite(line, (x0, y0))
        elif p > 0:
            pos = p * len(path)
            bi, frac = int(pos), pos - int(pos)
            mask = Image.new("L", line.size, 0)
            md = ImageDraw.Draw(mask)
            for b in range(bi):
                md.rectangle([0, path[b][0], line.width, path[b][1]], fill=255)
            if bi < len(path):
                by0, by1, yc, xl, xr, rev = path[bi]
                xf = xr - (xr - xl) * frac if rev else xl + (xr - xl) * frac
                md.rectangle([xf, by0, line.width, by1] if rev else [0, by0, xf, by1], fill=255)
                tip = (x0 + xf, y0 + yc + math.sin(local * 40) * 5)
            part = line.copy()
            part.putalpha(Image.fromarray(np.minimum(np.asarray(line.split()[3]), np.asarray(mask))))
            canvas.alpha_composite(part, (x0, y0))
        cf = ease((local - sketch_d) / max(0.3, seg["dur"] * 0.25))
        if cf > 0:
            c = color.copy()
            c.putalpha(Image.fromarray((np.asarray(color.split()[3]) * cf).astype(np.uint8)))
            canvas.alpha_composite(c, (x0, y0))
            if seg.get("label"):
                lf = self.f("black", seg.get("label_size", 40))
                d = ImageDraw.Draw(canvas)
                lw = d.textlength(seg["label"], font=lf)
                lx, ly = seg["pos"][0] - lw / 2, y0 + color.height + 12
                d.rounded_rectangle([lx - 16, ly - 4, lx + lw + 16, ly + lf.size + 14], 12,
                                    fill=MILKTEA + (int(255 * cf),))
                d.text((lx, ly), seg["label"], font=lf, fill=DARK + (int(255 * cf),))
        return tip

    # ---------- 各類場景 ----------
    def reader(self, key, *args, **kw):
        if key not in self.readers:
            self.readers[key] = VideoReader(*args, **kw)
        return self.readers[key]

    def badge(self, im, text, xy):
        d = ImageDraw.Draw(im, "RGBA")
        f = self.f("bold", 30)
        w = d.textlength(text, font=f)
        d.rounded_rectangle([xy[0], xy[1], xy[0] + w + 28, xy[1] + 48], 10, fill=(0, 0, 0, 140))
        d.text((xy[0] + 14, xy[1] + 7), text, font=f, fill=CREAM)

    def scene_live(self, scene, t):
        seg = scene["segs"][0]
        # visual_start：畫面從這一秒開始（之前凍結在這格），用來跳過片頭字卡但保留開頭的聲音
        a, b = seg["clip"]
        vs = seg.get("visual_start", a)
        lt = max(0.0, min(t - seg["start"] - (vs - a), b - vs - 1 / FPS))
        if seg.get("fit") == "contain":
            # 完整保留原畫面（含平台加上的 AI 生成標識），左右以模糊放大的同一畫面填滿
            r = self.reader(("live", seg["id"]), seg["video_path"], vs, b, (self.CW, self.CH), mode="contain")
            fr = r.get(lt)
            im = fr.resize((self.CW // 8, self.CH // 8), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
            im = Image.blend(im.resize((self.CW, self.CH), Image.BILINEAR), Image.new("RGB", (self.CW, self.CH), DARKER), 0.45)
            im.paste(fr, ((self.CW - fr.width) // 2, (self.CH - fr.height) // 2))
        else:
            r = self.reader(("live", seg["id"]), seg["video_path"], vs, b, (self.CW, self.CH),
                            focus=seg.get("focus_y", 0.5))
            im = r.get(lt).copy()
        if seg.get("ai_label"):
            self.badge(im, seg["ai_label"], (24, 24))
        return im

    def scene_board(self, scene, t):
        canvas = Image.new("RGBA", (self.CW, self.CH), CREAM + (255,))
        tip = None
        for seg in scene["segs"]:
            if t >= seg["start"]:
                tip = self.draw_icon(canvas, seg, t) or tip
        st = self.boards.setdefault(scene["key"], {})
        rest = (self.CW * 0.88, self.CH * 0.97)
        if tip is None:
            lt = st.get("tip", (self.CW * 1.1, self.CH * 1.1))
            tip = (lt[0] + (rest[0] - lt[0]) * 0.18, lt[1] + (rest[1] - lt[1]) * 0.18)
        st["tip"] = tip
        canvas.alpha_composite(self.hand, (int(tip[0] - self.hand_tip[0]), int(tip[1] - self.hand_tip[1])))
        return canvas.convert("RGB")

    def scene_pip(self, scene, t):
        seg = scene["segs"][0]
        local = t - seg["start"]
        im = Image.new("RGB", (self.CW, self.CH), DARKER)
        sh = int(self.CH * seg.get("screen_height", 0.86))
        sr = self.reader(("screen", seg["id"]), self.p(seg["screen"]), *seg.get("screen_clip", [0, seg["dur"]]),
                         (self.CW - 40, sh), mode="contain", crop=seg.get("screen_crop"))
        fr = sr.get(max(0.0, local))
        im.paste(fr, ((self.CW - fr.width) // 2, 16))
        if seg.get("screen_label"):
            self.badge(im, seg["screen_label"], (36, 32))
        if seg.get("pip"):
            pw, ph = seg.get("pip_size", [240, 300])
            pr = self.reader(("pip", seg["id"]), self.p(seg["pip"]), *seg.get("pip_clip", [0, 5]), (pw, ph),
                             focus=seg.get("pip_focus", 0.3), loop=True)
            k = ease(local / 0.5)
            px = self.CW - pw - 30
            py = 30 if seg.get("pip_pos", "tr") == "tr" else self.CH - ph - 140
            py = int(py - (1 - k) * 40)
            mask = Image.new("L", (pw, ph), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], 28, fill=255)
            d = ImageDraw.Draw(im)
            d.rounded_rectangle([px - 6, py - 6, px + pw + 5, py + ph + 5], 32, fill=GOLD)
            im.paste(pr.get(local), (px, py), mask)
            if seg.get("pip_label"):
                lf = self.f("black", 30)
                lw = d.textlength(seg["pip_label"], font=lf)
                d.rounded_rectangle([px + pw / 2 - lw / 2 - 14, py + ph - 26, px + pw / 2 + lw / 2 + 14,
                                     py + ph + 22], 12, fill=DARK)
                d.text((px + pw / 2, py + ph - 2), seg["pip_label"], font=lf, fill=BRIGHT_GOLD, anchor="mm")
        return im

    def scene_card(self, scene, t):
        seg = scene["segs"][0]
        local = t - seg["start"]
        im = Image.new("RGB", (self.CW, self.CH), CREAM)
        d = ImageDraw.Draw(im)
        m = 60
        d.rounded_rectangle([m, 36, self.CW - m, self.CH - 140], 36, fill=DARK, outline=GOLD, width=5)
        if seg.get("kind") == "info":
            d.text((self.CW / 2, 110), seg["heading"], font=self.f("black", 56), fill=BRIGHT_GOLD, anchor="mm")
            d.line([m + 60, 160, self.CW - m - 60, 160], fill=GOLD, width=2)
            for i, (k, v) in enumerate(seg["rows"]):
                a = ease((local - 0.15 - i * 0.18) / 0.35)
                if a <= 0:
                    continue
                y = 200 + i * 78 + (1 - a) * 30
                d.text((m + 70, y), k, font=self.f("bold", 38), fill=GOLD)
                d.text((m + 230, y - 4), v, font=self.f("black", 44), fill=CREAM)
        else:  # cta
            d.text((self.CW / 2, 140), seg["heading"], font=self.f("black", 60), fill=CREAM, anchor="mm")
            for i, line in enumerate(seg.get("lines", [])):
                d.text((self.CW / 2, 235 + i * 60), line, font=self.f("bold", 40), fill=MILKTEA, anchor="mm")
            pulse = 1 + 0.05 * math.sin(local * 6)
            bw, bh = 520 * pulse, 110 * pulse
            cx, cy = self.CW / 2, 430
            d.rounded_rectangle([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 55, fill=BRIGHT_GOLD)
            d.text((cx, cy), seg["button"], font=self.f("black", int(54 * pulse)), fill=DARK, anchor="mm")
            ay = cy + 80 + 10 * math.sin(local * 6)
            d.polygon([(cx - 36, ay), (cx + 36, ay), (cx, ay + 40)], fill=BRIGHT_GOLD)
        return im

    def render_scene(self, scene, t):
        kind = scene["key"].split(":")[0]
        return {"live": self.scene_live, "board": self.scene_board, "pip": self.scene_pip,
                "card": self.scene_card}[kind](scene, t)

    # ---------- 單格畫面 ----------
    def frame(self, t):
        idx = max(i for i, s in enumerate(self.scenes) if s["start"] <= t + 1e-6)
        cur = self.scenes[idx]
        content = self.render_scene(cur, t)
        k = (t - cur["start"]) / TRANSITION
        if idx > 0 and k < 1:  # 新場景由右側滑入，蓋過上一場景
            prev = self.render_scene(self.scenes[idx - 1], t)
            prev.paste(content, (int(self.CW * (1 - ease(k))), 0))
            content = prev
        small = content.resize((W // 6, H // 6), Image.BILINEAR).filter(ImageFilter.GaussianBlur(4))
        out = Image.blend(small.resize((W, H), Image.BILINEAR), Image.new("RGB", (W, H), DARKER),
                          self.sb.get("bg_darken", 0.55))
        out.paste(content, (0, CONTENT[0]))
        out.paste(self.chrome, (0, 0), self.chrome)
        self.draw_subtitle(out, t)
        return out

    def subtitle_at(self, t):
        for seg in self.segments:
            local = t - seg["start"]
            if seg.get("srt_rows"):
                if not (-0.05 <= local < seg["dur"] + 0.15):
                    continue
                for a, b, text in seg["srt_rows"]:
                    if a - 0.05 <= local < min(b + 0.2, seg["dur"] + 0.15):
                        return text
            elif seg.get("subtitle") and -0.05 <= local < seg["dur"] + 0.15:
                lines = seg["subtitle"] if isinstance(seg["subtitle"], list) else [seg["subtitle"]]
                total, acc = sum(len(s) for s in lines), 0.0
                for s in lines:
                    acc += seg["dur"] * len(s) / total
                    if local < acc:
                        return s
                return lines[-1]
        return None

    def draw_subtitle(self, out, t):
        text = self.subtitle_at(t)
        if text:
            d = ImageDraw.Draw(out)
            size = 62  # 超過 1000px 寬就縮字，最小 46；再長請在分鏡拆成兩句
            while size > 46 and d.textlength(text, font=self.f("black", size)) > W - 80:
                size -= 2
            d.text((W / 2, CONTENT[1] - self.sb.get("subtitle_offset", 110) + 33), text,
                   font=self.f("black", size), fill=DARK, stroke_width=9, stroke_fill=CREAM, anchor="mm")

    # ---------- 音訊：人聲軌 + 背景音樂自動壓低 ----------
    def build_audio(self, path):
        inputs, filt, labels = [], [], []
        for s in self.segments:
            ms = int(s["start"] * 1000)
            if s.get("video_path"):
                a, b = s["clip"]
                src, chain = s["video_path"], (f"atrim={a}:{b},asetpts=PTS-STARTPTS,"
                                               f"afade=t=out:st={b - a - 0.08:.3f}:d=0.08")
            elif s.get("voice_path"):
                src, chain = s["voice_path"], f"atempo={self.tempo}"
            else:
                continue
            i = len(labels)
            inputs += ["-i", src]
            filt.append(f"[{i}:a]{chain},aresample=48000,aformat=channel_layouts=stereo,"
                        f"adelay={ms}|{ms},apad[v{i}]")
            labels.append(f"[v{i}]")
        n = len(labels)
        filt.append(f"{''.join(labels)}amix=inputs={n}:normalize=0,atrim=0:{self.total:.3f},"
                    f"loudnorm=I=-16:TP=-1.5,aresample=48000[voice]")
        bgm = self.sb.get("bgm")
        if bgm:
            inputs += ["-stream_loop", "-1", "-i", self.p(bgm["file"])]
            filt.append("[voice]asplit=2[vo][sc]")
            # 音樂先標準化到固定響度（預設 -28 LUFS，比人聲低 12 dB），不受來源檔音量影響
            filt.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,"
                        f"atrim=0:{self.total:.3f},loudnorm=I={bgm.get('lufs', -28)}:TP=-3,aresample=48000,"
                        f"afade=t=in:d=0.8,afade=t=out:st={self.total - 1.2:.3f}:d=1.2[bg]")
            # 人聲出現時把音樂壓低（ducking）
            filt.append(f"[bg][sc]sidechaincompress=threshold={bgm.get('threshold', 0.02)}:"
                        f"ratio={bgm.get('ratio', 12)}:attack=30:release=600:makeup=1[duck]")
            filt.append("[duck]asplit=2[duck1][duck2]")
            filt.append("[vo][duck1]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]")
        else:
            filt.append("[voice]anull[out]")
        maps = ["-map", "[out]", "-ar", "48000", "-ac", "2", path]
        if bgm:  # 另存壓低後的純音樂軌，供驗證 ducking
            maps += ["-map", "[duck2]", "-ar", "48000", path + ".bgm.wav"] if bgm.get("debug") else []
            if not bgm.get("debug"):
                filt[-2] = "[duck]anull[duck1]"
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt), *maps])

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
            print(f"  {s['start']:6.2f}-{s['start'] + s['dur']:6.2f}  {s['type']:5s} {s['id']}")


if __name__ == "__main__":
    sb_path, out = sys.argv[1], sys.argv[2]
    sb = json.load(open(sb_path, encoding="utf-8"))
    Renderer(sb, os.path.dirname(os.path.abspath(sb_path))).render(out)
