# Dégâts combat (saisie libre) + PV temporaires qui absorbent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un champ de saisie libre pour appliquer des dégâts/soins en Mode Combat et sur la fiche perso, et des PV temporaires qui absorbent réellement les dégâts avant les PV réels sur les deux écrans.

**Architecture:** Deux moteurs d'état séparés et déjà existants (`combatChangeHp` dans `js/combat/state.js` pour le Mode Combat, `adjHp` dans `js/player/counters.js` pour la fiche perso) reçoivent chacun le même correctif logique (absorption temp → réel côté dégâts, rien de changé côté soin), suivi de l'ajout d'un champ + deux boutons (🩸 Dégâts / 💚 Soin) réutilisant ces fonctions corrigées sur chaque écran concerné.

**Tech Stack:** Vanilla JS (pas de framework), tests via pages HTML autonomes chargeant les fichiers réels (convention déjà en place dans `tests/roundtrip.html`), vérification manuelle UI via le serveur statique du projet (`.claude/launch.json`, config `logrpg-static`, port 8777).

**Spec :** `docs/superpowers/specs/2026-09-18-combat-degats-pv-temporaires-design.md`

---

### Task 1: Mode Combat — PV temporaires absorbent les dégâts (`combatChangeHp`) ✅ DONE (commit 95854af, reviews OK)

**Files:**
- Modify: `js/combat/state.js:101-104`
- Test: `tests/combat-hp-temp.html` (nouveau)

- [ ] **Step 1: Écrire le test (qui doit échouer avec le code actuel)**

Créer `tests/combat-hp-temp.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Test — PV temporaires absorbent les dégâts (combatChangeHp)</title>
  <style>
    body { font-family: ui-monospace, Menlo, Consolas, monospace; background:#0f1419; color:#d6dde6;
           margin:0; padding:24px; line-height:1.5; }
    h1 { font-size:16px; color:#fff; margin:0 0 4px; }
    .sub { color:#7b8794; font-size:12px; margin-bottom:18px; }
    #summary { font-size:14px; font-weight:700; padding:10px 14px; border-radius:8px; margin-bottom:16px; }
    .ok  { background:#15351f; color:#7ee2a8; }
    .ko  { background:#3a1620; color:#ff8aa3; }
    table { border-collapse:collapse; width:100%; font-size:12px; }
    th, td { border:1px solid #243040; padding:6px 9px; text-align:left; vertical-align:top; }
    th { background:#161d27; color:#9fb0c2; position:sticky; top:0; }
    td.pass { color:#7ee2a8; font-weight:700; white-space:nowrap; }
    td.fail { color:#ff8aa3; font-weight:700; white-space:nowrap; }
  </style>
</head>
<body>
  <h1>combatChangeHp — PV temporaires absorbent les dégâts avant les PV réels</h1>
  <div class="sub">Spec : docs/superpowers/specs/2026-09-18-combat-degats-pv-temporaires-design.md §2, §6</div>
  <div id="summary">Exécution…</div>
  <table id="results">
    <thead><tr><th>Cas</th><th>Avant</th><th>Delta</th><th>Attendu</th><th>Obtenu</th><th>Résultat</th></tr></thead>
    <tbody></tbody>
  </table>

  <script src="../js/combat/state.js"></script>
  <script>
    const CASES = [
      ['dégâts absorbés en partie',       {currentHp:20, maxHp:20, tempHp:10}, -15, {currentHp:15, tempHp:0}],
      ['dégâts dépassent largement temp', {currentHp:20, maxHp:20, tempHp:3},  -10, {currentHp:13, tempHp:0}],
      ['dégâts sans PV temp',             {currentHp:20, maxHp:20, tempHp:0},  -6,  {currentHp:14, tempHp:0}],
      ['dégâts < temp (absorbe tout)',    {currentHp:20, maxHp:20, tempHp:10}, -4,  {currentHp:20, tempHp:6}],
      ['dégâts = temp pile',              {currentHp:20, maxHp:20, tempHp:10}, -10, {currentHp:20, tempHp:0}],
      ['dégâts clampés à 0',              {currentHp:5,  maxHp:20, tempHp:0},  -20, {currentHp:0,  tempHp:0}],
      ['soin ne touche jamais temp',      {currentHp:15, maxHp:20, tempHp:5},  8,   {currentHp:20, tempHp:5}],
      ['soin clampé à maxHp',             {currentHp:10, maxHp:20, tempHp:0},  5,   {currentHp:15, tempHp:0}],
    ];

    function runCase([label, before, delta, expected]) {
      _combat.participants = [{ id: 'p1', currentHp: before.currentHp, maxHp: before.maxHp, tempHp: before.tempHp }];
      combatChangeHp('p1', delta);
      const after = _combat.participants[0];
      const pass = after.currentHp === expected.currentHp && after.tempHp === expected.tempHp;
      return { label, before, delta, expected, after, pass };
    }

    const results = CASES.map(runCase);
    const allPass = results.every(r => r.pass);

    document.getElementById('summary').textContent = allPass
      ? `✅ ${results.length}/${results.length} cas OK`
      : `❌ ${results.filter(r=>!r.pass).length}/${results.length} cas en échec`;
    document.getElementById('summary').className = allPass ? 'ok' : 'ko';

    document.querySelector('#results tbody').innerHTML = results.map(r => `
      <tr>
        <td>${r.label}</td>
        <td>PV ${r.before.currentHp}/${r.before.maxHp} + ${r.before.tempHp} temp</td>
        <td>${r.delta > 0 ? '+' : ''}${r.delta}</td>
        <td>PV ${r.expected.currentHp}, temp ${r.expected.tempHp}</td>
        <td>PV ${r.after.currentHp}, temp ${r.after.tempHp}</td>
        <td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? '✅ PASS' : '❌ FAIL'}</td>
      </tr>`).join('');
  </script>
</body>
</html>
```

