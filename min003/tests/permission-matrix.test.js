const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch(); const errs=[]; const R=[];
 const u='file://'+require('path').join(__dirname,'../prototype/MIN003獲客戰情室.html');
 const p=await b.newPage({viewport:{width:1280,height:900}}); p.on('pageerror',e=>errs.push(e.message));
 const chk=(role,item,expect,actual)=>R.push({role,item,expect,actual,pass:String(expect)===String(actual)});
 for (const [uid,role] of [['u1','總部管理者'],['u2','商務專人'],['p1','推薦夥伴']]){
  await p.goto(u+'#war'); await p.reload(); await p.waitForTimeout(200); await p.selectOption('#asUser',uid); await p.waitForTimeout(100);
  const views=await p.$$eval('.vbtn',v=>v.map(x=>x.dataset.view));
  chk(role,'可見畫面數',{u1:10,u2:9,p1:1}[uid],views.length);
  chk(role,'看得到佣金結算畫面',uid==='u1',views.includes('commission'));
  chk(role,'看得到客戶名冊',uid!=='p1',views.includes('crm'));
  if(uid!=='p1'){
   await p.click('[data-view="crm"]'); const rows=await p.$$eval('tr.click',r=>r.length);
   chk(role,'名冊筆數（全部 16／自己負責）',uid==='u1'?16:'自己負責 '+rows, uid==='u1'?rows:'自己負責 '+rows);
   const owners=await p.$$eval('tr.click td:nth-child(9)',t=>[...new Set(t.map(x=>x.textContent))]);
   chk(role,'名冊只含自己負責的客戶',uid==='u1'?'不限':'商務 A',uid==='u1'?'不限':owners.join(','));
   chk(role,'有匯入／匯出按鈕',uid==='u1',!!(await p.$('#imp'))&&!!(await p.$('#exp')));
   await p.click('tr.click'); chk(role,'可分派負責人',uid==='u1',!(await p.$eval('#f-owner',e=>e.disabled))); chk(role,'有刪除個資按鈕',uid==='u1',!!(await p.$('[data-del]'))); await p.click('.x');
   if(uid==='u2'){ await p.selectOption('#fOwner','u3').catch(()=>{}); }
   await p.click('[data-view="partners"]'); const pend=await p.$$eval('tr[data-partner] td:nth-child(11)',t=>t.map(x=>x.textContent));
   chk(role,'夥伴績效看得到佣金金額',uid==='u1',pend.some(x=>x.includes('NT$')));
   chk(role,'可裁決爭議',uid==='u1',!!(await p.$('[data-dsd]')));
   await p.click('[data-view="notify"]'); chk(role,'可修改通知規則',uid==='u1',!(await p.$eval('[data-rule]',e=>e.disabled)));
  } else {
   const txt=await p.textContent('main'); chk(role,'入口不出現其他夥伴名稱',false,/小華|林會計|陳老師|吳經理/.test(txt));
   chk(role,'入口不出現客戶電話',false,/09xx/.test(txt));
   chk(role,'入口只列自己推薦的客戶',true,(await p.$$eval('tbody tr td:first-child',t=>t.map(x=>x.textContent))).every(x=>/水電工程 02|水電工程 04/.test(x)));
   await p.fill('#rp-co','模擬水電行 03'); await p.check('#rp-ok'); await p.click('#rpSend'); const r=await p.textContent('#rpOut');
   chk(role,'報備他人保護期內客戶：不透露原夥伴',false,/小華|P002/.test(r));
   await p.fill('#rp-co','模擬水電行 88'); await p.fill('#rp-ph','0912-345-678'); await p.click('#rpSend'); chk(role,'報備填個人手機被擋下',true,(await p.textContent('#rpOut')).includes('個人手機'));
  }
 }
 // params
 await p.reload(); await p.waitForTimeout(200); await p.selectOption('#asUser','u1'); await p.click('[data-view="commission"]'); await p.fill('#cfg-rate','12'); await p.fill('#cfg-cap','1000'); await p.click('#cfgSave');
 const ver=await p.textContent('.card h2'); chk('總部管理者','參數儲存後版本 +1','參數設定（v2）',(await p.$$eval('h2',h=>h.map(x=>x.textContent))).find(x=>x.startsWith('參數設定')));
 await p.fill('#cfg-protect','10'); await p.click('#cfgSave'); chk('總部管理者','保護期超出範圍被擋下','保護期需在 30–365 天',await p.textContent('#cfgMsg'));
 await p.click('[data-view="case"]'); for(let i=0;i<6;i++){await p.click(`[data-cstep="${i}"]`)}
 await p.click('[data-view="commission"]'); const row=(await p.$$eval('tbody tr',r=>r.map(x=>x.innerText))).find(x=>x.includes('W009'))||'';
 chk('總部管理者','新佣金套用新參數（12%、上限 1,000）','NT$1,000',(row.match(/NT\$1,000/)||[''])[0]);
 chk('總部管理者','舊佣金沿用建立當時比例','NT$1,500',((await p.$$eval('tbody tr',r=>r.map(x=>x.innerText))).find(x=>x.includes('CM-0001'))||'').includes('NT$1,500')?'NT$1,500':'不符');
 console.log(JSON.stringify({R,errs},null,0)); await b.close();})();
