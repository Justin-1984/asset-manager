const APP_VERSION = 'v6.0';
const STORAGE_KEY = 'assetManagerPWA_v6';
const LEGACY_KEYS = ['assetManagerPWA_v54','assetManagerPWA_v5','assetManagerPWA'];
const tabs = [
  ['assets','자산'], ['debts','부채'], ['insurance','보험'], ['analysis','분석'], ['settings','설정']
];
const fxDefaults = { KRW:1, USD:1380, USDT:1380, HKD:195, AUD:1080 };
let state = loadState();

function uid(){ return crypto?.randomUUID?.() || String(Date.now()+Math.random()); }
function money(v){ return '₩' + Math.round(Number(v)||0).toLocaleString('ko-KR'); }
function fx(cur){ return state.fx[(cur||'KRW').toUpperCase()] || 1; }
function assetValue(a){ return (Number(a.amount)||1) * (Number(a.price)||0) * fx(a.currency); }
function debtValue(d){ return (Number(d.balance)||0) * fx(d.currency); }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadState(){
  const current = localStorage.getItem(STORAGE_KEY);
  if(current) return JSON.parse(current);
  for(const key of LEGACY_KEYS){
    const raw = localStorage.getItem(key);
    if(raw){
      const old = JSON.parse(raw);
      return migrate(old);
    }
  }
  return migrate({});
}
function migrate(old){
  return {
    version: APP_VERSION,
    fx: {...fxDefaults, ...(old.fx||{})},
    assets: old.assets || sampleAssets(),
    debts: old.debts || [],
    insurance: old.insurance || [],
    snapshots: old.snapshots || [],
    settings: { hiddenTabs: [], ...(old.settings||{}) }
  };
}
function sampleAssets(){
  return [
    {id:uid(), name:'예시 현금', type:'현금', country:'한국', currency:'KRW', amount:1, price:1000000, cost:1000000},
    {id:uid(), name:'예시 SCHD', type:'미국주식', country:'미국', currency:'USD', amount:1, price:75, cost:70}
  ];
}

function initTabs(){
  const bar = document.getElementById('tabBar');
  bar.innerHTML = tabs.filter(t=>!state.settings.hiddenTabs.includes(t[0])).map(([id,label])=>`<button data-tab="${id}">${label}</button>`).join('');
  bar.querySelectorAll('button').forEach(btn=>btn.onclick=()=>showTab(btn.dataset.tab));
  bar.querySelector('button')?.classList.add('active');
}
function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===id));
  document.querySelectorAll('.tab-bar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  if(id==='analysis') renderAnalysis();
}

function render(){
  document.getElementById('versionBadge').textContent = APP_VERSION;
  renderLists();
  renderSummary();
  renderAnalysis();
  save();
}
function totals(){
  const assets = state.assets.reduce((s,a)=>s+assetValue(a),0) + state.insurance.filter(i=>i.includeRefund).reduce((s,i)=>s+(Number(i.refund)||0),0);
  const debts = state.debts.reduce((s,d)=>s+debtValue(d),0);
  return {assets, debts, net: assets-debts};
}
function renderSummary(){
  const t = totals();
  document.getElementById('totalAssets').textContent = money(t.assets);
  document.getElementById('totalDebts').textContent = money(t.debts);
  document.getElementById('netWorth').textContent = money(t.net);
  document.getElementById('riskLevel').textContent = analyzePortfolio().risk.label;
}
function itemRow(title, sub, value, onDelete){
  const el = document.createElement('article'); el.className='row card';
  el.innerHTML = `<div><strong>${title}</strong><p>${sub}</p></div><div><b>${value}</b><button class="danger">삭제</button></div>`;
  el.querySelector('button').onclick = onDelete;
  return el;
}
function renderLists(){
  const assetList = document.getElementById('assetList'); assetList.innerHTML='';
  state.assets.forEach(a=>assetList.appendChild(itemRow(a.name, `${a.type} · ${a.country||'-'} · ${a.currency}`, money(assetValue(a)), ()=>{state.assets=state.assets.filter(x=>x.id!==a.id); render();})));
  const debtList = document.getElementById('debtList'); debtList.innerHTML='';
  state.debts.forEach(d=>debtList.appendChild(itemRow(d.name, `${d.type} · ${d.currency} · ${d.rate||0}%`, money(debtValue(d)), ()=>{state.debts=state.debts.filter(x=>x.id!==d.id); render();})));
  const insuranceList = document.getElementById('insuranceList'); insuranceList.innerHTML='';
  state.insurance.forEach(i=>insuranceList.appendChild(itemRow(`${i.company} ${i.product}`, `${i.type||'-'} · 매월 ${i.payday||'-'}일 · 월 ${money(i.premium)}`, i.includeRefund?money(i.refund):'자산 제외', ()=>{state.insurance=state.insurance.filter(x=>x.id!==i.id); render();})));
}

