// MJ — TAGS @ref (liens cliquables dans les scénarios + autocomplétion)
// ═══════════════════════════════════════════════════════════════
// Un tag s'écrit @Mot ou @{Nom complet}. Il pointe vers une ressource
// MJ par nom : image, rencontre (combat), PNJ ou session.

let _mjTagIndex = [];   // [{ name, lname, type, id, icon }]
let _mjBacklinks = {};  // 'type:id' -> [{ sessionId, docId, docTitle, sessionTitle }]

const _MJ_TAG_META = {
  scenario:  { icon: '📄', section: 'sessions',   label: 'Scénario' },
  encounter: { icon: '⚔️',  section: 'encounters', label: 'Combat'   },
  npc:       { icon: '🧑', section: 'npcs',       label: 'PNJ'      },
  objet:     { icon: '📦', section: 'objects',    label: 'Objet'    },
  lieu:      { icon: '📍', section: 'places',     label: 'Lieu'     },
  asset:     { icon: '🖼️', section: 'assets',     label: 'Image'    },
};

// Cache d'object URLs pour les aperçus d'image (évite les fuites)
let _mjImgUrlCache = {};
function _mjAssetUrl(asset) {
  if (!asset || !asset.data) return null;
  if (!_mjImgUrlCache[asset.id]) _mjImgUrlCache[asset.id] = URL.createObjectURL(asset.data);
  return _mjImgUrlCache[asset.id];
}

