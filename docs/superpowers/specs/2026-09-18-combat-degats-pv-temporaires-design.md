# Dégâts combat (saisie libre) + PV temporaires qui absorbent

> Design validé — 2026-09-18. Branche : `v1.7.0`.
> Objectif : (1) permettre de saisir un montant de dégâts/soin libre au lieu de
> cliquer −5/−1/+1/+5, et (2) faire en sorte que les PV temporaires absorbent
> réellement les dégâts avant les PV réels — en Mode Combat **et** sur la fiche
> perso (Mode Joueur), qui ont chacun leur propre bug sur ce point.

## 1. Contexte — retour utilisateur

> « pendant les combats ce serait cool de pouvoir saisir les dégâts infligés à
> la main (genre Camille parfois elle me fait 44 pts de dégâts et c'est
> compliqué avec des 5 et des 1) »
>
> « les pv temporaires ça marche pas hyper bien quand on inflige des dégâts un
> peu »

Deux bugs distincts découverts en creusant le code, un par écran :

**Mode Combat** (`js/combat/state.js`) — `combatChangeHp(id, delta)` modifie
`currentHp` directement, sans jamais toucher `tempHp`. Les PV temporaires ont
leurs propres boutons ±1 (`combatChangeTempHp`), totalement déconnectés des
dégâts : encaisser un coup ne les entame jamais.

**Fiche perso** (`js/player/counters.js`) — modèle différent, bug différent.
`adjHp(d)` laisse `CS.hp` monter jusqu'à `hpMax + hpTemp` (les PV réels et
temporaires partagent une seule plage). La barre visuelle calcule correctement
la portion "temp" restante à l'affichage (`tempPct`), mais **`CS.hpTemp`
lui-même n'est jamais décrémenté** par `adjHp` : après des dégâts, le chiffre
"+X PV temp." affiché reste celui d'avant le coup, alors que la barre, elle,
a raison. Les deux se contredisent visuellement.

Saisie des dégâts : 4 boutons fixes −5/−1/+1/+5 (`js/combat/view.js:287-288`
pour le menu contextuel, `js/combat/view.js:84-93` pour le panneau détail).
Pour 44 dégâts : 8 clics sur −5 + 4 sur −1.

## 2. Règle métier (confirmée avec l'utilisateur)

- **Dégâts** : les PV temporaires absorbent en premier. Exemple : 20/20 PV +
  10 PV temp (30 "effectifs"), 15 dégâts → PV temp 10→0, PV réels 20→15
  (5 dégâts réels après avoir mangé les 10 temp).
- **Soin** : remonte uniquement les PV réels (plafonné à `hpMax`), ne touche
  jamais les PV temporaires. C'est déjà le comportement actuel des deux
  écrans pour les deltas positifs — rien à changer de ce côté.
- Les PV temporaires eux-mêmes ne se regagnent que via leur bouton dédié
  (±1 existant, inchangé) — pas de nouvelle mécanique d'octroi ici.

Cette règle doit s'appliquer de façon identique quel que soit le montant
(boutons ±1/±5 existants **et** nouveau champ libre) : une seule fonction de
mutation par écran, pas de logique dupliquée.

## 3. Mode Combat — `js/combat/state.js` / `js/combat/view.js`

### 3.1 Logique

`combatChangeHp(id, delta)` change de comportement uniquement pour un delta
négatif (dégâts) :

```js
function combatChangeHp(id, delta) {
  if (delta < 0) {
    _updateP(id, p => {
      let dmg = -delta;
      const tempUsed = Math.min(p.tempHp || 0, dmg);
      dmg -= tempUsed;
      return {
        ...p,
        tempHp: (p.tempHp || 0) - tempUsed,
        currentHp: Math.max(0, p.currentHp - dmg),
      };
    });
  } else {
    _updateP(id, p => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + delta) }));
  }
}
```

La branche `delta >= 0` reproduit exactement le comportement actuel (aucune
régression sur le soin). Les boutons ±1/±5 existants passent déjà par cette
fonction (`combatHpAction`, `js/combat/view.js:483`) : ils héritent du fix
sans autre changement.

### 3.2 UI — nouveau champ, deux emplacements

Sous la ligne −5/+5 existante, nouvelle ligne :

```
[ champ nombre ]  [🩸 Dégâts]  [💚 Soin]
```

- **Panneau détail** du participant actif (`js/combat/view.js`, section
  `❤️ POINTS DE VIE`, après la ligne −5/+5 actuelle).
- **Menu contextuel** clic-droit (`_renderCtxMenu`, `js/combat/view.js:283`),
  sous la rangée de boutons `hpBtns` actuelle.
- 🩸 Dégâts appelle `combatChangeHp(id, -val)`, 💚 Soin appelle
  `combatChangeHp(id, +val)`, où `val = Math.abs(parseInt(champ) || 0)`
  (0 ou vide → no-op, pas d'erreur ; `Math.abs` évite qu'un nombre tapé en
  négatif inverse silencieusement le sens du bouton cliqué).
