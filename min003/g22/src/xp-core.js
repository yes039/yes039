/* =================== G2.2 體驗層：先看 Demo → 換成我的公司 → 親自體驗 =================== */
/* Demo 模式用原 Demo 的 seed()；我的公司模式由產業模型產生同一種資料結構，原有畫面直接沿用 */
const F={n:x=>Math.round(x).toLocaleString("zh-TW"),d1:x=>(Math.round(x*10)/10).toLocaleString("zh-TW"),pct:x=>Math.round(x*100)+"%",pct1:x=>(x*100).toFixed(1)+"%",
 wan:x=>(Math.abs(x)>=10000?(Math.round(x/1000)/10).toLocaleString("zh-TW")+" 億":(Math.round(x*10)/10).toLocaleString("zh-TW")+" 萬"),nt:x=>"NT$"+Math.round(x).toLocaleString("zh-TW")};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const seedRand=i=>{const x=Math.sin(i*9301+49297)*233280;return x-Math.floor(x)};
const plain=x=>String(x??"").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
let MODE="demo", XP;
const SRC_ALL={direct:{label:"直接進入（無推薦）"},
  P001:{label:"推薦夥伴 P001 阿明（水電材料行）",ind:"water"},P002:{label:"推薦夥伴 P002 小華（水電師傅）",ind:"water"},P101:{label:"推薦夥伴 P101 吳經理（建材商）",ind:"build"},
  TW1:{label:"測試者 TW1（水電第一輪）",ind:"water"},TW2:{label:"測試者 TW2（水電第一輪）",ind:"water"},TB1:{label:"測試者 TB1（營造第一輪）",ind:"build"},TB2:{label:"測試者 TB2（營造第一輪）",ind:"build"}};
const SRC=Object.fromEntries(Object.entries(SRC_ALL).filter(([k,v])=>!v.ind||v.ind===IND));
function freshXP(){const M=MODS[IND];return {consent:null,source:"direct",code:null,session:"s-"+Math.random().toString(36).slice(2,8),events:[],dev:false,
  inp:{...M.defaults},asm:{...M.asm},resolved:{},sim:{...M.simDefaults},asst:{tasks:[],day:0},scen:null,xdrawer:null,leads:[],demoS:null}}
/* 測試入口：只讀網址 #代碼（例 #TW1、#P001），代碼不含個資，也不是登入憑證；產業不符的代碼視為無效 */
function applyHash(){const raw=decodeURIComponent(location.hash.slice(1)).trim().toUpperCase(); if(!raw||VIEWS.some(v=>v[0]===raw.toLowerCase())) return "none";
  if(!SRC[raw]||raw==="DIRECT") return "invalid"; XP.source=raw; XP.code=raw; return "ok"}
/* 事件：開啟、同意與客戶主動按下的意願永遠記錄；其餘互動需同意 */
function track(type,data){
  const always=["page_open","consent","summary_request","booking_intent","line_interest","card_save","invalid_code"];
  const ok=always.includes(type)||XP.consent==="同意記錄操作";
  XP.events.unshift({t:new Date().toTimeString().slice(0,8),ms:Date.now(),type,data:data||"",ok,src:XP.source,mode:MODE});
  if(XP.dev) renderDev();
}
const MOD=()=>MODS[IND];
function curModel(){return MOD().model(XP.inp,XP.resolved,XP.asm)}
function mineState(){return ADAPT.mine(curModel(),XP.inp)}
const coName=()=>XP.inp.company?esc(XP.inp.company):"你的公司";

