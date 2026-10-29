/* =================== 營造：模型 → 原 Demo 資料結構 =================== */
/* 由 BUILD.model 的進度、成本、現金流（各自獨立計算）產生 projects／decide／subs／recv／changes／cost…，原有九宮格與各畫面直接沿用 */
const NEED={S01:m=>m.X>0,S02:m=>m.V>0,S03:m=>m.overdueRecv>0};
/* 金額顯示與原 Demo 相同：先換成整數元，再用原 Demo 的 wan()；分配到各工程時用最大餘數法，合計必等於總額 */
F.wan=x=>wan(Math.round(x*10000));
const NT=x=>Math.round(x*10000);
function apportion(total,weights){const s=weights.reduce((a,b)=>a+b,0); if(!s){const o=weights.map(()=>0); if(o.length) o[0]=total; return o}
  const raw=weights.map(w=>total*w/s), fl=raw.map(Math.floor); let rem=total-fl.reduce((a,b)=>a+b,0);
  raw.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(rem>0){fl[i]++;rem--}}); return fl}
const B_NAME=["市民運動中心新建","集合住宅新建","國中校舍補強","倉儲廠房增建","物流中心新建","辦公大樓新建","橋梁耐震補強","污水廠擴建","社會住宅新建","醫院增建"];
const B_LEAD=["陳主任","黃主任","張主任","李主任","王主任","劉主任","蔡主任","楊主任","鄭主任","謝主任"];
const B_SUB=["鋼筋工程","水電工程","防水工程","鋼構工程","模板工程","機電工程","帷幕工程","景觀工程"];
const B_DEF=[["工安","樓板開口未設護欄（監造巡查缺失）"],["品質","柱筋保護層不足，改善後重新查驗"],["工安","吊車作業未設警戒區"],["工安","外牆鷹架繫牆桿不足"],["品質","模板支撐間距過大"],["品質","混凝土試體未依規定取樣"],["工安","施工架未設上下設備"],["品質","鋼筋續接長度不足"]];
const B_ACT=["補足現場人力","送審材料樣品","確認進場日期與機具","安排業主初驗","提送施工計畫","辦理估驗計價"];
const B_DONE=["柱牆模板組立、鋼筋綁紮","隔間砌磚","教室收尾油漆","鋼柱吊裝","樓板混凝土澆置","外牆打底"], B_TMR=["柱筋查驗","粉刷","與業主約初驗","吊鋼樑","養護","外牆貼磚"];
const B_DOUBT=[["工項數量與圖面不一致","p.58"],["電梯規格未註明載重","p.112"],["第 4 章缺頁","—"],["鋼筋單價分析表缺少損耗率","p.66"],["臨時用電是否含於假設工程","p.40"],["景觀植栽保活期未寫","p.131"],["工期與附件甘特圖不符","p.6"],["機電介面責任未寫清楚","p.88"],["保留款扣款比例前後不一","p.9"]];
const VIEW_NAME=Object.fromEntries(VIEWS);
const ADAPT={
 titleTape:"管理儀表板", demoTitle:`營造公司<span class="tape">管理儀表板</span>`, demoPill:"示範資料・非真實工程", demoSize:"4 件工程",
 mineSize:i=>`${i.projects} 件工程`, namePh:"例如：大成營造", overviewName:"工程總覽", who:["工務","會計","老闆"],
 label:x=>{const [k,id]=String(x).split(":"); if(VIEW_NAME[k]) return VIEW_NAME[k]; return k==="blk"?BTITLE[id]:k==="site"?`${id} 案`:k==="msg"?"原話":x},
 mine(m,i){
  const P=m.P, W=10000, w=m.projects.map(q=>q.w), ws=w.reduce((a,b)=>a+b,0), share=k=>w[k]/ws, pid=k=>B_PID[k];
  const S0={projects:[],msgs:{},reports:{},issues:[],decide:[],tender:null,subs:[],recv:[],changes:[],actions:[],cost:[],reminded:{},feedback:null,seq:1};
  const miss=m.missingReports;
  m.projects.forEach((q,k)=>{const id=pid(k), lead=B_LEAD[k%10];
   S0.projects.push({id,name:B_NAME[k%10]+(k>=10?"二期":""),kind:k%2?"民間":"公共",lead,plan:Math.round(q.plan),act:Math.round(q.prog)});
   if(k>=P-miss) return;
   const mid=`M-${id}R`, done=B_DONE[k%6], tmr=B_TMR[k%6], wx=["晴","陰","晴","雨"][k%4], crew=`模板 ${6+k%4}、鋼筋 ${4+k%3}（${10+k%4+k%3} 人）`, eq=k%3===0?"吊車 1":"—", time=`10/27 17:${String(10+(k*7)%45).padStart(2,"0")}`;
   S0.msgs[mid]={p:id,who:lead,time,kind:"語音＋照片（模擬）",text:`${id}案今天${wx}，${crew}，${done}${eq!=="—"?"，吊車一台":""}，明天${tmr}`};
   S0.reports[id]={id:"DR-1027-"+id,time,src:mid,f:{weather:[wx,"ai"],crew:[crew,"ai"],done:[done,"ai"],equip:[eq,eq==="—"?"rule":"ai"],tomorrow:[tmr,"ai"]},hist:[]};
  });
  /* 待決策：落後、未簽追加減、逾期應收、成本效率，與特助和情境同一套條件 */
  const A2=["照建議處理","暫緩"], lateQ=m.projects.findIndex(q=>q.late);
  if(m.X){const p=S0.projects[lateQ]; S0.decide.push({id:"D-1",kind:"進度",p:p.id,title:`${p.id}案進度落後 ${p.plan-p.act}%，要不要增派班組？`,detail:`應達 ${p.plan}%、實際 ${p.act}%。建議要求分包增派班組，每日回報人數。`,done:null,acts:A2})}
  if(m.V>0) S0.decide.push({id:"D-2",kind:"追加減",p:pid(0),title:`追加減 ${F.wan(m.V)} 尚未簽認`,detail:"已施作卻沒簽，就不能請款。建議一週內補齊變更單與照片送業主簽認。",done:null,acts:A2});
  if(m.overdueRecv>0) S0.decide.push({id:"D-3",kind:"收款",p:pid(0),title:`逾期應收 ${F.wan(m.overdueRecv)}，要不要啟動催收？`,detail:`${m.netCash>0?`淨現金約可撐 ${F.d1(m.coverWeeks)} 週。`:"淨現金已為負。"}建議發催收函並約業主財務窗口。`,done:null,acts:A2});
  if(m.CPI<0.97) S0.decide.push({id:"D-4",kind:"成本",p:pid(0),title:`成本效率 ${m.CPI.toFixed(2)}，預估毛利 ${F.pct1(m.margin)}`,detail:"花得比進度快，毛利會被吃掉。建議逐項檢查超支科目。",done:null,acts:A2});
  /* 標案 */
  S0.tender={name:"新標案・社區活動中心新建（模擬）",items:120+30*m.bids,due:"11/05",
   clauses:[["逾期罰款","每日契約總價千分之一，上限 20%","第 18 條，p.24"],["保固","結構 5 年、其他 2 年","第 21 條，p.31"],["押標金","依招標文件","投標須知 第 7 點"],["估驗","每月一次，扣 5% 保留款","第 5 條，p.9"]],
   doubts:Array.from({length:m.doubts},(_,j)=>{const d=B_DOUBT[j%B_DOUBT.length], n=Math.floor(j/B_DOUBT.length); return [d[0]+(n?`（第 ${n+1} 件標案）`:""),d[1],0]})};
  /* 分包：總額、已估、已付依合約比例分配；前「異常 ÷ 2」件有請款差異 */
  const sv=apportion(NT(m.subValued),w), su=apportion(NT(m.subUnpaid),w), sc=apportion(NT(m.subTotal),w);
  m.projects.forEach((q,k)=>{const pr=Math.round(q.prog);
   S0.subs.push({p:pid(k),name:B_SUB[k%8],contract:sc[k],valued:sv[k],paid:sv[k]-su[k],next:`11/${String(5+k%20).padStart(2,"0")} 第 ${2+k%3} 期`,...(k<m.subFlag?{flag:`請款 ${pr+12}%，現場 ${pr}%`}:{})})});
  /* 業主款：已收依合約比例；逾期金額只放在落後工程，其餘未收放在其他工程 */
  let Ls=m.projects.map((q,k)=>q.late?k:-1).filter(k=>k>=0); if(!Ls.length) Ls=[0]; if(Ls.length===P&&P>1) Ls=Ls.slice(0,P-1);
  const nonL=[...Array(P).keys()].filter(k=>!Ls.includes(k)), odT=NT(m.overdueRecv), rest=NT(m.recv)-odT;
  const outL=apportion(odT,Ls.map(k=>w[k])), outN=apportion(nonL.length?rest:0,nonL.map(k=>w[k])), gotA=apportion(NT(m.received),w);
  m.projects.forEach((q,k)=>{const inL=Ls.includes(k), out=inL?outL[Ls.indexOf(k)]:outN[nonL.indexOf(k)], j=Ls.indexOf(k);
   S0.recv.push({p:pid(k),billed:out+gotA[k],got:gotA[k],next:`11/${String(10+k%18).padStart(2,"0")} 第 ${3+k%3} 期`,...(inL&&out>0?{late:18+9*j}:{})})});
  if(!nonL.length&&rest>0) S0.recv.push({p:pid(0),billed:rest,got:0,next:"本期估驗款"});
  /* 追加減：金額拆成三筆（與情境 S02 相同），另一筆已核定 */
  if(m.V>0){const va=apportion(NT(m.V),[5,3,2]); [["機電管線改道"],["地坪材質變更"],["外牆開口增設"]].forEach(([t],j)=>S0.changes.push({id:"C"+(j+1),p:pid(j%P),text:t,amt:va[j],status:"待業主簽認",done:false}))}
  S0.changes.push({id:"C9",p:pid(0),text:"機關追加無障礙坡道",amt:m.C*0.01*W,status:"已核定",done:true});
  /* 會議決議 */
  for(let j=0;j<m.openDecisions;j++) S0.actions.push({id:"A"+(j+1),p:pid(j%P),text:B_ACT[j%B_ACT.length],who:B_LEAD[(j%P)%10],due:j<m.lateDecisions?"10/25":["10/30","10/31","11/04","11/06"][j%4],done:false});
  /* 成本：預算與已花依合約比例；各工程毛利加權平均＝模型預估毛利 */
  const dev=m.projects.map((q,k)=>(seedRand(k+3)-.5)*4), dbar=dev.reduce((a,d,k)=>a+d*w[k],0)/ws;
  m.projects.forEach((q,k)=>S0.cost.push({p:pid(k),budget:m.budget*share(k)*W,actual:m.AC*share(k)*W,progress:Math.round(q.prog),margin:m.margin*100+dev[k]-dbar}));
  /* 工安品質缺失：逾期的放前面 */
  for(let j=0;j<m.defects;j++){const k=j%P, id=pid(k), [type,title]=B_DEF[j%B_DEF.length], mid=`M-${id}Q${j}`, od=j<m.defectsOver;
   S0.msgs[mid]={p:id,who:B_LEAD[k%10],time:od?"10/24 14:30":"10/27 16:10",kind:"照片＋文字（模擬）",text:title};
   S0.issues.push({id:`Q-${od?"1024":"1027"}-${id}${j+1}`,p:id,type,title,owner:B_LEAD[k%10],due:od?"10/26":"10/31",status:od?"處理中":"新開",src:mid,log:[],hist:[]})}
  return S0;
 },
 cardTiles(){const B=blocks(), pd=S.changes.filter(c=>!c.done), sum=pd.reduce((a,c)=>a+c.amt,0), col=c=>c==="decide"?"hub":c;
  return [{h:B.decide.h,big:String(B.decide.big),unit:"件",cls:"hub"},{h:B.recv.h,big:B.recv.big,unit:B.recv.unit,cls:col(B.recv.cls)},
   {h:B.change.h,big:(sum<0?"−":"")+wan(Math.abs(sum)),unit:`${pd.length} 件尚未簽認`,cls:col(B.change.cls)},{h:B.cost.h,big:B.cost.big,unit:B.cost.unit,cls:col(B.cost.cls)}]}
};
