/* =================== 水電：模型 → 原 Demo 資料結構 =================== */
/* 由 WATER.model 的工地明細產生 sites／reports／issues／mats，讓九宮格、老闆手機、工地總覽、LINE 回報直接沿用 */
const NEED={S01:m=>m.unrep2>0,S02:m=>m.tmrSites>0,S03:m=>m.O>0};
const W_TYPE=["透天新建","公寓翻修","店面裝修","住宅抓漏","廠房配電","住宅新建","診所裝修","辦公室裝修","餐廳裝修","大樓給排水"];
const W_LEAD=["李主任","黃主任","吳主任","劉主任","蔡主任","楊主任","許主任","鄭主任","謝主任","郭主任","洪主任","曾主任","邱主任","廖主任","賴主任","周主任","王主任","陳主任","張主任","林主任"];
const W_DONE=["給水管配管","配電盤安裝","排水管配管","弱電配線","衛浴設備安裝","管路測壓"], W_TMR=["續做配管","送電測試","下一層排水","設備定位","弱電收尾","試水"];
const W_ISS=[["品質","浴室天花板滲水，疑似冷水管接頭"],["業主變更","業主要多加 3 個插座，還沒報價"],["品質","熱水器型號跟圖面不符，要確認裝哪一台"],["停工","天花板內舊管線破損，要等業主決定"],["品質","配電箱位置與圖面不符"],["業主變更","業主要改浴室排水位置"]];
const W_MAT=[["1/2 吋彎頭","20 個"],["4 分 PVC 管","10 支"],["2.0mm² 電線","5 捲"],["給水球閥","6 個"],["排水 S 彎","8 個"],["配電箱","1 組"],["地板落水頭","4 個"]];
const VIEW_NAME=Object.fromEntries(VIEWS);
const ADAPT={
 titleTape:"工程管理儀表板", demoTitle:`水電公司<span class="tape">工程管理儀表板</span>`, demoPill:"示範資料・非真實工地", demoSize:"8 個工地",
 mineSize:i=>`${i.sites} 個工地`, namePh:"例如：大明水電", overviewName:"工地總覽", who:["主任","行政","老闆"],
 label:x=>{const [k,id]=String(x).split(":"); if(VIEW_NAME[k]) return VIEW_NAME[k]; return k==="site"?`${id} 案`:k==="msg"?"原話":x},
 mine(m,i){
  const S0={sites:[],msgs:{},reports:{},lastProgress:{},issues:[],mats:[],reminded:{},feedback:null,seq:1};
  const nL=Math.min(Math.max(1,i.leads),W_LEAD.length), idOf=x=>W_LET[x.id-1], leadOf=x=>W_LEAD[(x.id-1)%nL];
  m.sites.forEach((x,k)=>{const id=W_LET[k], lead=W_LEAD[k%nL];
   const s={id,name:W_TYPE[k%10]+(k>=10?"二期":""),lead,phase:"施工中"}; if(x.unrep2) s.last="10/26"; S0.sites.push(s);
   if(x.unrep){ S0.lastProgress[id]=x.actual; return }
   const mid=`M-${id}R`, done=W_DONE[k%6], tmr=x.tmr?"等材料到再施工":W_TMR[k%6], time=`17:${String(5+(k*7)%50).padStart(2,"0")}`;
   S0.msgs[mid]={site:id,who:lead,time,kind:"文字（模擬）",text:`${id}案今天${done}，大概${x.actual}%，${x.crew}個人，明天${tmr}`};
   S0.reports[id]={id:"R-1028-"+id,time,src:mid,f:{done:[done,"ai"],progress:[x.actual,"ai"],crew:[x.crew,"ai"],tomorrow:[tmr,"ai"]},hist:[]};
  });
  S0.msgs["M-A0"]={site:"A",who:W_LEAD[0],time:"07:31",kind:"文字（模擬）",text:"今天A案出工人數回報"};
  /* 異常：前「異常 ÷ 2」件要老闆決定；落後工地逾期（紅燈）；明天缺料另開一件老闆決定 */
  m.sites.filter(x=>x.abnormal).forEach((x,j)=>{const id=idOf(x), [type,title]=W_ISS[j%W_ISS.length], mid=`M-${id}I${j}`;
   S0.msgs[mid]={site:id,who:leadOf(x),time:"14:20",kind:"文字＋照片 1 張（模擬）",text:title};
   S0.issues.push({id:`I-1028-${id}${j+1}`,site:id,type,level:2,title,owner:leadOf(x),due:"10/30",status:"新開",boss:j<m.decAbn,src:mid,log:[]})});
  m.sites.filter(x=>x.late).forEach((x,j)=>{const id=idOf(x), mid=`M-${id}L`;
   S0.msgs[mid]={site:id,who:leadOf(x),time:"10/25 17:00",kind:"文字（模擬）",text:`${id}案進度預定 ${x.planned}%，實際 ${x.actual}%`};
   S0.issues.push({id:`I-1025-${id}L`,site:id,type:"進度落後",level:2,title:`進度落後 ${x.lag}%（預定 ${x.planned}%、實際 ${x.actual}%）`,owner:leadOf(x),due:"10/27",status:"處理中",boss:j===0&&m.decLate===1,src:mid,log:[]})});
  if(m.decShort){const x=m.sites.find(s=>s.tmr), id=idOf(x), mid=`M-${id}D`;
   S0.msgs[mid]={site:id,who:leadOf(x),time:"16:40",kind:"文字（模擬）",text:"明天要用的材料還沒到，要不要叫急件？"};
   S0.issues.push({id:`I-1028-${id}M`,site:id,type:"缺料",level:2,title:"明天會缺料，要不要急件叫料？",owner:leadOf(x),due:"10/29",status:"新開",boss:true,src:mid,log:[]})}
  /* 缺料待辦：M 項平均分到缺料工地；明天會缺的還沒叫料 */
  const shortS=m.sites.filter(x=>x.short);
  for(let j=0;j<m.M&&shortS.length;j++){const x=shortS[j%shortS.length], id=idOf(x), [item,qty]=W_MAT[j%W_MAT.length], mid=`M-${id}T${j}`;
   S0.msgs[mid]={site:id,who:leadOf(x),time:"16:50",kind:"文字（模擬）",text:`${id}案缺${item}${qty}`};
   S0.mats.push({id:`M-1028-${id}${j+1}`,site:id,item,qty,need:x.tmr?"10/29 上午":"10/31",status:x.tmr?"提出":"已叫料",src:mid})}
  return S0;
 },
 hub(){const n=S.sites.length, un=unreported(), rep=n-un.length, open=S.issues.filter(i=>i.status!=="結案"), od=open.filter(overdue).length;
  return {n,rep,un:un.length,un2:un.filter(s=>days(s)>=2).length,dec:open.filter(i=>i.boss).length,open:open.length,od,mats:S.mats.filter(m=>m.status!=="已到場"),tmr:S.mats.some(m=>m.status==="提出"&&/10\/29/.test(m.need))}},
 cardTiles(){const h=ADAPT.hub();
  return [{h:"今日回報",big:`${h.rep}/${h.n}`,unit:"工地已回報",cls:h.un2?"red":h.un?"amber":"green"},{h:"要你決定",big:String(h.dec),unit:"件",cls:"hub"},
   {h:"未結異常",big:String(h.open),unit:`件・逾期 ${h.od}`,cls:h.od?"red":h.open?"amber":"green"},{h:"缺料待辦",big:String(h.mats.length),unit:"項",cls:h.tmr?"red":h.mats.length?"amber":"green"}]}
};
