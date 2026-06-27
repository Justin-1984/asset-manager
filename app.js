const APP_VERSION = 'v6.4-dashboard';
const STORAGE_KEY = 'assetManagerPWA_v6';
const LEGACY_KEYS = ['assetManagerPWA_v5_4','assetManagerPWA_v54','assetManager_v5_4','assetManagerPWA_v5','assetManagerPWA','assetManager','asset_manager_data'];
const tabs = [['dashboard','대시보드'],['assets','자산'],['debts','부채'],['insurance','보험'],['analysis','분석'],['settings','설정']];
const fxDefaults = { KRW:1, USD:1380, USDT:1380, HKD:195, AUD:1080 };
let state = loadState();

const $ = id => document.getElementById(id);
function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random()); }
function num(v){ return Number(v)||0; }
function money(v){ return '₩' + Math.round(num(v)).toLocaleString('ko-KR'); }
function fx(cur){ return state.fx[(cur||'KRW').toUpperCase()] || 1; }
function assetValue(a){ return num(a.value) || num(a.krwValue) || (num(a.amount)||1) * (num(a.price)||0) * fx(a.currency); }
function debtValue(d){ return num(d.value) || num(d.krwValue) || num(d.balance) * fx(d.currency); }
function save(){ state.version = APP_VERSION; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function normalizeArray(v){ return Array.isArray(v) ? v : []; }
function normalizeState(raw, source='unknown'){
  const old = raw || {};
  return {
    version: APP_VERSION,
    migratedFrom: source,
    fx: {...fxDefaults, ...(old.fx||old.exchangeRates||{})},
    assets: normalizeArray(old.assets || old.assetList).map(a=>({id:a.id||uid(), name:a.name||a.title||'이름없음', type:a.type||a.category||'자산', country:a.country||'', currency:(a.currency||'KRW').toUpperCase(), amount:a.amount??a.quantity??1, price:a.price??a.currentPrice??a.value??0, cost:a.cost??a.principal??0, value:a.value, krwValue:a.krwValue})),
    debts: normalizeArray(old.debts || old.debtList).map(d=>({id:d.id||uid(), name:d.name||d.title||'부채', type:d.type||'일반 부채', currency:(d.currency||'KRW').toUpperCase(), balance:d.balance??d.amount??d.value??0, rate:d.rate||0, monthly:d.monthly||0, value:d.value, krwValue:d.krwValue})),
    insurance: normalizeArray(old.insurance || old.insurances || old.policies).map(i=>({id:i.id||uid(), company:i.company||i.insurer||'', product:i.product||i.name||'', type:i.type||'', premium:i.premium||0, payday:i.payday||'', refund:i.refund||0, includeRefund:!!i.includeRefund, memo:i.memo||''})),
    snapshots: normalizeArray(old.snapshots),
    settings: { hiddenTabs: [], theme: 'light', ...(old.settings||{}) }
  };
}
function looksLikeAssetData(obj){ return obj && typeof obj==='object' && (Array.isArray(obj.assets)||Array.isArray(obj.assetList)||Array.isArray(obj.debts)||Array.isArray(obj.insurance)||Array.isArray(obj.insurances)); }
function findLegacyState(){
  for(const key of [STORAGE_KEY, ...LEGACY_KEYS]){
    const raw = localStorage.getItem(key);
    if(!raw) continue;
    try{ const parsed = JSON.parse(raw); if(looksLikeAssetData(parsed)) return {state:normalizeState(parsed,key), key}; }catch(e){}
  }
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i);
    if(!key || key===STORAGE_KEY) continue;
    try{ const parsed = JSON.parse(localStorage.getItem(key)); if(looksLikeAssetData(parsed)) return {state:normalizeState(parsed,key), key}; }catch(e){}
  }
  return null;
}
function loadState(){
  const found = findLegacyState();
  if(found){ return found.state; }
  return normalizeState({}, 'empty');
}
function showNotice(msg){ const n=$('notice'); n.textContent=msg; n.classList.remove('hidden'); }

