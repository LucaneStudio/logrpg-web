// CARACT — Sections & Widgets — v1.2.0
// ═══════════════════════════════════════════════════════════════

// ── Couleurs accent ───────────────────────────────────────────────────────────
const ACCENT = {
  PURPLE: { main:'#A78BFA', light:'#EDE9FF', name:'PURPLE' },
  BLUE:   { main:'#5B9CF6', light:'#DDEAFF', name:'BLUE'   },
  RED:    { main:'#FF6B6B', light:'#FFE0E0', name:'RED'     },
  GREEN:  { main:'#5CC8A8', light:'#D4F2EA', name:'GREEN'   },
  ORANGE: { main:'#FF8C42', light:'#FFEDE0', name:'ORANGE'  },
  YELLOW: { main:'#FFD166', light:'#FFF3CC', name:'YELLOW'  },
};
const ACCENT_LIST = Object.values(ACCENT);

let _caractCharId = null;

// ── Render principal ──────────────────────────────────────────────────────────
async function renderCaractTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _caractCharId = char.id;
  const sections = getStatSections(char);
  const area = document.getElementById('content-area');

  const sectionsHtml = sections.map((s, i) => renderSection(s, i, sections.length)).join('');
  const emptyState = sections.length === 0 ? `
    <div style="text-align:center;padding:30px 20px;">
      <div style="font-size:40px;margin-bottom:10px;opacity:.5;">📋</div>
      <div style="font-size:13px;font-weight:700;color:var(--text-mid);margin-bottom:16px;">Aucune section pour l'instant</div>
      <button class="btn btn-primary" style="margin-bottom:8px;width:100%;" onclick="openTemplateModal()">
        ✨ Utiliser un template
      </button>
    </div>` : '';

  area.innerHTML = `
    <div id="caract-root">
      ${emptyState}
      <div id="sections-list" style="display:flex;flex-direction:column;">${sectionsHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="add-pill orange" style="flex:1;" onclick="openAddSectionModal()">＋ Ajouter une section</button>
        ${sections.length === 0 ? '' : `<button class="add-pill green" style="flex:1;" onclick="openTemplateModal()">✨ Template</button>`}
      </div>
    </div>`;

  _bindDragDrop();
}

// ── Render section ────────────────────────────────────────────────────────────
function renderSection(section, index, total) {
  const widgetsHtml = renderWidgetGrid(section);
  const showHandle  = total > 1;
  return `
  <div class="card stat-section" data-section-id="${section.id}"
       draggable="${showHandle}"
       ondragstart="onSectionDragStart(event,'${section.id}')"
       ondragover="onSectionDragOver(event)"
       ondrop="onSectionDrop(event,'${section.id}')"
       ondragend="onSectionDragEnd(event)"
       ondragleave="onSectionDragLeave(event)"
       oncontextmenu="event.preventDefault();openSectionContextMenu(event,'${section.id}')">
    <div class="stat-section-header">
      <span class="stat-section-title">${escapeHtml(section.title.toUpperCase())}</span>
      ${showHandle ? `<span class="section-drag-handle" title="Glisser pour réordonner">⠿</span>` : ''}
    </div>
    <div class="stat-widget-grid">${widgetsHtml}</div>
  </div>`;
}

// ── Render grille widgets ─────────────────────────────────────────────────────
function renderWidgetGrid(section) {
  const widgets = section.widgets || [];
  return widgets.map(w => {
    const a = ACCENT[w.accentColor] || ACCENT.PURPLE;
    return renderWidgetRead(w, a, section.id);
  }).join('');
}

// ── Widget lecture ────────────────────────────────────────────────────────────
function renderWidgetRead(w, a, sectionId) {
  return `
  <div class="stat-widget-cell" style="background:${a.light}22;border:1.5px solid ${a.main}40;"
       oncontextmenu="event.preventDefault();openWidgetContextMenu(event,'${sectionId}','${w.id}')">
    <div class="stat-widget-title">${escapeHtml(w.title)}</div>
    ${renderWidgetValue(w, a)}
  </div>`;
}

