# Rapport de revue — Mobile & Safari

Date : 2026-09-17
Périmètre : `index.html`, `css/*.css`, `js/**/*.js` (hors `android/`, `www/`, `node_modules/`)
Méthode : revue automatisée par 6 agents spécialisés (viewport/CSS, menus contextuels vs tactile, drag & drop/événements souris, stockage IndexedDB/localStorage, éditeur WYSIWYG contenteditable, API JS & meta HTML), chaque finding relu et vérifié par un second agent indépendant à charge de le réfuter. 31 problèmes remontés, 30 confirmés après vérification, 1 écarté (mais gardé en annexe car il redevient pertinent si le point n°1 ci-dessous est corrigé).

## Résumé exécutif

Le problème le plus structurant n'est pas un bug isolé mais un choix d'architecture répété partout dans le code : **toutes les bascules desktop/mobile reposent uniquement sur `window.innerWidth < 1100`, jamais sur une détection de capacité tactile** (`matchMedia('(pointer: coarse)')`, `'ontouchstart' in window`, etc.). Résultat : sur toute tablette tactile large (iPad en paysage, tablette Android via le wrapper Capacitor), l'app affiche l'interface « desktop » pensée pour souris/clic droit à un utilisateur qui n'a que son doigt. C'est la cause racine d'une bonne partie des findings « critiques » et « majeurs » ci-dessous (menus contextuels inaccessibles, drag & drop cassé, etc.).

