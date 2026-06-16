// MJ — VUE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let _mjSection = 'sessions';   // 'sessions' | 'encounters' | 'npcs'

// ── Ouverture / Fermeture ─────────────────────────────────────
async function openMjMode() {
  if (window.innerWidth < 1100) return;
  document.getElementById('mj-overlay').style.display = 'flex';
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderAll();
}

function closeMjMode() {
  document.getElementById('mj-overlay').style.display = 'none';
}

// ── Render complet ────────────────────────────────────────────
async function _mjRenderAll() {
  _mjRenderShell();
  await _mjRenderSection();
}

function _mjRenderShell() {
  document.getElementById('mj-overlay').innerHTML = `
    <div class="mj-topbar">
      <div class="mj-topbar-left">
        <span class="mj-topbar-title">Mode MJ</span>
        <span class="mj-topbar-badge">MAÎTRE DE JEU</span>
      </div>
      <div class="spacer"></div>
      <button class="mj-btn-combat" onclick="closeMjMode();openCombatSetup()">⚡ Combat rapide</button>
      <button class="mj-btn-export" onclick="mjExportZip()">📤 Exporter</button>
      <button class="mj-btn-export" onclick="_mjTriggerImport()" title="Importer un fichier .zip">📥 Importer</button>
      <button class="mj-btn-close" onclick="closeMjMode()">✕ Fermer</button>
    </div>

    <div class="mj-body">
      <div class="mj-nav" id="mj-nav">
        <div class="mj-nav-group">PRÉPARER</div>
        <button class="mj-nav-btn ${_mjSection==='sessions'?'on':''}"
          onclick="mjSwitchSection('sessions')">📅 Sessions</button>
        <button class="mj-nav-btn ${_mjSection==='encounters'?'on':''}"
          onclick="mjSwitchSection('encounters')">⚔️ Rencontres</button>
        <div class="mj-nav-hr"></div>
        <div class="mj-nav-group">RESSOURCES</div>
        <button class="mj-nav-btn ${_mjSection==='npcs'?'on':''}"
          onclick="mjSwitchSection('npcs')">👥 PNJ</button>
        <button class="mj-nav-btn ${_mjSection==='objects'?'on':''}"
          onclick="mjSwitchSection('objects')">📦 Objets</button>
        <button class="mj-nav-btn ${_mjSection==='places'?'on':''}"
          onclick="mjSwitchSection('places')">📍 Lieux</button>
        <button class="mj-nav-btn ${_mjSection==='assets'?'on':''}"
          onclick="mjSwitchSection('assets')">🖼️ Images</button>
        <div class="mj-nav-hr"></div>
        <div class="mj-nav-group">JOUEURS</div>
        <button class="mj-nav-btn ${_mjSection==='pj'?'on':''}"
          onclick="mjSwitchSection('pj')">🧑 Fiches PJ</button>
      </div>

      <div class="mj-list" id="mj-list"
        style="overflow:hidden;transition:width .2s ease;">
        <div class="mj-list-hdr">
          <span id="mj-list-title" class="mj-list-title"></span>
          <button class="mj-add-pill" id="mj-add-btn" onclick="mjAddNew()"
            style="${_mjSection==='pj'?'display:none':''}">
            ${_mjSection==='assets'?'📤 Importer':'＋ Nouveau'}</button>
        </div>
        <div class="mj-list-body" id="mj-list-body"></div>
      </div>
      ${_mjSection==='sessions' ? `<button id="mj-sessions-toggle" onclick="mjToggleSessionsList()"
        title="${_mjSessionListOpen?'Réduire la liste':'Afficher la liste'}"
        style="width:18px;flex-shrink:0;background:var(--surface);border:none;
        border-right:1px solid rgba(0,0,0,.06);border-left:1px solid rgba(0,0,0,.06);
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:9px;color:var(--text-light);transition:background .15s;"
        onmouseenter="this.style.background='var(--divider)'"
        onmouseleave="this.style.background='var(--surface)'">
        ${_mjSessionListOpen?'◀':'▶'}</button>` : ''}

      <div class="mj-detail" id="mj-detail">
        <div class="mj-detail-empty">Sélectionne un élément</div>
      </div>
    </div>`;
}

