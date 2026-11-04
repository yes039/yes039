#!/usr/bin/env python3
"""AI-CORE-013 G1 三路線對照測試執行器（A: Sonnet / B: Sonnet+Opus Advisor / C: Opus）。

預設為 dry-run：只列出將執行的組合與費用上限，不呼叫任何模型。
必須同時加上 --approved 與 --budget-usd 才會實際執行，對應執行令中
「取得總指揮核准後才執行可能產生費用的批量測試」的規定。

輸入：tests.json（格式見 tests.example.json），只引用 SEAL-02 原始資產，
不得放入自行捏造的資料。

隔離：每組測試都在全新暫存目錄中執行，只複製該測試指定的單一店家資料，
並使用 --no-session-persistence。三條路線使用相同的提示、工具權限、
Schema 與輪數上限。

輸出：
- runs/<test_id>/<route>/ 底下放 raw.json 與 output.json（本機證據，不上傳；已列入 .gitignore）
- 03-模型對照測試紀錄.csv、05-成本與效能分析.csv 的資料列
- blind/：匿名化輸出，以及另存的對照鍵（盲評用）
"""
import argparse, csv, json, random, shutil, subprocess, sys, tempfile, time
from pathlib import Path

ROUTES = {
    "A": {"model": "claude-sonnet-5-5", "advisor": None},
    "B": {"model": "claude-sonnet-5-5", "advisor": "claude-opus-5-5"},
    "C": {"model": "claude-opus-5-5", "advisor": None},
}
# 官方牌價（US$/百萬 token，2026-10）。CLI 也會回報 costUSD（costBasis=list），兩者都只是估算。
PRICE = {
    "claude-sonnet-5-5": {"in": 2.0, "out": 10.0, "cache_read": 0.20, "cache_write_5m": 2.5, "cache_write_1h": 4.0},
    "claude-opus-5-5": {"in": 4.0, "out": 20.0, "cache_read": 0.20, "cache_write_5m": 5.0, "cache_write_1h": 8.0},
}
ALLOWED_TOOLS = ["Read", "Glob", "Grep"]  # 三路線相同，只能讀取
MAX_TURNS = 8
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def build_cmd(route, prompt, schema):
    r = ROUTES[route]
    cmd = ["claude", "-p", prompt, "--model", r["model"], "--output-format", "json",
           "--max-turns", str(MAX_TURNS), "--no-session-persistence", "--strict-mcp-config",
           "--tools", *ALLOWED_TOOLS, "--allowedTools", *ALLOWED_TOOLS]
    if schema:
        cmd += ["--json-schema", json.dumps(schema, ensure_ascii=False)]
    if r["advisor"]:
        cmd += ["--advisor", r["advisor"]]
    return cmd


def parse(raw):
    usage = raw.get("usage", {})
    its = usage.get("iterations", []) or []
    adv = [i for i in its if i.get("type") == "advisor_message"]
    mu = raw.get("modelUsage", {})
    return {
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cache_read": usage.get("cache_read_input_tokens", 0),
        "cache_write": usage.get("cache_creation_input_tokens", 0),
        "advisor_calls": len(adv),
        "advisor_in": sum(i.get("input_tokens", 0) for i in adv),
        "advisor_out": sum(i.get("output_tokens", 0) for i in adv),
        "cost_list_usd": raw.get("total_cost_usd"),
        "cost_basis": ",".join(sorted({v.get("costBasis", "?") for v in mu.values()})) or "unavailable",
        "num_turns": raw.get("num_turns"),
        "is_error": raw.get("is_error"),
        "structured": raw.get("structured_output"),
        "result": raw.get("result"),
    }


def run_one(t, route, outdir):
    work = Path(tempfile.mkdtemp(prefix=f"g1_{t['test_id']}_{route}_"))
    for src in t["input_files"]:  # 只複製該店資料，作為資料隔離
        shutil.copy(ROOT / src, work / Path(src).name)
    if t.get("skill_md"):
        shutil.copy(ROOT / t["skill_md"], work / "SKILL.md")
    schema = json.loads((ROOT / t["schema"]).read_text()) if t.get("schema") else None
    t0 = time.time()
    retries, raw = 0, None
    while retries <= 1:
        p = subprocess.run(build_cmd(route, t["prompt"], schema), cwd=work, capture_output=True, text=True, timeout=900)
        try:
            raw = json.loads(p.stdout)
            break
        except json.JSONDecodeError:
            retries += 1
    secs = round(time.time() - t0, 1)
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "raw.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2) if raw else p.stdout + p.stderr)
    m = parse(raw or {})
    out = m["structured"] if m["structured"] is not None else m["result"]
    (outdir / "output.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    schema_ok = "N/A"
    if schema is not None:
        try:
            import jsonschema
            jsonschema.validate(m["structured"], schema)
            schema_ok = "PASS"
        except Exception as e:  # noqa: BLE001
            schema_ok = f"FAIL:{type(e).__name__}"
    shutil.rmtree(work, ignore_errors=True)
    status = "OK"
    if route == "B" and m["advisor_calls"] == 0:
        status = "NO_ADVISOR_CALL"
    return {**m, "seconds": secs, "retries": retries, "schema_ok": schema_ok, "status": status}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tests", default=str(HERE / "tests.json"))
    ap.add_argument("--routes", default="A,B,C")
    ap.add_argument("--approved", action="store_true", help="總指揮已核准費用")
    ap.add_argument("--budget-usd", type=float, default=0.0, help="累計估算費用上限，超過即停止")
    a = ap.parse_args()
    tests = json.loads(Path(a.tests).read_text())
    routes = a.routes.split(",")
    plan = [(t, r) for t in tests for r in routes]
    print(f"計畫 {len(plan)} 組（{len(tests)} 測試 × {len(routes)} 路線）")
    if not (a.approved and a.budget_usd > 0):
        for t, r in plan:
            print("DRY-RUN", t["test_id"], r, " ".join(build_cmd(r, "<prompt>", None)[3:]))
        print("未加 --approved 與 --budget-usd，沒有呼叫任何模型。")
        return
    random.shuffle(plan)  # 打散順序，降低時段偏差
    spent, rows = 0.0, []
    for t, r in plan:
        if spent >= a.budget_usd:
            print("已達預算上限，停止。")
            break
        res = run_one(t, r, ROOT / "runs" / t["test_id"] / r)
        spent += res["cost_list_usd"] or 0
        rows.append({"test_id": t["test_id"], "employee": t["employee"], "route": r,
                     "executor": ROUTES[r]["model"], "advisor": ROUTES[r]["advisor"] or "", **{k: v for k, v in res.items() if k not in ("structured", "result")}})
        print(t["test_id"], r, res["status"], res["cost_list_usd"])
    with open(ROOT / "runs" / "matrix_results.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    # 盲評包：匿名代號 → 路線，對照鍵另存，評分者不得取得
    blind = ROOT / "runs" / "blind"
    blind.mkdir(exist_ok=True)
    key = {}
    for row in rows:
        code = f"X{random.randrange(10**6):06d}"
        key[code] = {"test_id": row["test_id"], "route": row["route"]}
        shutil.copy(ROOT / "runs" / row["test_id"] / row["route"] / "output.json", blind / f"{row['test_id']}_{code}.json")
    (ROOT / "runs" / "BLIND_KEY.json").write_text(json.dumps(key, indent=2))
    print(f"完成，估算花費 US${spent:.4f}")


if __name__ == "__main__":
    sys.exit(main())