/* ---------- 模式切換 ---------- */
function enterMine(){
  if(MODE==="demo") XP.demoS=S;
  MODE="mine"; S=mineState(); chat=[]; pending=null; drawer=null; XP.xdrawer=null;
  view="grid"; history.replaceState(null,"","#grid"); render(); xpRender(); window.scrollTo({top:0});
  track("mode_mine",`${IND}${XP.source!=="direct"?"・來源 "+XP.source:""}`); toast("已換成你的公司（模擬資料）");
}
function backDemo(){
  MODE="demo"; S=XP.demoS||seed(); chat=[]; pending=null; drawer=null; XP.xdrawer=null;
  view="grid"; history.replaceState(null,"","#grid"); render(); xpRender(); window.scrollTo({top:0});
  track("mode_demo",IND); toast("已回到 Demo（示範資料）");
}
/* 條件或情境結果改變：重新產生我的公司資料，畫面停在原處 */
function regenMine(){ if(MODE!=="mine") return; S=mineState(); drawer=null; render(); xpRefresh() }
function modeChrome(){
  const mine=MODE==="mine";
  $("#ttl").innerHTML=mine?`${XP.inp.company?esc(XP.inp.company):"我的"}<span class="tape">${ADAPT.titleTape}</span>`:ADAPT.demoTitle;
  const pill=$("#modePill"); pill.textContent=mine?"你的模擬資料・依輸入條件產生":ADAPT.demoPill; pill.className=mine?"demo mine":"demo";
  $("#reset").textContent=mine?"重新產生":"重設示範";
  const cta=$("#xpCta"); cta.textContent=mine?"回到 Demo":"換成我的公司"; cta.className=mine?"btn ghost sm":"btn sm";
  document.body.dataset.mode=MODE; const hd=$("header.top"); if(hd) document.documentElement.style.setProperty("--hdr",hd.offsetHeight+"px");
  $("#modeBar").innerHTML=mine
   ?`<div class="xmode mine"><span><b>${coName()}</b>・${ADAPT.mineSize(XP.inp)}・依你輸入的條件模擬，<b>不是真實資料</b></span><span class="xmode-a">${XP.code?`<span class="pill grey">體驗編號 ${esc(XP.code)}</span>`:""}<button class="btn ghost sm" data-xgo="cfg">修改條件</button><button class="btn ghost sm" data-xgo="demo">回到 Demo</button></span></div>`
   :`<div class="xmode"><span><b>示範公司</b>・${ADAPT.demoSize}・<b>示範資料</b>　想看看換成你的公司會怎樣？</span><span class="xmode-a">${XP.code?`<span class="pill grey">體驗編號 ${esc(XP.code)}</span>`:""}<button class="btn sm" data-xgo="form">換成我的公司 ↓</button></span></div>`;
}

/* ---------- 體驗區（主畫面下方） ---------- */
const fv2=(f,v)=>f.fmt==="wan"?F.wan(v):`${v} ${f.unit}`;
function cfgHtml(btn){
  const M=MOD(), i=XP.inp;
  return `${XP.consent==null?`<div class="xconsent"><b>開始前</b><span>正式版會先問你：要不要記錄你試用了哪些功能，方便之後說明。<b>這個體驗版不會傳出任何資料</b>，關掉頁面就消失；選哪一個都能完整體驗。</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-consent="同意記錄操作">同意記錄操作</button><button class="btn ghost sm" data-consent="只看不記錄">只看不記錄</button></div></div>`:""}
   <label class="xfld"><span class="xlab">公司名稱（可留空）</span><input type="text" id="in-company" value="${esc(i.company)}" placeholder="${ADAPT.namePh}" maxlength="20"></label>
   <div class="xcfg">${M.inputs.map(f=>`<label class="xfld"><span class="xlab">${f.label}<b id="v-${f.k}">${fv2(f,i[f.k])}</b></span><input type="range" id="in-${f.k}" data-in="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${i[f.k]}" aria-label="${f.label}"></label>`).join("")}</div>
   <span class="xclamp" id="clampNote"></span>${btn}`;
}
function xpRender(){
  const el=$("#xp");
  if(MODE==="demo"){
    el.innerHTML=`<section class="xcard xcta" id="sec-form"><span class="xkick">30 秒免費體驗</span><h2>換成我的公司</h2>
      <p class="xlede">上面是示範公司。調幾個數字，同一個儀表板會立刻變成你的公司：九宮格、老闆手機、${ADAPT.overviewName}、異常情境、改善試算都跟著換。不用登入，也不用真實工程資料。</p>
      ${cfgHtml(`<button class="btn xbig" data-xgo="mine">產生我的工程管理儀表板</button>`)}
      <p class="xnote">數字全部依你輸入的條件模擬；建議是固定規則產生的模擬建議，沒有接 AI 模型，也不會連到任何真實工程或 LINE 群組。</p></section>
      <p class="xfoot"><button class="src" id="devBtn">觀察紀錄</button></p>`;
  } else {
    el.innerHTML=`<nav class="xsec" aria-label="體驗段落"><button data-xgo="top">我的儀表板</button><button data-jump="sec-scen">三個情境</button><button data-jump="sec-ai">AI 經營特助</button><button data-jump="sec-sim">改善試算</button><button data-jump="sec-next">下一步</button><button data-jump="sec-cfg">修改條件</button></nav>
     <section class="xcard" id="sec-scen"><h2>三個老闆最常遇到的情境</h2><p class="xlede">用你剛才輸入的條件，每個情境走一遍：異常 → 原因 → 建議 → 你的決定 → 派工 → 驗果。完成後，上面的儀表板會依結果更新。</p><div class="xscens" id="scenArea"></div></section>
     <section class="xcard" id="sec-ai"><div class="xrow"><h2>AI 經營特助</h2><span class="xrule">規則式模擬建議・未接 AI 模型</span></div><div id="aiArea"></div></section>
     <section class="xcard" id="sec-sim"><h2>改善試算</h2><p class="xlede">拉動改善幅度，看可能的效果。所有金額都附計算方式與假設，可自行修改假設；這是估算，不是保證收益。</p><div id="simArea"></div></section>
     <section class="xcard" id="sec-next"><h2>下一步</h2><p class="xlede">看完覺得有用，可以選一個方式繼續。體驗版不會傳出你輸入的任何資料。</p>
      <div class="xconvs"><button class="xconv" data-conv="card"><b>我的體驗成果卡</b><span>把儀表板重點、今日三件事和改善試算做成一張圖，可以存到手機或傳給合夥人。</span></button>
      <button class="xconv" data-conv="booking"><b>預約真實導入示範</b><span>專人用你公司的實際情況，示範每天怎麼用。</span></button>
      <button class="xconv" data-conv="line"><b>LINE 官方帳號</b><span>正式開放後，可以在 LINE 看更多工程老闆的使用方式。</span></button></div></section>
     <section class="xcard" id="sec-cfg"><h2>修改條件</h2><p class="xlede">改了之後，上面的儀表板、情境、特助和試算會立刻跟著變。</p>
      ${cfgHtml(`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-resetinp="1">恢復預設條件</button><button class="btn ghost sm" data-xgo="demo">回到 Demo</button></div>`)}</section>
     <p class="xfoot"><button class="src" id="devBtn">觀察紀錄</button></p>`;
    xpRefresh();
  }
  clampNote(); xRenderDrawer(); if(XP.dev) renderDev();
}
function clampNote(){const M=MOD(), i=XP.inp, el=$("#clampNote"); if(!el) return; const caps=M.inputs.filter(f=>f.cap&&i[f.k]>i[f.cap]);
  el.textContent=caps.length?`${caps.map(f=>f.label).join("、")}超過${M.inputs.find(x=>x.k===caps[0].cap).label}，以上限計算`:""}