- [ ] **Step 2: Lancer le serveur statique et ouvrir le test pour vérifier qu'il échoue**

Démarrer le serveur du projet (config `.claude/launch.json`, `logrpg-static`) puis ouvrir :
`http://127.0.0.1:8777/tests/combat-hp-temp.html`

Attendu : bandeau rouge `❌ 5/8 cas en échec` (les cas de dégâts avec PV temp en jeu échouent, seuls "dégâts sans PV temp", "dégâts clampés à 0" et "soin clampé à maxHp" passent déjà — ce sont les seuls où `tempHp` vaut 0 ou où le delta est positif).

- [ ] **Step 3: Corriger `combatChangeHp`**

Dans `js/combat/state.js`, remplacer :

```js
// ── HP ────────────────────────────────────────────────────────
function combatChangeHp(id, delta) {
  _updateP(id, p => ({ ...p, currentHp: Math.max(0, Math.min(p.maxHp, p.currentHp + delta)) }));
}
```

par :

```js
// ── HP ────────────────────────────────────────────────────────
// Les PV temporaires absorbent les dégâts (delta négatif) avant les PV réels.
// Un soin (delta positif) ne touche jamais les PV temporaires.
function combatChangeHp(id, delta) {
  if (delta < 0) {
    _updateP(id, p => {
      let dmg = -delta;
      const tempUsed = Math.min(p.tempHp || 0, dmg);
      dmg -= tempUsed;
      return { ...p, tempHp: (p.tempHp || 0) - tempUsed, currentHp: Math.max(0, p.currentHp - dmg) };
    });
  } else {
    _updateP(id, p => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + delta) }));
  }
}
```

- [ ] **Step 4: Recharger le test et vérifier qu'il passe**

Recharger `http://127.0.0.1:8777/tests/combat-hp-temp.html`.
Attendu : bandeau vert `✅ 8/8 cas OK`.

- [ ] **Step 5: Commit**

```bash
git add js/combat/state.js tests/combat-hp-temp.html
git commit -m "fix(combat): les PV temporaires absorbent les dégâts avant les PV réels"
```

---

### Task 2: Fiche perso — PV temporaires absorbent les dégâts (`adjHp`) ✅ DONE (commits 53a73de + ac23493 fix adjHpTemp, reviews OK)

**Files:**
- Modify: `js/player/counters.js:44-47` (`renderHpBlock`), `:87` (`adjHp`), `:100-107` (`updateHpUI`)
- Test: `tests/counters-hp-temp.html` (nouveau)

- [ ] **Step 1: Écrire le test (qui doit échouer avec le code actuel)**

