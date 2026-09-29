# 封面：情緒高點那一格＋上方課程名
from render import *
c = sc5(24.5)
caption(c, 24.5, S(('60+ AI 生活體驗課', YELLOW)), 96, W / 2, 250, 0, 99, pop=False, stroke=2)
c.convert('RGB').save('../封面.jpg', quality=92)
