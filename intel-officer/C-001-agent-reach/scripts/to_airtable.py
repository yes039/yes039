#!/usr/bin/env python3
"""把 Agent-Reach 上游工具的原始輸出轉成 Airtable「情報」表紀錄。

只做格式轉換，不連網、不需要任何 Token。產出兩種格式：
  - Airtable REST API 批次請求本文（每批最多 10 筆，POST /v0/{baseId}/{table}）
  - CSV（可直接在 Airtable 介面「匯入 CSV」，完全不需要 API 金鑰）

支援來源：
  web      Jina Reader 輸出的 Markdown（curl https://r.jina.ai/<URL>）
  youtube  yt-dlp --dump-json 的 JSON（一行一部影片）
  github   本機 git clone 目錄（git clone --depth 1 <URL>）

用法：
  python3 to_airtable.py github <clone目錄> --url https://github.com/owner/repo -o out
  python3 to_airtable.py web page.md -o out
  python3 to_airtable.py youtube video.json -o out
"""

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Airtable 欄位（與 04-Airtable紀錄.md 的表結構一致）
FIELDS = [
    "標題", "來源平台", "來源網址", "作者或頻道", "發布時間", "採集時間",
    "原文節錄", "摘要", "標籤", "採集工具", "狀態", "去重鍵",
]
EXCERPT_LIMIT = 2000  # 長文字欄位避免塞爆；全文另存檔
BATCH_SIZE = 10  # Airtable API 每次最多建立 10 筆


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def dedup_key(url):
    return hashlib.sha256(url.strip().lower().rstrip("/").encode()).hexdigest()[:16]


def clean_text(text, limit=EXCERPT_LIMIT):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)  # 圖片
    text = re.sub(r"\[\]\([^)]*\)", "", text)  # 拿掉圖片後剩下的空連結（徽章）
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:limit]


def record(title, platform, url, author, published, excerpt, tool, tags=()):
    return {
        "標題": title[:250],
        "來源平台": platform,
        "來源網址": url,
        "作者或頻道": author or "",
        "發布時間": published or "",
        "採集時間": now_iso(),
        "原文節錄": excerpt,
        "摘要": "",  # 交給 AI 情報官填寫，人工審核後才改狀態
        "標籤": list(tags),
        "採集工具": tool,
        "狀態": "待審",
        "去重鍵": dedup_key(url),
    }


def from_web(path):
    """Jina Reader 格式：Title: / URL Source: / Published Time: / Markdown Content:"""
    raw = Path(path).read_text(encoding="utf-8")
    head, _, body = raw.partition("Markdown Content:")
    meta = dict(re.findall(r"^([A-Za-z ]+):\s*(.*)$", head, flags=re.M))
    url = meta.get("URL Source", "").strip()
    if not url:
        raise ValueError(f"{path}: 找不到 'URL Source:'，不是 Jina Reader 輸出")
    return [record(
        title=meta.get("Title", url).strip(),
        platform="網站",
        url=url,
        author="",
        published=meta.get("Published Time", "").strip(),
        excerpt=clean_text(body or raw),
        tool="Agent-Reach/Jina Reader",
    )]


def from_youtube(path):
    out = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        v = json.loads(line)
        date = v.get("upload_date") or ""
        if len(date) == 8:
            date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
        url = v.get("webpage_url") or f"https://www.youtube.com/watch?v={v['id']}"
        out.append(record(
            title=v.get("title", url),
            platform="YouTube",
            url=url,
            author=v.get("channel") or v.get("uploader", ""),
            published=date,
            excerpt=clean_text(v.get("description", "")),
            tool=f"Agent-Reach/yt-dlp {v.get('_version', {}).get('version', '')}".strip(),
            tags=v.get("tags", [])[:10],
        ))
    return out


def from_github(clone_dir, url):
    def git(*args):
        return subprocess.run(
            ["git", "-C", clone_dir, *args], capture_output=True, text=True, check=True
        ).stdout.strip()

    sha, date, subject, author = git("log", "-1", "--format=%H%x00%cI%x00%s%x00%an").split("\0")
    readme = next(
        (p for p in Path(clone_dir).iterdir() if p.name.lower().startswith("readme")), None
    )
    excerpt = clean_text(readme.read_text(encoding="utf-8", errors="replace")) if readme else ""
    name = url.rstrip("/").split("github.com/")[-1]
    return [record(
        title=f"{name}（最新提交 {sha[:7]}：{subject}）",
        platform="GitHub",
        url=url,
        author=author,
        published=date,
        excerpt=excerpt,
        tool="git clone（Agent-Reach gh 路徑需登入，見實測 T3）",
    )]


def write_outputs(records, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    batches = [
        {"records": [{"fields": r} for r in records[i:i + BATCH_SIZE]], "typecast": True}
        for i in range(0, len(records), BATCH_SIZE)
    ]
    for n, b in enumerate(batches, 1):
        (out / f"airtable_batch_{n}.json").write_text(
            json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    with open(out / "airtable_import.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for r in records:
            w.writerow({**r, "標籤": ", ".join(r["標籤"])})
    return len(batches)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("source", choices=["web", "youtube", "github"])
    ap.add_argument("input")
    ap.add_argument("--url", help="github 來源必填：repo 網址")
    ap.add_argument("-o", "--out", default="out")
    a = ap.parse_args()

    if a.source == "web":
        records = from_web(a.input)
    elif a.source == "youtube":
        records = from_youtube(a.input)
    else:
        if not a.url:
            ap.error("github 來源需要 --url")
        records = from_github(a.input, a.url)

    seen, unique = set(), []
    for r in records:
        if r["去重鍵"] not in seen:
            seen.add(r["去重鍵"])
            unique.append(r)
    n = write_outputs(unique, a.out)
    print(f"{len(unique)} 筆紀錄 → {a.out}/airtable_import.csv + {n} 個 API 批次檔", file=sys.stderr)


if __name__ == "__main__":
    main()
