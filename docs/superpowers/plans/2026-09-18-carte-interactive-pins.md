# Carte interactive à pins (Groupe C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une catégorie Mode MJ « Cartes » : une image de fond sur laquelle le MJ pose des pins (titre, court texte, lien optionnel vers une autre ressource MJ ou une autre carte), avec un mode « masquer les pins » pour montrer la carte au joueur sans spoiler.

**Architecture:** Nouvelle table Dexie `mj_maps` (clé primaire string explicite, comme le bestiaire, pour que les liens carte→carte survivent à un export/import ZIP). Nouvel écran liste+détail (`js/mj/maps.js`) où le détail est un canvas image+pins au lieu de champs de texte. Les pins réutilisent au maximum l'infrastructure `@tag` déjà en place (`js/mj/tags.js` : `_mjTagIndex`, `_MJ_TAG_META`, `mjTagGo`) pour le choix et la résolution du lien, plutôt que d'inventer un système parallèle.

**Tech Stack:** Vanilla JS, Dexie/IndexedDB (déjà en place), vérification manuelle via le serveur statique du projet (`.claude/launch.json`, `logrpg-static`, port 8777) — pas de test automatisé possible (dépend du DOM/IndexedDB, hors de la convention `tests/*.html`).

**Spec :** `docs/superpowers/specs/2026-09-18-carte-interactive-pins-design.md`

---

### Task 1 : Fondation données — table `mj_maps`, extension du système `@tag`, suppression totale ✅ DONE (3f7b945, reviews OK)

**Files:**
- Modify: `js/mj/db.js` (nouvelle table + CRUD)
- Modify: `js/mj/tags.js` (`_MJ_TAG_META`, `mjBuildTagIndex`, `mjTagGo`)
- Modify: `js/apropos.js` (`aproposDeleteAll`)

- [ ] **Step 1 : Nouvelle table Dexie**

Dans `js/mj/db.js`, remplacer :

```js
// Migration v4 : bestiaire (remplace le localStorage historique). Clé
// primaire EXPLICITE ('id', pas '++id') : les entrées migrées gardent
// exactement leur ancien id ('bt_xxxxx'), donc aucune référence existante
// (participant de rencontre/combat) ne casse.
db.version(4).stores({
  mj_bestiary: 'id, name',
});
```

par :

```js
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
```

- [ ] **Step 2 : CRUD des cartes**

Dans `js/mj/db.js`, après le bloc `// ── Lieux ─────` (juste avant `// ── Assets (images Blob) ──`), ajouter :

```js

// ── Cartes ────────────────────────────────────────────────────
// { id, name, assetId, pins: [{id,x,y,title,text,link:{type,id}|null}] }
function newMapId() { return 'map_' + Math.random().toString(36).slice(2, 9); }
async function mjGetMaps()    { return db.mj_maps.orderBy('name').toArray(); }
async function mjGetMap(id)   { return db.mj_maps.get(id); }
async function mjSaveMap(m)   {
  if (!m.id) m.id = newMapId();
  await db.mj_maps.put(m);
  return m.id;
}
async function mjDeleteMap(id) { await db.mj_maps.delete(id); }
```

- [ ] **Step 3 : Étendre le système `@tag` — nouveau type `carte`**

Dans `js/mj/tags.js`, remplacer :

```js
const _MJ_TAG_META = {
  scenario:  { icon: '📄', section: 'sessions',   label: 'Scénario' },
  encounter: { icon: '⚔️',  section: 'encounters', label: 'Combat'   },
  npc:       { icon: '🧑', section: 'npcs',       label: 'PNJ'      },
  objet:     { icon: '📦', section: 'objects',    label: 'Objet'    },
  lieu:      { icon: '📍', section: 'places',     label: 'Lieu'     },
  asset:     { icon: '🖼️', section: 'assets',     label: 'Image'    },
};
```

par :

```js
const _MJ_TAG_META = {
  scenario:  { icon: '📄', section: 'sessions',   label: 'Scénario' },
  encounter: { icon: '⚔️',  section: 'encounters', label: 'Combat'   },
  npc:       { icon: '🧑', section: 'npcs',       label: 'PNJ'      },
  objet:     { icon: '📦', section: 'objects',    label: 'Objet'    },
  lieu:      { icon: '📍', section: 'places',     label: 'Lieu'     },
  asset:     { icon: '🖼️', section: 'assets',     label: 'Image'    },
  carte:     { icon: '🗺️', section: 'maps',       label: 'Carte'    },
};
```

Remplacer :

```js
async function mjBuildTagIndex() {
  const idx = [];
  try {
    const [sessions, encounters, npcs, objects, places, assets] = await Promise.all([
      mjGetSessions(), mjGetEncounters(), mjGetNpcs(),
      (typeof mjGetObjects === 'function' ? mjGetObjects() : []),
      (typeof mjGetPlaces  === 'function' ? mjGetPlaces()  : []),
      db.mj_assets.toArray(),
    ]);
    const bestiary = (typeof bestiaryGetAll === 'function') ? bestiaryGetAll() : [];
```

par :

```js
async function mjBuildTagIndex() {
  const idx = [];
  try {
    const [sessions, encounters, npcs, objects, places, assets, maps] = await Promise.all([
      mjGetSessions(), mjGetEncounters(), mjGetNpcs(),
      (typeof mjGetObjects === 'function' ? mjGetObjects() : []),
      (typeof mjGetPlaces  === 'function' ? mjGetPlaces()  : []),
      db.mj_assets.toArray(),
      (typeof mjGetMaps === 'function' ? mjGetMaps() : []),
    ]);
    const bestiary = (typeof bestiaryGetAll === 'function') ? bestiaryGetAll() : [];
```

Remplacer :

```js
    assets.forEach(a => idx.push({ name: a.name || 'image', type: 'asset', id: a.id, url: _mjAssetUrl(a) }));

    // Normaliser puis publier l'index direct
```