function xpRefresh(){ if(MODE!=="mine") return; renderScens(); renderAI(); renderSim(); clampNote() }
function renderScens(){
  const M=MOD();
  $("#scenArea").innerHTML=Object.entries(M.scenarios).map(([id,s])=>{const done=XP.resolved[id];return `<button class="xscen ${done?"done":""}" data-scen="${id}"><span class="small muted">${id}</span><b>${s.title}</b><span class="small muted">${s.sub}</span><span class="xsteps">${STEPS.map(x=>`<span class="xstep ${done?"ok":""}">${x}</span>`).join("")}</span><span class="small" style="color:var(--blue);font-weight:700">${done?"已處理，再看一次 →":"開始體驗 →"}</span></button>`}).join("");
}
function renderAI(){
  const M=MOD(), m=curModel(), A=XP.asst, top=M.assistant(m);
  $("#aiArea").innerHTML=`<div><h3>今日最重要的三個問題</h3>${top.map((x,i)=>`<div class="xissue"><span class="xno">${i+1}</span><span><span class="xt">${esc(x.t)}</span><br><span class="xm">${esc(x.why)}</span><br><span class="xm">建議優先處理：${esc(x.task)}</span></span><span>${x.scen?`<button class="btn ghost sm" data-scen="${x.scen}">看情境</button>`:""}</span></div>`).join("")}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-asst="dispatch" ${A.tasks.length?"disabled":""}>一鍵模擬派工</button><button class="btn ghost sm" data-asst="day" ${A.tasks.length&&A.day<3?"":"disabled"}>快轉一天</button><button class="btn ghost sm" data-asst="reset" ${A.tasks.length?"":"disabled"}>重來</button></div>
   ${A.tasks.length?`<div><h3>處理進度（第 ${A.day} 天）</h3><div class="xtasks" style="margin-top:6px">${A.tasks.map(t=>{const st=A.day>=t.done?"已完成":A.day>=1?"處理中":"已派工";return `<div class="xtask"><span><b>${esc(t.task)}</b><br><span class="small muted">負責：${esc(t.who)}</span></span><span class="pill ${st==="已完成"?"green":st==="處理中"?"blue":"grey"}">${st}</span></div>`}).join("")}</div></div>
   <div><h3>改善結果</h3><div class="xcmp" style="margin-top:6px">${A.tasks.map(t=>`<div><span>${esc(t.metric[0])}</span><b>${A.day>=t.done?`${esc(t.metric[1])} → ${esc(t.metric[2])}`:esc(t.metric[1])}</b></div>`).join("")}</div>${A.day>=3?`<p class="xnote" style="margin-top:8px">三天後的模擬結果，只示範處理流程，不會改變上方儀表板（儀表板只在完成情境後更新）。正式使用時，這些數字來自每天的回報與系統紀錄。</p>`:""}</div>`:""}`;
}
function renderSim(){
  const M=MOD(), m=curModel(), s=XP.sim, a=XP.asm, r=M.sim(m,s,a);
  $("#simArea").innerHTML=`<div class="xsimgrid"><div class="xcfg" style="grid-template-columns:1fr">${M.simInputs.map(f=>`<label class="xfld"><span class="xlab">${f.label}<b id="sv-${f.k}">${s[f.k]} ${f.unit}</b></span><input type="range" data-sim="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${s[f.k]}" aria-label="${f.label}"></label>`).join("")}</div>
   <div class="xres" id="simRes">${simRes(r)}</div></div>
   <details><summary class="small" style="cursor:pointer">修改計算假設</summary><div class="xasm-edit" style="margin-top:8px">${Object.entries(M.asmLabels).map(([key,[lab]])=>`<label>${lab}<input type="text" inputmode="decimal" data-asm="${key}" value="${a[key]}"></label>`).join("")}</div></details>`;
}
function simRes(r){return r.rows.map(x=>`<div class="xresrow"><span>${x[0]}<div class="xasm">${esc(x[2])}</div></span><b>${x[1]}</b></div>`).join("")+(r.total!=null?`<div class="xresrow"><span><b>每月可能減少的成本合計</b></span><b>${F.nt(r.total)}</b></div>`:"")+`<p class="xnote">估算，不是保證收益。實際效果要看導入後的回報與紀錄。</p>`}

