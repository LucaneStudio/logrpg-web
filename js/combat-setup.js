// COMBAT SETUP
// ═══════════════════════════════════════════════════════════════

let _cSetup = { localSel: new Set(), type: 'MONSTRE', bestiaryOpen: false };

// ── Entrée ────────────────────────────────────────────────────
async function openCombatSetup() {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE', bestiaryOpen: false };
  document.getElementById('combat-overlay').style.display = 'flex';
  await _renderSetup();
}

function closeCombatOverlay() {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE', bestiaryOpen: false };
  if (typeof _resetCombatViewState === 'function') _resetCombatViewState();
  document.getElementById('combat-overlay').style.display = 'none';
}

// ── Render setup ──────────────────────────────────────────────
async function _renderSetup() {
  const chars = await getAllCharacters();
  document.getElementById('combat-overlay').innerHTML = `
    <div class="cbt-setup-wrap">
      <div class="cbt-setup-hdr">
        <div>
          <div style="font-size:18px;font-weight:900;color:var(--text);">⚔️ Préparer le combat</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:2px;">${_combat.participants.length} participant(s) ajouté(s)</div>
        </div>
        <button class="cbt-cancel-btn cbt-hover-cancel" onclick="closeCombatOverlay()">✕ Annuler</button>
      </div>
      <div class="cbt-setup-body">
        <div class="cbt-setup-col scroll">
          ${chars.length ? _renderLocalSection(chars) : ''}
          ${_renderBestiarySection()}
          ${_renderManualSection()}
        </div>
        <div class="cbt-setup-col" style="display:flex;flex-direction:column;gap:12px;">
          <div class="scroll" style="flex:1;">${_renderParticipantsList()}</div>
          ${_combat.participants.length === 1 ? '<div style="font-size:11px;color:var(--text-light);font-weight:700;text-align:center;margin-bottom:6px;">Il faut au moins 2 participants</div>' : ''}
          <button onclick="launchCombat()" ${_combat.participants.length < 2 ? 'disabled' : ''}
            class="cbt-launch-btn ${_combat.participants.length >= 2 ? 'active' : ''}">
            ⚔️ Lancer le combat
          </button>
        </div>
      </div>
    </div>`;
}

