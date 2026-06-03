// INVENTAIRE
// ═══════════════════════════════════════════════════════════════

let _invCharId   = null;
let _invSearch   = '';
let _invFilter   = 'ALL'; // ALL | CONSUMABLE | EQUIPPED
let _invExpanded = new Set();

// ── Render principal ──────────────────────────────────────────────────────────
async function renderInventaireTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _invCharId = char.id;
  const all = getItems(char);

  let filtered = all;
  if (_invFilter === 'CONSUMABLE') filtered = all.filter(i => i.isConsumable);
  if (_invFilter === 'EQUIPPED')   filtered = all.filter(i => i.isEquipped);
  if (_invSearch) {
    const q = _invSearch.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.category    || '').toLowerCase().includes(q) ||
      (i.notes       || '').toLowerCase().includes(q)
    );
  }

  const chips = [
    { key:'ALL',        label:`Tous (${all.length})`,                             color:'var(--orange)' },
    { key:'CONSUMABLE', label:`🧪 Consomm. (${all.filter(i=>i.isConsumable).length})`, color:'var(--red)'    },
    { key:'EQUIPPED',   label:`✓ Équipés (${all.filter(i=>i.isEquipped).length})`,     color:'var(--green-d)' },
  ].map(c => `<button class="filter-chip ${_invFilter===c.key?'active':''}"
    style="${_invFilter===c.key?'background:'+c.color+';color:#fff;border-color:'+c.color:''}"
    onclick="setInvFilter('${c.key}')">${c.label}</button>`).join('');

  const cardsHtml = filtered.length === 0
    ? `<div class="empty-panel"><div class="emoji">${_invSearch||_invFilter!=='ALL'?'🔍':'🎒'}</div>
       <p>${_invSearch?'Aucun résultat':_invFilter!=='ALL'?'Aucun objet dans ce filtre':'Aucun objet.<br>Ajoute le premier !'}</p></div>`
    : filtered.map(i => renderItemCard(i)).join('');

  const area = document.getElementById('content-area');
  area.innerHTML = `
    <div id="inv-root">
      <div class="search-bar" style="margin-bottom:8px;">
        <span>🔍</span>
        <input id="inv-search-input" placeholder="Rechercher un objet..."
               value="${escapeHtml(_invSearch)}" oninput="onInvSearch(this.value)"/>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${chips}</div>
      ${cardsHtml}
      <button class="add-pill orange" style="margin-top:4px;" onclick="openAddItemModal()">＋ Ajouter un objet</button>
    </div>`;

  if (_invSearch) {
    const inp = document.getElementById('inv-search-input');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

function onInvSearch(val) { _invSearch = val; refreshInventaireTab(); }
function setInvFilter(f)  { _invFilter = f;   refreshInventaireTab(); }

// ── Render carte item ─────────────────────────────────────────────────────────
function renderItemCard(item) {
  const expanded = _invExpanded.has(item.id);
  const accent = item.isConsumable ? 'var(--red)' : item.isEquipped ? 'var(--green)' : 'var(--purple)';
  const accentL = item.isConsumable ? 'var(--red-l)' : item.isEquipped ? 'var(--green-l)' : 'var(--purple-l)';

  const badges = [
    item.category    ? `<span class="ability-badge" style="color:${accent};background:${accent}1a;">${escapeHtml(item.category)}</span>` : '',
    item.isEquipped  ? `<span class="ability-badge" style="color:var(--green-d);background:var(--green-l);">Équipé</span>` : '',
    item.isConsumable? `<span class="ability-badge" style="color:var(--red);background:var(--red-l);">Consomm.</span>` : '',
  ].filter(Boolean).join('');

  // Compteur consommable inline
  const qtyCtrl = item.isConsumable ? `
    <div style="display:flex;align-items:center;gap:5px;" onclick="event.stopPropagation()">
      <button class="item-qty-btn" onclick="changeItemQty('${item.id}',-1)"
              style="color:var(--red);background:var(--red-l);">−</button>
      <span style="font-size:15px;font-weight:900;color:var(--red);min-width:20px;text-align:center;">${item.quantity||1}</span>
      <button class="item-qty-btn" onclick="changeItemQty('${item.id}',1)"
              style="color:var(--red);background:var(--red-l);">＋</button>
    </div>` : `
    <button class="item-equip-dot ${item.isEquipped?'on':''}"
            onclick="event.stopPropagation();toggleEquip('${item.id}')"
            title="${item.isEquipped?'Déséquiper':'Équiper'}"></button>`;

  const detail = expanded ? `
    <div style="padding:0 14px 12px 18px;">
      <div style="height:1px;background:#F0F3F2;margin-bottom:10px;"></div>
      ${item.description ? `<p style="font-size:13px;color:var(--text-mid);line-height:1.6;margin-bottom:8px;">${escapeHtml(item.description)}</p>` : ''}
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${item.weight   ? `<span class="ability-detail-row">⚖️ <b>Poids</b> ${escapeHtml(item.weight)}</span>` : ''}
        ${item.quantity > 1 && !item.isConsumable ? `<span class="ability-detail-row">📦 <b>Qté</b> ${item.quantity}</span>` : ''}
        ${item.notes    ? `<span class="ability-detail-row">📝 <b>Notes</b> ${escapeHtml(item.notes)}</span>` : ''}
      </div>
    </div>` : '';

  return `
  <div class="card ability-card-item" style="margin-bottom:8px;position:relative;overflow:hidden;cursor:pointer;"
       onclick="toggleItem('${item.id}')"
       oncontextmenu="event.preventDefault();openItemContextMenu(event,'${item.id}')">
    <div class="ability-accent-bar" style="background:linear-gradient(180deg,${accent},${accent}33);"></div>
    <div style="padding:12px 14px 12px 18px;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:13.5px;font-weight:800;color:var(--text);">${escapeHtml(item.name)}</span>
          ${item.quantity > 1 && !item.isConsumable ? `<span style="font-size:11.5px;color:var(--text-light);font-weight:700;">×${item.quantity}</span>` : ''}
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
          ${badges}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        ${qtyCtrl}
        <span style="font-size:11px;color:var(--text-light);">${expanded?'∧':'∨'}</span>
      </div>
    </div>
    ${detail}
  </div>`;
}

function toggleItem(id) {
  if (_invExpanded.has(id)) _invExpanded.delete(id);
  else _invExpanded.add(id);
  refreshInventaireTab();
}

async function changeItemQty(id, delta) {
  const char = await getCharacter(_invCharId);
  const items = getItems(char);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx].quantity = Math.max(0, (items[idx].quantity || 1) + delta);
    await saveItems(_invCharId, items);
    refreshInventaireTab();
  }
}

