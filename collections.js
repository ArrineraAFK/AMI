const TYPE_LABELS     = {egg:'Egg',event:'Event',shop:'Shop / Update',special:'Special',lure:'Lure'};
const TYPE_BADGE      = {egg:'badge-egg',event:'badge-event',shop:'badge-shop',special:'badge-special',lure:'badge-lure'};

// ── VIEW ─────────────────────────────────────────────────────────
let currentView='collections';

function switchView(view){
  currentView=view;
  document.querySelectorAll('.view-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
  document.getElementById('view-collections').style.display=view==='collections'?'':'none';
  document.getElementById('view-rarity').style.display=view==='rarity'?'':'none';
  document.getElementById('view-alpha').style.display=view==='alpha'?'':'none';
  document.getElementById('view-owned').style.display=view==='owned'?'':'none';
  // show/hide controls relevant to each view
  const isCollections=view==='collections';
  document.querySelector('.expand-btn').style.display=isCollections?'':'none';
  document.querySelector('.collapse-btn').style.display=isCollections?'':'none';
  document.querySelector('.filter-type-sel').style.display=isCollections?'':'none';
  document.querySelector('.col-sort-sel').style.display=isCollections?'':'none';
  document.querySelector('.filter-status-sel').style.display=(view==='owned'||view==='alpha'||view==='rarity')?'none':'';
  renderCurrentView();
}

function renderCurrentView(){
  if(currentView==='collections') renderCollections();
  else if(currentView==='rarity') renderRarityView();
  else if(currentView==='alpha')  renderAlphaView();
  else if(currentView==='owned')  renderOwnedView();
}
window.onHeaderSearch=renderCurrentView;

// ── PROFILES ─────────────────────────────────────────────────────
const STORAGE_KEY='am_profiles';
function loadAllProfiles(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{active:'Default',profiles:{Default:{}}};}catch(e){return{active:'Default',profiles:{Default:{}}};} }
function saveAllProfiles(d){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){} }

let profileData=loadAllProfiles();
let owned=profileData.profiles[profileData.active]||{};

function save(){ profileData.profiles[profileData.active]=owned; saveAllProfiles(profileData); }
function renderProfileBar(){ const sel=document.getElementById('profile-select'); sel.innerHTML=Object.keys(profileData.profiles).map(n=>`<option value="${n}" ${n===profileData.active?'selected':''}>${n}</option>`).join(''); }
function switchProfile(){ profileData.active=document.getElementById('profile-select').value; owned=profileData.profiles[profileData.active]||{}; saveAllProfiles(profileData); expanded={}; sortMode={}; renderCurrentView(); }
function openNewProfileModal(){ openInputModal('New Profile','',name=>{ if(!name)return; if(profileData.profiles[name]){openConfirmModal('Already exists',`Profile "${name}" already exists.`,()=>{});return;} profileData.profiles[name]={}; profileData.active=name; owned={}; saveAllProfiles(profileData); renderProfileBar(); expanded={}; sortMode={}; renderCurrentView(); }); }
function openRenameModal(){ openInputModal('Rename',profileData.active,n=>{ if(!n||n===profileData.active)return; if(profileData.profiles[n]){openConfirmModal('Already exists',`Profile "${n}" already exists.`,()=>{});return;} profileData.profiles[n]=profileData.profiles[profileData.active]; delete profileData.profiles[profileData.active]; profileData.active=n; saveAllProfiles(profileData); renderProfileBar(); renderCurrentView(); }); }
function openDeleteConfirm(){ if(Object.keys(profileData.profiles).length<=1){openConfirmModal('Not possible','You cannot delete the last profile.',()=>{});return;} openConfirmModal('Delete profile',`Really delete profile "${profileData.active}"?`,()=>{ delete profileData.profiles[profileData.active]; profileData.active=Object.keys(profileData.profiles)[0]; owned=profileData.profiles[profileData.active]||{}; saveAllProfiles(profileData); renderProfileBar(); expanded={}; sortMode={}; renderCurrentView(); }); }
function openResetConfirm(){ openConfirmModal('Reset','Reset all checkmarks in the current profile?',()=>{ owned={}; save(); renderCurrentView(); }); }
function toggleProfileMenu(){ document.getElementById('profile-dropdown').classList.toggle('open'); }
function closeProfileMenu(){ document.getElementById('profile-dropdown').classList.remove('open'); }
document.addEventListener('click',e=>{ if(!e.target.closest('.profile-menu'))closeProfileMenu(); });

