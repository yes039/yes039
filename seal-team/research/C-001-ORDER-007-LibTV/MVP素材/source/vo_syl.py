import sys, numpy as np, wave, zhtts
t = zhtts.TTS()
def prep(ids):
    ids = np.expand_dims(np.array(ids, np.int32), 0)
    return (ids, np.array([0], np.int32), np.array([1.0], np.float32),
            np.array([1.0], np.float32), np.array([1.0], np.float32))
t.prepare_input = prep
chars = "天天忙到半夜月底錢咧"
for i, c in enumerate(chars):
    a = t.mel2audio(t.text2mel(c))
    a = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    with wave.open(f"syl/{i:02d}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(a.tobytes())
    print(i, c, t.frontend(c)[1][:30], len(a)/24000)