/* ---------- 情境流程（異常 → 原因 → 建議 → 決策 → 派工 → 驗果） ---------- */
const STEPS=["異常","原因","建議","決策","派工","驗果"];
function scenBody(){
  const sc=XP.scen, M=MOD(), m=M.model(XP.inp,{...XP.resolved,[sc.id]:false},XP.asm), Sx=M.scenarios[sc.id], d=Sx.build(m,XP.asm);
  const o=d.options.find(x=>x.id===sc.choice), m2=o?M.model(XP.inp,{...XP.resolved,[sc.id]:o.id},XP.asm):null;
  sc.demo=!NEED[sc.id](m);
  const blocks=[
   `<div class="xcard" style="border-left:5px solid var(--red)"><h3>① 異常</h3><b>${esc(d.anomaly)}</b><div style="display:flex;flex-direction:column;gap:6px">${d.evidence.map(e=>`<div class="xmsg"><div class="xwho">${esc(e[0])}</div>${esc(e[1])}${e[2]?"・"+esc(e[2]):""}</div>`).join("")}</div></div>`,
   `<div class="xcard"><h3>② 可能原因（依規則排序）</h3><ol style="margin:0;padding-left:20px">${d.causes.map(c=>`<li>${esc(c)}</li>`).join("")}</ol></div>`,
   `<div class="xcard"><h3>③ 建議方案</h3>${d.options.map(x=>`<button class="xopt" data-opt="${x.id}" aria-pressed="${sc.choice===x.id}"><b>${esc(x.t)}</b><small>${esc(x.c)}・預期：${esc(x.eff)}</small></button>`).join("")}<span class="xrule" style="align-self:flex-start">規則式模擬建議</span></div>`,
   o?`<div class="xcard"><h3>④ 老闆決策</h3><b>你選擇：${esc(o.t)}</b><span class="small muted">正式版會記下決策時間與內容，之後可回頭看效果（本版不保存）。</span></div>`:"",
   o&&sc.step>=4?(()=>{const t=d.dispatch(o);return `<div class="xcard"><h3>⑤ 派工</h3><div class="xkv"><span>負責</span><span>${esc(t.who)}</span><span>工作</span><span>${esc(t.what)}</span><span>期限</span><span>${esc(t.due)}</span></div><span class="small muted">正式版會用 LINE 通知負責人，到期未完成會提醒（本版不發送）。</span></div>`})():"",
   o&&sc.step>=5?(()=>{const v=d.verify(o,m2);return `<div class="xcard" style="border-left:5px solid var(--green)"><h3>⑥ 驗果</h3><p style="margin:0">${esc(v.text)}</p><div class="xcmp">${v.before.map((b,i)=>`<div><span>${esc(b[0])}</span><b>${esc(String(b[1]))} → ${esc(String(v.after[i][1]))}</b></div>`).join("")}</div></div>`})():""];
  return `<div class="xsteps">${STEPS.map((x,i)=>`<span class="xstep ${i<sc.step?"ok":i===sc.step?"on":""}">${x}</span>`).join("")}</div>
   ${sc.demo?`<p class="xnote" style="border-left:4px solid var(--amber)">你輸入的條件目前沒有這個問題，下面用示範數字走一遍流程，儀表板不會改變。</p>`:""}<div class="xflow">${blocks.slice(0,Math.min(sc.step+1,6)).join("")}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap">${sc.step<2?`<button class="btn" data-next="1">下一步：${STEPS[sc.step+1]}</button>`:sc.step===2?`<button class="btn" data-next="1" ${sc.choice?"":"disabled"}>${sc.choice?"確定這個決策":"先選一個方案"}</button>`:sc.step<5?`<button class="btn" data-next="1">下一步：${STEPS[sc.step+1]}</button>`:`<button class="btn" data-scenclose="1">完成，回到儀表板</button><button class="btn ghost" data-conv="booking">想用在我的公司</button>`}</div>`;
}

