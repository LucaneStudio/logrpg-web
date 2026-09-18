// MJ — CARTES (liste+détail, image de fond + pins — voir js/mj/tags.js
// pour l'index @tag et js/mj/db.js pour le CRUD mj_maps)
// ═══════════════════════════════════════════════════════════════

let _mjMap = null;
let _mjMapEditingPinId = null;   // id du pin en cours d'édition (carte flottante ouverte), ou null
let _mjMapHidePins = false;      // mode présentation : masque tous les pins, jamais persisté
let _mjMapAssetUrlCache = {};    // assetId -> object URL déjà créée, pour ne pas recréer un
                                  // nouveau blob (donc recharger/clignoter l'<img>) à chaque
                                  // rendu déclenché par une interaction sur un pin

async function _mjMapGetAssetUrl(assetId) {
  if (!assetId) return null;
  if (_mjMapAssetUrlCache[assetId]) return _mjMapAssetUrlCache[assetId];
  const url = await mjAssetToUrl(assetId);
  if (url) _mjMapAssetUrlCache[assetId] = url;
  return url;
}
function _mjMapInvalidateAssetUrl(assetId) {
  if (!assetId || !_mjMapAssetUrlCache[assetId]) return;
  URL.revokeObjectURL(_mjMapAssetUrlCache[assetId]);
  delete _mjMapAssetUrlCache[assetId];
}

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderMapsList() {
  const maps = await mjGetMaps();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = maps.length === 0
    ? `<div class="mj-empty">🗺️<br>Aucune carte.<br>Ajoute la première !</div>`
    : maps.map(m => `
        <div class="mj-item-card ${_mjMap?.id === m.id ? 'active' : ''}" onclick="mjSelectMap('${m.id}')"
             oncontextmenu="return mjItemContext(event, () => mjDeleteMapConfirm('${m.id}'))">
          <div class="mj-item-name">${escapeHtml(m.name || 'Sans nom')}</div>
          <div class="mj-item-sub"><span>🗺️ ${(m.pins || []).length} pin${(m.pins || []).length === 1 ? '' : 's'}</span></div>
        </div>`).join('');
}

async function mjSelectMap(id) {
  _mjMap = await mjGetMap(id);
  _mjMapHidePins = false;   // repart toujours affiché à l'ouverture d'une carte
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await mjRenderMapsList();
  await mjRenderMapDetail();
}

