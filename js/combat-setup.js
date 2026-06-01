// COMBAT SETUP
// ═══════════════════════════════════════════════════════════════

let _cSetup = { localSel: new Set(), type: 'MONSTRE' };

// ── Entrée ────────────────────────────────────────────────────
async function openCombatSetup() {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE' };
  document.getElementById('combat-overlay').style.display = 'flex';
  await _renderSetup();
}

function closeCombatOverlay() {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE' };
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
        <button class="cbt-cancel-btn" onclick="closeCombatOverlay()">✕ Annuler</button>
      </div>
      <div class="cbt-setup-body">
        <div class="cbt-setup-col scroll">
          ${chars.length ? _renderLocalSection(chars) : ''}
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
      <button onclick="submitManualParticipant()" class="cbt-add-manual-btn">＋ Ajouter</button>
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
          style="width:28px;height:28px;border-radius:8px;background:var(--red-l);border:none;color:var(--red);font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:6px;">×</button>
      </div>`;
    }).join('');
}

// ── Actions ───────────────────────────────────────────────────
function selectCombatType(type) {
  _cSetup.type = type;
  if (_combat.isStarted) {
    // En mode combat : re-render le panneau droit pour refléter le changement
    const right = document.querySelector('.cbt-right-panel');
    if (right) right.innerHTML = _renderRightPanel();
  } else {
    // En setup : mise à jour des classes directement
    ['PJ','PNJ','MONSTRE'].forEach(t => {
      const el = document.getElementById(`chip-${t}`);
      if (el) el.classList.toggle('cbt-chip-active', t === type);
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
  combatAddParticipant(name, _cSetup.type, Math.max(1, hp), init);
  _renderSetup();
}

function launchCombat() {
  if (_combat.participants.length < 2) return;
  combatStart();
  renderCombatView();
}