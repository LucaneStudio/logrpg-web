// MJ — SESSIONS (modèle dossier/documents)
// ═══════════════════════════════════════════════════════════════
// Session = dossier { id, title, date, docs:[{id,title,content}] }
//
// L'éditeur de scénario est un éditeur « par blocs » (style Notion) :
// le document est TOUJOURS rendu et découpé en blocs ; on clique un bloc
// pour l'éditer en Markdown brut, il se re-rend dès qu'on en sort.
// La source de vérité reste le texte Markdown dans doc.content.

let _mjSession    = null;  // session (dossier) sélectionnée
let _mjSessionDoc = null;  // document sélectionné dans la session
let _mjDocSaveTimer = null;
let _mjSessionListOpen = true;        // volet arborescence ouvert/fermé
let _mjExpanded        = new Set();   // ids des sessions dépliées dans l'arbre

// Éditeur par blocs ────────────────────────────────────────────
// Réutilisable sur n'importe quelle zone de texte (scénario, description
// d'objet/lieu/PNJ…). L'« hôte » fournit juste une fonction de sauvegarde
// (`_mjBlockSave`) qui lit `_mjBlocksToContent()` et persiste où il veut.
let _mjBlocks         = [];      // [{ id, raw }] modèle de travail de la zone ouverte
let _mjEditingBlockId = null;    // id du bloc en cours d'édition (ou null)
let _mjBlockSeq       = 0;
let _mjBlockSave      = null;    // fonction (sans argument) : persiste le contenu courant
let _mjBlockSaveTimer = null;
let _mjTableModel     = null;    // { headers:[], rows:[[]] } du tableau en cours d'édition (grille)

function _newDocId()    { return 'doc_' + Math.random().toString(36).slice(2, 9); }
function _mjNewBlockId() { return 'b' + (++_mjBlockSeq); }

// Rendu Markdown + transformation des @tags en liens et des widgets /switch…
function _mjMarkdownWithTags(content) {
  // Les /details (potentiellement multi-lignes, contenu Markdown) sont extraits
  // AVANT le rendu Markdown pour ne pas casser leur HTML, puis réinjectés.
  let pre = content || '', blocks = [];
  if (typeof mjExtractDetails === 'function') {
    const r = mjExtractDetails(pre); pre = r.text; blocks = r.blocks;
  }
  let html = renderMarkdown(pre);
  blocks.forEach((b, i) => { html = html.split('§§DETAILS' + i + '§§').join(b); });
  if (typeof mjLinkifyTags    === 'function') html = mjLinkifyTags(html);
  if (typeof mjLinkifyWidgets === 'function') html = mjLinkifyWidgets(html);
  return html;
}

// ── Découpage du contenu en blocs ─────────────────────────────
// Un bloc = une unité Markdown séparée par une ligne vide. Les /details
// (qui peuvent contenir des lignes vides) sont protégés avant le découpage
// pour rester insécables.
// Sentinelle (zone privée Unicode) protégeant les /details multi-lignes au découpage
// en blocs ; construite par code pour ne pas mettre d'octet non imprimable dans la source.
const _MJ_BLK_SENT = String.fromCharCode(0xE010);
function _mjSplitBlocks(content) {
  content = content || '';
  const details = [];
  const protectedTxt = content.replace(/\/details(?:\[[^\]]*\])?\{[\s\S]*?\}/g, (m) => {
    details.push(m);
    return _MJ_BLK_SENT + 'D' + (details.length - 1) + _MJ_BLK_SENT;
  });
  const restore = (s) => s.replace(new RegExp(_MJ_BLK_SENT + 'D(\\d+)' + _MJ_BLK_SENT, 'g'), (m, i) => details[+i]);
  const parts = protectedTxt.split(/\n[ \t]*\n+/);
  const out = [];
  parts.forEach((p) => {
    const raw = restore(p).replace(/\s+$/g, '');   // retire les espaces de fin
    if (raw.trim() === '') return;                 // ignore les blocs vides du split
    out.push(raw);
  });
  if (out.length === 0) out.push('');
  return out;
}

function _mjLoadBlocks(content) {
  _mjBlocks = _mjSplitBlocks(content).map((raw) => ({ id: _mjNewBlockId(), raw }));
  _mjEditingBlockId = null;
}

function _mjBlocksToContent() {
  return _mjBlocks.map((b) => b.raw).join('\n\n');
}

// ── Montage de l'éditeur sur une zone quelconque ──────────────
// Markup de la barre de mise en forme (réutilisé par tous les hôtes)
function _mjFormatBarHtml() {
  return `<div id="mj-format-bar" class="mj-format-bar off">
    <button class="mj-fmt-btn" data-mark="**" onmousedown="event.preventDefault()" onclick="mjFormatToggle('**')" title="Gras"><b>B</b></button>
    <button class="mj-fmt-btn" data-mark="*"  onmousedown="event.preventDefault()" onclick="mjFormatToggle('*')"  title="Italique"><i>I</i></button>
    <button class="mj-fmt-btn" data-mark="__" onmousedown="event.preventDefault()" onclick="mjFormatToggle('__')" title="Souligné"><u>U</u></button>
    <button class="mj-fmt-btn" data-mark="~~" onmousedown="event.preventDefault()" onclick="mjFormatToggle('~~')" title="Barré"><s>S</s></button>
  </div>`;
}

// Markup complet « barre + conteneur de blocs ». boxed = cadre blanc (descriptions).
function mjBlockEditorHtml(opts) {
  const boxed = opts && opts.boxed ? ' mj-blocks-boxed' : '';
  return _mjFormatBarHtml() + `<div id="mj-blocks" class="mj-blocks${boxed}"></div>`;
}

// Monte l'éditeur : charge le contenu, branche la sauvegarde, rend les blocs.
// À appeler APRÈS avoir injecté le markup (mjBlockEditorHtml) dans le DOM.
function mjMountBlockEditor(content, saveFn) {
  _mjBlockSave = (typeof saveFn === 'function') ? saveFn : null;
  _mjLoadBlocks(content || '');
  _mjRenderBlocks();
}

// Applique un contenu modifié hors frappe (ex. clic sur un widget) :
// recharge les blocs, re-rend (le scroll parent est préservé car on ne
// remplace que #mj-blocks) et persiste immédiatement.
function mjBlocksApplyExternal(content) {
  _mjLoadBlocks(content);
  _mjRenderBlocks();
  if (typeof _mjBlockSave === 'function') _mjBlockSave();
}

// ── Arborescence des sessions (dossiers > documents) ──────────
async function mjRenderSessionsList() {
  const sessions = await mjGetSessions();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  if (sessions.length === 0) {
    list.innerHTML = `<div class="mj-empty">📁<br>Aucune session.<br>Crée la première !</div>`;
    return;
  }

  list.innerHTML = sessions.map(s => {
    const docs        = s.docs || [];
    const expanded    = _mjExpanded.has(s.id);
    const activeSess  = _mjSession?.id === s.id;

    const folder = `
      <div class="mj-tree-folder ${activeSess ? 'active' : ''}" onclick="mjSelectSession(${s.id})"
           oncontextmenu="return mjItemContext(event, () => mjDeleteSessionConfirm(${s.id}))">
        <span class="mj-tree-chevron">${expanded ? '▾' : '▸'}</span>
        <span class="mj-tree-ico">📁</span>
        <span class="mj-tree-label">${escapeHtml(s.title || 'Sans titre')}</span>
        <span class="mj-tree-count">${docs.length}</span>
      </div>`;

    let children = '';
    if (expanded) {
      const docNodes = docs.map(d => `
        <div class="mj-tree-doc ${(activeSess && _mjSessionDoc?.id === d.id) ? 'active' : ''}"
             onclick="event.stopPropagation();mjSelectDocFromTree(${s.id},'${d.id}')"
             oncontextmenu="return mjItemContext(event, () => mjDeleteScenarioConfirm(${s.id},'${d.id}'))">
          <span class="mj-tree-ico">📄</span>
          <span class="mj-tree-label">${escapeHtml(d.title || 'Sans titre')}</span>
        </div>`).join('');
      const addRow = `
        <div class="mj-tree-add" onclick="event.stopPropagation();mjAddDocTo(${s.id})">
          <span class="mj-tree-ico">＋</span>
          <span class="mj-tree-label">document</span>
        </div>`;
      children = `<div class="mj-tree-children">${docNodes}${addRow}</div>`;
    }
    return `<div class="mj-tree-node">${folder}${children}</div>`;
  }).join('');
}

// Clic sur un dossier : sélectionne la session + déplie/replie
async function mjSelectSession(id) {
  const sameSession = _mjSession?.id === id;
  _mjSession    = await mjGetSession(id);
  _mjSessionDoc = null;
  if (sameSession) {
    if (_mjExpanded.has(id)) _mjExpanded.delete(id); else _mjExpanded.add(id);
  } else {
    _mjExpanded.add(id);
  }
  await mjRenderSessionsList();
  mjRenderSessionDetail();
}

