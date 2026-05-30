// COUNTERS.JS — Compteurs HP / Mana / Monnaie
// ═══════════════════════════════════════════════════════════════
let CS = null;

function initCounterState(char) {
  CS = {
    charId:        char.id,
    hp:            char.hpCurrent,
    hpMax:         char.hpMax,
    hpTemp:        char.temporaryHealth || 0,
    hpTempInput:   5,
    mana:          char.manaCurrent,
    manaMax:       char.manaMax,
    manaTemp:      char.manaTemp || 0,
    manaTempInput: 5,
    manaMode:      char.manaMode     || 'MANA',
    slots:         char.spellSlots   || defaultSlots(),
    currencyMode:  char.currencyMode || 'SINGLE',
    credits:       char.credits      || 0,
  };
}

async function saveCS(fields) {
  if (!CS) return;
  await updateCharacterFields(CS.charId, fields);
  await loadCharacterList();
}

function renderCountersPanel(char) {
  initCounterState(char);
  const _hdr = document.getElementById('counters-char-header'); if (_hdr) _hdr.innerHTML = '';
  renderCountersContent();
}

function renderCountersContent() {
  document.getElementById('counters-content').innerHTML =
    renderHpBlock() + renderManaBlock() + renderCurrencyBlock();
  bindSlotEvents();
}