function totals(){
  const assets = state.assets.reduce((s,a)=>s+assetValue(a),0) + state.insurance.filter(i=>i.includeRefund).reduce((s,i)=>s+num(i.refund),0);
  const debts = state.debts.reduce((s,d)=>s+debtValue(d),0);
  return {assets, debts, net: assets-debts};
}
function groupPct(list, total, fn){
  if(!total) return {};
  return list.reduce((m,item)=>{ const k=fn(item)||'미분류'; m[k]=(m[k]||0)+assetValue(item)/total*100; return m; },{});
}
function analyzePortfolio(){
  const total = state.assets.reduce((s,a)=>s+assetValue(a),0);
  const byType = groupPct(state.assets,total,a=>a.type);
  const byCountry = groupPct(state.assets,total,a=>a.country);
  const byCurrency = groupPct(state.assets,total,a=>(a.currency||'KRW').toUpperCase());
  const cryptoPct = byType['코인'] || 0;
  const cashPct = (byType['현금']||0)+(byType['은행']||0);
  const etfPct = (byType['한국 ETF']||0)+(byType['ETF']||0);
  const stockPct = (byType['미국주식']||0)+(byType['주식']||0);
  const concentration = total ? Math.max(0,...state.assets.map(a=>assetValue(a)/total*100)) : 0;
  let score = 100;
  if(total<=0) score = 0;
  if(cryptoPct>30) score-=25; else if(cryptoPct>15) score-=12;
  if(cashPct<5 && total>0) score-=15; else if(cashPct>50) score-=10;
  if(concentration>50) score-=20; else if(concentration>30) score-=10;
  if(Object.values(byCountry).some(v=>v>80)) score-=8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const risk = score>=80?{label:'낮음',score}:score>=60?{label:'보통',score}:score>=40?{label:'높음',score}:{label:total?'매우 높음':'- ',score};
  const recommendations=[];
  if(total<=0) recommendations.push('자산 데이터가 없습니다. 기존 백업을 복원하거나 기존 데이터 다시 찾기를 눌러주세요.');
  if(cryptoPct>30) recommendations.push('코인 비중이 30%를 초과합니다. 현금/ETF 분산을 검토하세요.');
  if(cashPct<5 && total>0) recommendations.push('현금성 자산이 5% 미만입니다. 비상자금 확보가 우선입니다.');
  if(concentration>50) recommendations.push('단일 자산 집중도가 50%를 초과합니다. 특정 자산 의존도를 낮추는 것이 좋습니다.');
  if(etfPct+stockPct<30 && total>0) recommendations.push('ETF/주식 장기 투자 비중이 낮습니다. 분산자산 확대를 검토하세요.');
  if(!recommendations.length) recommendations.push('현재 배분은 큰 경고 신호가 적습니다. 정기 리밸런싱만 유지하세요.');
  return {total, byType, byCountry, byCurrency, cryptoPct, cashPct, etfPct, stockPct, concentration, risk, recommendations};
}