// ── Détail : layout dossier ───────────────────────────────────
function mjRenderSessionDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;
  if (typeof mjAcClose === 'function') mjAcClose();
  if (typeof mjTagPreviewHide === 'function') mjTagPreviewHide();
  _mjEditingBlockId = null;

  if (!_mjSession) {
    detail.innerHTML = `<div class="mj-detail-empty">📁<br>Sélectionne ou crée une session</div>`;
    return;
  }

  const s = _mjSession;

  // En-tête session
  const hdr = `
    <div class="mj-detail-hdr">
      <div class="mj-detail-hdr-left" style="flex:1;min-width:0;">
        <input id="mj-session-title" class="mj-title-input"
          value="${escapeHtml(s.title || '')}" placeholder="Nom de la session…"
          onchange="mjSessionSaveField('title', this.value)"/>
        <input id="mj-session-date" type="date" value="${s.date || ''}"
          class="mj-subtitle-input" style="cursor:pointer;"
          onchange="mjSessionSaveField('date', this.value)"/>
      </div>
      <button class="mj-btn-danger" onclick="mjDeleteSessionConfirm(${s.id})">🗑️</button>
    </div>`;

  // Éditeur de document (ou état vide)
  const editor = _mjSessionDoc
    ? `<div class="mj-doc-editor">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <input id="mj-doc-title" class="mj-title-input" style="font-size:14px;flex:1;"
            value="${escapeHtml(_mjSessionDoc.title || '')}" placeholder="Titre du document…"
            onchange="_mjDocChanged()"/>
          <span id="mj-doc-save-ind" style="font-size:10px;color:var(--text-light);font-weight:700;flex-shrink:0;"></span>
          <button class="mj-btn-sm" onclick="mjCopyDocMarkdown(this)" title="Copier le contenu en Markdown" style="flex-shrink:0;">⧉ Markdown</button>
          <button class="mj-btn-sm-danger" onclick="mjDeleteDoc('${_mjSessionDoc.id}')" title="Supprimer">×</button>
        </div>
        ${_mjFormatBarHtml()}
        <div id="mj-doc-scroll" class="mj-doc-scroll">
          <div id="mj-blocks" class="mj-blocks"></div>
        </div>
      </div>`
    : `<div class="mj-doc-editor" style="display:flex;align-items:center;justify-content:center;">
        <div class="mj-empty-sm">📄 Sélectionne ou crée un document<br>dans l'arborescence à gauche</div>
      </div>`;

  detail.innerHTML = hdr + `<div class="mj-session-body">${editor}</div>`;

  if (_mjSessionDoc) {
    // La session a son propre conteneur scrollable (#mj-doc-scroll) déjà présent ;
    // on monte l'éditeur dans #mj-blocks avec _mjDocSaveNow comme persisteur.
    mjMountBlockEditor(_mjSessionDoc.content || '', _mjDocSaveNow);
  }
}

// ── Tableaux : édition en grille (WYSIWYG, source Markdown) ───
// Un bloc tableau est édité comme une vraie grille : on tape dans les cellules,
// on ajoute/supprime lignes & colonnes. À chaque changement, on régénère le
// Markdown (| … | --- |) qui reste la source de vérité pour la sauvegarde.
function _mjIsTableBlock(raw) {
  const lines = (raw || '').trim().split('\n');
  if (lines.length < 2) return false;
  return lines[0].trim().startsWith('|') && /^[\|\-:\s]+$/.test(lines[1].trim());
}

function _mjParseTable(raw) {
  const lines = (raw || '').split('\n').filter(l => l.trim().startsWith('|'));
  const parseRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const isSep = (l) => /^[\|\-:\s]+$/.test(l.trim());
  if (!lines.length) return { headers: [''], rows: [['']] };
  const headers = parseRow(lines[0]);
  const start = (lines[1] && isSep(lines[1])) ? 2 : 1;
  const rows = lines.slice(start).map(parseRow);
  rows.forEach(r => { while (r.length < headers.length) r.push(''); });
  return { headers, rows };
}

function _mjTableToMarkdown(headers, rows) {
  const esc = (s) => (s == null ? '' : String(s)).replace(/\|/g, ' ').replace(/\n/g, ' ').trim();
  const head = '| ' + headers.map(esc).join(' | ') + ' |';
  const sep  = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + headers.map((_, c) => esc(r[c] || '')).join(' | ') + ' |').join('\n');
  return head + '\n' + sep + (body ? '\n' + body : '');
}

// HTML de la grille éditable (remplace la textarea quand le bloc est un tableau).
// Cellules : Échap ou perte de focus hors grille → validation auto (mjTableDone).
// Boutons : onmousedown preventDefault → ne volent pas le focus des cellules.
function _mjTableEditorHtml(b) {
  _mjTableModel = _mjParseTable(b.raw);
  const { headers, rows } = _mjTableModel;
  const ev = `oninput="mjTableCellInput(KIND,RR,CC,this.value)" onkeydown="mjTableKeydown(event)" onblur="mjTableCellBlur()"`;
  const headCells = headers.map((h, c) => `<th class="mj-tedit-th">
      <input class="mj-tedit-cell mj-tedit-head" value="${escapeHtml(h)}" placeholder="Colonne ${c + 1}"
        ${ev.replace('KIND', "'h'").replace('RR', '0').replace('CC', c)}/>
      ${headers.length > 1 ? `<button class="mj-tedit-del" title="Supprimer la colonne" onmousedown="event.preventDefault()" onclick="mjTableDelCol(${c})">✕</button>` : ''}
    </th>`).join('');
  const bodyRows = rows.map((row, r) => `<tr>
      <td class="mj-tedit-ctrl">${rows.length > 1 ? `<button class="mj-tedit-del" title="Supprimer la ligne" onmousedown="event.preventDefault()" onclick="mjTableDelRow(${r})">✕</button>` : ''}</td>
      ${headers.map((_, c) => `<td><input class="mj-tedit-cell" value="${escapeHtml(row[c] || '')}"
        ${ev.replace('KIND', "'b'").replace('RR', r).replace('CC', c)}/></td>`).join('')}
    </tr>`).join('');
  return `<div class="mj-block editing"><div class="mj-tedit-wrap" data-block-id="${b.id}">
    <table class="mj-tedit"><thead><tr><th class="mj-tedit-ctrl"></th>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    <div class="mj-tedit-bar">
      <button class="mj-tedit-add" onmousedown="event.preventDefault()" onclick="mjTableAddRow()">＋ Ligne</button>
      <button class="mj-tedit-add" onmousedown="event.preventDefault()" onclick="mjTableAddCol()">＋ Colonne</button>
      <button class="mj-tedit-done" onmousedown="event.preventDefault()" onclick="mjTableDone()">✓ Terminé</button>
    </div>
  </div></div>`;
}

// Écrit le modèle de tableau dans le bloc + planifie la sauvegarde (sans re-render)
function _mjTableSync() {
  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (!b || !_mjTableModel) return;
  b.raw = _mjTableToMarkdown(_mjTableModel.headers, _mjTableModel.rows);
  _mjBlocksChanged();
}

function mjTableCellInput(kind, r, c, val) {
  if (!_mjTableModel) return;
  if (kind === 'h') _mjTableModel.headers[c] = val;
  else if (_mjTableModel.rows[r]) _mjTableModel.rows[r][c] = val;
  _mjTableSync();   // pas de re-render → on garde le focus dans la cellule
}

// Refocus une cellule après re-render structurel (sinon le blur sortirait de la grille)
function _mjTableRefocus(sel) {
  const el = document.querySelector(sel || '.mj-tedit-wrap .mj-tedit-cell');
  if (el) el.focus();
}

function mjTableAddCol() {
  if (!_mjTableModel) return;
  _mjTableModel.headers.push('');
  _mjTableModel.rows.forEach(r => r.push(''));
  _mjTableSync(); _mjRenderBlocks();
  _mjTableRefocus('.mj-tedit thead .mj-tedit-head:last-child');
}

function mjTableAddRow() {
  if (!_mjTableModel) return;
  _mjTableModel.rows.push(_mjTableModel.headers.map(() => ''));
  _mjTableSync(); _mjRenderBlocks();
  _mjTableRefocus('.mj-tedit tbody tr:last-child .mj-tedit-cell');
}

function mjTableDelCol(c) {
  if (!_mjTableModel || _mjTableModel.headers.length <= 1) return;
  _mjTableModel.headers.splice(c, 1);
  _mjTableModel.rows.forEach(r => r.splice(c, 1));
  _mjTableSync(); _mjRenderBlocks();
  _mjTableRefocus();
}

function mjTableDelRow(r) {
  if (!_mjTableModel || _mjTableModel.rows.length <= 1) return;
  _mjTableModel.rows.splice(r, 1);
  _mjTableSync(); _mjRenderBlocks();
  _mjTableRefocus();
}

// Échap dans une cellule → valider et sortir
function mjTableKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); mjTableDone(); }
}

// Perte de focus : si le focus quitte la grille, valider et sortir
function mjTableCellBlur() {
  setTimeout(() => {
    const wrap = document.querySelector('.mj-tedit-wrap');
    if (!wrap) return;                                  // déjà sorti
    if (wrap.contains(document.activeElement)) return;  // focus encore dans la grille
    mjTableDone();
  }, 150);
}

function mjTableDone() {
  // valide immédiatement (sans attendre le débounce) puis repasse en lecture
  clearTimeout(_mjBlockSaveTimer);
  if (typeof _mjBlockSave === 'function') _mjBlockSave();
  _mjTableModel = null;
  _mjEditingBlockId = null;
  _mjRenderBlocks();
}

// /tab : transforme le bloc courant en tableau par défaut et ouvre la grille.
// `remaining` = texte du bloc hors du token /tab (vide dans le cas courant).
function mjMakeTableBlock(remaining) {
  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (!b) return;
  const DEFAULT = _mjTableToMarkdown(['Colonne 1', 'Colonne 2'], [['', ''], ['', '']]);
  const rest = (remaining || '').trim();
  if (rest === '') {
    b.raw = DEFAULT;                               // bloc (quasi) vide → devient le tableau
  } else {
    b.raw = rest;                                  // garde le texte, tableau dans un nouveau bloc dessous
    const nb = { id: _mjNewBlockId(), raw: DEFAULT };
    _mjBlocks.splice(_mjBlocks.findIndex((x) => x.id === b.id) + 1, 0, nb);
    _mjEditingBlockId = nb.id;
  }
  _mjBlocksChanged();
  _mjRenderBlocks();                               // bloc tableau + editing → grille
  setTimeout(() => _mjTableRefocus(), 0);
}

