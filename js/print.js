// PRINT — Génération PDF fiche personnage — v1.2.0
// ═══════════════════════════════════════════════════════════════

let _printCharId  = null;
let _printNoteIds = new Set();

// ── Ouverture du flow ─────────────────────────────────────────────────────────
async function openPrintFlow(charId) {
  _printCharId  = charId;
  _printNoteIds = new Set();

  const char = await getCharacter(charId);
  if (!char) return;
  const notes = getNotes(char);

  if (notes.length === 0) {
    _generatePDF(char, []);
    return;
  }
  _renderNotePickerModal(char, notes);
  openModal('modal-print-notes');
}

// ── Modal sélection des notes ─────────────────────────────────────────────────
function _renderNotePickerModal(char, notes) {
  const list = document.getElementById('print-notes-list');
  if (!list) return;
  document.getElementById('print-char-name-label').textContent = char.name;
  list.innerHTML = notes.map(n => {
    const dateStr = new Date(n.updatedAt || n.createdAt || Date.now())
      .toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
    const preview = (n.content || '').replace(/[#>\-\*`]/g,'').trim().slice(0, 60);
    return `
      <label class="print-note-row" onclick="_togglePrintNote('${n.id}',this)">
        <div class="print-note-check" id="pnc-${n.id}"></div>
        <div class="print-note-info">
          <div class="print-note-title">${escapeHtml(n.title)}</div>
          ${preview ? `<div class="print-note-preview">${escapeHtml(preview)}${(n.content||'').length > 60 ? '…' : ''}</div>` : ''}
        </div>
        <div class="print-note-date">${dateStr}</div>
      </label>`;
  }).join('');
}

function _togglePrintNote(noteId, row) {
  const check = document.getElementById('pnc-' + noteId);
  if (_printNoteIds.has(noteId)) {
    _printNoteIds.delete(noteId);
    check.classList.remove('checked');
    row.classList.remove('selected');
  } else {
    _printNoteIds.add(noteId);
    check.classList.add('checked');
    row.classList.add('selected');
  }
  const btn = document.getElementById('print-confirm-btn');
  if (btn) btn.textContent = _printNoteIds.size > 0
    ? `🖨️ Générer avec ${_printNoteIds.size} note${_printNoteIds.size > 1 ? 's' : ''}`
    : '🖨️ Générer sans notes';
}

function selectAllPrintNotes() {
  document.querySelectorAll('#print-notes-list .print-note-row').forEach(row => {
    const noteId = row.querySelector('[id^="pnc-"]')?.id.replace('pnc-', '');
    if (noteId && !_printNoteIds.has(noteId)) _togglePrintNote(noteId, row);
  });
}

async function confirmPrint() {
  closeModal('modal-print-notes');
  const char = await getCharacter(_printCharId);
  if (!char) return;
  const notes = getNotes(char).filter(n => _printNoteIds.has(n.id));
  _generatePDF(char, notes);
}

// ── Génération HTML → nouvelle fenêtre ───────────────────────────────────────
function _generatePDF(char, selectedNotes) {
  const sections  = getStatSections(char);
  const abilities = getAbilities(char);
  const items     = getItems(char);
  const hpPct     = char.hpMax > 0 ? Math.round(char.hpCurrent / char.hpMax * 100) : 0;
  const today     = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const avatarColor = getAvatarColor(char.id);
  const safeName  = escapeHtml(char.name);

  // Avatar : photo base64 ou lettre colorée
  const avatarHtml = char.profilePhoto
    ? `<div class="av" style="background:${avatarColor};padding:0;overflow:hidden;">
         <img src="${char.profilePhoto}" style="width:100%;height:100%;object-fit:cover;display:block;"/>
       </div>`
    : `<div class="av" style="background:${avatarColor};">${getInitial(char.name)}</div>`;

  // ── Mana / Slots ──
  const isSlots    = char.manaMode === 'SPELL_SLOTS';
  const activeSlots = isSlots
    ? (char.spellSlots || []).filter(s => s.max > 0)
    : [];
  const manaPct    = char.manaMax > 0 ? Math.round(char.manaCurrent / char.manaMax * 100) : 0;

  // Ligne mana dans le header
  let manaHeaderHtml = '';
  if (isSlots && activeSlots.length > 0) {
    const totalSlots   = activeSlots.reduce((a,s) => a + s.max, 0);
    const currentSlots = activeSlots.reduce((a,s) => a + s.current, 0);
    const pills = activeSlots.map(s => {
      const dep = s.current === 0;
      return `<span style="min-width:18px;height:18px;padding:0 4px;border-radius:99px;
        background:${dep ? 'transparent' : '#A78BFA'};
        border:${dep ? '1.5px solid #A78BFA' : 'none'};
        color:${dep ? '#A78BFA' : 'white'};
        font-size:9px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;
        opacity:${dep ? '.5' : '1'};">${s.current}</span>`;
    }).join('');
    manaHeaderHtml = `<div class="v-row">
      <span class="v-ico">📖</span>
      <div style="display:flex;gap:3px;align-items:center;flex:1;flex-wrap:wrap;">${pills}</div>
      <span style="font-size:9.5px;font-weight:800;color:#C8A8F8;white-space:nowrap;">${currentSlots}/${totalSlots}</span>
    </div>`;
  } else if (!isSlots && char.manaMax > 0) {
    manaHeaderHtml = `<div class="v-row">
      <span class="v-ico">💧</span>
      <div class="v-wrap">
        <div class="v-lbl">MANA</div>
        <div class="v-track"><div class="v-fill" style="width:${manaPct}%;background:var(--blue);"></div></div>
      </div>
      <span class="v-val" style="color:#8BB8F8;">${char.manaCurrent}/${char.manaMax}</span>
    </div>`;
  }

  // ── Meta badge mana/slots ──
  let manaMetaBadge = '';
  if (isSlots && activeSlots.length > 0) {
    const cur = activeSlots.reduce((a,s) => a + s.current, 0);
    const max = activeSlots.reduce((a,s) => a + s.max, 0);
    manaMetaBadge = `<span class="meta-badge">📖 ${cur} / ${max} sorts</span>`;
  } else if (!isSlots && char.manaMax > 0) {
    manaMetaBadge = `<span class="meta-badge">💧 ${char.manaCurrent} / ${char.manaMax} MP</span>`;
  }

  // ── Crédits selon currencyMode ──
  let creditsMetaBadge = '';
  if (char.credits > 0) {
    const mode = char.currencyMode || 'SINGLE';
    if (mode === 'SINGLE') {
      creditsMetaBadge = `<span class="meta-badge">💰 ${char.credits} crédits</span>`;
    } else {
      const d = getCurrencyDisplay(char.credits, mode);
      creditsMetaBadge = `<span class="meta-badge">🥇 ${d.gold} OR · ${d.silver} ARG · ${d.copper} CUI</span>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Fiche — ${safeName}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--green:#5CC8A8;--green-d:#3DAF8E;--green-l:#D4F2EA;--blue:#5B9CF6;--blue-l:#DDEAFF;--red:#FF6B6B;--red-l:#FFE0E0;--purple:#A78BFA;--purple-l:#EDE9FF;--orange:#FF8C42;--orange-l:#FFEDE0;--yellow:#FFD166;--yellow-l:#FFF3CC;--text:#2C3E50;--text-mid:#6B7C8E;--text-light:#A8B8C8;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',sans-serif;background:#C8D8D4;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 20px 60px;gap:20px;}
#sheet-wrapper{display:flex;flex-direction:column;gap:20px;width:794px;}
/* A4 = 794 × 1123px à 96dpi */
:root{--a4-w:794px;--a4-h:1123px;}
.no-print{display:flex;gap:8px;align-items:center;background:white;padding:10px 20px;border-radius:99px;box-shadow:0 4px 20px rgba(0,0,0,.12);font-size:13px;font-weight:800;color:var(--text);flex-wrap:wrap;justify-content:center;width:794px;}
.btn-dl{padding:8px 18px;border-radius:99px;border:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;background:var(--green);color:white;transition:background .15s;}
.btn-dl:hover{background:var(--green-d);}
.btn-dl:disabled{opacity:.6;cursor:wait;}
.btn-print{padding:8px 18px;border-radius:99px;border:1.5px solid #DDE2E6;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;background:white;color:var(--text-mid);}
.btn-print:hover{background:#F5F7F8;}
.dl-hint{font-size:11px;color:var(--text-light);font-weight:700;}
/* Conteneur des pages générées */
#sheet{ display:flex; flex-direction:column; gap:20px; }
/* Pages générées dynamiquement par paginateSheet() */
.page{
  width:794px;
  min-height:1123px;
  background:white;
  position:relative;
  box-shadow:0 8px 40px rgba(0,0,0,.18);
}

.page-footer-stamp{
  position:absolute;
  bottom:0; left:0; right:0;
  padding:9px 36px;
  border-top:1px solid #EEF2F5;
  display:flex; justify-content:space-between;
  background:#FAFCFB;
  font-size:8.5px; font-weight:700; color:var(--text-light);
  font-family:'Nunito',sans-serif;
}
.hdr{padding:26px 36px 20px;background:linear-gradient(135deg,#2C3E50,#3D5166);display:flex;align-items:center;gap:20px;position:relative;overflow:hidden;width:100%;}
.hdr::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(92,200,168,.07);}
.av{width:68px;height:68px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:white;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,.3);}
.hdr-info{flex:1;}
.char-name{font-size:24px;font-weight:900;color:white;margin-bottom:5px;letter-spacing:-.2px;}
.meta-row{display:flex;gap:6px;flex-wrap:wrap;}
.meta-badge{padding:2px 9px;border-radius:99px;font-size:10px;font-weight:800;background:rgba(255,255,255,.12);color:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.15);}
.hdr-vitals{display:flex;flex-direction:column;gap:7px;min-width:155px;}
.v-row{display:flex;align-items:center;gap:7px;}
.v-ico{font-size:12px;width:16px;flex-shrink:0;}
.v-wrap{flex:1;}
.v-lbl{font-size:8px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:.8px;margin-bottom:2px;}
.v-track{height:6px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden;}
.v-fill{height:100%;border-radius:99px;}
.v-val{font-size:9.5px;font-weight:800;white-space:nowrap;min-width:34px;text-align:right;}
.hdr-logo{position:absolute;top:14px;right:18px;font-size:9px;font-weight:800;color:rgba(255,255,255,.25);letter-spacing:2px;}
.body{padding:22px 36px 28px;display:flex;flex-direction:column;gap:20px;}
.sec-title{font-size:8.5px;font-weight:900;color:var(--text-light);letter-spacing:1.8px;text-transform:uppercase;margin-bottom:9px;display:flex;align-items:center;gap:8px;}
.sec-title::after{content:'';flex:1;height:1px;background:#EEF2F5;}
.stats-grid{display:grid;gap:7px;}
.stat-cell{border-radius:9px;padding:9px 5px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;}
.stat-lbl{font-size:7.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:var(--text-light);}
.stat-val{font-size:20px;font-weight:900;color:var(--text);line-height:1;}
.stat-mod{font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;}
.ab-list{display:flex;flex-direction:column;gap:5px;}
.ab-item{display:flex;align-items:flex-start;gap:9px;padding:8px 11px;border-radius:9px;background:#F8FBFA;border:1px solid #EEF2F5;position:relative;overflow:hidden;}
.ab-bar{position:absolute;left:0;top:0;bottom:0;width:3px;}
.ab-name{font-size:11.5px;font-weight:800;color:var(--text);}
.ab-badges{display:flex;gap:3px;flex-wrap:wrap;margin-top:2px;}
.ab-badge{font-size:8.5px;font-weight:800;padding:1px 6px;border-radius:99px;}
.ab-desc{font-size:10px;color:var(--text-mid);margin-top:3px;line-height:1.5;}
.inv-table{width:100%;border-collapse:collapse;}
.inv-table th{font-size:8px;font-weight:900;color:var(--text-light);letter-spacing:1px;text-align:left;padding:4px 7px;border-bottom:1.5px solid #EEF2F5;}
.inv-table td{font-size:10.5px;font-weight:700;color:var(--text);padding:6px 7px;border-bottom:1px solid #F5F7F8;}
.inv-table tr:last-child td{border-bottom:none;}
.inv-badge{font-size:8px;font-weight:800;padding:1px 5px;border-radius:99px;display:inline-block;}
.note-block{background:#F8FBFA;border:1px solid #EEF2F5;border-radius:9px;padding:11px 13px;}
.note-block-title{font-size:10.5px;font-weight:800;color:var(--text);margin-bottom:5px;display:flex;align-items:center;gap:6px;}
.note-content{font-size:10.5px;color:var(--text-mid);line-height:1.7;font-weight:600;white-space:pre-wrap;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
/* footer géré via .page-footer-stamp injecté dynamiquement */
@media print{
  body{background:white;padding:0;}
  .no-print{display:none;}
  #sheet-wrapper{gap:0;}
  .page{
    width:100%;height:100vh;
    box-shadow:none;
    page-break-after:always;
    break-after:page;
    margin:0!important;
    border-radius:0!important;
  }
}
</style>
</head>
<body>
<div class="no-print">
  <span>📄 ${safeName}</span>
  <button class="btn-dl" id="btn-dl" onclick="downloadPDF()">⬇️ Télécharger PDF</button>
  <button class="btn-print" onclick="window.print()">🖨️ Imprimer</button>
  <span class="dl-hint">Si le téléchargement échoue, utilise Imprimer → Enregistrer en PDF</span>
</div>
<div id="sheet-source" style="width:794px;background:white;position:fixed;left:-9999px;top:0;z-index:-1;">
  <div class="hdr">
    ${avatarHtml}
    <div class="hdr-info">
      <div class="char-name">${safeName}</div>
      <div class="meta-row">
        <span class="meta-badge">❤️ ${char.hpCurrent} / ${char.hpMax} PV</span>
        ${manaMetaBadge}
        ${creditsMetaBadge}
      </div>
    </div>
    <div class="hdr-vitals">
      <div class="v-row">
        <span class="v-ico">❤️</span>
        <div class="v-wrap">
          <div class="v-lbl">POINTS DE VIE</div>
          <div class="v-track"><div class="v-fill" style="width:${hpPct}%;background:var(--red);"></div></div>
        </div>
        <span class="v-val" style="color:#FF9999;">${char.hpCurrent}/${char.hpMax}</span>
      </div>
      ${manaHeaderHtml}
    </div>
    <div class="hdr-logo">LOGRPG</div>
  </div>
  <div class="body" id="sheet-body">
    ${_buildStatsSections(sections)}
    ${abilities.length > 0 ? _buildAbilities(abilities) : ''}
    ${_buildInventaireAndNotes(items, selectedNotes)}
  </div>
</div><!-- /sheet-source -->
<div id="sheet-wrapper"><div id="sheet"></div></div><!-- pages injectées ici -->

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
// Paginer dès que la police est chargée et le DOM rendu
document.fonts.ready.then(() => requestAnimationFrame(paginateSheet));
</script>
<script>
// ── Pagination : découpe le contenu en pages A4 ─────────────────────────────
const A4_H   = 1123; // px à 96dpi
const FOOTER_H = 32; // hauteur du footer en px
const USABLE_H = A4_H - FOOTER_H; // zone utile par page

function paginateSheet() {
  const source  = document.getElementById('sheet-source');
  const target  = document.getElementById('sheet');
  const hdr     = source.querySelector('.hdr');
  const body    = document.getElementById('sheet-body');
  const today   = document.querySelector('.no-print span').textContent.replace('📄 ', '');
  const charName = document.title.replace('Fiche — ', '');
  target.innerHTML = '';

  // ── Page 1 : header directement dans la page (hors du body paddé) ──
  let pageEl   = _newPage();
  let pageH    = 0;
  let pageBody = _newPageBody(pageEl);

  // Header cloné directement dans pageEl AVANT le body paddé
  const hdrClone = hdr.cloneNode(true);
  hdrClone.style.cssText = 'width:100%;flex-shrink:0;';
  pageEl.insertBefore(hdrClone, pageBody);
  pageH += hdrClone.offsetHeight;

  // Parcourir les enfants du body source
  const children = Array.from(body.children);
  for (const child of children) {
    const childH = child.offsetHeight + 20; // 20 = gap
    if (pageH + childH > USABLE_H && pageH > 0) {
      // Ne tient plus → finaliser cette page, créer la suivante
      _stampFooter(pageEl, charName, target.querySelectorAll('.page').length + 1);
      target.appendChild(pageEl);
      pageEl   = _newPage();
      pageH    = 0;
      pageBody = _newPageBody(pageEl);
    }
    const clone = child.cloneNode(true);
    pageBody.appendChild(clone);
    pageH += childH;
  }

  // Finaliser la dernière page
  _stampFooter(pageEl, charName, target.querySelectorAll('.page').length + 1);
  target.appendChild(pageEl);

  // Supprimer la source hors écran
  source.style.display = 'none';
}

function _newPage() {
  const p = document.createElement('div');
  p.className = 'page';
  p.style.cssText = 'position:relative;display:flex;flex-direction:column;background:white;width:794px;min-height:1123px;';
  return p;
}

function _newPageBody(pageEl) {
  const b = document.createElement('div');
  b.className = 'body';
  b.style.flex = '1';
  pageEl.appendChild(b);
  return b;
}

function _stampFooter(pageEl, charName, pageNum) {
  const f = document.createElement('div');
  f.className = 'page-footer-stamp';
  f.innerHTML = \`<span>LogRPG · p.\${pageNum}</span><span>\${charName}</span>\`;
  pageEl.appendChild(f);
}

async function downloadPDF() {
  const btn = document.getElementById('btn-dl');
  btn.disabled = true;
  btn.textContent = '⏳ Génération…';
  try {
    const { jsPDF } = window.jspdf;
    const pdf  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const pages = document.querySelectorAll('#sheet .page');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width:  794,
        height: A4_H,
        windowWidth: 794,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.93);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    }
    pdf.save('${safeName.replace(/[^a-zA-Z0-9_\-]/g, '_')}_fiche.pdf');
  } catch(e) {
    alert('Erreur lors de la génération. Utilise le bouton Imprimer → Enregistrer en PDF.');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇️ Télécharger PDF';
  }
}
</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('⚠️ Autorisez les popups pour générer le PDF'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Builders HTML ─────────────────────────────────────────────────────────────
function _accentForColor(color) {
  const MAP = {
    PURPLE:{ main:'#A78BFA', light:'#EDE9FF' },
    BLUE:  { main:'#5B9CF6', light:'#DDEAFF' },
    RED:   { main:'#FF6B6B', light:'#FFE0E0' },
    GREEN: { main:'#5CC8A8', light:'#D4F2EA' },
    ORANGE:{ main:'#FF8C42', light:'#FFEDE0' },
    YELLOW:{ main:'#FFD166', light:'#FFF3CC' },
  };
  return MAP[color] || MAP.PURPLE;
}

function _abilityAccentColor(category) {
  if (!category) return { main:'#A78BFA', light:'#EDE9FF' };
  const c = category.toLowerCase();
  if (c.includes('combat'))  return { main:'#FF6B6B', light:'#FFE0E0' };
  if (c.includes('magie'))   return { main:'#5B9CF6', light:'#DDEAFF' };
  if (c.includes('social'))  return { main:'#FFD166', light:'#FFF3CC' };
  if (c.includes('passif'))  return { main:'#5CC8A8', light:'#D4F2EA' };
  return { main:'#A78BFA', light:'#EDE9FF' };
}

function _buildStatsSections(sections) {
  if (!sections.length) return '';
  return sections.map(s => {
    const widgets = s.widgets || [];
    if (!widgets.length) return '';
    const cols  = Math.min(widgets.length, 6);
    const cells = widgets.map(w => {
      const a = _accentForColor(w.accentColor);
      let valueHtml = '';
      if (w.type === 'CAR_MOD') {
        const big   = w.modFirst ? (w.modifier || '—') : (w.value || '—');
        const small = w.modFirst ? (w.value    || '')  : (w.modifier || '');
        valueHtml   = `<div class="stat-val">${escapeHtml(big)}</div>`
          + (small ? `<div class="stat-mod" style="background:${a.light};color:${a.main};">${escapeHtml(small)}</div>` : '');
      } else if (w.type === 'PERCENT') {
        valueHtml = `<div class="stat-val" style="font-size:16px;">${w.value || '0'}%</div>`;
      } else if (w.type === 'SWITCH') {
        const on  = w.value === 'true';
        valueHtml = `<div style="font-size:11px;font-weight:800;color:${on ? a.main : 'var(--text-light)'};">${on ? '● Actif' : '○ Inactif'}</div>`;
      } else {
        valueHtml = `<div class="stat-val">${escapeHtml(w.value || '—')}</div>`;
      }
      return `<div class="stat-cell" style="background:${a.light}22;border:1.5px solid ${a.main}40;">
        <div class="stat-lbl">${escapeHtml(w.title)}</div>${valueHtml}
      </div>`;
    }).join('');
    return `<div>
      <div class="sec-title">${escapeHtml(s.title)}</div>
      <div class="stats-grid" style="grid-template-columns:repeat(${cols},1fr);">${cells}</div>
    </div>`;
  }).join('');
}

function _buildAbilities(abilities) {
  const cards = abilities.map(a => {
    const accent  = _abilityAccentColor(a.category);
    const badges  = [
      a.category ? `<span class="ab-badge" style="background:${accent.light};color:${accent.main};">${escapeHtml(a.category)}</span>` : '',
      a.cost     ? `<span class="ab-badge" style="background:var(--orange-l);color:var(--orange);">${escapeHtml(a.cost)}</span>`      : '',
      a.range    ? `<span class="ab-badge" style="background:#F0F3F2;color:var(--text-mid);">🎯 ${escapeHtml(a.range)}</span>`          : '',
      a.damage   ? `<span class="ab-badge" style="background:#F0F3F2;color:var(--text-mid);">⚔️ ${escapeHtml(a.damage)}</span>`         : '',
    ].filter(Boolean).join('');
    return `<div class="ab-item">
      <div class="ab-bar" style="background:${accent.main};"></div>
      <div style="padding-left:5px;flex:1;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="ab-name">${escapeHtml(a.name)}</div>
          <div class="ab-badges">${badges}</div>
        </div>
        ${a.description ? `<div class="ab-desc">${escapeHtml(a.description)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<div><div class="sec-title">✨ Capacités</div><div class="ab-list">${cards}</div></div>`;
}

function _buildInventaireAndNotes(items, notes) {
  const invHtml = items.length === 0 ? '' : `
    <div>
      <div class="sec-title">🎒 Inventaire</div>
      <table class="inv-table">
        <thead><tr><th>Objet</th><th>Qté</th><th>Type</th><th>Notes</th></tr></thead>
        <tbody>${items.map(i => {
          const badge = i.isEquipped
            ? `<span class="inv-badge" style="background:var(--green-l);color:var(--green-d);">Équipé</span>`
            : i.isConsumable
            ? `<span class="inv-badge" style="background:var(--red-l);color:var(--red);">Consomm.</span>`
            : `<span class="inv-badge" style="background:#F0F3F2;color:var(--text-mid);">Objet</span>`;
          return `<tr>
            <td><strong>${escapeHtml(i.name)}</strong>${i.description
              ? `<br><span style="font-size:9.5px;color:var(--text-mid);">${escapeHtml(i.description.slice(0,60))}${i.description.length>60?'…':''}</span>`
              : ''}</td>
            <td style="text-align:center;">${i.quantity || 1}</td>
            <td>${badge}</td>
            <td style="font-size:9.5px;color:var(--text-mid);">${escapeHtml(i.notes || '')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  if (notes.length === 0) return invHtml;

  const notesHtml = `<div>
    <div class="sec-title">📝 Notes</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${notes.map(n => `
        <div class="note-block">
          <div class="note-block-title">
            <span>📄</span>${escapeHtml(n.title)}
            <span style="font-size:9px;color:var(--text-light);font-weight:700;margin-left:auto;">
              ${new Date(n.updatedAt || n.createdAt || Date.now()).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <div class="note-content">${escapeHtml(n.content || '').slice(0, 800)}${(n.content||'').length > 800 ? '\n…(tronqué)' : ''}</div>
        </div>`).join('')}
    </div>
  </div>`;

  if (items.length > 0 && items.length <= 8 && notes.length <= 2) {
    return `<div class="two-col">${invHtml}${notesHtml}</div>`;
  }
  return invHtml + notesHtml;
}

// ═══════════════════════════════════════════════════════════════