async function toggleEquip(id) {
  const char = await getCharacter(_invCharId);
  const items = getItems(char);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx].isEquipped = !items[idx].isEquipped;
    await saveItems(_invCharId, items);
    refreshInventaireTab();
  }
}

// ── Context menu item ─────────────────────────────────────────────────────────
let _ctxItemId = null;
function openItemContextMenu(e, id) {
  e.stopPropagation();
  _ctxItemId = id;
  const menu = document.getElementById('item-context-menu');
  getCharacter(_invCharId).then(char => {
    const item = getItems(char).find(i => i.id === id);
    if (!item) return;
    document.getElementById('item-ctx-title').textContent = item.name;
    // Mettre à jour label toggle équiper/consommable
    document.getElementById('item-ctx-equip').textContent   = item.isEquipped   ? '○ Déséquiper'   : '● Équiper';
    document.getElementById('item-ctx-consume').textContent = item.isConsumable ? '🧪 Non consommable' : '🧪 Marquer consommable';
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 240 > window.innerWidth)  x = window.innerWidth  - 244;
  if (y + 160 > window.innerHeight) y = window.innerHeight - 164;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closeItemContextMenu() {
  document.getElementById('item-context-menu').style.display = 'none';
  _ctxItemId = null;
}
function editItemFromCtx() {
  const id = _ctxItemId; closeItemContextMenu();
  openEditItemModal(id);
}
async function deleteItemFromCtx() {
  const id = _ctxItemId; closeItemContextMenu();
  const char = await getCharacter(_invCharId);
  await saveItems(_invCharId, getItems(char).filter(i => i.id !== id));
  refreshInventaireTab();
}
async function toggleEquipFromCtx() {
  const id = _ctxItemId; closeItemContextMenu();
  await toggleEquip(id);
}
async function toggleConsumeFromCtx() {
  const id = _ctxItemId; closeItemContextMenu();
  const char = await getCharacter(_invCharId);
  const items = getItems(char);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx].isConsumable = !items[idx].isConsumable;
    if (items[idx].isConsumable) items[idx].isEquipped = false;
    await saveItems(_invCharId, items);
    refreshInventaireTab();
  }
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openAddItemModal() {
  ['it-name','it-desc','it-qty','it-weight','it-category','it-notes'].forEach(id => {
    document.getElementById(id).value = id === 'it-qty' ? '1' : '';
  });
  document.getElementById('it-consumable').checked = false;
  document.getElementById('it-equipped').checked   = false;
  document.getElementById('it-error').textContent  = '';
  document.getElementById('it-modal-title').textContent = '🎒 Nouvel objet';
  document.getElementById('it-submit-btn').onclick = submitAddItem;
  updateItemToggles();
  openModal('modal-item');
  setTimeout(() => document.getElementById('it-name').focus(), 100);
}

async function openEditItemModal(id) {
  const char = await getCharacter(_invCharId);
  const item = getItems(char).find(i => i.id === id);
  if (!item) return;
  document.getElementById('it-name').value     = item.name        || '';
  document.getElementById('it-desc').value     = item.description || '';
  document.getElementById('it-qty').value      = item.quantity    || 1;
  document.getElementById('it-weight').value   = item.weight      || '';
  document.getElementById('it-category').value = item.category    || '';
  document.getElementById('it-notes').value    = item.notes       || '';
  document.getElementById('it-consumable').checked = !!item.isConsumable;
  document.getElementById('it-equipped').checked   = !!item.isEquipped;
  document.getElementById('it-error').textContent  = '';
  document.getElementById('it-modal-title').textContent = "✏️ Modifier l'objet";
  document.getElementById('it-submit-btn').onclick = () => submitEditItem(id);
  updateItemToggles();
  openModal('modal-item');
  setTimeout(() => document.getElementById('it-name').focus(), 100);
}

function updateItemToggles() {
  const isConsumable = document.getElementById('it-consumable').checked;
  const equippedRow  = document.getElementById('it-equipped-row');
  if (equippedRow) equippedRow.style.display = isConsumable ? 'none' : '';
  if (isConsumable) document.getElementById('it-equipped').checked = false;
}

async function submitAddItem() {
  const name = document.getElementById('it-name').value.trim();
  const desc = document.getElementById('it-desc').value.trim();
  if (!name) { document.getElementById('it-error').textContent = 'Le nom est obligatoire.'; return; }
  const char = await getCharacter(_invCharId);
  const items = getItems(char);
  items.push({
    id: newItemId(), name, description: desc,
    quantity:    parseInt(document.getElementById('it-qty').value) || 1,
    weight:      document.getElementById('it-weight').value.trim()   || null,
    category:    document.getElementById('it-category').value.trim() || null,
    notes:       document.getElementById('it-notes').value.trim()    || null,
    isConsumable:!!document.getElementById('it-consumable').checked,
    isEquipped:  !!document.getElementById('it-equipped').checked,
  });
  await saveItems(_invCharId, items);
  closeModal('modal-item');
  refreshInventaireTab();
}

async function submitEditItem(id) {
  const name = document.getElementById('it-name').value.trim();
  if (!name) { document.getElementById('it-error').textContent = 'Le nom est obligatoire.'; return; }
  const char = await getCharacter(_invCharId);
  const items = getItems(char);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], name,
      description: document.getElementById('it-desc').value.trim(),
      quantity:    parseInt(document.getElementById('it-qty').value) || 1,
      weight:      document.getElementById('it-weight').value.trim()   || null,
      category:    document.getElementById('it-category').value.trim() || null,
      notes:       document.getElementById('it-notes').value.trim()    || null,
      isConsumable:!!document.getElementById('it-consumable').checked,
      isEquipped:  !!document.getElementById('it-equipped').checked,
    };
  }
  await saveItems(_invCharId, items);
  closeModal('modal-item');
  refreshInventaireTab();
}

// ═══════════════════════════════════════════════════════════════