// Bloc « rich » = paragraphe (aucun préfixe Markdown de bloc). Au pilote (spec §11)
// Paragraphes, titres (#..) et citations (>) passent en contenteditable riche.
// Listes, séparateur, tableau et /details restent gérés à part (textarea / grille /
// modale). Un bloc vide est traité comme un paragraphe.
function _mjIsRichBlock(raw) {
  if (_mjIsTableBlock(raw)) return false;
  const t = (raw || '').trim();
  if (t === '') return true;
  if (/^[-*]\s/.test(t))                    return false;  // liste à puces (étape ultérieure)
  if (/^\d+\.\s/.test(t))                   return false;  // liste numérotée (étape ultérieure)
  if (/^([-*_]\s*){3,}$/.test(t))           return false;  // séparateur
  if (/^\/details(\[[^\]]*\])?\{/.test(t))  return false;  // bloc /details (modale)
  return true;                                             // paragraphe, titres, citations
}

// Sépare le préfixe de bloc (# / ## / ### / > ) de son contenu inline.
function _mjSplitPrefix(raw) {
  const r = raw == null ? '' : String(raw);
  let m;
  if ((m = r.match(/^(#{1,3})\s/))) return { prefix: r.slice(0, m[1].length + 1), inline: r.slice(m[1].length + 1), type: 'h' + m[1].length };
  if ((m = r.match(/^>\s/)))        return { prefix: r.slice(0, 2), inline: r.slice(2), type: 'quote' };
  return { prefix: '', inline: r, type: 'p' };
}

// Markdown complet d'un bloc riche = préfixe (data-bp) + contenu inline sérialisé.
function _mjRichRaw(el) {
  return (el.getAttribute('data-bp') || '') + mjEditableToMd(el);
}

// ── Listes multi-niveaux (§7) ─────────────────────────────────
// Un bloc liste = lignes consécutives, chacune « indentation + marqueur + texte ».
function _mjIsListBlock(raw) {
  const lines = (raw || '').split('\n').filter((l) => l.trim() !== '');
  return lines.length > 0 && lines.every((l) => /^[ \t]*([-*]|\d+\.)\s/.test(l));
}

// raw → { ordered, items:[{level, inline}] } (niveaux normalisés : pas de saut > +1).
function _mjParseList(raw) {
  const lines = (raw || '').split('\n').filter((l) => l.trim() !== '');
  const ordered = lines.length > 0 && /^[ \t]*\d+\.\s/.test(lines[0]);
  const items = lines.map((l) => {
    const m = l.match(/^([ \t]*)(?:[-*]|\d+\.)\s+(.*)$/);
    const indent = (m && m[1] ? m[1] : '').replace(/\t/g, '  ').length;
    return { level: Math.floor(indent / 2), inline: (m && m[2]) || '' };
  });
  return { ordered, items: _mjNormalizeLevels(items) };
}

// Premier item au niveau 0 ; aucun item ne saute de plus d'un niveau vs le précédent.
function _mjNormalizeLevels(items) {
  let prev = -1;
  items.forEach((it) => { it.level = Math.max(0, Math.min(it.level, prev + 1)); prev = it.level; });
  return items;
}

// items → markdown (2 espaces / niveau ; numérotation ordonnée par compteurs de niveau).
function _mjListToMarkdown(ordered, items) {
  const counters = [];
  return items.map((it) => {
    const lvl = Math.max(0, it.level);
    let marker;
    if (ordered) { counters[lvl] = (counters[lvl] || 0) + 1; counters.length = lvl + 1; marker = counters[lvl] + '.'; }
    else marker = '-';
    return '  '.repeat(lvl) + marker + ' ' + it.inline;
  }).join('\n');
}

// Contenu inline d'un item (les éventuels sauts de ligne parasites deviennent des espaces).
function _mjLiInline(li) { return mjEditableToMd(li).replace(/\n+/g, ' ').replace(/\s+$/g, ''); }

// DOM de l'éditeur de liste → markdown.
function _mjListSerialize(el) {
  const ordered = el.getAttribute('data-ltype') === 'ol';
  const items = [...el.querySelectorAll(':scope > .mj-li')].map((li) => ({
    level: parseInt(li.getAttribute('data-level'), 10) || 0,
    inline: _mjLiInline(li),
  }));
  return _mjListToMarkdown(ordered, _mjNormalizeLevels(items));
}

// Sérialisation unifiée d'un éditeur de bloc → markdown (liste / rich / textarea).
function _mjEditorToRaw(el) {
  if (!el) return '';
  if (el.classList && el.classList.contains('mj-list-edit'))  return _mjListSerialize(el);
  if (el.classList && el.classList.contains('mj-block-rich'))  return _mjRichRaw(el);
  if (el.isContentEditable) return mjEditableToMd(el);
  return el.value != null ? el.value : '';
}

// Conteneur « rich » actif pour les marques : l'item .mj-li dans une liste, sinon le bloc.
function _mjActiveRichContainer(el) {
  if (!el) return null;
  if (el.classList && el.classList.contains('mj-list-edit')) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let n = sel.getRangeAt(0).startContainer;
    while (n && n !== el) { if (n.nodeType === 1 && n.classList && n.classList.contains('mj-li')) return n; n = n.parentNode; }
    return null;
  }
  return el;
}

// HTML d'édition d'un bloc liste (contenteditable, un <div.mj-li> par item).
function _mjListEditorHtml(b) {
  const { ordered, items } = _mjParseList(b.raw);
  const lis = items.map((it) =>
    `<div class="mj-li" data-level="${it.level}" style="--lvl:${it.level};">${mjMdToEditableHtml(it.inline) || '<br>'}</div>`
  ).join('');
  return `<div class="mj-block editing" data-block-id="${b.id}">
    <div id="mjb-${b.id}" class="mj-list-edit" contenteditable="true" spellcheck="false" data-ltype="${ordered ? 'ol' : 'ul'}"
      oninput="mjListInput('${b.id}')"
      onkeydown="mjListKeydown(event,'${b.id}')"
      onkeyup="mjRichKeyup(event,'${b.id}')"
      onmouseup="mjFormatUpdateState()"
      onpaste="mjRichPaste(event)"
      onblur="mjListBlur('${b.id}')">${lis}</div>
  </div>`;
}

// Item .mj-li contenant le curseur.
function _mjCurrentLi(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.getRangeAt(0).startContainer;
  while (n && n !== el) { if (n.nodeType === 1 && n.classList && n.classList.contains('mj-li')) return n; n = n.parentNode; }
  return null;
}
function _mjLiLevel(li) { return parseInt(li.getAttribute('data-level'), 10) || 0; }
function _mjLiSetLevel(li, lvl) { lvl = Math.max(0, lvl); li.setAttribute('data-level', lvl); li.style.setProperty('--lvl', lvl); }
function _mjLiCaretAtStart(li) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(li);
  probe.setEnd(r.startContainer, r.startOffset);
  return probe.cloneContents().childNodes.length === 0;
}

function mjListInput(id) {
  const b = _mjBlocks.find((x) => x.id === id), el = document.getElementById('mjb-' + id);
  if (b && el) b.raw = _mjListSerialize(el);
  _mjBlocksChanged();
  if (typeof mjAcUpdateRich === 'function') mjAcUpdateRich(el);
  mjFormatUpdateState();
}

function mjListBlur(id) {
  setTimeout(() => {
    if (document.getElementById('mj-wdg-form')?.style.display === 'block') return;
    const el = document.getElementById('mjb-' + id);
    if (el && document.activeElement === el) return;
    if (_mjEditingBlockId !== id) return;
    if (el) { const b = _mjBlocks.find((x) => x.id === id); if (b) b.raw = _mjListSerialize(el); }
    if (typeof mjAcClose === 'function') mjAcClose();
    _mjEditingBlockId = null;
    _mjRenderBlocks();
  }, 150);
}

function mjListKeydown(e, id) {
  if (typeof _mjAcOpen !== 'undefined' && _mjAcOpen && typeof mjAcKeydown === 'function') {
    mjAcKeydown(e); if (e.defaultPrevented) return;
  }
  const el = document.getElementById('mjb-' + id);
  const li = _mjCurrentLi(el);
  if (e.key === 'Tab') {                          // indenter / désindenter
    e.preventDefault();
    if (!li) return;
    if (e.shiftKey) { _mjLiSetLevel(li, _mjLiLevel(li) - 1); mjListInput(id); }
    else {
      const prev = li.previousElementSibling;     // le 1er item ne peut pas s'indenter
      if (prev) { _mjLiSetLevel(li, Math.min(_mjLiLevel(li) + 1, _mjLiLevel(prev) + 1)); mjListInput(id); }
    }
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!li) return;
    if (_mjLiInline(li) === '') {                 // item vide → désindente, ou sort de la liste
      if (_mjLiLevel(li) > 0) { _mjLiSetLevel(li, _mjLiLevel(li) - 1); mjListInput(id); }
      else _mjListExitToParagraph(id, li);
    } else _mjListSplitItem(id, li);              // item avec texte → nouvel item frère
    return;
  }
  if (e.key === 'Backspace') {
    const pill = _mjPillAdjacentToCaret(el, 'before');
    if (pill) { e.preventDefault(); pill.remove(); mjListInput(id); return; }
    if (li && _mjLiCaretAtStart(li)) {
      if (_mjLiLevel(li) > 0) { e.preventDefault(); _mjLiSetLevel(li, _mjLiLevel(li) - 1); mjListInput(id); return; }
      const prev = li.previousElementSibling;
      if (prev) { e.preventDefault(); _mjListMergePrevItem(id, li, prev); return; }
      if (_mjLiInline(li) === '') { e.preventDefault(); _mjListExitToParagraph(id, li); return; }
    }
    return;
  }
  if (e.key === 'Delete') {
    const pill = _mjPillAdjacentToCaret(el, 'after');
    if (pill) { e.preventDefault(); pill.remove(); mjListInput(id); }
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); el?.blur(); }
}

