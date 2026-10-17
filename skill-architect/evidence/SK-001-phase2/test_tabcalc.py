"""tabcalc 自測：用已知答案驗證確定性計算（於 sandbox 目錄執行）。"""
import json, subprocess, sys
def run(*a):
    p = subprocess.run([sys.executable, "-I", "tools/tabcalc.py", *a], capture_output=True, text=True)
    return json.loads(p.stdout)
Y, C = "cases/yx/data", "cases/club/data"
checks = [
 (run("sum", f"{Y}/小購_採購主表_V02.csv", "--col", "實付金額")["sum"], 18450),
 (run("sum", f"{Y}/小購_暫存單據_V01.csv", "--col", "辨識結果.total_amount", "--where", "狀態=已入帳")["sum"], 18450),
 (run("sum", f"{Y}/小購_暫存單據_V01.csv", "--col", "辨識結果.total_amount", "--where", "狀態=待確認")["sum"], 5700),
 (run("count", f"{Y}/小購_暫存單據_V01.csv", "--where", "狀態=待確認")["count"], 3),
 (run("sum", f"{Y}/工作表1.csv", "--col", "營收")["sum"], 59942),
 (run("ratio", "59942", "220")["ratio"], 272.46),
 (sum(run("profile", f"{Y}/{f}.csv")["anomaly_count"] for f in ["工作表1","小購_暫存單據_V01","小購_採購主表_V02","小購_測試資料_V01"]), 8),
 (run("profile", f"{C}/registrations.csv", "--key", "email")["anomaly_count"], 1),
 (run("profile", f"{C}/payments.csv", "--key", "pay_id")["anomaly_count"], 0),
 (run("sum", f"{C}/payments.csv", "--col", "amount")["sum"], 3500),
 (len(run("match", f"{C}/registrations.csv", "email", f"{C}/payments.csv", "email", "--where-a", "status=報名")["b_unmatched"]), 2),
 (run("count", f"{C}/registrations.csv", "--where", "status=報名", "--distinct", "email")["distinct_count"], 5),
 ("error" in run("sum", "/home/user/yes039/README.md", "--col", "x"), True),
 ("error" in run("sum", "cases/club-missing/data/payments.csv", "--col", "amount"), True),
]
bad = [(i, got, exp) for i, (got, exp) in enumerate(checks) if got != exp]
print(f"{len(checks)-len(bad)}/{len(checks)} passed", bad or "")
sys.exit(1 if bad else 0)
