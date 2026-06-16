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
let _mjAcTypeFilter = null;               // si défini (ex. 'npc'), ne propose que ce type de ressource

// Modèles insérés par l'autocomplétion « / » ($ = position du curseur après insertion)
// Types de blocs (préfixe Markdown) puis widgets MJ (token avec état dans le texte).
const _MJ_WIDGET_AC = [
  { key: 'h1',       icon: 'H₁', desc: 'Titre 1',             tpl: '# $' },
  { key: 'h2',       icon: 'H₂', desc: 'Titre 2',             tpl: '## $' },
  { key: 'h3',       icon: 'H₃', desc: 'Titre 3',             tpl: '### $' },
  { key: 'liste',    icon: '•',  desc: 'Liste à puces',       tpl: '- $' },
  { key: 'num',      icon: '1.', desc: 'Liste numérotée',     tpl: '1. $' },
  { key: 'cite',     icon: '❝',  desc: 'Citation',            tpl: '> $' },
  { key: 'sep',      icon: '—',  desc: 'Séparateur',          tpl: '---' },
  { key: 'tab',      icon: '▦',  desc: 'Tableau',             tpl: '| $ | Colonne 2 |\n| --- | --- |\n| | |' },
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
function mjAcUpdate() { _mjAcTargetId = 'mj-doc-content'; _mjAcTagOnly = false; _mjAcTypeFilter = null; _mjAcRun(); }
// Bloc de scénario (textarea dynamique #mjb-…) : tags @ + widgets /
function mjAcUpdateBlock(el) { if (!el || !el.id) return; _mjAcTargetId = el.id; _mjAcTagOnly = false; _mjAcTypeFilter = null; _mjAcRun(); }
function mjAcKeyupBlock(e, el) {
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
  mjAcUpdateBlock(el);
}
// Champ générique (input) : uniquement les tags @, éventuellement restreints à un type (ex. 'npc')
function mjAcUpdateField(el, type) { if (!el || !el.id) return; _mjAcTargetId = el.id; _mjAcTagOnly = true; _mjAcTypeFilter = type || null; _mjAcRun(); }

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
    if (!/^[a-zà-ÿ0-9]*$/i.test(partial)) { mjAcClose(); return; }  // accolade/espace → plus un token
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
  const sig = 't|' + at + '|' + braced + '|' + q + '|' + (_mjAcTypeFilter || '');
  if (sig === _mjAcSig && _mjAcOpen) return;   // rien de neuf → ne pas réinitialiser
  _mjAcSig = sig;

  let items = q ? _mjTagIndex.filter(r => r.lname.includes(q)) : _mjTagIndex.slice();
  if (_mjAcTypeFilter) items = items.filter(r => r.type === _mjAcTypeFilter);   // ex. propriétaire d'objet → PNJ only
  items = items.slice(0, 8);
  _mjAcMode       = 'tag';
  _mjAcItems      = items;
  _mjAcTokenStart = at;
  _mjAcBraced     = braced;
  _mjAcIndex      = 0;
  _mjAcRender(ta, caret);
}

// HTML des items du menu (partagé textarea / contenteditable)
function _mjAcItemsHtml() {
  if (!_mjAcItems.length) return `<div class="mj-ac-empty">Aucun résultat</div>`;
  if (_mjAcMode === 'widget') {
    return _mjAcItems.map((w, i) => `
      <div class="mj-ac-item ${i === _mjAcIndex ? 'sel' : ''}"
           onmousedown="event.preventDefault();mjAcInsertByIndex(${i})">
        <span class="mj-ac-ico">${w.icon}</span>
        <span class="mj-ac-name">/${escapeHtml(w.key)} <span style="color:var(--text-light);font-weight:600;">· ${escapeHtml(w.desc)}</span></span>
        <span class="mj-ac-type">Widget</span>
      </div>`).join('');
  }
  return _mjAcItems.map((r, i) => `
    <div class="mj-ac-item ${i === _mjAcIndex ? 'sel' : ''}"
         onmousedown="event.preventDefault();mjAcInsertByIndex(${i})">
      <span class="mj-ac-ico">${r.icon}</span>
      <span class="mj-ac-name">${escapeHtml(r.name)}${r.parentName ? ` <span style="color:var(--text-light);font-weight:600;">· ${escapeHtml(r.parentName)}</span>` : ''}</span>
      <span class="mj-ac-type">${_MJ_TAG_META[r.type].label}</span>
    </div>`).join('');
}

