"""誦經錄音去雜音：去除碰撞/爆音、降低底噪嘶聲、濾除低頻隆隆聲與高頻。

用法: python3 clean_audio.py  (讀 audio/chant_original.m4a，輸出 audio/chant_clean.wav)
"""
import os
import subprocess
import wave

import imageio_ffmpeg
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
N, HOP = 2048, 512


def load(path):
    raw = subprocess.run([FFMPEG, "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def stft(x):
    win = np.hanning(N)
    x = np.pad(x, (N, N))
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * win
    return np.fft.rfft(frames, axis=1)


def istft(X, length):
    win = np.hanning(N)
    frames = np.fft.irfft(X, n=N, axis=1) * win
    out = np.zeros(HOP * (len(frames) - 1) + N)
    norm = np.zeros_like(out)
    for i, f in enumerate(frames):
        out[i * HOP:i * HOP + N] += f
        norm[i * HOP:i * HOP + N] += win ** 2
    out /= np.maximum(norm, 1e-8)
    return out[N:N + length]


def rolling_median(M, half):
    """沿時間軸取每個頻率的滑動中位數。"""
    pad = np.pad(M, ((half, half), (0, 0)), mode="edge")
    win = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1, axis=0)
    return np.median(win, axis=-1)


def main():
    x = load(os.path.join(HERE, "audio", "chant_original.m4a"))
    X = stft(x)
    mag, ph = np.abs(X), np.angle(X)
    freqs = np.fft.rfftfreq(N, 1 / SR)

    # 1) 爆音/碰撞：高頻 (>3kHz) 能量遠高於前後 0.5 秒中位數的格子 → 各頻率壓回局部中位數
    half = int(0.5 * SR / HOP)
    med = rolling_median(mag, half)
    hf = freqs > 3000
    ratio = mag[:, hf].sum(1) / (med[:, hf].sum(1) + 1e-9)
    bad = ratio > 3.0
    bad = np.convolve(bad, np.ones(7), "same") > 0  # 前後各多 3 格
    print("修掉爆音格數:", int(bad.sum()), "約", round(bad.sum() * HOP / SR, 2), "秒")
    mag = np.where(bad[:, None], np.minimum(mag, med * 1.2), mag)

    # 2) 底噪：每個頻率取 10% 分位數當噪音，頻譜減法 + 保留一點底，避免水聲
    noise = np.percentile(mag, 10, axis=0)
    gain = np.maximum(1 - 1.6 * noise / (mag + 1e-9), 0.12)
    gain = rolling_median(gain, 2)  # 平滑，減少「音樂噪音」
    mag = mag * gain

    # 3) 帶通：去除 < 80Hz 隆隆聲、> 7kHz 嘶聲
    band = np.clip((freqs - 60) / 40, 0, 1) * np.clip((8000 - freqs) / 1500, 0, 1)
    mag = mag * band

    y = istft(mag * np.exp(1j * ph), len(x))
    # 4) 音量：RMS 對齊 -18 dBFS，峰值限制
    y = y / (np.sqrt((y ** 2).mean()) + 1e-9) * 10 ** (-18 / 20)
    peak = np.abs(y).max()
    if peak > 0.95:
        y = np.tanh(y / 0.95) * 0.95
    with wave.open(os.path.join(HERE, "audio", "chant_clean.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    print("done, 長度", round(len(y) / SR, 2), "秒")


if __name__ == "__main__":
    main()