// Entrée avec texte : scinde l'item au curseur en deux items frères (même niveau).
function _mjListSplitItem(id, li) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const caret = sel.getRangeAt(0);
  const afterRange = document.createRange();
  afterRange.selectNodeContents(li);
  afterRange.setStart(caret.endContainer, caret.endOffset);
  const frag = afterRange.extractContents();
  const lvl = _mjLiLevel(li);
  const nl = document.createElement('div');
  nl.className = 'mj-li'; nl.setAttribute('data-level', lvl); nl.style.setProperty('--lvl', lvl);
  nl.appendChild(frag);
  if (!nl.childNodes.length) nl.appendChild(document.createElement('br'));
  if (!li.childNodes.length) li.appendChild(document.createElement('br'));
  li.parentNode.insertBefore(nl, li.nextSibling);
  const r = document.createRange(); r.selectNodeContents(nl); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  mjListInput(id);
}

// Backspace début d'item (niveau 0, avec précédent) : fusionne dans l'item précédent.
function _mjListMergePrevItem(id, li, prev) {
  if (prev.lastChild && prev.lastChild.nodeName === 'BR') prev.removeChild(prev.lastChild);
  const joinNode = prev.lastChild;
  while (li.firstChild) {
    if (li.firstChild.nodeName === 'BR' && !li.firstChild.nextSibling) { li.removeChild(li.firstChild); break; }
    prev.appendChild(li.firstChild);
  }
  li.remove();
  const r = document.createRange();
  if (joinNode) r.setStartAfter(joinNode); else { r.selectNodeContents(prev); }
  r.collapse(true);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  mjListInput(id);
}

// Item vide niveau 0 + Entrée : sort de la liste. L'item devient un paragraphe ;
// les items suivants forment une nouvelle liste sous le paragraphe.
function _mjListExitToParagraph(id, li) {
  const el = document.getElementById('mjb-' + id);
  const ordered = el.getAttribute('data-ltype') === 'ol';
  const all = [...el.querySelectorAll(':scope > .mj-li')];
  const pos = all.indexOf(li);
  const toItems = (arr) => _mjNormalizeLevels(arr.map((x) => ({ level: _mjLiLevel(x), inline: _mjLiInline(x) })));
  const beforeMd = _mjListToMarkdown(ordered, toItems(all.slice(0, pos)));
  const afterMd  = _mjListToMarkdown(ordered, toItems(all.slice(pos + 1)));
  const blockIdx = _mjBlocks.findIndex((b) => b.id === id);
  const b = _mjBlocks[blockIdx];
  const para = { id: _mjNewBlockId(), raw: '' };
  const tail = afterMd ? [para, { id: _mjNewBlockId(), raw: afterMd }] : [para];
  if (beforeMd) { b.raw = beforeMd; _mjBlocks.splice(blockIdx + 1, 0, ...tail); }
  else { _mjBlocks.splice(blockIdx, 1, ...tail); }
  _mjEditingBlockId = para.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  _mjFocusBlockEditor(para.id, 'start');
}

// HTML d'édition d'un bloc paragraphe en contenteditable riche (option D).
function _mjRichEditorHtml(b) {
  const { prefix, inline, type } = _mjSplitPrefix(b.raw);
  const cls = 'mj-block-edit mj-block-rich' + (type !== 'p' ? ' mj-rich-' + type : '');
  const ph = type === 'p' ? 'Écris ton scénario…  @ pour lier une ressource, / pour un bloc'
           : (type === 'quote' ? 'Citation…' : 'Titre…');
  return `<div class="mj-block editing" data-block-id="${b.id}">
    <div id="mjb-${b.id}" class="${cls}" contenteditable="true" spellcheck="false"
      data-bp="${escapeHtml(prefix)}" data-ph="${escapeHtml(ph)}"
      oninput="mjRichInput('${b.id}')"
      onkeydown="mjRichKeydown(event,'${b.id}')"
      onkeyup="mjRichKeyup(event,'${b.id}')"
      onmouseup="mjFormatUpdateState()"
      onpaste="mjRichPaste(event)"
      onblur="mjRichBlur('${b.id}')">${mjMdToEditableHtml(inline)}</div>
  </div>`;
}

// ── Rendu de la pile de blocs ─────────────────────────────────
function _mjRenderBlocks() {
  const host = document.getElementById('mj-blocks');
  if (!host) return;
  if (typeof mjBeginWidgetSeq === 'function') mjBeginWidgetSeq();  // index widgets global au doc
  const html = _mjBlocks.map((b) => {
    if (b.id === _mjEditingBlockId) {
      if (_mjIsTableBlock(b.raw)) return _mjTableEditorHtml(b);   // tableau → grille éditable
      if (_mjIsListBlock(b.raw))  return _mjListEditorHtml(b);    // liste → éditeur multi-niveaux
      if (_mjIsRichBlock(b.raw))  return _mjRichEditorHtml(b);    // paragraphe → contenteditable riche
      return `<div class="mj-block editing" data-block-id="${b.id}">
        <textarea id="mjb-${b.id}" class="mj-block-edit" rows="1" spellcheck="false"
          placeholder="Écris ton scénario…  @ pour lier une ressource, / pour un bloc"
          oninput="mjBlockInput(this)"
          onkeydown="mjBlockKeydown(event,'${b.id}')"
          onkeyup="if(typeof mjAcKeyupBlock==='function')mjAcKeyupBlock(event,this);mjFormatUpdateState()"
          onclick="if(typeof mjAcUpdateBlock==='function')mjAcUpdateBlock(this);mjFormatUpdateState()"
          onselect="mjFormatUpdateState()"
          onblur="mjBlockBlur('${b.id}')">${escapeHtml(b.raw)}</textarea>
      </div>`;
    }
    const rendered = b.raw.trim()
      ? _mjMarkdownWithTags(b.raw)
      : `<div class="mj-block-empty">Bloc vide — clique pour écrire</div>`;
    return `<div class="mj-block" data-block-id="${b.id}" onclick="mjBlockClick(event,'${b.id}')"`
      + ` oncontextmenu="if(typeof mjWidgetContext==='function')return mjWidgetContext(event);return true;">${rendered}</div>`;
  }).join('');
  host.innerHTML = html
    + `<div class="mj-blocks-tail" onclick="mjBlocksTailClick()" title="Ajouter un bloc"></div>`;
  if (typeof mjEndWidgetSeq === 'function') mjEndWidgetSeq();
  // Ajuster la largeur des combos rendus dans les blocs
  if (typeof _mjSizeCombos === 'function') setTimeout(_mjSizeCombos, 0);
  mjFormatUpdateState();   // barre de mise en forme : active/inactive selon l'édition en cours
}

// Ajuste la hauteur d'une textarea de bloc à son contenu
function _mjAutosize(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = (ta.scrollHeight) + 'px';
}

// ── Entrée / sortie d'édition d'un bloc ───────────────────────
function mjBlockClick(e, id) {
  // Ne pas éditer si on clique un élément interactif (widget, tag, lien, résumé…)
  if (e.target.closest('.mj-wdg, .mj-wdg-details, .mj-tag, a, summary, select, button, input')) return;
  // Bloc /details ou séparateur : pas d'édition texte inline (action via clic droit).
  const b = _mjBlocks.find((x) => x.id === id);
  const raw = (b ? b.raw : '').trim();
  if (b && (/^\/details(\[[^\]]*\])?\{/.test(raw) || /^([-*_]\s*){3,}$/.test(raw))) return;
  if (_mjEditingBlockId === id) return;
  _mjEnterEdit(id);
}

function _mjEnterEdit(id) {
  _mjEditingBlockId = id;
  _mjRenderBlocks();
  const el = document.getElementById('mjb-' + id);
  if (el) {
    _mjFocusBlockEditor(id, 'end');   // textarea ou contenteditable
  } else {
    // bloc tableau → focus la première cellule de la grille
    const cell = document.querySelector('.mj-tedit-wrap .mj-tedit-cell');
    if (cell) cell.focus();
  }
}

function mjBlockInput(ta) {
  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (b) b.raw = ta.value;
  _mjAutosize(ta);
  _mjBlocksChanged();
  if (typeof mjAcUpdateBlock === 'function') mjAcUpdateBlock(ta);
  mjFormatUpdateState();
}

function mjBlockKeydown(e, id) {
  // Laisser l'autocomplétion intercepter ses touches de navigation
  if (typeof _mjAcOpen !== 'undefined' && _mjAcOpen && typeof mjAcKeydown === 'function') {
    mjAcKeydown(e);
    if (e.defaultPrevented) return;
  }
  const ta = e.target;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    mjBlockSplit(id, ta.selectionStart);
  } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
    if (mjBlockMergePrev(id)) e.preventDefault();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (typeof mjAcClose === 'function') mjAcClose();
    ta.blur();
  }
  // Maj+Entrée : comportement par défaut (saut de ligne dans le bloc)
}

function mjBlockBlur(id) {
  setTimeout(() => {
    const ta = document.getElementById('mjb-' + id);
    if (ta && document.activeElement === ta) return;   // toujours focus (ex. re-focus après autocomplétion)
    if (_mjEditingBlockId !== id) return;
    if (typeof mjAcClose === 'function') mjAcClose();
    _mjEditingBlockId = null;
    _mjRenderBlocks();
  }, 150);
}

// Entrée : scinde le bloc à la position du curseur
function mjBlockSplit(id, caret) {
  const idx = _mjBlocks.findIndex((b) => b.id === id);
  if (idx === -1) return;
  const b = _mjBlocks[idx];
  const before = b.raw.slice(0, caret);
  const after  = b.raw.slice(caret);
  b.raw = before;
  const nb = { id: _mjNewBlockId(), raw: after };
  _mjBlocks.splice(idx + 1, 0, nb);
  _mjEditingBlockId = nb.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  _mjFocusBlockEditor(nb.id, 'start');   // textarea ou contenteditable
}