Créer `tests/counters-hp-temp.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Test — PV temporaires absorbent les dégâts (adjHp, fiche perso)</title>
  <style>
    body { font-family: ui-monospace, Menlo, Consolas, monospace; background:#0f1419; color:#d6dde6;
           margin:0; padding:24px; line-height:1.5; }
    h1 { font-size:16px; color:#fff; margin:0 0 4px; }
    .sub { color:#7b8794; font-size:12px; margin-bottom:18px; }
    #summary { font-size:14px; font-weight:700; padding:10px 14px; border-radius:8px; margin-bottom:16px; }
    .ok  { background:#15351f; color:#7ee2a8; }
    .ko  { background:#3a1620; color:#ff8aa3; }
    table { border-collapse:collapse; width:100%; font-size:12px; }
    th, td { border:1px solid #243040; padding:6px 9px; text-align:left; vertical-align:top; }
    th { background:#161d27; color:#9fb0c2; position:sticky; top:0; }
    td.pass { color:#7ee2a8; font-weight:700; white-space:nowrap; }
    td.fail { color:#ff8aa3; font-weight:700; white-space:nowrap; }
  </style>
</head>
<body>
  <h1>adjHp (fiche perso) — PV temporaires absorbent les dégâts avant les PV réels</h1>
  <div class="sub">Spec : docs/superpowers/specs/2026-09-18-combat-degats-pv-temporaires-design.md §2, §6</div>
  <div id="summary">Exécution…</div>
  <table id="results">
    <thead><tr><th>Cas</th><th>Avant</th><th>Delta</th><th>Attendu</th><th>Obtenu</th><th>Résultat</th></tr></thead>
    <tbody></tbody>
  </table>

  <script>
    // Stubs — pas de vraie IndexedDB dans ce test isolé (db.js non chargé).
    async function updateCharacterFields() {}
    async function loadCharacterList() {}
  </script>
  <script src="../js/player/counters.js"></script>
  <script>
    const CASES = [
      ['dégâts absorbés en partie',       {hp:20, hpMax:20, hpTemp:10}, -15, {hp:15, hpTemp:0}],
      ['dégâts dépassent largement temp', {hp:20, hpMax:20, hpTemp:3},  -10, {hp:13, hpTemp:0}],
      ['dégâts sans PV temp',             {hp:20, hpMax:20, hpTemp:0},  -6,  {hp:14, hpTemp:0}],
      ['dégâts < temp (absorbe tout)',    {hp:20, hpMax:20, hpTemp:10}, -4,  {hp:20, hpTemp:6}],
      ['dégâts = temp pile',              {hp:20, hpMax:20, hpTemp:10}, -10, {hp:20, hpTemp:0}],
      ['dégâts clampés à 0',              {hp:5,  hpMax:20, hpTemp:0},  -20, {hp:0,  hpTemp:0}],
      ['soin ne touche jamais temp',      {hp:15, hpMax:20, hpTemp:5},  8,   {hp:20, hpTemp:5}],
      ['soin clampé à maxHp',             {hp:10, hpMax:20, hpTemp:0},  5,   {hp:15, hpTemp:0}],
    ];

    function runCase([label, before, delta, expected]) {
      CS = { charId: 1, hp: before.hp, hpMax: before.hpMax, hpTemp: before.hpTemp };
      adjHp(delta);
      const after = { hp: CS.hp, hpTemp: CS.hpTemp };
      const pass = after.hp === expected.hp && after.hpTemp === expected.hpTemp;
      return { label, before, delta, expected, after, pass };
    }

    const results = CASES.map(runCase);
    const allPass = results.every(r => r.pass);

    document.getElementById('summary').textContent = allPass
      ? `✅ ${results.length}/${results.length} cas OK`
      : `❌ ${results.filter(r=>!r.pass).length}/${results.length} cas en échec`;
    document.getElementById('summary').className = allPass ? 'ok' : 'ko';

    document.querySelector('#results tbody').innerHTML = results.map(r => `
      <tr>
        <td>${r.label}</td>
        <td>PV ${r.before.hp}/${r.before.hpMax} + ${r.before.hpTemp} temp</td>
        <td>${r.delta > 0 ? '+' : ''}${r.delta}</td>
        <td>PV ${r.expected.hp}, temp ${r.expected.hpTemp}</td>
        <td>PV ${r.after.hp}, temp ${r.after.hpTemp}</td>
        <td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? '✅ PASS' : '❌ FAIL'}</td>
      </tr>`).join('');
  </script>
</body>
</html>
```

- [ ] **Step 2: Ouvrir le test pour vérifier qu'il échoue**