// Affiche le menu à une position écran donnée (top = sous la ligne du curseur)
function _mjAcShowAt(left, top, lineH) {
  const el = _mjAcEl();
  el.innerHTML = _mjAcItemsHtml();
  el.style.display = 'block';
  el.style.top  = (top + lineH + 2) + 'px';
  el.style.left = left + 'px';
  const r = el.getBoundingClientRect();
  if (r.right  > window.innerWidth  - 8) el.style.left = Math.max(8, window.innerWidth  - 8 - r.width)  + 'px';
  if (r.bottom > window.innerHeight - 8) el.style.top  = Math.max(8, top - r.height - 2) + 'px';
  _mjAcOpen = true;
}

function _mjAcRender(ta, caret) {
  const c = _mjCaretCoords(ta, caret);
  _mjAcShowAt(c.left, c.top, c.lineHeight);
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
  const el = document.getElementById(_mjAcTargetId);
  if (el && el.isContentEditable) {        // bloc riche
    if (_mjAcMode === 'tag') {
      _mjAcInsertTagRich(item);
    } else if (_MJ_INLINE_WIDGETS.includes(item.key)) {          // widget inline → formulaire (§5.1)
      if (typeof mjOpenWidgetForm === 'function') {
        mjOpenWidgetForm(item.key, { node: _mjAcRichNode, start: _mjAcRichTokenStart, caret: _mjAcRichCaret, targetId: _mjAcTargetId });
        mjAcClose();
      }
    } else {                                                     // h1/h2/h3/liste/num/cite/sep/tab/details
      _mjAcConvertBlockRich(item);
    }
    return;
  }
  if (_mjAcMode === 'widget') _mjAcInsertWidget(item);
  else _mjAcInsert(item);
}

// ── Autocomplétion dans un bloc riche (contenteditable) ───────
// Détecte le token @ à gauche du curseur (dans le nœud texte courant), propose
// les ressources, et insère une PUCE-TAG atomique à la validation. Les widgets « / »
// (formulaire d'insertion, spec §5.1) viendront dans l'incrément dédié.
let _mjAcRichNode       = null;   // nœud texte contenant le token
let _mjAcRichTokenStart = -1;     // offset du @ dans ce nœud
let _mjAcRichCaret      = -1;     // offset du curseur dans ce nœud

function mjAcUpdateRich(el) {
  if (!el || !el.isContentEditable) { mjAcClose(); return; }
  _mjAcTargetId = el.id; _mjAcTagOnly = false; _mjAcTypeFilter = null;
  _mjAcRunRich(el);
}

function _mjAcRunRich(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) { mjAcClose(); return; }
  const range = sel.getRangeAt(0);
  if (!range.collapsed || range.startContainer.nodeType !== 3
      || !el.contains(range.startContainer)) { mjAcClose(); return; }
  const node  = range.startContainer;
  const caret = range.startOffset;
  const text  = node.nodeValue.slice(0, caret);

  const atTag = text.lastIndexOf('@');
  const atWdg = text.lastIndexOf('/');
  const at    = Math.max(atTag, atWdg);
  if (at === -1) { mjAcClose(); return; }
  if (at > 0 && /[\wÀ-ÿ]/.test(text[at - 1])) { mjAcClose(); return; }

  const partial = text.slice(at + 1);
  _mjAcRichNode = node; _mjAcRichTokenStart = at; _mjAcRichCaret = caret;

  // ── Mode widget « / » : liste complète (widgets inline + conversions de bloc)
  if (at === atWdg) {
    if (!/^[a-zà-ÿ0-9]*$/i.test(partial)) { mjAcClose(); return; }
    const q = partial.trim().toLowerCase();
    _mjAcMode  = 'widget';
    _mjAcItems = _MJ_WIDGET_AC.filter(w => w.key.includes(q));
    _mjAcIndex = 0;
    _mjAcRenderRich(range);
    return;
  }

  // ── Mode tag « @ » ──
  let braced = false, query = partial;
  if (partial.startsWith('{')) {
    if (partial.includes('}')) { mjAcClose(); return; }
    braced = true; query = partial.slice(1);
  } else if (!/^[\wÀ-ÿ\-]*$/.test(partial)) { mjAcClose(); return; }

  const q   = query.trim().toLowerCase();
  let items = q ? _mjTagIndex.filter(r => r.lname.includes(q)) : _mjTagIndex.slice();
  items = items.slice(0, 8);
  _mjAcMode = 'tag';
  _mjAcItems = items;
  _mjAcBraced = braced;
  _mjAcIndex = 0;
  _mjAcRenderRich(range);
}