Répartition des 30 findings confirmés :
- **Critique : 4** — fonctionnalités entièrement inaccessibles au tactile (renommer/supprimer un personnage, éditer/supprimer un widget de scénario, ouverture d'IndexedDB non protégée, import ZIP MJ qui peut échouer silencieusement).
- **Majeur : 18** — dégradations fortes mais contournables ou partielles (zoom involontaire Safari, clavier virtuel qui cache l'UI, presse-papiers/export qui échouent silencieusement sur WebKit, etc.).
- **Mineur : 8** — rendu ou confort dégradé sans perte de fonctionnalité.

À noter : le bug déjà connu et documenté sur l'éditeur WYSIWYG (voir `docs/CONTEXT-wysiwyg-handoff.md`) n'a pas été re-décrit ici ; les agents avaient pour consigne de chercher des problèmes Safari/mobile *additionnels* sur ce même code, ce qui a fait remonter 6 points distincts (section 5).

---

## 1. Cause racine : détection desktop/mobile par largeur d'écran uniquement

| Sévérité | Fichier | Détail |
|---|---|---|
| Majeur | [js/mj/view.js:8](js/mj/view.js#L8) | `openMjMode()` ouvre le Mode MJ dès `window.innerWidth >= 1100`, sans distinguer souris/tactile. |
| Majeur | [js/init.js:5](js/init.js#L5) | Le choix desktop/mobile n'est évalué **qu'une fois**, au chargement (`DOMContentLoaded`) ; aucun listener `resize`/`orientationchange` nulle part dans le code. Un iPad ouvert en paysage (UI desktop, `initMobileApp()` jamais appelé) puis tourné en portrait affiche un `#mobile-app` vide (le CSS bascule, mais le contenu JS n'a jamais été peuplé) jusqu'à un rechargement complet. |

Un iPad Air/Pro/mini en paysage (largeur CSS ≈ 1133–1366px) ou une tablette Android en paysage via Capacitor dépassent systématiquement ce seuil de 1100px et tombent donc dans la branche « desktop », alors qu'il s'agit d'appareils 100 % tactiles.

**Recommandation** : remplacer (ou compléter) le test de largeur par une détection de capacité d'entrée (`matchMedia('(pointer: coarse)')` ou `'ontouchstart' in window`) partout où ce seuil de 1100px décide de l'UI, et ajouter un listener `resize`/`orientationchange` (debounced) qui ré-évalue `initMobileApp()` après le chargement initial.

---

## 2. Menus contextuels (clic droit) sans équivalent tactile

Conséquence directe du point 1 : de nombreuses actions ajoutées récemment via clic droit (« Supprimer » sur tous les items, cf. historique git) n'ont **aucun** chemin tactile, alors qu'un mécanisme d'appui long existe déjà dans `js/mobile.js` (`mobLongPressStart`/`mobLongPressMove`/`mobLongPressEnd`, seuil de mouvement 10px) mais n'est branché que sur les cartes personnage de la liste mobile.

| Sévérité | Fichier | Détail |
|---|---|---|
| **Critique** | [js/mobile.js:10](js/mobile.js#L10) | Sur un écran tactile ≥ 1100px, l'app charge la liste de personnages « desktop » (`js/db.js`) où renommer/supprimer un perso n'est possible que par `oncontextmenu` (`openCharContextMenu`) — aucun bouton ni appui long de secours. Sur iPad Safari, un tap ne déclenche pas `contextmenu` : fonctionnalité totalement inaccessible. |
| **Critique** | [js/mj/tags.js:1194](js/mj/tags.js#L1194) | Dans l'éditeur de scénario, modifier/supprimer un widget (`/switch`, `/todo`, `/combo`, `/compteur`, `/jauge`), un tableau, un séparateur ou un bloc `/details` n'est possible **que** par clic droit (`mjWidgetContext`) : le clic simple est explicitement détourné vers l'interaction (bascule/dépliage), sans aucun bouton de secours. Sur tablette, un widget mal placé reste bloqué à vie dans le scénario. |
| Majeur | [js/mj/view.js:161](js/mj/view.js#L161) | Le menu « Supprimer » générique du Mode MJ (`mjItemContext`, branché en `oncontextmenu` sur sessions, scénarios, PNJ, objets, lieux, rencontres, images) n'a reçu aucun équivalent tactile alors que le pattern existe déjà dans `js/mobile.js`. Un bouton 🗑️ redondant existe dans le panneau de détail, mais impose d'ouvrir chaque élément un par un. |

**Recommandation** : généraliser le pattern `mobLongPressStart`/`_mobOpenMenuAt` de `js/mobile.js` (avec seuil de mouvement) à tous les éléments dotés d'un `oncontextmenu` personnalisé, en particulier `mjItemContext` et `mjWidgetContext`.

---

## 3. Drag & drop et événements souris sans équivalent tactile

| Sévérité | Fichier | Détail |
|---|---|---|
| Majeur | [js/player/caract.js:150](js/player/caract.js#L150) | Le fallback tactile du drag & drop des sections (`_bindTouchDragDrop`) ne s'active qu'en dessous de 1100px. Au-dessus, seul le Drag & Drop HTML5 natif (`draggable`, `dragstart/dragover/drop`) reste actif — une API qui ne fonctionne pas au doigt sur Safari pour des éléments génériques. Sur iPad en paysage : réorganiser les sections de la fiche est silencieusement impossible. |
| Majeur | [js/player/caract.js:60](js/player/caract.js#L60) | Renommer/supprimer une section (`.stat-section`) ou un widget (`.stat-widget-cell`) — et de façon identique les capacités, objets et notes (mêmes classes réutilisées) — ne sont accessibles que via `oncontextmenu`, sans `-webkit-touch-callout:none` : le long-press déclenche au mieux la loupe/sélection native iOS, jamais le menu de l'appli. |
| Majeur | [js/player/counters.js:223](js/player/counters.js#L223) | Le texte d'aide affiché (« Maintenir = modifier max ») promet un appui long, mais `bindSlotEvents` ne branche qu'un `contextmenu` desktop — aucun `touchstart`/minuterie de long-press. Fonctionnalité annoncée dans l'UI mais inexistante au doigt. |
| Majeur | [js/player/print.js:346](js/player/print.js#L346) | Sur mobile, `window.print()` n'est appelé qu'après une longue chaîne asynchrone (`document.fonts.ready` → `requestAnimationFrame` → `setTimeout(80ms)`), en aval d'un `await getCharacter(...)`. Le geste utilisateur (tap) peut avoir expiré : Safari peut alors ignorer `print()` silencieusement, sans erreur visible. L'équipe a déjà corrigé ce problème pour `window.open()` dans ce même fichier mais pas pour `print()`. Les boutons manuels de secours sont en plus piégés dans un iframe hors-écran, donc inaccessibles si l'auto-print échoue. |

**Annexe (finding écarté après vérification, mais à garder à l'œil)** : `js/combat/view.js:201` — le menu d'action par participant de combat (KO, fuite, forcer le tour...) n'a lui non plus aucun fallback tactile. Il a été écarté du rapport car le Mode Combat est actuellement masqué en dessous de 1099px et documenté « desktop uniquement » — un MJ sur iPad/iPhone n'atteint jamais cet écran aujourd'hui. **Si le point 1 (détection tactile) est corrigé et que le Mode Combat devient accessible sur tablette, ce trou redeviendra un vrai bug bloquant** — à traiter dans la même passe.

---

## 4. Stockage (IndexedDB/localStorage) et Safari

| Sévérité | Fichier | Détail |
|---|---|---|
| **Critique** | [js/db.js:3](js/db.js#L3) | L'ouverture de la base Dexie (`new Dexie('LogRPGDatabase')`) ne comporte aucune gestion d'erreur ni détection de disponibilité d'IndexedDB. En navigation privée Safari (quota proche de 0), l'échec produit une promesse rejetée non interceptée : la liste de personnages reste vide, sans message d'erreur. |
| **Critique** | [js/mj/db.js:128](js/mj/db.js#L128) | Dans `mjImportZip`, `bestiarySave(data.bestiary)` (qui écrit dans `localStorage`, sans try/catch) s'exécute **avant** la réimportation des assets/sessions/PNJ/objets/lieux. En navigation privée Safari, `localStorage.setItem` lève classiquement une `QuotaExceededError` : la restauration d'une sauvegarde ZIP — seul filet de sécurité contre une perte de données MJ — échoue totalement et silencieusement. |
| Majeur | [js/db.js:66](js/db.js#L66) | `saveProfilePhoto`/`updateCharacterFields`, ainsi que l'appel équivalent dans `js/player/profile.js:194`, écrivent en IndexedDB sans try/catch. Un `QuotaExceededError` (navigation privée Safari) laisse la modale ouverte sans message, l'utilisateur croit avoir sauvegardé sa photo. |
| Majeur | [js/mj/db.js:69](js/mj/db.js#L69) | `mjSaveAsset` enregistre un Blob brut sans limite de taille ni gestion d'erreur, contrairement à `js/player/profile.js` qui plafonne à 10 Mo et redimensionne. Une photo importée depuis la pellicule d'un iPhone peut dépasser le quota Safari et faire échouer l'ajout sans retour utilisateur. |
| Majeur | [js/mj/db.js:112](js/mj/db.js#L112) | `mjExportZip` déclenche le téléchargement via un `<a download>` jamais attaché au DOM, cliqué après un `await`, avec `URL.revokeObjectURL` appelé immédiatement après — enchaînement connu pour échouer silencieusement sur Safari (perte de l'activation utilisateur + révocation prématurée du blob). Le code contient pourtant déjà, ailleurs (`js/player/profile.js:525-541`), le pattern correct (ouverture synchrone + `revokeObjectURL` différé) : il n'a simplement pas été repris ici. |

**Recommandation** : ajouter un test `'indexedDB' in window` + try/catch systématique autour des accès Dexie/localStorage critiques, avec un message utilisateur explicite (`QuotaExceededError` notamment) plutôt qu'un échec silencieux ; aligner `mjExportZip` sur le pattern déjà utilisé dans `profile.js`.

---

## 5. Éditeur WYSIWYG (contenteditable) — problèmes additionnels à celui déjà documenté

Le bug connu et non résolu de l'éditeur (voir `docs/CONTEXT-wysiwyg-handoff.md`) n'est pas repris ici. Les points suivants sont distincts :

| Sévérité | Fichier | Détail |
|---|---|---|
| Majeur | [js/mj/sessions.js:654](js/mj/sessions.js#L654) | Les blocs contenteditable (`.mj-block-rich` ligne 654, `.mj-list-edit` ligne 492) ne désactivent que `spellcheck` ; `autocorrect`/`autocapitalize` (attributs WebKit) ne sont jamais posés nulle part dans le projet. Le clavier iOS reste libre d'auto-capitaliser/corriger le texte, y compris dans les widgets/tags. |
| Majeur | [js/mj/tags.js:476](js/mj/tags.js#L476) | Le menu d'autocomplétion (`@tags`, `/widgets`) décide de se retourner au-dessus du curseur via `window.innerHeight`, qui ne reflète pas le rétrécissement du viewport visuel causé par le clavier iOS (seul `visualViewport.height` le fait) — le menu peut se croire de la place alors qu'il est masqué sous le clavier. Même souci dans `mjTagCreateMenu` (l.246), `_mjShowWdgCtx` (l.1251), `mjRichComboOpen` (l.1165), `_mjTagPreviewPlace` (l.830). |
| Majeur | [js/mj/sessions.js:817](js/mj/sessions.js#L817) | `_mjFocusBlockEditor` fait `el.focus()` sans `scrollIntoView` dans un overlay `position:fixed` à défilement interne (`#mj-overlay` + `.mj-doc-scroll`) — le remontage automatique de Safari cible le scroll du document principal, pas un scroller imbriqué : le bloc édité peut rester caché sous le clavier. |
| Majeur | [js/mj/sessions.js:1264](js/mj/sessions.js#L1264) | Dans `mjRichPaste`, `if (!e.clipboardData) return;` s'exécute **avant** `e.preventDefault()` : si `clipboardData` n'est pas peuplé (comportement WebKit réputé incohérent selon la source du contenu copié), le collage natif a lieu tel quel, contournant la sanitisation « texte brut uniquement » prévue (§9). |
| Mineur | [js/mj/sessions.js:1257](js/mj/sessions.js#L1257) | Le repli `document.execCommand('copy')` ne vérifie jamais son retour booléen ; le callback de succès (toast « ✅ Markdown copié ») est appelé inconditionnellement. Sur Safari, l'appel se fait après un `.catch()` asynchrone (fenêtre d'activation utilisateur déjà expirée) : le toast peut mentir. |
| Mineur | [css/mj.css:335](css/mj.css#L335) | `.mj-pill` force `-webkit-user-select: all` mais aucun `-webkit-touch-callout: none` n'est posé, alors que ces puces s'appuient sur `contextmenu` pour leur menu Modifier/Supprimer. Sur iPad, un appui long peut faire apparaître le callout natif Safari (Copier/Rechercher/Partager) à la place du menu applicatif. |

---

## 6. API JS diverses & structure HTML/meta

| Sévérité | Fichier | Détail |
|---|---|---|
| Majeur | [index.html:5](index.html#L5) | Le meta viewport n'a pas `viewport-fit=cover`, alors que le CSS mobile utilise déjà `env(safe-area-inset-bottom)` (ligne 981) : cette variable vaut donc toujours 0, la marge de sécurité en bas d'écran (barre d'accueil gestuelle) n'est jamais appliquée. |
| Majeur | [js/apropos.js:182](js/apropos.js#L182) | `aproposParseUserAgent()` teste `/Mac OS X/` avant `/iPhone\|iPad\|iPod/`. Depuis iPadOS 13, Safari envoie par défaut un user-agent identique à macOS (sans token iPad) : un iPad est donc systématiquement étiqueté « macOS » dans le formulaire de rapport de bug — ironique puisque c'est justement la plateforme visée par cette revue. |
| Majeur | [js/apropos.js:329](js/apropos.js#L329) | Le bouton d'aide au collage d'image indique « Ctrl+V », raccourci inexistant sur clavier virtuel mobile/tactile (accessible aussi depuis `#mobile-app`). |
| Majeur | [js/init.js:5](js/init.js#L5) | (déjà cité en section 1 — absence de listener resize/orientationchange). |
| Mineur | [index.html:36](index.html#L36) | Aucune balise `apple-touch-icon`/`apple-mobile-web-app-capable`/`apple-mobile-web-app-status-bar-style`, pas de `manifest.json`. Seul un favicon SVG est déclaré (non supporté par iOS comme icône d'écran d'accueil) : « Ajouter à l'écran d'accueil » depuis Safari donne une icône floue et rouvre avec la barre d'adresse visible. |

---

## Autres points relevés en section 1 (CSS/viewport)

| Sévérité | Fichier | Détail |
|---|---|---|
| Majeur | [css/base.css:389](css/base.css#L389) | `.input` (et équivalents `.mj-wf-input`, `.mj-owner-input`, `.field-input`/`.mj-field-input`) utilisent `font-size: 13–13.5px`, sous le seuil de 16px qui évite le zoom automatique de Safari iOS au focus. Le meta viewport n'ayant ni `maximum-scale` ni `user-scalable=no` (choix volontaire pour l'accessibilité, déjà documenté), ce zoom se déclenche réellement à chaque saisie. |
| Majeur | [css/mj.css:344](css/mj.css#L344) | Le formulaire d'insertion de widget (`.mj-wf-card`) est centré verticalement en `top:50%` figé dans un conteneur `position:fixed`, sans recalcul via `visualViewport` : sur iPad Safari en paysage, le clavier virtuel peut masquer le bouton de validation. |
| Mineur | [css/base.css:470](css/base.css#L470) | `backdrop-filter` sans `-webkit-backdrop-filter` sur `.modal-overlay` (idem `css/combat.css:145` pour `.cbt-overlay-dim`) : le flou de fond ne s'applique pas sur Safari < 15.4. |
| Mineur | [css/base.css:518](css/base.css#L518) | `.toast` est ancré à `bottom: 24px` sans `env(safe-area-inset-bottom)` : peut être trop proche du geste de retour sur iPhone à home indicator. |
| Mineur | [css/base.css:52](css/base.css#L52) | `#app` utilise uniquement `height: 100vh` sans le repli `100dvh` appliqué partout ailleurs dans le même fichier — incohérence qui peut couper le bas de l'UI desktop sur iPad en Stage Manager/Split View. |
| Mineur | [css/mj.css:29](css/mj.css#L29) | Les règles `:hover` du Mode MJ/Combat (`.mj-btn-combat`, `.mj-tag`, `.type-chip`, `.cbt-ctx-item`) ne sont jamais restreintes par `@media (hover: hover) and (pointer: fine)` : un tap sur iPad peut laisser un état hover visuellement « collé ». |

---

## Priorisation suggérée

1. **Détection tactile transversale** (section 1) — corrige d'un coup la cause racine de la moitié des findings critiques/majeurs.
2. **Fallback tactile sur les suppressions/éditions récemment ajoutées en clic droit** (section 2 et 3) — sinon des fonctionnalités livrées récemment sont inutilisables sur tablette.
3. **Robustesse du stockage** (section 4) — un échec silencieux d'IndexedDB/localStorage en navigation privée Safari peut donner l'impression que l'app perd des données.
4. **Zoom au focus des champs + clavier virtuel qui masque l'UI** (sections 1/5/6) — gêne perceptible dès la première utilisation sur iPhone.
5. Le reste (préfixes CSS, meta PWA, détection UA, libellés « Ctrl+V ») — polish, à traiter au fil de l'eau.
