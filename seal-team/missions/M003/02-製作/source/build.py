#!/usr/bin/env python3
"""宜大鐵板燒 21 秒 9:16 宣傳片：一鍵產出。
用法：python3 build.py   （在本資料夾執行，需要 ffmpeg、numpy、Pillow）
"""
import os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '../../00-素材'))
OUT = os.path.normpath(os.path.join(HERE, '..'))
TMP = os.path.join(HERE, 'tmp')
os.makedirs(TMP, exist_ok=True)
W, H, FPS = 1080, 1920, 30
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
BPM = 120  # 每拍 0.5 秒，所有切點落在拍點上

# (類型, 檔名, 起點秒, 長度秒, 大字, 小字)
SHOTS = [
    ('v', '813081980.331421.mp4', 0.2, 2.0, '這個聲音', '響了 35 年'),
    ('p', 'S__2015262_0.jpg',     0,   2.0, '創店 1991', '鏟子掛滿一整面牆'),
    ('v', '813081979.197960.mp4', 0.8, 2.0, '大火現炒', ''),
    ('v', '813070630.558495.mp4', 2.0, 2.0, '雞肉・蛋', '鐵板上現點現煎'),
    ('v', '813070630.183335.mp4', 0.3, 2.5, '撒上蒜酥', '直接上桌'),
    ('p', 'S__94625886_0.jpg',    0,   1.5, '外酥內嫩', '鐵板豆腐'),
    ('v', '813081980.073952.mp4', 0.3, 2.0, '熱騰騰', '一手接過來'),
    ('p', 'S__2015249_0.jpg',     0,   1.5, '荷包蛋淋醬', '配一碗白飯'),
    ('p', 'S__94625897_0.jpg',    0,   1.5, '圍著鐵板', '坐成一排'),
    ('end', 'S__2015260_0.jpg',   0,   4.0, '', ''),
]

def run(cmd):
    subprocess.run(cmd, check=True)

def font(sz):
    return ImageFont.truetype(FONT, sz)

def text_layer(big, small, path):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if big:
        f = font(132)
        w = d.textlength(big, font=f)
        d.text(((W - w) / 2, 1330), big, font=f, fill='white',
               stroke_width=10, stroke_fill=(20, 10, 5))
    if small:
        f = font(68)
        w = d.textlength(small, font=f)
        pad = 26
        x0, y0 = (W - w) / 2 - pad, 1500
        d.rounded_rectangle([x0, y0, x0 + w + 2 * pad, y0 + 100], 18, fill=(214, 64, 28, 235))
        d.text(((W - w) / 2, y0 + 14), small, font=f, fill='white')
    im.save(path)

def end_layer(path):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    grad = Image.new('L', (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(max(0, (y - 900) / 1020) * 230))
    shade = Image.new('RGBA', (W, H), (10, 6, 4, 255))
    shade.putalpha(grad.resize((W, H)))
    im = Image.alpha_composite(im, shade)
    d = ImageDraw.Draw(im)
    def ctr(t, y, sz, fill, stroke=0):
        f = font(sz); w = d.textlength(t, font=f)
        d.text(((W - w) / 2, y), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))
    ctr('宜大鐵板燒', 1180, 170, 'white', 8)
    ctr('TEPPANYAKI  ·  SINCE 1991', 1380, 50, (240, 200, 150))
    d.line([(300, 1470), (780, 1470)], fill=(214, 64, 28), width=6)
    ctr('35 年老滋老味', 1510, 84, 'white', 4)
    f = font(70); t = '今晚，來坐鐵板前'; w = d.textlength(t, font=f)
    x0 = (W - w) / 2 - 40
    d.rounded_rectangle([x0, 1660, x0 + w + 80, 1780], 60, fill=(214, 64, 28))
    d.text(((W - w) / 2, 1683), t, font=f, fill='white')
    ctr('宜蘭市聖後街 88 號・03-935-4787', 1810, 46, (235, 225, 210))
    im.save(path)

LOOK = 'eq=saturation=1.18:contrast=1.06:brightness=0.01,colorbalance=rm=0.04:bm=-0.04'

def render_shot(i, s):
    kind, name, t0, dur, big, small = s
    src = os.path.join(SRC, name)
    ov = os.path.join(TMP, f'ov{i}.png')
    end_layer(ov) if kind == 'end' else text_layer(big, small, ov)
    out = os.path.join(TMP, f's{i}.mp4')
    n = int(round(dur * FPS))
    if kind == 'v':
        vf = (f'[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},'
              f'fps={FPS},{LOOK}[b];[b][1:v]overlay=0:0,format=yuv420p[v]')
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t0), '-t', str(dur), '-i', src, '-i', ov,
             '-filter_complex', vf, '-map', '[v]', '-map', '0:a', '-frames:v', str(n),
             '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-c:a', 'aac', '-ar', '48000', '-ac', '2',
             '-af', f'apad,atrim=0:{dur}', out])
    else:
        # 照片：先裁成 9:16，再用緩慢推近（Ken Burns）讓靜態畫面活起來
        z = '1+0.10*on/%d' % n if kind != 'end' else '1.12-0.10*on/%d' % n
        vf = (f'[0:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},'
              f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS},"
              f'{LOOK}[b];[b][1:v]overlay=0:0,format=yuv420p[v]')
        run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-i', src, '-i', ov,
             '-f', 'lavfi', '-t', str(dur), '-i', 'anullsrc=r=48000:cl=stereo',
             '-filter_complex', vf, '-map', '[v]', '-map', '2:a', '-frames:v', str(n),
             '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-c:a', 'aac', out])
    return out

