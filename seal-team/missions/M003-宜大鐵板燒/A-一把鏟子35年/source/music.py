"""A 版配樂：F 大調，鋼琴＋弦樂墊底。時間以秒為單位（60 BPM，1 拍＝1 秒），對齊 render.py 的時間軸。
輸出 music.mid，再用 FluidSynth 渲染：
  fluidsynth -ni -g 0.6 -r 44100 -F music_raw.wav /usr/share/sounds/sf2/FluidR3_GM.sf2 music.mid
"""
import sys
import mido

TPB = 480
N = {}
for o in range(1, 7):
    for name, semi in zip(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'], range(12)):
        N[f'{name}{o}'] = 12 * (o + 1) + semi

events = []  # (time_sec, msg)
def note(ch, t, dur, pitches, vel):
    for p in pitches if isinstance(pitches, (list, tuple)) else [pitches]:
        events.append((t, mido.Message('note_on', channel=ch, note=N[p], velocity=vel)))
        events.append((t + dur, mido.Message('note_off', channel=ch, note=N[p], velocity=0)))

PIANO, STR = 0, 1
F = ['F3', 'A3', 'C4']; Dm = ['D3', 'F3', 'A3']; Bb = ['Bb2', 'D3', 'F3']; C = ['C3', 'E3', 'G3']; Am = ['A2', 'C3', 'E3']

# S1 0–3.5：這面牆上，掛著 35 年
note(STR, 0.2, 3.4, F, 42)
note(PIANO, 0.3, 3.0, 'F2', 48)
note(PIANO, 0.6, 1.2, 'A4', 50)
note(PIANO, 1.6, 2.0, 'F4', 46)

# S2 3.5–10.5：鏡頭停在每一把鏟子時落一個音，一路往上
T_S2, STEP = 3.5, 7.0 / 9
rise = ['C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5']
for i, p in enumerate(rise):
    note(PIANO, T_S2 + (i + 0.62) * STEP, 1.4, p, 46 + i * 2)
note(STR, 3.5, 2.35, Dm, 40)
note(STR, 5.85, 2.3, Bb, 42)
note(STR, 8.15, 2.35, C, 44)

# S3 10.5–13.5：拉開看整面牆，回到主和弦
note(PIANO, 10.5, 3.0, ['F2', 'C3', 'A3'], 50)
note(PIANO, 10.5, 2.8, 'A5', 44)
note(STR, 10.5, 3.0, F, 46)

# S4 13.5–20.6：現場聲為主，只留很淡的弦樂
note(STR, 13.5, 3.5, Dm, 30)
note(STR, 17.0, 3.6, Bb, 30)

# S5 20.6–26.1：鋼琴回來
note(STR, 20.6, 1.4, Bb, 36); note(PIANO, 20.6, 1.4, 'Bb2', 42)
note(STR, 22.0, 1.4, C, 36);  note(PIANO, 22.0, 1.4, 'C3', 42)
note(STR, 23.4, 1.4, Am, 36); note(PIANO, 23.4, 1.4, 'A2', 42)
note(STR, 24.8, 1.3, Dm, 38); note(PIANO, 24.8, 1.3, 'D3', 42)
for t, p in [(20.6, 'D5'), (21.3, 'C5'), (22.0, 'E5'), (22.7, 'D5'), (23.4, 'C5'), (24.1, 'A4'), (24.8, 'A4'), (25.45, 'C5')]:
    note(PIANO, t, 0.9, p, 44)

# S6 26.1–29.6：老吃老想
note(STR, 26.1, 1.75, Bb, 42); note(PIANO, 26.1, 1.75, ['Bb2', 'F3'], 44)
note(STR, 27.85, 1.75, C, 44);  note(PIANO, 27.85, 1.75, ['C3', 'G3'], 44)
for t, p in [(26.1, 'D5'), (26.8, 'F5'), (27.85, 'E5'), (28.7, 'G5')]:
    note(PIANO, t, 1.0, p, 44)

# S7 29.6–34.6：店門口，收在 F
note(STR, 29.6, 5.0, F, 44)
note(PIANO, 29.6, 5.0, ['F2', 'C3', 'A3'], 48)
note(PIANO, 29.6, 1.3, 'A5', 46)
note(PIANO, 30.9, 3.7, 'F5', 42)

def build(path):
    mid = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=1_000_000))
    tr.append(mido.Message('program_change', channel=PIANO, program=0))
    tr.append(mido.Message('program_change', channel=STR, program=49))
    tr.append(mido.Message('control_change', channel=PIANO, control=64, value=0))
    tr.append(mido.Message('control_change', channel=PIANO, control=91, value=70))  # reverb
    tr.append(mido.Message('control_change', channel=STR, control=91, value=80))
    tr.append(mido.Message('control_change', channel=STR, control=7, value=70))
    now = 0
    for t, m in sorted(events, key=lambda e: (e[0], e[1].type == 'note_on')):
        tick = int(round(t * TPB))
        tr.append(m.copy(time=tick - now)); now = tick
    mid.save(path)

build(sys.argv[1] if len(sys.argv) > 1 else 'music.mid')
