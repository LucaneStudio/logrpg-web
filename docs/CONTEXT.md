# LogRPG Web — Contexte de session

> Doc de passation pour reprendre le travail dans une nouvelle session.
> Dernière mise à jour : 2026-06-15.

## Vue d'ensemble
- App web **vanilla JS** (pas de build, pas de framework), servie en statique.
- Persistance locale via **Dexie / IndexedDB** (instance globale `db`).
- Deux UI : **desktop** (`#app`) et **mobile** (`#mobile-app`), basculées par media query à **1100px**.
- Branche de travail : **`Mode-MJ`**. Branche principale : `main`.
- Version courante : **1.6.0** (dans `js/config.js`).

## Lancer / tester
- Serveur statique : `python -m http.server 8777` (config preview dans `.claude/launch.json`).
- Pas de tests automatisés ; vérification manuelle via le navigateur de preview.

## Architecture des fichiers
- `index.html` — tout le markup + **toutes les modales** + chargement des scripts (en bas).
- `css/` : `base.css` (joueur + commun), `combat.css`, `mj.css` (Mode MJ).
- `js/config.js` — `APP_CONFIG.version`, affiche le badge de version.
- `js/db.js` — Dexie v1 (personnages), `openModal/closeModal`, **`appConfirm(msg, onOk, {okLabel,danger})`** (modale de confirmation stylée, à préférer à `confirm()`).
- `js/player/` — `counters.js` (PV/Mana/Monnaie + **compteurs personnalisés**), `caract.js`, `capacites.js`, `inventaire.js`, `notes.js` (`renderMarkdown`/`inlineMd`), `profile.js`, `print.js` (PDF).
- `js/combat/` — bestiaire, setup, state, view.
- `js/mj/` — `db.js` (Dexie v2/v3 + CRUD + export/import ZIP), `view.js` (shell + nav + `mjSwitchSection`), `sessions.js` (scénarios), `encounters.js`, `npcs.js`, **`objects.js`** (Objets + Lieux), `assets.js`, `pj.js`, `tags.js` (tags `@`, autocomplétion, widgets `/`, aperçus).
- `js/mobile.js` — couche mobile.

## Pièges / conventions importantes
- **Cache-busting** : les assets locaux sont en `?v=<version>` dans `index.html` (28 balises). **À bumper en même temps que `APP_CONFIG.version` à chaque release**, sinon les utilisateurs (et le preview) gardent d'anciens fichiers → bugs de mismatch. (Cause racine de plusieurs bugs « ça marche pas sur mobile ».)
- **Cache du preview** : il sert souvent des fichiers en cache même après reload. Pour tester en frais : bumper `?v=` (nouvelles URLs) **ou** changer le port dans `launch.json` (nouvelle origine).
- **Modales** : doivent être **hors de `#app`** dans `index.html` (sinon masquées sur mobile, car `#app { display:none }` < 1100px).
- **Mobile** : `mobile.js` réutilise les rendus desktop via un hack « ghost-div » (renommage temporaire de l'`id` `content-area`/`counters-content`). `renderCountersContent` est monkey-patché pour cibler la zone mobile. Tout passe par `renderCountersContent`, donc les features compteurs apparaissent automatiquement sur mobile.
- **Dexie** : déclarer les `db.version(n).stores()` **avant** ouverture ; versions en ordre croissant (v1 dans `js/db.js`, v2+v3 dans `js/mj/db.js`).

## Mode MJ — système de tags (`js/mj/tags.js`)
- Tag `@Nom` ou `@{Nom complet}` dans le contenu (rendu en mode Aperçu). Résolu via `_mjTagIndex` (reconstruit par `mjBuildTagIndex`).
- Types : `scenario`, `encounter`, `npc`, `objet`, `lieu`, `asset` (table `_MJ_TAG_META`).
- Autocomplétion `@` **généralisée** : `mjAcUpdateField(el)` la branche sur n'importe quel input (ex. champ propriétaire d'un objet), `mjAcUpdate()` reste pour le scénario (qui a aussi les widgets `/`).
- Widgets de scénario (mode Aperçu, état stocké dans le texte) : `/switch /todo /combo /compteur /jauge /details`.
- Menu « créer depuis un tag cassé » : clic sur un `@tag` inexistant → créer la ressource.

## Travaux récents
- **1.4.x** : refonte mobile Safari (zoom, appui long, PDF via iframe, layout) — repliée dans 1.5.0.
- **1.5.0** : widgets de scénario MJ ; compteurs personnalisés joueur (types simple/jauge/cases/repos/pas, couleur, reset) ; ressources MJ **Objets** & **Lieux** taggables ; menu créer-depuis-tag-cassé ; cache-busting ; refonte affichage des notes de version (hiérarchie + `code` inline).
- **1.6.0** (en cours, dernier commit `3fa1e9e`) :
  - Objets : raretés **personnalisables** (localStorage `mj_obj_rarities`, éditeur via ⚙️) ; **propriétaire** = ligne de texte libre avec autocomplétion `@` (taggable PNJ).
  - Lieux : vignette colorée arrondie avant le nom + **image ouvrable en plein écran** (`mjOpenImageLightbox`).
  - Style des tags Objet/Lieu (fond/contour) aligné sur les autres.

## Idées / pistes non faites
- Réordonner les compteurs perso (drag) ou les épingler sur la fiche.
- Mode MJ sur **mobile** (actuellement desktop ≥ 1100px uniquement).
- Widgets de scénario supplémentaires proposés mais non retenus : `/dé`, `/secret`.
- Automatiser le bump du `?v=` cache-busting depuis `APP_CONFIG.version` (éviter l'oubli manuel).
