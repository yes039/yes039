# 錄音去雜音：保留音樂，壓低底噪嘶聲、低頻轟聲，修補碰撞／爆音等突發雜音。
# 用法：python3 denoise.py 輸入.wav(48k 單聲道) 輸出.wav
import sys, subprocess, wave, numpy as np

SR, NFFT, HOP = 48000, 2048, 512
src, dst = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", src, "-af", "highpass=f=70:poles=2,highpass=f=70:poles=2",
                      "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)

win = np.hanning(NFFT + 1)[:-1]
pad = np.concatenate([np.zeros(NFFT), x, np.zeros(NFFT)])
nfr = (len(pad) - NFFT) // HOP + 1
idx = np.arange(NFFT)[None, :] + HOP * np.arange(nfr)[:, None]
X = np.fft.rfft(pad[idx] * win, axis=1)
mag, ph = np.abs(X), np.angle(X)
freqs = np.fft.rfftfreq(NFFT, 1 / SR)

def tmedian(m, k):
    """沿時間軸的移動中位數"""
    h = k // 2
    p = np.pad(m, ((h, h), (0, 0)), mode="edge")
    return np.median(np.lib.stride_tricks.sliding_window_view(p, k, axis=0), axis=-1)

# 1) 突發雜音修補（碰撞、爆音、手機摩擦）：
#    某一幀的中高頻能量比前後 1 秒的中位數高出 6 dB 以上 → 該幀中高頻改用前後 0.6 秒的中位頻譜
hf = freqs > 800
e = (mag[:, hf] ** 2).sum(1)
pe = np.pad(e, 50, mode="edge")
em = np.median(np.lib.stride_tricks.sliding_window_view(pe, 101), axis=-1)
bad = e > em * 4.0
bad = np.convolve(bad, np.ones(5), "same") > 0          # 前後各延伸 2 幀
med = tmedian(mag, 61)
fix = np.ix_(bad, hf)
mag[fix] = np.minimum(mag[fix], med[fix])
# 單一頻率的尖刺（極短的嘀聲）壓回局部中位數的 4 倍以內
lim = tmedian(mag, 21) * 4.0
spike = (mag > lim) & hf[None, :]
mag = np.where(spike, lim, mag)

# iSTFT（重疊相加）
Y = np.fft.irfft(mag * np.exp(1j * ph), n=NFFT, axis=1) * win
y = np.zeros(len(pad)); wsum = np.zeros(len(pad))
for i in range(nfr):
    y[i * HOP:i * HOP + NFFT] += Y[i]; wsum[i * HOP:i * HOP + NFFT] += win ** 2
y = (y / np.maximum(wsum, 1e-8))[NFFT:NFFT + len(x)]
y /= np.max(np.abs(y)) * 1.12
with wave.open(dst, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype("<i2").tobytes())
print(f"修補突發雜音幀數: {int(bad.sum())} / {nfr}, 尖刺格數比例: {spike.mean():.3%}")
np.save(dst + ".bad.npy", np.nonzero(bad)[0] * HOP / SR)
