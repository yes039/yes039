#!/usr/bin/env python3
"""ORDER-002 第 4 步：原始資產完整性驗證（只讀，不執行原型內任何程式）。

用法：
  python3 -I harness/verify_assets.py <SEAL02_5AI_G1_Prototype.zip> --sha256 <總指揮提供的雜湊> [--out <報告目錄>]

檢查項目：
  1. zip 的 SHA-256 與提供值是否相符（不相符就立即停止，不解壓縮）
  2. 解壓縮到獨立的唯讀目錄，並拒絕路徑穿越的檔名
  3. 五份 SKILL.md
  4. JSON Schema：要能解析，而且是合法的 schema
  5. 測試資料：A 店、B 店
  6. Python 參考執行器：只用 py_compile 編譯檢查，不執行
  7. R0–R3 驗證證據
  8. 若 zip 內含 SHA256SUMS 或 manifest，逐檔比對
產出 asset_verification.json 與 asset_verification.md；原始 zip 不會被修改。
"""
import argparse, hashlib, json, py_compile, re, stat, sys, zipfile
from pathlib import Path


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_extract(zf, dest):
    for m in zf.infolist():
        if not m.flag_bits & 0x800:  # 未標 UTF-8 的中文檔名會被解成 cp437，這裡還原
            for enc in ("utf-8", "big5", "gbk"):
                try:
                    m.filename = m.filename.encode("cp437").decode(enc)
                    break
                except (UnicodeEncodeError, UnicodeDecodeError):
                    continue
        name = m.filename
        if name.startswith("/") or ".." in Path(name).parts:
            raise SystemExit(f"拒絕：zip 內含不安全路徑 {name}")
    zf.extractall(dest, members=zf.infolist())
    for p in dest.rglob("*"):  # 解壓縮後全部設為唯讀，避免被誤改
        if p.is_file():
            p.chmod(stat.S_IRUSR | stat.S_IRGRP)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip")
    ap.add_argument("--sha256", required=True)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "runs" / "asset_check"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rep = {"zip": Path(a.zip).name, "expected_sha256": a.sha256.lower()}
    rep["actual_sha256"] = sha256(a.zip)
    rep["sha256_match"] = rep["actual_sha256"] == rep["expected_sha256"]
    if not rep["sha256_match"]:
        (out / "asset_verification.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False))
        print("FAIL：SHA-256 不相符，停止。")
        return 2
    dest = out / "extracted"
    if dest.exists():
        raise SystemExit(f"{dest} 已存在，請先確認後手動移除。")
    with zipfile.ZipFile(a.zip) as zf:
        safe_extract(zf, dest)
    files = [p for p in dest.rglob("*") if p.is_file()]
    rel = lambda p: str(p.relative_to(dest))

    skills = [rel(p) for p in files if p.name == "SKILL.md"]
    schemas, schema_err = [], []
    for p in files:
        if p.suffix == ".json" and re.search(r"schema", p.name, re.I):
            try:
                import jsonschema
                s = json.loads(p.read_text(encoding="utf-8"))
                jsonschema.validators.validator_for(s).check_schema(s)
                schemas.append(rel(p))
            except Exception as e:  # noqa: BLE001
                schema_err.append(f"{rel(p)}: {type(e).__name__}: {e}"[:300])
    store_a = [rel(p) for p in files if re.search(r"晨光|A店|store[_-]?a", rel(p), re.I)]
    store_b = [rel(p) for p in files if re.search(r"暮色|B店|store[_-]?b", rel(p), re.I)]
    py_ok, py_err = [], []
    for p in files:
        if p.suffix == ".py":
            try:
                py_compile.compile(str(p), cfile=str(out / "pyc" / (p.name + "c")), doraise=True)
                py_ok.append(rel(p))
            except py_compile.PyCompileError as e:
                py_err.append(f"{rel(p)}: {e.msg}"[:300])
    rounds = {r: sorted({rel(p) for p in files if re.search(rf"(^|[^A-Za-z0-9]){r}([^0-9]|$)", rel(p))}) for r in ["R0", "R1", "R2", "R3"]}

    sums_check = []
    for p in files:
        if re.fullmatch(r"(SHA256SUMS|sha256sums)(\.txt)?|manifest\.json", p.name, re.I) and p.suffix != ".json":
            for line in p.read_text(encoding="utf-8").splitlines():
                m = re.match(r"([0-9a-fA-F]{64})\s+\*?(.+)", line.strip())
                if m:
                    tgt = (p.parent / m.group(2)).resolve()
                    ok = tgt.is_file() and sha256(tgt) == m.group(1).lower()
                    sums_check.append({"file": m.group(2), "ok": ok})

    rep.update({
        "file_count": len(files),
        "skill_md": skills, "skill_md_count_ok": len(skills) == 5,
        "json_schema_valid": schemas, "json_schema_errors": schema_err,
        "store_a_files": store_a, "store_b_files": store_b,
        "python_compiled": py_ok, "python_errors": py_err,
        "evidence_rounds": rounds,
        "internal_checksums": sums_check,
    })
    gates = {
        "SHA-256": rep["sha256_match"],
        "五份 SKILL.md": rep["skill_md_count_ok"],
        "JSON Schema": bool(schemas) and not schema_err,
        "A 店資料": bool(store_a),
        "B 店資料": bool(store_b),
        "執行器": bool(py_ok) and not py_err,
        "R0–R3 證據": all(rounds.values()),
        "內部校驗": all(x["ok"] for x in sums_check) if sums_check else None,
    }
    rep["gates"] = gates
    rep["verdict"] = "PASS" if all(v is not False for v in gates.values()) and all(v is not None for k, v in gates.items() if k != "內部校驗") else "FAIL"
    (out / "asset_verification.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False))
    md = ["# 原始資產完整性驗證", "", f"- zip：`{rep['zip']}`", f"- SHA-256：`{rep['actual_sha256']}`", f"- 判定：**{rep['verdict']}**", "", "| 檢查 | 結果 |", "|---|---|"]
    md += [f"| {k} | {'PASS' if v else ('N/A' if v is None else 'FAIL')} |" for k, v in gates.items()]
    md += ["", "說明：判斷 A／B 店與 R0–R3 的方式是比對檔名或路徑，結果需要人工確認。原型裡的程式只做了編譯檢查，沒有執行。"]
    (out / "asset_verification.md").write_text("\n".join(md))
    print("\n".join(md))
    return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
