// ── STATE ─────────────────────────────────────────────────────────
let VALUES=[];
let SOURCES=[];
let currentSource=null;
let currentValueType=null; // depends on currentSource, e.g. 'baseless'/'frost'/'ridepotion' or 'frost'/'shark'
let currentVariant='regular'; // 'regular' | 'neon' | 'mega'
let sourceDropdownOpen=false;
let valueTypeDropdownOpen=false;
let pvView='values';
let calcSides={you:[],them:[]};

function formatValue(n){ return n==null?'—':n.toLocaleString('en-US',{maximumFractionDigits:4}); }
function currentSourceObj(){ return SOURCES.find(s=>s.id===currentSource); }
function valueTypesFor(sourceId){ const s=SOURCES.find(s=>s.id===sourceId); return (s&&s.valueTypes)||[]; }
function valueFor(p){
  const src=p.sources&&p.sources[currentSource];
  const vt=src&&src[currentValueType];
  return vt?(vt[currentVariant]??null):null;
}

// ── VALUE SOURCE + VALUE-TYPE SWITCHERS ───────────────────────────
function renderSourceBar(){
  const src=currentSourceObj();
  document.getElementById('source-toggle-label').textContent=src?src.label:'—';
  document.getElementById('source-toggle').classList.toggle('open',sourceDropdownOpen);
  const dd=document.getElementById('source-dropdown');
  dd.classList.toggle('open',sourceDropdownOpen);
  dd.innerHTML=SOURCES.map(s=>`<button class="sf-chip${s.id===currentSource?' active':''}" onclick="event.stopPropagation();setSource('${s.id}')">${s.label}</button>`).join('');

  const types=valueTypesFor(currentSource);
  const vt=types.find(t=>t.id===currentValueType);
  document.getElementById('valuetype-toggle-label').textContent=vt?vt.label:'—';
  document.getElementById('valuetype-toggle').classList.toggle('open',valueTypeDropdownOpen);
  const vdd=document.getElementById('valuetype-dropdown');
  vdd.classList.toggle('open',valueTypeDropdownOpen);
  vdd.innerHTML=types.map(t=>`<button class="sf-chip${t.id===currentValueType?' active':''}" onclick="event.stopPropagation();setValueType('${t.id}')">${t.label}</button>`).join('');

  document.querySelectorAll('.pv-variant-btn').forEach(b=>b.classList.toggle('active',b.dataset.variant===currentVariant));
}
function toggleSourceDropdown(e){ e.stopPropagation(); sourceDropdownOpen=!sourceDropdownOpen; valueTypeDropdownOpen=false; renderSourceBar(); }
function toggleValueTypeDropdown(e){ e.stopPropagation(); valueTypeDropdownOpen=!valueTypeDropdownOpen; sourceDropdownOpen=false; renderSourceBar(); }
function setSource(id){
  currentSource=id;
  sourceDropdownOpen=false;
  localStorage.setItem('ami_value_source',id);
  const types=valueTypesFor(id);
  if(!types.some(t=>t.id===currentValueType)) currentValueType=types[0]&&types[0].id;
  renderSourceBar();
  renderCurrentView();
}
function setValueType(id){
  currentValueType=id;
  valueTypeDropdownOpen=false;
  localStorage.setItem('ami_value_type',id);
  renderSourceBar();
  renderCurrentView();
}
function setVariant(v){
  currentVariant=v;
  localStorage.setItem('ami_value_variant',v);
  renderSourceBar();
  renderCurrentView();
}
document.addEventListener('click',()=>{
  if(sourceDropdownOpen||valueTypeDropdownOpen){ sourceDropdownOpen=false; valueTypeDropdownOpen=false; renderSourceBar(); }
});

// ── VIEW ─────────────────────────────────────────────────────────
function switchView(view){
  pvView=view;
  document.querySelectorAll('.view-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
  document.getElementById('view-values').style.display=view==='values'?'':'none';
  document.getElementById('view-calculator').style.display=view==='calculator'?'':'none';
  document.querySelector('.pv-controls').style.display=view==='values'?'':'none';
  renderCurrentView();
}

function renderCurrentView(){
  if(pvView==='values') renderValuesTab();
  else renderCalculatorTab();
}
window.onHeaderSearch=renderCurrentView;

// ── VALUES TAB ───────────────────────────────────────────────────
function renderValuesTab(){
  const search=document.getElementById('search').value.toLowerCase();
  const rarityFilter=document.getElementById('pv-rarity-filter').value;
  const sort=document.getElementById('pv-sort').value;
  let list=VALUES.filter(p=>{
    if(rarityFilter!=='all'&&p.rarity!==rarityFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search))return false;
    return true;
  });
  list=[...list];
  if(sort==='value-desc') list.sort((a,b)=>(valueFor(b)??-1)-(valueFor(a)??-1));
  else if(sort==='value-asc') list.sort((a,b)=>(valueFor(a)??Infinity)-(valueFor(b)??Infinity));
  else if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  else if(sort==='rarity') list.sort((a,b)=>RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity)||a.name.localeCompare(b.name));

  const grid=document.getElementById('pv-grid');
  if(!list.length){ grid.innerHTML='<div class="no-results">No pets found.</div>'; return; }
  grid.innerHTML=list.map(p=>`<div class="pv-item">
    ${petImgHtml(p.rarity,p.name)}
    <div class="pet-name">${p.name}</div>
    <span class="rarity-dot ${RARITY_COLOR[p.rarity]||'r-unknown'}"></span>
    <span class="rarity-label">${RARITY_LABEL[p.rarity]||p.rarity}</span>
    <span class="pv-value">${formatValue(valueFor(p))}</span>
  </div>`).join('');
  observeImages(grid);
}

