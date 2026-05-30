// DB.JS — Persistance IndexedDB
// ═══════════════════════════════════════════════════════════════
const db = new Dexie('LogRPGDatabase');
db.version(1).stores({ characters: '++id, name, createdAt' });

function defaultSlots() {
  return Array.from({length:9}, (_,i) => ({level:i+1, current:0, max:0}));
}

async function createCharacter(data) {
  return await db.characters.add({
    name:            data.name,
    hpMax:           data.hpMax     || 20,
    hpCurrent:       data.hpMax     || 20,
    temporaryHealth: 0,
    manaMax:         data.manaMax   || 0,
    manaCurrent:     data.manaMax   || 0,
    manaTemp:        0,
    manaMode:        'MANA',
    spellSlots:      defaultSlots(),
    currencyMode:    'SINGLE',
    credits:         0,
    createdAt:       Date.now()
  });
}
async function getAllCharacters() {
  return await db.characters.orderBy('createdAt').toArray();
}
async function getCharacter(id) {
  return await db.characters.get(id);
}
async function deleteCharacter(id) {
  await db.characters.delete(id);
}
async function updateCharacterFields(id, fields) {
  await db.characters.update(id, fields);
}

// ── Abilities ─────────────────────────────────────────────────────────────────
function getAbilities(char) {
  try { return char.abilities ? JSON.parse(char.abilities) : []; }
  catch { return []; }
}
async function saveAbilities(charId, abilities) {
  await updateCharacterFields(charId, { abilities: JSON.stringify(abilities) });
}
function newAbilityId() { return 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── Items ─────────────────────────────────────────────────────────────────────
function getItems(char) {
  try { return char.items ? JSON.parse(char.items) : []; }
  catch { return []; }
}
async function saveItems(charId, items) {
  await updateCharacterFields(charId, { items: JSON.stringify(items) });
}
function newItemId() { return 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── Photo de profil ───────────────────────────────────────────────────────────
async function getProfilePhoto(charId) {
  try {
    const c = await getCharacter(charId);
    return c?.profilePhoto || null; // base64 data URL
  } catch { return null; }
}
async function saveProfilePhoto(charId, dataUrl) {
  await updateCharacterFields(charId, { profilePhoto: dataUrl });
}
async function deleteProfilePhoto(charId) {
  await updateCharacterFields(charId, { profilePhoto: null });
}

// ── Notes ─────────────────────────────────────────────────────────────────────
function getNotes(char) {
  try { return char.notes ? JSON.parse(char.notes) : []; }
  catch { return []; }
}
async function saveNotes(charId, notes) {
  await updateCharacterFields(charId, { notes: JSON.stringify(notes) });
}
function newNoteId() { return 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ── Stat sections & widgets ──────────────────────────────────────────────────
// On stocke sections+widgets directement dans le character (JSON) pour éviter
// une migration DB complexe. Structure : [{id, title, widgets:[{id,title,type,value,modifier,accentColor}]}]

function getStatSections(char) {
  try { return char.statSections ? JSON.parse(char.statSections) : []; }
  catch { return []; }
}

async function saveStatSections(charId, sections) {
  await updateCharacterFields(charId, { statSections: JSON.stringify(sections) });
}

function newSectionId() { return 's_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }
function newWidgetId()  { return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

// ═══════════════════════════════════════════════════════════════
// APP.JS — Utilitaires partagés
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let _toastTimer = null;
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  if (id === 'modal-currency-mode' && CS) {
    ['SINGLE','BY_TEN','BY_HUNDRED'].forEach(m => {
      const r = document.getElementById('radio-'+m);
      if (r) r.classList.toggle('selected', CS.currencyMode === m);
    });
  }
  if (id === 'modal-currency-add')   setTimeout(()=>document.getElementById('currency-add-input').focus(), 100);
  if (id === 'modal-currency-spend') setTimeout(()=>document.getElementById('currency-spend-input').focus(), 100);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

function closeDetail() {
  document.getElementById('panel-detail').classList.remove('open');
  // Si c'était une note, on la désépingle et on la déselectionne
  if (_editingNote) {
    _notePinned   = false;
    _editingNote  = null;
    // Retirer le highlight dans la liste
    document.querySelectorAll('.note-card-item').forEach(el => el.classList.remove('note-active'));
  }
}

const TABS = ['tab-fiche','tab-caract','tab-capacites','tab-inventaire','tab-notes'];
function switchTab(tabId) {
  document.querySelectorAll('#main-tabs .tab-btn').forEach((b,i) => b.classList.toggle('active', TABS[i] === tabId));
  // Fermer le panel-detail si on quitte notes ET que la note n'est pas pinnée
  if (tabId !== 'tab-notes' && _editingNote && !_notePinned) {
    _editingNote = null;
    closeDetail();
  }
  if (tabId === 'tab-fiche')        { renderFicheTab();        return; }
  if (tabId === 'tab-caract')      { renderCaractTab();      return; }
  if (tabId === 'tab-capacites')   { renderCapacitesTab();   return; }
  if (tabId === 'tab-inventaire')  { renderInventaireTab();  return; }
  if (tabId === 'tab-notes')       { renderNotesTab();       return; }
  const icons  = {'tab-inventaire':'🎒','tab-notes':'📝'};
  const labels = {'tab-inventaire':'Inventaire','tab-notes':'Notes'};
  document.getElementById('content-area').innerHTML = `
    <div class="empty-panel">
      <div class="emoji">${icons[tabId]}</div>
      <p>${labels[tabId]}<br><span style="font-size:11px;opacity:.7;">Bientôt disponible</span></p>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// CHARACTERS.JS — Liste & sélection
// ═══════════════════════════════════════════════════════════════
const AVATAR_COLORS = [
  'linear-gradient(135deg,#A78BFA,#7C5CDB)',
  'linear-gradient(135deg,#5CC8A8,#3DAF8E)',
  'linear-gradient(135deg,#5B9CF6,#3A7BD5)',
  'linear-gradient(135deg,#FF8C42,#E06030)',
  'linear-gradient(135deg,#FF6B6B,#D94444)',
];
function getInitial(name)   { return name.trim().charAt(0).toUpperCase() || '?'; }
function getAvatarColor(id) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

let _selectedCharId = null;

function renderCharCard(char) {
  const hpPct   = char.hpMax   > 0 ? char.hpCurrent  / char.hpMax   * 100 : 0;
  const manaPct = char.manaMax > 0 ? char.manaCurrent / char.manaMax * 100 : 0;
  const manaBar = char.manaMax > 0 ? `
    <div class="bar-row"><span class="bar-icon">💧</span>
      <div class="bar-track"><div class="bar-fill" style="width:${manaPct}%;background:var(--blue);"></div></div>
    </div>` : '';
  return `
    <div class="card">
      <div class="char-row ${char.id===_selectedCharId?'selected':''}"
           onclick="selectCharacter(${char.id})"
           oncontextmenu="event.preventDefault();openCharContextMenu(event,${char.id},'${escapeHtml(char.name)}')">
        <div class="char-avatar" style="background:${getAvatarColor(char.id)};overflow:hidden;padding:0;cursor:pointer;"
             onclick="event.stopPropagation();openProfilePhotoModal(${char.id})" title="Modifier la photo">
          ${char.profilePhoto
            ? `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;" alt=""/>`
            : `<span>${getInitial(char.name)}</span>`}
        </div>
        <div class="char-info">
          <div class="char-name">${escapeHtml(char.name)}</div>
          <div class="bar-row"><span class="bar-icon">❤️</span>
            <div class="bar-track"><div class="bar-fill" style="width:${hpPct}%;background:var(--red);"></div></div>
          </div>
          ${manaBar}
        </div>
      </div>
    </div>`;
}

async function loadCharacterList() {
  // Mettre à jour aussi la liste mobile si on est sur mobile
  if (window.innerWidth < 1100) {
    await mobLoadCharList();
  }
  const list = document.getElementById('char-list');
  const chars = await getAllCharacters();
  if (chars.length === 0) {
    list.innerHTML = `<div style="padding:18px 4px;text-align:center;color:var(--text-light);">
      <div style="font-size:28px;margin-bottom:6px;opacity:.4;">🧙</div>
      <div style="font-size:11px;font-weight:700;line-height:1.5;">Aucun personnage</div>
    </div>`;
    showWelcomeScreen();
    return;
  }
  // Si l'écran d'accueil était affiché, le cacher
  hideWelcomeScreen();
  list.innerHTML = chars.map(renderCharCard).join('');
  // Sélectionner auto le premier perso si aucun n'est sélectionné
  if (!_selectedCharId && chars.length > 0) {
    selectCharacter(chars[0].id);
  }
}

async function selectCharacter(id) {
  const char = await getCharacter(id);
  if (!char) return;
  _selectedCharId = id;
  // Header global
  const _av = document.getElementById('topbar-char-avatar');
  if (char.profilePhoto) {
    _av.style.background = getAvatarColor(char.id);
    _av.innerHTML = `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:7px;"/>`;
  } else {
    _av.style.background = getAvatarColor(char.id);
    _av.innerHTML = `<span id="topbar-char-initial">${getInitial(char.name)}</span>`;
  }
  document.getElementById('topbar-char-name').textContent = char.name;
  document.getElementById('topbar-char-section').style.display = 'flex';
  // Collapse la sidebar quand un perso est sélectionné
  collapseSidebar();
  // Refresh liste + rail
  await loadCharacterList();
  // Compteurs (sans header nom)
  renderCountersPanel(char);
  // Onglets
  document.getElementById('main-tabs').style.display = 'flex';
  switchTab('tab-fiche');
}

function collapseSidebar() {
  document.getElementById('panel-sidebar').classList.add('collapsed');
  renderCharRail();
}
function expandSidebar() {
  document.getElementById('panel-sidebar').classList.remove('collapsed');
}

async function renderCharRail() {
  const rail = document.getElementById('char-rail');
  if (!rail) return;
  const chars = await getAllCharacters();
  rail.innerHTML = chars.map(char => `
    <div class="rail-avatar ${char.id===_selectedCharId?'selected':''}"
         style="background:${char.profilePhoto ? getAvatarColor(char.id) : getAvatarColor(char.id)};overflow:hidden;padding:0;"
         onclick="selectCharacterFromRail(${char.id})"
         oncontextmenu="event.preventDefault();openCharContextMenu(event,${char.id},'${escapeHtml(char.name)}')"
         title="${escapeHtml(char.name)}">
      ${char.profilePhoto
        ? `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;" alt=""/>`
        : `<span style="font-size:16px;font-weight:900;color:#fff;">${getInitial(char.name)}</span>`}
    </div>`).join('');
}

async function selectCharacterFromRail(id) {
  const char = await getCharacter(id);
  if (!char) return;
  _selectedCharId = id;
  const _av = document.getElementById('topbar-char-avatar');
  if (char.profilePhoto) {
    _av.style.background = getAvatarColor(char.id);
    _av.innerHTML = `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:7px;"/>`;
  } else {
    _av.style.background = getAvatarColor(char.id);
    _av.innerHTML = `<span id="topbar-char-initial">${getInitial(char.name)}</span>`;
  }
  document.getElementById('topbar-char-name').textContent = char.name;
  document.getElementById('topbar-char-section').style.display = 'flex';
  renderCharRail(); // refresh sélection dans le rail
  renderCountersPanel(char);
  document.getElementById('main-tabs').style.display = 'flex';
  switchTab('tab-fiche');
}

function openCreateCharModal() {
  ['form-char-name','form-char-hp','form-char-mana'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('form-char-error').textContent = '';
  openModal('modal-create-char');
  setTimeout(() => document.getElementById('form-char-name').focus(), 100);
}

async function submitCreateChar() {
  const name  = document.getElementById('form-char-name').value.trim();
  const error = document.getElementById('form-char-error');
  if (!name) { error.textContent = 'Le nom est obligatoire.'; return; }
  const hpMax   = parseInt(document.getElementById('form-char-hp').value)   || 20;
  const manaMax = parseInt(document.getElementById('form-char-mana').value) || 0;
  try {
    const id = await createCharacter({ name, hpMax, manaMax });
    closeModal('modal-create-char');
    await loadCharacterList();
    showToast(`✨ ${name} créé !`);
    await selectCharacter(id);
  } catch(e) {
    error.textContent = 'Erreur lors de la sauvegarde.';
    console.error(e);
  }
}

function confirmDelete(id, name) {
  if (confirm(`Supprimer ${name} ? Cette action est irréversible.`)) doDelete(id, name);
}

// Context menu personnage
let _ctxCharId = null, _ctxCharName = null;
function openCharContextMenu(e, id, name) {
  _ctxCharId = id; _ctxCharName = name;
  const menu = document.getElementById('char-context-menu');
  document.getElementById('char-context-title').textContent = name;
  menu.style.display = 'block';
  const menuW = 220, menuH = 100;
  let x = e.clientX, y = e.clientY;
  if (x + menuW > window.innerWidth)  x = window.innerWidth  - menuW - 8;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}
function closeCharContextMenu() {
  document.getElementById('char-context-menu').style.display = 'none';
  _ctxCharId = null; _ctxCharName = null;
}
function renameCharFromCtx() {
  const id = _ctxCharId, name = _ctxCharName;
  closeCharContextMenu();
  document.getElementById('rename-char-input').value = name || '';
  document.getElementById('rename-char-error').textContent = '';
  document.getElementById('rename-char-id').value = id;
  openModal('modal-rename-char');
  setTimeout(() => { const inp = document.getElementById('rename-char-input'); inp.focus(); inp.select(); }, 100);
}
async function submitRenameChar() {
  const id    = parseInt(document.getElementById('rename-char-id').value);
  const name  = document.getElementById('rename-char-input').value.trim();
  if (!name) { document.getElementById('rename-char-error').textContent = 'Le nom est obligatoire.'; return; }
  await updateCharacterFields(id, { name });
  closeModal('modal-rename-char');
  await loadCharacterList();
  // Mettre à jour la topbar si c'est le perso sélectionné
  if (id === _selectedCharId) {
    document.getElementById('topbar-char-name').textContent = name;
  }
  showToast('✅ Personnage renommé !');
}
function deleteCharFromContext() {
  const id = _ctxCharId, name = _ctxCharName;
  closeCharContextMenu();
  confirmDelete(id, name);
}
async function doDelete(id, name) {
  await deleteCharacter(id);
  if (_selectedCharId === id) {
    _selectedCharId = null;
    CS = null;
    document.getElementById('topbar-char-section').style.display = 'none';
    document.getElementById('counters-content').innerHTML = `<div class="empty-panel"><div class="emoji">🎯</div><p>Sélectionne un personnage<br>pour voir ses compteurs</p></div>`;
    document.getElementById('counters-char-header').innerHTML = '';
    document.getElementById('main-tabs').style.display = 'none';
    document.getElementById('content-area').innerHTML = `<div class="empty-panel"><div class="emoji">🧙</div><p>Sélectionne un personnage<br>pour accéder à sa fiche</p></div>`;
    expandSidebar();
  }
  await loadCharacterList();
  await initMobileApp();
  showToast(`🗑️ ${name} supprimé.`);
}

// ═══════════════════════════════════════════════════════════════
