// ═══════════════════════════════════════════════════════════════
// À PROPOS — release note, patchnotes, bugs connus, retours, données
// ═══════════════════════════════════════════════════════════════

// ── Caches mémoire ────────────────────────────────────────────
let _aproposChangelogCache = null;   // versions parsées du CHANGELOG
let _aproposKbCache         = null;   // bugs connus (known-bugs.json)

// ── État formulaires ──────────────────────────────────────────
let _aproposBugSeverity   = null;
let _aproposBugKnownId     = null;
let _aproposBugScreenshot  = null;    // File | null
let _aproposIdeaCategory   = null;

// ═══════════════════════════════════════════════════════════════
// Helpers sévérité
// ═══════════════════════════════════════════════════════════════
function aproposSevClass(sev) {
  return sev === 'Bloquant' ? 'bloquant' : sev === 'Gênant' ? 'genant' : 'mineur';
}

// ═══════════════════════════════════════════════════════════════
// Parsing CHANGELOG.md
// ═══════════════════════════════════════════════════════════════
function aproposParseChangelog(text) {
  const versions = [];
  let cur = null, sec = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^##\s*\[([^\]]+)\]\s*[—–-]\s*(.+)$/))) {
      cur = { version: m[1].trim(), date: m[2].trim(), sections: [] };
      sec = null;
      versions.push(cur);
    } else if ((m = line.match(/^###\s+(.+)$/)) && cur) {
      sec = { title: m[1].trim(), items: [] };
      cur.sections.push(sec);
    } else if ((m = line.match(/^-\s+(.+)$/)) && sec) {
      sec.items.push(m[1].trim());
    }
  }
  return versions;
}

