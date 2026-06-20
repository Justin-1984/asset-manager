const STORAGE_KEY='asset-manager-v3-9';
const OLD_KEYS=['asset-manager-v3-8-1','asset-manager-v3-8','asset-manager-v3-6','asset-manager-v3-7','asset-manager-v3-6','asset-manager-v3-5','asset-manager-v3-0','asset-manager-v2-3','asset-manager-v2-2','asset-manager-v2-1','asset-manager-v2-0','asset-manager-v1-5','asset-manager-v1-4','asset-manager-v1-3','asset-manager-v1-2','asset-manager-v1-1'];
const SETTINGS_KEY='asset-manager-github-settings';
const PREFS_KEY='asset-manager-prefs';
const COLORS=['#2563eb','#0f766e','#f59e0b','#7c3aed','#ef4444','#06b6d4','#84cc16','#64748b','#db2777','#14b8a6'];
let state=loadState(), settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'), prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{"usdRate":1380,"usdtRate":1380,"hkdRate":195,"audRate":1080,"goalAmount":0,"fxUpdatedAt":""}');
let assetFilter='전체', barMode='account', assetSearch='', assetSort='amountDesc', editingAssetId=null, editingDebtId=null, editingExchangeId=null;
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const money=n=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(Number(n)||0);
const moneyShort=n=>{n=Math.round(Number(n)||0);const abs=Math.abs(n);if(abs>=100000000)return '₩'+(n/100000000).toFixed(abs>=1000000000?1:2).replace(/\.0+$|0+$/,'')+'억';if(abs>=10000)return '₩'+Math.round(n/10000).toLocaleString('ko-KR')+'만';return money(n);};
const num=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:8}).format(Number(n)||0);

const exchangeCurrencyMap={
  '업비트':'KRW','upbit':'KRW','빗썸':'KRW','bithumb':'KRW','코인원':'KRW','coinone':'KRW',
  '바이낸스':'USDT','binance':'USDT','bingx':'USDT','빙엑스':'USDT','htx':'USDT','후오비':'USDT','huobi':'USDT','okx':'USDT','오케이엑스':'USDT','bybit':'USDT','바이비트':'USDT','bitget':'USDT','비트겟':'USDT','mexc':'USDT','gate':'USDT','gate.io':'USDT','kucoin':'USDT','쿠코인':'USDT',
  '미국주식':'USD','미국':'USD','schwab':'USD','키움':'USD','토스증권':'USD','연금저축':'KRW','isa':'KRW','irp':'KRW',
  '항생':'HKD','hang seng':'HKD','hsbc':'HKD','홍콩':'HKD'
};
function guessCurrencyFromAccount(account){const v=String(account||'').trim().toLowerCase();if(!v)return '';for(const [k,c] of Object.entries(exchangeCurrencyMap)){if(v.includes(k.toLowerCase()))return c;}return '';}
function exchangeNeedsPassphrase(name){return ['OKX','Bitget','Gate.io'].includes(String(name||''));}
function maskKey(v){v=String(v||'');return v? v.slice(0,4)+'••••'+v.slice(-4):'미입력';}
function exchangeStatusLabel(x){return x.apiKey&&x.secret&&x.readOnly?'연결 준비':'미완료';}
function exchangeStatusClass(x){return x.apiKey&&x.secret&&x.readOnly?'plus':'minus';}
function exchangeNeedsPassphrase(name){return ['OKX','Bitget','Gate.io'].includes(String(name||''));}
function updateExchangePassHint(){const el=$('exchangePassphrase');if(!el||!$('exchangeName'))return;const name=$('exchangeName').value;el.placeholder=exchangeNeedsPassphrase(name)?'Passphrase 필수':'Passphrase / UID 필요한 거래소만 입력';}
function updateCurrencyHint(){const guessed=guessCurrencyFromAccount($('assetAccount')?.value);const cur=$('assetCurrency')?.value||'KRW';const el=$('currencyHint');if(!el)return;el.innerHTML=guessed?`감지된 기본통화: <b>${guessed}</b> · 현재 입력통화: <b>${esc(cur.toUpperCase())}</b>`:'기본통화: 업비트/빗썸/코인원=KRW · 바이낸스/OKX/Bybit/Bitget/MEXC/Gate/BingX/HTX=USDT';}