`http://127.0.0.1:8777/tests/counters-hp-temp.html`
Attendu : `❌ 5/8 cas en échec` (même symétrie que Task 1 — `CS.hpTemp` ne bouge jamais dans le code actuel).

- [ ] **Step 3: Corriger `adjHp`**

Dans `js/player/counters.js`, remplacer :

```js
function adjHp(d) { CS.hp=Math.max(0,Math.min(CS.hpMax+CS.hpTemp,CS.hp+d)); updateHpUI(); saveCS({hpCurrent:CS.hp}); }
```

par :

```js
// Les PV temporaires absorbent les dégâts (d négatif) avant les PV réels.
// Un soin (d positif) ne touche jamais les PV temporaires. CS.hp reste
// toujours borné à [0, CS.hpMax] — même modèle que combatChangeHp (Mode Combat).
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

- [ ] **Step 4: Recharger le test et vérifier qu'il passe**

Recharger `http://127.0.0.1:8777/tests/counters-hp-temp.html`.
Attendu : `✅ 8/8 cas OK`.

- [ ] **Step 5: Aligner le calcul de la barre (`renderHpBlock`) — `CS.hp` ne dépasse plus jamais `hpMax`**

Dans `js/player/counters.js`, remplacer :

```js
function renderHpBlock() {
  const {hp,hpMax,hpTemp,hpTempInput} = CS;
  const basePct = hpMax>0 ? Math.min(hp,hpMax)/hpMax*100 : 0;
  const tempPct = (hpTemp>0&&hpMax>0) ? Math.max(0,Math.min(hp-hpMax,hpTemp)/hpMax*100) : 0;
  const hasTemp = hpTemp>0;
```

par :

```js
function renderHpBlock() {
  const {hp,hpMax,hpTemp,hpTempInput} = CS;
  const basePct = hpMax>0 ? hp/hpMax*100 : 0;
  const tempPct = hpMax>0 ? Math.min(hpTemp/hpMax*100, 100-basePct) : 0;
  const hasTemp = hpTemp>0;
```

- [ ] **Step 6: Même alignement dans `updateHpUI`**

Dans `js/player/counters.js`, remplacer :

```js
function updateHpUI() {
  const basePct=CS.hpMax>0?Math.min(CS.hp,CS.hpMax)/CS.hpMax*100:0;
  const tempPct=(CS.hpTemp>0&&CS.hpMax>0)?Math.max(0,Math.min(CS.hp-CS.hpMax,CS.hpTemp)/CS.hpMax*100):0;
  const hasTemp=CS.hpTemp>0;
  const v=document.getElementById('hp-v'); if(v) v.textContent=CS.hp;
  const bb=document.getElementById('hp-bar-base'); if(bb) bb.style.width=basePct+'%';
  const bt=document.getElementById('hp-bar-temp'); if(bt){bt.style.left=basePct+'%';bt.style.width=tempPct+'%';}
  const leg=document.getElementById('hp-legend'); if(leg) leg.textContent=`${Math.min(CS.hp,CS.hpMax)} / ${CS.hpMax} PV`;
```

par :

```js
function updateHpUI() {
  const basePct=CS.hpMax>0?CS.hp/CS.hpMax*100:0;
  const tempPct=CS.hpMax>0?Math.min(CS.hpTemp/CS.hpMax*100, 100-basePct):0;
  const hasTemp=CS.hpTemp>0;
  const v=document.getElementById('hp-v'); if(v) v.textContent=CS.hp;
  const bb=document.getElementById('hp-bar-base'); if(bb) bb.style.width=basePct+'%';
  const bt=document.getElementById('hp-bar-temp'); if(bt){bt.style.left=basePct+'%';bt.style.width=tempPct+'%';}
  const leg=document.getElementById('hp-legend'); if(leg) leg.textContent=`${CS.hp} / ${CS.hpMax} PV`;
```

(Les lignes suivantes de `updateHpUI` — `hp-temp-legend`, `hp-temp-legend-val`, `hp-temp-inline`, `hp-temp-val` — utilisent déjà `CS.hpTemp` directement, elles n'ont pas besoin de changer : c'était uniquement la valeur de `CS.hpTemp` elle-même qui était fausse après des dégâts, pas leur lecture.)

- [ ] **Step 7: Commit**

```bash
git add js/player/counters.js tests/counters-hp-temp.html
git commit -m "fix(fiche-perso): les PV temporaires absorbent les dégâts avant les PV réels"
```

