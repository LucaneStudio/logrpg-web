// MJ — SESSIONS (modèle dossier/documents)
// ═══════════════════════════════════════════════════════════════
// Session = dossier { id, title, date, docs:[{id,title,content}] }

let _mjSession    = null;  // session (dossier) sélectionnée
let _mjSessionDoc = null;  // document sélectionné dans la session
let _mjDocSaveTimer = null;
let _mjDocPreview      = false;
let _mjSessionListOpen = true;        // volet arborescence ouvert/fermé
let _mjExpanded        = new Set();   // ids des sessions dépliées dans l'arbre

function _newDocId() { return 'doc_' + Math.random().toString(36).slice(2, 9); }

// Rendu Markdown + transformation des @tags en liens et des widgets /switch…
function _mjMarkdownWithTags(content) {
  let html = renderMarkdown(content || '');
  if (typeof mjLinkifyTags    === 'function') html = mjLinkifyTags(html);
  if (typeof mjLinkifyWidgets === 'function') html = mjLinkifyWidgets(html);
  return html;
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
      <div class="mj-tree-folder ${activeSess ? 'active' : ''}" onclick="mjSelectSession(${s.id})">
        <span class="mj-tree-chevron">${expanded ? '▾' : '▸'}</span>
        <span class="mj-tree-ico">📁</span>
        <span class="mj-tree-label">${escapeHtml(s.title || 'Sans titre')}</span>
        <span class="mj-tree-count">${docs.length}</span>
      </div>`;

    let children = '';
    if (expanded) {
      const docNodes = docs.map(d => `
        <div class="mj-tree-doc ${(activeSess && _mjSessionDoc?.id === d.id) ? 'active' : ''}"
             onclick="event.stopPropagation();mjSelectDocFromTree(${s.id},'${d.id}')">
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
  _mjDocPreview = false;
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
          <button onclick="mjDocTogglePreview()"
            style="flex-shrink:0;padding:5px 10px;border-radius:8px;background:${_mjDocPreview?'var(--purple-l)':'var(--surface)'};
            border:1.5px solid ${_mjDocPreview?'rgba(167,139,250,.4)':'var(--divider)'};
            font-family:'Nunito',sans-serif;font-size:11px;font-weight:900;
            color:${_mjDocPreview?'var(--purple)':'var(--text-light)'};cursor:pointer;">
            ${_mjDocPreview ? '✏️ Modifier' : '👁 Aperçu'}</button>
          <button class="mj-btn-sm-danger" onclick="mjDeleteDoc('${_mjSessionDoc.id}')" title="Supprimer">×</button>
        </div>
        ${_mjDocPreview
          ? `<div id="mj-doc-preview-scroll" style="flex:1;overflow-y:auto;border:1.5px solid var(--divider);border-radius:12px;
              padding:14px 18px;background:var(--white);">${_mjMarkdownWithTags(_mjSessionDoc.content || '')}</div>`
          : `<textarea id="mj-doc-content"
              style="width:100%;flex:1;min-height:calc(100vh - 300px);border:1.5px solid var(--divider);
              border-radius:12px;padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;
              color:var(--text);line-height:1.7;resize:none;background:var(--white);outline:none;box-sizing:border-box;"
              placeholder="Accroche, lieux, événements, dialogues importants… (@ pour lier une ressource, supporte le Markdown)"
              oninput="_mjDocChanged();mjAcUpdate()"
              onkeydown="mjAcKeydown(event)"
              onkeyup="mjAcKeyup(event)"
              onclick="mjAcUpdate()"
              onblur="mjAcBlur()">${escapeHtml(_mjSessionDoc.content || '')}</textarea>`}
      </div>`
    : `<div class="mj-doc-editor" style="display:flex;align-items:center;justify-content:center;">
        <div class="mj-empty-sm">📄 Sélectionne ou crée un document<br>dans l'arborescence à gauche</div>
      </div>`;

  detail.innerHTML = hdr + `<div class="mj-session-body">${editor}</div>`;
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
  _mjDocPreview = !!(_mjSessionDoc?.content?.trim());
  if (_mjDocPreview && typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
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
  _mjDocPreview = false;
  _mjExpanded.add(sessionId);
  await mjSaveSession(_mjSession);
  await mjRenderSessionsList();
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-doc-title')?.focus(), 80);
}

async function mjDeleteDoc(docId) {
  if (!_mjSession || !confirm('Supprimer ce document ?')) return;
  _mjSession.docs = (_mjSession.docs || []).filter(d => d.id !== docId);
  _mjSessionDoc = _mjSession.docs[0] || null;
  _mjDocPreview = !!(_mjSessionDoc?.content?.trim());
  await mjSaveSession(_mjSession);
  await mjRenderSessionsList();
  mjRenderSessionDetail();
}

function _mjDocChanged() {
  const ind = document.getElementById('mj-doc-save-ind');
  if (ind) ind.textContent = '●';
  clearTimeout(_mjDocSaveTimer);
  _mjDocSaveTimer = setTimeout(_mjDocSaveNow, 1000);
}

async function _mjDocSaveNow() {
  if (!_mjSession || !_mjSessionDoc) return;
  const titleEl   = document.getElementById('mj-doc-title');
  const contentEl = document.getElementById('mj-doc-content');
  _mjSessionDoc.title   = titleEl?.value.trim()  || 'Sans titre';
  _mjSessionDoc.content = contentEl?.value        || '';
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
  _mjDocPreview = false;
  _mjExpanded.add(id);
  await mjRenderSessionsList();
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-session-title')?.focus(), 80);
}

async function mjDeleteSessionConfirm(id) {
  if (!confirm('Supprimer cette session et tous ses documents ?')) return;
  await mjDeleteSession(id);
  _mjExpanded.delete(id);
  _mjSession = null; _mjSessionDoc = null;
  await mjRenderSessionsList();
  mjRenderSessionDetail();
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
  _mjDocPreview = false;
  _mjSessionListOpen = true;
  // Restaurer la liste sans toucher au shell
  const panel = document.getElementById('mj-list');
  if (panel) { panel.style.width = ''; panel.style.minWidth = ''; }
  const btn = document.getElementById('mj-sessions-toggle');
  if (btn) btn.textContent = '◀';
  mjRenderSessionsList();
  mjRenderSessionDetail();
}


async function mjDocTogglePreview() {
  if (!_mjDocPreview) {
    // Sauvegarder avant d'afficher l'aperçu
    const titleEl   = document.getElementById('mj-doc-title');
    const contentEl = document.getElementById('mj-doc-content');
    if (_mjSessionDoc && contentEl) {
      _mjSessionDoc.title   = titleEl?.value.trim() || 'Sans titre';
      _mjSessionDoc.content = contentEl.value;
      const idx = (_mjSession.docs||[]).findIndex(d=>d.id===_mjSessionDoc.id);
      if (idx !== -1) _mjSession.docs[idx] = {..._mjSessionDoc};
      await mjSaveSession(_mjSession);
    }
    // Index frais pour résoudre les @tags à l'affichage
    if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  }
  _mjDocPreview = !_mjDocPreview;
  mjRenderSessionDetail();
}