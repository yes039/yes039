"""G1 資料前處理管線：讀取報表匯出檔 → 標準化 → 個資掃描 → 驗證對帳 → 產出 clean CSV 與標準答案。

用法：python3 pipeline.py <raw資料夾> <輸出資料夾>
結束碼：0＝通過（可交給 Claude）；1＝有阻擋級錯誤（不得交給 Claude）

只讀取本機檔案，不連線任何系統。欄位對照（MAP）是依「假設格式」撰寫，
拿到真實 POS 匯出檔後，只需改寫 MAP，驗證規則不變。
"""
import csv
import datetime as dt
import json
import os
import re
import sys
from collections import defaultdict

# 標準欄位對照：檔名前綴 → (標準檔名, {原欄名: 標準欄名}, 數值欄, 主鍵)
MAP = {
    "R01": ("fact_summary", {"項目": "item", "數值": "value"}, ["value"], ["item"]),
    "R02": ("fact_daily", {"日期": "biz_date", "交易筆數": "order_cnt", "銷售金額": "gross_sales",
                           "折扣金額": "discount_amt", "實銷金額": "net_sales"},
            ["order_cnt", "gross_sales", "discount_amt", "net_sales"], ["biz_date"]),
    "R03": ("fact_hourly", {"日期": "biz_date", "時段": "hour_slot", "交易筆數": "order_cnt",
                            "實銷金額": "net_sales"}, ["order_cnt", "net_sales"], ["biz_date", "hour_slot"]),
    "R04": ("fact_shift", {"日期": "biz_date", "班別": "shift_code", "交易筆數": "order_cnt",
                           "實銷金額": "net_sales"}, ["order_cnt", "net_sales"], ["biz_date", "shift_code"]),
    "R06": ("fact_channel", {"日期": "biz_date", "銷售方式": "sales_mode", "交易筆數": "order_cnt",
                             "實銷金額": "net_sales"}, ["order_cnt", "net_sales"], ["biz_date", "sales_mode"]),
    "R07": ("fact_item", {"商品編號": "item_id", "商品名稱": "item_name", "類別": "category",
                          "數量": "qty", "銷售金額": "gross_amt", "折扣金額": "discount_amt",
                          "實銷金額": "net_amt"}, ["qty", "gross_amt", "discount_amt", "net_amt"], ["item_id"]),
    "R12": ("fact_margin", {"商品編號": "item_id", "商品名稱": "item_name", "數量": "qty",
                            "實銷金額": "net_amt", "成本金額": "cost_amt", "毛利": "gp_amt",
                            "毛利率": "gp_rate"}, ["qty", "net_amt", "cost_amt", "gp_amt"], ["item_id"]),
    "R22": ("fact_payment", {"日期": "biz_date", "付款方式": "pay_method", "筆數": "order_cnt",
                             "金額": "amount"}, ["order_cnt", "amount"], ["biz_date", "pay_method"]),
}
REQUIRED = list(MAP)

PII_PATTERNS = {
    "手機號碼": re.compile(r"09\d{2}[- ]?\d{3}[- ]?\d{3}"),
    "市話": re.compile(r"\(?0\d{1,2}\)?[- ]?\d{3,4}[- ]?\d{4}"),
    "Email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    "身分證字號": re.compile(r"\b[A-Z][12]\d{8}\b"),
    "信用卡號": re.compile(r"\b(?:\d[ -]?){15,16}\b"),
}
PII_HEADERS = ["姓名", "電話", "手機", "地址", "生日", "Email", "身分證", "統編", "載具", "密碼", "卡號"]


class Run:
    def __init__(self):
        self.results = []  # (規則, 等級, 通過, 說明)

    def add(self, rule, level, ok, msg):
        self.results.append((rule, level, ok, msg))

    @property
    def blocked(self):
        return any(lv == "BLOCK" and not ok for _, lv, ok, _ in self.results)


def to_num(s):
    s = str(s).replace(",", "").replace("%", "").strip()
    if s == "":
        return 0
    v = float(s)
    return int(v) if v.is_integer() else v


def load(raw_dir, code, run):
    files = [f for f in os.listdir(raw_dir) if f.startswith(code + "_") and f.endswith(".csv")]
    if not files:
        run.add("V0", "BLOCK", False, f"{code}：找不到檔案")
        return None, None
    path = os.path.join(raw_dir, files[0])
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    period = next((r[0] for r in rows[:3] if r and r[0].startswith("期間")), "")
    hdr_i = next(i for i, r in enumerate(rows) if r and r[0] in ("日期", "項目", "商品編號"))
    header = rows[hdr_i]
    body = [r for r in rows[hdr_i + 1:] if any(c.strip() for c in r)]
    total = None
    if body and body[-1][0] == "合計":
        total = body.pop()
    return dict(file=files[0], period=period, header=header, body=body, total=total), path