- Le champ **garde sa valeur** après clic (ne se vide pas) : permet
  d'appliquer le même montant à plusieurs participants d'affilée (sort de
  zone touchant plusieurs PJ, par exemple), sans retaper le nombre.
- Pas de comportement spécial sur Entrée dans le champ (pas d'ambiguïté
  dégâts/soin implicite) — il faut cliquer un des deux boutons.

## 4. Fiche perso — `js/player/counters.js`

### 4.1 Recalage du modèle sur celui du Mode Combat

Aujourd'hui `CS.hp` peut dépasser `hpMax` (jusqu'à `hpMax + hpTemp`) et
`CS.hpTemp` ne bouge qu'via ses boutons dédiés. On aligne sur le modèle du
Mode Combat : `CS.hp` toujours borné à `[0, hpMax]`, `CS.hpTemp` son propre
pool qui se vide réellement quand il absorbe des dégâts.

```js
function adjHp(d) {
  if (d < 0) {
    let dmg = -d;
    const tempUsed = Math.min(CS.hpTemp, dmg);
    CS.hpTemp -= tempUsed;
    dmg -= tempUsed;
    CS.hp = Math.max(0, CS.hp - dmg);
  } else {
    CS.hp = Math.min(CS.hpMax, CS.hp + d);
  }
  updateHpUI();
  saveCS({ hpCurrent: CS.hp, temporaryHealth: CS.hpTemp });
}
```

Note : `saveCS` doit maintenant aussi persister `temporaryHealth` depuis
`adjHp` (avant, seul `hpCurrent` était sauvé à cet endroit — `hpTemp` ne
changeait jamais depuis cette fonction donc ce n'était pas nécessaire).

### 4.2 Barre et légende (`renderHpBlock`)

Avec `CS.hp` désormais toujours `≤ hpMax`, `basePct` et `tempPct` doivent
être recalculés sur un pied d'égalité avec le Mode Combat :

- `basePct = hpMax > 0 ? hp / hpMax * 100 : 0` (plus besoin de `Math.min`,
  `hp` ne dépasse déjà plus `hpMax`).
- `tempPct = hpMax > 0 ? Math.min(hpTemp / hpMax * 100, 100 - basePct) : 0`
  (la portion temp affichée après la portion réelle, cohérente avec le Mode
  Combat `js/combat/view.js:76`).
- `hp-temp-legend-val` affiche directement `hpTemp` (plus de décalage
  possible avec la barre, puisque `hpTemp` reflète maintenant la vraie
  valeur restante).

### 4.3 UI — même champ que le Mode Combat

Même rangée `[champ] [🩸 Dégâts] [💚 Soin]` ajoutée sous la ligne ±1 actuelle
du bloc PV (`renderHpBlock`, sous les boutons `ctr-controls`). Mêmes règles :
champ persistant, pas de comportement spécial sur Entrée, `val =
Math.abs(parseInt(champ) || 0)` appelle `adjHp(-val)` ou `adjHp(+val)`.

## 5. Hors périmètre (confirmé avec l'utilisateur)

- Pas de nouvelle mécanique d'octroi de PV temporaires (le bouton ±1 dédié
  suffit, inchangé).
- Pas de règle de non-cumul façon D&D (« le plus haut des deux remplace » :
  ici on reste sur un compteur manuel qui s'additionne via les boutons
  existants, pas de changement de ce côté).
- Mana / mana temporaire (`adjMana`, `adjManaTemp`) non touchés : le
  retour utilisateur ne mentionne que les PV, et le mana n'a pas la même
  sémantique de "dégâts" — hors périmètre de ce groupe.

## 6. Tests / vérification

- Mode Combat : participant 20/20 PV + 10 temp → 15 dégâts via le nouveau
  champ → attendu 15/20 PV, 0 temp. Puis +8 soin → 20/20 (pas d'effet sur
  temp, qui reste à 0).
- Mode Combat : mêmes montants appliqués via boutons −5/−1 existants →
  résultat identique (même fonction `combatChangeHp`).
- Fiche perso : même scénario, vérifier que la légende "+X PV temp." et la
  barre restent synchronisées après les dégâts (c'est précisément le bug
  actuel).
- Vérifier qu'un soin ne fait jamais remonter `tempHp` (ni Mode Combat, ni
  fiche perso).
- Champ vide ou non numérique + clic Dégâts/Soin → aucun changement, pas
  d'erreur console (`parseInt('') || 0` → 0).
- Regression check : boutons ±1/±5 (Mode Combat) et ±1 (fiche perso) pour le
  soin se comportent exactement comme avant (aucune régression sur ce
  chemin, il n'est pas modifié).
