# Carte interactive à pins (Groupe C) — Design

## Contexte

Retour utilisateur v1.7 : ajouter une catégorie « Carte » dans Mode MJ, au même
niveau que Sessions/Rencontres/PNJ/Bestiaire/Objets/Lieux/Images. Une carte est
une image de fond sur laquelle le MJ pose des pins cliquables. Chaque pin a un
titre, un court texte (~200 caractères) et optionnellement un lien vers une
autre ressource MJ (PNJ, lieu, objet, rencontre, scénario, image, ou une autre
carte). Le MJ doit aussi pouvoir masquer temporairement tous les pins pour
montrer la carte au joueur sans spoiler.

Le socle existant le plus proche est l'écran « Lieux » (`js/mj/objects.js`,
section LIEUX) : liste+détail, upload d'image via `mjSaveAsset`/`mjAssetToUrl`,
lightbox. La Carte réutilise cette brique pour l'image, mais son détail est
entièrement différent (canvas avec pins au lieu de champs de texte).

## Portée

Mode MJ uniquement (aucune vue joueur). Mode MJ est déjà réservé au desktop
(`openMjMode()` retourne tôt si `window.innerWidth < 1100`) — pas de contrainte
tactile à gérer pour le clic droit.

## 1. Modèle de données

Nouvelle table Dexie `mj_maps`, migration v5 dans `js/mj/db.js` :

```js
db.version(5).stores({
  mj_maps: 'id, name',
});
```

Clé primaire **explicite** (`id`, pas `++id`), générée en JS (`'map_' +
Math.random().toString(36).slice(2, 9)`), pour la même raison que le bestiaire
(Task 1, Groupe B) : un id stable permet aux liens de pins ciblant une carte de
survivre à un export/import ZIP sans remap.

Objet carte :

```js
{
  id: 'map_xxxxx',
  name: 'Nouvelle carte',
  assetId: null,           // image de fond, via mjSaveAsset (comme Lieu)
  pins: [
    {
      id: 'pin_xxxxx',
      x: 42.5,              // % de la largeur affichée de l'image
      y: 61.0,              // % de la hauteur affichée de l'image
      title: 'Auberge du Cerf',
      text: 'Repaire des PJ, tenu par Gorak.',   // ≤ 200 caractères (compteur UI, non forcé en base)
      link: { type: 'npc', id: 3 } | null,        // type ∈ {scenario,encounter,npc,objet,lieu,asset,carte}
    },
  ],
}
```

`x`/`y` en pourcentage (pas en pixels) : l'image est affichée en
`width:100%; height:auto` (ratio préservé), donc un pourcentage reste correct
quelle que soit la taille de fenêtre. Si le MJ remplace l'image de fond par une
image d'un ratio différent, les pins existants se replacent visuellement selon
les nouvelles proportions — limite connue et acceptée, pas un bug.

