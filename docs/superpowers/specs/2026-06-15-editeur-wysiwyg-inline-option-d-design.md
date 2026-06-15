# Éditeur WYSIWYG inline (option D) — masquer le Markdown à l'édition

> Design validé en discussion — 2026-06-15. Branche : `rework-zone-text`.
> Suite de l'éditeur par blocs (spec `2026-06-15-editeur-blocs-scenario-design.md`).
> Objectif : éditer le contenu **sans jamais voir ni taper la syntaxe Markdown**,
> tout en gardant le **Markdown comme format de stockage**.

## 1. Contexte & problème

L'éditeur par blocs actuel a trois modes d'édition selon le bloc :

- **Texte** (titre, paragraphe, liste, citation) : édité dans une `<textarea>` qui
  montre le **Markdown brut** (`# Titre`, `**gras**`, `/combo{…}`, `@{Nom}`).
- **Tableau** : éditeur en **grille** (formulaire), aucune syntaxe visible.
- **`/details`** : bloc repliable, corps en Markdown.

La lecture (rendu) et le stockage sont déjà 100 % Markdown.

Le tableau a montré qu'une édition « formulaire » est très confortable, mais il était
**facile** car bloc-niveau et autonome (il occupe tout le bloc, pas de prose autour).
Le point douloureux restant : les **objets inline** — widgets (`switch`, `combo`,
`compteur`, `jauge`, `todo`) et la **mise en forme** (gras/ital/souligné/barré) — sont
noyés dans la prose. En mode édition texte, l'utilisateur revoit donc la syntaxe brute
inline, ce qui n'est pas accueillant pour un non-initié au Markdown.

**But de l'option D :** remplacer le mode édition *texte* (la `<textarea>` brute) par
une zone **`contenteditable` riche** où tout est rendu pendant la frappe, sans changer
ni la lecture ni le stockage.

## 2. Principe directeur (ce qui ne bouge PAS)

L'astuce qui rend D raisonnable : on **ne touche ni à la lecture ni au stockage**.

- **Stockage** : `doc.content` / `notes` restent du **Markdown texte**. Sauvegarde,
  export ZIP, index des `@tags`, rétroliens, copier-Markdown : inchangés.
- **Lecture** : rendu Markdown → HTML existant (`_mjMarkdownWithTags`), inchangé
  (sauf l'upgrade « listes imbriquées », voir §7).
- **Seul changement** : le **mode édition d'un bloc de texte** passe de
  `<textarea>` (brut) à `contenteditable` (riche).

Le **modèle en blocs ne change pas** : titre, paragraphe, liste, citation, tableau,
`/details`. Le découpage (ligne vide) et la recomposition (`\n\n`) restent identiques.

## 3. Les deux fonctions miroir (cœur technique)

Tout repose sur un couple de fonctions rigoureusement inverses :

1. **`markdown → DOM éditable`** : variante du rendu actuel produisant du contenu
   **éditable** — texte, `<strong>/<em>/<u>/<s>`, et **puces atomiques** pour les
   widgets et les `@tags` (au lieu du HTML figé de lecture).
2. **`DOM éditable → markdown`** : l'inverse, appelé en quittant le bloc (et/ou en
   différé). Parcourt le DOM du bloc et reconstruit la chaîne Markdown :
   - nœud texte → texte (en ré-échappant si besoin) ;
   - `<strong>`→`**…**`, `<em>`→`*…*`, `<u>`→`__…__`, `<s>`→`~~…~~` ;
   - puce widget → son token (`/combo[..]{…}`, `/switch[x]{…}`…) lu sur ses
     `data-*` ;
   - puce tag → `@{Nom}` ;
   - `<br>` / fin de ligne → `\n` ;
   - préfixe selon le type de bloc (`# `, `## `, `### `, `- `, `> `).

Le résultat repart dans `block.raw` **exactement comme aujourd'hui**. La fidélité de
cet aller-retour est l'exigence n°1 (voir §9, tests).

