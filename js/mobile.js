// APP MOBILE
// ═══════════════════════════════════════════════════════════════

let _mobCharId        = null;
let _mobTab           = 'tab-fiche';
let _mobLongPressTimer = null;

// ── Init mobile ───────────────────────────────────────────────────────────────
async function initMobileApp() {
  if (window.innerWidth >= 1100) return;
  await mobLoadCharList();
}

async function mobLoadCharList() {
  const chars = await getAllCharacters();
  const list  = document.getElementById('mob-char-list');
  if (!list) return;

  if (chars.length === 0) {
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  padding:40px 20px;text-align:center;gap:16px;flex:1;">
        <svg width="72" height="72" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.7186 3C20.7123 3 22.249 3.4878 23.3289 4.46339C24.4254 5.42245 24.9736 6.76178 24.9736 8.48146C24.9736 9.58933 24.7244 10.5567 24.226 11.3834C23.7442 12.1937 23.0381 12.8221 22.1077 13.2685C21.8186 13.4046 21.5078 13.5188 21.1754 13.6118C21.4715 13.6983 21.749 13.8238 22.0081 13.9878C22.5563 14.3186 23.0132 14.8311 23.3787 15.5256L24.6248 17.7579C24.8906 18.2374 25.0151 18.7087 24.9985 19.1717C24.9819 19.6181 24.7992 19.9902 24.4504 20.2878C24.1181 20.5689 23.628 20.7095 22.9801 20.7095C22.3321 20.7095 21.8004 20.5772 21.385 20.3126C20.9863 20.048 20.6292 19.6346 20.3135 19.0724L18.0458 14.9303C17.8464 14.5666 17.5889 14.3185 17.2732 14.1862C16.9742 14.0374 16.6253 13.963 16.2266 13.963H14.8565V17.609C14.8565 19.7255 13.9836 21.3295 12.7874 22.3878C11.5912 23.4626 9.88001 24 7.65378 24C6.74005 24 5.88447 23.9339 5.08703 23.8016C4.28959 23.6859 3.60007 23.5123 3.0186 23.2808C2.53681 23.1155 2.19614 22.8757 1.99677 22.5615C1.79741 22.2474 1.70608 21.9166 1.7227 21.5693C1.73931 21.2221 1.83065 20.9079 1.99677 20.6268C2.17952 20.3457 2.42045 20.139 2.71947 20.0067C3.01852 19.891 3.35088 19.8992 3.71638 20.0315C4.44735 20.3292 5.11186 20.5194 5.70993 20.602C6.30799 20.7012 6.81474 20.7508 7.23007 20.7508C8.24351 20.7508 8.99955 20.5359 9.49796 20.1059C10.0129 19.6925 10.2705 19.0394 10.2705 18.1466V17.0196C9.98784 17.5207 9.54762 17.946 8.94968 18.2954C8.18545 18.7253 7.35468 18.9403 6.45754 18.9403C5.36109 18.9402 4.40584 18.6922 3.5918 18.1962C2.77774 17.6836 2.13805 16.9725 1.67287 16.0631C1.2243 15.1536 1 14.087 1 12.8634C1.00001 11.9374 1.13298 11.1024 1.39879 10.3583C1.6646 9.61423 2.03007 8.97764 2.49523 8.44852C2.97701 7.9194 3.55018 7.51422 4.2147 7.23312C4.89585 6.93549 5.6435 6.78661 6.45754 6.78661C7.38791 6.78661 8.21868 7.00159 8.94968 7.43151C9.51556 7.75692 9.93849 8.15824 10.2188 8.63523C10.2311 8.53186 10.2485 8.43278 10.2706 8.33791V5.30668C10.2706 4.56262 10.4699 3.99215 10.8686 3.5953C11.284 3.19845 11.8572 3 12.5882 3H18.7186ZM7.82819 10.0359C7.36304 10.0359 6.94774 10.1516 6.58226 10.3831C6.21676 10.598 5.93421 10.9205 5.73485 11.3504C5.5521 11.7637 5.46078 12.2681 5.46077 12.8634C5.46077 13.7563 5.67677 14.4508 6.10872 14.9469C6.54067 15.4429 7.11382 15.6909 7.82819 15.691C8.3266 15.691 8.75029 15.5835 9.09918 15.3686C9.44805 15.1371 9.72218 14.8146 9.92154 14.4013C10.1209 13.9714 10.2205 13.4586 10.2205 12.8634C10.2205 11.9705 10.0046 11.2761 9.57271 10.78C9.14076 10.2839 8.55919 10.0359 7.82819 10.0359ZM14.856 10.7385H17.8963C18.7768 10.7385 19.4496 10.5649 19.9147 10.2176C20.3799 9.87039 20.6125 9.33301 20.6125 8.60545C20.6125 7.91098 20.3799 7.3901 19.9147 7.04286C19.4496 6.67911 18.7767 6.49716 17.8963 6.49716H14.856V10.7385Z" fill="url(#mob_grad)"/><defs><linearGradient id="mob_grad" x1="1" y1="3" x2="21.8142" y2="26.7876" gradientUnits="userSpaceOnUse"><stop stop-color="#5CC8A8"/><stop offset="1" stop-color="#3DAF8E"/></linearGradient></defs></svg>
        <div>
          <div style="font-size:18px;font-weight:900;color:#2C3E50;margin-bottom:6px;">Bienvenue sur LogRPG</div>
          <div style="font-size:13px;color:#6B7C8E;font-weight:600;line-height:1.5;">Crée ou importe ton premier personnage pour commencer.</div>
        </div>
        <button onclick="mobOpenCreateChar()" style="padding:13px 28px;border-radius:99px;background:#5CC8A8;border:none;color:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;">✨ Créer un personnage</button>
        <button onclick="mobTriggerImport()" style="padding:10px 24px;border-radius:99px;background:white;border:1.5px solid #E8ECF0;color:#2C3E50;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">📥 Importer un personnage</button>
      </div>`;
    return;
  }

  const addBtn = `<button onclick="mobOpenCreateChar()" style="width:100%;padding:14px;border-radius:16px;border:2px dashed rgba(92,200,168,.4);background:white;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;color:#5CC8A8;cursor:pointer;">＋ Ajouter un personnage</button>`;

  list.innerHTML = chars.map(char => {
    const hpPct = char.hpMax > 0 ? Math.min(char.hpCurrent || 0, char.hpMax) / char.hpMax * 100 : 0;
    const avatarContent = char.profilePhoto
      ? `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;"/>`
      : `<span style="font-size:19px;font-weight:900;color:#fff;">${getInitial(char.name)}</span>`;

    // Ligne mana/sorts selon manaMode
    let manaRow = '';
    if (char.manaMode === 'SPELL_SLOTS') {
      const slots = ((char.spellSlots || []).filter(s => s.max > 0));
      if (slots.length > 0) {
        const total   = slots.reduce((a, s) => a + s.max,     0);
        const current = slots.reduce((a, s) => a + s.current, 0);
        const pills = slots.map(s => {
          const depleted = s.current === 0;
          return `<div class="char-slot-pill ${depleted ? 'empty' : ''}" title="Niveau ${s.level}">${s.current}</div>`;
        }).join('');
        manaRow = `<div style="display:flex;align-items:center;gap:5px;margin-top:4px;">
          <span style="font-size:11px;">📖</span>
          <div style="display:flex;gap:3px;align-items:center;flex:1;flex-wrap:wrap;">${pills}</div>
        </div>`;
      }
    } else if (char.manaMax > 0) {
      const mpPct = Math.min(char.manaCurrent || 0, char.manaMax) / char.manaMax * 100;
      manaRow = `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <span style="font-size:11px;">💧</span>
        <div style="flex:1;height:6px;background:#EEF2F5;border-radius:99px;overflow:hidden;">
          <div style="width:${mpPct}%;height:100%;background:#5B9CF6;border-radius:99px;"></div>
        </div>
      </div>`;
    }

    return `
    <div class="mob-char-card" data-id="${char.id}"
         ontouchstart="mobLongPressStart(event,${char.id},'${escapeHtml(char.name)}')"
         ontouchend="mobLongPressCancel(event,${char.id})"
         ontouchmove="mobLongPressMove(event)"
         onclick="mobSelectChar(${char.id})">
      <div style="width:52px;height:52px;border-radius:14px;overflow:hidden;background:${getAvatarColor(char.id)};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${avatarContent}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:900;color:#2C3E50;margin-bottom:6px;">${escapeHtml(char.name)}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;">❤️</span>
          <div style="flex:1;height:6px;background:#EEF2F5;border-radius:99px;overflow:hidden;">
            <div style="width:${hpPct}%;height:100%;background:#FF6B6B;border-radius:99px;"></div>
          </div>
        </div>
        ${manaRow}
      </div>
      <button onclick="mobCardOpenMenu(event,${char.id},'${escapeHtml(char.name)}')" title="Options" style="width:34px;height:34px;border-radius:10px;background:#F5F7F8;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#6B7C8E;">⋯</button>
    </div>`;
  }).join('') + addBtn;
}

