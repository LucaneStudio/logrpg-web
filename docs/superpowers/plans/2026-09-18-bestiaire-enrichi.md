# Bestiaire enrichi (Groupe B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le bestiaire devient une vraie ressource Mode MJ (IndexedDB, stats libres + notes riches, écran liste+détail), reste consultable une fois un monstre engagé en combat, et une fiche PNJ peut être liée à une fiche bestiaire.

**Architecture:** Le stockage du bestiaire (`js/combat/bestiary.js`) passe de `localStorage` à IndexedDB (nouvelle table `mj_bestiary`, clé primaire explicite pour préserver les ids existants), derrière un cache mémoire qui garde `bestiaryGetAll()` synchrone pour tous les appelants existants. Une nouvelle UI Mode MJ (`js/mj/bestiary.js`) réutilise le patron liste+détail déjà en place pour les PNJ. Le combat (`js/combat/state.js`/`view.js`) et les PNJ (`js/mj/npcs.js`) gagnent chacun un lien optionnel vers une entrée bestiaire.

**Tech Stack:** Vanilla JS, Dexie/IndexedDB (déjà en place), vérification manuelle via le serveur statique du projet (`.claude/launch.json`, `logrpg-static`, port 8777) — pas de test automatisé possible pour cette tâche (dépend d'IndexedDB, hors de la convention `tests/*.html` déjà utilisée pour la logique pure).

**Spec :** `docs/superpowers/specs/2026-09-18-bestiaire-enrichi-design.md`

---

### Task 1 : Migration IndexedDB + cache mémoire ✅ DONE (1d80b60 + 3 fix, reviews OK)

**Files:**
- Modify: `js/mj/db.js` (nouvelle migration Dexie)
- Modify: `js/combat/bestiary.js` (réécriture complète, IndexedDB au lieu de localStorage)
- Modify: `js/combat/setup.js:20, :36 (removeFromBestiary), :318-327 (submitManualParticipantAndSave)`
- Modify: `js/mj/db.js` (`mjImportZip` — ajoute un `await`)

- [ ] **Step 1: Nouvelle table Dexie**

Dans `js/mj/db.js`, remplacer :

```js
// Migration v3 : ajout des objets et lieux (ressources taggables)
db.version(3).stores({
  mj_objects: '++id, name',
  mj_places : '++id, name',
});
```

par :

```js
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
```

- [ ] **Step 2: Réécrire `js/combat/bestiary.js`**

Remplacer tout le contenu du fichier par :

```js
// COMBAT BESTIARY — templates de monstres/PNJ sauvegardés
// ═══════════════════════════════════════════════════════════════
// Stockage IndexedDB (table mj_bestiary). bestiaryGetAll() reste SYNCHRONE
// (lit un cache mémoire) car appelée depuis du code de rendu existant qui
// ne peut pas devenir async sans remaniement disproportionné
// (js/combat/setup.js, js/mj/encounters.js, js/mj/tags.js).

const _BESTIARY_KEY = 'logrpg_bestiary'; // ancienne clé localStorage, migration one-shot
let _bestiaryCache = [];

function newBestiaryId() { return 'bt_' + Math.random().toString(36).slice(2, 9); }

// Charge le cache depuis IndexedDB ; migre le localStorage historique s'il
// en reste (bulkPut = insert-ou-remplace par id, donc rejouable sans risque
// de doublon). Appelée à l'ouverture de Mode MJ et de l'écran de combat.
async function bestiaryLoad() {
  const legacyRaw = localStorage.getItem(_BESTIARY_KEY);
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy) && legacy.length) {
        await db.mj_bestiary.bulkPut(legacy.map(t => ({
          id: t.id, name: t.name, type: t.type, maxHp: t.maxHp,
          initiative: t.initiative, stats: t.stats || [], notes: t.notes || '',
        })));
      }
    } catch (err) { console.error('[bestiaryLoad] migration localStorage', err); }
  }
  _bestiaryCache = await db.mj_bestiary.toArray();
}

function bestiaryGetAll() { return _bestiaryCache; }

async function bestiaryAdd(name, type, maxHp, initiative) {
  const entry = { id: newBestiaryId(), name: name.trim(), type, maxHp, initiative, stats: [], notes: '' };
  await db.mj_bestiary.put(entry);
  await bestiaryLoad();
  return entry.id;
}

async function bestiarySaveEntry(entry) {
  await db.mj_bestiary.put(entry);
  await bestiaryLoad();
}

async function bestiaryRemove(id) {
  await db.mj_bestiary.delete(id);
  await bestiaryLoad();
}

// Restauration ZIP complète (mjImportZip) : remplace tout le contenu de la table.
async function bestiarySave(templates) {
  await db.mj_bestiary.clear();
  await db.mj_bestiary.bulkPut(templates);
  await bestiaryLoad();
}
```

- [ ] **Step 3: Charger le cache à l'ouverture de Mode MJ et du setup combat**

Dans `js/mj/view.js`, remplacer :

```js
async function openMjMode() {
  if (window.innerWidth < 1100) return;
  document.getElementById('mj-overlay').style.display = 'flex';
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderAll();
}
```

par :

```js
async function openMjMode() {
  if (window.innerWidth < 1100) return;
  document.getElementById('mj-overlay').style.display = 'flex';
  await bestiaryLoad();
  if (typeof mjBuildTagIndex === 'function') await mjBuildTagIndex();
  await _mjRenderAll();
}
```

Dans `js/combat/setup.js`, remplacer le début de `openCombatSetup` :

```js
async function openCombatSetup(encounter = null) {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE', bestiaryOpen: false, fromMJ: !!encounter };

  if (encounter?.participants?.length) {
    const bestiary = bestiaryGetAll();
```

par :

```js
async function openCombatSetup(encounter = null) {
  combatReset();
  _cSetup = { localSel: new Set(), type: 'MONSTRE', bestiaryOpen: false, fromMJ: !!encounter };
  await bestiaryLoad();

  if (encounter?.participants?.length) {
    const bestiary = bestiaryGetAll();
```

- [ ] **Step 4: Adapter les appelants qui écrivent dans le bestiaire**

Dans `js/combat/setup.js`, remplacer :

```js
function removeFromBestiary(id) {
  bestiaryRemove(id);
  _renderSetup();
}
```

par :

```js
async function removeFromBestiary(id) {
  await bestiaryRemove(id);
  _renderSetup();
}
```

Et remplacer :

```js
function submitManualParticipantAndSave() {
  const name = document.getElementById('setup-manual-name')?.value.trim();
  const hp   = parseInt(document.getElementById('setup-manual-hp')?.value)   || 10;
  const init = parseInt(document.getElementById('setup-manual-init')?.value) || 0;
  const err  = document.getElementById('setup-manual-error');
  if (!name) { if (err) err.textContent = 'Le nom est obligatoire.'; return; }
  if (err) err.textContent = '';
  bestiaryAdd(name, _cSetup.type, Math.max(1, hp), init);
  combatAddParticipant(_uniqueParticipantName(name), _cSetup.type, Math.max(1, hp), init);
  _renderSetup();
}
```

par :

```js
async function submitManualParticipantAndSave() {
  const name = document.getElementById('setup-manual-name')?.value.trim();
  const hp   = parseInt(document.getElementById('setup-manual-hp')?.value)   || 10;
  const init = parseInt(document.getElementById('setup-manual-init')?.value) || 0;
  const err  = document.getElementById('setup-manual-error');
  if (!name) { if (err) err.textContent = 'Le nom est obligatoire.'; return; }
  if (err) err.textContent = '';
  const newId = await bestiaryAdd(name, _cSetup.type, Math.max(1, hp), init);
  combatAddParticipant(_uniqueParticipantName(name), _cSetup.type, Math.max(1, hp), init, null, null, null, null, newId);
  _renderSetup();
}
```

(`combatAddParticipant`'s 9ᵉ paramètre `bestiaryId` n'existe pas encore —
il est ajouté à la Task 3. Cette Task 1 peut être committée avant, l'appel
ci-dessus passera juste un 9ᵉ argument ignoré par la fonction jusque-là :
aucune erreur, `combatAddParticipant` accepte déjà plus d'arguments qu'il
n'en lit.)

Dans `js/mj/db.js`, dans `mjImportZip`, remplacer :

```js
  let bestiaryFailed = false;
  if (data.bestiary) {
    try { bestiarySave(data.bestiary); } catch (err) { console.error('[mjImportZip] bestiaire', err); bestiaryFailed = true; }
  }
```

par :

```js
  let bestiaryFailed = false;
  if (data.bestiary) {
    try { await bestiarySave(data.bestiary); } catch (err) { console.error('[mjImportZip] bestiaire', err); bestiaryFailed = true; }
  }
```

- [ ] **Step 5: Vérification manuelle**

Démarrer le serveur (`logrpg-static`), ouvrir l'app dans le navigateur.

1. Console : `await bestiaryGetAll()` avant tout chargement → tableau vide
   ou entrées migrées si le navigateur avait déjà des entrées en
   localStorage d'une session précédente.
2. Ouvrir Mode MJ, puis « Combat rapide » → section BESTIAIRE toujours
   fonctionnelle (import/ajout/suppression), aucune erreur console.
3. Ajouter un monstre via le formulaire manuel du setup combat (bouton qui
   appelle `submitManualParticipantAndSave`) → apparaît dans la liste
   bestiaire ET dans les participants du combat en préparation.
4. Recharger la page (F5), rouvrir Mode MJ → les entrées bestiaire créées
   à l'étape 3 sont toujours là (persistées en IndexedDB, plus en mémoire
   volatile).
5. Exporter un ZIP MJ (bouton Exporter), vider manuellement la table via
   la console (`await db.mj_bestiary.clear()`), réimporter le ZIP →
   bestiaire restauré à l'identique.

- [ ] **Step 6: Commit**

```bash
git add js/mj/db.js js/combat/bestiary.js js/combat/setup.js
git commit -m "feat(bestiaire): migre le stockage de localStorage vers IndexedDB"
```

---

### Task 2 : Écran Mode MJ « Bestiaire » ✅ DONE (14e3912 + fix mjBuildTagIndex, reviews OK)

**Files:**
- Create: `js/mj/bestiary.js`
- Modify: `js/mj/view.js` (nav + section + import du script dans `index.html`)
- Modify: `index.html` (balise `<script>`)

- [ ] **Step 1: Créer `js/mj/bestiary.js`**

```js
// MJ — BESTIAIRE (écran liste+détail, réutilise le stockage de
// js/combat/bestiary.js — bestiaryGetAll/Add/SaveEntry/Remove)
// ═══════════════════════════════════════════════════════════════

let _mjBestiaryEntry = null;

const MJ_BESTIARY_TYPES = [
  { key: 'MONSTRE', label: 'Monstre', color: 'var(--red)',   bg: 'var(--red-l)'    },
  { key: 'PNJ',      label: 'PNJ',     color: '#B8860B',      bg: 'var(--yellow-l)' },
  { key: 'PJ',       label: 'PJ',      color: 'var(--blue)',  bg: 'var(--blue-l)'   },
];
function _bestiaryTypeMeta(key) { return MJ_BESTIARY_TYPES.find(t => t.key === key) || MJ_BESTIARY_TYPES[0]; }

// ── Liste ─────────────────────────────────────────────────────
async function mjRenderBestiaryList() {
  const entries = bestiaryGetAll();
  const list = document.getElementById('mj-list-body');
  if (!list) return;

  list.innerHTML = entries.length === 0
    ? `<div class="mj-empty">🐉<br>Bestiaire vide.<br>Ajoute la première fiche !</div>`
    : entries.map(e => {
        const tm = _bestiaryTypeMeta(e.type);
        return `
          <div class="mj-item-card ${_mjBestiaryEntry?.id === e.id ? 'active' : ''}"
               onclick="mjSelectBestiaryEntry('${e.id}')"
               oncontextmenu="return mjItemContext(event, () => mjDeleteBestiaryEntryConfirm('${e.id}'))">
            <div class="mj-item-name">${escapeHtml(e.name || 'Sans nom')}</div>
            <div class="mj-item-sub">
              <span class="mj-pill" style="color:${tm.color};background:${tm.bg};">${tm.label}</span>
              <span>❤️ ${e.maxHp} · Init. ${e.initiative}</span>
            </div>
          </div>`;
      }).join('');
}

async function mjSelectBestiaryEntry(id) {
  _mjBestiaryEntry = bestiaryGetAll().find(e => e.id === id) || null;
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
}

// ── Détail ────────────────────────────────────────────────────
async function mjRenderBestiaryDetail() {
  const detail = document.getElementById('mj-detail');
  if (!detail) return;

  if (!_mjBestiaryEntry) {
    detail.innerHTML = `<div class="mj-detail-empty">🐉<br>Sélectionne ou crée une fiche</div>`;
    return;
  }

  const e = _mjBestiaryEntry;
  const typeBtns = MJ_BESTIARY_TYPES.map(t => `
    <button onclick="mjBestiarySetType('${t.key}')"
      style="padding:5px 10px;border-radius:8px;border:1.5px solid ${e.type===t.key?t.color:'var(--divider)'};
      background:${e.type===t.key?t.bg:'transparent'};font-family:'Nunito',sans-serif;font-size:11px;
      font-weight:800;color:${e.type===t.key?t.color:'var(--text-light)'};cursor:pointer;">
      ${t.label}</button>`).join('');

  const statsRows = (e.stats || []).map((s, i) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
      <input class="mj-field-input" style="flex:1;" placeholder="Label" value="${escapeHtml(s.label)}"
        onchange="mjBestiarySetStatField(${i},'label',this.value)"/>
      <input class="mj-field-input" style="flex:1;" placeholder="Valeur" value="${escapeHtml(s.value)}"
        onchange="mjBestiarySetStatField(${i},'value',this.value)"/>
      <button class="mj-btn-sm-danger" onclick="mjBestiaryRemoveStat(${i})">×</button>
    </div>`).join('');

  // Lien PNJ inverse : un PNJ narratif peut pointer vers cette fiche (§5 spec)
  const linkedNpc = (typeof mjGetNpcs === 'function') ? (await mjGetNpcs()).find(n => n.bestiaryId === e.id) : null;
  const reverseLinkHtml = linkedNpc ? `
    <div style="margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--yellow-l);
      display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-size:12px;font-weight:800;color:#8a6d00;">🧑 PNJ narratif lié : ${escapeHtml(linkedNpc.name || 'Sans nom')}</span>
      <button class="mj-btn-secondary" onclick="mjSwitchSection('npcs');setTimeout(()=>mjSelectNpc(${linkedNpc.id}),0)">Voir</button>
    </div>` : '';

  detail.innerHTML = `
    <div class="mj-detail-hdr">
      <div style="flex:1;min-width:0;">
        <input id="mj-bestiary-name" class="mj-title-input"
          value="${escapeHtml(e.name || '')}" placeholder="Nom de la fiche…"
          onchange="mjBestiarySaveField('name', this.value)"/>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="mj-btn-danger" onclick="mjDeleteBestiaryEntryConfirm('${e.id}')">🗑️</button>
      </div>
    </div>

    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">TYPE</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${typeBtns}</div>

      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div style="flex:1;">
          <div class="sec-lbl" style="margin-bottom:6px;">PV MAX</div>
          <input class="mj-field-input" type="number" value="${e.maxHp}" min="1"
            onchange="mjBestiarySaveField('maxHp', parseInt(this.value)||1)"/>
        </div>
        <div style="flex:1;">
          <div class="sec-lbl" style="margin-bottom:6px;">INITIATIVE</div>
          <input class="mj-field-input" type="number" value="${e.initiative}"
            onchange="mjBestiarySaveField('initiative', parseInt(this.value)||0)"/>
        </div>
      </div>

      <div class="sec-lbl" style="margin-bottom:8px;">STATS</div>
      <div style="margin-bottom:8px;">${statsRows}</div>
      <button class="mj-btn-secondary" onclick="mjBestiaryAddStat()" style="margin-bottom:16px;">＋ Ajouter une stat</button>
      ${reverseLinkHtml}

      <div class="sec-lbl" style="margin:16px 0 8px;">NOTES</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(e.notes || '', mjBestiarySaveNotes);
}

async function mjBestiarySaveNotes() {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.notes = _mjBlocksToContent();
  await bestiarySaveEntry(_mjBestiaryEntry);
}

// ── Actions ───────────────────────────────────────────────────
async function mjBestiarySaveField(field, value) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry[field] = value;
  await bestiarySaveEntry(_mjBestiaryEntry);
  if (field === 'name') await mjRenderBestiaryList();
}

async function mjBestiarySetType(type) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.type = type;
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
}

async function mjBestiaryAddStat() {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats = [...(_mjBestiaryEntry.stats || []), { label: '', value: '' }];
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryDetail();
}

async function mjBestiarySetStatField(i, field, value) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats[i][field] = value;
  await bestiarySaveEntry(_mjBestiaryEntry);
}

async function mjBestiaryRemoveStat(i) {
  if (!_mjBestiaryEntry) return;
  _mjBestiaryEntry.stats.splice(i, 1);
  await bestiarySaveEntry(_mjBestiaryEntry);
  await mjRenderBestiaryDetail();
}

async function mjNewBestiaryEntry() {
  const id = await bestiaryAdd('Nouvelle fiche', 'MONSTRE', 10, 0);
  _mjBestiaryEntry = bestiaryGetAll().find(e => e.id === id);
  await mjRenderBestiaryList();
  await mjRenderBestiaryDetail();
  setTimeout(() => document.getElementById('mj-bestiary-name')?.focus(), 100);
}

function mjDeleteBestiaryEntryConfirm(id) {
  appConfirm('Supprimer cette fiche ? Cette action est définitive.', async () => {
    await bestiaryRemove(id);
    if (_mjBestiaryEntry && _mjBestiaryEntry.id === id) _mjBestiaryEntry = null;
    await mjRenderBestiaryList();
    await mjRenderBestiaryDetail();
  }, { okLabel: 'Supprimer', danger: true });
}
```

