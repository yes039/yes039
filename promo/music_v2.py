"""合成 30 秒原創背景音樂第二版（無版權疑慮），輸出 media/bgm-v2.wav。

台客搖滾＋那卡西：155 BPM、A 小調（E 大三和弦帶出台語歌的和聲小調味）、破音吉他強力和弦、
那卡西電子琴反拍「蹦恰」、電吉他與嗩吶一問一答的主旋律。和弦 Am–F–G–E；重音對齊 scene.html 的剪輯點。
用法：python3 promo/music_v2.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 155
BEAT = 60 / BPM
EIGHTH = BEAT / 2
BAR = 4 * BEAT
rng = np.random.default_rng(11)

# 分軌：鼓／貝斯直接進主混音；吉他先進吉他匯流排再過音箱濾波
L = np.zeros(N)
R = np.zeros(N)
GL = np.zeros(N)
GR = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0, bus=None):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    l, r = bus if bus else (L, R)
    sig = sig[: N - i] * gain
    l[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    r[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def lowpass(x, k):
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc)
        y[i] = acc
    return y


def highpass(x, k):
    return x - lowpass(x, k)


# ---------- 鼓 ----------
def kick(t, g=1.0):
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    f = 55 + 140 * np.exp(-tt * 45)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 12)
    s += 0.5 * highpass(rng.standard_normal(n), 0.3) * np.exp(-tt * 300)  # 踏板敲擊聲
    add(np.tanh(s * 2.0), t, 0.8 * g)


def snare(t, g=1.0):
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(200 + 40 * np.exp(-tt * 60)) / SR) * np.exp(-tt * 25)
    nz = highpass(rng.standard_normal(n), 0.15) * np.exp(-tt * 14)
    add(np.tanh((0.8 * body + 0.9 * nz) * 1.4), t, 0.36 * g, 0.05)


def tom(t, pitch, g=1.0):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    f = pitch * (1 + 0.4 * np.exp(-tt * 30))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    s += 0.2 * rng.standard_normal(n) * np.exp(-tt * 80)
    add(np.tanh(s * 1.5), t, 0.45 * g, (pitch - 130) / 200)


def hat(t, g=1.0, open_=False):
    n = int((0.2 if open_ else 0.05) * SR)
    tt = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 0.55)
    add(nz * np.exp(-tt * (15 if open_ else 80)), t, 0.12 * g, -0.3)


def crash(t, g=1.0):
    n = int(2.0 * SR)
    tt = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 0.3)
    metal = sum(np.sin(2 * np.pi * f * tt) for f in (3320, 4610, 5870)) * 0.1
    add((nz + metal) * np.exp(-tt * 2.0) * np.minimum(tt / 0.002, 1), t, 0.17 * g, 0.3)


def fill(t0, beats=2, g=1.0):
    # 16 分音符小鼓→落地鼓過門
    steps = beats * 4
    for k in range(steps):
        t = t0 + k * BEAT / 4
        if k < steps // 2:
            snare(t, 0.5 + 0.5 * k / steps)
        else:
            tom(t, [220, 170, 130, 100][(k - steps // 2) * 4 // (steps - steps // 2)], g)


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


# ---------- 貝斯 ----------
def bass(t, note, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = midi(note)
    s = sum(np.sin(2 * np.pi * f * k * tt) / k ** 1.2 for k in range(1, 8))
    s *= np.minimum(tt / 0.003, 1) * np.exp(-tt * 2.5) * np.minimum((dur - tt) / 0.015, 1).clip(0)
    add(np.tanh(s * 1.6), t, 0.3 * g)


# ---------- 電吉他 ----------
def saw(f, tt, maxf=5000):
    ph = 2 * np.pi * np.cumsum(f) / SR if np.ndim(f) else 2 * np.pi * f * tt
    f0 = float(np.mean(f))
    s = np.zeros(len(tt))
    for k in range(1, int(maxf / f0) + 1):
        s += np.sin(ph * k) / k
    return s


def power_chord(t, root, dur, g=1.0, mute=False):
    """強力和弦（根音＋五度＋八度），雙軌左右聲道，破音。"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    for side, det, dly in ((-0.8, -0.06, 0.0), (0.8, 0.06, 0.012)):
        s = np.zeros(n)
        for off in (0, 7, 12):
            s += saw(midi(root + off + det), tt, 2500 if mute else 5000)
        if mute:
            e = np.minimum(tt / 0.002, 1) * np.exp(-tt * 22)
        else:
            e = np.minimum(tt / 0.003, 1) * (0.55 + 0.45 * np.exp(-tt * 4)) * np.minimum((dur - tt) / 0.03, 1).clip(0)
        add(np.tanh(s * e * 4.0), t + dly, 0.16 * g, side, bus=(GL, GR))


