#!/usr/bin/env python3
"""SEAL-01 語音辨識：影片／音訊 → 繁體中文 SRT（逐字時間 → 自動斷句）。

用法：python3 transcribe.py 輸入檔 輸出.srt [--model 模型資料夾] [--max 14]
- 在本機執行 faster-whisper，影片不會上傳到外部服務。
- 輸出經 OpenCC s2twp 轉為台灣繁體用語。
- 辨識結果一定要人工校對；校對後的 SRT 由 render.py 以 "srt" 欄位匯入。
"""
import argparse, re, subprocess
import numpy as np
from faster_whisper import WhisperModel
from opencc import OpenCC

PUNCT = "，。！？、；：,.!?;:"


def fmt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def lines_from_words(words, max_chars):
    """依標點、停頓與字數切成字幕行；行尾標點去掉（短影音字幕慣例）。"""
    out, cur, start, last_end = [], "", None, None
    for w in words:
        text = w["text"].strip()
        if not text:
            continue
        gap = (w["start"] - last_end) if last_end is not None else 0
        if cur and (gap > 0.45 or len(cur) + len(text) > max_chars):
            out.append((start, last_end, cur))
            cur, start = "", None
        if start is None:
            start = w["start"]
        cur += text
        last_end = w["end"]
        if cur and cur[-1] in PUNCT and len(cur) >= 4:
            out.append((start, last_end, cur))
            cur, start = "", None
    if cur:
        out.append((start, last_end, cur))
    return [(a, b, re.sub(f"[{PUNCT}]+$", "", t)) for a, b, t in out if t.strip(PUNCT)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--model", default="models/faster-whisper-medium")
    ap.add_argument("--max", type=int, default=14, help="每行最多字數")
    a = ap.parse_args()
    cc = OpenCC("s2twp")
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    # 以 ffmpeg 解碼成 16 kHz 單聲道，避開 PyAV 版本相依問題
    pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-i", a.src, "-vn", "-ac", "1", "-ar", "16000",
                                   "-f", "s16le", "-"])
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    segs, info = model.transcribe(audio, language="zh", word_timestamps=True, vad_filter=True,
                                  initial_prompt="以下是繁體中文的句子，有標點符號。")
    words = []
    for s in segs:
        for w in s.words or []:
            words.append({"start": w.start, "end": w.end, "text": cc.convert(w.word)})
    rows = lines_from_words(words, a.max)
    with open(a.out, "w", encoding="utf-8") as f:
        for i, (s, e, t) in enumerate(rows, 1):
            f.write(f"{i}\n{fmt(s)} --> {fmt(e)}\n{t}\n\n")
    for s, e, t in rows:
        print(f"{s:6.2f}-{e:6.2f}  {t}")


if __name__ == "__main__":
    main()
