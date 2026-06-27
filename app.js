const STORAGE_KEY='asset-manager-v5-3';
const OLD_KEYS=['asset-manager-v3-9','asset-manager-v3-8-1','asset-manager-v3-8','asset-manager-v3-6','asset-manager-v3-7','asset-manager-v3-6','asset-manager-v3-9','asset-manager-v3-8-1','asset-manager-v3-8','asset-manager-v3-7','asset-manager-v3-6','asset-manager-v3-5','asset-manager-v3-0','asset-manager-v2-3','asset-manager-v2-2','asset-manager-v2-1','asset-manager-v2-0','asset-manager-v1-5','asset-manager-v1-4','asset-manager-v1-3','asset-manager-v1-2','asset-manager-v1-1'];
const SETTINGS_KEY='asset-manager-github-settings';
const PREFS_KEY='asset-manager-prefs';
const COLORS=['#2563eb','#0f766e','#f59e0b','#7c3aed','#ef4444','#06b6d4','#84cc16','#64748b','#db2777','#14b8a6'];
let state=loadState(), settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'), prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{"usdRate":1530,"usdtRate":1530,"hkdRate":195,"audRate":1080,"goalAmount":0,"fxUpdatedAt":""}');
let assetFilter='전체', barMode='account', assetSearch='', assetSort='amountDesc', editingAssetId=null, editingDebtId=null, editingExchangeId=null, editingInsuranceId=null;
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let renderScheduled=false;
let lastRenderedTab='dashboard';
function requestRender(){
 if(renderScheduled)return;
 renderScheduled=true;
 requestAnimationFrame(()=>{renderScheduled=false;render();});
}
function currentTabId(){
 const active=document.querySelector('.view.active');
 return active?active.id:'dashboard';
}
function isVisibleTab(id){return currentTabId()===id;}
const money=n=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(Number(n)||0);
const moneyShort=n=>{n=Math.round(Number(n)||0);const abs=Math.abs(n);if(abs>=100000000)return '₩'+(n/100000000).toFixed(abs>=1000000000?1:2).replace(/\.0+$|0+$/,'')+'억';if(abs>=10000)return '₩'+Math.round(n/10000).toLocaleString('ko-KR')+'만';return money(n);};
const num=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:8}).format(Number(n)||0);

const exchangeCurrencyMap={
  '업비트':'KRW','upbit':'KRW','빗썸':'KRW','bithumb':'KRW','코인원':'KRW','coinone':'KRW',
  '바이낸스':'USDT','binance':'USDT','bingx':'USDT','빙엑스':'USDT','htx':'USDT','후오비':'USDT','huobi':'USDT','okx':'USDT','오케이엑스':'USDT','bybit':'USDT','바이비트':'USDT','bitget':'USDT','비트겟':'USDT','mexc':'USDT','gate':'USDT','gate.io':'USDT','kucoin':'USDT','쿠코인':'USDT',
  '미국주식':'USD','미국':'USD','schwab':'USD','키움':'USD','토스증권':'USD','연금저축':'KRW','isa':'KRW','irp':'KRW',
  '항생':'HKD','hang seng':'HKD','hsbc':'HKD','홍콩':'HKD'
};
const koreanTickerNameMap={
  '441640':'KODEX 미국S&P500TR',
  '360750':'TIGER 미국S&P500',
  '133690':'TIGER 미국나스닥100',
  '379800':'KODEX 미국S&P500TR',
  '379810':'KODEX 미국나스닥100TR',
  '381180':'TIGER 미국필라델피아반도체나스닥',
  '411060':'ACE 미국S&P500',
  '367380':'ACE 미국나스닥100',
  '069500':'KODEX 200',
  '102110':'TIGER 200',
  '091160':'KODEX 반도체',
  '305720':'KODEX 2차전지산업',
  '305540':'TIGER 2차전지테마',
  '458730':'TIGER 미국배당다우존스',
  '402970':'ACE 미국배당다우존스',
  '458760':'TIGER 미국배당다우존스타겟커버드콜2호',
  '458250':'KODEX 미국배당프리미엄액티브',
  '449170':'TIGER 미국테크TOP10 INDXX'
};
const usTickerNameMap={
  'SCHD':'Schwab U.S. Dividend Equity ETF',
  'VOO':'Vanguard S&P 500 ETF',
  'QQQ':'Invesco QQQ Trust',
  'SPY':'SPDR S&P 500 ETF',
  'VTI':'Vanguard Total Stock Market ETF',
  'JEPI':'JPMorgan Equity Premium Income ETF',
  'JEPQ':'JPMorgan Nasdaq Equity Premium Income ETF',
  'AAPL':'Apple',
  'MSFT':'Microsoft',
  'NVDA':'NVIDIA',
  'TSLA':'Tesla',
  'GOOGL':'Alphabet',
  'GOOG':'Alphabet',
  'AMZN':'Amazon',
  'META':'Meta Platforms',
  'BRK.B':'Berkshire Hathaway',
  'AVGO':'Broadcom'
};
const coinNameMap={
  'BTC':'Bitcoin',
  'ETH':'Ethereum',
  'XRP':'XRP',
  'SOL':'Solana',
  'AVAX':'Avalanche',
  'LINK':'Chainlink',
  'BNB':'BNB',
  'DOGE':'Dogecoin',
  'ADA':'Cardano',
  'DOT':'Polkadot'
};
function assetDisplayName(a){
 const raw=String(a?.name||'').trim();
 const upper=raw.toUpperCase();
 const kr=extractKoreanTicker(raw);
 if(kr&&koreanTickerNameMap[kr])return koreanTickerNameMap[kr];
 if(a?.type==='주식'&&usTickerNameMap[upper])return usTickerNameMap[upper];
 if(a?.type==='코인'&&coinNameMap[cleanCoinSymbol(raw)])return coinNameMap[cleanCoinSymbol(raw)];
 return '';
}
function assetTitleHtml(a){
 const alias=assetDisplayName(a);
 const raw=esc(a.name);
 return alias?`<div class="name">${esc(alias)}</div><div class="meta code">${raw}</div>`:`<div class="name">${raw}</div>`;
}
function guessCurrencyFromAccount(account){const v=String(account||'').trim().toLowerCase();if(!v)return '';for(const [k,c] of Object.entries(exchangeCurrencyMap)){if(v.includes(k.toLowerCase()))return c;}return '';}
function exchangeNeedsPassphrase(name){return ['OKX','Bitget','Gate.io'].includes(String(name||''));}
function maskKey(v){v=String(v||'');return v? v.slice(0,4)+'••••'+v.slice(-4):'미입력';}
function exchangeStatusLabel(x){return x.apiKey&&x.secret&&x.readOnly?'연결 준비':'미완료';}
function exchangeStatusClass(x){return x.apiKey&&x.secret&&x.readOnly?'plus':'minus';}
function exchangeNeedsPassphrase(name){return ['OKX','Bitget','Gate.io'].includes(String(name||''));}
function updateExchangePassHint(){const el=$('exchangePassphrase');if(!el||!$('exchangeName'))return;const name=$('exchangeName').value;el.placeholder=exchangeNeedsPassphrase(name)?'Passphrase 필수':'Passphrase / UID 필요한 거래소만 입력';}
function updateCurrencyHint(){const guessed=guessCurrencyFromAccount($('assetAccount')?.value);const cur=$('assetCurrency')?.value||'KRW';const el=$('currencyHint');if(!el)return;el.innerHTML=guessed?`감지된 기본통화: <b>${guessed}</b> · 현재 입력통화: <b>${esc(cur.toUpperCase())}</b>`:'기본통화: 업비트/빗썸/코인원=KRW · 바이낸스/OKX/Bybit/Bitget/MEXC/Gate/BingX/HTX=USDT';}

