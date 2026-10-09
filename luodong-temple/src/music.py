"""原創配樂：D 宮五聲音階，撥弦（類古箏）主旋律 + 持續低音 + 廟鐘 + 輕鼓。

全部由程式合成，無任何取樣或既有曲目，無版權疑慮。
用法：python3 music.py out.wav [秒數]
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 72
BEAT = 60 / BPM
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
rng = np.random.default_rng(7)

# D 宮五聲：D E F# A B
SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83]  # MIDI，兩個八度


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def pluck(freq, dur, amp=0.5):
    """Karplus-Strong 撥弦，按延遲長度分塊向量化。"""
    n = int(dur * SR)
    N = max(2, int(SR / freq))
    y = np.zeros(n + N + 1)
    y[:N] = rng.uniform(-1, 1, N)
    decay = 0.996
    pos = N
    while pos < len(y):
        end = min(pos + N, len(y))
        seg = y[pos - N:end - N]
        seg2 = y[pos - N - 1:end - N - 1] if pos > N else np.concatenate(([0], y[pos - N:end - N - 1]))
        y[pos:end] = decay * 0.5 * (seg + seg2)
        pos = end
    out = y[N:N + n]
    env = np.minimum(1, np.arange(n) / (0.004 * SR))
    return amp * out * env


def bell(freq, dur, amp=0.35):
    t = np.arange(int(dur * SR)) / SR
    partials = [(0.56, 1.0, 1.2), (1.0, 0.8, 1.6), (1.19, 0.5, 2.4), (2.0, 0.35, 3.0), (2.74, 0.25, 4.5), (3.76, 0.15, 6)]
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d) for r, a, d in partials)
    return amp * s / 3


def drum(dur=0.6, amp=0.5):
    t = np.arange(int(dur * SR)) / SR
    f = 90 * np.exp(-t * 6) + 55
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = rng.uniform(-1, 1, len(t)) * np.exp(-t * 80) * 0.3
    return amp * (body + click)


def woodblock(amp=0.25):
    t = np.arange(int(0.15 * SR)) / SR
    return amp * np.sin(2 * np.pi * 1100 * t) * np.exp(-t * 45)


def add(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[:j - i]


L = np.zeros(int((DUR + 3) * SR))
R = np.zeros_like(L)

# 持續低音（D2 + A2），緩慢起伏
t = np.arange(len(L)) / SR
drone = (np.sin(2 * np.pi * hz(38) * t) * 0.5 + np.sin(2 * np.pi * hz(45) * t) * 0.3
         + np.sin(2 * np.pi * hz(50) * t) * 0.15) * (0.75 + 0.25 * np.sin(2 * np.pi * t / 8))
drone *= 0.09
L += drone
R += drone

# 旋律：4 小節樂句，以音階步進為主
bars = int(DUR / (4 * BEAT)) + 1
rhythms = [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [1, 0.5, 0.5, 2], [2, 1, 1], [0.5, 0.5, 1, 2], [3, 1]]
idx = 4
time = 0.0
for bar in range(bars):
    phrase_end = bar % 4 == 3
    rh = [2, 2] if phrase_end else rhythms[rng.integers(len(rhythms))]
    for k, b in enumerate(rh):
        if bar < 2 and bar * 4 * BEAT + sum(rh[:k]) * BEAT < 4 * BEAT:
            continue  # 前奏只有鐘與低音
        step = rng.choice([-2, -1, -1, 0, 1, 1, 2])
        idx = int(np.clip(idx + step, 1, len(SCALE) - 2))
        if phrase_end and k == len(rh) - 1:
            idx = 0 if bar % 8 == 7 else 3  # 樂句收在 D 或 A
        at = bar * 4 * BEAT + sum(rh[:k]) * BEAT
        note = pluck(hz(SCALE[idx]), b * BEAT + 1.2, 0.42)
        pan = 0.5 + 0.2 * np.sin(at)
        add(L, note * (1 - pan) * 1.4, at)
        add(R, note * pan * 1.4, at)
        if b >= 2:  # 長音加八度裝飾
            orn = pluck(hz(SCALE[idx] + 12), 1.0, 0.12)
            add(L, orn, at + BEAT)
            add(R, orn, at + BEAT)
    # 打擊：每小節第 1 拍鼓，第 3 拍木魚；樂句開頭鐘
    bt = bar * 4 * BEAT
    if bar >= 2:
        d = drum(amp=0.35 if bar % 4 else 0.5)
        add(L, d, bt)
        add(R, d, bt)
        w = woodblock()
        add(L, w * 0.7, bt + 2 * BEAT)
        add(R, w, bt + 2 * BEAT)
    if bar % 8 == 0:
        b_ = bell(hz(50), 6)
        add(L, b_, bt)
        add(R, b_, bt)

# 結尾鐘聲
b_ = bell(hz(50), 5, 0.4)
add(L, b_, DUR - 4.5)
add(R, b_, DUR - 4.5)

n = int(DUR * SR)
st = np.stack([L[:n], R[:n]], axis=1)
fade_in, fade_out = int(1.5 * SR), int(3 * SR)
st[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
st[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
st /= np.max(np.abs(st)) / 0.89
pcm = (st * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], DUR, "s")
