"""只替換 Netlify 站上指定檔案（digest 法）。
用法：
  python3 netlify_swap.py 本機路徑:站上路徑 ...            預演（不部署）
  python3 netlify_swap.py --draft 本機路徑:站上路徑 ...    先發草稿（不影響正式站），印出草稿網址與「基準版」編號
  python3 netlify_swap.py --publish=草稿編號 --base=基準版編號   草稿驗過後發正式；正式站若在這中間被別人換過就拒絕
  python3 netlify_swap.py --go 本機路徑:站上路徑 ...       直接上正式（舊用法，不建議）
"""
import json, sys, hashlib, time, urllib.request, os
SITE = '80025f46-1ffa-4669-b866-9187fdc3fb9a'
SRC = os.path.expanduser('~/Desktop/講座報名網站_上線用')

def find_token(o):
    if isinstance(o, dict):
        if 'token' in o and isinstance(o['token'], str) and len(o['token']) > 20: return o['token']
        for v in o.values():
            t = find_token(v)
            if t: return t
    return None
TOKEN = find_token(json.load(open(os.path.expanduser('~/Library/Preferences/netlify/config.json'))))

def api(method, path, body=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request('https://api.netlify.com/api/v1' + path, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': ctype})
    with urllib.request.urlopen(req, timeout=120) as r:
        t = r.read()
        return json.loads(t) if t else None

def sha1(p): return hashlib.sha1(open(p, 'rb').read()).hexdigest()

def arg(name):
    for a in sys.argv[1:]:
        if a.startswith(name + '='): return a.split('=', 1)[1]
    return None

def published_id(): return api('GET', f'/sites/{SITE}')['published_deploy']['id']

def wait_ready(did):
    for _ in range(60):
        d = api('GET', f'/deploys/{did}')
        if d['state'] in ('ready', 'error'): return d
        time.sleep(3)
    return d

pub = arg('--publish')
if pub:
    base, now = arg('--base'), published_id()
    assert base, '發正式要帶 --base=草稿當時印出的基準版編號'
    assert now == base, f'正式站在草稿之後被換過（現在 {now}，草稿基準 {base}），直接發會蓋掉別人的改動；請重發草稿'
    before = {x['path']: x['sha'] for x in api('GET', f'/sites/{SITE}/files')}
    api('POST', f'/sites/{SITE}/deploys/{pub}/restore')
    for _ in range(40):
        if published_id() == pub: break
        time.sleep(3)
    print('正式版現在是', published_id())
    after = {x['path']: x['sha'] for x in api('GET', f'/sites/{SITE}/files')}
    print('sha 有變動：', [p for p in after if before.get(p) != after[p]], '消失：', [p for p in before if p not in after])
    sys.exit()

draft = '--draft' in sys.argv
go = '--go' in sys.argv or draft
pairs = [a.split(':', 1) for a in sys.argv[1:] if not a.startswith('--')]
base = published_id()  # 草稿以這一版為底；發正式前會核對它沒被換掉
live = api('GET', f'/sites/{SITE}/files')
files = {x['path']: x['sha'] for x in live}
print('線上檔案數', len(files))
# _redirects：線上清單有就沿用線上版（部落格自動發文會在線上加轉址，本機來源常落後）；
# 清單沒有才用部署來源那份，否則 /free /prep 會掉。要改轉址就明確帶「本機:/_redirects」。
src_redirects = sha1(os.path.join(SRC, '_redirects'))
if '/_redirects' not in files:
    files['/_redirects'] = src_redirects
elif files['/_redirects'] != src_redirects:
    print('⚠️ 部署來源的 _redirects 跟線上不同，這次沿用線上版；記得把線上版同步回部署來源')
changes = {}
for local, site_path in pairs:
    new = sha1(local)
    old = files.get(site_path)
    print(f'{site_path}: 線上 {old} → 新 {new}')
    files[site_path] = new
    changes[site_path] = (local, new)
if not go:
    print('（預演，未部署；加 --draft 先發草稿）'); sys.exit()
body = {'files': files, 'async': False}
if draft: body['draft'] = True
d = api('POST', f'/sites/{SITE}/deploys', body)
did, req = d['id'], d.get('required', [])
print('deploy', did, 'required', req)
expect = {v[1] for v in changes.values()}
extra = set(req) - expect - {files['/_redirects']}
assert not extra, f'required 出現非預期檔案：{extra}'
for site_path, (local, sha) in changes.items():
    if sha in req:
        api('PUT', f'/deploys/{did}/files{site_path}', raw=open(local, 'rb').read(), ctype='application/octet-stream')
        print('上傳', site_path)
if files['/_redirects'] in req and '/_redirects' not in changes and files['/_redirects'] == src_redirects:
    api('PUT', f'/deploys/{did}/files/_redirects', raw=open(os.path.join(SRC, '_redirects'), 'rb').read(), ctype='application/octet-stream')
    print('上傳 /_redirects')
dd = wait_ready(did)
print('狀態', dd['state'])
if draft:
    print('草稿網址', dd.get('deploy_ssl_url') or dd.get('deploy_url'))
    print(f'驗過後發正式：python3 {sys.argv[0]} --publish={did} --base={base}')
    sys.exit()
after = {x['path']: x['sha'] for x in api('GET', f'/sites/{SITE}/files')}
before = {x['path']: x['sha'] for x in live}
print('sha 有變動：', [p for p in after if before.get(p) != after[p]], '消失：', [p for p in before if p not in after])
