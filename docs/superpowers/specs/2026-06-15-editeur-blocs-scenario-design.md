# Éditeur de scénario par blocs (style Notion, source Markdown)

> Design validé — 2026-06-15. Branche : `rework-zone-text`.
> Objectif : remplacer le toggle « Aperçu / Modifier » des scénarios MJ par un
> éditeur **toujours rendu**, organisé en **pile de blocs** éditables au clic,
> avec un menu `/` de types de blocs — tout en gardant le **texte Markdown**
> comme source de vérité.

## 1. Contexte

Aujourd'hui (`js/mj/sessions.js`), un document de scénario a deux états mutuellement
exclusifs :

- **Édition** : une grande `<textarea>` (`#mj-doc-content`) avec le Markdown brut +
  `@tags` + widgets `/switch /todo /combo /compteur /jauge /details`.
- **Aperçu** (`_mjDocPreview`) : le contenu rendu en HTML via `_mjMarkdownWithTags`,
  où les widgets deviennent interactifs (`js/mj/tags.js`).

L'état des widgets vit **dans le texte** (ex. `/jauge[2]{Rituel: 6}`), persiste,
et part dans l'export ZIP. Les `@tags` sont résolus via `_mjTagIndex`.

On veut fusionner les deux états en une seule surface façon Notion, sans changer
le format de stockage.

## 2. Principes directeurs

1. **Source = Markdown texte.** `doc.content` reste une chaîne Markdown (avec
   `@tags` et tokens de widgets). Aucune migration des scénarios existants ;
   l'export ZIP, les `@tags`, les widgets et les rétroliens fonctionnent inchangés.
2. **Toujours rendu.** Plus de bouton Aperçu/Modifier, plus d'état `_mjDocPreview`.
   Le document s'affiche en permanence sous forme rendue.
3. **Édition locale.** Seul le **bloc en cours d'édition** montre sa syntaxe brute,
   le temps de la frappe ; il se re-rend dès qu'on en sort.
4. **Vanilla JS, pas de lib.** Aucune dépendance (pas de CodeMirror/ProseMirror),
   conformément à l'architecture du projet.
5. **Sérialisation triviale.** Le découpage en blocs et la recomposition doivent
   faire un aller-retour stable (`split` puis `join` sans perte).

## 3. Modèle de blocs

### 3.1 Découpage

Le `content` est découpé en **blocs séparés par une ligne vide**. Un bloc est une
unité Markdown de niveau paragraphe :

- un titre (`# …`, `## …`, `### …`) ;
- un paragraphe de texte ;
- **une liste entière** : les lignes consécutives `- …` / `* …` / `1. …` forment
  **un seul bloc** (pas un bloc par item — choix de simplicité pour la v1) ;
- une citation : lignes `> …` consécutives = un bloc ;
- un séparateur `---` ;
- un bloc `/details{… | …}` (qui peut contenir des lignes vides dans son corps).

**Protection des `/details` avant découpage.** Comme un `/details{}` peut contenir
des lignes vides, on l'extrait d'abord (réutiliser/adapter la logique de
`mjExtractDetails`) en plaçant un placeholder, on découpe le reste sur les lignes
vides, puis chaque `/details` redevient un bloc autonome. Cela garantit qu'on ne
coupe pas un `/details` en deux.

### 3.2 Représentation interne

Un bloc est simplement `{ id, raw }` où `raw` est le texte Markdown brut du bloc
(sans les lignes vides séparatrices). `id` est un identifiant éphémère (généré au
rendu, non persisté) servant à cibler le DOM et la textarea d'édition.

### 3.3 Sérialisation

`content = blocs.map(b => b.raw).join("\n\n")`.

Règle : on normalise à **une ligne vide** entre blocs. Un aller-retour
découpe → recompose ne doit pas modifier le sens du document (les multiples lignes
vides successives sont compactées, ce qui est acceptable et attendu).

### 3.4 Rendu

Chaque bloc est rendu via la pipeline existante (`_mjMarkdownWithTags` : Markdown +
`mjLinkifyTags` + `mjLinkifyWidgets`). Le conteneur du document empile les blocs
rendus, chacun dans un wrapper `.mj-block` portant `data-block-id`.

### 3.5 Index global des widgets (point critique)