// ── EXPORT / IMPORT ───────────────────────────────────────────────
function exportData(){
  const blob=new Blob([JSON.stringify(profileData,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;
  const now=new Date();
  const date=now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\./g,'-');
  const time=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}).replace(':','-');
  const safe=profileData.active.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g,'_');
  a.download=`AM_Tracker_${safe}_${date}_${time}.json`; a.click(); URL.revokeObjectURL(url);
}
function importData(event){
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{ try{ const p=JSON.parse(e.target.result); if(!p.profiles||!p.active){openConfirmModal('Invalid file','Not a valid format.',()=>{});return;} openConfirmModal('Confirm import','All current profiles will be replaced. Continue?',()=>{ profileData=p; owned=profileData.profiles[profileData.active]||{}; saveAllProfiles(profileData); renderProfileBar(); expanded={}; sortMode={}; renderCurrentView(); }); }catch(err){openConfirmModal('Error','File could not be read.',()=>{});} event.target.value=''; };
  reader.readAsText(file);
}

// ── STATE ─────────────────────────────────────────────────────────
let COLLECTIONS=[],ALL_PETS=[],expanded={},sortMode={};

function togglePet(colId,pet){ haptic(); const name=decodeURIComponent(pet); const key=colId+'|||'+name; owned[key]=!owned[key]; if(!owned[key])delete owned[key]; save(); refreshCard(colId); updateStats(); }
function togglePetFromFlat(colId,pet){ haptic(); const name=decodeURIComponent(pet); const key=colId+'|||'+name; owned[key]=!owned[key]; if(!owned[key])delete owned[key]; save(); updateStats(); renderCurrentView(); }
function getOwned(colId){ return COLLECTIONS.find(c=>c.id===colId).pets.filter(p=>owned[colId+'|||'+p.name]).length; }
function expandAll(){ COLLECTIONS.forEach(c=>expanded[c.id]=true); renderCollections(); }
function collapseAll(){ expanded={}; renderCollections(); }
function setSortMode(colId,mode){ sortMode[colId]=mode; refreshCard(colId); }

function updateStats(){
  let complete=0,partial=0,totalPets=0,ownedPets=0;
  COLLECTIONS.forEach(c=>{ const o=getOwned(c.id),t=c.pets.length; totalPets+=t; ownedPets+=o; if(o===t)complete++; else if(o>0)partial++; });
  document.getElementById('s-complete').textContent=complete;
  document.getElementById('s-partial').textContent=partial;
  document.getElementById('s-total').textContent=COLLECTIONS.length;
  document.getElementById('s-pets').textContent=ownedPets+'/'+totalPets;
  document.getElementById('global-bar').style.width=(totalPets?Math.round(ownedPets/totalPets*100):0)+'%';
}

// ── COLLECTIONS VIEW ──────────────────────────────────────────────
function getPets(col){
  const mode=sortMode[col.id]||'rarity';
  const pets=[...col.pets];
  if(mode==='alpha'){ pets.sort((a,b)=>a.name.localeCompare(b.name)); return{grouped:false,pets}; }
  const groups={};
  pets.forEach(p=>{ const r=p.rarity||'unknown'; if(!groups[r])groups[r]=[]; groups[r].push(p); });
  return{grouped:true,groups};
}

