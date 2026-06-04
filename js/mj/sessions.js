// MJ — SESSIONS (modèle dossier/documents)
// ═══════════════════════════════════════════════════════════════
// Session = dossier { id, title, date, docs:[{id,title,content}] }

let _mjSession    = null;  // session (dossier) sélectionnée
let _mjSessionDoc = null;  // document sélectionné dans la session
let _mjDocSaveTimer = null;
let _mjDocPreview      = false;
let _mjSessionListOpen = true;  // volet sessions ouvert/fermé
let _mjDocListOpen     = true;  // volet documents ouvert/fermé

function _newDocId() { return 'doc_' + Math.random().toString(36).slice(2, 9); }

// ── Liste des sessions ────────────────────────────────────────
async function mjRenderSessionsList() {
  const sessions = await mjGetSessions();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = sessions.length === 0
    ? `<div class="mj-empty">📁<br>Aucune session.<br>Crée la première !</div>`
    : sessions.map(s => {
        const nbDocs = (s.docs || []).length;
        return `
          <div class="mj-item-card ${_mjSession?.id === s.id ? 'active' : ''}"
               onclick="mjSelectSession(${s.id})">
            <div class="mj-item-name" style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:14px;">📁</span>
              ${escapeHtml(s.title || 'Sans titre')}
            </div>
            <div class="mj-item-sub">
              ${s.date ? `<span>${new Date(s.date).toLocaleDateString('fr-FR')}</span>` : ''}
              <span>${nbDocs} document${nbDocs !== 1 ? 's' : ''}</span>
            </div>
          </div>`;
      }).join('');
}

async function mjSelectSession(id) {
  _mjSession    = await mjGetSession(id);
  _mjSessionDoc = (_mjSession.docs || [])[0] || null;
  _mjDocPreview = !!(_mjSessionDoc?.content?.trim());
  // Mettre à jour la liste (sélection visuelle) + afficher le détail
  await mjRenderSessionsList();
  mjRenderSessionDetail();
}

