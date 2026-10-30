#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小評 — 機場美食商場年度評鑑計分引擎
你的 AI 數字員工 / 稽核評鑑部

零第三方依賴，只用 Python 3 標準庫。

硬規（寫死在程式裡）：
  1. 沒有 evidence 的項目一律計 N/A，進補件清單，不給分也不扣分。
  2. 食安重大缺失 veto 命中 → 年度等第直接鎖定丁等，其他構面高分不得補救。
  3. 本程式只產出建議，契約處分與續約決定由權責單位為之。
"""

import argparse
import json
import os
import sys
import datetime
from pathlib import Path

BRAND = "你的 AI 數字員工"
TODAY = datetime.date.today()

# ---------------------------------------------------------------- 專案路徑

def project_dir(year=None):
    base = Path.home() / "Desktop"
    if year:
        return base / f"機場評鑑_{year}"
    # 沒指定年度就找最新的一個
    cands = sorted(base.glob("機場評鑑_*"))
    if not cands:
        return base / f"機場評鑑_{TODAY.year}"
    return cands[-1]


def load_json(path, default=None):
    if not Path(path).exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------- 預設指標

DEFAULT_RUBRIC = {
    "版本": "通用預設 v1.0",
    "說明": "⚠️ 這是通用模板。實際執行一律以主辦單位公告之評鑑要點為準，請逐條覆寫權重與查核點。",
    "等第門檻": {"甲等": 90, "乙等": 80, "丙等": 70, "丁等": 60},
    "食安一票否決": [
        "冷藏/冷凍未留存溫度紀錄或紀錄造假",
        "逾有效期限原料置於備料區或上架供應",
        "從業人員無有效健康檢查證明",
        "油炸油酸價超過法定上限",
        "作業區發現病媒(蟲鼠)屍體或活體",
        "使用未經核准之食品添加物"
    ],
    "構面": [
        {
            "代碼": "A", "名稱": "食品安全與衛生", "權重": 25,
            "項目": [
                {"id": "A1", "名稱": "HACCP/ISO22000 驗證與效期", "配分": 5, "證據": "驗證證書影本(查效期)"},
                {"id": "A2", "名稱": "原料溯源與有效期限管理", "配分": 5, "證據": "進貨單據+現場效期抽查照片"},
                {"id": "A3", "名稱": "冷藏冷凍溫度紀錄完整性", "配分": 5, "證據": "溫度紀錄表+現場溫度計讀值照片"},
                {"id": "A4", "名稱": "從業人員健康檢查與衛生習慣", "配分": 4, "證據": "健檢名冊+現場著裝照片"},
                {"id": "A5", "名稱": "油品管理(酸價/更換頻率)", "配分": 2, "證據": "酸價檢測紀錄"},
                {"id": "A6", "名稱": "病媒防治與環境消毒", "配分": 2, "證據": "防治委外契約+執行紀錄"},
                {"id": "A7", "名稱": "廢棄物與廢油處理合規", "配分": 2, "證據": "清運聯單"}
            ]
        },
        {
            "代碼": "B", "名稱": "服務品質與旅客體驗", "權重": 20,
            "項目": [
                {"id": "B1", "名稱": "神秘客綜合評分", "配分": 6, "證據": "神秘客報告×2(平日/假日)"},
                {"id": "B2", "名稱": "尖峰候餐時間", "配分": 4, "證據": "現場計時紀錄(≥10筆)"},
                {"id": "B3", "名稱": "多語點餐能力(中英日韓)", "配分": 3, "證據": "現場測試紀錄+菜單照片"},
                {"id": "B4", "名稱": "旅客滿意度調查得分", "配分": 3, "證據": "問卷/ASQ餐飲構面報表"},
                {"id": "B5", "名稱": "客訴件數與處理時效", "配分": 2, "證據": "客訴系統報表"},
                {"id": "B6", "名稱": "無障礙與親子友善設施", "配分": 2, "證據": "現場照片"}
            ]
        },
        {
            "代碼": "C", "名稱": "營運績效與契約遵循", "權重": 20,
            "項目": [
                {"id": "C1", "名稱": "營業額達成率", "配分": 5, "證據": "POS/申報營業額報表"},
                {"id": "C2", "名稱": "權利金按期繳納", "配分": 4, "證據": "繳款紀錄"},
                {"id": "C3", "名稱": "營業時間遵守(首班機前/末班機後)", "配分": 5, "證據": "突襲查核紀錄(含時間戳照片)"},
                {"id": "C4", "名稱": "人員配置足額(尖峰)", "配分": 3, "證據": "班表+現場點數"},
                {"id": "C5", "名稱": "品項供應完整度(缺品率)", "配分": 3, "證據": "現場菜單比對紀錄"}
            ]
        },
        {
            "代碼": "D", "名稱": "商品與定價", "權重": 15,
            "項目": [
                {"id": "D1", "名稱": "街價一致性(同價政策)", "配分": 5, "證據": "市區門市價目對照表+照片"},
                {"id": "D2", "名稱": "價目表公開揭示與正確性", "配分": 3, "證據": "現場價目表照片"},
                {"id": "D3", "名稱": "菜單更新與季節性商品", "配分": 3, "證據": "菜單改版紀錄"},
                {"id": "D4", "名稱": "在地特色與伴手禮商品", "配分": 2, "證據": "商品清單+照片"},
                {"id": "D5", "名稱": "素食/清真/過敏原標示", "配分": 2, "證據": "標示現場照片"}
            ]
        },
        {
            "代碼": "E", "名稱": "環境與設施維護", "權重": 10,
            "項目": [
                {"id": "E1", "名稱": "店裝完整度與識別維護", "配分": 3, "證據": "現場照片"},
                {"id": "E2", "名稱": "座位區與檯面清潔", "配分": 3, "證據": "尖峰時段巡檢照片"},
                {"id": "E3", "名稱": "油煙異味控制", "配分": 2, "證據": "排煙設備保養紀錄+現場查核"},
                {"id": "E4", "名稱": "消防與逃生動線淨空", "配分": 2, "證據": "現場照片"}
            ]
        },
        {
            "代碼": "F", "名稱": "永續與企業責任", "權重": 10,
            "項目": [
                {"id": "F1", "名稱": "減塑與循環容器", "配分": 3, "證據": "採購紀錄+現場查核"},
                {"id": "F2", "名稱": "廚餘減量與回收", "配分": 2, "證據": "廚餘清運紀錄"},
                {"id": "F3", "名稱": "節能措施", "配分": 2, "證據": "用電數據/設備汰換紀錄"},
                {"id": "F4", "名稱": "勞動條件與薪資合規", "配分": 2, "證據": "勞保投保名冊/薪資結構說明"},
                {"id": "F5", "名稱": "在地食材採購比例", "配分": 1, "證據": "採購單據抽查"}
            ]
        }
    ]
}

SAMPLE_VENDORS = [
    {"id": "V001", "名稱": "（範例）鼎泰豐 第二航廈管制區", "航廈": "T2", "位置": "管制區 4F 美食廣場",
     "類型": "中式餐廳", "契約起迄": "2025-01-01~2029-12-31", "去年等第": "甲等", "聯絡人": "", "電話": ""},
    {"id": "V002", "名稱": "（範例）星巴克 第一航廈出境", "航廈": "T1", "位置": "出境大廳 3F",
     "類型": "咖啡輕食", "契約起迄": "2024-07-01~2028-06-30", "去年等第": "乙等", "聯絡人": "", "電話": ""}
]


# ---------------------------------------------------------------- 計分核心

def grade_of(total, thresholds):
    if total >= thresholds["甲等"]:
        return "甲等"
    if total >= thresholds["乙等"]:
        return "乙等"
    if total >= thresholds["丙等"]:
        return "丙等"
    if total >= thresholds["丁等"]:
        return "丁等"
    return "不合格"


def score_vendor(vid, rubric, vscore):
    """回傳單一業者的計分結果。

    vscore 格式：
      {"veto": ["逾有效期限原料..."], "項目": {"A1": {"得分": 4, "證據": "...", "備註": "..."}}}
    """
    items = vscore.get("項目", {})
    veto_hits = [v for v in vscore.get("veto", []) if v]

    dims = []
    missing = []          # 補件清單
    total_weighted = 0.0
    total_weight_counted = 0.0

    for dim in rubric["構面"]:
        got, full, na_pts = 0.0, 0.0, 0.0
        detail = []
        for it in dim["項目"]:
            rec = items.get(it["id"])
            pts = it["配分"]
            full += pts
            if not rec or rec.get("得分") is None or not str(rec.get("證據", "")).strip():
                # 硬規 1：沒有證據 → N/A，不給分也不扣分
                na_pts += pts
                missing.append({
                    "業者": vid, "構面": dim["名稱"], "id": it["id"],
                    "項目": it["名稱"], "應附證據": it["證據"],
                    "原因": "缺證據" if rec else "未評分"
                })
                detail.append({"id": it["id"], "項目": it["名稱"], "得分": None,
                               "配分": pts, "狀態": "N/A"})
            else:
                s = float(rec["得分"])
                s = max(0.0, min(s, pts))     # 夾在 0~配分之間
                got += s
                detail.append({"id": it["id"], "項目": it["名稱"], "得分": s,
                               "配分": pts, "狀態": "已評",
                               "證據": rec.get("證據", ""), "備註": rec.get("備註", "")})

        effective = full - na_pts             # 實際可評配分
        if effective > 0:
            rate = got / effective            # 構面達成率（只用有評到的項目算）
            weighted = rate * dim["權重"]
            total_weighted += weighted
            total_weight_counted += dim["權重"]
        else:
            rate, weighted = None, None

        dims.append({
            "代碼": dim["代碼"], "名稱": dim["名稱"], "權重": dim["權重"],
            "得分": round(got, 2), "可評配分": round(effective, 2), "原始配分": full,
            "達成率": round(rate * 100, 1) if rate is not None else None,
            "加權得分": round(weighted, 2) if weighted is not None else None,
            "明細": detail
        })

    # 資料涵蓋率：有被計分的權重佔比
    coverage = round(total_weight_counted, 1)
    # 換算回 100 分制（以實際可評權重為母數）
    total = round(total_weighted / total_weight_counted * 100, 2) if total_weight_counted else 0.0

    th = rubric["等第門檻"]
    grade = grade_of(total, th)

    # 硬規 2：食安 veto
    if veto_hits:
        grade = "丁等"
        veto_flag = True
    else:
        veto_flag = False

    return {
        "業者": vid,
        "總分": total,
        "等第": grade,
        "veto": veto_flag,
        "veto缺失": veto_hits,
        "資料涵蓋率": coverage,
        "構面": dims,
        "補件清單": missing
    }


def compute_all(pdir):
    rubric = load_json(pdir / "rubric.json")
    vendors = load_json(pdir / "vendors.json", [])
    scores = load_json(pdir / "scores.json", {})
    if not rubric:
        sys.exit(f"❌ 找不到 {pdir/'rubric.json'}，請先跑：audit.py init --year <年度>")
    results = []
    for v in vendors:
        vid = v["id"]
        results.append((v, score_vendor(vid, rubric, scores.get(vid, {}))))
    return rubric, vendors, scores, results


# ---------------------------------------------------------------- 子指令

def cmd_init(args):
    pdir = project_dir(args.year)
    (pdir / "output").mkdir(parents=True, exist_ok=True)
    (pdir / "evidence").mkdir(parents=True, exist_ok=True)
    created = []
    for name, data in (("rubric.json", DEFAULT_RUBRIC),
                       ("vendors.json", SAMPLE_VENDORS),
                       ("scores.json", {})):
        p = pdir / name
        if p.exists() and not args.force:
            print(f"⏭  已存在，保留不覆蓋：{name}（要覆蓋請加 --force）")
            continue
        dump_json(p, data)
        created.append(name)
    print(f"\n✅ {args.year} 年度評鑑專案就緒：{pdir}")
    if created:
        print("   新建：" + "、".join(created))
    print("\n下一步：")
    print("  1. 打開 rubric.json，逐條對照主辦單位公告的評鑑要點修改權重與查核點")
    print("  2. 打開 vendors.json，把範例業者換成真實名冊")
    print("  3. audit.py checklist --vendor V001   產出現場查檢表")
    return 0


def cmd_status(args):
    pdir = project_dir(args.year)
    if not (pdir / "rubric.json").exists():
        print(f"📭 尚未建立評鑑專案（找不到 {pdir}）")
        print("   建立：python3 audit.py init --year %d" % TODAY.year)
        return 0
    rubric, vendors, scores, results = compute_all(pdir)

    print("=" * 62)
    print(f"  {BRAND} — 年度評鑑進度儀表板")
    print(f"  專案：{pdir.name}    產製日：{TODAY}")
    print("=" * 62)
    print(f"  指標版本：{rubric.get('版本','-')}    受評業者：{len(vendors)} 家\n")

    done = [r for _, r in results if r["資料涵蓋率"] >= 99.9]
    partial = [r for _, r in results if 0 < r["資料涵蓋率"] < 99.9]
    none_ = [r for _, r in results if r["資料涵蓋率"] == 0]
    print(f"  📊 收件進度：完整 {len(done)} 家 ／ 部分 {len(partial)} 家 ／ 未收 {len(none_)} 家\n")

    print(f"  {'業者':<26}{'涵蓋率':>7}{'總分':>8}{'等第':>7}  旗標")
    print("  " + "-" * 58)
    for v, r in sorted(results, key=lambda x: -x[1]["總分"]):
        name = v["名稱"][:24]
        flag = "🔴 食安veto" if r["veto"] else ("🟡 待補件" if r["補件清單"] else "🟢")
        cov = f"{r['資料涵蓋率']:.0f}%"
        print(f"  {name:<26}{cov:>7}{r['總分']:>8.1f}{r['等第']:>7}  {flag}")

    red = [(v, r) for v, r in results if r["veto"]]
    if red:
        print("\n  🔴 食安一票否決（鎖定丁等，不得以其他構面補救）：")
        for v, r in red:
            for hit in r["veto缺失"]:
                print(f"     • {v['名稱']}：{hit}")

    pend = sum(len(r["補件清單"]) for _, r in results)
    if pend:
        print(f"\n  🟡 待補件項目共 {pend} 項 → 明細：audit.py gap --vendor <ID>")

    # 改善追蹤逾期
    track = load_json(pdir / "improvement.json", [])
    overdue = [t for t in track if not t.get("複查日") and t.get("限期")
               and t["限期"] < TODAY.isoformat()]
    if overdue:
        print(f"\n  ⏰ 改善複查逾期 {len(overdue)} 件：")
        for t in overdue[:10]:
            print(f"     • {t.get('業者','?')} / {t.get('缺失','')[:28]}（限期 {t['限期']}）")
    print()
    return 0


def cmd_checklist(args):
    pdir = project_dir(args.year)
    rubric = load_json(pdir / "rubric.json")
    vendors = load_json(pdir / "vendors.json", [])
    if not rubric:
        sys.exit("❌ 請先 init")
    v = next((x for x in vendors if x["id"] == args.vendor), None)
    if not v:
        sys.exit(f"❌ 名冊中找不到業者 {args.vendor}")

    L = []
    L.append(f"# 現場查檢表｜{v['名稱']}")
    L.append("")
    L.append(f"> {BRAND} 稽核評鑑部　指標版本：{rubric.get('版本','-')}")
    L.append("")
    L.append(f"- **業者代碼**：{v['id']}　**航廈/位置**：{v.get('航廈','')} {v.get('位置','')}")
    L.append(f"- **稽查日期**：____年__月__日　**時段**：□早班(首班機前) □午尖峰 □晚尖峰 □末班機前")
    L.append(f"- **稽查方式**：□突襲現場 □神秘客 □書面查核　**稽查人**：____________")
    L.append("")
    L.append("> ⚠️ **沒有證據不給分。** 每項務必於現場當下拍照／記錄量測值，事後補寫一律不採認。")
    L.append("> 證據命名：`業者代碼_日期_時間_項目_序號.jpg`（例 `V001_20270815_1230_溫度紀錄_01.jpg`）")
    L.append("")
    L.append("## 🔴 食品安全一票否決檢查（任一命中即鎖定丁等）")
    L.append("")
    for hit in rubric["食安一票否決"]:
        L.append(f"- [ ] {hit}")
    L.append("")
    for dim in rubric["構面"]:
        L.append(f"## {dim['代碼']}. {dim['名稱']}（權重 {dim['權重']}%）")
        L.append("")
        L.append("| 項目 | 配分 | 得分 | 應附證據 | 現場紀錄／量測值 |")
        L.append("|---|---:|---:|---|---|")
        for it in dim["項目"]:
            L.append(f"| {it['id']} {it['名稱']} | {it['配分']} |  | {it['證據']} |  |")
        L.append("")
    L.append("## 綜合意見")
    L.append("")
    L.append("| 項目 | 內容 |")
    L.append("|---|---|")
    L.append("| 具體優點（需可佐證） |  |")
    L.append("| 具體缺失（缺失事實／依據條款／限期） |  |")
    L.append("| 本次未能查核之項目（列入補件） |  |")
    L.append("")
    L.append("稽查人簽名：________________　　業者現場人員簽名：________________")
    L.append("")
    L.append("---")
    L.append(f"*{BRAND}｜本查檢表僅供評鑑作業使用，評鑑結論不等同契約處分決定*")

    out = pdir / "output" / f"查檢表_{v['id']}_{TODAY:%Y%m%d}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L), encoding="utf-8")
    print(f"✅ 查檢表已產出：{out}")
    return 0


def cmd_score(args):
    pdir = project_dir(args.year)
    rubric, vendors, scores, results = compute_all(pdir)
    print(f"\n【{pdir.name}】加權計分結果　（指標：{rubric.get('版本','-')}）\n")
    print(f"{'排名':<5}{'業者':<26}{'總分':>8}{'等第':>7}{'涵蓋率':>8}  備註")
    print("-" * 70)
    ranked = sorted(results, key=lambda x: -x[1]["總分"])
    for i, (v, r) in enumerate(ranked, 1):
        note = "🔴 食安veto鎖定丁等" if r["veto"] else (f"待補 {len(r['補件清單'])} 項" if r["補件清單"] else "")
        print(f"{i:<5}{v['名稱'][:24]:<26}{r['總分']:>8.2f}{r['等第']:>7}{r['資料涵蓋率']:>7.0f}%  {note}")
    print("\n構面達成率：")
    for dim in rubric["構面"]:
        vals = [d["達成率"] for _, r in results for d in r["構面"]
                if d["代碼"] == dim["代碼"] and d["達成率"] is not None]
        avg = f"{sum(vals)/len(vals):.1f}%" if vals else "無資料"
        print(f"  {dim['代碼']}. {dim['名稱']:<14} 平均 {avg}")
    dump_json(pdir / "output" / "計分結果.json", [r for _, r in results])
    print(f"\n💾 明細已存：{pdir/'output'/'計分結果.json'}")
    print("⚠️ 本結果為評鑑建議，契約處分與續約決定由權責單位依契約條款為之。\n")
    return 0


def cmd_rank(args):
    return cmd_score(args)


def cmd_gap(args):
    pdir = project_dir(args.year)
    rubric, vendors, scores, results = compute_all(pdir)
    targets = [(v, r) for v, r in results if not args.vendor or v["id"] == args.vendor]
    if not targets:
        sys.exit(f"❌ 找不到業者 {args.vendor}")
    for v, r in targets:
        print(f"\n{'='*62}\n  缺失盤點｜{v['名稱']}（{v['id']}）　總分 {r['總分']:.2f} {r['等第']}\n{'='*62}")
        if r["veto缺失"]:
            print("\n🔴 食安一票否決（立即改善，不得營業至改善完成前）")
            for h in r["veto缺失"]:
                print(f"   • {h}")
        low = []
        for d in r["構面"]:
            for it in d["明細"]:
                if it["狀態"] == "已評" and it["配分"] and it["得分"] / it["配分"] < 0.6:
                    low.append((d["名稱"], it))
        if low:
            print("\n🟠 未達 60% 之項目（列入限期改善）")
            print(f"   {'構面':<16}{'項目':<28}{'得分/配分':>10}  建議限期")
            for dname, it in sorted(low, key=lambda x: x[1]["得分"] / x[1]["配分"]):
                ratio = it["得分"] / it["配分"]
                days = 14 if ratio < 0.3 else 30
                print(f"   {dname[:14]:<16}{(it['id']+' '+it['項目'])[:26]:<28}"
                      f"{it['得分']:>4.1f}/{it['配分']:<5}  {days} 日內"
                      f"（{(TODAY + datetime.timedelta(days=days)).isoformat()}）")
        if r["補件清單"]:
            print(f"\n🟡 待補件 {len(r['補件清單'])} 項（無證據不計分，非扣分）")
            for m in r["補件清單"]:
                print(f"   • [{m['id']}] {m['項目']}　應附：{m['應附證據']}（{m['原因']}）")
        if not (r["veto缺失"] or low or r["補件清單"]):
            print("\n🟢 無低分項目、無待補件。")
    print()
    return 0


CN_NUM = "一二三四五六七八九十"


def _report_lines(v, r, rubric, pdir):
    L = []
    _sec = [0]

    def sec(title):
        """動態章節編號——空章節不輸出，編號才不會跳號。"""
        _sec[0] += 1
        return f"## {CN_NUM[_sec[0] - 1]}、{title}"

    L.append(f"# {v['名稱']}　年度評鑑報告")
    L.append("")
    L.append(f"> {BRAND}　稽核評鑑部｜產製日 {TODAY}")
    L.append("")
    L.append(sec("基本資料"))
    L.append("")
    L.append("| 項目 | 內容 |")
    L.append("|---|---|")
    L.append(f"| 業者代碼 | {v['id']} |")
    L.append(f"| 航廈／位置 | {v.get('航廈','')} {v.get('位置','')} |")
    L.append(f"| 業種 | {v.get('類型','')} |")
    L.append(f"| 契約起迄 | {v.get('契約起迄','')} |")
    L.append(f"| 去年度等第 | {v.get('去年等第','—')} |")
    L.append("")
    L.append(sec("評鑑結果"))
    L.append("")
    L.append(f"**總分 {r['總分']:.2f} ／ 100　等第：{r['等第']}**"
             + ("　🔴 **食安一票否決，等第鎖定丁等**" if r["veto"] else ""))
    L.append("")
    if v.get("去年等第") and v["去年等第"] != "—":
        L.append(f"去年等第 {v['去年等第']} → 今年 {r['等第']}")
        L.append("")
    if r["資料涵蓋率"] < 99.9:
        L.append(f"> ⚠️ 本次資料涵蓋率 {r['資料涵蓋率']:.0f}%，"
                 f"尚有 {len(r['補件清單'])} 項因缺證據列為 N/A（不計分亦不扣分），"
                 f"總分係以已評項目之權重換算。補件後應重新計分。")
        L.append("")
    L.append("### 各構面得分")
    L.append("")
    L.append("| 構面 | 權重 | 得分／可評配分 | 達成率 | 加權得分 |")
    L.append("|---|---:|---:|---:|---:|")
    for d in r["構面"]:
        rate = f"{d['達成率']:.1f}%" if d["達成率"] is not None else "無資料"
        w = f"{d['加權得分']:.2f}" if d["加權得分"] is not None else "—"
        L.append(f"| {d['代碼']}. {d['名稱']} | {d['權重']}% | "
                 f"{d['得分']:.1f} / {d['可評配分']:.0f} | {rate} | {w} |")
    L.append("")
    if r["veto缺失"]:
        L.append(sec("食品安全重大缺失（一票否決）"))
        L.append("")
        for h in r["veto缺失"]:
            L.append(f"- 🔴 {h}")
        L.append("")
        L.append("> 依評鑑要點，命中食安重大缺失者年度等第逕列丁等，不得以其他構面得分補救，並列入專案輔導。")
        L.append("")
    L.append(sec("具體缺失與限期改善"))
    L.append("")
    L.append("| 缺失事實 | 依據條款 | 限期 | 複查方式 |")
    L.append("|---|---|---|---|")
    any_low = False
    for d in r["構面"]:
        for it in d["明細"]:
            if it["狀態"] == "已評" and it["配分"] and it["得分"] / it["配分"] < 0.6:
                any_low = True
                ratio = it["得分"] / it["配分"]
                days = 14 if ratio < 0.3 else 30
                due = (TODAY + datetime.timedelta(days=days)).isoformat()
                note = it.get("備註") or f"{it['id']} {it['項目']}　得分 {it['得分']:.1f}/{it['配分']}"
                L.append(f"| {note} | （填入評鑑要點／契約條款） | {due} | 現場複查 |")
    if not any_low:
        L.append("| （本次無未達 60% 之項目） | — | — | — |")
    L.append("")
    if r["補件清單"]:
        L.append(sec("待補件項目（無證據不計分，非扣分）"))
        L.append("")
        L.append("| 代碼 | 項目 | 應附證據 | 原因 |")
        L.append("|---|---|---|---|")
        for m in r["補件清單"]:
            L.append(f"| {m['id']} | {m['項目']} | {m['應附證據']} | {m['原因']} |")
        L.append("")
    L.append(sec("綜合建議"))
    L.append("")
    if r["veto"]:
        L.append("- 立即停止相關作業並完成改善，改善完成經複查合格前不得恢復該項供應。")
        L.append("- 列入次年度加強稽查名單，稽查頻次加倍。")
    elif r["等第"] in ("丙等", "丁等", "不合格"):
        L.append(f"- 本年度 {r['等第']}，請於限期內完成改善並接受複查。")
        L.append("- 若連續二年丙等以下，建議提報契約檢討。")
    elif r["等第"] == "甲等":
        L.append("- 本年度表現優良，建議列入優良業者表揚名單。")
    else:
        L.append("- 維持現行水準，就上述低分項目提出精進計畫。")
    L.append("")
    L.append("> ⚠️ 本報告為評鑑建議，**契約處分、罰則、續約與否由權責單位依契約條款決定**，本報告不生處分效力。")
    L.append("")
    L.append("---")
    L.append("")
    L.append(f"*{BRAND}｜稽核評鑑部｜{TODAY}*")
    return L


def cmd_report(args):
    pdir = project_dir(args.year)
    rubric, vendors, scores, results = compute_all(pdir)
    outdir = pdir / "output"
    outdir.mkdir(parents=True, exist_ok=True)

    if args.all:
        ranked = sorted(results, key=lambda x: -x[1]["總分"])
        L = [f"# {pdir.name}　年度評鑑總報告", "",
             f"> {BRAND}　稽核評鑑部｜產製日 {TODAY}｜指標版本 {rubric.get('版本','-')}", "",
             "## 一、評鑑結果總表", "",
             "| 排名 | 業者 | 航廈 | 總分 | 等第 | 去年 | 旗標 |",
             "|---:|---|---|---:|---|---|---|"]
        for i, (v, r) in enumerate(ranked, 1):
            flag = "🔴 食安veto" if r["veto"] else ("🟡 待補件" if r["補件清單"] else "🟢")
            L.append(f"| {i} | {v['名稱']} | {v.get('航廈','')} | {r['總分']:.2f} | "
                     f"{r['等第']} | {v.get('去年等第','—')} | {flag} |")
        L += ["", "## 二、等第分布", "", "| 等第 | 家數 |", "|---|---:|"]
        for g in ("甲等", "乙等", "丙等", "丁等", "不合格"):
            L.append(f"| {g} | {sum(1 for _, r in results if r['等第'] == g)} |")
        L += ["", "## 三、各構面平均達成率", "", "| 構面 | 權重 | 平均達成率 |", "|---|---:|---:|"]
        for dim in rubric["構面"]:
            vals = [d["達成率"] for _, r in results for d in r["構面"]
                    if d["代碼"] == dim["代碼"] and d["達成率"] is not None]
            avg = f"{sum(vals)/len(vals):.1f}%" if vals else "無資料"
            L.append(f"| {dim['代碼']}. {dim['名稱']} | {dim['權重']}% | {avg} |")
        L += ["", "> ⚠️ 本報告為評鑑建議，契約處分與續約決定由權責單位依契約條款為之。",
              "> ⚠️ 公開版報告不得揭露個別業者營業額等商業敏感資料。", "",
              "---", "", f"*{BRAND}｜稽核評鑑部｜{TODAY}*"]
        out = outdir / f"年度評鑑總報告_{TODAY:%Y%m%d}.md"
        out.write_text("\n".join(L), encoding="utf-8")
        print(f"✅ 總報告已產出：{out}")
        return 0

    v, r = next(((v, r) for v, r in results if v["id"] == args.vendor), (None, None))
    if not v:
        sys.exit(f"❌ 找不到業者 {args.vendor}（或請用 --all）")
    out = outdir / f"評鑑報告_{v['id']}_{TODAY:%Y%m%d}.md"
    out.write_text("\n".join(_report_lines(v, r, rubric, pdir)), encoding="utf-8")
    print(f"✅ 評鑑報告已產出：{out}")
    return 0


def main():
    # --year 同時掛在主解析器與每個子指令，前後擺放都吃得到
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--year", type=int, default=None, help="評鑑年度（預設取最新專案）")

    ap = argparse.ArgumentParser(description="小評 — 機場美食商場年度評鑑計分引擎",
                                 parents=[common])
    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("init", help="建立年度評鑑專案", parents=[common])
    p.add_argument("--force", action="store_true", help="覆蓋既有設定檔")
    sub.add_parser("status", help="進度儀表板（唯讀，預設動作）", parents=[common])
    p = sub.add_parser("checklist", help="產出現場查檢表", parents=[common])
    p.add_argument("--vendor", required=True)
    sub.add_parser("score", help="加權計分＋等第＋veto", parents=[common])
    sub.add_parser("rank", help="排名與分布", parents=[common])
    p = sub.add_parser("gap", help="缺失盤點與限期改善清單", parents=[common])
    p.add_argument("--vendor", default=None)
    p = sub.add_parser("report", help="產出評鑑報告", parents=[common])
    p.add_argument("--vendor", default=None)
    p.add_argument("--all", action="store_true")

    args = ap.parse_args()
    if args.cmd in (None, "status"):
        args.cmd = "status"
    if args.cmd == "init" and args.year is None:
        args.year = TODAY.year
    return {"init": cmd_init, "status": cmd_status, "checklist": cmd_checklist,
            "score": cmd_score, "rank": cmd_rank, "gap": cmd_gap,
            "report": cmd_report}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