function changeSince(days){
  const t=totals();
  if(!state.snapshots || !state.snapshots.length) return null;
  const cutoff = Date.now() - days*24*60*60*1000;
  const sorted = [...state.snapshots].filter(s=>s.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const base = sorted.find(s=>new Date(s.date).getTime()>=cutoff) || sorted[0];
  if(!base) return null;
  return t.net - num(base.net);
}
function investmentProfit(){
  const cost = state.assets.reduce((sum,a)=>sum+num(a.cost)*fx(a.currency),0);
  const value = state.assets.reduce((sum,a)=>sum+assetValue(a),0);
  const profit = value - cost;
  const rate = cost>0 ? profit/cost*100 : 0;
  return {cost,value,profit,rate};
}
function goalRate(){
  const goal = num(state.settings?.netWorthGoal || state.goal || state.targetNetWorth);
  if(!goal) return null;
  return totals().net / goal * 100;
}
function renderDashboard(){
  if(!$('dashNetWorth')) return;
  const t=totals();
  const a=analyzePortfolio();
  const p=investmentProfit();
  const month=changeSince(31);
  const week=changeSince(7);
  const year=changeSince(365);
  const goal=goalRate();
  $('dashNetWorth').textContent=money(t.net);
  $('dashMonthChange').textContent='이번 달 변화 ' + (month===null ? '스냅샷 없음' : money(month));
  $('dashProfit').textContent=money(p.profit);
  $('dashProfitRate').textContent='수익률 ' + (p.cost>0 ? p.rate.toFixed(1)+'%' : '계산 대기');
  $('dashGoalRate').textContent=goal===null ? '목표 미설정' : goal.toFixed(1)+'%';
  $('dashRiskText').textContent='위험도 ' + a.risk.label.trim() + ' · 점수 ' + a.risk.score + '/100';
  $('dashCashCrypto').textContent=`현금 ${a.cashPct.toFixed(1)}% / 코인 ${a.cryptoPct.toFixed(1)}%`;
  const entries=Object.entries(a.byType).sort((x,y)=>y[1]-x[1]);
  const parts=[]; let acc=0;
  entries.forEach(([k,v],idx)=>{ const start=acc; acc+=v; const hue=(idx*58)%360; parts.push(`hsl(${hue} 70% 55%) ${start}% ${acc}%`); });
  $('dashDonut').style.background = parts.length ? `conic-gradient(${parts.join(',')})` : 'var(--line)';
  $('dashLegend').innerHTML = entries.length ? entries.map(([k,v],idx)=>`<span><i style="background:hsl(${(idx*58)%360} 70% 55%)"></i>${escapeHtml(k)} ${v.toFixed(1)}%</span>`).join('') : '<span>분석할 자산이 없습니다.</span>';
  const top=[...state.assets].map(x=>({...x,_v:assetValue(x)})).sort((x,y)=>y._v-x._v).slice(0,5);
  $('dashTopAssets').innerHTML = top.length ? top.map((x,i)=>`<div><b>${i+1}. ${escapeHtml(x.name)}</b><span>${escapeHtml(x.type)} · ${money(x._v)}</span></div>`).join('') : '<div class="empty">자산을 등록하면 TOP 5가 표시됩니다.</div>';
  $('dashChanges').innerHTML = [
    ['이번 주', week], ['이번 달', month], ['올해', year]
  ].map(([label,val])=>`<p><b>${label}</b><span>${val===null?'스냅샷 없음':money(val)}</span></p>`).join('');
  $('dashChecks').innerHTML = a.recommendations.slice(0,4).map(r=>`<p>• ${escapeHtml(r)}</p>`).join('');
}

function initTabs(){
  $('tabBar').innerHTML = tabs.filter(t=>!state.settings.hiddenTabs.includes(t[0])).map(([id,label])=>`<button data-tab="${id}">${label}</button>`).join('');
  document.querySelectorAll('#tabBar button').forEach(btn=>btn.onclick=()=>showTab(btn.dataset.tab));
  document.querySelector('#tabBar button')?.classList.add('active');
}
function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===id));
  document.querySelectorAll('#tabBar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  if(id==='analysis') renderAnalysis();
  if(id==='dashboard') renderDashboard();
}
function render(){ applyTheme(); renderSummary(); renderLists(); renderAnalysis(); renderDashboard(); save(); }
function renderSummary(){
  const t=totals(); const a=analyzePortfolio();
  $('versionBadge').textContent='v6.4'; $('totalAssets').textContent=money(t.assets); $('totalDebts').textContent=money(t.debts); $('netWorth').textContent=money(t.net); $('riskLevel').textContent=a.risk.label.trim();
  if(!state.assets.length && !state.debts.length && !state.insurance.length) showNotice('기존 데이터가 자동으로 발견되지 않았습니다. 설정에서 “기존 데이터 다시 찾기” 또는 “복원”을 사용하세요. 예시 데이터는 더 이상 자동 생성하지 않습니다.');
}