def pii_scan(code, tbl, run):
    hits = []
    for h in tbl["header"]:
        if any(k in h for k in PII_HEADERS):
            hits.append(f"欄名「{h}」")
    for r_i, r in enumerate(tbl["body"], start=1):
        for c in r:
            for name, pat in PII_PATTERNS.items():
                if pat.search(c) and not re.fullmatch(r"[\d,./:\- ~%]+", c):
                    hits.append(f"第{r_i}列 {name}")
    run.add("V8", "BLOCK", not hits, f"{code} 個資掃描：" + ("無" if not hits else "；".join(hits)))


def standardize(code, tbl, run):
    std_name, colmap, nums, keys = MAP[code]
    missing = [c for c in colmap if c not in tbl["header"]]
    if missing:
        run.add("V0", "BLOCK", False, f"{code} 缺少欄位：{missing}")
        return []
    idx = {colmap[c]: tbl["header"].index(c) for c in colmap}
    out, bad = [], []
    for n, r in enumerate(tbl["body"], start=1):
        rec = {k: r[i].strip() for k, i in idx.items()}
        for k in nums:
            try:
                rec[k] = to_num(rec[k])
            except ValueError:
                bad.append(f"第{n}列 {k}={rec[k]!r}")
                rec[k] = None
        if "biz_date" in rec:
            rec["biz_date"] = rec["biz_date"].replace("/", "-")
        out.append(rec)
    run.add("V0", "BLOCK", not bad, f"{code} 數值格式：" + ("正常" if not bad else "；".join(bad)))
    # V4 去重
    seen, dedup, dups = set(), [], 0
    for rec in out:
        k = tuple(rec[x] for x in keys)
        if k in seen:
            dups += 1
            continue
        seen.add(k)
        dedup.append(rec)
    run.add("V4", "WARN", dups == 0, f"{code} 主鍵重複：{dups} 列" + ("（已自動去除）" if dups else ""))
    # 合計列核對
    if tbl["total"]:
        t = dict(zip(tbl["header"], tbl["total"]))
        diffs = []
        for c, k in colmap.items():
            if k in nums and t.get(c, "").strip():
                s = sum(x[k] or 0 for x in dedup)
                if abs(s - to_num(t[c])) > 1:
                    diffs.append(f"{c} 明細合計 {s:,} ≠ 報表合計 {to_num(t[c]):,}")
        run.add("V0", "BLOCK", not diffs, f"{code} 合計列核對：" + ("一致" if not diffs else "；".join(diffs)))
    return dedup


def by_day(rows, amt="net_sales", cnt="order_cnt"):
    d = defaultdict(lambda: [0, 0])
    for r in rows:
        d[r["biz_date"]][0] += r[cnt] or 0
        d[r["biz_date"]][1] += r[amt] or 0
    return d


def validate(T, period, run):
    summ = {r["item"]: r["value"] for r in T["R01"]}
    daily = {r["biz_date"]: r for r in T["R02"]}
    # V1：日報合計 = 營業總表
    s_net = sum(r["net_sales"] or 0 for r in T["R02"])
    s_cnt = sum(r["order_cnt"] or 0 for r in T["R02"])
    ok = abs(s_net - summ.get("實銷金額", 0)) <= 1 and s_cnt == summ.get("有效交易筆數")
    run.add("V1", "BLOCK", ok, f"R02 合計 {s_net:,} 元／{s_cnt} 筆；R01 {summ.get('實銷金額', 0):,} 元／"
                               f"{summ.get('有效交易筆數')} 筆")
    # V5：日期連續
    m = re.findall(r"(\d{4}/\d{2}/\d{2})", period)
    if len(m) == 2:
        a, b = (dt.datetime.strptime(x, "%Y/%m/%d").date() for x in m)
        want = {str(a + dt.timedelta(days=i)) for i in range((b - a).days + 1)}
        miss = sorted(want - set(daily))
        run.add("V5", "BLOCK", not miss, "日期連續性：" + ("完整" if not miss else f"缺 {miss}"))
    # V2 / V3：各維度每日合計 = 日報
    for code, label, amt in [("R03", "時段", "net_sales"), ("R04", "班別", "net_sales"),
                             ("R06", "銷售方式", "net_sales"), ("R22", "付款方式", "amount")]:
        rule = "V3" if code == "R22" else "V2"
        diffs = []
        for d, (c, v) in sorted(by_day(T[code], amt).items()):
            ref = daily.get(d)
            if ref is None:
                continue  # 缺日已由 V5 報告
            if abs(v - ref["net_sales"]) > 1 or c != ref["order_cnt"]:
                diffs.append(f"{d}：{label} {v:,}/{c} 筆 vs 日報 {ref['net_sales']:,}/{ref['order_cnt']} 筆")
        run.add(rule, "BLOCK", not diffs, f"{code} {label} vs R02：" + ("一致" if not diffs else "；".join(diffs)))
    # 商品表 vs 營業總表
    for code, k in [("R07", "net_amt"), ("R12", "net_amt")]:
        s = sum(r[k] or 0 for r in T[code])
        ok = abs(s - summ.get("實銷金額", 0)) <= 1
        run.add("V2", "BLOCK", ok, f"{code} 商品實銷合計 {s:,} vs R01 {summ.get('實銷金額', 0):,}")
    # V10：成本缺漏比例
    zero = [r for r in T["R12"] if not r["cost_amt"]]
    ratio = len(zero) / max(len(T["R12"]), 1)
    run.add("V10", "WARN", ratio <= 0.05,
            f"R12 成本為 0 或空白：{len(zero)}/{len(T['R12'])} 項（{ratio:.0%}）"
            + ("→ 毛利改用外部標準配方表（X3）計算，不得採用 R12 毛利" if ratio > 0.05 else ""))


