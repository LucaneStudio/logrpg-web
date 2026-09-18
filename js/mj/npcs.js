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
               onclick="mjSelectNpc(${n.id})"
               oncontextmenu="return mjItemContext(event, () => mjDeleteNpcConfirm(${n.id}))">
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
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();  // @tags rendus dans les notes
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

      <div class="sec-lbl" style="margin-bottom:8px;">🐉 FICHE DE COMBAT</div>
      <div style="margin-bottom:16px;">${_mjNpcBestiaryLinkHtml(n)}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">NOTES</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(n.notes || '', mjNpcSaveNotes);
}

// ── Lien vers une fiche bestiaire (§5 spec) ───────────────────
function _mjNpcBestiaryLinkHtml(n) {
  if (n.bestiaryId) {
    const entry = (typeof bestiaryGetAll === 'function') ? bestiaryGetAll().find(e => e.id === n.bestiaryId) : null;
    if (!entry) return `
      <div class="mj-empty-sm" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>Fiche liée introuvable (supprimée ?).</span>
        <button class="mj-btn-secondary" onclick="mjNpcUnlinkBestiary()">Délier</button>
      </div>`;
    const statsPreview = (entry.stats || []).slice(0, 3).map(s => `${escapeHtml(s.label)} ${escapeHtml(s.value)}`).join(' · ');
    return `
      <div style="padding:10px 12px;border-radius:10px;background:var(--yellow-l);border:1.5px solid rgba(255,209,102,.4);">
        <div style="font-size:12px;font-weight:900;color:#8a6d00;margin-bottom:4px;">${escapeHtml(entry.name || 'Sans nom')}</div>
        <div style="font-size:11px;font-weight:700;color:#8a6d00;opacity:.85;">❤️ ${entry.maxHp} PV · Init. ${entry.initiative}${statsPreview ? ' · ' + statsPreview : ''}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="mj-btn-secondary" onclick="mjSwitchSection('bestiary');setTimeout(()=>mjSelectBestiaryEntry('${entry.id}'),0)">Voir la fiche complète</button>
          <button class="mj-btn-secondary" onclick="mjNpcUnlinkBestiary()">Délier</button>
        </div>
      </div>`;
  }
  const options = (typeof bestiaryGetAll === 'function' ? bestiaryGetAll() : [])
    .filter(e => e.id !== n.bestiaryId)
    .map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  return `
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <select id="mj-npc-link-select" class="mj-field-input" style="flex:1;min-width:160px;">
        <option value="">— Choisir une fiche existante —</option>
        ${options}
      </select>
      <button class="mj-btn-secondary" onclick="mjNpcLinkBestiary(document.getElementById('mj-npc-link-select').value)">Lier</button>
      <button class="mj-btn-secondary" onclick="mjNpcCreateLinkedBestiary()">＋ Créer une fiche liée</button>
    </div>`;
}

async function mjNpcLinkBestiary(bestiaryId) {
  if (!_mjNpc || !bestiaryId) return;
  _mjNpc.bestiaryId = bestiaryId;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}

async function mjNpcCreateLinkedBestiary() {
  if (!_mjNpc) return;
  const id = await bestiaryAdd((_mjNpc.name || '').trim() || 'Nouveau PNJ', 'PNJ', 10, 0);
  _mjNpc.bestiaryId = id;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}

async function mjNpcUnlinkBestiary() {
  if (!_mjNpc) return;
  _mjNpc.bestiaryId = null;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}

async function mjNpcSaveNotes() {
  if (!_mjNpc) return;
  _mjNpc.notes = _mjBlocksToContent();
  await mjSaveNpc(_mjNpc);
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

function mjDeleteNpcConfirm(id) {
  appConfirm('Supprimer ce PNJ ? Cette action est définitive.', async () => {
    const npc = await mjGetNpc(id);
    if (npc && npc.assetId) await mjDeleteAsset(npc.assetId);
    await mjDeleteNpc(id);
    if (_mjNpc && _mjNpc.id === id) _mjNpc = null;
    await mjRenderNpcsList();
    await mjRenderNpcDetail();
  }, { okLabel: 'Supprimer', danger: true });
}
