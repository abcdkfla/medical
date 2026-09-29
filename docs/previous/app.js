const defaults = [
  {name:'글루코스 (C₆H₁₂O₆)', amount:20, role:'carbon',note:'탄소원 (C)'},
  {name:'(NH₄)₂SO₄', amount:5, role:'nitrogen',note:'질소원 (N)'},
  {name:'KH₂PO₄', amount:1, role:'buffer',note:'완충제 / 인산원'},
  {name:'K₂HPO₄', amount:3, role:'buffer',note:'완충제 / 인산원'},
  {name:'MgSO₄·7H₂O', amount:.5, role:'mineral',note:'보조인자 (Mg²⁺)'},
  {name:'미량원소 용액', amount:1, role:'trace',note:'금속이온 (Fe, Zn 등)'},
  {name:'비타민 용액', amount:1, role:'vitamin',note:'비타민 (B₁, B₇ 등)'}
];
let reagents = defaults.map(x=>({...x}));
let strain = 'bl21', horizon = 24, chartKey = 'X', lastResult = null;
let simIndex = 0, simTimer = null, simRunning = false;
const $ = s => document.querySelector(s);
const el = id => document.getElementById(id);
const params = {
  bl21:{name:'E. coli BL21', mumax:.7,Ks:.05,Yxs:.48,mS:.04,qscrit:1,Topt:37,pHopt:7,qO2:10},
  cg:{name:'C. glutamicum',mumax:.44,Ks:.05,Yxs:.5,mS:.079,qscrit:99,Topt:30,pHopt:7,qO2:8.2}
};
const chartMeta={X:['BIOMASS X','g/L','#36e2c3'],S:['GLUCOSE S','g/L','#6ea8fe'],DO:['DISSOLVED OXYGEN','%','#ffcb6b'],pH:['CULTURE pH','pH','#c792ea'],A:['ACETATE A','g/L','#ff7a90'],V:['WORKING VOLUME','L','#86b7fe']};

