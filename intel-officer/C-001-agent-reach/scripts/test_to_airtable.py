"""to_airtable.py 的解析器測試。

注意：這裡的 web / youtube 輸入是「格式樣本」，只驗證欄位對應是否正確，
不是實測資料。實測結果見 ../02-讀取實測.md。
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import to_airtable as t  # noqa: E402

JINA_SAMPLE = """Title: 範例頁面
URL Source: https://example.com/a
Published Time: 2026-10-01T00:00:00Z

Markdown Content:
# 標題

內文 <b>粗體</b> ![img](x.png)
"""

YTDLP_SAMPLE = {
    "id": "abc123", "title": "範例影片", "channel": "範例頻道",
    "upload_date": "20261001", "description": "影片說明",
    "webpage_url": "https://www.youtube.com/watch?v=abc123",
    "tags": ["ai", "agent"], "_version": {"version": "2026.07.04"},
}


def test_web(tmp_path):
    p = tmp_path / "page.md"
    p.write_text(JINA_SAMPLE, encoding="utf-8")
    [r] = t.from_web(p)
    assert r["來源網址"] == "https://example.com/a"
    assert r["標題"] == "範例頁面"
    assert r["發布時間"] == "2026-10-01T00:00:00Z"
    assert "<b>" not in r["原文節錄"] and "img" not in r["原文節錄"]
    assert r["狀態"] == "待審"


def test_youtube(tmp_path):
    p = tmp_path / "v.json"
    p.write_text(json.dumps(YTDLP_SAMPLE, ensure_ascii=False), encoding="utf-8")
    [r] = t.from_youtube(p)
    assert r["發布時間"] == "2026-10-01"
    assert r["作者或頻道"] == "範例頻道"
    assert r["標籤"] == ["ai", "agent"]
    assert r["採集工具"].endswith("2026.07.04")


def test_github(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "README.md").write_text("# Demo\n\nhello", encoding="utf-8")
    g = ["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"]
    subprocess.run(g[:3] + ["init", "-q"], check=True)
    subprocess.run(g + ["add", "."], check=True)
    subprocess.run(g + ["commit", "-qm", "init"], check=True)
    [r] = t.from_github(str(repo), "https://github.com/o/demo")
    assert r["來源平台"] == "GitHub" and "o/demo" in r["標題"] and "hello" in r["原文節錄"]


def test_batches_and_dedup_key(tmp_path):
    recs = [t.record(f"t{i}", "網站", f"https://e.com/{i}", "", "", "", "x") for i in range(23)]
    assert t.write_outputs(recs, tmp_path) == 3  # 10 + 10 + 3
    b1 = json.loads((tmp_path / "airtable_batch_1.json").read_text(encoding="utf-8"))
    assert len(b1["records"]) == 10 and b1["typecast"] is True
    assert t.dedup_key("https://E.com/a/") == t.dedup_key("https://e.com/a")
