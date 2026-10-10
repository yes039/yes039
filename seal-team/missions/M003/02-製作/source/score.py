# 68 秒佛曲風配樂（MIDI）：古箏、尺八、弦樂、暖音墊、大提琴、木魚、管鐘。
# 60 BPM → 1 拍 = 1 秒，段落對齊影片鏡頭切點。
# 用法：python3 score.py score.mid && fluidsynth -ni -g 0.6 -r 48000 -F raw.wav /usr/share/sounds/sf2/FluidR3_GM.sf2 score.mid
import sys, mido

TPB = 480
mid = mido.MidiFile(ticks_per_beat=TPB)
events = []  # (秒, 訊息)

def note(ch, t, dur, n, vel):
    events.append((t, mido.Message("note_on", channel=ch, note=n, velocity=vel)))
    events.append((t + dur, mido.Message("note_off", channel=ch, note=n, velocity=0)))

def cc(ch, t, ctl, val):
    events.append((t, mido.Message("control_change", channel=ch, control=ctl, value=int(val))))

def ramp(ch, t0, t1, v0, v1, ctl=11, steps=24):
    for i in range(steps + 1):
        cc(ch, t0 + (t1 - t0) * i / steps, ctl, v0 + (v1 - v0) * i / steps)

KOTO, STR, PAD, SHAKU, BELL, CELLO, GLOCK, DRUM = 0, 1, 2, 3, 4, 5, 6, 9
for ch, prog, vol, pan in [(KOTO, 107, 112, 54), (STR, 48, 82, 72), (PAD, 89, 70, 64), (SHAKU, 77, 100, 60),
                           (BELL, 14, 92, 64), (CELLO, 42, 78, 58), (GLOCK, 9, 58, 76)]:
    events.append((0, mido.Message("program_change", channel=ch, program=prog)))
    cc(ch, 0, 7, vol); cc(ch, 0, 10, pan); cc(ch, 0, 91, 110); cc(ch, 0, 93, 30)
cc(DRUM, 0, 7, 70); cc(DRUM, 0, 91, 70)

D, Bm, G, Em, Asus = "D", "Bm", "G", "Em", "Asus"
CH = {  # 和弦：(低音, 墊底音, 古箏分解音)
    D:    (50, [62, 66, 69], [62, 69, 74, 76, 78, 74, 69, 66]),
    Bm:   (47, [59, 62, 66], [59, 66, 71, 74, 76, 74, 71, 66]),
    G:    (43, [59, 62, 67], [55, 62, 67, 71, 74, 71, 69, 62]),
    Em:   (40, [59, 64, 67], [52, 59, 64, 67, 71, 67, 64, 59]),
    Asus: (45, [62, 64, 69], [57, 64, 69, 71, 74, 71, 69, 64]),
}
PROG = [(0, 7, D), (7, 3, Bm), (10, 3, G), (13, 3, D), (16, 3, Asus), (19, 3, Bm), (22, 3, G),
        (25, 3.5, Em), (28.5, 3.5, Asus), (32, 4, D), (36, 4, Bm), (40, 3.5, G), (43.5, 3.5, Asus),
        (47, 2.5, D), (49.5, 2.5, Bm), (52, 2.5, G), (54.5, 2.5, Asus), (57, 3, Bm), (60, 1.25, G),
        (61.25, 1.25, Asus), (62.5, 5.5, D)]

for t0, dur, c in PROG:
    bass, padn, arp = CH[c]
    # 墊底與弦樂：長音
    for n in padn:
        note(PAD, t0, dur + 0.15, n, 60)
        if t0 >= 7:
            note(STR, t0, dur + 0.1, n + (12 if t0 >= 47 else 0), 62 if t0 < 47 else 70)
    if t0 >= 7:
        note(CELLO, t0, dur, bass - 12 if bass > 45 else bass, 72)
    # 古箏：開場稀疏（每拍一音），中段每半拍，花供養段之後偶爾加 16 分音裝飾
    if t0 < 7:
        for i, tt in enumerate([1.0, 2.0, 3.0, 4.5, 5.0, 5.5]):
            note(KOTO, tt, 2.5, arp[[0, 1, 2, 4, 3, 2][i]], 70 + i * 4)
    else:
        step = 0.5 if 13 <= t0 < 62.5 else 1.0
        k, tt = 0, t0
        while tt < t0 + dur - 1e-6:
            vel = 78 if k % 4 == 0 else 62
            note(KOTO, tt, 1.6, arp[k % len(arp)], vel)
            if t0 >= 47 and k % 4 == 3 and tt + 0.25 < t0 + dur:
                note(KOTO, tt + 0.25, 1.2, arp[(k + 1) % len(arp)] + 12, 50)
            k += 1; tt += step

# 尺八旋律（原創，五聲音階）
MEL = [
    (13, 2, 69), (15, 1, 71), (16, 1, 69), (17, 2, 66), (19, 1, 64), (20, 1, 66), (21, 2, 69), (23, 2, 74),
    (25.5, 1.5, 71), (27, 1, 69), (28, 0.5, 66), (28.5, 2.5, 64),
    (32, 2, 74), (34, 1, 71), (35, 1, 69), (36, 2, 66), (38, 1.5, 69), (39.5, 0.5, 71), (40, 2, 74),
    (42, 1, 76), (43, 0.5, 74), (43.5, 1.5, 71), (45, 2, 69),
    (52, 1, 74), (53, 1, 76), (54, 0.5, 78), (54.5, 2, 76),
    (57, 1.5, 78), (58.5, 0.5, 76), (59, 1, 74), (60, 1, 71), (61, 0.75, 69), (61.75, 0.75, 71), (62.5, 5, 74),
]
for t, d, n in MEL:
    note(SHAKU, t, d * 0.97, n, 84)
cc(SHAKU, 0, 11, 100)
ramp(SHAKU, 62.5, 67.5, 100, 40)

# 木魚：大雄寶殿段每拍，緣起段每兩拍，漸弱
for i in range(7):
    note(DRUM, 25 + i, 0.2, 77, 70 + (i % 2) * 8)
for i in range(4):
    note(DRUM, 32 + 2 * i, 0.2, 77, 56 - i * 6)

# 引磬（管鐘）：開場、緣起、片尾
for t, ns, v in [(0.1, [74], 96), (32, [74, 62], 100), (62.5, [69, 74], 104)]:
    for n in ns:
        note(BELL, t, 4.5, n, v)
# 鐘琴點綴：花供養、身心清淨
for t, n in [(47, 86), (47.5, 90), (48, 93), (52, 86), (52.5, 88), (53, 90)]:
    note(GLOCK, t, 1.5, n, 60)

# 整體表情：開頭淡入，片尾漸弱
for ch in (PAD, STR, CELLO, KOTO):
    ramp(ch, 0, 3, 40, 110)
    ramp(ch, 64, 68, 110, 0)
ramp(STR, 47, 57, 110, 122)

# 輸出（加一個時間差的單一 track）
events.sort(key=lambda e: (e[0], e[1].type == "note_on"))
tr = mido.MidiTrack(); mid.tracks.append(tr)
tr.append(mido.MetaMessage("set_tempo", tempo=1_000_000, time=0))
last = 0
for t, msg in events:
    tick = round(t * TPB)
    tr.append(msg.copy(time=tick - last)); last = tick
tr.append(mido.MetaMessage("end_of_track", time=TPB * 4))
mid.save(sys.argv[1] if len(sys.argv) > 1 else "score.mid")
