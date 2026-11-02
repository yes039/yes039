"""產生 G1 模擬資料（純虛構，不含任何真實 POS 資料）。

用法：python3 gen_mock.py
產出：
  raw_clean/  8 張報表的模擬匯出檔（假設格式，含標題列與合計列）
  raw_dirty/  同一份資料，刻意埋入 7 種錯誤，用來測試驗證規則能否攔截

注意：真實 WISE POS 的匯出格式目前未知（G0 等級 D）。
      本檔的欄位名稱與版面全部是「假設」，G1 拿到真實檔案後必須改寫 mapping。
"""
import csv
import datetime as dt
import os
import random
import shutil
from collections import defaultdict

SEED = 20261102
STORE = "模擬店"
START = dt.date(2026, 10, 26)
DAYS = 7
HERE = os.path.dirname(os.path.abspath(__file__))

# 商品主檔（虛構）：編號, 名稱, 類別, 售價, 單位成本
ITEMS = [
    ("A001", "招牌海鮮粥", "粥品", 180, 72),
    ("A002", "皮蛋瘦肉粥", "粥品", 120, 38),
    ("A003", "干貝雞粥", "粥品", 160, 61),
    ("B001", "蝦仁炒飯", "飯麵", 150, 52),
    ("B002", "沙茶牛肉炒麵", "飯麵", 160, 58),
    ("B003", "鹹蛋苦瓜飯", "飯麵", 130, 40),
    ("C001", "三杯雞", "熱炒", 280, 98),
    ("C002", "蒜泥白肉", "熱炒", 220, 70),
    ("C003", "炒高麗菜", "熱炒", 120, 30),
    ("C004", "糖醋排骨", "熱炒", 260, 95),
    ("C005", "清蒸鱸魚", "熱炒", 420, 180),
    ("D001", "蛤蜊湯", "湯品", 150, 55),
    ("D002", "酸菜肚片湯", "湯品", 180, 60),
    ("E001", "辦公室合菜（4人）", "合菜套餐", 980, 380),
    ("E002", "溫馨家庭餐（3人）", "合菜套餐", 780, 300),
    ("F001", "滷味拼盤", "小菜", 90, 30),
    ("F002", "涼拌小黃瓜", "小菜", 60, 12),
    ("G001", "冬瓜茶", "飲料", 40, 8),
    ("G002", "啤酒", "飲料", 90, 45),
    ("G003", "白飯", "其他", 15, 4),
]

# 每小時來客權重（10–24 時；24 代表 00:00–00:59）
HOUR_W = {10: 1, 11: 6, 12: 10, 13: 6, 14: 2, 15: 1, 16: 2, 17: 6, 18: 10,
          19: 8, 20: 4, 21: 3, 22: 3, 23: 2, 24: 1}
MODES = [("內用", 55), ("外帶", 30), ("外送", 15)]
PAYS = {"內用": [("現金", 50), ("信用卡", 30), ("LINE Pay", 20)],
        "外帶": [("現金", 60), ("LINE Pay", 40)],
        "外送": [("外送平台", 100)]}


def shift_of(hour):
    return "早班" if hour < 16 else "晚班"


def pick(rng, pairs):
    return rng.choices([p[0] for p in pairs], weights=[p[1] for p in pairs])[0]


def gen_transactions(rng):
    txns = []
    for d in range(DAYS):
        day = START + dt.timedelta(days=d)
        n = rng.randint(95, 120) if day.weekday() < 5 else rng.randint(125, 150)
        for i in range(n):
            hour = pick(rng, list(HOUR_W.items()))
            biz_date = day  # 00:00 後的交易仍歸屬前一營業日
            mode = pick(rng, MODES)
            lines = []
            if hour in (11, 12, 13) and rng.random() < 0.10:
                lines.append(("E001", 1))
            elif hour in (17, 18, 19) and rng.random() < 0.08:
                lines.append(("E002", 1))
            for _ in range(rng.randint(1, 4)):
                if hour >= 21:
                    pool = ["A001", "A002", "A003", "F001", "G002", "D001"]
                else:
                    pool = [it[0] for it in ITEMS if not it[0].startswith("E")]
                lines.append((rng.choice(pool), rng.choice([1, 1, 1, 2])))
            disc_rate = 0.1 if rng.random() < 0.08 else 0.0
            status = "作廢" if rng.random() < 0.015 else "正常"
            txns.append(dict(
                txn_id=f"S{day:%Y%m%d}{i + 1:04d}", biz_date=biz_date, hour=hour,
                mode=mode, pay=pick(rng, PAYS[mode]), disc_rate=disc_rate,
                status=status, lines=lines))
    return txns