const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function loadState(){let saved=localStorage.getItem(STORAGE_KEY);if(!saved){for(const k of OLD_KEYS){if(localStorage.getItem(k)){saved=localStorage.getItem(k);break;}}} if(saved){try{const s=JSON.parse(saved);return {...{assets:[],debts:[],snapshots:[],exchanges:[],insurances:[]},...s,version:'5.3'};}catch{}} return {version:'5.3',assets:[],debts:[],snapshots:[],exchanges:[],insurances:[],updatedAt:new Date().toISOString()};}
function save(){state.version='5.3';state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));requestRender();scheduleAutoGithubBackup();}
function fx(cur){cur=String(cur||'KRW').toUpperCase();if(cur==='KRW')return 1;if(cur==='USD')return Number(prefs.usdRate)||1;if(cur==='USDT')return Number(prefs.usdtRate||prefs.usdRate)||1;if(cur==='HKD')return Number(prefs.hkdRate)||1;if(cur==='AUD')return Number(prefs.audRate)||1;return 1;}
function assetAmount(a){return (Number(a.qty)||0)*(Number(a.price)||0)*fx(a.currency);}
function assetCost(a){return (Number(a.qty)||0)*(Number(a.costPrice)||0)*fx(a.currency);}
function isInvestAsset(a){return ['코인','주식'].includes(a.type);}
function assetProfit(a){return isInvestAsset(a)&&Number(a.costPrice)>0?assetAmount(a)-assetCost(a):0;}
function assetProfitPct(a){const c=assetCost(a);return c?assetProfit(a)/c*100:0;}
function totalInvestCost(){return state.assets.filter(isInvestAsset).reduce((s,a)=>s+assetCost(a),0)}
function totalProfit(){return state.assets.filter(isInvestAsset).reduce((s,a)=>s+assetProfit(a),0)}
function totalProfitPct(){const c=totalInvestCost();return c?totalProfit()/c*100:0;}
function profitClass(v){return v>0?'profit plus':v<0?'profit minus':'profit';}
function signedMoney(v){return (v>0?'+':'')+money(v);}
function signedPct(v){return (v>0?'+':'')+(Number(v)||0).toFixed(2)+'%';}
function debtAmount(d){return (Number(d.amount)||0)*fx(d.currency);}
function foreignExchange(account){return /binance|바이낸스|bingx|빙엑스|htx|후오비|huobi|okx|bybit|바이비트|bitget|mexc|gate|kucoin|kraken/i.test(String(account||''));}
function updateAssetPreview(){updateCurrencyHint();const el=$('assetPreview');if(!el)return;const cur=String($('assetCurrency').value||'KRW').toUpperCase();const qty=Number($('assetQty').value)||0;const price=Number($('assetPrice').value)||0;const costPrice=Number($('assetCostPrice')?.value)||0;const krw=qty*price*fx(cur);const cost=qty*costPrice*fx(cur);const profit=costPrice?krw-cost:0;const pct=cost?profit/cost*100:0;el.innerHTML=`평가액 미리보기: <b>${money(krw)}</b> <span>(${num(qty)} × ${num(price)} ${esc(cur)} × 환율 ${num(fx(cur))})</span>${costPrice?`<br><b class="${profitClass(profit)}">손익 ${signedMoney(profit)} (${signedPct(pct)})</b>`:''}`;}
function refreshFxBoard(){['usdRate','usdtRate','hkdRate','audRate'].forEach(id=>{const el=$(id+'View');if(el)el.textContent=money(Number(prefs[id])||0);const input=$(id);if(input && document.activeElement!==input)input.value=prefs[id]||'';});const t=$('fxUpdatedAtText');if(t)t.textContent=prefs.fxUpdatedAt?`마지막 갱신 ${prefs.fxUpdatedAt}`:'아직 갱신 기록 없음';const st=$('fxAutoStatus');if(st)st.textContent=prefs.fxAutoStatus||'앱 실행 시 자동으로 환율을 조회합니다.';}function timeAgoText(dateText){
 if(!dateText)return '기록 없음';
 const t=new Date(dateText.replace(/\./g,'-'));
 const ts=isNaN(t.getTime())?Date.parse(dateText):t.getTime();
 if(!ts)return dateText;
 const diff=Date.now()-ts;
 const min=Math.floor(diff/60000), hr=Math.floor(min/60), day=Math.floor(hr/24);
 if(min<1)return '방금 전';
 if(min<60)return `${min}분 전`;
 if(hr<24)return `${hr}시간 전`;
 return `${day}일 전`;
}
function freshnessLabel(dateText, warnHours=24, dangerHours=168){
 if(!dateText)return '🔴 기록 없음';
 const ts=Date.parse(dateText);
 if(!ts)return '🟡 확인 필요';
 const hours=(Date.now()-ts)/3600000;
 if(hours<=warnHours)return '🟢 최신';
 if(hours<=dangerHours)return '🟡 '+Math.floor(hours)+'시간 경과';
 return '🔴 '+Math.floor(hours/24)+'일 경과';
}
function addBackupLog(type,msg){
 prefs.backupLogs=prefs.backupLogs||[];
 prefs.backupLogs.unshift({type,msg,time:new Date().toISOString(),display:new Date().toLocaleString('ko-KR')});
 prefs.backupLogs=prefs.backupLogs.slice(0,10);
 localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
}
function refreshStatusBoard(){
 const set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
 set('lastPriceUpdateText', prefs.priceUpdatedAt||'기록 없음');
 set('lastFxUpdateText', prefs.fxUpdatedAt||'기록 없음');
 set('lastBackupText', prefs.lastBackupAt||'기록 없음');
 set('lastRestoreText', prefs.lastRestoreAt||'기록 없음');
 set('priceFreshness', freshnessLabel(prefs.priceUpdatedAt,6,48));
 set('fxFreshness', freshnessLabel(prefs.fxUpdatedAt,12,72));
 set('backupFreshness', freshnessLabel(prefs.lastBackupAt,24,168));
 set('restoreFreshness', prefs.lastRestoreAt?timeAgoText(prefs.lastRestoreAt):'-');
 const log=$('backupLogList');
 if(log){
  const rows=(prefs.backupLogs||[]).slice(0,5);
  log.innerHTML=rows.length?rows.map(x=>`<div><span>${esc(x.display||'')}</span><b>${esc(x.type||'로그')}</b><small>${esc(x.msg||'')}</small></div>`).join(''):'<p class="note">백업/복원 로그가 없습니다.</p>';
 }
}

async function autoUpdateFx(manual=false){
 const st=$('fxAutoStatus'); const btn=$('refreshFxBtn');
 const setMsg=(msg)=>{prefs.fxAutoStatus=msg; localStorage.setItem(PREFS_KEY,JSON.stringify(prefs)); if(st)st.textContent=msg;};
 try{
  if(st)st.textContent=manual?'환율 수동 갱신 중...':'환율 자동조회 중...';
  if(btn){btn.disabled=true;btn.textContent='갱신 중...';}

  // v4.1: 실시간에 가까운 공개 환율 API를 우선 사용합니다.
  // 1순위: open.er-api.com USD 기준
  // 2순위: Frankfurter 보조
  const getJson=async url=>{
   const r=await fetch(url,{cache:'no-store'});
   if(!r.ok)throw new Error('HTTP '+r.status);
   return r.json();
  };

  let usdKrw=0, hkdRate=0, audRate=0, source='';

  try{
   const data=await getJson('https://open.er-api.com/v6/latest/USD');
   const r=data.rates||{};
   usdKrw=Number(r.KRW);
   const hkdPerUsd=Number(r.HKD);
   const audPerUsd=Number(r.AUD);
   if(!usdKrw||!hkdPerUsd||!audPerUsd)throw new Error('ER API 데이터 부족');
   hkdRate=usdKrw/hkdPerUsd;
   audRate=usdKrw/audPerUsd;
   source='ExchangeRate API';
  }catch(primaryErr){
   const data=await getJson('https://api.frankfurter.app/latest?from=USD&to=KRW,HKD,AUD');
   const r=data.rates||{};
   usdKrw=Number(r.KRW);
   const hkdPerUsd=Number(r.HKD);
   const audPerUsd=Number(r.AUD);
   if(!usdKrw||!hkdPerUsd||!audPerUsd)throw new Error('환율 데이터 부족');
   hkdRate=usdKrw/hkdPerUsd;
   audRate=usdKrw/audPerUsd;
   source='Frankfurter 보조';
  }

  // v4.4.1: USDT/KRW는 기본적으로 USD/KRW와 동일하게 사용합니다.
  // 업비트 USDT/KRW는 스프레드/유동성 때문에 실제 달러 환율과 차이가 크게 날 수 있어 자동반영하지 않습니다.
  const usdtKrw=usdKrw;

  prefs.usdRate=Math.round(usdKrw*100)/100;
  prefs.usdtRate=Math.round(usdtKrw*100)/100;
  prefs.hkdRate=Math.round(hkdRate*100)/100;
  prefs.audRate=Math.round(audRate*100)/100;
  prefs.fxUpdatedAt=new Date().toLocaleString('ko-KR');
  prefs.fxAutoStatus=(manual?'수동 환율 갱신 완료':'자동 환율 조회 완료')+' · '+source;
  localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  requestRender();
 }catch(e){
  // 실패 시 기본값 1380으로 되돌리지 않고 마지막 정상 저장 환율을 유지합니다.
  setMsg((manual?'수동 환율 갱신 실패':'자동 환율 조회 실패')+' · 마지막 저장 환율 유지 · '+e.message);
 } finally {
  if(btn){btn.disabled=false;btn.textContent='환율 갱신';}
 }
}