async function aproposFetchChangelog() {
  if (_aproposChangelogCache) return _aproposChangelogCache;
  try {
    const res = await fetch('./CHANGELOG.md', { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch CHANGELOG');
    _aproposChangelogCache = aproposParseChangelog(await res.text());
  } catch (e) {
    _aproposChangelogCache = null;
  }
  return _aproposChangelogCache;
}

function aproposCatClass(title) {
  const t = title.toLowerCase();
  if (t.startsWith('correction')) return 'fix';
  if (t.startsWith('changement')) return 'change';
  return '';
}

function aproposRenderSections(sections) {
  return sections.map(sec => `
    <div class="rn-section">
      <span class="rn-cat ${aproposCatClass(sec.title)}">${escapeHtml(sec.title)}</span>
      ${sec.items.map(it => `<div class="rn-item">${escapeHtml(it)}</div>`).join('')}
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════════
// known-bugs.json
// ═══════════════════════════════════════════════════════════════
async function aproposLoadKnownBugs() {
  if (_aproposKbCache) return _aproposKbCache;
  try {
    const res = await fetch('./known-bugs.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch known-bugs');
    const data = await res.json();
    _aproposKbCache = Array.isArray(data) ? data : [];
  } catch (e) {
    _aproposKbCache = [];
  }
  return _aproposKbCache;
}

// ═══════════════════════════════════════════════════════════════
// Release note automatique
// ═══════════════════════════════════════════════════════════════
async function aproposCheckReleaseNote() {
  try {
    if (localStorage.getItem('logrpg_seen_version') === APP_CONFIG.version) return;
  } catch (e) { return; }

  const versions = await aproposFetchChangelog();
  if (!versions || !versions.length) return;

  const v = versions.find(x => x.version === APP_CONFIG.version) || versions[0];
  document.getElementById('rn-version-badge').textContent = 'v' + v.version;
  document.getElementById('rn-body').innerHTML = aproposRenderSections(v.sections);
  document.getElementById('modal-release-note').classList.add('open');
}

function aproposCloseReleaseNote() {
  document.getElementById('modal-release-note').classList.remove('open');
}

function aproposConfirmReleaseNote() {
  try { localStorage.setItem('logrpg_seen_version', APP_CONFIG.version); } catch (e) {}
  aproposCloseReleaseNote();
}

// ═══════════════════════════════════════════════════════════════
// Panneau À propos
// ═══════════════════════════════════════════════════════════════
function aproposOpen() {
  const footer = document.getElementById('apropos-footer-version');
  if (footer) footer.textContent = `${APP_CONFIG.appName} Web · v${APP_CONFIG.version}`;
  document.getElementById('panel-apropos').classList.add('open');
}

function aproposClose() {
  document.getElementById('panel-apropos').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// Patchnotes (historique complet)
// ═══════════════════════════════════════════════════════════════
async function aproposOpenPatchnotes() {
  const versions = await aproposFetchChangelog();
  const body = document.getElementById('patchnotes-body');
  if (!versions || !versions.length) {
    body.innerHTML = `<div style="text-align:center;color:var(--text-light);font-size:12px;padding:24px 0;">Historique indisponible.</div>`;
  } else {
    body.innerHTML = versions.map(v => `
      <div class="pn-version">
        <div class="pn-version-head">
          <span class="rn-version-badge">v${escapeHtml(v.version)}</span>
          <span class="pn-date">${escapeHtml(v.date)}</span>
        </div>
        ${aproposRenderSections(v.sections)}
      </div>`).join('');
  }
  document.getElementById('modal-patchnotes').classList.add('open');
}

function aproposClosePatchnotes() {
  document.getElementById('modal-patchnotes').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// userAgent → lisible
// ═══════════════════════════════════════════════════════════════
function aproposParseUserAgent() {
  const ua = navigator.userAgent || '';
  let m, browser = 'Navigateur inconnu';
  if      ((m = ua.match(/Edg\/([\d.]+)/)))                browser = 'Edge '    + m[1].split('.')[0];
  else if ((m = ua.match(/OPR\/([\d.]+)/)))                browser = 'Opera '   + m[1].split('.')[0];
  else if ((m = ua.match(/Firefox\/([\d.]+)/)))            browser = 'Firefox ' + m[1].split('.')[0];
  else if ((m = ua.match(/Chrome\/([\d.]+)/)))             browser = 'Chrome '  + m[1].split('.')[0];
  else if ((m = ua.match(/Version\/([\d.]+).*Safari/)))    browser = 'Safari '  + m[1].split('.')[0];
  else if (/Safari/.test(ua))                              browser = 'Safari';

  let os = '';
  if      (/Windows NT 10/.test(ua))   os = 'Windows';
  else if (/Windows/.test(ua))         os = 'Windows';
  else if ((m = ua.match(/Mac OS X ([\d_]+)/))) os = 'macOS ' + m[1].replace(/_/g, '.').split('.').slice(0, 2).join('.');
  else if (/Android/.test(ua))         { m = ua.match(/Android ([\d.]+)/); os = 'Android' + (m ? ' ' + m[1] : ''); }
  else if (/iPhone|iPad|iPod/.test(ua)){ m = ua.match(/OS ([\d_]+)/);      os = 'iOS' + (m ? ' ' + m[1].replace(/_/g, '.') : ''); }
  else if (/Linux/.test(ua))           os = 'Linux';

  return os ? `${browser} · ${os}` : browser;
}

// ═══════════════════════════════════════════════════════════════
// Formulaire "Signaler un bug"
// ═══════════════════════════════════════════════════════════════
// Entrée publique "Signaler un bug" :
//  - s'il existe des bugs connus → ouvre la modale de choix
//  - sinon → ouvre directement la modale de déclaration
async function aproposBugReport() {
  aproposClose();
  const bugs = await aproposLoadKnownBugs();
  if (bugs.length) {
    aproposBugRenderChooser(bugs);
    document.getElementById('modal-known-bugs').classList.add('open');
  } else {
    aproposBugOpenForm(null);
  }
}

function aproposBugRenderChooser(bugs) {
  document.getElementById('bug-chooser-list').innerHTML = bugs.map(b => `
    <div class="kb-card" onclick="aproposBugChooseKnown('${b.id}')">
      <div style="margin-top:2px"><span class="sev ${aproposSevClass(b.severity)}">${escapeHtml(b.severity)}</span></div>
      <div class="kb-card-body">
        <div class="kb-card-title">${escapeHtml(b.title)}</div>
        <div class="kb-card-desc">${escapeHtml(b.description || '')}</div>
        <div class="kb-card-id">#${escapeHtml(b.id)}${b.category ? ' · ' + escapeHtml(b.category) : ''}</div>
      </div>
    </div>`).join('');
}

function aproposBugChooserClose() {
  document.getElementById('modal-known-bugs').classList.remove('open');
}

function aproposBugChooseKnown(id) {
  aproposBugChooserClose();
  aproposBugOpenForm(id);
}

function aproposBugChooseNew() {
  aproposBugChooserClose();
  aproposBugOpenForm(null);
}

// Réouvre la modale de choix depuis le formulaire ("← changer")
function aproposBugBackToChooser() {
  aproposBugClose();
  aproposBugReport();
}

// Ouvre la modale de déclaration (vide, ou pré-remplie depuis un bug connu)
function aproposBugOpenForm(knownBugId = null) {
  _aproposBugSeverity   = null;
  _aproposBugKnownId    = null;
  _aproposBugScreenshot = null;

  document.getElementById('bug-pseudo').value      = '';
  document.getElementById('bug-title').value       = '';
  document.getElementById('bug-description').value = '';
  document.getElementById('bug-precisions').value  = '';
  document.getElementById('bug-browser').value     = aproposParseUserAgent();
  document.getElementById('bug-file-input').value  = '';
  aproposBugClearScreenshot();
  aproposBugUpdateSeverityChips();

  document.getElementById('bug-precisions-group').style.display = 'none';
  document.getElementById('bug-prefilled-notice').style.display = 'none';

  document.getElementById('modal-bug-report').classList.add('open');

  if (knownBugId) aproposBugPrefill(knownBugId);
}

function aproposBugPrefill(id) {
  const bug = (_aproposKbCache || []).find(b => b.id === id);
  if (!bug) return;
  document.getElementById('bug-title').value       = bug.title || '';
  document.getElementById('bug-description').value = bug.description || '';
  _aproposBugSeverity = bug.severity || null;
  aproposBugUpdateSeverityChips();
  _aproposBugKnownId = bug.id;
  document.getElementById('bug-prefilled-id').textContent = '#' + bug.id;
  document.getElementById('bug-prefilled-notice').style.display = 'flex';
  document.getElementById('bug-precisions-group').style.display = '';
}

function aproposBugClose() {
  document.getElementById('modal-bug-report').classList.remove('open');
}

function aproposBugSelectSeverity(sev) {
  _aproposBugSeverity = sev;
  aproposBugUpdateSeverityChips();
}

function aproposBugUpdateSeverityChips() {
  document.querySelectorAll('#bug-severity-chips .chip').forEach(c => {
    c.classList.toggle('sel', c.dataset.sev === _aproposBugSeverity);
  });
}

// ── Capture d'écran ───────────────────────────────────────────
function aproposBugPickFile() {
  document.getElementById('bug-file-input').click();
}

function aproposBugFileChange(input) {
  const file = input.files && input.files[0];
  if (file) aproposBugSetScreenshot(file);
}

function aproposBugSetScreenshot(file) {
  if (!file.type || !file.type.startsWith('image/')) { showToast('❌ Image uniquement (PNG, JPG, GIF)'); return; }
  if (file.size > 8 * 1024 * 1024)                    { showToast('❌ Image trop lourde (max 8 Mo)');    return; }
  _aproposBugScreenshot = file;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('bug-screenshot-preview');
    prev.innerHTML = `
      <img src="${e.target.result}" alt="aperçu"/>
      <div class="screenshot-preview-label" onclick="aproposBugClearScreenshot()">✕ retirer</div>`;
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function aproposBugClearScreenshot() {
  _aproposBugScreenshot = null;
  const prev = document.getElementById('bug-screenshot-preview');
  if (prev) { prev.innerHTML = ''; prev.style.display = 'none'; }
  const input = document.getElementById('bug-file-input');
  if (input) input.value = '';
}

function aproposBugHintPaste() {
  showToast('📋 Copie une image puis fais Ctrl+V ici');
}

// Collage d'image (Ctrl+V) quand la modale bug est ouverte
document.addEventListener('paste', e => {
  const modal = document.getElementById('modal-bug-report');
  if (!modal || !modal.classList.contains('open')) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const file = it.getAsFile();
      if (file) { aproposBugSetScreenshot(file); e.preventDefault(); }
      break;
    }
  }
});

async function aproposBugSubmit() {
  const title       = document.getElementById('bug-title').value.trim();
  const description = document.getElementById('bug-description').value.trim();
  if (!title)       { showToast('❌ Le titre est requis');       return; }
  if (!description) { showToast('❌ La description est requise'); return; }

  const pseudo     = document.getElementById('bug-pseudo').value.trim();
  const precisions = document.getElementById('bug-precisions').value.trim();
  const browser    = document.getElementById('bug-browser').value.trim();
  const severity   = _aproposBugSeverity || 'Mineur';
  const knownId    = _aproposBugKnownId;
  const file       = _aproposBugScreenshot;
  const fileName   = file ? (file.name || 'capture.png') : null;

  const color = severity === 'Bloquant' ? 0xE05555
              : severity === 'Gênant'   ? 0xE6A817
              :                            0x5577DD;

  const embed = {
    title: `🐛 [${knownId || 'NOUVEAU'}] ${title}`.slice(0, 256),
    color,
    fields: [
      { name: 'Sévérité',    value: severity,        inline: true },
      { name: 'ID bug connu', value: knownId || '—', inline: true },
      { name: 'Pseudo',      value: pseudo || 'Anonyme', inline: true },
      { name: 'Description', value: description.slice(0, 1024) },
      { name: 'Précisions',  value: (precisions || '—').slice(0, 1024) },
      { name: 'Navigateur',  value: browser || '—' },
      { name: 'Version app', value: APP_CONFIG.version },
    ],
    timestamp: new Date().toISOString(),
  };
  if (fileName) embed.image = { url: 'attachment://' + fileName };

  const btn = document.getElementById('bug-submit-btn');
  if (btn) btn.disabled = true;
  const ok = await aproposSendWebhook(DISCORD_WEBHOOKS.bugs, embed, file, fileName);
  if (btn) btn.disabled = false;

  if (ok) { showToast('✅ Bug signalé, merci !'); aproposBugClose(); }
  else    { showToast("❌ Erreur d'envoi, réessaie."); }
}

// ═══════════════════════════════════════════════════════════════
// Formulaire "Proposer une idée"
// ═══════════════════════════════════════════════════════════════
function aproposIdeaOpen() {
  aproposClose();
  _aproposIdeaCategory = null;
  document.getElementById('idea-pseudo').value      = '';
  document.getElementById('idea-title').value       = '';
  document.getElementById('idea-description').value = '';
  aproposIdeaUpdateChips();
  document.getElementById('modal-idea').classList.add('open');
}

function aproposIdeaClose() {
  document.getElementById('modal-idea').classList.remove('open');
}

function aproposIdeaSelectCategory(cat) {
  _aproposIdeaCategory = cat;
  aproposIdeaUpdateChips();
}

function aproposIdeaUpdateChips() {
  document.querySelectorAll('#idea-category-chips .chip').forEach(c => {
    c.classList.toggle('sel', c.dataset.cat === _aproposIdeaCategory);
  });
}

async function aproposIdeaSubmit() {
  const title       = document.getElementById('idea-title').value.trim();
  const description = document.getElementById('idea-description').value.trim();
  if (!title)       { showToast('❌ Le titre est requis');       return; }
  if (!description) { showToast('❌ La description est requise'); return; }

  const pseudo    = document.getElementById('idea-pseudo').value.trim();
  const categorie = _aproposIdeaCategory || 'Autre';

  const embed = {
    title: `💡 [${categorie}] ${title}`.slice(0, 256),
    color: 0xFF8C42,
    fields: [
      { name: 'Catégorie',   value: categorie,          inline: true },
      { name: 'Pseudo',      value: pseudo || 'Anonyme', inline: true },
      { name: 'Description', value: description.slice(0, 1024) },
      { name: 'Version app', value: APP_CONFIG.version },
    ],
    timestamp: new Date().toISOString(),
  };

  const btn = document.getElementById('idea-submit-btn');
  if (btn) btn.disabled = true;
  const ok = await aproposSendWebhook(DISCORD_WEBHOOKS.ideas, embed, null);
  if (btn) btn.disabled = false;

  if (ok) { showToast('✅ Idée envoyée, merci !'); aproposIdeaClose(); }
  else    { showToast("❌ Erreur d'envoi, réessaie."); }
}

// ═══════════════════════════════════════════════════════════════
// Envoi webhook Discord
// ═══════════════════════════════════════════════════════════════
async function aproposSendWebhook(url, embed, file, fileName) {
  if (!url || url.startsWith('VOTRE_')) {
    console.warn('Webhook Discord non configuré dans config.js');
    return false;
  }
  try {
    let res;
    if (file) {
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify({ embeds: [embed] }));
      fd.append('files[0]', file, fileName || 'capture.png');
      res = await fetch(url, { method: 'POST', body: fd });
    } else {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
    return res.ok;
  } catch (e) {
    console.error('Erreur envoi webhook', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Suppression de toutes les données
// ═══════════════════════════════════════════════════════════════
function aproposConfirmDeleteOpen() {
  aproposClose();
  document.getElementById('modal-confirm-delete').classList.add('open');
}

function aproposConfirmDeleteClose() {
  document.getElementById('modal-confirm-delete').classList.remove('open');
}

async function aproposDeleteAll() {
  try {
    await Promise.all(
      ['characters', 'mj_sessions', 'mj_encounters', 'mj_npcs', 'mj_assets']
        .filter(t => db[t])
        .map(t => db[t].clear())
    );
  } catch (e) { console.error('Erreur suppression Dexie', e); }

  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('logrpg_') && k !== 'logrpg_seen_version') toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) { console.error('Erreur suppression localStorage', e); }

  window.location.reload();
}