// ── Navigation ─────────────────────────────────────────────────────────────────
async function mobSelectChar(id) {
  _mobCharId = id;
  _selectedCharId = id;
  const char = await getCharacter(id);
  if (!char) return;
  const av = document.getElementById('mob-avatar');
  av.style.background = getAvatarColor(char.id);
  if (char.profilePhoto) av.innerHTML = `<img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;"/>`;
  else av.innerHTML = `<span style="font-size:19px;font-weight:900;color:#fff;">${getInitial(char.name)}</span>`;
  document.getElementById('mob-char-name').textContent = char.name;
  document.getElementById('mob-screen-list').style.display   = 'none';
  document.getElementById('mob-screen-detail').style.display = 'flex';
  mobRenderCounters(char);
  mobSwitchTab(_mobTab);
}

function mobGoBack() {
  document.getElementById('mob-screen-detail').style.display = 'none';
  document.getElementById('mob-screen-list').style.display   = 'flex';
  _editingNote = null; _notePinned = false;
  mobLoadCharList();
}

function mobSwitchTab(tabId) {
  _mobTab = tabId;

  document.querySelectorAll('#mob-tabs .mob-tab').forEach(btn => {
    const match = btn.getAttribute('onclick') && btn.getAttribute('onclick').match(/mobSwitchTab.'([^']+)'\./);
    const btnTab = match ? match[1] : '';
    btn.classList.toggle('active', btnTab === tabId);
  });

  const countersZone = document.getElementById('mob-counters-zone');
  const mobileArea   = document.getElementById('content-area-mobile');

  if (tabId === 'tab-compteurs') {
    if (countersZone) countersZone.style.display = 'block';
    if (mobileArea)   mobileArea.style.display   = 'none';
    getCharacter(_mobCharId).then(char => { if (char) mobRenderCounters(char); });
    return;
  }

  if (countersZone) countersZone.style.display = 'none';
  if (mobileArea)   mobileArea.style.display   = 'block';

  mobRenderTab(tabId, mobileArea);
}

