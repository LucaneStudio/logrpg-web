# Passation — Éditeur WYSIWYG inline (option D) — suite

> Reprise de session. Branche : `rework-zone-text`. Version : **1.7.14** (`js/config.js`).
> **Commité** : `8b24857` (éditeur WYSIWYG option D) + `a908af7` (clic droit tableaux) +
> commit listes. `origin/main` = v1.6.0 ; non poussée (push + note de version à la fin).
> Spec : `docs/superpowers/specs/2026-06-15-editeur-wysiwyg-inline-option-d-design.md`.

## Où on en est

Éditeur de scénario par blocs ; **seuls les blocs texte passent en `contenteditable` riche**
(option D). Stockage et lecture restent du **Markdown**. Moteur miroir dans `js/mj/rich.js`
(`mjMdToEditableHtml` / `mjEditableToMd`) ; reste de l'éditeur dans `js/mj/sessions.js`,
autocomplétion + widgets + menu contextuel dans `js/mj/tags.js`.

## ✅ Fait et VÉRIFIÉ (Chromium, vraie app avec `#mj-overlay`)

1. **Bug modale widget invisible** (le « bug Firefox » qui n'en était pas un) : la modale
   `#mj-wdg-form` (z 1200) et le popup combo `#mj-wdg-pick` (z 1300) passaient **sous**
   `#mj-overlay` (z 4998, fond opaque) → invisibles, focus quand même dedans (frappe en
   aveugle). Corrigé : z-index **11050 / 11060**. ⚠️ Leçon : **toujours tester dans la vraie
   app (overlay présent), pas en conteneur scratch** — c'est ce qui avait masqué le bug.

2. **Bug gras/ital partiel** : enlever le gras d'un mot DANS une zone grasse cassait
   (marqueurs parasites). `_mjPeelStyles` ne gérait que les marqueurs adjacents. Réécrit en
   **modèle caractère→marques** : `_mjRichModel`, `_mjRichModelPos`, `_mjRichSelIndices`,
   `_mjSerializeModel`, `mjRichFormatToggle` (+ `mjFormatUpdateState` rich). Gère toggle
   partiel / split / imbrication + boutons B/I/U/S corrects. (`_mjApplyMark`/`_mjPeelStyles`
   restent pour le chemin textarea.)

3. **Menu contextuel widget (clic droit) Modifier/Supprimer**, lecture ET édition :
   `mjWidgetContext`, `_mjShowWdgCtx`, `mjWdgCtxModify/Delete`, `mjWdgCtxClose`,
   `_mjWidgetTokenAt` (tags.js) ; `mjOpenWidgetEditFormRead` + branche `editRead` dans
   `mjWidgetFormSubmit` (sessions.js) ; puces routées via `mjWidgetContext` (rich.js).
   Menu `#mj-wdg-ctx` z 11070. « Modifier » ouvre la modale pré-remplie ; « Supprimer »
   retire le token (lecture via `_mjWidgetMutate`, puce en édition).

4. **Partie A — titres + citations en rich** (préfixe `#`/`>` séparé de l'inline) :
   `_mjSplitPrefix`, `_mjRichRaw`, `_mjIsRichBlock` (inclut titres/citations, exclut
   listes/séparateur/details/tableau), `_mjRichEditorHtml` (pose `data-bp` + classe
   `mj-rich-h1/h2/h3/quote`). Sérialisation préfixée dans `mjRichInput`, `mjRichBlur`,
   `mjRichSplit` (Entrée → le « après » devient un paragraphe), `mjRichMergePrev` (fusionne
   l'inline sans le préfixe de cur), `mjRichFormatToggle`. CSS `.mj-rich-h1/h2/h3/quote`.
   Vérifié : `## Titre` ↔ édition « Titre » (style H2, sans `##`), citation idem, round-trip OK.

## ✅ Partie B : bloc `/details` en MODALE — FAIT et VÉRIFIÉ (vraie app)

`/details` géré comme les widgets via une **modale Titre + Contenu (textarea)**.
Insertion via `/details` (autocomplétion) → modale → bloc rendu en `<details>` lecture.
Édition/suppression via **clic droit** sur le `<details>`.
- `_MJ_WDG_FORM.details` = `{title}` + `{body, type:'textarea'}`.
- `_mjOpenWf` : rend un `<textarea class="mj-wf-textarea">` si `f.type==='textarea'`
  (onkeydown **Échap seulement** → Enter = saut de ligne). Pré-remplissage synchrone.
- `_mjBuildWidgetToken` cas `details` → `/details{Titre | Contenu}` (assaini : `|`/`}` du
  titre, `}` du corps ; corps multi-lignes OK, `_mjSplitBlocks` protège déjà le token).
- `_mjDetailsTokenToVals`, `mjOpenDetailsForm(blockId, remaining, editToken)`,
  `mjMakeDetailsBlock(blockId, remaining, token)` (sessions.js).
- `mjWidgetFormSubmit` : branches `detailsInsert` / `detailsEdit`.
- `_mjAcConvertBlockRich` (tags.js) : `item.key==='details'` → `mjOpenDetailsForm(...)`.
- `mjWidgetContext` détecte `.mj-wdg-details` → `_mjShowWdgCtx(ev,{mode:'details',blockId})` ;
  `mjWdgCtxModify`/`mjWdgCtxDelete` gèrent `mode==='details'`.
- `mjBlockClick` : garde — un bloc `/details` n'entre pas en édition texte (édit = clic droit).
- CSS `.mj-wf-textarea`.
Vérifié dans la vraie app : insertion (texte avant conservé → 2 blocs), rendu `<details>`,
clic droit → Modifier pré-rempli (corps multi-lignes conservé) → mise à jour, Supprimer,
aller-retour `_mjBlocksToContent`→`_mjLoadBlocks` stable, garde mjBlockClick. Modale z 11050
(au-dessus de `#mj-overlay`). 0 erreur console.

## ✅ Tableaux : clic droit Modifier / Supprimer (FAIT)
`mjWidgetContext` détecte un bloc dont le `raw` est un tableau (`_mjIsTableBlock`) →
`_mjShowWdgCtx(ev,{mode:'table',blockId})`. `mjWdgCtxModify` mode `table` → `_mjEnterEdit`
(grille) ; `mjWdgCtxDelete` mode `table` → retire le bloc (corrige l'impossibilité de
supprimer un tableau). Vérifié dans la vraie app.

## ✅ Listes multi-niveaux (§7) — FAIT et VÉRIFIÉ
Bloc liste (puces `-` ou numéroté `1.`) édité en contenteditable : un `<div.mj-li>`
par item, niveau via `data-level`/`--lvl`. Comportement type Word :
- Entrée (texte) → item frère ; Entrée (item vide) → désindente, ou sort de la liste
  niveau 0 (l'item devient un paragraphe ; items suivants → nouvelle liste sous le para).
- Tab → indente (≤ niveau du précédent+1 ; 1er item non indentable) ; Maj+Tab → désindente.
- Backspace début d'item : niveau>0 → désindente ; sinon fusionne avec l'item précédent.
- Sérialisation : 2 espaces/niveau ; ordonné numéroté par compteurs de niveau.
- Marques B/I/U/S et tags `@` fonctionnent **dans l'item courant** (conteneur actif =
  `.mj-li`, via `_mjActiveRichContainer`). Sérialisation unifiée `_mjEditorToRaw(el)`.
- Rendu lecture (§7.2) : `renderMarkdown` (`js/player/notes.js`) respecte l'indentation
  (niveau = espaces/2, marqueurs •/◦/▪, listes numérotées avec leur n°). Bénéficie aussi
  aux notes joueur.
Fonctions (sessions.js) : `_mjIsListBlock`, `_mjParseList`, `_mjListToMarkdown`,
`_mjListSerialize`, `_mjLiInline`, `_mjEditorToRaw`, `_mjActiveRichContainer`,
`_mjListEditorHtml`, `mjListInput/Keydown/Blur`, `_mjListSplitItem`, `_mjListMergePrevItem`,
`_mjListExitToParagraph`. CSS `.mj-list-edit`/`.mj-li`.
Vérifié : pures 10/10, structure 7/7, marques+tags 6/6, Entrée/Tab/Maj+Tab en vrai éditeur.

## ✅ Copier/coller Markdown (§9) + séparateur — FAIT
- **Copier Markdown** : bouton « ⧉ Markdown » dans l'en-tête du document →
  `mjCopyDocMarkdown()` copie `_mjBlocksToContent()` (clipboard API + repli execCommand).
- **Coller** : `mjRichPaste` (onpaste sur rich + liste) n'insère QUE le `text/plain`
  (`_mjInsertPlainTextAtCaret`) — le HTML externe est ignoré (pas de styles arbitraires).
- **Séparateur** (`---`) : rendu en `<hr>` ; clic gauche n'entre pas en édition ; clic droit
  → menu « Supprimer » seul (Modifier masqué pour `mode:'sep'`). Insertion via `/sep`.
Vérifié dans la vraie app : copie sans erreur, collage sanitisé (gras/script supprimés),
séparateur supprimable.

## 🧹 Dette — RÉSOLUE
- Les 4 octets NUL de `_mjSplitBlocks` sont remplacés par `_MJ_BLK_SENT =
  String.fromCharCode(0xE010)` ; `sessions.js` est de nouveau du texte (ripgrep/Grep OK).

## ✅ Clic droit « Supprimer » sur tous les items MJ — FAIT
Menu contextuel générique `mjItemContext(ev, action)` (js/mj/view.js, `#mj-item-ctx`,
réutilise les classes `.mj-wdgctx-*`, z 11070) branché en `oncontextmenu` sur sessions,
scénarios (arbre), PNJ, objets, lieux, combats, images. « Supprimer » → modale
`appConfirm` (z 10000, au-dessus de l'overlay 4998). Les confirmations PNJ/combat/image
qui utilisaient `confirm()` natif sont passées à `appConfirm` (modale stylée) ; nouveau
`mjDeleteScenarioConfirm(sessionId, docId)` sûr hors session courante. Vérifié (session
+ PNJ supprimés via la modale).

## ⏭️ Ensuite — il ne reste que la FIN
- Pousser la branche `rework-zone-text` + rédiger la **note de version** (demande
  utilisateur : à la toute fin, une fois tout terminé). Penser à recenser les bumps
  de version internes (actuellement v1.7.17).

## Tester / lancer
- Serveur `logrpg-static` : `python -m http.server 8777 --bind 127.0.0.1`. L'utilisateur teste
  sur **localhost:8777 en Firefox**. Preview Claude = Chromium.
- **Mode MJ desktop only** : `openMjMode()` sort si `innerWidth < 1100` → `preview_resize` ≥ 1100
  AVANT d'ouvrir. Vérifier **dans la vraie app** (overlay présent).
- À chaque édition d'un fichier déjà servi : **bumper** `APP_CONFIG.version` + les `?v=` de
  `index.html` (`sed -i 's/?v=A/?v=B/g' index.html`), sinon cache. Ctrl+F5 côté utilisateur.
- Repro éditeur en scratch (logique pure) : `host.innerHTML=mjBlockEditorHtml({});
  mjMountBlockEditor('texte', null); _mjEnterEdit(_mjBlocks[0].id);` — MAIS pour tout ce qui
  touche overlay/z-index/contextuel, tester dans la vraie app.
