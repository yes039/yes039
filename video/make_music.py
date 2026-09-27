"""莊嚴背景音樂 audio/music.wav：低沉梵鐘、持續和聲、古琴式撥弦、引磬。

用法: python3 make_music.py  (鐘聲時間點取自 make_video.SCENES)
"""
import os
import wave

import numpy as np

from make_video import DUR, SCENES, STARTS

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
T = np.arange(int(SR * DUR)) / SR
RNG = np.random.default_rng(3)


def pad_note(f, t):
    """風琴式持續音：多個泛音、微走音合唱。"""
    out = np.zeros_like(t)
    for det in (-0.12, 0, 0.12):
        for h in range(1, 7):
            out += np.sin(2 * np.pi * (f + det) * h * t + RNG.uniform(0, 6.28)) / h ** 1.6
    return out


def bronze_bell(f0, n, strength=1.0):
    """梵鐘：非諧和泛音，長殘響，含拍頻。"""
    t = np.arange(n) / SR
    partials = ((0.5, .55, 0.25), (1.0, 1.0, 0.45), (1.19, .45, 0.6), (1.56, .35, 0.8), (2.0, .4, 0.9),
                (2.51, .25, 1.3), (3.2, .15, 1.8), (4.1, .08, 2.5))
    out = np.zeros(n)
    for r, g, d in partials:
        f = f0 * r
        out += g * np.exp(-t * d) * (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * (f + 0.7) * t))
    attack = RNG.normal(0, 1, n) * np.exp(-t * 60) * 0.3
    return (out + attack) * np.minimum(1, t / 0.004) * strength


def qing(n):
    """引磬：清亮高音。"""
    t = np.arange(n) / SR
    return sum(g * np.exp(-t * d) * np.sin(2 * np.pi * 1318.5 * r * t)
               for r, g, d in ((1, .6, 1.5), (2.71, .25, 3), (5.1, .1, 5))) * np.minimum(1, t / 0.002)


def pluck(f, n):
    """古琴式撥弦：泛音越高衰減越快，聲音溫潤。"""
    t = np.arange(n) / SR
    out = sum(np.sin(2 * np.pi * f * h * t * (1 + 0.0004 * h * h)) / h ** 1.2 * np.exp(-t * (0.8 + 0.9 * h * h / 4))
              for h in range(1, 9))
    out = out * np.minimum(1, t / 0.003) * np.clip((t[-1] - t) / 0.3, 0, 1)
    return out


def reverb(x, secs=3.0, decay=2.2, wet=0.45):
    n = int(secs * SR)
    ir = RNG.normal(0, 1, n) * np.exp(-np.arange(n) / SR * decay)
    ir[:int(0.02 * SR)] = 0
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L))[:len(x)]
    return x * (1 - wet) + y / (np.abs(y).max() + 1e-9) * np.abs(x).max() * wet


def main():
    n = len(T)
    # 1) 持續和聲：D → G → A → D（五度、八度，不用三度，較莊重）
    chords = [(0, (73.42, 110.0, 146.83)), (10, (98.0, 146.83, 196.0)), (18, (110.0, 164.81, 220.0)),
              (24, (73.42, 110.0, 146.83))]
    pad = np.zeros(n)
    for k, (st, notes) in enumerate(chords):
        en = chords[k + 1][0] if k + 1 < len(chords) else DUR
        env = np.clip(np.minimum((T - st + 1.5) / 3.0, (en + 1.5 - T) / 3.0), 0, 1)
        pad += sum(pad_note(f, T) for f in notes) * env
    pad *= 0.75 + 0.25 * np.sin(2 * np.pi * T / 9.0)
    pad = pad / np.abs(pad).max() * 0.35

    # 2) 梵鐘：開場、主神、法會影片、焚化金紙、結尾；其餘換幕敲引磬
    big = {0, 1, 4, 7, len(SCENES) - 1}
    perc = np.zeros(n)
    for i, st in enumerate(STARTS):
        s = int(st * SR)
        if i in big:
            perc[s:] += bronze_bell(73.42, n - s, 1.0 if i in (0, len(SCENES) - 1) else 0.8)
        else:
            perc[s:] += qing(n - s) * 0.35
    perc = perc / np.abs(perc).max() * 0.8

    # 3) 古琴式五聲旋律（D 宮調：D E F# A B），緩慢稀疏
    melody = [(1.5, 293.66), (3.0, 220.0), (4.5, 246.94), (6.5, 293.66), (9.0, 329.63), (10.5, 293.66),
              (12.0, 246.94), (14.5, 220.0), (16.0, 196.0), (18.5, 220.0), (20.0, 246.94), (21.5, 293.66),
              (24.0, 329.63), (25.5, 369.99), (27.0, 293.66)]
    qin = np.zeros(n)
    for st, f in melody:
        s = int(st * SR)
        m = min(int(3.5 * SR), n - s)
        qin[s:s + m] += pluck(f, m)
    qin = qin / np.abs(qin).max() * 0.4

    mix = reverb(pad + perc * 0.9 + qin)
    fade = np.minimum(1, np.minimum(T / 1.0, (DUR - T) / 2.5))
    mix = mix * fade
    mix = mix / np.abs(mix).max() * 0.9
    with wave.open(os.path.join(HERE, "audio", "music.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("done")


if __name__ == "__main__":
    main()