par :

```js
    assets.forEach(a => idx.push({ name: a.name || 'image', type: 'asset', id: a.id, url: _mjAssetUrl(a) }));

    maps.forEach(m => idx.push({ name: m.name || 'Sans nom', type: 'carte', id: m.id,
      pinCount: (m.pins || []).length }));

    // Normaliser puis publier l'index direct
```

Remplacer :

```js
async function mjTagGo(type, id, parentId) {
  const meta = _MJ_TAG_META[type];
  if (!meta) return;
  mjTagPreviewHide();   // l'aperçu ne se ferme pas tout seul après la redirection
  const ac = document.getElementById('mj-ac'); if (ac) ac.style.display = 'none';
  if (_mjSection !== meta.section) await mjSwitchSection(meta.section);
  if (type === 'scenario')  { await mjSelectSession(parentId); await mjSelectDocFromTree(parentId, id); }
  else if (type === 'encounter') await mjSelectEncounter(id);
  else if (type === 'npc')       await mjSelectNpc(id);
  else if (type === 'objet')     await mjSelectObject(id);
  else if (type === 'lieu')      await mjSelectPlace(id);
  else if (type === 'asset')     await mjSelectAsset(id);
}
```

par :

```js
async function mjTagGo(type, id, parentId) {
  const meta = _MJ_TAG_META[type];
  if (!meta) return;
  mjTagPreviewHide();   // l'aperçu ne se ferme pas tout seul après la redirection
  const ac = document.getElementById('mj-ac'); if (ac) ac.style.display = 'none';
  if (_mjSection !== meta.section) await mjSwitchSection(meta.section);
  if (type === 'scenario')  { await mjSelectSession(parentId); await mjSelectDocFromTree(parentId, id); }
  else if (type === 'encounter') await mjSelectEncounter(id);
  else if (type === 'npc')       await mjSelectNpc(id);
  else if (type === 'objet')     await mjSelectObject(id);
  else if (type === 'lieu')      await mjSelectPlace(id);
  else if (type === 'asset')     await mjSelectAsset(id);
  else if (type === 'carte')     await mjSelectMap(id);
}
```

(`mjSelectMap` n'existe pas encore — elle est ajoutée en Task 2. `mjTagGo`
n'est pas encore appelée avec `type === 'carte'` avant Task 4, donc cette
branche est morte jusque-là, sans erreur : `else if` ne s'exécute jamais
pour un type qui n'existe pas encore dans l'index.)

- [ ] **Step 4 : Suppression totale des données**

Dans `js/apropos.js`, remplacer :

```js
      ['characters', 'mj_sessions', 'mj_encounters', 'mj_npcs', 'mj_assets', 'mj_bestiary']
```

par :

```js
      ['characters', 'mj_sessions', 'mj_encounters', 'mj_npcs', 'mj_assets', 'mj_bestiary', 'mj_maps']
```

- [ ] **Step 5 : Vérification manuelle**

1. Démarrer le serveur (`logrpg-static`), ouvrir l'app, console : aucune
   erreur au chargement (la migration Dexie v5 s'applique silencieusement).
2. Console : `await mjGetMaps()` → tableau vide.
3. Console : `await mjSaveMap({name:'Test', assetId:null, pins:[]})` → retourne
   un id `'map_xxxxx'` ; `await mjGetMaps()` → contient l'entrée ; `await
   mjDeleteMap(id)` → redevient vide.
4. Réglages > Supprimer toutes les données → aucune erreur (même si
   `mj_maps` est déjà vide, `db.mj_maps.clear()` ne doit pas planter).

- [ ] **Step 6 : Commit**

```bash
git add js/mj/db.js js/mj/tags.js js/apropos.js
git commit -m "feat(cartes): fondation données — table mj_maps, type @tag carte"
```

---

### Task 2 : Écran Mode MJ « Cartes » (liste+détail, image de fond) ✅ DONE (3579471, reviews OK)

**Files:**
- Create: `js/mj/maps.js`
- Modify: `js/mj/view.js` (nav + section + `index.html`)
- Modify: `index.html` (balise `<script>`)

- [ ] **Step 1 : Créer `js/mj/maps.js`**

```js
// MJ — CARTES (liste+détail, image de fond + pins — voir js/mj/tags.js
// pour l'index @tag et js/mj/db.js pour le CRUD mj_maps)
// ═══════════════════════════════════════════════════════════════

let _mjMap = null;

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderMapsList() {
  const maps = await mjGetMaps();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = maps.length === 0
    ? `<div class="mj-empty">🗺️<br>Aucune carte.<br>Ajoute la première !</div>`
    : maps.map(m => `
        <div class="mj-item-card ${_mjMap?.id === m.id ? 'active' : ''}" onclick="mjSelectMap('${m.id}')"
             oncontextmenu="return mjItemContext(event, () => mjDeleteMapConfirm('${m.id}'))">
          <div class="mj-item-name">${escapeHtml(m.name || 'Sans nom')}</div>
          <div class="mj-item-sub"><span>🗺️ ${(m.pins || []).length} pin${(m.pins || []).length === 1 ? '' : 's'}</span></div>
        </div>`).join('');
}

async function mjSelectMap(id) {
  _mjMap = await mjGetMap(id);
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await mjRenderMapsList();
  await mjRenderMapDetail();
}

// ── Détail ────────────────────────────────────────────────────
async function mjRenderMapDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjMap) {
    detail.innerHTML = `<div class="mj-detail-empty">🗺️<br>Sélectionne ou crée une carte</div>`;
    return;
  }

  const m = _mjMap;
  let canvasHtml;
  if (m.assetId) {
    const url = await mjAssetToUrl(m.assetId);
    canvasHtml = url
      ? `<div class="mj-map-canvas" style="position:relative;width:100%;">
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
        </div>`
      : `<div class="mj-detail-empty">🗺️<br>Image introuvable</div>`;
  } else {
    canvasHtml = `<div class="mj-detail-empty">🗺️<br>Ajoute une image de fond</div>`;
  }

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="flex:1;min-width:0;">
        <input id="mj-map-name" class="mj-title-input"
          value="${escapeHtml(m.name || '')}" placeholder="Nom de la carte…"
          onchange="mjMapSaveField('name', this.value)"/>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-secondary" onclick="mjMapUploadImage('${m.id}')">🖼️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeleteMapConfirm('${m.id}')">🗑️</button>
      </div>
    </div>
    <div class="mj-detail-body">
      ${canvasHtml}
    </div>`;
}

async function mjMapSaveField(field, value) {
  if (!_mjMap) return;
  _mjMap[field] = value;
  await mjSaveMap(_mjMap);
  if (field === 'name') await mjRenderMapsList();
}

function mjMapUploadImage(mapId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (_mjMap.assetId) await mjDeleteAsset(_mjMap.assetId);
    _mjMap.assetId = await mjSaveAsset(file.name, file.type, file);
    await mjSaveMap(_mjMap);
    await mjRenderMapDetail();
  };
  input.click();
}

async function mjNewMap() {
  const id = await mjSaveMap({ name: 'Nouvelle carte', assetId: null, pins: [] });
  _mjMap = await mjGetMap(id);
  await mjRenderMapsList();
  await mjRenderMapDetail();
  setTimeout(() => document.getElementById('mj-map-name')?.focus(), 100);
}

function mjDeleteMapConfirm(id) {
  appConfirm('Supprimer cette carte ? Cette action est définitive.', async () => {
    const map = await mjGetMap(id);
    if (map?.assetId) await mjDeleteAsset(map.assetId);
    await mjDeleteMap(id);
    if (_mjMap && _mjMap.id === id) _mjMap = null;
    await mjRenderMapsList();
    await mjRenderMapDetail();
    if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  }, { okLabel: 'Supprimer', danger: true });
}
```

