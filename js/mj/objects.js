// MJ — OBJETS & LIEUX
// ═══════════════════════════════════════════════════════════════
// Deux ressources taggables : objet (type/rareté/propriétaire) et
// lieu (type/région). Calqué sur le module PNJ.

let _mjObject = null;
let _mjPlace  = null;

// Raretés par défaut — personnalisables par le MJ (stockées en localStorage)
const MJ_DEFAULT_RARITIES = [
  { key: 'common',    label: 'Commun',     color: '#6B7C8E' },
  { key: 'uncommon',  label: 'Peu commun', color: '#3DAF8E' },
  { key: 'rare',      label: 'Rare',       color: '#5B9CF6' },
  { key: 'veryrare',  label: 'Très rare',  color: '#A78BFA' },
  { key: 'legendary', label: 'Légendaire', color: '#FF8C42' },
];
function mjGetRarities() {
  try {
    const s = localStorage.getItem('mj_obj_rarities');
    if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) return a; }
  } catch (e) {}
  return MJ_DEFAULT_RARITIES.slice();
}
function mjSaveRarities(list) {
  try { localStorage.setItem('mj_obj_rarities', JSON.stringify(list)); } catch (e) {}
}
// bg dérivé de la couleur (#RRGGBB + alpha) si non fourni
function _objRarityMeta(k) {
  const list = mjGetRarities();
  const m = list.find(r => r.key === k) || list[0] || MJ_DEFAULT_RARITIES[0];
  return { ...m, bg: m.bg || (m.color + '22') };
}

// ── Éditeur de raretés ──
let _rarityDraft = [];
function openRarityEditor() {
  _rarityDraft = mjGetRarities().map(r => ({ key: r.key, label: r.label, color: r.color }));
  _renderRarityRows();
  openModal('modal-rarity-edit');
}
function _renderRarityRows() {
  const box = document.getElementById('rarity-rows');
  if (!box) return;
  box.innerHTML = _rarityDraft.map((r, i) => `
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="color" value="${r.color}" onchange="_rarityDraft[${i}].color=this.value"
        style="width:36px;height:36px;border:none;background:none;cursor:pointer;padding:0;flex-shrink:0;"/>
      <input class="input" value="${escapeHtml(r.label)}" oninput="_rarityDraft[${i}].label=this.value"
        placeholder="Nom de la rareté" style="flex:1;"/>
      <button class="btn-icon" onclick="_deleteRarityRow(${i})" title="Supprimer" style="flex-shrink:0;color:var(--red);">✕</button>
    </div>`).join('');
}
function _deleteRarityRow(i) { _rarityDraft.splice(i, 1); _renderRarityRows(); }
function addRarityRow() {
  _rarityDraft.push({ key: 'r_' + Math.random().toString(36).slice(2, 8), label: '', color: '#6B7C8E' });
  _renderRarityRows();
}
async function confirmRarities() {
  const list = _rarityDraft
    .map(r => ({ key: r.key, label: (r.label || '').trim(), color: r.color }))
    .filter(r => r.label);
  if (!list.length) return;
  mjSaveRarities(list);
  closeModal('modal-rarity-edit');
  if (_mjObject) await mjRenderObjectDetail();
  await mjRenderObjectsList();
}

// ═══════════════════════════════════════════════════════════════
// OBJETS
// ═══════════════════════════════════════════════════════════════
async function mjRenderObjectsList() {
  const objs = await mjGetObjects();
  const list = document.getElementById('mj-list-body');
  if (!list) return;
  list.innerHTML = objs.length === 0
    ? `<div class="mj-empty">📦<br>Aucun objet.<br>Ajoute le premier !</div>`
    : objs.map(o => {
        const r = _objRarityMeta(o.rarity);
        return `
          <div class="mj-item-card ${_mjObject?.id === o.id ? 'active' : ''}" onclick="mjSelectObject(${o.id})"
               oncontextmenu="return mjItemContext(event, () => mjDeleteObjectConfirm(${o.id}))">
            <div class="mj-item-name">${escapeHtml(o.name || 'Sans nom')}</div>
            <div class="mj-item-sub">
              <span class="mj-pill" style="color:${r.color};background:${r.bg};">${r.label}</span>
              ${o.otype ? `<span>${escapeHtml(o.otype)}</span>` : ''}
            </div>
          </div>`;
      }).join('');
}