Les fonctions de mutation de widgets (`mjWidgetToggle`, `mjWidgetGauge`,
`mjWidgetCombo`, `mjWidgetCount` dans `tags.js`) identifient un widget par son
**index d'ordre d'apparition `wi` dans le `content` complet**. Le rendu par blocs
doit donc attribuer un **index global continu** à travers les blocs (un compteur
qui ne se réinitialise pas entre blocs), pour que `wi` reste cohérent avec le
`content` complet utilisé par `_mjWidgetMutate`.

Implémentation : exposer un compteur de widgets partagé pendant le rendu de la
séquence de blocs (ex. réinitialiser un `_mjWidgetSeq = -1` avant de rendre la
liste, et faire en sorte que `mjLinkifyWidgets` l'utilise au lieu d'un `wi` local
par appel). À vérifier au test : un document multi-blocs avec plusieurs widgets se
bascule correctement bloc par bloc.

## 4. Interaction d'édition

### 4.1 Entrer en édition

- **Clic sur le texte d'un bloc** → le wrapper rendu est remplacé par une
  `<textarea>` auto-dimensionnée (hauteur = contenu) contenant le `raw` du bloc.
  Focus placé à la position du clic si possible, sinon en fin de bloc.
- L'autocomplétion `@` (ressources) et le menu `/` (types de blocs + widgets) sont
  actifs dans cette textarea, en ciblant son `id` via le mécanisme existant
  `_mjAcTargetId` (voir §5).

### 4.2 Sortir de l'édition

- **Clic en dehors du bloc** ou **`Échap`** → on commit le `raw` édité dans le
  modèle, on recompose `content`, on sauvegarde (différé via `_mjDocChanged`), et
  on re-rend le bloc (et au besoin ses voisins).

### 4.3 Clavier (convention Notion)

- **`Entrée`** : scinde le bloc courant à la position du curseur en deux blocs ;
  le curseur va au début du nouveau bloc (en dessous). Si le curseur est en fin de
  bloc, on crée simplement un bloc vide en dessous et on y entre.
- **`Maj+Entrée`** : insère un saut de ligne **dans** le bloc courant (pas de
  nouveau bloc).
- **`Retour arrière` en position 0 d'un bloc** : fusionne le bloc courant avec le
  précédent ; le curseur se place à la jointure. Si le bloc précédent n'existe pas,
  ne rien faire.

### 4.4 Interaction avec les widgets

