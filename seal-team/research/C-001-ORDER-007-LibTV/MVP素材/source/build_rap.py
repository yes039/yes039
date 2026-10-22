"""5 秒 Rap 導唱軌：96 BPM 鼓組＋貝斯，逐字 TTS 卡在八分音符格上，輸出音節時間表。
用法：python3 build_rap.py <逐字 wav 目錄> <輸出目錄>（逐字 wav 由 vo_syl.py 產生，24 kHz）"""
import json, subprocess, sys, wave
import numpy as np

SR = 48000
BPM = 96
BEAT = 60 / BPM          # 0.625 s
SLOT = BEAT / 2          # 八分音符 0.3125 s
DUR = 5.0
SYL_DIR, OUT = sys.argv[1], sys.argv[2]

# (字, 注音／拼音, 起始八分格, 佔幾格, 嘴型)
LYRIC = [
    ("天", "tiān", 2, 1, "開-展唇"), ("天", "tiān", 3, 1, "開-展唇"),
    ("忙", "máng", 4, 1, "閉→大開"), ("到", "dào", 5, 1, "開→圓"),
    ("半", "bàn", 6, 1, "閉→開"), ("夜", "yè", 7, 2, "展唇-半開"),
    ("月", "yuè", 10, 1, "圓→半開"), ("底", "dǐ", 11, 1, "展唇-小開"),
    ("錢", "qián", 12, 1, "展唇→開"), ("咧", "lie", 13, 2, "半開-上揚語氣"),
]

def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1",
                          "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def trim(a, th=0.02):
    idx = np.where(np.abs(a) > th)[0]
    return a[idx[0]:idx[-1] + 1] if len(idx) else a

def fit(a, max_len):
    """太長就用 atempo 壓縮（不變調），再加 8 ms 淡入淡出。"""
    if len(a) / SR > max_len:
        ratio = (len(a) / SR) / max_len
        p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                            "-filter:a", f"atempo={min(ratio, 2.0):.4f}", "-f", "f32le", "-"],
                           input=a.astype(np.float32).tobytes(), capture_output=True, check=True)
        a = np.frombuffer(p.stdout, np.float32)
    f = int(0.008 * SR)
    a = a.copy(); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    return a

n = int(DUR * SR)
t = np.arange(n) / SR
vox = np.zeros(n, np.float32)
table = []
for i, (ch, py, slot, span, mouth) in enumerate(LYRIC):
    a = fit(trim(load(f"{SYL_DIR}/{i:02d}.wav")), SLOT * span * 0.92)
    s = int(slot * SLOT * SR)
    vox[s:s + len(a)] += a[: n - s]
    table.append({"idx": i + 1, "char": ch, "pinyin": py, "start": round(slot * SLOT, 3),
                  "end": round(slot * SLOT + len(a) / SR, 3), "mouth": mouth,
                  "frame30_start": int(round(slot * SLOT * 30)),
                  "frame30_end": int(round((slot * SLOT + len(a) / SR) * 30))})
vox /= max(1e-6, np.abs(vox).max()); vox *= 0.8

# 鼓組＋貝斯（純程式合成，無取樣、無第三方音源）
rng = np.random.default_rng(7)
beat = np.zeros(n, np.float32)
def put(sig, at):
    s = int(at * SR); e = min(n, s + len(sig)); beat[s:e] += sig[: e - s]
def kick():
    tt = np.arange(int(0.35 * SR)) / SR
    return np.sin(2 * np.pi * (45 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * 0.9
def snare():
    tt = np.arange(int(0.2 * SR)) / SR
    return (rng.standard_normal(len(tt)) * 0.5 + np.sin(2 * np.pi * 190 * tt) * 0.4) * np.exp(-tt * 22) * 0.6
def hat():
    tt = np.arange(int(0.05 * SR)) / SR
    x = rng.standard_normal(len(tt)); x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-tt * 80) * 0.15
for b in range(8):
    at = b * BEAT
    if b in (0, 2, 4, 5, 6): put(kick(), at)
    if b in (1, 3, 5, 7): put(snare(), at)
    put(hat(), at); put(hat() * 0.6, at + SLOT)
bass_notes = [55.0, 55.0, 65.41, 49.0]   # A1 A1 C2 G1，每兩拍換
for k, f0 in enumerate(bass_notes):
    s, e = int(k * 2 * BEAT * SR), int((k + 1) * 2 * BEAT * SR)
    tt = np.arange(e - s) / SR
    beat[s:e] += (np.sin(2 * np.pi * f0 * tt) + 0.3 * np.sin(4 * np.pi * f0 * tt)) * 0.35 * np.minimum(1, tt * 40) * np.exp(-tt * 0.8)
beat /= max(1e-6, np.abs(beat).max()); beat *= 0.7

fade = int(0.15 * SR)
def write(name, x):
    x = x.copy(); x[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    st = np.stack([pcm, pcm], 1)
    with wave.open(f"{OUT}/{name}", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
write("rap-5s-vocal-guide.wav", vox)
write("rap-5s-beat.wav", beat)
mix = vox * 0.85 + beat * 0.55
write("rap-5s-mix.wav", mix / max(1e-6, np.abs(mix).max()) * 0.89)

json.dump({"bpm": BPM, "beat_sec": BEAT, "slot_sec": SLOT, "duration": DUR, "fps_ref": 30,
           "lyric": "天天忙到半夜，月底錢咧？", "syllables": table},
          open(f"{OUT}/音節時間表.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(table, ensure_ascii=False))