- [ ] **Step 2 : Ajouter l'onglet dans la nav Mode MJ**

Dans `js/mj/view.js`, remplacer :

```js
        <button class="mj-nav-btn ${_mjSection==='places'?'on':''}"
          onclick="mjSwitchSection('places')">📍 Lieux</button>
        <button class="mj-nav-btn ${_mjSection==='assets'?'on':''}"
          onclick="mjSwitchSection('assets')">🖼️ Images</button>
```

par :

```js
        <button class="mj-nav-btn ${_mjSection==='places'?'on':''}"
          onclick="mjSwitchSection('places')">📍 Lieux</button>
        <button class="mj-nav-btn ${_mjSection==='maps'?'on':''}"
          onclick="mjSwitchSection('maps')">🗺️ Cartes</button>
        <button class="mj-nav-btn ${_mjSection==='assets'?'on':''}"
          onclick="mjSwitchSection('assets')">🖼️ Images</button>
```

Remplacer :

```js
async function _mjRenderSection() {
  const titles = { sessions: 'Sessions', encounters: 'Rencontres', npcs: 'PNJ', bestiary: 'Bestiaire', objects: 'Objets', places: 'Lieux' };
  const titleEl = document.getElementById('mj-list-title');
  if (titleEl) titleEl.textContent = titles[_mjSection] || '';

  if (_mjSection === 'sessions') {
    await mjRenderSessionsList();
    mjRenderSessionDetail();
  } else if (_mjSection === 'encounters') {
    await mjRenderEncountersList();
    mjRenderEncounterDetail();
  } else if (_mjSection === 'npcs') {
    await mjRenderNpcsList();
    await mjRenderNpcDetail();
  } else if (_mjSection === 'bestiary') {
    await mjRenderBestiaryList();
    await mjRenderBestiaryDetail();
  } else if (_mjSection === 'objects') {
    await mjRenderObjectsList();
    await mjRenderObjectDetail();
  } else if (_mjSection === 'places') {
    await mjRenderPlacesList();
    await mjRenderPlaceDetail();
  } else if (_mjSection === 'pj') {
```

par :

```js
async function _mjRenderSection() {
  const titles = { sessions: 'Sessions', encounters: 'Rencontres', npcs: 'PNJ', bestiary: 'Bestiaire', objects: 'Objets', places: 'Lieux', maps: 'Cartes' };
  const titleEl = document.getElementById('mj-list-title');
  if (titleEl) titleEl.textContent = titles[_mjSection] || '';

  if (_mjSection === 'sessions') {
    await mjRenderSessionsList();
    mjRenderSessionDetail();
  } else if (_mjSection === 'encounters') {
    await mjRenderEncountersList();
    mjRenderEncounterDetail();
  } else if (_mjSection === 'npcs') {
    await mjRenderNpcsList();
    await mjRenderNpcDetail();
  } else if (_mjSection === 'bestiary') {
    await mjRenderBestiaryList();
    await mjRenderBestiaryDetail();
  } else if (_mjSection === 'objects') {
    await mjRenderObjectsList();
    await mjRenderObjectDetail();
  } else if (_mjSection === 'places') {
    await mjRenderPlacesList();
    await mjRenderPlaceDetail();
  } else if (_mjSection === 'maps') {
    await mjRenderMapsList();
    await mjRenderMapDetail();
  } else if (_mjSection === 'pj') {
```

Remplacer :

```js
  if (section === 'objects')    { _mjObject    = null; }
  if (section === 'places')     { _mjPlace     = null; }
  _mjRenderShell();
```

par :

```js
  if (section === 'objects')    { _mjObject    = null; }
  if (section === 'places')     { _mjPlace     = null; }
  if (section === 'maps')       { _mjMap       = null; }
  _mjRenderShell();
```

Remplacer :