// ── Index des ressources taggables ────────────────────────────
async function mjBuildTagIndex() {
  const idx = [];
  try {
    const [sessions, encounters, npcs, objects, places, assets] = await Promise.all([
      mjGetSessions(), mjGetEncounters(), mjGetNpcs(),
      (typeof mjGetObjects === 'function' ? mjGetObjects() : []),
      (typeof mjGetPlaces  === 'function' ? mjGetPlaces()  : []),
      db.mj_assets.toArray(),
    ]);
    const bestiary = (typeof bestiaryGetAll === 'function') ? bestiaryGetAll() : [];

    // Scénarios = documents à l'intérieur des sessions
    sessions.forEach(s => (s.docs || []).forEach(d => idx.push({
      name: d.title || 'Sans titre', type: 'scenario', id: d.id,
      sessionId: s.id, parentName: s.title || 'Session',
      excerpt: (d.content || '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
    })));

    encounters.forEach(e => {
      const parts = (e.participants || []).map(p => {
        if (p.bestiaryId) {
          const t = bestiary.find(b => b.id === p.bestiaryId);
          return t ? { name: t.name, ptype: t.type, qty: p.qty || 1 } : null;
        }
        return { name: p.name, ptype: p.ptype || 'MONSTRE', qty: p.qty || 1 };
      }).filter(Boolean);
      idx.push({ name: e.title || 'Sans titre', type: 'encounter', id: e.id, location: e.location || '', parts });
    });

    npcs.forEach(n => {
      const a = n.assetId ? assets.find(x => x.id === n.assetId) : null;
      idx.push({ name: n.name || 'Sans nom', type: 'npc', id: n.id,
        role: n.role || '', status: n.status || 'UNKNOWN', portrait: a ? _mjAssetUrl(a) : null });
    });

    objects.forEach(o => {
      const a = o.assetId ? assets.find(x => x.id === o.assetId) : null;
      idx.push({ name: o.name || 'Sans nom', type: 'objet', id: o.id,
        otype: o.otype || '', rarity: o.rarity || 'common', owner: o.owner || '',
        excerpt: (o.notes || '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140),
        portrait: a ? _mjAssetUrl(a) : null });
    });

    places.forEach(p => {
      const a = p.assetId ? assets.find(x => x.id === p.assetId) : null;
      idx.push({ name: p.name || 'Sans nom', type: 'lieu', id: p.id,
        ptype: p.ptype || '', region: p.region || '',
        excerpt: (p.notes || '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140),
        portrait: a ? _mjAssetUrl(a) : null });
    });

    assets.forEach(a => idx.push({ name: a.name || 'image', type: 'asset', id: a.id, url: _mjAssetUrl(a) }));

    // Normaliser puis publier l'index direct
    idx.forEach(r => {
      r.name  = (r.name || '').trim();          // ignore les espaces parasites des noms
      r.icon  = _MJ_TAG_META[r.type].icon;
      r.lname = r.name.toLowerCase();
    });
    _mjTagIndex = idx;

    // Index inverse : quels scénarios référencent chaque ressource
    const backlinks = {};
    sessions.forEach(s => (s.docs || []).forEach(d => {
      const seen = new Set();
      _mjScanTags(d.content || '').forEach(name => {
        const res = _mjTagFind(name.toLowerCase());
        if (!res || res.type === 'scenario') return;   // pas de lien scénario→scénario ici
        const key = res.type + ':' + res.id;
        if (seen.has(key)) return;
        seen.add(key);
        (backlinks[key] = backlinks[key] || []).push({
          sessionId: s.id, docId: d.id,
          docTitle: (d.title || 'Sans titre').trim(),
          sessionTitle: (s.title || 'Session').trim(),
        });
      });
    }));
    _mjBacklinks = backlinks;
  } catch (e) {
    console.error('Index tags MJ', e);
    _mjTagIndex = idx;
  }
  return idx;
}

function _mjTagFind(rawNameLower) {
  return _mjTagIndex.find(r => r.lname === rawNameLower) || null;
}

// Décode les entités HTML d'un fragment (pour comparer aux noms bruts)
function _mjUnescape(s) {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

// ── Transforme les @tags du HTML rendu en pastilles cliquables ──
function mjLinkifyTags(html) {
  return html.replace(/(^|[^\wÀ-ÿ])@(\{([^}]+)\}|([\wÀ-ÿ\-]+))/g,
    (m, pre, _whole, braced, simple) => {
      const shown = (braced != null ? braced : simple).trim();
      const res   = _mjTagFind(_mjUnescape(shown).toLowerCase());
      if (res) {
        const idArg = (typeof res.id === 'string') ? `'${res.id}'` : res.id;
        const extra = res.type === 'scenario' ? `,${res.sessionId}` : '';
        const hover = ` data-type="${res.type}" data-id="${typeof res.id === 'string' ? escapeHtml(res.id) : res.id}"`
                    + ` onmouseenter="mjTagHover(event)" onmouseleave="mjTagPreviewHide()"`;
        return `${pre}<span class="mj-tag mj-tag-${res.type}" title="${_MJ_TAG_META[res.type].label} : ${escapeHtml(res.name)}"`
             + ` onclick="mjTagGo('${res.type}',${idArg}${extra})"${hover}>${res.icon} ${escapeHtml(res.name)}</span>`;
      }
      return `${pre}<span class="mj-tag broken" title="Cliquer pour créer « ${shown} »"`
           + ` data-name="${escapeHtml(_mjUnescape(shown))}" onclick="mjTagCreateMenu(event)">@${shown}</span>`;
    });
}

// ── Index inverse : rétroliens ────────────────────────────────
// Extrait les noms tagués (@Mot / @{Nom}) du texte brut d'un scénario
function _mjScanTags(content) {
  const names = [];
  const re = /(^|[^\wÀ-ÿ])@(\{([^}]+)\}|([\wÀ-ÿ\-]+))/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = (m[3] != null ? m[3] : m[4]).trim();
    if (name) names.push(name);
  }
  return names;
}

function mjBacklinksFor(type, id) {
  return _mjBacklinks[type + ':' + id] || [];
}

// Bouton compact "🔗 N" pour l'en-tête de fiche (vide si aucun rétrolien)
function mjRenderBacklinksButton(type, id) {
  const n = mjBacklinksFor(type, id).length;
  if (!n) return '';
  return `<button class="mj-btn-refs" onclick="mjShowRefs('${type}',${id})"`
       + ` title="Scénarios qui référencent cet élément">🔗 ${n}</button>`;
}

// Sidebar latérale listant les scénarios qui référencent la ressource
function _mjRefsEl() {
  let el = document.getElementById('mj-refs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-refs';
    el.innerHTML = `
      <div class="mj-refs-backdrop" onclick="mjCloseRefs()"></div>
      <div class="mj-refs-panel">
        <div class="mj-refs-hdr">
          <span id="mj-refs-title">🔗 Référencé par</span>
          <button class="btn-icon" onclick="mjCloseRefs()">✕</button>
        </div>
        <div class="mj-refs-list" id="mj-refs-list"></div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function mjShowRefs(type, id) {
  const list = mjBacklinksFor(type, id);
  const el = _mjRefsEl();
  el.querySelector('#mj-refs-title').textContent = `🔗 Référencé par (${list.length})`;
  el.querySelector('#mj-refs-list').innerHTML = list.length
    ? list.map(b => `
        <div class="mj-refs-item" onclick="mjCloseRefs();mjTagGo('scenario','${b.docId}',${b.sessionId})">
          <span class="mj-tree-ico">📄</span>
          <div style="min-width:0;flex:1;">
            <div class="mj-refs-doc">${escapeHtml(b.docTitle)}</div>
            <div class="mj-refs-sess">📁 ${escapeHtml(b.sessionTitle)}</div>
          </div>
        </div>`).join('')
    : `<div class="mj-empty-sm">Aucune référence.</div>`;
  el.classList.add('open');
}

function mjCloseRefs() {
  const el = document.getElementById('mj-refs');
  if (el) el.classList.remove('open');
}

// ── Créer une ressource depuis un tag cassé ───────────────────
function _mjCreateMenuEl() {
  let el = document.getElementById('mj-create-menu');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-create-menu';
    el.innerHTML = `
      <div class="mj-create-backdrop" onclick="mjCreateMenuClose()"></div>
      <div class="mj-create-card" id="mj-create-card">
        <div class="mj-create-hdr" id="mj-create-title"></div>
        <div class="mj-create-opt" onclick="mjTagCreate('scenario')">📄 Scénario</div>
        <div class="mj-create-opt" onclick="mjTagCreate('encounter')">⚔️ Combat</div>
        <div class="mj-create-opt" onclick="mjTagCreate('npc')">🧑 PNJ</div>
        <div class="mj-create-opt" onclick="mjTagCreate('objet')">📦 Objet</div>
        <div class="mj-create-opt" onclick="mjTagCreate('lieu')">📍 Lieu</div>
        <div class="mj-create-opt" onclick="mjTagCreate('asset')">🖼️ Image (importer)</div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function mjTagCreateMenu(e) {
  e.stopPropagation();
  const name = e.currentTarget.dataset.name || '';
  if (!name) return;
  const el = _mjCreateMenuEl();
  el.dataset.name = name;
  el.querySelector('#mj-create-title').textContent = `Créer « ${name} » comme :`;
  el.style.display = 'block';
  const card = el.querySelector('#mj-create-card');
  const r = e.currentTarget.getBoundingClientRect();
  card.style.left = '0px'; card.style.top = '0px';
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let left = r.left;
  let top  = r.bottom + 4;
  if (top + ch > window.innerHeight - 8) top = r.top - ch - 4;
  left = Math.max(8, Math.min(left, window.innerWidth - cw - 8));
  card.style.left = left + 'px';
  card.style.top  = top + 'px';
}

function mjCreateMenuClose() {
  const el = document.getElementById('mj-create-menu');
  if (el) el.style.display = 'none';
}

async function mjTagCreate(type) {
  const menu = document.getElementById('mj-create-menu');
  const name = menu ? (menu.dataset.name || '') : '';
  mjCreateMenuClose();
  if (!name) return;

  if (type === 'asset') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      await mjSaveAsset(name, file.type, file);
      await _mjAfterCreate('image');
    };
    input.click();
    return;
  }

  if (type === 'npc') {
    await mjSaveNpc({ name, role: '', status: 'UNKNOWN', notes: '' });
  } else if (type === 'objet') {
    await mjSaveObject({ name, otype: '', rarity: 'common', owner: '', notes: '' });
  } else if (type === 'lieu') {
    await mjSavePlace({ name, ptype: '', region: '', notes: '' });
  } else if (type === 'encounter') {
    await mjSaveEncounter({ title: name, location: '', participants: [], prepNotes: '' });
  } else if (type === 'scenario') {
    if (!_mjSession) return;
    if (!_mjSession.docs) _mjSession.docs = [];
    _mjSession.docs.push({ id: _newDocId(), title: name, content: '' });
    await mjSaveSession(_mjSession);
  } else {
    return;
  }
  const labels = { npc: 'PNJ', objet: 'objet', lieu: 'lieu', encounter: 'combat', scenario: 'scénario' };
  await _mjAfterCreate(labels[type] || 'ressource');
}

async function _mjAfterCreate(label) {
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  // Déplier la session courante pour que le scénario créé soit visible dans l'arbre
  if (typeof _mjExpanded !== 'undefined' && _mjSession) _mjExpanded.add(_mjSession.id);
  // Rafraîchir l'arbre (un scénario créé apparaît) puis le détail (le tag devient valide)
  if (typeof mjRenderSessionsList === 'function')  await mjRenderSessionsList();
  if (typeof mjRenderSessionDetail === 'function') mjRenderSessionDetail();
  if (typeof showToast === 'function') showToast(`✅ ${label ? label[0].toUpperCase() + label.slice(1) : 'Ressource'} créé`);
}

// ── Navigation au clic ────────────────────────────────────────
async function mjTagGo(type, id, parentId) {
  const meta = _MJ_TAG_META[type];
  if (!meta) return;
  mjTagPreviewHide();   // l'aperçu ne se ferme pas tout seul après la redirection
  const ac = document.getElementById('mj-ac'); if (ac) ac.style.display = 'none';
  if (_mjSection !== meta.section) await mjSwitchSection(meta.section);
  if (type === 'scenario')  { await mjSelectSession(parentId); await mjSelectDocFromTree(parentId, id); }
  else if (type === 'encounter') await mjSelectEncounter(id);
  else if (type === 'npc')       await mjSelectNpc(id);
  else if (type === 'objet')     await mjSelectObject(id);
  else if (type === 'lieu')      await mjSelectPlace(id);
  else if (type === 'asset')     await mjSelectAsset(id);
}

// ═══════════════════════════════════════════════════════════════
// Autocomplétion dans la zone de texte (#mj-doc-content)
// ═══════════════════════════════════════════════════════════════
let _mjAcOpen       = false;
let _mjAcItems      = [];
let _mjAcIndex      = 0;
let _mjAcTokenStart = -1;
let _mjAcBraced     = false;
let _mjAcSig        = '';
let _mjAcMode       = 'tag';   // 'tag' (@) | 'widget' (/)
let _mjAcTargetId   = 'mj-doc-content';   // champ courant pour l'autocomplétion
let _mjAcTagOnly    = false;              // true = pas de widgets « / » (champs autres que le scénario)

// Modèles insérés par l'autocomplétion « / » ($ = position du curseur après insertion)
const _MJ_WIDGET_AC = [
  { key: 'switch',   icon: '🔘', desc: 'Interrupteur on/off',  tpl: '/switch{$}' },
  { key: 'todo',     icon: '☑️', desc: 'Case à cocher',         tpl: '/todo{$}' },
  { key: 'combo',    icon: '🔽', desc: 'Liste déroulante',     tpl: '/combo{$: option1|option2}' },
  { key: 'compteur', icon: '🔢', desc: 'Compteur +/− (unité)', tpl: '/compteur{$}' },
  { key: 'jauge',    icon: '🕐', desc: 'Horloge segmentée',     tpl: '/jauge{$: 6}' },
  { key: 'details',  icon: '▶️', desc: 'Bloc repliable',        tpl: '/details{$ | contenu}' },
];

function _mjAcEl() {
  let el = document.getElementById('mj-ac');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-ac';
    el.className = 'mj-ac';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function mjAcClose() {
  _mjAcOpen = false;
  _mjAcSig  = '';
  const el = document.getElementById('mj-ac');
  if (el) el.style.display = 'none';
}

function mjAcBlur() {
  setTimeout(mjAcClose, 150);
}

// Scénario (textarea) : tags @ + widgets /
function mjAcUpdate() { _mjAcTargetId = 'mj-doc-content'; _mjAcTagOnly = false; _mjAcRun(); }
// Champ générique (input) : uniquement les tags @
function mjAcUpdateField(el) { if (!el || !el.id) return; _mjAcTargetId = el.id; _mjAcTagOnly = true; _mjAcRun(); }

// Recalcule le token @… à gauche du curseur et affiche le menu
function _mjAcRun() {
  const ta = document.getElementById(_mjAcTargetId);
  if (!ta) { mjAcClose(); return; }
  const caret = ta.selectionStart;
  const val   = ta.value;

  // Déclencheur le plus proche à gauche du curseur : @ (tag) ou / (widget)
  const atTag = val.lastIndexOf('@', caret - 1);
  const atWdg = _mjAcTagOnly ? -1 : val.lastIndexOf('/', caret - 1);
  const at    = Math.max(atTag, atWdg);
  if (at === -1) { mjAcClose(); return; }
  if (at > 0 && /[\wÀ-ÿ]/.test(val[at - 1])) { mjAcClose(); return; }

  const partial = val.slice(at + 1, caret);

  // ── Mode widget « / » : suggère switch / cycle / compteur ──
  if (at === atWdg) {
    if (!/^[a-zà-ÿ]*$/i.test(partial)) { mjAcClose(); return; }  // accolade/espace → plus un token
    const q   = partial.trim().toLowerCase();
    const sig = 'w|' + at + '|' + q;
    if (sig === _mjAcSig && _mjAcOpen) return;
    _mjAcSig = sig;
    _mjAcMode       = 'widget';
    _mjAcItems      = _MJ_WIDGET_AC.filter(w => w.key.includes(q));
    _mjAcTokenStart = at;
    _mjAcBraced     = false;
    _mjAcIndex      = 0;
    _mjAcRender(ta, caret);
    return;
  }

  // ── Mode tag « @ » ──
  let braced = false, query = partial;
  if (partial.startsWith('{')) {
    if (partial.includes('}')) { mjAcClose(); return; }
    braced = true; query = partial.slice(1);
  } else if (!/^[\wÀ-ÿ\-]*$/.test(partial)) {
    mjAcClose(); return;   // espace ou autre → plus un token
  }

  const q   = query.trim().toLowerCase();
  const sig = 't|' + at + '|' + braced + '|' + q;
  if (sig === _mjAcSig && _mjAcOpen) return;   // rien de neuf → ne pas réinitialiser
  _mjAcSig = sig;

  let items = q ? _mjTagIndex.filter(r => r.lname.includes(q)) : _mjTagIndex.slice();
  items = items.slice(0, 8);
  _mjAcMode       = 'tag';
  _mjAcItems      = items;
  _mjAcTokenStart = at;
  _mjAcBraced     = braced;
  _mjAcIndex      = 0;
  _mjAcRender(ta, caret);
}

function _mjAcRender(ta, caret) {
  const el = _mjAcEl();
  if (!_mjAcItems.length) {
    el.innerHTML = `<div class="mj-ac-empty">Aucun résultat</div>`;
  } else if (_mjAcMode === 'widget') {
    el.innerHTML = _mjAcItems.map((w, i) => `
      <div class="mj-ac-item ${i === _mjAcIndex ? 'sel' : ''}"
           onmousedown="event.preventDefault();mjAcInsertByIndex(${i})">
        <span class="mj-ac-ico">${w.icon}</span>
        <span class="mj-ac-name">/${escapeHtml(w.key)} <span style="color:var(--text-light);font-weight:600;">· ${escapeHtml(w.desc)}</span></span>
        <span class="mj-ac-type">Widget</span>
      </div>`).join('');
  } else {
    el.innerHTML = _mjAcItems.map((r, i) => `
      <div class="mj-ac-item ${i === _mjAcIndex ? 'sel' : ''}"
           onmousedown="event.preventDefault();mjAcInsertByIndex(${i})">
        <span class="mj-ac-ico">${r.icon}</span>
        <span class="mj-ac-name">${escapeHtml(r.name)}${r.parentName ? ` <span style="color:var(--text-light);font-weight:600;">· ${escapeHtml(r.parentName)}</span>` : ''}</span>
        <span class="mj-ac-type">${_MJ_TAG_META[r.type].label}</span>
      </div>`).join('');
  }
  const c = _mjCaretCoords(ta, caret);
  el.style.display = 'block';
  el.style.top  = (c.top + c.lineHeight + 2) + 'px';
  el.style.left = c.left + 'px';
  const r = el.getBoundingClientRect();
  if (r.right  > window.innerWidth  - 8) el.style.left = Math.max(8, window.innerWidth  - 8 - r.width)  + 'px';
  if (r.bottom > window.innerHeight - 8) el.style.top  = Math.max(8, c.top - r.height - 2) + 'px';
  _mjAcOpen = true;
}

function _mjAcMove(d) {
  if (!_mjAcItems.length) return;
  _mjAcIndex = (_mjAcIndex + d + _mjAcItems.length) % _mjAcItems.length;
  const el = _mjAcEl();
  [...el.querySelectorAll('.mj-ac-item')].forEach((it, i) => it.classList.toggle('sel', i === _mjAcIndex));
  const sel = el.querySelector('.mj-ac-item.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function mjAcInsertByIndex(i) {
  const item = _mjAcItems[i];
  if (!item) return;
  if (_mjAcMode === 'widget') _mjAcInsertWidget(item);
  else _mjAcInsert(item);
}

// Insère un modèle de widget ; place le curseur sur le marqueur $
function _mjAcInsertWidget(w) {
  const ta = document.getElementById('mj-doc-content');
  if (!ta || _mjAcTokenStart < 0) return;
  const caret  = ta.selectionStart;
  const before = ta.value.slice(0, _mjAcTokenStart);
  const after  = ta.value.slice(caret);
  const mark   = w.tpl.indexOf('$');
  const insert = w.tpl.replace('$', '');
  ta.value = before + insert + after;
  const pos = before.length + (mark >= 0 ? mark : insert.length);
  mjAcClose();
  ta.focus();
  ta.setSelectionRange(pos, pos);
  _mjDocChanged();
}

function _mjAcInsert(item) {
  const ta = document.getElementById(_mjAcTargetId);
  if (!ta || _mjAcTokenStart < 0) return;
  const caret  = ta.selectionStart;
  const before = ta.value.slice(0, _mjAcTokenStart);
  const after  = ta.value.slice(caret);
  // Accolades dès que le nom n'est pas un token simple (espace, apostrophe, ponctuation…)
  const token  = /^[\wÀ-ÿ-]+$/.test(item.name) ? `@${item.name}` : `@{${item.name}}`;
  ta.value = before + token + after;
  const pos = before.length + token.length;
  mjAcClose();
  ta.focus();
  ta.setSelectionRange(pos, pos);
  if (_mjAcTargetId === 'mj-doc-content') _mjDocChanged();   // sauvegarde différée du scénario
  else ta.dispatchEvent(new Event('change'));                // déclenche le onchange du champ
}

// Navigation clavier (appelée depuis onkeydown du textarea)
function mjAcKeydown(e) {
  if (!_mjAcOpen) return;
  if      (e.key === 'ArrowDown') { e.preventDefault(); _mjAcMove(1); }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); _mjAcMove(-1); }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); mjAcInsertByIndex(_mjAcIndex); }
  else if (e.key === 'Escape')    { e.preventDefault(); mjAcClose(); }
}