function totalAssets(){return state.assets.reduce((s,a)=>s+assetAmount(a),0)+insuranceAssetAmount()}
function totalDebts(){return state.debts.reduce((s,d)=>s+debtAmount(d),0)}
function netWorth(){return totalAssets()-totalDebts()}
function groupBy(list,keyFn,valFn){return list.reduce((m,x)=>{const k=keyFn(x)||'미지정';m[k]=(m[k]||0)+valFn(x);return m;},{});}
function byType(){return groupBy(state.assets,a=>a.type,assetAmount)}
function byCrypto(){return groupBy(state.assets.filter(a=>a.type==='코인'),a=>a.name,assetAmount)}
function byAccount(){return groupBy(state.assets,a=>a.account,assetAmount)}
function byCurrency(){return groupBy(state.assets,a=>(a.currency||'KRW').toUpperCase(),assetAmount)}
function barData(){if(barMode==='type')return {title:'자산군별 자산',data:byType()};if(barMode==='currency')return {title:'통화별 자산',data:byCurrency()};return {title:'계좌/거래소별 자산',data:byAccount()};}
function monthKey(date=new Date()){
 const y=date.getFullYear();
 const m=String(date.getMonth()+1).padStart(2,'0');
 return `${y}-${m}`;
}
function monthLabel(key){
 const [y,m]=String(key).split('-');
 return `${y}.${m}`;
}
function getMonthlySnapshots(){
 state.monthlySnapshots=state.monthlySnapshots||[];
 return state.monthlySnapshots;
}
function saveMonthlySnapshot(auto=false){
 state.monthlySnapshots=state.monthlySnapshots||[];
 const key=monthKey();
 const snap={
  month:key,
  date:new Date().toLocaleDateString('ko-KR'),
  assets:totalAssets(),
  debts:totalDebts(),
  netWorth:netWorth(),
  profit:totalProfit(),
  investCost:totalInvestCost(),
  auto:!!auto,
  savedAt:new Date().toISOString()
 };
 const idx=state.monthlySnapshots.findIndex(s=>s.month===key);
 if(idx>=0) state.monthlySnapshots[idx]=snap;
 else state.monthlySnapshots.push(snap);
 state.monthlySnapshots=state.monthlySnapshots.slice(-60);
 return snap;
}
function ensureMonthlySnapshot(){
 const today=new Date();
 const key=monthKey(today);
 const list=getMonthlySnapshots();
 const existing=list.find(s=>s.month===key);
 const lastAutoKey=prefs.lastAutoMonthlySnapshot||'';
 if(!existing || lastAutoKey!==key){
  saveMonthlySnapshot(true);
  prefs.lastAutoMonthlySnapshot=key;
  localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 }
}
function monthlyChange(){
 const rows=getMonthlySnapshots().slice().sort((a,b)=>String(a.month).localeCompare(String(b.month)));
 if(rows.length<2) return {amount:0,pct:0,prev:null,last:rows[rows.length-1]||null};
 const last=rows[rows.length-1], prev=rows[rows.length-2];
 const amount=(Number(last.netWorth)||0)-(Number(prev.netWorth)||0);
 return {amount,pct:prev.netWorth?amount/Math.abs(prev.netWorth)*100:0,prev,last};
}
function renderMonthlySnapshots(){
 const el=$('monthlySnapshotList');
 if(!el)return;
 const rows=getMonthlySnapshots().slice().sort((a,b)=>String(b.month).localeCompare(String(a.month))).slice(0,6);
 el.innerHTML=rows.length?rows.map(s=>`<div><span>${esc(monthLabel(s.month))}</span><b>${money(s.netWorth)}</b><small>자산 ${moneyShort(s.assets)} · 부채 ${moneyShort(s.debts)}${s.auto?' · 자동':''}</small></div>`).join(''):'<p class="note">아직 월별 스냅샷이 없습니다.</p>';
}
function drawMonthlyLine(){
 const canvas=$('monthlyLine');
 if(!canvas)return;
 const {ctx,w,h}=setupCanvas('monthlyLine',720,280);
 const data=getMonthlySnapshots().slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))).slice(-12);
 ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');
 ctx.beginPath();ctx.moveTo(40,20);ctx.lineTo(40,h-40);ctx.lineTo(w-20,h-40);ctx.stroke();
 if(data.length<2){
  ctx.fillStyle=textColor();ctx.font='14px sans-serif';ctx.textAlign='center';
  ctx.fillText('월별 스냅샷 2개 이상부터 추이가 표시됩니다.',w/2,h/2);
  return;
 }
 const vals=data.map(d=>Number(d.netWorth)||0),min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)||1;
 ctx.strokeStyle='#0f766e';ctx.lineWidth=3;ctx.beginPath();
 data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-(((Number(d.netWorth)||0)-min)/pad)*(h-70);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
 ctx.stroke();
 data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-(((Number(d.netWorth)||0)-min)/pad)*(h-70);ctx.fillStyle='#0f766e';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();if(i===data.length-1){ctx.fillStyle=textColor();ctx.font='700 12px sans-serif';ctx.textAlign='right';ctx.fillText(moneyShort(d.netWorth),Math.min(w-22,x+58),Math.max(18,y-10));}});
 ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText(money(max),45,22);ctx.fillText(money(min),45,h-45);
}
function todayKey(date=new Date()){
 const y=date.getFullYear();
 const m=String(date.getMonth()+1).padStart(2,'0');
 const d=String(date.getDate()).padStart(2,'0');
 return `${y}-${m}-${d}`;
}
function getDailySnapshots(){
 state.dailySnapshots=state.dailySnapshots||[];
 return state.dailySnapshots;
}
function saveDailySnapshot(auto=false){
 state.dailySnapshots=state.dailySnapshots||[];
 const key=todayKey();
 const snap={
  date:key,
  label:new Date().toLocaleDateString('ko-KR'),
  assets:totalAssets(),
  debts:totalDebts(),
  netWorth:netWorth(),
  profit:totalProfit(),
  auto:!!auto,
  savedAt:new Date().toISOString()
 };
 const idx=state.dailySnapshots.findIndex(s=>s.date===key);
 if(idx>=0) state.dailySnapshots[idx]=snap;
 else state.dailySnapshots.push(snap);
 state.dailySnapshots=state.dailySnapshots.slice(-120);
 return snap;
}
function ensureDailySnapshot(){
 const key=todayKey();
 const rows=getDailySnapshots();
 const existing=rows.find(s=>s.date===key);
 if(!existing || prefs.lastAutoDailySnapshot!==key){
  saveDailySnapshot(true);
  prefs.lastAutoDailySnapshot=key;
  localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 }
}
function dailyChange(){
 const rows=getDailySnapshots().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(rows.length<2)return {amount:0,pct:0,prev:null,last:rows[rows.length-1]||null};
 const last=rows[rows.length-1], prev=rows[rows.length-2];
 const amount=(Number(last.netWorth)||0)-(Number(prev.netWorth)||0);
 return {amount,pct:prev.netWorth?amount/Math.abs(prev.netWorth)*100:0,prev,last};
}
function accountStats(){
 const grouped={};
 state.assets.filter(isInvestAsset).forEach(a=>{
  const k=a.account||'미지정';
  if(!grouped[k])grouped[k]={account:k,amount:0,cost:0,profit:0,assets:0};
  grouped[k].amount+=assetAmount(a);
  grouped[k].cost+=assetCost(a);
  grouped[k].profit+=assetProfit(a);
  grouped[k].assets++;
 });
 return Object.values(grouped).map(x=>({...x,pct:x.cost?x.profit/x.cost*100:0})).sort((a,b)=>b.amount-a.amount);
}
function renderAccountPerformance(){
 const el=$('accountPerformanceList');
 if(!el)return;
 const rows=accountStats();
 el.innerHTML=rows.length?rows.map(x=>`<div class="perf-row"><div><b>${esc(x.account)}</b><small>${x.assets}개 자산</small></div><div><strong>${money(x.amount)}</strong><span class="${profitClass(x.profit)}">${signedMoney(x.profit)} (${signedPct(x.pct)})</span></div></div>`).join(''):'<p class="note">수익률 계산 가능한 코인/주식 자산이 없습니다.</p>';
}
function renderDailySnapshots(){
 const el=$('dailySnapshotList');
 if(!el)return;
 const rows=getDailySnapshots().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
 el.innerHTML=rows.length?rows.map(s=>`<div><span>${esc(s.label||s.date)}</span><b>${money(s.netWorth)}</b><small>자산 ${moneyShort(s.assets)} · 부채 ${moneyShort(s.debts)}${s.auto?' · 자동':''}</small></div>`).join(''):'<p class="note">아직 일별 스냅샷이 없습니다.</p>';
}
function drawDailyLine(){
 const canvas=$('dailyLine');
 if(!canvas)return;
 const {ctx,w,h}=setupCanvas('dailyLine',720,260);
 const data=getDailySnapshots().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-30);
 ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');
 ctx.beginPath();ctx.moveTo(40,20);ctx.lineTo(40,h-40);ctx.lineTo(w-20,h-40);ctx.stroke();
 if(data.length<2){
  ctx.fillStyle=textColor();ctx.font='14px sans-serif';ctx.textAlign='center';
  ctx.fillText('일별 스냅샷 2개 이상부터 추이가 표시됩니다.',w/2,h/2);
  return;
 }
 const vals=data.map(d=>Number(d.netWorth)||0),min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)||1;
 ctx.strokeStyle='#7c3aed';ctx.lineWidth=3;ctx.beginPath();
 data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-(((Number(d.netWorth)||0)-min)/pad)*(h-70);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
 ctx.stroke();
 data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-(((Number(d.netWorth)||0)-min)/pad)*(h-70);ctx.fillStyle='#7c3aed';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});
 ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText(money(max),45,22);ctx.fillText(money(min),45,h-45);
}

function insuranceMonthlyPremiumTotal(){state.insurances=state.insurances||[];return state.insurances.reduce((s,i)=>s+(Number(i.monthlyPremium)||0)*fx(i.currency),0);}
function insuranceRefundTotal(){state.insurances=state.insurances||[];return state.insurances.filter(i=>i.includeAsset).reduce((s,i)=>s+(Number(i.refundValue)||0)*fx(i.currency),0);}
function insuranceCoverageTotal(){state.insurances=state.insurances||[];return state.insurances.reduce((s,i)=>s+(Number(i.coverageAmount)||0)*fx(i.currency),0);}
function insuranceAssetAmount(){return insuranceRefundTotal();}
function renderInsurances(){
 const el=$('insuranceList'); if(!el)return; state.insurances=state.insurances||[];
 if($('insuranceMonthlyPremiumTotal'))$('insuranceMonthlyPremiumTotal').textContent=money(insuranceMonthlyPremiumTotal());
 if($('insuranceRefundTotal'))$('insuranceRefundTotal').textContent=money(insuranceRefundTotal());
 if($('insuranceCoverageTotal'))$('insuranceCoverageTotal').textContent=money(insuranceCoverageTotal());
 el.innerHTML=state.insurances.length?state.insurances.map(i=>`<div class="item"><div><div class="name">${esc(i.name)}</div><div class="meta">${esc(i.type||'보험')} · ${esc(i.company||'보험사 미입력')} · ${esc(i.currency||'KRW')}${i.payDate?` · 납입일 ${esc(i.payDate)}`:''}</div>${i.memo?`<div class="meta">${esc(i.memo)}</div>`:''}</div><div class="meta">월 보험료 ${money((Number(i.monthlyPremium)||0)*fx(i.currency))}<br>해지환급금 ${money((Number(i.refundValue)||0)*fx(i.currency))}<br>${i.includeAsset?'자산 포함':'자산 미포함'}</div><div class="amount">보장 ${money((Number(i.coverageAmount)||0)*fx(i.currency))}</div><button onclick="editInsurance('${i.id}')">수정</button><button class="danger" onclick="removeInsurance('${i.id}')">삭제</button></div>`).join(''):'<p class="note">등록된 보험이 없습니다.</p>';
}
function resetInsuranceForm(){editingInsuranceId=null;if(!$('insuranceForm'))return;$('insuranceSubmitBtn').textContent='저장';$('insuranceCancelBtn').classList.add('hidden');$('insuranceForm').reset();$('insuranceCurrency').value='KRW';$('insuranceIncludeAsset').checked=false;}
window.editInsurance=id=>{const i=(state.insurances||[]).find(x=>x.id===id);if(!i)return;editingInsuranceId=id;$('insuranceForm').classList.remove('hidden');$('insuranceSubmitBtn').textContent='수정 저장';$('insuranceCancelBtn').classList.remove('hidden');$('insuranceCompany').value=i.company||'';$('insuranceName').value=i.name||'';$('insuranceType').value=i.type||'종신/저축성';$('insuranceCurrency').value=i.currency||'KRW';$('insuranceMonthlyPremium').value=i.monthlyPremium||'';$('insurancePayDate').value=i.payDate||'';$('insuranceRefundValue').value=i.refundValue||'';$('insuranceCoverageAmount').value=i.coverageAmount||'';$('insuranceIncludeAsset').checked=!!i.includeAsset;$('insuranceMemo').value=i.memo||'';window.scrollTo({top:$('insurance').offsetTop,behavior:'smooth'});};
window.removeInsurance=id=>{if(confirm('이 보험을 삭제할까요?')){state.insurances=(state.insurances||[]).filter(i=>i.id!==id);save();}};

