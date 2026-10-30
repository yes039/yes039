#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小貨 · 片型丁：動態圖卡＋旁白版（2026-10-06 無塵氏除塵紙案做出來的流程）

前置：片型甲的案子已經跑到 shots（鏡頭/ 都齊了）、配樂/ 至少一版。
在 帶貨片.json 每個 shot 加 "say"：這一鏡要唸的旁白（只講字卡上的真實賣點）。
選填："voice": "Leda"（Gemini 預設聲音名）、"music_pick": "B_輕電子"。

用法（在案子資料夾裡）：
    python3 motion_voice.py 帶貨片.json base     # 出一支沒有字卡的底片（沿用 build_ad 的剪法）
    python3 motion_voice.py 帶貨片.json tts      # 每鏡旁白各生一句；可只重做：tts 3 8
    python3 motion_voice.py 帶貨片.json render   # 無頭 Chrome 逐格渲染動態圖卡（第一次會自動裝工具）
    python3 motion_voice.py 帶貨片.json mix      # 圖卡疊上、旁白放定位、配樂遇旁白自動壓低
    python3 motion_voice.py 帶貨片.json check    # 抽幀拼圖＋全片聽寫＋空檔雜音掃描

🚨 文字轉語音三個雷（都撞過）：
  1. 語氣指示要用英文寫，中文指示會被當台詞唸出來。
  2. gemini-3.8-flash-tts 回傳的是完整音訊檔（有表頭，結尾還附 C2PA 憑證區塊），
     不能再包一層表頭——會在每句頭尾各出一聲雜音。腳本用 wave 正規讀取只取聲音資料。
  3. 偶爾一句停不下來（生出 200 多秒），tts 會自動擋下來重生。