## 4. Vocabulaire inline supporté

Dans un bloc de texte, le `contenteditable` n'autorise QUE :

- du **texte** et des **retours à la ligne** (`<br>`) ;
- les **marques** gras / italique / souligné / barré (vrais `<strong>/<em>/<u>/<s>`,
  posées par la barre B/I/U/S sur la sélection — cumulables, souligné⇄barré exclusifs,
  comme la logique déjà en place) ;
- des **puces atomiques** : widgets et `@tags`.

Pas d'images, pas de tableaux, pas de titres *dans* un paragraphe : la structure de
bloc reste portée par le bloc lui-même.

## 5. Puces (widgets & tags)

Une **puce** est un élément inline **atomique** : `contenteditable="false"`, sélectionné
et supprimé d'un seul tenant, porteur de ses données en `data-*`.

### 5.1 Widgets
- **Insertion** : menu `/` → ouvre un **petit formulaire** adapté au type
  (ex. combo : libellé + liste d'options ; jauge : libellé + nombre de segments ;
  compteur : unité + min/max ; switch/todo : libellé). À la validation, une puce est
  insérée **à la position du curseur**, dans la phrase.
- **Affichage** : la puce ressemble au widget rendu en lecture (interrupteur, segments,
  select…). Son **état** (on/off, valeur…) reste éditable comme aujourd'hui.
- **Édition de structure** : clic sur la puce → **popover** rouvrant le formulaire
  (libellé/options) + bouton supprimer.
- **Suppression** : `Retour arrière` / `Suppr` adjacent à la puce la retire entière.

### 5.2 Tags `@`
- **Insertion** : autocomplétion `@` (existante) → pose une **puce-tag** cliquable
  (navigation vers la ressource, comme en lecture).
- Réutilise `_mjTagIndex`, `mjTagGo`, les aperçus au survol.

## 6. Types de bloc & conversion

- Conversion via `/` en début de bloc (`/h1 /h2 /h3 /liste /cite /sep /tab`) **ou** un
  sélecteur de type sur le bloc — sans jamais afficher `#`, `>`, etc.
- `/tab` et `/details` créent leurs blocs dédiés (grille / conteneur), comme déjà fait.

## 7. Listes (comportement type Word) — le type le plus fin

Un bloc-liste devient une structure `[{ niveau, texte_riche }]`. Règles d'édition :

- **Entrée** dans un item (avec texte) → nouvel item **frère** au même niveau, curseur
  dedans.
- **Tab** dans un item → **indente** d'un niveau (sous-item du précédent). Possible
  seulement s'il existe un item au-dessus pour servir de parent (le 1er item ne peut
  pas s'indenter).
