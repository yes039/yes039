# 配樂＋音效混音 → final_audio.wav（30 s）
import numpy as np, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100; N = SR * 30
src = sys.argv[1] if len(sys.argv) > 1 else 'music_raw.wav'
sr, a = wavfile.read(src); a = a.astype(np.float32)
if a.ndim == 2: a = a.mean(1)
a /= np.abs(a).max()
mus = np.pad(a[:N], (0, max(0, N - len(a))))
env = np.ones(N); fo = int(28.6 * SR); env[fo:] = np.linspace(1, 0, N - fo) ** 1.5
mus *= env * 0.62

sfx = np.zeros(N, np.float32); rng = np.random.default_rng(7)
def put(at, sig, g=1.0):
    st = int(at * SR); sig = sig[:N - st]; sfx[st:st + len(sig)] += sig * g
def tone(f, d, dec=8):
    tt = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * f * tt) * np.exp(-dec * tt)
def noise(d, lo, hi, dec=30):
    n = rng.standard_normal(int(d * SR)); n = sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), n)
    return n * np.exp(-dec * np.arange(len(n)) / SR)
def whoosh(d=.45):
    n = rng.standard_normal(int(d * SR)); u = np.linspace(0, 1, len(n))
    return sosfilt(butter(2, [300, 3500], 'band', fs=SR, output='sos'), n) * np.sin(np.pi * u) ** 2 * .3
def M(*xs):
    L = max(len(x) for x in xs); return sum(np.pad(x, (0, L - len(x))) for x in xs)
ding = lambda: M(tone(1318, .6, 6) * .5, tone(1760, .6, 7) * .35)
pop = lambda f=880: M(tone(f, .18, 22) * .6, noise(.03, 1500, 5000, 120) * .25)

put(4.78, M(noise(.05, 1000, 8000, 80) * .9, np.pad(noise(.07, 700, 6000, 60) * .6, (int(.08 * SR), 0))), 1)  # 快門
put(6.0, whoosh(.35), .6)
put(6.3, M(tone(1046, .12, 25), tone(1568, .12, 25) * .5), .35)            # 開始錄音
put(7.85, M(tone(1568, .12, 25), tone(1046, .12, 25) * .5), .3)            # 錄音結束
for k in range(20): put(8.55 + k * .105 + (k % 3) * .012, noise(.025, 1800, 6000, 140), .16)  # 打字
put(10.8, ding(), .45)
for i in range(3): put(12.3 + i * .6, pop(784 + i * 196), .5)
put(14.55, whoosh(.4), .5)
put(16.95, ding(), .4)                                                      # 訊息傳出
put(19.22, M(*[tone(f, 1.2, 3.5) * .18 for f in [1568, 2093, 2637, 3136]]), .7)  # 高點閃光
put(22.7, whoosh(.4), .5)
put(24.95, whoosh(.5), .6)
put(26.2, M(tone(1175, .3, 10) * .5, tone(1760, .3, 12) * .3), .45)        # 費用徽章

mix = mus + sfx
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.abs(mix).max() * 0.9
wavfile.write('final_audio.wav', SR, (mix * 32767).astype(np.int16))
print('final_audio.wav ok')
