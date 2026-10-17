#!/usr/bin/env python3
"""tabcalc：通用 CSV 確定性計算工具（金額、筆數、比率、機械異常盤點）。

設計原則：AI 決定「算什麼」（欄位、篩選條件、口徑），本工具負責「算出來」。同樣的輸入一定得到同樣的輸出。
- 列號：表頭為第 1 列，第一筆資料為第 2 列。
- 數值與比對一律先做 NFKC 正規化（全形轉半形）並去除前後空白。
- 只允許讀取工作目錄下的 cases/、runs/ 和 fixtures/。

子指令：
  profile <csv> [--key 欄,欄] [--test-pattern REGEX]   機械異常盤點（分類 F1–F4，計數單位見下方）
  sum     <csv> --col 欄 [--where 條件 ...]            加總
  count   <csv> [--where 條件 ...] [--group 欄] [--distinct 欄]   筆數，可分組；--distinct 依正規化小寫鍵去重
  ratio   <分子> <分母> [--round N]                     比率
  match   <csvA> <鍵A> <csvB> <鍵B> [--where-a ...] [--where-b ...]   以正規化鍵比對兩表

欄位可用「JSON 欄.路徑」取 JSON 欄內的值，例如 辨識結果.total_amount、辨識結果.items.0.name。
條件：欄=值、欄!=值、欄~正則、欄!~正則、欄?（非空）、欄!?（空值）。

機械異常分類（計數單位＝不重複的（檔案, 列號, 分類））：
  F1 全形字元   該列任一儲存格含全形英數或符號（U+FF01–FF5E、U+3000）
  F2 空值       該列任一儲存格為空（只看 CSV 儲存格，不看 JSON 內部）
  F3 重複鍵     依 --key 正規化並轉小寫後與前面某列相同（第一次出現的那列不算）
  F4 測試標記   該列任一儲存格符合 --test-pattern（預設 (?i)(?<![a-z])test(?![a-z])|測試）
"""
import csv, json, os, re, sys, unicodedata, argparse

ALLOWED = ("cases", "runs", "fixtures")


def die(msg):
    print(json.dumps({"error": msg}, ensure_ascii=False)); sys.exit(2)


def safe_path(p):
    base = os.path.realpath(os.getcwd())
    rp = os.path.realpath(p)
    if not any(rp == os.path.join(base, a) or rp.startswith(os.path.join(base, a) + os.sep) for a in ALLOWED):
        die(f"path not allowed: {p}")
    if not os.path.isfile(rp):
        die(f"file not found: {p}")
    return rp


def norm(s):
    return unicodedata.normalize("NFKC", s or "").strip()


def load(p):
    with open(safe_path(p), newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        die(f"empty file: {p}")
    hdr = rows[0]
    data = [(i + 2, dict(zip(hdr, r + [""] * (len(hdr) - len(r))))) for i, r in enumerate(rows[1:]) if any(c.strip() for c in r)]
    return hdr, data


def get(rec, field):
    if field in rec:
        return rec[field]
    if "." in field:
        col, path = field.split(".", 1)
        if col in rec:
            try:
                v = json.loads(rec[col])
            except Exception:
                return ""
            for k in path.split("."):
                if isinstance(v, list) and k.isdigit() and int(k) < len(v):
                    v = v[int(k)]
                elif isinstance(v, dict) and k in v:
                    v = v[k]
                else:
                    return ""
            return "" if v is None else (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v))
    die(f"unknown field: {field}")


COND = re.compile(r"^(.+?)(!=|!~|=|~|!\?|\?)(.*)$")


def match_all(rec, conds):
    for c in conds or []:
        m = COND.match(c)
        if not m:
            die(f"bad condition: {c}")
        f, op, val = m.groups()
        v = norm(get(rec, f))
        ok = {"=": v == norm(val), "!=": v != norm(val), "~": re.search(val, v) is not None,
              "!~": re.search(val, v) is None, "?": v != "", "!?": v == ""}[op]
        if not ok:
            return False
    return True


def num(s):
    s = norm(s).replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def clean(x):
    return int(x) if float(x).is_integer() else round(x, 6)


