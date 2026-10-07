"""A 版混音：配樂＋現場原音（S4、S5 對齊畫面）＋店內環境聲。輸出 final_audio.wav（未做響度標準化）。
用法：python3 mix.py <素材資料夾> <工作資料夾>（工作資料夾內需有 music_raw.wav）
"""
import os, sys, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SRC, WORK = sys.argv[1], sys.argv[2]
SR, T_END = 44100, 34.6
L = int(SR * T_END)

def load_clip_audio(name, start, dur):
    p = os.path.join(WORK, f'aud_{name}_{start}.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', os.path.join(SRC, name + '.mp4'),
                    '-t', str(dur), '-vn', '-ac', '2', '-ar', str(SR), p], check=True)
    sr, a = wavfile.read(p)
    return a.astype(np.float32) / 32768

def place(buf, a, t, gain, fade=0.06):
    a = a.copy() * gain
    f = int(fade * SR)
    ramp = np.linspace(0, 1, f)[:, None]
    a[:f] *= ramp; a[-f:] *= ramp[::-1]
    i = int(t * SR)
    n = min(len(a), L - i)
    buf[i:i + n] += a[:n]

def env(points):
    """分段線性音量包絡：[(秒, 音量), ...]"""
    ts, vs = zip(*points)
    return np.interp(np.arange(L) / SR, ts, vs).astype(np.float32)[:, None]

out = np.zeros((L, 2), np.float32)

# 配樂
sr, m = wavfile.read(os.path.join(WORK, 'music_raw.wav'))
m = m.astype(np.float32) / (32768 if m.dtype == np.int16 else 1)
m = np.pad(m, ((0, max(0, L - len(m))), (0, 0)))[:L]
m *= env([(0, 3.4), (13.3, 3.4), (13.6, 0.7), (20.4, 0.7), (21.2, 2.2), (26.0, 2.6), (33.6, 3.0), (34.6, 0)])
out += m

# 店內環境聲：把幾段現場原音低通、壓小，墊在靜態照片段落下
amb = np.concatenate([load_clip_audio(n, 0, 9) for n in
                      ['813081979.467604', '813081979.528458', '813081980.073952', '813081979.388851',
                       '813070630.558495', '813081979.197960', '813081980.331421']])
amb = sosfilt(butter(4, 1400, 'low', fs=SR, output='sos'), amb, axis=0).astype(np.float32)
amb = np.pad(amb, ((0, max(0, L - len(amb))), (0, 0)))[:L]
amb *= env([(0, 0), (0.8, 0.22), (13.3, 0.26), (13.6, 0), (26.0, 0), (26.6, 0.3), (33.8, 0.24), (34.6, 0)])
out += amb

# 現場原音（跟畫面同步）
place(out, load_clip_audio('813081980.331421', 0.0, 3.6), 13.5, 1.0, fade=0.02)  # 安靜→滋滋聲，硬切
place(out, load_clip_audio('813081979.197960', 0.3, 3.5), 17.1, 0.95)
place(out, load_clip_audio('813070630.558495', 2.0, 3.0), 20.6, 0.6)
place(out, load_clip_audio('813070630.183335', 0.8, 2.5), 23.6, 0.55)

out = np.tanh(out * 1.1) / np.tanh(1.1)  # 軟限幅，避免爆音
wavfile.write(os.path.join(WORK, 'final_audio.wav'), SR, (out * 32767).astype(np.int16))
print('ok', out.shape, float(np.abs(out).max()))
