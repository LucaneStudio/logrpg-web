// MJ — FICHES PJ
// ═══════════════════════════════════════════════════════════════
// Affiche les fiches des personnages locaux en lecture seule
// Réutilise les render functions existantes via ghost div

let _mjPjCharId = null;
let _mjPjTab    = 'caract';

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderPjList() {
  const chars = await getAllCharacters();
  const list  = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = chars.length === 0
    ? `<div class="mj-empty">🧑<br>Aucun personnage local.<br>Les joueurs doivent créer leurs fiches.</div>`
    : chars.map(c => `
        <div class="mj-item-card ${_mjPjCharId === c.id ? 'active' : ''}"
             onclick="mjSelectPj(${c.id})">
          <div class="mj-item-name">${escapeHtml(c.name || 'Sans nom')}</div>
          <div class="mj-item-sub">
            ${c.classe    ? `<span>${escapeHtml(c.classe)}</span>`   : ''}
            ${c.niveau    ? `<span>Niv. ${c.niveau}</span>`          : ''}
            ${c.race      ? `<span>${escapeHtml(c.race)}</span>`     : ''}
          </div>
        </div>`).join('');
}

async function mjSelectPj(charId) {
  _mjPjCharId = charId;
  _mjPjTab    = 'caract';
  await mjRenderPjList();
  await mjRenderPjDetail();
}

// ── Détail : ghost div trick pour réutiliser les render functions ──
async function mjRenderPjDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjPjCharId) {
    detail.innerHTML = `<div class="mj-detail-empty">🧑<br>Sélectionne un personnage</div>`;
    return;
  }

  const char = await getCharacter(_mjPjCharId);
  if (!char) {
    detail.innerHTML = `<div class="mj-detail-empty">Personnage introuvable</div>`;
    return;
  }

  // Onglets (mêmes que le mode joueur, sans Compteurs)
  const tabs = [
    { key:'caract',   label:'⚔️ Caract.'    },
    { key:'capacites',label:'✨ Capacités'  },
    { key:'inventaire',label:'🎒 Inventaire'},
    { key:'notes',    label:'📝 Notes'      },
  ];
  const tabsHtml = tabs.map(t => `
    <button class="mj-tab ${_mjPjTab===t.key?'on':''}" onclick="mjPjSwitchTab('${t.key}')">
      ${t.label}</button>`).join('');

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div class="mj-detail-hdr-left">
        <div class="mj-title-input" style="pointer-events:none;">${escapeHtml(char.name || 'Sans nom')}</div>
        <div class="mj-subtitle-input">
          ${[char.race, char.classe, char.niveau ? 'Niv. '+char.niveau : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
    <div class="mj-tabs">${tabsHtml}</div>
    <div id="mj-pj-content" class="mj-detail-body" style="padding:14px 16px;overflow-y:auto;flex:1;"></div>`;

  await _mjRenderPjTab();
}

async function mjPjSwitchTab(tab) {
  _mjPjTab = tab;
  // Re-render seulement les tabs + contenu
  const tabBtns = document.querySelectorAll('#mj-detail .mj-tab');
  const tabs = ['caract','capacites','inventaire','notes'];
  tabBtns.forEach((btn, i) => btn.classList.toggle('on', tabs[i] === tab));
  await _mjRenderPjTab();
}

async function _mjRenderPjTab() {
  const container = document.getElementById('mj-pj-content');
  if (!container) return;

  // Sauvegarder _selectedCharId et pointer vers le perso MJ
  const prevCharId = _selectedCharId;
  _selectedCharId  = _mjPjCharId;

  // Ghost div trick : masquer #content-area desktop, créer un ghost
  const real = document.getElementById('content-area');
  if (real) real.id = '_mj-pj-hidden';
  const ghost = document.createElement('div');
  ghost.id    = 'content-area';
  ghost.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;visibility:hidden;';
  document.body.appendChild(ghost);

  try {
    if (_mjPjTab === 'caract')    await renderCaractTab();
    if (_mjPjTab === 'capacites') await renderCapacitesTab();
    if (_mjPjTab === 'inventaire')await renderInventaireTab();
    if (_mjPjTab === 'notes')     await renderNotesTab();
    container.innerHTML = ghost.innerHTML;
    // Désactiver les interactions d'édition dans la vue MJ (lecture seule)
    container.querySelectorAll('button, input, textarea, select').forEach(el => {
      el.setAttribute('disabled', 'true');
      el.style.pointerEvents = 'none';
    });
  } finally {
    document.body.removeChild(ghost);
    if (real) real.id = 'content-area';
    _selectedCharId = prevCharId;
  }
}