def sizzle_bed(total):
    """現場聲當底：照片段落也要有鐵板的滋滋聲，從炒高麗菜那支影片取 3 秒循環。"""
    out = os.path.join(TMP, 'bed.wav')
    run(['ffmpeg', '-y', '-v', 'error', '-ss', '3', '-t', '3', '-i', os.path.join(SRC, '813081979.197960.mp4'),
         '-af', 'aloop=loop=-1:size=144000,atrim=0:%s,highpass=f=1500,volume=0.5' % total,
         '-ar', '48000', '-ac', '2', out])
    return out

def music(total):
    """程式合成的 120 BPM 輕快節拍：大鼓、拍手、沙鈴、貝斯、撥弦和弦。"""
    sr = 48000; n = int(total * sr); t = np.arange(n) / sr
    mix = np.zeros(n); beat = 60 / BPM
    rng = np.random.default_rng(7)
    def add(sig, at):
        i = int(at * sr); j = min(n, i + len(sig))
        if i < n: mix[i:j] += sig[:j - i]
    def env(L, a, d):
        e = np.exp(-np.arange(L) / (d * sr)); e[:int(a * sr)] *= np.linspace(0, 1, int(a * sr)); return e
    L = int(0.35 * sr); tt = np.arange(L) / sr
    kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-tt * 30)) * tt) * env(L, 0.002, 0.12)
    clap = rng.standard_normal(int(0.2 * sr)) * env(int(0.2 * sr), 0.001, 0.05)
    hat = np.diff(rng.standard_normal(int(0.05 * sr) + 1)) * env(int(0.05 * sr), 0.0005, 0.012)
    def pluck(f, d=0.4, v=0.25):
        L = int(d * sr); x = np.arange(L) / sr
        return v * (np.sin(2*np.pi*f*x) + 0.4*np.sin(4*np.pi*f*x) + 0.15*np.sin(6*np.pi*f*x)) * env(L, 0.003, d / 4)
    # 和弦進行 Am - F - C - G（每兩拍... 每小節一個）
    prog = [(220.0, [220, 261.6, 329.6]), (174.6, [174.6, 220, 261.6]),
            (130.8, [196, 261.6, 329.6]), (196.0, [196, 246.9, 293.7])]
    bars = int(total / (4 * beat)) + 1
    for b in range(bars):
        root, chord = prog[b % 4]
        for k in range(8):
            at = (b * 4 + k / 2) * beat
            if at >= total - 4.0 + 0.01 and at < total - 3.99: pass
            if k % 2 == 0: add(kick * 0.9, at)
            if k in (2, 6): add(clap * 0.35, at)
            add(hat * (0.25 if k % 2 else 0.12), at + (0.25 * beat if k % 2 == 0 else 0))
            if k in (0, 3, 4, 6): add(pluck(root / 2, 0.45, 0.35), at)
            if k in (1, 5, 7):
                for f in chord: add(pluck(f * 2, 0.3, 0.07), at)
    # 結尾片卡：一記重拍＋停頓，最後和弦延音
    end_at = total - 4.0
    add(kick * 1.2, end_at)
    for f in [220, 261.6, 329.6, 440]: add(pluck(f, 3.5, 0.12), end_at)
    fade = np.ones(n); fade[-int(0.8 * sr):] = np.linspace(1, 0, int(0.8 * sr))
    mix = np.tanh(mix * 1.3) * fade * 0.6
    out = os.path.join(TMP, 'music.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        st = (np.repeat(mix[:, None], 2, 1) * 32767).astype('<i2')
        w.writeframes(st.tobytes())
    return out

def main():
    parts = [render_shot(i, s) for i, s in enumerate(SHOTS)]
    total = sum(s[3] for s in SHOTS)
    lst = os.path.join(TMP, 'list.txt')
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    cat = os.path.join(TMP, 'cat.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', cat])
    bed, mus = sizzle_bed(total), music(total)
    final = os.path.join(OUT, '宜大鐵板燒-宣傳-21s-9x16.mp4')
    af = ('[0:a]volume=1.0[live];[1:a]volume=0.6[bed];[2:a]volume=0.55[mus];'
          '[live][bed][mus]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]')
    run(['ffmpeg', '-y', '-v', 'error', '-i', cat, '-i', bed, '-i', mus, '-filter_complex', af,
         '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
         '-movflags', '+faststart', '-t', str(total), final])
    run(['ffmpeg', '-y', '-v', 'error', '-ss', '2.6', '-i', final, '-frames:v', '1', '-q:v', '2',
         os.path.join(OUT, '封面.jpg')])
    print(final)

if __name__ == '__main__':
    main()
