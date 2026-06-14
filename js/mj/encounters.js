// MJ — RENCONTRES
// ═══════════════════════════════════════════════════════════════

let _mjEncounter = null;
let _mjEncTab    = 'participants'; // 'participants' | 'notes'
let _encAddType  = 'MONSTRE';

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderEncountersList() {
  const encounters = await mjGetEncounters();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = encounters.length === 0
    ? `<div class="mj-empty">⚔️<br>Aucune rencontre.<br>Prépare la première !</div>`
    : encounters.map(e => {
        const total = (e.participants || []).reduce((s, p) => s + (p.qty || 1), 0);
        return `
          <div class="mj-item-card ${_mjEncounter?.id === e.id ? 'active' : ''}"
               onclick="mjSelectEncounter(${e.id})">
            <div class="mj-item-name">${escapeHtml(e.title || 'Sans titre')}</div>
            <div class="mj-item-sub">
              <span class="mj-pill mj-pill-red">${total} participant${total>1?'s':''}</span>
              ${e.location ? `<span>${escapeHtml(e.location)}</span>` : ''}
            </div>
          </div>`;
      }).join('');
}

async function mjSelectEncounter(id) {
  _mjEncounter = await mjGetEncounter(id);
  _mjEncTab    = 'participants';
  await mjRenderEncountersList();
  mjRenderEncounterDetail();
}