function topAssets(limit=5){
 return state.assets.slice().map(a=>({name:a.name,display:assetDisplayName(a)||a.name,type:a.type,account:a.account||'미지정',amount:assetAmount(a),profit:assetProfit(a),pct:assetProfitPct(a)})).sort((a,b)=>b.amount-a.amount).slice(0,limit);
}
function bestWorstAssets(){
 const rows=state.assets.filter(a=>isInvestAsset(a)&&Number(a.costPrice)>0).map(a=>({name:a.name,display:assetDisplayName(a)||a.name,type:a.type,amount:assetAmount(a),profit:assetProfit(a),pct:assetProfitPct(a)}));
 return {best:rows.slice().sort((a,b)=>b.profit-a.profit)[0], worst:rows.slice().sort((a,b)=>a.profit-b.profit)[0]};
}
function allocationRows(){
 const total=totalAssets()||1;
 const rows=[
  ...Object.entries(byType()).map(([name,value])=>({group:'자산군',name,value,share:value/total*100})),
  ...Object.entries(byCurrency()).map(([name,value])=>({group:'통화',name,value,share:value/total*100}))
 ];
 return rows.sort((a,b)=>b.value-a.value);
}
const dividendYieldMap={'SCHD':3.5,'VOO':1.25,'SPY':1.25,'VTI':1.35,'QQQ':0.6,'JEPI':7.0,'JEPQ':8.5,'DGRO':2.3,'VYM':2.8,'HDV':3.5,'AAPL':0.5,'MSFT':0.7,'NVDA':0.03,'AVGO':1.5,'KO':3.0,'PEP':3.0,'O':5.5};
function dividendYieldForAsset(a){
 const s=String(a.name||'').toUpperCase().trim();
 return Number(a.dividendYield)||dividendYieldMap[s]||0;
}
function dividendRows(){
 return state.assets.filter(a=>a.type==='주식').map(a=>{
  const y=dividendYieldForAsset(a);
  const amount=assetAmount(a);
  const annual=amount*y/100;
  return {name:a.name,display:assetDisplayName(a)||a.name,amount,yield:y,annual,monthly:annual/12,currency:a.currency||'KRW'};
 }).filter(x=>x.yield>0).sort((a,b)=>b.annual-a.annual);
}
function dividendAnnualTotal(){return dividendRows().reduce((s,x)=>s+x.annual,0);}
function renderInsights(){
 const el=$('insightList'); if(!el)return;
 const bw=bestWorstAssets();
 const largest=topAssets(1)[0];
 const div=dividendAnnualTotal();
 const goal=Number(prefs.goalAmount)||0;
 const goalPct=goal?Math.min(netWorth()/goal*100,999):0;
 const items=[
  largest?`가장 큰 자산은 <b>${esc(largest.display)}</b> ${money(largest.amount)}입니다.`:'아직 자산이 없습니다.',
  bw.best?`가장 많이 오른 자산은 <b>${esc(bw.best.display)}</b> ${signedMoney(bw.best.profit)} (${signedPct(bw.best.pct)})입니다.`:'수익률 계산 가능한 자산이 아직 부족합니다.',
  bw.worst?`가장 많이 내린 자산은 <b>${esc(bw.worst.display)}</b> ${signedMoney(bw.worst.profit)} (${signedPct(bw.worst.pct)})입니다.`:'',
  goal?`순자산 목표 달성률은 <b>${goalPct.toFixed(1)}%</b>입니다.`:'순자산 목표를 설정하면 달성률을 표시합니다.',
  div?`예상 연 배당은 <b>${money(div)}</b>, 월평균 ${money(div/12)}입니다.`:'배당 ETF/주식을 등록하면 예상 배당을 표시합니다.'
 ].filter(Boolean);
 el.innerHTML=items.map(x=>`<div class="insight-item">${x}</div>`).join('');
 if($('goalProgressBar'))$('goalProgressBar').style.width=(goal?Math.min(goalPct,100):0)+'%';
 if($('goalProgressText'))$('goalProgressText').textContent=goal?`${money(netWorth())} / ${money(goal)} · ${goalPct.toFixed(1)}%`:'목표 없음';
 if($('expectedDividendAnnual'))$('expectedDividendAnnual').textContent=money(div);if($('expectedDividendAnnualHome'))$('expectedDividendAnnualHome').textContent=money(div);
 if($('expectedDividendMonthly'))$('expectedDividendMonthly').textContent=money(div/12);
}
function renderTopAssets(){
 const el=$('topAssetList'); if(!el)return;
 const rows=topAssets(6);
 el.innerHTML=rows.length?rows.map(x=>`<div class="perf-row"><div><b>${esc(x.display)}</b><small>${esc(x.type)} · ${esc(x.account)}</small></div><div><strong>${money(x.amount)}</strong>${x.profit?`<span class="${profitClass(x.profit)}">${signedMoney(x.profit)} (${signedPct(x.pct)})</span>`:''}</div></div>`).join(''):'<p class="note">자산을 추가하면 표시됩니다.</p>';
}
function renderAllocationAnalysis(){
 const el=$('allocationAnalysisList'); if(!el)return;
 const rows=allocationRows().slice(0,10);
 el.innerHTML=rows.length?rows.map(x=>`<div class="perf-row"><div><b>${esc(x.name)}</b><small>${esc(x.group)}</small></div><div><strong>${money(x.value)}</strong><span>${x.share.toFixed(1)}%</span></div></div>`).join(''):'<p class="note">분석할 자산이 없습니다.</p>';
}
function renderDividendAnalysis(){
 const el=$('dividendList'); if(!el)return;
 const rows=dividendRows();
 el.innerHTML=rows.length?rows.map(x=>`<div class="perf-row"><div><b>${esc(x.display)}</b><small>${esc(x.name)} · 예상 배당률 ${x.yield.toFixed(2)}%</small></div><div><strong>${money(x.annual)}/년</strong><span>${money(x.monthly)}/월</span></div></div>`).join(''):'<p class="note">SCHD, JEPI, JEPQ 같은 배당 ETF/주식을 등록하면 예상 배당이 표시됩니다.</p>';
}
function renderAnalysis(){
 renderInsights();renderTopAssets();renderAllocationAnalysis();renderDividendAnalysis();
}
function render(){
 refreshFxBoard();refreshStatusBoard();
 $('netWorth').textContent=money(netWorth());$('totalAssets').textContent=money(totalAssets());$('totalLiabilities').textContent=money(totalDebts());if($('totalInvestCost'))$('totalInvestCost').textContent=money(totalInvestCost());if($('totalProfit')){$('totalProfit').textContent=signedMoney(totalProfit());$('totalProfit').className=profitClass(totalProfit());}if($('totalProfitPct')){$('totalProfitPct').textContent=signedPct(totalProfitPct());$('totalProfitPct').className=profitClass(totalProfit());}
 const last=state.snapshots[state.snapshots.length-1];const change=last?netWorth()-last.netWorth:0;$('monthChange').textContent=money(change);if($('monthChangePct'))$('monthChangePct').textContent=last&&last.netWorth?((change/Math.abs(last.netWorth))*100).toFixed(1)+'%':'0%';
 const goal=Number(prefs.goalAmount)||0;$('goalText').textContent=goal?`목표 ${money(goal)} · 달성률 ${Math.round(netWorth()/goal*100)}%`:'목표 없음';
 const mc=monthlyChange();if($('monthlyChange')){$('monthlyChange').textContent=signedMoney(mc.amount);$('monthlyChange').className=profitClass(mc.amount);}if($('monthlyChangePct')){$('monthlyChangePct').textContent=signedPct(mc.pct);$('monthlyChangePct').className=profitClass(mc.amount);}
 const dc=dailyChange();if($('dailyChange')){$('dailyChange').textContent=signedMoney(dc.amount);$('dailyChange').className=profitClass(dc.amount);}if($('dailyChangePct')){$('dailyChangePct').textContent=signedPct(dc.pct);$('dailyChangePct').className=profitClass(dc.amount);}
 renderAssets();renderDebts();renderInsurances();renderExchanges();renderSnapshots();renderMonthlySnapshots();renderDailySnapshots();renderAccountPerformance();renderAnalysis();
 const tab=currentTabId();
 if(tab==='dashboard'){drawPie('assetPie',byType(),'assetLegend','총자산');drawLine();drawMonthlyLine();drawDailyLine();}
 if(tab==='graphs'){drawPie('cryptoPie',byCrypto(),'cryptoLegend','코인');drawBar();}
 lastRenderedTab=tab;
}
function filteredAssets(){let rows=state.assets.filter(a=>assetFilter==='전체'||a.type===assetFilter);const q=assetSearch.trim().toLowerCase();if(q)rows=rows.filter(a=>[a.type,a.account,a.name,a.currency].some(v=>String(v||'').toLowerCase().includes(q)));return rows.sort((a,b)=>{if(assetSort==='amountAsc')return assetAmount(a)-assetAmount(b);if(assetSort==='nameAsc')return String(a.name).localeCompare(String(b.name),'ko');if(assetSort==='typeAsc')return String(a.type).localeCompare(String(b.type),'ko')||assetAmount(b)-assetAmount(a);return assetAmount(b)-assetAmount(a);});}
function renderAssets(){const rows=filteredAssets();$('assetList').innerHTML=rows.length?rows.map(a=>{const p=assetProfit(a),pct=assetProfitPct(a);const profitHtml=isInvestAsset(a)&&Number(a.costPrice)>0?`<div class="${profitClass(p)}">${signedMoney(p)} (${signedPct(pct)})</div>`:`<div class="meta">손익 미입력</div>`;return `<div class="item"><div>${assetTitleHtml(a)}<div class="meta">${esc(a.type)} · ${esc(a.account||'미지정')}</div></div><div class="meta">현재 ${num(a.qty)} × ${num(a.price)} ${esc(a.currency||'KRW')}<br>${Number(a.costPrice)>0?`평단 ${num(a.costPrice)} ${esc(a.currency||'KRW')}`:`평단 미입력`} · 환율 ${num(fx(a.currency))}</div><div class="amount">${money(assetAmount(a))}${profitHtml}<div class="meta">${a.priceSource?`시세 ${esc(a.priceSource)} · ${esc(a.priceUpdatedAt||'')}`:''}</div></div><button onclick="editAsset('${a.id}')">수정</button><button class="danger" onclick="removeAsset('${a.id}')">삭제</button></div>`}).join(''):`<p class="note">표시할 자산이 없습니다. 검색어나 필터를 확인하세요.</p>`;}
function renderDebts(){$('debtList').innerHTML=state.debts.length?state.debts.map(d=>`<div class="item"><div><div class="name">${esc(d.name)}</div><div class="meta">${esc(d.type)} · ${esc(d.currency||'KRW')} ${d.rate?`· 금리 ${d.rate}%`:''}</div></div><div class="meta">부채 잔액</div><div class="amount">${money(debtAmount(d))}</div><button onclick="editDebt('${d.id}')">수정</button><button class="danger" onclick="removeDebt('${d.id}')">삭제</button></div>`).join(''):'<p class="note">등록된 부채가 없습니다.</p>';}
function renderExchanges(){const el=$('exchangeList');if(!el)return;state.exchanges=state.exchanges||[];el.innerHTML=state.exchanges.length?state.exchanges.map(x=>{const test=x.lastPublicTest?`<br>시세 테스트: ${esc(x.lastPublicTest)}`:'';return `<div class="item"><div><div class="name">${esc(x.name)}</div><div class="meta">시세조회 기준 거래소 · API Key 없이 사용 가능<br>마지막 확인: ${esc(x.lastSync||'아직 없음')}${test}</div></div><div class="amount"><div class="profit plus">시세조회용</div><div class="meta">잔고는 수동 입력</div></div><button onclick="editExchange('${x.id}')">수정</button><button class="ghost" onclick="testExchange('${x.id}')">시세 테스트</button><button class="danger" onclick="removeExchange('${x.id}')">삭제</button></div>`}).join(''):'<p class="note">등록된 거래소가 없어도 코인 시세 자동조회는 작동합니다. 자산의 계좌/거래소명 기준으로 우선 조회합니다.</p>';}
function renderSnapshots(){const el=$('snapshotList');if(!el)return;const rows=state.snapshots.slice(-5).reverse();el.innerHTML=rows.length?rows.map(s=>`<div><span>${esc(s.date)}</span><b>${money(s.netWorth)}</b><small>자산 ${moneyShort(s.assets)} · 부채 ${moneyShort(s.debts)}</small></div>`).join(''):'<p class="note">아직 저장된 스냅샷이 없습니다.</p>';}
function textColor(){return getComputedStyle(document.body).getPropertyValue('--text').trim()}function cardColor(){return getComputedStyle(document.body).getPropertyValue('--card').trim()}
function setupCanvas(id,w=320,h=320){const c=$(id),ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return{c,ctx,w,h};}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function drawPie(id,obj,legendId,label){const {ctx,w,h}=setupCanvas(id,360,360);const cx=180,cy=180,r=128;const data=Object.entries(obj).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);const total=data.reduce((s,[,v])=>s+v,0);if(!total){ctx.fillStyle=textColor();ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText('데이터 없음',w/2,h/2);if(legendId)$(legendId).innerHTML='';return;}let start=-Math.PI/2;const mids=[];data.forEach(([name,value],i)=>{const angle=value/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+angle);ctx.closePath();ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();mids.push({name,value,i,mid:start+angle/2,share:value/total});start+=angle;});ctx.beginPath();ctx.arc(cx,cy,68,0,Math.PI*2);ctx.fillStyle=cardColor();ctx.fill();ctx.fillStyle=textColor();ctx.font='700 15px sans-serif';ctx.textAlign='center';ctx.fillText(label,cx,cy-7);ctx.font='800 18px sans-serif';ctx.fillText(moneyShort(total),cx,cy+20);mids.filter(x=>x.share>=0.055).slice(0,6).forEach(x=>{const lx=cx+Math.cos(x.mid)*92,ly=cy+Math.sin(x.mid)*92,text=moneyShort(x.value);ctx.font='800 12px sans-serif';const tw=Math.max(ctx.measureText(text).width+18,58);roundRect(ctx,lx-tw/2,ly-13,tw,26,13);ctx.fillStyle='rgba(255,255,255,.92)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=COLORS[x.i%COLORS.length];ctx.stroke();ctx.fillStyle='#111827';ctx.textAlign='center';ctx.fillText(text,lx,ly+4);});if(legendId)$(legendId).innerHTML=data.map(([n,v],i)=>`<span class="pill"><b style="color:${COLORS[i%COLORS.length]}">●</b> ${esc(n)} ${moneyShort(v)} · ${Math.round(v/total*100)}%</span>`).join('');}
function drawLine(){const {ctx,w,h}=setupCanvas('netLine',720,280);const data=state.snapshots.slice(-12);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');ctx.beginPath();ctx.moveTo(40,20);ctx.lineTo(40,h-40);ctx.lineTo(w-20,h-40);ctx.stroke();if(data.length<2){ctx.fillStyle=textColor();ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('스냅샷 2개 이상부터 추이가 표시됩니다.',w/2,h/2);return;}const vals=data.map(d=>d.netWorth),min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)||1;ctx.strokeStyle='#2563eb';ctx.lineWidth=3;ctx.beginPath();data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-((d.netWorth-min)/pad)*(h-70);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();data.forEach((d,i)=>{const x=40+i*((w-70)/(data.length-1)),y=(h-40)-((d.netWorth-min)/pad)*(h-70);ctx.fillStyle='#2563eb';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();if(i===data.length-1){ctx.fillStyle=textColor();ctx.font='700 12px sans-serif';ctx.textAlign='right';ctx.fillText(moneyShort(d.netWorth),Math.min(w-22,x+58),Math.max(18,y-10));}});ctx.fillStyle=textColor();ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText(money(max),45,22);ctx.fillText(money(min),45,h-45);}
function drawBar(){const {title,data:raw}=barData();if($('barTitle'))$('barTitle').textContent=title;const {ctx,w,h}=setupCanvas('accountBar',720,380);const data=Object.entries(raw).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8);if(!data.length){ctx.fillStyle=textColor();ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('데이터 없음',w/2,h/2);return;}const total=data.reduce((s,[,v])=>s+v,0),max=Math.max(...data.map(([,v])=>v));data.forEach(([name,val],i)=>{const y=34+i*42,label=moneyShort(val),pct=total?Math.round(val/total*100):0;ctx.fillStyle=textColor();ctx.textAlign='left';ctx.font='800 13px sans-serif';ctx.fillText(name,20,y+15);ctx.textAlign='right';ctx.fillText(`${label} (${pct}%)`,w-20,y+15);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--line');roundRect(ctx,20,y+24,w-40,16,8);ctx.fill();const bw=Math.max((val/max)*(w-40),6);ctx.fillStyle=COLORS[i%COLORS.length];roundRect(ctx,20,y+24,bw,16,8);ctx.fill();});}
function resetAssetForm(){editingAssetId=null;$('assetSubmitBtn').textContent='저장';$('assetCancelBtn').classList.add('hidden');$('assetForm').reset();$('assetCurrency').value='KRW';$('assetQty').value=1;if($('assetCostPrice'))$('assetCostPrice').value='';updateAssetPreview();}
function resetDebtForm(){editingDebtId=null;$('debtSubmitBtn').textContent='저장';$('debtCancelBtn').classList.add('hidden');$('debtForm').reset();$('debtCurrency').value='KRW';}
window.removeAsset=id=>{if(confirm('이 자산을 삭제할까요?')){state.assets=state.assets.filter(a=>a.id!==id);save();}};
window.removeDebt=id=>{if(confirm('이 부채를 삭제할까요?')){state.debts=state.debts.filter(d=>d.id!==id);save();}};
window.editAsset=id=>{const a=state.assets.find(x=>x.id===id);if(!a)return;editingAssetId=id;$('assetForm').classList.remove('hidden');$('assetSubmitBtn').textContent='수정 저장';$('assetCancelBtn').classList.remove('hidden');$('assetType').value=a.type;$('assetAccount').value=a.account||'';$('assetName').value=a.name;$('assetCurrency').value=a.currency||'KRW';$('assetQty').value=a.qty;$('assetPrice').value=a.price;if($('assetCostPrice'))$('assetCostPrice').value=a.costPrice||'';updateAssetPreview();window.scrollTo({top:$('assets').offsetTop,behavior:'smooth'});};
window.removeExchange=id=>{if(confirm('이 거래소 연결 정보를 삭제할까요?')){state.exchanges=(state.exchanges||[]).filter(x=>x.id!==id);save();}};

async function fetchPublicTicker(exchange){
 const name=String(exchange||'').toLowerCase();
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const getJson=async url=>{const r=await timeout(10000,fetch(url,{cache:'no-store'}));if(!r.ok)throw new Error('HTTP '+r.status);return r.json();};
 if(name.includes('binance')){const j=await getJson('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');return {symbol:'BTC/USDT',price:Number(j.price),currency:'USDT'};}
 if(name.includes('upbit')||name.includes('업비트')){const j=await getJson('https://api.upbit.com/v1/ticker?markets=KRW-BTC');return {symbol:'BTC/KRW',price:Number(j[0].trade_price),currency:'KRW'};}
 if(name.includes('okx')){const j=await getJson('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT');return {symbol:'BTC/USDT',price:Number(j.data?.[0]?.last),currency:'USDT'};}
 if(name.includes('bybit')){const j=await getJson('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');return {symbol:'BTC/USDT',price:Number(j.result?.list?.[0]?.lastPrice),currency:'USDT'};}
 if(name.includes('bitget')){const j=await getJson('https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT');const row=Array.isArray(j.data)?j.data[0]:j.data;return {symbol:'BTC/USDT',price:Number(row?.lastPr||row?.close||row?.last),currency:'USDT'};}
 if(name.includes('gate')){const j=await getJson('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT');return {symbol:'BTC/USDT',price:Number(j[0]?.last),currency:'USDT'};}
 if(name.includes('htx')||name.includes('huobi')){const j=await getJson('https://api.huobi.pro/market/detail/merged?symbol=btcusdt');return {symbol:'BTC/USDT',price:Number(j.tick?.close),currency:'USDT'};}
 if(name.includes('bingx')){const j=await getJson('https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=BTC-USDT');const d=j.data||{};return {symbol:'BTC/USDT',price:Number(d.lastPrice||d.last||d.close),currency:'USDT'};}
 throw new Error('지원하지 않는 거래소입니다');
}

function cleanCoinSymbol(name){return String(name||'').toUpperCase().replace(/(USDT|KRW|USD)$/,'').replace(/[^A-Z0-9]/g,'').trim();}
function preferredPriceSources(asset){const acct=String(asset.account||'').toLowerCase();const cur=String(asset.currency||'').toUpperCase();const stableUsdt=['binance','okx','bybit','bitget','htx','gate','bingx','upbit'];if(cur==='KRW'||/upbit|업비트|bithumb|빗썸|coinone|코인원/.test(acct))return ['upbit','binance','okx','bybit','bitget','htx','gate','bingx'];return stableUsdt;}
async function fetchCryptoPriceBySource(symbol,source){
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const getJson=async url=>{const r=await timeout(9000,fetch(url,{cache:'no-store'}));if(!r.ok)throw new Error(source+' HTTP '+r.status);return r.json();};
 if(source==='upbit'){const j=await getJson(`https://api.upbit.com/v1/ticker?markets=KRW-${symbol}`);return {price:Number(j[0]?.trade_price),currency:'KRW',source:'Upbit'};}
 if(source==='binance'){const j=await getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);return {price:Number(j.price),currency:'USDT',source:'Binance'};}
 if(source==='okx'){const j=await getJson(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`);return {price:Number(j.data?.[0]?.last),currency:'USDT',source:'OKX'};}
 if(source==='bybit'){const j=await getJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}USDT`);return {price:Number(j.result?.list?.[0]?.lastPrice),currency:'USDT',source:'Bybit'};}
 if(source==='bitget'){const j=await getJson(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}USDT`);const row=Array.isArray(j.data)?j.data[0]:j.data;return {price:Number(row?.lastPr||row?.close||row?.last),currency:'USDT',source:'Bitget'};}
 if(source==='gate'){const j=await getJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol}_USDT`);return {price:Number(j[0]?.last),currency:'USDT',source:'Gate.io'};}
 if(source==='htx'){const j=await getJson(`https://api.huobi.pro/market/detail/merged?symbol=${symbol.toLowerCase()}usdt`);return {price:Number(j.tick?.close),currency:'USDT',source:'HTX'};}
 if(source==='bingx'){const j=await getJson(`https://open-api.bingx.com/openApi/spot/v1/ticker/24hr?symbol=${symbol}-USDT`);const d=j.data||{};return {price:Number(d.lastPrice||d.last||d.close),currency:'USDT',source:'BingX'};}
 throw new Error('지원하지 않는 시세 출처');
}
async function fetchCryptoPriceForAsset(asset){const symbol=cleanCoinSymbol(asset.name);if(!symbol)throw new Error('코인 심볼 없음');for(const source of preferredPriceSources(asset)){try{const t=await fetchCryptoPriceBySource(symbol,source);if(t.price>0)return t;}catch(e){console.warn('price source failed',symbol,source,e.message);}}throw new Error(`${symbol} 시세 조회 실패`);}
function normalizeStockSymbol(name){
 return String(name||'').trim().toUpperCase().replace(/\s+/g,'');
}
function extractKoreanTicker(name){
 const s=String(name||'');
 const m=s.match(/(\d{6})/);
 return m?m[1]:'';
}
async function fetchYahooChart(symbol){
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const r=await timeout(9000,fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,{cache:'no-store'}));
 if(!r.ok)throw new Error('Yahoo HTTP '+r.status);
 const j=await r.json();
 const meta=j.chart?.result?.[0]?.meta||{};
 const price=Number(meta.regularMarketPrice||meta.previousClose);
 if(!price)throw new Error('가격 파싱 실패');
 return price;
}
async function fetchStooqPrice(symbol){
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const r=await timeout(9000,fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`,{cache:'no-store'}));
 if(!r.ok)throw new Error('Stooq HTTP '+r.status);
 const txt=await r.text();
 const lines=txt.trim().split(/\r?\n/);
 if(lines.length<2)throw new Error('Stooq 데이터 없음');
 const cols=lines[1].split(',');
 const close=Number(cols[6]||cols[3]||cols[4]);
 if(!close)throw new Error('Stooq 가격 파싱 실패');
 return close;
}
async function fetchNaverRealtimePrice(code){
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const url=`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
 const r=await timeout(9000,fetch(url,{cache:'no-store'}));
 if(!r.ok)throw new Error('Naver HTTP '+r.status);
 const j=await r.json();
 const item=j.result?.areas?.[0]?.datas?.[0];
 const price=Number(String(item?.nv||item?.closePrice||'').replace(/,/g,''));
 if(!price)throw new Error('Naver 가격 파싱 실패');
 return price;
}
async function fetchNaverViaJinaPrice(code){
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('요청 시간 초과')),ms))]);
 const url=`https://r.jina.ai/http://finance.naver.com/item/main.naver?code=${code}`;
 const r=await timeout(12000,fetch(url,{cache:'no-store'}));
 if(!r.ok)throw new Error('Jina/Naver HTTP '+r.status);
 const txt=await r.text();
 const clean=txt.replace(/\s+/g,' ');
 const candidates=[
  /현재가\s*([0-9,]{3,})/,
  /종가\s*([0-9,]{3,})/,
  /([0-9]{1,3}(?:,[0-9]{3})+)\s*원/
 ];
 for(const rgx of candidates){
  const m=clean.match(rgx);
  if(m){
   const price=Number(m[1].replace(/,/g,''));
   if(price>0)return price;
  }
 }
 throw new Error('Jina/Naver 가격 파싱 실패');
}