// Retour arrière en début de bloc : fusion avec le bloc précédent
function mjBlockMergePrev(id) {
  const idx = _mjBlocks.findIndex((b) => b.id === id);
  if (idx <= 0) return false;
  const prev = _mjBlocks[idx - 1];
  const cur  = _mjBlocks[idx];
  const joinPos = prev.raw.length;
  prev.raw = prev.raw + cur.raw;
  _mjBlocks.splice(idx, 1);
  _mjEditingBlockId = prev.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  _mjFocusBlockEditor(prev.id, joinPos);   // textarea (offset) ou contenteditable (→ fin)
  return true;
}

// Clic dans la zone vide sous le dernier bloc : ajoute un bloc
function mjBlocksTailClick() {
  const nb = { id: _mjNewBlockId(), raw: '' };
  _mjBlocks.push(nb);
  _mjEditingBlockId = nb.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  _mjFocusBlockEditor(nb.id, 'end');   // bloc vide → contenteditable (paragraphe)
}

// ── Éditeur riche (contenteditable) : paragraphes ─────────────
// Focalise l'éditeur d'un bloc (textarea OU contenteditable) et place le curseur.
// pos : 'start' | 'end' | nombre (offset Markdown, valable pour la textarea).
function _mjFocusBlockEditor(id, pos) {
  const el = document.getElementById('mjb-' + id);
  if (!el) return null;
  if (el.isContentEditable) {
    el.focus();
    if (el.classList.contains('mj-list-edit')) {   // liste : curseur dans le 1er/dernier item
      const items = el.querySelectorAll(':scope > .mj-li');
      const li = pos === 'start' ? items[0] : items[items.length - 1];
      _mjRichCaret(li || el, pos === 'start');
    } else {
      _mjRichCaret(el, pos === 'start');   // offset Markdown non mappable → début ou fin
    }
    mjFormatUpdateState();
    return el;
  }
  el.focus();
  const L = el.value.length;
  const p = (pos === 'start') ? 0 : (typeof pos === 'number' ? Math.min(pos, L) : L);
  el.setSelectionRange(p, p);
  _mjAutosize(el);
  mjFormatUpdateState();
  return el;
}

// Place le curseur au début (atStart=true) ou à la fin d'un contenteditable.
function _mjRichCaret(el, atStart) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(!!atStart);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Frappe dans un bloc riche : re-sérialise le DOM → Markdown (sans re-render,
// le curseur est préservé) et planifie la sauvegarde.
function mjRichInput(id) {
  const b  = _mjBlocks.find((x) => x.id === id);
  const el = document.getElementById('mjb-' + id);
  if (b && el) b.raw = _mjRichRaw(el);
  _mjBlocksChanged();
  if (typeof mjAcUpdateRich === 'function') mjAcUpdateRich(el);
  mjFormatUpdateState();
}

// keyup : rafraîchit l'autocomplétion (hors touches de navigation) + l'état des marques
function mjRichKeyup(e, id) {
  if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
    if (typeof mjAcUpdateRich === 'function') mjAcUpdateRich(document.getElementById('mjb-' + id));
  }
  mjFormatUpdateState();
}

function mjRichKeydown(e, id) {
  // Laisser l'autocomplétion intercepter ses touches de navigation
  if (typeof _mjAcOpen !== 'undefined' && _mjAcOpen && typeof mjAcKeydown === 'function') {
    mjAcKeydown(e);
    if (e.defaultPrevented) return;
  }
  const el = document.getElementById('mjb-' + id);
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    mjRichSplit(id);
  } else if (e.key === 'Backspace') {
    const pill = _mjPillAdjacentToCaret(el, 'before');   // suppression atomique d'une puce
    if (pill) { e.preventDefault(); pill.remove(); mjRichInput(id); return; }
    if (_mjRichCaretAtStart(el) && mjRichMergePrev(id)) e.preventDefault();
  } else if (e.key === 'Delete') {
    const pill = _mjPillAdjacentToCaret(el, 'after');
    if (pill) { e.preventDefault(); pill.remove(); mjRichInput(id); }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    el?.blur();
  }
  // Maj+Entrée : comportement par défaut (insère un <br> dans le bloc)
}

// Puce atomique immédiatement avant/après le curseur (collapsed) — pour la
// suppression d'un seul tenant (Retour arrière / Suppr).
function _mjPillAdjacentToCaret(el, side) {
  if (!el) return null;
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!r.collapsed || !el.contains(r.startContainer)) return null;
  let node = r.startContainer, off = r.startOffset;
  if (node.nodeType === 3) {
    const txt = node.nodeValue.split(_MJ_RICH_ZWSP).join('');
    if (side === 'before') {
      if (node.nodeValue.slice(0, off).split(_MJ_RICH_ZWSP).join('') !== '') return null;
      let prev = node.previousSibling;
      while (prev && prev.nodeType === 3 && prev.nodeValue.split(_MJ_RICH_ZWSP).join('') === '') prev = prev.previousSibling;
      return _mjIsPill(prev) ? prev : null;
    } else {
      if (node.nodeValue.slice(off).split(_MJ_RICH_ZWSP).join('') !== '') return null;
      let next = node.nextSibling;
      while (next && next.nodeType === 3 && next.nodeValue.split(_MJ_RICH_ZWSP).join('') === '') next = next.nextSibling;
      return _mjIsPill(next) ? next : null;
    }
  }
  const cand = (side === 'before') ? node.childNodes[off - 1] : node.childNodes[off];
  return _mjIsPill(cand) ? cand : null;
}
function _mjIsPill(n) { return n && n.nodeType === 1 && n.classList && n.classList.contains('mj-pill'); }

// Curseur en tout début du bloc (rien — texte ou puce — avant lui) ?
function _mjRichCaretAtStart(el) {
  if (!el) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(el);
  probe.setEnd(r.startContainer, r.startOffset);
  return probe.cloneContents().childNodes.length === 0;
}

// Entrée : scinde le bloc riche à la position du curseur (Range-based).
function mjRichSplit(id) {
  const idx = _mjBlocks.findIndex((b) => b.id === id);
  if (idx === -1) return;
  const el  = document.getElementById('mjb-' + id);
  const sel = window.getSelection();
  if (!el || !sel.rangeCount) return;
  const caret = sel.getRangeAt(0);
  // Extrait tout ce qui suit le curseur → fragment « après » (el garde « avant »)
  const afterRange = document.createRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(caret.endContainer, caret.endOffset);
  const afterFrag = afterRange.extractContents();
  const tmp = document.createElement('div');
  tmp.appendChild(afterFrag);
  const beforeMd = mjEditableToMd(el);
  const afterMd  = mjEditableToMd(tmp);
  const b  = _mjBlocks[idx];
  b.raw = (el.getAttribute('data-bp') || '') + beforeMd;   // garde le type (titre/citation)
  const nb = { id: _mjNewBlockId(), raw: afterMd };          // Entrée → nouveau paragraphe
  _mjBlocks.splice(idx + 1, 0, nb);
  _mjEditingBlockId = nb.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  _mjFocusBlockEditor(nb.id, 'start');
}

// Retour arrière en début de bloc riche : fusion avec le bloc précédent.
function mjRichMergePrev(id) {
  const idx = _mjBlocks.findIndex((b) => b.id === id);
  if (idx <= 0) return false;
  const prev = _mjBlocks[idx - 1];
  const cur  = _mjBlocks[idx];
  const prevRaw = prev.raw, curRaw = cur.raw;
  const prevInline = _mjSplitPrefix(prevRaw).inline;       // contenu inline (sans préfixe)
  const curInline  = _mjSplitPrefix(curRaw).inline;        // on fusionne sans le préfixe de cur
  prev.raw = prevRaw + curInline;                          // prev garde son propre préfixe
  _mjBlocks.splice(idx, 1);
  _mjEditingBlockId = prev.id;
  _mjBlocksChanged();
  _mjRenderBlocks();
  const el = document.getElementById('mjb-' + prev.id);
  if (el && el.isContentEditable) _mjRichSetCaretAtSeam(el, prevInline, curInline);
  else _mjFocusBlockEditor(prev.id, prevRaw.length);   // prev non-rich (liste/séparateur)
  return true;
}

// Réécrit el avec [avant][curseur][après] et pose le curseur à la jointure.
function _mjRichSetCaretAtSeam(el, beforeMd, afterMd) {
  el.innerHTML = mjMdToEditableHtml(beforeMd)
    + '<span class="mj-seam"></span>' + mjMdToEditableHtml(afterMd);
  const seam = el.querySelector('.mj-seam');
  el.focus();
  const range = document.createRange();
  range.setStartBefore(seam);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  seam.remove();   // la plage « avant seam » reste à la jointure après suppression
}

// Sortie d'un bloc riche : sérialise une dernière fois, repasse en lecture.
function mjRichBlur(id) {
  setTimeout(() => {
    // Formulaire d'insertion de widget ouvert → il a pris le focus, on reste en édition
    if (document.getElementById('mj-wdg-form')?.style.display === 'block') return;
    const el = document.getElementById('mjb-' + id);
    if (el && document.activeElement === el) return;   // toujours focus (ex. re-focus)
    if (_mjEditingBlockId !== id) return;
    if (el) { const b = _mjBlocks.find((x) => x.id === id); if (b) b.raw = _mjRichRaw(el); }
    if (typeof mjAcClose === 'function') mjAcClose();
    _mjEditingBlockId = null;
    _mjRenderBlocks();
  }, 150);
}