- **Maj+Tab** → **désindente** d'un niveau.
- **Entrée sur un item vide** → désindente d'un niveau ; si déjà au niveau racine →
  **sort de la liste** (l'item vide redevient un paragraphe normal sous la liste).

### 7.1 Sérialisation
Indentation Markdown standard : **2 espaces par niveau**.
```
- item racine
  - sous-item
    - sous-sous-item
- autre item racine
```
Le bloc-liste reste **un seul bloc** (lignes `-` consécutives, pas de ligne vide).

### 7.2 Upgrade du rendu lecture (nécessaire)
Le renderer actuel (`renderMarkdown`, `js/player/notes.js`) **aplatit** toutes les
puces (il `trim()` la ligne et ignore l'indentation). Il faut le faire **respecter
l'indentation** (2 espaces = 1 niveau) pour que les sous-niveaux s'affichent en retrait
en lecture, cohérents avec l'édition. (Impacte aussi les notes joueur — amélioration
bienvenue.)

## 8. Limitation assumée : pas de blocs gigognes (sauf sous-listes)

- **Interdit** : un bloc dans un bloc — liste dans citation, tableau dans citation,
  citation dans une puce de liste, etc. Rare en scénario, explose le sérialiseur.
- **Autorisé** : les **sous-niveaux de liste** (§7), qui sont une imbrication
  liste-dans-liste gérée explicitement.
- **`/details`** = seul vrai conteneur : son **corps** est son propre petit
  sous-éditeur de blocs, pas une imbrication générale.

## 9. Copier / coller Markdown

- **Copier en Markdown** : un bouton dédié copie `doc.content` (ou `notes`) brut — c'est
  déjà le format de stockage, donc trivial. Permet de réutiliser un contenu comme
  template dans un autre fichier.
- **Coller du Markdown** : on peut alimenter un bloc/document depuis du Markdown collé
  (passe par `markdown → DOM éditable`). Le **collage de HTML externe** est en revanche
  **nettoyé en texte** (pas d'import de styles arbitraires).

## 10. Risques & points de vigilance

- **Fidélité de l'aller-retour** `markdown ↔ DOM` (§3) : la priorité absolue. Un
  contenu non modifié doit revenir identique après une édition.
- **Curseur autour des puces atomiques** : flèches, `Retour arrière`/`Suppr` qui
  retirent la puce d'un bloc ; placer le curseur avant/après une puce en début/fin de
  ligne.
- **Application des marques** sur une sélection **sans `execCommand`** (déprécié) :
  manipulation manuelle des Range, en réutilisant la logique de cumul existante.
- **Collage** : sanitisation HTML externe → texte.
- **Listes** : la gestion niveaux + Entrée/Tab/Maj+Tab + sortie de liste (§7).
- **Cohérence de l'index des widgets** : déjà géré globalement par bloc (`mjBeginWidgetSeq`),
  à préserver.

## 11. Stratégie de mise en œuvre (incrémentale, faible risque)

Comme lecture et stockage ne bougent pas, on construit D **à côté** de l'éditeur actuel
et on bascule **type de bloc par type de bloc** :

1. **Pilote sur le paragraphe** : moteur `contenteditable` + couple de sérialisation +
   marques (B/I/U/S) + puces tags. Valider la fidélité de l'aller-retour.
2. **Puces widgets** : formulaires d'insertion + popover d'édition + suppression
   atomique.
3. **Titres & citation** : même moteur, juste le type/préfixe qui change.
4. **Listes** : structure à niveaux + comportement Word (§7) + upgrade du rendu lecture.
5. **`/details`** : corps en sous-éditeur.
6. **Copier/coller Markdown** : boutons dédiés.

Le tableau garde son éditeur en grille existant (déjà conforme à l'esprit D).

À chaque étape, le bloc non encore migré retombe sur l'édition `<textarea>` actuelle :
on peut livrer progressivement sans tout casser.

## 12. Hors périmètre

- Blocs gigognes arbitraires (sauf sous-listes et corps de `/details`).
- Images inline, couleurs de texte, autres marques exotiques.
- Mode mobile (Mode MJ reste desktop ≥ 1100px).
- Réordonnancement des blocs par glisser-déposer (toujours non prévu ici).

## 13. Vérification

1. **Aller-retour** : pour un échantillon de contenus (gras imbriqué, widgets inline,
   tags, listes multi-niveaux, citation avec gras), `markdown → DOM → markdown` rend une
   chaîne **équivalente** (idempotence).
2. **Frappe** : taper du texte, appliquer B/I/U/S sur une sélection → rendu live correct,
   sérialisation correcte au blur.
3. **Widget** : `/` → formulaire → puce insérée dans la phrase ; clic → popover →
   modif/suppr ; état (toggle/valeur) toujours interactif ; token correct en sortie.
4. **Tag** : `@` → puce cliquable → navigation.
5. **Liste** : Entrée (frère), Tab (indente), Maj+Tab (désindente), Entrée sur item vide
   (désindente puis sort) ; sérialisation en 2 espaces/niveau ; rendu lecture en retrait.
6. **Copier-Markdown** : le bouton renvoie le Markdown brut attendu ; recharger la page
   conserve le contenu identique.
7. **Cache-busting** : bumper `?v=` + `APP_CONFIG.version` (règle projet).
