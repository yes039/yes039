# 60+ 字幕閱讀時間檢查：每段字「可讀」的秒數 ≥ 0.4 + 字數 / 5（一般成人字幕約 6–7 字/秒，60+ 放慢到 5）
import render
FPS = 10; seen = {}
for i in range(int(render.DUR * FPS)):
    render.SEEN.clear(); render.frame(i / FPS)
    for s in render.SEEN: seen[s] = seen.get(s, 0) + 1 / FPS
bad = 0
for s, d in seen.items():
    n = len(s.replace(' ', '').replace('→', '')); need = .4 + n / 5
    ok = d >= need; bad += not ok
    print(f"{'OK ' if ok else 'NG '} {d:4.1f}s / 需 {need:4.1f}s  {s}")
print('全部通過' if not bad else f'{bad} 段不足')
