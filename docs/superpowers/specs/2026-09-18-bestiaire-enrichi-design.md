# Bestiaire enrichi (stats/notes, accès hors combat, lien PNJ)

> Design validé — 2026-09-18. Branche : `v1.7.0` (suite du Groupe A, un
> commit unique par groupe une fois terminé — même convention).
> Objectif : (1) le bestiaire devient une vraie ressource Mode MJ (accessible
> hors combat, stats personnalisées + notes riches), (2) ses stats restent
> consultables une fois un monstre engagé en combat, (3) une fiche PNJ peut
> être liée à une fiche bestiaire (les deux systèmes restent séparés).

## 1. Contexte — retour utilisateur

> « pouvoir renseigner des stats/notes sur les ennemis (en gros pour avoir
> les stats ou infos pendant combat quand on peut préparer le combat à
> l'avance) »
>
> « l'accès au bestiaire hors combat ce serait pratique aussi pour l'éditer
> plus facilement »

**État actuel.** Le bestiaire (`js/combat/bestiary.js`) vit dans
`localStorage` (clé `logrpg_bestiary`), sous la forme d'un tableau
`{id, name, type, maxHp, initiative}` — aucun champ notes/stats. Il n'est
visible que dans une section repliable de l'écran de préparation de combat
(`js/combat/setup.js`, `_renderBestiarySection`). C'est la SEULE ressource
MJ qui ne vit pas en IndexedDB (PNJ/Objets/Lieux y sont tous, via
`js/mj/db.js`, avec un écran liste+détail dans Mode MJ et un éditeur de
notes riche partagé — voir `js/mj/npcs.js` comme référence de patron).

`bestiaryId` est déjà référencé ailleurs dans le code (rencontres
préparées, combat en cours) : `js/mj/encounters.js` (participants d'une
rencontre), `js/mj/tags.js` (résolution du nom d'un monstre dans l'aperçu
`@tag` d'une rencontre), `js/mj/db.js` (export/import ZIP). Toute migration
doit préserver ces références.

## 2. Modèle de données

### 2.1 Nouvelle table `mj_bestiary`

```js
// js/mj/db.js — nouvelle migration Dexie
db.version(4).stores({
  mj_bestiary: 'id, name',   // clé primaire EXPLICITE (pas '++id') : voir §3.1
});
```

Une entrée :

```js
{
  id: 'bt_xxxxx',        // string, généré par newBestiaryId() — voir §3.1
  name: 'Gobelin éclaireur',
  type: 'MONSTRE',        // 'PJ' | 'PNJ' | 'MONSTRE' — inchangé, existant
  maxHp: 18,
  initiative: 8,
  stats: [{ label: 'Défense', value: '14' }, ...],  // libre, 0..n paires
  notes: '',              // même format que npc.notes (Markdown + @tags +
                           // widgets, via mjBlockEditorHtml/mjMountBlockEditor)
}
```

Pas de champ `assetId`/portrait — non demandé, hors périmètre (§6).

### 2.2 `stats` : paires libres, pas de champs figés

Cohérent avec le reste de l'appli (sections/widgets personnalisables de la
fiche perso, raretés d'objets « adaptées à ton univers ») : pas de
`Défense`/`Attaque` imposés, l'utilisateur nomme ses propres stats. Édition
en liste simple (ajouter/renommer/supprimer une paire label/valeur),
comme un mini-tableau, pas de widget de mise en forme.

## 3. Migration localStorage → IndexedDB

### 3.1 Identifiants préservés (pas de remapping)

`mj_bestiary` utilise une clé primaire **explicite** (`'id'`, pas
`'++id'`) : les entrées migrées gardent exactement leur ancien id
(`'bt_' + Math.random()...`), donc **aucune référence existante
(`p.bestiaryId` dans une rencontre ou un combat) ne casse**. Les nouvelles
entrées créées après migration génèrent un id du même format (fonction
`newBestiaryId()`, reprise de l'ancien `bestiaryAdd`).

### 3.2 Migration idempotente et vraiment one-shot

Au premier accès (voir §3.3, dans `bestiaryLoad()`) : si
`localStorage.getItem('logrpg_bestiary')` contient des entrées, les
transférer vers `mj_bestiary` via `db.mj_bestiary.bulkPut(...)` (put =
insert-ou-remplace par id, donc rejouer la migration ne duplique jamais
rien), **puis supprimer la clé `localStorage` source**. Sans cette
suppression, `bestiaryLoad()` (appelée à chaque ouverture de Mode MJ/
combat) rejoue le `bulkPut` à l'infini et **ressuscite** toute entrée
supprimée depuis via `bestiaryRemove` — bug trouvé en test à
l'implémentation, corrigé avant que ça n'arrive en prod.

### 3.3 `bestiaryGetAll()` reste synchrone — cache mémoire

`bestiaryGetAll()` est appelée **de façon synchrone** dans du code de rendu
existant qui ne peut pas devenir `async` sans un remaniement disproportionné
par rapport à la demande (`js/combat/setup.js` §`_renderBestiarySection`,
`_cSetup`, `js/mj/encounters.js` §`_renderEncParticipants`, `js/mj/tags.js`
§`mjBuildTagIndex`). Solution : un cache mémoire, rechargé après chaque
écriture — le même principe que `_mjTagIndex` (déjà dans le code, voir
`js/mj/tags.js`).

```js
// js/combat/bestiary.js — réécrit pour IndexedDB, signatures/comportement
// externes inchangés pour bestiaryGetAll (toujours synchrone).
let _bestiaryCache = [];

async function bestiaryLoad() {
  if (localStorage.getItem('logrpg_bestiary')) {
    const legacy = JSON.parse(localStorage.getItem('logrpg_bestiary') || '[]');
    if (legacy.length) await db.mj_bestiary.bulkPut(legacy);
  }
  _bestiaryCache = await db.mj_bestiary.toArray();
}

function bestiaryGetAll() { return _bestiaryCache; }   // synchrone, inchangé pour les appelants

async function bestiaryAdd(name, type, maxHp, initiative) {
  const entry = { id: newBestiaryId(), name: name.trim(), type, maxHp, initiative, stats: [], notes: '' };
  await db.mj_bestiary.put(entry);
  await bestiaryLoad();
  return entry.id;
}
async function bestiarySaveEntry(entry) { await db.mj_bestiary.put(entry); await bestiaryLoad(); }
async function bestiaryRemove(id) { await db.mj_bestiary.delete(id); await bestiaryLoad(); }

// Restauration ZIP complète (mjImportZip) : remplace tout le contenu.
async function bestiarySave(templates) {
  await db.mj_bestiary.clear();
  await db.mj_bestiary.bulkPut(templates);
  await bestiaryLoad();
}
```

`bestiaryLoad()` est appelée une fois à l'ouverture de Mode MJ (dans
`openMjMode()`, à côté de `mjBuildTagIndex()`) et à chaque fois que l'écran
de préparation de combat s'ouvre (`openCombatSetup()`), pour couvrir le cas
où le combat est lancé sans être passé par Mode MJ.

**Callers à ajuster** (ajout d'un `await`, aucun changement de logique) :
- `js/combat/setup.js` : `removeFromBestiary`, la création manuelle dans le
  bestiaire (bouton d'ajout rapide, si présent) — passent en `async`.
- `js/mj/db.js` : `mjImportZip`, ligne `bestiarySave(data.bestiary)` → `await
  bestiarySave(data.bestiary)`.
- `js/mj/npcs.js` (nouveau, §5) : création d'une fiche bestiaire depuis un
  PNJ.

Tous les **appels de lecture** (`bestiaryGetAll()`) restent identiques,
aucun fichier listé en §1 n'a besoin d'être touché pour eux.

## 4. Mode MJ — écran Bestiaire

Nouvel onglet « 🐉 Bestiaire » dans la nav Mode MJ (`js/mj/view.js`,
`_mjRenderShell`, entre PNJ et Objets). Nouveau fichier `js/mj/bestiary_mj.js`
(nom à ajuster à l'implémentation pour éviter la collision avec
`js/combat/bestiary.js`) reprenant le patron de `js/mj/npcs.js` :

- **Liste** (`mjRenderBestiaryList`) : carte par entrée (nom, pastille
  type, ❤️ PV · Init.), clic droit → Supprimer (`mjItemContext`, comme les
  autres listes MJ).
- **Détail** (`mjRenderBestiaryDetail`) : nom, type (3 boutons PJ/PNJ/
  Monstre), PV max, initiative (champs déjà existants dans le formulaire
  d'ajout de `setup.js`, réutilisés ici en édition inline) ; liste de
  stats libres (ajouter/renommer/supprimer une ligne label/valeur) ; bloc
  NOTES avec `mjBlockEditorHtml`/`mjMountBlockEditor` (identique à
  `js/mj/npcs.js:103-106`).
- CRUD (`mjNewBestiaryEntry`, `mjSaveBestiaryField`, `mjDeleteBestiaryEntryConfirm`,
  `mjBestiarySaveNotes`) au calque du CRUD PNJ, mais appelant les fonctions
  IndexedDB du §3.3 (`bestiaryAdd`/`bestiarySaveEntry`/`bestiaryRemove`) au
  lieu de `mjSaveNpc`/`mjDeleteNpc`.

Le panneau bestiaire de l'écran de préparation de combat
(`_renderBestiarySection`, `js/combat/setup.js`) n'est **pas retiré** — il
reste le raccourci rapide pendant la préparation d'un combat, juste
reconnecté à `bestiaryGetAll()`/`bestiaryAdd()` version IndexedDB (aucun
changement visuel).

## 5. Lien PNJ ↔ Bestiaire

Nouveau champ optionnel sur les PNJ (`js/mj/npcs.js`, table `mj_npcs`,
pas de migration Dexie nécessaire — IndexedDB est sans schéma strict par
colonne) :

```js
n.bestiaryId  // string | null — id d'une entrée mj_bestiary, ou null
```

Sur la fiche PNJ (`mjRenderNpcDetail`), sous le bloc STATUT, un nouveau
bloc « 🐉 FICHE DE COMBAT » :
- Non lié : bouton « Lier une fiche existante » (liste déroulante des
  entrées `bestiaryGetAll()`) + bouton « Créer une fiche liée » (crée une
  entrée bestiaire vide de type PNJ, préremplie avec le nom du PNJ, et la
  lie immédiatement).
- Lié : résumé compact (❤️ PV max · Init., aperçu des 2-3 premières stats)
  + bouton « Voir la fiche complète » (bascule Mode MJ vers l'onglet
  Bestiaire, sélectionne l'entrée) + bouton « Délier ».

Sur la fiche bestiaire (§4), si une entrée est liée par un PNJ (recherche
inverse : PNJ dont `bestiaryId === cette entrée`), afficher un raccourci
« 🧑 PNJ narratif lié : <nom> » vers la fiche PNJ. Une entrée bestiaire ne
peut être liée que par **un seul** PNJ à la fois (pas de contrainte
technique forte à ajouter — juste ne pas proposer une entrée déjà liée
dans le sélecteur « Lier une fiche existante » d'un autre PNJ).

## 6. Pendant le combat

### 6.1 Le lien vers la fiche bestiaire survit à l'ajout en combat

`combatAddParticipant` (`js/combat/state.js`) gagne un paramètre optionnel
`bestiaryId = null` en fin de signature, stocké sur l'objet participant.
`addFromBestiary` (`js/combat/setup.js`) le renseigne désormais :

```js
combatAddParticipant(uniqueName, t.type, t.maxHp, t.initiative, null, null, null, null, t.id);
```

(Les participants ajoutés manuellement ou importés depuis une fiche PJ
n'ont simplement pas de `bestiaryId` — `undefined`/`null`, comportement
actuel inchangé pour eux.)

### 6.2 Bouton « 📋 Fiche »

Dans `js/combat/view.js`, panneau détail du participant **et** menu
contextuel (mêmes deux emplacements que le champ Dégâts/Soin) : un bouton
« 📋 Fiche », visible **seulement si `p.bestiaryId` est renseigné**, ouvre
une popup en lecture seule (nouvelle fonction `_renderBestiaryFicheModal`)
affichant les stats et les notes de l'entrée bestiaire liée (notes rendues
via `_mjMarkdownWithTags`, comme partout ailleurs dans Mode MJ). Fermeture
au clic en dehors ou sur ✕, aucune édition possible depuis cette popup
(pour éditer, il faut passer par l'onglet Bestiaire de Mode MJ).

## 7. Hors périmètre (confirmé avec l'utilisateur)

- Pas de fusion des systèmes PNJ narratif / bestiaire combat — ils restent
  deux ressources distinctes, seulement reliées par un champ optionnel.
- Pas de portrait/image sur les fiches bestiaire.
- Pas de tag `@` pour référencer une fiche bestiaire depuis un scénario
  (seul l'@tag d'encounter existe déjà et résout déjà les noms de monstres
  via `p.bestiaryId` pour l'affichage — inchangé).
- Pas de contrainte technique empêchant deux PNJ de lier la même fiche
  bestiaire (juste non proposé dans le sélecteur normal).

## 8. Tests / vérification

- Migration : avec des entrées existantes dans `localStorage.logrpg_bestiary`
  et une rencontre existante référençant l'une d'elles par `bestiaryId`,
  ouvrir Mode MJ → l'entrée apparaît dans le nouvel onglet Bestiaire, la
  rencontre affiche toujours correctement ce participant (même id).
  Recharger la page une seconde fois → pas de doublon dans la liste
  (idempotence de `bulkPut`).
- CRUD Bestiaire : créer une entrée, ajouter 2 stats libres, écrire une
  note, recharger la page → tout est toujours là.
- Ajouter un monstre en combat depuis le bestiaire → bouton « 📋 Fiche »
  visible, affiche bien les stats/notes de l'entrée. Ajouter un
  participant manuellement (sans bestiaire) → bouton absent.
- Lier un PNJ à une fiche bestiaire (existante puis « créer liée ») → les
  deux écrans affichent bien le lien croisé. Délier → les deux raccourcis
  disparaissent, aucune des deux fiches n'est supprimée.
- Export ZIP puis import sur un état vide → bestiaire restauré à
  l'identique (stats/notes comprises), rencontres toujours cohérentes.
- Aucune erreur console à aucune étape ; vérifier particulièrement
  `js/mj/tags.js` (aperçu `@tag` d'une rencontre) et
  `js/mj/encounters.js` (liste des participants d'une rencontre) après
  migration, puisqu'ils lisent `bestiaryGetAll()` en synchrone.
