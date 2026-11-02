"""比對 Claude 分析結果與標準答案（golden_metrics.json）。

用法：python3 check_answer.py <golden_metrics.json> <claude_answer.json>
claude_answer.json 格式：{"指標路徑": 數值, ...}，例如
  {"net_sales": 429307, "channel.外送.share": 0.1463}
容許誤差：金額、筆數 ≤ 1；比率 ≤ 0.001（0.1 個百分點）
"""
import json
import sys


def get(d, path):
    for p in path.split("."):
        d = d[p]
    return d


def main(golden_path, ans_path):
    g = json.load(open(golden_path, encoding="utf-8"))
    a = json.load(open(ans_path, encoding="utf-8"))
    fails = 0
    for k, v in a.items():
        try:
            ref = get(g, k)
        except (KeyError, TypeError):
            print(f"❓ {k}: 標準答案無此指標（請人工判斷）")
            continue
        tol = 0.001 if isinstance(ref, float) and abs(ref) < 1.5 else 1
        ok = abs(v - ref) <= tol
        fails += not ok
        print(f"{'✅' if ok else '❌'} {k}: Claude={v} 標準={ref}")
    print(f"\n{len(a) - fails}/{len(a)} 通過")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
