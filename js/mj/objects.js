// MJ — OBJETS & LIEUX
// ═══════════════════════════════════════════════════════════════
// Deux ressources taggables : objet (type/rareté/propriétaire) et
// lieu (type/région). Calqué sur le module PNJ.

let _mjObject = null;
let _mjPlace  = null;

const MJ_OBJ_RARITIES = [
  { key: 'common',    label: 'Commun',     color: '#6B7C8E', bg: '#EEF2F5' },
  { key: 'uncommon',  label: 'Peu commun', color: '#3DAF8E', bg: '#D4F2EA' },
  { key: 'rare',      label: 'Rare',       color: '#5B9CF6', bg: '#DDEAFF' },
  { key: 'veryrare',  label: 'Très rare',  color: '#A78BFA', bg: '#EDE9FF' },
  { key: 'legendary', label: 'Légendaire', color: '#FF8C42', bg: '#FFEDE0' },
];
function _objRarityMeta(k) { return MJ_OBJ_RARITIES.find(r => r.key === k) || MJ_OBJ_RARITIES[0]; }

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
          <div class="mj-item-card ${_mjObject?.id === o.id ? 'active' : ''}" onclick="mjSelectObject(${o.id})">
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

  const rarityBtns = MJ_OBJ_RARITIES.map(r => `
    <button onclick="mjObjectSetRarity('${r.key}')"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid ${o.rarity===r.key?r.color:'var(--divider)'};
      background:${o.rarity===r.key?r.bg:'transparent'};font-family:'Nunito',sans-serif;font-size:11px;
      font-weight:800;color:${o.rarity===r.key?r.color:'var(--text-light)'};cursor:pointer;">
      ${r.label}</button>`).join('');

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
      <div class="sec-lbl" style="margin-bottom:8px;">RARETÉ</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${rarityBtns}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">PROPRIÉTAIRE</div>
      <input class="mj-subtitle-input" style="margin-bottom:16px;"
        value="${escapeHtml(o.owner || '')}" placeholder="Qui le possède ?"
        onchange="mjObjectSaveField('owner', this.value)"/>

      <div class="sec-lbl" style="margin-bottom:8px;">DESCRIPTION</div>
      <textarea id="mj-object-notes"
        style="width:100%;min-height:160px;border:1.5px solid var(--divider);border-radius:12px;
        padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;color:var(--text);
        line-height:1.7;resize:vertical;background:var(--white);outline:none;box-sizing:border-box;"
        placeholder="Pouvoirs, histoire, apparence… (@ pour lier une ressource)"
        onchange="mjObjectSaveField('notes', this.value)">${escapeHtml(o.notes || '')}</textarea>
    </div>`;
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
        <div class="mj-item-card ${_mjPlace?.id === p.id ? 'active' : ''}" onclick="mjSelectPlace(${p.id})">
          <div class="mj-item-name">${escapeHtml(p.name || 'Sans nom')}</div>
          <div class="mj-item-sub">
            ${p.ptype ? `<span>${escapeHtml(p.ptype)}</span>` : ''}
            ${p.region ? `<span>📍 ${escapeHtml(p.region)}</span>` : ''}
          </div>
        </div>`).join('');
}

async function mjSelectPlace(id) {
  _mjPlace = await mjGetPlace(id);
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

  let imgHtml = '';
  if (p.assetId) {
    const url = await mjAssetToUrl(p.assetId);
    if (url) imgHtml = `<img src="${url}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;flex-shrink:0;"/>`;
  }
  if (!imgHtml) {
    imgHtml = `<div style="width:64px;height:64px;border-radius:14px;background:${combatColorFor(p.name||'?')};
      display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">📍</div>`;
  }

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        ${imgHtml}
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
      <textarea id="mj-place-notes"
        style="width:100%;min-height:160px;border:1.5px solid var(--divider);border-radius:12px;
        padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;color:var(--text);
        line-height:1.7;resize:vertical;background:var(--white);outline:none;box-sizing:border-box;"
        placeholder="Ambiance, PNJ présents, points d'intérêt… (@ pour lier une ressource)"
        onchange="mjPlaceSaveField('notes', this.value)">${escapeHtml(p.notes || '')}</textarea>
    </div>`;
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
