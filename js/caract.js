// CARACT — Sections & Widgets
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

// état d'édition : sectionId en cours ou null
let _caractCharId = null;

// ── Render principal ──────────────────────────────────────────────────────────
async function renderCaractTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _caractCharId = char.id;
  const sections = getStatSections(char);
  const area = document.getElementById('content-area');

  const sectionsHtml = sections.map(s => renderSection(s)).join('');
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
      ${sectionsHtml}
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="add-pill orange" style="flex:1;" onclick="openAddSectionModal()">＋ Ajouter une section</button>
        ${sections.length === 0 ? '' : `<button class="add-pill green" style="flex:1;" onclick="openTemplateModal()">✨ Template</button>`}
      </div>
    </div>`;

  bindCaractEvents();
}

// ── Render section ────────────────────────────────────────────────────────────
function renderSection(section) {
  const widgetsHtml = renderWidgetGrid(section);
  return `
  <div class="card stat-section" data-section-id="${section.id}" style="margin-bottom:12px;cursor:context-menu;"
       oncontextmenu="event.preventDefault();openSectionContextMenu(event,'${section.id}')">
    <div class="stat-section-header">
      <span class="stat-section-title">${escapeHtml(section.title.toUpperCase())}</span>
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
    ${renderWidgetValue(w, a, false)}
  </div>`;
}


function renderWidgetValue(w, a, editing) {
  const val = w.value || '';
  switch(w.type) {
    case 'CAR_MOD': return `
      <div style="font-size:26px;font-weight:900;color:var(--text);line-height:1;">${val || '—'}</div>
      ${w.modifier ? `<div style="padding:2px 8px;border-radius:99px;background:${a.light};border:1.5px solid ${a.main}50;font-size:11px;font-weight:900;color:${a.main};margin-top:3px;">${escapeHtml(w.modifier)}</div>` : ''}`;
    case 'PERCENT': {
      const pct2 = Math.max(0, Math.min(100, parseInt(val)||0));
      const r2=22, circ2=2*Math.PI*r2, dash2=circ2*pct2/100;
      // hex -> rgba 20% pour le track (comme accent.copy(alpha=.2f) Kotlin)
      return `
      <div style="position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center;">
        <svg width="60" height="60" viewBox="0 0 60 60" style="position:absolute;top:0;left:0;transform:rotate(-90deg)">
          <circle cx="30" cy="30" r="${r2}" fill="none" stroke="${a.main}" stroke-width="5.5" opacity="0.2"/>
          <circle cx="30" cy="30" r="${r2}" fill="none" stroke="${a.main}" stroke-width="5.5"
                  stroke-dasharray="${dash2.toFixed(1)} ${circ2.toFixed(1)}" stroke-linecap="round"/>
        </svg>
        <span style="font-size:14px;font-weight:800;color:${a.main};position:relative;z-index:1;">${pct2}%</span>
      </div>`;
    }
    default: // FREE
      return `<div style="font-size:28px;font-weight:900;color:var(--text);line-height:1;">${val || '—'}</div>`;
  }
}


// ── Events ────────────────────────────────────────────────────────────────────
function bindCaractEvents() {} // les handlers sont inline via onclick/oncontextmenu




// ── Context menu section ──────────────────────────────────────────────────────
let _ctxSectionId = null;
function openSectionContextMenu(e, sectionId) {
  e.stopPropagation();
  _ctxSectionId = sectionId;
  const menu = document.getElementById('section-context-menu');
  getCharacter(_caractCharId).then(char => {
    const s = getStatSections(char).find(s => s.id === sectionId);
    const titleEl = document.getElementById('section-context-title');
    if (titleEl && s) titleEl.textContent = s.title;
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
  // Trouver le titre du widget pour l'afficher
  getCharacter(_caractCharId).then(char => {
    const sections = getStatSections(char);
    const s = sections.find(s => s.id === sectionId);
    const w = s?.widgets.find(w => w.id === widgetId);
    const titleEl = document.getElementById('widget-context-title');
    if (titleEl && w) titleEl.textContent = w.title;
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 230 > window.innerWidth)  x = window.innerWidth  - 234;
  if (y + 130 > window.innerHeight) y = window.innerHeight - 134;
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

async function openEditWidgetValueModal(sectionId, widgetId) {
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === sectionId);
  const w = s?.widgets.find(w => w.id === widgetId);
  if (!w) return;
  // Remplir le modal selon le type
  const isPercent  = w.type === 'PERCENT';
  const isCarMod   = w.type === 'CAR_MOD';
  document.getElementById('edit-val-title').textContent = w.title;
  document.getElementById('edit-val-input').value = w.value || '';
  document.getElementById('edit-val-input').type  = isPercent ? 'number' : 'text';
  document.getElementById('edit-val-input').min   = isPercent ? '0' : '';
  document.getElementById('edit-val-input').max   = isPercent ? '100' : '';
  document.getElementById('edit-val-input').placeholder = isPercent ? '0–100' : 'Valeur';
  const modRow = document.getElementById('edit-val-mod-row');
  modRow.style.display = isCarMod ? 'block' : 'none';
  if (isCarMod) document.getElementById('edit-val-mod-input').value = w.modifier || '';
  document.getElementById('edit-val-section').value = sectionId;
  document.getElementById('edit-val-widget').value  = widgetId;
  openModal('modal-edit-value');
  setTimeout(() => { document.getElementById('edit-val-input').focus(); document.getElementById('edit-val-input').select(); }, 100);
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

function editWidgetFromCtx() {
  // Capturer avant fermeture du menu qui remet à null
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

// ── Templates ────────────────────────────────────────────────────────────────
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
        { title: 'Armure',       type:'FREE', accentColor:'BLUE'   },
        { title: 'Initiative',   type:'FREE', accentColor:'YELLOW' },
        { title: 'Vitesse',      type:'FREE', accentColor:'GREEN'  },
        { title: 'Maîtrise',     type:'FREE', accentColor:'PURPLE' },
      ]},
      { title: 'Jets de sauvegarde', widgets: [
        { title: 'FOR',  type:'FREE', accentColor:'RED'    },
        { title: 'DEX',  type:'FREE', accentColor:'GREEN'  },
        { title: 'CON',  type:'FREE', accentColor:'ORANGE' },
        { title: 'INT',  type:'FREE', accentColor:'BLUE'   },
        { title: 'SAG',  type:'FREE', accentColor:'PURPLE' },
        { title: 'CHA',  type:'FREE', accentColor:'YELLOW' },
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
        { title: 'Points de vie', type:'FREE', accentColor:'RED'    },
        { title: 'Santé mentale', type:'FREE', accentColor:'PURPLE' },
        { title: 'Esquive',       type:'PERCENT', accentColor:'GREEN' },
        { title: 'Armure',        type:'FREE', accentColor:'BLUE'   },
      ]},
      { title: 'Compétences', widgets: [
        { title: 'Écoute',        type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Discrétion',    type:'PERCENT', accentColor:'GREEN'  },
        { title: 'Bibliothèque',  type:'PERCENT', accentColor:'BLUE'   },
        { title: 'Médecine',      type:'PERCENT', accentColor:'RED'    },
        { title: 'Persuasion',    type:'PERCENT', accentColor:'YELLOW' },
        { title: 'Occultisme',    type:'PERCENT', accentColor:'PURPLE' },
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
        { title: 'HP max',       type:'FREE', accentColor:'RED'    },
        { title: 'Armure SP',    type:'FREE', accentColor:'BLUE'   },
        { title: 'Humanité',     type:'FREE', accentColor:'PURPLE' },
        { title: 'Rôle / Rang',  type:'FREE', accentColor:'YELLOW' },
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

function openTemplateModal() {
  openModal('modal-template');
}

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
      sectionId: '', // sera ignoré
      title: w.title,
      type: w.type,
      value: w.type === 'PERCENT' ? '50' : w.type === 'CAR_MOD' ? '10' : '',
      modifier: w.type === 'CAR_MOD' ? '0' : '',
      accentColor: w.accentColor,
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
  // Ouvrir directement l'ajout de widget dans la nouvelle section
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
  if (s) s.widgets.push({ id: newWidgetId(), sectionId: _addWidgetSectionId, title, type, value: type === 'PERCENT' ? '50' : type === 'CAR_MOD' ? '10' : '', modifier: type === 'CAR_MOD' ? '0' : '', accentColor: color });
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-add-widget');
  refreshCaractTab();
}

let _editWidgetSectionId = null, _editWidgetId = null;
async function openEditWidgetModal(sectionId, widgetId) {
  _editWidgetSectionId = sectionId; _editWidgetId = widgetId;
  // Charger le widget AVANT d'ouvrir le modal
  const char = await getCharacter(_caractCharId);
  const sections = getStatSections(char);
  const s = sections.find(s => s.id === sectionId);
  const w = s?.widgets.find(w => w.id === widgetId);
  if (!w) return;
  document.getElementById('edit-widget-title').value = w.title;
  document.getElementById('edit-widget-type').value  = w.type;
  document.getElementById('edit-widget-color').value = w.accentColor;
  document.getElementById('edit-widget-error').textContent = '';
  openModal('modal-edit-widget');
  // renderColorDots après ouverture du modal (DOM visible)
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
    if (w.id === _editWidgetId) { w.title = title; w.type = type; w.accentColor = color; }
  }));
  await saveStatSections(_caractCharId, sections);
  closeModal('modal-edit-widget');
  refreshCaractTab();
}

// ── Color dots ────────────────────────────────────────────────────────────────
function renderColorDots(hiddenInputId, selected) {
  const container = document.getElementById(hiddenInputId + '-dots');
  if (!container) return;
  container.innerHTML = ACCENT_LIST.map(a => `
    <div onclick="selectColor('${hiddenInputId}','${a.name}')"
         style="width:24px;height:24px;border-radius:50%;background:${a.main};cursor:pointer;flex-shrink:0;
                outline:${selected===a.name?'3px solid var(--text)':'2px solid transparent'};
                outline-offset:2px;transition:outline .15s;"></div>`).join('');
}
function selectColor(hiddenInputId, name) {
  document.getElementById(hiddenInputId).value = name;
  renderColorDots(hiddenInputId, name);
}

// ═══════════════════════════════════════════════════════════════