- Un clic sur un **contrôle de widget** (interrupteur, segment de jauge, `<select>`
  de combo, boutons +/− du compteur, `<summary>` d'un details) **n'entre PAS** en
  mode édition : il actionne le widget (comportement actuel via `_mjWidgetMutate`).
  → ces éléments appellent `event.stopPropagation()` (ou le handler de clic du bloc
  ignore les clics dont la cible est un `.mj-wdg*` / `summary`).
- Pour éditer le texte autour d'un widget, on clique sur la partie texte du bloc.

### 4.5 Document vide / fin de document

- Un document vide affiche un bloc vide éditable (placeholder « Écris ton
  scénario… `@` pour lier, `/` pour un bloc »).
- Un clic dans la zone vide sous le dernier bloc crée/édite un bloc final.

## 5. Menu `/` (types de blocs)

On **étend** le mécanisme `/` existant de `tags.js` (`_MJ_WIDGET_AC`,
`_mjAcInsertWidget`). Aujourd'hui il ne s'active que dans `#mj-doc-content` ; il
faut le généraliser pour cibler la textarea du **bloc actif** (id dynamique).

Entrées du menu (regroupées) :

| Commande     | Insère                | Catégorie            |
|--------------|-----------------------|----------------------|
| `/h1`        | `# `                  | Titre                |
| `/h2`        | `## `                 | Titre                |
| `/h3`        | `### `                | Titre                |
| `/liste`     | `- `                  | Liste                |
| `/num`       | `1. `                 | Liste                |
| `/todo`      | `/todo{$}`            | Case à cocher (widget existant) |
| `/cite`      | `> `                  | Citation             |
| `/sep`       | `---`                 | Séparateur           |
| `/switch`    | `/switch{$}`          | Widget MJ            |
| `/combo`     | `/combo{$: a\|b}`     | Widget MJ            |
| `/compteur`  | `/compteur{$}`        | Widget MJ            |
| `/jauge`     | `/jauge{$: 6}`        | Widget MJ            |
| `/details`   | `/details{$ \| contenu}` | Widget MJ         |

(`$` = position finale du curseur, déjà géré par `_mjAcInsertWidget`.)

Les commandes de **titre/liste/citation/séparateur** insèrent un préfixe Markdown
au token `/…` ; comme on tape généralement `/` en début de bloc vide, le résultat
est un bloc du bon type. (On ne gère pas en v1 la « transformation » d'un bloc déjà
rempli via le menu — on insère le préfixe à la position du token.)

Aliases tolérés (filtrage `includes`) : `h1`/`titre`, `liste`/`puce`, etc. — au
choix lors de l'implémentation, sans complexité superflue.

## 6. Impacts sur le code existant

- **`js/mj/sessions.js`**
  - Supprimer `_mjDocPreview`, le bouton toggle, `mjDocTogglePreview`.
  - `mjRenderSessionDetail` : remplacer le bloc `editor` (textarea OU aperçu) par le
    **conteneur de blocs rendus**.
  - Ajouter les fonctions de l'éditeur de blocs : découpage, rendu de la séquence,
    entrée/sortie d'édition, gestion clavier, commit + recomposition + sauvegarde.
  - `mjSelectDocFromTree` / `mjAddDocTo` / `mjDeleteDoc` / `mjNewSession` : retirer
    les affectations à `_mjDocPreview` ; s'assurer que `mjBuildTagIndex` est appelé
    avant le rendu (les `@tags` doivent être résolus à l'affichage).
  - `_mjDocSaveNow` : lit désormais le `content` recomposé depuis les blocs (et le
    titre du document) au lieu de `#mj-doc-content`.
- **`js/mj/tags.js`**
  - Généraliser l'autocomplétion `/` pour cibler la textarea du bloc actif
    (réutiliser `_mjAcTargetId`, aujourd'hui figé sur `mj-doc-content` pour le mode
    widget).
  - Étendre `_MJ_WIDGET_AC` avec les entrées titres/listes/citation/séparateur.
  - Rendre l'index de widgets **global** au document lors du rendu par blocs (§3.5).
- **`css/mj.css`** : styles `.mj-block` (survol, curseur texte), textarea d'édition
  de bloc, placeholder du bloc vide.

## 7. Hors périmètre v1 (assumé)

- Poignée `⋮⋮` glisser-déplacer des blocs.
- Bouton `＋` au survol entre blocs.
- Menu par bloc (dupliquer / supprimer / transformer un bloc rempli).
- Bouton « Source » (édition brute du document entier) — **abandonné**.
- Liste = un bloc par item (on garde la liste entière en un bloc).
- Mobile : le Mode MJ reste desktop uniquement (≥ 1100px).

Le modèle de blocs (§3) est conçu pour accueillir ces ajouts ensuite sans
refonte.

## 8. Risques & points de vigilance

- **Cohérence de l'index de widgets** entre rendu par blocs et `_mjWidgetMutate`
  (§3.5) — à tester explicitement avec plusieurs widgets sur plusieurs blocs.
- **Aller-retour découpe/recompose** : vérifier qu'un document existant non modifié
  n'est pas altéré à la première édition (lignes vides multiples compactées =
  acceptable, mais pas de perte de contenu).
- **`/details` multi-lignes** : doit rester un bloc insécable au découpage.
- **Positionnement de l'autocomplétion** (`_mjCaretCoords`) dans une textarea de
  bloc auto-dimensionnée et potentiellement scrollée.
- **Sauvegarde différée** vs re-rendu : ne pas perdre la frappe en cours si un
  re-rendu intervient (commit avant re-rendu).
- **Cache-busting** : bumper `?v=` des fichiers modifiés dans `index.html` en même
  temps que `APP_CONFIG.version` (règle projet).

## 9. Vérification (manuelle, navigateur de preview)

1. Ouvrir un scénario existant → s'affiche entièrement rendu, sans bouton toggle.
2. Cliquer un paragraphe → édition brute ; modifier → re-rendu correct au blur.
3. `Entrée` crée un nouveau bloc ; `Maj+Entrée` saute une ligne dans le bloc ;
   `Retour arrière` en début de bloc vide fusionne avec le précédent.
4. `/` ouvre le menu ; insérer `/h2`, `/liste`, `/cite`, `/sep` → blocs corrects.
5. `@` résout une ressource ; le tag rendu est cliquable et navigue.
6. Document multi-blocs avec 2+ widgets : basculer chaque widget met à jour le bon
   token (index global cohérent).
7. `/details` multi-lignes : reste un seul bloc, repliable, contenu Markdown rendu.
8. Recharger la page → contenu identique (aller-retour stable).