// ── HP ──
function renderHpBlock() {
  const {hp,hpMax,hpTemp,hpTempInput} = CS;
  const basePct = hpMax>0 ? Math.min(hp,hpMax)/hpMax*100 : 0;
  const tempPct = (hpTemp>0&&hpMax>0) ? Math.max(0,Math.min(hp-hpMax,hpTemp)/hpMax*100) : 0;
  const hasTemp = hpTemp>0;
  return `
  <div class="card ctr-card" style="margin-bottom:10px;">
    <div class="ctr-label-row"><span class="ctr-label-text">❤️ POINTS DE VIE</span>
      <div class="ctr-actions">
        <button class="ctr-icon-btn" onclick="resetHp()" title="Repos long">↺</button>
        <button class="ctr-icon-btn" onclick="openEditMax('hp')" title="Modifier max PV">✏️</button>
      </div>
    </div>
    <div class="ctr-bar-wrap">
      <div class="ctr-bar-track">
        <div id="hp-bar-base" class="ctr-bar-base" style="width:${basePct}%;background:linear-gradient(90deg,var(--red),#FF9999);"></div>
        <div id="hp-bar-temp" class="ctr-bar-temp" style="left:${basePct}%;width:${tempPct}%;background:linear-gradient(90deg,#FFBBBB,#FFD5D5);"></div>
      </div>
      <div class="ctr-bar-legend">
        <span class="ctr-legend-item"><span class="ctr-legend-dot" style="background:var(--red);"></span><span id="hp-legend">${Math.min(hp,hpMax)} / ${hpMax} PV</span></span>
        <span class="ctr-legend-item" id="hp-temp-legend" style="display:${hasTemp?'':'none'}"><span class="ctr-legend-dot" style="background:#FFBBBB;"></span><span id="hp-temp-legend-val">+${hpTemp} PV temp.</span></span>
      </div>
    </div>
    <div class="ctr-controls">
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(-1)">−</button>
      <div class="ctr-val-block">
        <div class="ctr-big" id="hp-v" style="color:var(--red);">${hp}</div>
        <div class="ctr-sub">/ ${hpMax}<span id="hp-temp-inline" style="color:#FF9999;font-weight:900;">${hasTemp?' +'+hpTemp+'✨':''}</span></div>
      </div>
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(1)">＋</button>
    </div>
    <div class="ctr-temp-section">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div class="ctr-temp-label" style="color:var(--red);margin:0;">✨ PV TEMPORAIRES</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="ctr-temp-sm-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHpTemp(-1)">−</button>
          <span id="hp-temp-val" style="font-size:18px;font-weight:900;color:var(--red);min-width:28px;text-align:center;">${hpTemp}</span>
          <button class="ctr-temp-sm-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHpTemp(1)">＋</button>
          ${hasTemp ? '<button class="ctr-temp-clear-btn" onclick="clearHpTemp()">✕</button>' : ''}
        </div>
      </div>
    </div>
  </div>`;
}
function adjHp(d) { CS.hp=Math.max(0,Math.min(CS.hpMax+CS.hpTemp,CS.hp+d)); updateHpUI(); saveCS({hpCurrent:CS.hp}); }
function adjHpTemp(d) {
  CS.hpTemp = Math.max(0, CS.hpTemp + d);
  // Si on augmente les PV temp alors que le perso est déjà au max, on augmente aussi les PV courants
  if (d > 0) CS.hp = Math.min(CS.hp + d, CS.hpMax + CS.hpTemp);
  // Mise à jour UI inline (sans re-render complet)
  const el = document.getElementById('hp-temp-val');
  if (el) el.textContent = CS.hpTemp;
  updateHpUI();
  saveCS({hpCurrent: CS.hp, temporaryHealth: CS.hpTemp});
}
function clearHpTemp() { CS.hpTemp=0; if(CS.hp>CS.hpMax)CS.hp=CS.hpMax; updateHpUI(); saveCS({hpCurrent:CS.hp,temporaryHealth:0}); }
function resetHp() { CS.hp=CS.hpMax; CS.hpTemp=0; updateHpUI(); saveCS({hpCurrent:CS.hp,temporaryHealth:0}); }
function updateHpUI() {
  const basePct=CS.hpMax>0?Math.min(CS.hp,CS.hpMax)/CS.hpMax*100:0;
  const tempPct=(CS.hpTemp>0&&CS.hpMax>0)?Math.max(0,Math.min(CS.hp-CS.hpMax,CS.hpTemp)/CS.hpMax*100):0;
  const hasTemp=CS.hpTemp>0;
  const v=document.getElementById('hp-v'); if(v) v.textContent=CS.hp;
  const bb=document.getElementById('hp-bar-base'); if(bb) bb.style.width=basePct+'%';
  const bt=document.getElementById('hp-bar-temp'); if(bt){bt.style.left=basePct+'%';bt.style.width=tempPct+'%';}
  const leg=document.getElementById('hp-legend'); if(leg) leg.textContent=`${Math.min(CS.hp,CS.hpMax)} / ${CS.hpMax} PV`;
  const tleg=document.getElementById('hp-temp-legend'); if(tleg) tleg.style.display=hasTemp?'':'none';
  const tlegv=document.getElementById('hp-temp-legend-val'); if(tlegv) tlegv.textContent=`+${CS.hpTemp} PV temp.`;
  const tinl=document.getElementById('hp-temp-inline'); if(tinl) tinl.textContent=hasTemp?` +${CS.hpTemp}✨`:'';
  const tv=document.getElementById('hp-temp-val'); if(tv) tv.textContent=CS.hpTemp;
}

// ── Mana / Sorts ──
function renderManaBlock() { return CS.manaMode==='SPELL_SLOTS' ? renderSpellSlotsBlock() : renderManaClassicBlock(); }