async function _mjRenderSection() {
  const titles = { sessions: 'Sessions', encounters: 'Rencontres', npcs: 'PNJ', objects: 'Objets', places: 'Lieux' };
  const titleEl = document.getElementById('mj-list-title');
  if (titleEl) titleEl.textContent = titles[_mjSection] || '';

  if (_mjSection === 'sessions') {
    await mjRenderSessionsList();
    mjRenderSessionDetail();
  } else if (_mjSection === 'encounters') {
    await mjRenderEncountersList();
    mjRenderEncounterDetail();
  } else if (_mjSection === 'npcs') {
    await mjRenderNpcsList();
    await mjRenderNpcDetail();
  } else if (_mjSection === 'objects') {
    await mjRenderObjectsList();
    await mjRenderObjectDetail();
  } else if (_mjSection === 'places') {
    await mjRenderPlacesList();
    await mjRenderPlaceDetail();
  } else if (_mjSection === 'pj') {
    await mjRenderPjList();
    await mjRenderPjDetail();
  } else if (_mjSection === 'assets') {
    await mjRenderAssetsList();
    await mjRenderAssetDetail();
  }
}

async function mjSwitchSection(section) {
  _mjSection = section;
  // Reset sélection
  if (section === 'sessions')   { _mjSession  = null; }
  if (section === 'pj')         { _mjPjCharId = null; }
  if (section === 'assets')     { _mjAssetSelected = null; }
  if (section === 'encounters') { _mjEncounter = null; }
  if (section === 'npcs')       { _mjNpc       = null; }
  if (section === 'objects')    { _mjObject    = null; }
  if (section === 'places')     { _mjPlace     = null; }
  _mjRenderShell();
  // Index direct + rétroliens à jour avant de rendre la section
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderSection();
}

function mjAddNew() {
  if (_mjSection === 'sessions')   mjNewSession();
  if (_mjSection === 'encounters') mjNewEncounter();
  if (_mjSection === 'npcs')       mjNewNpc();
  if (_mjSection === 'objects')    mjNewObject();
  if (_mjSection === 'places')     mjNewPlace();
  if (_mjSection === 'assets')     mjAddAsset();
}

// ── Retour au mode MJ après un combat lancé depuis une rencontre ──
function returnToMjMode() {
  document.getElementById('mj-overlay').style.display = 'flex';
}

function _mjTriggerImport() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.zip';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await mjImportZip(file);
  };
  input.click();
}

// ── Menu contextuel générique des items MJ (clic droit → Supprimer) ──
// Réutilisé par toutes les listes (sessions, scénarios, PNJ, objets, lieux,
// combats, images). L'action passée ouvre la modale de confirmation dédiée.
let _mjItemCtxAction = null;
function mjItemContext(ev, action) {
  if (typeof action !== 'function') return true;
  ev.preventDefault(); ev.stopPropagation();
  _mjItemCtxAction = action;
  let el = document.getElementById('mj-item-ctx');
  if (!el) {
    el = document.createElement('div'); el.id = 'mj-item-ctx';
    el.innerHTML = `<div class="mj-wdgctx-backdrop" oncontextmenu="event.preventDefault();mjItemCtxClose();return false;" onclick="mjItemCtxClose()"></div>`
      + `<div class="mj-wdgctx-card" id="mj-itemctx-card"><div class="mj-wdgctx-item danger" onclick="mjItemCtxRun()">🗑️ Supprimer</div></div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'block';
  const card = el.querySelector('#mj-itemctx-card');
  card.style.left = '0px'; card.style.top = '0px';
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let left = ev.clientX, top = ev.clientY;
  if (left + cw > window.innerWidth  - 8) left = window.innerWidth  - 8 - cw;
  if (top  + ch > window.innerHeight - 8) top  = window.innerHeight - 8 - ch;
  card.style.left = Math.max(8, left) + 'px';
  card.style.top  = Math.max(8, top)  + 'px';
  return false;
}
function mjItemCtxClose() { const el = document.getElementById('mj-item-ctx'); if (el) el.style.display = 'none'; _mjItemCtxAction = null; }
function mjItemCtxRun() { const a = _mjItemCtxAction; mjItemCtxClose(); if (typeof a === 'function') a(); }