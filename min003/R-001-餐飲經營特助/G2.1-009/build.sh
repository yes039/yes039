#!/usr/bin/env bash
# 把 app.html（Artifact 格式，無 <html> 外殼）包成可直接用瀏覽器開啟的 index.html
set -e
cd "$(dirname "$0")"
{
  echo '<!doctype html>'
  echo '<html lang="zh-Hant"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>'
  echo '</head><body>'
  cat app.html
  echo '</body></html>'
} > index.html
echo "built index.html"