```js
function mjAddNew() {
  if (_mjSection === 'sessions')   mjNewSession();
  if (_mjSection === 'encounters') mjNewEncounter();
  if (_mjSection === 'npcs')       mjNewNpc();
  if (_mjSection === 'bestiary')   mjNewBestiaryEntry();
  if (_mjSection === 'objects')    mjNewObject();
  if (_mjSection === 'places')     mjNewPlace();
  if (_mjSection === 'assets')     mjAddAsset();
}
```

par :

```js
function mjAddNew() {
  if (_mjSection === 'sessions')   mjNewSession();
  if (_mjSection === 'encounters') mjNewEncounter();
  if (_mjSection === 'npcs')       mjNewNpc();
  if (_mjSection === 'bestiary')   mjNewBestiaryEntry();
  if (_mjSection === 'objects')    mjNewObject();
  if (_mjSection === 'places')     mjNewPlace();
  if (_mjSection === 'maps')       mjNewMap();
  if (_mjSection === 'assets')     mjAddAsset();
}
```

- [ ] **Step 3 : Charger le script**

Dans `index.html`, remplacer :

```html
<script src="js/mj/bestiary.js?v=1.6.0"></script>
```

par :

```html
<script src="js/mj/bestiary.js?v=1.6.0"></script>
<script src="js/mj/maps.js?v=1.7.0"></script>
```

- [ ] **Step 4 : Vérification manuelle**

1. Ouvrir Mode MJ → onglet « 🗺️ Cartes » visible entre Lieux et Images.
2. « ＋ Nouveau » → carte créée, nom éditable, focus automatique sur le nom.
3. « 🖼️ Image » → uploader une image → elle s'affiche pleine largeur dans le
   détail.