// ── Détail ────────────────────────────────────────────────────
async function mjRenderMapDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjMap) {
    detail.innerHTML = `<div class="mj-detail-empty">🗺️<br>Sélectionne ou crée une carte</div>`;
    return;
  }

  const m = _mjMap;
  let canvasHtml;
  if (m.assetId) {
    const url = await _mjMapGetAssetUrl(m.assetId);
    canvasHtml = url
      ? `<div class="mj-map-canvas" style="position:relative;width:100%;"
            oncontextmenu="return mjMapCanvasContextMenu(event, '${m.id}')">
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
          ${_mjMapHidePins ? '' : (m.pins || []).map(p => _mjMapRenderPin(p)).join('')}
        </div>`
      : `<div class="mj-detail-empty">🗺️<br>Image introuvable</div>`;
  } else {
    canvasHtml = `<div class="mj-detail-empty">🗺️<br>Ajoute une image de fond</div>`;
  }

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="flex:1;min-width:0;">
        <input id="mj-map-name" class="mj-title-input"
          value="${escapeHtml(m.name || '')}" placeholder="Nom de la carte…"
          onchange="mjMapSaveField('name', this.value)"/>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-secondary" onclick="mjMapToggleHidePins()">${_mjMapHidePins ? '👁️ Afficher les pins' : '👁️ Masquer les pins'}</button>
        <button class="mj-btn-secondary" onclick="mjMapUploadImage('${m.id}')">🖼️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeleteMapConfirm('${m.id}')">🗑️</button>
      </div>
    </div>
    <div class="mj-detail-body">
      ${canvasHtml}
    </div>`;
  if (_mjMapEditingPinId) _mjMapPlaceEditCard(_mjMapEditingPinId);
}

async function mjMapSaveField(field, value) {
  if (!_mjMap) return;
  _mjMap[field] = value;
  await mjSaveMap(_mjMap);
  if (field === 'name') await mjRenderMapsList();
}

function mjMapUploadImage(mapId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (_mjMap.assetId) {
      await mjDeleteAsset(_mjMap.assetId);
      _mjMapInvalidateAssetUrl(_mjMap.assetId);
    }
    _mjMap.assetId = await mjSaveAsset(file.name, file.type, file);
    await mjSaveMap(_mjMap);
    await mjRenderMapDetail();
  };
  input.click();
}

async function mjNewMap() {
  const id = await mjSaveMap({ name: 'Nouvelle carte', assetId: null, pins: [] });
  _mjMap = await mjGetMap(id);
  _mjMapHidePins = false;   // même reset que mjSelectMap : jamais hérité de la carte précédente
  await mjRenderMapsList();
  await mjRenderMapDetail();
  setTimeout(() => document.getElementById('mj-map-name')?.focus(), 100);
}

function mjDeleteMapConfirm(id) {
  appConfirm('Supprimer cette carte ? Cette action est définitive.', async () => {
    const map = await mjGetMap(id);
    if (map?.assetId) { await mjDeleteAsset(map.assetId); _mjMapInvalidateAssetUrl(map.assetId); }
    await mjDeleteMap(id);
    if (_mjMap && _mjMap.id === id) _mjMap = null;
    await mjRenderMapsList();
    await mjRenderMapDetail();
    if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  }, { okLabel: 'Supprimer', danger: true });
}

// ── Pins ──────────────────────────────────────────────────────
function _mjMapRenderPin(p) {
  const editing = _mjMapEditingPinId === p.id;
  return `
    <div class="mj-map-pin" data-pin-id="${p.id}"
      style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-100%);z-index:${editing ? 30 : 10};"
      onmouseenter="_mjMapPinShowPopup(this)"
      onmouseleave="_mjMapPinHidePopup(this)"
      onclick="mjMapEditPin('${p.id}')"
      oncontextmenu="return mjItemContext(event, () => mjMapDeletePinConfirm('${p.id}'))">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--orange-l);
        display:flex;align-items:center;justify-content:center;font-size:12px;
        box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;">📍</div>
      <div class="mj-map-pin-pop" style="display:none;position:absolute;min-width:160px;max-width:240px;
        background:var(--white);border:1.5px solid var(--divider);border-radius:10px;padding:10px 12px;
        box-shadow:0 8px 28px rgba(0,0,0,.18);">
        ${_mjMapPinPopupHtml(p)}
      </div>
      ${editing ? _mjMapPinEditHtml(p) : ''}
    </div>`;
}

function _mjMapPinPopupHtml(p) {
  const linkHtml = _mjMapPinLinkHtml(p);
  return `
    <div style="font-size:12.5px;font-weight:900;color:var(--text);margin-bottom:4px;">${escapeHtml(p.title || 'Sans titre')}</div>
    ${p.text ? `<div style="font-size:11.5px;font-weight:700;color:var(--text-light);margin-bottom:${linkHtml ? '6px' : '0'};">${escapeHtml(p.text)}</div>` : ''}
    ${linkHtml}`;
}

// Résolution du lien affiché dans le popup de survol : toujours en direct
// via _mjTagIndex, jamais une copie figée du nom (même principe que le
// lien PNJ↔bestiaire ou la Fiche bestiaire en combat).
function _mjMapPinLinkHtml(p) {
  if (!p.link) return '';
  const r = _mjTagIndex.find(x => x.type === p.link.type && String(x.id) === String(p.link.id));
  if (!r) return `<div style="font-size:11px;font-weight:700;color:var(--text-light);font-style:italic;">Lien introuvable (supprimé ?)</div>`;
  const meta = _MJ_TAG_META[r.type];
  // id/sessionId non-string (npc/objet/lieu/encounter en ++id numérique) doivent
  // rester des littéraux numériques dans l'onclick, pas des chaînes : sinon
  // db.mj_npcs.get('5') ne retrouve jamais la clé numérique 5 (même piège que
  // mjLinkifyTags dans js/mj/tags.js, qui applique déjà cette garde).
  const idArg = (typeof r.id === 'string') ? `'${r.id}'` : r.id;
  const parentArg = (r.sessionId != null) ? (typeof r.sessionId === 'string' ? `'${r.sessionId}'` : r.sessionId) : 'null';
  return `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--blue);cursor:pointer;"
    onclick="event.stopPropagation();mjTagGo('${r.type}',${idArg},${parentArg})">
    <span>${meta.icon}</span><span>${escapeHtml(r.name)}</span><span>→</span>
  </div>`;
}

// Limites visibles réelles pour le clamp des éléments flottants (popup/carte
// d'édition) : l'intersection du canvas ET de son conteneur défilant
// (.mj-detail-body), sinon un pin dans la partie non visible d'une grande
// image se clamperait contre des bords hors écran (invisibles derrière le
// scroll) au lieu du cadre réellement visible.
function _mjMapVisibleBounds(canvas) {
  const canvasRect = canvas.getBoundingClientRect();
  const scroller = canvas.closest('.mj-detail-body');
  if (!scroller) return canvasRect;
  const scrollRect = scroller.getBoundingClientRect();
  return {
    left:   Math.max(canvasRect.left, scrollRect.left),
    right:  Math.min(canvasRect.right, scrollRect.right),
    top:    Math.max(canvasRect.top, scrollRect.top),
    bottom: Math.min(canvasRect.bottom, scrollRect.bottom),
  };
}

// Positionne le popup de survol pour qu'il reste dans les limites visibles
// (mesure la taille réelle après rendu, comme le clamp du menu contextuel
// combat — voir js/combat/view.js:_openCvCtx).
function _mjMapPinShowPopup(el) {
  if (el._pinHideTimer) { clearTimeout(el._pinHideTimer); el._pinHideTimer = null; }   // annule une fermeture programmée si on re-survole (le pin ou le popup lui-même, descendant du même élément)
  if (_mjMapEditingPinId) return;   // une carte d'édition est déjà ouverte, pas d'aperçu en plus
  const pop = el.querySelector('.mj-map-pin-pop');
  if (!pop) return;
  pop.style.display = 'block';
  pop.style.left = '0px'; pop.style.top = '0px';
  const canvas = el.closest('.mj-map-canvas');
  if (!canvas) return;
  const bounds = _mjMapVisibleBounds(canvas);
  const dotRect = el.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let left = (dotRect.width / 2) - (popRect.width / 2);
  let top  = -popRect.height - 8;
  let absLeft = dotRect.left + left;
  if (absLeft < bounds.left) left += (bounds.left - absLeft);
  absLeft = dotRect.left + left;
  if (absLeft + popRect.width > bounds.right) left -= (absLeft + popRect.width - bounds.right);
  if (dotRect.top + top < bounds.top) top = dotRect.height + 8;   // pas de place au-dessus → bascule en dessous
  const absTop = dotRect.top + top;
  if (absTop + popRect.height > bounds.bottom) top -= (absTop + popRect.height - bounds.bottom);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
function _mjMapPinHidePopup(el) {
  // Petit délai avant de fermer : laisse le temps de traverser l'écart entre
  // le point et le popup (positionné au-dessus/en dessous, pas collé) pour
  // pouvoir cliquer le lien. Annulé par _mjMapPinShowPopup si on re-survole
  // le pin OU le popup lui-même (descendant du même élément, donc un nouveau
  // mouseenter sur .mj-map-pin se déclenche en y entrant).
  if (el._pinHideTimer) clearTimeout(el._pinHideTimer);
  el._pinHideTimer = setTimeout(() => {
    const pop = el.querySelector('.mj-map-pin-pop');
    if (pop) pop.style.display = 'none';
    el._pinHideTimer = null;
  }, 300);
}

// Même principe de clamp que le popup de survol, appliqué à la carte
// d'édition (position par défaut left:28px;top:-8px, cf. _mjMapPinEditHtml).
// Appelée après insertion dans le DOM (mjRenderMapDetail), car la carte
// d'édition fait partie du HTML rendu directement, pas d'un toggle JS
// séparé comme le popup.
function _mjMapPlaceEditCard(pinId) {
  const pinEl = document.querySelector(`.mj-map-pin[data-pin-id="${pinId}"]`);
  if (!pinEl) return;
  const card = pinEl.querySelector('.mj-map-pin-edit');
  const canvas = pinEl.closest('.mj-map-canvas');
  if (!card || !canvas) return;
  card.style.left = '28px'; card.style.top = '-8px';
  const bounds = _mjMapVisibleBounds(canvas);
  const dotRect = pinEl.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  let left = 28, top = -8;
  let absLeft = dotRect.left + left;
  if (absLeft + cardRect.width > bounds.right) left -= (absLeft + cardRect.width - bounds.right);
  absLeft = dotRect.left + left;
  if (absLeft < bounds.left) left += (bounds.left - absLeft);
  let absTop = dotRect.top + top;
  if (absTop < bounds.top) top += (bounds.top - absTop);
  absTop = dotRect.top + top;
  if (absTop + cardRect.height > bounds.bottom) top -= (absTop + cardRect.height - bounds.bottom);
  card.style.left = left + 'px';
  card.style.top  = top + 'px';
}

function _mjMapPinEditHtml(p) {
  return `
    <div class="mj-map-pin-edit" onclick="event.stopPropagation()"
      style="position:absolute;left:28px;top:-8px;width:220px;background:var(--white);
      border:1.5px solid var(--divider);border-radius:12px;padding:12px;
      box-shadow:0 10px 32px rgba(0,0,0,.22);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:900;color:var(--text-light);letter-spacing:.6px;">MODIFIER LE PIN</span>
        <button onclick="mjMapCloseEditPin()" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <input class="mj-field-input" style="width:100%;margin-bottom:8px;box-sizing:border-box;" placeholder="Titre"
        value="${escapeHtml(p.title || '')}" onchange="mjMapSavePinField('${p.id}','title',this.value)"/>
      <textarea class="mj-field-input" style="width:100%;min-height:56px;resize:vertical;margin-bottom:4px;box-sizing:border-box;"
        placeholder="Texte court…" maxlength="200"
        oninput="mjMapPinTextCounter('${p.id}',this)"
        onchange="mjMapSavePinField('${p.id}','text',this.value)">${escapeHtml(p.text || '')}</textarea>
      <div id="mj-pin-counter-${p.id}" style="font-size:10px;color:var(--text-light);text-align:right;margin-bottom:8px;">${(p.text || '').length}/200</div>
      ${_mjMapPinLinkChipHtml(p)}
    </div>`;
}
function mjMapPinTextCounter(pinId, el) {
  const c = document.getElementById('mj-pin-counter-' + pinId);
  if (c) c.textContent = el.value.length + '/200';
}

// Zone lien dans la carte d'édition : puce du lien actuel (avec bouton pour
// délier) ou bouton pour ouvrir le sélecteur.
function _mjMapPinLinkChipHtml(p) {
  if (p.link) {
    const r = _mjTagIndex.find(x => x.type === p.link.type && String(x.id) === String(p.link.id));
    const label = r ? `${_MJ_TAG_META[r.type].icon} ${escapeHtml(r.name)}` : '⚠️ Lien introuvable';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;
        padding:6px 8px;border-radius:8px;background:var(--bg);font-size:11.5px;font-weight:800;">
        <span>${label}</span>
        <button onclick="mjMapUnlinkPin('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:13px;">✕</button>
      </div>`;
  }
  return `<button class="mj-btn-secondary" style="width:100%;" onclick="mjMapOpenLinkPicker('${p.id}')">🔗 Lier à…</button>`;
}
async function mjMapUnlinkPin(pinId) {
  await mjMapSavePinField(pinId, 'link', null);
  await mjRenderMapDetail();
}

