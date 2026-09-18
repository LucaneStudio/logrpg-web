// MJ — BESTIAIRE (écran liste+détail, réutilise le stockage de
// js/combat/bestiary.js — bestiaryGetAll/Add/SaveEntry/Remove)
// ═══════════════════════════════════════════════════════════════

let _mjBestiaryEntry = null;

const MJ_BESTIARY_TYPES = [
  { key: 'MONSTRE', label: 'Monstre', color: 'var(--red)',   bg: 'var(--red-l)'    },
  { key: 'PNJ',      label: 'PNJ',     color: '#B8860B',      bg: 'var(--yellow-l)' },
  { key: 'PJ',       label: 'PJ',      color: 'var(--blue)',  bg: 'var(--blue-l)'   },
];
function _bestiaryTypeMeta(key) { return MJ_BESTIARY_TYPES.find(t => t.key === key) || MJ_BESTIARY_TYPES[0]; }

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderBestiaryList() {
  const entries = bestiaryGetAll();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = entries.length === 0
    ? `<div class="mj-empty">🐉<br>Bestiaire vide.<br>Ajoute la première fiche !</div>`
    : entries.map(e => {
        const tm = _bestiaryTypeMeta(e.type);
        return `
          <div class="mj-item-card ${_mjBestiaryEntry?.id === e.id ? 'active' : ''}"
               onclick="mjSelectBestiaryEntry('${e.id}')"
               oncontextmenu="return mjItemContext(event, () => mjDeleteBestiaryEntryConfirm('${e.id}'))">
            <div class="mj-item-name">${escapeHtml(e.name || 'Sans nom')}</div>
            <div class="mj-item-sub">
              <span class="mj-pill" style="color:${tm.color};background:${tm.bg};">${tm.label}</span>
              <span>❤️ ${e.maxHp} · Init. ${e.initiative}</span>
            </div>
          </div>`;
      }).join('');
}

async function mjSelectBestiaryEntry(id) {
  _mjBestiaryEntry = bestiaryGetAll().find(e => e.id === id) || null;
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();  // cohérence avec mjSelectNpc/mjSelectObject
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
}

// ── Détail ────────────────────────────────────────────────────
async function mjRenderBestiaryDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjBestiaryEntry) {
    detail.innerHTML = `<div class="mj-detail-empty">🐉<br>Sélectionne ou crée une fiche</div>`;
    return;
  }

  const e = _mjBestiaryEntry;
  const typeBtns = MJ_BESTIARY_TYPES.map(t => `
    <button onclick="mjBestiarySetType('${t.key}')"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid ${e.type===t.key?t.color:'var(--divider)'};
      background:${e.type===t.key?t.bg:'transparent'};font-family:'Nunito',sans-serif;font-size:11px;
      font-weight:800;color:${e.type===t.key?t.color:'var(--text-light)'};cursor:pointer;">
      ${t.label}</button>`).join('');

  const statsRows = (e.stats || []).map((s, i) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
      <input class="mj-field-input" style="flex:1;" placeholder="Label" value="${escapeHtml(s.label)}"
        onchange="mjBestiarySetStatField(${i},'label',this.value)"/>
      <input class="mj-field-input" style="flex:1;" placeholder="Valeur" value="${escapeHtml(s.value)}"
        onchange="mjBestiarySetStatField(${i},'value',this.value)"/>
      <button class="mj-btn-sm-danger" onclick="mjBestiaryRemoveStat(${i})">×</button>
    </div>`).join('');

  // Lien PNJ inverse : plusieurs PNJ narratifs peuvent pointer vers cette fiche (§5/§7 spec, pas de contrainte 1:1)
  const linkedNpcs = (typeof mjGetNpcs === 'function') ? (await mjGetNpcs()).filter(n => n.bestiaryId === e.id) : [];
  const reverseLinkHtml = linkedNpcs.length ? linkedNpcs.map(linkedNpc => `
    <div style="margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--yellow-l);
      display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-size:12px;font-weight:800;color:#8a6d00;">🧑 PNJ narratif lié : ${escapeHtml(linkedNpc.name || 'Sans nom')}</span>
      <button class="mj-btn-secondary" onclick="mjSwitchSection('npcs');setTimeout(()=>mjSelectNpc(${linkedNpc.id}),0)">Voir</button>
    </div>`).join('') : '';

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="flex:1;min-width:0;">
        <input id="mj-bestiary-name" class="mj-title-input"
          value="${escapeHtml(e.name || '')}" placeholder="Nom de la fiche…"
          onchange="mjBestiarySaveField('name', this.value)"/>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-danger" onclick="mjDeleteBestiaryEntryConfirm('${e.id}')">🗑️</button>
      </div>
    </div>

    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">TYPE</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${typeBtns}</div>

      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div style="flex:1;">
          <div class="sec-lbl" style="margin-bottom:6px;">PV MAX</div>
          <input class="mj-field-input" type="number" value="${e.maxHp}" min="1"
            onchange="mjBestiarySaveField('maxHp', parseInt(this.value)||1)"/>
        </div>
        <div style="flex:1;">
          <div class="sec-lbl" style="margin-bottom:6px;">INITIATIVE</div>
          <input class="mj-field-input" type="number" value="${e.initiative}"
            onchange="mjBestiarySaveField('initiative', parseInt(this.value)||0)"/>
        </div>
      </div>

      <div class="sec-lbl" style="margin-bottom:8px;">STATS</div>
      <div style="margin-bottom:8px;">${statsRows}</div>
      <button class="mj-btn-secondary" onclick="mjBestiaryAddStat()" style="margin-bottom:16px;">＋ Ajouter une stat</button>
      ${reverseLinkHtml}

      <div class="sec-lbl" style="margin:16px 0 8px;">NOTES</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(e.notes || '', mjBestiarySaveNotes);
}

async function mjBestiarySaveNotes() {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.notes = _mjBlocksToContent();
  await bestiarySaveEntry(_mjBestiaryEntry);
}

// ── Actions ───────────────────────────────────────────────────
async function mjBestiarySaveField(field, value) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry[field] = value;
  await bestiarySaveEntry(_mjBestiaryEntry);
  if (field === 'name') await mjRenderBestiaryList();
}

async function mjBestiarySetType(type) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.type = type;
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
}

async function mjBestiaryAddStat() {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats = [...(_mjBestiaryEntry.stats || []), { label: '', value: '' }];
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryDetail();
}

async function mjBestiarySetStatField(i, field, value) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats[i][field] = value;
  await bestiarySaveEntry(_mjBestiaryEntry);
}

async function mjBestiaryRemoveStat(i) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats.splice(i, 1);
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryDetail();
}

async function mjNewBestiaryEntry() {
  const id = await bestiaryAdd('Nouvelle fiche', 'MONSTRE', 10, 0);
  _mjBestiaryEntry = bestiaryGetAll().find(e => e.id === id);
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
  setTimeout(() => document.getElementById('mj-bestiary-name')?.focus(), 100);
}

function mjDeleteBestiaryEntryConfirm(id) {
  appConfirm('Supprimer cette fiche ? Cette action est définitive.', async () => {
    await bestiaryRemove(id);
    if (_mjBestiaryEntry && _mjBestiaryEntry.id === id) _mjBestiaryEntry = null;
    await mjRenderBestiaryList();
    await mjRenderBestiaryDetail();
  }, { okLabel: 'Supprimer', danger: true });
}