async function mjSelectObject(id) {
  _mjObject = await mjGetObject(id);
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();  // @tags rendus dans la description
  await mjRenderObjectsList();
  await mjRenderObjectDetail();
}

async function mjRenderObjectDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;
  if (!_mjObject) {
    detail.innerHTML = `<div class="mj-detail-empty">📦<br>Sélectionne ou crée un objet</div>`;
    return;
  }
  const o = _mjObject;

  let imgHtml = '';
  if (o.assetId) {
    const url = await mjAssetToUrl(o.assetId);
    if (url) imgHtml = `<img src="${url}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;flex-shrink:0;"/>`;
  }
  if (!imgHtml) {
    imgHtml = `<div style="width:64px;height:64px;border-radius:14px;background:${combatColorFor(o.name||'?')};
      display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">📦</div>`;
  }

  const rarityBtns = mjGetRarities().map(r => `
    <button onclick="mjObjectSetRarity('${r.key}')"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid ${o.rarity===r.key?r.color:'var(--divider)'};
      background:${o.rarity===r.key?(r.color+'22'):'transparent'};font-family:'Nunito',sans-serif;font-size:11px;
      font-weight:800;color:${o.rarity===r.key?r.color:'var(--text-light)'};cursor:pointer;">
      ${escapeHtml(r.label)}</button>`).join('');

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        ${imgHtml}
        <div style="flex:1;min-width:0;">
          <input id="mj-object-name" class="mj-title-input"
            value="${escapeHtml(o.name || '')}" placeholder="Nom de l'objet…"
            onchange="mjObjectSaveField('name', this.value)"/>
          <input class="mj-subtitle-input"
            value="${escapeHtml(o.otype || '')}" placeholder="Type (arme, potion, artefact…)"
            onchange="mjObjectSaveField('otype', this.value)"/>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${typeof mjRenderBacklinksButton === 'function' ? mjRenderBacklinksButton('objet', o.id) : ''}
        <button class="mj-btn-secondary" onclick="mjObjectUploadImage(${o.id})">🖼️️️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeleteObjectConfirm(${o.id})">🗑️</button>
      </div>
    </div>
    <div class="mj-detail-body">
      <div class="sec-lbl" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">RARETÉ
        <button onclick="openRarityEditor()" title="Personnaliser les raretés"
          style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;line-height:1;color:var(--text-light);">⚙️</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${rarityBtns}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">PROPRIÉTAIRE</div>
      <div id="mj-owner-field" style="margin-bottom:16px;">${_mjOwnerFieldHtml(o.owner)}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">DESCRIPTION</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(o.notes || '', mjObjectSaveNotes);
}

async function mjObjectSaveNotes() {
  if (!_mjObject) return;
  _mjObject.notes = _mjBlocksToContent();
  await mjSaveObject(_mjObject);
}

// ── Champ « Propriétaire » : tag PNJ cliquable au repos, éditable au clic ──
// Au repos, le @tag est rendu en pastille cliquable (navigation vers le PNJ).
// Au clic ailleurs, le champ redevient un input avec autocomplétion PNJ only.
function _mjOwnerFieldHtml(owner) {
  const v = (owner || '').trim();
  const inner = v
    ? (typeof mjLinkifyTags === 'function' ? mjLinkifyTags(escapeHtml(v)) : escapeHtml(v))
    : `<span class="mj-owner-ph">Tape @ pour lier un PNJ…</span>`;
  return `<div class="mj-owner-view" onclick="mjOwnerEdit(event)" title="Cliquer pour modifier">${inner}</div>`;
}