---

### Task 3: Mode Combat — champ de saisie libre Dégâts/Soin ✅ DONE (commits bfbb2f6 + 79b12dc fix reset, reviews OK)

**Files:**
- Modify: `js/combat/view.js:4-8` (état module), `:91-95` (panneau détail), `:283-314` (menu contextuel), `:483` (helpers)

- [ ] **Step 1: Ajouter la variable d'état partagée (mémorise le montant tapé entre les rendus)**

Dans `js/combat/view.js`, remplacer :

```js
let _cvCtxId       = null;
let _cvShowAdd     = false;
let _cvBonusId     = null;
let _cvEndModal    = false;
let _cvConditionId = null; // id du participant pour la dialog condition
```

par :

```js
let _cvCtxId       = null;
let _cvShowAdd     = false;
let _cvBonusId     = null;
let _cvEndModal    = false;
let _cvConditionId = null; // id du participant pour la dialog condition
let _cbtDmgInputValue = ''; // montant du champ Dégâts/Soin, conservé entre les rendus
```

- [ ] **Step 2: Ajouter les fonctions d'action près de `combatHpAction`**

Dans `js/combat/view.js`, remplacer :

```js
// ── Helpers ───────────────────────────────────────────────────
function combatHpAction(id, delta) { combatChangeHp(id, delta); renderCombatView(); }
```

par :

```js
// ── Helpers ───────────────────────────────────────────────────
function combatHpAction(id, delta) { combatChangeHp(id, delta); renderCombatView(); }

// Lit le montant saisi dans le champ (inputId), applique dégâts/soin via
// combatChangeHp (même fonction que les boutons ±1/±5, même règle d'absorption
// des PV temporaires). closeCtx=true ferme aussi le menu contextuel (utilisé
// depuis _renderCtxMenu, qui a son propre champ séparé du panneau détail).
function combatApplyDamageInput(id, inputId, closeCtx) {
  const el = document.getElementById(inputId);
  const val = Math.abs(parseInt(el.value) || 0);
  if (val === 0) return;
  combatChangeHp(id, -val);
  if (closeCtx) _cvCtxId = null;
  renderCombatView();
}
function combatApplyHealInput(id, inputId, closeCtx) {
  const el = document.getElementById(inputId);
  const val = Math.abs(parseInt(el.value) || 0);
  if (val === 0) return;
  combatChangeHp(id, val);
  if (closeCtx) _cvCtxId = null;
  renderCombatView();
}
```

- [ ] **Step 3: Ajouter la ligne dans le panneau détail (participant actif)**

Dans `js/combat/view.js`, remplacer :

```js
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="ctrl-btn minus" onclick="combatHpAction('${p.id}',-5)" style="font-size:12px;">−5</button>
        <button class="ctrl-btn plus"  onclick="combatHpAction('${p.id}',+5)" style="font-size:12px;">+5</button>
      </div>
      <div class="ctr-temp-section">
```

par :

```js
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="ctrl-btn minus" onclick="combatHpAction('${p.id}',-5)" style="font-size:12px;">−5</button>
        <button class="ctrl-btn plus"  onclick="combatHpAction('${p.id}',+5)" style="font-size:12px;">+5</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
        <input type="number" id="cbt-dmg-input" placeholder="Montant" value="${_cbtDmgInputValue}"
          oninput="_cbtDmgInputValue=this.value"
          style="flex:1;min-width:0;padding:6px 8px;border-radius:8px;border:1.5px solid var(--divider);font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--text);background:var(--white);outline:none;">
        <button onclick="combatApplyDamageInput('${p.id}','cbt-dmg-input')"
          style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(255,107,107,.3);background:var(--red-l);color:var(--red);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;">🩸 Dégâts</button>
        <button onclick="combatApplyHealInput('${p.id}','cbt-dmg-input')"
          style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(92,200,168,.3);background:var(--green-l);color:var(--green-d);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;">💚 Soin</button>
      </div>
      <div class="ctr-temp-section">
```

- [ ] **Step 4: Ajouter la ligne dans le menu contextuel (clic droit sur un participant)**

Dans `js/combat/view.js`, remplacer :

