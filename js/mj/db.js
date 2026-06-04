// MJ — BASE DE DONNÉES
// ═══════════════════════════════════════════════════════════════
// Migration Dexie v1→v2 : ajout des tables MJ

db.version(2).stores({
  mj_sessions  : '++id, title, updatedAt',
  mj_encounters: '++id, title',
  mj_npcs      : '++id, name, status',
  mj_assets    : '++id, name',
});

// ── Sessions ──────────────────────────────────────────────────
async function mjGetSessions()    { return db.mj_sessions.orderBy('updatedAt').reverse().toArray(); }
async function mjGetSession(id)   { return db.mj_sessions.get(id); }
async function mjSaveSession(s)   {
  s.updatedAt = new Date().toISOString();
  if (s.id) { await db.mj_sessions.put(s); return s.id; }
  return db.mj_sessions.add(s);
}
async function mjDeleteSession(id) { await db.mj_sessions.delete(id); }

// ── Rencontres ────────────────────────────────────────────────
// participants: [{ bestiaryId, qty }]
async function mjGetEncounters()    { return db.mj_encounters.orderBy('id').reverse().toArray(); }
async function mjGetEncounter(id)   { return db.mj_encounters.get(id); }
async function mjSaveEncounter(e)   {
  if (e.id) { await db.mj_encounters.put(e); return e.id; }
  return db.mj_encounters.add(e);
}
async function mjDeleteEncounter(id) { await db.mj_encounters.delete(id); }

// ── PNJ ───────────────────────────────────────────────────────
// status: 'ALIVE' | 'DEAD' | 'MISSING' | 'UNKNOWN'
async function mjGetNpcs()    { return db.mj_npcs.orderBy('name').toArray(); }
async function mjGetNpc(id)   { return db.mj_npcs.get(id); }
async function mjSaveNpc(n)   {
  if (n.id) { await db.mj_npcs.put(n); return n.id; }
  return db.mj_npcs.add(n);
}
async function mjDeleteNpc(id) { await db.mj_npcs.delete(id); }

// ── Assets (images Blob) ──────────────────────────────────────
async function mjSaveAsset(name, mimeType, blob) {
  return db.mj_assets.add({ name, mimeType, data: blob });
}
async function mjGetAsset(id)    { return db.mj_assets.get(id); }
async function mjDeleteAsset(id) { await db.mj_assets.delete(id); }

// Convertit un Blob en data URL pour affichage <img>
async function mjAssetToUrl(id) {
  if (!id) return null;
  const asset = await mjGetAsset(id);
  if (!asset) return null;
  return URL.createObjectURL(asset.data);
}

// ── Export ZIP ────────────────────────────────────────────────
async function mjExportZip() {
  if (typeof JSZip === 'undefined') { alert('JSZip non chargé'); return; }
  const zip = new JSZip();
  const assetsFolder = zip.folder('assets');

  const [sessions, encounters, npcs, allAssets] = await Promise.all([
    mjGetSessions(), mjGetEncounters(), mjGetNpcs(),
    db.mj_assets.toArray(),
  ]);

  // Ajouter les images dans le dossier assets
  for (const asset of allAssets) {
    assetsFolder.file(`${asset.id}.${asset.mimeType.split('/')[1]}`, asset.data);
  }

  const data = {
    version: APP_CONFIG.version,
    exportedAt: new Date().toISOString(),
    bestiary: bestiaryGetAll(),
    sessions,
    encounters,
    npcs,
    assetMeta: allAssets.map(a => ({ id: a.id, name: a.name, mimeType: a.mimeType })),
  };
  zip.file('data.json', JSON.stringify(data, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `logrpg-mj-${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ZIP ────────────────────────────────────────────────
async function mjImportZip(file) {
  if (typeof JSZip === 'undefined') { alert('JSZip non chargé'); return; }
  const zip  = await JSZip.loadAsync(file);
  const json = await zip.file('data.json').async('string');
  const data = JSON.parse(json);

  if (data.bestiary) bestiarySave(data.bestiary);

  // Réimporter les assets
  const assetIdMap = {};
  for (const meta of (data.assetMeta || [])) {
    const ext  = meta.mimeType.split('/')[1];
    const zf   = zip.file(`assets/${meta.id}.${ext}`);
    if (!zf) continue;
    const blob = await zf.async('blob');
    const newId = await mjSaveAsset(meta.name, meta.mimeType, blob);
    assetIdMap[meta.id] = newId;
  }

  // Remapper les assetId dans les données
  const remap = obj => {
    if (obj.assetId && assetIdMap[obj.assetId]) obj.assetId = assetIdMap[obj.assetId];
    return obj;
  };

  for (const s of (data.sessions   || [])) { const {id,...rest}=s; await mjSaveSession(remap(rest)); }
  for (const e of (data.encounters || [])) { const {id,...rest}=e; await mjSaveEncounter(remap(rest)); }
  for (const n of (data.npcs       || [])) { const {id,...rest}=n; await mjSaveNpc(remap(rest)); }

  alert('Import réussi !');
  await _mjRenderAll();
}
