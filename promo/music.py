"""合成 30 秒原創背景音樂（無版權疑慮），輸出 media/bgm.wav。

節奏 120 BPM，A 小調五聲音階，三味線風撥弦主旋律；重音對齊 scene.html 的剪輯點。
用法：python3 promo/music.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BEAT = 0.5  # 120 BPM
rng = np.random.default_rng(3)

L = np.zeros(N)
R = np.zeros(N)
duck = np.ones(N)  # kick 觸發的側鏈壓縮


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def lowpass(x, k):
    # 簡單單極低通
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc)
        y[i] = acc
    return y


# ---------- 音色 ----------
def kick(t, g=1.0):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 35)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
    s += 0.3 * rng.standard_normal(n) * np.exp(-tt * 200)
    add(np.tanh(s * 1.6), t, 0.9 * g)
    i = int(t * SR)
    m = min(N - i, int(0.3 * SR))
    if m > 0:
        duck[i:i + m] = np.minimum(duck[i:i + m], 0.35 + 0.65 * (np.arange(m) / m) ** 0.6)


def taiko(t, g=1.0):
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    f = 55 + 70 * np.exp(-tt * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2)
    s += 0.5 * lowpass(rng.standard_normal(n), 0.08) * np.exp(-tt * 12)
    add(np.tanh(s * 2.2), t, 1.0 * g)


def clap(t, g=1.0):
    n = int(0.25 * SR)
    tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    nz = nz - lowpass(nz, 0.15)
    e = np.exp(-tt * 28) + 0.6 * np.exp(-np.maximum(tt - 0.012, 0) * 60) * (tt > 0.012)
    add(nz * e, t, 0.32 * g, 0.1)


def hat(t, g=1.0, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    nz = nz - lowpass(nz, 0.5)
    add(nz * np.exp(-tt * (18 if open_ else 90)), t, 0.14 * g, -0.3)


def bass(t, note, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = midi(note)
    s = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 6))
    s *= np.minimum(tt / 0.005, 1) * np.exp(-tt * 3) * np.minimum((dur - tt) / 0.02, 1)
    add(np.tanh(s * 1.2), t, 0.34 * g)


def shamisen(t, note, dur=0.45, g=1.0, pan=0.25):
    # Karplus-Strong 撥弦
    f = midi(note)
    p = int(SR / f)
    n = int(dur * SR)
    buf = rng.uniform(-1, 1, p)
    out = np.empty(n)
    for i in range(n):
        v = buf[i % p]
        out[i] = v
        buf[i % p] = 0.497 * (v + buf[(i + 1) % p])
    out *= np.minimum(np.arange(n) / (0.002 * SR), 1)
    out[-400:] *= np.linspace(1, 0, 400)
    add(out, t, 0.42 * g, pan)


def pad(t, notes, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for nt in notes:
        for det in (-0.12, 0.12):
            f = midi(nt + det)
            s += sum(np.sin(2 * np.pi * f * k * tt + k) / k ** 1.5 for k in range(1, 4))
    s *= np.minimum(tt / 0.25, 1) * np.minimum((dur - tt) / 0.3, 1).clip(0)
    add(s / len(notes), t, 0.05 * g, -0.2)
    add(s / len(notes), t + 0.012, 0.05 * g, 0.4)


def stab(t, notes, g=1.0):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for nt in notes:
        f = midi(nt)
        s += sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 7))
    add(np.tanh(s / len(notes) * env(n, 0.003, 0.18) * 1.5), t, 0.3 * g)


def riser(t0, t1, g=1.0):
    n = int((t1 - t0) * SR)
    p = np.linspace(0, 1, n)
    nz = rng.standard_normal(n)
    k = 0.02 + 0.5 * p
    y = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += k[i] * (nz[i] - acc)
        y[i] = acc
    add(y * p ** 2, t0, 0.35 * g)


def crash(t, g=1.0):
    n = int(1.8 * SR)
    tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    nz = nz - lowpass(nz, 0.3)
    add(nz * np.exp(-tt * 2.2), t, 0.13 * g, 0.2)


# ---------- 編曲 ----------
# Am - F - G - Am（每小節 2 秒）
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (55, [55, 59, 62]), (57, [57, 60, 64])]
# 主旋律（八分音符，None 為休止），A 小調五聲音階
HOOK = [
    69, None, 72, 74, 76, None, 74, 72,
    74, None, 72, 69, 67, None, 69, None,
    69, None, 72, 74, 76, None, 79, 76,
    74, 72, 74, 76, 69, None, None, None,
]


def groove(start, end, lead=True, hats=True, full=True):
    bar = 0
    t = start
    while t < end - 1e-6:
        root, chord = CHORDS[bar % 4]
        for b in range(4):
            bt = t + b * BEAT
            if bt >= end:
                break
            kick(bt)
            if b in (1, 3):
                clap(bt)
            if hats:
                hat(bt + BEAT / 2, 1.0, open_=(b == 3))
                hat(bt, 0.5)
            # 八分音符彈跳貝斯
            for k, off in enumerate((0, 0.25)):
                if bt + off < end:
                    bass(bt + off, root - 12 + (12 if k and b % 2 else 0), 0.22)
        if full:
            pad(t, [n + 12 for n in chord], min(2.0, end - t))
        if lead:
            for k in range(8):
                nt = HOOK[(bar % 4) * 8 + k]
                lt = t + k * BEAT / 2
                if nt is not None and lt < end:
                    shamisen(lt, nt, 0.5)
        bar += 1
        t += 4 * BEAT


# 開場：riser → 「夯」落下太鼓（0.6s） → 氛圍
riser(0.0, 0.6, 0.8)
taiko(0.6, 1.2)
crash(0.6, 1.0)
pad(0.6, [69, 72, 76], 2.5, 1.4)
for k, nt in enumerate([81, 79, 76, 74, 72]):
    shamisen(1.0 + k * 0.18, nt, 0.6, 0.7, pan=-0.2)
taiko(1.8, 0.5)
taiko(2.3, 0.6)
riser(2.2, 3.0, 0.6)

# 主段 3.0–18.6（第一小節不加主旋律）
groove(3.0, 5.0, lead=False)
groove(5.0, 18.6)
crash(3.0, 0.8)
crash(7.6, 0.6)
crash(14.1, 0.6)

# 節奏字卡：下班後／來一串／配一杯
for t, ch in ((18.7, [57, 60, 64]), (19.7, [53, 57, 60]), (20.7, [55, 59, 62])):
    taiko(t, 0.9)
    stab(t, [n + 12 for n in ch])
    shamisen(t, ch[-1] + 12, 0.6, 0.8, pan=-0.2)
riser(20.9, 21.8, 0.9)

# 高潮 21.8–25.1、結尾 25.1–30
taiko(21.8, 1.0)
crash(21.8, 1.0)
groove(21.8, 25.1)
taiko(25.1, 0.8)
crash(25.1, 0.8)
groove(25.1, 29.1, lead=True, hats=True)
stab(29.1, [69, 72, 76], 1.2)
taiko(29.1, 1.1)
crash(29.1, 0.9)

# ---------- 混音 ----------
mix = np.stack([L, R])
mix *= duck ** 0.5
fade = np.ones(N)
fn = int(0.9 * SR)
fade[-fn:] = np.linspace(1, 0, fn)
mix *= fade
mix = np.tanh(mix * 1.3)
mix /= np.max(np.abs(mix)) / 0.89

out = Path(__file__).parent / 'media' / 'bgm.wav'
pcm = (mix.T * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'完成：{out}')
