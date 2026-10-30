#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小房 ▎房仲帶看與成交工具

工作區預設 ~/AI員工_小房/（可用環境變數 XIAOFANG_HOME 覆蓋）。
八個指令：new / list / showing / log / offer / pipeline / check / report
"""
import argparse, json, os, re, sys, datetime, pathlib

SKILL_DIR = pathlib.Path(__file__).resolve().parent.parent


def _cfg(name, default):
    f = SKILL_DIR / name
    if f.exists():
        t = f.read_text(encoding='utf-8').strip()
        if t:
            return t
    return default


BRAND = _cfg('brand.txt', '老闆　▎　你的 AI 數字員工')
_ws = os.environ.get('XIAOFANG_HOME') or _cfg('workspace.txt', '~/AI員工_小房')
HOME = pathlib.Path(os.path.expanduser(_ws))
DB = HOME / 'data.json'
OUT = HOME / 'out'
TODAY = datetime.date.today()

STAGES = ['開發', '需求', '帶看', '追蹤', '議價', '出價', '簽約', '成交', '結案']
OVERDUE = {'A': 4, 'B': 10, 'C': 35}

# ── 禁用詞：房仲最常踩的保證型字眼 ───────────────────────────────────
BANNED = [
    ('保證增值',   '改寫：本區近三年實價登錄成交區間為…（附來源與日期）'),
    ('一定漲',     '改寫：目前市場資料顯示…，未來價格無法預測'),
    ('穩賺',       '整句刪除，沒有可替代說法'),
    ('穩賺不賠',   '整句刪除，沒有可替代說法'),
    ('零風險',     '整句刪除，沒有可替代說法'),
    ('包賺',       '整句刪除'),
    ('保證獲利',   '改寫：以目前租金與開價試算，毛租金報酬率約…，實際依成交價與空置率而定'),
    ('保證投報',   '同上，一律改成試算並附前提'),
    ('投報率保證', '同上'),
    ('保證租得掉', '改寫：本區同類型近期出租天數約…（附來源）'),
    ('保證出租',   '同上'),
    ('保證貸款',   '改寫：貸款成數由銀行依個人條件核定，可協助轉介諮詢'),
    ('保證過件',   '同上'),
    ('一定過件',   '同上'),
    ('都更一定',   '改寫：目前都更進度為…，核定時程由主管機關決定'),
    ('保證都更',   '同上'),
    ('政府保證',   '刪除，政府不對個案投資背書'),
    ('內線',       '刪除，涉及不實或不當招攬'),
    ('最後一戶',   '若非事實即為假稀缺，刪除或改為實際剩餘戶數與統計日期'),
    ('最後一間',   '同上'),
    ('今天不買就沒了', '刪除，製造急迫屬欺罔'),
    ('公定',       '服務費沒有公定價，改寫：法定上限為合計 6%，本公司收費標準為…'),
    ('規定就是2%', '同上'),
    ('免頭期',     '若有附帶條件必須寫明，否則刪除'),
]
# 僅在肯定句才算違規；出現在否定句／衛教句中放行
NEGATORS = ['不能說', '不可以說', '不得', '禁止', '違規', '不要說', '沒有人可以', '任何人跟你說']


def load():
    if DB.exists():
        return json.loads(DB.read_text(encoding='utf-8'))
    return {'clients': [], 'showings': [], 'offers': []}


def save(d):
    HOME.mkdir(parents=True, exist_ok=True)
    DB.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')


def find(d, cid):
    for c in d['clients']:
        if c['id'] == cid or c['name'] == cid:
            return c
    sys.exit(f'✗ 找不到客戶「{cid}」，先跑 list 看清單')


def tier_of(c):
    """四個條件：決策者到位／資金明確／時間明確／條件收斂"""
    score = sum(bool(c['flags'].get(k)) for k in ('decider', 'funds', 'timing', 'narrowed'))
    return 'A' if score >= 4 else ('B' if score >= 2 else 'C'), score


def days_since(s):
    if not s:
        return 999
    return (TODAY - datetime.date.fromisoformat(s)).days


def write_out(name, text):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    p.write_text(text, encoding='utf-8')
    return p


# ── 指令 ──────────────────────────────────────────────────────────────
def cmd_new(a):
    d = load()
    cid = f"C{len(d['clients']) + 1:03d}"
    c = {'id': cid, 'name': a.name, 'phone': a.phone or '', 'source': a.source or '未填',
         'motive': a.motive or '', 'stage': '需求', 'created': TODAY.isoformat(),
         'last_contact': TODAY.isoformat(), 'notes': [],
         'flags': {'decider': False, 'funds': False, 'timing': False, 'narrowed': False}}
    d['clients'].append(c)
    save(d)
    print(f'✓ 建立客戶 {cid}　{a.name}　來源：{c["source"]}')
    print('\n接下來請用《購屋需求確認單》問完 12 題，四題關鍵不可略過：')
    print('  1. 誰會一起住、誰會一起做決定')
    print('  2. 自備款多少、貸款打算幾成　← 問自備款不要問總價')
    print('  3. 什麼時候要入住、為什麼是那個時間')
    print('  4. 現在住哪裡、為什麼要離開')
    print(f'\n範本：templates/購屋需求確認單.md')
    print(f'問完後用：dealflow.py log --client {cid} --result "…" --decider --funds …')


def cmd_list(a):
    d = load()
    if not d['clients']:
        return print('（還沒有客戶，用 new 建立）')
    rows = []
    for c in d['clients']:
        t, s = tier_of(c)
        gap = days_since(c['last_contact'])
        rows.append((t, -gap, c, t, s, gap))
    rows.sort(key=lambda r: ('ABC'.index(r[0]), r[1]))
    print(f'{"ID":<6}{"分級":<4}{"姓名":<10}{"階段":<6}{"幾天沒聯絡":<10}來源')
    print('─' * 62)
    for _, _, c, t, s, gap in rows:
        if a.tier and t != a.tier.upper():
            continue
        flag = '　⚠️ 逾期' if gap > OVERDUE[t] else ''
        print(f'{c["id"]:<6}{t}({s})  {c["name"]:<10}{c["stage"]:<6}{gap:<10}{c["source"]}{flag}')


def cmd_showing(a):
    d = load()
    c = find(d, a.client)
    props = [p.strip() for p in a.properties.split(',') if p.strip()]
    if not 2 <= len(props) <= 3:
        print('⚠️ 建議一次帶看 2–3 間：只帶一間沒有比較基準，超過三間客戶會記憶混亂。')
        if len(props) == 0:
            sys.exit('✗ 至少要有一間')
    rec = {'client': c['id'], 'date': a.date, 'properties': props, 'logged': False}
    d['showings'].append(rec)
    c['stage'] = '帶看'
    save(d)

    order = '次佳 → 最差 → 最佳（最後看的印象最深）'
    body = [f'# 帶看確認書', '',
            f'**客戶**：{c["name"]}　　**帶看日期**：{a.date}', '',
            '## 今日帶看物件', '']
    for i, p in enumerate(props, 1):
        body += [f'{i}. {p}', f'   - 地址：＿＿＿＿＿＿＿＿＿＿　屋齡：＿＿＿　坪數：＿＿＿', '']
    body += ['## 請確認', '',
             '- [ ] 以上時間、地點與物件清單無誤',
             '- [ ] 已收到各物件之**不動產說明書**',
             '- [ ] 了解本次帶看不涉及任何出價或付款行為', '',
             f'客戶簽名：＿＿＿＿＿＿＿＿＿　日期：＿＿＿＿＿＿', '',
             '---', '', BRAND]
    p1 = write_out(f'帶看確認書_{c["name"]}_{a.date}.md', '\n'.join(body))

    log = ['# 帶看紀錄表', '', f'客戶：{c["name"]}　日期：{a.date}', '']
    for i, p in enumerate(props, 1):
        log += [f'## {i}. {p}', '',
                '- 客戶第一句話：', '- 他說最大的問題是：', '- 停留時間：',
                '- 有沒有拍照／量尺寸：', '- 家人反應：', '']
    log += ['## 離開前必問', '', '**請客戶把今天看的排序，並說出排第一的理由**（這是後面議價的全部籌碼）', '',
            '1. ＿＿＿＿　理由：', '2. ＿＿＿＿', '3. ＿＿＿＿', '',
            '## 下一步（要有具體日期）', '', '- 日期：　　　　要做的事：']
    p2 = write_out(f'帶看紀錄表_{c["name"]}_{a.date}.md', '\n'.join(log))

    print(f'✓ 已排帶看：{c["name"]}　{a.date}　{len(props)} 間')
    print(f'  建議看屋順序：{order}')
    print(f'  → {p1}')
    print(f'  → {p2}')
    print('\n現場提醒：不動產說明書主動給；缺點主動講；不替客戶決定。')


def cmd_log(a):
    d = load()
    c = find(d, a.client)
    c['notes'].append({'date': TODAY.isoformat(), 'text': a.result})
    c['last_contact'] = TODAY.isoformat()
    for k in ('decider', 'funds', 'timing', 'narrowed'):
        if getattr(a, k):
            c['flags'][k] = True
    if a.stage:
        if a.stage not in STAGES:
            sys.exit(f'✗ 階段只能是：{" / ".join(STAGES)}')
        c['stage'] = a.stage
    t, s = tier_of(c)
    save(d)
    print(f'✓ 已記錄　{c["name"]}　階段：{c["stage"]}　分級：{t}（{s}/4）')
    miss = [n for k, n in [('decider', '決策者到位'), ('funds', '資金明確'),
                           ('timing', '時間明確'), ('narrowed', '條件收斂')]
            if not c['flags'][k]]
    if miss:
        print(f'  還缺：{"、".join(miss)}　← 下次追蹤就是要補這幾項')
    print(f'  追蹤節奏：{t} 級每 {OVERDUE[t]} 天內要有聯絡')


def cmd_offer(a):
    """出價流程：強制先產生二擇一告知書"""
    d = load()
    c = find(d, a.client)
    stamp = TODAY.isoformat()
    notice = f"""# 出價前告知書　▎　斡旋金與要約書二擇一

