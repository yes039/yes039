"""步驟 3：對白配音（ElevenLabs eleven_v3，吃 [sarcastic] 這類情緒標籤；失敗退 multilingual_v2）
生完自動：去頭尾靜音 → 壓停頓 → **調到目標語速** → 太短的補到 2.2 秒（對嘴模型最少要 2 秒）
語速：episode.json 的 speech_rate（字/秒，預設 4.6＝台灣人講話的速度）；voice_speed 是 ElevenLabs 原生調速 0.7–1.2
用法：python3 gen_audio.py [s01 ...] [--v2]      重生某句：先刪 audio/sXX.mp3 再跑"""
import re, sys, shutil, subprocess, requests
from concurrent.futures import ThreadPoolExecutor
from common import ROOT, EP, key, dur, shots

A = ROOT / "audio"
only = set(a for a in sys.argv[1:] if not a.startswith("--"))
FORCE_V2 = "--v2" in sys.argv
EL = key("ELEVENLABS_API_KEY")
MAXP, KEEP = 0.35, 0.18                      # 停頓超過 0.35 秒就壓到 0.18
SPEED = EP.get("voice_speed", 1.2)           # ElevenLabs 原生調速（上限 1.2）
TARGET = EP.get("speech_rate", 4.6)          # 目標語速：字/秒
MAX_TEMPO = 1.4                              # 後製加速上限（atempo 1.4 內音質還聽不出來，再上去會失真）


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *map(str, args)], check=True)


def tts(text, voice, out, model):
    if model != "eleven_v3":
        text = re.sub(r"\*\]\s*", "", text)
        settings = {"stability": 0.4, "similarity_boost": 0.75, "style": 0.45, "use_speaker_boost": True, "speed": SPEED}
    else:
        settings = {"stability": 0.5, "speed": SPEED}
    for attempt in range(3):  # 共享 voice 第一次用會自動加進帳號，同時打兩個會回 409，等一下重打即可
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                          headers={"xi-api-key": EL}, timeout=120,
                          json={"text": text, "model_id": model, "voice_settings": settings, "language_code": "zh"})
        if r.status_code == 409:
            import time; time.sleep(3 * (attempt + 1)); continue
        if r.status_code != 200:
            raise RuntimeError(f"{r.status_code} {r.text[:200]}")
        break
    raw = out.with_suffix(".raw.mp3"); raw.write_bytes(r.content)
    ff("-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
       "silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=120|120,apad=pad_dur=0.12", "-ar", 44100, out)


def tighten(src):
    orig = src.with_suffix(".orig.mp3"); shutil.copy(src, orig)
    total = dur(orig)
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(orig), "-af", "silencedetect=noise=-30dB:d=0.2", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    if len(en) < len(st): en.append(total)
    keep, cur = [], 0.0
    for s, e in zip(st, en):
        if e >= total - 0.01:
            keep.append((cur, min(total, s + 0.15))); cur = total; break
        if e - s > MAXP and s > 0.05:
            keep.append((cur, s + KEEP / 2)); cur = e - KEEP / 2
    if cur < total: keep.append((cur, total))
    fc = "".join(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS[p{i}];" for i, (a, b) in enumerate(keep))
    fc += "".join(f"[p{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=0:a=1[o]"
    ff("-i", orig, "-filter_complex", fc, "-map", "[o]", "-ar", 44100, src)
    return total, dur(src)


def word_count(text):
    """情緒標籤與標點不算字"""
    return len(re.sub(r"[，。？！、…—\s]", "", re.sub(r"\*\]", "", text)))


def fit_rate(src, text):
    """量實際語速，不夠快就用 atempo 加速（atempo 不會變聲，音高保持）"""
    n = word_count(text)
    d = dur(src)
    if not n or not d:
        return 0.0, 1.0
    rate = n / d
    tempo = min(TARGET / rate, MAX_TEMPO) if rate < TARGET else 1.0
    if tempo > 1.02:
        tmp = src.with_suffix(".fast.mp3")
        ff("-i", src, "-af", f"atempo={tempo:.3f}", "-ar", 44100, tmp); tmp.replace(src)
    d2 = dur(src)
    if d2 < 2.1:   # 對嘴模型最少要 2 秒，補在最後才不會被加速吃掉
        tmp = src.with_suffix(".pad.mp3"); ff("-i", src, "-af", f"apad=pad_dur={2.2 - d2:.2f}", tmp); tmp.replace(src)
        # 🚨 補進去的靜音只是為了餵對嘴模型，鏡頭不該跟著變長 → 把「真正講話的長度」記下來給 timeline 用
        import json as _j
        f = A / "speech_dur.json"
        m = _j.loads(f.read_text()) if f.exists() else {}
        m[src.stem] = round(d2, 3)
        f.write_text(_j.dumps(m, ensure_ascii=False, indent=1))
    return n / d2, tempo   # 語速要用「補靜音前」的長度算，補的靜音會把數字稀釋掉


def job(sh):
    ln = sh.get("line") or sh.get("vo")
    out = A / f"{sh['id']}.mp3"
    if not ln or out.exists():
        return
    voice = EP["characters"][ln["who"]]["voice"]
    try:
        tts(ln["text"], voice, out, "eleven_multilingual_v2" if FORCE_V2 else "eleven_v3")
    except Exception as e:
        print(sh["id"], "v3 失敗，改用 v2：", e)
        tts(ln["text"], voice, out, "eleven_multilingual_v2")
    a, b = tighten(out)
    rate, tempo = fit_rate(out, ln["text"])
    print(f"ok {sh['id']}  {a:.2f}s → {dur(out):.2f}s｜{rate:.2f} 字/秒" + (f"（加速 {tempo:.2f}×）" if tempo > 1.02 else ""))


with ThreadPoolExecutor(3) as ex:
    for f in [ex.submit(job, sh) for sh in shots(only)]:
        f.result()
print("👂 下一步：跑 check_audio.py 讓 Gemini 逐句核對台詞、語氣、口音（聽錯字、把情緒標籤念出來都會抓）")
