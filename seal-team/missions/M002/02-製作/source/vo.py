import sys, json, numpy as np
sys.path.insert(0, '../tts/zh')
import pypinyin
pypinyin.load_phrases_dict({'誒艾': [['èi'], ['ài']], '按著': [['àn'], ['zhe']], '沒那麼': [['méi'], ['nà'], ['me']]})
import zhtts
from scipy.io import wavfile
t = zhtts.TTS()
SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.08
def prep(ids):
    ids = np.expand_dims(np.array(ids, np.int32), 0)
    return (ids, np.array([0], np.int32), np.array([SPEED], np.float32),
            np.array([1.0], np.float32), np.array([1.0], np.float32))
t.prepare_input = prep
lines = [
  "誒艾？聽起來好難，好像跟我沒關係。",
  "其實，誒艾就像一個很有耐心的朋友。",
  "不用打字，按著說話就好。",
  "拍張照片，它也看得懂。",
  "原來，誒艾沒那麼難，我也做得到！",
  "六十加學誒艾，小班慢慢教。現在就來報名！",
]
out = {}
for i, s in enumerate(lines):
    parts = zhtts.tts.split_sens(s)
    audio = []
    for j, p in enumerate(parts):
        a = t.mel2audio(t.text2mel(p))
        audio.append(a)
        if j < len(parts) - 1:
            audio.append(np.zeros(int(0.12 * 24000), np.float32))
    a = np.concatenate(audio)
    wavfile.write(f'vo{i}.wav', 24000, a)
    out[i] = len(a) / 24000
    print(i, t.frontend(s)[1][:80], round(out[i], 2))
json.dump(out, open('vo_dur.json', 'w'))