// keyup : ignorer les touches de navigation/validation pour ne pas
// réinitialiser la sélection ni rouvrir le menu après insertion
function mjAcKeyup(e) {
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
  mjAcUpdate();
}
// keyup pour un champ générique (input) en mode tag uniquement
function mjAcKeyupField(e, el) {
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
  mjAcUpdateField(el);
}

// ═══════════════════════════════════════════════════════════════
// Aperçu d'image au survol d'un tag image
// ═══════════════════════════════════════════════════════════════
function _mjTagPreviewEl() {
  let el = document.getElementById('mj-tag-preview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-tag-preview';
    el.className = 'mj-tag-preview';
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function mjTagHover(e) {
  const tag = e.currentTarget;
  if (!tag || !tag.dataset) return;
  const r = _mjTagIndex.find(x => x.type === tag.dataset.type && String(x.id) === String(tag.dataset.id));
  if (!r) return;
  const html = _mjTagPreviewHtml(r);
  if (!html) return;
  const box = _mjTagPreviewEl();
  box.className   = 'mj-tag-preview mj-prev-' + r.type;
  box.innerHTML   = html;
  box.style.display = 'block';
  const place = () => _mjTagPreviewPlace(tag);
  const img = box.querySelector('img');
  if (img) img.onload = place;
  place();
}

function _encEmoji(t) { return t === 'PNJ' ? '🧑' : t === 'PJ' ? '⭐' : '🐉'; }

function _mjTagPreviewHtml(r) {
  if (r.type === 'asset') {
    return r.url ? `<img alt="" src="${r.url}"/>` : '';
  }
  if (r.type === 'encounter') {
    const rows = (r.parts && r.parts.length)
      ? r.parts.map(p => `<div class="mj-prev-row"><span>${_encEmoji(p.ptype)} ${escapeHtml(p.name)}</span><span class="mj-prev-qty">×${p.qty}</span></div>`).join('')
      : `<div class="mj-prev-empty">Aucun participant</div>`;
    return `<div class="mj-prev-card">
      <div class="mj-prev-title">⚔️ ${escapeHtml(r.name)}</div>
      ${r.location ? `<div class="mj-prev-sub">📍 ${escapeHtml(r.location)}</div>` : ''}
      <div class="mj-prev-list">${rows}</div>
    </div>`;
  }
  if (r.type === 'npc') {
    const st = (typeof _npcStatusMeta === 'function') ? _npcStatusMeta(r.status) : null;
    const portrait = r.portrait
      ? `<img class="mj-prev-portrait" alt="" src="${r.portrait}"/>`
      : `<div class="mj-prev-portrait ph">${escapeHtml((r.name[0] || '?').toUpperCase())}</div>`;
    return `<div class="mj-prev-card mj-prev-npc-card">
      ${portrait}
      <div style="min-width:0;">
        <div class="mj-prev-title">${escapeHtml(r.name)}</div>
        ${r.role ? `<div class="mj-prev-sub">${escapeHtml(r.role)}</div>` : ''}
        ${st ? `<div class="mj-prev-badge" style="color:${st.color};background:${st.bg};">${st.label}</div>` : ''}
      </div>
    </div>`;
  }
  if (r.type === 'objet') {
    const rm = (typeof _objRarityMeta === 'function') ? _objRarityMeta(r.rarity) : null;
    const portrait = r.portrait
      ? `<img class="mj-prev-portrait" alt="" src="${r.portrait}"/>`
      : `<div class="mj-prev-portrait ph">📦</div>`;
    return `<div class="mj-prev-card mj-prev-npc-card">
      ${portrait}
      <div style="min-width:0;">
        <div class="mj-prev-title">${escapeHtml(r.name)}</div>
        ${r.otype ? `<div class="mj-prev-sub">${escapeHtml(r.otype)}${r.owner ? ' · ' + escapeHtml(r.owner) : ''}</div>` : (r.owner ? `<div class="mj-prev-sub">${escapeHtml(r.owner)}</div>` : '')}
        ${rm ? `<div class="mj-prev-badge" style="color:${rm.color};background:${rm.bg};">${rm.label}</div>` : ''}
      </div>
    </div>`;
  }
  if (r.type === 'lieu') {
    const portrait = r.portrait
      ? `<img class="mj-prev-portrait" alt="" src="${r.portrait}"/>`
      : `<div class="mj-prev-portrait ph">📍</div>`;
    return `<div class="mj-prev-card mj-prev-npc-card">
      ${portrait}
      <div style="min-width:0;">
        <div class="mj-prev-title">${escapeHtml(r.name)}</div>
        ${r.ptype ? `<div class="mj-prev-sub">${escapeHtml(r.ptype)}</div>` : ''}
        ${r.region ? `<div class="mj-prev-sub">📍 ${escapeHtml(r.region)}</div>` : ''}
      </div>
    </div>`;
  }
  if (r.type === 'scenario') {
    return `<div class="mj-prev-card">
      <div class="mj-prev-title">📄 ${escapeHtml(r.name)}</div>
      <div class="mj-prev-sub">📁 ${escapeHtml(r.parentName || '')}</div>
      <div class="mj-prev-excerpt">${r.excerpt ? escapeHtml(r.excerpt) + '…' : '<span style="opacity:.55">Document vide</span>'}</div>
    </div>`;
  }
  return '';
}

function _mjTagPreviewPlace(tag) {
  const box = _mjTagPreviewEl();
  const r   = tag.getBoundingClientRect();
  const bw  = box.offsetWidth, bh = box.offsetHeight;
  let left = r.left + r.width / 2 - bw / 2;
  let top  = r.top - bh - 8;
  if (top < 8) top = r.bottom + 8;                    // bascule en dessous si pas de place au-dessus
  left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
  box.style.left = left + 'px';
  box.style.top  = top + 'px';
}

function mjTagPreviewHide() {
  const el = document.getElementById('mj-tag-preview');
  if (el) el.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// Widgets interactifs : /switch /cycle /compteur
// ═══════════════════════════════════════════════════════════════
// L'état vit DANS le texte du scénario (comme une case Markdown) :
// il persiste, part dans l'export ZIP, et ne nécessite aucun store.
//   /switch{Objet trouvé}             interrupteur éteint (le bouton suit le libellé)
//   /switch[x]{Objet trouvé}          interrupteur allumé
//   /todo{Parler au forgeron}         case à cocher (texte barré si cochée)
//   /todo[x]{Parler au forgeron}      cochée
//   /combo{Porte: fermée|ouverte}     liste déroulante (état 0)
//   /combo[1]{Porte: fermée|ouverte}  état courant = index 1
//   /compteur{pv}                     compteur 0 avec unité : « − 0 pv + »
//   /compteur[3]{pv: 0..4}            compteur = 3, borné à 0..4
//   /jauge{Rituel: 6}                 horloge segmentée 0/6
//   /jauge[2]{Rituel: 6}              2 segments remplis sur 6
//   /details{Titre | contenu replié} bloc repliable (élément <details> natif)
//
// Interactifs en mode Aperçu (👁). Le changement réécrit le token dans
// le contenu du document puis re-rend. Regex recréée à chaque appel
// pour éviter les soucis de lastIndex avec le flag /g.
// Widgets « inline » (une ligne, état dans [ ]). /details est traité à part
// (multi-lignes) par mjExtractDetails, donc absent d'ici : ainsi les index de
// widgets restent cohérents entre le rendu et les handlers de clic.
function _mjWidgetRe() {
  return /\/(switch|todo|combo|compteur|jauge)(?:\[([^\]]*)\])?\{([^}]*)\}/g;
}

// Extrait les /details (multi-lignes / Markdown) AVANT renderMarkdown : rend le
// contenu proprement et renvoie un placeholder à réinjecter après le Markdown.
function mjExtractDetails(content) {
  const blocks = [];
  const re = /\/details(?:\[[^\]]*\])?\{([\s\S]*?)\}/g;
  const text = (content || '').replace(re, (full, body) => {
    const pi      = body.indexOf('|');
    const summary = (pi >= 0 ? body.slice(0, pi) : body).trim();
    const inner   = (pi >= 0 ? body.slice(pi + 1) : '').trim();   // trim → saut de ligne initial ignoré
    let innerHtml = inner && typeof renderMarkdown === 'function' ? renderMarkdown(inner) : '';
    if (inner && typeof mjLinkifyTags === 'function') innerHtml = mjLinkifyTags(innerHtml);
    blocks.push(`<details class="mj-wdg-details"><summary>${escapeHtml(summary || 'Détails')}</summary>`
      + `<div class="mj-wdg-details-body">${innerHtml}</div></details>`);
    return '§§DETAILS' + (blocks.length - 1) + '§§';
  });
  return { text, blocks };
}

