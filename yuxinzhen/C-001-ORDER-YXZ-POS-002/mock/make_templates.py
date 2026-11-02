"""產生《G1 資料欄位範本.xlsx》：8 張 POS 報表的標準欄位，以及 POS 沒有、需要外部補充的 X1–X5 範本。
範例列取自模擬資料（純虛構）。用法：python3 make_templates.py
"""
import csv
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "G1資料欄位範本.xlsx")
HEAD = PatternFill("solid", fgColor="1F4E78")
NOTE = PatternFill("solid", fgColor="FFF2CC")

POS = [  # 工作表, 標準檔, 說明
    ("R01營業總表", "fact_summary", "對帳基準。item 必須包含：有效交易筆數、作廢筆數、銷售總額、折扣金額、實銷金額"),
    ("R02日銷售", "fact_daily", "主鍵 biz_date；營業日跨午夜者，歸屬前一日"),
    ("R03時段", "fact_hourly", "主鍵 biz_date+hour_slot；hour_slot 格式 HH:00-HH:59，要求 1 小時一格"),
    ("R04班別", "fact_shift", "主鍵 biz_date+shift_code"),
    ("R06銷售方式", "fact_channel", "主鍵 biz_date+sales_mode；外送平台最好分開列"),
    ("R07商品明細", "fact_item", "主鍵 item_id（期間彙總）"),
    ("R12毛利", "fact_margin", "cost_amt 為 0 的比例 > 5% 時，不採用本表毛利"),
    ("R22付款", "fact_payment", "主鍵 biz_date+pay_method"),
]
EXT = [
    ("X1進貨明細", "店內依供應商發票、送貨單登打",
     ["date", "supplier_id", "ing_id", "ing_name", "spec", "unit", "qty", "unit_cost", "amount", "doc_no"],
     ["2026-10-27", "SUP01", "ING001", "白蝦（模擬）", "1kg/包", "包", 10, 320, 3200, "INV-0001"]),
    ("X2週盤點", "每週一盤點高金額前 20 項食材",
     ["count_date", "ing_id", "unit", "qty_end", "unit_cost", "waste_qty", "waste_reason"],
     ["2026-11-02", "ING001", "包", 3, 320, 0.5, "解凍過期"]),
    ("X3標準配方", "三增商品＋銷售前 20 名商品",
     ["item_id", "ing_id", "qty_per_unit", "unit", "loss_rate"],
     ["A001", "ING001", 0.08, "包", 0.05]),
    ("X4排班打卡", "員工只填代碼，不填姓名",
     ["work_date", "staff_code", "role", "shift_code", "clock_in", "clock_out", "break_min"],
     ["2026-10-26", "E01", "內場", "早班", "09:30", "15:30", 30]),
    ("X5人事成本", "每月一次，由會計提供；員工只填代碼",
     ["month", "staff_code", "pay_type", "rate", "ot_pay", "employer_cost"],
     ["2026-10", "E01", "月薪", 36000, 1200, 4500]),
]


def style_header(ws, row):
    for c in ws[row]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEAD


wb = Workbook()
ws = wb.active
ws.title = "說明"
for r in [
    ["G1 資料欄位範本（C-001-ORDER-YXZ-POS-002）"],
    ["範例列全部是模擬資料，不含任何真實 POS 資料。"],
    ["POS 報表工作表：真實匯出檔經 pipeline.py 對照後，必須變成這些欄位。"],
    ["X1–X5 工作表：POS 沒有的資料，由店內用 Excel 填寫。禁止填入姓名、電話、身分證字號。"],
    ["真實 POS 匯出格式目前未知（G0 等級 D），G1 取得實檔後只需修改 pipeline.py 的 MAP。"],
]:
    ws.append(r)
ws["A1"].font = Font(bold=True, size=14)
ws.column_dimensions["A"].width = 90

for sheet, std, note in POS:
    ws = wb.create_sheet(sheet)
    with open(os.path.join(HERE, "out_clean", "clean", std + ".csv"), encoding="utf-8") as f:
        rows = list(csv.reader(f))
    ws.append([f"標準檔：{std}.csv｜{note}"])
    ws["A1"].fill = NOTE
    ws.append(rows[0])
    style_header(ws, 2)
    for r in rows[1:4]:
        ws.append([float(x) if x.replace(".", "", 1).isdigit() else x for x in r])
    for col in ws.columns:
        ws.column_dimensions[col[1].column_letter].width = 16

for sheet, note, cols, sample in EXT:
    ws = wb.create_sheet(sheet)
    ws.append([f"外部補充｜{note}"])
    ws["A1"].fill = NOTE
    ws.append(cols)
    style_header(ws, 2)
    ws.append(sample)
    for col in ws.columns:
        ws.column_dimensions[col[1].column_letter].width = 15
        col[1].alignment = Alignment(horizontal="center")

wb.save(OUT)
print("已產生", os.path.normpath(OUT))
