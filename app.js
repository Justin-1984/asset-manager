const STORAGE_KEY = 'asset-manager-v1-1';
const SETTINGS_KEY = 'asset-manager-github-settings';
const COLORS = ['#2563eb','#0f766e','#f59e0b','#7c3aed','#ef4444','#06b6d4','#84cc16','#64748b'];

let state = loadState();
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('ko-KR', { style:'currency', currency:'KRW', maximumFractionDigits:0 }).format(Number(n)||0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function loadState(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) return JSON.parse(saved);
  return { assets: [], debts: [], snapshots: [], updatedAt: new Date().toISOString(), version: '1.1' };
}
function save(){ state.updatedAt = new Date().toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
function amountAsset(a){ return (Number(a.qty)||0) * (Number(a.price)||0); }
function totalAssets(){ return state.assets.reduce((s,a)=>s+amountAsset(a),0); }
function totalDebts(){ return state.debts.reduce((s,d)=>s+(Number(d.amount)||0),0); }
function byType(){ return state.assets.reduce((m,a)=>{ m[a.type]=(m[a.type]||0)+amountAsset(a); return m; },{}); }

function render(){
  $('netWorth').textContent = fmt(totalAssets()-totalDebts());
  $('totalAssets').textContent = fmt(totalAssets());
  $('totalLiabilities').textContent = fmt(totalDebts());
  renderAssets(); renderDebts(); drawPie();
}
function renderAssets(){
  $('assetList').innerHTML = state.assets.length ? state.assets.map(a=>`
    <div class="item">
      <div><div class="name">${escapeHtml(a.name)}</div><div class="meta">${escapeHtml(a.type)} · ${escapeHtml(a.account||'미지정')}</div></div>
      <div class="meta">수량 ${num(a.qty)} × 단가 ${fmt(a.price)}</div>
      <div class="amount">${fmt(amountAsset(a))}</div>
      <button class="danger" onclick="removeAsset('${a.id}')">삭제</button>
    </div>`).join('') : '<p class="note">아직 등록된 자산이 없습니다.</p>';
}
function renderDebts(){
  $('debtList').innerHTML = state.debts.length ? state.debts.map(d=>`
    <div class="item">
      <div><div class="name">${escapeHtml(d.name)}</div><div class="meta">${escapeHtml(d.type)}</div></div>
      <div class="meta">부채 잔액</div>
      <div class="amount">${fmt(d.amount)}</div>
      <button class="danger" onclick="removeDebt('${d.id}')">삭제</button>
    </div>`).join('') : '<p class="note">아직 등록된 부채가 없습니다.</p>';
}
function drawPie(){
  const canvas = $('assetPie'); const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1; const size = 320;
  canvas.width = size*dpr; canvas.height = size*dpr; canvas.style.width=size+'px'; canvas.style.height=size+'px'; ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,size,size);
  const data = Object.entries(byType()).filter(([,v])=>v>0);
  const total = data.reduce((s,[,v])=>s+v,0);
  if(!total){ ctx.fillStyle = getTextColor(); ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.fillText('자산을 입력하면 그래프가 표시됩니다',160,160); $('assetLegend').innerHTML=''; return; }
  let start = -Math.PI/2;
  data.forEach(([name,value],i)=>{ const angle = value/total*Math.PI*2; ctx.beginPath(); ctx.moveTo(160,160); ctx.arc(160,160,120,start,start+angle); ctx.closePath(); ctx.fillStyle=COLORS[i%COLORS.length]; ctx.fill(); start+=angle; });
  ctx.beginPath(); ctx.arc(160,160,66,0,Math.PI*2); ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card'); ctx.fill();
  ctx.fillStyle = getTextColor(); ctx.font='700 15px sans-serif'; ctx.textAlign='center'; ctx.fillText('총자산',160,153); ctx.font='800 18px sans-serif'; ctx.fillText(fmt(totalAssets()).replace('₩','₩ '),160,178);
  $('assetLegend').innerHTML = data.map(([name,value],i)=>`<span class="pill"><b style="color:${COLORS[i%COLORS.length]}">●</b> ${escapeHtml(name)} ${Math.round(value/total*100)}%</span>`).join('');
}
function getTextColor(){ return getComputedStyle(document.body).getPropertyValue('--text').trim(); }
function num(n){ return new Intl.NumberFormat('ko-KR', { maximumFractionDigits:8 }).format(Number(n)||0); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

window.removeAsset = id => { state.assets = state.assets.filter(a=>a.id!==id); save(); };
window.removeDebt = id => { state.debts = state.debts.filter(d=>d.id!==id); save(); };

$('addAssetBtn').onclick = () => $('assetForm').classList.toggle('hidden');
$('addDebtBtn').onclick = () => $('debtForm').classList.toggle('hidden');
$('themeToggle').onclick = () => { document.body.classList.toggle('dark'); localStorage.setItem('asset-manager-theme', document.body.classList.contains('dark')?'dark':'light'); drawPie(); };
if(localStorage.getItem('asset-manager-theme')==='dark') document.body.classList.add('dark');

$('assetForm').onsubmit = e => { e.preventDefault(); state.assets.push({ id:uid(), type:$('assetType').value, account:$('assetAccount').value.trim(), name:$('assetName').value.trim(), qty:Number($('assetQty').value), price:Number($('assetPrice').value) }); e.target.reset(); save(); };
$('debtForm').onsubmit = e => { e.preventDefault(); state.debts.push({ id:uid(), type:$('debtType').value, name:$('debtName').value.trim(), amount:Number($('debtAmount').value) }); e.target.reset(); save(); };

['ghOwner','ghRepo','ghPath','ghToken'].forEach(id=>{ if(settings[id]) $(id).value=settings[id]; });
$('saveSettings').onclick = () => { settings = { ghOwner:$('ghOwner').value.trim(), ghRepo:$('ghRepo').value.trim(), ghPath:$('ghPath').value.trim()||'asset-manager-data.json', ghToken:$('ghToken').value.trim() }; localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); setStatus('GitHub 설정 저장 완료'); };
function setStatus(msg){ $('syncStatus').textContent = msg; }
async function githubRequest(method, body){
  settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const {ghOwner,ghRepo,ghPath,ghToken}=settings;
  if(!ghOwner||!ghRepo||!ghPath||!ghToken) throw new Error('GitHub 설정을 먼저 저장하세요.');
  const url = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${encodeURIComponent(ghPath).replaceAll('%2F','/')}`;
  const headers = { Authorization:`Bearer ${ghToken}`, Accept:'application/vnd.github+json' };
  if(method==='GET') return fetch(url,{headers});
  return fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
$('backupBtn').onclick = async () => { try{ setStatus('백업 준비 중...'); let sha; const r=await githubRequest('GET'); if(r.ok){ const j=await r.json(); sha=j.sha; } const content = btoa(unescape(encodeURIComponent(JSON.stringify(state,null,2)))); const res=await githubRequest('PUT',{message:`asset-manager backup ${new Date().toISOString()}`, content, sha}); if(!res.ok) throw new Error(await res.text()); setStatus('GitHub 백업 완료'); }catch(e){ setStatus('백업 실패: '+e.message); } };
$('restoreBtn').onclick = async () => { try{ setStatus('복원 중...'); const r=await githubRequest('GET'); if(!r.ok) throw new Error(await r.text()); const j=await r.json(); const restored = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,''))))); state = restored; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStatus('GitHub 복원 완료'); render(); }catch(e){ setStatus('복원 실패: '+e.message); } };

if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
render();