function _mjAcRenderRich(range) {
  let rect = range.getBoundingClientRect();
  if (!rect || (!rect.top && !rect.left && !rect.height)) {
    const er = document.getElementById(_mjAcTargetId)?.getBoundingClientRect();
    rect = er || { left: 8, top: 8, height: 18 };
  }
  _mjAcShowAt(rect.left, rect.top, rect.height || 18);
}

// Remplace le token @… (du nœud texte) par une puce-tag atomique, curseur après.
function _mjAcInsertTagRich(item) {
  const node = _mjAcRichNode;
  if (!node || !node.parentNode) { mjAcClose(); return; }
  const full   = node.nodeValue;
  const before = full.slice(0, _mjAcRichTokenStart);
  const after  = full.slice(_mjAcRichCaret);

  const tmp = document.createElement('div');
  tmp.innerHTML = _mjTagPillHtml(item.name);
  const pill = tmp.firstChild;

  const parent    = node.parentNode;
  const beforeNd  = document.createTextNode(before);
  const afterNd   = document.createTextNode(after.length ? after : _MJ_RICH_ZWSP); // ancre le curseur
  parent.insertBefore(beforeNd, node);
  parent.insertBefore(pill, node);
  parent.insertBefore(afterNd, node);
  parent.removeChild(node);

  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(afterNd, 0); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  mjAcClose();

  const el = document.getElementById(_mjAcTargetId);
  if (el) {
    const b = (typeof _mjBlocks !== 'undefined') ? _mjBlocks.find(x => x.id === _mjEditingBlockId) : null;
    if (b) b.raw = mjEditableToMd(el);
    el.focus();
  }
  if (typeof _mjBlocksChanged === 'function') _mjBlocksChanged();
}

// Conversion de bloc depuis le contenteditable (h1/h2/h3/liste/num/cite/sep/tab/
// details). Miroir markdown du chemin textarea (_mjAcInsertWidget) : on retire le
// token /partial, on insère le modèle à sa place, puis on rebascule sur l'éditeur
// adapté au nouveau type (titre/liste/citation → textarea, comme la migration §11).
function _mjAcConvertBlockRich(item) {
  const el = document.getElementById(_mjAcTargetId);
  const b  = (typeof _mjBlocks !== 'undefined') ? _mjBlocks.find(x => x.id === _mjEditingBlockId) : null;
  if (!el || !b) { mjAcClose(); return; }
  const tokenOff = _mjRichMdLenTo(el, _mjAcRichNode, _mjAcRichTokenStart);
  const caretOff = _mjRichMdLenTo(el, _mjAcRichNode, _mjAcRichCaret);
  const raw    = mjEditableToMd(el);
  const before = raw.slice(0, tokenOff);
  const after  = raw.slice(caretOff);
  mjAcClose();
  if (item.key === 'tab' && typeof mjMakeTableBlock === 'function') {
    mjMakeTableBlock(before + after);          // crée la grille (gère le texte restant)
    return;
  }
  if (item.key === 'details' && typeof mjOpenDetailsForm === 'function') {
    mjOpenDetailsForm(b.id, before + after, null);   // modale Titre + Contenu
    return;
  }
  b.raw = before + item.tpl.replace('$', '') + after;
  if (typeof _mjBlocksChanged === 'function') _mjBlocksChanged();
  if (typeof _mjEnterEdit === 'function') _mjEnterEdit(b.id);   // re-rend + édite le nouveau type
}

// Notifie le bon handler après une insertion selon le champ ciblé
function _mjAcNotify(ta) {
  if (ta.id === 'mj-doc-content') { if (typeof _mjDocChanged === 'function') _mjDocChanged(); }
  else if (ta.id && ta.id.indexOf('mjb-') === 0) ta.dispatchEvent(new Event('input')); // bloc → mjBlockInput
  else ta.dispatchEvent(new Event('change'));                                           // champ générique
}