async function mobRenderTab(tabId, mobileArea) {
  if (!_mobCharId) return;
  if (tabId === 'tab-capacites')  { _capSearch = ''; }
  if (tabId === 'tab-inventaire') { _invSearch = ''; _invFilter = 'ALL'; }
  if (tabId === 'tab-notes')      { _notesSearch = ''; }
  mobileArea.innerHTML = '<div style="text-align:center;padding:40px;color:#6B7C8E;font-size:13px;font-weight:700;">Chargement…</div>';
  await _mobDoRender(mobileArea);
}

// ── Render centralisé avec verrou anti-race-condition ─────────────────────────
let _mobRenderLock    = false;
let _mobRenderPending = false;

async function mobRefreshCurrentTab() {
  if (!_mobCharId) return;
  if (window.innerWidth >= 1100) return;

  if (_mobTab === 'tab-compteurs') {
    const char = await getCharacter(_mobCharId);
    if (char) mobRenderCounters(char);
    return;
  }

  const mobileArea = document.getElementById('content-area-mobile');
  if (!mobileArea) return;

  if (_mobRenderLock) { _mobRenderPending = true; return; }

  await _mobDoRender(mobileArea);
}

async function _mobDoRender(mobileArea) {
  _mobRenderLock    = true;
  _mobRenderPending = false;

  // ── CLEF DU FIX ──────────────────────────────────────────────────────────
  // Il existe déjà un #content-area dans #app (desktop, caché sur mobile).
  // getElementById retourne TOUJOURS le premier trouvé dans le DOM.
  // On renomme temporairement l'id desktop pour que les fonctions de render
  // écrivent dans notre ghost div à la place.
  const desktopArea = document.getElementById('content-area');
  if (desktopArea) desktopArea.id = '_content-area-hidden';

  const ghost = document.createElement('div');
  ghost.id = 'content-area';
  ghost.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:390px;pointer-events:none;';
  document.body.appendChild(ghost);

  try {
    _selectedCharId = _mobCharId;
    const tab = _mobTab;

    if      (tab === 'tab-fiche')      { _ficheCharId  = _mobCharId; await renderFicheTab(); }
    else if (tab === 'tab-caract')     { _caractCharId = _mobCharId; await renderCaractTab(); }
    else if (tab === 'tab-capacites')  { _capCharId    = _mobCharId; await renderCapacitesTab(); }
    else if (tab === 'tab-inventaire') { _invCharId    = _mobCharId; await renderInventaireTab(); }
    else if (tab === 'tab-notes')      { _notesCharId  = _mobCharId; await renderNotesTab(); }

    // Ne copier que si l'onglet n'a pas changé pendant l'await
    if (_mobTab === tab) {
      mobileArea.innerHTML = ghost.innerHTML;
      // Rebinder le touch drag&drop après copie HTML (les listeners ne se clonent pas)
      if (tab === 'tab-caract') _bindDragDrop();
    }
  } catch(e) {
    console.error('[_mobDoRender]', e);
  } finally {
    // Toujours restaurer l'id desktop et supprimer le ghost
    if (desktopArea) desktopArea.id = 'content-area';
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    _mobRenderLock = false;

    // Rejouer si un refresh a été demandé pendant ce render
    if (_mobRenderPending) {
      const area = document.getElementById('content-area-mobile');
      if (area) await _mobDoRender(area);
    }
  }
}