function _mjParseWidget(type, stateStr, body) {
  body = body || '';
  if (type === 'switch' || type === 'todo') {
    return { type, label: body.trim(), on: (stateStr || '').trim().toLowerCase() === 'x' };
  }
  if (type === 'jauge') {
    const ci    = body.indexOf(':');
    const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
    let max = parseInt(ci >= 0 ? body.slice(ci + 1) : '', 10);
    if (isNaN(max)) max = 4;
    max = Math.max(1, Math.min(12, max));            // garde-fou
    let val = parseInt(stateStr, 10); if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(max, val));
    return { type, label, val, max };
  }
  if (type === 'combo') {
    const ci    = body.indexOf(':');
    const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
    const opts  = (ci >= 0 ? body.slice(ci + 1) : '').split('|').map(s => s.trim()).filter(Boolean);
    let idx = parseInt(stateStr, 10); if (isNaN(idx)) idx = 0;
    if (opts.length) idx = ((idx % opts.length) + opts.length) % opts.length;
    return { type, label, opts, idx };
  }
  // compteur : `label` porte l'unité (ex. « pv »)
  const ci    = body.indexOf(':');
  const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
  let min = null, max = null;
  if (ci >= 0) {
    const mm = body.slice(ci + 1).match(/(-?\d+)\s*\.\.\s*(-?\d+)/);
    if (mm) { min = parseInt(mm[1], 10); max = parseInt(mm[2], 10); }
  }
  let val = parseInt(stateStr, 10); if (isNaN(val)) val = (min != null ? min : 0);
  if (min != null) val = Math.max(min, val);
  if (max != null) val = Math.min(max, val);
  return { type, label, val, min, max };
}

