// MJ — TAGS @ref (liens cliquables dans les scénarios + autocomplétion)
// ═══════════════════════════════════════════════════════════════
// Un tag s'écrit @Mot ou @{Nom complet}. Il pointe vers une ressource
// MJ par nom : image, rencontre (combat), PNJ ou session.

let _mjTagIndex = [];   // [{ name, lname, type, id, icon }]

const _MJ_TAG_META = {
  scenario:  { icon: '📄', section: 'sessions',   label: 'Scénario' },
  encounter: { icon: '⚔️',  section: 'encounters', label: 'Combat'   },
  npc:       { icon: '🧑', section: 'npcs',       label: 'PNJ'      },
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
    const [sessions, encounters, npcs, assets] = await Promise.all([
      mjGetSessions(), mjGetEncounters(), mjGetNpcs(), db.mj_assets.toArray(),
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

    assets.forEach(a => idx.push({ name: a.name || 'image', type: 'asset', id: a.id, url: _mjAssetUrl(a) }));
  } catch (e) { console.error('Index tags MJ', e); }
  idx.forEach(r => {
    r.name  = (r.name || '').trim();          // ignore les espaces parasites des noms
    r.icon  = _MJ_TAG_META[r.type].icon;
    r.lname = r.name.toLowerCase();
  });
  _mjTagIndex = idx;
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
      return `${pre}<span class="mj-tag broken" title="Référence introuvable">@${shown}</span>`;
    });
}

// ── Navigation au clic ────────────────────────────────────────
async function mjTagGo(type, id, parentId) {
  const meta = _MJ_TAG_META[type];
  if (!meta) return;
  if (_mjSection !== meta.section) await mjSwitchSection(meta.section);
  if (type === 'scenario')  { await mjSelectSession(parentId); await mjSelectDocFromTree(parentId, id); }
  else if (type === 'encounter') await mjSelectEncounter(id);
  else if (type === 'npc')       await mjSelectNpc(id);
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

// Recalcule le token @… à gauche du curseur et affiche le menu
function mjAcUpdate() {
  const ta = document.getElementById('mj-doc-content');
  if (!ta) { mjAcClose(); return; }
  const caret = ta.selectionStart;
  const val   = ta.value;
  const at    = val.lastIndexOf('@', caret - 1);
  if (at === -1) { mjAcClose(); return; }
  if (at > 0 && /[\wÀ-ÿ]/.test(val[at - 1])) { mjAcClose(); return; }

  const partial = val.slice(at + 1, caret);
  let braced = false, query = partial;
  if (partial.startsWith('{')) {
    if (partial.includes('}')) { mjAcClose(); return; }
    braced = true; query = partial.slice(1);
  } else if (!/^[\wÀ-ÿ\-]*$/.test(partial)) {
    mjAcClose(); return;   // espace ou autre → plus un token
  }

  const q   = query.trim().toLowerCase();
  const sig = at + '|' + braced + '|' + q;
  if (sig === _mjAcSig && _mjAcOpen) return;   // rien de neuf → ne pas réinitialiser
  _mjAcSig = sig;

  let items = q ? _mjTagIndex.filter(r => r.lname.includes(q)) : _mjTagIndex.slice();
  items = items.slice(0, 8);
  _mjAcItems      = items;
  _mjAcTokenStart = at;
  _mjAcBraced     = braced;
  _mjAcIndex      = 0;
  _mjAcRender(ta, caret);
}

function _mjAcRender(ta, caret) {
  const el = _mjAcEl();
  if (!_mjAcItems.length) {
    el.innerHTML = `<div class="mj-ac-empty">Aucune ressource</div>`;
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
  if (item) _mjAcInsert(item);
}

function _mjAcInsert(item) {
  const ta = document.getElementById('mj-doc-content');
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
  _mjDocChanged();   // déclenche la sauvegarde différée
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
