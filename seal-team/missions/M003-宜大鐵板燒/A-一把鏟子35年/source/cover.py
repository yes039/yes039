"""A 版封面（1080x1920）：整面鏟子牆＋封面字。用法：python3 cover.py <素材資料夾> <輸出路徑>"""
import sys
src, out_path = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], src, '/tmp']  # render.py 在 import 時讀參數
import render as R

img = R.grade(R.wall.view(480, 760, 1250), dark=0.92)
R.band(img, 1330, 1.0, 0.6); R.band(img, 1470, 1.0, 0.5)
R.put_text(img, '這面牆，', 110, 1330, 1.0, spacing=10)
R.put_text(img, '掛著 35 年', 110, 1470, 1.0, spacing=10)
img.save(out_path, quality=92)
