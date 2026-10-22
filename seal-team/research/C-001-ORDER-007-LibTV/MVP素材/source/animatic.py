"""5 秒分鏡動態腳本（animatic）：每拍顯示景別／動作，目前音節高亮，配 rap-5s-mix.wav。
用法：python3 animatic.py <MVP素材目錄>"""
import json, subprocess, sys
D = sys.argv[1]
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
tab = json.load(open(f"{D}/音節時間表.json", encoding="utf-8"))
SHOTS = [  # (起, 迄, 景別, 動作)
    (0.000, 0.625, "中景・固定", "抬頭看鏡頭，雙手撐櫃台"),
    (0.625, 1.875, "中景・固定", "「天天忙到」雙手向兩側攤開"),
    (1.875, 2.500, "中景・固定", "「半夜」手放下，輕搖頭"),
    (2.500, 3.125, "中景・固定", "停頓、嘆氣，肩膀下沉"),
    (3.125, 3.750, "中景・固定", "「月底」右手食指敲櫃台兩下"),
    (3.750, 4.375, "中景・固定", "「錢咧？」攤手、挑眉"),
    (4.375, 5.000, "緩推近→胸上近景", "表情停住，直視鏡頭"),
]
def esc(s): return s.replace(":", "\\:").replace("'", "’")
f = ["color=c=0x1b1b1b:s=720x1280:r=30:d=5[bg]", "[bg]"]
chain = []
def dt(text, x, y, size, color, en=None):
    e = f":enable='between(t,{en[0]},{en[1]})'" if en else ""
    chain.append(f"drawtext=fontfile={FONT}:text='{esc(text)}':x={x}:y={y}:fontsize={size}:fontcolor={color}{e}")
dt("百業商戰 Battle｜MVP 5 秒分鏡（非成片）", "(w-tw)/2", 60, 30, "0x9a9a9a")
dt("傳統麵店老闆・55 歲・深色圍裙・9:16", "(w-tw)/2", 105, 28, "0x9a9a9a")
for a, b, shot, act in SHOTS:
    dt(shot, "(w-tw)/2", 300, 52, "0xffd34d", (a, b))
    dt(act, "(w-tw)/2", 390, 34, "white", (a, b))
x0 = 60
for s in tab["syllables"]:
    x = x0 + (s["idx"] - 1) * 60 + (40 if s["idx"] > 6 else 0)
    dt(s["char"], x, 700, 54, "0x555555")
    dt(s["char"], x, 700, 54, "0xff5a3c", (s["start"], s["end"]))
for b in range(8):
    dt(f"拍 {b+1}/8", "(w-tw)/2", 900, 40, "0x6fd3ff", (round(b * 0.625, 3), round((b + 1) * 0.625, 3)))
chain.append(f"drawtext=fontfile={FONT}:text='%{{pts\\:hms}}  幀 %{{frame_num}}':x=(w-tw)/2:y=1150:fontsize=30:fontcolor=0x9a9a9a")
graph = "color=c=0x1b1b1b:s=720x1280:r=30:d=5," + ",".join(chain)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", graph, "-i", f"{D}/rap-5s-mix.wav",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "192k",
                "-shortest", f"{D}/分鏡動態腳本-animatic-5s-9x16.mp4"], check=True)