function petItemHtml(colId,p,highlight){
  const isOwned=!!owned[colId+'|||'+p.name];
  const safe=encodeURIComponent(p.name);
  return`<div class="pet-item${isOwned?' owned':''}${highlight?' highlighted':''}" onclick="togglePet('${colId}','${safe}')">
    ${petImgHtml(p.rarity,p.name)}
    <div class="pet-name">${p.name}</div>
    ${rarityFooterHtml(p.rarity,isOwned)}
  </div>`;
}

function renderPetsHtml(col,search){
  const{grouped,pets,groups}=getPets(col);
  const sq=search?search.toLowerCase():'';
  const hi=p=>sq&&p.name.toLowerCase().includes(sq);
  let html='';
  if(grouped){ Object.keys(groups).forEach(r=>{ html+=`<div class="rarity-section">${RARITY_LABEL[r]||r}</div>`; groups[r].forEach(p=>html+=petItemHtml(col.id,p,hi(p))); }); }
  else{ pets.forEach(p=>html+=petItemHtml(col.id,p,hi(p))); }
  return html;
}

function refreshCard(colId){
  const el=document.getElementById('card-'+colId); if(!el)return;
  const col=COLLECTIONS.find(c=>c.id===colId);
  const o=getOwned(colId),t=col.pets.length,pct=t?Math.round(o/t*100):0,complete=o===t;
  el.className='card'+(complete?' complete':'');
  el.querySelector('.progress-bar').style.width=pct+'%';
  el.querySelector('.count-badge').textContent=o+'/'+t;
  const stamp=el.querySelector('.complete-stamp'); if(stamp)stamp.style.display=complete?'':'none';
  const pg=el.querySelector('.pets-grid');
  if(pg){ pg.innerHTML=renderPetsHtml(col,''); observeImages(el); }
  const mode=sortMode[colId]||'rarity';
  el.querySelectorAll('.sort-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
}

function renderCollections(){
  const search=document.getElementById('search').value.toLowerCase();
  const fStatus=document.getElementById('filter-status').value;
  const fType=document.getElementById('filter-type').value;
  const colSort=document.getElementById('col-sort').value;
  let filtered=COLLECTIONS.filter(c=>{
    if(fType!=='all'&&c.type!==fType)return false;
    const o=getOwned(c.id),t=c.pets.length;
    if(fStatus==='complete'&&o!==t)return false;
    if(fStatus==='partial'&&(o===0||o===t))return false;
    if(fStatus==='empty'&&o>0)return false;
    if(search&&!c.name.toLowerCase().includes(search)&&!c.pets.some(p=>p.name.toLowerCase().includes(search)))return false;
    return true;
  });
  if(colSort==='az') filtered.sort((a,b)=>a.name.localeCompare(b.name));
  else if(colSort==='progress-desc') filtered.sort((a,b)=>(getOwned(b.id)/b.pets.length||0)-(getOwned(a.id)/a.pets.length||0));
  else if(colSort==='progress-asc')  filtered.sort((a,b)=>(getOwned(a.id)/a.pets.length||0)-(getOwned(b.id)/b.pets.length||0));
  const grid=document.getElementById('grid');
  if(!filtered.length){grid.innerHTML='<div class="no-results">No collections found.</div>';updateStats();return;}
  grid.innerHTML=filtered.map(col=>{
    const o=getOwned(col.id),t=col.pets.length,pct=t?Math.round(o/t*100):0,complete=o===t;
    const petMatch=search&&col.pets.some(p=>p.name.toLowerCase().includes(search));
    const isOpen=expanded[col.id]||petMatch;
    const mode=sortMode[col.id]||'rarity';
    return`<div class="card${complete?' complete':''}" id="card-${col.id}">
      <div class="card-header" onclick="toggleExpand('${col.id}')">
        <div class="card-title">${col.name}</div>
        <div class="card-meta">
          ${complete?'<span class="complete-stamp">✓ Complete</span>':''}
          <span class="count-badge">${o}/${t}</span>
          <span class="badge ${TYPE_BADGE[col.type]||''}">${TYPE_LABELS[col.type]||col.type}</span>
          <span class="chevron${isOpen?' open':''}">▾</span>
        </div>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div class="card-toolbar${isOpen?' open':''}">
        <span class="sort-label">Sort by:</span>
        <button class="sort-btn${mode==='rarity'?' active':''}" data-mode="rarity" onclick="event.stopPropagation();setSortMode('${col.id}','rarity')">Rarity</button>
        <button class="sort-btn${mode==='alpha'?' active':''}"  data-mode="alpha"  onclick="event.stopPropagation();setSortMode('${col.id}','alpha')">A–Z</button>
      </div>
      <div class="pets-grid${isOpen?' open':''}" style="${isOpen?'display:grid':''}">
        ${isOpen?renderPetsHtml(col,search):''}
      </div>
    </div>`;
  }).join('');
  filtered.forEach(col=>{
    const isOpen=expanded[col.id]||(search&&col.pets.some(p=>p.name.toLowerCase().includes(search)));
    if(isOpen){ const card=document.getElementById('card-'+col.id); if(card)observeImages(card); }
  });
  updateStats();
}

function toggleExpand(id){
  expanded[id]=!expanded[id];
  const card=document.getElementById('card-'+id); if(!card)return;
  const pg=card.querySelector('.pets-grid');
  const col=COLLECTIONS.find(c=>c.id===id);
  if(expanded[id]&&pg.innerHTML.trim()===''){
    const search=document.getElementById('search').value.toLowerCase();
    pg.innerHTML=renderPetsHtml(col,search);
  }
  pg.style.display=expanded[id]?'grid':'none';
  pg.classList.toggle('open',!!expanded[id]);
  card.querySelector('.chevron').classList.toggle('open',!!expanded[id]);
  card.querySelector('.card-toolbar').classList.toggle('open',!!expanded[id]);
  if(expanded[id])observeImages(card);
}

// ── RARITY SUBFILTERS STATE ──────────────────────────────────────
const raritySubfilters={};
RARITY_ORDER.forEach(r=>{ raritySubfilters[r]={sort:null,open:false}; });

function setRaritySort(rarity,value){
  const sf=raritySubfilters[rarity];
  sf.sort=sf.sort===value?null:value;
  RARITY_ORDER.forEach(r=>{ raritySubfilters[r].open=false; });
  renderRarityView();
}

function toggleSubfilterOpen(rarity,e){
  e.stopPropagation();
  const sf=raritySubfilters[rarity];
  const wasOpen=sf.open;
  RARITY_ORDER.forEach(r=>{ raritySubfilters[r].open=false; });
  sf.open=!wasOpen;
  renderRarityView();
}

document.addEventListener('click',()=>{
  let any=false;
  RARITY_ORDER.forEach(r=>{ if(raritySubfilters[r].open){ raritySubfilters[r].open=false; any=true; } });
  if(any) renderRarityView();
});

// ── RARITY PET CARD HTML ─────────────────────────────────────────
function rarityPetCardHtml(p,search){
  const isOwned=!!owned[p.colId+'|||'+p.name];
  const hi=search&&(p.name.toLowerCase().includes(search)||p.colName.toLowerCase().includes(search));
  const safe=encodeURIComponent(p.name);
  return`<div class="rarity-pet-item${isOwned?' owned':''}${hi?' highlighted':''}" onclick="togglePetFromFlat('${p.colId}','${safe}')">
    ${petImgHtml(p.rarity,p.name)}
    <div class="pet-name">${p.name}</div>
    <div class="rarity-pet-col">${p.colName}</div>
    <div class="pet-footer"><div class="pet-footer-row"><div class="check">${isOwned?'✓':''}</div></div></div>
  </div>`;
}

// ── RARITY VIEW ───────────────────────────────────────────────────
function renderRarityView(){
  const search=document.getElementById('search').value.toLowerCase();
  const fStatus=document.getElementById('filter-status').value;
  const container=document.getElementById('rarity-view');
  let html='';
  RARITY_ORDER.forEach(rarity=>{
    let pets=ALL_PETS.filter(p=>p.rarity===rarity);
    if(search) pets=pets.filter(p=>p.name.toLowerCase().includes(search)||p.colName.toLowerCase().includes(search));
    if(fStatus==='complete') pets=pets.filter(p=>owned[p.colId+'|||'+p.name]);
    if(fStatus==='empty')    pets=pets.filter(p=>!owned[p.colId+'|||'+p.name]);
    if(!pets.length) return;

    const sf=raritySubfilters[rarity];
    const dot=RARITY_DOT_COLOR[rarity]||'#ccc';
    const ownedCount=pets.filter(p=>owned[p.colId+'|||'+p.name]).length;

    let filtered=[...pets];
    if(sf.sort==='alpha') filtered.sort((a,b)=>a.name.localeCompare(b.name));
    else if(sf.sort==='event') filtered.sort((a,b)=>a.colName.localeCompare(b.colName)||a.name.localeCompare(b.name));
    else if(sf.sort==='owned') filtered.sort((a,b)=>{
      const ao=!!owned[a.colId+'|||'+a.name],bo=!!owned[b.colId+'|||'+b.name];
      return bo-ao||a.name.localeCompare(b.name);
    });

    const hasSort=!!sf.sort;
    const sortLabel={alpha:'A–Z',event:'Event',owned:'Owned first'}[sf.sort]||'↕ Sort';

    html+=`<div class="rarity-group">
      <div class="rarity-group-header">
        <span style="width:10px;height:10px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0"></span>
        <span class="rarity-group-title">${RARITY_LABEL[rarity]}</span>
        <span class="rarity-group-count">${ownedCount}/${pets.length} Pets</span>
        <div class="dropdown-filter">
          <button class="subfilter-toggle${sf.open?' open':''}${hasSort?' active-filter':''}" onclick="toggleSubfilterOpen('${rarity}',event)">
            ${sortLabel} <span class="sf-chevron">▾</span>
          </button>
          <div class="subfilter-dropdown${sf.open?' open':''}">
            <div class="subfilter-label">Sort by</div>
            <button class="sf-chip${sf.sort==='alpha'?' active':''}" onclick="event.stopPropagation();setRaritySort('${rarity}','alpha')">🔤 Alphabet (A–Z)</button>
            <button class="sf-chip${sf.sort==='event'?' active':''}" onclick="event.stopPropagation();setRaritySort('${rarity}','event')">📅 Event order</button>
            <button class="sf-chip${sf.sort==='owned'?' active':''}" onclick="event.stopPropagation();setRaritySort('${rarity}','owned')">✓ Owned first</button>
            ${hasSort?`<div class="sf-divider"></div><button class="sf-chip" onclick="event.stopPropagation();setRaritySort('${rarity}',null)">✕ Reset</button>`:''}
          </div>
        </div>
      </div>
      <div class="rarity-pet-grid">
        ${filtered.map(p=>rarityPetCardHtml(p,search)).join('')}
      </div>
    </div>`;
  });
  container.innerHTML=html||'<div class="no-results">No pets found.</div>';
  observeImages(container);
  updateStats();
}

// ── ALPHA VIEW ────────────────────────────────────────────────────
function renderAlphaView(){
  const search=document.getElementById('search').value.toLowerCase();
  const fStatus=document.getElementById('filter-status').value;
  const container=document.getElementById('alpha-view');
  let pets=[...ALL_PETS];
  if(search) pets=pets.filter(p=>p.name.toLowerCase().includes(search)||p.colName.toLowerCase().includes(search));
  if(fStatus==='complete') pets=pets.filter(p=>owned[p.colId+'|||'+p.name]);
  if(fStatus==='empty')    pets=pets.filter(p=>!owned[p.colId+'|||'+p.name]);
  pets.sort((a,b)=>a.name.localeCompare(b.name));
  if(!pets.length){ container.innerHTML='<div class="no-results">No pets found.</div>'; updateStats(); return; }
  const byLetter={};
  pets.forEach(p=>{ const first=p.name[0].toUpperCase(); const l=/^[A-ZÄÖÜ]$/.test(first)?first:'#'; if(!byLetter[l])byLetter[l]=[]; byLetter[l].push(p); });
  const sortedLetters=Object.keys(byLetter).sort((a,b)=>{ if(a==='#')return -1; if(b==='#')return 1; return a.localeCompare(b); });
  container.innerHTML=sortedLetters.map(letter=>`<div class="alpha-group">
    <div class="alpha-letter">${letter}</div>
    <div class="alpha-pet-grid">
      ${byLetter[letter].map(p=>{
        const isOwned=!!owned[p.colId+'|||'+p.name];
        const hi=search&&(p.name.toLowerCase().includes(search)||p.colName.toLowerCase().includes(search));
        const safe=encodeURIComponent(p.name);
        return`<div class="rarity-pet-item${isOwned?' owned':''}${hi?' highlighted':''}" onclick="togglePetFromFlat('${p.colId}','${safe}')">
          ${petImgHtml(p.rarity,p.name)}
          <div class="pet-name">${p.name}</div>
          <div class="rarity-pet-col">${p.colName}</div>
          ${rarityFooterHtml(p.rarity,isOwned)}
        </div>`;
      }).join('')}
    </div>
  </div>`).join('');
  observeImages(container);
  updateStats();
}

// ── OWNED / NOT OWNED VIEW ────────────────────────────────────────
function renderOwnedView(){
  const search=document.getElementById('search').value.toLowerCase();
  const container=document.getElementById('owned-view');

  const matchSearch=p=>!search||(p.name.toLowerCase().includes(search)||p.colName.toLowerCase().includes(search));

  const ownedPets=ALL_PETS.filter(p=>owned[p.colId+'|||'+p.name]&&matchSearch(p))
    .sort((a,b)=>a.name.localeCompare(b.name));
  const notOwnedPets=ALL_PETS.filter(p=>!owned[p.colId+'|||'+p.name]&&matchSearch(p))
    .sort((a,b)=>a.name.localeCompare(b.name));

  const renderGroup=(pets,title,dot)=>{
    if(!pets.length) return '';
    return`<div class="rarity-group">
      <div class="rarity-group-header">
        <span style="width:10px;height:10px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0"></span>
        <span class="rarity-group-title">${title}</span>
        <span style="flex:1"></span>
        <span class="rarity-group-count">${pets.length} Pets</span>
      </div>
      <div class="rarity-pet-grid">
        ${pets.map(p=>rarityPetCardHtml(p,search)).join('')}
      </div>
    </div>`;
  };

  const html=renderGroup(ownedPets,'Collected','#1D9E75')+renderGroup(notOwnedPets,'Not Collected','#ccc');
  container.innerHTML=html||'<div class="no-results">No pets found.</div>';
  observeImages(container);
  updateStats();
}

// ── DATA LOADING ──────────────────────────────────────────────────
async function loadPetData(){
  try{
    const res=await fetch('pets.json');
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    const petsByCollection={};
    RARITY_ORDER.forEach(rarity=>{
      (data.pets[rarity]||[]).forEach(pet=>{
        if(!petsByCollection[pet.collection])petsByCollection[pet.collection]=[];
        petsByCollection[pet.collection].push({name:pet.name,rarity});
      });
    });
    COLLECTIONS=data.collections.map(col=>({...col,pets:petsByCollection[col.id]||[]}));
    ALL_PETS=[];
    COLLECTIONS.forEach(col=>{ col.pets.forEach(p=>ALL_PETS.push({name:p.name,rarity:p.rarity,colId:col.id,colName:col.name})); });
    renderProfileBar();
    renderCurrentView();
  }catch(e){
    document.getElementById('grid').innerHTML=`<div class="no-results">⚠️ Could not load pets.json.<br><small>${e.message}</small></div>`;
  }
}

loadPetData();
