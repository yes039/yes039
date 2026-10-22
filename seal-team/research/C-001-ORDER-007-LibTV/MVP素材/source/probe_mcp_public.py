"""LibTV MCP 公開端點探測（不登入、不帶任何憑證、不花點數）。
在可連到 mcp.liblib.tv 的電腦上執行：python3 probe_mcp_public.py > probe-結果.json
預期（官方 README）：/mcp 未授權回 401＋WWW-Authenticate: Bearer；兩個 OAuth well-known 端點回 200。"""
import json, urllib.request, urllib.error

BASE = "https://mcp.liblib.tv"
PATHS = ["/mcp",
         "/.well-known/oauth-protected-resource",
         "/.well-known/oauth-protected-resource/mcp",
         "/.well-known/oauth-authorization-server"]

def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, dict(r.headers), r.read(4000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read(4000).decode("utf-8", "replace")
    except urllib.error.URLError as e:
        return None, {}, f"網路錯誤：{e.reason}"

out = {}
for p in PATHS:
    code, headers, body = get(BASE + p)
    try:
        body = json.loads(body)
    except ValueError:
        pass
    out[p] = {"status": code, "www_authenticate": headers.get("WWW-Authenticate"), "body": body}

# 從 metadata 摘出補證需要的欄位：授權伺服器、是否支援動態註冊、scope
meta = out["/.well-known/oauth-authorization-server"]["body"]
if isinstance(meta, dict):
    out["摘要"] = {k: meta.get(k) for k in ("issuer", "authorization_endpoint", "token_endpoint",
                                           "registration_endpoint", "scopes_supported",
                                           "code_challenge_methods_supported")}
print(json.dumps(out, ensure_ascii=False, indent=2))