function mjMapEditPin(pinId) {
  _mjMapEditingPinId = _mjMapEditingPinId === pinId ? null : pinId;
  mjRenderMapDetail();
}
function mjMapCloseEditPin() {
  _mjMapEditingPinId = null;
  mjRenderMapDetail();
}

function mjMapToggleHidePins() {
  _mjMapHidePins = !_mjMapHidePins;
  if (_mjMapHidePins) _mjMapEditingPinId = null;   // pas d'édition ouverte en mode présentation
  mjRenderMapDetail();
}

async function mjMapCanvasContextMenu(ev, mapId) {
  ev.preventDefault();
  if (_mjMapHidePins) return false;   // pas de création de pin en mode présentation
  const canvas = ev.currentTarget.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((ev.clientX - canvas.left) / canvas.width) * 100));
  const y = Math.max(0, Math.min(100, ((ev.clientY - canvas.top) / canvas.height) * 100));
  await mjMapAddPin(mapId, x, y);
  return false;
}

async function mjMapAddPin(mapId, x, y) {
  const map = await mjGetMap(mapId);
  if (!map) return;
  const pin = { id: 'pin_' + Math.random().toString(36).slice(2, 9), x, y, title: 'Nouveau point', text: '', link: null };
  map.pins = [...(map.pins || []), pin];
  await mjSaveMap(map);
  _mjMap = map;
  _mjMapEditingPinId = pin.id;
  await mjRenderMapsList();
  await mjRenderMapDetail();
}

