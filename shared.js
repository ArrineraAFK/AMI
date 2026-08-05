const RARITY_ORDER    = ['common','uncommon','rare','ultrarare','legendary'];
const RARITY_LABEL    = {common:'Common',uncommon:'Uncommon',rare:'Rare',ultrarare:'Ultra-Rare',legendary:'Legendary',unknown:'Unknown'};
const RARITY_COLOR    = {common:'r-common',uncommon:'r-uncommon',rare:'r-rare',ultrarare:'r-ultrarare',legendary:'r-legendary',unknown:'r-unknown'};
const RARITY_EMOJI    = {common:'⚪',uncommon:'🟢',rare:'🔵',ultrarare:'🟣',legendary:'🟠',unknown:'⚫'};
const RARITY_DOT_COLOR= {common:'#888',uncommon:'#2d9e5f',rare:'#185FA5',ultrarare:'#7F77DD',legendary:'#D85A30'};

// ── DARK MODE ─────────────────────────────────────────────────────
function toggleDark(){
  const dark=document.body.classList.toggle('dark');
  localStorage.setItem('ami_dark',dark?'1':'');
  document.getElementById('dark-btn').textContent=dark?'☀️':'🌙';
}
if(localStorage.getItem('ami_dark')){
  document.body.classList.add('dark');
  document.getElementById('dark-btn').textContent='☀️';
}

// ── SEARCH BAR (sticky + collapsible) ───────────────────────────────
// Each page defines window.onHeaderSearch to re-render itself on input.
function updateSearchToggleIndicator(){
  document.getElementById('search-toggle-btn').classList.toggle('has-value',!!document.getElementById('search').value);
}
function onSearchInput(){ updateSearchToggleIndicator(); window.onHeaderSearch&&window.onHeaderSearch(); }
function toggleSearchBar(){
  const wrap=document.getElementById('header-search-wrap');
  const collapsed=wrap.classList.toggle('collapsed');
  document.getElementById('search-toggle-chevron').classList.toggle('open',!collapsed);
  localStorage.setItem('ami_search_collapsed',collapsed?'1':'');
  if(!collapsed) document.getElementById('search').focus();
}
if(localStorage.getItem('ami_search_collapsed')){
  document.getElementById('header-search-wrap').classList.add('collapsed');
}else{
  document.getElementById('search-toggle-chevron').classList.add('open');
}
updateSearchToggleIndicator();

// ── SCROLL TO TOP ─────────────────────────────────────────────────
window.addEventListener('scroll',()=>{
  document.getElementById('scroll-top').classList.toggle('visible',window.scrollY>300);
});

// ── HAPTIC ───────────────────────────────────────────────────────
function haptic(){ try{ navigator.vibrate&&navigator.vibrate(8); }catch(e){} }

// ── IMAGES ───────────────────────────────────────────────────────
function imgPath(rarity,petName){
  const file=petName.toLowerCase().replace(/['']/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  return `img/${rarity}/${file}.png`;
}

function loadImg(img){
  if(img.dataset.loaded)return;
  img.dataset.loaded='1';
  const placeholder=img.previousElementSibling;
  const show=()=>{
    img.classList.add('loaded');
    if(placeholder){
      placeholder.style.transition='opacity 0.3s ease';
      placeholder.style.opacity='0';
      setTimeout(()=>{ placeholder.style.display='none'; },300);
    }
  };
  img.onload=show;
  img.onerror=()=>{ if(placeholder)placeholder.style.animation='none'; };
  img.src=img.dataset.src;
  if(img.complete&&img.naturalWidth>0)show();
}

function observeImages(container){
  container.querySelectorAll('img[data-src]').forEach(img=>loadImg(img));
}

function petImgHtml(rarity,petName){
  const path=imgPath(rarity,petName);
  return`<div class="pet-img-wrap">
    <div class="pet-img-placeholder">${RARITY_EMOJI[rarity]||'❓'}</div>
    <img class="pet-img" data-src="${path}" alt="${petName}">
  </div>`;
}

// ── RARITY FOOTER ─────────────────────────────────────────────────
function rarityFooterHtml(rarity,isOwned){
  return`<div class="pet-footer">
    <div class="pet-footer-row"><div class="check">${isOwned?'✓':''}</div></div>
    <div class="pet-footer-row">
      <span class="rarity-dot ${RARITY_COLOR[rarity]||'r-unknown'}"></span>
      <span class="rarity-label">${RARITY_LABEL[rarity]||rarity}</span>
    </div>
  </div>`;
}

// ── MODALS ───────────────────────────────────────────────────────
let inputModalCallback=null;
function openInputModal(title,val,cb){ document.getElementById('modal-input-title').textContent=title; const f=document.getElementById('modal-input-field'); f.value=val||''; inputModalCallback=cb; document.getElementById('modal-input').classList.add('open'); setTimeout(()=>f.focus(),100); }
function closeInputModal(){ document.getElementById('modal-input').classList.remove('open'); inputModalCallback=null; }
function confirmInputModal(){ const v=document.getElementById('modal-input-field').value.trim(); if(inputModalCallback)inputModalCallback(v); closeInputModal(); }
document.getElementById('modal-input-field').addEventListener('keydown',e=>{ if(e.key==='Enter')confirmInputModal(); if(e.key==='Escape')closeInputModal(); });

let confirmCallback=null;
function openConfirmModal(title,text,cb){ document.getElementById('modal-confirm-title').textContent=title; document.getElementById('modal-confirm-text').textContent=text; confirmCallback=cb; document.getElementById('modal-confirm').classList.add('open'); }
function closeConfirmModal(){ document.getElementById('modal-confirm').classList.remove('open'); confirmCallback=null; }
document.getElementById('modal-confirm-ok').onclick=()=>{ if(confirmCallback)confirmCallback(); closeConfirmModal(); };
document.getElementById('modal-input').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeInputModal(); });
document.getElementById('modal-confirm').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeConfirmModal(); });

// ── POPOUT NAV PANEL ─────────────────────────────────────────────
// Every page declares <body data-page="..."> matching one PAGES[].id.
// Add a new page later by adding one entry here + a new .html file.
const PAGES=[
  {id:'collections',label:'Collections',icon:'📦',href:'index.html'},
  {id:'pet-values', label:'Pet Values', icon:'💰',href:'pet-values.html'}
];
function renderNavPanel(){
  const panel=document.getElementById('nav-panel');
  const current=document.body.dataset.page;
  panel.innerHTML='<h2>Pages</h2>'+PAGES.map(p=>{
    const active=p.id===current;
    const action=active?'closeNavPanel()':`location.href='${p.href}'`;
    return`<button class="nav-page-btn${active?' active':''}" onclick="${action}"><span class="nav-page-icon">${p.icon}</span>${p.label}</button>`;
  }).join('');
}
function openNavPanel(){ renderNavPanel(); document.getElementById('nav-overlay').classList.add('open'); }
function closeNavPanel(){ document.getElementById('nav-overlay').classList.remove('open'); }
function toggleNavPanel(){ document.getElementById('nav-overlay').classList.contains('open')?closeNavPanel():openNavPanel(); }
document.getElementById('nav-overlay').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeNavPanel(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape')closeNavPanel(); });
