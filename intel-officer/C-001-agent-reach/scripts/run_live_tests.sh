#!/usr/bin/env bash
# C-001 讀取實測重跑腳本：公開網站、YouTube、GitHub。
# 原則：不帶任何帳號憑證、不做系統安裝、不寫入真實 HOME。
# 所有東西都裝在 ./.c001-sandbox/ 裡，刪掉該資料夾即完全移除。
#
# 需要能連線的主機：github.com、raw.githubusercontent.com、r.jina.ai、
#                   www.youtube.com（含 *.googlevideo.com）、pypi.org
#
# 用法：bash run_live_tests.sh [網頁URL] [YouTube URL] [GitHub repo URL]
set -uo pipefail

WEB_URL="${1:-https://www.python.org/about/}"
YT_URL="${2:-https://www.youtube.com/watch?v=jNQXAC9IVRw}"
GH_URL="${3:-https://github.com/yt-dlp/yt-dlp}"
# 鎖定本次審查過的版本，不跟隨 main 分支
AR_COMMIT="94f06c1969dfc1834001269d79d3ad0972d9dee6"

HERE="$(cd "$(dirname "$0")" && pwd)"
SB="$PWD/.c001-sandbox"
OUT="$SB/out"
mkdir -p "$SB/home" "$OUT"

# 隔離：假 HOME、拿掉 GitHub Token，避免誤用正式帳號
RUN=(env -u GH_TOKEN -u GITHUB_TOKEN HOME="$SB/home" GH_TELEMETRY=false)

if [ ! -x "$SB/venv/bin/agent-reach" ]; then
  python3 -m venv "$SB/venv"
  "$SB/venv/bin/pip" install -q \
    "git+https://github.com/Panniantong/Agent-Reach.git@$AR_COMMIT" \
    || { echo "Agent-Reach 安裝失敗"; exit 1; }
fi
export PATH="$SB/venv/bin:$PATH"

echo "== Agent-Reach doctor（唯讀，不安裝） =="
"${RUN[@]}" agent-reach doctor || true

echo; echo "== T1 公開網站：Jina Reader =="
"${RUN[@]}" curl -sS -m 60 -o "$OUT/web.md" -w "HTTP %{http_code} %{size_download}B %{time_total}s\n" \
  "https://r.jina.ai/$WEB_URL" && head -5 "$OUT/web.md"

echo; echo "== T2 YouTube：yt-dlp 中繼資料 + 字幕 =="
"${RUN[@]}" yt-dlp --skip-download --dump-json "$YT_URL" > "$OUT/youtube.json" \
  && python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['title'],'|',d.get('channel'),'|',d.get('upload_date'))" "$OUT/youtube.json"
"${RUN[@]}" yt-dlp --skip-download --write-sub --write-auto-sub --sub-lang "zh-Hant,zh-Hans,zh,en" \
  -o "$OUT/sub_%(id)s" "$YT_URL" >/dev/null 2>&1; ls "$OUT"/sub_* 2>/dev/null || echo "（無字幕檔）"

echo; echo "== T3 GitHub：gh（未登入）與 git clone =="
"${RUN[@]}" gh repo view "${GH_URL#https://github.com/}" --json name,description,stargazerCount \
  || echo "→ gh 未登入無法讀取（預期結果，見 02-讀取實測.md）"
rm -rf "$OUT/repo" && "${RUN[@]}" git clone -q --depth 1 "$GH_URL" "$OUT/repo" && echo "git clone OK"

echo; echo "== T4 轉成 Airtable 紀錄（不連 Airtable） =="
[ -s "$OUT/web.md" ] && python3 "$HERE/to_airtable.py" web "$OUT/web.md" -o "$OUT/at_web"
[ -s "$OUT/youtube.json" ] && python3 "$HERE/to_airtable.py" youtube "$OUT/youtube.json" -o "$OUT/at_youtube"
[ -d "$OUT/repo" ] && python3 "$HERE/to_airtable.py" github "$OUT/repo" --url "$GH_URL" -o "$OUT/at_github"
echo "完成。CSV 可直接匯入 Airtable：$OUT/at_*/airtable_import.csv"