const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function loadState(){let saved=localStorage.getItem(STORAGE_KEY);if(!saved){for(const k of OLD_KEYS){if(localStorage.getItem(k)){saved=localStorage.getItem(k);break;}}} if(saved){try{const s=JSON.parse(saved);return {...{assets:[],debts:[],snapshots:[],exchanges:[]},...s,version:'3.9'};}catch{}} return {version:'3.9',assets:[],debts:[],snapshots:[],exchanges:[],updatedAt:new Date().toISOString()};}
function save(){state.version='3.9';state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();}
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
function refreshFxBoard(){['usdRate','usdtRate','hkdRate','audRate'].forEach(id=>{const el=$(id+'View');if(el)el.textContent=money(Number(prefs[id])||0);const input=$(id);if(input && document.activeElement!==input)input.value=prefs[id]||'';});const t=$('fxUpdatedAtText');if(t)t.textContent=prefs.fxUpdatedAt?`마지막 갱신 ${prefs.fxUpdatedAt}`:'아직 갱신 기록 없음';const st=$('fxAutoStatus');if(st)st.textContent=prefs.fxAutoStatus||'앱 실행 시 자동으로 환율을 조회합니다.';}

async function autoUpdateFx(manual=false){
 const st=$('fxAutoStatus'); const btn=$('refreshFxBtn');
 try{
  if(st)st.textContent=manual?'환율 수동 갱신 중...':'환율 자동조회 중...'; if(btn){btn.disabled=true;btn.textContent='갱신 중...';}
  const res=await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW,HKD,AUD',{cache:'no-store'});
  if(!res.ok)throw new Error('환율 서버 응답 오류');
  const data=await res.json();
  const r=data.rates||{};
  const usdKrw=Number(r.KRW);
  const hkdPerUsd=Number(r.HKD);
  const audPerUsd=Number(r.AUD);
  if(!usdKrw||!hkdPerUsd||!audPerUsd)throw new Error('환율 데이터 부족');
  prefs.usdRate=Math.round(usdKrw*100)/100;
  prefs.usdtRate=Math.round(usdKrw*100)/100;
  prefs.hkdRate=Math.round((usdKrw/hkdPerUsd)*100)/100;
  prefs.audRate=Math.round((usdKrw/audPerUsd)*100)/100;
  prefs.fxUpdatedAt=new Date().toLocaleString('ko-KR');
  prefs.fxAutoStatus=(manual?'수동 환율 갱신 완료':'자동 환율 조회 완료')+' · Frankfurter 기준';
  localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  render();
 }catch(e){
  prefs.fxAutoStatus=(manual?'수동 환율 갱신 실패':'자동 환율 조회 실패')+' · 마지막 저장 환율 사용';
  localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
  if(st)st.textContent=prefs.fxAutoStatus;
 } finally { if(btn){btn.disabled=false;btn.textContent='환율 갱신';} }
}

