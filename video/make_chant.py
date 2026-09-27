"""產生誦經配樂 chant.wav：玉皇寶誥，一字一拍，配木魚、磬。

需求: pip install sherpa-onnx numpy
模型: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-hf-fanchen-C.tar.bz2
用法: python3 make_chant.py <模型資料夾>
"""
import os
import sys
import wave

import numpy as np
import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
DUR = 30.0
BEAT = 0.345  # 每字一拍（木魚）
START = 1.0  # 開場磬聲後開始誦
VOICES = [(74, 1.00, 0.000), (119, 1.02, 0.012), (136, 0.98, -0.010)]  # (講者, 音高比例, 時間偏移)
TARGET_F0 = 110.0

# 玉皇寶誥
PHRASES = ["志心皈命禮", "太上彌羅無上天", "妙有玄真境", "渺渺紫金闕", "太微玉清宮", "無極無上聖", "廓落發光明",
           "寂寂浩無宗", "玄範總十方", "湛寂真常道", "恢漠大神通", "玉皇大天尊", "玄穹高上帝"]


def load_tts(d):
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=os.path.join(d, "vits-zh-hf-fanchen-C.onnx"),
                                                       lexicon=os.path.join(d, "lexicon.txt"),
                                                       tokens=os.path.join(d, "tokens.txt")),
            num_threads=4),
        rule_fsts=",".join(os.path.join(d, f) for f in ("phone.fst", "date.fst", "number.fst")))
    return sherpa_onnx.OfflineTts(cfg)


def resample(x, ratio):
    """長度變為 len(x)*ratio（線性內插）。"""
    n = max(2, int(len(x) * ratio))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def median_f0(x, sr):
    fr = int(0.04 * sr)
    ps = []
    for s in range(0, len(x) - fr, fr // 2):
        seg = x[s:s + fr]
        if np.abs(seg).max() < 0.05 * np.abs(x).max():
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, "full")[fr - 1:]
        lo, hi = int(sr / 300), int(sr / 70)
        ps.append(sr / (lo + np.argmax(ac[lo:hi])))
    return float(np.median(ps)) if ps else TARGET_F0


def trim(x, thr=0.03):
    idx = np.where(np.abs(x) > thr * np.abs(x).max())[0]
    return x[idx[0]:idx[-1] + 1] if len(idx) else x


def syllable(tts, ch, sid, pitch, hold):
    a = tts.generate(ch, sid=sid, speed=1.25)
    x = trim(np.array(a.samples, np.float32))
    x = resample(x, SR / a.sample_rate)  # 升到 44.1k
    f0 = median_f0(x, SR)
    x = resample(x, f0 / (TARGET_F0 * pitch))  # 拉平音高成單音誦唸
    maxlen = int(BEAT * (1.9 if hold else 0.92) * SR)
    x = x[:maxlen]
    env = np.ones(len(x))
    fo = min(len(x), int(0.06 * SR))
    env[-fo:] = np.linspace(1, 0, fo)
    return x / (np.abs(x).max() + 1e-6) * env


def woodfish(n):
    t = np.arange(int(0.25 * SR)) / SR
    hit = (np.sin(2 * np.pi * 720 * t) * 0.8 + np.sin(2 * np.pi * 1180 * t) * 0.3) * np.exp(-t * 38)
    hit += np.random.default_rng(1).normal(0, 1, len(t)) * np.exp(-t * 300) * 0.3
    return hit[:n]


def bell(n):
    t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * 523.25 * r * t) * g * np.exp(-t * d)
               for r, g, d in ((1, .5, 1.0), (2.76, .25, 2.2), (5.4, .12, 3.5), (0.5, .3, 0.7)))


def reverb(x):
    rng = np.random.default_rng(7)
    n = int(1.6 * SR)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 4.0)
    ir[0] = 0
    wet = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[:len(x)]
    return x + wet / np.abs(wet).max() * np.abs(x).max() * 0.35


def main():
    tts = load_tts(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "vits-zh-hf-fanchen-C"))
    total = int(SR * DUR)
    voice = np.zeros(total)
    perc = np.zeros(total)
    beat = 0
    for p in PHRASES:
        for k, ch in enumerate(p):
            t0 = START + beat * BEAT
            for sid, pitch, off in VOICES:
                s = syllable(tts, ch, sid, pitch, hold=(k == len(p) - 1))
                st = int((t0 + 0.02 + off) * SR)
                n = min(len(s), total - st)
                voice[st:st + n] += s[:n] * 0.4
            beat += 1
        beat += 1  # 句尾空一拍
    end_beat = beat
    # 木魚：從開始到誦畢，每拍一下
    wf = woodfish(int(0.25 * SR))
    for b in range(end_beat):
        st = int((START + b * BEAT) * SR)
        n = min(len(wf), total - st)
        perc[st:st + n] += wf[:n] * (0.55 if b % 4 == 0 else 0.4)
    # 磬：開頭、首句後、「玉皇大天尊」、結尾
    idx_yh = sum(len(p) + 1 for p in PHRASES[:PHRASES.index("玉皇大天尊")])
    for bt in (0.0, START + 6 * BEAT, START + idx_yh * BEAT, START + end_beat * BEAT):
        st = int(bt * SR)
        perc[st:] += bell(total - st) * 0.5
    # 低沉持續音
    t = np.arange(total) / SR
    drone = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 110 * t) * 0.25) * 0.06
    mix = reverb(voice / np.abs(voice).max() * 0.8) + perc * 0.6 + drone
    fade = np.minimum(1, np.minimum(t / 0.5, (DUR - t) / 1.5))
    mix = mix * fade
    mix = mix / np.abs(mix).max() * 0.9
    with wave.open(os.path.join(HERE, "audio", "chant.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("誦畢於", round(START + end_beat * BEAT, 2), "秒")


if __name__ == "__main__":
    main()
