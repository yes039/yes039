#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小分・數字人腳本檢查＋字幕分行（送去生成之前一定先跑）。

用法：
    python script_check.py 腳本.txt                 # 只檢查
    python script_check.py 腳本.txt --subs 字幕稿.txt   # 檢查＋產生字幕分行檔
    python script_check.py 腳本.txt --target 60      # 目標秒數（預設 40）

檢查四件事：
  1. 字數與預估秒數（中文約每秒 4 字；40 秒 ≈ 145～180 字）
  2. 違規用詞（收入保證、療效、絕對用語）
  3. 數字人容易念錯的字（「拚」會念成 pàn、阿拉伯數字與英文字母念法不穩）
  4. 太長沒有逗號的句子（AI 會一口氣念完，聽起來很急）

字幕分行規則：一行 5～12 字，照標點切，太長再對半切；標點不進字幕。
"""
import argparse
import re
import sys

CHARS_PER_SEC = 4.0

BANNED = {
    "保證": "收入或效果保證（公平交易法）",
    "穩賺": "收入保證",
    "月入": "收入暗示，改講具體做法",
    "被動收入": "收入暗示",
    "躺著賺": "收入暗示",
    "一定賺": "收入保證",
    "治好": "療效宣稱（醫療法／食安法）",
    "治療": "療效宣稱",
    "根治": "療效宣稱",
    "療效": "療效宣稱",
    "痊癒": "療效宣稱",
    "第一名": "絕對用語，要有出處",
    "最便宜": "絕對用語",
    "全台唯一": "絕對用語",
    "唯一": "絕對用語，確認有根據",
    "100%": "絕對用語",
    "百分之百": "絕對用語",
    "分潤": "你的公司禁用字",
    "下線": "你的公司禁用字",
}

RISKY_CHARS = {
    "拚": "數字人會念成 pàn，一律改「拼」",
}

PUNCT = "，。！？；：、,.!?;:「」『』（）()…—～~\"' \t"


def han_count(text):
    return len(re.findall(r"[一-鿿]", text))


def split_subs(text, max_len=12, min_len=5):
    parts = [p for p in re.split(r"[，。！？；：,.!?;:\n…—～~]+", text) if p.strip()]
    lines = []
    for p in parts:
        p = re.sub(r"[「」『』（）()\"'\s、]", "", p)
        while len(p) > max_len:
            cut = len(p) // 2 if len(p) <= max_len * 2 else max_len
            lines.append(p[:cut])
            p = p[cut:]
        if p:
            lines.append(p)
    merged = []
    for ln in lines:
        if merged and len(ln) < min_len and len(merged[-1]) + len(ln) <= max_len:
            merged[-1] += ln
        else:
            merged.append(ln)
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--subs", help="字幕分行輸出檔")
    ap.add_argument("--target", type=float, default=40.0, help="目標秒數")
    a = ap.parse_args()

    text = open(a.script, encoding="utf-8").read()
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith("#"))
    n = han_count(body)
    sec = n / CHARS_PER_SEC
    lo, hi = a.target * 3.6, a.target * 4.5
    problems = 0

    print(f"📏 中文字數 {n} 字，預估約 {sec:.0f} 秒（目標 {a.target:.0f} 秒 ≈ {lo:.0f}～{hi:.0f} 字）")
    if n < lo:
        print("   ⚠️ 太短，會講不完整，補一句痛點或解法")
    elif n > hi:
        print("   ⚠️ 太長，觀眾滑走的機率變高，砍到範圍內")

    for w, why in BANNED.items():
        if w in body:
            problems += 1
            print(f"🚫 違規用詞「{w}」：{why}")
    if re.search(r"第\s*[1一]\s*名", body) and "第一名" not in body:
        problems += 1
        print("🚫 違規用詞「第1名」：絕對用語，要有出處")
    for c, why in RISKY_CHARS.items():
        if c in body:
            problems += 1
            print(f"🗣 易念錯字「{c}」：{why}")
    if re.search(r"[0-9]", body):
        print("🔢 有阿拉伯數字：數字人念法不穩，建議改成口語（例：「三千兩百」「百分之二十」）")
    if re.search(r"[A-Za-z]", body):
        print("🔤 有英文字母：確認念法，品牌名可以留，其他改中文")

    for seg in re.split(r"[，。！？；：、,.!?;:\n]+", body):
        if han_count(seg) > 18:
            print(f"💨 太長沒斷句（{han_count(seg)} 字）：「{seg.strip()[:20]}…」每 12～18 字給一個逗號")

    if a.subs:
        lines = split_subs(body)
        with open(a.subs, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"📝 字幕分行 {len(lines)} 行 → {a.subs}")

    if problems:
        print(f"\n❌ 有 {problems} 個要改的地方，改完再送去生成")
        sys.exit(1)
    print("\n✅ 檢查通過")


if __name__ == "__main__":
    main()
