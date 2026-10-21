"""OPC-P001 測試腳本：同一個 case 丟給 Claude 與 Gemini，記錄輸出、tokens、延遲、成本。

用法：python3 run_test.py cases/<case>.json [--runs 2] [--models opus,g38flash]
需要：pip install anthropic google-genai；環境變數 ANTHROPIC_API_KEY（或 ant auth login）、GEMINI_API_KEY。
影片 case 會用 ffmpeg 抽格給 Claude（Claude 不能直接讀影片）。

刻意不開 Claude 的 server-side fallback：測試要知道到底是哪個模型回答的，
遇到 refusal 就照實記錄，不自動換模型。
"""
import argparse
import base64
import csv
import json
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

USD_TO_TWD = 32.0

# 每百萬 tokens 的美元價格（input, output）。Gemini 是第三方整理的推廣價，正式用前核對官方。
MODELS = {
    "opus": {"provider": "claude", "id": "claude-opus-5-5", "price": (4.00, 20.00)},
    "sonnet": {"provider": "claude", "id": "claude-sonnet-5-5", "price": (2.00, 10.00)},
    "g38flash": {"provider": "gemini", "id": "gemini-3.8-flash", "price": (0.75, 3.75)},
    "argon": {"provider": "gemini", "id": "gemini-4-argon", "price": (2.00, 10.00)},
}

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]


def cost_twd(price, in_tok, out_tok):
    return (in_tok * price[0] + out_tok * price[1]) / 1e6 * USD_TO_TWD


def extract_frames(video, every_sec, out_dir):
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(video), "-vf", f"fps=1/{every_sec}",
         "-q:v", "3", str(Path(out_dir) / "f%02d.jpg")],
        check=True,
    )
    return sorted(Path(out_dir).glob("f*.jpg"))


def run_claude(model_id, case, frames):
    import anthropic

    client = anthropic.Anthropic()
    content = []
    for i, f in enumerate(frames):
        content.append({"type": "text", "text": f"畫面 {i + 1}（約第 {i * case.get('frame_every_sec', 5)} 秒）"})
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg",
            "data": base64.b64encode(f.read_bytes()).decode()}})
    content.append({"type": "text", "text": case["user"]})

    resp = client.messages.create(
        model=model_id,
        max_tokens=16000,
        system=case["system"],
        output_config={"effort": case.get("claude_effort", "medium")},
        messages=[{"role": "user", "content": content}],
    )
    if resp.stop_reason == "refusal":
        text = f"[REFUSAL] {resp.stop_details}"
    else:
        text = "".join(b.text for b in resp.content if b.type == "text")
    # Claude 的思考 tokens 已含在 output_tokens 內
    return text, resp.usage.input_tokens, resp.usage.output_tokens, 0


def run_gemini(model_id, case, video):
    from google import genai
    from google.genai import types

    client = genai.Client()
    contents = []
    if video:
        f = client.files.upload(file=str(video))
        while f.state.name == "PROCESSING":
            time.sleep(2)
            f = client.files.get(name=f.name)
        contents.append(f)
    contents.append(case["user"])

    resp = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=case["system"]),
    )
    u = resp.usage_metadata
    thoughts = u.thoughts_token_count or 0
    # 思考 tokens 按輸出價計費，一併算進輸出
    return resp.text, u.prompt_token_count, (u.candidates_token_count or 0) + thoughts, thoughts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case")
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--models", default=None, help="逗號分隔，預設用 case 檔的 models")
    args = ap.parse_args()

    case_path = Path(args.case)
    case = json.loads(case_path.read_text(encoding="utf-8"))
    keys = (args.models or ",".join(case.get("models", MODELS))).split(",")
    video = REPO / case["video"] if case.get("video") else None

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    out_dir = HERE.parent / "results" / f"{case_path.stem}_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir.with_suffix(".csv")

    frames = []
    tmp = tempfile.TemporaryDirectory()
    if video and any(MODELS[k]["provider"] == "claude" for k in keys):
        frames = extract_frames(video, case.get("frame_every_sec", 5), tmp.name)

    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["case", "model", "run", "input_tokens", "output_tokens", "thinking_tokens",
                    "latency_s", "cost_twd", "output_file", "error"])
        for k in keys:
            m = MODELS[k]
            for run in range(1, args.runs + 1):
                t0 = time.time()
                try:
                    if m["provider"] == "claude":
                        text, i, o, th = run_claude(m["id"], case, frames)
                    else:
                        text, i, o, th = run_gemini(m["id"], case, video)
                    err = ""
                except Exception as e:  # 記錄失敗、繼續跑下一個
                    text, i, o, th, err = "", 0, 0, 0, repr(e)
                dt = round(time.time() - t0, 1)
                out_file = out_dir / f"{k}_{run}.md"
                out_file.write_text(text, encoding="utf-8")
                w.writerow([case_path.stem, m["id"], run, i, o, th, dt,
                            round(cost_twd(m["price"], i, o), 3), out_file.name, err])
                print(f"{k} #{run}: in={i} out={o} think={th} {dt}s NT${cost_twd(m['price'], i, o):.3f} {err}",
                      file=sys.stderr)

    print(f"CSV: {csv_path}\n原文: {out_dir}/（盲評前先把檔名改成 A/B/C）")


if __name__ == "__main__":
    main()