// ── CALCULATOR TAB ───────────────────────────────────────────────
function renderPicker(side){
  const q=document.getElementById('pv-search-'+side).value.trim().toLowerCase();
  const list=document.getElementById('pv-picker-'+side);
  if(!q){ list.classList.remove('open'); list.innerHTML=''; return; }
  const matches=VALUES.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){ list.innerHTML='<div class="pv-calc-empty">No matches</div>'; list.classList.add('open'); return; }
  list.innerHTML=matches.map(p=>`<div class="pv-pick-row" onclick="addToSide('${side}','${encodeURIComponent(p.name)}')"><span class="pv-pick-name">${p.name}</span><span class="pv-pick-value">${formatValue(valueFor(p))}</span></div>`).join('');
  list.classList.add('open');
}

function addToSide(side,encodedName){
  const name=decodeURIComponent(encodedName);
  const p=VALUES.find(v=>v.name===name);
  if(!p)return;
  calcSides[side].push(p);
  document.getElementById('pv-search-'+side).value='';
  document.getElementById('pv-picker-'+side).classList.remove('open');
  document.getElementById('pv-picker-'+side).innerHTML='';
  renderCalculatorTab();
}

function removeFromSide(side,idx){
  calcSides[side].splice(idx,1);
  renderCalculatorTab();
}

function clearSide(side){
  if(!calcSides[side].length)return;
  openConfirmModal('Clear side','Remove all pets from this side?',()=>{ calcSides[side]=[]; renderCalculatorTab(); });
}

function sideTotal(side){ return calcSides[side].reduce((s,p)=>s+(valueFor(p)||0),0); }

function renderCalcItems(side){
  const el=document.getElementById('pv-items-'+side);
  if(!calcSides[side].length){ el.innerHTML='<div class="pv-calc-empty">No pets added yet</div>'; return; }
  el.innerHTML=calcSides[side].map((p,i)=>`<div class="pv-calc-item">
    <span class="pv-item-name">${p.name}</span>
    <span class="pv-item-value">${formatValue(valueFor(p))}</span>
    <button class="pv-item-remove" onclick="removeFromSide('${side}',${i})">✕</button>
  </div>`).join('');
}

function renderFairness(){
  const you=sideTotal('you'),them=sideTotal('them');
  const el=document.getElementById('pv-fairness');
  if(!you&&!them){ el.innerHTML='<span class="pv-fair-arrow">⇄</span><span class="pv-fair-badge pv-fair-even">Add pets to compare</span>'; return; }
  const diff=you-them;
  const pct=Math.abs(diff)/Math.max(you,them,1);
  let cls='pv-fair-even',text='Fair trade';
  if(pct>=0.35){ cls='pv-fair-skewed'; text=diff>0?`Your side is worth ${formatValue(diff)} more`:`Their side is worth ${formatValue(-diff)} more`; }
  else if(pct>=0.1){ cls='pv-fair-mild'; text=diff>0?`Your side is worth ${formatValue(diff)} more`:`Their side is worth ${formatValue(-diff)} more`; }
  el.innerHTML=`<span class="pv-fair-arrow">⇄</span><span class="pv-fair-badge ${cls}">${text}</span>`;
}

function renderCalculatorTab(){
  document.getElementById('pv-total-you').textContent=formatValue(sideTotal('you'));
  document.getElementById('pv-total-them').textContent=formatValue(sideTotal('them'));
  renderCalcItems('you');
  renderCalcItems('them');
  renderFairness();
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.pv-calc-picker')){
    document.querySelectorAll('.pv-calc-picker-list.open').forEach(l=>l.classList.remove('open'));
  }
});

// ── DATA LOADING ──────────────────────────────────────────────────
async function loadValues(){
  try{
    const res=await fetch('values.json');
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    VALUES=data.pets||[];
    SOURCES=data.sources||[];
    const saved=localStorage.getItem('ami_value_source');
    currentSource=(saved&&SOURCES.some(s=>s.id===saved))?saved:(SOURCES[0]&&SOURCES[0].id);
    const types=valueTypesFor(currentSource);
    const savedType=localStorage.getItem('ami_value_type');
    currentValueType=(savedType&&types.some(t=>t.id===savedType))?savedType:(types[0]&&types[0].id);
    const savedVariant=localStorage.getItem('ami_value_variant');
    if(savedVariant==='regular'||savedVariant==='neon'||savedVariant==='mega') currentVariant=savedVariant;
    renderSourceBar();
    renderCurrentView();
  }catch(e){
    document.getElementById('pv-grid').innerHTML=`<div class="no-results">⚠️ Could not load values.json.<br><small>${e.message}</small></div>`;
  }
}

loadValues();