// Insère un modèle de widget ; place le curseur sur le marqueur $
function _mjAcInsertWidget(w) {
  const ta = document.getElementById(_mjAcTargetId);
  if (!ta || _mjAcTokenStart < 0) return;
  const caret  = ta.selectionStart;
  const before = ta.value.slice(0, _mjAcTokenStart);
  const after  = ta.value.slice(caret);
  // /tab : on ne colle pas de Markdown brut, on crée un tableau par défaut + grille
  if (w.key === 'tab' && ta.id.indexOf('mjb-') === 0 && typeof mjMakeTableBlock === 'function') {
    mjAcClose();
    mjMakeTableBlock(before + after);
    return;
  }
  const mark   = w.tpl.indexOf('$');
  const insert = w.tpl.replace('$', '');
  ta.value = before + insert + after;
  const pos = before.length + (mark >= 0 ? mark : insert.length);
  mjAcClose();
  ta.focus();
  ta.setSelectionRange(pos, pos);
  _mjAcNotify(ta);
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
  _mjAcNotify(ta);
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
function mjAcKeyupField(e, el, type) {
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
  mjAcUpdateField(el, type);
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

// Index des widgets : continu à travers plusieurs appels quand on rend le
// document bloc par bloc (sinon chaque bloc repartirait de 0 et mjWidgetToggle
// retomberait sur le mauvais token). mjBeginWidgetSeq/mjEndWidgetSeq encadrent
// le rendu d'une séquence de blocs ; hors séquence, l'index est local à l'appel.
let _mjWidgetSeq       = -1;
let _mjWidgetSeqActive = false;
function mjBeginWidgetSeq() { _mjWidgetSeq = -1; _mjWidgetSeqActive = true; }
function mjEndWidgetSeq()   { _mjWidgetSeqActive = false; }

// Transforme les tokens /switch… du HTML rendu en widgets cliquables
function mjLinkifyWidgets(html) {
  let localWi = -1;
  const out = html.replace(_mjWidgetRe(), (full, type, stateStr, body) => {
    const wi = _mjWidgetSeqActive ? (++_mjWidgetSeq) : (++localWi);
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
  const root = document.getElementById('mj-doc-scroll') || document;
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

// Réécrit le wi-ème widget de la zone active via `mutate`, sauvegarde et re-rend.
// Générique : agit sur l'éditeur par blocs courant (scénario, description…).
async function _mjWidgetMutate(wi, mutate) {
  if (typeof _mjBlocksToContent !== 'function' || typeof mjBlocksApplyExternal !== 'function') return;
  const cur = _mjBlocksToContent();
  let n = -1;
  const next = cur.replace(_mjWidgetRe(), (full, type, stateStr, body) => {
    n++;
    return (n === wi) ? mutate(type, stateStr, body) : full;
  });
  if (next === cur) return;
  mjBlocksApplyExternal(next);   // recharge blocs + re-rend (#mj-blocks, scroll préservé) + sauvegarde
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

// ═══════════════════════════════════════════════════════════════
// Widgets DANS l'éditeur riche (puce contenteditable=false, état autonome)
// ═══════════════════════════════════════════════════════════════
// Contrairement au mode lecture (index global + mjBlocksApplyExternal qui
// recharge tout), chaque puce d'éditeur est AUTONOME : elle porte son token
// complet en data-md. Les mutateurs ci-dessous agissent sur la puce cliquée
// (this), réécrivent son data-md + son rendu, et re-sérialisent juste le bloc
// courant — sans re-render global, pour préserver la session d'édition.
const _MJ_INLINE_WIDGETS = ['switch', 'todo', 'combo', 'compteur', 'jauge'];
const _MJ_WDG_TOKEN_RE = /^\/(switch|todo|combo|compteur|jauge)(?:\[([^\]]*)\])?\{([^}]*)\}$/;

// Rendu visuel interactif d'un token, à placer DANS la puce (.mj-pill-wdg).
// Miroir de _mjRenderWidget mais avec des handlers basés sur l'événement (pas
// d'index global) et un ré-échappement des libellés (issus du token brut).
function _mjWidgetEditorInner(token) {
  const m = (token || '').match(_MJ_WDG_TOKEN_RE);
  if (!m) return escapeHtml(token || '');
  const w = _mjParseWidget(m[1], m[2], m[3]);
  if (w.type === 'switch')
    return `<span class="mj-wdg mj-wdg-switch ${w.on ? 'on' : 'off'}" onclick="mjRichWdgToggle(event)" title="Interrupteur">`
         + `<span class="mj-wdg-label">${escapeHtml(w.label)}</span><span class="mj-wdg-knob"></span></span>`;
  if (w.type === 'todo')
    return `<span class="mj-wdg mj-wdg-todo ${w.on ? 'done' : ''}" onclick="mjRichWdgToggle(event)" title="Tâche">`
         + `<span class="mj-wdg-label">${escapeHtml(w.label)}</span><span class="mj-wdg-box">${w.on ? '✓' : ''}</span></span>`;
  if (w.type === 'jauge') {
    let segs = '';
    for (let i = 0; i < w.max; i++) segs += `<span class="mj-wdg-seg ${i < w.val ? 'on' : ''}" onclick="mjRichWdgGauge(event,${i})"></span>`;
    return `<span class="mj-wdg mj-wdg-gauge" title="Horloge">`
         + (w.label ? `<span class="mj-wdg-label">${escapeHtml(w.label)}</span>` : '')
         + `<span class="mj-wdg-segs">${segs}</span><span class="mj-wdg-gauge-txt">${w.val}/${w.max}</span></span>`;
  }
  if (w.type === 'combo') {
    // Liste maison (clic gauche = déployer/choisir) : un <select> natif est peu
    // fiable dans un contenteditable. Clic droit = modale d'édition (via la puce).
    const cur = w.opts.length ? (w.opts[w.idx] || w.opts[0]) : '—';
    return `<span class="mj-wdg mj-wdg-combo" onclick="mjRichComboOpen(event)" title="Cliquer pour choisir">`
         + (w.label ? `<span class="mj-wdg-label">${escapeHtml(w.label)}</span>` : '')
         + `<span class="mj-wdg-combo-val">${escapeHtml(cur)} ▾</span></span>`;
  }
  return `<span class="mj-wdg mj-wdg-count" title="Compteur">`
       + `<button class="mj-wdg-btn" onclick="mjRichWdgCount(event,-1)">−</button>`
       + `<span class="mj-wdg-val">${w.val}</span>`
       + (w.label ? `<span class="mj-wdg-unit">${escapeHtml(w.label)}</span>` : '')
       + `<button class="mj-wdg-btn" onclick="mjRichWdgCount(event,1)">＋</button></span>`;
}

// Mutation locale d'une puce donnée : réécrit son token + son rendu, puis
// re-sérialise le bloc courant (pas de re-render global → édition préservée).
function _mjRichWdgApply(pill, mutate) {
  const m = (pill.getAttribute('data-md') || '').match(_MJ_WDG_TOKEN_RE);
  if (!m) return;
  pill.setAttribute('data-md', mutate(m[1], m[2], m[3]));
  pill.innerHTML = _mjWidgetEditorInner(pill.getAttribute('data-md'));
  const host = pill.closest('.mj-block-rich');
  if (host && typeof _mjBlocks !== 'undefined') {
    const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
    if (b) b.raw = mjEditableToMd(host);
    if (typeof _mjBlocksChanged === 'function') _mjBlocksChanged();
  }
}
function _mjRichWdgMutate(ev, mutate) {
  ev.stopPropagation();
  const pill = ev.target.closest('.mj-pill-wdg');
  if (pill) _mjRichWdgApply(pill, mutate);
}

function mjRichWdgToggle(ev) {
  _mjRichWdgMutate(ev, (type, st, body) =>
    ((st || '').trim().toLowerCase() === 'x') ? `/${type}{${body}}` : `/${type}[x]{${body}}`);
}
function mjRichWdgGauge(ev, i) {
  _mjRichWdgMutate(ev, (type, st, body) => {
    const w = _mjParseWidget('jauge', st, body);
    const next = (i < w.val) ? i : i + 1;
    return `/jauge[${Math.max(0, Math.min(w.max, next))}]{${body}}`;
  });
}
function mjRichWdgCount(ev, delta) {
  _mjRichWdgMutate(ev, (type, st, body) => {
    const w = _mjParseWidget('compteur', st, body);
    let v = w.val + delta;
    if (w.min != null) v = Math.max(w.min, v);
    if (w.max != null) v = Math.min(w.max, v);
    return `/compteur[${v}]{${body}}`;
  });
}

// ── Combo : popup de choix maison (clic gauche) ───────────────
function mjRichComboOpen(ev) {
  ev.stopPropagation();
  const pill = ev.target.closest('.mj-pill-wdg');
  if (!pill) return;
  const m = (pill.getAttribute('data-md') || '').match(_MJ_WDG_TOKEN_RE);
  if (!m) return;
  const w = _mjParseWidget('combo', m[2], m[3]);
  if (!w.opts.length) return;
  let pop = document.getElementById('mj-wdg-pick');
  if (!pop) { pop = document.createElement('div'); pop.id = 'mj-wdg-pick'; document.body.appendChild(pop); }
  pop._pill = pill;
  const opts = w.opts.map((o, i) =>
    `<div class="mj-pick-opt ${i === w.idx ? 'sel' : ''}" onmousedown="event.preventDefault();mjRichComboPick(${i})">${escapeHtml(o)}</div>`).join('');
  pop.innerHTML = `<div class="mj-pick-back" onmousedown="event.preventDefault();mjRichComboClose()"></div><div class="mj-pick-menu">${opts}</div>`;
  pop.style.display = 'block';
  const trigger = ev.target.closest('.mj-wdg-combo') || pill;
  const r = trigger.getBoundingClientRect();
  const menu = pop.querySelector('.mj-pick-menu');
  menu.style.left = r.left + 'px';
  menu.style.top  = (r.bottom + 3) + 'px';
  const mr = menu.getBoundingClientRect();
  if (mr.bottom > window.innerHeight - 8) menu.style.top = Math.max(8, r.top - mr.height - 3) + 'px';
  if (mr.right  > window.innerWidth  - 8) menu.style.left = Math.max(8, window.innerWidth - 8 - mr.width) + 'px';
}
function mjRichComboPick(i) {
  const pop = document.getElementById('mj-wdg-pick');
  const pill = pop && pop._pill;
  if (pill) _mjRichWdgApply(pill, (type, st, body) => `/combo[${i}]{${body}}`);
  mjRichComboClose();
}
function mjRichComboClose() {
  const pop = document.getElementById('mj-wdg-pick');
  if (pop) { pop.style.display = 'none'; pop._pill = null; }
}

// ── Clic droit sur une puce-widget → modale d'édition de structure ──
// ── Menu contextuel widget (clic droit) : Modifier / Supprimer ──
// Unifié pour la puce en ÉDITION (.mj-pill-wdg) et le widget rendu en LECTURE
// (.mj-wdg). En lecture, le widget est repéré par son index d'ordre (wi), aligné
// sur _mjWidgetMutate (mêmes tokens, même ordre).
let _mjWdgCtxTarget = null;

function _mjWidgetTokenAt(wi) {
  if (typeof _mjBlocksToContent !== 'function') return null;
  const re = _mjWidgetRe(); const content = _mjBlocksToContent();
  let n = -1, m;
  while ((m = re.exec(content)) !== null) { n++; if (n === wi) return m[0]; }
  return null;
}

function mjWidgetContext(ev) {
  const pill = ev.target.closest && ev.target.closest('.mj-pill-wdg');
  if (pill) { ev.preventDefault(); ev.stopPropagation(); _mjShowWdgCtx(ev, { mode: 'edit', pill }); return false; }
  const wdg = ev.target.closest && ev.target.closest('.mj-wdg');
  if (wdg && !wdg.closest('.mj-pill-wdg')) {
    const all = [...document.querySelectorAll('#mj-blocks .mj-wdg')].filter((n) => !n.closest('.mj-pill-wdg'));
    const wi = all.indexOf(wdg);
    if (wi >= 0) { ev.preventDefault(); ev.stopPropagation(); _mjShowWdgCtx(ev, { mode: 'read', wi }); return false; }
  }
  const det = ev.target.closest && ev.target.closest('.mj-wdg-details');
  if (det) {
    const blockEl = det.closest('.mj-block');
    const blockId = blockEl && blockEl.getAttribute('data-block-id');
    if (blockId) { ev.preventDefault(); ev.stopPropagation(); _mjShowWdgCtx(ev, { mode: 'details', blockId }); return false; }
  }
  return true;
}

function _mjWdgCtxEl() {
  let el = document.getElementById('mj-wdg-ctx');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mj-wdg-ctx';
    el.innerHTML = `<div class="mj-wdgctx-backdrop" oncontextmenu="event.preventDefault();mjWdgCtxClose();return false;" onclick="mjWdgCtxClose()"></div>
      <div class="mj-wdgctx-card" id="mj-wdgctx-card">
        <div class="mj-wdgctx-item" onclick="mjWdgCtxModify()">✏️ Modifier</div>
        <div class="mj-wdgctx-item danger" onclick="mjWdgCtxDelete()">🗑️ Supprimer</div>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

function _mjShowWdgCtx(ev, target) {
  _mjWdgCtxTarget = target;
  const el = _mjWdgCtxEl();
  el.style.display = 'block';
  const card = el.querySelector('#mj-wdgctx-card');
  card.style.left = '0px'; card.style.top = '0px';
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let left = ev.clientX, top = ev.clientY;
  if (left + cw > window.innerWidth  - 8) left = window.innerWidth  - 8 - cw;
  if (top  + ch > window.innerHeight - 8) top  = window.innerHeight - 8 - ch;
  card.style.left = Math.max(8, left) + 'px';
  card.style.top  = Math.max(8, top) + 'px';
}

function mjWdgCtxClose() {
  const el = document.getElementById('mj-wdg-ctx');
  if (el) el.style.display = 'none';
  _mjWdgCtxTarget = null;
}

function mjWdgCtxModify() {
  const t = _mjWdgCtxTarget; mjWdgCtxClose();
  if (!t) return;
  if (t.mode === 'details') {
    const b = (typeof _mjBlocks !== 'undefined') ? _mjBlocks.find((x) => x.id === t.blockId) : null;
    if (typeof mjOpenDetailsForm === 'function') mjOpenDetailsForm(t.blockId, '', b ? b.raw : '');
  } else if (t.mode === 'edit') {
    if (typeof mjOpenWidgetEditForm === 'function') mjOpenWidgetEditForm(t.pill);
  } else if (typeof mjOpenWidgetEditFormRead === 'function') {
    mjOpenWidgetEditFormRead(t.wi);
  }
}

function mjWdgCtxDelete() {
  const t = _mjWdgCtxTarget; mjWdgCtxClose();
  if (!t) return;
  if (t.mode === 'details') {
    if (typeof _mjBlocks === 'undefined') return;
    const i = _mjBlocks.findIndex((x) => x.id === t.blockId);
    if (i < 0) return;
    _mjBlocks.splice(i, 1);
    if (_mjBlocks.length === 0) _mjBlocks.push({ id: _mjNewBlockId(), raw: '' });
    if (typeof _mjBlocksChanged === 'function') _mjBlocksChanged();
    if (typeof _mjRenderBlocks === 'function') _mjRenderBlocks();
  } else if (t.mode === 'edit') {
    const pill = t.pill, host = pill && pill.closest('.mj-block-rich');
    if (pill) pill.remove();
    if (host && typeof mjRichInput === 'function') mjRichInput(host.id.replace('mjb-', ''));
  } else if (typeof _mjWidgetMutate === 'function') {
    _mjWidgetMutate(t.wi, () => '');
  }
}

// Compat : ancien point d'entrée du clic droit sur puce → menu unifié.
function mjWidgetPillContext(ev) { return mjWidgetContext(ev); }

// Token → valeurs de formulaire (pour pré-remplir la modale d'édition).
function _mjWidgetTokenToVals(token) {
  const m = (token || '').match(_MJ_WDG_TOKEN_RE);
  if (!m) return null;
  const type = m[1], body = m[3];
  const ci = body.indexOf(':');
  const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
  const rest  = (ci >= 0 ? body.slice(ci + 1) : '').trim();
  const vals = { label };
  if (type === 'combo')    vals.opts = rest.split('|').map((s) => s.trim()).filter(Boolean).join('|');
  if (type === 'compteur') { const mm = rest.match(/-?\d+\s*\.\.\s*-?\d+/); vals.range = mm ? mm[0] : ''; }
  if (type === 'jauge')    { const n = parseInt(rest, 10); vals.segs = isNaN(n) ? '' : String(n); }
  return { type, vals };
}

// Applique l'édition de structure : remplace le token de la puce (en gardant l'état).
function _mjApplyWidgetEdit(pill, token) {
  if (!pill) return;
  _mjRichWdgApply(pill, () => token);
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
