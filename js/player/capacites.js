// CAPACITÉS
// ═══════════════════════════════════════════════════════════════

// Couleur de la barre latérale selon catégorie (identique à AbilityCard.kt)
function abilityAccentColor(category) {
  if (!category) return 'var(--purple)';
  const c = category.toLowerCase();
  if (c.includes('combat'))  return 'var(--red)';
  if (c.includes('magie'))   return 'var(--blue)';
  if (c.includes('social'))  return 'var(--yellow)';
  if (c.includes('passive')) return 'var(--green)';
  return 'var(--purple)';
}

let _capCharId = null;
let _capSearch = '';
let _expandedIds = new Set();

// ── Render principal ──────────────────────────────────────────────────────────
async function renderCapacitesTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _capCharId = char.id;
  const abilities = getAbilities(char);
  const area = document.getElementById('content-area');

  const filtered = abilities.filter(a => {
    if (!_capSearch) return true;
    const q = _capSearch.toLowerCase();
    return a.name.toLowerCase().includes(q)
        || (a.description || '').toLowerCase().includes(q)
        || (a.category    || '').toLowerCase().includes(q)
        || (a.cost        || '').toLowerCase().includes(q);
  });

  const cardsHtml = filtered.length === 0
    ? `<div class="empty-panel"><div class="emoji">${_capSearch ? '🔍' : '✨'}</div>
       <p>${_capSearch ? 'Aucun résultat' : 'Aucune capacité.<br>Ajoute la première !'}</p></div>`
    : filtered.map(a => renderAbilityCard(a)).join('');

  area.innerHTML = `
    <div id="cap-root">
      <div class="search-bar" style="margin-bottom:10px;">
        <span>🔍</span>
        <input id="cap-search-input" placeholder="Rechercher une capacité..."
               value="${escapeHtml(_capSearch)}"
               oninput="onCapSearch(this.value)"/>
      </div>
      ${cardsHtml}
      <button class="add-pill orange" style="margin-top:4px;" onclick="openAddAbilityModal()">
        ＋ Ajouter une capacité
      </button>
    </div>`;

  // Restaurer le focus si recherche active
  if (_capSearch) {
    const inp = document.getElementById('cap-search-input');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

function onCapSearch(val) {
  _capSearch = val;
  refreshCapacitesTab();
}

// ── Render carte capacité ─────────────────────────────────────────────────────
function renderAbilityCard(a) {
  const expanded = _expandedIds.has(a.id);
  const accent   = abilityAccentColor(a.category);

  const badges = [
    a.category ? `<span class="ability-badge" style="color:${accent};background:${accent}1a;">${escapeHtml(a.category)}</span>` : '',
    a.cost     ? `<span class="ability-badge" style="color:var(--orange);background:var(--orange-l);">${escapeHtml(a.cost)}</span>` : '',
  ].filter(Boolean).join('');

  const details = expanded ? `
    <div class="ability-detail">
      <div style="height:1px;background:#F0F3F2;margin:10px 0;"></div>
      ${a.description ? `<p style="font-size:13px;color:var(--text-mid);line-height:1.6;margin-bottom:8px;">${escapeHtml(a.description)}</p>` : ''}
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${a.range    ? `<span class="ability-detail-row">🎯 <b>Portée</b> ${escapeHtml(a.range)}</span>` : ''}
        ${a.duration ? `<span class="ability-detail-row">⏱️ <b>Durée</b> ${escapeHtml(a.duration)}</span>` : ''}
        ${a.damage   ? `<span class="ability-detail-row">⚔️ <b>Dégâts</b> ${escapeHtml(a.damage)}</span>` : ''}
      </div>
    </div>` : '';

  return `
  <div class="card ability-card-item" style="margin-bottom:8px;position:relative;overflow:hidden;cursor:pointer;"
       onclick="toggleAbility('${a.id}')"
       oncontextmenu="event.preventDefault();openAbilityContextMenu(event,'${a.id}')">
    <div class="ability-accent-bar" style="background:linear-gradient(180deg,${accent},${accent}33);"></div>
    <div style="padding:12px 14px 12px 18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:13.5px;font-weight:800;color:var(--text);flex:1;">${escapeHtml(a.name)}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${badges}
          <span style="font-size:12px;color:var(--text-light);">${expanded ? '∧' : '∨'}</span>
        </div>
      </div>
      ${details}
    </div>
  </div>`;
}

function toggleAbility(id) {
  if (_expandedIds.has(id)) _expandedIds.delete(id);
  else _expandedIds.add(id);
  refreshCapacitesTab();
}

// ── Context menu capacité ─────────────────────────────────────────────────────
let _ctxAbilityId = null;
function openAbilityContextMenu(e, id) {
  e.stopPropagation();
  _ctxAbilityId = id;
  const menu = document.getElementById('ability-context-menu');
  getCharacter(_capCharId).then(char => {
    const a = getAbilities(char).find(a => a.id === id);
    const el = document.getElementById('ability-ctx-title');
    if (el && a) el.textContent = a.name;
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 230 > window.innerWidth)  x = window.innerWidth  - 234;
  if (y + 100 > window.innerHeight) y = window.innerHeight - 104;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closeAbilityContextMenu() {
  document.getElementById('ability-context-menu').style.display = 'none';
  _ctxAbilityId = null;
}
function editAbilityFromCtx() {
  const id = _ctxAbilityId;
  closeAbilityContextMenu();
  openEditAbilityModal(id);
}
async function deleteAbilityFromCtx() {
  const id = _ctxAbilityId;
  closeAbilityContextMenu();
  const char = await getCharacter(_capCharId);
  const abilities = getAbilities(char).filter(a => a.id !== id);
  await saveAbilities(_capCharId, abilities);
  refreshCapacitesTab();
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openAddAbilityModal() {
  ['ab-name','ab-desc','ab-cost','ab-range','ab-duration','ab-damage','ab-category']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('ab-error').textContent = '';
  document.getElementById('ab-modal-title').textContent = '✨ Nouvelle capacité';
  document.getElementById('ab-submit-btn').onclick = submitAddAbility;
  openModal('modal-ability');
  setTimeout(() => document.getElementById('ab-name').focus(), 100);
}

async function openEditAbilityModal(id) {
  const char = await getCharacter(_capCharId);
  const a = getAbilities(char).find(a => a.id === id);
  if (!a) return;
  document.getElementById('ab-name').value     = a.name        || '';
  document.getElementById('ab-desc').value     = a.description || '';
  document.getElementById('ab-cost').value     = a.cost        || '';
  document.getElementById('ab-range').value    = a.range       || '';
  document.getElementById('ab-duration').value = a.duration    || '';
  document.getElementById('ab-damage').value   = a.damage      || '';
  document.getElementById('ab-category').value = a.category    || '';
  document.getElementById('ab-error').textContent = '';
  document.getElementById('ab-modal-title').textContent = '✏️ Modifier la capacité';
  document.getElementById('ab-submit-btn').onclick = () => submitEditAbility(id);
  openModal('modal-ability');
  setTimeout(() => document.getElementById('ab-name').focus(), 100);
}

async function submitAddAbility() {
  const name = document.getElementById('ab-name').value.trim();
  if (!name) { document.getElementById('ab-error').textContent = 'Le nom est obligatoire.'; return; }
  const char = await getCharacter(_capCharId);
  const abilities = getAbilities(char);
  abilities.push({
    id:          newAbilityId(),
    name,
    description: document.getElementById('ab-desc').value.trim(),
    cost:        document.getElementById('ab-cost').value.trim()     || null,
    range:       document.getElementById('ab-range').value.trim()    || null,
    duration:    document.getElementById('ab-duration').value.trim() || null,
    damage:      document.getElementById('ab-damage').value.trim()   || null,
    category:    document.getElementById('ab-category').value.trim() || null,
  });
  await saveAbilities(_capCharId, abilities);
  closeModal('modal-ability');
  refreshCapacitesTab();
}

async function submitEditAbility(id) {
  const name = document.getElementById('ab-name').value.trim();
  if (!name) { document.getElementById('ab-error').textContent = 'Le nom est obligatoire.'; return; }
  const char = await getCharacter(_capCharId);
  const abilities = getAbilities(char);
  const idx = abilities.findIndex(a => a.id === id);
  if (idx !== -1) {
    abilities[idx] = {
      ...abilities[idx],
      name,
      description: document.getElementById('ab-desc').value.trim(),
      cost:        document.getElementById('ab-cost').value.trim()     || null,
      range:       document.getElementById('ab-range').value.trim()    || null,
      duration:    document.getElementById('ab-duration').value.trim() || null,
      damage:      document.getElementById('ab-damage').value.trim()   || null,
      category:    document.getElementById('ab-category').value.trim() || null,
    };
  }
  await saveAbilities(_capCharId, abilities);
  closeModal('modal-ability');
  refreshCapacitesTab();
}

// ═══════════════════════════════════════════════════════════════