def cmd_profile(a):
    hdr, data = load(a.csv)
    fw = re.compile("[！-～　]")
    tp = re.compile(a.test_pattern)
    keys = a.key.split(",") if a.key else None
    seen, items = {}, []
    for rn, rec in data:
        cells = [rec.get(h, "") for h in hdr]
        cols = [h for h in hdr if fw.search(rec.get(h, ""))]
        if cols: items.append({"row": rn, "cat": "F1", "cols": cols})
        cols = [h for h in hdr if rec.get(h, "").strip() == ""]
        if cols: items.append({"row": rn, "cat": "F2", "cols": cols})
        if keys:
            k = tuple(norm(get(rec, x)).casefold() for x in keys)
            if k in seen: items.append({"row": rn, "cat": "F3", "dup_of": seen[k], "key": list(k)})
            else: seen[k] = rn
        cols = [h for h in hdr if tp.search(rec.get(h, ""))]
        if cols: items.append({"row": rn, "cat": "F4", "cols": cols})
    by = {c: sum(1 for i in items if i["cat"] == c) for c in ("F1", "F2", "F3", "F4")}
    return {"file": a.csv, "data_rows": len(data), "columns": hdr, "anomaly_count": len(items), "by_category": by, "items": items}


def cmd_sum(a):
    _, data = load(a.csv)
    used, skipped, total = [], [], 0.0
    for rn, rec in data:
        if not match_all(rec, a.where): continue
        v = num(get(rec, a.col))
        if v is None: skipped.append(rn)
        else: used.append(rn); total += v
    return {"file": a.csv, "col": a.col, "where": a.where, "sum": clean(total), "rows_used": used, "rows_skipped_empty_or_nonnumeric": skipped}


def cmd_count(a):
    _, data = load(a.csv)
    rows = [(rn, rec) for rn, rec in data if match_all(rec, a.where)]
    out = {"file": a.csv, "where": a.where, "count": len(rows), "rows": [rn for rn, _ in rows]}
    if a.distinct:
        first, dups = {}, []
        for rn, rec in rows:
            k = norm(get(rec, a.distinct)).casefold()
            if k in first: dups.append({"row": rn, "dup_of": first[k]})
            else: first[k] = rn
        out.update({"distinct_by": a.distinct, "distinct_count": len(first), "distinct_rows": list(first.values()), "duplicate_rows": dups})
    if a.group:
        g = {}
        for rn, rec in rows: g.setdefault(norm(get(rec, a.group)), []).append(rn)
        out["groups"] = {k: {"count": len(v), "rows": v} for k, v in g.items()}
    return out


def cmd_ratio(a):
    n, d = num(a.num), num(a.den)
    if n is None or d is None or d == 0: die("ratio needs numeric numerator and non-zero denominator")
    return {"numerator": clean(n), "denominator": clean(d), "ratio": round(n / d, a.round)}


def cmd_match(a):
    _, da = load(a.csv_a); _, db = load(a.csv_b)
    k = lambda rec, f: norm(get(rec, f)).casefold()
    A = [(rn, k(r, a.key_a)) for rn, r in da if match_all(r, a.where_a)]
    B = [(rn, k(r, a.key_b)) for rn, r in db if match_all(r, a.where_b)]
    bk = {}
    for rn, key in B: bk.setdefault(key, []).append(rn)
    ak = {key for _, key in A}
    return {"matched": [{"a_row": rn, "key": key, "b_rows": bk[key]} for rn, key in A if key in bk],
            "a_unmatched": [{"a_row": rn, "key": key} for rn, key in A if key not in bk],
            "b_unmatched": [{"b_row": rn, "key": key} for rn, key in B if key not in ak]}


def main():
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("profile"); x.add_argument("csv"); x.add_argument("--key"); x.add_argument("--test-pattern", default=r"(?i)(?<![a-z])test(?![a-z])|測試")
    x = s.add_parser("sum"); x.add_argument("csv"); x.add_argument("--col", required=True); x.add_argument("--where", nargs="*")
    x = s.add_parser("count"); x.add_argument("csv"); x.add_argument("--where", nargs="*"); x.add_argument("--group"); x.add_argument("--distinct")
    x = s.add_parser("ratio"); x.add_argument("num"); x.add_argument("den"); x.add_argument("--round", type=int, default=2)
    x = s.add_parser("match"); x.add_argument("csv_a"); x.add_argument("key_a"); x.add_argument("csv_b"); x.add_argument("key_b")
    x.add_argument("--where-a", nargs="*"); x.add_argument("--where-b", nargs="*")
    a = p.parse_args()
    print(json.dumps(globals()["cmd_" + a.cmd](a), ensure_ascii=False))


if __name__ == "__main__":
    main()