// ── Render compteurs mobile ───────────────────────────────────────────────────
// counters-content existe en double (desktop + mobile) → même problème que content-area.
function mobRenderCounters(char) {
  const desktopCounters = document.querySelector('.panel-counters #counters-content');
  if (desktopCounters) desktopCounters.id = '_counters-content-hidden';
  renderCountersPanel(char);
  if (desktopCounters) desktopCounters.id = 'counters-content';
}

// ── Monkey-patch renderCountersContent pour les mises à jour (adjHp, etc.) ───
// Toutes les actions sur les compteurs appellent renderCountersContent() directement.
// Sans ce patch, elles écrivent dans le #counters-content desktop (premier du DOM).
const _origRenderCountersContent = renderCountersContent;
renderCountersContent = function() {
  if (window.innerWidth >= 1100) { _origRenderCountersContent(); return; }
  const desktopCounters = document.querySelector('.panel-counters #counters-content');
  if (desktopCounters) desktopCounters.id = '_counters-content-hidden';
  _origRenderCountersContent();
  if (desktopCounters) desktopCounters.id = 'counters-content';
};

// ── Wrappers refresh tab : appelés depuis caract.js, capacites.js, etc. ──────
function _isMobile() { return window.innerWidth < 1100; }

async function refreshCaractTab()     { if (_isMobile()) await mobRefreshCurrentTab(); else await renderCaractTab(); }
async function refreshCapacitesTab()  { if (_isMobile()) await mobRefreshCurrentTab(); else await renderCapacitesTab(); }
async function refreshInventaireTab() { if (_isMobile()) await mobRefreshCurrentTab(); else await renderInventaireTab(); }
async function refreshNotesTab()      { if (_isMobile()) await mobRefreshCurrentTab(); else await renderNotesTab(); }