function mjOwnerEdit(e) {
  if (e && e.target.closest('.mj-tag')) return;   // clic sur la pastille = navigation, pas édition
  const box = document.getElementById('mj-owner-field');
  if (!box || !_mjObject) return;
  box.innerHTML = `<input id="mj-object-owner" class="mj-owner-input"
    value="${escapeHtml(_mjObject.owner || '')}" placeholder="Tape @ pour lier un PNJ…"
    oninput="mjAcUpdateField(this,'npc')" onkeydown="mjAcKeydown(event)" onkeyup="mjAcKeyupField(event,this,'npc')"
    onblur="mjOwnerCommit()"/>`;
  const inp = document.getElementById('mj-object-owner');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function mjOwnerCommit() {
  // léger délai : laisse l'autocomplétion insérer (elle re-focus l'input) avant de committer
  setTimeout(async () => {
    const inp = document.getElementById('mj-object-owner');
    if (!inp || !_mjObject) return;
    if (document.activeElement === inp) return;   // toujours en édition (re-focus après autocomplétion)
    if (typeof mjAcClose === 'function') mjAcClose();
    _mjObject.owner = inp.value;
    await mjSaveObject(_mjObject);
    const box = document.getElementById('mj-owner-field');
    if (box) box.innerHTML = _mjOwnerFieldHtml(_mjObject.owner);
  }, 150);
}

async function mjObjectSaveField(field, value) {
  if (!_mjObject) return;
  _mjObject[field] = value;
  await mjSaveObject(_mjObject);
  if (field === 'name' || field === 'otype') await mjRenderObjectsList();
}
async function mjObjectSetRarity(rarity) {
  if (!_mjObject) return;
  _mjObject.rarity = rarity;
  await mjSaveObject(_mjObject);
  await mjRenderObjectsList();
  await mjRenderObjectDetail();
}
// Ouvre une image en plein écran (lightbox) — clic pour fermer
function mjOpenImageLightbox(url) {
  if (!url) return;
  let el = document.getElementById('mj-lightbox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-lightbox';
    el.onclick = () => { el.style.display = 'none'; el.innerHTML = ''; };
    document.body.appendChild(el);
  }
  el.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.85);'
    + 'display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:24px;';
  el.innerHTML = `<img src="${url}" style="max-width:96%;max-height:96%;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.5);"/>`;
}
function mjObjectUploadImage(objId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (_mjObject.assetId) await mjDeleteAsset(_mjObject.assetId);
    _mjObject.assetId = await mjSaveAsset(file.name, file.type, file);
    await mjSaveObject(_mjObject);
    await mjRenderObjectDetail();
  };
  input.click();
}
async function mjNewObject() {
  const id = await mjSaveObject({ name: 'Nouvel objet', otype: '', rarity: 'common', owner: '', notes: '' });
  _mjObject = await mjGetObject(id);
  await mjRenderObjectsList();
  await mjRenderObjectDetail();
  setTimeout(() => document.getElementById('mj-object-name')?.focus(), 100);
}
function mjDeleteObjectConfirm(id) {
  appConfirm('Supprimer cet objet ? Cette action est définitive.', async () => {
    if (_mjObject?.assetId) await mjDeleteAsset(_mjObject.assetId);
    await mjDeleteObject(id);
    _mjObject = null;
    await mjRenderObjectsList();
    await mjRenderObjectDetail();
    if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  }, { okLabel: 'Supprimer', danger: true });
}

// ═══════════════════════════════════════════════════════════════
// LIEUX
// ═══════════════════════════════════════════════════════════════
async function mjRenderPlacesList() {
  const places = await mjGetPlaces();
  const list = document.getElementById('mj-list-body');
  if (!list) return;
  list.innerHTML = places.length === 0
    ? `<div class="mj-empty">📍<br>Aucun lieu.<br>Ajoute le premier !</div>`
    : places.map(p => `
        <div class="mj-item-card ${_mjPlace?.id === p.id ? 'active' : ''}" onclick="mjSelectPlace(${p.id})"
             oncontextmenu="return mjItemContext(event, () => mjDeletePlaceConfirm(${p.id}))">
          <div class="mj-item-name">${escapeHtml(p.name || 'Sans nom')}</div>
          <div class="mj-item-sub">
            ${p.ptype ? `<span>${escapeHtml(p.ptype)}</span>` : ''}
            ${p.region ? `<span>📍 ${escapeHtml(p.region)}</span>` : ''}
          </div>
        </div>`).join('');
}