// ── Insertion d'un widget via formulaire (spec §5.1) ──────────
// Champs collectés par type ; le token Markdown est construit à la validation,
// puis une puce-widget atomique est insérée à la position capturée.
const _MJ_WDG_FORM = {
  switch:   { title: '🔘 Interrupteur',    fields: [{ k: 'label', label: 'Libellé', ph: 'Objet trouvé' }] },
  todo:     { title: '☑️ Tâche',            fields: [{ k: 'label', label: 'Tâche',   ph: 'Parler au forgeron' }] },
  combo:    { title: '🔽 Liste déroulante', fields: [{ k: 'label', label: 'Libellé', ph: 'Porte' }, { k: 'opts', label: 'Options (séparées par |)', ph: 'fermée|ouverte' }] },
  compteur: { title: '🔢 Compteur',         fields: [{ k: 'label', label: 'Unité', ph: 'pv' }, { k: 'range', label: 'Bornes min..max (option)', ph: '0..10' }] },
  jauge:    { title: '🕐 Horloge',          fields: [{ k: 'label', label: 'Libellé', ph: 'Rituel' }, { k: 'segs', label: 'Segments', ph: '6', type: 'number' }] },
  details:  { title: '▶️ Bloc repliable',    fields: [{ k: 'title', label: 'Titre', ph: 'Secret du MJ' }, { k: 'body', label: 'Contenu', ph: 'Texte révélé en dépliant…', type: 'textarea' }] },
};

// Cible de la modale : insertion (position capturée) ou édition (puce existante).
let _mjWfTarget = null;     // { mode:'insert', ctx, targetId } | { mode:'edit', pill, state, targetId }
let _mjWdgFormKey = null;

// Insertion : ctx = { node, start, caret, targetId } (position du token /partial)
function mjOpenWidgetForm(key, ctx) {
  _mjOpenWf(key, { mode: 'insert', ctx, targetId: ctx && ctx.targetId }, {}, 'Insérer');
}
// Édition d'un widget rendu en LECTURE (clic droit, hors édition) : modale
// pré-remplie, réécrit le wi-ème token via _mjWidgetMutate (conserve l'état [..]).
function mjOpenWidgetEditFormRead(wi) {
  const token = (typeof _mjWidgetTokenAt === 'function') ? _mjWidgetTokenAt(wi) : null;
  if (!token) return;
  const parsed = (typeof _mjWidgetTokenToVals === 'function') ? _mjWidgetTokenToVals(token) : null;
  if (!parsed) return;
  const sm = token.match(/^\/[a-zà-ÿ]+\[([^\]]*)\]/i);
  _mjOpenWf(parsed.type, { mode: 'editRead', wi, state: sm ? sm[1] : '', targetId: null }, parsed.vals, 'Enregistrer');
}

// Édition (clic droit) : pré-remplit depuis la puce, conserve l'état [..]
function mjOpenWidgetEditForm(pill) {
  if (!pill) return;
  const md = pill.getAttribute('data-md') || '';
  const parsed = (typeof _mjWidgetTokenToVals === 'function') ? _mjWidgetTokenToVals(md) : null;
  if (!parsed) return;
  const sm = md.match(/^\/[a-zà-ÿ]+\[([^\]]*)\]/i);
  const host = pill.closest('.mj-block-rich');
  _mjOpenWf(parsed.type, { mode: 'edit', pill, state: sm ? sm[1] : '', targetId: host ? host.id : null }, parsed.vals, 'Enregistrer');
}

function _mjOpenWf(key, target, prefill, okLabel) {
  const cfg = _MJ_WDG_FORM[key];
  if (!cfg) return;
  _mjWfTarget = target; _mjWdgFormKey = key;
  let el = document.getElementById('mj-wdg-form');
  if (!el) { el = document.createElement('div'); el.id = 'mj-wdg-form'; document.body.appendChild(el); }
  const fields = cfg.fields.map((f) => {
    if (f.type === 'textarea') {
      // Échap seulement : Enter doit insérer un saut de ligne, pas valider.
      return `<label class="mj-wf-row">
        <span class="mj-wf-lbl">${escapeHtml(f.label)}</span>
        <textarea class="mj-wf-input mj-wf-textarea" id="mj-wf-${f.k}"
          placeholder="${escapeHtml(f.ph || '')}"
          onkeydown="if(event.key==='Escape'){event.preventDefault();mjWidgetFormClose(true);}"></textarea>
      </label>`;
    }
    return `<label class="mj-wf-row">
      <span class="mj-wf-lbl">${escapeHtml(f.label)}</span>
      <input class="mj-wf-input" id="mj-wf-${f.k}" type="${f.type || 'text'}"
             placeholder="${escapeHtml(f.ph || '')}" onkeydown="mjWidgetFormKey(event)"/>
    </label>`;
  }).join('');
  el.innerHTML = `
    <div class="mj-wf-backdrop" onclick="mjWidgetFormClose(true)"></div>
    <div class="mj-wf-card">
      <div class="mj-wf-title">${cfg.title}</div>
      ${fields}
      <div class="mj-wf-bar">
        <button class="mj-wf-cancel" onclick="mjWidgetFormClose(true)">Annuler</button>
        <button class="mj-wf-ok" onclick="mjWidgetFormSubmit()">${escapeHtml(okLabel || 'Insérer')}</button>
      </div>
    </div>`;
  el.style.display = 'block';
  // Pré-remplissage SYNCHRONE (les inputs existent dès l'innerHTML) ; focus différé.
  cfg.fields.forEach((f) => {
    const i = document.getElementById('mj-wf-' + f.k);
    if (i && prefill[f.k] != null) i.value = prefill[f.k];
  });
  setTimeout(() => {
    const first = el.querySelector('.mj-wf-input');
    if (first) { first.focus(); first.select(); }
  }, 30);
}

function mjWidgetFormKey(e) {
  if (e.key === 'Enter')      { e.preventDefault(); mjWidgetFormSubmit(); }
  else if (e.key === 'Escape'){ e.preventDefault(); mjWidgetFormClose(true); }
}

// refocus = true → redonne le focus au bloc en édition (annulation)
function mjWidgetFormClose(refocus) {
  const el = document.getElementById('mj-wdg-form');
  if (el) el.style.display = 'none';
  const targetId = _mjWfTarget && _mjWfTarget.targetId;
  _mjWfTarget = null; _mjWdgFormKey = null;
  if (refocus && targetId) document.getElementById(targetId)?.focus();
}

function mjWidgetFormSubmit() {
  const key = _mjWdgFormKey, target = _mjWfTarget;
  if (!key || !target) return;
  const vals = {};
  (_MJ_WDG_FORM[key].fields || []).forEach((f) => {
    const inp = document.getElementById('mj-wf-' + f.k);
    vals[f.k] = inp ? inp.value : '';
  });
  if (target.mode === 'detailsInsert') {
    const token = _mjBuildWidgetToken('details', vals);
    mjWidgetFormClose(false);
    mjMakeDetailsBlock(target.blockId, target.remaining, token);
  } else if (target.mode === 'detailsEdit') {
    const token = _mjBuildWidgetToken('details', vals);
    mjWidgetFormClose(false);
    const b = _mjBlocks.find((x) => x.id === target.blockId);
    if (b) { b.raw = token; _mjEditingBlockId = null; _mjBlocksChanged(); _mjRenderBlocks(); }
  } else if (target.mode === 'edit') {
    const token = _mjBuildWidgetToken(key, vals, target.state);   // conserve l'état [..]
    mjWidgetFormClose(false);
    if (typeof _mjApplyWidgetEdit === 'function') _mjApplyWidgetEdit(target.pill, token);
    document.getElementById(target.targetId)?.focus();
  } else if (target.mode === 'editRead') {
    const token = _mjBuildWidgetToken(key, vals, target.state);   // widget rendu (lecture)
    mjWidgetFormClose(false);
    if (typeof _mjWidgetMutate === 'function') _mjWidgetMutate(target.wi, () => token);
  } else {
    const token = _mjBuildWidgetToken(key, vals);
    mjWidgetFormClose(false);
    _mjInsertWidgetPillAt(target.ctx, token);
  }
}

// Construit le token Markdown ; `state` (optionnel) = contenu du [..] à préserver.
function _mjBuildWidgetToken(key, vals, state) {
  const br = (state != null && String(state).trim() !== '') ? `[${String(state).trim()}]` : '';
  const label = (vals.label || '').trim();
  if (key === 'switch' || key === 'todo') return `/${key}${br}{${label}}`;
  if (key === 'combo') {
    const opts = (vals.opts || '').split('|').map((s) => s.trim()).filter(Boolean).join('|');
    return `/combo${br}{${label}${opts ? ': ' + opts : ''}}`;
  }
  if (key === 'compteur') {
    const range = (vals.range || '').trim();
    return `/compteur${br}{${label}${/^-?\d+\s*\.\.\s*-?\d+$/.test(range) ? ': ' + range : ''}}`;
  }
  if (key === 'jauge') {
    let n = parseInt(vals.segs, 10); if (isNaN(n)) n = 6;
    n = Math.max(1, Math.min(12, n));
    return `/jauge${br}{${label}: ${n}}`;
  }
  if (key === 'details') {
    // /details{Titre | Contenu}. Titre sans « | » ni « } » ; contenu (multi-lignes OK) sans « } ».
    const title = (vals.title || '').replace(/[|}]/g, ' ').trim();
    const body  = (vals.body  || '').replace(/}/g, '').trim();
    return body ? `/details{${title} | ${body}}` : `/details{${title}}`;
  }
  return `/${key}${br}{${label}}`;
}

// ── Bloc /details via modale (Titre + Contenu) ────────────────
// Parse /details{titre | body} → { title, body } (pour pré-remplir la modale).
function _mjDetailsTokenToVals(token) {
  const m = (token || '').match(/^\/details(?:\[[^\]]*\])?\{([\s\S]*)\}$/);
  if (!m) return { title: '', body: '' };
  const body = m[1], pi = body.indexOf('|');
  return {
    title: (pi >= 0 ? body.slice(0, pi) : body).trim(),
    body:  (pi >= 0 ? body.slice(pi + 1) : '').trim(),
  };
}

// Ouvre la modale details : édition (editToken fourni) ou insertion.
function mjOpenDetailsForm(blockId, remaining, editToken) {
  if (editToken) {
    _mjOpenWf('details', { mode: 'detailsEdit', blockId }, _mjDetailsTokenToVals(editToken), 'Enregistrer');
  } else {
    _mjOpenWf('details', { mode: 'detailsInsert', blockId, remaining: remaining || '' }, {}, 'Insérer');
  }
}

