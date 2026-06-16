// MJ — RESSOURCES (images/assets)
// ═══════════════════════════════════════════════════════════════

let _mjAssetUrls = {}; // cache objectURL pour éviter les fuites mémoire

// ── Render liste ──────────────────────────────────────────────
async function mjRenderAssetsList() {
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  const assets = await db.mj_assets.orderBy('id').reverse().toArray();

  list.innerHTML = assets.length === 0
    ? `<div class="mj-empty">🖼️️️️<br>Aucune image.<br>Clique + pour importer.</div>`
    : assets.map(a => `
        <div class="mj-item-card ${_mjAssetSelected===a.id?'active':''}"
             onclick="mjSelectAsset(${a.id})"
             oncontextmenu="return mjItemContext(event, () => mjDeleteAssetConfirm(${a.id}))">
          <div class="mj-item-name" style="display:flex;align-items:center;gap:7px;">
            <span style="font-size:14px;">🖼️️️️</span>${escapeHtml(a.name)}
          </div>
          <div class="mj-item-sub">${a.mimeType}</div>
        </div>`).join('');
}

let _mjAssetSelected = null;

async function mjSelectAsset(id) {
  _mjAssetSelected = id;
  await mjRenderAssetsList();
  await mjRenderAssetDetail();
}

async function mjRenderAssetDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjAssetSelected) {
    detail.innerHTML = `<div class="mj-detail-empty">🖼️️️️<br>Sélectionne une image</div>`;
    return;
  }

  const asset = await db.mj_assets.get(_mjAssetSelected);
  if (!asset) { detail.innerHTML = `<div class="mj-detail-empty">Image introuvable</div>`; return; }

  // Créer ou réutiliser l'objectURL
  if (!_mjAssetUrls[asset.id]) {
    _mjAssetUrls[asset.id] = URL.createObjectURL(asset.data);
  }
  const url = _mjAssetUrls[asset.id];

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div class="mj-detail-hdr-left">
        <input id="mj-asset-name" class="mj-title-input"
          value="${escapeHtml(asset.name)}" placeholder="Nom de l'image…"
          onchange="mjAssetRename(${asset.id}, this.value)"/>
        <div class="mj-subtitle-input">${asset.mimeType}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${typeof mjRenderBacklinksButton === 'function' ? mjRenderBacklinksButton('asset', asset.id) : ''}
        <button class="mj-btn-danger" onclick="mjDeleteAssetConfirm(${asset.id})">🗑️</button>
      </div>
    </div>
    <div class="mj-detail-body" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;">
      <img src="${url}" style="max-width:100%;max-height:420px;border-radius:12px;
        box-shadow:0 4px 16px rgba(0,0,0,.1);object-fit:contain;"/>
    </div>`;
}

// ── Actions ───────────────────────────────────────────────────
function mjAddAsset() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async (e) => {
    for (const file of e.target.files) {
      await mjSaveAsset(file.name, file.type, file);
    }
    await mjRenderAssetsList();
  };
  input.click();
}

async function mjAssetRename(id, name) {
  await db.mj_assets.update(id, { name: name.trim() || 'image' });
  await mjRenderAssetsList();
}

function mjDeleteAssetConfirm(id) {
  appConfirm('Supprimer cette image ? Cette action est définitive.', async () => {
    if (_mjAssetUrls[id]) { URL.revokeObjectURL(_mjAssetUrls[id]); delete _mjAssetUrls[id]; }
    await mjDeleteAsset(id);
    if (_mjAssetSelected === id) _mjAssetSelected = null;
    await mjRenderAssetsList();
    await mjRenderAssetDetail();
  }, { okLabel: 'Supprimer', danger: true });
}
