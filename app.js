const APP_VERSION = 'v6.18.2-view-state-consolidation';

function displayVersion(){
  const m = String(APP_VERSION || '').match(/^v\d+\.\d+\.\d+/);
  return m ? m[0] : APP_VERSION;
}

const BACKUP_HISTORY_KEY = 'assetManagerPWA_v6_backupHistory';
const STORAGE_KEY = 'assetManagerPWA_v6';
const PRICE_CACHE_KEY = 'assetManagerPWA_v6_priceCache';
const MARKET_LOG_KEY = 'assetManagerPWA_v6_marketLog';
const LEGACY_KEYS = ['asset-manager-v4-5-1','asset-manager-v4-5','asset-manager-v4-4','asset-manager-v4','asset-manager-v3-9','assetManagerPWA_v5_4','assetManagerPWA_v54','assetManager_v5_4','assetManagerPWA_v5','assetManagerPWA','assetManager','asset_manager_data'];
const MARKET_REFRESH_MINUTES = 15;
const tabs = [['dashboard','🏠 Home'],['assets','💼 Assets'],['platforms','🏦 Platforms'],['transactions','🧾 Transactions'],['analysis','📊 Reports'],['calculator','🧮 Tools'],['settings','⚙ Settings'],['debts','부채'],['insurance','보험']];
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
  const views = ['merged','platform','type','currency','country','favorite','raw'];
  if(!views.includes(state.settings.assetViewMode)) state.settings.assetViewMode = 'merged';
  if(!state.settings.assetSearch) state.settings.assetSearch = '';
  if(!Array.isArray(state.settings.favoriteAssetIds)) state.settings.favoriteAssetIds = [];
  if(!state.settings.platformSearch) state.settings.platformSearch = '';
  const cats = ['all','exchange','broker','bank','insurance','other'];
  if(!cats.includes(state.settings.platformCategory)) state.settings.platformCategory = 'all';
  return state.settings;
}
function setAssetViewFilter({mode, search='', bucket=''}={}){
  const settings=safeSettings();
  if(mode!==undefined) settings.assetViewMode=mode;
  settings.assetSearch=search;
  settings.assetOverviewBucket=bucket;
  save();
}
function setPlatformSearch(value){
  safeSettings().platformSearch=value;
  save();
}
function hasMeaningfulData(s){ return !!(s && ((s.assets&&s.assets.length)||(s.debts&&s.debts.length)||(s.insurance&&s.insurance.length)||(s.transactions&&s.transactions.length)||(s.snapshots&&s.snapshots.length))); }
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
  const curNet = totals().net;
  const curCount = Array.isArray(state.assets) ? state.assets.length : 0;
  const bkNet = item.totals?.net;
  const bkCount = Array.isArray(item.data?.assets) ? item.data.assets.length : null;
  const netDiff = (typeof bkNet==='number') ? (bkNet-curNet) : null;
  const countDiff = (bkCount!==null) ? (bkCount-curCount) : null;
  const previewLines = [`이 백업으로 되돌리면:`];
  if(netDiff!==null) previewLines.push(`순자산 ${netDiff>=0?'+':''}${money(netDiff)} (현재 ${money(curNet)} → 백업 ${money(bkNet)})`);
  if(countDiff!==null) previewLines.push(`자산 개수 ${countDiff>=0?'+':''}${countDiff}개 (현재 ${curCount}개 → 백업 ${bkCount}개)`);
  previewLines.push('현재 상태는 복원 전 자동으로 백업됩니다.');
  if(!confirm(previewLines.join('\n'))) return;
  createLocalVersionBackup('복원 전 자동백업');
  state=normalizeState(item.data,'version-backup');
  render();
  log('버전 백업 복원 완료');
}
function versionSlug(){
  const m = String(APP_VERSION||'').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `v${m[1]}-${m[2]}-${m[3]}` : 'v0-0-0';
}
function downloadBackupHistory(){
  const payload={app:'AssetManagerPWA',version:APP_VERSION,exportedAt:new Date().toISOString(),current:state,history:getBackupHistory()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-${versionSlug()}-backup-history.json`; a.click(); URL.revokeObjectURL(a.href);
  log('백업묶음 다운로드 완료');
}
function integrityCheck(){
  const problems=[];
  ['assets','debts','insurance','transactions','snapshots'].forEach(k=>{ if(!Array.isArray(state[k])) problems.push(`${k} 배열 오류`); });
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
    assets: normalizeArray(old.assets || old.assetList).map(a=>({id:a.id||uid(), name:a.name||a.title||'이름없음', symbol:a.symbol||a.ticker||a.code||'', type:a.type||a.category||'자산', country:a.country||a.account||'', account:a.account||'', currency:(a.currency||'KRW').toUpperCase(), amount:a.amount??a.quantity??a.qty??1, price:a.price??a.currentPrice??0, cost:a.cost??a.costPrice??a.principal??0, costCurrency:(a.costCurrency||a.costCur||a.purchaseCurrency||'KRW').toUpperCase(), value:a.value, krwValue:a.krwValue, priceSource:a.priceSource||'', priceUpdatedAt:a.priceUpdatedAt||''})),
    transactions: normalizeArray(old.transactions || old.trades || old.transactionList).map(t=>({id:t.id||uid(), date:t.date||new Date().toISOString().slice(0,10), type:t.type||'매수', assetId:t.assetId||'', assetName:t.assetName||t.name||'', symbol:t.symbol||'', assetType:t.assetType||'', currency:(t.currency||'KRW').toUpperCase(), qty:t.qty??t.amount??0, price:t.price??0, fee:t.fee??0, memo:t.memo||'', totalKrw:t.totalKrw||0, createdAt:t.createdAt||new Date().toISOString()})),
    debts: normalizeArray(old.debts || old.debtList).map(d=>({id:d.id||uid(), name:d.name||d.title||'부채', type:d.type||'일반 부채', currency:(d.currency||'KRW').toUpperCase(), balance:d.balance??d.amount??d.value??0, rate:d.rate||0, monthly:d.monthly||0, value:d.value, krwValue:d.krwValue})),
    insurance: normalizeArray(old.insurance || old.insurances || old.policies).map(i=>({id:i.id||uid(), company:i.company||i.insurer||'', product:i.product||i.name||'', type:i.type||'', premium:i.premium||0, payday:i.payday||'', refund:i.refund||0, includeRefund:!!i.includeRefund, memo:i.memo||''})),
    snapshots: normalizeArray(old.snapshots),
    settings: { hiddenTabs: [], theme: 'light', finnhubToken: old.finnhubToken || '', marketWorkerUrl: old.marketWorkerUrl || old.settings?.marketWorkerUrl || '', favoriteAssetIds: [], platformSearch: '', ...(old.settings||{}) }
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
  // v6.18.0: 투자자산 원금은 "평균 매입단가 × 보유수량"에서 계산된 총 원금을 저장/환산합니다.
  // 기존 백업 호환을 위해 저장값은 그대로 cost/costCurrency를 사용하되, 신규 입력은 자동으로 총 원금으로 변환합니다.
  const cost = num(a.cost);
  const cur = (a.costCurrency || a.currency || 'KRW').toUpperCase();
  return cost * fx(cur);
}
function prepareAssetFormData(f){
  f.currency=(f.currency||'KRW').toUpperCase();
  const virtual={...f, type:f.type||'자산'};
  const qty=num(f.amount);
  const unitCost=num(f.cost);
  if(isInvestmentAsset(virtual)){
    // 입력창의 "평균 매입단가"를 내부 저장용 총 투자원금으로 변환합니다.
    f.cost = qty>0 && unitCost>0 ? unitCost * qty : 0;
    f.costCurrency = f.currency;
  }else{
    // 현금/은행/부동산/자동차 등은 수익률 계산 대상이 아니므로 원금 입력을 강제하지 않습니다.
    f.cost = num(f.cost)||0;
    f.costCurrency = (f.costCurrency || f.currency || 'KRW').toUpperCase();
  }
  return f;
}
function isGoldAsset(a){
  const t=String(a?.type||'').toLowerCase().replace(/\s+/g,'');
  // 현금/예금 같은 단어에 포함된 '금'은 금 투자자산으로 보지 않습니다.
  return t === '금' || t === '골드' || t === 'gold' || t.includes('금투자') || t.includes('금현물') || t.includes('골드');
}
function isCashAsset(a){
  const t=String(a?.type||'').toLowerCase().replace(/\s+/g,'');
  return t.includes('현금') || t.includes('은행') || t.includes('예금') || t.includes('적금') || t.includes('cash') || t.includes('bank');
}
function isInvestmentAsset(a){
  const t=String(a?.type||'').toLowerCase();
  return t.includes('코인') || t.includes('미국주식') || t.includes('미국 주식') || t.includes('미국 etf') || t.includes('etf') || t.includes('한국 etf') || t.includes('주식') || isGoldAsset(a);
}
function formatAssetQty(a){
  const qty=num(a.amount);
  if(!qty) return '-';
  const t=String(a.type||'');
  const symbol=String(a.symbol||'').trim().toUpperCase();
  const unit = t.includes('코인') ? (symbol || '개') : isGoldAsset(a) ? 'g' : '주';
  const digits = t.includes('코인') ? 8 : qty%1 ? 4 : 0;
  return `${qty.toLocaleString('ko-KR',{maximumFractionDigits:digits})}${unit}`;
}
function formatForeignMoney(v, cur='KRW'){
  cur=(cur||'KRW').toUpperCase();
  const n=num(v);
  if(cur==='KRW') return money(n);
  const prefix = cur==='USD' ? '$' : cur==='USDT' ? 'USDT ' : cur+' ';
  return prefix + n.toLocaleString('ko-KR',{maximumFractionDigits: cur==='USDT' ? 4 : 2});
}
function inferCashCurrency(a){
  const cur=String(a?.currency||'KRW').toUpperCase();
  if(cur && cur !== 'KRW') return cur;
  const text=(' '+String(a?.symbol||'')+' '+String(a?.name||'')+' ').toUpperCase();
  const candidates=['USDT','USD','HKD','AUD'];
  for(const c of candidates){
    if(new RegExp('(^|[^A-Z])'+c+'([^A-Z]|$)').test(text)) return c;
  }
  return 'KRW';
}
function cashHoldingAmount(a, cur){
  const amount=num(a?.amount);
  if(cur !== 'KRW' && amount>0) return amount;
  return assetValue(a);
}
function cashAppliedRate(a, cur){
  if(cur === 'KRW') return 1;
  const amount=num(a?.amount);
  const savedPrice=num(a?.price);
  if(savedPrice>0) return savedPrice;
  if(amount>0){
    const derived=assetValue(a)/amount;
    if(derived>0) return derived;
  }
  return fx(cur);
}
function formatFxRate(rate, cur){
  if(cur === 'KRW') return '-';
  return money(rate) + ' / ' + cur;
}
function formatAssetUnitPrice(a, price){
  const cur=(a.currency||'KRW').toUpperCase();
  return formatForeignMoney(price, cur);
}
function assetAveragePrice(a){
  const qty=num(a.amount);
  if(qty<=0) return 0;
  const cur=(a.currency||'KRW').toUpperCase();
  const costKrw=assetCostKrw(a);
  const rate=fx(cur)||1;
  return costKrw / qty / rate;
}
function signedMoney(v){
  const n=Math.round(num(v));
  if(n>0) return '+'+money(n);
  if(n<0) return '-'+money(Math.abs(n));
  return money(0);
}
function assetDetailHtml(a){
  if(!isInvestmentAsset(a)) return '';
  const value=assetValue(a);
  const cost=assetCostKrw(a);
  const profit=value-cost;
  const rate=cost>0 ? profit/cost*100 : 0;
  const avg=assetAveragePrice(a);
  const price=num(a.price);
  const rows=[
    ['보유수량', formatAssetQty(a)],
    ['평균단가', avg>0 ? formatAssetUnitPrice(a, avg) : '-'],
    ['현재가', price>0 ? formatAssetUnitPrice(a, price) : '-'],
    ['투자원금', cost>0 ? money(cost) : '-'],
    ['평가손익', `${signedMoney(profit)} (${rate>=0?'+':''}${rate.toFixed(2)}%)`]
  ];
  return `<div class="asset-detail-grid">${rows.map(([k,v])=>`<span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
}
function nonInvestmentStatsHtml(a){
  if(isCashAsset(a)){
    const cur=inferCashCurrency(a);
    const amount=cashHoldingAmount(a, cur);
    const krw=assetValue(a);
    const rate=cashAppliedRate(a, cur);
    const rows=[
      ['보유 외화', cur==='KRW' ? money(krw) : formatForeignMoney(amount, cur)],
      ['원화 환산', money(krw)],
      ['적용 환율', formatFxRate(rate, cur)]
    ];
    return `<div class="asset-stat-grid simple-asset-grid">${rows.map(([k,v])=>`<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>`;
  }
  const rows=[['현재가치', money(assetValue(a))]];
  return `<div class="asset-stat-grid simple-asset-grid">${rows.map(([k,v])=>`<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>`;
}

function normalizedAssetGroupKey(a){
  if(!isInvestmentAsset(a)) return 'single:' + (a.id || uid());
  const type=String(a.type||'').toLowerCase();
  let symbol=String(a.symbol||'').trim().toUpperCase();
  const code = extractKoreanCode(a.symbol, a.name);
  if(type.includes('한국 etf') && code) symbol=code;
  if(!symbol) symbol=cleanSymbol(a.name || displayAssetName(a));
  if(!symbol) return 'single:' + (a.id || uid());
  const family = type.includes('코인') ? 'crypto' : type.includes('한국 etf') ? 'kr-etf' : isGoldAsset(a) ? 'gold' : (type.includes('주식') || type.includes('etf')) ? 'stock-etf' : type;
  return family + ':' + symbol;
}
function groupDashboardAssets(){
  const map=new Map();
  state.assets.forEach(a=>{
    const key=normalizedAssetGroupKey(a);
    const value=assetValue(a), cost=assetCostKrw(a), qty=num(a.amount);
    if(!map.has(key)){
      map.set(key,{key, items:[], name:displayAssetName(a), type:a.type||'자산', symbol:a.symbol||'', value:0, cost:0, amount:0, currencies:new Set(), places:new Set()});
    }
    const g=map.get(key);
    g.items.push(a); g.value+=value; g.cost+=cost; g.amount+=qty;
    if(a.currency) g.currencies.add(String(a.currency).toUpperCase());
    if(a.country || a.account) g.places.add(a.country || a.account);
    if(!g.symbol && a.symbol) g.symbol=a.symbol;
    if((String(a.type||'').includes('한국 ETF') && extractKoreanCode(a.symbol,a.name)) || displayAssetName(a).length > g.name.length) g.name=displayAssetName(a);
  });
  return [...map.values()].map(g=>{
    const profit=g.value-g.cost;
    const rate=g.cost>0 ? profit/g.cost*100 : 0;
    return {...g, profit, rate, count:g.items.length, currencyText:[...g.currencies].join('/') || 'KRW', placeText:[...g.places].filter(Boolean).slice(0,3).join(' · ')};
  });
}

function assetPlatform(a){
  return String(a.account || a.country || a.exchange || a.platform || '').trim() || '미지정 기관';
}
function assetCountry(a){
  const raw=String(a.country || '').trim();
  const cur=String(a.currency||'KRW').toUpperCase();
  const type=String(a.type||'').toLowerCase();
  if(raw && !['binance','bybit','okx','upbit','bithumb','coinone','gate','bingx','htx'].includes(raw.toLowerCase())) return raw;
  if(cur==='KRW' || type.includes('한국')) return '한국';
  if(cur==='USD' || type.includes('미국')) return '미국';
  if(cur==='HKD') return '홍콩';
  if(cur==='AUD') return '호주';
  if(cur==='USDT' || type.includes('코인')) return '글로벌/코인';
  return '미지정';
}
function viewGroupSummary(items, label, kind){
  const value=items.reduce((s,a)=>s+assetValue(a),0);
  const cost=items.reduce((s,a)=>s+assetCostKrw(a),0);
  const profit=value-cost;
  const rate=cost>0 ? profit/cost*100 : 0;
  const types=[...new Set(items.map(a=>a.type||'자산').filter(Boolean))];
  const platforms=[...new Set(items.map(assetPlatform).filter(Boolean))];
  const currencies=[...new Set(items.map(a=>String(a.currency||'KRW').toUpperCase()))];
  return {label, kind, items, value, cost, profit, rate, types, platforms, currencies};
}
function assetSearchMatch(a, q){
  if(!q) return true;
  const hay=[a.name,a.symbol,a.type,a.country,a.account,a.currency,assetPlatform(a),assetCountry(a)].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}
function currentAssetItems(){
  const settings=safeSettings();
  const q=String(settings.assetSearch||'').trim();
  const fav=new Set(settings.favoriteAssetIds || []);
  const bucket=String(settings.assetOverviewBucket||'').trim();
  let list=state.assets || [];
  if(bucket==='favorite') list=list.filter(a=>fav.has(a.id));
  else if(bucket) list=list.filter(a=>assetBucketOf(a)===bucket);
  return list.filter(a=>assetSearchMatch(a,q));
}
function groupedBy(list, fn){
  const map=new Map();
  list.forEach(a=>{ const k=fn(a)||'미분류'; if(!map.has(k)) map.set(k,[]); map.get(k).push(a); });
  return [...map.entries()].map(([label,items])=>viewGroupSummary(items,label,''));
}
function assetViewLabel(mode){
  return ({merged:'통합 보기', platform:'기관별 보기', type:'자산종류별', currency:'통화별', country:'국가별', favorite:'즐겨찾기', raw:'개별 보기'})[mode] || '통합 보기';
}
function assetViewData(){
  const settings=safeSettings();
  const mode=settings.assetViewMode || 'merged';
  const list=currentAssetItems();
  const favorites = new Set(settings.favoriteAssetIds || []);
  if(mode==='favorite'){
    const favList=list.filter(a=>favorites.has(a.id));
    return {mode, groups: groupAssetsForList(favList).sort((a,b)=>b.value-a.value)};
  }
  if(mode==='merged') return {mode, groups: groupAssetsForList(list).sort((a,b)=>b.value-a.value)};
  if(mode==='raw') return {mode, items:list.slice().sort((a,b)=>assetValue(b)-assetValue(a))};
  const fn = mode==='platform' ? assetPlatform : mode==='type' ? (a=>a.type||'자산') : mode==='currency' ? (a=>String(a.currency||'KRW').toUpperCase()) : assetCountry;
  return {mode, sections:groupedBy(list,fn).sort((a,b)=>b.value-a.value)};
}
function assetViewToolbarHtml(){
  const settings=safeSettings();
  const mode=settings.assetViewMode || 'merged';
  const q=escapeHtml(settings.assetSearch||'');
  return `<div class="asset-view-toolbar"><div class="view-select-wrap"><span>보기</span><select id="assetViewMode"><option value="merged" ${mode==='merged'?'selected':''}>통합 보기</option><option value="platform" ${mode==='platform'?'selected':''}>기관별 보기</option><option value="type" ${mode==='type'?'selected':''}>자산 종류별</option><option value="currency" ${mode==='currency'?'selected':''}>통화별</option><option value="country" ${mode==='country'?'selected':''}>국가별</option><option value="favorite" ${mode==='favorite'?'selected':''}>즐겨찾기</option><option value="raw" ${mode==='raw'?'selected':''}>개별 보기</option></select></div><label class="asset-search"><span>검색</span><input id="assetSearchInput" value="${q}" placeholder="종목, 기관, 통화 검색" /></label></div><p class="view-help">데이터는 원본 그대로 보존하고, 보기 방식만 바꿔서 통합/기관/종류/통화/국가/즐겨찾기별로 확인합니다.</p>`;
}
function bindAssetViewControls(){
  const mode=$('assetViewMode');
  if(mode) mode.onchange=()=>{
    setAssetViewFilter({mode: mode.value});
    renderLists();
  };
  const search=$('assetSearchInput');
  if(search) search.oninput=()=>{ setAssetViewFilter({mode: safeSettings().assetViewMode, search: search.value}); renderLists(); };
}

function assetBucketOf(a){
  const t=String(a.type||'').toLowerCase();
  if(t.includes('현금') || t.includes('은행')) return 'cash';
  if(t.includes('자동차') || t.includes('부동산')) return 'real';
  if(t.includes('보험')) return 'insurance';
  return 'investment';
}
function assetOverviewHtml(){
  const list=state.assets || [];
  if(!list.length) return '';
  const fav=new Set((safeSettings().favoriteAssetIds||[]));
  const total=list.reduce((s,a)=>s+assetValue(a),0);
  const filtered=currentAssetItems();
  const buckets=[
    ['investment','투자자산','코인·주식·ETF·금','investment'],
    ['cash','현금/은행','KRW·USD·HKD·AUD','cash'],
    ['real','실물자산','자동차·부동산','real'],
    ['favorite','즐겨찾기','자주 보는 자산','']
  ];
  const cards=buckets.map(([key,title,sub,filter])=>{
    const items = key==='favorite' ? list.filter(a=>fav.has(a.id)) : list.filter(a=>assetBucketOf(a)===key);
    const value = items.reduce((s,a)=>s+assetValue(a),0);
    const pct = total>0 ? value/total*100 : 0;
    const action = key==='favorite' ? 'favorite' : filter;
    return `<button type="button" class="asset-overview-card" data-asset-overview="${escapeHtml(action)}"><span>${escapeHtml(title)}</span><strong>${money(value)}</strong><small>${items.length}개 · ${pct.toFixed(1)}% · ${escapeHtml(sub)}</small></button>`;
  }).join('');
  const currentValue=filtered.reduce((s,a)=>s+assetValue(a),0);
  return `<section class="asset-overview-panel"><div class="asset-overview-head"><div><p class="eyebrow">Assets Overview</p><h3>자산 보기 요약</h3></div><strong>${money(currentValue)}</strong></div><div class="asset-overview-grid">${cards}</div></section>`;
}
function bindAssetOverviewActions(){
  document.querySelectorAll('[data-asset-overview]').forEach(btn=>{
    btn.onclick=()=>{
      const v=btn.dataset.assetOverview || '';
      setAssetViewFilter({mode: v==='favorite' ? 'favorite' : 'merged', bucket: v});
      renderLists();
    };
  });
}


const INSTITUTION_OPTIONS = {
  exchange: [
    {key:'binance', label:'Binance', aliases:['binance','바이낸스']},
    {key:'upbit', label:'Upbit', aliases:['upbit','업비트']},
    {key:'bithumb', label:'Bithumb', aliases:['bithumb','빗썸','bithumb korea']},
    {key:'bybit', label:'Bybit', aliases:['bybit','바이비트']},
    {key:'okx', label:'OKX', aliases:['okx']},
    {key:'coinbase', label:'Coinbase', aliases:['coinbase','코인베이스']},
    {key:'kraken', label:'Kraken', aliases:['kraken','크라켄']},
    {key:'gate', label:'Gate.io', aliases:['gate.io','gate','게이트']},
    {key:'kucoin', label:'KuCoin', aliases:['kucoin','쿠코인']},
    {key:'bitget', label:'Bitget', aliases:['bitget','비트겟']},
    {key:'htx', label:'HTX', aliases:['htx','huobi','후오비']},
    {key:'mexc', label:'MEXC', aliases:['mexc','멕스씨','멕시']},
    {key:'bingx', label:'BingX', aliases:['bingx','빙엑스']},
    {key:'coinone', label:'Coinone', aliases:['coinone','코인원']}
  ],
  broker: [
    {key:'kiwoom', label:'키움증권', aliases:['키움','kiwoom']},
    {key:'mirae', label:'미래에셋증권', aliases:['미래','미래에셋','mirae']},
    {key:'samsung', label:'삼성증권', aliases:['삼성증권','samsung securities']},
    {key:'toss', label:'토스증권', aliases:['토스증권','toss securities']},
    {key:'hantu', label:'한국투자증권', aliases:['한국투자','한투','korea investment']},
    {key:'nh', label:'NH투자증권', aliases:['nh투자','나무','namuh','nh investment']},
    {key:'kbsec', label:'KB증권', aliases:['kb증권','국민증권','kb securities']},
    {key:'shinhansec', label:'신한투자증권', aliases:['신한투자','신한증권','shinhan securities']},
    {key:'hanasec', label:'하나증권', aliases:['하나증권','hana securities']},
    {key:'kakaopaysec', label:'카카오페이증권', aliases:['카카오페이','카카오페이증권','kakao pay securities','kakaopay securities']},
    {key:'naverpaysec', label:'네이버페이증권', aliases:['네이버페이','네이버페이증권','naver pay securities','naverpay securities']},
    {key:'ibkr', label:'Interactive Brokers', aliases:['interactive brokers','ibkr']}
  ],
  bank: [
    {key:'kb', label:'KB국민은행', aliases:['국민','국민은행','kb bank','kb국민']},
    {key:'shinhan', label:'신한은행', aliases:['신한','shinhan bank']},
    {key:'woori', label:'우리은행', aliases:['우리','woori bank']},
    {key:'hana', label:'하나은행', aliases:['하나','hana bank']},
    {key:'kakaobank', label:'카카오뱅크', aliases:['카카오','카카오뱅크','kakaobank','kakao bank']},
    {key:'tossbank', label:'토스뱅크', aliases:['토스뱅크','toss bank']},
    {key:'nhbank', label:'NH농협은행', aliases:['농협은행','nh bank','농협']},
    {key:'sc', label:'SC제일은행', aliases:['sc제일','standard chartered','sc bank']},
    {key:'hsbc', label:'HSBC', aliases:['hsbc']}
  ],
  insurance: [
    {key:'samsunglife', label:'삼성생명', aliases:['삼성생명']},
    {key:'samsungfire', label:'삼성화재', aliases:['삼성화재']},
    {key:'hyundaimarine', label:'현대해상', aliases:['현대해상']},
    {key:'db', label:'DB손해보험', aliases:['db손보','db손해보험']},
    {key:'kbins', label:'KB손해보험', aliases:['kb손보','kb손해보험']},
    {key:'meritz', label:'메리츠화재', aliases:['메리츠']},
    {key:'hanwha', label:'한화생명', aliases:['한화생명']}
  ]
};
const EXCHANGE_OPTIONS = INSTITUTION_OPTIONS.exchange;
function institutionBucketByAssetType(type){
  const t=String(type||'').toLowerCase();
  if(t.includes('코인') || t.includes('crypto')) return 'exchange';
  if(t.includes('주식') || t.includes('etf') || t.includes('stock')) return 'broker';
  if(t.includes('은행') || t.includes('현금') || t.includes('cash') || t.includes('예금') || t.includes('적금')) return 'bank';
  if(t.includes('보험')) return 'insurance';
  return 'all';
}
function allInstitutionOptions(){ return Object.values(INSTITUTION_OPTIONS).flat(); }
function optionsForInstitutionBucket(bucket){
  const base = bucket==='all' ? allInstitutionOptions() : (INSTITUTION_OPTIONS[bucket] || allInstitutionOptions());
  const seen = new Set();
  return base.filter(o=>{ const k=String(o.key||'').toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; });
}
function institutionSearchText(inst){ return [inst.key, inst.label, ...(inst.aliases||[])].join(' ').toLowerCase(); }
function normalizeInstitutionQuery(q){ return String(q||'').trim().toLowerCase(); }
function filterInstitutionOptions(opts, query){
  const q=normalizeInstitutionQuery(query);
  if(!q) return opts;
  return opts.filter(o=>institutionSearchText(o).includes(q));
}
function normalizeInstitutionKey(value){
  const raw=String(value||'').trim();
  const t=raw.toLowerCase();
  if(!t) return '';
  for(const inst of allInstitutionOptions()){
    if(String(inst.key).toLowerCase()===t || String(inst.label).toLowerCase()===t || (inst.aliases||[]).some(a=>t.includes(String(a).toLowerCase()))) return inst.key;
  }
  return '';
}
function normalizeExchangeKey(value){
  const k=normalizeInstitutionKey(value);
  return EXCHANGE_OPTIONS.some(x=>x.key===k) ? k : '';
}
function institutionLabelFromKey(key){
  const inst=allInstitutionOptions().find(x=>x.key===key);
  return inst ? inst.label : '';
}
function exchangeLabelFromKey(key){ return institutionLabelFromKey(key); }
function syncInstitutionSelector(options={}){
  const form=$('assetForm'); if(!form) return;
  const typeEl=form.elements.type;
  const countryEl=form.elements.country;
  const sel=$('exchangeSelect');
  const custom=$('exchangeCustomWrap');
  const search=$('institutionSearchInput');
  const hint=$('institutionSelectHint');
  if(!typeEl || !countryEl || !sel) return;
  const bucket=institutionBucketByAssetType(typeEl.value);
  const allOpts=optionsForInstitutionBucket(bucket);
  const query=search ? search.value : '';
  let opts=filterInstitutionOptions(allOpts, query);
  const currentKey=normalizeInstitutionKey(countryEl.value);
  const prev=sel.value;
  if(currentKey && !opts.some(o=>o.key===currentKey) && allOpts.some(o=>o.key===currentKey)) opts=[allOpts.find(o=>o.key===currentKey), ...opts];
  if(prev && prev!=='custom' && !opts.some(o=>o.key===prev) && allOpts.some(o=>o.key===prev)) opts=[allOpts.find(o=>o.key===prev), ...opts];
  sel.innerHTML = opts.map(o=>`<option value="${escapeHtml(o.key)}">${escapeHtml(o.label)}</option>`).join('') + '<option value="custom">기타 직접입력</option>';
  if(currentKey && opts.some(o=>o.key===currentKey)) sel.value=currentKey;
  else if(prev && opts.some(o=>o.key===prev)) sel.value=prev;
  else if(opts.length && query && !options.keepCustom) sel.value=opts[0].key;
  else sel.value='custom';
  const isCustom=sel.value==='custom';
  sel.classList.remove('hidden');
  if(search) search.classList.remove('hidden');
  countryEl.classList.toggle('hidden', !isCustom);
  if(custom){
    const label= bucket==='exchange' ? '목록에 없는 거래소는 직접 입력하세요.' : bucket==='broker' ? '목록에 없는 증권사는 직접 입력하세요.' : bucket==='bank' ? '목록에 없는 은행/현금 계좌는 직접 입력하세요.' : bucket==='insurance' ? '목록에 없는 보험사는 직접 입력하세요.' : '목록에 없는 기관은 직접 입력하세요.';
    custom.textContent=label;
    custom.classList.toggle('hidden', !isCustom);
  }
  if(hint){
    const bucketLabel=platformCategoryLabel(bucket==='all'?'all':bucket);
    hint.textContent = `${bucketLabel} ${allOpts.length}개 중 ${opts.length}개 표시 · 검색 후 선택하면 기관명이 자동 입력됩니다.`;
  }
  if(!isCustom) countryEl.value=institutionLabelFromKey(sel.value) || countryEl.value;
}
function syncExchangeSelector(){ syncInstitutionSelector(); }
function applySelectedExchangeToAssetForm(){
  const form=$('assetForm'); if(!form) return;
  const sel=$('exchangeSelect');
  const countryEl=form.elements.country;
  if(sel && countryEl && sel.value && sel.value!=='custom') countryEl.value=institutionLabelFromKey(sel.value) || sel.value;
  syncInstitutionSelector();
}

function visualKeyFromText(text){
  const t=String(text||'').toLowerCase();
  if(t.includes('binance') || t.includes('바이낸스')) return 'binance';
  if(t.includes('bybit')) return 'bybit';
  if(t.includes('upbit')) return 'upbit';
  if(t.includes('okx')) return 'okx';
  if(t.includes('빗썸') || t.includes('bithumb')) return 'bithumb';
  if(t.includes('코인원') || t.includes('coinone')) return 'coinone';
  if(t.includes('coinbase') || t.includes('코인베이스')) return 'coinbase';
  if(t.includes('kraken') || t.includes('크라켄')) return 'kraken';
  if(t.includes('gate')) return 'gate';
  if(t.includes('kucoin') || t.includes('쿠코인')) return 'kucoin';
  if(t.includes('bitget') || t.includes('비트겟')) return 'bitget';
  if(t.includes('htx') || t.includes('huobi') || t.includes('후오비')) return 'htx';
  if(t.includes('mexc') || t.includes('멕스')) return 'mexc';
  if(t.includes('bingx') || t.includes('빙엑스')) return 'bingx';
  if(t.includes('kiwoom') || t.includes('키움')) return 'kiwoom';
  if(t.includes('mirae') || t.includes('미래')) return 'mirae';
  if(t.includes('삼성증권') || t.includes('samsung')) return 'samsung';
  if(t.includes('토스증권')) return 'toss';
  if(t.includes('토스뱅크')) return 'tossbank';
  if(t.includes('토스')) return 'toss';
  if(t.includes('한국투자') || t.includes('한투')) return 'hantu';
  if(t.includes('nh투자') || t.includes('나무')) return 'nh';
  if(t.includes('농협은행')) return 'nhbank';
  if(t.includes('nh') || t.includes('농협')) return 'nh';
  if(t.includes('국민') || t.includes('kb')) return 'kb';
  if(t.includes('신한')) return 'shinhan';
  if(t.includes('우리')) return 'woori';
  if(t.includes('하나')) return 'hana';
  if(t.includes('카카오페이') || t.includes('kakao pay')) return 'kakaopaysec';
  if(t.includes('네이버페이') || t.includes('naver pay')) return 'naverpaysec';
  if(t.includes('카카오')) return 'kakaobank';
  if(t.includes('sc제일') || t.includes('standard chartered')) return 'sc';
  if(t.includes('hsbc')) return 'hsbc';
  if(t.includes('interactive brokers') || t.includes('ibkr')) return 'ibkr';
  if(t.includes('삼성생명')) return 'samsunglife';
  if(t.includes('삼성화재')) return 'samsungfire';
  if(t.includes('현대해상')) return 'hyundaimarine';
  if(t.includes('db손')) return 'db';
  if(t.includes('kb손')) return 'kbins';
  if(t.includes('메리츠')) return 'meritz';
  if(t.includes('한화생명')) return 'hanwha';
  if(t.includes('bank') || t.includes('은행') || t.includes('현금')) return 'bank';
  if(t.includes('코인') || t.includes('coin') || t.includes('btc') || t.includes('eth')) return 'crypto';
  if(t.includes('etf') || t.includes('주식') || t.includes('schd') || t.includes('voo')) return 'stock';
  return 'default';
}
function platformIcon(label){
  const k=visualKeyFromText(label);
  return ({
    binance:'B', bybit:'Y', upbit:'U', okx:'OK', bithumb:'BT', coinone:'CO', coinbase:'CB', kraken:'KR', gate:'G', kucoin:'KC', bitget:'BG', htx:'HT', mexc:'MX', bingx:'BX',
    kiwoom:'K', mirae:'M', samsung:'S', toss:'T', hantu:'KI', nh:'농', kakaopaysec:'KP', naverpaysec:'NP',
    kb:'국', shinhan:'신', woori:'우', hana:'하', kakaobank:'카',
    tossbank:'TB', nhbank:'NH', sc:'SC', ibkr:'IB', kbsec:'KB', shinhansec:'신', hanasec:'하', samsunglife:'생', samsungfire:'화', hyundaimarine:'현', db:'DB', kbins:'KB', meritz:'메', hanwha:'한', hsbc:'H', bank:'₩', crypto:'₿', stock:'↗', default:'•'
  })[k] || '•';
}

function platformCategory(sec){
  const label=String(sec?.label||'').toLowerCase();
  const types=(sec?.types||[]).join(' ').toLowerCase();
  if(normalizeExchangeKey(label) || ['gate','bingx','htx','mexc','kucoin','bitget','coinbase','kraken'].some(x=>label.includes(x))) return 'exchange';
  if(['키움','미래','삼성증권','토스증권','한국투자','한투','nh투자','ibkr','카카오페이','네이버페이','증권','securities','broker'].some(x=>label.includes(x.toLowerCase()))) return 'broker';
  if(['은행','bank','hsbc','sc','국민','신한','카카오','토스','우리','하나','농협'].some(x=>label.includes(x.toLowerCase())) || types.includes('은행') || types.includes('현금')) return 'bank';
  if(types.includes('보험') || ['생명','화재','손해보험','손보','현대해상','메리츠','한화생명'].some(x=>label.includes(x.toLowerCase()))) return 'insurance';
  return 'other';
}
function platformCategoryLabel(cat){
  return ({all:'전체',exchange:'거래소',broker:'증권사',bank:'은행/현금',insurance:'보험',other:'기타'})[cat] || '전체';
}
function categoryCount(sections, cat){
  if(cat==='all') return sections.length;
  return sections.filter(sec=>platformCategory(sec)===cat).length;
}
function recentTransactionRows(limit=3){
  const list=(state.transactions||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,limit);
  if(!list.length) return '<div class="empty compact-empty">최근 거래가 없습니다.</div>';
  return list.map(t=>`<div class="home-transaction-row"><span>${escapeHtml(t.date||'-')}</span><b>${escapeHtml(t.type||'-')} · ${escapeHtml(t.assetName||t.asset||'-')}</b><em>${escapeHtml(money(transactionKrwTotal(t)))}</em></div>`).join('');
}
function platformPreviewHtml(limit=4){
  const total=state.assets.reduce((s,a)=>s+assetValue(a),0);
  const sections=platformSummaries().slice(0,limit);
  if(!sections.length) return '<div class="empty compact-empty">기관별 자산을 등록하면 표시됩니다.</div>';
  return sections.map(sec=>{
    const pct=total>0 ? sec.value/total*100 : 0;
    const top=groupAssetsForList(sec.items).slice(0,3).map(g=>g.name).join(' · ');
    const cls=visualKeyFromText(sec.label);
    return `<button type="button" class="home-platform-row platform-skin-${cls}" data-home-platform="${escapeHtml(sec.label)}"><i>${escapeHtml(platformIcon(sec.label))}</i><span><b>${escapeHtml(sec.label)}</b><small>${escapeHtml(top || sec.types.join(' · ') || '자산')}</small></span><strong>${money(sec.value)}<em>${pct.toFixed(1)}%</em></strong></button>`;
  }).join('');
}
function bindDashboardHomeActions(){
  document.querySelectorAll('[data-home-platform]').forEach(btn=>{
    btn.onclick=()=>{
      setAssetViewFilter({mode:'platform', search: btn.dataset.homePlatform || ''});
      showTab('assets');
      renderLists();
    };
  });
}

function renderAssetViewSection(sec){
  const el=document.createElement('article');
  el.className='asset-view-section asset-view-section-'+visualKeyFromText(sec.label);
  const plural=`${sec.items.length}개 자산`;
  const meta=[plural, sec.types.slice(0,3).join('/'), sec.currencies.join('/')].filter(Boolean).join(' · ');
  el.innerHTML=`<details open><summary><div class="section-summary-left"><i>${escapeHtml(platformIcon(sec.label))}</i><div><strong>${escapeHtml(sec.label)}</strong><span>${escapeHtml(meta)}</span></div></div><b>${money(sec.value)}</b></summary><div class="asset-section-list"></div></details>`;
  const box=el.querySelector('.asset-section-list');
  const cards = sec.items.length>1 && safeSettings().assetViewMode !== 'raw' ? groupAssetsWithinSection(sec.items) : sec.items.map(a=>({single:a}));
  cards.forEach(item=>{
    if(item.single) box.appendChild(renderSingleAssetCard(item.single));
    else box.appendChild(renderGroupedAssetCard(item));
  });
  return el;
}
function groupAssetsWithinSection(items){
  const old=state.assets;
  state.assets=items;
  const groups=groupDashboardAssets().sort((a,b)=>b.value-a.value);
  state.assets=old;
  return groups;
}
function groupAssetsForList(items){
  const old=state.assets;
  state.assets=items || [];
  const groups=groupDashboardAssets().sort((a,b)=>b.value-a.value);
  state.assets=old;
  return groups;
}


function platformLastUpdateText(){
  const last = state.settings?.market?.lastUpdate;
  if(!last) return '업데이트 대기';
  try{ return new Date(last).toLocaleString('ko-KR'); }catch(e){ return '업데이트 기록 있음'; }
}
function platformBreakdown(sec){
  const byType = {};
  const byCurrency = {};
  (sec.items||[]).forEach(a=>{
    const type = a.type || '자산';
    const cur = String(a.currency||'KRW').toUpperCase();
    byType[type] = (byType[type]||0) + assetValue(a);
    byCurrency[cur] = (byCurrency[cur]||0) + assetValue(a);
  });
  const typeRows = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const curRows = Object.entries(byCurrency).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return {typeRows, curRows};
}
function platformMiniBar(value,total){
  const pct = total>0 ? Math.max(0, Math.min(100, value/total*100)) : 0;
  return `<div class="platform-mini-bar"><span style="width:${pct.toFixed(2)}%"></span></div>`;
}

function platformSummaries(){
  return groupedBy(state.assets, assetPlatform).sort((a,b)=>b.value-a.value);
}
function platformSearchMatch(sec, q){
  if(!q) return true;
  const hay=[sec.label, sec.types.join(' '), sec.currencies.join(' '), sec.items.map(a=>[a.name,a.symbol,a.type,a.currency].join(' ')).join(' ')].join(' ').toLowerCase();
  return hay.includes(String(q).toLowerCase());
}
function renderPlatformCenter(){
  const box=$('platformList'); if(!box) return;
  safeSettings();
  const input=$('platformSearchInput');
  if(input && document.activeElement!==input) input.value = state.settings.platformSearch || '';
  const q=String(state.settings.platformSearch||'').trim();
  const allSections=platformSummaries();
  const total=state.assets.reduce((s,a)=>s+assetValue(a),0);
  const cat=state.settings.platformCategory || 'all';
  const filteredByCat=allSections.filter(sec=>cat==='all' || platformCategory(sec)===cat);
  const sections=filteredByCat.filter(sec=>platformSearchMatch(sec,q));
  const summary=$('platformSummary');
  if(summary){
    const shownValue=filteredByCat.reduce((s,x)=>s+x.value,0);
    const top=filteredByCat[0];
    summary.innerHTML=`<div><span>${escapeHtml(platformCategoryLabel(cat))}</span><strong>${money(shownValue)}</strong><p>${top?`1위 ${escapeHtml(top.label)} · ${money(top.value)}`:'기관 자산 등록 대기'}</p></div><div class="platform-summary-meta"><b>${filteredByCat.length}개 기관 · ${state.assets.length}개 자산</b><small>${q?'검색 적용 중':'최근 업데이트 '+escapeHtml(platformLastUpdateText())}</small></div>`;
  }
  const chips=$('platformCategoryChips');
  if(chips){
    const cats=['all','exchange','broker','bank','insurance','other'];
    chips.innerHTML=cats.map(c=>`<button type="button" data-platform-cat="${c}" class="${cat===c?'active':''}">${platformCategoryLabel(c)} <b>${categoryCount(allSections,c)}</b></button>`).join('');
    chips.querySelectorAll('[data-platform-cat]').forEach(btn=>btn.onclick=()=>{ safeSettings().platformCategory=btn.dataset.platformCat; save(); renderPlatformCenter(); });
  }
  if(!sections.length){ box.innerHTML='<div class="empty">표시할 기관이 없습니다.</div>'; return; }
  box.innerHTML=sections.map((sec,idx)=>{
    const pct=total>0 ? sec.value/total*100 : 0;
    const cls=visualKeyFromText(sec.label);
    const profitClass=sec.profit>=0?'positive':'negative';
    const top=groupAssetsForList(sec.items).slice(0,4);
    const assetRows=top.map(g=>`<li><span>${escapeHtml(g.name)}</span><em>${escapeHtml(g.type||'자산')}</em><b>${money(g.value)}</b></li>`).join('');
    const {typeRows, curRows}=platformBreakdown(sec);
    const typeText=typeRows.map(([k,v])=>`${escapeHtml(k)} ${money(v)}`).join(' · ') || '분류 대기';
    const curText=curRows.map(([k,v])=>`${escapeHtml(k)} ${money(v)}`).join(' · ') || 'KRW';
    return `<article class="platform-card platform-card-pro platform-skin-${cls}"><div class="platform-rank">${idx+1}</div><div class="platform-head"><div class="platform-title"><i>${escapeHtml(platformIcon(sec.label))}</i><div><strong>${escapeHtml(sec.label)}</strong><span>${escapeHtml(platformCategoryLabel(platformCategory(sec)))} · 전체 비중 ${pct.toFixed(1)}%</span></div></div><button type="button" data-platform-view="${escapeHtml(sec.label)}">열기</button></div><div class="platform-main"><b>${money(sec.value)}</b><small class="${profitClass}">${escapeHtml(signedMoney(sec.profit))} (${sec.rate>=0?'+':''}${sec.rate.toFixed(2)}%)</small></div>${platformMiniBar(sec.value,total)}<div class="platform-metrics"><p><span>자산 개수</span><b>${sec.items.length}개</b></p><p><span>최근 업데이트</span><b>${escapeHtml(platformLastUpdateText())}</b></p><p><span>통화</span><b>${escapeHtml(sec.currencies.join(' / ') || 'KRW')}</b></p></div><div class="platform-breakdown"><p><span>자산 구성</span><b>${typeText}</b></p><p><span>통화 구성</span><b>${curText}</b></p></div><ul>${assetRows || '<li><span>자산 없음</span><b>-</b></li>'}</ul></article>`;
  }).join('');
  box.querySelectorAll('[data-platform-view]').forEach(btn=>{
    btn.onclick=()=>{
      setAssetViewFilter({mode:'platform', search: btn.dataset.platformView || ''});
      showTab('assets');
      renderLists();
    };
  });
}

function bindPlatformCenterControls(){
  const input=$('platformSearchInput');
  if(input) input.oninput=()=>{ setPlatformSearch(input.value); renderPlatformCenter(); };
  const clear=$('platformSearchClear');
  if(clear) clear.onclick=()=>{ setPlatformSearch(''); renderPlatformCenter(); };
}

function dashboardAssetGroupHtml(g, index){
  const merged = g.count>1 ? `<em>${g.count}개 계좌/거래소 통합</em>` : '';
  const detail = g.count>1 ? `<small>${escapeHtml(g.items.map(a=>`${a.country||a.account||a.currency||'-'} ${formatAssetQty(a)} ${money(assetValue(a))}`).join(' / '))}</small>` : '';
  const sub = `${escapeHtml(g.type)} · ${escapeHtml(g.currencyText)}${g.placeText ? ' · '+escapeHtml(g.placeText) : ''}`;
  return `<div class="dash-asset-row"><div><b>${index+1}. ${escapeHtml(g.name)}</b><span>${sub} ${merged}</span>${detail}</div><strong>${money(g.value)}</strong></div>`;
}

function assetGroupStatsHtml(g){
  const first=g.items[0] || {};
  const qty=g.amount;
  const avgKrw = qty>0 ? g.cost/qty : 0;
  const valueKrw = g.value;
  const priceKrw = qty>0 ? valueKrw/qty : 0;
  const sameCurrency = g.currencies && g.currencies.size===1;
  const cur = sameCurrency ? ([...g.currencies][0] || first.currency || 'KRW') : 'KRW';
  const rate = fx(cur)||1;
  const avgDisplay = qty>0 ? formatForeignMoney(avgKrw/rate, cur) : '-';
  const priceDisplay = qty>0 ? formatForeignMoney(priceKrw/rate, cur) : '-';
  const qtyUnit = formatAssetQty({...first, amount:qty});
  const rows=[
    ['총 보유수량', qtyUnit],
    ['평균단가', avgDisplay],
    ['현재가', priceDisplay],
    ['투자원금', g.cost>0 ? money(g.cost) : '-']
  ];
  return `<div class="asset-stat-grid">${rows.map(([k,v])=>`<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}</div>`;
}
function assetBreakdownHtml(g){
  if(g.count<=1) return '';
  return `<details class="asset-group-breakdown"><summary><span>계좌/거래소별 보유내역</span><b>${g.count}개</b></summary>${g.items.map(a=>{
    const place=escapeHtml(a.country || a.account || a.currency || '-');
    const sub=`${escapeHtml(a.type||'-')} · ${escapeHtml(a.symbol||'')} · ${escapeHtml(a.currency||'KRW')}`;
    return `<div class="asset-holding-row"><div class="holding-info"><b>${escapeHtml(displayAssetName(a))}</b><span>${place} · ${sub}</span><small>${escapeHtml(formatAssetQty(a))} · 원금 ${escapeHtml(money(assetCostKrw(a)))} · 손익 ${escapeHtml(signedMoney(assetValue(a)-assetCostKrw(a)))}</small></div><div class="row-actions"><button class="edit" type="button" data-edit-asset="${escapeHtml(a.id)}">수정</button><button class="danger" type="button" data-delete-asset="${escapeHtml(a.id)}">삭제</button></div></div>`;
  }).join('')}</details>`;
}
function toggleAssetFavorite(ids){
  safeSettings();
  const set=new Set(state.settings.favoriteAssetIds || []);
  const allFav=ids.every(id=>set.has(id));
  ids.forEach(id=> allFav ? set.delete(id) : set.add(id));
  state.settings.favoriteAssetIds=[...set];
  save(); renderLists(); renderPlatformCenter();
}
function bindAssetCardActions(el){
  el.querySelectorAll('[data-toggle-favorite]').forEach(btn=>{
    btn.onclick=()=>toggleAssetFavorite(String(btn.dataset.toggleFavorite||'').split(',').filter(Boolean));
  });
  el.querySelectorAll('[data-edit-asset]').forEach(btn=>{
    btn.onclick=()=>{ const a=state.assets.find(x=>x.id===btn.dataset.editAsset); if(a) startEdit('assets', a); };
  });
  el.querySelectorAll('[data-delete-asset]').forEach(btn=>{
    btn.onclick=()=>{ const id=btn.dataset.deleteAsset; const a=state.assets.find(x=>x.id===id); if(a && confirm('이 자산을 삭제할까요?')){state.assets=state.assets.filter(x=>x.id!==id); autoBackup('자산 삭제'); render();} };
  });
}
function renderSingleAssetCard(a){
  const g={items:[a], count:1, name:displayAssetName(a), type:a.type||'자산', value:assetValue(a), cost:assetCostKrw(a), amount:num(a.amount), currencies:new Set([String(a.currency||'KRW').toUpperCase()]), currencyText:String(a.currency||'KRW').toUpperCase(), placeText:a.country||a.account||'', profit:assetValue(a)-assetCostKrw(a), rate:assetCostKrw(a)>0?(assetValue(a)-assetCostKrw(a))/assetCostKrw(a)*100:0};
  const el=document.createElement('article');
  el.className='card asset-card-v2 asset-skin-'+visualKeyFromText((a.country||a.account||a.type||a.name));
  const meta=`${escapeHtml(a.type||'자산')} · ${a.symbol?escapeHtml(a.symbol)+' · ':''}${escapeHtml(a.country||a.account||'-')} · ${escapeHtml(a.currency||'KRW')}`;
  const icon=platformIcon(a.country||a.account||a.type||a.name);
  el.innerHTML=`<div class="asset-card-head"><div class="asset-title-wrap"><i class="asset-avatar">${escapeHtml(icon)}</i><div class="asset-title"><strong>${escapeHtml(displayAssetName(a))}</strong><p>${meta}</p></div></div><div class="asset-value"><b>${money(g.value)}</b><small class="${g.profit>=0?'positive':'negative'}">${escapeHtml(signedMoney(g.profit))} (${g.rate>=0?'+':''}${g.rate.toFixed(2)}%)</small></div></div>${isInvestmentAsset(a)?assetGroupStatsHtml(g):nonInvestmentStatsHtml(a)}<div class="asset-card-actions"><button class="favorite" type="button" data-toggle-favorite="${escapeHtml(a.id)}">${(safeSettings().favoriteAssetIds||[]).includes(a.id)?'★ 즐겨찾기':'☆ 즐겨찾기'}</button><button class="edit" type="button" data-edit-asset="${escapeHtml(a.id)}">수정</button><button class="danger" type="button" data-delete-asset="${escapeHtml(a.id)}">삭제</button></div>`;
  bindAssetCardActions(el);
  return el;
}
function renderGroupedAssetCard(g){
  if(g.count===1) return renderSingleAssetCard(g.items[0]);
  const el=document.createElement('article');
  el.className='card asset-card-v2 asset-group-card asset-skin-'+visualKeyFromText(g.placeText||g.type||g.name);
  const meta=`${escapeHtml(g.type)} · ${escapeHtml(g.currencyText)}${g.placeText ? ' · '+escapeHtml(g.placeText) : ''}`;
  const icon=platformIcon(g.placeText||g.type||g.name);
  el.innerHTML=`<div class="asset-card-head"><div class="asset-title-wrap"><i class="asset-avatar">${escapeHtml(icon)}</i><div class="asset-title"><strong>${escapeHtml(g.name)}</strong><p>${meta}</p><span class="merge-pill">${g.count}개 계좌/거래소 통합</span></div></div><div class="asset-value"><b>${money(g.value)}</b><small class="${g.profit>=0?'positive':'negative'}">${escapeHtml(signedMoney(g.profit))} (${g.rate>=0?'+':''}${g.rate.toFixed(2)}%)</small></div></div>${assetGroupStatsHtml(g)}<div class="asset-card-actions"><button class="favorite" type="button" data-toggle-favorite="${escapeHtml(g.items.map(a=>a.id).join(','))}">${g.items.every(a=>(safeSettings().favoriteAssetIds||[]).includes(a.id))?'★ 즐겨찾기':'☆ 즐겨찾기'}</button></div>${assetBreakdownHtml(g)}`;
  bindAssetCardActions(el);
  return el;
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
  const totalAssets = Math.max(1, state.assets.reduce((s,x)=>s+assetValue(x),0));
  const platformCount = platformSummaries().length;
  const assetCount = state.assets.length;
  const topPlatform = platformSummaries()[0];
  const todayHint = a.recommendations[0] || (topPlatform ? `${topPlatform.label} 비중 ${((topPlatform.value/totalAssets)*100).toFixed(1)}% 확인` : '자산을 등록하면 오늘의 체크가 표시됩니다.');
  const ds=$('dashMarketStatus'); if(ds) ds.textContent = marketStatusText();
  const hmt=$('homeMarketStatusTitle'); if(hmt) hmt.textContent = marketStatusTitle();
  const hmd=$('homeMarketStatusDetail'); if(hmd) hmd.innerHTML = marketDetailHtml();
  const hero=$('homeHeroSummary');
  if(hero){
    hero.innerHTML = `<div class="home-hero-main"><span>총 순자산</span><strong>${money(t.net)}</strong><p>${month===null?'스냅샷 기준 변화 계산 대기':'이번 달 '+money(month)}</p></div><div class="home-hero-chips"><span>기관 ${platformCount}개</span><span>자산 ${assetCount}개</span><span>${a.risk.label.trim()}</span></div>`;
  }
  const focus=$('homeFocusGrid');
  if(focus){
    const cashValue = state.assets.filter(x=>String(x.type||'').includes('현금')||String(x.type||'').includes('은행')).reduce((s,x)=>s+assetValue(x),0);
    const topValue = topPlatform ? topPlatform.value : 0;
    focus.innerHTML = [
      ['오늘 손익', p.profit, p.cost>0 ? `${p.rate.toFixed(1)}%` : '계산 대기'],
      ['현금/은행', cashValue, `${a.cashPct.toFixed(1)}%`],
      ['1위 기관', topValue, topPlatform ? topPlatform.label : '대기'],
      ['오늘 체크', 0, todayHint]
    ].map(([k,v,sub])=>`<article class="focus-card"><span>${escapeHtml(k)}</span><b>${k==='오늘 체크'?escapeHtml(sub):money(v)}</b><small>${k==='오늘 체크'?'':escapeHtml(sub)}</small></article>`).join('');
  }
  const platformBox=$('homePlatformPreview'); if(platformBox) platformBox.innerHTML=platformPreviewHtml(4);
  const txBox=$('homeRecentTransactions'); if(txBox) txBox.innerHTML=recentTransactionRows(3);
  const entries=Object.entries(a.byType).sort((x,y)=>y[1]-x[1]);
  const parts=[]; let acc=0;
  entries.forEach(([k,v],idx)=>{ const start=acc; acc+=v; const hue=(idx*58)%360; parts.push(`hsl(${hue} 70% 55%) ${start}% ${acc}%`); });
  $('dashDonut').style.background = parts.length ? `conic-gradient(${parts.join(',')})` : 'var(--line)';
  $('dashLegend').innerHTML = entries.length ? entries.map(([k,v],idx)=>`<span><i style="background:hsl(${(idx*58)%360} 70% 55%)"></i>${escapeHtml(k)} ${v.toFixed(1)}%</span>`).join('') : '<span>분석할 자산이 없습니다.</span>';
  const top=groupDashboardAssets().sort((x,y)=>y.value-x.value).slice(0,5);
  $('dashTopAssets').innerHTML = top.length ? top.map((x,i)=>dashboardAssetGroupHtml(x,i)).join('') : '<div class="empty">자산을 등록하면 TOP 5가 표시됩니다.</div>';
  $('dashChanges').innerHTML = [
    ['이번 주', week], ['이번 달', month], ['올해', year]
  ].map(([label,val])=>`<p><b>${label}</b><span>${val===null?'스냅샷 없음':money(val)}</span></p>`).join('');
  $('dashChecks').innerHTML = a.recommendations.slice(0,4).map(r=>`<p>• ${escapeHtml(r)}</p>`).join('');
  bindDashboardHomeActions();
}



function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function getNeededCurrencies(){
  const cur = [];
  state.assets.forEach(a=>cur.push((a.currency||'KRW').toUpperCase()));
  state.debts.forEach(d=>cur.push((d.currency||'KRW').toUpperCase()));
  return uniq(cur).filter(c=>c!=='KRW');
}

function marketStatusTitle(){
  const m = state.settings?.market || {};
  const d = m.detail || {};
  if(!m.lastUpdate) return '갱신 대기';
  const failed = Number(d.market?.failed || 0) + Number(d.fx?.failed || 0);
  if(!m.ok || failed>0) return `확인 필요 · 실패 ${failed}건`;
  const market = d.market ? `${d.market.success || 0}/${d.market.total || 0}` : '-';
  const fx = d.fx ? `${d.fx.success || 0}/${d.fx.total || 0}` : '-';
  return `정상 · 시장 ${market} · 환율 ${fx}`;
}

function marketStatusText(){
  const m = state.settings?.market || {};
  if(!m.lastUpdate) return '아직 자동 갱신 전입니다.';
  const t = new Date(m.lastUpdate).toLocaleString();
  if(m.summary) return `${t} · ${m.summary}`;
  return `${t} · ${m.message || '갱신 완료'}`;
}
function marketDetailHtml(){
  const m = state.settings?.market || {};
  const d = m.detail || {};
  if(!m.lastUpdate) return '<p class="muted">아직 갱신 기록이 없습니다.</p>';
  const rows = [
    ['시장 데이터', d.market ? `${d.market.success || 0}/${d.market.total || 0}` : '-'],
    ['환율', d.fx ? `${d.fx.success || 0}/${d.fx.total || 0}` : '-'],
    ['캐시 유지', d.market?.cached || 0],
    ['실패', d.market?.failed || 0],
    ['제외', d.market?.skipped || 0],
    ['소요시간', d.elapsedMs ? `${(d.elapsedMs/1000).toFixed(1)}초` : '-']
  ];
  const skippedTypes = d.skippedTypes || {};
  const failedItems = d.failedItems || [];
  let html = `<div class="market-detail-grid">${rows.map(([k,v])=>`<p><b>${k}</b><span>${v}</span></p>`).join('')}</div>`;
  if(Object.keys(skippedTypes).length){
    html += `<div class="market-detail-section"><strong>제외 자산 분류</strong><p>${Object.entries(skippedTypes).map(([k,v])=>`${escapeHtml(k)} ${v}`).join(' · ')}</p></div>`;
  }
  if(failedItems.length){
    html += `<div class="market-detail-section"><strong>실패 항목</strong><p>${failedItems.slice(0,8).map(x=>escapeHtml(x)).join(' · ')}${failedItems.length>8?' 외 '+(failedItems.length-8)+'개':''}</p></div>`;
  }
  return html;
}
function renderMarketStatus(){
  const box=$('marketStatusText'); if(box) box.textContent = marketStatusText();
  const mini=$('dashMarketStatus'); if(mini) mini.textContent = marketStatusText();
  const detail=$('marketStatusDetail'); if(detail) detail.innerHTML = marketDetailHtml();
}
function setMarketStatus(message, ok=true, detail=null){
  if(!state.settings) state.settings = {};
  const prev = state.settings.market || {};
  const summary = detail?.summary || message;
  state.settings.market = {...prev, lastUpdate: ok ? new Date().toISOString() : (prev.lastUpdate||''), message, summary, ok, detail: detail || prev.detail || null};
  renderMarketStatus();
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
function marketAssetLabel(a){
  const name = displayAssetName(a);
  const type = a.type || '종류없음';
  const place = a.country || a.account || a.platform || '';
  return `${name}${place ? `(${place})` : ''}·${type}`;
}
function shortAssetList(list, limit=6){
  if(!list.length) return '';
  const shown = list.slice(0, limit).map(x=>marketAssetLabel(x));
  const more = list.length > limit ? ` 외 ${list.length-limit}개` : '';
  return shown.join(', ') + more;
}
async function updateAssetMarketPrices(){
  let updated = 0, skipped = 0, failed = 0, cached = 0;
  const skippedTypes = {};
  const failedItems = [];
  const cache = getPriceCache();
  for(const a of state.assets){
    const type = String(a.type||'미분류');
    const symbol = cleanSymbol(a.symbol || a.ticker || a.code || a.name);
    try{
      if(!symbol){ skipped++; skippedTypes[type]=(skippedTypes[type]||0)+1; continue; }
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
        skippedTypes[type]=(skippedTypes[type]||0)+1;
      }
    }catch(e){
      const old = cache[symbol];
      if(old && old.price>0){ a.price = old.price; cached++; marketLog({symbol, source:'cache', ok:true, message:'최근 성공 시세 유지'}); }
      else { failed++; failedItems.push(symbol || a.name || type); marketLog({symbol, source:'all', ok:false, message:String(e.message||e)}); }
    }
  }
  setPriceCache(cache);
  const total = updated + cached + failed;
  return {updated, cached, failed, skipped, total, skippedTypes, failedItems};
}
let marketUpdating = false;
async function refreshMarketData(manual=false){
  if(marketUpdating) return;
  if(!navigator.onLine){ setMarketStatus('오프라인 · 온라인 복귀 시 갱신 대기', false); return; }
  marketUpdating = true;
  const btn=$('marketRefreshBtn'); if(btn) btn.textContent='갱신 중...';
  try{
    const started = Date.now();
    setMarketStatus('환율/시세 갱신 중...', false);
    const fxMsg = await updateFxRates();
    const price = await updateAssetMarketPrices();
    const fxCount = getNeededCurrencies().length;
    const summary = `정상 · 시장 ${price.updated + price.cached}/${price.total} · 환율 ${fxCount}/${fxCount}`;
    setMarketStatus(summary, true, {
      summary,
      elapsedMs: Date.now() - started,
      market: {success: price.updated + price.cached, total: price.total, updated: price.updated, cached: price.cached, failed: price.failed, skipped: price.skipped},
      fx: {success: fxCount, total: fxCount, message: fxMsg},
      skippedTypes: price.skippedTypes,
      failedItems: price.failedItems
    });
    renderSummary(); renderAnalysis(); renderDashboard(); renderLists();
    log('자동 업데이트 완료 · '+summary);
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
  if(id==='platforms') { renderPlatformCenter(); bindPlatformCenterControls(); }
}
function render(){ applyTheme(); renderSummary(); renderLists(); renderPlatformCenter(); renderAnalysis(); renderDashboard(); renderBackupHistory(); updateBackupStatus(); renderMarketSettings(); renderTransactions(); renderAverageAssetOptions(); save(); }
function renderSummary(){
  const t=totals(); const a=analyzePortfolio();
  $('versionBadge').textContent=displayVersion(); $('totalAssets').textContent=money(t.assets); $('totalDebts').textContent=money(t.debts); $('netWorth').textContent=money(t.net); $('riskLevel').textContent=a.risk.label.trim();
  if(!state.assets.length && !state.debts.length && !state.insurance.length) showNotice('기존 데이터가 자동으로 발견되지 않았습니다. 설정에서 “기존 데이터 다시 찾기” 또는 “복원”을 사용하세요. 예시 데이터는 더 이상 자동 생성하지 않습니다.');
}

let editing = { assets:null, debts:null, insurance:null };
function itemRow(title, sub, value, onEdit, onDelete, detailHtml=''){
  const el=document.createElement('article'); el.className='row card';
  el.innerHTML=`<div class="row-main"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(sub)}</p>${detailHtml||''}</div><div class="row-side"><b>${value}</b><div class="row-actions"><button class="edit" type="button">수정</button><button class="danger" type="button">삭제</button></div></div>`;
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
  if(kind==='assets') syncExchangeSelector();
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
  if(kind==='assets'){
    // 수정 화면에서는 내부 총 원금을 다시 사용자가 이해하기 쉬운 평균 매입단가로 보여줍니다.
    if(isInvestmentAsset(item) && form.elements.cost){
      const avg=assetAveragePrice(item);
      form.elements.cost.value = avg ? String(Math.round(avg*100000000)/100000000) : '';
    }
    if(form.elements.costCurrency) form.elements.costCurrency.value=(item.currency||'KRW').toUpperCase();
    syncExchangeSelector();
  }
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
  const assetList=$('assetList'); assetList.innerHTML=assetOverviewHtml()+assetViewToolbarHtml();
  bindAssetOverviewActions();
  bindAssetViewControls();
  const view=assetViewData();
  const content=document.createElement('div');
  content.className='asset-view-content';
  if(view.mode==='merged' || view.mode==='favorite') view.groups.forEach(g=>content.appendChild(renderGroupedAssetCard(g)));
  else if(view.mode==='raw') view.items.forEach(a=>content.appendChild(renderSingleAssetCard(a)));
  else view.sections.forEach(sec=>content.appendChild(renderAssetViewSection(sec)));
  assetList.appendChild(content);
  if(!state.assets.length) assetList.innerHTML=assetViewToolbarHtml()+'<div class="empty">등록된 자산이 없습니다.</div>';
  else if(!currentAssetItems().length) content.innerHTML='<div class="empty">검색 결과가 없습니다.</div>';
  const debtList=$('debtList'); debtList.innerHTML='';
  state.debts.forEach(d=>debtList.appendChild(itemRow(d.name, `${d.type} · ${d.currency} · ${d.rate||0}%`, money(debtValue(d)), ()=>startEdit('debts', d), ()=>{ if(confirm('이 부채를 삭제할까요?')){state.debts=state.debts.filter(x=>x.id!==d.id); autoBackup('부채 삭제'); render();} }))); 
  if(!state.debts.length) debtList.innerHTML='<div class="empty">등록된 부채가 없습니다.</div>';
  const insuranceList=$('insuranceList'); insuranceList.innerHTML='';
  state.insurance.forEach(i=>insuranceList.appendChild(itemRow(`${i.company} ${i.product}`, `${i.type||'-'} · 매월 ${i.payday||'-'}일 · 월 ${money(i.premium)}`, i.includeRefund?money(i.refund):'자산 제외', ()=>startEdit('insurance', i), ()=>{ if(confirm('이 보험을 삭제할까요?')){state.insurance=state.insurance.filter(x=>x.id!==i.id); autoBackup('보험 삭제'); render();} }))); 
  if(!state.insurance.length) insuranceList.innerHTML='<div class="empty">등록된 보험이 없습니다.</div>';
}
function setHtml(id, html){ const el=$(id); if(el) el.innerHTML=html; }
function reportJumpTo(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
}
function reportValueRows(list, labelFn){
  const total=list.reduce((s,item)=>s+assetValue(item),0);
  const map=new Map();
  list.forEach(item=>{
    const label=String(labelFn(item)||'미분류').trim() || '미분류';
    const current=map.get(label) || {label, value:0, count:0};
    current.value += assetValue(item);
    current.count += 1;
    map.set(label,current);
  });
  return [...map.values()].sort((a,b)=>b.value-a.value).map(row=>({...row, pct:total>0 ? row.value/total*100 : 0}));
}
function reportBarRowsHtml(rows, options={}){
  if(!rows.length) return '<div class="empty">분석할 데이터가 없습니다.</div>';
  const limit=options.limit || 8;
  return rows.slice(0,limit).map((row,idx)=>`<div class="report-bar-row${idx===0?' top-rank':''}"><div class="report-bar-label"><strong>${escapeHtml(row.label)}</strong><span>${row.count||0}개 · ${money(row.value)}</span></div><div class="report-bar-track"><i style="width:${Math.min(100,row.pct||0).toFixed(2)}%"></i></div><b>${(row.pct||0).toFixed(1)}%</b></div>`).join('');
}
function reportReturnRows(){
  return groupDashboardAssets()
    .filter(g=>isInvestmentAsset(g.items?.[0] || {type:g.type}))
    .sort((a,b)=>Math.abs(b.profit)-Math.abs(a.profit));
}
function reportReturnHtml(){
  const rows=reportReturnRows();
  if(!rows.length) return '<div class="empty">투자 수익률을 계산할 자산이 없습니다.</div>';
  return rows.slice(0,8).map(g=>{
    const cls=g.profit>0?'positive':g.profit<0?'negative':'neutral';
    return `<div class="report-return-row"><div><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.type||'자산')} · ${escapeHtml(g.placeText||'기관 미지정')}</span></div><b>${money(g.value)}</b><em class="${cls}">${signedMoney(g.profit)} / ${g.rate>=0?'+':''}${g.rate.toFixed(2)}%</em></div>`;
  }).join('');
}
function reportSnapshotRows(){
  const snapshots=normalizeArray(state.snapshots).filter(s=>s && s.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const monthly=new Map();
  snapshots.forEach(s=>{
    const d=new Date(s.date);
    if(Number.isNaN(d.getTime())) return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly.set(key,{label:key, net:num(s.net), assets:num(s.assets), debts:num(s.debts), date:s.date});
  });
  const rows=[...monthly.values()].sort((a,b)=>a.label.localeCompare(b.label));
  const t=totals();
  const currentKey=new Date().toISOString().slice(0,7);
  if(!rows.length || rows[rows.length-1].label!==currentKey){ rows.push({label:currentKey, net:t.net, assets:t.assets, debts:t.debts, date:new Date().toISOString()}); }
  return rows.slice(-8).map((row,idx,arr)=>({...row, change:idx>0 ? row.net-arr[idx-1].net : 0}));
}
function reportMonthlyHtml(){
  const rows=reportSnapshotRows();
  if(rows.length<=1 && !state.snapshots.length) return '<div class="empty">스냅샷을 만들면 월별 변화가 누적 표시됩니다.</div>';
  return rows.map(row=>`<div class="report-month-row"><span>${escapeHtml(row.label)}</span><b>${money(row.net)}</b><em class="${row.change>0?'positive':row.change<0?'negative':'neutral'}">${signedMoney(row.change)}</em></div>`).join('');
}
function renderAnalysis(){
  const a=analyzePortfolio();
  const t=totals();
  const investmentAssets=state.assets.filter(isInvestmentAsset);
  const investCost=investmentAssets.reduce((s,x)=>s+assetCostKrw(x),0);
  const investProfit=investmentAssets.reduce((s,x)=>s+assetValue(x),0)-investCost;
  const investRate=investCost>0 ? investProfit/investCost*100 : 0;
  const month=changeSince(31);
  const typeRows=reportValueRows(state.assets, x=>x.type||'자산');
  const countryRows=reportValueRows(state.assets, assetCountry);
  const currencyRows=reportValueRows(state.assets, x=>String(x.currency||'KRW').toUpperCase());
  const platformRows=reportValueRows(state.assets, assetPlatform);
  const cards=[
    ['순자산', money(t.net), month===null?'스냅샷 대기':'최근 변화 '+signedMoney(month)],
    ['총 투자손익', signedMoney(investProfit), `${investRate>=0?'+':''}${investRate.toFixed(2)}%`],
    ['위험도', a.risk.label.trim(), `${a.risk.score}/100`],
    ['기관 수', `${platformRows.length}개`, `${state.assets.length}개 자산`],
    ['통화 수', `${currencyRows.length}개`, currencyRows.map(r=>r.label).slice(0,3).join(' / ') || '-'],
    ['단일자산 집중도', `${a.concentration.toFixed(1)}%`, '분산 점검']
  ];
  setHtml('reportMetricCards', cards.map(([k,v,sub])=>`<article class="card report-metric"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong><p>${escapeHtml(sub)}</p></article>`).join(''));
  setHtml('reportHeroSummary', `<div><span>Reports UX Cleanup</span><strong>${money(t.assets)}</strong><p>자산 비중 · 국가 · 통화 · 기관 · 투자수익률 · 월별 변화를 한 화면에서 확인합니다.</p></div><div class="report-hero-side"><b>${state.assets.length}개 자산</b><small>투자자산 ${investmentAssets.length}개 · 거래 ${state.transactions.length}개 · 스냅샷 ${state.snapshots.length}개</small></div>`);
  setHtml('reportAssetMix', reportBarRowsHtml(typeRows));
  setHtml('reportCountryMix', reportBarRowsHtml(countryRows));
  setHtml('reportCurrencyMix', reportBarRowsHtml(currencyRows));
  setHtml('reportPlatformMix', reportBarRowsHtml(platformRows));
  setHtml('reportReturnTable', reportReturnHtml());
  setHtml('reportMonthlyChange', reportMonthlyHtml());
  setHtml('rebalanceList', a.recommendations.length ? a.recommendations.map(r=>`<p>• ${escapeHtml(r)}</p>`).join('') : '<div class="empty">현재 리밸런싱 추천 사항이 없습니다.</div>');
}


function transactionTypeLabel(v){ return v || '매수'; }
function transactionKrwTotal(t){
  const cur=(t.currency||'KRW').toUpperCase();
  const type=t.type||'매수';
  const qty=num(t.qty);
  const price=num(t.price) || ((type==='입금'||type==='출금'||type==='이자'||type==='배당') ? 1 : 0);
  const fee=num(t.fee);
  let gross = qty * price;
  if(type==='수수료') gross = fee || qty || 0;
  else if(type==='이자' || type==='배당') gross = Math.max(0, gross - fee);
  else gross = gross + fee;
  return gross * fx(cur);
}
function renderTransactionAssetOptions(){
  const sel=$('txAssetSelect');
  if(!sel) return;
  const current=sel.value;
  sel.innerHTML='<option value="">직접 입력/새 자산</option>' + state.assets.map(a=>`<option value="${a.id}">${escapeHtml(displayAssetName(a))} · ${escapeHtml(a.type||'-')} · ${escapeHtml(a.currency||'KRW')}</option>`).join('');
  if(current && state.assets.some(a=>a.id===current)) sel.value=current;
}
function fillTransactionFromAsset(){
  const sel=$('txAssetSelect'); if(!sel || !sel.value) return;
  const a=state.assets.find(x=>x.id===sel.value); if(!a) return;
  const form=$('transactionForm'); if(!form) return;
  form.elements.assetName.value = displayAssetName(a);
  form.elements.symbol.value = a.symbol || '';
  form.elements.assetType.value = a.type || '미국주식';
  form.elements.currency.value = (a.currency || 'KRW').toUpperCase();
  form.elements.price.value = a.price || '';
  updateTransactionPreview();
}
function updateTransactionPreview(){
  const form=$('transactionForm'); const box=$('txPreview'); if(!form || !box) return;
  const f=Object.fromEntries(new FormData(form));
  const cur=(f.currency||'KRW').toUpperCase();
  const qty=num(f.qty), price=num(f.price), fee=num(f.fee);
  const type=f.type||'매수';
  const effectivePrice = price || ((type==='입금'||type==='출금'||type==='이자'||type==='배당') ? 1 : 0);
  const total=transactionKrwTotal({...f, qty, price: effectivePrice, fee, currency: cur, type});
  const sign=(type==='매도'||type==='출금'||type==='수수료') ? '-' : '+';
  const unitText=(type==='입금'||type==='출금'||type==='이자'||type==='배당') ? `${qty||0} ${cur}` : `${qty||0}개 × ${effectivePrice||0} ${cur}`;
  box.textContent = `예상 반영: ${type} · ${unitText} · 수수료 ${fee||0} ${cur} · 원화 ${sign}${Math.round(total).toLocaleString('ko-KR')}원`;
}
function findOrCreateAssetForTransaction(tx){
  let asset = tx.assetId ? state.assets.find(a=>a.id===tx.assetId) : null;
  const sym=(tx.symbol||'').trim();
  if(!asset && sym){
    asset=state.assets.find(a=>String(a.symbol||'').toUpperCase()===sym.toUpperCase() || String(a.name||'').toUpperCase().includes(sym.toUpperCase()));
  }
  if(!asset){
    asset={id:uid(), name:tx.assetName||tx.symbol||'새 자산', symbol:tx.symbol||'', type:tx.assetType||'미국주식', country:'', account:'', currency:(tx.currency||'KRW').toUpperCase(), amount:0, price:tx.price||0, cost:0, costCurrency:'KRW', priceSource:'거래내역', priceUpdatedAt:new Date().toISOString()};
    if(String(asset.type).includes('한국 ETF')){
      const code=extractKoreanCode(asset.symbol, asset.name);
      const nm=code && krEtfKnownName(code);
      if(code){ asset.symbol=code; asset.currency='KRW'; if(nm && !String(asset.name||'').includes(nm)) asset.name=`${code} ${nm}`; }
    }
    state.assets.push(asset);
  }
  return asset;
}
function snapshotAsset(a){
  if(!a) return null;
  return {id:a.id, amount:num(a.amount), price:num(a.price), cost:num(a.cost), costCurrency:(a.costCurrency||'KRW').toUpperCase(), currency:(a.currency||'KRW').toUpperCase(), priceUpdatedAt:a.priceUpdatedAt||''};
}
function restoreAssetSnapshot(snap){
  if(!snap || !snap.id) return false;
  const a=state.assets.find(x=>x.id===snap.id);
  if(!a) return false;
  a.amount = num(snap.amount);
  a.price = num(snap.price);
  a.cost = num(snap.cost);
  a.costCurrency = (snap.costCurrency||'KRW').toUpperCase();
  a.currency = (snap.currency||a.currency||'KRW').toUpperCase();
  a.priceUpdatedAt = new Date().toISOString();
  return true;
}
function approximateReverseTransaction(tx){
  if(!tx || tx.type==='배당' || tx.type==='수수료') return false;
  const asset = tx.assetId ? state.assets.find(a=>a.id===tx.assetId) : null;
  if(!asset) return false;
  const type=tx.type, qty=num(tx.qty), price=num(tx.price), fee=num(tx.fee);
  const cur=(tx.currency||asset.currency||'KRW').toUpperCase();
  const effectivePrice = price || ((type==='입금'||type==='출금'||type==='이자') ? 1 : 0);
  const txCost=(qty*effectivePrice+fee)*fx(cur);
  if(type==='매수' || type==='입금' || type==='이자'){
    asset.amount=Math.max(0, num(asset.amount)-qty);
    if(type!=='이자') asset.cost=Math.max(0, assetCostKrw(asset)-txCost);
    asset.costCurrency='KRW';
  }else if(type==='매도' || type==='출금'){
    asset.amount=num(asset.amount)+qty;
    asset.cost=Math.max(0, assetCostKrw(asset)+txCost);
    asset.costCurrency='KRW';
  }
  asset.priceUpdatedAt = new Date().toISOString();
  return true;
}
function reverseTransactionFromAsset(tx){
  if(!tx) return false;
  if(tx.assetBeforeState && restoreAssetSnapshot(tx.assetBeforeState)) return true;
  return approximateReverseTransaction(tx);
}
function applyTransactionToAsset(tx){
  const type=tx.type;
  if(type==='배당' || type==='수수료') return null;
  const asset=findOrCreateAssetForTransaction(tx);
  tx.assetId = asset.id;
  const before=snapshotAsset(asset);
  const qty=num(tx.qty);
  const price=num(tx.price);
  const fee=num(tx.fee);
  const cur=(tx.currency||asset.currency||'KRW').toUpperCase();
  const oldQty=num(asset.amount);
  const oldCost=assetCostKrw(asset);
  const effectivePrice = price || ((type==='입금'||type==='출금'||type==='이자') ? 1 : 0);
  const txCost=(qty*effectivePrice+fee)*fx(cur);
  if(type==='이자'){
    asset.amount = oldQty + qty;
    asset.price = effectivePrice || asset.price || 1;
    asset.currency = cur;
    // 이자는 수익으로 보며 매입원금은 늘리지 않습니다.
  }else if(type==='매수' || type==='입금'){
    asset.amount = oldQty + qty;
    asset.price = effectivePrice || asset.price || 0;
    asset.currency = cur;
    asset.cost = Math.max(0, oldCost + txCost);
    asset.costCurrency = 'KRW';
  }else if(type==='매도' || type==='출금'){
    const sellQty=Math.min(qty, oldQty);
    const remainQty=Math.max(0, oldQty - sellQty);
    const remainRatio=oldQty>0 ? remainQty/oldQty : 0;
    asset.amount = remainQty;
    asset.price = effectivePrice || asset.price || 0;
    asset.cost = Math.max(0, oldCost * remainRatio);
    asset.costCurrency = 'KRW';
  }
  asset.priceUpdatedAt = new Date().toISOString();
  tx.assetBeforeState = before;
  tx.assetAfterState = snapshotAsset(asset);
  return asset;
}
let editingTransactionId = null;
function transactionFromForm(){
  const form=$('transactionForm'); if(!form) return null;
  const f=Object.fromEntries(new FormData(form));
  const txType=f.type||'매수';
  const tx={id:editingTransactionId||uid(), date:f.date || new Date().toISOString().slice(0,10), type:txType, assetId:f.assetId||'', assetName:f.assetName||'', symbol:f.symbol||'', assetType:f.assetType||'미국주식', currency:(f.currency||'KRW').toUpperCase(), qty:num(f.qty), price:num(f.price) || ((txType==='입금'||txType==='출금'||txType==='이자'||txType==='배당') ? 1 : 0), fee:num(f.fee), memo:f.memo||'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
  tx.totalKrw = transactionKrwTotal(tx);
  return tx;
}
function resetTransactionForm(){
  const form=$('transactionForm'); if(!form) return;
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0,10);
  form.elements.currency.value = 'KRW';
  editingTransactionId=null;
  const btn=$('txSaveBtn'); if(btn) btn.textContent='거래 저장 및 자산 반영';
  const cancel=$('txCancelBtn'); if(cancel) cancel.classList.add('hidden');
  updateTransactionPreview();
}
function addTransaction(e){
  if(e) e.preventDefault();
  const tx=transactionFromForm(); if(!tx) return;
  if((tx.type==='매수'||tx.type==='매도'||tx.type==='입금'||tx.type==='출금'||tx.type==='이자'||tx.type==='배당') && (!tx.qty || tx.qty<0)){ log('거래 수량/금액을 확인하세요.'); return; }
  if((tx.type==='매수'||tx.type==='매도') && !tx.price){ log('거래 단가를 확인하세요.'); return; }
  if(editingTransactionId){
    const old=state.transactions.find(t=>t.id===editingTransactionId);
    if(old) reverseTransactionFromAsset(old);
    applyTransactionToAsset(tx);
    state.transactions = state.transactions.filter(t=>t.id!==editingTransactionId);
    state.transactions.unshift({...old, ...tx});
    autoBackup('거래내역 수정');
    log('거래내역 수정 및 자산 재반영 완료');
  }else{
    applyTransactionToAsset(tx);
    state.transactions.unshift(tx);
    autoBackup('거래내역 추가');
    log('거래내역 저장 및 자산 반영 완료');
  }
  resetTransactionForm();
  render();
}
function editTransaction(id){
  const tx=state.transactions.find(t=>t.id===id); if(!tx) return;
  const form=$('transactionForm'); if(!form) return;
  editingTransactionId=id;
  form.elements.date.value=tx.date||new Date().toISOString().slice(0,10);
  form.elements.type.value=tx.type||'매수';
  form.elements.assetId.value=tx.assetId||'';
  form.elements.assetName.value=tx.assetName||'';
  form.elements.symbol.value=tx.symbol||'';
  form.elements.assetType.value=tx.assetType||'미국주식';
  form.elements.currency.value=(tx.currency||'KRW').toUpperCase();
  form.elements.qty.value=tx.qty||'';
  form.elements.price.value=tx.price||'';
  form.elements.fee.value=tx.fee||0;
  form.elements.memo.value=tx.memo||'';
  const btn=$('txSaveBtn'); if(btn) btn.textContent='거래 수정 및 자산 재반영';
  const cancel=$('txCancelBtn'); if(cancel) cancel.classList.remove('hidden');
  document.getElementById('transactions')?.scrollIntoView({behavior:'smooth', block:'start'});
  updateTransactionPreview();
}
function deleteTransaction(id){
  const tx=state.transactions.find(t=>t.id===id);
  if(!tx) return;
  if(!confirm('거래내역을 삭제하고 해당 거래의 자산 반영분을 되돌릴까요?')) return;
  reverseTransactionFromAsset(tx);
  state.transactions=state.transactions.filter(t=>t.id!==id);
  autoBackup('거래내역 삭제 및 자산 되돌림'); render(); log('거래내역 삭제 및 자산 되돌림 완료');
}
function renderTransactions(){
  renderTransactionAssetOptions();
  const dateEl=$('txDate'); if(dateEl && !dateEl.value) dateEl.value=new Date().toISOString().slice(0,10);
  const list=$('transactionList'); if(!list) return;
  const txs=state.transactions || [];
  if(!txs.length){ list.innerHTML='<div class="empty">등록된 거래내역이 없습니다.</div>'; return; }
  list.innerHTML='';
  txs.slice(0,80).forEach(t=>{
    const title=`${t.date||''} · ${transactionTypeLabel(t.type)} · ${t.assetName||t.symbol||'자산'}`;
    const incomeType=(t.type==='이자'||t.type==='배당'||t.type==='입금'||t.type==='출금');
    const sub= incomeType ? `${t.symbol||'-'} · ${t.qty||0} ${t.currency||'KRW'} · 수수료 ${t.fee||0}` : `${t.symbol||'-'} · ${t.qty||0} × ${t.price||0} ${t.currency||'KRW'} · 수수료 ${t.fee||0}`;
    list.appendChild(itemRow(title, sub, money(t.totalKrw || transactionKrwTotal(t)), ()=>{ const a=state.assets.find(x=>x.id===t.assetId); if(a) startEdit('assets', a); else log('연결된 자산을 찾지 못했습니다.'); }, ()=>deleteTransaction(t.id)));
  });
}


function getAvgCurrency(){ return ($('avgCurrency')?.value || 'KRW').toUpperCase(); }
function getAvgFxRate(){ const cur=getAvgCurrency(); const manual=Number($('avgFxRate')?.value||0); return cur==='KRW' ? 1 : (manual>0 ? manual : fx(cur)); }
function syncAvgFxRate(){
  const cur=getAvgCurrency();
  const el=$('avgFxRate');
  if(!el) return;
  if(cur==='KRW'){ el.value='1'; el.disabled=true; }
  else { el.disabled=false; if(!Number(el.value) || Number(el.value)===1) el.value = fx(cur) || ''; }
}
function fmtUnit(v,cur){
  v=Number(v)||0; cur=(cur||'KRW').toUpperCase();
  if(cur==='KRW') return money(v);
  return `${v.toLocaleString('ko-KR',{maximumFractionDigits:4})} ${cur}`;
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
  const cur=(a.currency||'KRW').toUpperCase();
  if($('avgCurrency')) $('avgCurrency').value = ['KRW','USD','USDT','HKD','AUD'].includes(cur) ? cur : 'KRW';
  syncAvgFxRate();
  const rate=getAvgFxRate();
  const cost=Number(a.cost||0);
  const costCur=(a.costCurrency||'KRW').toUpperCase();
  let avg = Number(a.price||0);
  if(qty>0 && cost>0){
    if(costCur===cur) avg = cost/qty;
    else avg = assetCostKrw(a) / qty / rate;
  }
  if($('avgCurrentQty')) $('avgCurrentQty').value = qty || '';
  if($('avgCurrentPrice')) $('avgCurrentPrice').value = avg ? String(Math.round(avg*10000)/10000) : '';
  if($('avgResult')) $('avgResult').innerHTML = `<div class="empty">${escapeHtml(displayAssetName(a))} 기준으로 ${cur} 평단을 불러왔습니다. 매입원금 통화(${costCur})를 반영했습니다.</div>`;
}
function calculateAverageBuy(){
  syncAvgFxRate();
  const cur=getAvgCurrency();
  const rate=getAvgFxRate();
  const curQty=Number($('avgCurrentQty')?.value||0);
  const curPrice=Number($('avgCurrentPrice')?.value||0);
  const addQty=Number($('avgAddQty')?.value||0);
  const addPrice=Number($('avgAddPrice')?.value||0);
  const fee=Number($('avgFee')?.value||0);
  const box=$('avgResult');
  if(!box) return;
  if(curQty<0 || addQty<0 || curPrice<0 || addPrice<0 || fee<0 || (curQty+addQty)<=0 || rate<=0){
    box.innerHTML='<div class="empty">수량, 단가, 환율을 확인해 주세요.</div>'; return;
  }
  const oldCost=curQty*curPrice;
  const addCost=addQty*addPrice + fee;
  const totalQty=curQty+addQty;
  const totalCost=oldCost+addCost;
  const newAvg=totalCost/totalQty;
  const beforeAvg=curQty>0?curPrice:0;
  const diff=beforeAvg>0?newAvg-beforeAvg:0;
  const diffPct=beforeAvg>0?(diff/beforeAvg*100):0;
  const totalKrw=totalCost*rate, avgKrw=newAvg*rate;
  const rows=[
    ['계산 통화', cur],
    ['적용 환율', cur==='KRW' ? '1' : rate.toLocaleString('ko-KR',{maximumFractionDigits:2})],
    ['기존 매입금액', fmtUnit(oldCost,cur)],
    ['추가 매입금액', fmtUnit(addCost,cur)],
    ['총 보유수량', totalQty.toLocaleString('ko-KR',{maximumFractionDigits:8})],
    ['새 총 매입금액', fmtUnit(totalCost,cur)],
    ['새 평단', fmtUnit(newAvg,cur)],
    ['원화 환산 평단', money(avgKrw)],
    ['원화 총 매입금액', money(totalKrw)],
    ['평단 변화', beforeAvg>0 ? `${diff>=0?'+':''}${diff.toLocaleString('ko-KR',{maximumFractionDigits:4})} ${cur} (${diffPct>=0?'+':''}${diffPct.toFixed(2)}%)` : '-']
  ];
  box.dataset.copy = `계산 통화: ${cur}\n새 평단: ${newAvg} ${cur}\n원화 환산 평단: ${Math.round(avgKrw)} KRW\n총 보유수량: ${totalQty}\n총 매입금액: ${totalCost} ${cur}\n원화 총 매입금액: ${Math.round(totalKrw)} KRW`;
  box.innerHTML = '<div class="avg-grid">' + rows.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('') + '</div>';
}
function resetAverageCalculator(){
  ['avgCurrentQty','avgCurrentPrice','avgAddQty','avgAddPrice','avgFee'].forEach(id=>{ const el=$(id); if(el) el.value = id==='avgFee' ? '0' : ''; });
  const sel=$('avgAssetSelect'); if(sel) sel.value='';
  if($('avgCurrency')) $('avgCurrency').value='KRW';
  if($('avgFxRate')) $('avgFxRate').value='1';
  syncAvgFxRate();
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
  if(!state.settings) state.settings={};
  const w=$('marketWorkerUrl'); if(w) state.settings.marketWorkerUrl=w.value.trim();
  save(); renderMarketSettings(); const st=$('marketWorkerStatus'); if(st) st.textContent='Worker URL 저장 완료'; log('Worker URL 저장 완료');
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
  const typeEl=assetForm?.elements?.type; if(typeEl) typeEl.onchange=()=>{ if(typeEl.value==='한국 ETF'){ assetForm.currency.value='KRW'; } const search=$('institutionSearchInput'); if(search) search.value=''; syncExchangeSelector(); };
  const exSel=$('exchangeSelect'); if(exSel) exSel.onchange=applySelectedExchangeToAssetForm;
  const institutionSearch=$('institutionSearchInput'); if(institutionSearch) institutionSearch.oninput=()=>syncInstitutionSelector({keepCustom:false});
  syncExchangeSelector();
  assetForm.onsubmit=e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(assetForm));
    const exSel=$('exchangeSelect');
    if(exSel && exSel.value && exSel.value!=='custom') f.country=institutionLabelFromKey(exSel.value) || f.country;
    prepareAssetFormData(f);
    if(String(f.type||'').includes('한국 ETF')){
      const code=extractKoreanCode(f.symbol, f.name);
      if(code){
        const nm=krEtfKnownName(code);
        f.symbol=code;
        f.currency='KRW';
        f.costCurrency = f.costCurrency || 'KRW';
        if(nm && !String(f.name||'').includes(nm)) f.name=`${code} ${nm}`;
      }
    }
    upsert('assets', f); render();
  };
  debtForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(debtForm)); f.currency=(f.currency||'KRW').toUpperCase(); upsert('debts', f); render(); };
  insuranceForm.onsubmit=e=>{ e.preventDefault(); const f=Object.fromEntries(new FormData(insuranceForm)); f.includeRefund=insuranceForm.includeRefund.checked; upsert('insurance', f); render(); };
}
function backup(){ const blob=new Blob([JSON.stringify({...state,version:APP_VERSION,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`asset-manager-${versionSlug()}-backup.json`; a.click(); URL.revokeObjectURL(a.href); }
function restore(file){ const r=new FileReader(); r.onload=()=>{ try{ createLocalVersionBackup('복원 전 자동백업'); state=normalizeState(JSON.parse(r.result),'restore'); createLocalVersionBackup('파일 복원 완료'); render(); log('복원 완료'); }catch(e){ log('복원 실패: JSON 파일을 확인하세요.'); } }; r.readAsText(file); }
function log(msg){ $('logBox').textContent=`[${new Date().toLocaleString()}] ${msg}`; }
function takeSnapshot(){ const t=totals(); state.snapshots.push({id:uid(),date:new Date().toISOString(),...t}); autoBackup('스냅샷 저장'); render(); log('스냅샷 저장 완료'); }
function forceMigrate(){ const found=findLegacyState(); if(found){ createLocalVersionBackup('기존 데이터 복구 전 자동백업'); state=found.state; createLocalVersionBackup('기존 데이터 복구 완료'); render(); log(`기존 데이터 복구 완료: ${found.key}`); } else log('기존 데이터를 찾지 못했습니다. 백업 파일 복원을 사용하세요.'); }
function resetDemo(){ state.assets = state.assets.filter(a=>!(a.name||'').startsWith('예시 ')); autoBackup('예시 데이터 제거'); render(); log('예시 데이터 제거 완료'); }
function restoreMenus(){ safeSettings(); state.settings.hiddenTabs=[]; initTabs(); render(); log('메뉴 전체 복구 완료'); }
function recoverLastGoodBackup(){ const b=latestBackupState(); if(!b){ log('복구 가능한 백업 데이터를 찾지 못했습니다.'); return; } createLocalVersionBackup('최근 정상 백업 복구 전 자동백업'); state=b.state; createLocalVersionBackup('최근 정상 백업 복구 완료'); render(); log('최근 정상 데이터 복구 완료: '+b.key); }

async function purgeAppCaches(){
  if('caches' in window){
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
  }
}

async function checkForUpdate(){
  log('업데이트 확인 중... 캐시와 Service Worker를 갱신합니다.');
  try{
    await purgeAppCaches();

    if('serviceWorker' in navigator){
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg){
        await reg.update();
        const sw = reg.waiting || reg.installing;
        if(sw){
          sw.postMessage({type:'SKIP_WAITING'});
          log('새 Service Worker 적용 중입니다. 잠시 후 새로고침합니다.');
          setTimeout(()=>location.reload(), 900);
          return;
        }
      }
    }

    // GitHub Pages / 브라우저 캐시를 우회해서 핵심 파일을 다시 요청합니다.
    await Promise.all([
      fetch(`./index.html?update=${Date.now()}`, {cache:'reload'}),
      fetch(`./app.js?update=${Date.now()}`, {cache:'reload'}),
      fetch(`./styles.css?update=${Date.now()}`, {cache:'reload'}),
      fetch(`./sw.js?update=${Date.now()}`, {cache:'reload'})
    ]);

    log('업데이트 확인 완료. 최신 파일로 다시 시작합니다.');
    setTimeout(()=>location.reload(), 800);
  }catch(e){
    console.warn(e);
    log('업데이트 확인 실패. 인터넷 연결 또는 GitHub Pages 배포 상태를 확인하세요.');
  }
}

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  try{
    let reloadedByControllerChange = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(reloadedByControllerChange) return;
      reloadedByControllerChange = true;
      log('새 앱 버전이 적용되어 화면을 새로고침합니다.');
      setTimeout(()=>location.reload(), 500);
    });

    const reg = await navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(APP_VERSION)}`);
    await reg.update();
    if(reg.waiting){
      reg.waiting.postMessage({type:'SKIP_WAITING'});
    }
    log('업데이트 시스템 준비 완료 · '+APP_VERSION);
  }catch(e){
    console.warn(e);
    log('Service Worker 등록 실패 · 일반 웹 모드로 실행합니다.');
  }
}

window.addEventListener('load',()=>{
  initTabs();
  bindForms();
  bindPlatformCenterControls();
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
  safeBind('marketDetailToggle', ()=>{ const d=$('marketStatusDetail'); if(d) d.classList.toggle('open'); });
  safeBind('homeMarketDetailToggle', ()=>{ const d=$('homeMarketStatusDetail'); if(d) d.classList.toggle('open'); });
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
    await purgeAppCaches();
    log('캐시 삭제 완료. 최신 파일 확인을 위해 새로고침합니다.');
    setTimeout(()=>location.reload(), 600);
  });
  safeBind('forceMigrateBtn', forceMigrate);
  safeBind('resetDemoBtn', resetDemo);
  safeBind('restoreMenusBtn', restoreMenus);
  safeBind('recoverLastGoodBtn', recoverLastGoodBackup);
  safeBind('themeToggleBtn', toggleTheme);
  safeBind('saveMarketSettingsBtn', saveMarketSettings);
  safeBind('testMarketWorkerBtn', testMarketWorker);
  const txForm=$('transactionForm'); if(txForm) txForm.addEventListener('submit', addTransaction);
  const txSel=$('txAssetSelect'); if(txSel) txSel.addEventListener('change', fillTransactionFromAsset);
  safeBind('txCancelBtn', resetTransactionForm);
  ['txType','txCurrency','txQty','txPrice','txFee'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', updateTransactionPreview); if(el) el.addEventListener('change', updateTransactionPreview); });
  safeBind('avgCalcBtn', calculateAverageBuy);
  safeBind('avgResetBtn', resetAverageCalculator);
  safeBind('avgApplyMemoBtn', copyAverageResult);
  const avgSel=$('avgAssetSelect'); if(avgSel) avgSel.addEventListener('change', loadAverageAsset);
  ['avgCurrentQty','avgCurrentPrice','avgAddQty','avgAddPrice','avgFee','avgFxRate'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input', calculateAverageBuy); });
  const avgCur=$('avgCurrency'); if(avgCur) avgCur.addEventListener('change', ()=>{ syncAvgFxRate(); calculateAverageBuy(); });
  syncAvgFxRate();
  startAutoMarketRefresh();

  document.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>resetEdit(btn.dataset.cancel)));
  registerServiceWorker();
});
