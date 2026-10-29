const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'../G2工程體驗版.html'), mt=path.join(__dirname,'mobiletest.html');
fs.writeFileSync(mt,'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+fs.readFileSync(src,'utf8'));
(async()=>{const b=await chromium.launch(); const R=[]; const errs=[];
 const ok=(name,cond,info)=>R.push({name,pass:!!cond,info:info||""});
 for (const [vw,vh,label,mobile] of [[1280,900,'桌面',false],[390,844,'手機',true]]){
  const p=await b.newPage({viewport:{width:vw,height:vh},isMobile:mobile,hasTouch:mobile}); p.on('pageerror',e=>errs.push(label+':'+e.message));
  const click=async s=>{ if(mobile) await p.tap(s); else await p.click(s); await p.waitForTimeout(60)};
  const setRange=async(k,v)=>{await p.$eval(`[data-in="${k}"]`,(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},v); await p.waitForTimeout(40)};
  const tileText=async k=>(await p.textContent(`[data-tile="${k}"]`)).replace(/\s+/g,' ');
  await p.goto('file://'+mt); await p.waitForTimeout(250);
  ok(`${label} 首頁兩個入口`,(await p.$$('[data-ind]')).length===2);
  // ---- 水電
  await click('[data-ind="water"]'); await click('[data-consent="同意記錄操作"]');
  const before=await tileText('report');
  await setRange('sites',12); await setRange('reportRate',50);
  const after=await tileText('report');
  ok(`${label} 水電：改工地數與回報率，今日回報格更新`,after.includes('6/12'),before+' → '+after);
  ok(`${label} 水電：明日工作與回報連動`,(await tileText('tomorrow')).includes('/12'),await tileText('tomorrow'));
  await setRange('shortage',9); const mat=await tileText('material'); ok(`${label} 水電：缺料 9 項 → 影響 5 工地、明天 3 工地`,mat.includes('9')&&mat.includes('影響 5')&&mat.includes('明天 3'),mat);
  ok(`${label} 水電：人員格閒置人日 > 0`,(await tileText('crew')).includes('閒置'),await tileText('crew'));
  await setRange('abnormal',30); ok(`${label} 水電：異常超過工地數以上限計算`,(await p.textContent('#clampNote')).length>0 && (await tileText('abnormal')).includes('12'),await tileText('abnormal'));
  await setRange('abnormal',2);
  await p.fill('#in-company','大明水電'); ok(`${label} 水電：公司名稱帶入標題`,(await p.textContent('#indTitle')).includes('大明水電的12工地')||(await p.textContent('#indTitle')).includes('大明水電 的12工地'),await p.textContent('#indTitle'));
  for (const sid of ['S01','S02','S03']){
   await click(`.scen[data-scen="${sid}"]`); for(let i=0;i<2;i++) await click('[data-next]'); await click('[data-opt="a"]'); await click('[data-next]'); await click('[data-next]');
   const txt=await p.textContent('#drb'); ok(`${label} 水電 ${sid}：六步走完到驗果`,txt.includes('⑥ 驗果')&&txt.includes('⑤ 派工')&&txt.includes('④ 老闆決策'));
   await click('[data-scenclose]');
  }
  ok(`${label} 水電：完成 S01 後回報 +1`,(await tileText('report')).includes('7/12'),await tileText('report'));
  ok(`${label} 水電：完成 S02 後明天不缺料`,(await tileText('material')).includes('明天不受影響'),await tileText('material'));
  await click('[data-asst="dispatch"]'); for(let i=0;i<3;i++) await click('[data-asst="day"]'); ok(`${label} 水電：特助派工到第 3 天全部完成`,(await p.textContent('#aiArea')).match(/已完成/g)?.length===3);
  await p.$eval('[data-sim="shortCut"]',el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true}))}); ok(`${label} 水電：試算顯示假設與非保證`,(await p.textContent('#simRes')).includes('不是保證')&&(await p.textContent('#simRes')).includes('×'));
  await click('[data-conv="booking"]'); ok(`${label} 水電：預約不收聯絡方式`,!(await p.$('#drb input')));
  await click('[data-intent="booking"]'); const ib=await p.textContent('#intentBox'); ok(`${label} 水電：預約意願明說體驗版不會傳出`,ib.includes('不會傳出')&&ib.includes('告訴陪同你的人'),ib); await click('.x');
  // ---- 營造
  await click('[data-home]'); await click('[data-ind="build"]');
  const t0=await tileText('cost'); await p.$eval('[data-in="budgetExec"]',el=>{el.value=70;el.dispatchEvent(new Event('input',{bubbles:true}))}); const t1=await tileText('cost');
  const c0=await tileText('cash');
  ok(`${label} 營造：預算執行提高 → 毛利下降`,parseFloat(t1.match(/(-?[\d.]+)%預估/)[1])<parseFloat(t0.match(/(-?[\d.]+)%預估/)[1]),t0+' → '+t1);
  ok(`${label} 營造：成本變動不影響請款收款（公式獨立）`,c0===(await tileText('cash')));
  await p.$eval('[data-in="pendingBill"]',el=>{el.value=2000;el.dispatchEvent(new Event('input',{bubbles:true}))}); ok(`${label} 營造：待請款提高 → 已請未收下降、毛利不變`,(await tileText('cash'))!==c0&&(await tileText('cost'))===t1,await tileText('cash'));
  await p.$eval('[data-in="trouble"]',el=>{el.value=3;el.dispatchEvent(new Event('input',{bubbles:true}))}); ok(`${label} 營造：異常工程增加 → 進度格轉紅`,(await p.getAttribute('[data-tile="progress"]','class')).includes('red'),await tileText('progress'));
  for (const sid of ['S01','S02','S03']){
   await click(`.scen[data-scen="${sid}"]`); for(let i=0;i<2;i++) await click('[data-next]'); await click('[data-opt="a"]'); await click('[data-next]'); await click('[data-next]');
   ok(`${label} 營造 ${sid}：六步走完到驗果`,(await p.textContent('#drb')).includes('⑥ 驗果')); await click('[data-scenclose]');
  }
  await click('[data-tile="cost"]'); ok(`${label} 營造：成本格顯示公式`,(await p.textContent('#drb')).includes('成本效率 = 應花 ÷ 已花')); await click('.x');
  await click('[data-conv="card"]'); await p.waitForTimeout(150);
  const card=await p.evaluate(()=>{const i=document.querySelector('#cardImg');return {src:i.src.slice(0,22),w:i.naturalWidth,h:i.naturalHeight,shown:i.getBoundingClientRect().width}});
  ok(`${label} 營造：成果卡產生寬 1080 圖片並完整顯示`,card.src==='data:image/png;base64,'&&card.w===1080&&card.h>=1250&&card.h<=1700&&card.shown<=vw,JSON.stringify(card)); await click('.x');
  // dev events
  await click('#devBtn'); await p.selectOption('#srcSel','P101'); await click('[data-conv="booking"]'); await click('[data-intent="booking"]'); await click('.x');
  const dev=await p.textContent('#devPanel'); ok(`${label} 歸因：預約意願帶推薦夥伴 P101`,dev.includes('booking_intent')&&dev.includes('來源 P101'));
  ok(`${label} 觀察摘要含九宮格與情境`,/點開的九宮格：[^—]/.test(dev)&&/完成情境：.*營造 S01 工程進度落後/.test(dev)&&dev.includes('預約示範 2'),dev.slice(0,400));
  ok(`${label} 版面無橫向捲動`,(await p.evaluate(()=>document.documentElement.scrollWidth))<=vw,await p.evaluate(()=>document.documentElement.scrollWidth));
  if(mobile){ const r=await p.evaluate(()=>{const g=document.querySelector('.nine').getBoundingClientRect();return [Math.round(g.width),Math.round(g.height)]}); ok('手機 九宮格 9:16',Math.abs(r[0]/r[1]-9/16)<0.02,r.join('×')); await p.screenshot({path:path.join(__dirname,'g2m.png')}); }
  else await p.screenshot({path:path.join(__dirname,'g2d.png')});
 }
 // consent off
 const q=await b.newPage(); await q.goto('file://'+mt); await q.click('[data-ind="water"]'); await q.click('[data-consent="只看不記錄"]'); await q.click('#devBtn'); await q.click('[data-tile="report"]'); await q.click('.x');
 const dv=await q.textContent('#devPanel'); ok('未同意：點九宮格不記錄',/grid_open[\s\S]*不記錄/.test(dv));
 // ---- G2.1 測試入口：網址 #代碼
 for (const [code,view,chip] of [['TW1','water',true],['TB1','build',true],['P101','build',true],['XYZ9','home',false],['','home',false]]){
  const e=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); e.on('pageerror',x=>errs.push('hash:'+x.message));
  await e.goto('file://'+mt+(code?'#'+code:'')); await e.waitForTimeout(200);
  const st=await e.evaluate(()=>({view:ST.view,src:ST.source,chip:!document.querySelector('#codeChip').hidden,chipT:document.querySelector('#codeChip').textContent,ev:ST.events.map(x=>x.type+' '+x.data)}));
  const good=st.view===view&&st.chip===chip&&(chip?st.chipT.includes(code)&&st.ev.some(x=>x.startsWith('page_open')&&x.includes('來源 '+code)):st.src==='direct');
  ok(`入口 #${code||'（無）'} → ${view}${chip?'・顯示體驗編號':''}${code==='XYZ9'?'・無效代碼視為直接進入':''}`,good&&(code!=='XYZ9'||st.ev.some(x=>x.startsWith('invalid_code'))),JSON.stringify(st));
  await e.close();
 }
 // ---- G2.1 沒有誤導性成功訊息：走過所有抽屜與情境後掃描全文
 {const e=await b.newPage(); await e.goto('file://'+mt); const seen=[];
  const grab=async()=>seen.push(await e.evaluate(()=>document.body.innerText+' '+(document.querySelector('#toastBox')?.innerText||'')));
  for (const ind of ['water','build']){
   await e.evaluate(i=>{ST.view=i;render()},ind); await grab();
   for (const sid of ['S01','S02','S03']) for (const o of ['a','b','c']){ await e.click(`.scen[data-scen="${sid}"]`); await e.click('[data-next]'); await e.click('[data-next]'); await e.click(`[data-opt="${o}"]`); await e.click('[data-next]'); await e.click('[data-next]'); await grab(); await e.click('[data-scenclose]'); await grab(); }
   for (const c of ['card','booking','line']){ await e.click(`[data-conv="${c}"]`); await e.waitForTimeout(80); if(c!=='card') await e.click(`[data-intent="${c}"]`); await grab(); await e.click('.x'); }
   await e.click('[data-asst="dispatch"]'); for(let i=0;i<3;i++) await e.click('[data-asst="day"]'); await grab();
  }
  const all=seen.join('\n'), bad=['已收到','會寄給你','專人會聯繫你','已送出','送出預約','保存 12 個月','我已加入','留聯絡方式'].filter(w=>all.includes(w));
  ok('沒有誤導性成功訊息（已收到／會寄給你／專人會聯繫等字樣為 0）',bad.length===0,bad.join('、'));
  await e.close();}
 // ---- G2.1 數字一致：隨機 40 組條件 × 2 產業
 {const e=await b.newPage(); await e.goto('file://'+mt);
  const res=await e.evaluate(()=>{const bad=[]; let n=0; const rnd=(a,b,s)=>a+Math.round(Math.random()*(b-a)/s)*s;
   for(let r=0;r<40;r++) for(const k of ['water','build']){ const M=MODS[k]; const inp={...M.defaults}; M.inputs.forEach(f=>inp[f.k]=rnd(f.min,f.max,f.step)); ST.view=k; ST.inp[k]=inp; ST.resolved[k]={}; const a=ST.asm[k];
    const m=M.model(inp,{},a), tiles=M.tiles(m), cd=cardData(), sum=summaryText(); n++;
    cd.tiles.forEach(t=>{const g=tiles.find(x=>x.h===t.h); if(plain(g.big)!==t.big) bad.push(`${k} 成果卡 ${t.h} ${t.big}≠${plain(g.big)}`)});
    tiles.filter(t=>t.k!=='ai').forEach(t=>{if(!sum.includes(`${t.h}：${plain(t.big)} ${t.unit}`)) bad.push(`${k} 摘要缺 ${t.h}`)});
    if(k==='water'){const ai=tiles.find(t=>t.k==='ai'); const c=M.assistant(m).filter(x=>x.s>1).length; if(Number(ai.big)!==c) bad.push(`特助格 ${ai.big}≠${c}`)}
    for(const id of ['S01','S02','S03']) for(const o of ['a','b','c']){ const d=M.scenarios[id].build(m,a), m2=M.model(inp,{[id]:o},a), v=d.verify(d.options.find(x=>x.id===o),m2), af=v.after.map(x=>String(x[1])), demo=!NEED[k][id](m);
     if(demo) continue;
     const exp=k==='water'?{S01:[[0,`${m2.reported}/${m2.S}`],[1,String(m2.sites.filter(x=>x.light==='red').length)]],S02:[[0,String(m2.tmrSites)]],S03:[[1,String(m2.O)]]}[id]
      :{S01:()=>o==='c'?[]:[[0,`${Math.round(m2.projects.find(x=>x.late).plan-m2.projects.find(x=>x.late).prog)}%`]],S02:()=>[[0,F.wan(m2.V)]],S03:()=>[[0,F.wan(m2.overdueRecv)]]}[id]();
     exp.forEach(([i,val])=>{if(af[i]!==val) bad.push(`${k} ${id}${o} 驗果「${v.after[i][0]}」${af[i]} ≠ 九宮格 ${val}`)});
     const bef=k==='water'?{S01:[[0,`${m.reported}/${m.S}`]],S02:[[0,String(m.tmrSites)]],S03:[[1,String(m.O)]]}[id]:{S01:[],S02:[[0,F.wan(m.V)]],S03:[[0,F.wan(m.overdueRecv)]]}[id];
     bef.forEach(([i,val])=>{if(String(v.before[i][1])!==val) bad.push(`${k} ${id} 處理前「${v.before[i][0]}」${v.before[i][1]} ≠ 九宮格 ${val}`)});
    }}
   ST.inp={water:{...MODS.water.defaults},build:{...MODS.build.defaults}}; return {n,bad:bad.slice(0,8),count:bad.length}});
  ok(`數字一致：${res.n} 組隨機條件，成果卡／摘要／特助格／情境驗果與九宮格相同`,res.count===0,JSON.stringify(res));
  // 選 c「改排工項」：明天仍缺料但不閒置
  await e.evaluate(()=>{ST.view='water';ST.inp.water={...MODS.water.defaults};ST.resolved.water={};render()});
  await e.click('.scen[data-scen="S02"]'); await e.click('[data-next]'); await e.click('[data-next]'); await e.click('[data-opt="c"]'); await e.click('[data-next]'); await e.click('[data-next]'); await e.click('[data-scenclose]');
  const mt2=(await e.textContent('[data-tile="material"]')), cr=(await e.textContent('[data-tile="crew"]'));
  ok('水電 S02 選「改排工項」：材料格仍顯示明天缺料、人員格無閒置',/明天 \d+ 個工地會缺/.test(mt2)&&cr.includes('沒有閒置'),mt2+' | '+cr);
  await e.evaluate(()=>{ST.inp.water.unrep2=0;ST.inp.water.reportRate=100;render()});
  await e.click('.scen[data-scen="S01"]'); ok('條件沒有該問題時，情境標示示範數字',(await e.textContent('#drb')).includes('示範數字'));
  await e.close();}
 // ---- 成果卡樣張（預設條件）
 {const e=await b.newPage(); await e.goto('file://'+mt);
  for (const [k,name] of [['water','水電'],['build','營造']]){ await e.evaluate(k=>{ST.view=k;render()},k); await e.click('[data-conv="card"]'); await e.waitForTimeout(150);
   const url=await e.evaluate(()=>document.querySelector('#cardImg').src); fs.writeFileSync(path.join(__dirname,`card-${k}.png`),Buffer.from(url.split(',')[1],'base64')); await e.click('.x'); }
  await e.close();}
 console.log(JSON.stringify({R,errs})); await b.close();})();
