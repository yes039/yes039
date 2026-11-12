#!/usr/bin/env python3
"""產生 SEAL-01 流程驗證用的測試素材（不呼叫任何付費生成服務）。

用法：python3 test_assets.py 輸出資料夾 字型Black.ttf
產出：
  icon_handoff.png / icon_chat_x.png / icon_clock_check.png / icon_calendar.png /
  icon_teacher.png / icon_classroom.png   程式繪製的佔位圖示（咖啡線稿＋奶茶金填色）
  demo_mock.webm                          模擬 AI 回覆私訊的螢幕錄影（畫面標明「測試用模擬畫面」）
  bgm_test.wav                            合成的測試背景音樂（僅供驗證壓低功能）
正式版請替換為真實 Demo 錄影、核准的圖示與有商用授權的音樂。
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

LINE, FILL, GOLD, PAPER = (107, 74, 51, 255), (230, 213, 190, 255), (201, 161, 90, 255), (250, 246, 238, 255)
S, LW = 600, 14


def canvas():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def person(d, cx, cy, s=1.0, fill=FILL):
    d.ellipse([cx - 55 * s, cy - 150 * s, cx + 55 * s, cy - 40 * s], fill=PAPER, outline=LINE, width=LW)
    d.rounded_rectangle([cx - 95 * s, cy - 20 * s, cx + 95 * s, cy + 170 * s], 60 * s, fill=fill, outline=LINE,
                        width=LW)


def icon_handoff(font):
    im, d = canvas()
    person(d, 170, 260)
    person(d, 430, 270, 0.9, fill=PAPER)
    d.rounded_rectangle([380, 300, 480, 360], 10, fill=GOLD, outline=LINE, width=8)
    d.text((430, 330), "AI", font=font(34), fill=LINE, anchor="mm")
    d.rectangle([250, 250, 340, 360], fill=PAPER, outline=LINE, width=LW)
    for y in (280, 305, 330):
        d.line([265, y, 325, y], fill=LINE, width=6)
    d.line([300, 470, 360, 470], fill=LINE, width=10)
    d.polygon([(360, 450), (395, 470), (360, 490)], fill=LINE)
    return im


def icon_chat_x(font):
    im, d = canvas()
    d.rounded_rectangle([80, 120, 520, 400], 60, fill=PAPER, outline=LINE, width=LW)
    d.polygon([(160, 395), (150, 480), (240, 398)], fill=PAPER, outline=LINE)
    d.line([160, 398, 150, 480, 240, 398], fill=LINE, width=LW)
    for y in (200, 260, 320):
        d.line([150, y, 450, y], fill=LINE, width=10)
    d.line([360, 330, 540, 510], fill=(190, 70, 50, 255), width=26)
    d.line([540, 330, 360, 510], fill=(190, 70, 50, 255), width=26)
    return im


def icon_clock_check(font):
    im, d = canvas()
    d.ellipse([90, 90, 470, 470], fill=PAPER, outline=LINE, width=LW)
    d.line([280, 280, 280, 160], fill=LINE, width=14)
    d.line([280, 280, 370, 320], fill=LINE, width=14)
    d.ellipse([265, 265, 295, 295], fill=LINE)
    d.ellipse([390, 380, 560, 550], fill=GOLD, outline=LINE, width=10)
    d.line([425, 465, 465, 505, 530, 425], fill=LINE, width=18)
    return im


def icon_calendar(font):
    im, d = canvas()
    d.rounded_rectangle([90, 110, 510, 500], 30, fill=PAPER, outline=LINE, width=LW)
    d.rectangle([90, 110, 510, 210], fill=GOLD, outline=LINE, width=LW)
    for x in (190, 410):
        d.rounded_rectangle([x - 14, 70, x + 14, 150], 10, fill=LINE)
    d.text((300, 160), "11月", font=font(60), fill=LINE, anchor="mm")
    d.text((300, 355), "30", font=font(190), fill=LINE, anchor="mm")
    d.ellipse([170, 245, 430, 470], outline=(190, 70, 50, 255), width=10)
    return im


def icon_teacher(font):
    im, d = canvas()
    d.rounded_rectangle([60, 60, 540, 540], 240, fill=FILL, outline=LINE, width=LW)
    person(d, 300, 330, 1.25, fill=PAPER)
    d.text((300, 500), "照片待提供", font=font(40), fill=LINE, anchor="mm")
    return im


def icon_classroom(font):
    im, d = canvas()
    d.rectangle([90, 90, 510, 330], fill=(92, 110, 90, 255), outline=LINE, width=LW)
    d.text((300, 210), "B2 教室", font=font(64), fill=PAPER, anchor="mm")
    for x in (150, 300, 450):
        d.ellipse([x - 32, 380, x + 32, 444], fill=PAPER, outline=LINE, width=10)
        d.rounded_rectangle([x - 52, 450, x + 52, 520], 26, fill=FILL, outline=LINE, width=10)
    d.ellipse([370, 20, 580, 230], fill=None, outline=(190, 70, 50, 255), width=12)
    d.text((475, 125), "免費", font=font(64), fill=(190, 70, 50, 255), anchor="mm")
    return im


MOCK_HTML = """<!doctype html><html><head><meta charset=utf-8><style>
body{margin:0;font-family:'Noto Sans TC',sans-serif;background:#efe7da;width:1280px;height:800px;overflow:hidden}
.bar{background:#3a2a1f;color:#ebc97a;padding:18px 28px;font-size:28px;font-weight:700}
.tag{position:absolute;top:16px;right:24px;background:#c0392b;color:#fff;font-size:22px;padding:6px 14px;border-radius:8px}
.wrap{display:flex;gap:24px;padding:28px}
.col{flex:1;background:#fff;border-radius:18px;padding:22px;height:600px;box-sizing:border-box}
h3{margin:0 0 14px;font-size:26px;color:#6b4a33}
.msg{background:#f5ede0;border-radius:14px;padding:16px;font-size:26px;line-height:1.5;min-height:60px;white-space:pre-wrap}
.ai{background:#fff7e0;border:2px solid #c9a15a}
.btn{margin-top:18px;display:inline-block;background:#c9a15a;color:#3a2a1f;font-size:26px;font-weight:700;padding:12px 26px;border-radius:30px;opacity:.35}
.btn.on{opacity:1}
</style></head><body>
<div class=bar>店家私訊小幫手</div><div class=tag>測試用模擬畫面</div>
<div class=wrap>
 <div class=col><h3>客人私訊</h3><div class=msg id=q></div></div>
 <div class=col><h3>AI 回覆草稿</h3><div class="msg ai" id=a></div><div class=btn id=b>確認送出</div></div>
</div>
<script>
const q="請問週六晚上 7 點還有 4 位的位子嗎？有兒童椅嗎？";
const a="您好，感謝詢問！週六 19:00 目前還有 4 位座位，也有提供兒童椅。方便留下大名與電話，我們幫您保留座位～";
function type(el,s,ms){return new Promise(r=>{let i=0;const t=setInterval(()=>{el.textContent=s.slice(0,++i);if(i>=s.length){clearInterval(t);r()}},ms)})}
(async()=>{await new Promise(r=>setTimeout(r,800));document.getElementById('q').textContent=q;
await new Promise(r=>setTimeout(r,1500));await type(document.getElementById('a'),a,70);
await new Promise(r=>setTimeout(r,700));document.getElementById('b').classList.add('on');})();
</script></body></html>"""


def demo_mock(out_dir, font_path):
    html = os.path.join(out_dir, "demo_mock.html")
    open(html, "w", encoding="utf-8").write(MOCK_HTML.replace(
        "</style>", "@font-face{font-family:'Noto Sans TC';src:url('file://%s')}</style>" % font_path))
    js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch();
  const ctx = await b.newContext({{ viewport: {{ width: 1280, height: 800 }},
    recordVideo: {{ dir: '{out_dir}/rec', size: {{ width: 1280, height: 800 }} }} }});
  const p = await ctx.newPage();
  await p.goto('file://{html}');
  await p.waitForTimeout(13000);
  const v = p.video(); await ctx.close(); await b.close();
  console.log(await v.path());
}})();"""
    path = subprocess.check_output(["node", "-e", js]).decode().strip().splitlines()[-1]
    os.replace(path, os.path.join(out_dir, "demo_mock.webm"))


def bgm(out_dir):
    # C–G–Am–F 和弦循環的柔和合成音，加慢速音量起伏
    chords = [(261.6, 329.6, 392.0), (196.0, 246.9, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 349.2)]
    parts = []
    for i, (a, b, c) in enumerate(chords * 2):
        parts.append(f"sine=f={a}:d=2[a{i}];sine=f={b}:d=2[b{i}];sine=f={c}:d=2[c{i}];"
                     f"[a{i}][b{i}][c{i}]amix=3,afade=t=in:d=0.3,afade=t=out:st=1.6:d=0.4[ch{i}]")
    n = len(chords) * 2
    graph = ";".join(parts) + ";" + "".join(f"[ch{i}]" for i in range(n)) + \
        f"concat=n={n}:v=0:a=1,tremolo=f=0.5:d=0.3,volume=0.6[out]"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                           "-filter_complex", graph, "-map", "[out]", "-ar", "48000",
                           os.path.join(out_dir, "bgm_test.wav")])


if __name__ == "__main__":
    out_dir, font_path = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)
    font = lambda s: ImageFont.truetype(font_path, s)
    for name, fn in [("handoff", icon_handoff), ("chat_x", icon_chat_x), ("clock_check", icon_clock_check),
                     ("calendar", icon_calendar), ("teacher", icon_teacher), ("classroom", icon_classroom)]:
        fn(font).save(os.path.join(out_dir, f"icon_{name}.png"))
    demo_mock(out_dir, font_path)
    bgm(out_dir)
    print("ok", sorted(os.listdir(out_dir)))
