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

// Some value types aren't stored per-pet — they're just a source's "baseless"
// value (both-potions/FR tier value) divided by a fixed reference pet's own
// baseless value, rounded to 2 decimals (confirmed against the live site).
// Computed live so values.json only ever has to carry the raw baseless matrix.
const DERIVED_VALUE_TYPES={
  amvgg:{
    frost:1.65,        // Frost Dragon's regular/both baseless value on AMVGG
    ridepotion:0.0064936 // Ride-A-Pet Potion's true regular/both baseless value on AMVGG,
    // least-squares fit from 12 known site values (displayed as "0.0065", itself rounded)
  }
};
function round2(n){ return Math.round(n*100)/100; }
function potionFor(ride,fly){ return ride&&fly?'both':fly?'fly':ride?'ride':'none'; }
// tier: 'regular'|'neon'|'mega'. potion: 'both'|'fly'|'ride'|'none' (default 'both'/FR).
function valueForCombo(p,tier,potion){
  const src=p.sources&&p.sources[currentSource];
  if(!src) return null;
  const derived=DERIVED_VALUE_TYPES[currentSource];
  const divisor=derived&&derived[currentValueType];
  if(divisor!=null){
    const base=src.baseless&&src.baseless[tier]&&src.baseless[tier][potion||'both'];
    return base==null?null:round2(base/divisor);
  }
  const vt=src[currentValueType];
  const t=vt&&vt[tier];
  return t?(t[potion||'both']??null):null;
}
function valueForVariant(p,variant){ return valueForCombo(p,variant,'both'); }
function valueFor(p){ return valueForVariant(p,currentVariant); }

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
  grid.innerHTML=list.map(p=>`<div class="pv-item" onclick="openAttrPanel('${encodeURIComponent(p.name)}',null)">
    ${petImgHtml(p.rarity,p.name)}
    <div class="pet-name">${p.name}</div>
    <span class="rarity-dot ${RARITY_COLOR[p.rarity]||'r-unknown'}"></span>
    <span class="rarity-label">${RARITY_LABEL[p.rarity]||p.rarity}</span>
    <span class="pv-value">${formatValue(valueFor(p))}</span>
  </div>`).join('');
  observeImages(grid);
}

// ── CALCULATOR TAB ───────────────────────────────────────────────
// "Add a pet" popup: category sidebar + search, opened from a side's "+" slot.
const PV_CATEGORIES=[
  {id:'all',label:'All'},
  {id:'pets',label:'Pets'},
  {id:'eggs',label:'Eggs'},
  {id:'petwear',label:'Pet Wear'},
  {id:'food',label:'Food'},
  {id:'toys',label:'Toys'},
  {id:'vehicles',label:'Vehicles'},
  {id:'strollers',label:'Strollers'},
  {id:'gifts',label:'Gifts'},
  {id:'stickers',label:'Stickers'},
  {id:'houses',label:'Houses'}
];
let addModalSide=null;
let addCategory='all';

function openAddModal(side){
  addModalSide=side;
  addCategory='all';
  document.getElementById('pv-add-search').value='';
  document.getElementById('pv-add-overlay').classList.add('open');
  renderAddCategories();
  renderAddResults();
  setTimeout(()=>document.getElementById('pv-add-search').focus(),50);
}
function closeAddModal(){
  document.getElementById('pv-add-overlay').classList.remove('open');
  addModalSide=null;
}
function setAddCategory(id){
  addCategory=id;
  renderAddCategories();
  renderAddResults();
}
function renderAddCategories(){
  document.getElementById('pv-add-categories').innerHTML=PV_CATEGORIES.map(c=>
    `<button class="pv-add-cat-btn${c.id===addCategory?' active':''}" onclick="setAddCategory('${c.id}')">${c.label}</button>`
  ).join('');
}
function renderAddResults(){
  const grid=document.getElementById('pv-add-results');
  if(addCategory!=='all'&&addCategory!=='pets'){
    grid.innerHTML='<div class="pv-add-placeholder">Coming soon</div>';
    return;
  }
  const q=document.getElementById('pv-add-search').value.trim().toLowerCase();
  let list=VALUES;
  if(q) list=list.filter(p=>p.name.toLowerCase().includes(q));
  if(!list.length){ grid.innerHTML='<div class="pv-add-placeholder">No matches</div>'; return; }
  grid.innerHTML=list.slice(0,120).map(p=>`<div class="pv-add-result-item" onclick="openAttrPanel('${encodeURIComponent(p.name)}','${addModalSide}')">
    ${petImgHtml(p.rarity,p.name)}
    <div class="pet-name">${p.name}</div>
    <span class="pv-value">${formatValue(valueFor(p))}</span>
  </div>`).join('');
  observeImages(grid);
}
document.getElementById('pv-add-overlay').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeAddModal(); });

