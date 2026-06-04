// NOTES
// ═══════════════════════════════════════════════════════════════

let _notesCharId  = null;
let _notesSearch  = '';
let _editingNote  = null;   // note en cours d'édition
let _notePinned   = false;  // note épinglée = panel reste ouvert en changeant d'onglet
let _noteAutoSaveTimer = null;
let _noteSaved = true;

// ── Render liste ──────────────────────────────────────────────────────────────
async function renderNotesTab() {
  const char = await getCharacter(_selectedCharId);
  if (!char) return;
  _notesCharId = char.id;
  const all = getNotes(char);
  const filtered = _notesSearch
    ? all.filter(n => n.title.toLowerCase().includes(_notesSearch.toLowerCase())
                   || (n.content || '').toLowerCase().includes(_notesSearch.toLowerCase()))
    : all;

  const cardsHtml = filtered.length === 0
    ? `<div class="empty-panel"><div class="emoji">${_notesSearch ? '🔍' : '📝'}</div>
       <p>${_notesSearch ? 'Aucun résultat' : 'Aucune note.<br>Crée la première !'}</p></div>`
    : filtered.map(n => renderNoteCard(n)).join('');

  document.getElementById('content-area').innerHTML = `
    <div id="notes-root">
      <div class="search-bar" style="margin-bottom:10px;">
        <span>🔍</span>
        <input id="notes-search-input" placeholder="Rechercher une note..."
               value="${escapeHtml(_notesSearch)}" oninput="onNotesSearch(this.value)"/>
      </div>
      ${cardsHtml}
      <button class="add-pill orange" style="margin-top:4px;" onclick="createNote()">
        ＋ Créer une note
      </button>
    </div>`;

  if (_notesSearch) {
    const inp = document.getElementById('notes-search-input');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  // Le panel-detail reste ouvert si une note était éditée — pas besoin de rappeler
}

function onNotesSearch(val) { _notesSearch = val; refreshNotesTab(); }

// ── Render carte note ─────────────────────────────────────────────────────────
function renderNoteCard(n) {
  const date = new Date(n.updatedAt || n.createdAt || Date.now());
  const dateStr = date.toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'})
                + ' · ' + date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  const preview = (n.content || '').replace(/[#>\-\*]/g,'').trim().slice(0, 80);
  const isActive = _editingNote?.id === n.id;

  return `
  <div class="card note-card-item ${isActive ? 'note-active' : ''}" style="margin-bottom:8px;cursor:pointer;"
       onclick="openNoteEditor('${n.id}')"
       oncontextmenu="event.preventDefault();openNoteContextMenu(event,'${n.id}')">
    <div style="padding:14px 16px;">
      <div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:4px;">${escapeHtml(n.title)}</div>
      ${preview ? `<div style="font-size:12px;color:var(--text-mid);line-height:1.45;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preview)}</div>` : ''}
      <div style="font-size:10.5px;color:var(--text-light);font-weight:700;">Modifiée le ${dateStr}</div>
    </div>
  </div>`;
}

// ── Éditeur ───────────────────────────────────────────────────────────────────
async function openNoteEditor(id) {
  const char = await getCharacter(_notesCharId || _mobCharId);
  const note = getNotes(char).find(n => n.id === id);
  if (!note) return;
  _editingNote = note;

  // ── Mobile : remplacer mob-content par l'éditeur plein écran ─────────────
  if (window.innerWidth < 1100) {
    const area = document.getElementById('mob-content');
    if (area) {
      area.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <button onclick="mobBackToNotes()" style="padding:6px 14px;border-radius:99px;background:white;border:1.5px solid #E8ECF0;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#2C3E50;cursor:pointer;">← Notes</button>
            <span style="font-size:14px;font-weight:900;color:#2C3E50;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(note.title)}</span>
<span id="note-save-indicator" style="font-size:13px;font-weight:900;color:#5CC8A8;">✓</span>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <button class="ctr-icon-btn" onclick="toggleNotePreview()" id="note-preview-btn" title="Aperçu">👁</button>
          </div>
          <div id="note-editor-area" style="flex:1;position:relative;min-height:0;">
            <textarea id="note-editor-ta"
              style="width:100%;height:100%;min-height:200px;border:1.5px solid #E8ECF0;border-radius:12px;
                     padding:12px 14px;font-family:'Nunito',sans-serif;font-size:14px;line-height:1.7;
                     color:#2C3E50;resize:none;outline:none;background:#F8FAF9;box-sizing:border-box;"
              oninput="onNoteInput(this.value)"
              onfocus="this.style.borderColor='#5CC8A8'"
              onblur="this.style.borderColor='#E8ECF0'"
              placeholder="Écris ta note ici...">${escapeHtml(note.content || '')}</textarea>
            <div id="note-preview-area" style="display:none;width:100%;height:100%;border:1.5px solid #E8ECF0;border-radius:12px;padding:12px 14px;overflow-y:auto;background:white;box-sizing:border-box;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:11px;color:#6B7C8E;font-weight:700;">
            <span id="note-char-count">${(note.content||'').length} caractères</span>
            <span id="note-line-count">${(note.content||'').split('\n').length} lignes</span>
          </div>
        </div>`;
      setTimeout(() => {
        const ta = document.getElementById('note-editor-ta');
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      }, 50);
    }
    return;
  }

  // ── Desktop : panel détail latéral ───────────────────────────────────────
  document.getElementById('detail-title').innerHTML =
    `<span style="font-size:13px;">📝</span> ${escapeHtml(note.title)}`;
  document.getElementById('detail-content').innerHTML = renderNoteEditor(note);
  document.getElementById('panel-detail').classList.add('open');

  document.querySelectorAll('.note-card-item').forEach(el => {
    const isActive = el.getAttribute('onclick')?.includes(id);
    el.classList.toggle('note-active', !!isActive);
  });

  setTimeout(() => {
    const ta = document.getElementById('note-editor-ta');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function mobBackToNotes() {
  _editingNote = null;
  _notePinned  = false;
  if (_noteAutoSaveTimer) { clearTimeout(_noteAutoSaveTimer); _noteAutoSaveTimer = null; }
  mobSwitchTab('tab-notes');
}

function renderNoteEditor(note) {
  const content = note.content || '';
  const lines = content.split('\n').length;
  return `
  <div style="display:flex;flex-direction:column;height:100%;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <button class="ctr-icon-btn" onclick="toggleNotePreview()" id="note-preview-btn" title="Aperçu markdown">👁</button>
      <button class="ctr-icon-btn" id="note-pin-btn"
              onclick="toggleNotePin()"
              title="${_notePinned ? 'Désépingler la note' : 'Épingler — garder visible en changeant d\'onglet'}"
              style="${_notePinned ? 'background:var(--orange-l);color:var(--orange);' : ''}">📌</button>
      <span id="note-save-indicator" style="font-size:13px;font-weight:900;color:var(--green);margin-left:auto;">✓</span>
    </div>
    <div id="note-editor-area" style="flex:1;position:relative;">
      <textarea id="note-editor-ta"
        style="width:100%;height:100%;min-height:300px;border:1.5px solid #E8ECF0;border-radius:12px;
               padding:12px 14px;font-family:'Nunito',sans-serif;font-size:13px;line-height:1.7;
               color:var(--text);resize:none;outline:none;background:var(--bg);transition:border-color .15s;"
        onfocus="this.style.borderColor='var(--green)'"
        onblur="this.style.borderColor='#E8ECF0'"
        oninput="onNoteInput(this.value)"
        placeholder="# Titre\n\nÉcris ta note ici...\n\nMarkdown supporté : **gras**, *italique*,\n# H1, ## H2, - liste, > citation">${escapeHtml(content)}</textarea>
      <div id="note-preview-area" style="display:none;width:100%;min-height:300px;border:1.5px solid #E8ECF0;
               border-radius:12px;padding:12px 14px;overflow-y:auto;background:var(--white);"></div>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:11px;color:var(--text-light);font-weight:700;">
      <span id="note-char-count">${content.length} caractères</span>
      <span id="note-line-count">${lines} ligne${lines>1?'s':''}</span>
    </div>
  </div>`;
}

function onNoteInput(value) {
  // Indicateur non-sauvegardé
  const ind = document.getElementById('note-save-indicator');
  if (ind) { ind.textContent = '●'; ind.style.color = 'var(--blue)'; }
  // Compteurs
  const lines = value.split('\n').length;
  const cc = document.getElementById('note-char-count');
  const lc = document.getElementById('note-line-count');
  if (cc) cc.textContent = value.length + ' caractères';
  if (lc) lc.textContent = lines + ' ligne' + (lines>1?'s':'');
  // Auto-save debounce 1s
  if (_noteAutoSaveTimer) clearTimeout(_noteAutoSaveTimer);
  _noteAutoSaveTimer = setTimeout(() => saveNoteContent(value), 1000);
}

async function saveNoteContent(value) {
  if (!_editingNote || !_notesCharId) return;
  const char = await getCharacter(_notesCharId);
  const notes = getNotes(char);
  const idx = notes.findIndex(n => n.id === _editingNote.id);
  if (idx !== -1) {
    notes[idx].content   = value;
    notes[idx].updatedAt = Date.now();
    _editingNote = notes[idx];
    await saveNotes(_notesCharId, notes);
    // Indicateur sauvegardé
    const ind = document.getElementById('note-save-indicator');
    if (ind) { ind.textContent = '✓'; ind.style.color = 'var(--green)'; }
    // Rafraîchir les cartes sans perdre le focus
    renderNoteListOnly();
  }
}

async function renderNoteListOnly() {
  const char = await getCharacter(_notesCharId);
  const all = getNotes(char);
  const filtered = _notesSearch
    ? all.filter(n => n.title.toLowerCase().includes(_notesSearch.toLowerCase())
                   || (n.content || '').toLowerCase().includes(_notesSearch.toLowerCase()))
    : all;
  const list = document.getElementById('notes-root');
  if (!list) return;
  // Remplacer seulement les cartes (pas la searchbar ni le bouton add)
  const cards = filtered.map(n => renderNoteCard(n)).join('');
  const searchBar = list.querySelector('.search-bar')?.outerHTML || '';
  const addBtn    = list.querySelector('.add-pill')?.outerHTML    || '';
  const emptyDiv  = filtered.length === 0
    ? `<div class="empty-panel"><div class="emoji">📝</div><p>Aucune note</p></div>` : '';
  list.innerHTML = searchBar + (filtered.length === 0 ? emptyDiv : cards) + addBtn;
}

// ── Toggle preview markdown ───────────────────────────────────────────────────
let _notePreviewMode = false;

function toggleNotePin() {
  _notePinned = !_notePinned;
  const btn = document.getElementById('note-pin-btn');
  if (btn) {
    btn.style.background = _notePinned ? 'var(--orange-l)' : '';
    btn.style.color      = _notePinned ? 'var(--orange)'   : '';
    btn.title = _notePinned
      ? "Désépingler — se fermera en changeant d'onglet"
      : "Épingler — garder visible en changeant d'onglet";
  }
  // Mettre à jour le titre du panel avec l'indicateur pin
  updateDetailPanelTitle();
}

function updateDetailPanelTitle() {
  if (!_editingNote) return;
  document.getElementById('detail-title').innerHTML =
    (_notePinned ? '<span style="font-size:11px;color:var(--orange);">📌</span> ' : '<span style="font-size:13px;">📝</span> ')
    + escapeHtml(_editingNote.title);
}

function toggleNotePreview() {
  _notePreviewMode = !_notePreviewMode;
  const ta   = document.getElementById('note-editor-ta');
  const prev = document.getElementById('note-preview-area');
  const btn  = document.getElementById('note-preview-btn');
  if (!ta || !prev) return;
  if (_notePreviewMode) {
    prev.innerHTML = renderMarkdown(ta.value);
    prev.style.display = 'block';
    ta.style.display   = 'none';
    if (btn) btn.style.background = 'var(--green-l)';
  } else {
    prev.style.display = 'none';
    ta.style.display   = 'block';
    ta.focus();
    if (btn) btn.style.background = '';
  }
}

// ── Renderer markdown ─────────────────────────────────────────────────────────
function renderMarkdown(md) {
  if (!md.trim()) return '<div style="opacity:.4;text-align:center;padding:20px;">Aucun contenu</div>';
  const lines = md.split('\n');
  const out   = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const tr   = line.trim();
    // Séparateur horizontal : --- / *** / ___
    if (/^([-*_]\s*){3,}$/.test(tr)) {
      out.push('<hr style="border:none;border-top:2px solid rgba(0,0,0,.15);margin:16px 0;"/>');
      i++; continue;
    }
    // Tableau : lignes consécutives commençant par |
    if (tr.startsWith('|')) {
      const tLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { tLines.push(lines[i]); i++; }
      out.push(_mdTable(tLines)); continue;
    }
    // Titres
    if (line.startsWith('### ')) { out.push(`<h3 style="font-size:16px;font-weight:800;color:var(--text);margin:10px 0 4px;">${escapeHtml(line.slice(4))}</h3>`); i++; continue; }
    if (line.startsWith('## '))  { out.push(`<h2 style="font-size:19px;font-weight:900;color:var(--text);margin:14px 0 5px;">${escapeHtml(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith('# '))   { out.push(`<h1 style="font-size:22px;font-weight:900;color:var(--purple);margin:16px 0 6px;">${escapeHtml(line.slice(2))}</h1>`); i++; continue; }
    // Liste
    if (tr.startsWith('- ') || tr.startsWith('* '))  { out.push(`<div style="display:flex;gap:8px;margin:2px 0;"><span style="color:var(--purple);">•</span><span>${inlineMd(escapeHtml(tr.slice(2)))}</span></div>`); i++; continue; }
    // Citation
    if (tr.startsWith('> '))  { out.push(`<div style="border-left:3px solid var(--purple);background:var(--purple-l);padding:8px 12px;border-radius:0 8px 8px 0;margin:6px 0;font-style:italic;">${escapeHtml(tr.slice(2))}</div>`); i++; continue; }
    // Ligne vide
    if (!tr) { out.push('<div style="height:8px;"></div>'); i++; continue; }
    // Paragraphe
    out.push(`<div>${inlineMd(escapeHtml(line))}</div>`);
    i++;
  }
  return '<div style="line-height:1.75;font-size:13.5px;">' + out.join('') + '</div>';
}

function _mdTable(lines) {
  const parseRow = l => l.trim().replace(/^\|?|\|?$/g,'').split('|').map(c => c.trim());
  const isSep    = l => /^[\|\-:\s]+$/.test(l.trim());
  if (lines.length < 2 || !isSep(lines[1])) {
    // Pas un vrai tableau, render ligne par ligne
    return lines.map(l => `<div>${inlineMd(escapeHtml(l))}</div>`).join('');
  }
  const headers = parseRow(lines[0]);
  const rows    = lines.slice(2).map(parseRow);
  const thCells = headers.map(h => `<th style="padding:7px 12px;background:var(--surface);font-size:12px;font-weight:900;color:var(--text);text-align:left;border-bottom:2px solid var(--divider);">${escapeHtml(h)}</th>`).join('');
  const dataRows = rows.map(row =>
    `<tr>${row.map((cell,j) => `<td style="padding:6px 12px;font-size:12.5px;border:1px solid var(--divider);color:${j===0?'var(--text)':'var(--text-mid)'};">${inlineMd(escapeHtml(cell))}</td>`).join('')}</tr>`
  ).join('');
  return `<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;background:var(--white);border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.05);border:1px solid var(--divider);">
    <thead><tr>${thCells}</tr></thead>
    <tbody>${dataRows}</tbody>
  </table></div>`;
}

function inlineMd(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>');
}

// ── Create / Rename / Delete ──────────────────────────────────────────────────
async function createNote() {
  document.getElementById('note-dialog-title').textContent = '📝 Nouvelle note';
  document.getElementById('note-dialog-input').value = '';
  document.getElementById('note-dialog-error').textContent = '';
  document.getElementById('note-dialog-submit').onclick = submitCreateNote;
  openModal('modal-note-dialog');
  setTimeout(() => document.getElementById('note-dialog-input').focus(), 100);
}

async function submitCreateNote() {
  const title = document.getElementById('note-dialog-input').value.trim();
  if (!title) { document.getElementById('note-dialog-error').textContent = 'Le titre est obligatoire.'; return; }
  const char = await getCharacter(_notesCharId);
  const notes = getNotes(char);
  const newNote = { id: newNoteId(), title, content: '', createdAt: Date.now(), updatedAt: Date.now() };
  notes.unshift(newNote); // Ajouter en tête comme Android
  await saveNotes(_notesCharId, notes);
  closeModal('modal-note-dialog');
  _editingNote = null;
  await refreshNotesTab();
  openNoteEditor(newNote.id);
}

// Context menu note
let _ctxNoteId = null;
function openNoteContextMenu(e, id) {
  e.stopPropagation();
  _ctxNoteId = id;
  const menu = document.getElementById('note-context-menu');
  getCharacter(_notesCharId).then(char => {
    const n = getNotes(char).find(n => n.id === id);
    const el = document.getElementById('note-ctx-title');
    if (el && n) el.textContent = n.title;
  });
  menu.style.display = 'block';
  let x = e.clientX, y = e.clientY;
  if (x + 230 > window.innerWidth)  x = window.innerWidth  - 234;
  if (y + 100 > window.innerHeight) y = window.innerHeight - 104;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function closeNoteContextMenu() {
  document.getElementById('note-context-menu').style.display = 'none';
  _ctxNoteId = null;
}
function renameNoteFromCtx() {
  const id = _ctxNoteId; closeNoteContextMenu();
  getCharacter(_notesCharId).then(char => {
    const n = getNotes(char).find(n => n.id === id);
    if (!n) return;
    document.getElementById('note-dialog-title').textContent = 'Renommer la note';
    document.getElementById('note-dialog-input').value = n.title;
    document.getElementById('note-dialog-error').textContent = '';
    document.getElementById('note-dialog-submit').onclick = () => submitRenameNote(id);
    openModal('modal-note-dialog');
    setTimeout(() => { const inp = document.getElementById('note-dialog-input'); inp.focus(); inp.select(); }, 100);
  });
}
async function submitRenameNote(id) {
  const title = document.getElementById('note-dialog-input').value.trim();
  if (!title) { document.getElementById('note-dialog-error').textContent = 'Le titre est obligatoire.'; return; }
  const char = await getCharacter(_notesCharId);
  const notes = getNotes(char);
  const idx = notes.findIndex(n => n.id === id);
  if (idx !== -1) { notes[idx].title = title; notes[idx].updatedAt = Date.now(); }
  await saveNotes(_notesCharId, notes);
  closeModal('modal-note-dialog');
  if (_editingNote?.id === id) {
    _editingNote = notes[idx];
    document.getElementById('detail-title').innerHTML = `<span style="font-size:13px;">📝</span> ${escapeHtml(title)}`;
  }
  renderNoteListOnly();
}
async function deleteNoteFromCtx() {
  const id = _ctxNoteId; closeNoteContextMenu();
  const char = await getCharacter(_notesCharId);
  await saveNotes(_notesCharId, getNotes(char).filter(n => n.id !== id));
  if (_editingNote?.id === id) {
    _editingNote = null;
    closeDetail();
  }
  refreshNotesTab();
}

// ═══════════════════════════════════════════════════════════════