def lead(t, note, dur, g=1.0, bend=False):
    """主奏吉他：可推弦（由下方全音推上）、延音抖音、破音。"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f0 = midi(note)
    semis = np.zeros(n)
    if bend:
        semis += -2 * (1 - np.minimum(tt / 0.09, 1)) ** 2
    semis += 0.3 * np.minimum(np.maximum(tt - 0.15, 0) / 0.2, 1) * np.sin(2 * np.pi * 5.5 * tt)
    f = f0 * 2 ** (semis / 12)
    s = saw(f, tt, 6000)
    e = np.minimum(tt / 0.004, 1) * (0.7 + 0.3 * np.exp(-tt * 5)) * np.minimum((dur - tt) / 0.03, 1).clip(0)
    add(np.tanh(s * e * 3.0), t, 0.13 * g, 0.15, bus=(GL, GR))
    add(np.tanh(s * e * 3.0), t + 0.09, 0.035 * g, -0.5, bus=(GL, GR))  # 短延遲空間感


def organ(t, notes, dur=0.14, g=1.0):
    # 那卡西電子琴：拉桿風琴短促和弦
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for nt in notes:
        f = midi(nt)
        for h, a in ((1, 1.0), (2, 0.7), (3, 0.45), (4, 0.3), (6, 0.2), (8, 0.12)):
            s += a * np.sin(2 * np.pi * f * h * tt)
    s *= (1 + 0.15 * np.sin(2 * np.pi * 7 * tt)) * np.minimum(tt / 0.004, 1) * np.exp(-tt * 10)
    add(s / len(notes), t, 0.075 * g, -0.4)


def formant(f):
    return (1.0 * np.exp(-((f - 1300) / 500) ** 2) + 0.7 * np.exp(-((f - 2900) / 700) ** 2)
            + 0.25 * np.exp(-((f - 600) / 300) ** 2) + 0.05)


def suona(t, note, dur, g=1.0, bend=True):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f0 = midi(note)
    slide = -1.2 * np.exp(-tt / 0.035) if bend else 0
    vib = 0.35 * np.minimum(tt / 0.3, 1) * np.sin(2 * np.pi * 6.2 * tt)
    ph = 2 * np.pi * np.cumsum(f0 * 2 ** ((slide + vib) / 12)) / SR
    s = np.zeros(n)
    for k in range(1, 22):
        if f0 * k > 9000:
            break
        s += np.sin(ph * k) / k ** 0.8 * formant(f0 * k)
    e = np.minimum(tt / 0.015, 1) * np.minimum((dur - tt) / 0.04, 1).clip(0) * (0.85 + 0.15 * np.exp(-tt * 6))
    add(np.tanh(s * e * 0.9), t, 0.22 * g, -0.1)


# ---------- 編曲 ----------
# Am–F–G–E（最後 E 大三和弦＝台語歌常見的和聲小調），強力和弦根音與電子琴和弦
ROOTS = [45, 41, 43, 40]
ORGAN = [[69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 68, 71]]
# 主旋律（八分音符；None 延長前一音；負數表示推弦／滑音進入）
# 前兩小節電吉他、後兩小節嗩吶，一問一答
HOOK = [
    76, None, 74, 72, 74, None, -76, None,
    77, None, 76, 74, 72, None, -69, None,
    71, 72, 74, None, -79, None, 77, 76,
    -76, None, None, 74, 71, None, 68, None,
]


def play_hook(start, end, bar0=0):
    steps = int(round((end - start) / EIGHTH))
    k = 0
    while k < steps:
        nt = HOOK[(bar0 * 8 + k) % len(HOOK)]
        if nt is None:
            k += 1
            continue
        ln = 1
        while k + ln < steps and HOOK[(bar0 * 8 + k + ln) % len(HOOK)] is None:
            ln += 1
        voice = suona if ((bar0 * 8 + k) % len(HOOK)) >= 16 else lead
        voice(start + k * EIGHTH, abs(nt), ln * EIGHTH * 0.97, bend=nt < 0)
        k += ln


def groove(start, end, lead_on=True, open_chords=False):
    bar = 0
    t = start
    while t < end - 1e-6:
        root = ROOTS[bar % 4]
        for b in range(4):
            bt = t + b * BEAT
            if bt >= end - 1e-6:
                break
            # 搖滾鼓：1、3 拍大鼓＋2 拍後半拍補一下；2、4 拍小鼓
            if b in (0, 2):
                kick(bt)
            if b == 1:
                kick(bt + EIGHTH, 0.8)
            if b in (1, 3):
                snare(bt)
            hat(bt, 0.9, open_=open_chords and b == 3)
            hat(bt + EIGHTH, 0.6)
            if bt + EIGHTH < end:
                organ(bt + EIGHTH, ORGAN[bar % 4])  # 恰
            for off in (0, EIGHTH):
                if bt + off < end:
                    bass(bt + off, root + (12 if off and b % 2 else 0), EIGHTH * 0.9)
                    if not open_chords:
                        power_chord(bt + off, root, EIGHTH * 0.9, 0.9, mute=True)
        if open_chords:
            # 副歌：每兩拍刷一次全開和弦
            power_chord(t, root, 2 * BEAT, 1.0)
            if t + 2 * BEAT < end:
                power_chord(t + 2 * BEAT, root, min(2 * BEAT, end - t - 2 * BEAT), 0.9)
        if lead_on:
            play_hook(t, min(t + BAR, end), bar % 4)
        bar += 1
        t += BAR


# 開場：riser → 「夯」落下（0.6s）全開 A 和弦長音 → 嗩吶引子 → 過門
riser(0.0, 0.6, 0.8)
kick(0.6, 1.3)
crash(0.6, 1.2)
power_chord(0.6, 45, 1.6, 1.2)
organ(0.6, [69, 72, 76, 81], 0.8, 1.6)
suona(0.9, 81, 0.55)
suona(1.45, 79, 0.2, bend=False)
suona(1.65, 76, 0.2, bend=False)
suona(1.85, 77, 0.2, bend=False)
suona(2.05, 76, 0.35)
fill(3.0 - 2 * BEAT, 2)

# 主段 3.0–18.6：前兩小節悶音無主奏，之後加主奏
crash(3.0, 1.0)
groove(3.0, 3.0 + 2 * BAR, lead_on=False)
groove(3.0 + 2 * BAR, 18.6)
for t in (7.6, 14.1):
    crash(t, 0.7)
fill(18.6 - 2 * BEAT, 2, 0.8)

# 節奏字卡：下班後／來一串／配一杯 —— 全樂團齊奏重音
for t, root, nt in ((18.7, 45, 76), (19.7, 41, 77), (20.7, 40, 80)):
    kick(t, 1.2)
    crash(t, 0.9)
    power_chord(t, root, 0.75, 1.2)
    bass(t, root, 0.7, 1.2)
    organ(t, ORGAN[[45, 41, 43, 40].index(root)], 0.5, 1.8)
    (suona if t > 20 else lead)(t + 0.05, nt, 0.6, bend=True)
riser(21.0, 21.8, 0.7)
fill(21.8 - 2 * BEAT, 2, 1.0)

# 副歌 21.8–29.1（全開和弦）、收尾
crash(21.8, 1.1)
groove(21.8, 25.1, open_chords=True)
crash(25.1, 0.9)
groove(25.1, 29.1, open_chords=True)
kick(29.1, 1.3)
crash(29.1, 1.1)
power_chord(29.1, 45, 0.9, 1.3)
bass(29.1, 45, 0.9, 1.2)
organ(29.1, [69, 72, 76, 81], 0.7, 1.8)
suona(29.1, 81, 0.85)
lead(29.1, 88, 0.85, 0.7, bend=True)

# ---------- 混音 ----------
# 吉他匯流排：音箱模擬（去低頻、兩段低通）
gtr = []
for ch in (GL, GR):
    x = highpass(ch, 0.012)
    x = lowpass(lowpass(x, 0.42), 0.55)
    gtr.append(x)
mix = np.stack([L + gtr[0] * 1.1, R + gtr[1] * 1.1])
fn = int(0.8 * SR)
mix[:, -fn:] *= np.linspace(1, 0, fn)
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) / 0.89

out = Path(__file__).parent / 'media' / 'bgm-v2.wav'
pcm = (mix.T * 32767).astype('<i2')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'完成：{out}')
