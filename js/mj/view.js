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
  const titles = { sessions: 'Sessions', encounters: 'Rencontres', npcs: 'PNJ' };
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
  _mjRenderShell();
  // Index direct + rétroliens à jour avant de rendre la section
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderSection();
}

function mjAddNew() {
  if (_mjSection === 'sessions')   mjNewSession();
  if (_mjSection === 'encounters') mjNewEncounter();
  if (_mjSection === 'npcs')       mjNewNpc();
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