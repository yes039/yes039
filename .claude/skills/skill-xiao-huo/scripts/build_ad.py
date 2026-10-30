#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小貨 · 模式 A：情境帶貨片（一張商品照 → 9:16 有畫面、有字卡、有配樂的帶貨短片）

開新案子（複製範例設定檔＋放好商品照）：
    python3 build_ad.py new ~/小貨案子/保溫杯 商品照.jpg

一份 帶貨片.json 驅動，分七步，每步做完都要「用眼睛看過」再跑下一步：

    python3 build_ad.py 帶貨片.json upscale   # ① 商品照重繪成高解析（外觀照原圖）
    python3 build_ad.py 帶貨片.json scenes    # ② 生情境圖（附高解析圖當參考）
    python3 build_ad.py 帶貨片.json shots     # ③ 情境圖 → 影片鏡頭（並行生成）
    python3 build_ad.py 帶貨片.json check     # ④ 鏡頭抽幀拼圖，人工驗收
    python3 build_ad.py 帶貨片.json music     # ⑤ ElevenLabs 生純配樂 ×N 版＋人聲檢查
    python3 build_ad.py 帶貨片.json cut       # ⑥ 剪輯＋字卡＋混音（每版配樂各出一支）
    python3 build_ad.py 帶貨片.json final     # ⑦ 成片抽幀拼圖，交付前最後一眼

只重做某幾個：在指令後面加名稱，例如
    python3 build_ad.py 帶貨片.json scenes 1_通勤 4_開蓋特寫
（已存在的檔案預設跳過；指名重做的會覆蓋）