**客戶**：{c['name']}　　**標的**：{a.property}　　**日期**：{stamp}

依內政部規定與公平交易委員會決議，您在表示購買意願時，
**可以自由選擇**下列兩種方式之一，本公司不得要求您一定要採用斡旋金。

| | 斡旋金 | 內政部版要約書 |
|---|---|---|
| 是否先付款 | 要 | **不用付款** |
| 賣方同意後 | 斡旋金通常轉為定金 | 契約成立，再付定金 |
| 買方反悔 | 可能遭沒收 | **仍須負違約責任** |

⚠️ 要約書**並非沒有法律責任**的版本，賣方承諾後反悔一樣要負違約責任。

## 審閱期

本件定型化契約，您享有**至少 3 日**的契約審閱期（消費者保護法第 11 條之 1）。

- [ ] 我已獲充分說明，**選擇採用斡旋金**
- [ ] 我已獲充分說明，**選擇採用內政部版要約書**
- [ ] 我已被告知享有至少 3 日審閱期

客戶簽名：＿＿＿＿＿＿＿＿＿＿　日期：＿＿＿＿＿＿＿

經紀人簽名：＿＿＿＿＿＿＿＿＿　證號：＿＿＿＿＿＿＿

---
{BRAND}
"""
    p = write_out(f'出價前告知書_{c["name"]}_{stamp}.md', notice)
    print('🚨 強制順序：先給告知書，客戶簽名選擇之後，才能進斡旋或要約。')
    print(f'  → {p}')

    if not a.confirmed:
        print('\n告知書已產生。等客戶**簽名選擇**後，再加上 --confirmed 重跑這個指令，')
        print('才會建立出價紀錄。（沒有這一步就收斡旋金＝違反公平交易法第 25 條）')
        return

    d['offers'].append({'client': c['id'], 'property': a.property, 'price': a.price,
                        'date': stamp, 'notice_signed': True})
    c['stage'] = '出價'
    save(d)
    print(f'\n✓ 已建立出價紀錄：{c["name"]}　{a.property}　{a.price}')
    print('\n出價單上五件事必須寫清楚：')
    for i, x in enumerate(['價格（含不含車位、稅費分擔）', '有效期限', '付款方式與各期時點',
                           '交屋日', '特約條件（貸款不足怎麼辦／現況交屋／既有租約／瑕疵處理）'], 1):
        print(f'  {i}. {x}')
    print('\n送出前：真人逐項確認、真人送出。小房不按送出鍵。')


def cmd_pipeline(a):
    d = load()
    if not d['clients']:
        return print('（還沒有客戶，用 new 建立）')
    overdue, stuck = [], []
    for c in d['clients']:
        t, s = tier_of(c)
        gap = days_since(c['last_contact'])
        if gap > OVERDUE[t]:
            overdue.append((gap, t, c))
        stuck.append((gap, c['stage'], c))
    overdue.sort(reverse=True)
    stuck.sort(reverse=True)

    print('━━━ 今天該追誰 ━━━')
    if overdue:
        for gap, t, c in overdue:
            print(f'  {t} 級　{c["name"]:<10}{gap} 天沒聯絡（{t} 級上限 {OVERDUE[t]} 天）　階段：{c["stage"]}')
            if c['notes']:
                print(f'       上次：{c["notes"][-1]["text"][:40]}')
    else:
        print('  （沒有逾期，難得）')

    print('\n━━━ 卡關最久 ━━━')
    for gap, st, c in stuck[:5]:
        print(f'  {st:<6}{c["name"]:<10}{gap} 天沒動')

    print('\n━━━ 本月進度 ━━━')
    cnt = {}
    for c in d['clients']:
        cnt[c['stage']] = cnt.get(c['stage'], 0) + 1
    for st in STAGES:
        if cnt.get(st):
            print(f'  {st:<6}{cnt[st]} 組')
    print(f'  合計 {len(d["clients"])} 組　／　出價紀錄 {len(d["offers"])} 件')
    print('\n提醒：沒有新東西就不要打電話，空洞的「考慮得怎麼樣」會把客戶推遠。')


def cmd_check(a):
    if a.file:
        text = pathlib.Path(a.file).read_text(encoding='utf-8')
    elif a.text:
        text = a.text
    else:
        text = sys.stdin.read()
    lines = text.split('\n')
    hits = []
    for i, ln in enumerate(lines, 1):
        for word, fix in BANNED:
            if word in ln:
                if any(n in ln for n in NEGATORS):
                    continue  # 否定句／衛教句放行
                hits.append((i, word, fix, ln.strip()))
    if not hits:
        print('✓ 沒有掃到禁用詞。')
        print('  但工具只掃字面，語意上的保證、暗示稀缺、誤導比較仍要自己把關。')
        return 0
    print(f'✗ 掃到 {len(hits)} 處要改：\n')
    for i, w, fix, ln in hits:
        print(f'  第 {i} 行　「{w}」')
        print(f'    原文：{ln[:60]}')
        print(f'    怎麼改：{fix}\n')
    print('依據：合規紅線.md 紅線五（一律不保證）、紅線六（廣告與資料不實）')
    return 1


def cmd_report(a):
    d = load()
    c = find(d, a.client)
    t, s = tier_of(c)
    lines = [f'# 客戶服務報告　{c["name"]}', '',
             f'產出日期：{TODAY.isoformat()}　／　客戶編號：{c["id"]}', '',
             '## 目前狀態', '',
             f'- 階段：{c["stage"]}',
             f'- 分級：{t}（四項條件符合 {s} 項）',
             f'- 距上次聯絡：{days_since(c["last_contact"])} 天',
             f'- 名單來源：{c["source"]}', '']
    sh = [x for x in d['showings'] if x['client'] == c['id']]
    lines += ['## 帶看紀錄', '']
    if sh:
        for x in sh:
            lines.append(f'- {x["date"]}　{len(x["properties"])} 間：{"、".join(x["properties"])}')
    else:
        lines.append('- （尚未帶看）')
    of = [x for x in d['offers'] if x['client'] == c['id']]
    lines += ['', '## 出價紀錄', '']
    lines += [f'- {x["date"]}　{x["property"]}　{x["price"]}　二擇一告知書：已簽' for x in of] or ['- （尚未出價）']
    lines += ['', '## 聯繫紀錄', '']
    lines += [f'- {n["date"]}　{n["text"]}' for n in c['notes'][-10:]] or ['- （無）']
    lines += ['', '---', '',
              '本報告僅供服務進度說明，不構成任何價格、增值、租金收益或貸款條件之保證。', '',
              BRAND]
    p = write_out(f'客戶報告_{c["name"]}_{TODAY.isoformat()}.md', '\n'.join(lines))
    print(f'✓ {p}')


# ── CLI ───────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(prog='dealflow.py', description='小房 ▎房仲帶看與成交工具')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('new', help='建立客戶卡')
    p.add_argument('--name', required=True); p.add_argument('--phone')
    p.add_argument('--source', help='名單來源：591／FB／轉介／店頭…')
    p.add_argument('--motive', help='他自己說出口的動機')
    p.set_defaults(fn=cmd_new)

    p = sub.add_parser('list', help='列出客戶')
    p.add_argument('--tier', choices=['A', 'B', 'C', 'a', 'b', 'c'])
    p.set_defaults(fn=cmd_list)

    p = sub.add_parser('showing', help='排帶看並產生文件')
    p.add_argument('--client', required=True); p.add_argument('--date', required=True)
    p.add_argument('--properties', required=True, help='用逗號分隔，建議 2–3 間')
    p.set_defaults(fn=cmd_showing)

    p = sub.add_parser('log', help='記錄追蹤結果')
    p.add_argument('--client', required=True); p.add_argument('--result', required=True)
    p.add_argument('--stage');
    for k, h in [('decider', '決策者到位'), ('funds', '資金明確'),
                 ('timing', '時間明確'), ('narrowed', '條件收斂')]:
        p.add_argument(f'--{k}', action='store_true', help=h)
    p.set_defaults(fn=cmd_log)

    p = sub.add_parser('offer', help='出價流程（強制先出告知書）')
    p.add_argument('--client', required=True); p.add_argument('--property', required=True)
    p.add_argument('--price', default='＿＿＿')
    p.add_argument('--confirmed', action='store_true', help='客戶已簽名選擇後才加這個旗標')
    p.set_defaults(fn=cmd_offer)

    p = sub.add_parser('pipeline', help='成交看板')
    p.set_defaults(fn=cmd_pipeline)

    p = sub.add_parser('check', help='話術／文案合規稽核')
    p.add_argument('--file'); p.add_argument('--text')
    p.set_defaults(fn=cmd_check)

    p = sub.add_parser('report', help='產出客戶報告')
    p.add_argument('--client', required=True)
    p.set_defaults(fn=cmd_report)

    a = ap.parse_args()
    sys.exit(a.fn(a) or 0)


if __name__ == '__main__':
    main()