function renderWidgetValue(w, a) {
  const val = w.value || '';
  switch (w.type) {
    case 'CAR_MOD': {
      if (w.modFirst) {
        // Modificateur en avant : modif en grand + valeur en badge pill secondaire
        return `
          <div style="font-size:26px;font-weight:900;color:var(--text);line-height:1;">${w.modifier || '—'}</div>
          ${val ? `<div style="padding:2px 8px;border-radius:99px;background:#F0F3F2;border:1.5px solid #DDE2E6;font-size:11px;font-weight:700;color:var(--text-mid);margin-top:3px;">${escapeHtml(val)}</div>` : ''}`;
      }
      // Par défaut : valeur en grand + modif en badge pill coloré
      return `
        <div style="font-size:26px;font-weight:900;color:var(--text);line-height:1;">${val || '—'}</div>
        ${w.modifier ? `<div style="padding:2px 8px;border-radius:99px;background:${a.light};border:1.5px solid ${a.main}50;font-size:11px;font-weight:900;color:${a.main};margin-top:3px;">${escapeHtml(w.modifier)}</div>` : ''}`;
    }
    case 'SWITCH': {
      const isOn = w.value === 'true';
      return `
        <div onclick="event.stopPropagation();toggleSwitchWidget('${w._sectionId||''}','${w.id}')"
             style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div class="widget-switch-track ${isOn ? 'on' : ''}" style="${isOn ? `background:${a.main};` : ''}">
            <div class="widget-switch-thumb"></div>
          </div>
          <span style="font-size:10px;font-weight:800;color:${isOn ? a.main : 'var(--text-light)'};">${isOn ? 'Actif' : 'Inactif'}</span>
        </div>`;
    }
    case 'PERCENT': {
      const pct = Math.max(0, Math.min(100, parseInt(val) || 0));
      const r = 22, circ = 2 * Math.PI * r, dash = circ * pct / 100;
      return `
        <div style="position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center;">
          <svg width="60" height="60" viewBox="0 0 60 60" style="position:absolute;top:0;left:0;transform:rotate(-90deg)">
            <circle cx="30" cy="30" r="${r}" fill="none" stroke="${a.main}" stroke-width="5.5" opacity="0.2"/>
            <circle cx="30" cy="30" r="${r}" fill="none" stroke="${a.main}" stroke-width="5.5"
                    stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"/>
          </svg>
          <span style="font-size:14px;font-weight:800;color:${a.main};position:relative;z-index:1;">${pct}%</span>
        </div>`;
    }
    default: // FREE
      return `<div style="font-size:28px;font-weight:900;color:var(--text);line-height:1;">${val || '—'}</div>`;
  }
}

// ── Toggle switch widget (clic direct) ────────────────────────────────────────
async function toggleSwitchWidget(sectionId, widgetId) {
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  sections.forEach(s => s.widgets.forEach(w => {
    if (w.id === widgetId) w.value = w.value === 'true' ? 'false' : 'true';
  }));
  await saveStatSections(_caractCharId, sections);
  refreshCaractTab();
}

// ── Drag & Drop sections ──────────────────────────────────────────────────────
let _dragSectionId  = null;
let _dropTargetId   = null;  // section sous le curseur
let _dropPosition   = null;  // 'before' | 'after'

function _bindDragDrop() {}

function onSectionDragStart(e, sectionId) {
  _dragSectionId = sectionId;
  e.dataTransfer.effectAllowed = 'move';
  // Léger délai pour que l'opacité s'applique après la capture du ghost
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}

function onSectionDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  _dragSectionId = null;
  _dropTargetId  = null;
  _dropPosition  = null;
  _clearDropIndicators();
}