function totalAssets(){return state.assets.reduce((s,a)=>s+assetAmount(a),0)}
function totalDebts(){return state.debts.reduce((s,d)=>s+debtAmount(d),0)}
function netWorth(){return totalAssets()-totalDebts()}
function groupBy(list,keyFn,valFn){return list.reduce((m,x)=>{const k=keyFn(x)||'미지정';m[k]=(m[k]||0)+valFn(x);return m;},{});}
function byType(){return groupBy(state.assets,a=>a.type,assetAmount)}
function byCrypto(){return groupBy(state.assets.filter(a=>a.type==='코인'),a=>a.name,assetAmount)}
function byAccount(){return groupBy(state.assets,a=>a.account,assetAmount)}
function byCurrency(){return groupBy(state.assets,a=>(a.currency||'KRW').toUpperCase(),assetAmount)}
function barData(){if(barMode==='type')return {title:'자산군별 자산',data:byType()};if(barMode==='currency')return {title:'통화별 자산',data:byCurrency()};return {title:'계좌/거래소별 자산',data:byAccount()};}
function render(){
 refreshFxBoard();
 $('netWorth').textContent=money(netWorth());$('totalAssets').textContent=money(totalAssets());$('totalLiabilities').textContent=money(totalDebts());if($('totalInvestCost'))$('totalInvestCost').textContent=money(totalInvestCost());if($('totalProfit')){$('totalProfit').textContent=signedMoney(totalProfit());$('totalProfit').className=profitClass(totalProfit());}if($('totalProfitPct')){$('totalProfitPct').textContent=signedPct(totalProfitPct());$('totalProfitPct').className=profitClass(totalProfit());}
 const last=state.snapshots[state.snapshots.length-1];const change=last?netWorth()-last.netWorth:0;$('monthChange').textContent=money(change);if($('monthChangePct'))$('monthChangePct').textContent=last&&last.netWorth?((change/Math.abs(last.netWorth))*100).toFixed(1)+'%':'0%';
 const goal=Number(prefs.goalAmount)||0;$('goalText').textContent=goal?`목표 ${money(goal)} · 달성률 ${Math.round(netWorth()/goal*100)}%`:'목표 없음';
 renderAssets();renderDebts();renderExchanges();renderSnapshots();drawPie('assetPie',byType(),'assetLegend','총자산');drawLine();drawPie('cryptoPie',byCrypto(),'cryptoLegend','코인');drawBar();
}
function filteredAssets(){let rows=state.assets.filter(a=>assetFilter==='전체'||a.type===assetFilter);const q=assetSearch.trim().toLowerCase();if(q)rows=rows.filter(a=>[a.type,a.account,a.name,a.currency].some(v=>String(v||'').toLowerCase().includes(q)));return rows.sort((a,b)=>{if(assetSort==='amountAsc')return assetAmount(a)-assetAmount(b);if(assetSort==='nameAsc')return String(a.name).localeCompare(String(b.name),'ko');if(assetSort==='typeAsc')return String(a.type).localeCompare(String(b.type),'ko')||assetAmount(b)-assetAmount(a);return assetAmount(b)-assetAmount(a);});}
function renderAssets(){const rows=filteredAssets();$('assetList').innerHTML=rows.length?rows.map(a=>{const p=assetProfit(a),pct=assetProfitPct(a);const profitHtml=isInvestAsset(a)&&Number(a.costPrice)>0?`<div class="${profitClass(p)}">${signedMoney(p)} (${signedPct(pct)})</div>`:`<div class="meta">손익 미입력</div>`;return `<div class="item"><div><div class="name">${esc(a.name)}</div><div class="meta">${esc(a.type)} · ${esc(a.account||'미지정')}</div></div><div class="meta">현재 ${num(a.qty)} × ${num(a.price)} ${esc(a.currency||'KRW')}<br>${Number(a.costPrice)>0?`평단 ${num(a.costPrice)} ${esc(a.currency||'KRW')}`:`평단 미입력`} · 환율 ${num(fx(a.currency))}</div><div class="amount">${money(assetAmount(a))}${profitHtml}<div class="meta">${a.priceSource?`시세 ${esc(a.priceSource)} · ${esc(a.priceUpdatedAt||'')}`:''}</div></div><button onclick="editAsset('${a.id}')">수정</button><button class="danger" onclick="removeAsset('${a.id}')">삭제</button></div>`}).join(''):`<p class="note">표시할 자산이 없습니다. 검색어나 필터를 확인하세요.</p>`;}
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
function preferredPriceSources(asset){const acct=String(asset.account||'').toLowerCase();const cur=String(asset.currency||'').toUpperCase();if(cur==='KRW'||/upbit|업비트|bithumb|빗썸|coinone|코인원/.test(acct))return ['upbit','binance','okx','bybit','bitget','gate','htx','bingx'];if(/okx|오케이엑스/.test(acct))return ['okx','binance','bybit','bitget','gate','htx','bingx','upbit'];if(/bybit|바이비트/.test(acct))return ['bybit','binance','okx','bitget','gate','htx','bingx','upbit'];if(/bitget|비트겟/.test(acct))return ['bitget','binance','okx','bybit','gate','htx','bingx','upbit'];if(/gate/.test(acct))return ['gate','binance','okx','bybit','bitget','htx','bingx','upbit'];if(/htx|huobi|후오비/.test(acct))return ['htx','binance','okx','bybit','bitget','gate','bingx','upbit'];if(/bingx|빙엑스/.test(acct))return ['bingx','binance','okx','bybit','bitget','gate','htx','upbit'];return ['binance','okx','bybit','bitget','gate','htx','bingx','upbit'];}
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
async function refreshCryptoPrices(manual=false){
 const assets=state.assets.filter(a=>a.type==='코인'&&cleanCoinSymbol(a.name));
 const btn=$('refreshPricesBtn'); const st=$('priceAutoStatus')||$('fxAutoStatus');
 if(!assets.length){alert('시세를 조회할 코인 자산이 없습니다. 먼저 코인을 추가해 주세요.');return;}
 let ok=0,fail=[]; if(btn){btn.disabled=true;btn.textContent='시세 갱신 중...';} if(st)st.textContent='보유 코인 시세 조회 중...';
 for(const a of assets){try{const t=await fetchCryptoPriceForAsset(a);a.price=t.price;a.currency=t.currency;a.priceSource=t.source;a.priceUpdatedAt=new Date().toLocaleString('ko-KR');ok++;}catch(e){fail.push(`${a.name}: ${e.message}`);}}
 state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 prefs.priceUpdatedAt=new Date().toLocaleString('ko-KR');prefs.priceAutoStatus=`코인 시세 갱신 ${ok}개 완료${fail.length?` · 실패 ${fail.length}개`:''}`;localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));
 if(btn){btn.disabled=false;btn.textContent='전체 시세 갱신';} render(); if(manual&&fail.length)alert('일부 시세 조회 실패\n'+fail.slice(0,8).join('\n'));
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
function resetExchangeForm(){editingExchangeId=null;if(!$('exchangeForm'))return;$('exchangeSubmitBtn').textContent='저장';$('exchangeCancelBtn').classList.add('hidden');$('exchangeForm').reset();$('exchangeReadOnly').checked=true;if($('exchangeWorkerUrl'))$('exchangeWorkerUrl').value='';updateExchangePassHint();}
window.editDebt=id=>{const d=state.debts.find(x=>x.id===id);if(!d)return;editingDebtId=id;$('debtForm').classList.remove('hidden');$('debtSubmitBtn').textContent='수정 저장';$('debtCancelBtn').classList.remove('hidden');$('debtType').value=d.type;$('debtName').value=d.name;$('debtCurrency').value=d.currency||'KRW';$('debtAmount').value=d.amount;$('debtRate').value=d.rate||'';window.scrollTo({top:$('debts').offsetTop,behavior:'smooth'});};
$('addAssetBtn').onclick=()=>{$('assetForm').classList.toggle('hidden');if(!$('assetForm').classList.contains('hidden'))resetAssetForm();};$('addDebtBtn').onclick=()=>{$('debtForm').classList.toggle('hidden');if(!$('debtForm').classList.contains('hidden'))resetDebtForm();};$('assetCancelBtn').onclick=resetAssetForm;$('debtCancelBtn').onclick=resetDebtForm;
if($('addExchangeBtn'))$('addExchangeBtn').onclick=()=>{$('exchangeForm').classList.toggle('hidden');if(!$('exchangeForm').classList.contains('hidden'))resetExchangeForm();};if($('exchangeCancelBtn'))$('exchangeCancelBtn').onclick=resetExchangeForm;if($('exchangeName'))$('exchangeName').onchange=updateExchangePassHint;