4. Recharger (F5), rouvrir Mode MJ > Cartes → carte et image toujours là.
5. Clic droit sur la carte dans la liste → Supprimer → carte et son image
   disparaissent (asset bien supprimé, vérifier `await
   db.mj_assets.toArray()` en console ne contient plus l'entrée).
6. Aucune erreur console.

- [ ] **Step 5 : Commit**

```bash
git add js/mj/maps.js js/mj/view.js index.html
git commit -m "feat(cartes): écran Mode MJ liste+détail (image de fond)"
```

---

### Task 3 : Pins — créer, éditer, supprimer ✅ DONE (8625d54, reviews OK + 3 fix qualité)

**Files:**
- Modify: `js/mj/maps.js`

- [ ] **Step 1 : État et rendu des pins dans le canvas**

Dans `js/mj/maps.js`, remplacer :

```js
let _mjMap = null;
```

par :

```js
let _mjMap = null;
let _mjMapEditingPinId = null;   // id du pin en cours d'édition (carte flottante ouverte), ou null
```

Remplacer :

```js
  const m = _mjMap;
  let canvasHtml;
  if (m.assetId) {
    const url = await mjAssetToUrl(m.assetId);
    canvasHtml = url
      ? `<div class="mj-map-canvas" style="position:relative;width:100%;">
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
        </div>`
      : `<div class="mj-detail-empty">🗺️<br>Image introuvable</div>`;
  } else {
    canvasHtml = `<div class="mj-detail-empty">🗺️<br>Ajoute une image de fond</div>`;
  }
```

par :

```js
  const m = _mjMap;
  let canvasHtml;
  if (m.assetId) {
    const url = await mjAssetToUrl(m.assetId);
    canvasHtml = url
      ? `<div class="mj-map-canvas" style="position:relative;width:100%;"
            oncontextmenu="return mjMapCanvasContextMenu(event, '${m.id}')">
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
          ${(m.pins || []).map(p => _mjMapRenderPin(p)).join('')}
        </div>`
      : `<div class="mj-detail-empty">🗺️<br>Image introuvable</div>`;
  } else {
    canvasHtml = `<div class="mj-detail-empty">🗺️<br>Ajoute une image de fond</div>`;
  }
```

- [ ] **Step 2 : Ajouter les fonctions de rendu et d'action des pins**

Dans `js/mj/maps.js`, à la fin du fichier, ajouter :

```js

// ── Pins ──────────────────────────────────────────────────────
function _mjMapRenderPin(p) {
  const editing = _mjMapEditingPinId === p.id;
  return `
    <div class="mj-map-pin" data-pin-id="${p.id}"
      style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-100%);z-index:${editing ? 30 : 10};"
      onmouseenter="_mjMapPinShowPopup(this)"
      onmouseleave="_mjMapPinHidePopup(this)"
      onclick="mjMapEditPin('${p.id}')"
      oncontextmenu="return mjItemContext(event, () => mjMapDeletePinConfirm('${p.id}'))">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--red);
        display:flex;align-items:center;justify-content:center;font-size:12px;
        box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;">📍</div>
      <div class="mj-map-pin-pop" style="display:none;position:absolute;min-width:160px;max-width:240px;
        background:var(--white);border:1.5px solid var(--divider);border-radius:10px;padding:10px 12px;
        box-shadow:0 8px 28px rgba(0,0,0,.18);">
        ${_mjMapPinPopupHtml(p)}
      </div>
      ${editing ? _mjMapPinEditHtml(p) : ''}
    </div>`;
}

function _mjMapPinPopupHtml(p) {
  const linkHtml = _mjMapPinLinkHtml(p);
  return `
    <div style="font-size:12.5px;font-weight:900;color:var(--text);margin-bottom:4px;">${escapeHtml(p.title || 'Sans titre')}</div>
    ${p.text ? `<div style="font-size:11.5px;font-weight:700;color:var(--text-light);margin-bottom:${linkHtml ? '6px' : '0'};">${escapeHtml(p.text)}</div>` : ''}
    ${linkHtml}`;
}

// Résolution du lien affiché dans le popup de survol — remplacée en Task 4.
function _mjMapPinLinkHtml(p) { return ''; }

// Positionne le popup de survol pour qu'il reste dans les limites du canvas
// (mesure la taille réelle après rendu, comme le clamp du menu contextuel
// combat — voir js/combat/view.js:_openCvCtx).
function _mjMapPinShowPopup(el) {
  if (_mjMapEditingPinId) return;   // une carte d'édition est déjà ouverte, pas d'aperçu en plus
  const pop = el.querySelector('.mj-map-pin-pop');
  if (!pop) return;
  pop.style.display = 'block';
  pop.style.left = '0px'; pop.style.top = '0px';
  const canvas = el.closest('.mj-map-canvas');
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();
  const dotRect = el.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let left = (dotRect.width / 2) - (popRect.width / 2);
  let top  = -popRect.height - 8;
  const absLeft = dotRect.left + left;
  if (absLeft < canvasRect.left) left += (canvasRect.left - absLeft);
  if (absLeft + popRect.width > canvasRect.right) left -= (absLeft + popRect.width - canvasRect.right);
  if (dotRect.top + top < canvasRect.top) top = dotRect.height + 8;   // pas de place au-dessus → bascule en dessous
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
function _mjMapPinHidePopup(el) {
  const pop = el.querySelector('.mj-map-pin-pop');
  if (pop) pop.style.display = 'none';
}

function _mjMapPinEditHtml(p) {
  return `
    <div class="mj-map-pin-edit" onclick="event.stopPropagation()"
      style="position:absolute;left:28px;top:-8px;width:220px;background:var(--white);
      border:1.5px solid var(--divider);border-radius:12px;padding:12px;
      box-shadow:0 10px 32px rgba(0,0,0,.22);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:900;color:var(--text-light);letter-spacing:.6px;">MODIFIER LE PIN</span>
        <button onclick="mjMapCloseEditPin()" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <input class="mj-field-input" style="width:100%;margin-bottom:8px;box-sizing:border-box;" placeholder="Titre"
        value="${escapeHtml(p.title || '')}" onchange="mjMapSavePinField('${p.id}','title',this.value)"/>
      <textarea class="mj-field-input" style="width:100%;min-height:56px;resize:vertical;margin-bottom:4px;box-sizing:border-box;"
        placeholder="Texte court…" maxlength="200"
        oninput="mjMapPinTextCounter('${p.id}',this)"
        onchange="mjMapSavePinField('${p.id}','text',this.value)">${escapeHtml(p.text || '')}</textarea>
      <div id="mj-pin-counter-${p.id}" style="font-size:10px;color:var(--text-light);text-align:right;margin-bottom:8px;">${(p.text || '').length}/200</div>
      ${_mjMapPinLinkChipHtml(p)}
    </div>`;
}
function mjMapPinTextCounter(pinId, el) {
  const c = document.getElementById('mj-pin-counter-' + pinId);
  if (c) c.textContent = el.value.length + '/200';
}

// Zone lien dans la carte d'édition — remplacée en Task 4.
function _mjMapPinLinkChipHtml(p) { return ''; }

function mjMapEditPin(pinId) {
  _mjMapEditingPinId = _mjMapEditingPinId === pinId ? null : pinId;
  mjRenderMapDetail();
}
function mjMapCloseEditPin() {
  _mjMapEditingPinId = null;
  mjRenderMapDetail();
}

async function mjMapCanvasContextMenu(ev, mapId) {
  ev.preventDefault();
  const canvas = ev.currentTarget.getBoundingClientRect();
  const x = ((ev.clientX - canvas.left) / canvas.width) * 100;
  const y = ((ev.clientY - canvas.top) / canvas.height) * 100;
  await mjMapAddPin(mapId, x, y);
  return false;
}

async function mjMapAddPin(mapId, x, y) {
  const map = await mjGetMap(mapId);
  if (!map) return;
  const pin = { id: 'pin_' + Math.random().toString(36).slice(2, 9), x, y, title: 'Nouveau point', text: '', link: null };
  map.pins = [...(map.pins || []), pin];
  await mjSaveMap(map);
  _mjMap = map;
  _mjMapEditingPinId = pin.id;
  await mjRenderMapDetail();
}

async function mjMapSavePinField(pinId, field, value) {
  if (!_mjMap) return;
  const pin = (_mjMap.pins || []).find(p => p.id === pinId);
  if (!pin) return;
  pin[field] = value;
  await mjSaveMap(_mjMap);
}

function mjMapDeletePinConfirm(pinId) {
  appConfirm('Supprimer ce pin ? Cette action est définitive.', async () => {
    if (!_mjMap) return;
    _mjMap.pins = (_mjMap.pins || []).filter(p => p.id !== pinId);
    await mjSaveMap(_mjMap);
    if (_mjMapEditingPinId === pinId) _mjMapEditingPinId = null;
    await mjRenderMapsList();
    await mjRenderMapDetail();
  }, { okLabel: 'Supprimer', danger: true });
}
```

- [ ] **Step 3 : Vérification manuelle**

1. Sur une carte avec image, clic droit sur une zone vide → un pin apparaît
   exactement à l'endroit cliqué, carte d'édition flottante ouverte.
2. Écrire un titre et un texte (vérifier le compteur `n/200` qui avance en
   tapant, et que la saisie est bloquée à 200 caractères).
3. Fermer la carte d'édition (✕) → pin visible sur le canvas.
4. Survoler le pin → popup titre+texte apparaît, disparaît en sortant.
5. Recharger (F5), rouvrir la carte → pin toujours là avec son titre/texte.
6. Clic droit sur le pin → Supprimer → confirmation → pin disparaît, compteur
   de la liste des cartes à jour (« N pins »).