def metrics(T):
    summ = {r["item"]: r["value"] for r in T["R01"]}
    net, cnt = summ["實銷金額"], summ["有效交易筆數"]
    days = len(T["R02"])
    hourly = defaultdict(lambda: [0, 0])
    for r in T["R03"]:
        hourly[r["hour_slot"][:2]][0] += r["order_cnt"]
        hourly[r["hour_slot"][:2]][1] += r["net_sales"]

    def window(hs):
        c = sum(hourly[h][0] for h in hs)
        v = sum(hourly[h][1] for h in hs)
        return {"net_sales": v, "order_cnt": c, "daily_avg_sales": round(v / days),
                "aov": round(v / c) if c else 0, "share": round(v / net, 4)}

    def agg(rows, key, amt="net_sales"):
        d = defaultdict(lambda: [0, 0])
        for r in rows:
            d[r[key]][0] += r["order_cnt"]
            d[r[key]][1] += r[amt]
        return {k: {"net_sales": v[1], "order_cnt": v[0], "share": round(v[1] / net, 4),
                    "aov": round(v[1] / v[0]) if v[0] else 0} for k, v in sorted(d.items())}

    cat = defaultdict(int)
    for r in T["R07"]:
        cat[r["category"]] += r["net_amt"]
    top = sorted(T["R07"], key=lambda r: -r["net_amt"])[:10]
    cost = sum(r["cost_amt"] for r in T["R12"])
    return {
        "_說明": "模擬資料的標準答案（golden）。Claude 的分析數字必須與此相符（誤差 ≤ 1 元或 0.1 個百分點）",
        "period_days": days,
        "net_sales": net, "order_cnt": cnt, "aov": round(net / cnt),
        "discount_amt": summ["折扣金額"], "discount_rate": round(summ["折扣金額"] / summ["銷售總額"], 4),
        "void_cnt": summ["作廢筆數"],
        "daily": {r["biz_date"]: {"net_sales": r["net_sales"], "order_cnt": r["order_cnt"],
                                  "aov": round(r["net_sales"] / r["order_cnt"])} for r in T["R02"]},
        "peak_hour": max(hourly, key=lambda h: hourly[h][1]),
        "windows_三增時段": {"午餐 11–13 時": window(["11", "12", "13"]),
                         "晚餐 17–19 時": window(["17", "18", "19"]),
                         "深夜 21–00 時": window(["21", "22", "23", "00"])},
        "shift": agg(T["R04"], "shift_code"),
        "channel": agg(T["R06"], "sales_mode"),
        "payment": agg(T["R22"], "pay_method", "amount"),
        "category_share": {k: round(v / net, 4) for k, v in sorted(cat.items(), key=lambda x: -x[1])},
        "top10_items": [{"item_id": r["item_id"], "item_name": r["item_name"], "net_amt": r["net_amt"],
                         "qty": r["qty"]} for r in top],
        "food_cost_rate_R12": round(cost / net, 4),
        "gross_margin_rate_R12": round(1 - cost / net, 4),
    }


def main(raw, out):
    run = Run()
    T, period = {}, ""
    for code in REQUIRED:
        tbl, _ = load(raw, code, run)
        if tbl is None:
            continue
        period = period or tbl["period"]
        pii_scan(code, tbl, run)
        T[code] = standardize(code, tbl, run)
    if all(c in T for c in REQUIRED):
        validate(T, period, run)
    os.makedirs(out, exist_ok=True)
    status = "❌ 阻擋：不得交給 Claude" if run.blocked else "✅ 通過：可交給 Claude"
    lines = [f"# 驗證報告｜{os.path.basename(os.path.normpath(raw))}", "", f"- {period}",
             f"- 結果：**{status}**", "", "| 規則 | 等級 | 結果 | 說明 |", "|---|---|---|---|"]
    for rule, lv, ok, msg in run.results:
        lines.append(f"| {rule} | {lv} | {'✅' if ok else ('❌' if lv == 'BLOCK' else '⚠️')} | {msg} |")
    with open(os.path.join(out, "validation_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    if not run.blocked:
        cdir = os.path.join(out, "clean")
        os.makedirs(cdir, exist_ok=True)
        for code, rows in T.items():
            with open(os.path.join(cdir, MAP[code][0] + ".csv"), "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        with open(os.path.join(out, "golden_metrics.json"), "w", encoding="utf-8") as f:
            json.dump(metrics(T), f, ensure_ascii=False, indent=2)
    print(status)
    fails = [r for r in run.results if not r[2]]
    for rule, lv, _, msg in fails:
        print(f"  {lv:5} {rule}: {msg}")
    return 1 if run.blocked else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