function renderManaClassicBlock() {
  const {mana,manaMax,manaTemp,manaTempInput}=CS;
  const basePct=manaMax>0?Math.min(mana,manaMax)/manaMax*100:0;
  const tempPct=(manaTemp>0&&manaMax>0)?Math.max(0,Math.min(mana-manaMax,manaTemp)/manaMax*100):0;
  const hasTemp=manaTemp>0;
  return `
  <div class="card ctr-card" style="margin-bottom:10px;">
    <div class="ctr-label-row"><span class="ctr-label-text">💧 MANA</span>
      <div class="ctr-actions">
        <button class="ctr-icon-btn" onclick="resetMana()" title="Repos long">↺</button>
        <button class="ctr-icon-btn" onclick="openEditMax('mana')" title="Modifier max Mana">✏️</button>
        <button class="ctr-icon-btn" onclick="toggleManaMode()" title="Emplacements de sorts">📖</button>
      </div>
    </div>
    <div class="ctr-bar-wrap">
      <div class="ctr-bar-track">
        <div id="mana-bar-base" class="ctr-bar-base" style="width:${basePct}%;background:linear-gradient(90deg,var(--blue),#99BBFF);"></div>
        <div id="mana-bar-temp" class="ctr-bar-temp" style="left:${basePct}%;width:${tempPct}%;background:linear-gradient(90deg,#BBCCFF,#D5E0FF);"></div>
      </div>
      <div class="ctr-bar-legend">
        <span class="ctr-legend-item"><span class="ctr-legend-dot" style="background:var(--blue);"></span><span id="mana-legend">${Math.min(mana,manaMax)} / ${manaMax} MP</span></span>
        <span class="ctr-legend-item" id="mana-temp-legend" style="display:${hasTemp?'':'none'}"><span class="ctr-legend-dot" style="background:#BBCCFF;"></span><span id="mana-temp-legend-val">+${manaTemp} MP temp.</span></span>
      </div>
    </div>
    <div class="ctr-controls">
      <button class="ctr-btn" style="background:var(--blue-l);color:var(--blue);" onclick="adjMana(-1)">−</button>
      <div class="ctr-val-block">
        <div class="ctr-big" id="mana-v" style="color:var(--blue);">${mana}</div>
        <div class="ctr-sub">/ ${manaMax}<span id="mana-temp-inline" style="color:#99BBFF;font-weight:900;">${hasTemp?' +'+manaTemp+'✨':''}</span></div>
      </div>
      <button class="ctr-btn" style="background:var(--blue-l);color:var(--blue);" onclick="adjMana(1)">＋</button>
    </div>
    <div class="ctr-temp-section">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div class="ctr-temp-label" style="color:var(--blue);margin:0;">✨ MANA TEMPORAIRE</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="ctr-temp-sm-btn" style="background:var(--blue-l);color:var(--blue);" onclick="adjManaTemp(-1)">−</button>
          <span id="mana-temp-val" style="font-size:18px;font-weight:900;color:var(--blue);min-width:28px;text-align:center;">${manaTemp}</span>
          <button class="ctr-temp-sm-btn" style="background:var(--blue-l);color:var(--blue);" onclick="adjManaTemp(1)">＋</button>
          ${hasTemp ? '<button class="ctr-temp-clear-btn" onclick="clearManaTemp()">✕</button>' : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderSpellSlotsBlock() {
  const cells = CS.slots.map((s,i) => {
    const inactive=s.max===0, depleted=!inactive&&s.current===0;
    return `<div class="spell-cell${depleted?' depleted':''}${inactive?' inactive':''}" data-slot="${i}">
      <div class="sc-lvl">NIV.${s.level}</div>
      <div class="sc-cur">${inactive?'—':s.current}</div>
      <div class="sc-max">${inactive?'':'/'+s.max}</div>
    </div>`;
  }).join('');
  return `
  <div class="card ctr-card" style="margin-bottom:10px;">
    <div class="ctr-label-row"><span class="ctr-label-text">📖 EMPLACEMENTS DE SORTS</span>
      <div class="ctr-actions">
        <button class="ctr-icon-btn" onclick="openSlotPicker()"    title="Configurer">⚙️</button>
        <button class="ctr-icon-btn" onclick="toggleManaMode()"    title="Retour mana">💧</button>
      </div>
    </div>
    <div class="spell-hint">Clic = utiliser · Double-clic = récupérer · Maintenir = modifier max</div>
    <div class="spell-grid" id="spell-grid">${cells}</div>
    <div class="spell-resets">
      <button class="spell-reset-btn short" onclick="resetSlots('short')">☀️ Repos court</button>
      <button class="spell-reset-btn long"  onclick="resetSlots('long')">🌙 Repos long</button>
    </div>
  </div>`;
}

function adjMana(d){CS.mana=Math.max(0,Math.min(CS.manaMax+CS.manaTemp,CS.mana+d));updateManaUI();saveCS({manaCurrent:CS.mana});}
function adjManaTemp(d) {
  CS.manaTemp = Math.max(0, CS.manaTemp + d);
  if (d > 0) CS.mana = Math.min(CS.mana + d, CS.manaMax + CS.manaTemp);
  const el = document.getElementById('mana-temp-val');
  if (el) el.textContent = CS.manaTemp;
  updateManaUI();
  saveCS({manaCurrent: CS.mana, manaTemp: CS.manaTemp});
}
function clearManaTemp(){CS.manaTemp=0;if(CS.mana>CS.manaMax)CS.mana=CS.manaMax;updateManaUI();saveCS({manaCurrent:CS.mana,manaTemp:0});}
function resetMana(){CS.mana=CS.manaMax;CS.manaTemp=0;updateManaUI();saveCS({manaCurrent:CS.mana,manaTemp:0});}
function updateManaUI(){
  if(CS.manaMode!=='MANA')return;
  const basePct=CS.manaMax>0?Math.min(CS.mana,CS.manaMax)/CS.manaMax*100:0;
  const tempPct=(CS.manaTemp>0&&CS.manaMax>0)?Math.max(0,Math.min(CS.mana-CS.manaMax,CS.manaTemp)/CS.manaMax*100):0;
  const hasTemp=CS.manaTemp>0;
  const v=document.getElementById('mana-v'); if(v) v.textContent=CS.mana;
  const bb=document.getElementById('mana-bar-base'); if(bb) bb.style.width=basePct+'%';
  const bt=document.getElementById('mana-bar-temp'); if(bt){bt.style.left=basePct+'%';bt.style.width=tempPct+'%';}
  const leg=document.getElementById('mana-legend'); if(leg) leg.textContent=`${Math.min(CS.mana,CS.manaMax)} / ${CS.manaMax} MP`;
  const tleg=document.getElementById('mana-temp-legend'); if(tleg) tleg.style.display=hasTemp?'':'none';
  const tlegv=document.getElementById('mana-temp-legend-val'); if(tlegv) tlegv.textContent=`+${CS.manaTemp} MP temp.`;
  const tinl=document.getElementById('mana-temp-inline'); if(tinl) tinl.textContent=hasTemp?` +${CS.manaTemp}✨`:'';
  const tv=document.getElementById('mana-temp-val'); if(tv) tv.textContent=CS.manaTemp;
}
function toggleManaMode(){CS.manaMode=CS.manaMode==='MANA'?'SPELL_SLOTS':'MANA';saveCS({manaMode:CS.manaMode});renderCountersContent();}

function bindSlotEvents(){
  if(CS.manaMode!=='SPELL_SLOTS')return;
  const grid=document.getElementById('spell-grid');
  if(!grid)return;
  grid.querySelectorAll('.spell-cell').forEach((cell,i)=>{
    let tapCount=0,tapTimer=null;
    // Clic droit → context menu
    cell.addEventListener('contextmenu',(e)=>{
      e.preventDefault();
      openSlotContextMenu(e, i);
    });
    // Clic gauche : simple = utiliser, double = récupérer
    cell.addEventListener('click',()=>{
      closeSlotContextMenu();
      tapCount++;
      if(tapCount===1){
        tapTimer=setTimeout(()=>{
          if(CS.slots[i].current>0){CS.slots[i].current--;refreshSlots();saveCS({spellSlots:CS.slots});}
          tapCount=0;
        },260);
      } else {
        clearTimeout(tapTimer);
        if(CS.slots[i].current<CS.slots[i].max){CS.slots[i].current++;refreshSlots();saveCS({spellSlots:CS.slots});}
        tapCount=0;
      }
    });
  });
}

// Context menu slots
let _ctxSlotIdx = null;
function openSlotContextMenu(e, i) {
  _ctxSlotIdx = i;
  const s = CS.slots[i];
  const inactive = s.max === 0;
  const menu = document.getElementById('slot-context-menu');
  document.getElementById('slot-context-title').textContent =
    inactive ? `Niveau ${s.level} — non configuré` : `Niveau ${s.level} — ${s.current} / ${s.max}`;
  // Afficher/masquer les actions selon état
  const btnUse     = menu.querySelectorAll('.ctx-menu-item')[1];
  const btnRecover = menu.querySelectorAll('.ctx-menu-item')[2];
  btnUse.style.display     = inactive ? 'none' : 'flex';
  btnRecover.style.display = inactive ? 'none' : 'flex';
  // Positionner près du curseur
  menu.style.display = 'block';
  const menuW = 220, menuH = inactive ? 80 : 140;
  let x = e.clientX, y = e.clientY;
  if (x + menuW > window.innerWidth)  x = window.innerWidth  - menuW - 8;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}
function closeSlotContextMenu() {
  document.getElementById('slot-context-menu').style.display = 'none';
  _ctxSlotIdx = null;
}
function openSlotEditFromContext()    { const idx = _ctxSlotIdx; closeSlotContextMenu(); openSlotEdit(idx); }
function useSlotFromContext() {
  if(_ctxSlotIdx===null)return;
  if(CS.slots[_ctxSlotIdx].current>0){CS.slots[_ctxSlotIdx].current--;refreshSlots();saveCS({spellSlots:CS.slots});}
  closeSlotContextMenu();
}
function recoverSlotFromContext() {
  if(_ctxSlotIdx===null)return;
  if(CS.slots[_ctxSlotIdx].current<CS.slots[_ctxSlotIdx].max){CS.slots[_ctxSlotIdx].current++;refreshSlots();saveCS({spellSlots:CS.slots});}
  closeSlotContextMenu();
}
// Ferme tous les menus contextuels si clic ailleurs
document.addEventListener('click', (e) => {
  ['slot-context-menu','char-context-menu','section-context-menu','widget-context-menu','ability-context-menu','item-context-menu','note-context-menu','pdf-context-menu'].forEach(id => {
    const m = document.getElementById(id);
    if (m && m.style.display !== 'none' && !m.contains(e.target)) m.style.display = 'none';
  });
});
function refreshSlots(){
  const grid=document.getElementById('spell-grid');
  if(!grid)return;
  grid.querySelectorAll('.spell-cell').forEach((cell,i)=>{
    const s=CS.slots[i];
    const inactive=s.max===0,depleted=!inactive&&s.current===0;
    cell.className='spell-cell'+(depleted?' depleted':'')+(inactive?' inactive':'');
    cell.querySelector('.sc-cur').textContent=inactive?'—':s.current;
    cell.querySelector('.sc-max').textContent=inactive?'':'/'+s.max;
  });
}
function resetSlots(type){CS.slots.forEach((s,i)=>{if(type==='long')CS.slots[i].current=s.max;else if(s.level<=2)CS.slots[i].current=s.max;});refreshSlots();saveCS({spellSlots:CS.slots});}
function openSlotPicker(){openModal('modal-slot-picker');renderSlotPicker();}
function renderSlotPicker(){
  const grid=document.getElementById('slot-picker-grid');
  if(!grid)return;
  grid.innerHTML=CS.slots.map((s,i)=>`<button class="slot-pick-btn" onclick="openSlotEdit(${i});closeModal('modal-slot-picker')">Niv. ${s.level}</button>`).join('');
}
function openSlotEdit(i){
  document.getElementById('slot-edit-title').textContent=`Niveau ${CS.slots[i].level} — Emplacements max`;
  document.getElementById('slot-edit-val').value=CS.slots[i].max;
  window._editSlotIdx=i;
  openModal('modal-slot-edit');
}
function confirmSlotEdit(){
  const i=window._editSlotIdx;
  const v=Math.max(0,Math.min(9,parseInt(document.getElementById('slot-edit-val').value)||0));
  CS.slots[i].max=v;
  if(CS.slots[i].current>v)CS.slots[i].current=v;
  refreshSlots();saveCS({spellSlots:CS.slots});closeModal('modal-slot-edit');
}

// ── Monnaie ──
function renderCurrencySep(){return'';}
function renderCurrencyBlock(){
  const {credits,currencyMode}=CS;
  const d=getCurrencyDisplay(credits,currencyMode);
  const coinsHtml=currencyMode==='SINGLE'
    ?`<div class="coins-row"><div class="coin"><div class="coin-val" style="color:var(--text);">${credits}</div><div class="coin-lbl">CRÉDITS</div></div></div>`
    :`<div class="coins-row">
        <div class="coin"><div class="coin-val" style="color:var(--yellow);">${d.gold}</div><div class="coin-lbl">OR</div></div>
        <div class="coin"><div class="coin-val" style="color:var(--text-mid);">${d.silver}</div><div class="coin-lbl">ARGENT</div></div>
        <div class="coin"><div class="coin-val" style="color:var(--orange);">${d.copper}</div><div class="coin-lbl">CUIVRE</div></div>
      </div><div class="coin-total">Total : ${credits} crédits</div>`;
  return`<div class="card ctr-card">
    <div class="ctr-label-row"><span class="ctr-label-text">💰 MONNAIE</span>
      <div class="ctr-actions"><button class="ctr-icon-btn" onclick="openModal('modal-currency-mode')">⚙️</button></div>
    </div>
    ${coinsHtml}
    <div class="ctr-action-row">
      <button class="ctr-action-btn add" onclick="openModal('modal-currency-add')">＋ Ajouter</button>
      <button class="ctr-action-btn spend" onclick="openModal('modal-currency-spend')">− Dépenser</button>
    </div>
  </div>`;
}
function getCurrencyDisplay(credits,mode){
  if(mode==='BY_TEN')     return{gold:Math.floor(credits/100),  silver:Math.floor((credits%100)/10),   copper:credits%10};
  if(mode==='BY_HUNDRED') return{gold:Math.floor(credits/10000),silver:Math.floor((credits%10000)/100),copper:credits%100};
  return{gold:0,silver:0,copper:credits};
}
function setCurrencyMode(mode){CS.currencyMode=mode;saveCS({currencyMode:mode});renderCountersContent();closeModal('modal-currency-mode');}
function submitAddCredits(){addCredits(parseInt(document.getElementById('currency-add-input').value)||0);}
function submitSpendCredits(){spendCredits(parseInt(document.getElementById('currency-spend-input').value)||0);}
function addCredits(amount){if(!amount)return;CS.credits+=amount;saveCS({credits:CS.credits});renderCountersContent();closeModal('modal-currency-add');}
function spendCredits(amount){if(!amount)return;CS.credits=Math.max(0,CS.credits-amount);saveCS({credits:CS.credits});renderCountersContent();closeModal('modal-currency-spend');}

// ── Edit max HP / Mana ──
function openEditMax(type) {
  const isHp = type === 'hp';
  const current = isHp ? CS.hpMax : CS.manaMax;
  document.getElementById('edit-max-title').textContent = isHp ? '❤️ PV maximum' : '💧 Mana maximum';
  const inp = document.getElementById('edit-max-input');
  inp.value = current;
  inp.dataset.type = type;
  openModal('modal-edit-max');
  setTimeout(()=>{ inp.focus(); inp.select(); }, 120);
}

function confirmEditMax() {
  const inp = document.getElementById('edit-max-input');
  const type = inp.dataset.type;
  const val = Math.max(1, parseInt(inp.value) || 1);
  if (type === 'hp') {
    CS.hpMax = val;
    if (CS.hp > val) CS.hp = val;
    saveCS({ hpMax: val, hpCurrent: CS.hp });
  } else {
    CS.manaMax = val;
    if (CS.mana > val) CS.mana = val;
    saveCS({ manaMax: val, manaCurrent: CS.mana });
  }
  renderCountersContent(); // re-render complet pour tout mettre à jour
  closeModal('modal-edit-max');
}

// ═══════════════════════════════════════════════════════════════