// ── Menu contextuel : helper d'ouverture ──────────────────────────────────────
// openCharContextMenu attend un event avec clientX/clientY ; on lui fournit un
// faux event positionné sur les coordonnées fournies (touch ou bouton).
function _mobOpenMenuAt(x, y, id, name) {
  openCharContextMenu({
    clientX: x, clientY: y,
    preventDefault: ()=>{}, stopPropagation: ()=>{}
  }, id, name);
}

// ── Appui long → menu contextuel (avec seuil de mouvement) ────────────────────
// iOS émet des touchmove en permanence : on n'annule que si le doigt bouge
// vraiment (> MOVE_THRESHOLD px), sinon l'appui long ne se déclenche jamais.
const MOVE_THRESHOLD = 10;
let _mobLongPressed = false;
let _lpStartX = 0, _lpStartY = 0;

function mobLongPressStart(e, id, name) {
  _mobLongPressed = false;
  const t = e.touches[0];
  _lpStartX = t.clientX; _lpStartY = t.clientY;
  mobLongPressEnd();
  _mobLongPressTimer = setTimeout(() => {
    _mobLongPressed = true;
    _mobOpenMenuAt(_lpStartX, _lpStartY, id, name);
  }, 500);
}
function mobLongPressMove(e) {
  if (!_mobLongPressTimer) return;
  const t = e.touches[0];
  if (Math.abs(t.clientX - _lpStartX) > MOVE_THRESHOLD ||
      Math.abs(t.clientY - _lpStartY) > MOVE_THRESHOLD) {
    mobLongPressEnd();
  }
}
function mobLongPressEnd() {
  if (_mobLongPressTimer) { clearTimeout(_mobLongPressTimer); _mobLongPressTimer = null; }
}
function mobLongPressCancel(e, id) {
  if (_mobLongPressed) { e.preventDefault(); _mobLongPressed = false; }
  mobLongPressEnd();
}

// Bouton ⋯ d'une carte perso (écran liste)
function mobCardOpenMenu(e, id, name) {
  e.stopPropagation();           // ne pas sélectionner le perso
  mobLongPressEnd();
  const r = e.currentTarget.getBoundingClientRect();
  _mobOpenMenuAt(r.left, r.bottom, id, name);
}

// ── Appui long sur le header détail ───────────────────────────────────────────
let _mobDetailLpTimer = null;
let _dlpStartX = 0, _dlpStartY = 0;

function mobDetailLongPressStart(e) {
  const t = e.touches[0];
  _dlpStartX = t.clientX; _dlpStartY = t.clientY;
  mobDetailLongPressEnd();
  _mobDetailLpTimer = setTimeout(async () => {
    const char = await getCharacter(_mobCharId);
    if (!char) return;
    _mobOpenMenuAt(_dlpStartX, _dlpStartY, _mobCharId, char.name);
  }, 500);
}
function mobDetailLongPressMove(e) {
  if (!_mobDetailLpTimer) return;
  const t = e.touches[0];
  if (Math.abs(t.clientX - _dlpStartX) > MOVE_THRESHOLD ||
      Math.abs(t.clientY - _dlpStartY) > MOVE_THRESHOLD) {
    mobDetailLongPressEnd();
  }
}
function mobDetailLongPressEnd() {
  if (_mobDetailLpTimer) { clearTimeout(_mobDetailLpTimer); _mobDetailLpTimer = null; }
}

// Bouton ⋯ du header détail
async function mobDetailOpenMenu(e) {
  e.stopPropagation();
  mobDetailLongPressEnd();
  if (!_mobCharId) return;
  const char = await getCharacter(_mobCharId);
  if (!char) return;
  const r = e.currentTarget.getBoundingClientRect();
  _mobOpenMenuAt(r.left, r.bottom, _mobCharId, char.name);
}

// ── Create / Import mobile ────────────────────────────────────────────────────
function mobOpenCreateChar() { openCreateCharModal(); }
function mobTriggerImport()  { triggerImport(); }

// ═══════════════════════════════════════════════════════════════