// Le label/options proviennent du HTML déjà rendu → déjà échappés, sûrs à injecter.
function _mjRenderWidget(w, wi) {
  if (w.type === 'switch') {
    // Interrupteur APRÈS le libellé
    return `<span class="mj-wdg mj-wdg-switch ${w.on ? 'on' : 'off'}" onclick="mjWidgetToggle(${wi})"`
         + ` title="Interrupteur — cliquer pour basculer"><span class="mj-wdg-label">${w.label}</span>`
         + `<span class="mj-wdg-knob"></span></span>`;
  }
  if (w.type === 'todo') {
    // Case à cocher APRÈS le libellé (comme le switch) ; texte barré quand cochée
    return `<span class="mj-wdg mj-wdg-todo ${w.on ? 'done' : ''}" onclick="mjWidgetToggle(${wi})"`
         + ` title="Tâche — cliquer pour cocher"><span class="mj-wdg-label">${w.label}</span>`
         + `<span class="mj-wdg-box">${w.on ? '✓' : ''}</span></span>`;
  }
  if (w.type === 'jauge') {
    // Horloge segmentée : clic sur un segment → remplit/vide jusqu'à lui
    let segs = '';
    for (let i = 0; i < w.max; i++) {
      segs += `<span class="mj-wdg-seg ${i < w.val ? 'on' : ''}" onclick="mjWidgetGauge(${wi},${i})"></span>`;
    }
    return `<span class="mj-wdg mj-wdg-gauge" title="Horloge de progression">`
         + (w.label ? `<span class="mj-wdg-label">${w.label}</span>` : '')
         + `<span class="mj-wdg-segs">${segs}</span>`
         + `<span class="mj-wdg-gauge-txt">${w.val}/${w.max}</span></span>`;
  }
  if (w.type === 'combo') {
    // Liste déroulante des états
    const opts = w.opts.map((o, i) => `<option value="${i}"${i === w.idx ? ' selected' : ''}>${o}</option>`).join('');
    return `<span class="mj-wdg mj-wdg-combo" title="Choisir un état">`
         + (w.label ? `<span class="mj-wdg-label">${w.label}</span>` : '')
         + `<select class="mj-wdg-select" onchange="mjWidgetCombo(${wi}, this.selectedIndex)">${opts}</select></span>`;
  }
  // compteur : « − valeur unité + »
  return `<span class="mj-wdg mj-wdg-count" title="Compteur">`
       + `<button class="mj-wdg-btn" onclick="mjWidgetCount(${wi},-1)">−</button>`
       + `<span class="mj-wdg-val">${w.val}</span>`
       + (w.label ? `<span class="mj-wdg-unit">${w.label}</span>` : '')
       + `<button class="mj-wdg-btn" onclick="mjWidgetCount(${wi},1)">＋</button></span>`;
}