['assetCurrency','assetQty','assetPrice','assetCostPrice','assetAccount'].forEach(id=>{if($(id))$(id).addEventListener('input',()=>{if(id==='assetAccount'&&$('assetType').value==='코인'&&foreignExchange($('assetAccount').value)&&!editingAssetId){$('assetCurrency').value='USDT';}updateAssetPreview();});});
if($('assetType'))$('assetType').addEventListener('change',()=>{if($('assetType').value==='코인'&&foreignExchange($('assetAccount').value))$('assetCurrency').value='USDT';updateAssetPreview();});
if($('assetAccount'))$('assetAccount').addEventListener('blur',()=>{const guessed=guessCurrencyFromAccount($('assetAccount').value);if(guessed && (!$('assetCurrency').value || $('assetCurrency').value==='KRW')){$('assetCurrency').value=guessed;}updateAssetPreview();});
$('assetForm').onsubmit=e=>{e.preventDefault();const item={id:editingAssetId||uid(),type:$('assetType').value,account:$('assetAccount').value.trim(),name:$('assetName').value.trim(),currency:$('assetCurrency').value.trim().toUpperCase()||'KRW',qty:Number($('assetQty').value),price:Number($('assetPrice').value),costPrice:Number($('assetCostPrice')?.value)||0};if(editingAssetId){state.assets=state.assets.map(a=>a.id===editingAssetId?item:a);}else state.assets.push(item);resetAssetForm();save();};
$('debtForm').onsubmit=e=>{e.preventDefault();const item={id:editingDebtId||uid(),type:$('debtType').value,name:$('debtName').value.trim(),currency:$('debtCurrency').value.trim().toUpperCase()||'KRW',amount:Number($('debtAmount').value),rate:$('debtRate').value};if(editingDebtId){state.debts=state.debts.map(d=>d.id===editingDebtId?item:d);}else state.debts.push(item);resetDebtForm();save();};
if($('exchangeForm'))$('exchangeForm').onsubmit=e=>{e.preventDefault();state.exchanges=state.exchanges||[];const item={id:editingExchangeId||uid(),name:$('exchangeName').value,apiKey:$('exchangeApiKey').value.trim(),secret:$('exchangeSecret').value.trim(),passphrase:$('exchangePassphrase').value.trim(),workerUrl:($('exchangeWorkerUrl')?.value||'').trim(),readOnly:$('exchangeReadOnly').checked,lastSync:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastSync||'',lastPublicTest:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastPublicTest||''};if(!item.readOnly){alert('안전을 위해 조회 전용 권한 확인이 필요합니다. 거래/출금 권한은 절대 켜지 마세요.');return;}if(editingExchangeId){state.exchanges=state.exchanges.map(x=>x.id===editingExchangeId?item:x);}else state.exchanges.push(item);resetExchangeForm();save();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if($('exchangeForm'))$('exchangeForm').onsubmit=e=>{e.preventDefault();state.exchanges=state.exchanges||[];const item={id:editingExchangeId||uid(),name:$('exchangeName').value,apiKey:$('exchangeApiKey').value.trim(),secret:$('exchangeSecret').value.trim(),passphrase:$('exchangePassphrase').value.trim(),workerUrl:($('exchangeWorkerUrl')?.value||'').trim(),readOnly:$('exchangeReadOnly').checked,lastSync:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastSync||'',lastPublicTest:(state.exchanges.find(x=>x.id===editingExchangeId)||{}).lastPublicTest||''};if(!item.readOnly){alert('안전을 위해 조회 전용 권한 확인이 필요합니다. 거래/출금 권한은 절대 켜지 마세요.');return;}if(editingExchangeId){state.exchanges=state.exchanges.map(x=>x.id===editingExchangeId?item:x);}else state.exchanges.push(item);resetExchangeForm();save();};
document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active');render();});
document.querySelectorAll('[data-asset-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-asset-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');assetFilter=b.dataset.assetFilter;renderAssets();});
if($('assetSearch'))$('assetSearch').oninput=e=>{assetSearch=e.target.value;renderAssets();};if($('assetSort'))$('assetSort').onchange=e=>{assetSort=e.target.value;renderAssets();};
document.querySelectorAll('[data-bar-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-bar-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');barMode=b.dataset.barMode;drawBar();});
$('themeToggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('asset-manager-theme',document.body.classList.contains('dark')?'dark':'light');render();};if(localStorage.getItem('asset-manager-theme')==='dark')document.body.classList.add('dark');
$('snapshotBtn').onclick=()=>{const today=new Date().toLocaleDateString('ko-KR');const snap={date:today,assets:totalAssets(),debts:totalDebts(),netWorth:netWorth()};const same=state.snapshots.findIndex(s=>s.date===today);if(same>=0)state.snapshots[same]=snap;else state.snapshots.push(snap);save();};$('clearSnapshotsBtn').onclick=()=>{if(confirm('순자산 추이를 초기화할까요?')){state.snapshots=[];save();}};
['goalAmount','usdRate','usdtRate','hkdRate','audRate'].forEach(id=>{if($(id))$(id).value=prefs[id]||''});$('savePrefs').onclick=()=>{prefs={goalAmount:Number($('goalAmount').value)||0,usdRate:Number($('usdRate').value)||1380,usdtRate:Number($('usdtRate').value)||Number($('usdRate').value)||1380,hkdRate:Number($('hkdRate').value)||195,audRate:Number($('audRate').value)||1080,fxUpdatedAt:new Date().toLocaleString('ko-KR')};localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));render();setStatus('환율/목표 설정 저장 완료');prefs.fxAutoStatus='수동 환율 저장 완료';localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));};
['ghOwner','ghRepo','ghPath','ghToken'].forEach(id=>{if(settings[id])$(id).value=settings[id]});$('saveSettings').onclick=()=>{settings={ghOwner:$('ghOwner').value.trim(),ghRepo:$('ghRepo').value.trim(),ghPath:$('ghPath').value.trim()||'asset-manager-data.json',ghToken:$('ghToken').value.trim()};localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setStatus('GitHub 설정 저장 완료');};function setStatus(m){$('syncStatus').textContent=m;}
async function gh(method,body){settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');const{ghOwner,ghRepo,ghPath,ghToken}=settings;if(!ghOwner||!ghRepo||!ghPath||!ghToken)throw new Error('GitHub 설정을 먼저 저장하세요.');const url=`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${encodeURIComponent(ghPath).replaceAll('%2F','/')}`;const headers={Authorization:`Bearer ${ghToken}`,Accept:'application/vnd.github+json'};return method==='GET'?fetch(url,{headers}):fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});}
$('backupBtn').onclick=async()=>{try{setStatus('백업 중...');let sha;const r=await gh('GET');if(r.ok)sha=(await r.json()).sha;const payload={state,prefs,backupAt:new Date().toISOString()};const content=btoa(unescape(encodeURIComponent(JSON.stringify(payload,null,2))));const res=await gh('PUT',{message:`asset-manager backup ${new Date().toISOString()}`,content,sha});if(!res.ok)throw new Error(await res.text());setStatus('GitHub 백업 완료');}catch(e){setStatus('백업 실패: '+e.message)}};
$('restoreBtn').onclick=async()=>{try{setStatus('복원 중...');const r=await gh('GET');if(!r.ok)throw new Error(await r.text());const j=await r.json();const payload=JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,'')))));state=payload.state||payload;prefs=payload.prefs||prefs;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));setStatus('GitHub 복원 완료');render();}catch(e){setStatus('복원 실패: '+e.message)}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({state,prefs},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='asset-manager-backup.json';a.click();URL.revokeObjectURL(a.href);};
if($('refreshPricesBtn'))$('refreshPricesBtn').onclick=()=>refreshCryptoPrices(true);
$('importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result);state=p.state||p;prefs=p.prefs||prefs;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));setStatus('파일 가져오기 완료');render();}catch(err){setStatus('가져오기 실패: '+err.message)}};reader.readAsText(f);};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=3.9').catch(()=>{});updateAssetPreview();render();autoUpdateFx().then(()=>refreshCryptoPrices(false)).catch(()=>refreshCryptoPrices(false));
