"""MPT-001 實測用原創配樂：C 大調、112 BPM，木琴感主旋律＋和弦墊底＋輕鼓。
全部以 numpy 合成，不使用任何取樣或既有曲目。用法：python3 bgm.py out.wav [秒數]"""
import sys, wave
import numpy as np

SR, BPM = 44100, 112
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 34.0
BEAT = 60 / BPM
N = int(DUR * SR)
out = np.zeros(N)
rng = np.random.default_rng(39)

def hz(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, t):
    i = int(t * SR)
    if i >= N: return
    seg = sig[: N - i]
    out[i:i + len(seg)] += seg

def mallet(m, dur=0.5, amp=0.22):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*4*f*t)*np.exp(-t*30)
    return amp * s * np.exp(-t * 6) * np.minimum(1, t / 0.003)

def pad(ms, dur, amp=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2*np.pi*hz(m)*t) + 0.3*np.sin(2*np.pi*2*hz(m)*t) for m in ms)
    env = np.minimum(1, t / 0.3) * np.minimum(1, (dur - t) / 0.3)
    return amp * s * env

def kick(amp=0.5):
    n = int(0.25 * SR); t = np.arange(n) / SR
    return amp * np.sin(2*np.pi*(50 + 90*np.exp(-t*30))*t) * np.exp(-t*14)

def hat(amp=0.05):
    n = int(0.05 * SR); t = np.arange(n) / SR
    return amp * rng.uniform(-1, 1, n) * np.exp(-t * 90)

# I–V–vi–IV（C–G–Am–F），每和弦 2 拍... 每小節 4 拍一個和弦
CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]]
MELODY = [[72, 76, 79, 76], [74, 79, 83, 79], [76, 72, 69, 72], [77, 76, 74, 72]]
bar = 4 * BEAT
nbars = int(DUR / bar) + 1
for b in range(nbars):
    t0 = b * bar
    ch = CHORDS[b % 4]
    add(pad([m + 12 for m in ch], bar), t0)
    add(mallet(ch[0] - 12 + 12, 0.9, 0.18), t0)
    if b >= 1:  # 第 2 小節起加旋律
        for k, m in enumerate(MELODY[b % 4]):
            add(mallet(m), t0 + k * BEAT)
    if b >= 2:  # 第 3 小節起加鼓
        for k in range(4):
            if k in (0, 2): add(kick(), t0 + k * BEAT)
            add(hat(), t0 + k * BEAT + BEAT / 2)

fade = int(1.5 * SR)
out[-fade:] *= np.linspace(1, 0, fade)
out /= np.max(np.abs(out)) / 0.8
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[1], DUR, "s")
