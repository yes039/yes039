#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小文 · 文案合規與可讀性稽核
用法：
    python3 copycheck.py 文案.md
    cat 文案.md | python3 copycheck.py
    python3 copycheck.py 文案.md --industry 醫療
離開碼：0 = 全綠 / 1 = 有 🔴 紅燈
"""
import sys
import re
import unicodedata

RED = {
    "絕對化用語（公平交易法§21 廣告不實）": [
        "最好", "最佳", "最便宜", "最有效", "最強", "第一品牌", "業界第一", "全台第一",
        "唯一", "頂級", "極致", "完美", "百分百", "100%有效", "絕對", "永久有效",
        "終身有效", "全台最大", "世界級", "無人能及", "史上最",
    ],
    "療效／醫療宣稱（食安法§28、化粧品法§10、藥事法§66-69）": [
        "療效", "治療", "根治", "痊癒", "醫療級", "醫美級", "消炎", "殺菌", "抗癌",
        "降血糖", "降血壓", "降膽固醇", "增強免疫", "提升免疫力", "排毒", "解毒",
        "修復細胞", "活化細胞", "改善過敏", "治百病", "藥效", "抗發炎", "殺死病毒",
    ],
    "收益／投資保證（銀行法§29-1、投信投顧法）": [
        "保證獲利", "保證賺", "穩賺不賠", "穩賺", "保本保息", "保證報酬", "保證收益",
        "躺著賺", "被動收入保證", "無風險", "零風險", "月入百萬保證", "包賺",
        "保證返還", "保證增值", "保證回本",
    ],
    "傳銷用語（多層次傳銷管理法）": [
        "下線", "分潤", "組織獎金", "團隊分紅", "拉人頭",
    ],
    "保證類承諾（做不到即廣告不實）": [
        "保證有效", "保證錄取", "保證成交", "保證瘦", "保證合法", "保證不會被拆",
        "永不漏水", "保證入住", "保證有床",
    ],
}

YELLOW = {
    "需附可查證來源": ["研究顯示", "數據顯示", "調查指出", "根據統計", "專家推薦", "醫師推薦"],
    "需確認是真實且做得到": ["限時", "限量", "最後", "倒數", "名額僅剩", "免費", "退費", "無條件退款", "終身"],
    "Meta 政策：不得暗示個人狀態": ["你是不是也很胖", "你是不是也有", "你的病", "你的疾病", "肥胖問題", "禿頭問題"],
    "空洞形容詞（換成具體事實）": ["優質", "頂尖", "卓越", "用心經營", "專業團隊", "領航", "共創未來", "值得信賴", "品質保證"],
}

CTA_HINT = ["立即", "馬上", "現在", "點擊", "點我", "加入", "加 LINE", "加line", "預約",
            "報名", "領取", "填表", "私訊", "來電", "洽詢", "查看", "下載", "訂閱", "購買"]

DISCLAIMER_HINT = ["不構成投資建議", "個人成果", "因人而異", "非醫療", "不具療效",
                   "諮詢專業", "民俗調理", "本內容為教育"]

INDUSTRY_REQUIRED = {
    "不動產": ["經紀業", "經紀人", "坪", "屋齡"],
    "醫療": ["院所名稱", "醫師"],
    "食品": ["成分", "有效日期", "廠商"],
    "化粧品": ["全成分", "注意事項"],
    "醫療器材": ["許可證", "處方"],
    "課程": ["退費"],
    "旅遊": ["註冊編號", "取消"],
    "保險": ["免責"],
}


def width(s: str) -> int:
    """全形字寬計數"""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def full_width_len(s: str) -> int:
    return round(width(s) / 2)


def scan(text: str, table: dict):
    hits = []
    for cat, words in table.items():
        for w in words:
            if w in text:
                idx = text.find(w)
                line_no = text.count("\n", 0, idx) + 1
                snippet = text.splitlines()[line_no - 1].strip()[:50]
                hits.append((cat, w, line_no, snippet))
    return hits


def main():
    args = [a for a in sys.argv[1:]]
    industry = None
    if "--industry" in args:
        i = args.index("--industry")
        industry = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]

    if args:
        with open(args[0], encoding="utf-8") as f:
            text = f.read()
        src = args[0]
    else:
        text = sys.stdin.read()
        src = "(stdin)"

    print("=" * 60)
    print("✍️  小文 · 文案稽核報告")
    print(f"   來源：{src}")
    print("=" * 60)

    red_hits = scan(text, RED)
    yellow_hits = scan(text, YELLOW)

    # --- 紅燈 ---
    print("\n【🔴 紅燈 — 必須改掉才能交件】")
    if not red_hits:
        print("  ✅ 沒有踩到硬性紅線")
    else:
        for cat, w, ln, snip in red_hits:
            print(f"  🔴 L{ln}｜{cat}")
            print(f"      禁詞「{w}」 → {snip}")

    # --- 黃燈 ---
    print("\n【🟡 黃燈 — 需人工確認有無事實依據】")
    if not yellow_hits:
        print("  ✅ 無")
    else:
        for cat, w, ln, snip in yellow_hits:
            print(f"  🟡 L{ln}｜{cat}｜「{w}」 → {snip}")

    # --- 可讀性 ---
    print("\n【📏 可讀性】")
    total = full_width_len(text)
    print(f"  全文長度：約 {total} 全形字")

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    long_lines = [(i + 1, l) for i, l in enumerate(text.splitlines())
                  if full_width_len(l.strip()) > 60 and not l.strip().startswith("|")]
    if long_lines:
        print(f"  ⚠️  {len(long_lines)} 行超過 60 全形字（手機上會變一團）：")
        for ln, l in long_lines[:5]:
            print(f"      L{ln}：{l.strip()[:30]}…（{full_width_len(l.strip())} 字）")
    else:
        print("  ✅ 沒有過長的段落")

    long_sent = []
    for seg in re.split(r"[。！？!?\n]", text):
        seg = seg.strip()
        if full_width_len(seg) > 45:
            long_sent.append(seg)
    if long_sent:
        print(f"  ⚠️  {len(long_sent)} 個句子超過 45 全形字未斷句，建議拆短")
    else:
        print("  ✅ 句長 OK")

    # --- 結構 ---
    print("\n【🎯 結構】")
    if any(c in text for c in CTA_HINT):
        found = [c for c in CTA_HINT if c in text][:5]
        print(f"  ✅ 偵測到 CTA 動詞：{'、'.join(found)}")
    else:
        print("  🔴 找不到任何 CTA 動詞 — 這份文案沒有終點")
        red_hits.append(("結構", "缺 CTA", 0, ""))

    if any(d in text for d in DISCLAIMER_HINT):
        print("  ✅ 偵測到免責／個人成果聲明")
    else:
        print("  🟡 未偵測到免責句 — 健康／金融／命理／成果類必加（見 references/合規紅線與禁詞.md）")

    nums = re.findall(r"\d+(?:\.\d+)?\s*(?:%|％|萬|倍|人|天|年)", text)
    if nums:
        print(f"  🟡 出現 {len(nums)} 個數字主張（{'、'.join(nums[:6])}）— 每個都要有出處")

    if industry:
        req = INDUSTRY_REQUIRED.get(industry)
        print(f"\n【📋 {industry} 法定必載檢查】")
        if not req:
            print(f"  （無此行業預設清單，請自行對照 references/合規紅線與禁詞.md）")
        else:
            for r in req:
                print(f"  {'✅' if r in text else '🔴'} {r}")
                if r not in text:
                    red_hits.append(("必載事項", r, 0, ""))

    print("\n" + "=" * 60)
    if red_hits:
        print(f"❌ 稽核未通過：{len(red_hits)} 個紅燈，先改再交。")
        print("=" * 60)
        sys.exit(1)
    print("✅ 稽核通過（黃燈項請人工確認事實依據）")
    print("=" * 60)
    sys.exit(0)


if __name__ == "__main__":
    main()
