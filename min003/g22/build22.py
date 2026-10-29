#!/usr/bin/env python3
"""G2.2 整合開發版產生器：原 Demo（不修改原檔）＋ G2 產業模型 ＋ 體驗層 → 單頁。
用法（在 min003/g22 執行）：python3 build22.py demo-base/水電Demo.html demo-base/營造Demo.html ../g2/G2工程體驗版.html out"""
import sys, re, os
DEMO_W, DEMO_B, G2, OUT = sys.argv[1:5]
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
rd = lambda p: open(p, encoding="utf8").read()
core = rd(os.path.join(HERE, "xp-core.js"))
base, core_rest = core.split('let MODE="demo", XP;', 1)
core_rest = 'let MODE="demo", XP;' + core_rest
css = rd(os.path.join(HERE, "xp.css"))
g2 = rd(G2)

def rep(s, old, new, count=1):
    n = s.count(old)
    if n != count:
        sys.exit(f"錨點出現 {n} 次（預期 {count}）：{old[:90]}")
    return s.replace(old, new)

def module(name, nxt):
    a = g2.index(f"const {name}={{"); b = g2.index(nxt, a)
    return g2[a:b].rstrip()

# ---------- 產業模型（取自 G2，僅調整工地／工程命名與重疊規則） ----------
water = module("WATER", "/* =================== 產業模組：營造")
water = rep(water, 'name:`工地 ${String(k+1).padStart(2,"0")}`', 'name:`${W_LET[k]} 案`')
water = rep(water, 'abnormal:k>=Oeff&&k<Oeff+A,', 'abnormal:((k-Oeff+S)%S)<A,')  # 異常工地數＝輸入值（可與落後工地重疊）
water = rep(water, '"今天下班前從工地 01 調料"', '"今天下班前從其他工地調料"')
build = module("BUILD", "const MODS=")
build = rep(build, 'name:`工程 ${String.fromCharCode(65+k)}`', 'name:`${B_PID[k]}案`')
build = rep(build, 't:`成本效率 ${m.CPI.toFixed(2)}，預估毛利 ${F.pct(m.margin)}`', 't:`成本效率 ${m.CPI.toFixed(2)}，預估毛利 ${F.pct1(m.margin)}`')
build = rep(build, 'metric:["預估毛利",F.pct(m.margin),F.pct(m.margin+.02)]', 'metric:["預估毛利",F.pct1(m.margin),F.pct1(m.margin+.02)]')

COMMON_HEAD = [
    ('<main><div class="wrap" id="main"></div></main>', '<main><div class="wrap modebar" id="modeBar"></div><div class="wrap" id="main"></div><div class="wrap xp" id="xp"></div></main>'),
    ('<div id="layer"></div>', '<div id="layer"></div><div id="xlayer"></div>'),
    ('function render(){\n  $("#views")', 'function render(){\n  modeChrome();\n  $("#views")'),
    ('function go(v){view=v;', 'function go(v){view=v; track("view_open",v);'),
    ('function openDrawer(kind,id){drawer={kind,id}; renderDrawer()}', 'function openDrawer(kind,id){drawer={kind,id}; track("detail_open",kind+":"+id); renderDrawer()}'),
    ('if(d.sample){ const ta=$("#msgIn"); ta.value=SAMPLES[d.sample];', 'if(d.sample){ const ta=$("#msgIn"); ta.value=samples()[d.sample];'),
    ('const SAMPLES={', 'const SAMPLES_DEMO={'),
]
CAP_JS = 'const CAP=6, more=(arr,where,n=CAP)=>arr.length>n?`<p class="more-s">還有 ${arr.length-n} 項，在「${where}」</p>`:"";\n'

