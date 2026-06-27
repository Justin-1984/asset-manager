const APP_VERSION = 'v6.10.0-avg-buy-calculator';
const BACKUP_HISTORY_KEY = 'assetManagerPWA_v6_backupHistory';
const STORAGE_KEY = 'assetManagerPWA_v6';
const PRICE_CACHE_KEY = 'assetManagerPWA_v6_priceCache';
const MARKET_LOG_KEY = 'assetManagerPWA_v6_marketLog';
const LEGACY_KEYS = ['asset-manager-v4-5-1','asset-manager-v4-5','asset-manager-v4-4','asset-manager-v4','asset-manager-v3-9','assetManagerPWA_v5_4','assetManagerPWA_v54','assetManager_v5_4','assetManagerPWA_v5','assetManagerPWA','assetManager','asset_manager_data'];
const MARKET_REFRESH_MINUTES = 15;
const tabs = [['dashboard','대시보드'],['assets','자산'],['debts','부채'],['insurance','보험'],['analysis','분석'],['calculator','계산기'],['settings','설정']];
const fxDefaults = { KRW:1, USD:1380, USDT:1380, HKD:195, AUD:1080 };
let state = loadState();
(function applyLegacyPrefsOnce(){ const p=getLegacyPrefs(); if(p){ if(!state.settings) state.settings={}; if(!state.settings.marketWorkerUrl && p.marketWorkerUrl) state.settings.marketWorkerUrl=p.marketWorkerUrl; if(goodRate("USD",p.usdRate)) state.fx.USD=Number(p.usdRate); if(goodRate("USDT",p.usdtRate)) state.fx.USDT=Number(p.usdtRate); if(goodRate("HKD",p.hkdRate)) state.fx.HKD=Number(p.hkdRate); if(goodRate("AUD",p.audRate)) state.fx.AUD=Number(p.audRate); } })();

const $ = id => document.getElementById(id);
function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()+Math.random()); }
function num(v){ return Number(v)||0; }
function money(v){ return '₩' + Math.round(num(v)).toLocaleString('ko-KR'); }
function fx(cur){ return state.fx[(cur||'KRW').toUpperCase()] || 1; }
function getLegacyPrefs(){ try{return JSON.parse(localStorage.getItem('asset-manager-prefs')||'{}');}catch(e){return {};} }
function goodRate(cur,val){ val=Number(val); const range={USD:[900,2500],USDT:[900,2500],HKD:[100,300],AUD:[600,1400]}; const r=range[cur]; return !!(r && val>=r[0] && val<=r[1]); }
function setFxRate(cur,val){ if(goodRate(cur,val)) state.fx[cur]=Math.round(Number(val)*100)/100; }
function safeSettings(){
  if(!state.settings || typeof state.settings !== 'object') state.settings = {};
  if(!Array.isArray(state.settings.hiddenTabs)) state.settings.hiddenTabs = [];
  const ids = tabs.map(t=>t[0]);
  state.settings.hiddenTabs = state.settings.hiddenTabs.filter(id=>ids.includes(id) && id !== 'settings');
  if(!ids.some(id=>!state.settings.hiddenTabs.includes(id)) || state.settings.hiddenTabs.includes('settings')) state.settings.hiddenTabs = [];
  return state.settings;
}
function hasMeaningfulData(s){ return !!(s && ((s.assets&&s.assets.length)||(s.debts&&s.debts.length)||(s.insurance&&s.insurance.length)||(s.snapshots&&s.snapshots.length))); }
function getPriceCache(){ try{return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY)||'{}');}catch(e){return {};} }
function setPriceCache(cache){ try{localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache||{}));}catch(e){} }
function marketLog(entry){ try{ const list=JSON.parse(localStorage.getItem(MARKET_LOG_KEY)||'[]'); list.unshift({time:new Date().toISOString(), ...entry}); localStorage.setItem(MARKET_LOG_KEY, JSON.stringify(list.slice(0,80))); }catch(e){} }
function assetValue(a){
  const cur=(a.currency||'KRW').toUpperCase();
  const amount = num(a.amount)||1;
  const price = num(a.price);
  // v6.9.5: 현재평가액은 항상 현재단가 × 현재환율로 계산합니다.
  // 기존 value/krwValue는 예전 환율로 저장된 stale 값일 수 있으므로 price가 없을 때만 fallback으로 사용합니다.
  if(price>0) return amount * price * fx(cur);
  return num(a.value) || num(a.krwValue) || 0;
}
function debtValue(d){ return num(d.value) || num(d.krwValue) || num(d.balance) * fx(d.currency); }