function normalizeWorkerUrl(raw){
 let worker=String(raw||'').trim();
 if(!worker)throw new Error('미국주식 시세 Worker URL 미설정');
 if(worker.includes('justin-1984.github.io'))throw new Error('Worker URL이 자산매니저 주소입니다. workers.dev 주소를 넣어주세요.');
 if(worker.includes('dash.cloudflare.com'))throw new Error('Cloudflare 편집 화면 주소가 아니라 workers.dev 주소를 넣어주세요.');
 try{
  const u=new URL(worker);
  if(!u.hostname.includes('workers.dev'))throw new Error('workers.dev 주소가 아닙니다');
  return u.origin;
 }catch(e){
  throw new Error('Worker URL 형식 오류: '+worker);
 }
}
async function fetchMarketWorkerPrice(symbol){
 const worker=normalizeWorkerUrl(prefs.marketWorkerUrl);
 const timeout=(ms,p)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Worker 요청 시간 초과')),ms))]);
 const reqUrl=worker+'/?symbol='+encodeURIComponent(symbol);
 const r=await timeout(10000,fetch(reqUrl,{cache:'no-store'}));
 const text=await r.text();
 if(!r.ok)throw new Error('Worker HTTP '+r.status+' · '+reqUrl+' · '+text.slice(0,80));
 let j;
 try{j=JSON.parse(text);}catch(e){throw new Error('Worker 응답이 JSON이 아닙니다: '+text.slice(0,80));}
 if(!j.ok||!Number(j.price))throw new Error((j.error||'Worker 가격 없음')+' · '+reqUrl);
 return {price:Number(j.price),source:j.source||'Market Worker',currency:j.currency||''};
}
async function fetchStockPriceForAsset(asset){
 const raw=normalizeStockSymbol(asset.name);
 const cur=String(asset.currency||'').toUpperCase();
 const acct=String(asset.account||'').toLowerCase();

 // 한국 ETF/국내주식: 6자리 종목코드를 자산명에 넣는 방식이 가장 안정적입니다. 예: 441640
 const krCode=extractKoreanTicker(asset.name);
 if(cur==='KRW'||/isa|irp|연금|한국|국내|kodex|tiger|ace|kbstar|sol/.test(acct+raw)||krCode){
  const code=krCode||raw;
  if(!/^\d{6}$/.test(code))throw new Error('한국 ETF는 6자리 종목코드를 자산명에 넣어주세요. 예: 441640');
  const errors=[];
  try{const w=await fetchMarketWorkerPrice(code);return {price:w.price,currency:w.currency||'KRW',source:w.source}}catch(e){errors.push('Worker:'+e.message)}
  try{return {price:await fetchNaverRealtimePrice(code),currency:'KRW',source:'Naver'}}catch(e){errors.push('Naver:'+e.message)}
  try{return {price:await fetchNaverViaJinaPrice(code),currency:'KRW',source:'Naver/Jina'}}catch(e){errors.push('Naver/Jina:'+e.message)}
  try{return {price:await fetchYahooChart(`${code}.KS`),currency:'KRW',source:'Yahoo KS'}}catch(e){errors.push('Yahoo KS:'+e.message)}
  try{return {price:await fetchYahooChart(`${code}.KQ`),currency:'KRW',source:'Yahoo KQ'}}catch(e){errors.push('Yahoo KQ:'+e.message)}
  throw new Error(`${code} 한국 시세 조회 실패 (${errors.join(' → ')})`);
 }

 // 미국주식/ETF: SCHD, VOO, QQQ 등. v4.4부터 Worker(Finnhub)를 우선 사용합니다.
 const symbol=raw.replace(/[^A-Z.]/g,'');
 if(!symbol)throw new Error('미국주식 티커 없음');
 const errors=[];
 try{const w=await fetchMarketWorkerPrice(symbol);return {price:w.price,currency:'USD',source:w.source}}catch(e){errors.push('Worker:'+e.message)}
 try{return {price:await fetchStooqPrice(symbol.toLowerCase()+'.us'),currency:'USD',source:'Stooq US'}}catch(e){errors.push('Stooq:'+e.message)}
 try{return {price:await fetchYahooChart(symbol),currency:'USD',source:'Yahoo US'}}catch(e){errors.push('Yahoo:'+e.message)}
 throw new Error(`${symbol} 미국 시세 조회 실패 (${errors.join(' → ')})`);
}
async function fetchMarketPriceForAsset(asset){
 if(asset.type==='코인')return fetchCryptoPriceForAsset(asset);
 if(asset.type==='주식')return fetchStockPriceForAsset(asset);
 throw new Error('시세조회 대상 아님');
}
async function refreshCryptoPrices(manual=false){
 const assets=state.assets.filter(a=>(a.type==='코인'&&cleanCoinSymbol(a.name))||(a.type==='주식'&&String(a.name||'').trim()));
 const btn=$('refreshPricesBtn'); const st=$('priceAutoStatus')||$('fxAutoStatus');
 if(!assets.length){if(manual)alert('시세를 조회할 코인/주식 자산이 없습니다. 먼저 자산을 추가해 주세요.');return;}
 let ok=0,fail=[]; if(btn){btn.disabled=true;btn.textContent='시세 갱신 중...';} if(st)st.textContent='보유 코인/주식 시세 조회 중...';
 for(const a of assets){
  try{
   const t=await fetchMarketPriceForAsset(a);
   a.price=t.price;
   a.currency=t.currency;
   a.priceSource=t.source;
   a.priceUpdatedAt=new Date().toLocaleString('ko-KR');
   ok++;
  }catch(e){fail.push(`${a.name}: ${e.message}`);}
 }
 state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 prefs.priceUpdatedAt=new Date().toISOString();
 prefs.priceAutoStatus=`시세 갱신 ${ok}개 완료${fail.length?` · 실패 ${fail.length}개`:''}`;
 localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
 if(btn){btn.disabled=false;btn.textContent='전체 시세 갱신';}
 render();
 if(manual&&fail.length)alert('일부 시세 조회 실패\n'+fail.slice(0,10).join('\n'));
}
window.testExchange=async id=>{const x=(state.exchanges||[]).find(v=>v.id===id);if(!x)return;try{const btn=event?.target;if(btn){btn.disabled=true;btn.textContent='테스트 중...';}const t=await fetchPublicTicker(x.name);if(!t.price)throw new Error('가격 파싱 실패');x.lastPublicTest=`${t.symbol} ${num(t.price)} ${t.currency} · ${new Date().toLocaleString('ko-KR')}`;x.lastSync=new Date().toLocaleString('ko-KR');save();alert(`${x.name} 실제 시세 테스트 성공\n${t.symbol}: ${num(t.price)} ${t.currency}\n\n이 테스트는 API Key 없이 공개 시세 API가 브라우저에서 호출되는지 확인하는 단계입니다.`);}catch(e){alert(`${x.name} 실제 시세 테스트 실패\n${e.message}\n\n일부 거래소는 브라우저 직접 호출을 막을 수 있습니다. 이 경우 서버/프록시 방식으로 연결해야 합니다.`);}finally{render();}};