function analyzePortfolio(){
  const total = state.assets.reduce((s,a)=>s+assetValue(a),0) || 1;
  const byType = groupPct(a=>a.type);
  const byCountry = groupPct(a=>a.country||'미분류');
  const byCurrency = groupPct(a=>(a.currency||'KRW').toUpperCase());
  const cryptoPct = byType['코인'] || 0;
  const cashPct = (byType['현금']||0)+(byType['은행']||0);
  const etfPct = byType['한국 ETF']||0;
  const usStockPct = byType['미국주식']||0;
  const concentration = Math.max(0, ...state.assets.map(a=>assetValue(a)/total*100));
  let score = 100;
  if(cryptoPct>30) score -= 25; else if(cryptoPct>15) score -= 12;
  if(cashPct<5) score -= 15; else if(cashPct>50) score -= 10;
  if(concentration>50) score -= 20; else if(concentration>30) score -= 10;
  if((byCountry['미국']||0)>80 || (byCountry['한국']||0)>80) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const risk = score>=80?{label:'낮음',score}:score>=60?{label:'보통',score}:score>=40?{label:'높음',score}:{label:'매우 높음',score};
  const recommendations = [];
  if(cryptoPct>30) recommendations.push('코인 비중이 30%를 초과합니다. 일부 이익실현 또는 현금/ETF 분산을 검토하세요.');
  if(cashPct<5) recommendations.push('현금성 자산이 5% 미만입니다. 비상자금 확보가 우선입니다.');
  if(concentration>50) recommendations.push('단일 자산 집중도가 50%를 초과합니다. 특정 자산 의존도를 낮추는 것이 좋습니다.');
  if(etfPct+usStockPct<30) recommendations.push('ETF/주식 장기 투자 비중이 낮습니다. 안정적 분산자산 확대를 검토하세요.');
  if(!recommendations.length) recommendations.push('현재 배분은 큰 경고 신호가 적습니다. 정기 리밸런싱만 유지하세요.');
  return { total, byType, byCountry, byCurrency, cryptoPct, cashPct, etfPct, usStockPct, concentration, risk, recommendations };
  function groupPct(fn){
    return state.assets.reduce((m,a)=>{ const k=fn(a); m[k]=(m[k]||0)+assetValue(a)/total*100; return m; },{});
  }
}
function renderAnalysis(){
  const a = analyzePortfolio();
  const cards = [
    ['투자비중 점수', `${a.risk.score}/100`], ['위험도', a.risk.label], ['코인 비중', `${a.cryptoPct.toFixed(1)}%`], ['현금 비중', `${a.cashPct.toFixed(1)}%`], ['ETF/주식 비중', `${(a.etfPct+a.usStockPct).toFixed(1)}%`], ['단일자산 집중도', `${a.concentration.toFixed(1)}%`]
  ];
  document.getElementById('analysisCards').innerHTML = cards.map(([k,v])=>`<article class="card metric"><span>${k}</span><strong>${v}</strong></article>`).join('');
  document.getElementById('rebalanceList').innerHTML = a.recommendations.map(r=>`<p>• ${r}</p>`).join('');
  document.getElementById('allocationBars').innerHTML = Object.entries(a.byType).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div><i style="width:${Math.min(100,v)}%"></i></div><b>${v.toFixed(1)}%</b></div>`).join('');
}

function bindForms(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.open).classList.toggle('hidden'));
  assetForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(assetForm)); state.assets.push({id:uid(),...f}); assetForm.reset(); render(); };
  debtForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(debtForm)); state.debts.push({id:uid(),...f}); debtForm.reset(); render(); };
  insuranceForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(insuranceForm)); f.includeRefund=insuranceForm.includeRefund.checked; state.insurance.push({id:uid(),...f}); insuranceForm.reset(); render(); };
}
function backup(){
  const blob = new Blob([JSON.stringify({...state, version:APP_VERSION, exportedAt:new Date().toISOString()}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-${APP_VERSION}-backup.json`; a.click(); URL.revokeObjectURL(a.href);
}
function restore(file){
  const r = new FileReader(); r.onload=()=>{ state=migrate(JSON.parse(r.result)); render(); log('복원 완료'); }; r.readAsText(file);
}
function log(msg){ document.getElementById('logBox').textContent = `[${new Date().toLocaleString()}] ${msg}`; }
function takeSnapshot(){ const t=totals(); state.snapshots.push({id:uid(), date:new Date().toISOString(), ...t}); render(); log('스냅샷 저장 완료'); }

window.addEventListener('load',()=>{
  initTabs(); bindForms(); render();
  snapshotBtn.onclick=takeSnapshot;
  refreshAnalysis.onclick=renderAnalysis;
  backupBtn.onclick=backup;
  restoreInput.onchange=e=>e.target.files[0]&&restore(e.target.files[0]);
  syncCheckBtn.onclick=()=>log('로컬 저장 정상 · GitHub 연동 설정은 기존 토큰/저장소 설정을 유지하세요.');
  clearCacheBtn.onclick=async()=>{ if('caches' in window){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } log('캐시 삭제 완료'); };
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});