def assemble(demo, ind, title, pill, extra, modtxt, pre, adapt_file):
    s = rd(demo)
    s = rep(s, s[s.index("<title>"):s.index("</title>")+8], f"<title>{title}</title>")
    h1 = re.search(r"<h1>(.*?)</h1>", s).group(0)
    s = rep(s, h1, h1.replace("<h1>", '<h1 id="ttl">'))
    s = rep(s, f'<span class="demo">{pill}</span>', f'<span class="demo" id="modePill">{pill}</span>')
    s = rep(s, '<button class="btn ghost sm" id="reset">重設示範</button>', '<button class="btn ghost sm" id="reset">重設示範</button>\n  <button class="btn sm" id="xpCta">換成我的公司</button>')
    i = s.index("</style>"); s = s[:i] + css + s[i:]
    for a, b in COMMON_HEAD + extra:
        s = rep(s, a, b)
    tail = "render();\n</script>"
    s = rep(s, tail, "\n" + CAP_JS + f'const IND="{ind}";\n' + base + pre + modtxt + f"\nconst MODS={{{ind}:{ 'WATER' if ind=='water' else 'BUILD'}}};\n" + rd(os.path.join(HERE, adapt_file)) + core_rest + "</script>")
    return s

# ---------- 水電：原 Demo 的固定數字改為依工地數 ----------
W_EXTRA = [
    ('<p class="lede gridlede">八個工地圍著總部排成九宮格，一眼看完全部。點任何一格看那個工地的細節和原話。</p>', '<p class="lede gridlede">${gridLede()}</p>'),
    ('<b class="${rep<8?"alert":""}">${rep}/8</b>', '<b class="${rep<S.sites.length?"alert":""}">${rep}/${S.sites.length}</b>'),
    ('<div class="sub"><span>未回報</span><b>${8-rep}</b></div>', '<div class="sub"><span>未回報</span><b>${S.sites.length-rep}</b></div>'),
    ('const ss=S.sites, cells=[tile(ss[0]),tile(ss[1]),tile(ss[2]),tile(ss[3]),hub,tile(ss[4]),tile(ss[5]),tile(ss[6]),tile(ss[7])];', 'const ss=gridSites(), cells=[0,1,2,3,-1,4,5,6,7].map(k=>k<0?hub:ss[k]?tile(ss[k]):EMPTY_TILE);'),
    ('<span>燈號依固定規則判斷，不靠 AI</span></div>`;', '<span>燈號依固定規則判斷，不靠 AI</span></div>${gridMore()}`;'),
    ('function vGrid(){', '''const EMPTY_TILE=`<div class="tile empty" aria-hidden="true"><span class="t-id">—</span><span class="small">未使用</span></div>`;
/* 工地超過 8 個時，九宮格先排最需要注意的 8 個；8 個以下保留空格 */
function gridSites(){const ss=S.sites; if(ss.length<=8) return ss; const R={red:0,grey:1,amber:2,green:3}; return ss.slice().sort((a,b)=>R[light(a.id)]-R[light(b.id)]||ss.indexOf(a)-ss.indexOf(b)).slice(0,8)}
function gridLede(){const n=S.sites.length; return n===8?"八個工地圍著總部排成九宮格，一眼看完全部。點任何一格看那個工地的細節和原話。":n<8?`${n} 個工地圍著總部排成九宮格，一眼看完全部。點任何一格看那個工地的細節和原話。`:`九宮格先排最需要注意的 8 個工地，其餘 ${n-8} 個在「工地總覽」。點任何一格看那個工地的細節和原話。`}
function gridMore(){const n=S.sites.length; return n>8?`<p class="gridmore">另有 ${n-8} 個工地在「工地總覽」，九宮格先顯示最需要注意的 8 個。</p>`:""}
const noteSite=()=>MODE==="demo"?"E":(unreported()[0]||S.sites[S.sites.length-1]).id;
function vGrid(){'''),
    ('<div class="kpi"><span>今日回報</span><b>${rep}/8</b></div>', '<div class="kpi"><span>今日回報</span><b>${rep}/${S.sites.length}</b></div>'),
    ('${decide.length?decide.map(i=>', '${decide.length?decide.slice(0,CAP).map(i=>'),
    ('<div class="acts"><button class="btn ghost sm" data-assign="${i.id}">指派</button><button class="btn sm" data-handle="${i.id}">已處理</button></div>${handleBox(i)}</div>`).join(""):`<p class="empty-s">今天沒有要你決定的事。</p>`}',
     '<div class="acts"><button class="btn ghost sm" data-assign="${i.id}">指派</button><button class="btn sm" data-handle="${i.id}">已處理</button></div>${handleBox(i)}</div>`).join("")+more(decide,"今日摘要"):`<p class="empty-s">今天沒有要你決定的事。</p>`}'),
    ('${others.length?others.map(i=>', '${others.length?others.slice(0,CAP).map(i=>'),
    ('<button class="src" data-issue="${i.id}">追蹤</button></span></div>`).join(""):`<p class="empty-s">沒有其他未結異常。</p>`}',
     '<button class="src" data-issue="${i.id}">追蹤</button></span></div>`).join("")+more(others,"異常追蹤"):`<p class="empty-s">沒有其他未結異常。</p>`}'),
    ('${S.mats.filter(m=>m.status!=="已到場").map(m=>', '${S.mats.filter(m=>m.status!=="已到場").slice(0,CAP).map(m=>'),
    ('<button class="src" data-msg="${m.src}">看原話</button></span></div>`).join("")}\n   </div>', '<button class="src" data-msg="${m.src}">看原話</button></span></div>`).join("")+more(S.mats.filter(m=>m.status!=="已到場"),"工地總覽")}\n   </div>'),
    ('${unreported().length?unreported().map(s=>', '${unreported().length?unreported().slice(0,CAP).map(s=>'),
    ('${S.reminded[s.id]?"已提醒":"提醒主任"}</button></span></div>`).join(""):`<p class="empty-s">8 個工地都回報了。</p>`}',
     '${S.reminded[s.id]?"已提醒":"提醒主任"}</button></span></div>`).join("")+more(unreported(),"工地總覽"):`<p class="empty-s">${S.sites.length} 個工地都回報了。</p>`}'),
    ('或到「師傅 LINE 回報」替 E 案傳一則回報', '或到「師傅 LINE 回報」替 ${noteSite()} 案傳一則回報'),
    ('<span class="small muted">　回報 ${8-un.length}/8 工地</span>', '<span class="small muted">　回報 ${S.sites.length-un.length}/${S.sites.length} 工地</span>'),
    ('<div class="chat-h"><span>○○水電（官方帳號）</span>', '<div class="chat-h"><span>${MODE==="mine"?coName():"○○水電"}（官方帳號）</span>'),
    ('試著按「今日回報」替 E 案送出', '試著按「今日回報」替 ${noteSite()} 案送出'),
    ('const sm=t.match(/([A-Ha-h])\\s*案/); p.site=sm?sm[1].toUpperCase():null;', 'const sm=t.match(/([A-Ta-t])\\s*案/); p.site=sm&&site(sm[1].toUpperCase())?sm[1].toUpperCase():null;'),
    ('p.issue=t.replace(/^[A-Ha-h]\\s*案/,"")', 'p.issue=t.replace(/^[A-Ta-t]\\s*案/,"")'),
    ('const first=t.replace(/^[A-Ha-h]\\s*案/,"")', 'const first=t.replace(/^[A-Ta-t]\\s*案/,"")'),
    ('<p class="small muted" style="margin:0">這是師傅在 LINE 傳的原文（示範）。', '<p class="small muted" style="margin:0">這是師傅在 LINE 傳的原文（${MODE==="mine"?"模擬":"示範"}）。'),
    ('if(t.id==="reset"){ S=seed();', 'if(t.id==="reset"){ if(MODE==="mine"){ S=mineState(); chat=[]; pending=null; drawer=null; toast("已重新產生你的模擬資料（條件不變）"); return render() } S=seed();'),
    ('function vReport(){', '''function samples(){ if(MODE==="demo") return SAMPLES_DEMO; const u=noteSite(), last=S.sites[S.sites.length-1].id, b=(S.sites[1]||S.sites[0]).id;
  return {report:SAMPLES_DEMO.report.replace("E案",u+"案"),issue:SAMPLES_DEMO.issue.replace("H案",last+"案"),mat:SAMPLES_DEMO.mat.replace("E案",u+"案"),done:SAMPLES_DEMO.done.replace("B案",b+"案")} }
function vReport(){'''),
]
W_PRE = 'const W_LET="ABCDEFGHIJKLMNOPQRST";\n'