async function fetchBinanceBalancesViaWorker(x){
  const workerUrl=(x.workerUrl||'').trim();
  if(!workerUrl) throw new Error('Binance Worker URL을 먼저 입력하세요. Cloudflare Worker 배포 후 URL을 거래소 설정에 저장해야 합니다.');
  if(!x.apiKey||!x.secret) throw new Error('Binance API Key와 Secret Key를 입력하세요.');
  const base=workerUrl.replace(/\/$/,'');
  const endpoint=base.endsWith('/binance/balances') ? base : base + '/binance/balances';
  const res=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({apiKey:x.apiKey,secret:x.secret})
  });
  const txt=await res.text();
  let data;
  try{data=JSON.parse(txt)}
  catch{throw new Error('Worker 응답이 JSON이 아닙니다. Worker 코드가 최신인지 확인하세요. 응답: '+(txt||'').slice(0,300))}
  if(!res.ok||!data.ok) throw new Error(data.error||('HTTP '+res.status));
  return data.balances||[];
}
window.editExchange=id=>{const x=(state.exchanges||[]).find(v=>v.id===id);if(!x)return;editingExchangeId=id;$('exchangeForm').classList.remove('hidden');$('exchangeSubmitBtn').textContent='수정 저장';$('exchangeCancelBtn').classList.remove('hidden');$('exchangeName').value=x.name;$('exchangeApiKey').value=x.apiKey||'';$('exchangeSecret').value=x.secret||'';$('exchangePassphrase').value=x.passphrase||'';if($('exchangeWorkerUrl'))$('exchangeWorkerUrl').value=x.workerUrl||'';$('exchangeReadOnly').checked=!!x.readOnly;updateExchangePassHint();window.scrollTo({top:$('exchanges').offsetTop,behavior:'smooth'});};
function resetExchangeForm(){editingExchangeId=null, editingInsuranceId=null;if(!$('exchangeForm'))return;$('exchangeSubmitBtn').textContent='저장';$('exchangeCancelBtn').classList.add('hidden');$('exchangeForm').reset();$('exchangeReadOnly').checked=true;if($('exchangeWorkerUrl'))$('exchangeWorkerUrl').value='';updateExchangePassHint();}
window.editDebt=id=>{const d=state.debts.find(x=>x.id===id);if(!d)return;editingDebtId=id;$('debtForm').classList.remove('hidden');$('debtSubmitBtn').textContent='수정 저장';$('debtCancelBtn').classList.remove('hidden');$('debtType').value=d.type;$('debtName').value=d.name;$('debtCurrency').value=d.currency||'KRW';$('debtAmount').value=d.amount;$('debtRate').value=d.rate||'';window.scrollTo({top:$('debts').offsetTop,behavior:'smooth'});};
$('addAssetBtn').onclick=()=>{$('assetForm').classList.toggle('hidden');if(!$('assetForm').classList.contains('hidden'))resetAssetForm();};$('addDebtBtn').onclick=()=>{$('debtForm').classList.toggle('hidden');if(!$('debtForm').classList.contains('hidden'))resetDebtForm();};$('assetCancelBtn').onclick=resetAssetForm;$('debtCancelBtn').onclick=resetDebtForm;
if($('addExchangeBtn'))$('addExchangeBtn').onclick=()=>{$('exchangeForm').classList.toggle('hidden');if(!$('exchangeForm').classList.contains('hidden'))resetExchangeForm();};if($('exchangeCancelBtn'))$('exchangeCancelBtn').onclick=resetExchangeForm;if($('exchangeName'))$('exchangeName').onchange=updateExchangePassHint;