// Transforme les tokens /switch… du HTML rendu en widgets cliquables
function mjLinkifyWidgets(html) {
  let wi = -1;
  const out = html.replace(_mjWidgetRe(), (full, type, stateStr, body) => {
    wi++;
    return _mjRenderWidget(_mjParseWidget(type, stateStr, body), wi);
  });
  // Une fois le HTML inséré dans le DOM (au prochain tick), ajuster la largeur
  // des combos. setTimeout plutôt que rAF : se déclenche aussi onglet en arrière-plan.
  if (out.indexOf('mj-wdg-select') !== -1) {
    setTimeout(() => { if (typeof _mjSizeCombos === 'function') _mjSizeCombos(); }, 0);
  }
  return out;
}

// Ajuste la largeur de chaque combo à son option courante : un <select> natif
// se dimensionne sinon sur l'option la plus large → espace vide disgracieux.
function _mjSizeCombos() {
  const root = document.getElementById('mj-doc-preview-scroll') || document;
  const sels = root.querySelectorAll('.mj-wdg-select');
  if (!sels.length) return;
  const meas = document.createElement('span');
  meas.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;';
  document.body.appendChild(meas);
  sels.forEach(sel => {
    const cs = getComputedStyle(sel);
    meas.style.fontFamily    = cs.fontFamily;
    meas.style.fontSize      = cs.fontSize;
    meas.style.fontWeight    = cs.fontWeight;
    meas.style.letterSpacing = cs.letterSpacing;
    const opt = sel.options[sel.selectedIndex];
    meas.textContent = opt ? opt.textContent : '';
    sel.style.width = (Math.ceil(meas.offsetWidth) + 22) + 'px';  // texte + flèche/padding
  });
  meas.remove();
}