/* ---------- 下一步：成果卡、預約意願、LINE ---------- */
function convBody(kind){
  if(kind==="card") return `<img id="cardImg" alt="體驗成果卡" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,.12)">
   <p class="xnote">手機可以長按圖片儲存或分享。卡上的數字和你剛才看到的儀表板相同，都是依你輸入的條件模擬。</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-cardsave="1" id="cardSave" hidden>下載圖片</button><button class="btn ghost sm" data-copysum="1">複製文字版</button></div>`;
  if(kind==="line") return `<p style="margin:0">LINE 官方帳號還沒開放，這個體驗版不會開啟 LINE。</p><button class="btn" data-intent="line">我有興趣</button><div id="intentBox"></div>`;
  return `<p style="margin:0">真實導入示範：專人用你公司的實際情況，帶你走一遍每天怎麼用。</p><button class="btn" data-intent="booking">我想預約示範</button><div id="intentBox"></div>`;
}
function intentMsg(kind){
  const code=XP.code?`<br>說的時候附上體驗編號：<b>${esc(XP.code)}</b>`:"";
  return kind==="booking"?`<div class="xcard" style="border-left:5px solid var(--blue)"><b>下一步：請直接告訴陪同你的人，或回覆推薦你的人「我想預約示範」。</b><span class="small">體驗版不會傳出任何資料，所以我們不會自動收到這個按鈕的結果。${code}</span></div>`
   :`<div class="xcard" style="border-left:5px solid var(--blue)"><b>謝謝！官方帳號開放後，請推薦你的人把連結傳給你。</b><span class="small">體驗版不會傳出任何資料。${code}</span></div>`;
}
/* 成果卡與文字摘要：數字直接取自畫面上的儀表板、特助與試算，不另外計算 */
function cardData(){
  const M=MOD(), m=curModel();
  return {title:plain(XP.inp.company?`${esc(XP.inp.company)}的${ADAPT.titleTape}`:`我的${ADAPT.titleTape}`),ind:M.name,tiles:ADAPT.cardTiles(),
   top:M.assistant(m).map(x=>`${x.t} → ${x.task}`),sim:M.sim(m,XP.sim,XP.asm).rows.map(r=>[r[0],plain(r[1])]),
   done:Object.values(XP.resolved).filter(Boolean).length,code:XP.code,date:new Date().toLocaleDateString("zh-TW")};
}
function summaryText(){
  const D=cardData();
  return `${D.title}｜管理體檢摘要（模擬）\n`+D.tiles.map(t=>`・${t.h}：${t.big} ${t.unit}${t.cls==="red"?"（要處理）":""}`).join("\n")+`\n\n今日三件事：\n`+D.top.map((x,n)=>`${n+1}. ${x}`).join("\n")+`\n\n＊依輸入條件模擬，建議為規則式模擬。`;
}
function drawCard(){
  const D=cardData(), W=1080, H=1700, c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d");
  const FN='"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei",sans-serif', font=(w,px)=>g.font=`${w} ${px}px ${FN}`;
  const COL={red:"#c8402f",amber:"#c98a12",green:"#2f8a4e",hub:"#2c5fa8"};
  const rr=(x,y,w,h,r,fill)=>{g.beginPath(); if(g.roundRect) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h); g.fillStyle=fill; g.fill()};
  const wrap=(t,x,y,maxW,lh,maxL)=>{const L=[];let line="";for(const ch of t){if(line&&g.measureText(line+ch).width>maxW){L.push(line);line=ch}else line+=ch} if(line) L.push(line);
   const out=L.slice(0,maxL); if(L.length>maxL){let l=out[maxL-1]; while(l&&g.measureText(l+"…").width>maxW) l=l.slice(0,-1); out[maxL-1]=l+"…"} out.forEach((l,n)=>g.fillText(l,x,y+n*lh)); return out.length};
  g.fillStyle="#f5f3ee"; g.fillRect(0,0,W,H);
  g.fillStyle="#1f2a44"; g.fillRect(0,0,W,210);
  g.fillStyle="#c9d3e6"; font(600,32); g.fillText(`體驗成果卡｜${D.ind}`,60,72);
  g.fillStyle="#fff"; font(800,54); wrap(D.title,60,150,W-120,60,1);
  const bw=(W-60*2-24)/2, bh=210;
  D.tiles.forEach((t,n)=>{const x=60+(n%2)*(bw+24), y=250+Math.floor(n/2)*(bh+24); rr(x,y,bw,bh,22,"#fff"); g.fillStyle=COL[t.cls]||"#555"; g.fillRect(x,y+24,8,bh-48);
   g.fillStyle="#555"; font(600,30); g.fillText(t.h,x+36,y+60); g.fillStyle=COL[t.cls]||"#222"; font(800,68); wrap(String(t.big),x+36,y+142,bw-60,70,1); g.fillStyle="#666"; font(500,28); wrap(t.unit,x+36,y+184,bw-60,30,1)});
  let y=770; g.fillStyle="#1f2a44"; font(800,36); g.fillText("今日最重要的三件事",60,y); y+=20;
  D.top.forEach((t,n)=>{y+=56; g.fillStyle="#2c5fa8"; font(800,32); g.fillText(String(n+1),60,y); g.fillStyle="#222"; font(500,30); y+=(wrap(t,104,y,W-170,42,2)-1)*42});
  y+=80; g.fillStyle="#1f2a44"; font(800,36); g.fillText("改善試算（估算）",60,y);
  D.sim.forEach(r=>{y+=54; g.fillStyle="#444"; font(500,30); wrap(r[0],60,y,W-420,40,1); g.fillStyle="#222"; font(800,32); g.textAlign="right"; g.fillText(r[1],W-60,y); g.textAlign="left"});
  y+=66; g.fillStyle="#555"; font(600,28); g.fillText(`情境體驗：完成 ${D.done}／3`,60,y);
  y+=40; g.fillStyle="#e7e3da"; g.fillRect(0,y,W,120); g.fillStyle="#666"; font(500,24);
  g.fillText("模擬體驗：數字依輸入條件產生，不是實際營運資料；建議為規則式模擬。",60,y+50);
  g.fillText(`${D.code?"體驗編號 "+D.code+"・":""}${D.date}`,60,y+86);
  /* 依內容裁切高度，避免文字換行時壓到頁尾 */
  const out=document.createElement("canvas"); out.width=W; out.height=y+120; out.getContext("2d").drawImage(c,0,0); return out;
}
function getDL(){ if(!getDL.p) getDL.p=(window.claude&&window.claude.use)?Promise.resolve(window.claude.use("downloads")).catch(()=>null):Promise.resolve(null); return getDL.p }
function showCard(){const c=drawCard(); const img=$("#cardImg"); if(img) img.src=c.toDataURL("image/png"); showCard.c=c;
  getDL().then(dl=>{const b=$("#cardSave"); if(dl&&b) b.hidden=false})}