async function mjSelectPlace(id) {
  _mjPlace = await mjGetPlace(id);
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();  // @tags rendus dans la description
  await mjRenderPlacesList();
  await mjRenderPlaceDetail();
}

async function mjRenderPlaceDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;
  if (!_mjPlace) {
    detail.innerHTML = `<div class="mj-detail-empty">📍<br>Sélectionne ou crée un lieu</div>`;
    return;
  }
  const p = _mjPlace;

  // Vignette avant le nom — clic : ouvre l'image en grand (carte), ou importe si vide
  let thumb;
  if (p.assetId) {
    const url = await mjAssetToUrl(p.assetId);
    thumb = url
      ? `<img src="${url}" onclick="mjOpenImageLightbox('${url}')" title="Ouvrir en grand"
          style="width:64px;height:64px;border-radius:14px;object-fit:cover;flex-shrink:0;cursor:zoom-in;"/>`
      : '';
  }
  if (!thumb) {
    thumb = `<div onclick="mjPlaceUploadImage(${p.id})" title="Ajouter une image"
      style="width:64px;height:64px;border-radius:14px;background:${combatColorFor(p.name||'?')};
      display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;cursor:pointer;">📍</div>`;
  }

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        ${thumb}
        <div style="flex:1;min-width:0;">
          <input id="mj-place-name" class="mj-title-input"
            value="${escapeHtml(p.name || '')}" placeholder="Nom du lieu…"
            onchange="mjPlaceSaveField('name', this.value)"/>
          <input class="mj-subtitle-input"
            value="${escapeHtml(p.ptype || '')}" placeholder="Type (ville, donjon, taverne…)"
            onchange="mjPlaceSaveField('ptype', this.value)"/>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${typeof mjRenderBacklinksButton === 'function' ? mjRenderBacklinksButton('lieu', p.id) : ''}
        <button class="mj-btn-secondary" onclick="mjPlaceUploadImage(${p.id})">🖼️️️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeletePlaceConfirm(${p.id})">🗑️</button>
      </div>
    </div>
    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">RÉGION</div>
      <input class="mj-subtitle-input" style="margin-bottom:16px;"
        value="${escapeHtml(p.region || '')}" placeholder="Région, royaume, secteur…"
        onchange="mjPlaceSaveField('region', this.value)"/>

      <div class="sec-lbl" style="margin-bottom:8px;">DESCRIPTION</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(p.notes || '', mjPlaceSaveNotes);
}

async function mjPlaceSaveNotes() {
  if (!_mjPlace) return;
  _mjPlace.notes = _mjBlocksToContent();
  await mjSavePlace(_mjPlace);
}

async function mjPlaceSaveField(field, value) {
  if (!_mjPlace) return;
  _mjPlace[field] = value;
  await mjSavePlace(_mjPlace);
  if (field === 'name' || field === 'ptype' || field === 'region') await mjRenderPlacesList();
}
function mjPlaceUploadImage(placeId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (_mjPlace.assetId) await mjDeleteAsset(_mjPlace.assetId);
    _mjPlace.assetId = await mjSaveAsset(file.name, file.type, file);
    await mjSavePlace(_mjPlace);
    await mjRenderPlaceDetail();
  };
  input.click();
}
async function mjNewPlace() {
  const id = await mjSavePlace({ name: 'Nouveau lieu', ptype: '', region: '', notes: '' });
  _mjPlace = await mjGetPlace(id);
  await mjRenderPlacesList();
  await mjRenderPlaceDetail();
  setTimeout(() => document.getElementById('mj-place-name')?.focus(), 100);
}
function mjDeletePlaceConfirm(id) {
  appConfirm('Supprimer ce lieu ? Cette action est définitive.', async () => {
    if (_mjPlace?.assetId) await mjDeleteAsset(_mjPlace.assetId);
    await mjDeletePlace(id);
    _mjPlace = null;
    await mjRenderPlacesList();
    await mjRenderPlaceDetail();
    if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  }, { okLabel: 'Supprimer', danger: true });
}