['assetCurrency','assetQty','assetPrice','assetCostPrice','assetAccount'].forEach(id=>{if($(id))$(id).addEventListener('input',()=>{if(id==='assetAccount'&&$('assetType').value==='코인'&&foreignExchange($('assetAccount').value)&&!editingAssetId){$('assetCurrency').value='USDT';}updateAssetPreview();});});
if($('assetType'))$('assetType').addEventListener('change',()=>{if($('assetType').value==='코인'&&foreignExchange($('assetAccount').value))$('assetCurrency').value='USDT';updateAssetPreview();});
if($('assetAccount'))$('assetAccount').addEventListener('blur',()=>{const guessed=guessCurrencyFromAccount($('assetAccount').value);if(guessed && (!$('assetCurrency').value || $('assetCurrency').value==='KRW')){$('assetCurrency').value=guessed;}updateAssetPreview();});
$('assetForm').onsubmit=e=>{e.preventDefault();const item={id:editingAssetId||uid(),type:$('assetType').value,account:$('assetAccount').value.trim(),name:$('assetName').value.trim(),currency:$('assetCurrency').value.trim().toUpperCase()||'KRW',qty:Number($('assetQty').value),price:Number($('assetPrice').value),costPrice:Number($('assetCostPrice')?.value)||0};if(editingAssetId){state.assets=state.assets.map(a=>a.id===editingAssetId?item:a);}else state.assets.push(item);resetAssetForm();save();};
$('debtForm').onsubmit=e=>{e.preventDefault();const item={id:editingDebtId||uid(),type:$('debtType').value,name:$('debtName').value.trim(),currency:$('debtCurrency').value.trim().toUpperCase()||'KRW',amount:Number($('debtAmount').value),rate:$('debtRate').value};if(editingDebtId){state.debts=state.debts.map(d=>d.id===editingDebtId?item:d);}else state.debts.push(item);resetDebtForm();save();};
if($('exchangeForm'))$('exchangeForm').onsubmit=e=>{e.preventDefault();state.exchanges=state.exchanges||[];const item={id:editingExchangeId||uid(),name:$('exchangeName').value,apiKey:$('exchangeApiKey').value.trim(),secret:$('exchangeSecret').value.trim(),passphrase:$('exchangePassphrase').value.trim(),workerUrl:($('exchangeWorkerUrl')?.value||'').trim(),readOnly:$('exchangeReadOnly').checked,lastSync:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastSync||'',lastPublicTest:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastPublicTest||''};if(!item.readOnly){alert('안전을 위해 조회 전용 권한 확인이 필요합니다. 거래/출금 권한은 절대 켜지 마세요.');return;}if(editingExchangeId){state.exchanges=state.exchanges.map(x=>x.id===editingExchangeId?item:x);}else state.exchanges.push(item);resetExchangeForm();save();};

if($('addInsuranceBtn'))$('addInsuranceBtn').onclick=()=>{$('insuranceForm').classList.toggle('hidden');if(!$('insuranceForm').classList.contains('hidden'))resetInsuranceForm();};
if($('insuranceCancelBtn'))$('insuranceCancelBtn').onclick=resetInsuranceForm;
if($('insuranceForm'))$('insuranceForm').onsubmit=e=>{e.preventDefault();state.insurances=state.insurances||[];const item={id:editingInsuranceId||uid(),company:$('insuranceCompany').value.trim(),name:$('insuranceName').value.trim(),type:$('insuranceType').value,currency:$('insuranceCurrency').value.trim().toUpperCase()||'KRW',monthlyPremium:Number($('insuranceMonthlyPremium').value)||0,payDate:$('insurancePayDate').value,refundValue:Number($('insuranceRefundValue').value)||0,coverageAmount:Number($('insuranceCoverageAmount').value)||0,includeAsset:$('insuranceIncludeAsset').checked,memo:$('insuranceMemo').value.trim()};if(editingInsuranceId)state.insurances=state.insurances.map(i=>i.id===editingInsuranceId?item:i);else state.insurances.push(item);resetInsuranceForm();save();};

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if($('exchangeForm'))$('exchangeForm').onsubmit=e=>{e.preventDefault();state.exchanges=state.exchanges||[];const item={id:editingExchangeId||uid(),name:$('exchangeName').value,apiKey:$('exchangeApiKey').value.trim(),secret:$('exchangeSecret').value.trim(),passphrase:$('exchangePassphrase').value.trim(),workerUrl:($('exchangeWorkerUrl')?.value||'').trim(),readOnly:$('exchangeReadOnly').checked,lastSync:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastSync||'',lastPublicTest:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastPublicTest||''};if(!item.readOnly){alert('안전을 위해 조회 전용 권한 확인이 필요합니다. 거래/출금 권한은 절대 켜지 마세요.');return;}if(editingExchangeId){state.exchanges=state.exchanges.map(x=>x.id===editingExchangeId?item:x);}else state.exchanges.push(item);resetExchangeForm();save();};

if($('addInsuranceBtn'))$('addInsuranceBtn').onclick=()=>{$('insuranceForm').classList.toggle('hidden');if(!$('insuranceForm').classList.contains('hidden'))resetInsuranceForm();};
if($('insuranceCancelBtn'))$('insuranceCancelBtn').onclick=resetInsuranceForm;
if($('insuranceForm'))$('insuranceForm').onsubmit=e=>{e.preventDefault();state.insurances=state.insurances||[];const item={id:editingInsuranceId||uid(),company:$('insuranceCompany').value.trim(),name:$('insuranceName').value.trim(),type:$('insuranceType').value,currency:$('insuranceCurrency').value.trim().toUpperCase()||'KRW',monthlyPremium:Number($('insuranceMonthlyPremium').value)||0,payDate:$('insurancePayDate').value,refundValue:Number($('insuranceRefundValue').value)||0,coverageAmount:Number($('insuranceCoverageAmount').value)||0,includeAsset:$('insuranceIncludeAsset').checked,memo:$('insuranceMemo').value.trim()};if(editingInsuranceId)state.insurances=state.insurances.map(i=>i.id===editingInsuranceId?item:i);else state.insurances.push(item);resetInsuranceForm();save();};