CRUD dans `js/mj/db.js` (miroir de `mjGetPlaces`/`mjSavePlace`/`mjDeletePlace`) :
`mjGetMaps()`, `mjGetMap(id)`, `mjSaveMap(m)` (put si `m.id` fourni, sinon
génère l'id), `mjDeleteMap(id)`.

## 2. Écran Mode MJ « Cartes »

Nouveau fichier `js/mj/maps.js`, miroir du patron liste+détail :

- `mjRenderMapsList()` : carte-item avec nom + sous-ligne `🗺️ N pin(s)`.
- `mjSelectMap(id)` → `mjRenderMapsList()` + `mjRenderMapDetail()` (+ rebuild
  `mjBuildTagIndex()` comme les autres écrans, pour les @tags dans les
  scénarios).
- `mjRenderMapDetail()` : en-tête (nom éditable inline comme les autres,
  bouton 🖼️ Image, bouton 👁️ Masquer/Afficher les pins, bouton 🗑️ Supprimer),
  puis le canvas :
  - Pas d'image → état vide `mj-detail-empty` avec bouton d'upload.
  - Image présente → conteneur `position:relative` contenant `<img
    style="width:100%;height:auto">` + un `<div>` absolument positionné par
    pin (masqués si le mode « présentation » est actif).
- `mjMapUploadImage(mapId)` : même mécanique que `mjPlaceUploadImage`
  (supprime l'ancien asset si présent, `mjSaveAsset`, sauvegarde, re-rend).
- `mjNewMap()` : crée avec nom par défaut « Nouvelle carte », sélectionne,
  focus sur le champ nom (même UX que `mjNewBestiaryEntry`/`mjNewPlace`).
- `mjDeleteMapConfirm(id)` : `appConfirm` (supprime aussi l'asset lié),
  rebuild tag index.

Nav (`js/mj/view.js`) : bouton "🗺️ Cartes" entre "📍 Lieux" et "🖼️ Images"
dans la barre, plus les branches correspondantes dans `_mjRenderSection`,
`mjSwitchSection` (reset `_mjMap = null`) et `mjAddNew` (`mjNewMap()`).

`index.html` : `<script src="js/mj/maps.js?v=1.7.0"></script>` après
`js/mj/bestiary.js`.

## 3. Pins — interactions

Toutes les actions sont gérées dans `js/mj/maps.js`, portées par le canvas
rendu dans `mjRenderMapDetail()`.

- **Clic droit sur le canvas (zone vide)** : capture la position du clic
  relative au conteneur (`getBoundingClientRect` du wrapper de l'image,
  converti en % x/y), crée immédiatement un pin (`title: 'Nouveau point'`,
  `text: ''`, `link: null`), sauvegarde, ouvre directement sa carte d'édition
  flottante (`_mjMapEditingPinId`).
- **Clic droit sur un pin existant** : `event` bulle jusqu'au canvas
  s'arrête via le comportement standard de `mjItemContext` (appelle déjà
  `preventDefault`/`stopPropagation`), donc pas de risque de déclencher aussi
  la création d'un nouveau pin. Ouvre le menu `mjItemContext` → « Supprimer »
  → `mjMapDeletePinConfirm(mapId, pinId)` (via `appConfirm`, supprime le pin
  du tableau, sauvegarde, re-rend).
- **Survol d'un pin (mouseenter/mouseleave)** : affiche un popup en lecture
  seule (titre, texte, lien cliquable si présent) positionné pour rester
  dans les limites du canvas (mesure réelle de la taille du popup après
  rendu, même logique que le clamp du menu contextuel combat — cf. la
  revue de branche qui a trouvé cette classe de bug une première fois).
- **Clic sur un pin** : ouvre/ferme une carte d'édition flottante ancrée au
  pin (titre en `<input>`, texte en `<textarea>` avec compteur `n/200`,
  bouton "🔗 Lier à…" ou puce `icône + nom + ✕` si déjà lié). Sauvegarde
  automatique `onchange` (même convention que le reste de l'app, pas de
  bouton "Enregistrer" séparé).
- **Bouton "👁️ Masquer les pins"** dans l'en-tête : bascule une variable
  d'état transitoire `_mjMapHidePins` (pas persistée, repart à `false` à
  chaque sélection/réouverture de carte). Quand actif, le rendu du canvas
  n'affiche que l'image, aucun pin, aucun clic droit actif (le bouton devient
  "👁️ Afficher les pins" pour revenir en mode édition).

## 4. Lien du pin — sélecteur

Bouton "🔗 Lier à…" ouvre une petite liste cherchable (nouveau composant,
`mjOpenMapLinkPicker(onPick)` dans `js/mj/maps.js`) alimentée par :
- `_mjTagIndex` existant (scénario, rencontre, PNJ, objet, lieu, image) —
  déjà construit par `mjBuildTagIndex()`.
- Les cartes elles-mêmes (nouveau type `carte`, ajouté à `_MJ_TAG_META` dans
  `js/mj/tags.js` : `{ icon: '🗺️', section: 'maps', label: 'Carte' }`, et
  `mjBuildTagIndex()` inclut `mjGetMaps()` dans son `Promise.all` et pousse
  chaque carte dans l'index comme les autres types).

Filtrage texte simple sur le nom (même principe que l'autocomplétion `@tag`
existante, mais présenté comme une liste à choix unique plutôt qu'une
saisie de texte libre). Sélection → stocke `{type, id}` sur le pin, ferme la
liste.

Rendu du lien dans le popup de survol : icône + nom (via `_mjTagIndex`,
résolu en direct à chaque rendu — pas de copie figée du nom, comme partout
ailleurs dans l'app) + zone cliquable qui appelle `mjSwitchSection(section)`
puis sélectionne la cible (`mjSelectNpc`/`mjSelectPlace`/etc., ou
`mjSelectMap` pour une cible `carte`) — même mécanique « Voir » que les
autres liens croisés de l'app.

Si la cible n'existe plus (supprimée) : le popup affiche « Lien introuvable
(supprimé ?) » sans lien cliquable, pas de crash — même filet de sécurité
que la Fiche bestiaire en combat et le lien PNJ↔bestiaire (Groupe B).

**Hors scope :** pas de lien direct vers une fiche bestiaire (le bestiaire
n'est pas dans `_mjTagIndex` aujourd'hui, seulement référencé via les
rencontres) ni vers une session entière (seulement vers un scénario/doc
individuel, comme le système `@tag` existant le permet déjà).

## 5. Intégrité des données

**Suppression totale (`js/apropos.js`, `aproposDeleteAll`)** : `mj_maps`
ajouté à la liste des tables Dexie vidées, dès ce commit (leçon du Groupe B
où `mj_bestiary` avait été oublié).

**Export ZIP (`mjExportZip`)** : `maps: await mjGetMaps()` ajouté à l'objet
exporté, comme `places`/`objects`/etc.

**Import ZIP (`mjImportZip`)** — point sensible : les ressources
PNJ/Objets/Lieux/Rencontres sont ré-importées via `mjSave*(remap(rest))`
avec un id Dexie auto-incrémenté **différent** de l'id d'origine. Aujourd'hui
rien ne référence ces ids depuis un autre enregistrement, donc ça n'a jamais
posé de problème — mais un pin de carte le fait explicitement (`link.id`
pointe vers l'ancien id). Il faut donc :

1. Capturer l'id retourné par chaque `mjSaveNpc`/`mjSaveObject`/
   `mjSavePlace`/`mjSaveEncounter` pendant l'import, dans une table de
   correspondance ancien-id → nouvel-id par type (comme `assetIdMap` existe
   déjà pour les images).
2. Après avoir importé toutes les ressources (y compris les cartes
   elles-mêmes, dont l'id ne change pas grâce à la clé explicite), parcourir
   chaque carte importée et remapper `pin.link.id` via la table du type
   correspondant.
3. Les types `scenario` (id stable `doc_xxx`, jamais réassigné même en
   Dexie) et `carte` (id stable `map_xxx`) n'ont besoin d'aucun remap.
4. Si la cible d'un lien n'est pas retrouvée dans le ZIP (ressource absente
   de l'export, ou remap échoué) : mettre `link: null` sur ce pin, garder le
   pin (titre/texte intacts) — jamais de perte totale du pin pour un lien
   cassé, jamais de crash de l'import entier.

Import des cartes ordonné **après** PNJ/Objets/Lieux/Rencontres/Sessions
(pour que les tables de correspondance existent avant le remap), même
principe d'isolation des échecs que le bestiaire (try/catch dédié, message
d'alerte si échec, sans bloquer le reste de l'import).

## 6. Hors scope (v1)

- Vue côté joueur de la carte.
- Icône de pin différenciée par type de cible liée (un seul marqueur
  uniforme pour l'instant).
- Lien direct vers une fiche bestiaire ou une session entière.
- Zoom/pan sur l'image de la carte.
- Déplacer un pin existant par glisser-déposer (le MJ supprime et recrée si
  besoin de repositionner).
- État « pins masqués » persisté (toujours réinitialisé à l'affichage).

## 7. Vérification

Pas de test automatisé (logique UI/IndexedDB-dépendante, même posture que le
Groupe B). Vérification manuelle :

1. Créer une carte, uploader une image de fond.
2. Clic droit sur le canvas → pin créé à la bonne position, carte d'édition
   flottante s'ouvre, renommer/écrire un texte, lier à un PNJ existant.
3. Survoler le pin → popup titre/texte/lien correct, lien cliquable bascule
   bien vers le PNJ et le sélectionne.
4. Créer une deuxième carte, lier un pin de la première vers la deuxième →
   navigation carte→carte fonctionne.
5. Clic droit sur le pin → Supprimer → confirmation → pin disparaît.
6. "👁️ Masquer les pins" → aucun pin visible, aucune création possible tant
   qu'actif ; rouvrir la carte (changer de section puis revenir) → pins
   réaffichés par défaut.
7. Exporter un ZIP, vider `mj_maps`/`mj_npcs`/etc. dans la console,
   réimporter → cartes restaurées, pins toujours liés au bon PNJ malgré son
   nouvel id.
8. Réglages > Supprimer toutes les données → `mj_maps` bien vidé après
   reload.
9. Aucune erreur console à chaque étape.

## Self-review

- **Placeholders :** aucun TBD/TODO restant.
- **Cohérence interne :** le modèle de données (§1), les interactions (§3)
  et le sélecteur de lien (§4) s'accordent — un pin a toujours au plus un
  lien, résolu en direct via `_mjTagIndex`/`mjGetMaps()`, jamais de copie
  figée du nom de la cible.
- **Portée :** un seul écran + une extension ciblée de `js/mj/tags.js` et
  `js/mj/db.js` (export/import/suppression totale) — pas de décomposition
  nécessaire.
- **Ambiguïté :** le format exact du popup de survol et de la carte
  d'édition (mise en forme CSS) sera détaillé dans le plan d'implémentation,
  pas figé ici — c'est un détail de présentation, pas une décision de design.