"""
import sys, json, wave, io, pathlib, subprocess, shutil, concurrent.futures as cf

HERE = pathlib.Path(__file__).resolve().parent
TTS_MODEL = "gemini-3.8-flash-tts"
STYLE = ("Read the following Traditional Chinese line aloud in Taiwanese Mandarin, as a cheerful, energetic "
         "young female TV-shopping host, slightly fast pace. Speak only the line itself:\n")
FPS, X = 30, 0.35


def load(p):
    p = pathlib.Path(p).resolve(); return p.parent, json.loads(p.read_text(encoding="utf-8"))


def timeline(cfg):
    t, shots = 0.0, []
    for s in cfg["shots"]:
        shots.append({"t0": round(t, 3), "t1": round(t + s["dur"], 3), "big": s.get("big", ""),
                      "small": s.get("small", ""), "end": s.get("end_line", ""), "say": s.get("say", "")})
        t += s["dur"] - X
    # tag：左上角標示（有實拍畫面就寫「部分畫面 AI 生成」）；cta：結尾按鈕字
    return {"shots": shots, "total": round(t + X, 3),
            "tag": cfg.get("tag") or "AI 生成", "cta": cfg.get("cta") or "趕快去買！"}


def step_base(root, cfg, a):
    base = dict(cfg); base["tag"] = ""; base["out_name"] = "無字底片"
    base["shots"] = [{**s, "big": "", "small": "", "end_line": ""} for s in cfg["shots"]]
    pick = cfg.get("music_pick") or cfg["music"][0]["name"]
    base["music"] = [m for m in cfg["music"] if m["name"] == pick]
    (root / "_底片.json").write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
    subprocess.run([sys.executable, str(HERE / "build_ad.py"), str(root / "_底片.json"), "cut"], check=True)
    (root / "時間軸.json").write_text(json.dumps(timeline(cfg), ensure_ascii=False, indent=1), encoding="utf-8")


def step_tts(root, cfg, a):
    from google import genai
    from google.genai import types
    c = genai.Client(); tl = timeline(cfg)["shots"]; (root / "旁白").mkdir(exist_ok=True)
    idx = [int(x) for x in a] or [i for i, s in enumerate(tl) if s["say"]]

    def one(i):
        slot = tl[i]["t1"] - tl[i]["t0"] - 0.5
        for _ in range(3):
            r = c.models.generate_content(model=TTS_MODEL, contents=STYLE + tl[i]["say"],
                config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=cfg.get("voice", "Leda"))))))
            data = r.candidates[0].content.parts[0].inline_data.data
            if data[:4] == b"RIFF":            # 完整音訊檔 → 正規讀出聲音資料，丟掉表頭與 C2PA 區塊
                w = wave.open(io.BytesIO(data)); sr = w.getframerate(); pcm = w.readframes(w.getnframes())
            else:
                sr, pcm = 24000, data
            d = len(pcm) / 2 / sr
            if d <= slot + 1.5:
                break                          # 停不下來的那種（幾十～幾百秒）就重生
        with wave.open(str(root / f"旁白/{i:02d}.wav"), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm)
        return i, d, slot

    with cf.ThreadPoolExecutor(4) as ex:
        for i, d, slot in ex.map(one, idx):
            print(f"{'✅' if d <= slot else '⚠️ 太長，縮短台詞'} {i:02d} 旁白 {d:.2f} 秒／時段 {slot:.2f} 秒  {tl[i]['say']}")


def step_render(root, cfg, a):
    if not (HERE / "motion/node_modules/puppeteer-core").exists():
        print("第一次使用：安裝無頭瀏覽器控制工具…")
        subprocess.run(["npm", "install", "--silent"], cwd=HERE / "motion", check=True)
    if not (root / "時間軸.json").exists():
        (root / "時間軸.json").write_text(json.dumps(timeline(cfg), ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.rmtree(root / "圖卡幀", ignore_errors=True) if not a else None
    subprocess.run(["node", str(HERE / "motion/渲染.mjs"), str(root), *([",".join(a)] if a else [])], check=True)


def step_mix(root, cfg, a):
    tl = timeline(cfg); T = tl["total"]
    pick = cfg.get("music_pick") or cfg["music"][0]["name"]
    base = root / f"無字底片_{pick}_9比16.mp4"
    ins, fc, n = [], [], 0
    for i, s in enumerate(tl["shots"]):
        f = root / f"旁白/{i:02d}.wav"
        if not s["say"] or not f.exists():
            continue
        d = wave.open(str(f)).getnframes() / wave.open(str(f)).getframerate()
        ins += ["-i", str(f)]
        fc.append(f"[{n}:a]aresample=48000,afade=t=in:d=0.015,afade=t=out:st={d - 0.015:.3f}:d=0.015,"
                  f"adelay={int((s['t0'] + 0.2) * 1000)}:all=1[v{n}]"); n += 1
    fc.append("".join(f"[v{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{T}[vo]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(fc), "-map", "[vo]",
                    str(root / "旁白軌.wav")], check=True)
    out = root / f"{cfg.get('out_name', '帶貨短片')}_動態旁白版_9比16.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(base), "-framerate", str(FPS), "-i", str(root / "圖卡幀/%05d.png"),
        "-i", str(root / "旁白軌.wav"), "-i", str(root / f"配樂/{pick}.mp3"), "-filter_complex",
        "[0:v][1:v]overlay=0:0:shortest=1,format=yuv420p[v];[2:a]volume=1.6,asplit=2[vo][sc];"
        f"[3:a]atrim=0:{T},afade=t=in:d=0.3,afade=t=out:st={T - 1.2}:d=1.2,volume=0.55[m];"
        "[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[md];"
        "[md][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", "-t", f"{T:.2f}", str(out)], check=True)
    print(f"✅ {out.name}（{T:.1f} 秒）")


def step_check(root, cfg, a):
    import numpy as np
    out = next(root.glob("*_動態旁白版_9比16.mp4"))
    tl = timeline(cfg)["shots"]; tmp = root / "_驗收"; tmp.mkdir(exist_ok=True); ps = []
    for i, s in enumerate(tl):
        p = tmp / f"動態_{i:02d}.png"; ps.append(p)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["t0"] + (s["t1"] - s["t0"]) * 0.6), "-i", str(out),
                        "-frames:v", "1", "-vf", "scale=-2:480", str(p)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", str(p)] for p in ps], []), "-filter_complex",
                    f"hstack={len(ps)}", str(root / "動態旁白版_驗收.png")], check=True)
    print("🖼  拼圖 → 動態旁白版_驗收.png（圖卡有沒有壓到商品、AI 標示在不在）")
    # 旁白檔體檢：雙層表頭／結尾夾帶憑證區塊，都會在句子頭尾出雜音
    bad = []
    for f in sorted((root / "旁白").glob("*.wav")):
        w = wave.open(str(f)); sr = w.getframerate(); raw = w.readframes(w.getnframes())
        x = np.frombuffer(raw, np.int16).astype(float) / 32768
        tail = 20 * np.log10(np.sqrt(np.mean(x[-int(.08 * sr):] ** 2)) + 1e-9)
        if raw[:4] == b"RIFF" or abs(x[0]) > 0.3 or tail > -30:
            bad.append(f"{f.name}（{'雙層表頭' if raw[:4] == b'RIFF' else f'結尾 {tail:.0f}dB'}）")
    print("✅ 旁白檔頭尾乾淨" if not bad else "❌ 旁白檔頭尾有雜音：" + "、".join(bad) + " → 重跑 tts")
    try:
        import whisper
        r = whisper.load_model("small").transcribe(str(out), language="zh", initial_prompt="繁體中文。")
        for s in r["segments"]:
            print(f"🎧 {s['start']:5.1f} {s['text']}")
        print("（同音字聽錯正常；要看的是每句都在、時間點落在對的鏡頭）")
    except ImportError:
        print("（沒裝 whisper → 戴耳機聽一遍）")


STEPS = {"base": step_base, "tts": step_tts, "render": step_render, "mix": step_mix, "check": step_check}
if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[2] not in STEPS:
        sys.exit(__doc__)
    root, cfg = load(sys.argv[1]); STEPS[sys.argv[2]](root, cfg, sys.argv[3:])
