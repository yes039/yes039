#!/usr/bin/env bash
# MPT-001 場景 B 實測：一鍵執行（隔離安裝 → 防護 → 配樂 → 出片 → 驗片）
# 用法：bash run_mpt001.sh <工作資料夾>  [--until-subtitle]
#   工作資料夾必須在 repo 之外（建議用工作階段暫存區）。
#   --until-subtitle：只跑到字幕階段，不需要 Pexels key、不連 Pexels（預演用）。
# 需要：環境變數 MPT_PEXELS_API_KEY（只在完整執行時需要；本腳本不會印出它）。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="${1:?需要工作資料夾}"; MODE="${2:-full}"
MPT_COMMIT=bd6939b61292d2acf435e0c8bd442470843a2781
TASK_ID=00000000-0000-4000-8000-0000000000b1
mkdir -p "$T"; LOG="$T/timings.txt"; : > "$LOG"
stamp(){ echo "$(date -u +%FT%TZ) $1" | tee -a "$LOG"; }

stamp "start mode=$MODE"
if [ "$MODE" != "--until-subtitle" ]; then
  [ -n "${MPT_PEXELS_API_KEY:-}" ] || { echo "缺少 MPT_PEXELS_API_KEY，停止"; exit 3; }
  code=$(curl -sS -o /dev/null -m 20 -w '%{http_code}' -H "Authorization: $MPT_PEXELS_API_KEY" \
    'https://api.pexels.com/v1/videos/search?query=cafe&per_page=1&orientation=portrait' || true)
  stamp "pexels preflight http=$code"
  [ "$code" = 200 ] || { echo "Pexels 無法連線或 key 無效（http=$code），停止"; exit 4; }
fi

# 1. 隔離安裝（全部放在 $T）
stamp "install begin"
pip install -q --no-cache-dir --target "$T/uvpkg" uv
[ -d "$T/mpt" ] || git clone -q https://github.com/harry0703/MoneyPrinterTurbo.git "$T/mpt"
git -C "$T/mpt" checkout -q "$MPT_COMMIT"
export UV_CACHE_DIR="$T/uv-cache" UV_PYTHON_INSTALL_DIR="$T/uv-python" UV_PROJECT_ENVIRONMENT="$T/venv"
(cd "$T/mpt" && "$T/uvpkg/bin/uv" sync -q --frozen --no-dev --python 3.11)
stamp "install end"

# 2. 防護：移除授權不明的內建配樂與字型；設定檔只放 Pexels key
cd "$T/mpt"
rm -rf resource/songs && mkdir resource/songs
rm -f resource/fonts/MicrosoftYaHei*.ttc resource/fonts/STHeiti*.ttc "resource/fonts/UTM Kabel KT.ttf"
cp /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc resource/fonts/
cp config.example.toml config.toml
if [ "$MODE" != "--until-subtitle" ]; then
  "$T/venv/bin/python" - <<'PY'
import os, re
p = "config.toml"; s = open(p, encoding="utf-8").read()
s, n = re.subn(r"^pexels_api_keys = \[\]", 'pexels_api_keys = ["%s"]' % os.environ["MPT_PEXELS_API_KEY"], s, flags=re.M)
assert n == 1, "pexels_api_keys line not found"
open(p, "w", encoding="utf-8").write(s)
PY
fi
grep -q '^upload_post_enabled = false' config.toml && grep -q '^upload_post_api_key = ""' config.toml
stamp "safeguards done"

# 3. 原創配樂
mkdir -p storage/bgm
python3 -I "$HERE/bgm.py" "$T/bgm.wav" 34 >/dev/null
ffmpeg -v error -y -i "$T/bgm.wav" -c:a libmp3lame -b:a 192k storage/bgm/mpt001-original-bgm.mp3
stamp "bgm done"

# 4. 出片
mapfile -t A < <(sed 's/^\(--[a-z-]*\) \(.*\)$/\1\n\2/' "$HERE/run_args.txt")
STOP=video; [ "$MODE" = "--until-subtitle" ] && STOP=subtitle
stamp "mpt begin stop_at=$STOP"
"$T/venv/bin/python" cli.py "${A[@]}" --video-script "$(cat "$HERE/script.txt")" \
  --task-id "$TASK_ID" --stop-at "$STOP" > "$T/mpt_run.log" 2>&1 || { stamp "mpt FAILED"; tail -20 "$T/mpt_run.log"; exit 1; }
stamp "mpt end"
TD="storage/tasks/$TASK_ID"
[ "$STOP" = video ] || { ls "$TD"; exit 0; }

# 5. 驗片
V="$TD/final-1.mp4"; cp "$V" "$T/MPT-001-小店老闆用AI-30s-9x16.mp4"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate -of compact "$V" | tee "$T/probe.txt"
ffmpeg -hide_banner -i "$V" -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input (Integrated|True Peak)" | tee -a "$T/probe.txt"
mkdir -p "$T/frames"
for i in 0 1 2 3 4 5 6 7 8 9; do ffmpeg -v error -y -ss "$(python3 -c "print(1.4+$i*2.9)")" -i "$V" -frames:v 1 -vf scale=270:480 "$T/frames/f$i.jpg"; done
ffmpeg -v error -y -i "$T/frames/f%d.jpg" -vf tile=5x2 -frames:v 1 "$T/contact_sheet.jpg"
cp "$TD"/*.json "$T/" 2>/dev/null || true
stamp "verify done"