// Réécrit le wi-ème widget du document via `mutate`, sauvegarde et re-rend
async function _mjWidgetMutate(wi, mutate) {
  if (!_mjSession || !_mjSessionDoc) return;
  let n = -1;
  const next = (_mjSessionDoc.content || '').replace(_mjWidgetRe(), (full, type, stateStr, body) => {
    n++;
    return (n === wi) ? mutate(type, stateStr, body) : full;
  });
  if (next === _mjSessionDoc.content) return;

  _mjSessionDoc.content = next;
  const idx = (_mjSession.docs || []).findIndex(d => d.id === _mjSessionDoc.id);
  if (idx !== -1) _mjSession.docs[idx] = { ..._mjSessionDoc };
  await mjSaveSession(_mjSession);

  // Préserver la position de défilement de l'aperçu
  const prev = document.getElementById('mj-doc-preview-scroll');
  const top  = prev ? prev.scrollTop : 0;
  mjRenderSessionDetail();
  const next2 = document.getElementById('mj-doc-preview-scroll');
  if (next2) next2.scrollTop = top;
}

// Bascule on/off — conserve le type (switch ou todo)
function mjWidgetToggle(wi) {
  _mjWidgetMutate(wi, (type, stateStr, body) => {
    const on = (stateStr || '').trim().toLowerCase() === 'x';
    return on ? `/${type}{${body}}` : `/${type}[x]{${body}}`;
  });
}