```js
    <div style="padding:6px 10px;border-bottom:1px solid var(--divider);">
      <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:5px;">❤️ DÉGÂTS / SOINS</div>
      <div style="display:flex;gap:5px;">${hpBtns}</div>
    </div>
    ${actions.map(a => `<button class="cbt-ctx-item ${a.danger ? 'danger' : ''}" onclick="${a.fn}">${a.label}</button>`).join('')}
```

par :

```js
    <div style="padding:6px 10px;border-bottom:1px solid var(--divider);">
      <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:5px;">❤️ DÉGÂTS / SOINS</div>
      <div style="display:flex;gap:5px;">${hpBtns}</div>
      <div style="display:flex;gap:5px;align-items:center;margin-top:5px;">
        <input type="number" id="cbt-ctx-dmg-input" placeholder="Montant" value="${_cbtDmgInputValue}"
          oninput="_cbtDmgInputValue=this.value"
          style="flex:1;min-width:0;padding:5px 6px;border-radius:7px;border:1.5px solid var(--divider);font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;color:var(--text);background:var(--white);outline:none;">
        <button onclick="combatApplyDamageInput('${p.id}','cbt-ctx-dmg-input',true)"
          style="padding:5px 7px;border-radius:7px;border:1.5px solid rgba(255,107,107,.3);background:var(--red-l);color:var(--red);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">🩸</button>
        <button onclick="combatApplyHealInput('${p.id}','cbt-ctx-dmg-input',true)"
          style="padding:5px 7px;border-radius:7px;border:1.5px solid rgba(92,200,168,.3);background:var(--green-l);color:var(--green-d);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">💚</button>
      </div>
    </div>
    ${actions.map(a => `<button class="cbt-ctx-item ${a.danger ? 'danger' : ''}" onclick="${a.fn}">${a.label}</button>`).join('')}
```

- [ ] **Step 5: Vérification manuelle dans le navigateur**

Démarrer le serveur (`logrpg-static`), ouvrir l'app, créer/sélectionner un personnage, lancer un combat rapide avec au moins un participant.

1. Sur le participant actif (panneau détail) : cliquer 🩸 avec le champ vide → rien ne doit changer (no-op).
2. Taper `44` dans le champ, cliquer 🩸 Dégâts → PV baissent de 44 (clampé à 0 si besoin), le champ garde `44` affiché.
3. Donner des PV temp au participant (bouton ✨ +1 plusieurs fois), puis retaper un montant de dégâts inférieur au total PV temp, cliquer 🩸 → les PV réels ne bougent pas, seuls les PV temp baissent.
4. Cliquer 💚 Soin avec un montant → PV réels remontent (jamais au-dessus du max), PV temp inchangés.
5. Clic droit sur un autre participant (menu contextuel) → même champ présent, même comportement, et le clic ferme bien le menu après application.
6. Vérifier dans la console navigateur qu'aucune erreur n'apparaît pendant ces manipulations.

- [ ] **Step 6: Commit**

```bash
git add js/combat/view.js
git commit -m "feat(combat): champ de saisie libre pour appliquer des dégâts/soins"
```

---

### Task 4: Fiche perso — champ de saisie libre Dégâts/Soin ✅ DONE (commits 1545bb4 + fd045d1 fix reset + d9db054 refactor DRY, reviews OK)

**Files:**
- Modify: `js/player/counters.js:3` (état module), `:66-73` (bloc PV)

- [ ] **Step 1: Ajouter la variable d'état partagée**

Dans `js/player/counters.js`, remplacer :

```js
// COUNTERS.JS — Compteurs HP / Mana / Monnaie
// ═══════════════════════════════════════════════════════════════
let CS = null;
```

par :

```js
// COUNTERS.JS — Compteurs HP / Mana / Monnaie
// ═══════════════════════════════════════════════════════════════
let CS = null;
let _hpDmgInputValue = ''; // montant du champ Dégâts/Soin, conservé entre les rendus
```

- [ ] **Step 2: Ajouter les fonctions d'action et la ligne UI dans `renderHpBlock`**

Dans `js/player/counters.js`, remplacer :

```js
    <div class="ctr-controls">
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(-1)">−</button>
      <div class="ctr-val-block">
        <div class="ctr-big" id="hp-v" style="color:var(--red);">${hp}</div>
        <div class="ctr-sub">/ ${hpMax}<span id="hp-temp-inline" style="color:#FF9999;font-weight:900;">${hasTemp?' +'+hpTemp+'✨':''}</span></div>
      </div>
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(1)">＋</button>
    </div>
    <div class="ctr-temp-section">
```