/* ---------- 體驗區抽屜（與原 Demo 抽屜分開） ---------- */
function xRenderDrawer(){
  const d=XP.xdrawer, L=$("#xlayer"); if(!d){L.innerHTML="";return}
  let h="",b="";
  if(d.kind==="scen"){const Sx=MOD().scenarios[XP.scen.id]; h=`${XP.scen.id}｜${Sx.title}`; b=scenBody()}
  if(d.kind==="conv"){h={card:"我的體驗成果卡",line:"LINE 官方帳號",booking:"預約真實導入示範"}[d.k]; b=convBody(d.k)}
  L.innerHTML=`<div class="scrim" data-xclose="1"></div><aside class="drawer xdrawer" role="dialog" aria-label="${esc(h)}"><div class="dr-h"><h2 style="font-size:18px">${esc(h)}</h2><button class="x" data-xclose="1" aria-label="關閉">×</button></div><div class="dr-b" id="xdrb">${b}</div></aside>`;
  if(d.kind==="conv"&&d.k==="card") showCard();
}

/* ---------- 觀察紀錄（只存在這個畫面） ---------- */
function obsText(){
  const ev=XP.events.filter(e=>e.ok).slice().reverse(), cnt=t=>ev.filter(e=>e.type===t).length;
  const first=ev[0], mine=ev.find(e=>e.type==="mode_mine"), last=ev[ev.length-1];
  const tally=type=>{const o={}; ev.filter(e=>e.type===type).forEach(e=>{const n=(e.mode==="mine"?"我的・":"Demo・")+ADAPT.label(e.data); o[n]=(o[n]||0)+1}); return Object.entries(o).map(([n,c])=>`${n}×${c}`).join("、")||"—"};
  return `體驗觀察摘要（只含同意記錄的操作；未同意時只有開啟與主動按下的意願）\n體驗編號：${XP.code||"無"}・來源：${SRC[XP.source].label}\n同意選擇：${XP.consent||"尚未選擇"}\n`+
   `開始到換成我的公司：${first&&mine?Math.round((mine.ms-first.ms)/1000)+" 秒":"—"}；體驗總時間：${first&&last?Math.round((last.ms-first.ms)/1000)+" 秒":"—"}\n`+
   `看過的畫面：${tally("view_open")}\n點開的細節：${tally("detail_open")}\n`+
   `調整條件 ${cnt("customize")} 次・改善試算 ${cnt("simulator_use")} 次・特助派工 ${cnt("assistant_dispatch")} 次・回到 Demo ${cnt("mode_demo")} 次\n`+
   `完成情境：${ev.filter(e=>e.type==="scenario_complete").map(e=>{const id=e.data; return `${id} ${MOD().scenarios[id].title}`}).join("、")||"—"}\n`+
   `成果卡：開啟 ${cnt("card_open")}・下載 ${cnt("card_save")}・複製文字 ${cnt("summary_request")}\n`+
   `意願：預約示範 ${cnt("booking_intent")}・LINE 有興趣 ${cnt("line_interest")}`;
}
function renderDev(){
  let el=$("#devPanel"); if(!XP.dev){ if(el) el.remove(); return }
  if(!el){el=document.createElement("section");el.id="devPanel";el.className="xcard";$("#xp").append(el)}
  el.innerHTML=`<div class="xrow"><h2 style="font-size:17px">觀察紀錄：來源與事件</h2><span class="small muted">只存在這個畫面，關掉就消失</span></div>
   <pre id="obsPre" style="white-space:pre-wrap;font-family:var(--body);background:var(--sunk);border-radius:10px;padding:10px;margin:0;font-size:13px">${esc(obsText())}</pre><div><button class="btn ghost sm" data-copyobs="1">複製觀察摘要</button></div>
   <label class="xfld"><span class="xlab">來源（由網址 #代碼決定，也可在這裡切換測試）</span><select id="srcSel">${Object.entries(SRC).map(([k,v])=>`<option value="${k}" ${XP.source===k?"selected":""}>${v.label}</option>`).join("")}</select></label>
   <div class="xkv"><span>session</span><span>${XP.session}</span><span>模式</span><span>${MODE==="mine"?"我的公司（模擬）":"Demo（示範）"}</span><span>同意</span><span>${XP.consent||"尚未選擇"}</span><span>意願</span><span>${XP.leads.length} 筆（${XP.leads.map(l=>l.kind).join("、")||"—"}）</span></div>
   <div style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto">${XP.events.map(e=>`<div class="xev"><span>${e.t}</span><span><code>${e.type}</code> ${esc(e.data)}<br><span class="muted">來源：${SRC[e.src].label}</span></span><span class="pill ${e.ok?"green":"grey"}">${e.ok?"記錄":"不記錄"}</span></div>`).join("")||`<span class="small muted">還沒有事件。</span>`}</div>`;
}

