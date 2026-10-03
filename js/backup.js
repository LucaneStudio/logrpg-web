// ═══════════════════════════════════════════════════════════════
// SAUVEGARDE COMPLÈTE — export / import de toutes les données
// + transfert en un clic vers l'application LogRPG (contrat §1 et §2)
// ═══════════════════════════════════════════════════════════════
// Format : ZIP `logrpg-sauvegarde-AAAA-MM-JJ.zip` contenant
//  - backup.json : { format, formatVersion, appVersion, exportedAt,
//                    characters (enregistrements Dexie bruts), settings }
//  - mj.zip      : archive de campagne identique à « 📤 Exporter » du Mode MJ
//                  (absente s'il n'y a aucune donnée MJ)

const BACKUP_FORMAT         = 'logrpg-backup';
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_MJ_TABLES = ['mj_sessions', 'mj_encounters', 'mj_npcs', 'mj_objects', 'mj_places', 'mj_assets', 'mj_bestiary', 'mj_maps'];

function backupFileName() {
  const d   = new Date();   // date locale
  const pad = n => String(n).padStart(2, '0');
  return `logrpg-sauvegarde-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}

// Vrai s'il existe au moins une donnée MJ (session, rencontre, PNJ, objet,
// lieu, image, bestiaire ou carte).
async function backupHasMjData() {
  const counts = await Promise.all(BACKUP_MJ_TABLES.filter(t => db[t]).map(t => db[t].count()));
  return counts.some(n => n > 0);
}

// Construit la sauvegarde complète → { blob, characters, campaign }
async function backupBuildZip() {
  if (typeof JSZip === 'undefined') throw new Error('JSZip non chargé');
  const characters = await db.characters.toArray();
  let rarities = null;
  try { rarities = localStorage.getItem('mj_obj_rarities'); } catch (e) {}

  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify({
    format       : BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion   : APP_CONFIG.version,
    exportedAt   : new Date().toISOString(),
    characters,
    settings     : { mj_obj_rarities: rarities },
  }));

  const campaign = await backupHasMjData();
  if (campaign) {
    // Le cache du bestiaire n'est chargé qu'à l'ouverture du Mode MJ / combat
    await bestiaryLoad();
    zip.file('mj.zip', await mjBuildExportBlob());
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, characters: characters.length, campaign };
}

// ── Export (À propos → Données) ───────────────────────────────
let _backupBusy = false;
async function backupExportAll() {
  if (_backupBusy) return;
  _backupBusy = true;
  try {
    showToast('⏳ Préparation de la sauvegarde…', 10000);
    const { blob } = await backupBuildZip();
    downloadBlob(blob, backupFileName());
    showToast('✅ Sauvegarde exportée');
  } catch (err) {
    console.error('[backupExportAll]', err);
    showToast("❌ Échec de l'export de la sauvegarde", 4000);
  } finally {
    _backupBusy = false;
  }
}

// ── Import d'une sauvegarde complète ──────────────────────────
function backupImportPick() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.zip';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await backupImportFile(file);
  };
  input.click();
}

// Lit et valide l'archive → { zip, data, characters (valides), mjFile }
async function backupReadZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('backup.json');
  if (!entry) throw new Error('backup.json manquant');
  const data = JSON.parse(await entry.async('string'));
  if (!data || data.format !== BACKUP_FORMAT || typeof data.formatVersion !== 'number' || data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('format inconnu');
  }
  const characters = (Array.isArray(data.characters) ? data.characters : [])
    .filter(c => c && typeof c === 'object' && !Array.isArray(c) && typeof c.name === 'string');
  return { data, characters, mjFile: zip.file('mj.zip') };
}

async function backupImportFile(file) {
  if (typeof JSZip === 'undefined') { showToast('❌ JSZip non chargé'); return; }
  let parsed;
  try {
    parsed = await backupReadZip(file);
  } catch (err) {
    console.error('[backupImportFile]', err);
    showToast("❌ Ce fichier n'est pas une sauvegarde complète LogRPG", 4000);
    return;
  }
  const n = parsed.characters.length;
  const parts = [`${n} personnage${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}`];
  if (parsed.mjFile) parts.push('campagne MJ fusionnée (le bestiaire est remplacé)');
  appConfirm(`Importer cette sauvegarde ? ${parts.join(', ')}. Les données actuelles sont conservées.`,
    () => backupImportParsed(parsed), { okLabel: '📥 Importer' });
}

async function backupImportParsed({ data, characters, mjFile }) {
  aproposClose();
  showToast('⏳ Import en cours…', 10000);
  let added = 0, mjResult = null;
  try {
    // Personnages : toujours ajoutés comme nouveaux enregistrements
    for (const c of characters) {
      const { id, ...rest } = c;
      await db.characters.add(rest);
      added++;
    }
    const rarities = data.settings && data.settings.mj_obj_rarities;
    if (typeof rarities === 'string') {
      try {
        if (Array.isArray(JSON.parse(rarities))) localStorage.setItem('mj_obj_rarities', rarities);
      } catch (e) { console.warn('[backupImport] raretés ignorées', e); }
    }
    if (mjFile) mjResult = await mjImportZipData(await mjFile.async('uint8array'));
  } catch (err) {
    console.error('[backupImportParsed]', err);
    showToast(`❌ Import interrompu (${added} personnage${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''})`, 5000);
    await loadCharacterList();
    return;
  }

  await loadCharacterList();
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  const overlay = document.getElementById('mj-overlay');
  if (overlay && overlay.style.display !== 'none' && typeof _mjRenderAll === 'function') await _mjRenderAll();

  const warn = mjResult && (mjResult.bestiaryFailed || mjResult.mapsFailed) ? ' (une partie de la campagne n\'a pas pu être restaurée)' : '';
  showToast(`✅ Sauvegarde importée : ${added} personnage${added > 1 ? 's' : ''}${mjFile ? ' + campagne MJ' : ''}${warn}`, 4000);
}

// ═══════════════════════════════════════════════════════════════
// Transfert en un clic vers l'application (contrat §2)
// ═══════════════════════════════════════════════════════════════
// L'application ouvre `<site>#logrpg-transfer=<port>.<token>`. Le fragment est
// lu et retiré de l'URL dès le chargement du script (avant tout rendu) ;
// rien n'est envoyé sans clic explicite sur « Envoyer mes données ».
let _backupTransfer = null;   // { port, token } | null

function backupReadTransferHash() {
  const hash = location.hash || '';
  if (!hash.startsWith('#logrpg-transfer=')) return false;
  // Fragment retiré dans tous les cas (même invalide) : le jeton ne doit pas
  // rester dans l'historique ni dans un favori.
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  const m = /^#logrpg-transfer=(\d{1,5})\.([0-9a-f]{32})$/.exec(hash);
  if (!m) return false;
  const port = Number(m[1]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return false;
  _backupTransfer = { port, token: m[2] };
  return true;
}
backupReadTransferHash();
// Site déjà ouvert dans l'onglet : seul le fragment change, pas de rechargement
window.addEventListener('hashchange', () => { if (backupReadTransferHash()) backupCheckTransfer(); });

function backupHasPendingTransfer() { return !!_backupTransfer; }

// Appelée après l'ouverture de la base (init.js)
async function backupCheckTransfer() {
  if (!_backupTransfer) return;
  let nChars = 0, campaign = false;
  try {
    nChars   = await db.characters.count();
    campaign = await backupHasMjData();
  } catch (err) { console.error('[backupCheckTransfer]', err); }
  document.getElementById('transfer-summary').textContent =
    `${nChars} personnage${nChars > 1 ? 's' : ''} · campagne MJ : ${campaign ? 'oui' : 'non'}`;
  backupTransferSetState('idle');
  document.getElementById('modal-transfer').classList.add('open');
}

// idle | sending | done | error
function backupTransferSetState(state, msg) {
  const status = document.getElementById('transfer-status');
  const send   = document.getElementById('transfer-send-btn');
  const cancel = document.getElementById('transfer-cancel-btn');
  status.textContent   = msg || '';
  status.style.display = msg ? '' : 'none';
  status.style.color   = state === 'done' ? 'var(--green-d)' : state === 'error' ? 'var(--red)' : 'var(--text-light)';
  send.disabled        = state === 'sending';
  send.style.display   = state === 'done' ? 'none' : '';
  send.textContent     = state === 'error' ? '🔁 Réessayer' : 'Envoyer mes données';
  cancel.textContent   = state === 'done' ? 'Fermer' : 'Annuler';
  cancel.disabled      = state === 'sending';
}

function backupTransferClose() {
  document.getElementById('modal-transfer').classList.remove('open');
}

async function backupTransferSend() {
  const t = _backupTransfer;
  if (!t || _backupBusy) return;
  _backupBusy = true;
  backupTransferSetState('sending', '⏳ Préparation et envoi…');
  const failMsg = "❌ L'application LogRPG n'a pas répondu. Garde-la ouverte et réessaie, ou utilise « Exporter toutes mes données ».";
  const ctrl = new AbortController();
  let timer  = null;
  try {
    const { blob } = await backupBuildZip();
    // Délai de 30 s compté à partir de l'envoi (pas de la construction du ZIP)
    timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`http://127.0.0.1:${t.port}/logrpg/transfer`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/zip', 'X-LogRPG-Token': t.token },
      body   : blob,
      signal : ctrl.signal,
    });
    if (res.ok) {
      _backupTransfer = null;   // jeton à usage unique
      backupTransferSetState('done', "✅ Données envoyées à l'application");
      showToast("✅ Données envoyées à l'application", 4000);
    } else if (res.status === 403) {
      backupTransferSetState('error', "❌ L'application a refusé le transfert (lien expiré). Relance le transfert depuis l'application.");
    } else if (res.status === 413) {
      backupTransferSetState('error', '❌ Données trop volumineuses pour le transfert. Utilise « Exporter toutes mes données ».');
    } else {
      backupTransferSetState('error', `❌ L'application n'a pas pu importer les données (erreur ${res.status}). Utilise « Exporter toutes mes données ».`);
    }
  } catch (err) {
    console.error('[backupTransferSend]', err);
    backupTransferSetState('error', failMsg);
  } finally {
    clearTimeout(timer);
    _backupBusy = false;
  }
}