🚨 規則（踩過才寫的）
- 生圖、生影片提示詞只寫「想看到的東西」，不寫「不要什麼」——寫了反而會畫出來。
- 一定附「高解析商品圖」當參考，杯蓋、按鍵、比例才會跟原圖一致。
- 生出來的圖要看：假站牌、假文字、結構畫錯（蓋子掀開按鍵還留在杯身）→ 指名重生。
- 生影片模型的關鍵動作常在最後一秒才發生 → 用 ss（從第幾秒切）把動作留住。
- 橫式鏡頭放進直式畫面：底色自動取鏡頭邊緣色、邊緣裁 8px（模型會留細黑線）。
- 語音辨識把純音樂聽成「字幕志愿者 XXX」這類字是幻覺，不是真人聲。
"""
import os, sys, json, time, pathlib, subprocess, datetime, concurrent.futures as cf

IMAGE_MODEL = "gemini-3.1-flash-image"          # 正式版；-preview 版官方已排下架
VIDEO_MODEL = "veo-3.1-fast-generate-preview"   # 🚨 2026-10-22 下架 → 換 gemini-omni-1.1-flash
VIDEO_MODEL_EOL = datetime.date(2026, 10, 22)
W, H, FPS = 1080, 1920, 30


def font_path():
    for p in ("/System/Library/Fonts/STHeiti Medium.ttc", "C:/Windows/Fonts/msjhbd.ttc", "C:/Windows/Fonts/msjh.ttc"):
        if os.path.exists(p):
            return p
    sys.exit("❌ 找不到中文字型")


def load(cfg_path):
    cfg_path = pathlib.Path(cfg_path).resolve()
    return cfg_path.parent, json.loads(cfg_path.read_text(encoding="utf-8"))


def gclient():
    from google import genai
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        sys.exit("❌ GEMINI_API_KEY 沒設")
    return genai.Client(api_key=key)


def gen_image(c, refs, prompt, ratio, dst):
    from google.genai import types
    r = c.models.generate_content(model=IMAGE_MODEL, contents=[*refs, prompt],
        config=types.GenerateContentConfig(response_modalities=["IMAGE"],
                                           image_config=types.ImageConfig(aspect_ratio=ratio)))
    for p in r.candidates[0].content.parts:
        if p.inline_data:
            dst.write_bytes(p.inline_data.data)
            return True
    return False


def wanted(items, names, root, path_of):
    """回傳要做的項目：有指名就只做指名的（覆蓋），沒指名就做還沒產出的。"""
    if names:
        return [it for it in items if it["name"] in names]
    return [it for it in items if not (root / path_of(it)).exists()]


def contact(paths, dst, h=300, cols=None):
    from PIL import Image
    ims = [Image.open(p).convert("RGB") for p in paths]
    ims = [im.resize((int(im.width * h / im.height), h)) for im in ims]
    cols = cols or len(ims)
    rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
    Wc = max(sum(i.width for i in r) for r in rows)
    sheet = Image.new("RGB", (Wc, h * len(rows)), (255, 255, 255))
    for ri, r in enumerate(rows):
        x = 0
        for im in r:
            sheet.paste(im, (x, ri * h)); x += im.width
    sheet.save(dst)
    print(f"🖼  拼圖 → {dst}（一定要打開用眼睛看）")


# ① 商品照重繪
def step_upscale(root, cfg, names):
    from PIL import Image, ImageOps
    src = root / cfg["product_image"]
    dst = root / "高解析商品圖.png"
    if dst.exists() and "force" not in names:
        print(f"⏭  {dst.name} 已存在（要重做加 force）"); return
    im = ImageOps.exif_transpose(Image.open(src))
    print(f"原圖 {im.width}×{im.height}")
    prompt = ("Recreate this exact product photo as a sharp, high-resolution studio product shot. "
              f"Keep exactly the same products in the same order: {cfg['product_desc']}. "
              "Same colors, same proportions, same details. Pure white seamless background, soft even studio lighting, "
              "gentle shadow beneath each item, wide framing with even spacing. Plain surfaces exactly as in the reference.")
    ok = gen_image(gclient(), [im], prompt, cfg.get("upscale_ratio", "16:9"), dst)
    print("✅" if ok else "❌", dst, "→ 跟原圖並排比對：顏色、按鍵、比例有沒有跑掉")


# ② 情境圖
def step_scenes(root, cfg, names):
    from PIL import Image
    ref = Image.open(root / "高解析商品圖.png")
    (root / "情境圖").mkdir(exist_ok=True)
    c = gclient()
    for it in wanted(cfg["scenes"], names, root, lambda it: f"情境圖/{it['name']}.png"):
        p = "Use the attached product as the exact product reference. " + it["prompt"]
        ok = gen_image(c, [ref], p, it.get("ratio", "9:16"), root / f"情境圖/{it['name']}.png")
        print("✅" if ok else "❌", it["name"])
    paths = sorted((root / "情境圖").glob("*.png"))
    if paths:
        contact(paths, root / "情境圖_驗收.png", h=533)


# ③ 影片鏡頭
def step_shots(root, cfg, names):
    from google.genai import types
    if datetime.date.today() >= VIDEO_MODEL_EOL:
        sys.exit(f"❌ {VIDEO_MODEL} 已於 {VIDEO_MODEL_EOL} 下架，先把 VIDEO_MODEL 改成新模型")
    c = gclient()
    (root / "鏡頭").mkdir(exist_ok=True)
    todo = wanted(cfg["shots"], names, root, lambda it: f"鏡頭/{it['name']}.mp4")

    def run(it):
        from PIL import Image
        img = root / it["image"]
        w, h = Image.open(img).size
        ar = "16:9" if w > h else "9:16"
        op = c.models.generate_videos(model=VIDEO_MODEL, prompt=it["prompt"],
            image=types.Image(image_bytes=img.read_bytes(), mime_type="image/png"),
            config=types.GenerateVideosConfig(aspect_ratio=ar, number_of_videos=1,
                                              duration_seconds=it.get("gen_seconds", 6)))
        t = 0
        while not op.done:
            time.sleep(15); t += 15
            if t > 600:
                return it["name"], "逾時"
            op = c.operations.get(op)
        if op.error:
            return it["name"], str(op.error)[:200]
        v = op.response.generated_videos[0].video
        c.files.download(file=v); v.save(str(root / f"鏡頭/{it['name']}.mp4"))
        return it["name"], "ok"

    print(f"生 {len(todo)} 個鏡頭（並行，約 2–5 分鐘）")
    with cf.ThreadPoolExecutor(max(1, len(todo))) as ex:
        for n, r in ex.map(run, todo):
            print(("✅ " if r == "ok" else "❌ ") + n, "" if r == "ok" else r, flush=True)


def grab(video, t, dst, h=300):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(video), "-frames:v", "1",
                    "-vf", f"scale=-2:{h}", str(dst)], check=True)


# ④ 鏡頭驗收
def step_check(root, cfg, names):
    tmp = root / "_驗收"; tmp.mkdir(exist_ok=True)
    rows = []
    for it in cfg["shots"]:
        v = root / f"鏡頭/{it['name']}.mp4"
        if not v.exists():
            print("⚠️ 缺", v.name); continue
        for i, t in enumerate((0.5, 2, 3.5, 5)):
            p = tmp / f"{it['name']}_{i}.png"; grab(v, t, p); rows.append(p)
    contact(rows, root / "鏡頭_驗收.png", cols=4)
    print("看：變形、亂碼字、假標誌、結構畫錯、關鍵動作出現在第幾秒（調 ss／dur）、畫面有沒有出框")


# ⑤ 配樂
def step_music(root, cfg, names):
    import requests
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("❌ ELEVENLABS_API_KEY 沒設")
    (root / "配樂").mkdir(exist_ok=True)
    total = cut_total(cfg)
    todo = wanted(cfg["music"], names, root, lambda it: f"配樂/{it['name']}.mp3")

    def run(it):
        p = "Instrumental only, no vocals. " + it["prompt"]
        r = requests.post("https://api.elevenlabs.io/v1/music", headers={"xi-api-key": key},
                          params={"output_format": "mp3_44100_192"},
                          json={"prompt": p, "music_length_ms": int((total + 1) * 1000),
                                "model_id": "music_v2", "force_instrumental": True}, timeout=900)
        if r.status_code != 200:
            return it["name"], f"{r.status_code} {r.text[:200]}"
        (root / f"配樂/{it['name']}.mp3").write_bytes(r.content)
        return it["name"], "ok"

    with cf.ThreadPoolExecutor(max(1, len(todo))) as ex:
        for n, r in ex.map(run, todo):
            print(("✅ " if r == "ok" else "❌ ") + n, "" if r == "ok" else r, flush=True)
    # 人聲檢查（有裝 whisper 才跑）
    try:
        import whisper
        m = whisper.load_model("large-v3-turbo")
        for it in cfg["music"]:
            f = root / f"配樂/{it['name']}.mp3"
            if f.exists():
                txt = m.transcribe(str(f), language="zh")["text"].strip()
                print(f"🎧 {it['name']} 辨識：{txt!r}  ← 空白或「字幕志愿者」這類字＝純配樂；出現通順句子才是混到人聲")
    except ImportError:
        print("（沒裝 whisper，人聲檢查略過 → 自己戴耳機聽一遍）")


def cut_total(cfg, X=0.35):
    return sum(s["dur"] for s in cfg["shots"]) - X * (len(cfg["shots"]) - 1)


def edge_color(video):
    import numpy as np
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", "1", "-i", str(video), "-frames:v", "1",
                          "-vf", "scale=320:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    h = len(out) // (320 * 3)
    a = np.frombuffer(out, np.uint8).reshape(h, 320, 3)
    c = np.concatenate([a[2:10].reshape(-1, 3), a[-10:-2].reshape(-1, 3)]).mean(0).astype(int)
    return "0x%02X%02X%02X" % tuple(c)


def caption_png(big, small, dst, tag, end_line=None, logo=None):
    from PIL import Image, ImageDraw, ImageFont
    F = font_path()
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    g = Image.linear_gradient("L").resize((W, 520)).point(lambda v: int(v * 150 / 255))
    sh = Image.new("RGBA", (W, 520), (0, 0, 0, 255)); sh.putalpha(g); im.alpha_composite(sh, (0, H - 520))
    for txt, s, y in ((big, 110, H - 430), (small, 60, H - 280)):
        if not txt:
            continue
        f = ImageFont.truetype(F, s); w = d.textlength(txt, font=f)
        d.text(((W - w) / 2, y), txt, font=f, fill=(255, 255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0, 160))
    if end_line:
        f = ImageFont.truetype(F, 46); w = d.textlength(end_line, font=f)
        d.text(((W - w) / 2, H - 560), end_line, font=f, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0, 160))
    if tag:
        f = ImageFont.truetype(F, 32); w = d.textlength(tag, font=f)
        d.rounded_rectangle((30, 60, 74 + w, 112), 26, fill=(0, 0, 0, 110))
        d.text((52, 68), tag, font=f, fill=(255, 255, 255, 235))
    if logo:   # 右上角品牌標誌（客戶片放客戶的，你的公司自家片才放龍蝦）
        lg = Image.open(logo).convert("RGBA"); r = 120 / max(lg.size)
        lg = lg.resize((int(lg.width * r), int(lg.height * r)))
        lg.putalpha(lg.split()[3].point(lambda v: int(v * 0.85)))
        im.alpha_composite(lg, (W - lg.width - 40, 50))
    im.save(dst)


# ⑥ 剪輯＋混音
def step_cut(root, cfg, names):
    from PIL import Image
    tmp = root / "_剪"; tmp.mkdir(exist_ok=True)
    X = 0.35
    tag = cfg.get("tag", "AI 生成")
    logo = str(root / cfg["logo"]) if cfg.get("logo") else None
    parts = []
    for i, s in enumerate(cfg["shots"]):
        v = root / f"鏡頭/{s['name']}.mp4"
        cap = tmp / f"字{i}.png"
        caption_png(s.get("big", ""), s.get("small", ""), cap, tag, s.get("end_line"), logo)
        probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                "stream=width,height", "-of", "csv=p=0", str(v)], capture_output=True, text=True).stdout
        vw, vh = map(int, probe.strip().split(","))
        if vw > vh:   # 橫式鏡頭 → 放在直式畫面中間，底色取鏡頭邊緣色
            bg = edge_color(v)
            vf = (f"[0:v]crop=iw-8:ih-12,scale={W}:-2,setsar=1[v];color=c={bg}:s={W}x{H}:d={s['dur']}[bg];"
                  f"[bg][v]overlay=0:(H-h)/2-120:shortest=1[b];[b][1:v]overlay=0:0,fps={FPS},format=yuv420p")
        else:
            vf = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[b];"
                  f"[b][1:v]overlay=0:0,fps={FPS},format=yuv420p")
        out = tmp / f"段{i}.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(s.get("ss", 0)), "-i", str(v), "-loop", "1", "-i", str(cap),
                        "-filter_complex", vf, "-t", str(s["dur"]), "-an", "-c:v", "libx264", "-crf", "18",
                        "-preset", "medium", str(out)], check=True)
        parts.append((out, s["dur"]))
    # 交叉淡化串成無聲母片
    inputs, fc, prev, off = [], "", "[0:v]", 0
    for p, _ in parts:
        inputs += ["-i", str(p)]
    for i in range(1, len(parts)):
        off += parts[i - 1][1] - X
        fc += f"{prev}[{i}:v]xfade=transition=fade:duration={X}:offset={off:.2f}[x{i}];"; prev = f"[x{i}]"
    total = cut_total(cfg, X)
    silent = tmp / "無聲母片.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc.rstrip(";"), "-map", prev,
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", str(silent)], check=True)
    # 每版配樂各出一支（音量對齊短影音平台標準 −14）
    base = cfg.get("out_name", "帶貨短片")
    for m in cfg["music"]:
        mp3 = root / f"配樂/{m['name']}.mp3"
        if not mp3.exists():
            print("⚠️ 缺配樂", mp3.name); continue
        dst = root / f"{base}_{m['name']}_9比16.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(mp3), "-filter_complex",
                        f"[1:a]atrim=0:{total},afade=t=in:d=0.3,afade=t=out:st={total - 1.2}:d=1.2,"
                        f"loudnorm=I=-14:TP=-1.5:LRA=11[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
                        "-t", f"{total:.2f}", str(dst)], check=True)
        print(f"✅ {dst.name}（{total:.1f} 秒）")


# ⑦ 成片驗收
def step_final(root, cfg, names):
    tmp = root / "_驗收"; tmp.mkdir(exist_ok=True)
    base = cfg.get("out_name", "帶貨短片")
    vids = sorted(root.glob(f"{base}_*_9比16.mp4"))
    if not vids:
        sys.exit("❌ 還沒有成片，先跑 cut")
    v = vids[0]; ts, t = [], 0.0
    for s in cfg["shots"]:
        ts.append(t + s["dur"] * 0.6); t += s["dur"] - 0.35
    paths = []
    for i, x in enumerate(ts):
        p = tmp / f"成片_{i}.png"; grab(v, x, p, h=480); paths.append(p)
    contact(paths, root / "成片_驗收.png", h=480)
    print("看：字卡有沒有被切、壓到商品；左上角 AI 標示在不在；收尾那鏡有沒有色帶或黑線")


def step_new(dst, img):
    import shutil
    dst = pathlib.Path(dst).expanduser().resolve()
    if "Desktop" in dst.parts or "桌面" in dst.parts:
        print("⚠️ 案子放桌面會被 iCloud 搬走、腳本讀到空殼檔卡住 → 建議放家目錄，例如 ~/小貨案子/")
    dst.mkdir(parents=True, exist_ok=True)
    here = pathlib.Path(__file__).resolve().parent.parent / "templates"
    cfg = dst / "帶貨片.json"
    if cfg.exists():
        sys.exit(f"❌ {cfg} 已存在，不覆蓋")
    shutil.copy(here / "帶貨片_範例.json", cfg)
    src = pathlib.Path(img).expanduser()
    shutil.copy(src, dst / ("原圖" + src.suffix.lower()))
    d = json.loads(cfg.read_text(encoding="utf-8")); d["product_image"] = "原圖" + src.suffix.lower()
    cfg.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ 開好了：{dst}\n下一步：打開 帶貨片.json 改 product_desc／scenes／shots／music，再跑 upscale")


STEPS = {"upscale": step_upscale, "scenes": step_scenes, "shots": step_shots, "check": step_check,
         "music": step_music, "cut": step_cut, "final": step_final}

if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "new":
        step_new(sys.argv[2], sys.argv[3]); sys.exit()
    if len(sys.argv) < 3 or sys.argv[2] not in STEPS:
        sys.exit(__doc__)
    root, cfg = load(sys.argv[1])
    STEPS[sys.argv[2]](root, cfg, sys.argv[3:])