function renderReagents(){
  el('reagentRows').innerHTML='';
  reagents.forEach((r,i)=>{
    const row=document.createElement('div');row.className='reagent-row';
    row.innerHTML=`<span class="drag-handle">⠿</span><input aria-label="시약 이름" class="reagent-name" value="${r.name}"><div class="amount-wrap"><input aria-label="투입량" class="amount" type="number" min="0" step="0.001" value="${r.amount}"></div><input aria-label="비고" class="reagent-note" value="${r.note||''}"><button class="delete-reagent" aria-label="${r.name} 삭제">⊖</button>`;
    row.querySelector('.reagent-name').addEventListener('input',e=>{reagents[i].name=e.target.value; inferRole(reagents[i]); updateMediaCalc()});
    row.querySelector('.amount').addEventListener('input',e=>{reagents[i].amount=Math.max(0,+e.target.value||0);updateMediaCalc()});
    row.querySelector('.reagent-note').addEventListener('input',e=>{reagents[i].note=e.target.value});
    row.querySelector('button').addEventListener('click',()=>{reagents.splice(i,1);renderReagents();updateMediaCalc()});
    el('reagentRows').append(row);
  });
}
function inferRole(r){const n=r.name.toLowerCase();r.role=/glucose|글루코스|glycerol|글리세롤|sucrose|sugar|당/.test(n)?'carbon':/nh₄|암모|urea|요소|질소|ammon/.test(n)?'nitrogen':'other'}
function mediaStats(){
  const carbon=reagents.filter(r=>r.role==='carbon').reduce((a,r)=>a+r.amount,0);
  const n=reagents.filter(r=>r.role==='nitrogen').reduce((a,r)=>a+r.amount*(/\(nh₄\)₂so₄|\(NH₄\)₂SO₄/i.test(r.name)?0.212:0.20),0);
  return {S0:carbon,N0:n,ratio:n?carbon/n:Infinity,Xmax:carbon*params[strain].Yxs};
}
function updateMediaCalc(){const m=mediaStats();el('s0Calc').innerHTML=`${m.S0.toFixed(1)} <small>g/L</small>`;el('n0Calc').innerHTML=`${m.N0.toFixed(2)} <small>g/L</small>`;el('cnCalc').textContent=isFinite(m.ratio)?`${m.ratio.toFixed(1)} : 1`:'—';el('xmaxCalc').innerHTML=`${m.Xmax.toFixed(2)} <small>g/L</small>`;const limited=m.N0<m.Xmax*.11;const a=el('limitAlert');a.className='limit-alert '+(limited?'warn':'ok');a.innerHTML=limited?'<i>!</i><span>질소 제한 가능성이 있습니다</span>':'<i>✓</i><span>질소 공급이 충분합니다</span>'}
function addReagent(){reagents.push({name:'새 시약',amount:0,role:'other',note:'사용자 정의'});renderReagents();updateMediaCalc();const inputs=document.querySelectorAll('.reagent-name');inputs[inputs.length-1].focus();inputs[inputs.length-1].select()}
function updateControls(){
  document.querySelectorAll('.range-row input').forEach(input=>input.nextElementSibling.textContent=(input.id==='rpm'?Number(input.value).toFixed(0):Number(input.value).toFixed(1)));
  const air=+el('air').value,o2=+el('o2').value,V=Math.min(4,Math.max(.2,+el('v0').value||2)),gas=air+o2;
  el('vvmRead').textContent=`${(gas/V).toFixed(2)} vvm`;el('yo2Read').textContent=`${(gas?(0.21*air+o2)/gas*100:0).toFixed(1)}%`;el('gasRead').textContent=`${gas.toFixed(1)} L/min`;
}
function simulate(){
  const p=params[strain],m=mediaStats(),dt=.05,steps=Math.round(horizon/dt),data={t:[],X:[],S:[],DO:[],pH:[],A:[],V:[],mu:[],OTR:[],OUR:[]};
  let X=Math.max(.01,+el('x0').value||.12),S=m.S0,DO=95,ph=p.pHopt,A=0,V=Math.min(4,Math.max(.2,+el('v0').value||2));
  const air=+el('air').value,o2=+el('o2').value,rpm=+el('rpm').value,F=+el('feed').value/1000,Fb=+el('base').value/1000,Fa=+el('acid').value/1000,Ffoam=+el('foam').value/1000,Sf=+el('sf').value,dosp=+el('dosp').value,T=+el('tsp').value,phsp=+el('phsp').value;
  const gas=air+o2,yo2=gas?(0.21*air+o2)/gas:.21,vvm=gas/V;
  for(let i=0;i<=steps;i++){
    const t=i*dt,tempF=Math.exp(-Math.pow((T-p.Topt)/7,2)),phF=Math.exp(-Math.pow((ph-p.pHopt)/1.1,2)),acetateInhib=strain==='bl21'?1/(1+Math.max(0,A-2)/3):1;
    const mu=p.mumax*(S/(p.Ks+Math.max(0,S)))*(DO/(8+Math.max(0,DO)))*tempF*phF*acetateInhib;
    const qS=mu/p.Yxs+p.mS,kla=.55*Math.pow(Math.max(50,rpm),.7)*Math.pow(Math.max(.03,vvm),.3)/10,cs=100*(yo2/.21),otr=Math.max(0,kla*(cs-DO)/100),our=p.qO2*X/8;
    if(i%10===0){data.t.push(t);data.X.push(X);data.S.push(S);data.DO.push(DO);data.pH.push(ph);data.A.push(A);data.V.push(V);data.mu.push(mu);data.OTR.push(otr);data.OUR.push(our)}
    const qA=strain==='bl21'&&qS>p.qscrit?.22*(qS-p.qscrit):0,dV=F+Fb+Fa+Ffoam,dX=mu*X-(dV/V)*X,dS=-qS*X+(F/V)*(Sf-S),dA=qA*X-(dV/V)*A;
    const doCtl=DO<dosp?1.35:1, dDO=(otr*doCtl-our)*5, acidLoad=.025*mu*X, baseEffect=Fb*12/V, acidEffect=Fa*12/V, dph=-acidLoad+baseEffect-acidEffect+(phsp-ph)*.18;
    X=Math.max(.001,X+dX*dt);S=Math.max(0,S+dS*dt);A=Math.max(0,A+dA*dt);DO=Math.max(.2,Math.min(cs,DO+dDO*dt));ph=Math.max(4.5,Math.min(8.5,ph+dph*dt));V=Math.min(4.5,V+dV*dt);
  }
  return data;
}
function drawChart(){if(!lastResult)return;const c=el('mainChart'),ctx=c.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),rect=c.getBoundingClientRect();c.width=rect.width*dpr;c.height=rect.height*dpr;ctx.scale(dpr,dpr);const w=rect.width,h=rect.height,pad={l:42,r:12,t:14,b:26},allVals=lastResult[chartKey],end=Math.max(1,Math.min(allVals.length,simIndex+1)),vals=allVals.slice(0,end),times=lastResult.t.slice(0,end);let min=Math.min(...allVals),max=Math.max(...allVals);if(chartKey!=='pH')min=0;if(max-min<.001)max=min+1;const xp=i=>pad.l+(times[i]/horizon)*(w-pad.l-pad.r),yp=v=>pad.t+(1-(v-min)/(max-min))*(h-pad.t-pad.b);
  ctx.clearRect(0,0,w,h);ctx.font='10px ui-monospace';ctx.fillStyle='#607b8b';ctx.strokeStyle='rgba(60,91,108,.38)';ctx.lineWidth=1;
  for(let j=0;j<5;j++){const y=pad.t+j*(h-pad.t-pad.b)/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=max-j*(max-min)/4;ctx.fillText(v.toFixed(chartKey==='pH'?2:1),3,y+3)}
  for(let j=0;j<=4;j++){const x=pad.l+j*(w-pad.l-pad.r)/4;ctx.fillText((horizon*j/4).toFixed(0)+'h',x-7,h-6)}
  const color=chartMeta[chartKey][2];const grad=ctx.createLinearGradient(0,pad.t,0,h-pad.b);grad.addColorStop(0,color+'50');grad.addColorStop(1,color+'00');ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(xp(i),yp(v)):ctx.moveTo(xp(i),yp(v)));ctx.lineTo(xp(vals.length-1),h-pad.b);ctx.lineTo(pad.l,h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(xp(i),yp(v)):ctx.moveTo(xp(i),yp(v)));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(xp(vals.length-1),yp(vals.at(-1)),3.5,0,Math.PI*2);ctx.fill();
  const meta=chartMeta[chartKey];el('chartTitle').textContent=meta[0];el('chartValue').textContent=`${vals.at(-1).toFixed(chartKey==='pH'?2:chartKey==='DO'?1:2)} ${meta[1]}`;el('chartValue').style.color=color;el('chartLegend').textContent=`${times.at(-1).toFixed(1)} / ${horizon} h · Δt 0.05 h`;
}
function renderResultAt(index){
  const d=lastResult,i=Math.max(0,Math.min(index,d.t.length-1)),mu=d.mu[i],td=mu>.001?Math.log(2)/mu:Infinity,X=d.X[i],V=d.V[i],our=d.OUR[i],otr=d.OTR[i],t=d.t[i];simIndex=i;el('muCard').textContent=mu.toFixed(3);el('tdCard').textContent=isFinite(td)&&td<999?td.toFixed(2):'—';el('bioCard').textContent=(X*V).toFixed(1);el('otrCard').textContent=otr.toFixed(1);el('ourCard').textContent=our.toFixed(1);el('baseCard').textContent=(+el('base').value*t).toFixed(0);el('feedCard').textContent=(+el('feed').value*t).toFixed(0);el('volCard').textContent=V.toFixed(2);el('liveTime').textContent=`${t.toFixed(1)} h`;el('elapsed').textContent=`${String(Math.floor(t)).padStart(2,'0')}:${String(Math.round((t%1)*60)).padStart(2,'0')}`;
  const gas=+el('air').value + +el('o2').value,yo2=gas?(.21*+el('air').value + +el('o2').value)/gas:.21,o2out=Math.max(1,yo2*100-our*.45),co2out=Math.min(15,our*.38);el('o2out').innerHTML=`${o2out.toFixed(1)}<small>%</small>`;el('co2out').innerHTML=`${co2out.toFixed(1)}<small>%</small>`;el('ourSmall').textContent=our.toFixed(1);el('cerSmall').textContent=(our*.86).toFixed(1);el('rqSmall').textContent='0.86';
  drawChart();
}
function updateResults(){
  stopSimulation(false);lastResult=simulate();simIndex=lastResult.t.length-1;renderResultAt(simIndex);
  const d=lastResult,A=d.A.at(-1),lowDO=Math.min(...d.DO)<10,msg=lowDO?'산소전달이 성장 요구량을 따라가지 못합니다. AIR/O₂ 또는 교반을 높여보세요.':A>2?`아세트산이 ${A.toFixed(1)} g/L까지 축적됩니다. FEED를 낮춰 오버플로 대사를 줄이세요.`:`${params[strain].name} 조건에서 뚜렷한 산소·부산물 제한 없이 운전됩니다.`;el('insight').innerHTML=`<span>AI</span><p><b>공정 인사이트</b><br><em>${msg}</em></p>`;
}
function setRunUi(state){
  const btn=el('runBtn'),status=el('footerStatus'),wrap=document.querySelector('.chart-wrap');
  simRunning=state==='running';wrap.classList.toggle('running',simRunning);btn.classList.toggle('running',simRunning);
  btn.innerHTML=simRunning?'<span>Ⅱ</span> PAUSE':'<span>▶</span> RUN';
  status.className=state==='paused'?'paused':simRunning?'running':'';
  status.innerHTML=state==='paused'?'<i></i> 일시정지됨':simRunning?'<i></i> 시뮬레이션 실행 중':'<i></i> 시뮬레이션 엔진 정상';
}
function stopSimulation(paused=true){if(simTimer){clearInterval(simTimer);simTimer=null}setRunUi(paused?'paused':'ready')}
function startSimulation(){
  if(simRunning){stopSimulation(true);return}
  if(!lastResult||simIndex>=lastResult.t.length-1){lastResult=simulate();simIndex=0;el('insight').innerHTML='<span>RUN</span><p><b>배양 시뮬레이션 진행 중</b><br><em>시간에 따른 물질수지와 산소전달을 계산하고 있습니다.</em></p>'}
  setRunUi('running');
  simTimer=setInterval(()=>{const step=Math.max(1,Math.round(+el('simSpeed').value*2));simIndex=Math.min(lastResult.t.length-1,simIndex+step);renderResultAt(simIndex);if(simIndex>=lastResult.t.length-1){stopSimulation(false);const A=lastResult.A.at(-1),lowDO=Math.min(...lastResult.DO)<10,msg=lowDO?'DO가 10% 아래로 떨어졌습니다. 통기 또는 교반 조건을 검토하세요.':A>2?`아세트산 ${A.toFixed(1)} g/L 축적 위험이 있습니다. FEED를 낮춰보세요.`:'설정한 조건으로 계산이 완료되었습니다.';el('insight').innerHTML=`<span>DONE</span><p><b>시뮬레이션 완료</b><br><em>${msg}</em></p>`}},90);
}
function resetSimulation(){stopSimulation(false);lastResult=simulate();simIndex=0;renderResultAt(0);el('insight').innerHTML='<span>READY</span><p><b>초기 상태</b><br><em>RUN을 누르면 시간에 따라 배양이 진행됩니다.</em></p>'}
function exportCsv(){
  if(!lastResult)lastResult=simulate();const keys=['t','X','S','DO','pH','A','V','mu','OTR','OUR'];const rows=[keys.join(','),...lastResult.t.map((_,i)=>keys.map(k=>Number(lastResult[k][i]).toFixed(4)).join(','))];const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fed-batch-${strain}-${horizon}h.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setStrain(next){strain=next;document.querySelectorAll('.strain-btn').forEach(b=>b.classList.toggle('active',b.dataset.strain===strain));const isBL=strain==='bl21';el('acetateTab').style.display=isBL?'':'none';el('acetateFormula').style.display=isBL?'':'none';el('tsp').value=isBL?37:30;if(!isBL&&chartKey==='A'){chartKey='X';document.querySelectorAll('.chart-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.chart==='X'))}updateMediaCalc();updateResults()}
document.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{updateControls()}));document.querySelectorAll('.range-row input').forEach(i=>i.addEventListener('input',updateControls));document.querySelectorAll('.strain-btn').forEach(b=>b.addEventListener('click',()=>setStrain(b.dataset.strain)));document.querySelectorAll('.chart-tabs button').forEach(b=>b.addEventListener('click',()=>{chartKey=b.dataset.chart;document.querySelectorAll('.chart-tabs button').forEach(x=>x.classList.toggle('active',x===b));drawChart()}));document.querySelectorAll('.time-select button').forEach(b=>b.addEventListener('click',()=>{horizon=+b.dataset.hours;el('durationInput').value=horizon;document.querySelectorAll('.time-select button').forEach(x=>x.classList.toggle('active',x===b));updateResults()}));
el('durationInput').addEventListener('change',e=>{horizon=Math.max(1,Math.min(240,+e.target.value||24));e.target.value=horizon;document.querySelectorAll('.time-select button').forEach(x=>x.classList.toggle('active',+x.dataset.hours===horizon));updateResults()});
document.querySelectorAll('.pump button').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();button.classList.toggle('active')}));
el('runBtn').addEventListener('click',()=>{updateMediaCalc();updateControls();startSimulation()});el('resetSim').addEventListener('click',resetSimulation);el('exportCsv').addEventListener('click',exportCsv);el('addReagentWide').addEventListener('click',addReagent);el('resetMedia').addEventListener('click',()=>{reagents=defaults.map(x=>({...x}));renderReagents();updateMediaCalc()});el('formulaBtn').addEventListener('click',()=>el('formulaDialog').showModal());el('closeFormula').addEventListener('click',()=>el('formulaDialog').close());el('formulaDialog').addEventListener('click',e=>{if(e.target===el('formulaDialog'))el('formulaDialog').close()});window.addEventListener('resize',drawChart);
renderReagents();updateMediaCalc();updateControls();updateResults();
if(document.modelContext?.registerTool){document.modelContext.registerTool({name:'run_culture_simulation',title:'배양 시뮬레이션 실행',description:'현재 설정 또는 지정한 균주와 1~240시간 운전시간으로 fed-batch 시뮬레이션을 실행하고 최종 결과를 반환합니다.',inputSchema:{type:'object',properties:{strain:{type:'string',enum:['bl21','cg']},hours:{type:'number',minimum:1,maximum:240}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(input?.strain)setStrain(input.strain);if(input?.hours){horizon=Math.max(1,Math.min(240,input.hours));el('durationInput').value=horizon;document.querySelectorAll('.time-select button').forEach(x=>x.classList.toggle('active',+x.dataset.hours===horizon))}updateResults();return{strain:params[strain].name,hours:horizon,finalBiomass_g:+(lastResult.X.at(-1)*lastResult.V.at(-1)).toFixed(2),finalVolume_L:+lastResult.V.at(-1).toFixed(2),finalAcetate_gL:+lastResult.A.at(-1).toFixed(2)}}})}

// Physical equipment training page
function showPage(pageId){
  document.querySelectorAll('.app-page').forEach(page=>{const active=page.id===pageId;page.hidden=!active;page.classList.toggle('active',active)});
  document.querySelectorAll('.page-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===pageId));
  if(pageId==='simPage') requestAnimationFrame(drawChart);
  window.scrollTo({top:0,behavior:'smooth'});
}
function hardwarePumpRate(name){
  const card=document.querySelector(`.hardware-pump[data-pump="${name}"]`);
  return card?.classList.contains('active') ? Math.max(0,+card.querySelector('input').value||0) : 0;
}
function updateHardware(){
  const airA=+el('hwAirA').value,o2A=+el('hwO2A').value,gas=airA+o2A,V=Math.max(.2,+el('v0').value||2);
  ['AirA','O2A','AirB','O2B'].forEach(key=>el('hw'+key+'Out').textContent=(+el('hw'+key).value).toFixed(key.includes('O2')?2:1));
  const yo2=gas?(.21*airA+o2A)/gas:0;
  const active=[...document.querySelectorAll('.hardware-pump.active')].filter(x=>x.dataset.pump.endsWith('A')).map(x=>x.dataset.pump.replace('A','').toUpperCase());
  const liquid=['acidA','baseA','feedA','foamA'].reduce((sum,name)=>sum+hardwarePumpRate(name),0)*24;
  el('hwGasTotal').textContent=`${gas.toFixed(2)} L/min`;
  el('hwYO2').textContent=`${(yo2*100).toFixed(1)}%`;
  el('hwVvm').textContent=(gas/V).toFixed(2);
  el('hwActivePumps').textContent=active.length?active.join(' · '):'없음';
  el('hwLiquid').textContent=`${liquid.toFixed(0)} mL`;
  el('hwDo').innerHTML=`${(+el('dosp').value).toFixed(1)}<small>%</small>`;
  el('hwPh').textContent=(+el('phsp').value).toFixed(2);
  el('hwTemp').innerHTML=`${(+el('tsp').value).toFixed(1)}<small>°C</small>`;
  const alert=el('hardwareAlert'),feedOn=hardwarePumpRate('feedA')>0;
  if(gas<=0){alert.className='hardware-alert warn';alert.innerHTML='<i>!</i><p><b>가스 공급 없음</b><span>AIR 또는 O₂ 유량을 올려주세요.</span></p>'}
  else if(!feedOn){alert.className='hardware-alert warn';alert.innerHTML='<i>!</i><p><b>FEED 펌프 정지</b><span>Fed-batch 운전 전 펌프 상태를 확인하세요.</span></p>'}
  else{alert.className='hardware-alert ok';alert.innerHTML='<i>✓</i><p><b>연결 상태 양호</b><span>가스 공급과 FEED 라인이 준비되었습니다.</span></p>'}
}
document.querySelectorAll('.page-tab').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
document.querySelectorAll('.vertical-range').forEach(input=>input.addEventListener('input',updateHardware));
document.querySelectorAll('.hardware-pump').forEach(card=>{
  card.querySelector('.pump-head').addEventListener('click',()=>{card.classList.toggle('active');updateHardware()});
  card.querySelector('input').addEventListener('input',updateHardware);
});
el('applyHardware').addEventListener('click',()=>{
  el('air').value=el('hwAirA').value;
  el('o2').value=el('hwO2A').value;
  el('acid').value=hardwarePumpRate('acidA');
  el('base').value=hardwarePumpRate('baseA');
  el('feed').value=hardwarePumpRate('feedA');
  el('foam').value=hardwarePumpRate('foamA');
  updateControls();updateResults();showPage('simPage');
  el('insight').innerHTML='<span>HW</span><p><b>장비 실습값 적용 완료</b><br><em>Vessel A의 가스·펌프 설정으로 결과를 다시 계산했습니다.</em></p>';
});
updateHardware();
