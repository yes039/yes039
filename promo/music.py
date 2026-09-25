"""合成 30 秒原創背景音樂（無版權疑慮），輸出 media/bgm.wav。

台味電音：140 BPM 四拍踩底鼓、嗩吶主旋律（滑音＋抖音）、那卡西電子琴反拍「蹦恰」、鑼鈸重音。
G 大調五聲音階，和弦 G–Em–C–D；重音對齊 scene.html 的剪輯點。
用法：python3 promo/music.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 140
BEAT = 60 / BPM
rng = np.random.default_rng(5)

L = np.zeros(N)
R = np.zeros(N)
duck = np.ones(N)  # 底鼓觸發的側鏈壓縮


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def lowpass(x, k):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc)
        y[i] = acc
    return y


def highpass(x, k):
    return x - lowpass(x, k)


# ---------- 打擊 ----------
def kick(t, g=1.0):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = 48 + 120 * np.exp(-tt * 40)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    s += 0.4 * rng.standard_normal(n) * np.exp(-tt * 250)
    add(np.tanh(s * 1.8), t, 0.85 * g)
    i = int(t * SR)
    m = min(N - i, int(0.22 * SR))
    if m > 0:
        duck[i:i + m] = np.minimum(duck[i:i + m], 0.4 + 0.6 * (np.arange(m) / m) ** 0.6)


def snare(t, g=1.0):
    n = int(0.22 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30)
    nz = highpass(rng.standard_normal(n), 0.2) * np.exp(-tt * 22)
    add(np.tanh((0.6 * body + nz) * 1.2), t, 0.3 * g, 0.05)


def hat(t, g=1.0, open_=False):
    n = int((0.16 if open_ else 0.04) * SR)
    tt = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 0.55)
    add(nz * np.exp(-tt * (20 if open_ else 110)), t, 0.13 * g, -0.3)


def gong(t, g=1.0):
    # 鑼：不和諧泛音＋輕微下滑音高
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in ((1.0, 1.0, 1.2), (1.52, 0.6, 1.0), (2.14, 0.45, 0.8), (2.76, 0.3, 0.6), (3.4, 0.25, 0.5)):
        f = 150 * ratio * (1 - 0.03 * (1 - np.exp(-tt * 3)))
        s += amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / dec)
    s += 0.4 * lowpass(rng.standard_normal(n), 0.1) * np.exp(-tt * 15)
    s *= np.minimum(tt / 0.004, 1)
    add(np.tanh(s * 0.9), t, 0.5 * g, -0.15)


def cymbal(t, g=1.0):
    # 鈸：明亮長尾噪音＋金屬泛音
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 0.35)
    metal = sum(np.sin(2 * np.pi * f * tt) for f in (3150, 4270, 5510, 6930)) * 0.15
    add((nz + metal) * np.exp(-tt * 2.6), t, 0.2 * g, 0.25)


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
    add(y * p ** 2, t0, 0.3 * g)


# ---------- 旋律樂器 ----------
def formant(f):
    # 嗩吶的鼻音共鳴
    return (1.0 * np.exp(-((f - 1300) / 500) ** 2) + 0.7 * np.exp(-((f - 2900) / 700) ** 2)
            + 0.25 * np.exp(-((f - 600) / 300) ** 2) + 0.05)


def suona(t, note, dur, g=1.0, bend=True):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f0 = midi(note)
    slide = -1.2 * np.exp(-tt / 0.035) if bend else 0
    vib = 0.35 * np.minimum(tt / 0.3, 1) * np.sin(2 * np.pi * 6.2 * tt)
    f = f0 * 2 ** ((slide + vib) / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.zeros(n)
    for k in range(1, 22):
        if f0 * k > 9000:
            break
        s += np.sin(ph * k) / k ** 0.8 * formant(f0 * k)
    e = np.minimum(tt / 0.015, 1) * np.minimum((dur - tt) / 0.04, 1).clip(0) * (0.85 + 0.15 * np.exp(-tt * 6))
    add(np.tanh(s * e * 0.9), t, 0.26 * g, 0.1)


def organ(t, notes, dur=0.16, g=1.0):
    # 那卡西電子琴：拉桿風琴音色短促和弦
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for nt in notes:
        f = midi(nt)
        for h, a in ((1, 1.0), (2, 0.7), (3, 0.45), (4, 0.3), (6, 0.2), (8, 0.12)):
            s += a * np.sin(2 * np.pi * f * h * tt)
    s *= (1 + 0.15 * np.sin(2 * np.pi * 7 * tt)) * np.minimum(tt / 0.004, 1) * np.exp(-tt * 9)
    add(s / len(notes), t, 0.07 * g, -0.35)


def bass(t, note, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = midi(note)
    s = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 6))
    s *= np.minimum(tt / 0.004, 1) * np.exp(-tt * 4) * np.minimum((dur - tt) / 0.02, 1).clip(0)
    add(np.tanh(s * 1.3), t, 0.36 * g)


# ---------- 編曲 ----------
# G - Em - C - D（台語流行歌常見的 I-vi-IV-V）
CHORDS = [(43, [67, 71, 74]), (40, [64, 67, 71]), (36, [64, 67, 72]), (38, [66, 69, 74])]
# 嗩吶主旋律（八分音符；數字為 MIDI 音高，None 延長前一音），G 大調五聲音階
HOOK = [
    74, 76, 79, 76, 74, None, 71, 74,
    76, None, 74, 71, 69, 71, 67, None,
    67, 69, 71, 74, 76, 79, 76, 74,
    76, 74, 71, 69, 74, None, None, None,
]
EIGHTH = BEAT / 2
BAR = 4 * BEAT


def play_hook(start, end, bar0=0):
    steps = int(round((end - start) / EIGHTH))
    k = 0
    while k < steps:
        idx = (bar0 * 8 + k) % len(HOOK)
        nt = HOOK[idx]
        if nt is None:
            k += 1
            continue
        ln = 1
        while k + ln < steps and HOOK[(bar0 * 8 + k + ln) % len(HOOK)] is None:
            ln += 1
        suona(start + k * EIGHTH, nt, ln * EIGHTH * 0.98, bend=(ln > 1 or k % 2 == 0))
        k += ln


def groove(start, end, lead=True):
    bar = 0
    t = start
    while t < end - 1e-6:
        root, chord = CHORDS[bar % 4]
        for b in range(4):
            bt = t + b * BEAT
            if bt >= end - 1e-6:
                break
            kick(bt)
            if b in (1, 3):
                snare(bt)
            hat(bt + EIGHTH, 1.0, open_=True)
            hat(bt, 0.45)
            # 蹦：貝斯根音／五度交替；恰：反拍電子琴和弦
            bass(bt, root + (7 if b % 2 else 0), EIGHTH * 0.9)
            if bt + EIGHTH < end:
                bass(bt + EIGHTH, root + 12, EIGHTH * 0.6, 0.6)
                organ(bt + EIGHTH, chord)
        if lead:
            play_hook(t, min(t + BAR, end), bar % 4)
        bar += 1
        t += BAR


# 開場：riser → 「夯」落下（0.6s）鑼＋鈸 → 嗩吶長音引子
riser(0.0, 0.6, 0.8)
gong(0.6, 1.3)
cymbal(0.6, 1.2)
kick(0.6, 1.2)
suona(0.9, 79, 0.5)
suona(1.4, 76, 0.25)
suona(1.65, 74, 0.25)
suona(1.9, 76, 0.9)
for k in range(4):  # 小鼓滾奏帶進主段
    snare(2.8 - 0.8 + k * 0.2, 0.6 + 0.15 * k)
riser(2.3, 3.0, 0.6)

# 主段 3.0–18.6
cymbal(3.0, 1.0)
groove(3.0, 18.6)
for t in (7.6, 14.1):
    cymbal(t, 0.8)

# 節奏字卡：下班後／來一串／配一杯
for t, ch, nt in ((18.7, [67, 71, 74], 74), (19.7, [64, 67, 72], 76), (20.7, [66, 69, 74], 79)):
    gong(t, 0.8)
    cymbal(t, 0.9)
    kick(t, 1.1)
    organ(t, ch, 0.4, 1.8)
    suona(t, nt, 0.7)
riser(20.95, 21.8, 0.9)

# 高潮 21.8–25.1、結尾 25.1–29.1、收尾
gong(21.8, 1.0)
cymbal(21.8, 1.0)
groove(21.8, 25.1)
cymbal(25.1, 0.9)
groove(25.1, 29.1)
gong(29.1, 1.2)
cymbal(29.1, 1.0)
kick(29.1, 1.2)
organ(29.1, [67, 71, 74, 79], 0.6, 1.8)
suona(29.1, 79, 0.85)

# ---------- 混音 ----------
mix = np.stack([L, R])
mix *= duck ** 0.5
fn = int(0.8 * SR)
mix[:, -fn:] *= np.linspace(1, 0, fn)
mix = np.tanh(mix * 1.25)
mix /= np.max(np.abs(mix)) / 0.89

out = Path(__file__).parent / 'media' / 'bgm.wav'
pcm = (mix.T * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'完成：{out}')