/* ---------- 體驗區事件 ---------- */
function jumpTo(id){const el=document.getElementById(id), hd=$("header.top"); if(el) window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-(hd?hd.offsetHeight:0)-8,behavior:"smooth"})}
document.addEventListener("input",e=>{const t=e.target;
  if(t.dataset.in){const f=MOD().inputs.find(x=>x.k===t.dataset.in); XP.inp[f.k]=Number(t.value); document.querySelectorAll("#v-"+f.k).forEach(x=>x.textContent=fv2(f,XP.inp[f.k])); clampNote(); regenMine(); clearTimeout(track.t1); track.t1=setTimeout(()=>track("customize",`${f.k}=${t.value}`),600); return}
  if(t.id==="in-company"){XP.inp.company=t.value.slice(0,20); if(MODE==="mine") modeChrome(); return}
  if(t.dataset.sim){const f=MOD().simInputs.find(x=>x.k===t.dataset.sim); XP.sim[f.k]=Number(t.value); $("#sv-"+f.k).textContent=`${t.value} ${f.unit}`; $("#simRes").innerHTML=simRes(MOD().sim(curModel(),XP.sim,XP.asm)); clearTimeout(track.t2); track.t2=setTimeout(()=>track("simulator_use",`${f.k}=${t.value}`),600); return}
  if(t.dataset.asm){const v=Number(t.value); if(!Number.isNaN(v)&&v>=0){XP.asm[t.dataset.asm]=v; if(MODE==="mine"){S=mineState(); render(); renderScens(); renderAI(); $("#simRes").innerHTML=simRes(MOD().sim(curModel(),XP.sim,XP.asm))}} return}
});
document.addEventListener("change",e=>{ if(e.target.id==="srcSel"){XP.source=e.target.value; track("source_set",XP.source); toast("已切換來源")} });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&XP.xdrawer){XP.xdrawer=null;xRenderDrawer()} });
document.addEventListener("click",async e=>{
  const t=e.target.closest("button"); if(!t) return; const d=t.dataset;
  if(t.id==="devBtn"){XP.dev=!XP.dev; renderDev(); if(XP.dev) $("#devPanel").scrollIntoView({block:"nearest"}); return}
  if(t.id==="xpCta"){ return MODE==="mine"?backDemo():jumpTo("sec-form") }
  if(d.xgo){ if(d.xgo==="mine") return enterMine(); if(d.xgo==="demo") return backDemo(); if(d.xgo==="form") return jumpTo("sec-form"); if(d.xgo==="cfg") return jumpTo("sec-cfg"); if(d.xgo==="top"){window.scrollTo({top:0,behavior:"smooth"});return} }
  if(d.jump) return jumpTo(d.jump);
  if(d.consent){XP.consent=d.consent; track("consent",d.consent); document.querySelectorAll(".xconsent").forEach(x=>x.remove()); return}
  if(d.resetinp){XP.inp={...MOD().defaults}; XP.resolved={}; XP.asst={tasks:[],day:0}; S=mineState(); render(); xpRender(); modeChrome(); return}
  if(d.xclose){XP.xdrawer=null; xRenderDrawer(); return}
  if(d.scen){XP.scen={id:d.scen,step:0,choice:null}; XP.xdrawer={kind:"scen"}; xRenderDrawer(); track("scenario_open",d.scen); return}
  if(d.opt){XP.scen.choice=d.opt; $("#xdrb").innerHTML=scenBody(); return}
  if(d.next){const sc=XP.scen; if(sc.step===2&&!sc.choice) return; sc.step=Math.min(5,sc.step+(sc.step===2?2:1)); $("#xdrb").innerHTML=scenBody(); $("#xdrb").scrollTop=$("#xdrb").scrollHeight;
    if(sc.step===4) track("scenario_decision",`${sc.id}:${sc.choice}`);
    if(sc.step===5){XP.resolved[sc.id]=sc.choice; track("scenario_complete",sc.id); S=mineState(); render(); renderScens(); renderAI(); $("#simRes").innerHTML=simRes(MOD().sim(curModel(),XP.sim,XP.asm))} return}
  if(d.scenclose){const demo=XP.scen.demo; XP.xdrawer=null; XP.scen=null; xRenderDrawer(); toast(demo?"示範情境完成（儀表板不變）":"儀表板已依處理結果更新"); return}
  if(d.asst){const A=XP.asst;
    if(d.asst==="dispatch"){const m=curModel(); A.tasks=MOD().assistant(m).map((x,n)=>({task:x.task,who:ADAPT.who[n%3],metric:x.metric,done:n+1})); A.day=0; track("assistant_dispatch",IND)}
    if(d.asst==="day"){A.day=Math.min(3,A.day+1); if(A.day===3) track("assistant_result",IND)}
    if(d.asst==="reset"){A.tasks=[];A.day=0}
    renderAI(); return}
  if(d.conv){XP.xdrawer={kind:"conv",k:d.conv}; xRenderDrawer(); track(d.conv==="card"?"card_open":d.conv==="line"?"line_open":"booking_open",IND); return}
  if(d.copysum){try{await navigator.clipboard.writeText(summaryText()); toast("已複製摘要")}catch(err){toast("請長按摘要文字手動複製")} track("summary_request","copy"); return}
  if(d.intent){const kind=d.intent; XP.leads.push({kind:kind==="booking"?"想預約示範":"LINE 有興趣",src:XP.source});
    track(kind==="booking"?"booking_intent":"line_interest",`${IND}${XP.source!=="direct"?"・來源 "+XP.source:""}`); t.disabled=true; $("#intentBox").innerHTML=intentMsg(kind); return}
  if(d.cardsave){const dl=await getDL(); if(!dl||!showCard.c){toast("請長按圖片儲存");return}
    const blob=await new Promise(r=>showCard.c.toBlob(r,"image/png"));
    try{await dl.save({filename:`體驗成果卡-${MOD().name.slice(0,2)}.png`,data:blob}); track("card_save",IND)}catch(err){if(err&&err.code!=="declined") toast("這個畫面不能下載，請長按圖片儲存")} return}
  if(d.copyobs){try{await navigator.clipboard.writeText(obsText()); toast("已複製觀察摘要")}catch(err){toast("請長按文字手動複製")} return}
});
function boot(){XP=freshXP(); const h=applyHash(); render(); xpRender();
  if(h==="invalid") track("invalid_code","代碼不在名單，視為直接進入");
  track("page_open",`${IND}・Demo${XP.source!=="direct"?"・來源 "+XP.source:""}`)}
boot();