7. Créer 2-3 pins proches des bords de l'image (haut, gauche, droite) →
   vérifier que le popup de survol reste visible dans le cadre du canvas
   (bascule en dessous / se décale plutôt que de sortir de l'écran).
8. Aucune erreur console.

- [ ] **Step 4 : Commit**

```bash
git add js/mj/maps.js
git commit -m "feat(cartes): pins — créer, éditer, supprimer"
```

---

### Task 4 : Lien du pin — sélecteur et navigation ✅ DONE (95949d7, reviews OK + 2 bugs corrigés)

**Files:**
- Modify: `js/mj/maps.js`

- [ ] **Step 1 : Résolution et affichage du lien dans le popup de survol**

Dans `js/mj/maps.js`, remplacer :

```js
// Résolution du lien affiché dans le popup de survol — remplacée en Task 4.
function _mjMapPinLinkHtml(p) { return ''; }
```

par :

```js
// Résolution du lien affiché dans le popup de survol : toujours en direct
// via _mjTagIndex, jamais une copie figée du nom (même principe que le
// lien PNJ↔bestiaire ou la Fiche bestiaire en combat).
function _mjMapPinLinkHtml(p) {
  if (!p.link) return '';
  const r = _mjTagIndex.find(x => x.type === p.link.type && String(x.id) === String(p.link.id));
  if (!r) return `<div style="font-size:11px;font-weight:700;color:var(--text-light);font-style:italic;">Lien introuvable (supprimé ?)</div>`;
  const meta = _MJ_TAG_META[r.type];
  return `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--blue);cursor:pointer;"
    onclick="event.stopPropagation();mjTagGo('${r.type}','${r.id}','${r.sessionId || ''}')">
    <span>${meta.icon}</span><span>${escapeHtml(r.name)}</span><span>→</span>
  </div>`;
}
```

- [ ] **Step 2 : Puce de lien / bouton « Lier à… » dans la carte d'édition**

Remplacer :

```js
// Zone lien dans la carte d'édition — remplacée en Task 4.
function _mjMapPinLinkChipHtml(p) { return ''; }
```

par :

```js
// Zone lien dans la carte d'édition : puce du lien actuel (avec bouton pour
// délier) ou bouton pour ouvrir le sélecteur.
function _mjMapPinLinkChipHtml(p) {
  if (p.link) {
    const r = _mjTagIndex.find(x => x.type === p.link.type && String(x.id) === String(p.link.id));
    const label = r ? `${_MJ_TAG_META[r.type].icon} ${escapeHtml(r.name)}` : '⚠️ Lien introuvable';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;
        padding:6px 8px;border-radius:8px;background:var(--bg);font-size:11.5px;font-weight:800;">
        <span>${label}</span>
        <button onclick="mjMapUnlinkPin('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:13px;">✕</button>
      </div>`;
  }
  return `<button class="mj-btn-secondary" style="width:100%;" onclick="mjMapOpenLinkPicker('${p.id}')">🔗 Lier à…</button>`;
}
async function mjMapUnlinkPin(pinId) {
  await mjMapSavePinField(pinId, 'link', null);
  await mjRenderMapDetail();
}
```

- [ ] **Step 3 : Sélecteur de lien (liste cherchable)**

À la fin du fichier, ajouter :

```js