- [ ] **Step 2: Ajouter l'onglet dans la nav Mode MJ**

Dans `js/mj/view.js`, remplacer :

```js
        <button class="mj-nav-btn ${_mjSection==='npcs'?'on':''}"
          onclick="mjSwitchSection('npcs')">👥 PNJ</button>
        <button class="mj-nav-btn ${_mjSection==='objects'?'on':''}"
          onclick="mjSwitchSection('objects')">📦 Objets</button>
```

par :

```js
        <button class="mj-nav-btn ${_mjSection==='npcs'?'on':''}"
          onclick="mjSwitchSection('npcs')">👥 PNJ</button>
        <button class="mj-nav-btn ${_mjSection==='bestiary'?'on':''}"
          onclick="mjSwitchSection('bestiary')">🐉 Bestiaire</button>
        <button class="mj-nav-btn ${_mjSection==='objects'?'on':''}"
          onclick="mjSwitchSection('objects')">📦 Objets</button>
```

Remplacer :

```js
async function _mjRenderSection() {
  const titles = { sessions: 'Sessions', encounters: 'Rencontres', npcs: 'PNJ', objects: 'Objets', places: 'Lieux' };
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
  } else if (_mjSection === 'objects') {
```

par :

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
```

Remplacer :

```js
function mjSwitchSection(section) {
  _mjSection = section;
  // Reset sélection
  if (section === 'sessions')   { _mjSession  = null; }
  if (section === 'pj')         { _mjPjCharId = null; }
  if (section === 'assets')     { _mjAssetSelected = null; }
  if (section === 'encounters') { _mjEncounter = null; }
  if (section === 'npcs')       { _mjNpc       = null; }
  if (section === 'objects')    { _mjObject    = null; }
  if (section === 'places')     { _mjPlace     = null; }
```

par :

```js
function mjSwitchSection(section) {
  _mjSection = section;
  // Reset sélection
  if (section === 'sessions')   { _mjSession  = null; }
  if (section === 'pj')         { _mjPjCharId = null; }
  if (section === 'assets')     { _mjAssetSelected = null; }
  if (section === 'encounters') { _mjEncounter = null; }
  if (section === 'npcs')       { _mjNpc       = null; }
  if (section === 'bestiary')   { _mjBestiaryEntry = null; }
  if (section === 'objects')    { _mjObject    = null; }
  if (section === 'places')     { _mjPlace     = null; }
```

Et remplacer (bouton « Nouveau »/import de la liste) :

```js
function mjAddNew() {
  if (_mjSection === 'sessions')   mjNewSession();
  if (_mjSection === 'encounters') mjNewEncounter();
  if (_mjSection === 'npcs')       mjNewNpc();
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
  if (_mjSection === 'assets')     mjAddAsset();
}
```

Note : le bouton « ＋ Nouveau » du header de liste (`mj-add-btn`) n'a pas
de condition d'affichage par section à part `pj`/`assets` (voir
`_mjRenderShell`) — il s'affiche déjà pour `bestiary` sans changement
supplémentaire.

- [ ] **Step 3: Charger le script**

Dans `index.html`, remplacer :

```html
<script src="js/mj/npcs.js?v=1.6.0"></script>
```

par :

```html
<script src="js/mj/npcs.js?v=1.6.0"></script>
<script src="js/mj/bestiary.js?v=1.6.0"></script>
```

- [ ] **Step 4: Vérification manuelle**

1. Ouvrir Mode MJ → onglet « 🐉 Bestiaire » visible entre PNJ et Objets.
2. Créer une fiche (bouton ＋ Nouveau) → nom éditable, type, PV/init,
   ajouter 2 stats libres, écrire une note.
3. Recharger (F5), rouvrir Mode MJ → tout est toujours là.
4. Clic droit sur une fiche dans la liste → Supprimer fonctionne (même
   modale de confirmation que PNJ/Objets).
5. Les entrées créées via l'écran de préparation de combat (Task 1, étape
   5.3) apparaissent bien aussi dans cet écran (même table).
6. Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add js/mj/bestiary.js js/mj/view.js index.html
git commit -m "feat(bestiaire): écran Mode MJ liste+détail (stats libres, notes)"
```

---

### Task 3 : Lien bestiaire conservé pendant le combat ✅ DONE (aa9cd1f + fix bouton fantôme 0bb2936, reviews OK)

**Files:**
- Modify: `js/combat/state.js` (`combatAddParticipant`)
- Modify: `js/combat/setup.js:20, :309` (propager `bestiaryId`)
- Modify: `js/combat/view.js` (bouton « 📋 Fiche » + popup)

- [ ] **Step 1: Ajouter `bestiaryId` au participant**

Dans `js/combat/state.js`, remplacer :

```js
function combatAddParticipant(name, type, maxHp, initiative, localCharId = null, avatarColorOverride = null, avatarPhoto = null, currentHpOverride = null) {
  const p = {
    id: _newCombatId(), name, type, localCharId,
    currentHp: (currentHpOverride !== null ? currentHpOverride : maxHp), maxHp, tempHp: 0, initiative,
    initiativeBonus: 0, pendingBonus: 0,
    conditions: [], status: 'ACTIVE',
    avatarColor: avatarColorOverride || combatColorFor(name),
    avatarLetter: (name[0] || '?').toUpperCase(),
    avatarPhoto: avatarPhoto || null,
  };
  _combat.participants.push(p);
  return p;
}
```

par :

```js
function combatAddParticipant(name, type, maxHp, initiative, localCharId = null, avatarColorOverride = null, avatarPhoto = null, currentHpOverride = null, bestiaryId = null) {
  const p = {
    id: _newCombatId(), name, type, localCharId,
    currentHp: (currentHpOverride !== null ? currentHpOverride : maxHp), maxHp, tempHp: 0, initiative,
    initiativeBonus: 0, pendingBonus: 0,
    conditions: [], status: 'ACTIVE',
    avatarColor: avatarColorOverride || combatColorFor(name),
    avatarLetter: (name[0] || '?').toUpperCase(),
    avatarPhoto: avatarPhoto || null,
    bestiaryId,
  };
  _combat.participants.push(p);
  return p;
}
```

- [ ] **Step 2: Propager l'id depuis les deux points d'entrée bestiaire**

Dans `js/combat/setup.js`, remplacer (dans `openCombatSetup`, réimport
d'une rencontre préparée) :

```js
        for (let i = 0; i < (ep.qty || 1); i++) {
          combatAddParticipant(_uniqueParticipantName(t.name), t.type, t.maxHp, t.initiative);
        }
```

par :

```js
        for (let i = 0; i < (ep.qty || 1); i++) {
          combatAddParticipant(_uniqueParticipantName(t.name), t.type, t.maxHp, t.initiative, null, null, null, null, t.id);
        }
```

Et remplacer (`addFromBestiary`) :

```js
function addFromBestiary(id) {
  const t = bestiaryGetAll().find(t => t.id === id);
  if (!t) return;
  const uniqueName = _uniqueParticipantName(t.name);
  combatAddParticipant(uniqueName, t.type, t.maxHp, t.initiative);
  _renderSetup();
}
```

par :

```js
function addFromBestiary(id) {
  const t = bestiaryGetAll().find(t => t.id === id);
  if (!t) return;
  const uniqueName = _uniqueParticipantName(t.name);
  combatAddParticipant(uniqueName, t.type, t.maxHp, t.initiative, null, null, null, null, t.id);
  _renderSetup();
}
```

(Les autres appelants de `combatAddParticipant` — PJ local, ajout manuel —
n'ont pas de fiche bestiaire à lier : ils continuent de ne pas passer ce
9ᵉ argument, `bestiaryId` reste `null` pour eux, comportement inchangé.)

- [ ] **Step 3: Bouton « 📋 Fiche » + popup en lecture seule**

Dans `js/combat/view.js`, ajouter une nouvelle fonction de rendu (à côté
de `_renderCtxMenu`, par exemple juste avant) :

```js
// ── Fiche bestiaire en lecture seule (bouton 📋 pendant le combat) ───────────
let _cvFicheId = null;   // id du PARTICIPANT (pas de l'entrée bestiaire) dont la fiche est ouverte

function _renderBestiaryFicheModal() {
  const p = _combat.participants.find(p => p.id === _cvFicheId);
  if (!p || !p.bestiaryId) return '';
  const entry = bestiaryGetAll().find(e => e.id === p.bestiaryId);
  if (!entry) return '';

  const statsHtml = (entry.stats || []).length
    ? entry.stats.map(s => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--divider);">
          <span style="font-size:12px;font-weight:800;color:var(--text-light);">${escapeHtml(s.label)}</span>
          <span style="font-size:12px;font-weight:800;color:var(--text);">${escapeHtml(s.value)}</span>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--text-light);font-style:italic;">Aucune stat.</div>`;

  const notesHtml = entry.notes
    ? (typeof _mjMarkdownWithTags === 'function' ? _mjMarkdownWithTags(entry.notes) : escapeHtml(entry.notes))
    : `<div style="font-size:12px;color:var(--text-light);font-style:italic;">Aucune note.</div>`;

  return `
    <div style="position:fixed;inset:0;z-index:5300;background:rgba(20,24,33,.35);display:flex;align-items:center;justify-content:center;"
      onclick="_cvFicheId=null;renderCombatView()">
      <div style="background:var(--white);border-radius:16px;padding:20px;width:min(420px,calc(100vw - 32px));max-height:80vh;overflow-y:auto;"
        onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="font-size:15px;font-weight:900;color:var(--text);">🐉 ${escapeHtml(entry.name)}</span>
          <button onclick="_cvFicheId=null;renderCombatView()" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text-light);">✕</button>
        </div>
        <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:6px;">STATS</div>
        ${statsHtml}
        <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin:14px 0 6px;">NOTES</div>
        ${notesHtml}
      </div>
    </div>`;
}
```

Brancher le rendu de la modale dans `renderCombatView` : remplacer

```js
    ${_cvCtxId    ? _renderCtxMenu()      : ''}`;
```

par

```js
    ${_cvCtxId    ? _renderCtxMenu()      : ''}
    ${_cvFicheId  ? _renderBestiaryFicheModal() : ''}`;
```

Ajouter le bouton dans l'en-tête du panneau détail, à côté du badge
Round. Remplacer :

```js
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <div class="round-badge">Round ${_combat.round}</div>
        <button onclick="openEndCombatModal()" class="cbt-end-btn">🏁 Fin de combat</button>
      </div>
    </div>
```

par :

```js
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        ${p.bestiaryId ? `<button onclick="_cvFicheId='${p.id}';renderCombatView()" class="cbt-cancel-btn" style="padding:6px 12px;">📋 Fiche</button>` : ''}
        <div class="round-badge">Round ${_combat.round}</div>
        <button onclick="openEndCombatModal()" class="cbt-end-btn">🏁 Fin de combat</button>
      </div>
    </div>
```

Ajouter le même bouton dans le menu contextuel (`_renderCtxMenu`), dans la
liste `actions` (juste après la ligne `Bonus / Malus initiative`) :

```js
    ...(p.bestiaryId ? [{ label: '📋 Fiche bestiaire', fn: `_cvFicheId='${p.id}';_cvCtxId=null;renderCombatView()` }] : []),
```

- [ ] **Step 4: Vérification manuelle**

1. Ajouter un monstre au combat depuis le bestiaire (formulaire ou
   panneau bestiaire du setup) → une fois le combat lancé, bouton
   « 📋 Fiche » visible sur ce participant (panneau détail ET menu
   contextuel).
2. Cliquer → popup affiche bien les stats et notes de la fiche bestiaire
   liée. Fermer (✕ ou clic extérieur) → popup disparaît, combat inchangé.
3. Ajouter un participant manuellement (sans bestiaire) → bouton absent
   pour lui.
4. Préparer une rencontre MJ avec un monstre du bestiaire, lancer le
   combat depuis cette rencontre → bouton présent aussi (chemin
   `openCombatSetup(encounter)`, pas seulement `addFromBestiary`).
5. Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add js/combat/state.js js/combat/setup.js js/combat/view.js
git commit -m "feat(combat): bouton Fiche pour consulter les stats bestiaire liées"
```

---

### Task 4 : Lien PNJ ↔ Bestiaire ✅ DONE (implémenté + reviews OK, en attente du commit squash groupe B)

**Files:**
- Modify: `js/mj/npcs.js` (champ `bestiaryId`, bloc de liaison)

- [ ] **Step 1: Bloc « Fiche de combat liée » sur la fiche PNJ**

Dans `js/mj/npcs.js`, remplacer :

```js
    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">STATUT</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${statusBtns}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">NOTES</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(n.notes || '', mjNpcSaveNotes);
}
```

par :

```js
    <div class="mj-detail-body">
      <div class="sec-lbl" style="margin-bottom:8px;">STATUT</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">${statusBtns}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">🐉 FICHE DE COMBAT</div>
      <div style="margin-bottom:16px;">${_mjNpcBestiaryLinkHtml(n)}</div>

      <div class="sec-lbl" style="margin-bottom:8px;">NOTES</div>
      ${mjBlockEditorHtml({ boxed: true })}
    </div>`;
  mjMountBlockEditor(n.notes || '', mjNpcSaveNotes);
}

// ── Lien vers une fiche bestiaire (§5 spec) ───────────────────
function _mjNpcBestiaryLinkHtml(n) {
  if (n.bestiaryId) {
    const entry = (typeof bestiaryGetAll === 'function') ? bestiaryGetAll().find(e => e.id === n.bestiaryId) : null;
    if (!entry) return `<div class="mj-empty-sm">Fiche liée introuvable (supprimée ?).</div>`;
    const statsPreview = (entry.stats || []).slice(0, 3).map(s => `${escapeHtml(s.label)} ${escapeHtml(s.value)}`).join(' · ');
    return `
      <div style="padding:10px 12px;border-radius:10px;background:var(--yellow-l);border:1.5px solid rgba(255,209,102,.4);">
        <div style="font-size:12px;font-weight:900;color:#8a6d00;margin-bottom:4px;">${escapeHtml(entry.name)}</div>
        <div style="font-size:11px;font-weight:700;color:#8a6d00;opacity:.85;">❤️ ${entry.maxHp} PV · Init. ${entry.initiative}${statsPreview ? ' · ' + statsPreview : ''}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="mj-btn-secondary" onclick="mjSwitchSection('bestiary');setTimeout(()=>mjSelectBestiaryEntry('${entry.id}'),0)">Voir la fiche complète</button>
          <button class="mj-btn-secondary" onclick="mjNpcUnlinkBestiary()">Délier</button>
        </div>
      </div>`;
  }
  const options = (typeof bestiaryGetAll === 'function' ? bestiaryGetAll() : [])
    .filter(e => e.id !== n.bestiaryId)
    .map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  return `
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <select id="mj-npc-link-select" class="mj-field-input" style="flex:1;min-width:160px;">
        <option value="">— Choisir une fiche existante —</option>
        ${options}
      </select>
      <button class="mj-btn-secondary" onclick="mjNpcLinkBestiary(document.getElementById('mj-npc-link-select').value)">Lier</button>
      <button class="mj-btn-secondary" onclick="mjNpcCreateLinkedBestiary()">＋ Créer une fiche liée</button>
    </div>`;
}

async function mjNpcLinkBestiary(bestiaryId) {
  if (!_mjNpc || !bestiaryId) return;
  _mjNpc.bestiaryId = bestiaryId;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}

async function mjNpcCreateLinkedBestiary() {
  if (!_mjNpc) return;
  const id = await bestiaryAdd(_mjNpc.name || 'Nouveau PNJ', 'PNJ', 10, 0);
  _mjNpc.bestiaryId = id;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}

async function mjNpcUnlinkBestiary() {
  if (!_mjNpc) return;
  _mjNpc.bestiaryId = null;
  await mjSaveNpc(_mjNpc);
  await mjRenderNpcDetail();
}
```

- [ ] **Step 2: Vérification manuelle**

1. Ouvrir une fiche PNJ → bloc « 🐉 FICHE DE COMBAT » avec un sélecteur
   (vide si aucune fiche bestiaire n'existe encore).
2. Créer une fiche bestiaire depuis ce bloc (« ＋ Créer une fiche liée »)
   → bascule visuellement en état « lié », résumé PV/init affiché.
3. Aller dans Bestiaire → l'entrée nouvellement créée existe (type PNJ,
   nom pré-rempli), et affiche le raccourci « 🧑 PNJ narratif lié ».
4. Depuis le PNJ, cliquer « Voir la fiche complète » → bascule sur
   l'onglet Bestiaire, sélectionne la bonne entrée.
5. Délier (des deux côtés testés séparément) → les deux raccourcis
   disparaissent, aucune des deux fiches n'est supprimée.
6. Lier un PNJ à une fiche bestiaire déjà créée par ailleurs (pas
   « créer liée ») via le sélecteur → fonctionne pareil.
7. Aucune erreur console.

- [ ] **Step 3: Commit**

```bash
git add js/mj/npcs.js
git commit -m "feat(pnj): lien optionnel vers une fiche bestiaire"
```

---

## Self-Review

**Couverture spec :**
- §2/§3 (modèle de données, migration idempotente, id préservés, cache
  synchrone) → Task 1.
- §4 (écran Mode MJ) → Task 2.
- §5 (lien PNJ) → Task 4.
- §6 (combat : bestiaryId propagé, bouton Fiche) → Task 3.
- §7 hors périmètre (pas de fusion PNJ/bestiaire, pas de portrait, pas de
  tag `@`, pas de contrainte technique de liaison unique) → respecté,
  aucune tâche n'y contrevient.
- §8 scénarios de test → repris dans les étapes de vérification de chaque
  tâche (migration + non-duplication, CRUD, combat, lien PNJ, export/
  import ZIP couvert en Task 1 étape 5).

**Cohérence des noms :** `bestiaryGetAll/Add/SaveEntry/Remove/Save`,
`bestiaryLoad`, `_bestiaryCache`, `newBestiaryId` (Task 1) ; `mjRenderBestiaryList/Detail`,
`mjSelectBestiaryEntry`, `mjBestiary*` (Task 2) ; `combatAddParticipant`
9ᵉ paramètre `bestiaryId`, `_cvFicheId`, `_renderBestiaryFicheModal`
(Task 3) ; `_mjNpcBestiaryLinkHtml`, `mjNpcLinkBestiary/CreateLinkedBestiary/UnlinkBestiary`
(Task 4) — utilisés de façon identique partout où ils apparaissent.

**Ordre des tâches :** Task 1 (fondation stockage) doit passer avant tout
le reste — Tasks 2, 3 et 4 en dépendent toutes. Task 3 dépend aussi
légèrement de Task 1 (id stable) mais pas de Task 2. Task 4 dépend de
Task 1 (fonctions de stockage) et référence Task 2 pour la navigation
« Voir la fiche complète » (`mjSwitchSection('bestiary')` doit déjà
exister) — ordre 1→2→3→4 respecté dans ce plan.