// Pose le token /details dans son bloc : si du texte restait, il garde sa place et
// le bloc details est inséré dessous. Le bloc details se rend en lecture (<details>).
function mjMakeDetailsBlock(blockId, remaining, token) {
  const b = _mjBlocks.find((x) => x.id === blockId);
  if (!b) return;
  const rest = (remaining || '').trim();
  if (rest === '') {
    b.raw = token;
  } else {
    b.raw = rest;
    const nb = { id: _mjNewBlockId(), raw: token };
    _mjBlocks.splice(_mjBlocks.findIndex((x) => x.id === b.id) + 1, 0, nb);
  }
  _mjEditingBlockId = null;
  _mjBlocksChanged();
  _mjRenderBlocks();
}

// Remplace le token /partial (capturé) par une puce-widget atomique, curseur après.
function _mjInsertWidgetPillAt(ctx, token) {
  const node = ctx && ctx.node;
  const el = document.getElementById(ctx ? ctx.targetId : '');
  if (!node || !node.parentNode || !el) return;
  const full   = node.nodeValue;
  const before = full.slice(0, ctx.start);
  const after  = full.slice(ctx.caret);

  const tmp = document.createElement('div');
  tmp.innerHTML = _mjWidgetPillHtml(token);
  const pill = tmp.firstChild;

  const parent   = node.parentNode;
  const beforeNd = document.createTextNode(before);
  const afterNd  = document.createTextNode(after.length ? after : _MJ_RICH_ZWSP);
  parent.insertBefore(beforeNd, node);
  parent.insertBefore(pill, node);
  parent.insertBefore(afterNd, node);
  parent.removeChild(node);

  el.focus();
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(afterNd, 0); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);

  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (b) b.raw = mjEditableToMd(el);
  _mjBlocksChanged();
  if (typeof _mjSizeCombos === 'function') setTimeout(_mjSizeCombos, 0);
}

// ── Copier / coller Markdown (§9) ─────────────────────────────
// Copie le contenu courant (Markdown brut) dans le presse-papier.
function mjCopyDocMarkdown() {
  const md = (typeof _mjBlocksToContent === 'function') ? _mjBlocksToContent() : '';
  const done = () => { if (typeof showToast === 'function') showToast('✅ Markdown copié'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(md).then(done).catch(() => _mjFallbackCopy(md, done));
  } else _mjFallbackCopy(md, done);
}
function _mjFallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  ta.remove(); if (cb) cb();
}

// Collage dans un éditeur riche/liste : on n'insère QUE du texte brut (text/plain),
// jamais le HTML externe (pas d'import de styles arbitraires) — spec §9.
function mjRichPaste(e) {
  if (!e.clipboardData) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain') || '';
  _mjInsertPlainTextAtCaret(text);
  const el = e.target.closest && e.target.closest('.mj-block-rich, .mj-list-edit');
  if (el) {
    const id = el.id.replace('mjb-', '');
    if (el.classList.contains('mj-list-edit')) mjListInput(id); else mjRichInput(id);
  }
}
function _mjInsertPlainTextAtCaret(text) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  const nodes = [];
  text.split(/\r?\n/).forEach((p, i) => { if (i) nodes.push(document.createElement('br')); nodes.push(document.createTextNode(p)); });
  const frag = document.createDocumentFragment();
  nodes.forEach((n) => frag.appendChild(n));
  const last = nodes[nodes.length - 1];
  r.insertNode(frag);
  if (last) { r.setStartAfter(last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
}

// Planifie la sauvegarde (différée) de l'éditeur actif, quel que soit l'hôte
function _mjBlocksChanged() {
  const ind = document.getElementById('mj-doc-save-ind');
  if (ind) ind.textContent = '●';
  if (typeof _mjBlockSave !== 'function') return;
  clearTimeout(_mjBlockSaveTimer);
  _mjBlockSaveTimer = setTimeout(_mjBlockSave, 600);
}

// ── Barre de mise en forme (gras / italique / souligné / barré) ──
// Marqueurs Markdown, du plus externe au plus interne (ordre canonique
// d'imbrication, cohérent avec inlineMd) : ** (gras), __ (souligné),
// ~~ (barré), * (italique). Souligné et barré occupent le « créneau du
// milieu » → mutuellement exclusifs.
const _MJ_FMT_ORDER = ['**', '__', '~~', '*'];

// « Épluche » les marqueurs qui entourent immédiatement la sélection [s,e[
// et renvoie l'ensemble des styles présents + les bornes externes (os,oe).
// La sélection est supposée porter sur le texte visible (marqueurs autour).
function _mjPeelStyles(v, s, e) {
  const styles = new Set();
  let os = s, oe = e, changed = true;
  while (changed) {
    changed = false;
    for (const m of _MJ_FMT_ORDER) {
      if (styles.has(m)) continue;
      const ml = m.length;
      if (v.slice(os - ml, os) === m && v.slice(oe, oe + ml) === m) {
        // « * » ne doit pas capter un « ** » (le gras est épluché en premier)
        if (m === '*' && (v.slice(os - 2, os) === '**' || v.slice(oe, oe + 2) === '**')) continue;
        styles.add(m); os -= ml; oe += ml; changed = true; break;
      }
    }
  }
  return { styles, os, oe };
}

// Logique pure de bascule d'une marque sur la chaîne Markdown `v` entre [s,e[.
// Ordre canonique d'imbrication (_MJ_FMT_ORDER), souligné⇄barré exclusifs.
// Renvoie { raw, s, e } : la nouvelle chaîne et la sélection à restaurer.
function _mjApplyMark(v, s, e, mark) {
  // Pas de sélection → insère des marqueurs vides, curseur au milieu
  if (s === e) {
    const raw = v.slice(0, s) + mark + mark + v.slice(e);
    const pos = s + mark.length;
    return { raw, s: pos, e: pos };
  }
  const { styles, os, oe } = _mjPeelStyles(v, s, e);
  const core = v.slice(s, e);
  if (styles.has(mark)) {
    styles.delete(mark);
  } else {
    styles.add(mark);
    if (mark === '__') styles.delete('~~');   // souligné ⇄ barré exclusifs
    if (mark === '~~') styles.delete('__');
  }
  const ordered = _MJ_FMT_ORDER.filter((m) => styles.has(m));
  const open  = ordered.join('');
  const close = ordered.slice().reverse().join('');
  const raw = v.slice(0, os) + open + core + close + v.slice(oe);
  const ns = os + open.length;
  return { raw, s: ns, e: ns + core.length };
}

function mjFormatToggle(mark) {
  if (!_mjEditingBlockId) return;
  const el = document.getElementById('mjb-' + _mjEditingBlockId);
  if (!el) return;
  if (el.isContentEditable) { mjRichFormatToggle(el, mark); return; }
  const r = _mjApplyMark(el.value, el.selectionStart, el.selectionEnd, mark);
  el.value = r.raw;
  el.focus(); el.setSelectionRange(r.s, r.e);
  _mjAutosize(el);
  _mjSyncBlockRaw(el);
}

// ── Bloc riche : marques via un modèle caractère→marques (robuste) ──
// L'approche « chaîne Markdown + marqueurs adjacents » ne gérait pas le toggle
// PARTIEL (enlever le gras d'un mot DANS une zone grasse) ni le split. On
// construit donc un modèle non ambigu depuis le DOM : chaque caractère porte son
// ensemble de marques ; les puces sont des entrées atomiques. On bascule la
// marque sur l'intervalle puis on re-sérialise en Markdown canonique.

// DOM éditable → [{ch, marks:Set} | {pill:token}] (un élément par caractère visible)
function _mjRichModel(el) {
  const model = [];
  const walk = (node, marks) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const t = child.nodeValue.split(_MJ_RICH_ZWSP).join('');
        for (const ch of t) model.push({ ch, marks: new Set(marks) });
        return;
      }
      if (child.nodeType !== 1) return;
      if (child.classList && child.classList.contains('mj-pill')) { model.push({ pill: _mjPillToMd(child) }); return; }
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') { model.push({ ch: '\n', marks: new Set(marks) }); return; }
      const mk = _MJ_RICH_MARK[tag];
      walk(child, mk ? new Set([...marks, mk]) : marks);
    });
  };
  walk(el, new Set());
  return model;
}

// Index (dans le modèle) correspondant au point DOM (node, offset).
function _mjRichModelPos(root, tNode, tOffset) {
  let idx = 0, done = false, res = 0;
  const walk = (node) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length && !done; i++) {
      if (node === tNode && i === tOffset) { res = idx; done = true; return; }
      const child = kids[i];
      if (child.nodeType === 3) {
        if (child === tNode) { res = idx + child.nodeValue.slice(0, tOffset).split(_MJ_RICH_ZWSP).join('').length; done = true; return; }
        idx += child.nodeValue.split(_MJ_RICH_ZWSP).join('').length;
      } else if (child.nodeType === 1) {
        if (child.classList && child.classList.contains('mj-pill')) idx += 1;
        else { const tag = child.tagName.toLowerCase(); if (tag === 'br') idx += 1; else walk(child); }
      }
    }
    if (!done && node === tNode && tOffset === kids.length) { res = idx; done = true; }
  };
  walk(root);
  return res;
}

// Bornes [si, ei[ de la sélection courante dans le modèle (ou null).
function _mjRichSelIndices(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return null;
  const a = _mjDeepPoint(range.startContainer, range.startOffset, true);
  const z = _mjDeepPoint(range.endContainer, range.endOffset, false);
  let si = _mjRichModelPos(el, a.node, a.offset);
  let ei = _mjRichModelPos(el, z.node, z.offset);
  if (si > ei) { const t = si; si = ei; ei = t; }
  return { si, ei, collapsed: range.collapsed };
}

