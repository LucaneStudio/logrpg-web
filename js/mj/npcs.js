// MJ — PNJ
// ═══════════════════════════════════════════════════════════════

let _mjNpc = null;

const MJ_NPC_STATUSES = [
  { key: 'ALIVE',   label: '🟢 Vivant',   color: 'var(--green-d)', bg: 'var(--green-l)' },
  { key: 'DEAD',    label: '💀 Mort',      color: 'var(--red)',     bg: 'var(--red-l)'   },
  { key: 'MISSING', label: '❓ Disparu',  color: '#B8860B',        bg: 'var(--yellow-l)' },
  { key: 'UNKNOWN', label: '⬜ Inconnu',  color: 'var(--text-light)', bg: 'var(--bg)'   },
];

function _npcStatusMeta(key) {
  return MJ_NPC_STATUSES.find(s => s.key === key) || MJ_NPC_STATUSES[3];
}

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderNpcsList() {
  const npcs = await mjGetNpcs();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = npcs.length === 0
    ? `<div class="mj-empty">🧑<br>Aucun PNJ.<br>Ajoute le premier !</div>`
    : npcs.map(n => {
        const st = _npcStatusMeta(n.status);
        return `
          <div class="mj-item-card ${_mjNpc?.id === n.id ? 'active' : ''}"
               onclick="mjSelectNpc(${n.id})">
            <div class="mj-item-name">${escapeHtml(n.name || 'Sans nom')}</div>
            <div class="mj-item-sub">
              <span class="mj-pill" style="color:${st.color};background:${st.bg};">${st.label}</span>
              ${n.role ? `<span>${escapeHtml(n.role)}</span>` : ''}
            </div>
          </div>`;
      }).join('');
}

async function mjSelectNpc(id) {
  _mjNpc = await mjGetNpc(id);
  await mjRenderNpcsList();
  await mjRenderNpcDetail();
}

// ── Détail ────────────────────────────────────────────────────
async function mjRenderNpcDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjNpc) {
    detail.innerHTML = `<div class="mj-detail-empty">🧑<br>Sélectionne ou crée un PNJ</div>`;
    return;
  }

  const n  = _mjNpc;
  const st = _npcStatusMeta(n.status);

  // Charger le portrait si disponible
  let portraitHtml = '';
  if (n.assetId) {
    const url = await mjAssetToUrl(n.assetId);
    if (url) portraitHtml = `<img src="${url}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;flex-shrink:0;"/>`;
  }
  if (!portraitHtml) {
    portraitHtml = `<div style="width:64px;height:64px;border-radius:14px;background:${combatColorFor(n.name||'?')};
      display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;flex-shrink:0;">
      ${(n.name?.[0]||'?').toUpperCase()}</div>`;
  }

  const statusBtns = MJ_NPC_STATUSES.map(s => `
    <button onclick="mjNpcSetStatus('${s.key}')"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid ${n.status===s.key?s.color:'var(--divider)'};
      background:${n.status===s.key?s.bg:'transparent'};font-family:'Nunito',sans-serif;font-size:11px;
      font-weight:800;color:${n.status===s.key?s.color:'var(--text-light)'};cursor:pointer;">
      ${s.label}</button>`).join('');

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        ${portraitHtml}
        <div style="flex:1;min-width:0;">
          <input id="mj-npc-name" class="mj-title-input"
            value="${escapeHtml(n.name || '')}" placeholder="Nom du PNJ…"
            onchange="mjNpcSaveField('name', this.value)"/>
          <input id="mj-npc-role" class="mj-subtitle-input"
            value="${escapeHtml(n.role || '')}" placeholder="Rôle, métier, faction…"
            onchange="mjNpcSaveField('role', this.value)"/>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${typeof mjRenderBacklinksButton === 'function' ? mjRenderBacklinksButton('npc', n.id) : ''}
        <button class="mj-btn-secondary" onclick="mjNpcUploadPortrait(${n.id})">🖼️️️ Portrait</button>
        <button class="mj-btn-danger" onclick="mjDeleteNpcConfirm(${n.id})">🗑️</button>
      </div>
    </div>

    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">STATUT</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${statusBtns}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">NOTES</div>
      <textarea id="mj-npc-notes"
        style="width:100%;min-height:180px;border:1.5px solid var(--divider);border-radius:12px;
        padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;color:var(--text);
        line-height:1.7;resize:vertical;background:var(--white);outline:none;box-sizing:border-box;"
        placeholder="Personnalité, secrets, liens avec les PJ…"
        onchange="mjNpcSaveField('notes', this.value)">${escapeHtml(n.notes || '')}</textarea>
    </div>`;
}

// ── Actions ───────────────────────────────────────────────────
async function mjNpcSaveField(field, value) {
  if (!_mjNpc) return;
  _mjNpc[field] = value;
  await mjSaveNpc(_mjNpc);
  if (field === 'name') await mjRenderNpcsList();
}

async function mjNpcSetStatus(status) {
  if (!_mjNpc) return;
  _mjNpc.status = status;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcsList();
  await mjRenderNpcDetail();
}

function mjNpcUploadPortrait(npcId) {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Supprimer l'ancien asset si existant
    if (_mjNpc.assetId) await mjDeleteAsset(_mjNpc.assetId);
    const assetId = await mjSaveAsset(file.name, file.type, file);
    _mjNpc.assetId = assetId;
    await mjSaveNpc(_mjNpc);
    await mjRenderNpcDetail();
  };
  input.click();
}

async function mjNewNpc() {
  const id = await mjSaveNpc({ name: 'Nouveau PNJ', role: '', status: 'UNKNOWN', notes: '' });
  _mjNpc = await mjGetNpc(id);
  await mjRenderNpcsList();
  await mjRenderNpcDetail();
  setTimeout(() => document.getElementById('mj-npc-name')?.focus(), 100);
}

async function mjDeleteNpcConfirm(id) {
  if (!confirm('Supprimer ce PNJ ?')) return;
  if (_mjNpc?.assetId) await mjDeleteAsset(_mjNpc.assetId);
  await mjDeleteNpc(id);
  _mjNpc = null;
  await mjRenderNpcsList();
  await mjRenderNpcDetail();
}