def money(n):
    return f"{n:,}"


def write_report(path, title, period, header, rows, total=None):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([f"{STORE} {title}"])
        w.writerow([f"期間：{period}"])
        w.writerow(header)
        w.writerows(rows)
        if total:
            w.writerow(total)


def build_reports(txns, out):
    os.makedirs(out, exist_ok=True)
    price = {i[0]: i for i in ITEMS}
    period = f"{START:%Y/%m/%d} ~ {START + dt.timedelta(days=DAYS - 1):%Y/%m/%d}"
    day = defaultdict(lambda: [0, 0, 0])            # 筆數, 原價, 折扣
    hour = defaultdict(lambda: [0, 0])
    shift = defaultdict(lambda: [0, 0])
    mode = defaultdict(lambda: [0, 0])
    pay = defaultdict(lambda: [0, 0])
    item = defaultdict(lambda: [0, 0, 0])            # 數量, 原價, 折扣
    voids = 0
    for t in txns:
        if t["status"] == "作廢":
            voids += 1
            continue
        gross = disc = 0
        for iid, q in t["lines"]:
            g = price[iid][3] * q
            dsc = round(g * t["disc_rate"])
            gross += g
            disc += dsc
            item[iid][0] += q
            item[iid][1] += g
            item[iid][2] += dsc
        net = gross - disc
        d = t["biz_date"]
        day[d][0] += 1; day[d][1] += gross; day[d][2] += disc
        h = t["hour"] % 24
        hour[(d, h)][0] += 1; hour[(d, h)][1] += net
        s = shift_of(t["hour"])
        shift[(d, s)][0] += 1; shift[(d, s)][1] += net
        mode[(d, t["mode"])][0] += 1; mode[(d, t["mode"])][1] += net
        pay[(d, t["pay"])][0] += 1; pay[(d, t["pay"])][1] += net

    tot_cnt = sum(v[0] for v in day.values())
    tot_gross = sum(v[1] for v in day.values())
    tot_disc = sum(v[2] for v in day.values())
    tot_net = tot_gross - tot_disc

    write_report(f"{out}/R01_營業總表.csv", "營業總表", period,
                 ["項目", "數值"],
                 [["有效交易筆數", tot_cnt], ["作廢筆數", voids],
                  ["銷售總額", money(tot_gross)], ["折扣金額", money(tot_disc)],
                  ["實銷金額", money(tot_net)]])
    rows = [[f"{d:%Y/%m/%d}", v[0], money(v[1]), money(v[2]), money(v[1] - v[2])]
            for d, v in sorted(day.items())]
    write_report(f"{out}/R02_日銷售統計表.csv", "日銷售統計表", period,
                 ["日期", "交易筆數", "銷售金額", "折扣金額", "實銷金額"], rows,
                 ["合計", tot_cnt, money(tot_gross), money(tot_disc), money(tot_net)])
    rows = [[f"{d:%Y/%m/%d}", f"{h:02d}:00-{h:02d}:59", v[0], money(v[1])]
            for (d, h), v in sorted(hour.items(), key=lambda x: (x[0][0], (x[0][1] - 6) % 24))]
    write_report(f"{out}/R03_收銀時段分析表.csv", "收銀時段分析表", period,
                 ["日期", "時段", "交易筆數", "實銷金額"], rows,
                 ["合計", "", tot_cnt, money(tot_net)])
    rows = [[f"{d:%Y/%m/%d}", s, v[0], money(v[1])] for (d, s), v in sorted(shift.items())]
    write_report(f"{out}/R04_班別銷售統計表.csv", "班別銷售統計表", period,
                 ["日期", "班別", "交易筆數", "實銷金額"], rows,
                 ["合計", "", tot_cnt, money(tot_net)])
    rows = [[f"{d:%Y/%m/%d}", m, v[0], money(v[1])] for (d, m), v in sorted(mode.items())]
    write_report(f"{out}/R06_銷售方式分析表.csv", "銷售方式分析表", period,
                 ["日期", "銷售方式", "交易筆數", "實銷金額"], rows,
                 ["合計", "", tot_cnt, money(tot_net)])
    rows, rows12 = [], []
    for iid, v in sorted(item.items()):
        _, name, cat, _, cost = price[iid]
        net = v[1] - v[2]
        rows.append([iid, name, cat, v[0], money(v[1]), money(v[2]), money(net)])
        c = cost * v[0]
        rows12.append([iid, name, v[0], money(net), money(c), money(net - c),
                       f"{(net - c) / net * 100:.1f}%"])
    write_report(f"{out}/R07_商品銷售明細表.csv", "商品銷售明細表", period,
                 ["商品編號", "商品名稱", "類別", "數量", "銷售金額", "折扣金額", "實銷金額"],
                 rows, ["合計", "", "", sum(v[0] for v in item.values()),
                        money(tot_gross), money(tot_disc), money(tot_net)])
    write_report(f"{out}/R12_商品銷售毛利分析表.csv", "商品銷售毛利分析表", period,
                 ["商品編號", "商品名稱", "數量", "實銷金額", "成本金額", "毛利", "毛利率"],
                 rows12)
    rows = [[f"{d:%Y/%m/%d}", p, v[0], money(v[1])] for (d, p), v in sorted(pay.items())]
    write_report(f"{out}/R22_付款方式統計表.csv", "付款方式統計表", period,
                 ["日期", "付款方式", "筆數", "金額"], rows,
                 ["合計", "", tot_cnt, money(tot_net)])