// ── Section personnages locaux — toggle style ─────────────────
function _renderLocalSection(chars) {
  return `<div class="setup-section">
    <div class="setup-section-label">🧙 PERSONNAGES LOCAUX</div>
    ${chars.map(char => {
      const sel   = _cSetup.localSel.has(char.id);
      const hpPct = char.hpMax > 0 ? Math.min(char.hpCurrent || 0, char.hpMax) / char.hpMax * 100 : 0;
      const av    = char.profilePhoto
        ? `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;"/>`
        : `<span style="font-size:13px;font-weight:900;color:#fff;">${getInitial(char.name)}</span>`;
      return `
        <div class="setup-char-row">
          <div style="width:40px;height:40px;border-radius:12px;overflow:hidden;background:${getAvatarColor(char.id)};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${av}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:800;color:var(--text);">${escapeHtml(char.name)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
              <span style="font-size:11px;">❤️</span>
              <div style="flex:1;height:5px;background:var(--divider);border-radius:2px;overflow:hidden;">
                <div style="width:${hpPct}%;height:100%;background:#FF6B6B;border-radius:2px;"></div>
              </div>
              <span style="font-size:11px;font-weight:800;color:var(--text-mid);margin-right:12px;">${char.hpCurrent || 0}/${char.hpMax || 0}</span>
            </div>
          </div>
          <label class="setup-toggle-label" onclick="event.stopPropagation()">
            <input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleSetupChar(${char.id}, this.checked)" style="display:none;">
            <div class="setup-toggle ${sel ? 'on' : ''}"></div>
          </label>
        </div>`;
    }).join('')}
  </div>`;
}

// ── Section manuel ────────────────────────────────────────────
function _renderManualSection() {
  const chips = [
    { t: 'MONSTRE', label: '👹 Monstre', cls: 'mob' },
    { t: 'PNJ',     label: '🗣 PNJ',     cls: 'pnj' },
    { t: 'PJ',      label: '🧙 PJ',      cls: 'pj'  },
  ].map(({ t, label, cls }) =>
    `<div id="chip-${t}" class="type-chip ${cls} ${_cSetup.type === t ? 'cbt-chip-active' : ''}"
      onclick="selectCombatType('${t}')">${label}</div>`
  ).join('');

  return `<div class="setup-section">
    <div class="setup-section-label">➕ AJOUTER MANUELLEMENT</div>
    <div class="type-chips" style="margin:8px 0 12px;">${chips}</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <input id="setup-manual-name" class="field-input" placeholder="Nom du participant…" style="width:100%;"/>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;"><div class="field-label">PV MAX</div>
          <input id="setup-manual-hp" class="field-input" type="number" placeholder="20" min="1"/></div>
        <div style="flex:1;"><div class="field-label">INITIATIVE</div>
          <input id="setup-manual-init" class="field-input" type="number" placeholder="12"/></div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="submitManualParticipant()" class="cbt-add-manual-btn cbt-hover-green" style="flex:1;">＋ Ajouter</button>
        <button onclick="submitManualParticipantAndSave()" title="Ajouter et sauvegarder comme modèle"
          style="flex:0 0 auto;padding:10px 14px;border-radius:11px;background:var(--yellow-l);
          border:1.5px solid rgba(255,209,102,.4);font-family:'Nunito',sans-serif;font-size:13px;
          font-weight:900;color:#B8860B;cursor:pointer;transition:background .15s;" onmouseenter="this.style.background='rgba(255,209,102,.45)'" onmouseleave="this.style.background='var(--yellow-l)'">💾 Sauvegarder</button>
      </div>
      <div id="setup-manual-error" style="font-size:11px;color:var(--red);font-weight:700;min-height:14px;"></div>
    </div>
  </div>`;
}

// ── Liste participants (colonne droite) ───────────────────────
function _renderParticipantsList() {
  if (_combat.participants.length === 0) {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:8px;padding:48px 20px;text-align:center;color:var(--text-light);font-size:13px;font-weight:700;">
      <div style="font-size:36px;">⚔️</div>
      Aucun participant encore.<br>Ajoute des combattants depuis la gauche.
    </div>`;
  }
  return `<div class="setup-section-label" style="margin-bottom:12px;">PARTICIPANTS (${_combat.participants.length})</div>` +
    _combat.participants.map(p => {
      const tc = p.type === 'PJ' ? 'var(--blue)' : p.type === 'PNJ' ? '#B8860B' : 'var(--red)';
      const tb = p.type === 'PJ' ? 'var(--blue-l)' : p.type === 'PNJ' ? 'var(--yellow-l)' : 'var(--red-l)';
      return `<div class="setup-participant-row">
        <div style="width:36px;height:36px;border-radius:11px;background:${p.avatarColor};overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">${p.avatarPhoto ? '<img src="' + p.avatarPhoto + '" style="width:100%;height:100%;object-fit:cover;"/>' : p.avatarLetter}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
          <span style="font-size:9px;font-weight:900;color:${tc};background:${tb};padding:1px 6px;border-radius:4px;">${p.type}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;">
          <span style="font-size:9px;font-weight:700;color:var(--text-light);">INITIATIVE</span>
          <input class="setup-init-input" type="number" value="${p.initiative}"
            oninput="combatSetInitiative('${p.id}', this.value)"
            style="width:64px;font-size:16px;font-weight:900;text-align:center;"/>
        </div>
        <button onclick="setupRemoveParticipant('${p.id}')"
          style="width:28px;height:28px;border-radius:8px;background:var(--red-l);border:none;color:var(--red);font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:6px;transition:filter .15s;" onmouseenter="this.style.filter='brightness(.88)'" onmouseleave="this.style.filter=''">×</button>
      </div>`;
    }).join('');
}

