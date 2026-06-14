# Refonte propre de la version mobile (compatibilité Safari iOS)

**Date** : 2026-06-14
**Branche** : Mode-MJ
**Approche retenue** : durcir l'existant (conserver la réutilisation des rendus desktop, corriger les couches Safari)

## Contexte

La version mobile (`< 1100px`) réutilise les fonctions de rendu desktop via un mécanisme
« ghost div » dans [js/mobile.js](../../../js/mobile.js) (renommage temporaire de l'`id`
`content-area` desktop pour rediriger les rendus vers une div mobile). Ce mécanisme reste
en place : il évite la divergence des features entre desktop et mobile.

Plusieurs problèmes spécifiques à Safari iOS ont été signalés :

1. La génération PDF ne fonctionne pas.
2. Les appuis longs ne se déclenchent pas toujours.
3. Appuyer rapidement sur les boutons déclenche un zoom.
4. (Demande) Les compteurs doivent être un onglet, pas un élément épinglé.
5. (Reporté) Le Mode MJ n'est pas accessible sur mobile.

## Décisions de périmètre

- **Mode MJ sur mobile** : reporté (hors de cette itération).
- **Refonte mobile dédiée** : non retenue. On garde la réutilisation des rendus desktop.
- **Vérification** : pas d'iPhone disponible. Validation dans le navigateur de preview
  (Chrome) pour le responsive, le zoom et la logique. Les correctifs Safari s'appuient sur
  les bonnes pratiques connues, sans test Safari réel.
- **Bouton menu ⋯ explicite** : approuvé.
- **PDF mobile via `window.print()`** : approuvé.

## Corrections

### 1. Zoom au tap & gestes tactiles

**Cause** : le viewport ([index.html:5](../../../index.html)) n'empêche pas le double-tap
zoom, et les éléments interactifs n'ont pas `touch-action: manipulation` (délai 300 ms +
double-tap zoom).

**Fix** :
- `touch-action: manipulation` sur `#mobile-app` et ses boutons/onglets/cartes.
- `-webkit-user-select: none` + `-webkit-touch-callout: none` sur les cibles interactives
  (cartes perso, header détail) pour supprimer la sélection/loupe iOS parasite.
- Viewport : conserver `width=device-width, initial-scale=1.0`. Ne **pas** ajouter
  `user-scalable=no` (ignoré par iOS récent, mauvais pour l'accessibilité ; `touch-action`
  règle le vrai problème).

### 2. Appui long fiable + bouton menu explicite

**Cause** : dans [js/mobile.js](../../../js/mobile.js), le timer de 500 ms
(`mobLongPressStart`) est annulé au moindre `touchmove` (iOS en émet en permanence), et le
menu natif iOS (sélection / callout) entre en concurrence.

**Fix** :
- Seuil de mouvement (~10 px) avant annulation du timer : on mémorise la position de départ
  dans `ontouchstart` et on n'annule dans `ontouchmove` que si le déplacement dépasse le seuil.
- Suppression du callout natif sur les cibles (cf. §1).
- Timer 500 ms conservé.

**En plus** : bouton **⋯** visible sur chaque carte perso (écran liste) et dans le header
détail. Au tap, il ouvre `openCharContextMenu` avec les coordonnées du bouton. L'appui long
reste disponible en complément, mais l'accès au menu ne dépend plus de lui.

### 3. Génération PDF compatible Safari

**Cause** : le flow PDF ([js/player/print.js](../../../js/player/print.js)) utilise
`window.open('', '_blank')` + `document.write` + `html2canvas` — tous hostiles à iOS Safari.
De plus, `confirmPrint` ([print.js:69](../../../js/player/print.js)) et le chemin « sans notes »
de `openPrintFlow` font un `await getCharacter` **avant** `window.open` : iOS Safari coupe le
geste utilisateur et bloque la popup.

**Fix (mobile)** : remplacer, lorsque `_isMobile()`, le `window.open` par un **overlay plein
écran dans la même page** contenant la fiche imprimable, puis appeler `window.print()`. iOS
Safari propose nativement « Imprimer → Enregistrer dans Fichiers / PDF ».
- Réutiliser les builders HTML existants (`_buildStatsSections`, `_buildAbilities`,
  `_buildInventaireAndNotes`, en-tête) — pas de duplication de logique.
- Règles `@media print` : masquer `#mobile-app` et tout le reste, n'afficher que l'overlay
  fiche ; restaurer l'état après impression (`afterprint`).
- Pas de `html2canvas`, pas de `jsPDF`, pas de popup sur mobile.

**Desktop** : flow actuel (nouvelle fenêtre + bouton « Télécharger PDF » via
html2canvas/jsPDF) **inchangé**.

### 4. Onglet Compteurs

Les compteurs sont **déjà** un onglet (`tab-compteurs`, géré par `mobSwitchTab` dans
[js/mobile.js](../../../js/mobile.js)), pas un élément épinglé. On conserve ce
fonctionnement et on s'assure qu'il reste propre (pas de zone compteurs résiduelle hors de
l'onglet). Aucun changement structurel attendu ici, sauf vérification.

### 5. Robustesse layout iOS

- `#mobile-app` : `height:100vh` → `height:100dvh` avec fallback `100vh`. Sur Safari iOS,
  `100vh` inclut la barre d'adresse et coupe le bas du contenu.
- `env(safe-area-inset-bottom)` ajouté au padding bas de `#content-area-mobile` (et zones
  scrollables) pour l'encoche / barre home.

## Fichiers concernés

- `index.html` — bloc `<style>` mobile (zoom, touch-action, 100dvh, safe-area), ajout des
  boutons ⋯ dans le markup des cartes/détail.
- `js/mobile.js` — long-press avec seuil, handlers du bouton ⋯.
- `js/player/print.js` — branche mobile `window.print()` dans `_generatePDF` / le flow PDF.
- `css/base.css` — si des règles mobiles partagées y vivent (à vérifier lors de l'implémentation).

## Critères de réussite

- Taper rapidement sur les onglets/boutons ne zoome plus (vérifiable en preview via
  émulation tactile + viewport mobile).
- Le menu contextuel d'un personnage est accessible via le bouton ⋯ (et via appui long).
- La génération PDF sur mobile ouvre une vue imprimable et déclenche `window.print()` sans
  popup bloquée.
- Les compteurs restent un onglet dédié.
- Le contenu n'est plus coupé en bas sur un viewport mobile.
- Le fonctionnement desktop est strictement inchangé.

## Hors périmètre

- Mode MJ sur mobile.
- Réécriture de la couche mobile dédiée (suppression du hack ghost-div).
