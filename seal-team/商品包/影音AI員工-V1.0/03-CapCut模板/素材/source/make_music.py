"""產生兩首 30 秒原創配樂（純 numpy 合成，無取樣、無外部音色庫）。
用法：python3 make_music.py <輸出資料夾>
輸出：A-溫暖-30s.wav、B-輕快-30s.wav（再由 ffmpeg 轉 m4a、統一響度）
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a=0.005, d=0.6):
    t = np.arange(n) / SR
    e = np.minimum(t / a, 1.0) * np.exp(-t / d)
    return e


def piano(m, length, vel=0.3, decay=0.9):
    n = int(SR * length)
    t = np.arange(n) / SR
    f = midi_hz(m)
    tone = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.6 for k in range(1, 6))
    return vel * tone * env(n, 0.004, decay)


def pluck(m, length, vel=0.3):
    n = int(SR * length)
    t = np.arange(n) / SR
    f = midi_hz(m)
    tone = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t)
    return vel * tone * env(n, 0.002, 0.18)


def pad(ms, length, vel=0.08):
    n = int(SR * length)
    t = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * midi_hz(m) * t) + 0.5 * np.sin(2 * np.pi * midi_hz(m) * 1.003 * t) for m in ms)
    e = np.minimum(t / 0.4, 1.0) * np.minimum((length - t) / 0.4, 1.0)
    return vel * tone * np.clip(e, 0, 1)


def bass(m, length, vel=0.35):
    n = int(SR * length)
    t = np.arange(n) / SR
    f = midi_hz(m)
    return vel * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(n, 0.005, 0.35)


rng = np.random.default_rng(7)


def noise_hit(length, vel, decay):
    n = int(SR * length)
    return vel * rng.uniform(-1, 1, n) * env(n, 0.001, decay)


def kick(vel=0.6):
    n = int(SR * 0.3)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 18) + 45
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.12)


def add(buf, x, start):
    i = int(start * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def finish(buf):
    fade = int(SR * 2.0)
    buf[-fade:] *= np.linspace(1, 0, fade)
    buf[: int(SR * 0.02)] *= np.linspace(0, 1, int(SR * 0.02))
    peak = np.max(np.abs(buf)) or 1
    return buf / peak * 0.85


def track_a():
    """溫暖：90 BPM，C 大調 I–V–vi–IV，鋼琴分解和弦＋暖墊，第 3 小節後加沙鈴。"""
    buf = np.zeros(N)
    beat = 60 / 90
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    roots = [48, 43, 45, 41]
    t, bar = 0.0, 0
    while t < DUR:
        ch, r = chords[bar % 4], roots[bar % 4]
        add(buf, pad([n + 12 for n in ch], beat * 4), t)
        add(buf, bass(r, beat * 2, 0.25), t)
        add(buf, bass(r, beat * 2, 0.2), t + beat * 2)
        pattern = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]]
        for k, m in enumerate(pattern):
            add(buf, piano(m + 12, beat * 1.5, 0.22 if k % 2 else 0.28), t + k * beat / 2)
        if bar >= 2:
            for k in range(8):
                add(buf, noise_hit(0.08, 0.05 if k % 2 else 0.03, 0.03), t + k * beat / 2)
        t += beat * 4
        bar += 1
    return finish(buf)


def track_b():
    """輕快：120 BPM，G 大調 I–vi–IV–V，撥弦＋貝斯＋大鼓拍手。"""
    buf = np.zeros(N)
    beat = 0.5
    chords = [[67, 71, 74], [64, 67, 71], [60, 64, 67], [62, 66, 69]]
    roots = [43, 40, 36, 38]
    t, bar = 0.0, 0
    while t < DUR:
        ch, r = chords[bar % 4], roots[bar % 4]
        for k in range(4):
            add(buf, kick(0.5), t + k * beat)
            if k in (1, 3):
                add(buf, noise_hit(0.15, 0.25, 0.05), t + k * beat)
            add(buf, bass(r, beat * 0.9, 0.3), t + k * beat)
        for k in range(8):
            m = ch[k % 3] + (12 if k in (3, 7) else 0)
            add(buf, pluck(m, beat * 0.6, 0.16), t + k * beat / 2)
        add(buf, pad(ch, beat * 4, 0.04), t)
        t += beat * 4
        bar += 1
    return finish(buf)


def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    stereo = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    write(f"{out}/A-溫暖-30s.wav", track_a())
    write(f"{out}/B-輕快-30s.wav", track_b())