// ── Actions ───────────────────────────────────────────────────
function selectCombatType(type) {
  _cSetup.type = type;
  if (_combat.isStarted) {
    // En mode combat : re-render complet pour mettre à jour les chips mid-combat
    renderCombatView();
  } else {
    // En setup : mise à jour des classes directement (pas de re-render, évite de perdre le focus)
    ['PJ','PNJ','MONSTRE'].forEach(t => {
      ['chip-', 'mchip-'].forEach(prefix => {
        const el = document.getElementById(prefix + t);
        if (el) el.classList.toggle('cbt-chip-active', t === type);
      });
    });
  }
}

function toggleSetupChar(charId, checked) {
  if (!checked) {
    _cSetup.localSel.delete(charId);
    const p = _combat.participants.find(p => p.localCharId === charId);
    if (p) combatRemoveParticipant(p.id);
  } else {
    _cSetup.localSel.add(charId);
    getCharacter(charId).then(char => {
      if (!char) return;
      // Utiliser getAvatarColor pour cohérence avec le reste de l'app
      combatAddParticipant(char.name, 'PJ', char.hpMax || 10, 0, charId, getAvatarColor(charId), char.profilePhoto || null, char.hpCurrent ?? char.hpMax ?? 10);
      _renderSetup();
    });
    return;
  }
  _renderSetup();
}

function setupRemoveParticipant(id) {
  const p = _combat.participants.find(p => p.id === id);
  if (p?.localCharId) _cSetup.localSel.delete(p.localCharId);
  combatRemoveParticipant(id);
  _renderSetup();
}

function submitManualParticipant() {
  const name = document.getElementById('setup-manual-name')?.value.trim();
  const hp   = parseInt(document.getElementById('setup-manual-hp')?.value) || 10;
  const init = parseInt(document.getElementById('setup-manual-init')?.value) || 0;
  const err  = document.getElementById('setup-manual-error');
  if (!name) { if (err) err.textContent = 'Le nom est obligatoire.'; return; }
  if (err) err.textContent = '';
  combatAddParticipant(_uniqueParticipantName(name), _cSetup.type, Math.max(1, hp), init);
  _renderSetup();
}

function launchCombat() {
  if (_combat.participants.length < 2) return;
  combatStart();
  renderCombatView();
}