// ── PET ATTRIBUTES PANEL (Neon/Mega Neon/Ride/Fly) ─────────────────
// Ride/Fly are tags only for now — no pricing data found for them on AMVGG,
// so they don't affect the shown/added value yet.
let attrPet=null;
let attrTarget=null; // 'you'|'them' if opened from that side's add popup, else null (Values tab)
let attrVariant='regular';
let attrRide=false;
let attrFly=false;

function openAttrPanel(encodedName,target){
  const name=decodeURIComponent(encodedName);
  const p=VALUES.find(v=>v.name===name);
  if(!p)return;
  attrPet=p;
  attrTarget=target||null;
  attrVariant='regular';
  attrRide=false;
  attrFly=false;
  renderAttrPanel();
  document.getElementById('pv-attr-overlay').classList.add('open');
}
function closeAttrPanel(){
  document.getElementById('pv-attr-overlay').classList.remove('open');
  attrPet=null;
}
function setAttrVariant(v){ attrVariant=v; renderAttrPanel(); }
function toggleAttrRide(){ attrRide=!attrRide; renderAttrPanel(); }
function toggleAttrFly(){ attrFly=!attrFly; renderAttrPanel(); }
function renderAttrPanel(){
  if(!attrPet)return;
  const val=valueForCombo(attrPet,attrVariant,potionFor(attrRide,attrFly));
  const actions=attrTarget
    ? `<button onclick="confirmAttrAdd('${attrTarget}')">Add to ${attrTarget==='you'?'Your':'Their'} Side</button>`
    : `<button onclick="confirmAttrAdd('you')">Add to Your Side</button><button onclick="confirmAttrAdd('them')">Add to Their Side</button>`;
  document.getElementById('pv-attr-body').innerHTML=`
    <div class="pv-attr-head">
      ${petImgHtml(attrPet.rarity,attrPet.name)}
      <div class="pv-attr-name">${attrPet.name}</div>
    </div>
    <div class="pv-attr-tier pv-variant-toggle">
      <button class="pv-variant-btn${attrVariant==='regular'?' active':''}" onclick="setAttrVariant('regular')">Normal</button>
      <button class="pv-variant-btn${attrVariant==='neon'?' active':''}" onclick="setAttrVariant('neon')">Neon</button>
      <button class="pv-variant-btn${attrVariant==='mega'?' active':''}" onclick="setAttrVariant('mega')">Mega Neon</button>
    </div>
    <div class="pv-attr-toggles">
      <button class="pv-attr-chip${attrRide?' active':''}" onclick="toggleAttrRide()">🐴 Ride</button>
      <button class="pv-attr-chip${attrFly?' active':''}" onclick="toggleAttrFly()">🪽 Fly</button>
    </div>
    <div class="pv-attr-value">${formatValue(val)}</div>
    <div class="pv-attr-actions">${actions}</div>
  `;
  observeImages(document.getElementById('pv-attr-body'));
}
document.getElementById('pv-attr-overlay').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeAttrPanel(); });