par :

```js
    <div class="ctr-controls">
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(-1)">−</button>
      <div class="ctr-val-block">
        <div class="ctr-big" id="hp-v" style="color:var(--red);">${hp}</div>
        <div class="ctr-sub">/ ${hpMax}<span id="hp-temp-inline" style="color:#FF9999;font-weight:900;">${hasTemp?' +'+hpTemp+'✨':''}</span></div>
      </div>
      <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="adjHp(1)">＋</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
      <input type="number" id="hp-dmg-input" placeholder="Montant" value="${_hpDmgInputValue}"
        oninput="_hpDmgInputValue=this.value"
        style="flex:1;min-width:0;padding:6px 8px;border-radius:8px;border:1.5px solid #E8ECF0;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--text);background:var(--white);outline:none;">
      <button onclick="adjHpDamageInput()"
        style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(255,107,107,.3);background:var(--red-l);color:var(--red);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;">🩸 Dégâts</button>
      <button onclick="adjHpHealInput()"
        style="padding:6px 10px;border-radius:8px;border:1.5px solid rgba(92,200,168,.3);background:var(--green-l);color:var(--green-d);font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;">💚 Soin</button>
    </div>
    <div class="ctr-temp-section">
```

- [ ] **Step 3: Ajouter les fonctions d'action près de `adjHp`**

Dans `js/player/counters.js`, juste après la fonction `adjHp` (celle corrigée à la Task 2, avant `function clearHpTemp()`), ajouter :

```js
function adjHpDamageInput() {
  const el = document.getElementById('hp-dmg-input');
  const val = Math.abs(parseInt(el.value) || 0);
  if (val === 0) return;
  adjHp(-val);
}
function adjHpHealInput() {
  const el = document.getElementById('hp-dmg-input');
  const val = Math.abs(parseInt(el.value) || 0);
  if (val === 0) return;
  adjHp(val);
}
```

- [ ] **Step 4: Vérification manuelle dans le navigateur**

Sélectionner un personnage (Mode Joueur, hors combat), onglet Fiche/Compteurs visible.

1. Champ vide, clic 🩸 → rien ne change.
2. Taper `44`, clic 🩸 Dégâts → PV baissent (clampé à 0 si besoin), champ garde `44`.
3. Donner des PV temp (bouton ✨ +1 plusieurs fois), taper un montant de dégâts inférieur au total, clic 🩸 → PV réels inchangés, PV temp baissent, **et le texte "+X PV temp." affiché correspond bien au nouveau total** (c'était le bug d'origine).
4. Clic 💚 Soin avec un montant → PV réels remontent (jamais au-dessus du max), PV temp inchangés.
5. Recharger la page (F5), rouvrir le personnage → les PV et PV temp affichés correspondent à ce qui a été sauvegardé (vérifie que `saveCS({hpCurrent, temporaryHealth})` persiste bien les deux valeurs).
6. Vérifier l'absence d'erreur console.

- [ ] **Step 5: Commit**

```bash
git add js/player/counters.js
git commit -m "feat(fiche-perso): champ de saisie libre pour appliquer des dégâts/soins"
```

---

## Self-Review

**Couverture spec :**
- §2 règle d'absorption dégâts/soin → Task 1 (Mode Combat) + Task 2 (fiche perso), avec tests automatisés couvrant exactement les exemples du §6.
- §3.2 UI Mode Combat (panneau détail + menu contextuel, champ persistant, `Math.abs`, pas de comportement spécial sur Entrée) → Task 3.
- §4.2 légende/barre fiche perso synchronisées → Task 2, Step 5-6.
- §4.3 UI fiche perso → Task 4.
- §5 hors périmètre (mana, non-cumul PV temp) → non touché par ce plan, conforme.
- §6 scénarios de test → repris tels quels dans les deux fichiers de test.

**Cohérence des noms :** `combatChangeHp`, `combatApplyDamageInput`/`combatApplyHealInput`, `adjHp`, `adjHpDamageInput`/`adjHpHealInput`, `_cbtDmgInputValue`, `_hpDmgInputValue` — utilisés de façon identique partout où ils apparaissent (déclaration puis usage).

**Ordre des tâches :** logique d'abord (Tasks 1-2, testables automatiquement, zéro risque visuel), UI ensuite (Tasks 3-4, qui consomment les fonctions déjà corrigées et testées) — chaque tâche est déployable seule.