// Horloge : clic sur le segment i → remplit jusqu'à i+1, ou vide jusqu'à i
function mjWidgetGauge(wi, i) {
  _mjWidgetMutate(wi, (type, stateStr, body) => {
    const w = _mjParseWidget('jauge', stateStr, body);
    const next = (i < w.val) ? i : i + 1;   // segment plein → on enlève ; vide → on remplit
    return `/jauge[${Math.max(0, Math.min(w.max, next))}]{${body}}`;
  });
}

function mjWidgetCombo(wi, idx) {
  const i = Math.max(0, parseInt(idx, 10) || 0);
  _mjWidgetMutate(wi, (type, stateStr, body) => `/combo[${i}]{${body}}`);
}

function mjWidgetCount(wi, delta) {
  _mjWidgetMutate(wi, (type, stateStr, body) => {
    const w = _mjParseWidget('compteur', stateStr, body);
    let v = w.val + delta;
    if (w.min != null) v = Math.max(w.min, v);
    if (w.max != null) v = Math.min(w.max, v);
    return `/compteur[${v}]{${body}}`;
  });
}

// Coordonnées pixel du curseur dans un textarea (technique du miroir)
function _mjCaretCoords(ta, pos) {
  const style = getComputedStyle(ta);
  const div   = document.createElement('div');
  const props = ['boxSizing','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','textTransform','wordSpacing'];
  props.forEach(p => div.style[p] = style[p]);
  div.style.position   = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap   = 'break-word';
  div.style.overflow   = 'hidden';
  div.style.width      = ta.clientWidth + 'px';
  div.textContent      = ta.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = ta.value.slice(pos) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const taRect = ta.getBoundingClientRect();
  const lineH  = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.4);
  const top    = taRect.top  + (span.offsetTop  - ta.scrollTop);
  const left   = taRect.left + (span.offsetLeft - ta.scrollLeft);
  document.body.removeChild(div);
  return { top, left, lineHeight: lineH };
}