// ── Bestiary ──────────────────────────────────────────────────
function _renderBestiarySection() {
  const templates = bestiaryGetAll();
  if (templates.length === 0) return '';
  const open = _cSetup.bestiaryOpen === true;

  const typeClr = t => t === 'PJ' ? 'var(--blue)' : t === 'PNJ' ? '#B8860B' : 'var(--red)';
  const typeBg  = t => t === 'PJ' ? 'var(--blue-l)' : t === 'PNJ' ? 'var(--yellow-l)' : 'var(--red-l)';

  const hoverImportOn  = "this.style.background='rgba(255,209,102,.45)'";
  const hoverImportOff = "this.style.background='var(--yellow-l)'";
  const hoverAddOn     = "this.style.background='rgba(92,200,168,.35)'";
  const hoverAddOff    = "this.style.background='var(--green-l)'";
  const hoverDelOn     = "this.style.background='rgba(255,107,107,.35)'";
  const hoverDelOff    = "this.style.background='var(--red-l)'";

  const cards = open ? templates.map(t => {
    const av = (t.name[0]||'?').toUpperCase();
    const tc = typeClr(t.type);
    const tb = typeBg(t.type);
    const bg = combatColorFor(t.name);
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;
        background:var(--white);border:1.5px solid var(--divider);margin-bottom:6px;">
        <div style="width:36px;height:36px;border-radius:11px;background:${bg};display:flex;align-items:center;
          justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">${av}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.name)}</div>
          <div style="display:flex;gap:6px;margin-top:2px;align-items:center;">
            <span style="font-size:9px;font-weight:900;color:${tc};background:${tb};padding:1px 6px;border-radius:4px;">${t.type}</span>
            <span style="font-size:10px;font-weight:700;color:var(--text-light);">❤️ ${t.maxHp} PV · Init. ${t.initiative}</span>
          </div>
        </div>
        <button onclick="importFromBestiary('${t.id}')" title="Importer dans le formulaire"
          style="padding:6px 10px;border-radius:9px;background:var(--yellow-l);border:1.5px solid rgba(255,209,102,.4);
          font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;color:#B8860B;cursor:pointer;flex-shrink:0;transition:background .15s;"
          onmouseenter="${hoverImportOn}" onmouseleave="${hoverImportOff}">📋</button>
        <button onclick="addFromBestiary('${t.id}')" title="Ajouter au combat"
          style="padding:6px 12px;border-radius:9px;background:var(--green-l);border:1.5px solid rgba(92,200,168,.4);
          font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;color:var(--green-d);cursor:pointer;flex-shrink:0;transition:background .15s;"
          onmouseenter="${hoverAddOn}" onmouseleave="${hoverAddOff}">＋</button>
        <button onclick="removeFromBestiary('${t.id}')" title="Supprimer du bestiaire"
          style="padding:6px 10px;border-radius:9px;background:var(--red-l);border:1.5px solid rgba(255,107,107,.3);color:var(--red);
          font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0;transition:background .15s;"
          onmouseenter="${hoverDelOn}" onmouseleave="${hoverDelOff}">🗑️</button>
      </div>`;
  }).join('') : '';

  return `<div class="setup-section">
    <button class="cbt-bestiary-toggle" onclick="_cSetup.bestiaryOpen=!_cSetup.bestiaryOpen;_renderSetup()">
      <span class="setup-section-label" style="margin:0;">🐉 BESTIAIRE (${templates.length})</span>
      <span style="font-size:12px;color:var(--text-light);">${open ? '▲' : '▼'}</span>
    </button>
    ${cards}
  </div>`;
}


function importFromBestiary(id) {
  const t = bestiaryGetAll().find(t => t.id === id);
  if (!t) return;
  selectCombatType(t.type);
  // _renderSetup re-render le DOM — on attend que les champs existent
  _renderSetup().then(() => {
    const nameEl = document.getElementById('setup-manual-name');
    const hpEl   = document.getElementById('setup-manual-hp');
    const initEl = document.getElementById('setup-manual-init');
    if (nameEl)  nameEl.value  = t.name;
    if (hpEl)    hpEl.value    = t.maxHp;
    if (initEl)  initEl.value  = t.initiative;
    nameEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameEl?.focus();
  });
}

function addFromBestiary(id) {
  const t = bestiaryGetAll().find(t => t.id === id);
  if (!t) return;
  const uniqueName = _uniqueParticipantName(t.name);
  combatAddParticipant(uniqueName, t.type, t.maxHp, t.initiative);
  _renderSetup();
}

function removeFromBestiary(id) {
  bestiaryRemove(id);
  _renderSetup();
}

function submitManualParticipantAndSave() {
  const name = document.getElementById('setup-manual-name')?.value.trim();
  const hp   = parseInt(document.getElementById('setup-manual-hp')?.value)   || 10;
  const init = parseInt(document.getElementById('setup-manual-init')?.value) || 0;
  const err  = document.getElementById('setup-manual-error');
  if (!name) { if (err) err.textContent = 'Le nom est obligatoire.'; return; }
  if (err) err.textContent = '';
  bestiaryAdd(name, _cSetup.type, Math.max(1, hp), init);
  combatAddParticipant(_uniqueParticipantName(name), _cSetup.type, Math.max(1, hp), init);
  _renderSetup();
}