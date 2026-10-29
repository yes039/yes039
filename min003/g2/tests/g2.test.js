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
  await click('[data-conv="booking"]'); await p.fill('#cv-contact','line-test'); await click('[data-cvsend="booking"]'); ok(`${label} 水電：未勾同意不能送出預約`,!!(await p.$('.drawer')));
  await p.check('#cv-agree'); await click('[data-cvsend="booking"]'); ok(`${label} 水電：勾同意後送出`,!(await p.$('.drawer')));
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
  await click('[data-conv="summary"]'); ok(`${label} 營造：體檢摘要內容`,(await p.textContent('#drb')).includes('今日三件事')); await click('.x');
  // dev events
  await click('#devBtn'); await p.selectOption('#srcSel','P101'); await click('[data-conv="booking"]'); await p.fill('#cv-contact','x'); await p.check('#cv-agree'); await click('[data-cvsend="booking"]');
  const dev=await p.textContent('#devPanel'); ok(`${label} 歸因：預約事件帶推薦夥伴 P101`,dev.includes('booking_submit')&&dev.includes('歸因 P101'));
  ok(`${label} 版面無橫向捲動`,(await p.evaluate(()=>document.documentElement.scrollWidth))<=vw,await p.evaluate(()=>document.documentElement.scrollWidth));
  if(mobile){ const r=await p.evaluate(()=>{const g=document.querySelector('.nine').getBoundingClientRect();return [Math.round(g.width),Math.round(g.height)]}); ok('手機 九宮格 9:16',Math.abs(r[0]/r[1]-9/16)<0.02,r.join('×')); await p.screenshot({path:path.join(__dirname,'g2m.png')}); }
  else await p.screenshot({path:path.join(__dirname,'g2d.png')});
 }
 // consent off
 const q=await b.newPage(); await q.goto('file://'+mt); await q.click('[data-ind="water"]'); await q.click('[data-consent="只看不記錄"]'); await q.click('#devBtn'); await q.click('[data-tile="report"]'); await q.click('.x');
 const dv=await q.textContent('#devPanel'); ok('未同意：點九宮格不記錄',/grid_open[\s\S]*不記錄/.test(dv));
 console.log(JSON.stringify({R,errs})); await b.close();})();