function onSectionDragOver(e) {
  if (!_dragSectionId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const targetId = e.currentTarget.dataset.sectionId;
  if (targetId === _dragSectionId) return;
  const rect     = e.currentTarget.getBoundingClientRect();
  const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  if (targetId === _dropTargetId && position === _dropPosition) return; // pas de repaint inutile
  _dropTargetId  = targetId;
  _dropPosition  = position;
  _renderDropIndicators();
}

function onSectionDragLeave(e) {
  // Ignorer si on entre dans un enfant de la même card
  if (e.currentTarget.contains(e.relatedTarget)) return;
  const targetId = e.currentTarget.dataset.sectionId;
  if (targetId === _dropTargetId) {
    _dropTargetId = null;
    _dropPosition = null;
    _clearDropIndicators();
  }
}

async function onSectionDrop(e, targetSectionId) {
  e.preventDefault();
  // Capturer tout ce qu'il faut AVANT tout await
  const fromId    = _dragSectionId;
  const toId      = targetSectionId;
  const position  = _dropPosition; // 'before' | 'after'
  _clearDropIndicators();
  if (!fromId || fromId === toId) return;

  const char     = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const fromIdx  = sections.findIndex(s => s.id === fromId);
  const toIdx    = sections.findIndex(s => s.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;

  // Retirer l'élément source
  const [moved] = sections.splice(fromIdx, 1);
  // Recalculer toIdx après suppression
  const newToIdx = sections.findIndex(s => s.id === toId);
  const insertAt = position === 'after' ? newToIdx + 1 : newToIdx;
  sections.splice(insertAt, 0, moved);

  await saveStatSections(_caractCharId, sections);
  refreshCaractTab();
}

// ── Indicateurs visuels de drop (ligne verte entre cards) ──────────────────
function _clearDropIndicators() {
  document.querySelectorAll('.section-drop-line').forEach(el => el.remove());
  document.querySelectorAll('.stat-section.dragging').forEach(el => el.classList.remove('dragging'));
}

function _renderDropIndicators() {
  _clearDropIndicators();
  if (!_dropTargetId || !_dropPosition) return;
  const targetEl = document.querySelector(`.stat-section[data-section-id="${_dropTargetId}"]`);
  if (!targetEl) return;
  const line = document.createElement('div');
  line.className = 'section-drop-line';
  if (_dropPosition === 'before') {
    targetEl.parentNode.insertBefore(line, targetEl);
  } else {
    targetEl.parentNode.insertBefore(line, targetEl.nextSibling);
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindCaractEvents() {}


// ── Context menu section ──────────────────────────────────────────────────────
let _ctxSectionId = null;
function openSectionContextMenu(e, sectionId) {
  e.stopPropagation();
  _ctxSectionId = sectionId;
  const menu = document.getElementById('section-context-menu');
  getCharacter(_caractCharId).then(char => {
    const s = getStatSections(char).find(s => s.id === sectionId);
    const el = document.getElementById('section-context-title');
    if (el && s) el.textContent = s.title;
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 230 > window.innerWidth)  x = window.innerWidth  - 234;
  if (y + 110 > window.innerHeight) y = window.innerHeight - 114;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closeSectionContextMenu() {
  document.getElementById('section-context-menu').style.display = 'none';
  _ctxSectionId = null;
}
function openAddWidgetFromCtx() {
  const sid = _ctxSectionId;
  closeSectionContextMenu();
  openAddWidgetModal(sid);
}
function renameSectionFromCtx() {
  const sid = _ctxSectionId;
  closeSectionContextMenu();
  openRenameSectionModal(sid);
}
async function deleteSectionFromCtx() {
  const sid = _ctxSectionId;
  closeSectionContextMenu();
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char).filter(s => s.id !== sid);
  await saveStatSections(_caractCharId, sections);
  refreshCaractTab();
}

// ── Context menu widget ───────────────────────────────────────────────────────
let _ctxWidgetSectionId = null, _ctxWidgetId = null;
function openWidgetContextMenu(e, sectionId, widgetId) {
  e.stopPropagation();
  _ctxWidgetSectionId = sectionId; _ctxWidgetId = widgetId;
  const menu = document.getElementById('widget-context-menu');
  getCharacter(_caractCharId).then(char => {
    const s = getStatSections(char).find(s => s.id === sectionId);
    const w = s?.widgets.find(w => w.id === widgetId);
    const titleEl = document.getElementById('widget-context-title');
    if (titleEl && w) titleEl.textContent = w.title;
    // Mettre à jour le label inversion
    const invertBtn = document.getElementById('widget-ctx-invert');
    if (invertBtn && w) {
      invertBtn.style.display = w.type === 'CAR_MOD' ? '' : 'none';
      invertBtn.textContent   = (w.modFirst ? '🔄 Valeur en avant' : '🔄 Modificateur en avant');
    }
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 230 > window.innerWidth)  x = window.innerWidth  - 234;
  if (y + 160 > window.innerHeight) y = window.innerHeight - 164;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closeWidgetContextMenu() {
  document.getElementById('widget-context-menu').style.display = 'none';
  _ctxWidgetSectionId = null; _ctxWidgetId = null;
}
function editWidgetValueFromCtx() {
  const sid = _ctxWidgetSectionId, wid = _ctxWidgetId;
  closeWidgetContextMenu();
  openEditWidgetValueModal(sid, wid);
}
function editWidgetFromCtx() {
  const sid = _ctxWidgetSectionId, wid = _ctxWidgetId;
  closeWidgetContextMenu();
  openEditWidgetModal(sid, wid);
}
async function deleteWidgetFromCtx() {
  const wid = _ctxWidgetId;
  closeWidgetContextMenu();
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  sections.forEach(s => { s.widgets = s.widgets.filter(w => w.id !== wid); });
  await saveStatSections(_caractCharId, sections);
  refreshCaractTab();
}
async function toggleModFirstFromCtx() {
  const wid = _ctxWidgetId;
  closeWidgetContextMenu();
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  sections.forEach(s => s.widgets.forEach(w => {
    if (w.id === wid) w.modFirst = !w.modFirst;
  }));
  await saveStatSections(_caractCharId, sections);
  refreshCaractTab();
}

// ── Modals valeur ─────────────────────────────────────────────────────────────
async function openEditWidgetValueModal(sectionId, widgetId) {
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === sectionId);
  const w = s?.widgets.find(w => w.id === widgetId);
  if (!w) return;
  const isPercent = w.type === 'PERCENT';
  const isCarMod  = w.type === 'CAR_MOD';
  const isSwitch  = w.type === 'SWITCH';
  if (isSwitch) { await toggleSwitchWidget(sectionId, widgetId); return; }
  document.getElementById('edit-val-title').textContent = w.title;
  document.getElementById('edit-val-input').value       = w.value || '';
  document.getElementById('edit-val-input').type        = isPercent ? 'number' : 'text';
  document.getElementById('edit-val-input').min         = isPercent ? '0' : '';
  document.getElementById('edit-val-input').max         = isPercent ? '100' : '';
  document.getElementById('edit-val-input').placeholder = isPercent ? '0–100' : 'Valeur';
  const modRow = document.getElementById('edit-val-mod-row');
  modRow.style.display = isCarMod ? 'block' : 'none';
  if (isCarMod) document.getElementById('edit-val-mod-input').value = w.modifier || '';
  document.getElementById('edit-val-section').value = sectionId;
  document.getElementById('edit-val-widget').value  = widgetId;
  openModal('modal-edit-value');
  setTimeout(() => {
    document.getElementById('edit-val-input').focus();
    document.getElementById('edit-val-input').select();
  }, 100);
}

async function submitEditWidgetValue() {
  const sectionId = document.getElementById('edit-val-section').value;
  const widgetId  = document.getElementById('edit-val-widget').value;
  const value     = document.getElementById('edit-val-input').value;
  const modifier  = document.getElementById('edit-val-mod-input').value;
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  sections.forEach(s => s.widgets.forEach(w => {
    if (w.id === widgetId) { w.value = value; w.modifier = modifier; }
  }));
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-edit-value');
  refreshCaractTab();
}

// ── Templates ─────────────────────────────────────────────────────────────────
const STAT_TEMPLATES = {
  dnd5e: {
    name: 'D&D 5e / Pathfinder',
    emoji: '⚔️',
    sections: [
      { title: 'Caractéristiques', widgets: [
        { title: 'Force',        type:'CAR_MOD', accentColor:'RED'    },
        { title: 'Dextérité',    type:'CAR_MOD', accentColor:'GREEN'  },
        { title: 'Constitution', type:'CAR_MOD', accentColor:'ORANGE' },
        { title: 'Intelligence', type:'CAR_MOD', accentColor:'BLUE'   },
        { title: 'Sagesse',      type:'CAR_MOD', accentColor:'PURPLE' },
        { title: 'Charisme',     type:'CAR_MOD', accentColor:'YELLOW' },
      ]},
      { title: 'Combat', widgets: [
        { title: 'Armure',     type:'FREE', accentColor:'BLUE'   },
        { title: 'Initiative', type:'FREE', accentColor:'YELLOW' },
        { title: 'Vitesse',    type:'FREE', accentColor:'GREEN'  },
        { title: 'Maîtrise',   type:'FREE', accentColor:'PURPLE' },
      ]},
      { title: 'Jets de sauvegarde', widgets: [
        { title: 'FOR', type:'FREE', accentColor:'RED'    },
        { title: 'DEX', type:'FREE', accentColor:'GREEN'  },
        { title: 'CON', type:'FREE', accentColor:'ORANGE' },
        { title: 'INT', type:'FREE', accentColor:'BLUE'   },
        { title: 'SAG', type:'FREE', accentColor:'PURPLE' },
        { title: 'CHA', type:'FREE', accentColor:'YELLOW' },
      ]},
    ]
  },
  coc: {
    name: 'Call of Cthulhu (BRP)',
    emoji: '🐙',
    sections: [
      { title: 'Caractéristiques', widgets: [
        { title: 'Force',        type:'PERCENT', accentColor:'RED'    },
        { title: 'Constitution', type:'PERCENT', accentColor:'ORANGE' },
        { title: 'Taille',       type:'PERCENT', accentColor:'YELLOW' },
        { title: 'Dextérité',    type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Apparence',    type:'PERCENT', accentColor:'PURPLE' },
        { title: 'Intelligence', type:'PERCENT', accentColor:'BLUE'   },
        { title: 'Pouvoir',      type:'PERCENT', accentColor:'PURPLE' },
        { title: 'Éducation',    type:'PERCENT', accentColor:'BLUE'   },
        { title: 'Chance',       type:'PERCENT', accentColor:'YELLOW' },
      ]},
      { title: 'Combat & Valeurs dérivées', widgets: [
        { title: 'Points de vie', type:'FREE',    accentColor:'RED'    },
        { title: 'Santé mentale', type:'FREE',    accentColor:'PURPLE' },
        { title: 'Esquive',       type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Armure',        type:'FREE',    accentColor:'BLUE'   },
      ]},
      { title: 'Compétences', widgets: [
        { title: 'Écoute',       type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Discrétion',   type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Bibliothèque', type:'PERCENT', accentColor:'BLUE'   },
        { title: 'Médecine',     type:'PERCENT', accentColor:'RED'    },
        { title: 'Persuasion',   type:'PERCENT', accentColor:'YELLOW' },
        { title: 'Occultisme',   type:'PERCENT', accentColor:'PURPLE' },
      ]},
    ]
  },
  cyberpunk: {
    name: 'Cyberpunk Red',
    emoji: '🤖',
    sections: [
      { title: 'Stats', widgets: [
        { title: 'INT',  type:'FREE', accentColor:'BLUE'   },
        { title: 'REF',  type:'FREE', accentColor:'GREEN'  },
        { title: 'DEX',  type:'FREE', accentColor:'GREEN'  },
        { title: 'TECH', type:'FREE', accentColor:'ORANGE' },
        { title: 'COOL', type:'FREE', accentColor:'PURPLE' },
        { title: 'WILL', type:'FREE', accentColor:'RED'    },
        { title: 'LUCK', type:'FREE', accentColor:'YELLOW' },
        { title: 'MOVE', type:'FREE', accentColor:'GREEN'  },
        { title: 'BODY', type:'FREE', accentColor:'RED'    },
        { title: 'EMP',  type:'FREE', accentColor:'PURPLE' },
      ]},
      { title: 'Combat', widgets: [
        { title: 'HP max',    type:'FREE', accentColor:'RED'    },
        { title: 'Armure SP', type:'FREE', accentColor:'BLUE'   },
        { title: 'Humanité',  type:'FREE', accentColor:'PURPLE' },
        { title: 'Rôle / Rang', type:'FREE', accentColor:'YELLOW' },
      ]},
      { title: 'Compétences', widgets: [
        { title: 'Athlétisme',   type:'FREE', accentColor:'GREEN'  },
        { title: 'Brawling',     type:'FREE', accentColor:'RED'    },
        { title: 'Conduite',     type:'FREE', accentColor:'ORANGE' },
        { title: 'Déguisement',  type:'FREE', accentColor:'PURPLE' },
        { title: 'Electronique', type:'FREE', accentColor:'BLUE'   },
        { title: 'Piratage',     type:'FREE', accentColor:'BLUE'   },
      ]},
    ]
  },
  anatheme: {
    name: 'Anathème',
    emoji: '✨',
    sections: [
      { title: 'Caractéristiques', widgets: [
        { title: 'Physique', type:'PERCENT', accentColor:'RED'    },
        { title: 'Mental',   type:'PERCENT', accentColor:'BLUE'   },
        { title: 'Social',   type:'PERCENT', accentColor:'ORANGE' },
        { title: 'Arcane',   type:'PERCENT', accentColor:'PURPLE' },
      ]},
      { title: 'Valeurs de Combat', widgets: [
        { title: 'Points d\'Armure', type:'FREE', accentColor:'BLUE'   },
        { title: 'Initiative',       type:'FREE', accentColor:'YELLOW' },
      ]},
    ]
  },
};

function openTemplateModal() { openModal('modal-template'); }

async function applyTemplate(templateKey) {
  const tpl = STAT_TEMPLATES[templateKey];
  if (!tpl) return;
  const char = await getCharacter(_caractCharId || _selectedCharId);
  const existing = getStatSections(char);
  if (existing.length > 0 && !confirm('Remplacer les sections existantes par ce template ?')) return;
  const sections = tpl.sections.map(s => ({
    id: newSectionId(),
    title: s.title,
    widgets: s.widgets.map(w => ({
      id: newWidgetId(),
      sectionId: '',
      title: w.title,
      type: w.type,
      value: w.type === 'PERCENT' ? '50' : w.type === 'CAR_MOD' ? '10' : w.type === 'SWITCH' ? 'false' : '',
      modifier: w.type === 'CAR_MOD' ? '0' : '',
      accentColor: w.accentColor,
      modFirst: false,
    }))
  }));
  await saveStatSections(_caractCharId || _selectedCharId, sections);
  closeModal('modal-template');
  refreshCaractTab();
  showToast(`✨ Template ${tpl.name} appliqué !`);
}

// ── Modals section ────────────────────────────────────────────────────────────
function openAddSectionModal() {
  document.getElementById('add-section-input').value = '';
  document.getElementById('add-section-error').textContent = '';
  openModal('modal-add-section');
  setTimeout(() => document.getElementById('add-section-input').focus(), 100);
}
async function submitAddSection() {
  const title = document.getElementById('add-section-input').value.trim();
  if (!title) { document.getElementById('add-section-error').textContent = 'Le titre est obligatoire.'; return; }
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const newId = newSectionId();
  sections.push({ id: newId, title, widgets: [] });
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-add-section');
  refreshCaractTab();
  setTimeout(() => openAddWidgetModal(newId), 80);
}

function openRenameSectionModal(sectionId) {
  _ctxSectionId = sectionId;
  document.getElementById('rename-section-input').value = '';
  document.getElementById('rename-section-error').textContent = '';
  openModal('modal-rename-section');
  setTimeout(async () => {
    const char = await getCharacter(_caractCharId);
    const s = getStatSections(char).find(s => s.id === sectionId);
    if (s) document.getElementById('rename-section-input').value = s.title;
    document.getElementById('rename-section-input').focus();
    document.getElementById('rename-section-input').select();
  }, 100);
}
async function submitRenameSection() {
  const title = document.getElementById('rename-section-input').value.trim();
  if (!title) { document.getElementById('rename-section-error').textContent = 'Le titre est obligatoire.'; return; }
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === _ctxSectionId);
  if (s) s.title = title;
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-rename-section');
  refreshCaractTab();
}

// ── Modals widget ─────────────────────────────────────────────────────────────
let _addWidgetSectionId = null;
function openAddWidgetModal(sectionId) {
  _addWidgetSectionId = sectionId;
  document.getElementById('add-widget-title').value = '';
  document.getElementById('add-widget-error').textContent = '';
  document.getElementById('add-widget-type').value = 'FREE';
  document.getElementById('add-widget-color').value = 'PURPLE';
  document.getElementById('add-widget-modfirst').checked = false;
  _updateModFirstRow('add-widget-type', 'add-widget-modfirst-row');
  openModal('modal-add-widget');
  requestAnimationFrame(() => {
    renderColorDots('add-widget-color', 'PURPLE');
    document.getElementById('add-widget-title').focus();
  });
}
async function submitAddWidget() {
  const title = document.getElementById('add-widget-title').value.trim();
  if (!title) { document.getElementById('add-widget-error').textContent = 'Le titre est obligatoire.'; return; }
  const type  = document.getElementById('add-widget-type').value;
  const color = document.getElementById('add-widget-color').value;
  const char  = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === _addWidgetSectionId);
  const modFirst = type === 'CAR_MOD' && document.getElementById('add-widget-modfirst').checked;
  if (s) s.widgets.push({
    id: newWidgetId(), sectionId: _addWidgetSectionId, title, type,
    value:    type === 'PERCENT' ? '50' : type === 'CAR_MOD' ? '10' : type === 'SWITCH' ? 'false' : '',
    modifier: type === 'CAR_MOD' ? '0' : '',
    accentColor: color,
    modFirst,
  });
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-add-widget');
  refreshCaractTab();
}

let _editWidgetSectionId = null, _editWidgetId = null;
async function openEditWidgetModal(sectionId, widgetId) {
  _editWidgetSectionId = sectionId; _editWidgetId = widgetId;
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === sectionId);
  const w = s?.widgets.find(w => w.id === widgetId);
  if (!w) return;
  document.getElementById('edit-widget-title').value = w.title;
  document.getElementById('edit-widget-type').value  = w.type;
  document.getElementById('edit-widget-color').value = w.accentColor;
  document.getElementById('edit-widget-modfirst').checked = !!w.modFirst;
  document.getElementById('edit-widget-error').textContent = '';
  _updateModFirstRow('edit-widget-type', 'edit-widget-modfirst-row');
  openModal('modal-edit-widget');
  requestAnimationFrame(() => renderColorDots('edit-widget-color', w.accentColor));
}
async function submitEditWidget() {
  const title = document.getElementById('edit-widget-title').value.trim();
  if (!title) { document.getElementById('edit-widget-error').textContent = 'Le titre est obligatoire.'; return; }
  const type  = document.getElementById('edit-widget-type').value;
  const color = document.getElementById('edit-widget-color').value;
  const char  = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  sections.forEach(s => s.widgets.forEach(w => {
    if (w.id === _editWidgetId) {
      w.title = title; w.type = type; w.accentColor = color;
      w.modFirst = type === 'CAR_MOD' && document.getElementById('edit-widget-modfirst').checked;
      if (type === 'SWITCH' && w.value !== 'true' && w.value !== 'false') w.value = 'false';
    }
  }));
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-edit-widget');
  refreshCaractTab();
}

// ── Helper visibilité row modFirst ───────────────────────────────────────────
function _updateModFirstRow(typeInputId, rowId) {
  const type = document.getElementById(typeInputId)?.value;
  const row  = document.getElementById(rowId);
  if (row) row.style.display = type === 'CAR_MOD' ? '' : 'none';
}

// ── Color dots ────────────────────────────────────────────────────────────────
function renderColorDots(hiddenInputId, selected) {
  const container = document.getElementById(hiddenInputId + '-dots');
  if (!container) return;
  container.innerHTML = ACCENT_LIST.map(a => `
    <div onclick="selectColor('${hiddenInputId}','${a.name}')"
         style="width:24px;height:24px;border-radius:50%;background:${a.main};cursor:pointer;flex-shrink:0;
                outline:${selected === a.name ? '3px solid var(--text)' : '2px solid transparent'};
                outline-offset:2px;transition:outline .15s;"></div>`).join('');
}
function selectColor(hiddenInputId, name) {
  document.getElementById(hiddenInputId).value = name;
  renderColorDots(hiddenInputId, name);
}

// ═══════════════════════════════════════════════════════════════