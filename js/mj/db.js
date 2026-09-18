// MJ — BASE DE DONNÉES
// ═══════════════════════════════════════════════════════════════
// Migration Dexie v1→v2 : ajout des tables MJ

db.version(2).stores({
  mj_sessions  : '++id, title, updatedAt',
  mj_encounters: '++id, title',
  mj_npcs      : '++id, name, status',
  mj_assets    : '++id, name',
});

// Migration v3 : ajout des objets et lieux (ressources taggables)
db.version(3).stores({
  mj_objects: '++id, name',
  mj_places : '++id, name',
});

// Migration v4 : bestiaire (remplace le localStorage historique). Clé
// primaire EXPLICITE ('id', pas '++id') : les entrées migrées gardent
// exactement leur ancien id ('bt_xxxxx'), donc aucune référence existante
// (participant de rencontre/combat) ne casse.
db.version(4).stores({
  mj_bestiary: 'id, name',
});

// Migration v5 : cartes à pins. Clé primaire EXPLICITE ('id', pas '++id'),
// même raison que le bestiaire : un pin peut lier une carte à une autre
// carte, l'id doit rester stable après un export/import ZIP.
db.version(5).stores({
  mj_maps: 'id, name',
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

// ── Objets ────────────────────────────────────────────────────
// { name, otype, rarity, owner, notes, assetId }
async function mjGetObjects()    { return db.mj_objects.orderBy('name').toArray(); }
async function mjGetObject(id)   { return db.mj_objects.get(id); }
async function mjSaveObject(o)   {
  if (o.id) { await db.mj_objects.put(o); return o.id; }
  return db.mj_objects.add(o);
}
async function mjDeleteObject(id) { await db.mj_objects.delete(id); }

// ── Lieux ─────────────────────────────────────────────────────
// { name, ptype, region, notes, assetId }
async function mjGetPlaces()    { return db.mj_places.orderBy('name').toArray(); }
async function mjGetPlace(id)   { return db.mj_places.get(id); }
async function mjSavePlace(p)   {
  if (p.id) { await db.mj_places.put(p); return p.id; }
  return db.mj_places.add(p);
}
async function mjDeletePlace(id) { await db.mj_places.delete(id); }

// ── Cartes ────────────────────────────────────────────────────
// { id, name, assetId, pins: [{id,x,y,title,text,link:{type,id}|null}] }
function newMapId() { return 'map_' + Math.random().toString(36).slice(2, 9); }
async function mjGetMaps()    { return db.mj_maps.orderBy('name').toArray(); }
async function mjGetMap(id)   { return db.mj_maps.get(id); }
async function mjSaveMap(m)   {
  if (!m.id) m.id = newMapId();   // stampe l'id sur l'objet passé (mutation), pas de copie
  await db.mj_maps.put(m);
  return m.id;
}
async function mjDeleteMap(id) { await db.mj_maps.delete(id); }

// ── Assets (images Blob) ──────────────────────────────────────
async function mjSaveAsset(name, mimeType, blob) {
  const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo, même limite que les photos de profil (profile.js)
  if (blob && blob.size > MAX_SIZE) {
    if (typeof showToast === 'function') showToast('❌ Image trop lourde (max 10 Mo)');
    return null;
  }
  try {
    return await db.mj_assets.add({ name, mimeType, data: blob });
  } catch (err) {
    console.error('[mjSaveAsset]', err);
    if (typeof showToast === 'function') showToast("❌ Échec de la sauvegarde de l'image (stockage plein ou indisponible)");
    return null;
  }
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

  const [sessions, encounters, npcs, objects, places, allAssets, maps] = await Promise.all([
    mjGetSessions(), mjGetEncounters(), mjGetNpcs(), mjGetObjects(), mjGetPlaces(),
    db.mj_assets.toArray(), mjGetMaps(),
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
    objects,
    places,
    maps,
    assetMeta: allAssets.map(a => ({ id: a.id, name: a.name, mimeType: a.mimeType })),
  };
  zip.file('data.json', JSON.stringify(data, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `logrpg-mj-${new Date().toISOString().slice(0,10)}.zip`;
  // Attaché au DOM avant le clic + révocation différée : sur Safari (iOS/
  // iPadOS/macOS), un <a> détaché ou une révocation immédiate du blob peut
  // faire échouer le téléchargement silencieusement.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── Import ZIP ────────────────────────────────────────────────
async function mjImportZip(file) {
  if (typeof JSZip === 'undefined') { alert('JSZip non chargé'); return; }
  const zip  = await JSZip.loadAsync(file);
  const json = await zip.file('data.json').async('string');
  const data = JSON.parse(json);

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

  // Tables de correspondance ancien-id → nouvel-id : encounter/npc/objet/lieu
  // changent d'id (Dexie '++id' réassigné à l'import), donc tout pin de carte
  // qui les référence doit être remappé après coup (§5 de la spec Groupe C).
  const encounterIdMap = {}, npcIdMap = {}, objectIdMap = {}, placeIdMap = {};

  for (const s of (data.sessions   || [])) { const {id,...rest}=s; await mjSaveSession(remap(rest)); }
  for (const e of (data.encounters || [])) { const {id,...rest}=e; const newId = await mjSaveEncounter(remap(rest)); if (id != null) encounterIdMap[id] = newId; }
  for (const n of (data.npcs       || [])) { const {id,...rest}=n; const newId = await mjSaveNpc(remap(rest));       if (id != null) npcIdMap[id] = newId; }
  for (const o of (data.objects    || [])) { const {id,...rest}=o; const newId = await mjSaveObject(remap(rest));   if (id != null) objectIdMap[id] = newId; }
  for (const p of (data.places     || [])) { const {id,...rest}=p; const newId = await mjSavePlace(remap(rest));    if (id != null) placeIdMap[id] = newId; }

  // Cartes : id stable (clé explicite, comme le bestiaire) — aucun remap de
  // l'id de la carte elle-même. Les liens de pins vers encounter/npc/objet/
  // lieu/asset ont tous besoin d'être corrigés (id Dexie '++id' réassigné à
  // l'import, y compris pour les images — assetIdMap est déjà calculée plus
  // haut pour ça) ; seuls scenario (id 'doc_xxx') et carte (id 'map_xxx')
  // sont déjà stables, aucun remap nécessaire pour eux.
  const idMapByType = { encounter: encounterIdMap, npc: npcIdMap, objet: objectIdMap, lieu: placeIdMap, asset: assetIdMap };
  let mapsFailed = false;
  if (data.maps) {
    try {
      for (const m of data.maps) {
        const fixedPins = (m.pins || []).map(p => {
          if (!p.link) return p;
          const idMap = idMapByType[p.link.type];
          if (!idMap) return p;   // scenario / carte : id déjà stable
          const mapped = idMap[p.link.id];
          return { ...p, link: (mapped != null) ? { type: p.link.type, id: mapped } : null };
        });
        await mjSaveMap(remap({ ...m, pins: fixedPins }));
      }
    } catch (err) { console.error('[mjImportZip] cartes', err); mapsFailed = true; }
  }

  // Le bestiaire vit dans IndexedDB (table mj_bestiary). On isole son échec
  // (table verrouillée, quota IndexedDB, etc.) et on l'exécute en dernier
  // pour qu'il n'empêche jamais la restauration des sessions/PNJ/objets/
  // lieux/assets ci-dessus.
  let bestiaryFailed = false;
  if (data.bestiary) {
    try { await bestiarySave(data.bestiary); } catch (err) { console.error('[mjImportZip] bestiaire', err); bestiaryFailed = true; }
  }

  alert([
    'Import réussi !',
    bestiaryFailed ? "(le bestiaire personnalisé n'a pas pu être restauré : stockage plein ou indisponible)" : null,
    mapsFailed ? "(les cartes n'ont pas pu être restaurées : stockage plein ou indisponible)" : null,
  ].filter(Boolean).join(' '));
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderAll();
}