function save(){
  state.version = APP_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateBackupStatus();
}
function getBackupHistory(){
  try{return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY)||'[]');}catch(e){return [];}
}
function setBackupHistory(list){
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(list.slice(0,30)));
  updateBackupStatus();
  renderBackupHistory();
}
function createLocalVersionBackup(reason='수동 백업'){
  const t = totals();
  const backup = {
    id: uid(),
    createdAt: new Date().toISOString(),
    reason,
    version: APP_VERSION,
    totals: t,
    data: JSON.parse(JSON.stringify({...state, version:APP_VERSION}))
  };
  const list = getBackupHistory();
  list.unshift(backup);
  setBackupHistory(list);
  localStorage.setItem('assetManagerPWA_v6_lastGoodBackup', JSON.stringify(backup));
  return backup;
}
function autoBackup(reason){
  try{ createLocalVersionBackup(reason); log('자동 버전백업 완료 · '+reason); }
  catch(e){ log('자동 백업 실패: 브라우저 저장공간을 확인하세요.'); }
}
function backupAgeText(iso){
  if(!iso) return '백업 없음';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff/60000);
  if(min < 1) return '방금 전';
  if(min < 60) return `${min}분 전`;
  const hr = Math.floor(min/60);
  if(hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr/24)}일 전`;
}
function updateBackupStatus(){
  const card=$('backupStatusCard'), dot=$('backupDot'), title=$('backupStatusTitle'), text=$('backupStatusText');
  if(!card || !dot || !title || !text) return;
  const last=getBackupHistory()[0];
  const min = last ? (Date.now()-new Date(last.createdAt).getTime())/60000 : Infinity;
  card.classList.remove('ok','warn','bad'); dot.classList.remove('ok','warn','bad');
  const cls = !last ? 'bad' : min>60 ? 'warn' : 'ok';
  card.classList.add(cls); dot.classList.add(cls);
  title.textContent = !last ? '백업 없음' : cls==='ok' ? '데이터 보호 정상' : '백업 확인 필요';
  text.textContent = last ? `최근 백업 ${backupAgeText(last.createdAt)} · ${last.reason} · ${money(last.totals?.net||0)}` : '데이터 입력 전 현재 상태 백업을 먼저 만들어두세요.';
}
function renderBackupHistory(){
  const box=$('backupHistoryList'); if(!box) return;
  const list=getBackupHistory();
  if(!list.length){ box.innerHTML='<div class="empty">아직 버전 백업이 없습니다.</div>'; return; }
  box.innerHTML=list.slice(0,8).map((b,i)=>`<div class="backup-item"><div><b>${new Date(b.createdAt).toLocaleString()}</b><p>${escapeHtml(b.reason)} · 순자산 ${money(b.totals?.net||0)}</p></div><button type="button" data-restore-backup="${i}">복원</button></div>`).join('');
  box.querySelectorAll('[data-restore-backup]').forEach(btn=>btn.onclick=()=>restoreVersionBackup(Number(btn.dataset.restoreBackup)));
}
function restoreVersionBackup(index){
  const list=getBackupHistory(); const item=list[index];
  if(!item) return log('복원할 백업을 찾지 못했습니다.');
  if(!confirm('선택한 백업으로 현재 데이터를 되돌릴까요? 현재 상태는 먼저 자동 백업됩니다.')) return;
  createLocalVersionBackup('복원 전 자동백업');
  state=normalizeState(item.data,'version-backup');
  render();
  log('버전 백업 복원 완료');
}
function downloadBackupHistory(){
  const payload={app:'AssetManagerPWA',version:APP_VERSION,exportedAt:new Date().toISOString(),current:state,history:getBackupHistory()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-v6-6-backup-history.json`; a.click(); URL.revokeObjectURL(a.href);
  log('백업묶음 다운로드 완료');
}
function integrityCheck(){
  const problems=[];
  ['assets','debts','insurance','snapshots'].forEach(k=>{ if(!Array.isArray(state[k])) problems.push(`${k} 배열 오류`); });
  if(!state.fx || typeof state.fx!=='object') problems.push('환율 정보 오류');
  state.assets.forEach((a,i)=>{ if(!a.id) problems.push(`자산 ${i+1} ID 없음`); if(!a.name) problems.push(`자산 ${i+1} 이름 없음`); });
  state.debts.forEach((d,i)=>{ if(!d.id) problems.push(`부채 ${i+1} ID 없음`); });
  state.insurance.forEach((x,i)=>{ if(!x.id) problems.push(`보험 ${i+1} ID 없음`); });
  if(problems.length){ log('데이터 검사 결과: 확인 필요\n- '+problems.join('\n- ')); }
  else { createLocalVersionBackup('데이터 검사 정상'); log('데이터 검사 완료 · 문제 없음 · 정상 백업 생성'); }
}
function cleanOldBackups(){
  const list=getBackupHistory().slice(0,30);
  setBackupHistory(list);
  log('백업 정리 완료 · 최근 30개 보관');
}