# ---------- 營造 ----------
ACT_OLD = ':`<button class="btn sm" data-dec="${d.id}" data-v="核准">核准</button><button class="btn ghost sm" data-dec="${d.id}" data-v="退回">退回</button>`}'
ACT_NEW = ':d.acts?`<button class="btn sm" data-dec="${d.id}" data-v="${d.acts[0]}">${d.acts[0]}</button><button class="btn ghost sm" data-dec="${d.id}" data-v="${d.acts[1]}">${d.acts[1]}</button>`:`<button class="btn sm" data-dec="${d.id}" data-v="核准">核准</button><button class="btn ghost sm" data-dec="${d.id}" data-v="退回">退回</button>`}'
B_EXTRA = [
    ('lines:S.projects.map(p=>`<div class="pv">', 'lines:S.projects.slice(0,6).map(p=>`<div class="pv">'),
    ('<b style="left:${p.plan}%"></b></span></div>`).join("")+`<div class="opt">', '<b style="left:${p.plan}%"></b></span></div>`).join("")+(S.projects.length>6?`<div class="opt"><span class="t muted">另 ${S.projects.length-6} 件在「工程總覽」</span></div>`:"")+`<div class="opt">'),
    ('<span class="t">乙案水電請款 > 現場進度</span>', '<span class="t">${MODE==="demo"?"乙案水電請款 > 現場進度":(()=>{const f=S.subs.find(s=>s.flag&&!s.cleared);return f?`${f.p}案${f.name}請款 > 現場進度`:""})()}</span>'),
    ('<span class="t muted">本週到期：乙案水電第 2 期（10/31）</span>', '<span class="t muted">${MODE==="demo"?"本週到期：乙案水電第 2 期（10/31）":`下一筆：${S.subs[0].p}案${S.subs[0].name}（${S.subs[0].next}）`}</span>'),
    ('lines:`${late.map(r=>', 'lines:`${late.slice(0,3).map(r=>'),
    ('<span class="t muted">下一筆：甲案第 4 期（11/10）</span>', '<span class="t muted">${MODE==="demo"?"下一筆：甲案第 4 期（11/10）":`下一筆：${S.recv[0].p}案（${S.recv[0].next}）`}</span>'),
    ('.map(c=>c.p+"案 "+c.margin+"%")', '.map(c=>c.p+"案 "+(+c.margin).toFixed(1)+"%")'),
    ('<td class="r num"><span class="pill ${c.margin<5?"amber":"green"}">${c.margin}%</span></td>', '<td class="r num"><span class="pill ${c.margin<5?"amber":"green"}">${(+c.margin).toFixed(1)}%</span></td>'),
    ('要先建立成本科目和預算才有真實數字。下面是示範數字。', '要先建立成本科目和預算才有真實數字。下面是${MODE==="mine"?"依你輸入的條件模擬的":"示範"}數字。'),
    ('${opQ.map(i=>`<div class="item ${overdue(i)?"red":"amber"}"><span class="item-t">${i.p} 案', '${opQ.slice(0,CAP).map(i=>`<div class="item ${overdue(i)?"red":"amber"}"><span class="item-t">${i.p} 案'),
    ('${esc(i.owner)}<button class="src" data-issue="${i.id}">追蹤</button></span></div>`).join("")}\n    ${behind.map(p=>', '${esc(i.owner)}<button class="src" data-issue="${i.id}">追蹤</button></span></div>`).join("")+more(opQ,"異常與缺失")}\n    ${behind.slice(0,4).map(p=>'),
    ('${late.map(r=>`<div class="item red"><span class="item-t">${r.p} 案・', '${late.slice(0,4).map(r=>`<div class="item red"><span class="item-t">${r.p} 案・'),
    ('${unreported().length?unreported().map(p=>', '${unreported().length?unreported().slice(0,CAP).map(p=>'),
    ('${S.reminded[p.id]?"已提醒":"提醒主任"}</button></span></div>`).join(""):`<p class="empty-s">每個工程的日報都交了。</p>`}', '${S.reminded[p.id]?"已提醒":"提醒主任"}</button></span></div>`).join("")+more(unreported(),"工程總覽"):`<p class="empty-s">每個工程的日報都交了。</p>`}'),
    ('<p>核准甲案第 3 期估驗；到「主任 LINE 回報」替戊案補交昨天的日報，回來看燈號和日報未交清單怎麼變。</p>', '<p>${MODE==="demo"?"核准甲案第 3 期估驗；到「主任 LINE 回報」替戊案補交昨天的日報":`處理一件「要你決定」；到「主任 LINE 回報」替${noteP()}案補交昨天的日報`}，回來看燈號和日報未交清單怎麼變。</p>'),
    ('<div class="chat-h"><span>○○營造（官方帳號）</span>', '<div class="chat-h"><span>${MODE==="mine"?coName():"○○營造"}（官方帳號）</span>'),
    ('按「工程日報」替戊案補交', '按「工程日報」替${noteP()}案補交'),
    ('const sm=t.match(/([甲乙丙丁戊])\\s*案/);', 'const sm=t.match(/([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉])\\s*案/);'),
    ('p.issue=t.replace(/^[甲乙丙丁戊]\\s*案/,"")', 'p.issue=t.replace(/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉]\\s*案/,"")'),
    ('.replace(/^[甲乙丙丁戊]案(昨天|今天)?/,"")', '.replace(/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉]案(昨天|今天)?/,"")'),
    ('<p class="small muted" style="margin:0">這是主任在 LINE 傳的原文（示範）。', '<p class="small muted" style="margin:0">這是主任在 LINE 傳的原文（${MODE==="mine"?"模擬":"示範"}）。'),
    ('if(t.id==="reset"){ S=seed();', 'if(t.id==="reset"){ if(MODE==="mine"){ S=mineState(); chat=[]; pending=null; drawer=null; toast("已重新產生你的模擬資料（條件不變）"); return render() } S=seed();'),
    ('function vReport(){', '''const noteP=()=>MODE==="demo"?"戊":(unreported()[0]||S.projects[S.projects.length-1]).id;
function samples(){ if(MODE==="demo") return SAMPLES_DEMO; const u=noteP(), b=(S.projects[1]||S.projects[0]).id, a=S.projects[0].id, q=(S.issues.find(i=>i.status!=="結案")||{p:a}).p;
  return {report:SAMPLES_DEMO.report.replace("戊案",u+"案"),issue:SAMPLES_DEMO.issue.replace("乙案",b+"案"),meeting:SAMPLES_DEMO.meeting.replace("甲案",a+"案"),fix:SAMPLES_DEMO.fix.replace("戊案",q+"案")} }
function vReport(){'''),
]
B_PRE = 'const B_PID="甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉";\n'

w = assemble(DEMO_W, "water", "水電工程體驗版", "示範資料・非真實工地", W_EXTRA, water, W_PRE, "water-adapt.js")
b0 = rd(DEMO_B)
if b0.count(ACT_OLD) != 2: sys.exit("營造決策按鈕錨點數量不符")
bx = assemble(DEMO_B, "build", "營造工程體驗版", "示範資料・非真實工程", B_EXTRA, build, B_PRE, "build-adapt.js")
bx = bx.replace(ACT_OLD, ACT_NEW)
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "水電工程體驗版.html"), "w", encoding="utf8").write(w)
open(os.path.join(OUT, "營造工程體驗版.html"), "w", encoding="utf8").write(bx)
print("ok", len(w), len(bx))