// ── Détail : layout dossier ───────────────────────────────────
function mjRenderSessionDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjSession) {
    detail.innerHTML = `<div class="mj-detail-empty">📁<br>Sélectionne ou crée une session</div>`;
    return;
  }

  const s    = _mjSession;
  const docs = s.docs || [];

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

  // Liste de documents (colonne gauche du détail)
  const docListItems = docs.map(d => `
    <div class="mj-doc-item ${_mjSessionDoc?.id === d.id ? 'active' : ''}"
         onclick="mjSelectDoc('${d.id}')">
      <span style="font-size:12px;">📄</span>
      <span class="mj-doc-title">${escapeHtml(d.title || 'Sans titre')}</span>
    </div>`).join('');

  const docList = _mjDocListOpen ? `
    <div class="mj-doc-list">
      <div class="mj-doc-list-hdr">
        <span class="sec-lbl" style="margin:0;">DOCUMENTS</span>
        <button class="mj-add-pill" onclick="mjAddDoc()">＋</button>
      </div>
      ${docListItems || `<div class="mj-empty-sm">Aucun document.<br>Clique + pour créer.</div>`}
    </div>` : '';

  // Éditeur (colonne droite)
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
          ? `<div style="flex:1;overflow-y:auto;border:1.5px solid var(--divider);border-radius:12px;
              padding:14px 18px;background:var(--white);">${renderMarkdown(_mjSessionDoc.content || '')}</div>`
          : `<textarea id="mj-doc-content"
              style="width:100%;flex:1;min-height:calc(100vh - 300px);border:1.5px solid var(--divider);
              border-radius:12px;padding:14px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;
              color:var(--text);line-height:1.7;resize:none;background:var(--white);outline:none;box-sizing:border-box;"
              placeholder="Accroche, lieux, événements, dialogues importants… (supporte le Markdown)"
              oninput="_mjDocChanged()">${escapeHtml(_mjSessionDoc.content || '')}</textarea>`}
      </div>`
    : `<div class="mj-doc-editor" style="display:flex;align-items:center;justify-content:center;">
        <div class="mj-empty-sm">📄 Sélectionne ou crée un document</div>
      </div>`;

  const docToggle = `<button id="mj-doc-toggle" onclick="mjToggleDocList()"
    title="${_mjDocListOpen?'Réduire':'Agrandir'}"
    style="width:18px;flex-shrink:0;background:var(--surface);border:none;
    border-right:1px solid rgba(0,0,0,.06);border-left:1px solid rgba(0,0,0,.06);
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    font-size:9px;color:var(--text-light);transition:background .15s;"
    onmouseenter="this.style.background='var(--divider)'"
    onmouseleave="this.style.background='var(--surface)'">
    ${_mjDocListOpen?'◀':'▶'}</button>`;
  detail.innerHTML = hdr + `<div class="mj-session-body">${docList}${docToggle}${editor}</div>`;

}

// ── Actions ───────────────────────────────────────────────────
async function mjSessionSaveField(field, value) {
  if (!_mjSession) return;
  _mjSession[field] = value;
  await mjSaveSession(_mjSession);
  await mjRenderSessionsList();
}

function mjSelectDoc(docId) {
  const docs = _mjSession?.docs || [];
  _mjSessionDoc = docs.find(d => d.id === docId) || null;
  // Aperçu par défaut si le document a du contenu
  _mjDocPreview = !!(_mjSessionDoc?.content?.trim());
  mjRenderSessionDetail();
}

async function mjAddDoc() {
  if (!_mjSession) return;
  if (!_mjSession.docs) _mjSession.docs = [];
  const doc = { id: _newDocId(), title: 'Nouveau document', content: '' };
  _mjSession.docs.push(doc);
  _mjSessionDoc = doc;
  await mjSaveSession(_mjSession);
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-doc-title')?.focus(), 80);
}

async function mjDeleteDoc(docId) {
  if (!_mjSession || !confirm('Supprimer ce document ?')) return;
  _mjSession.docs = (_mjSession.docs || []).filter(d => d.id !== docId);
  _mjSessionDoc = _mjSession.docs[0] || null;
  await mjSaveSession(_mjSession);
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
}

async function mjNewSession() {
  const id = await mjSaveSession({
    title: 'Session ' + (new Date().toLocaleDateString('fr-FR')),
    date: new Date().toISOString().slice(0, 10),
    docs: [{ id: _newDocId(), title: 'Scénario', content: '' }],
  });
  _mjSession = await mjGetSession(id);
  _mjSessionDoc = _mjSession.docs[0];
  await mjRenderSessionsList();
  mjRenderSessionDetail();
  setTimeout(() => document.getElementById('mj-session-title')?.focus(), 80);
}

async function mjDeleteSessionConfirm(id) {
  if (!confirm('Supprimer cette session et tous ses documents ?')) return;
  await mjDeleteSession(id);
  _mjSession = null; _mjSessionDoc = null;
  await mjRenderSessionsList();
  mjRenderSessionDetail();
}

function mjToggleDocList() {
  _mjDocListOpen = !_mjDocListOpen;
  const panel = document.querySelector('.mj-doc-list');
  if (panel) {
    panel.style.width    = _mjDocListOpen ? '220px' : '0px';
    panel.style.minWidth = _mjDocListOpen ? '220px' : '0px';
  }
  const btn = document.getElementById('mj-doc-toggle');
  if (btn) btn.textContent = _mjDocListOpen ? '◀' : '▶';
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


function mjDocTogglePreview() {
  if (!_mjDocPreview) {
    // Sauvegarder avant d'afficher l'aperçu
    const titleEl   = document.getElementById('mj-doc-title');
    const contentEl = document.getElementById('mj-doc-content');
    if (_mjSessionDoc && contentEl) {
      _mjSessionDoc.title   = titleEl?.value.trim() || 'Sans titre';
      _mjSessionDoc.content = contentEl.value;
      const idx = (_mjSession.docs||[]).findIndex(d=>d.id===_mjSessionDoc.id);
      if (idx !== -1) _mjSession.docs[idx] = {..._mjSessionDoc};
      mjSaveSession(_mjSession);
    }
  }
  _mjDocPreview = !_mjDocPreview;
  mjRenderSessionDetail();
}