document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active');render();});
document.querySelectorAll('[data-asset-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-asset-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');assetFilter=b.dataset.assetFilter;renderAssets();});
if($('assetSearch'))$('assetSearch').oninput=e=>{assetSearch=e.target.value;renderAssets();};if($('assetSort'))$('assetSort').onchange=e=>{assetSort=e.target.value;renderAssets();};
document.querySelectorAll('[data-bar-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-bar-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');barMode=b.dataset.barMode;drawBar();});
$('themeToggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('asset-manager-theme',document.body.classList.contains('dark')?'dark':'light');render();};if(localStorage.getItem('asset-manager-theme')==='dark')document.body.classList.add('dark');
if($('dailySnapshotBtn'))$('dailySnapshotBtn').onclick=()=>{saveDailySnapshot(false);save();setStatus('일별 스냅샷 저장 완료');};
if($('clearDailySnapshotsBtn'))$('clearDailySnapshotsBtn').onclick=()=>{if(confirm('일별 순자산 추이를 초기화할까요?')){state.dailySnapshots=[];save();}};
if($('monthlySnapshotBtn'))$('monthlySnapshotBtn').onclick=()=>{saveMonthlySnapshot(false);save();setStatus('월별 스냅샷 저장 완료');};
if($('clearMonthlySnapshotsBtn'))$('clearMonthlySnapshotsBtn').onclick=()=>{if(confirm('월별 순자산 추이를 초기화할까요?')){state.monthlySnapshots=[];save();}};
$('snapshotBtn').onclick=()=>{const today=new Date().toLocaleDateString('ko-KR');const snap={date:today,assets:totalAssets(),debts:totalDebts(),netWorth:netWorth()};const same=state.snapshots.findIndex(s=>s.date===today);if(same>=0)state.snapshots[same]=snap;else state.snapshots.push(snap);save();};$('clearSnapshotsBtn').onclick=()=>{if(confirm('순자산 추이를 초기화할까요?')){state.snapshots=[];save();}};
['goalAmount','usdRate','usdtRate','hkdRate','audRate','marketWorkerUrl'].forEach(id=>{if($(id))$(id).value=prefs[id]||''});$('savePrefs').onclick=()=>{prefs={...prefs,goalAmount:Number($('goalAmount').value)||0,usdRate:Number($('usdRate').value)||1380,usdtRate:Number($('usdtRate').value)||Number($('usdRate').value)||1380,hkdRate:Number($('hkdRate').value)||195,audRate:Number($('audRate').value)||1080,marketWorkerUrl:(()=>{try{return normalizeWorkerUrl($('marketWorkerUrl')?.value||prefs.marketWorkerUrl||'')}catch(e){return $('marketWorkerUrl')?.value.trim()||prefs.marketWorkerUrl||''}})(),autoGithubBackup:!!$('autoGithubBackup')?.checked,autoGithubSync:!!$('autoGithubSync')?.checked,fxUpdatedAt:new Date().toLocaleString('ko-KR'),fxAutoStatus:'수동 환율 저장 완료'};localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));render();setStatus('환율/목표/시세 Worker/자동백업 설정 저장 완료');scheduleAutoGithubBackup();};
['ghOwner','ghRepo','ghPath','ghToken'].forEach(id=>{if(settings[id])$(id).value=settings[id]});if($('autoGithubBackup'))$('autoGithubBackup').checked=!!prefs.autoGithubBackup;if($('autoGithubSync'))$('autoGithubSync').checked=!!prefs.autoGithubSync;$('saveSettings').onclick=()=>{settings={ghOwner:$('ghOwner').value.trim(),ghRepo:$('ghRepo').value.trim(),ghPath:$('ghPath').value.trim()||'asset-manager-data.json',ghToken:$('ghToken').value.trim()};localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setStatus('GitHub 설정 저장 완료');scheduleAutoGithubBackup();};function setStatus(m){$('syncStatus').textContent=m;}
async function gh(method,body){settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');const{ghOwner,ghRepo,ghPath,ghToken}=settings;if(!ghOwner||!ghRepo||!ghPath||!ghToken)throw new Error('GitHub 설정을 먼저 저장하세요.');const url=`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${encodeURIComponent(ghPath).replaceAll('%2F','/')}`;const headers={Authorization:`Bearer ${ghToken}`,Accept:'application/vnd.github+json'};return method==='GET'?fetch(url,{headers}):fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});}
let autoBackupTimer=null, autoBackupBusy=false;
function hasGithubSettings(){settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return !!(settings.ghOwner&&settings.ghRepo&&settings.ghPath&&settings.ghToken);}
function autoBackupEnabled(){return !!prefs.autoGithubBackup;}
function updateAutoBackupStatus(msg){const el=$('autoBackupStatus');if(el)el.textContent=msg||'';}
function scheduleAutoGithubBackup(){
  if(!autoBackupEnabled())return;
  if(!hasGithubSettings()){updateAutoBackupStatus('자동 백업 대기: GitHub 설정 필요');return;}
  clearTimeout(autoBackupTimer);
  updateAutoBackupStatus('자동 백업 대기 중...');
  autoBackupTimer=setTimeout(()=>doGithubBackup(true),3000);
}
async function doGithubBackup(auto=false){
 try{
  if(autoBackupBusy)return;
  autoBackupBusy=true;
  if(auto){updateAutoBackupStatus('자동 백업 중...');}else setStatus('백업 중...');
  let sha;const r=await gh('GET');if(r.ok)sha=(await r.json()).sha;
  const payload={state,prefs,backupAt:new Date().toISOString(),updatedAt:state.updatedAt||new Date().toISOString(),backupMode:auto?'auto':'manual',device:navigator.userAgent.slice(0,80)};
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));
  const res=await gh('PUT',{message:`asset-manager ${auto?'auto ':''}backup ${new Date().toISOString()}`,content,sha});
  if(!res.ok)throw new Error(await res.text());
  prefs.lastBackupAt=new Date().toISOString();addBackupLog(auto?'자동백업':'수동백업','성공');localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  const msg=(auto?'자동 GitHub 백업 완료':'GitHub 백업 완료')+' · '+new Date().toLocaleString('ko-KR');
  if(auto)updateAutoBackupStatus(msg);else setStatus(msg);refreshStatusBoard();
 }catch(e){addBackupLog(auto?'자동백업':'수동백업','실패: '+e.message);const msg=(auto?'자동 백업 실패: ':'백업 실패: ')+e.message;if(auto)updateAutoBackupStatus(msg);else setStatus(msg);refreshStatusBoard();}
 finally{autoBackupBusy=false;}
}
$('backupBtn').onclick=()=>doGithubBackup(false);
$('restoreBtn').onclick=async()=>{try{setStatus('복원 중...');const r=await gh('GET');if(!r.ok)throw new Error(await r.text());const j=await r.json();const payload=JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,'')))));state=payload.state||payload;prefs=payload.prefs||prefs;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));prefs.lastRestoreAt=new Date().toISOString();addBackupLog('복원','성공');localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));setStatus('GitHub 복원 완료');render();}catch(e){addBackupLog('복원','실패: '+e.message);setStatus('복원 실패: '+e.message);refreshStatusBoard();}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({state,prefs},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='asset-manager-backup.json';a.click();URL.revokeObjectURL(a.href);};

async function testMarketWorker(){
 const el=$('marketWorkerStatus');
 try{
  const normalized=normalizeWorkerUrl($('marketWorkerUrl')?.value||prefs.marketWorkerUrl);
  if(el)el.textContent='SCHD Worker 테스트 중... · '+normalized;
  const t=await fetchMarketWorkerPrice('SCHD');
  if(el)el.textContent=`Worker 정상 · SCHD ${num(t.price)} USD · ${t.source} · ${normalized}`;
  alert(`Worker 정상\nSCHD: ${num(t.price)} USD\n출처: ${t.source}\nURL: ${normalized}`);
 }catch(e){
  if(el)el.textContent='Worker 테스트 실패: '+e.message;
  alert('Worker 테스트 실패\n'+e.message);
 }
}
if($('refreshPricesBtn'))$('refreshPricesBtn').onclick=()=>refreshCryptoPrices(true);
if($('testMarketWorkerBtn'))$('testMarketWorkerBtn').onclick=()=>testMarketWorker();
if($('refreshAllDataBtn'))$('refreshAllDataBtn').onclick=async()=>{await autoUpdateFx(true);await refreshCryptoPrices(true);};
$('importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result);state=p.state||p;prefs=p.prefs||prefs;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));setStatus('파일 가져오기 완료');render();}catch(err){setStatus('가져오기 실패: '+err.message)}};reader.readAsText(f);};
async function checkGithubSync(auto=false){
 try{
  if(!hasGithubSettings())throw new Error('GitHub 설정 필요');
  if(!auto)setStatus('동기화 확인 중...');
  const r=await gh('GET');if(!r.ok)throw new Error(await r.text());
  const j=await r.json();
  const payload=JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,'')))));
  const remoteState=payload.state||payload;
  const remoteUpdated=Date.parse(remoteState.updatedAt||payload.updatedAt||payload.backupAt||0);
  const localUpdated=Date.parse(state.updatedAt||0);
  if(remoteUpdated>localUpdated+1000){
   if(auto || confirm('GitHub에 더 최신 백업이 있습니다. 복원할까요?')){
    state=remoteState;
    prefs={...prefs,...(payload.prefs||{})};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
    prefs.lastRestoreAt=new Date().toISOString();
    addBackupLog('자동동기화','최신 백업 복원');
    localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
    setStatus('GitHub 최신 백업 복원 완료');
    requestRender();
    return;
   }
  }
  setStatus('동기화 확인 완료 · 현재 데이터가 최신입니다');
 }catch(e){
  if(!auto)setStatus('동기화 확인 실패: '+e.message);
 }
}
function forceUpdate(){
 const base=location.origin+location.pathname;
 location.href=base+'?v=48&t='+Date.now();
}
if($('syncCheckBtn'))$('syncCheckBtn').onclick=()=>checkGithubSync(false);
if($('forceUpdateBtn'))$('forceUpdateBtn').onclick=()=>forceUpdate();
async function clearAppCache(){
 try{
  if('serviceWorker' in navigator){
   const regs=await navigator.serviceWorker.getRegistrations();
   for(const r of regs){await r.unregister();}
  }
  if(window.caches){
   const keys=await caches.keys();
   for(const k of keys){if(k.includes('asset-manager'))await caches.delete(k);}
  }
  setStatus('앱 캐시 정리 완료 · 새로고침 해주세요');
  alert('앱 캐시를 정리했습니다. 페이지를 새로고침하세요.');
 }catch(e){setStatus('캐시 정리 실패: '+e.message);}
}
if($('clearCacheBtn'))$('clearCacheBtn').onclick=()=>clearAppCache();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=53').catch(()=>{});updateAssetPreview();render();if(prefs.autoGithubSync)checkGithubSync(true);autoUpdateFx().then(()=>refreshCryptoPrices(false)).catch(()=>refreshCryptoPrices(false));