def read_all(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.reader(f))


def write_all(path, rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f).writerows(rows)


def make_dirty(src, dst):
    """埋入 7 種錯誤，每一種都對應交付三規格中的一條驗證規則。"""
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    # E1（V5 缺日）：R02 刪掉 10/29，但保留原合計列 → 同時觸發 V0 合計不符
    r = read_all(f"{dst}/R02_日銷售統計表.csv")
    r = [x for x in r if not x[0].startswith("2026/10/29")]
    write_all(f"{dst}/R02_日銷售統計表.csv", r)
    # E2（V4 重複）：R03 第 5 列重複一次
    r = read_all(f"{dst}/R03_收銀時段分析表.csv")
    r.insert(5, r[4])
    write_all(f"{dst}/R03_收銀時段分析表.csv", r)
    # E3（V8 個資）：R22 加一欄「備註」，內含電話與姓名
    r = read_all(f"{dst}/R22_付款方式統計表.csv")
    r[2].append("備註")
    for x in r[3:]:
        x.append("")
    r[4][-1] = "王小明 0912-345-678 熟客"
    write_all(f"{dst}/R22_付款方式統計表.csv", r)
    # E4（V10 成本缺漏）：R12 前 6 個商品的成本改為 0
    r = read_all(f"{dst}/R12_商品銷售毛利分析表.csv")
    for x in r[3:9]:
        x[4] = "0"
    write_all(f"{dst}/R12_商品銷售毛利分析表.csv", r)
    # E5（V2 跨表不一致）：R06 某一列金額 +500
    r = read_all(f"{dst}/R06_銷售方式分析表.csv")
    r[3][3] = f"{int(r[3][3].replace(',', '')) + 500:,}"
    write_all(f"{dst}/R06_銷售方式分析表.csv", r)
    # E6（V8 個資）：R07 商品名稱誤夾 Email
    r = read_all(f"{dst}/R07_商品銷售明細表.csv")
    r[3][1] = r[3][1] + "（訂購 abc@example.com）"
    write_all(f"{dst}/R07_商品銷售明細表.csv", r)
    # E7（V0 格式）：R04 一個金額欄寫成非數字
    r = read_all(f"{dst}/R04_班別銷售統計表.csv")
    r[3][3] = "N/A"
    write_all(f"{dst}/R04_班別銷售統計表.csv", r)


if __name__ == "__main__":
    rng = random.Random(SEED)
    tx = gen_transactions(rng)
    build_reports(tx, f"{HERE}/raw_clean")
    make_dirty(f"{HERE}/raw_clean", f"{HERE}/raw_dirty")
    print(f"模擬交易 {len(tx)} 筆 → raw_clean/、raw_dirty/ 已產生")
