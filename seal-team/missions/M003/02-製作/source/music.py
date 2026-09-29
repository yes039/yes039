# 配樂：100 BPM、F 大調，一小節 2.4 秒，剪輯點都落在小節線上
# 0–4.8 好奇（只有撥弦＋鐘琴）→ 4.8 貝斯進 → 12.0 拍手律動 → 21.6 高潮（弦樂＋旋律）→ 25.2 收尾
import mido
BPM = 100; TPB = 480
mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack(); mid.tracks.append(meta)
meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
notes = {}
def add(ch, st, du, n, v): notes.setdefault(ch, []).append((st, du, n, v))

CH = {'F': [53, 57, 60, 65], 'C': [48, 55, 60, 64], 'Dm': [50, 57, 62, 65], 'Bb': [46, 53, 58, 62],
      'Gm': [43, 55, 58, 62], 'Am': [45, 57, 60, 64]}
prog = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'F']   # 13 小節 = 31.2 s

for bar, c in enumerate(prog):
    b0 = bar * 4; t = CH[c]
    root = t[0] - 12 if t[0] >= 48 else t[0]
    # 撥弦（尼龍吉他）琶音
    pat = [t[0], t[2], t[1] + 12, t[2], t[3], t[2], t[1] + 12, t[2]]
    vel = 52 if bar < 2 else 62
    for i, n in enumerate(pat):
        if bar < 2 and i % 2: continue
        add(0, b0 + i * .5, .6, n, vel)
    if bar >= 2 and bar < 12:          # 貝斯
        for st in ([0, 2] if bar < 5 else [0, 1.5, 2, 3]): add(1, b0 + st, .9, root, 80)
    if bar >= 5 and bar < 12:          # 拍手、腳鼓、沙鈴
        for st in [1, 3]: add(9, b0 + st, .2, 39, 62)
        for st in [0, 2]: add(9, b0 + st, .2, 36, 70)
        for i in range(8): add(9, b0 + i * .5, .1, 70, 40 if i % 2 else 55)
    elif 2 <= bar < 5:
        for i in range(8): add(9, b0 + i * .5, .1, 70, 30 if i % 2 else 42)
    if bar >= 9 and bar < 12:          # 高潮：弦樂墊底
        for n in t[1:]: add(2, b0, 4, n + 12, 58)

# 開場「好奇」鐘琴動機（問句，停在 5 級）
for st, n in [(0.5, 77), (1, 81), (1.5, 84), (3, 79), (4.5, 77), (5, 81), (5.5, 84), (6.5, 86), (7, 84)]:
    add(3, st, .8, n, 66)
# 高潮旋律（21.6s = 第 9 小節起）
mel = [(0, 81), (1, 84), (2, 86), (3, 84), (4, 81), (5, 77), (6, 79), (8, 81), (9, 84), (10, 89), (11, 88),
       (12, 86), (13, 84), (14, 86), (16, 84)]
for st, n in mel: add(3, 36 + st, 1, n, 76)
# 片尾：主和弦
for n in [41, 53, 60, 65, 69, 72]: add(0, 48, 4, n, 64)
add(3, 48, 3, 89, 64); add(2, 48, 4, 65, 50); add(2, 48, 4, 69, 50)

chans = {0: (24, 110), 1: (33, 95), 2: (48, 70), 3: (9, 80), 9: (0, 90)}
for ch, (pg, vol) in chans.items():
    tr = mido.MidiTrack(); mid.tracks.append(tr)
    if ch != 9: tr.append(mido.Message('program_change', channel=ch, program=pg, time=0))
    tr.append(mido.Message('control_change', channel=ch, control=7, value=vol, time=0))
    tr.append(mido.Message('control_change', channel=ch, control=91, value=55, time=0))
    ev = []
    for st, du, n, v in notes.get(ch, []):
        ev.append((int(st * TPB), 1, n, v)); ev.append((int((st + du) * TPB), 0, n, 0))
    ev.sort(key=lambda e: (e[0], e[1])); last = 0
    for tk, on, n, v in ev:
        tr.append(mido.Message('note_on' if on else 'note_off', channel=ch, note=n, velocity=v, time=tk - last)); last = tk
mid.save('music.mid')
print('music.mid ok')