// Modèle → Markdown canonique. offsets[i] = position Markdown juste avant le
// contenu de l'entrée i (après ouverture de ses marques) → pour restaurer la sélection.
function _mjSerializeModel(model) {
  const order = _MJ_FMT_ORDER;
  let out = '', open = [];
  const offsets = new Array(model.length + 1);
  const setMarks = (want) => {
    let common = 0;
    while (common < open.length && common < want.length && open[common] === want[common]) common++;
    for (let i = open.length - 1; i >= common; i--) out += open[i];   // ferme (ordre inverse)
    for (let i = common; i < want.length; i++) out += want[i];        // ouvre (ordre canonique)
    open = want.slice();
  };
  for (let i = 0; i < model.length; i++) {
    const m = model[i];
    if (m.pill !== undefined) { setMarks([]); offsets[i] = out.length; out += m.pill; }
    else { setMarks(order.filter((x) => m.marks.has(x))); offsets[i] = out.length; out += m.ch; }
  }
  setMarks([]);
  offsets[model.length] = out.length;
  return { raw: out, offsets };
}

function mjRichFormatToggle(el, mark) {
  const cont = _mjActiveRichContainer(el);   // item .mj-li dans une liste, sinon le bloc
  if (!cont) return;
  const idx = _mjRichSelIndices(cont);
  if (!idx || idx.collapsed || idx.si === idx.ei) return;   // marque sur sélection uniquement
  const model = _mjRichModel(cont);
  const chars = [];
  for (let i = idx.si; i < idx.ei && i < model.length; i++) if (model[i].ch !== undefined) chars.push(model[i]);
  if (!chars.length) return;
  const allMarked = chars.every((m) => m.marks.has(mark));   // tout déjà marqué → on retire ; sinon on ajoute
  chars.forEach((m) => {
    if (allMarked) m.marks.delete(mark);
    else { m.marks.add(mark); if (mark === '__') m.marks.delete('~~'); if (mark === '~~') m.marks.delete('__'); }
  });
  const { raw, offsets } = _mjSerializeModel(model);   // raw = inline du conteneur
  cont.innerHTML = mjMdToEditableHtml(raw);
  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (b) b.raw = _mjEditorToRaw(el);                   // liste / rich (préfixe) selon le bloc
  const p1 = _mjRichDomPointAt(cont, offsets[idx.si]);
  const p2 = _mjRichDomPointAt(cont, offsets[idx.ei]);
  const nr = document.createRange();
  nr.setStart(p1.node, p1.offset);
  nr.setEnd(p2.node, p2.offset);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(nr);
  el.focus();
  _mjBlocksChanged();
  mjFormatUpdateState();
}

// Reporte la valeur de la textarea dans le modèle, sauvegarde et rafraîchit la barre
function _mjSyncBlockRaw(ta) {
  const b = _mjBlocks.find((x) => x.id === _mjEditingBlockId);
  if (b) b.raw = ta.value;
  _mjBlocksChanged();
  mjFormatUpdateState();
}

// Met à jour l'état actif des boutons selon le texte sélectionné
function mjFormatUpdateState() {
  const bar = document.getElementById('mj-format-bar');
  if (!bar) return;
  const el = _mjEditingBlockId ? document.getElementById('mjb-' + _mjEditingBlockId) : null;
  let styles = new Set(), active = false;
  if (el && el.isContentEditable) {
    active = true;
    const cont = _mjActiveRichContainer(el);
    const idx = cont ? _mjRichSelIndices(cont) : null;     // bouton actif si TOUTE la sélection porte la marque
    if (cont && idx && !idx.collapsed && idx.si !== idx.ei) {
      const model = _mjRichModel(cont);
      for (const m of _MJ_FMT_ORDER) {
        let any = false, all = true;
        for (let i = idx.si; i < idx.ei && i < model.length; i++) {
          if (model[i].ch === undefined) continue;
          any = true;
          if (!model[i].marks.has(m)) { all = false; break; }
        }
        if (any && all) styles.add(m);
      }
    }
  } else if (el) {                         // textarea (titres, listes, citations…)
    active = true;
    if (el.selectionEnd > el.selectionStart) {
      styles = _mjPeelStyles(el.value, el.selectionStart, el.selectionEnd).styles;
    }
  }
  bar.classList.toggle('off', !active);
  bar.querySelectorAll('.mj-fmt-btn').forEach((btn) => {
    btn.classList.toggle('active', styles.has(btn.dataset.mark));
  });
}

// ── Actions ───────────────────────────────────────────────────
async function mjSessionSaveField(field, value) {
  if (!_mjSession) return;
  _mjSession[field] = value;
  await mjSaveSession(_mjSession);
  await mjRenderSessionsList();
}

// Clic sur un document dans l'arbre : ouvre l'éditeur
async function mjSelectDocFromTree(sessionId, docId) {
  if (_mjSession?.id !== sessionId) _mjSession = await mjGetSession(sessionId);
  _mjExpanded.add(sessionId);
  const docs = _mjSession?.docs || [];
  _mjSessionDoc = docs.find(d => d.id === docId) || null;
  // Index frais pour résoudre les @tags à l'affichage (toujours rendu)
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await mjRenderSessionsList();
  mjRenderSessionDetail();
}

// Ajout d'un document à une session donnée (depuis le ＋ de l'arbre)
async function mjAddDocTo(sessionId) {
  if (_mjSession?.id !== sessionId) _mjSession = await mjGetSession(sessionId);
  if (!_mjSession) return;
  if (!_mjSession.docs) _mjSession.docs = [];
  const doc = { id: _newDocId(), title: 'Nouveau document', content: '' };
  _mjSession.docs.push(doc);
  _mjSessionDoc = doc;
  _mjExpanded.add(sessionId);
  await mjSaveSession(_mjSession);
  await mjRenderSessionsList();
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-doc-title')?.focus(), 80);
}

// Suppression d'un scénario depuis l'arbre (clic droit) — sûre quelle que soit la
// session actuellement sélectionnée (ne dépend pas de _mjSession).
function mjDeleteScenarioConfirm(sessionId, docId) {
  appConfirm('Supprimer ce scénario ? Cette action est définitive.', async () => {
    const sess = await mjGetSession(sessionId);
    if (!sess) return;
    sess.docs = (sess.docs || []).filter((d) => d.id !== docId);
    await mjSaveSession(sess);
    if (_mjSession && _mjSession.id === sessionId) {
      _mjSession = sess;
      if (_mjSessionDoc && _mjSessionDoc.id === docId) _mjSessionDoc = sess.docs[0] || null;
    }
    await mjRenderSessionsList();
    if (_mjSession && _mjSession.id === sessionId) mjRenderSessionDetail();
  }, { okLabel: 'Supprimer', danger: true });
}

function mjDeleteDoc(docId) {
  if (!_mjSession) return;
  appConfirm('Supprimer ce scénario ? Cette action est définitive.', async () => {
    _mjSession.docs = (_mjSession.docs || []).filter(d => d.id !== docId);
    _mjSessionDoc = _mjSession.docs[0] || null;
    await mjSaveSession(_mjSession);
    await mjRenderSessionsList();
    mjRenderSessionDetail();
  }, { okLabel: 'Supprimer', danger: true });
}

function _mjDocChanged() {
  const ind = document.getElementById('mj-doc-save-ind');
  if (ind) ind.textContent = '●';
  clearTimeout(_mjDocSaveTimer);
  _mjDocSaveTimer = setTimeout(_mjDocSaveNow, 1000);
}

async function _mjDocSaveNow() {
  if (!_mjSession || !_mjSessionDoc) return;
  const titleEl = document.getElementById('mj-doc-title');
  _mjSessionDoc.title   = titleEl?.value.trim() || 'Sans titre';
  _mjSessionDoc.content = _mjBlocksToContent();
  // Mettre à jour dans le tableau docs
  const idx = (_mjSession.docs || []).findIndex(d => d.id === _mjSessionDoc.id);
  if (idx !== -1) _mjSession.docs[idx] = { ..._mjSessionDoc };
  await mjSaveSession(_mjSession);
  const ind = document.getElementById('mj-doc-save-ind');
  if (ind) ind.textContent = '✓';
  // Rafraîchir le libellé dans l'arbre (n'affecte pas l'éditeur)
  await mjRenderSessionsList();
}

async function mjNewSession() {
  const id = await mjSaveSession({
    title: 'Session ' + (new Date().toLocaleDateString('fr-FR')),
    date: new Date().toISOString().slice(0, 10),
    docs: [{ id: _newDocId(), title: 'Scénario', content: '' }],
  });
  _mjSession = await mjGetSession(id);
  _mjSessionDoc = null;
  _mjExpanded.add(id);
  await mjRenderSessionsList();
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-session-title')?.focus(), 80);
}

function mjDeleteSessionConfirm(id) {
  appConfirm('Supprimer cette session et tous ses scénarios ? Cette action est définitive.', async () => {
    await mjDeleteSession(id);
    _mjExpanded.delete(id);
    _mjSession = null; _mjSessionDoc = null;
    await mjRenderSessionsList();
    mjRenderSessionDetail();
  }, { okLabel: 'Supprimer', danger: true });
}

function mjToggleSessionsList() {
  _mjSessionListOpen = !_mjSessionListOpen;
  const panel = document.getElementById('mj-list');
  if (panel) {
    panel.style.width    = _mjSessionListOpen ? '' : '0';
    panel.style.minWidth = _mjSessionListOpen ? '' : '0';
  }
  const btn = document.getElementById('mj-sessions-toggle');
  if (btn) btn.textContent = _mjSessionListOpen ? '◀' : '▶';
}

function mjCloseSession() {
  _mjSession    = null;
  _mjSessionDoc = null;
  _mjSessionListOpen = true;
  // Restaurer la liste sans toucher au shell
  const panel = document.getElementById('mj-list');
  if (panel) { panel.style.width = ''; panel.style.minWidth = ''; }
  const btn = document.getElementById('mj-sessions-toggle');
  if (btn) btn.textContent = '◀';
  mjRenderSessionsList();
  mjRenderSessionDetail();
}
