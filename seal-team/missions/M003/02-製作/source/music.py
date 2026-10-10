# 68 秒佛樂風背景音樂：持續音墊底＋古箏風撥弦（五聲音階）＋引磬鐘聲。純 numpy 合成。
import numpy as np, wave, sys

SR = 44100
DUR = 68.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
out = np.zeros((N, 2))

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    sig = sig[: max(0, N - i)]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + len(sig), 0] += sig * gain * l
    out[i:i + len(sig), 1] += sig * gain * r

def pad(notes, t0, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        f = hz(m)
        for det in (-0.12, 0.0, 0.12):
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(4 * np.pi * ff * t) + 0.08 * np.sin(6 * np.pi * ff * t)
    a = min(2.5, dur / 2)
    env = np.minimum(1, np.minimum(t / a, (dur - t) / a))
    return s * env * 0.035

def pluck(m, dur=3.5):
    # Karplus-Strong，模擬古箏撥弦
    f = hz(m); p = int(SR / f); n = int(dur * SR)
    buf = rng.uniform(-1, 1, p)
    y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]
        buf[i % p] = 0.4985 * (buf[i % p] + buf[(i + 1) % p])
    t = np.arange(n) / SR
    y *= np.exp(-t * 0.9)
    return y * 0.32

def bell(f0=392.0, dur=7.0):
    # 引磬：非諧和泛音＋緩慢衰減
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 0.55), (2.76, 0.5, 0.9), (5.40, 0.25, 1.6), (8.93, 0.12, 2.5), (0.5, 0.3, 0.4)]:
        s += amp * np.sin(2 * np.pi * f0 * ratio * t + rng.uniform(0, 6)) * np.exp(-t * dec)
    s *= 1 + 0.15 * np.sin(2 * np.pi * 3.2 * t)  # 微微顫動
    s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return s * 0.22

# D 五聲：D E F# A B
chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61],
          [50, 57, 62, 66], [47, 54, 59, 66], [43, 50, 59, 62], [45, 52, 57, 64], [50, 57, 62, 69]]
seg = DUR / len(chords)
for k, c in enumerate(chords):
    add(pad(c, 0, seg + 3), max(0, k * seg - 1.5), 0, 1.0)

# 撥弦旋律（每拍 1 秒，五聲音階，稀疏）
scale = [62, 64, 66, 69, 71, 74, 76, 78, 81]
melody = [
    (2, 74), (3, 71), (4, 69), (6, 66), (7.5, 69), (8, 71), (10, 74), (12, 76), (13, 74), (14, 71),
    (16, 69), (17, 66), (18, 64), (20, 62), (22, 66), (23, 69), (24, 71), (26, 74), (27.5, 76), (28, 78),
    (30, 76), (31, 74), (32, 71), (35, 69), (36, 71), (37, 74), (38, 76), (40, 74), (41, 71), (42, 69),
    (44, 66), (45, 69), (46, 71), (48, 74), (49, 76), (50, 78), (51, 81), (52, 78), (54, 76), (55, 74),
    (56, 71), (58, 69), (59, 71), (60, 74), (62, 69), (64, 66), (65, 62),
]
for t0, m in melody:
    add(pluck(m), t0, pan=rng.uniform(-0.4, 0.4), gain=0.9)
    if rng.random() < 0.35:
        add(pluck(m - 12), t0 + 0.02, pan=0, gain=0.5)

# 鐘聲：開場、說法段落、片尾
for t0, f in [(0.2, 392.0), (32.6, 392.0), (62.6, 293.66)]:
    add(bell(f), t0, 0, 1.0)

# 簡易殘響：指數衰減雜訊做脈衝響應（FFT 卷積）
ir_len = int(2.4 * SR)
ti = np.arange(ir_len) / SR
wet = np.zeros_like(out)
for ch in range(2):
    ir = rng.normal(0, 1, ir_len) * np.exp(-ti * 2.6)
    ir[0] = 0
    L = N + ir_len
    nfft = 1 << (L - 1).bit_length()
    w = np.fft.irfft(np.fft.rfft(out[:, ch], nfft) * np.fft.rfft(ir, nfft), nfft)[:N]
    wet[:, ch] = w / np.max(np.abs(ir)) * 0.02
mix = out * 0.8 + wet

t = np.arange(N) / SR
mix *= np.minimum(1, np.minimum(t / 1.5, (DUR - t) / 3.0))[:, None]
mix /= np.max(np.abs(mix)) * 1.12

with wave.open(sys.argv[1] if len(sys.argv) > 1 else "music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