function normalizeArray(v){ return Array.isArray(v) ? v : []; }
function normalizeState(raw, source='unknown'){
  const old = raw || {};
  return {
    version: APP_VERSION,
    migratedFrom: source,
    fx: {...fxDefaults, ...(old.fx||old.exchangeRates||{})},
    assets: normalizeArray(old.assets || old.assetList).map(a=>({id:a.id||uid(), name:a.name||a.title||'이름없음', symbol:a.symbol||a.ticker||a.code||'', type:a.type||a.category||'자산', country:a.country||a.account||'', account:a.account||'', currency:(a.currency||'KRW').toUpperCase(), amount:a.amount??a.quantity??a.qty??1, price:a.price??a.currentPrice??0, cost:a.cost??a.costPrice??a.principal??0, value:a.value, krwValue:a.krwValue, priceSource:a.priceSource||'', priceUpdatedAt:a.priceUpdatedAt||''})),
    debts: normalizeArray(old.debts || old.debtList).map(d=>({id:d.id||uid(), name:d.name||d.title||'부채', type:d.type||'일반 부채', currency:(d.currency||'KRW').toUpperCase(), balance:d.balance??d.amount??d.value??0, rate:d.rate||0, monthly:d.monthly||0, value:d.value, krwValue:d.krwValue})),
    insurance: normalizeArray(old.insurance || old.insurances || old.policies).map(i=>({id:i.id||uid(), company:i.company||i.insurer||'', product:i.product||i.name||'', type:i.type||'', premium:i.premium||0, payday:i.payday||'', refund:i.refund||0, includeRefund:!!i.includeRefund, memo:i.memo||''})),
    snapshots: normalizeArray(old.snapshots),
    settings: { hiddenTabs: [], theme: 'light', finnhubToken: old.finnhubToken || '', marketWorkerUrl: old.marketWorkerUrl || old.settings?.marketWorkerUrl || '', ...(old.settings||{}) }
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
function latestBackupState(){
  try{
    const direct = JSON.parse(localStorage.getItem('assetManagerPWA_v6_lastGoodBackup')||'null');
    if(direct && direct.data && hasMeaningfulData(direct.data)) return {state:normalizeState(direct.data,'lastGoodBackup'), key:'lastGoodBackup'};
  }catch(e){}
  try{
    const list = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY)||'[]');
    const hit = list.find(b=>b && b.data && hasMeaningfulData(b.data));
    if(hit) return {state:normalizeState(hit.data,'backupHistory'), key:'backupHistory'};
  }catch(e){}
  return null;
}
function loadState(){
  const found = findLegacyState();
  if(found && hasMeaningfulData(found.state)){ return found.state; }
  const backup = latestBackupState();
  if(backup){ return backup.state; }
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
function assetCostKrw(a){
  // v6.9.6 기준: 입력칸의 '매입 원금'은 원화 총매입원금으로 고정합니다.
  // 현재환율은 현재평가액에만 반영하고, 매입원금은 환율 갱신 때 바뀌지 않게 합니다.
  return num(a.cost);
}
function investmentProfit(){
  const cost = state.assets.reduce((sum,a)=>sum+assetCostKrw(a),0);
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
  $('dashTopAssets').innerHTML = top.length ? top.map((x,i)=>`<div><b>${i+1}. ${escapeHtml(displayAssetName(x))}</b><span>${escapeHtml(x.type)} · ${money(x._v)}</span></div>`).join('') : '<div class="empty">자산을 등록하면 TOP 5가 표시됩니다.</div>';
  $('dashChanges').innerHTML = [
    ['이번 주', week], ['이번 달', month], ['올해', year]
  ].map(([label,val])=>`<p><b>${label}</b><span>${val===null?'스냅샷 없음':money(val)}</span></p>`).join('');
  $('dashChecks').innerHTML = a.recommendations.slice(0,4).map(r=>`<p>• ${escapeHtml(r)}</p>`).join('');
  const ds=$('dashMarketStatus'); if(ds) ds.textContent = marketStatusText();
}



function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function getNeededCurrencies(){
  const cur = [];
  state.assets.forEach(a=>cur.push((a.currency||'KRW').toUpperCase()));
  state.debts.forEach(d=>cur.push((d.currency||'KRW').toUpperCase()));
  return uniq(cur).filter(c=>c!=='KRW');
}
function marketStatusText(){
  const m = state.settings?.market || {};
  if(!m.lastUpdate) return '아직 자동 갱신 전입니다.';
  const t = new Date(m.lastUpdate).toLocaleString();
  return `${t} · ${m.message || '갱신 완료'}`;
}
function setMarketStatus(message, ok=true){
  if(!state.settings) state.settings = {};
  state.settings.market = {...(state.settings.market||{}), lastUpdate: ok ? new Date().toISOString() : (state.settings.market?.lastUpdate||''), message, ok};
  const box=$('marketStatusText'); if(box) box.textContent = marketStatusText();
  const mini=$('dashMarketStatus'); if(mini) mini.textContent = marketStatusText();
  save();
}
async function fetchWithTimeout(url, options={}, timeout=8000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try{ return await fetch(url, {...options, cache:'no-store', signal:ctrl.signal}); }
  finally{ clearTimeout(id); }
}
async function fetchJson(url, timeout=8000){
  const res = await fetchWithTimeout(url, {}, timeout);
  if(!res.ok) throw new Error('HTTP '+res.status);
  return await res.json();
}
async function fetchText(url, timeout=8000){
  const res = await fetchWithTimeout(url, {}, timeout);
  if(!res.ok) throw new Error('HTTP '+res.status);
  return await res.text();
}
async function updateFxRates(){
  const needed = getNeededCurrencies();
  if(!needed.length && !state.assets.length && !state.debts.length) return '환율 필요 없음';
  const legacy = getLegacyPrefs();
  try{
    const j = await fetchJson('https://open.er-api.com/v6/latest/USD', 9000);
    const r = j.rates || {};
    const usd = Number(r.KRW), hkdPerUsd = Number(r.HKD), audPerUsd = Number(r.AUD);
    if(!usd || !hkdPerUsd || !audPerUsd) throw new Error('ER API 데이터 부족');
    setFxRate('USD', usd);
    setFxRate('USDT', usd); // USDT는 USD 환율 기준으로 유지
    setFxRate('HKD', usd / hkdPerUsd);
    setFxRate('AUD', usd / audPerUsd);
    state.settings.fxUpdatedAt = new Date().toISOString();
    return `환율 갱신 완료(ER) USD ${state.fx.USD} / HKD ${state.fx.HKD} / AUD ${state.fx.AUD}`;
  }catch(primaryErr){
    try{
      const j = await fetchJson('https://api.frankfurter.app/latest?from=USD&to=KRW,HKD,AUD', 9000);
      const r = j.rates || {};
      const usd = Number(r.KRW), hkdPerUsd = Number(r.HKD), audPerUsd = Number(r.AUD);
      if(!usd || !hkdPerUsd || !audPerUsd) throw new Error('Frankfurter 데이터 부족');
      setFxRate('USD', usd);
      setFxRate('USDT', usd);
      setFxRate('HKD', usd / hkdPerUsd);
      setFxRate('AUD', usd / audPerUsd);
      state.settings.fxUpdatedAt = new Date().toISOString();
      return `환율 갱신 완료(Frankfurter) USD ${state.fx.USD} / HKD ${state.fx.HKD} / AUD ${state.fx.AUD}`;
    }catch(e){
      // v4.5.1에서 저장했던 환율이 있으면 마지막 정상값으로 복원
      if(goodRate('USD', legacy.usdRate)) setFxRate('USD', legacy.usdRate);
      if(goodRate('USDT', legacy.usdtRate)) setFxRate('USDT', legacy.usdtRate);
      if(goodRate('HKD', legacy.hkdRate)) setFxRate('HKD', legacy.hkdRate);
      if(goodRate('AUD', legacy.audRate)) setFxRate('AUD', legacy.audRate);
      return '환율 갱신 실패 · 마지막 정상 환율 유지';
    }
  }
}
function cleanSymbol(name){
  return String(name||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$|USD$|KRW$/,'');
}
const cryptoNameMap = {BTC:'bitcoin',ETH:'ethereum',XRP:'ripple',SOL:'solana',AVAX:'avalanche-2',LINK:'chainlink',BNB:'binancecoin',DOGE:'dogecoin',ADA:'cardano',TRX:'tron',DOT:'polkadot'};
const KR_ETF_NAMES = {
  '069500':'KODEX 200','102110':'TIGER 200','278530':'KODEX 200TR','360750':'TIGER 미국S&P500','379800':'KODEX 미국S&P500TR','379810':'KODEX 미국나스닥100TR','133690':'TIGER 미국나스닥100','381180':'TIGER 미국필라델피아반도체나스닥','453850':'ACE 미국30년국채액티브(H)','441640':'KODEX 미국배당커버드콜액티브','458730':'TIGER 미국배당다우존스','489250':'KODEX 미국배당다우존스','476800':'KODEX 한국부동산리츠인프라','329200':'TIGER 리츠부동산인프라','114800':'KODEX 인버스','252670':'KODEX 200선물인버스2X','122630':'KODEX 레버리지','305720':'KODEX 2차전지산업','364980':'TIGER 2차전지TOP10','371460':'TIGER 차이나전기차SOLACTIVE'
};
function krEtfKnownName(code){ return KR_ETF_NAMES[String(code||'').trim()] || ''; }
function validKrwMarketPrice(v){ v=Number(v); return v>=100 && v<=1000000; }
function parseKoreanPrice(v){ return Number(String(v||'').replace(/[^0-9.]/g,'')); }

async function fetchCryptoUsd(symbol){
  const s = cleanSymbol(symbol);
  if(!s) throw new Error('symbol');
  try{ const j=await fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${s}USDT`); if(j.price) return Number(j.price); }catch(e){}
  try{ const j=await fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${s}-USDT`); if(j.data?.[0]?.last) return Number(j.data[0].last); }catch(e){}
  try{ const j=await fetchJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${s}USDT`); if(j.result?.list?.[0]?.lastPrice) return Number(j.result.list[0].lastPrice); }catch(e){}
  try{ const id=cryptoNameMap[s]; if(id){ const j=await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`); if(j[id]?.usd) return Number(j[id].usd); } }catch(e){}
  throw new Error('crypto price failed');
}
function normalizeWorkerUrl(raw){
  let worker=String(raw||'').trim();
  const legacy=getLegacyPrefs();
  if(!worker && legacy.marketWorkerUrl) worker=String(legacy.marketWorkerUrl).trim();
  if(!worker) throw new Error('미국주식/ETF Worker URL 미설정');
  if(worker.includes('justin-1984.github.io')) throw new Error('Worker URL이 앱 주소입니다. workers.dev 주소를 넣어주세요.');
  if(worker.includes('dash.cloudflare.com')) throw new Error('Cloudflare 편집 주소가 아니라 workers.dev 주소를 넣어주세요.');
  try{
    const u=new URL(worker);
    if(!u.hostname.includes('workers.dev')) throw new Error('workers.dev 주소가 아닙니다');
    return u.origin;
  }catch(e){ throw new Error('Worker URL 형식 오류: '+worker); }
}
async function fetchMarketWorkerPrice(symbol){
  const worker=normalizeWorkerUrl(state.settings?.marketWorkerUrl);
  const reqUrl=worker+'/?symbol='+encodeURIComponent(symbol);
  const txt=await fetchText(reqUrl, 10000);
  let j;
  try{ j=JSON.parse(txt); }catch(e){ throw new Error('Worker 응답 JSON 아님: '+txt.slice(0,80)); }
  if(!j.ok || !Number(j.price)) throw new Error((j.error||'Worker 가격 없음')+' · '+reqUrl);
  return {price:Number(j.price), source:j.source||'Market Worker', currency:j.currency||''};
}
async function fetchYahooChart(symbol){
  const urls=[
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
  ];
  for(const url of urls){
    const j=await fetchJson(url, 9000);
    const result=j.chart?.result?.[0];
    const meta=result?.meta||{};
    const price=Number(meta.regularMarketPrice || meta.previousClose || meta.chartPreviousClose);
    if(price>0) return price;
  }
  throw new Error('Yahoo 가격 없음');
}
async function fetchStooqPrice(symbol){
  const txt=await fetchText(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`, 9000);
  const line=txt.trim().split('\n')[1]||'';
  const parts=line.split(',');
  const close=Number(parts[6]);
  if(close>0) return close;
  throw new Error('Stooq 가격 파싱 실패');
}

function extractKoreanCode(...parts){
  const text = parts.map(x=>String(x||'')).join(' ');
  const m = text.match(/\b(\d{6})\b/);
  return m ? m[1] : '';
}
function cleanKoreanNameFromTitle(title, code){
  let t = String(title||'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  t = t.replace(/[:：]? 네이버페이 증권.*/,'').replace(/ - 네이버페이 증권.*/,'').replace(/종목상세.*/,'').trim();
  t = t.replace(new RegExp('^'+code+'\\s*'), '').trim();
  return t;
}
async function fetchNaverRealtimeKoreanPrice(code){
  const url=`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
  const j=await fetchJson(url, 9000);
  const item=j.result?.areas?.[0]?.datas?.[0];
  const price=parseKoreanPrice(item?.nv || item?.closePrice || item?.cv);
  if(validKrwMarketPrice(price)) return price;
  throw new Error('Naver Realtime 가격 파싱 실패');
}
async function fetchNaverJinaKoreanPrice(code){
  const txt=await fetchText(`https://r.jina.ai/http://finance.naver.com/item/main.naver?code=${code}`, 12000);
  const clean=txt.replace(/\s+/g,' ');
  const candidates=[/현재가\s*([0-9,]{3,})/, /종가\s*([0-9,]{3,})/, /([0-9]{1,3}(?:,[0-9]{3})+)\s*원/];
  for(const rgx of candidates){
    const m=clean.match(rgx);
    if(m){ const p=parseKoreanPrice(m[1]); if(validKrwMarketPrice(p)) return p; }
  }
  throw new Error('Naver/Jina 가격 파싱 실패');
}
async function fetchKoreanEtfInfo(...texts){
  const code = extractKoreanCode(...texts);
  if(!code) throw new Error('한국 ETF는 6자리 종목코드가 필요합니다. 예: 069500');
  const errors=[];
  let name = krEtfKnownName(code) || code;

  // v6.9.9: v4.5.1에서 성공했던 구조로 복원. 한국 ETF도 Worker를 1순위로 사용합니다.
  try{
    const w = await fetchMarketWorkerPrice(code);
    if(validKrwMarketPrice(w.price)){
      return {code, name, price:Number(w.price), source:w.source || 'Market Worker', currency:w.currency || 'KRW'};
    }
    errors.push('Worker:비정상 가격 '+w.price);
  }catch(e){ errors.push('Worker:'+e.message); }

  // 2순위: v4.5.1의 네이버 실시간 API. 현재가(nv)만 허용합니다.
  try{
    const p = await fetchNaverRealtimeKoreanPrice(code);
    return {code, name, price:p, source:'Naver Realtime', currency:'KRW'};
  }catch(e){ errors.push('NaverRealtime:'+e.message); }

  // 3순위: v4.5.1의 Jina/Naver 보조 조회.
  try{
    const p = await fetchNaverJinaKoreanPrice(code);
    return {code, name, price:p, source:'Naver/Jina', currency:'KRW'};
  }catch(e){ errors.push('Naver/Jina:'+e.message); }

  // 4순위: Yahoo KS/KQ. HTML 오류가 잦아서 최후순위로만 사용합니다.
  try{
    const p = await fetchYahooChart(code+'.KS');
    if(validKrwMarketPrice(p)) return {code, name, price:p, source:'Yahoo KS', currency:'KRW'};
  }catch(e){ errors.push('Yahoo.KS:'+e.message); }
  try{
    const p = await fetchYahooChart(code+'.KQ');
    if(validKrwMarketPrice(p)) return {code, name, price:p, source:'Yahoo KQ', currency:'KRW'};
  }catch(e){ errors.push('Yahoo.KQ:'+e.message); }

  // 실패해도 종목명은 살립니다. 단, 현재단가는 절대 이상한 값으로 덮지 않습니다.
  if(name && name !== code) return {code, name, price:0, source:'Name Map', currency:'KRW'};
  throw new Error('한국 ETF 조회 실패 ('+errors.join(' → ')+')');
}
async function fetchKoreanEtfKrw(name, symbol){
  return await fetchKoreanEtfInfo(symbol, name);
}
async function lookupKoreanEtfNameFromInput(){
  const form = $('assetForm'); if(!form) return;
  const code = extractKoreanCode(form.symbol?.value, form.name?.value);
  const status = $('krEtfLookupStatus');
  if(!code){ if(status) status.textContent='6자리 종목코드를 입력하세요.'; return; }
  try{
    if(status) status.textContent='한국 ETF 이름/시세 조회 중...';
    const info = await fetchKoreanEtfInfo(code);
    if(form.symbol) form.symbol.value = info.code;
    if(form.name && info.name && info.name !== info.code) form.name.value = `${info.code} ${info.name}`;
    if(form.currency) form.currency.value = 'KRW';
    if(form.price && info.price>0) form.price.value = info.price;
    if(status) status.textContent = info.price>0 ? `조회 완료 · ${info.code} ${info.name||''} · ${info.price.toLocaleString('ko-KR')}원 · ${info.source}` : `이름 확인 완료 · ${info.code} ${info.name||''} · 가격은 시세/환율 갱신에서 다시 시도`;
  }catch(e){ if(status) status.textContent='조회 실패: '+e.message; }
}

async function fetchStockUsd(symbol){
  const raw = cleanSymbol(symbol).replace(/[^A-Z0-9.]/g,'');
  if(!raw) throw new Error('symbol');
  const errors=[];
  // v6.9.5: v4.5.1에서 성공했던 Worker(Finnhub) 방식을 최우선으로 복원
  try{ const w=await fetchMarketWorkerPrice(raw); return Number(w.price); }catch(e){ errors.push('Worker:'+e.message); }
  try{ return await fetchStooqPrice(raw.toLowerCase()+'.us'); }catch(e){ errors.push('Stooq:'+e.message); }
  try{ return await fetchYahooChart(raw); }catch(e){ errors.push('Yahoo:'+e.message); }
  throw new Error(`${raw} 미국 ETF/주식 시세 실패 (${errors.join(' → ')})`);
}
async function updateAssetMarketPrices(){
  let updated = 0, skipped = 0, failed = 0, cached = 0;
  const cache = getPriceCache();
  for(const a of state.assets){
    const type = String(a.type||'');
    const symbol = cleanSymbol(a.name || a.symbol || a.ticker);
    try{
      if(!symbol){ skipped++; continue; }
      if(type.includes('코인')){
        const usd = await fetchCryptoUsd(symbol);
        a.price = (a.currency||'USDT').toUpperCase()==='KRW' ? usd * (state.fx.USDT||state.fx.USD||fxDefaults.USD) : usd;
        cache[symbol] = {price:a.price, usd, at:new Date().toISOString(), currency:(a.currency||'USDT').toUpperCase()};
        updated++;
      } else if(type.includes('한국 ETF')){
        const kr = await fetchKoreanEtfKrw(a.name, a.symbol || a.ticker || a.code);
        a.symbol = kr.code || a.symbol || a.ticker || a.code || '';
        if(kr.name && kr.name !== kr.code) a.name = `${kr.code} ${kr.name}`;
        if(Number(kr.price)>0) a.price = Number(kr.price);
        a.currency = 'KRW';
        a.priceSource = kr.source;
        a.priceUpdatedAt = new Date().toLocaleString('ko-KR');
        if(Number(kr.price)>0) cache[kr.code || symbol || extractKoreanCode(a.name)] = {price:a.price, at:new Date().toISOString(), currency:'KRW', source:kr.source};
        updated++;
      } else if(type.includes('미국주식') || type.includes('미국 ETF') || (type.toUpperCase().includes('ETF') && !type.includes('한국')) || type.includes('주식')){
        const usd = await fetchStockUsd(symbol);
        a.price = (a.currency||'USD').toUpperCase()==='KRW' ? usd * (state.fx.USD||fxDefaults.USD) : usd;
        cache[symbol] = {price:a.price, usd, at:new Date().toISOString(), currency:(a.currency||'USD').toUpperCase()};
        updated++;
      } else {
        skipped++;
      }
    }catch(e){
      const old = cache[symbol];
      if(old && old.price>0){ a.price = old.price; cached++; marketLog({symbol, source:'cache', ok:true, message:'최근 성공 시세 유지'}); }
      else { failed++; marketLog({symbol, source:'all', ok:false, message:String(e.message||e)}); }
    }
  }
  setPriceCache(cache);
  return `시세 ${updated}개 갱신${cached?`, ${cached}개 캐시 유지`:''}${failed?`, ${failed}개 실패`:''}${skipped?`, ${skipped}개 제외`:''}`;
}
let marketUpdating = false;
async function refreshMarketData(manual=false){
  if(marketUpdating) return;
  if(!navigator.onLine){ setMarketStatus('오프라인 · 온라인 복귀 시 갱신 대기', false); return; }
  marketUpdating = true;
  const btn=$('marketRefreshBtn'); if(btn) btn.textContent='갱신 중...';
  try{
    setMarketStatus('환율/시세 갱신 중...', false);
    const fxMsg = await updateFxRates();
    const priceMsg = await updateAssetMarketPrices();
    setMarketStatus(`${fxMsg} · ${priceMsg}`, true);
    renderSummary(); renderAnalysis(); renderDashboard(); renderLists();
    log('자동 업데이트 완료 · '+fxMsg+' · '+priceMsg);
  }catch(e){
    setMarketStatus('갱신 실패 · 기존 데이터 유지', false);
    log('자동 업데이트 실패 · 인터넷/API 상태를 확인하세요.');
  }finally{
    marketUpdating = false;
    if(btn) btn.textContent='시세/환율 갱신';
  }
}
function startAutoMarketRefresh(){
  setTimeout(()=>refreshMarketData(false), 500);
  setInterval(()=>refreshMarketData(false), MARKET_REFRESH_MINUTES*60*1000);
  window.addEventListener('online', ()=>refreshMarketData(false));
}

function initTabs(){
  safeSettings();
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
function render(){ applyTheme(); renderSummary(); renderLists(); renderAnalysis(); renderDashboard(); renderBackupHistory(); updateBackupStatus(); renderMarketSettings(); renderAverageAssetOptions(); save(); }
function renderSummary(){
  const t=totals(); const a=analyzePortfolio();
  $('versionBadge').textContent='v6.9.6'; $('totalAssets').textContent=money(t.assets); $('totalDebts').textContent=money(t.debts); $('netWorth').textContent=money(t.net); $('riskLevel').textContent=a.risk.label.trim();
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
  autoBackup(kind==='assets' ? '자산 변경' : kind==='debts' ? '부채 변경' : '보험 변경');
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function displayAssetName(a){
  const code = extractKoreanCode(a.symbol, a.name);
  if(String(a.type||'').includes('한국 ETF') && code){
    const nm = krEtfKnownName(code);
    if(nm && !String(a.name||'').includes(nm)) return `${code} ${nm}`;
  }
  return a.name || code || '이름없음';
}
function renderLists(){
  const assetList=$('assetList'); assetList.innerHTML='';
  state.assets.forEach(a=>assetList.appendChild(itemRow(displayAssetName(a), `${a.type} · ${a.symbol?escapeHtml(a.symbol)+' · ':''}${a.country||'-'} · ${a.currency}`, money(assetValue(a)), ()=>startEdit('assets', a), ()=>{ if(confirm('이 자산을 삭제할까요?')){state.assets=state.assets.filter(x=>x.id!==a.id); autoBackup('자산 삭제'); render();} }))); 
  if(!state.assets.length) assetList.innerHTML='<div class="empty">등록된 자산이 없습니다.</div>';
  const debtList=$('debtList'); debtList.innerHTML='';
  state.debts.forEach(d=>debtList.appendChild(itemRow(d.name, `${d.type} · ${d.currency} · ${d.rate||0}%`, money(debtValue(d)), ()=>startEdit('debts', d), ()=>{ if(confirm('이 부채를 삭제할까요?')){state.debts=state.debts.filter(x=>x.id!==d.id); autoBackup('부채 삭제'); render();} }))); 
  if(!state.debts.length) debtList.innerHTML='<div class="empty">등록된 부채가 없습니다.</div>';
  const insuranceList=$('insuranceList'); insuranceList.innerHTML='';
  state.insurance.forEach(i=>insuranceList.appendChild(itemRow(`${i.company} ${i.product}`, `${i.type||'-'} · 매월 ${i.payday||'-'}일 · 월 ${money(i.premium)}`, i.includeRefund?money(i.refund):'자산 제외', ()=>startEdit('insurance', i), ()=>{ if(confirm('이 보험을 삭제할까요?')){state.insurance=state.insurance.filter(x=>x.id!==i.id); autoBackup('보험 삭제'); render();} }))); 
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


function renderAverageAssetOptions(){
  const sel=$('avgAssetSelect');
  if(!sel) return;
  const current=sel.value;
  sel.innerHTML='<option value="">직접 입력</option>' + state.assets.map(a=>`<option value="${a.id}">${escapeHtml(displayAssetName(a))} · ${escapeHtml(a.currency||'KRW')}</option>`).join('');
  if(current && state.assets.some(a=>a.id===current)) sel.value=current;
}
function loadAverageAsset(){
  const sel=$('avgAssetSelect'); if(!sel || !sel.value) return;
  const a=state.assets.find(x=>x.id===sel.value); if(!a) return;
  const qty=Number(a.amount||0);
  const cost=Number(a.cost||0);
  const avg = qty>0 && cost>0 ? cost/qty : Number(a.price||0);
  if($('avgCurrentQty')) $('avgCurrentQty').value = qty || '';
  if($('avgCurrentPrice')) $('avgCurrentPrice').value = avg ? String(Math.round(avg*10000)/10000) : '';
  if($('avgResult')) $('avgResult').innerHTML = `<div class="empty">${escapeHtml(displayAssetName(a))} 기준으로 기존 수량/평단을 불러왔습니다.</div>`;
}
function calculateAverageBuy(){
  const curQty=Number($('avgCurrentQty')?.value||0);
  const curPrice=Number($('avgCurrentPrice')?.value||0);
  const addQty=Number($('avgAddQty')?.value||0);
  const addPrice=Number($('avgAddPrice')?.value||0);
  const fee=Number($('avgFee')?.value||0);
  const box=$('avgResult');
  if(!box) return;
  if(curQty<0 || addQty<0 || curPrice<0 || addPrice<0 || fee<0 || (curQty+addQty)<=0){
    box.innerHTML='<div class="empty">수량과 단가를 확인해 주세요.</div>'; return;
  }
  const oldCost=curQty*curPrice;
  const addCost=addQty*addPrice + fee;
  const totalQty=curQty+addQty;
  const totalCost=oldCost+addCost;
  const newAvg=totalCost/totalQty;
  const beforeAvg=curQty>0?curPrice:0;
  const diff=beforeAvg>0?newAvg-beforeAvg:0;
  const diffPct=beforeAvg>0?(diff/beforeAvg*100):0;
  const rows=[
    ['기존 매입금액', money(oldCost)],
    ['추가 매입금액', money(addCost)],
    ['총 보유수량', totalQty.toLocaleString('ko-KR',{maximumFractionDigits:8})],
    ['새 총 매입금액', money(totalCost)],
    ['새 평단', newAvg.toLocaleString('ko-KR',{maximumFractionDigits:4})],
    ['평단 변화', beforeAvg>0 ? `${diff>=0?'+':''}${diff.toLocaleString('ko-KR',{maximumFractionDigits:4})} (${diffPct>=0?'+':''}${diffPct.toFixed(2)}%)` : '-']
  ];
  box.dataset.copy = `새 평단: ${newAvg}\n총 보유수량: ${totalQty}\n총 매입금액: ${totalCost}`;
  box.innerHTML = '<div class="avg-grid">' + rows.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div>';
}
function resetAverageCalculator(){
  ['avgCurrentQty','avgCurrentPrice','avgAddQty','avgAddPrice','avgFee'].forEach(id=>{ const el=$(id); if(el) el.value = id==='avgFee' ? '0' : ''; });
  const sel=$('avgAssetSelect'); if(sel) sel.value='';
  const box=$('avgResult'); if(box) box.innerHTML='';
}
async function copyAverageResult(){
  const box=$('avgResult'); const txt=box?.dataset?.copy;
  if(!txt){ log('복사할 계산 결과가 없습니다.'); return; }
  try{ await navigator.clipboard.writeText(txt); log('평단 계산 결과 복사 완료'); }
  catch(e){ log('복사 실패. 결과를 직접 선택해서 복사하세요.'); }
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


function renderMarketSettings(){
  const ids=['USD','USDT','HKD','AUD'];
  ids.forEach(cur=>{ const el=$('fx'+cur); if(el && document.activeElement!==el) el.value = state.fx[cur] || fxDefaults[cur]; });
  const w=$('marketWorkerUrl'); if(w && document.activeElement!==w) w.value = state.settings?.marketWorkerUrl || getLegacyPrefs().marketWorkerUrl || '';
  const note=$('fxRateStatus');
  if(note) note.textContent = `현재환율 USD ${state.fx.USD||'-'} · USDT ${state.fx.USDT||'-'} · HKD ${state.fx.HKD||'-'} · AUD ${state.fx.AUD||'-'}`;
}
function saveMarketSettings(){
  ['USD','USDT','HKD','AUD'].forEach(cur=>{ const el=$('fx'+cur); if(el && Number(el.value)>0) state.fx[cur]=Number(el.value); });
  if(!state.settings) state.settings={};
  const w=$('marketWorkerUrl'); if(w) state.settings.marketWorkerUrl=w.value.trim();
  save(); renderMarketSettings(); const st=$('marketWorkerStatus'); if(st) st.textContent='환율/Worker 설정 저장 완료'; log('환율/Worker 설정 저장 완료');
}
async function testMarketWorker(){
  const el=$('marketWorkerStatus');
  try{
    if(!state.settings) state.settings={};
    const w=$('marketWorkerUrl'); if(w) state.settings.marketWorkerUrl=w.value.trim();
    if(el) el.textContent='SCHD Worker 테스트 중...';
    const t=await fetchMarketWorkerPrice('SCHD');
    if(el) el.textContent=`Worker 정상 · SCHD ${t.price} USD · ${t.source}`;
    log(`Worker 정상 · SCHD ${t.price} USD · ${t.source}`);
  }catch(e){
    if(el) el.textContent='Worker 테스트 실패: '+e.message;
    log('Worker 테스트 실패: '+e.message);
  }
}

function bindForms(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$(b.dataset.open).classList.toggle('hidden'));
  const krBtn=$('lookupKrEtfBtn'); if(krBtn) krBtn.onclick=lookupKoreanEtfNameFromInput;
  const typeEl=assetForm?.elements?.type; if(typeEl) typeEl.onchange=()=>{ if(typeEl.value==='한국 ETF'){ assetForm.currency.value='KRW'; } };
  assetForm.onsubmit=e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(assetForm));
    f.currency=(f.currency||'KRW').toUpperCase();
    if(String(f.type||'').includes('한국 ETF')){
      const code=extractKoreanCode(f.symbol, f.name);
      if(code){
        const nm=krEtfKnownName(code);
        f.symbol=code;
        f.currency='KRW';
        if(nm && !String(f.name||'').includes(nm)) f.name=`${code} ${nm}`;
      }
    }
    upsert('assets', f); render();
  };
  debtForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(debtForm)); f.currency=(f.currency||'KRW').toUpperCase(); upsert('debts', f); render(); };
  insuranceForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(insuranceForm)); f.includeRefund=insuranceForm.includeRefund.checked; upsert('insurance', f); render(); };
}
function backup(){ const blob=new Blob([JSON.stringify({...state,version:APP_VERSION,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-v6-6-backup.json`; a.click(); URL.revokeObjectURL(a.href); }
function restore(file){ const r=new FileReader(); r.onload=()=>{ try{ createLocalVersionBackup('복원 전 자동백업'); state=normalizeState(JSON.parse(r.result),'restore'); createLocalVersionBackup('파일 복원 완료'); render(); log('복원 완료'); }catch(e){ log('복원 실패: JSON 파일을 확인하세요.'); } }; r.readAsText(file); }
function log(msg){ $('logBox').textContent=`[${new Date().toLocaleString()}] ${msg}`; }
function takeSnapshot(){ const t=totals(); state.snapshots.push({id:uid(),date:new Date().toISOString(),...t}); autoBackup('스냅샷 저장'); render(); log('스냅샷 저장 완료'); }
function forceMigrate(){ const found=findLegacyState(); if(found){ createLocalVersionBackup('기존 데이터 복구 전 자동백업'); state=found.state; createLocalVersionBackup('기존 데이터 복구 완료'); render(); log(`기존 데이터 복구 완료: ${found.key}`); } else log('기존 데이터를 찾지 못했습니다. 백업 파일 복원을 사용하세요.'); }
function resetDemo(){ state.assets = state.assets.filter(a=>!(a.name||'').startsWith('예시 ')); autoBackup('예시 데이터 제거'); render(); log('예시 데이터 제거 완료'); }
function restoreMenus(){ safeSettings(); state.settings.hiddenTabs=[]; initTabs(); render(); log('메뉴 전체 복구 완료'); }
function recoverLastGoodBackup(){ const b=latestBackupState(); if(!b){ log('복구 가능한 백업 데이터를 찾지 못했습니다.'); return; } createLocalVersionBackup('최근 정상 백업 복구 전 자동백업'); state=b.state; createLocalVersionBackup('최근 정상 백업 복구 완료'); render(); log('최근 정상 데이터 복구 완료: '+b.key); }

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
  safeBind('refreshDashboard', ()=>location.reload());
  safeBind('pageReloadBtn', ()=>location.reload());
  safeBind('marketRefreshBtn', ()=>refreshMarketData(true));
  safeBind('refreshAnalysis', renderAnalysis);
  safeBind('backupBtn', backup);
  safeBind('versionBackupBtn', ()=>{createLocalVersionBackup('수동 버전백업'); log('수동 버전백업 완료');});
  safeBind('downloadHistoryBtn', downloadBackupHistory);
  safeBind('integrityCheckBtn', integrityCheck);
  safeBind('cleanOldBackupsBtn', cleanOldBackups);
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
  safeBind('restoreMenusBtn', restoreMenus);
  safeBind('recoverLastGoodBtn', recoverLastGoodBackup);
  safeBind('themeToggleBtn', toggleTheme);
  safeBind('saveMarketSettingsBtn', saveMarketSettings);
  safeBind('testMarketWorkerBtn', testMarketWorker);
  safeBind('avgCalcBtn', calculateAverageBuy);
  safeBind('avgResetBtn', resetAverageCalculator);
  safeBind('avgApplyMemoBtn', copyAverageResult);
  const avgSel=$('avgAssetSelect'); if(avgSel) avgSel.addEventListener('change', loadAverageAsset);
  ['avgCurrentQty','avgCurrentPrice','avgAddQty','avgAddPrice','avgFee'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', calculateAverageBuy); });
  startAutoMarketRefresh();

  document.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>resetEdit(btn.dataset.cancel)));
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});