// ── Sélecteur de lien (liste cherchable sur _mjTagIndex) ───────
let _mjMapLinkPickerPinId = null;
function mjMapOpenLinkPicker(pinId) {
  _mjMapLinkPickerPinId = pinId;
  let el = document.getElementById('mj-map-link-picker');
  if (!el) {
    el = document.createElement('div'); el.id = 'mj-map-link-picker';
    el.innerHTML = `
      <div class="mj-wdgctx-backdrop" style="position:fixed;inset:0;" onclick="mjMapCloseLinkPicker()"></div>
      <div class="mj-wdgctx-card" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
        width:min(320px,calc(100vw - 32px));max-height:60vh;display:flex;flex-direction:column;">
        <input id="mj-map-link-search" class="mj-field-input" style="margin:4px;box-sizing:border-box;flex-shrink:0;"
          placeholder="Chercher une ressource…" oninput="mjMapFilterLinkPicker(this.value)"/>
        <div id="mj-map-link-results" style="overflow-y:auto;flex:1;"></div>
      </div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'block';
  mjMapFilterLinkPicker('');
  setTimeout(() => document.getElementById('mj-map-link-search')?.focus(), 50);
}
function mjMapCloseLinkPicker() {
  const el = document.getElementById('mj-map-link-picker');
  if (el) el.style.display = 'none';
  _mjMapLinkPickerPinId = null;
}
function mjMapFilterLinkPicker(q) {
  const box = document.getElementById('mj-map-link-results');
  if (!box) return;
  const query = q.trim().toLowerCase();
  const items = (query ? _mjTagIndex.filter(r => r.lname.includes(query)) : _mjTagIndex.slice()).slice(0, 40);
  box.innerHTML = items.length === 0
    ? `<div class="mj-ac-empty">Aucun résultat</div>`
    : items.map(r => `
      <div class="mj-ac-item" onclick="mjMapPickLink('${r.type}','${r.id}')">
        <span class="mj-ac-ico">${r.icon}</span>
        <span class="mj-ac-name">${escapeHtml(r.name)}</span>
        <span class="mj-ac-type">${_MJ_TAG_META[r.type].label}</span>
      </div>`).join('');
}
async function mjMapPickLink(type, id) {
  const pinId = _mjMapLinkPickerPinId;
  mjMapCloseLinkPicker();
  if (!pinId) return;
  await mjMapSavePinField(pinId, 'link', { type, id });
  await mjRenderMapDetail();
}
```

- [ ] **Step 4 : Vérification manuelle**

1. Ouvrir la carte d'édition d'un pin → « 🔗 Lier à… » visible.
2. Cliquer → liste cherchable s'ouvre, filtrer par nom (PNJ, lieu, etc.) →
   résultats corrects avec icône + type.
3. Choisir un PNJ → carte d'édition affiche la puce du lien (icône+nom), «
   Lier à… » disparaît.
4. Fermer l'édition, survoler le pin → popup affiche le lien, cliquer sur
   le lien → bascule sur l'onglet PNJ et sélectionne le bon PNJ.
5. Créer une deuxième carte, ouvrir un pin de la première, lier vers cette
   deuxième carte (apparaît dans la liste sous « Carte ») → cliquer le lien
   dans le popup de survol bascule bien sur l'onglet Cartes et sélectionne
   la bonne carte.
6. Rouvrir le pin lié, cliquer ✕ sur la puce → lien retiré, « Lier à… »
   réapparaît.
7. Supprimer le PNJ lié depuis l'écran PNJ, revenir sur le pin qui le
   liait → popup de survol affiche « Lien introuvable (supprimé ?) » sans
   erreur console.
8. Aucune erreur console à chaque étape.

- [ ] **Step 5 : Commit**

```bash
git add js/mj/maps.js
git commit -m "feat(cartes): lien de pin — sélecteur et navigation croisée"
```

---

### Task 5 : Masquer les pins (mode présentation) ✅ DONE (d930b5a, reviews OK + 1 fix)

**Files:**
- Modify: `js/mj/maps.js`

- [ ] **Step 1 : État transitoire + bouton dans l'en-tête**

Dans `js/mj/maps.js`, remplacer :

```js
let _mjMap = null;
let _mjMapEditingPinId = null;   // id du pin en cours d'édition (carte flottante ouverte), ou null
```

par :

```js
let _mjMap = null;
let _mjMapEditingPinId = null;   // id du pin en cours d'édition (carte flottante ouverte), ou null
let _mjMapHidePins = false;      // mode présentation : masque tous les pins, jamais persisté
```

Remplacer :

```js
async function mjSelectMap(id) {
  _mjMap = await mjGetMap(id);
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await mjRenderMapsList();
  await mjRenderMapDetail();
}
```

par :

```js
async function mjSelectMap(id) {
  _mjMap = await mjGetMap(id);
  _mjMapHidePins = false;   // repart toujours affiché à l'ouverture d'une carte
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await mjRenderMapsList();
  await mjRenderMapDetail();
}
```

Remplacer :

```js
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-secondary" onclick="mjMapUploadImage('${m.id}')">🖼️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeleteMapConfirm('${m.id}')">🗑️</button>
      </div>
```

par :

```js
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-secondary" onclick="mjMapToggleHidePins()">${_mjMapHidePins ? '👁️ Afficher les pins' : '👁️ Masquer les pins'}</button>
        <button class="mj-btn-secondary" onclick="mjMapUploadImage('${m.id}')">🖼️ Image</button>
        <button class="mj-btn-danger" onclick="mjDeleteMapConfirm('${m.id}')">🗑️</button>
      </div>
```

Remplacer :

```js
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
          ${(m.pins || []).map(p => _mjMapRenderPin(p)).join('')}
```

par :

```js
          <img src="${url}" style="width:100%;height:auto;display:block;border-radius:12px;"/>
          ${_mjMapHidePins ? '' : (m.pins || []).map(p => _mjMapRenderPin(p)).join('')}
```

- [ ] **Step 2 : Fonction de bascule + désactiver l'ajout de pin en mode présentation**

Remplacer :

```js
async function mjMapCanvasContextMenu(ev, mapId) {
  ev.preventDefault();
  const canvas = ev.currentTarget.getBoundingClientRect();
```

par :

```js
function mjMapToggleHidePins() {
  _mjMapHidePins = !_mjMapHidePins;
  if (_mjMapHidePins) _mjMapEditingPinId = null;   // pas d'édition ouverte en mode présentation
  mjRenderMapDetail();
}

async function mjMapCanvasContextMenu(ev, mapId) {
  ev.preventDefault();
  if (_mjMapHidePins) return false;   // pas de création de pin en mode présentation
  const canvas = ev.currentTarget.getBoundingClientRect();
```

- [ ] **Step 3 : Vérification manuelle**

1. Ouvrir une carte avec plusieurs pins → « 👁️ Masquer les pins » visible.
2. Cliquer → tous les pins disparaissent, l'image reste seule, le bouton
   devient « 👁️ Afficher les pins ».
3. Clic droit sur le canvas en mode masqué → aucun nouveau pin créé.
4. Cliquer « 👁️ Afficher les pins » → pins réapparaissent.
5. Changer de section (ex. PNJ) puis revenir sur la même carte → pins
   réaffichés par défaut, même si on les avait masqués juste avant.
6. Aucune erreur console.

- [ ] **Step 4 : Commit**

```bash
git add js/mj/maps.js
git commit -m "feat(cartes): masquer les pins (mode présentation)"
```

---

### Task 6 : Export/Import ZIP et remap des liens de pins ✅ DONE (b1aff47, reviews OK)

**Files:**
- Modify: `js/mj/db.js` (`mjExportZip`, `mjImportZip`)

- [ ] **Step 1 : Inclure les cartes dans l'export**

Dans `js/mj/db.js`, remplacer :

```js
  const [sessions, encounters, npcs, objects, places, allAssets] = await Promise.all([
    mjGetSessions(), mjGetEncounters(), mjGetNpcs(), mjGetObjects(), mjGetPlaces(),
    db.mj_assets.toArray(),
  ]);
```

par :

```js
  const [sessions, encounters, npcs, objects, places, allAssets, maps] = await Promise.all([
    mjGetSessions(), mjGetEncounters(), mjGetNpcs(), mjGetObjects(), mjGetPlaces(),
    db.mj_assets.toArray(), mjGetMaps(),
  ]);
```

Remplacer :

```js
  const data = {
    version: APP_CONFIG.version,
    exportedAt: new Date().toISOString(),
    bestiary: bestiaryGetAll(),
    sessions,
    encounters,
    npcs,
    objects,
    places,
    assetMeta: allAssets.map(a => ({ id: a.id, name: a.name, mimeType: a.mimeType })),
  };
```

par :

```js
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
```

- [ ] **Step 2 : Remapper les ids pendant l'import**

Remplacer :

```js
  for (const s of (data.sessions   || [])) { const {id,...rest}=s; await mjSaveSession(remap(rest)); }
  for (const e of (data.encounters || [])) { const {id,...rest}=e; await mjSaveEncounter(remap(rest)); }
  for (const n of (data.npcs       || [])) { const {id,...rest}=n; await mjSaveNpc(remap(rest)); }
  for (const o of (data.objects    || [])) { const {id,...rest}=o; await mjSaveObject(remap(rest)); }
  for (const p of (data.places     || [])) { const {id,...rest}=p; await mjSavePlace(remap(rest)); }

  // Le bestiaire vit dans IndexedDB (table mj_bestiary). On isole son échec
  // (table verrouillée, quota IndexedDB, etc.) et on l'exécute en dernier
  // pour qu'il n'empêche jamais la restauration des sessions/PNJ/objets/
  // lieux/assets ci-dessus.
  let bestiaryFailed = false;
  if (data.bestiary) {
    try { await bestiarySave(data.bestiary); } catch (err) { console.error('[mjImportZip] bestiaire', err); bestiaryFailed = true; }
  }

  alert(bestiaryFailed
    ? "Import réussi (le bestiaire personnalisé n'a pas pu être restauré : stockage plein ou indisponible)."
    : 'Import réussi !');
  await _mjRenderAll();
```

par :

```js
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
  // l'id de la carte elle-même. Seuls les liens de pins vers encounter/npc/
  // objet/lieu ont besoin d'être corrigés ; scenario (id 'doc_xxx') et carte
  // (id 'map_xxx') sont déjà stables, aucun remap nécessaire pour eux.
  const idMapByType = { encounter: encounterIdMap, npc: npcIdMap, objet: objectIdMap, lieu: placeIdMap };
  let mapsFailed = false;
  if (data.maps) {
    try {
      for (const m of data.maps) {
        const fixedPins = (m.pins || []).map(p => {
          if (!p.link) return p;
          const idMap = idMapByType[p.link.type];
          if (!idMap) return p;   // scenario / carte / asset : id déjà stable
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
```

- [ ] **Step 3 : Vérification manuelle**

1. Créer un PNJ « Test PNJ », une carte « Test carte » avec une image, un pin
   lié à ce PNJ, et un deuxième pin lié à une deuxième carte « Test carte 2 ».
2. Exporter un ZIP.
3. En console : `await db.mj_npcs.clear(); await db.mj_maps.clear(); await
   db.mj_assets.clear();` (vider comme si on repartait de zéro).
4. Importer le ZIP exporté à l'étape 2.
5. Rouvrir « Test carte » → l'image de fond est revenue, les deux pins sont
   là, le premier pin toujours lié à « Test PNJ » (nouvel id, mais le lien
   résout correctement le nom), le deuxième toujours lié à « Test carte 2 »
   (id de carte inchangé).
6. Répéter en supprimant côté ZIP le PNJ ciblé avant réimport (édite le
   `data.json` du zip pour retirer l'entrée, ou vide `mj_npcs` sans
   réimporter les PNJ) → le pin garde son titre/texte, son lien devient
   « introuvable » plutôt que de planter l'import entier ou perdre le pin.
7. Aucune erreur console à aucune étape ; le message final d'import reste
   clair (mentionne un échec seulement si un échec a réellement eu lieu).

- [ ] **Step 4 : Commit**

```bash
git add js/mj/db.js
git commit -m "feat(cartes): export/import ZIP + remap des liens de pins"
```

---

## Self-Review

**Couverture spec :**
- §1 (modèle de données, id stable) → Task 1.
- §2 (écran Mode MJ) → Task 2.
- §3 (interactions des pins : créer/éditer/survoler/supprimer) → Task 3.
- §4 (lien du pin, résolution live, navigation croisée) → Task 4.
- §5 (intégrité : suppression totale, export/import + remap) → Task 1 (wipe)
  + Task 6 (ZIP).
- §6 hors périmètre (vue joueur, icônes par type, lien bestiaire/session
  entière, zoom/pan, drag-and-drop, persistance du masquage) → respecté,
  aucune tâche n'y contrevient.
- §7 scénarios de test → repris dans les étapes de vérification de chaque
  tâche (création carte+image, pins CRUD, lien+navigation, masquage,
  export/import avec remap, suppression totale).

**Cohérence des noms :** `mjGetMaps/mjGetMap/mjSaveMap/mjDeleteMap`,
`newMapId` (Task 1) ; `mjRenderMapsList/Detail`, `mjSelectMap`, `mjNewMap`,
`mjMapUploadImage`, `mjMapSaveField`, `mjDeleteMapConfirm` (Task 2) ;
`_mjMapRenderPin`, `_mjMapPinPopupHtml`, `_mjMapPinEditHtml`,
`mjMapEditPin/CloseEditPin`, `mjMapCanvasContextMenu`, `mjMapAddPin`,
`mjMapSavePinField`, `mjMapDeletePinConfirm` (Task 3) ; `_mjMapPinLinkHtml`,
`_mjMapPinLinkChipHtml`, `mjMapUnlinkPin`, `mjMapOpenLinkPicker` et sa
famille (Task 4) ; `_mjMapHidePins`, `mjMapToggleHidePins` (Task 5) —
utilisés de façon identique partout où ils apparaissent, sans collision
avec les noms déjà utilisés par les autres écrans MJ.

**Ordre des tâches :** Task 1 (fondation) avant tout le reste. Task 2 en
dépend (utilise `mjGetMaps`/`mjSaveMap`/etc.) mais est indépendante des
pins. Task 3 dépend de Task 2 (le canvas doit exister). Task 4 dépend de
Task 3 (les fonctions qu'elle remplace sont créées en Task 3 comme stubs
`return ''`). Task 5 dépend de Task 2/3 (bouton dans l'en-tête, rendu des
pins). Task 6 dépend de tout le reste (remap des liens de pins, qui
n'existent qu'à partir de Task 3/4) — placée en dernier à raison.