let editing = { assets:null, debts:null, insurance:null };
function itemRow(title, sub, value, onEdit, onDelete){
  const el=document.createElement('article'); el.className='row card';
  el.innerHTML=`<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(sub)}</p></div><div><b>${value}</b><div class="row-actions"><button class="edit" type="button">수정</button><button class="danger" type="button">삭제</button></div></div>`;
  el.querySelector('.edit').onclick=onEdit;
  el.querySelector('.danger').onclick=onDelete;
  return el;
}
function setFormValues(form, data){
  [...form.elements].forEach(el=>{
    if(!el.name) return;
    if(el.type==='checkbox') el.checked = !!data[el.name];
    else el.value = data[el.name] ?? '';
  });
}
function showForm(form, visible=true){ form.classList.toggle('hidden', !visible); }
function resetEdit(kind){
  editing[kind]=null;
  const form = kind==='assets' ? assetForm : kind==='debts' ? debtForm : insuranceForm;
  form.reset();
  const title = document.querySelector(`[data-title="${kind}"]`);
  const saveBtn = form.querySelector('[data-save]') || form.querySelector('button[type=submit]');
  const cancelBtn = form.querySelector('[data-cancel]');
  if(title) title.textContent = kind==='assets' ? '자산 추가' : kind==='debts' ? '부채 추가' : '보험 추가';
  if(saveBtn) saveBtn.textContent = '저장';
  if(cancelBtn) cancelBtn.classList.add('hidden');
}
function startEdit(kind, item){
  editing[kind]=item.id;
  const form = kind==='assets' ? assetForm : kind==='debts' ? debtForm : insuranceForm;
  const title = document.querySelector(`[data-title="${kind}"]`);
  const saveBtn = form.querySelector('[data-save]') || form.querySelector('button[type=submit]');
  const cancelBtn = form.querySelector('[data-cancel]');
  showForm(form,true);
  setFormValues(form,item);
  if(title) title.textContent = kind==='assets' ? '자산 수정' : kind==='debts' ? '부채 수정' : '보험 수정';
  if(saveBtn) saveBtn.textContent = '수정 완료';
  if(cancelBtn) cancelBtn.classList.remove('hidden');
  form.scrollIntoView({behavior:'smooth', block:'start'});
}
function upsert(kind, data){
  const id = editing[kind];
  if(id){
    const list = state[kind];
    const idx = list.findIndex(x=>x.id===id);
    if(idx>=0) list[idx] = {...list[idx], ...data, id};
    log('수정 완료');
  } else {
    state[kind].push({id:uid(),...data});
    log('저장 완료');
  }
  resetEdit(kind);
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function renderLists(){
  const assetList=$('assetList'); assetList.innerHTML='';
  state.assets.forEach(a=>assetList.appendChild(itemRow(a.name, `${a.type} · ${a.country||'-'} · ${a.currency}`, money(assetValue(a)), ()=>startEdit('assets', a), ()=>{ if(confirm('이 자산을 삭제할까요?')){state.assets=state.assets.filter(x=>x.id!==a.id); render();} }))); 
  if(!state.assets.length) assetList.innerHTML='<div class="empty">등록된 자산이 없습니다.</div>';
  const debtList=$('debtList'); debtList.innerHTML='';
  state.debts.forEach(d=>debtList.appendChild(itemRow(d.name, `${d.type} · ${d.currency} · ${d.rate||0}%`, money(debtValue(d)), ()=>startEdit('debts', d), ()=>{ if(confirm('이 부채를 삭제할까요?')){state.debts=state.debts.filter(x=>x.id!==d.id); render();} }))); 
  if(!state.debts.length) debtList.innerHTML='<div class="empty">등록된 부채가 없습니다.</div>';
  const insuranceList=$('insuranceList'); insuranceList.innerHTML='';
  state.insurance.forEach(i=>insuranceList.appendChild(itemRow(`${i.company} ${i.product}`, `${i.type||'-'} · 매월 ${i.payday||'-'}일 · 월 ${money(i.premium)}`, i.includeRefund?money(i.refund):'자산 제외', ()=>startEdit('insurance', i), ()=>{ if(confirm('이 보험을 삭제할까요?')){state.insurance=state.insurance.filter(x=>x.id!==i.id); render();} }))); 
  if(!state.insurance.length) insuranceList.innerHTML='<div class="empty">등록된 보험이 없습니다.</div>';
}
function renderAnalysis(){
  const a=analyzePortfolio();
  const cards=[['투자비중 점수',`${a.risk.score}/100`],['위험도',a.risk.label.trim()],['코인 비중',`${a.cryptoPct.toFixed(1)}%`],['현금 비중',`${a.cashPct.toFixed(1)}%`],['ETF/주식 비중',`${(a.etfPct+a.stockPct).toFixed(1)}%`],['단일자산 집중도',`${a.concentration.toFixed(1)}%`]];
  $('analysisCards').innerHTML=cards.map(([k,v])=>`<article class="card metric"><span>${k}</span><strong>${v}</strong></article>`).join('');
  $('rebalanceList').innerHTML=a.recommendations.map(r=>`<p>• ${escapeHtml(r)}</p>`).join('');
  renderBars('allocationBars', a.byType); renderBars('countryBars', a.byCountry);
}
function renderBars(id,obj){
  const entries=Object.entries(obj).sort((x,y)=>y[1]-x[1]);
  $(id).innerHTML = entries.length ? entries.map(([k,v])=>`<div class="bar-row"><span>${escapeHtml(k)}</span><div><i style="width:${Math.min(100,v)}%"></i></div><b>${v.toFixed(1)}%</b></div>`).join('') : '<div class="empty">분석할 데이터가 없습니다.</div>';
}

function applyTheme(){
  if(!state.settings) state.settings = {};
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark', theme === 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  const btn = $('themeToggleBtn');
  if(btn){
    btn.textContent = theme === 'dark' ? '라이트모드' : '다크모드';
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#111827');
}
function toggleTheme(){
  if(!state.settings) state.settings = {};
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
  log(state.settings.theme === 'dark' ? '다크모드 적용 완료' : '라이트모드 적용 완료');
}

function bindForms(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$(b.dataset.open).classList.toggle('hidden'));
  assetForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(assetForm)); f.currency=(f.currency||'KRW').toUpperCase(); upsert('assets', f); render(); };
  debtForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(debtForm)); f.currency=(f.currency||'KRW').toUpperCase(); upsert('debts', f); render(); };
  insuranceForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(insuranceForm)); f.includeRefund=insuranceForm.includeRefund.checked; upsert('insurance', f); render(); };
}
function backup(){ const blob=new Blob([JSON.stringify({...state,version:APP_VERSION,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-v6-4-backup.json`; a.click(); URL.revokeObjectURL(a.href); }
function restore(file){ const r=new FileReader(); r.onload=()=>{ try{ state=normalizeState(JSON.parse(r.result),'restore'); render(); log('복원 완료'); }catch(e){ log('복원 실패: JSON 파일을 확인하세요.'); } }; r.readAsText(file); }
function log(msg){ $('logBox').textContent=`[${new Date().toLocaleString()}] ${msg}`; }
function takeSnapshot(){ const t=totals(); state.snapshots.push({id:uid(),date:new Date().toISOString(),...t}); render(); log('스냅샷 저장 완료'); }
function forceMigrate(){ const found=findLegacyState(); if(found){ state=found.state; render(); log(`기존 데이터 복구 완료: ${found.key}`); } else log('기존 데이터를 찾지 못했습니다. 백업 파일 복원을 사용하세요.'); }
function resetDemo(){ state.assets = state.assets.filter(a=>!(a.name||'').startsWith('예시 ')); render(); log('예시 데이터 제거 완료'); }

async function checkForUpdate(){
  log('업데이트 확인 중...');
  try{
    if('serviceWorker' in navigator){
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg){
        await reg.update();
        const waiting = reg.waiting || reg.installing;
        if(waiting){
          waiting.postMessage({type:'SKIP_WAITING'});
          log('새 업데이트 발견. 앱을 새로고침합니다.');
          setTimeout(()=>location.reload(), 700);
          return;
        }
      }
    }
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    await fetch(`./index.html?update=${Date.now()}`, {cache:'reload'});
    await fetch(`./app.js?update=${Date.now()}`, {cache:'reload'});
    await fetch(`./styles.css?update=${Date.now()}`, {cache:'reload'});
    log('업데이트 확인 완료. 최신 파일을 다시 불러옵니다.');
    setTimeout(()=>location.reload(), 700);
  }catch(e){
    log('업데이트 확인 실패. 인터넷 연결 또는 GitHub Pages 배포 상태를 확인하세요.');
  }
}

window.addEventListener('load',()=>{
  initTabs();
  bindForms();
  applyTheme();
  render();
  log(`로드 완료 · 데이터 출처: ${state.migratedFrom || 'unknown'}`);

  const safeBind = (id, handler, event='click') => {
    const el = $(id);
    if(el) el.addEventListener(event, handler);
  };

  safeBind('snapshotBtn', takeSnapshot);
  safeBind('refreshDashboard', renderDashboard);
  safeBind('refreshAnalysis', renderAnalysis);
  safeBind('backupBtn', backup);
  const restoreEl = $('restoreInput');
  if(restoreEl) restoreEl.addEventListener('change', e=>e.target.files[0]&&restore(e.target.files[0]));
  safeBind('syncCheckBtn', ()=>log('로컬 저장 정상 · GitHub 백업/동기화 데이터는 기존 설정값 유지 대상입니다.'));
  safeBind('updateCheckBtn', checkForUpdate);
  safeBind('clearCacheBtn', async()=>{
    if('caches' in window){
      const ks=await caches.keys();
      await Promise.all(ks.map(k=>caches.delete(k)));
    }
    log('캐시 삭제 완료. 앱을 완전히 종료 후 다시 열어주세요.');
  });
  safeBind('forceMigrateBtn', forceMigrate);
  safeBind('resetDemoBtn', resetDemo);
  safeBind('themeToggleBtn', toggleTheme);

  document.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>resetEdit(btn.dataset.cancel)));
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});