async function mjMapSavePinField(pinId, field, value) {
  if (!_mjMap) return;
  const pin = (_mjMap.pins || []).find(p => p.id === pinId);
  if (!pin) return;
  pin[field] = value;
  await mjSaveMap(_mjMap);
}

function mjMapDeletePinConfirm(pinId) {
  appConfirm('Supprimer ce pin ? Cette action est définitive.', async () => {
    if (!_mjMap) return;
    _mjMap.pins = (_mjMap.pins || []).filter(p => p.id !== pinId);
    await mjSaveMap(_mjMap);
    if (_mjMapEditingPinId === pinId) _mjMapEditingPinId = null;
    await mjRenderMapsList();
    await mjRenderMapDetail();
  }, { okLabel: 'Supprimer', danger: true });
}

// ── Sélecteur de lien (liste cherchable sur _mjTagIndex) ───────
let _mjMapLinkPickerPinId = null;
function mjMapOpenLinkPicker(pinId) {
  _mjMapLinkPickerPinId = pinId;
  let el = document.getElementById('mj-map-link-picker');
  if (!el) {
    el = document.createElement('div'); el.id = 'mj-map-link-picker';
    // z-index posé en inline (pas de règle CSS #mj-map-link-picker) : doit
    // rester au-dessus de #mj-overlay (z-index 4998, voir css/mj.css) comme
    // tous les autres modaux MJ (#mj-wdg-ctx, #mj-create-menu, #mj-refs…).
    el.style.position = 'fixed'; el.style.inset = '0'; el.style.zIndex = '11070';
    el.innerHTML = `
      <div class="mj-wdgctx-backdrop" style="position:fixed;inset:0;" onclick="mjMapCloseLinkPicker()"></div>
      <div class="mj-wdgctx-card" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(320px,calc(100vw - 32px));max-height:60vh;display:flex;flex-direction:column;">
        <input id="mj-map-link-search" class="mj-field-input" style="margin:4px;box-sizing:border-box;flex-shrink:0;"
          placeholder="Chercher une ressource…" oninput="mjMapFilterLinkPicker(this.value)"/>
        <div id="mj-map-link-results" style="overflow-y:auto;flex:1;"></div>
      </div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'block';
  // Élément réutilisé entre deux ouvertures : vider la recherche précédente
  // (sinon la requête d'une session d'édition antérieure reste affichée et
  // se concatène avec la prochaine frappe).
  const search = document.getElementById('mj-map-link-search');
  if (search) search.value = '';
  mjMapFilterLinkPicker('');
  setTimeout(() => document.getElementById('mj-map-link-search')?.focus(), 50);
}
function mjMapCloseLinkPicker() {
  const el = document.getElementById('mj-map-link-picker');
  if (el) el.style.display = 'none';
  _mjMapLinkPickerPinId = null;
}
function mjMapFilterLinkPicker(q) {
  const box = document.getElementById('mj-map-link-results');
  if (!box) return;
  const query = q.trim().toLowerCase();
  const items = (query ? _mjTagIndex.filter(r => r.lname.includes(query)) : _mjTagIndex.slice()).slice(0, 40);
  box.innerHTML = items.length === 0
    ? `<div class="mj-ac-empty">Aucun résultat</div>`
    // id numérique (npc/objet/lieu/encounter en ++id) doit rester un littéral
    // numérique dans l'onclick — sinon le lien stocké devient une chaîne et
    // ne retrouve plus jamais la clé numérique en base (cf. _mjMapPinLinkHtml).
    : items.map(r => `
      <div class="mj-ac-item" onclick="mjMapPickLink('${r.type}',${typeof r.id === 'string' ? `'${r.id}'` : r.id})">
        <span class="mj-ac-ico">${r.icon}</span>
        <span class="mj-ac-name">${escapeHtml(r.name)}</span>
        <span class="mj-ac-type">${_MJ_TAG_META[r.type].label}</span>
      </div>`).join('');
}
async function mjMapPickLink(type, id) {
  const pinId = _mjMapLinkPickerPinId;
  mjMapCloseLinkPicker();
  if (!pinId) return;
  await mjMapSavePinField(pinId, 'link', { type, id });
  await mjRenderMapDetail();
}
