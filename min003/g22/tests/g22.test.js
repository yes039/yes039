/* G2.2 整合開發版驗收測試：NODE_PATH=$(npm root -g) node g22.test.js */
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const D=path.join(__dirname,'..'), T=__dirname;
const V='<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n';
const PAGES=[{ind:'water',name:'水電',orig:'demo-base/水電Demo.html',out:'out/水電工程體驗版.html',demoOnly:['板橋','中和','新莊','永和','土城','三重','樹林','蘆洲','林師傅','黃師傅'],code:'TW1',bad:'TB1'},
             {ind:'build',name:'營造',orig:'demo-base/營造Demo.html',out:'out/營造工程體驗版.html',demoOnly:['區民活動中心','社區集合住宅','國小校舍補強','廠房擴建','圖書館','林主任','周主任','許主任','吳主任'],code:'TB1',bad:'TW1'}];
/* 原 Demo 與 G2 的封版雜湊：任何修改都會讓「舊版本沒有被修改」失敗 */
const FROZEN={'demo-base/水電Demo.html':'3e347e40e0cd2016f7af91f236251959','demo-base/營造Demo.html':'cf5eae4126cc12cd2fa2661c1e976fc1','../g2/G2工程體驗版.html':'af59de272bf4fe10a78a0b92ab239dd0'};
const VIEWS=['grid','boss','overview','report','issues','summary'];
for(const p of PAGES){ for(const k of ['orig','out']) fs.writeFileSync(path.join(T,`${p.ind}-${k}.html`),V+fs.readFileSync(path.join(D,p[k]),'utf8')) }
const url=(p,k,h='')=>'file://'+path.join(T,`${p.ind}-${k}.html`)+h;
(async()=>{const b=await chromium.launch(); const R=[], errs=[];
 const ok=(name,cond,info)=>R.push({name,pass:!!cond,info:info===undefined?"":String(info).slice(0,500)});
 // ---- 7. 舊版本沒有被修改
 for(const [f,h] of Object.entries(FROZEN)){const m=crypto.createHash('md5').update(fs.readFileSync(path.join(D,f))).digest('hex'); ok(`舊版本未修改：${f}`,m===h,m)}
 for(const p of PAGES){
  for(const [vw,vh,label,mobile] of [[1280,900,'桌面',false],[390,844,'手機',true]]){
   const ctx={viewport:{width:vw,height:vh},isMobile:mobile,hasTouch:mobile};
   const o=await b.newPage(ctx), n=await b.newPage(ctx); n.on('pageerror',e=>errs.push(`${p.name}${label}:${e.message}`));
   const tap=async s=>{ if(mobile) await n.tap(s); else await n.click(s); await n.waitForTimeout(50)};
   await o.goto(url(p,'orig')); await n.goto(url(p,'out')); await n.waitForTimeout(150);
   // ---- 1. Demo 原有特色畫面完整保留：Demo 模式六個畫面與原 Demo 逐字相同
   let same=0; for(const v of VIEWS){await o.evaluate(v=>go(v),v); await n.evaluate(v=>go(v),v); if(await o.$eval('#main',e=>e.innerHTML)===await n.$eval('#main',e=>e.innerHTML)) same++}
   ok(`${p.name}${label}｜Demo 六個畫面（九宮格、老闆手機、總覽、LINE 回報、異常、摘要）與原 Demo 相同`,same===6,`${same}/6`);
   await n.evaluate(()=>go('grid'));
   // ---- 3. 首頁先展示 Demo；「換成我的公司」明顯
   const top=await n.evaluate(()=>({mode:MODE,pill:document.querySelector('#modePill').textContent,cta:(()=>{const r=document.querySelector('#xpCta').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width>0})(),bar:document.querySelector('#modeBar').innerText}));
   ok(`${p.name}${label}｜打開先看到有內容的 Demo，標示示範資料`,top.mode==='demo'&&top.pill.includes('示範')&&top.bar.includes('示範資料'),JSON.stringify(top));
   ok(`${p.name}${label}｜「換成我的公司」按鈕不用捲動就看得到`,top.cta);
   await tap('#xpCta'); await n.waitForTimeout(500);
   const formTop=await n.$eval('#sec-form',e=>Math.round(e.getBoundingClientRect().top));
   ok(`${p.name}${label}｜按「換成我的公司」捲到輸入區`,formTop>=0&&formTop<vh*0.6,formTop);
   if(mobile){const h=await n.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]); ok(`${p.name}手機｜Demo 模式沒有橫向捲動`,h[0]<=h[1],h.join('/'))}
   // ---- 輸入條件 → 產生 → 直接看到個人化九宮格
   await tap('[data-consent="同意記錄操作"]');
   const firstIn=p.ind==='water'?'sites':'projects';
   await n.$eval(`#in-${firstIn}`,(el)=>{el.value=el.max>15?12:6; el.dispatchEvent(new Event('input',{bubbles:true}))});
   await n.fill('#in-company',p.ind==='water'?'大明水電':'大成營造');
   await tap('[data-xgo="mine"]'); await n.waitForTimeout(300);
   const mine=await n.evaluate(()=>({mode:MODE,y:scrollY,view,ttl:document.querySelector('#ttl').textContent,pill:document.querySelector('#modePill').textContent,bar:document.querySelector('#modeBar').innerText,
     gridVisible:(()=>{const g=document.querySelector('.nine,.six');const r=g.getBoundingClientRect();return r.top<innerHeight})()}));
   ok(`${p.name}${label}｜產生後直接看到「我的」九宮格（回到頁首、九宮格在畫面內）`,mine.mode==='mine'&&mine.y===0&&mine.view==='grid'&&mine.gridVisible,JSON.stringify(mine));
   ok(`${p.name}${label}｜我的模式清楚標示「模擬資料、不是真實資料」與公司名`,mine.pill.includes('模擬')&&mine.bar.includes('不是真實資料')&&mine.ttl.includes(p.ind==='water'?'大明水電':'大成營造'),mine.bar);
   // ---- 2. 個人化九宮格計算正確（與模型一致）
   const chk=await n.evaluate(ind=>{const m=curModel(), bad=[];
     if(ind==='water'){const h=ADAPT.hub(), g=document.querySelector('.hub').innerText;
       const exp={n:m.S,rep:m.reported,un:m.S-m.reported,un2:m.unrep2,dec:m.decisions,od:m.O,mats:m.M};
       for(const [k,v] of Object.entries(exp)){const got=k==='mats'?h.mats.length:h[k]; if(got!==v) bad.push(`${k} ${got}≠${v}`)}
       if(h.open!==m.A+m.O+m.decShort) bad.push(`open ${h.open}`);
       if(!g.includes(`${m.reported}/${m.S}`)) bad.push('hub 今日回報');
       const tiles=document.querySelectorAll('.nine .tile:not(.empty)').length; if(tiles!==Math.min(8,m.S)) bad.push('tiles '+tiles);
     } else {const B=blocks();
       const want={decide:String(m.decisions),recv:F.wan(m.recv),subs:F.wan(m.subUnpaid),daily:`${m.P-m.missingReports}/${m.P}`,safety:String(m.defects),tender:String(m.doubts),cost:(m.margin*100).toFixed(1)+'%',proj:String(m.P)};
       for(const [k,v] of Object.entries(want)) if(String(B[k].big)!==v) bad.push(`${k} ${B[k].big}≠${v}`);
       const late=S.recv.filter(r=>r.late).reduce((a,r)=>a+r.billed-r.got,0); if(wan(late)!==F.wan(m.overdueRecv)) bad.push('逾期 '+late);
       const pd=S.changes.filter(c=>!c.done).reduce((a,c)=>a+c.amt,0); if(wan(pd)!==F.wan(m.V)) bad.push('追加減 '+pd);
       if(S.issues.filter(overdue).length!==m.defectsOver) bad.push('逾期缺失');}
     return bad},p.ind);
   ok(`${p.name}${label}｜我的九宮格數字與計算模型一致`,chk.length===0,chk.join('；'));
   // ---- 我的模式：各特色畫面都能開、不混入示範公司資料
   let leak=[]; for(const v of VIEWS){await n.evaluate(v=>go(v),v); const t=await n.$eval('#main',e=>e.innerText); p.demoOnly.forEach(w=>{if(t.includes(w)) leak.push(`${v}:${w}`)});
     if(mobile&&v!=='overview'){const h=await n.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]); if(h[0]>h[1]) leak.push(`${v} 橫向捲動 ${h[0]}`)}}
   ok(`${p.name}${label}｜我的模式六個畫面都可開啟，沒有混入示範公司資料${mobile?'、沒有橫向捲動':''}`,leak.length===0,leak.join('、'));
   await n.evaluate(()=>go('boss')); const bossTxt=await n.$eval('#main',e=>e.innerText);
   ok(`${p.name}${label}｜我的老闆手機首頁 KPI 與九宮格一致`,p.ind==='water'?bossTxt.includes(`${(await n.evaluate(()=>curModel().reported))}/${(await n.evaluate(()=>curModel().S))}`):bossTxt.includes(`${await n.evaluate(()=>{const m=curModel();return (m.P-m.missingReports)+'/'+m.P})}`));
   // LINE 回報在我的模式寫入「我的」工地
   await n.evaluate(()=>go('report')); await tap('[data-sample="report"]'); await tap('#send'); await tap('#ok');
   const wrote=await n.evaluate(ind=>{const id=chat.filter(c=>!c.me&&!c.card).pop().text.match(/到 (\S+?) 案/); return {msg:chat[chat.length-1].text, ok:!!id&&(ind==='water'?!!site(id[1]):!!proj(id[1]))}},p.ind);
   ok(`${p.name}${label}｜我的模式 LINE 回報寫入自己的${p.ind==='water'?'工地':'工程'}`,wrote.ok,wrote.msg);
   await n.evaluate(()=>go('grid'));
   // ---- 4. 異常、決策、派工、驗果
   await n.evaluate(()=>window.scrollTo(0,0));
   let flows=0; for(const sid of ['S01','S02','S03']){
     await n.evaluate(id=>document.querySelector(`.xscen[data-scen="${id}"]`).click(),sid); await n.waitForTimeout(60);
     for(let i=0;i<2;i++) await tap('[data-next]'); await tap('[data-opt="a"]'); await tap('[data-next]'); await tap('[data-next]');
     const t=await n.$eval('#xdrb',e=>e.innerText); if(['① 異常','④ 老闆決策','⑤ 派工','⑥ 驗果'].every(x=>t.includes(x))) flows++;
     await tap('[data-scenclose]'); }
   ok(`${p.name}${label}｜三個情境都走完 異常→原因→建議→決策→派工→驗果`,flows===3,flows);
   const after=await n.evaluate(ind=>{const m=curModel(); return ind==='water'?{rep:ADAPT.hub().rep,exp:m.reported,dec:ADAPT.hub().dec,expd:m.decisions}:{rep:blocks().recv.big,exp:F.wan(m.recv),dec:blocks().decide.big,expd:m.decisions}},p.ind);
   ok(`${p.name}${label}｜完成情境後儀表板依結果更新、仍與模型一致`,String(after.rep)===String(after.exp)&&+after.dec===after.expd,JSON.stringify(after));
   // ---- 5. 成果卡、推薦來源
   await n.evaluate(()=>document.querySelector('[data-conv="card"]').click()); await n.waitForTimeout(200);
   const card=await n.evaluate(()=>{const i=document.querySelector('#cardImg');return {w:i.naturalWidth,h:i.naturalHeight,shown:i.getBoundingClientRect().width,tiles:ADAPT.cardTiles().map(t=>t.big)}});
   ok(`${p.name}${label}｜成果卡產生（寬 1080、完整顯示）`,card.w===1080&&card.h>=1250&&card.shown<=vw,JSON.stringify(card));
   if(!mobile){const url64=await n.evaluate(()=>document.querySelector('#cardImg').src); fs.writeFileSync(path.join(T,`card-${p.ind}.png`),Buffer.from(url64.split(',')[1],'base64'))}
   await tap('.xdrawer .x');
   await n.evaluate(()=>document.querySelector('[data-conv="booking"]').click()); await tap('[data-intent="booking"]');
   const ib=await n.$eval('#intentBox',e=>e.innerText); ok(`${p.name}${label}｜預約意願明說不會傳出，不收聯絡方式`,ib.includes('不會傳出')&&!(await n.$('#xdrb input')),ib);
   await tap('.xdrawer .x');
   // ---- 3. 返回 Demo、修改條件、重新體驗
   await n.evaluate(()=>{XP.inp[ MODS[IND].inputs[0].k ]=3; regenMine()}); const changed=await n.evaluate(ind=>ind==='water'?S.sites.length:S.projects.length,p.ind);
   ok(`${p.name}${label}｜修改條件後儀表板立即重算`,changed===3,changed);
   await tap('#reset'); ok(`${p.name}${label}｜「重新產生」維持我的模式與條件`,await n.evaluate(ind=>MODE==='mine'&&(ind==='water'?S.sites.length:S.projects.length)===3,p.ind));
   await tap('#xpCta'); await n.waitForTimeout(150);
   let back=0; for(const v of VIEWS){await o.evaluate(v=>go(v),v); await n.evaluate(v=>go(v),v); if(await o.$eval('#main',e=>e.innerHTML)===await n.$eval('#main',e=>e.innerHTML)) back++}
   ok(`${p.name}${label}｜回到 Demo：標示示範、六個畫面恢復原 Demo、沒有我的資料`,back===6&&(await n.$eval('#modePill',e=>e.textContent)).includes('示範'),`${back}/6`);
   if(mobile){await n.evaluate(()=>go('grid')); const r=await n.evaluate(()=>{const g=document.querySelector('.nine,.six').getBoundingClientRect();return [g.width,g.height]}); ok(`${p.name}手機｜Demo 九宮格 9:16`,Math.abs(r[0]/r[1]-9/16)<0.02,r.join('×'));
     await n.evaluate(()=>enterMine()); const r2=await n.evaluate(()=>{const g=document.querySelector('.nine,.six').getBoundingClientRect();return [g.width,g.height]}); ok(`${p.name}手機｜我的九宮格 9:16`,Math.abs(r2[0]/r2[1]-9/16)<0.02,r2.join('×'));
     await n.screenshot({path:path.join(T,`m-${p.ind}-mine.png`)}); await n.evaluate(()=>backDemo()); await n.screenshot({path:path.join(T,`m-${p.ind}-demo.png`)}); }
   // 觀察紀錄
   await n.evaluate(()=>document.querySelector('#devBtn').click()); const obs=await n.$eval('#obsPre',e=>e.innerText);
   ok(`${p.name}${label}｜觀察摘要記錄換成我的公司秒數、看過的畫面、完成情境`,/開始到換成我的公司：\d+ 秒/.test(obs)&&obs.includes('老闆手機首頁')&&obs.includes('S01'),obs.slice(0,300));
   await o.close(); await n.close();
  }
  // ---- 推薦來源：#代碼
  for(const [h,exp] of [[p.code,'ok'],[p.bad,'invalid'],['P001',p.ind==='water'?'ok':'invalid']]){const e=await b.newPage(); await e.goto(url(p,'out','#'+h)); await e.waitForTimeout(120);
    const st=await e.evaluate(()=>({src:XP.source,mode:MODE,bar:document.querySelector('#modeBar').innerText,ev:XP.events.map(x=>x.type+' '+x.data)}));
    const good=exp==='ok'?st.src===h&&st.mode==='demo'&&st.bar.includes('體驗編號 '+h)&&st.ev.some(x=>x.includes('來源 '+h)):st.src==='direct'&&st.ev.some(x=>x.startsWith('invalid_code'));
    ok(`${p.name}｜入口 #${h} → ${exp==='ok'?'記錄來源、仍先看 Demo':'產業不符，視為直接進入'}`,good,JSON.stringify(st)); await e.close()}
  // ---- 2. 隨機條件：模型 ↔ 儀表板 ↔ 成果卡 ↔ 情境驗果
  {const e=await b.newPage(); await e.goto(url(p,'out'));
   const res=await e.evaluate(ind=>{const M=MODS[IND], bad=[]; const rnd=(a,b,s)=>a+Math.round(Math.random()*(b-a)/s)*s; let n=0;
    for(let r=0;r<40;r++){ const inp={...M.defaults}; M.inputs.forEach(f=>inp[f.k]=rnd(f.min,f.max,f.step)); XP.inp=inp; XP.resolved={}; enterMine(); n++; const m=curModel();
     const tiles=ADAPT.cardTiles(), D=cardData(); D.tiles.forEach((t,i)=>{if(t.big!==tiles[i].big) bad.push('卡')});
     if(ind==='water'){const h=ADAPT.hub(); if(h.rep!==m.reported||h.dec!==m.decisions||h.mats.length!==m.M||h.od!==m.O||h.un2!==m.unrep2) bad.push(`hub ${JSON.stringify(inp)}`)}
     else {const B=blocks(); if(B.decide.big!==m.decisions||B.recv.big!==F.wan(m.recv)||B.cost.big!==(m.margin*100).toFixed(1)+'%'||B.subs.big!==F.wan(m.subUnpaid)) bad.push(`blocks ${JSON.stringify(inp)}`)}
     for(const id of ['S01','S02','S03']) for(const o of ['a','b','c']){ if(!NEED[id](m)) continue; const d=M.scenarios[id].build(m,XP.asm), m2=M.model(inp,{[id]:o},XP.asm), v=d.verify(d.options.find(x=>x.id===o),m2), af=v.after.map(x=>String(x[1]));
      const exp=ind==='water'?{S01:()=>[[0,`${m2.reported}/${m2.S}`]],S02:()=>[[0,String(m2.tmrSites)]],S03:()=>[[1,String(m2.O)]]}[id]():{S01:()=>[],S02:()=>[[0,F.wan(m2.V)]],S03:()=>[[0,F.wan(m2.overdueRecv)]]}[id]();
      exp.forEach(([i,val])=>{if(af[i]!==val) bad.push(`${id}${o} ${af[i]}≠${val}`)});
      XP.resolved={[id]:o}; regenMine(); const m3=curModel();
      if(ind==='water'){const h=ADAPT.hub(); if(h.rep!==m3.reported||h.dec!==m3.decisions) bad.push(`完成 ${id}${o} 後 hub`)} else {const B=blocks(); if(B.decide.big!==m3.decisions||B.recv.big!==F.wan(m3.recv)) bad.push(`完成 ${id}${o} 後 blocks`)}
      XP.resolved={}; regenMine(); }
    } return {n,count:bad.length,bad:bad.slice(0,6)}},p.ind);
   ok(`${p.name}｜數字一致：${res.n} 組隨機條件，儀表板／成果卡／情境驗果／完成情境後都與模型相同`,res.count===0,JSON.stringify(res));
   // 沒有誤導性成功訊息
   await e.evaluate(()=>{XP.inp={...MODS[IND].defaults}; enterMine()}); const seen=[];
   const grab=async()=>seen.push(await e.evaluate(()=>document.body.innerText));
   for(const v of VIEWS){await e.evaluate(v=>go(v),v); await grab()}
   for(const sid of ['S01','S02','S03']) for(const o of ['a','b','c']){ await e.evaluate(id=>document.querySelector(`.xscen[data-scen="${id}"]`).click(),sid); await e.click('[data-next]'); await e.click('[data-next]'); await e.click(`[data-opt="${o}"]`); await e.click('[data-next]'); await e.click('[data-next]'); await grab(); await e.click('[data-scenclose]'); await grab(); await e.evaluate(()=>{XP.resolved={};regenMine()}) }
   for(const c of ['booking','line']){ await e.evaluate(c=>document.querySelector(`[data-conv="${c}"]`).click(),c); await e.click(`[data-intent="${c}"]`); await grab(); await e.click('.xdrawer .x') }
   const all=seen.join('\n'), badw=['已收到','會寄給你','專人會聯繫你','已送出','送出預約','保存 12 個月','我已加入','留聯絡方式'].filter(w=>all.includes(w));
   ok(`${p.name}｜沒有誤導性成功訊息`,badw.length===0,badw.join('、'));
   await e.close()}
 }
 console.log(JSON.stringify({R,errs})); await b.close();})();