// ── Détail ────────────────────────────────────────────────────
function mjRenderEncounterDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjEncounter) {
    detail.innerHTML = `<div class="mj-detail-empty">⚔️<br>Sélectionne ou crée une rencontre</div>`;
    return;
  }

  const e   = _mjEncounter;
  const tab = _mjEncTab;

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div class="mj-detail-hdr-left">
        <input id="mj-enc-title" class="mj-title-input"
          value="${escapeHtml(e.title || '')}" placeholder="Nom de la rencontre…"
          onchange="mjSaveEncounterField('title', this.value)"/>
        <input id="mj-enc-location" class="mj-subtitle-input"
          value="${escapeHtml(e.location || '')}" placeholder="📍 Lieu…"
          onchange="mjSaveEncounterField('location', this.value)"/>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="mj-btn-launch" onclick="mjLaunchEncounterCombat(${e.id})">⚔️ Lancer le combat</button>
        <button class="mj-btn-danger" onclick="mjDeleteEncounterConfirm(${e.id})">🗑️</button>
      </div>
    </div>

    <div class="mj-tabs">
      <button class="mj-tab ${tab==='participants'?'on':''}" onclick="mjEncTab('participants')">⚔️ Participants</button>
      <button class="mj-tab ${tab==='notes'?'on':''}" onclick="mjEncTab('notes')">📝 Notes de prep</button>
    </div>

    <div class="mj-detail-body">
      ${tab === 'participants' ? _renderEncParticipants(e) : _renderEncNotes(e)}
    </div>`;
}

// Couleurs par type (PJ/PNJ/MONSTRE)
function _encTypeColors(type) {
  if (type === 'PJ')      return { c:'#5B9CF6',  b:'#DDEAFF' };
  if (type === 'PNJ')     return { c:'#B8860B',  b:'#FFF3CC' };
  return                         { c:'#FF6B6B',  b:'#FFE0E0' };
}

function _renderEncParticipants(e) {
  const bestiary = bestiaryGetAll();
  const parts    = (e.participants || []);
  const total    = parts.reduce((s,p) => s + (p.qty||1), 0);

  // Render une ligne participant (bestiary ou manuel)
  const rows = parts.map(p => {
    let name, ptype, maxHp, initiative;
    if (p.bestiaryId) {
      const t = bestiary.find(b => b.id === p.bestiaryId);
      if (!t) return '';
      name=t.name; ptype=t.type; maxHp=t.maxHp; initiative=t.initiative;
    } else {
      name=p.name; ptype=p.ptype||'MONSTRE'; maxHp=p.maxHp; initiative=p.initiative;
    }
    const pid = p.bestiaryId || p.pid;
    const {c,b} = _encTypeColors(ptype);
    return `
      <div class="mj-participant-row">
        <div class="mj-p-av" style="background:${combatColorFor(name)};">${(name[0]||'?').toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div class="mj-p-name">${escapeHtml(name)}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:2px;">
            <span class="mj-pill" style="color:${c};background:${b};">${ptype}</span>
            <span class="mj-p-sub">❤️ ${maxHp} PV · Init. ${initiative}</span>
          </div>
        </div>
        <div class="mj-qty-ctrl">
          <button class="mj-qty-btn" onclick="mjEncQty('${pid}',-1)">−</button>
          <span class="mj-qty-val">${p.qty||1}</span>
          <button class="mj-qty-btn" onclick="mjEncQty('${pid}',+1)">＋</button>
        </div>
        <button class="mj-btn-sm-danger" onclick="mjEncRemoveParticipant('${pid}')">×</button>
      </div>`;
  }).join('');

  // Formulaire ajout manuel
  const typeChips = ['MONSTRE','PNJ','PJ'].map(t => {
    const {c,b} = _encTypeColors(t);
    const emoji  = t==='MONSTRE'?'🐉':t==='PNJ'?'🧑':'⭐';
    return `<button id="enc-chip-${t}" class="mj-enc-chip ${_encAddType===t?'active':''}"
      style="${_encAddType===t?`background:${b};color:${c};border-color:${c}`:''}"
      onclick="mjEncSetType('${t}')">${emoji} ${t}</button>`;
  }).join('');

  const manualForm = `
    <div class="mj-enc-add-form">
      <div class="sec-lbl">AJOUTER MANUELLEMENT</div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">${typeChips}</div>
      <input id="enc-add-name" class="mj-field-input" placeholder="Nom du participant…"
      style="margin-bottom:6px;background:var(--green-l);border-color:rgba(92,200,168,.4);"
      onfocus="this.style.borderColor='var(--green)'" onblur="this.style.borderColor='rgba(92,200,168,.4)'"/>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:4px;">PV MAX</div>
          <input id="enc-add-hp" type="number" class="mj-field-input" value="10" min="1" style="text-align:center;background:#EDE9FF;border-color:rgba(167,139,250,.4);" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='rgba(167,139,250,.4)'"/>
        </div>
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:4px;">INIT.</div>
          <input id="enc-add-init" type="number" class="mj-field-input" value="0" style="text-align:center;background:#EDE9FF;border-color:rgba(167,139,250,.4);" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='rgba(167,139,250,.4)'"/>
        </div>
      </div>
      <button class="mj-btn-launch" style="width:100%;padding:9px;"
        onclick="mjEncAddManual()">＋ Ajouter</button>
    </div>`;

  // Bestiaire
  const bRows = bestiary.length === 0
    ? `<div class="mj-empty-sm">Bestiaire vide.</div>`
    : bestiary.map(t => `
        <div class="mj-bestiary-add-row" onclick="mjEncAddParticipant('${t.id}')">
          <div class="mj-p-av" style="background:${combatColorFor(t.name)};width:28px;height:28px;font-size:11px;">${(t.name[0]||'?').toUpperCase()}</div>
          <span style="font-size:12px;font-weight:800;color:var(--text);flex:1;">${escapeHtml(t.name)}</span>
          <span style="font-size:10px;font-weight:700;color:var(--text-light);">❤️ ${t.maxHp} · ＋</span>
        </div>`).join('');

  return `
    <div class="mj-two-col" style="align-items:flex-start;">
      <div class="mj-col">
        <div class="sec-lbl">PARTICIPANTS (${total})</div>
        ${rows || `<div class="mj-empty-sm">Aucun participant.</div>`}
      </div>
      <div class="mj-col" style="display:flex;flex-direction:column;gap:12px;">
        ${manualForm}
        <div>
          <div class="sec-lbl">DEPUIS LE BESTIAIRE</div>
          ${bRows}
        </div>
      </div>
    </div>`;
}

function _renderEncNotes(e) {
  return `
    <div class="sec-lbl">NOTES DE PRÉPARATION</div>
    <textarea id="mj-enc-notes"
      style="width:100%;min-height:200px;border:1.5px solid var(--divider);border-radius:12px;
      padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;color:var(--text);
      line-height:1.7;resize:vertical;background:var(--white);outline:none;box-sizing:border-box;"
      placeholder="Tactiques, loot, PNJ présents, conditions particulières…"
      onchange="mjSaveEncounterField('prepNotes', this.value)">${escapeHtml(e.prepNotes || '')}</textarea>`;
}

// ── Actions ───────────────────────────────────────────────────
function mjEncTab(tab) { _mjEncTab = tab; mjRenderEncounterDetail(); }

function mjEncSetType(t) {
  _encAddType = t;
  // Mise à jour visuelle des chips sans re-render complet
  ['MONSTRE','PNJ','PJ'].forEach(type => {
    const el = document.getElementById('enc-chip-' + type);
    if (!el) return;
    const {c,b} = _encTypeColors(type);
    el.classList.toggle('active', type === t);
    if (type === t) { el.style.background = b; el.style.color = c; el.style.borderColor = c; }
    else            { el.style.background = ''; el.style.color = ''; el.style.borderColor = ''; }
  });
}

async function mjEncAddManual() {
  if (!_mjEncounter) return;
  const name = document.getElementById('enc-add-name')?.value.trim();
  const hp   = parseInt(document.getElementById('enc-add-hp')?.value)   || 10;
  const init = parseInt(document.getElementById('enc-add-init')?.value) || 0;
  if (!name) { document.getElementById('enc-add-name')?.focus(); return; }
  if (!_mjEncounter.participants) _mjEncounter.participants = [];
  const pid = 'mp_' + Math.random().toString(36).slice(2, 9);
  _mjEncounter.participants.push({ pid, name, ptype: _encAddType, maxHp: hp, initiative: init, qty: 1 });
  await mjSaveEncounter(_mjEncounter);
  // Reset nom
  const nameEl = document.getElementById('enc-add-name');
  if (nameEl) nameEl.value = '';
  mjRenderEncounterDetail();
}

async function mjSaveEncounterField(field, value) {
  if (!_mjEncounter) return;
  _mjEncounter[field] = value;
  await mjSaveEncounter(_mjEncounter);
}

async function mjEncQty(pid, delta) {
  if (!_mjEncounter) return;
  const p = _mjEncounter.participants.find(p => (p.bestiaryId || p.pid) === pid);
  if (!p) return;
  p.qty = Math.max(1, (p.qty || 1) + delta);
  await mjSaveEncounter(_mjEncounter);
  mjRenderEncounterDetail();
}

async function mjEncAddParticipant(bestiaryId) {
  if (!_mjEncounter) return;
  if (!_mjEncounter.participants) _mjEncounter.participants = [];
  const exists = _mjEncounter.participants.find(p => p.bestiaryId === bestiaryId);
  if (exists) { exists.qty = (exists.qty || 1) + 1; }
  else { _mjEncounter.participants.push({ bestiaryId, qty: 1 }); }
  await mjSaveEncounter(_mjEncounter);
  mjRenderEncounterDetail();
}

async function mjEncRemoveParticipant(pid) {
  if (!_mjEncounter) return;
  _mjEncounter.participants = (_mjEncounter.participants || []).filter(p => (p.bestiaryId || p.pid) !== pid);
  await mjSaveEncounter(_mjEncounter);
  mjRenderEncounterDetail();
}

async function mjNewEncounter() {
  const id = await mjSaveEncounter({ title: 'Nouvelle rencontre', location: '', participants: [], prepNotes: '' });
  _mjEncounter = await mjGetEncounter(id);
  _mjEncTab    = 'participants';
  await mjRenderEncountersList();
  mjRenderEncounterDetail();
  setTimeout(() => document.getElementById('mj-enc-title')?.focus(), 100);
}

async function mjDeleteEncounterConfirm(id) {
  if (!confirm('Supprimer cette rencontre ?')) return;
  await mjDeleteEncounter(id);
  _mjEncounter = null;
  await mjRenderEncountersList();
  mjRenderEncounterDetail();
}

// ── Lancement combat depuis une rencontre ─────────────────────
async function mjLaunchEncounterCombat(encId) {
  const enc = await mjGetEncounter(encId);
  if (!enc) return;
  document.getElementById('mj-overlay').style.display = 'none';
  // combat/setup.js gère les participants bestiaire via enc.participants
  // Les participants manuels (p.pid) sont ajoutés directement dans combatAddParticipant
  openCombatSetup(enc);
}