function confirmAttrAdd(side){
  if(!attrPet)return;
  calcSides[side].push({pet:attrPet,variant:attrVariant,ride:attrRide,fly:attrFly});
  closeAttrPanel();
  document.getElementById('pv-total-'+side).textContent=formatValue(sideTotal(side));
  renderCalcItems(side);
  renderFairness();
}

function removeFromSide(side,idx){
  calcSides[side].splice(idx,1);
  renderCalculatorTab();
}

function clearSide(side){
  if(!calcSides[side].length)return;
  openConfirmModal('Clear side','Remove all pets from this side?',()=>{ calcSides[side]=[]; renderCalculatorTab(); });
}

function sideTotal(side){ return calcSides[side].reduce((s,item)=>s+(valueForCombo(item.pet,item.variant,potionFor(item.ride,item.fly))||0),0); }

const PV_MIN_SLOTS=6;
function renderCalcItems(side){
  const el=document.getElementById('pv-items-'+side);
  const items=calcSides[side];
  const addSlot=`<div class="pv-calc-slot pv-add-slot">
    <button class="pv-add-btn" onclick="openAddModal('${side}')" title="Add a pet">+</button>
  </div>`;
  const filled=items.map((item,i)=>{
    const badges=[];
    if(item.variant==='neon') badges.push({letter:'N',shape:'circle',cls:'pv-tag-n'});
    if(item.variant==='mega') badges.push({letter:'M',shape:'circle',cls:'pv-tag-m'});
    if(item.fly) badges.push({letter:'F',shape:'square',cls:'pv-tag-f'});
    if(item.ride) badges.push({letter:'R',shape:'square',cls:'pv-tag-r'});
    const wrapCls=badges.length>1?'pv-tags-bar':'pv-tags-single';
    const tags=badges.length?`<div class="pv-slot-tags ${wrapCls}">${badges.map(b=>`<span class="pv-tag-badge pv-tag-${b.shape} ${b.cls}">${b.letter}</span>`).join('')}</div>`:'';
    return `<div class="pv-calc-slot" title="${item.pet.name}">
      ${petImgHtml(item.pet.rarity,item.pet.name)}
      <span class="pv-slot-value">${formatValue(valueForCombo(item.pet,item.variant,potionFor(item.ride,item.fly)))}</span>
      ${tags}
      <button class="pv-slot-remove" onclick="removeFromSide('${side}',${i})">✕</button>
    </div>`;
  }).join('');
  const emptyCount=Math.max(0,PV_MIN_SLOTS-1-items.length);
  const empty='<div class="pv-calc-slot pv-slot-empty"></div>'.repeat(emptyCount);
  el.innerHTML=addSlot+filled+empty;
  observeImages(el);
}

function renderFairness(){
  const you=sideTotal('you'),them=sideTotal('them');
  const el=document.getElementById('pv-fairness');
  if(!you&&!them){ el.innerHTML='<span class="pv-fair-arrow">⇄</span><span class="pv-fair-badge pv-fair-even">Add pets to compare</span>'; return; }
  const diff=you-them;
  const pct=Math.abs(diff)/Math.max(you,them,1);
  let cls='pv-fair-even';
  if(pct>=0.35) cls='pv-fair-skewed';
  else if(pct>=0.1) cls='pv-fair-mild';
  const sign=diff>0?'+':diff<0?'−':'';
  const text=`${sign}${formatValue(Math.abs(diff))}`;
  el.innerHTML=`<span class="pv-fair-arrow">⇄</span><span class="pv-fair-badge ${cls} pv-fair-number">${text}</span>`;
}

function renderCalculatorTab(){
  document.getElementById('pv-total-you').textContent=formatValue(sideTotal('you'));
  document.getElementById('pv-total-them').textContent=formatValue(sideTotal('them'));
  renderCalcItems('you');
  renderCalcItems('them');
  renderFairness();
}

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
