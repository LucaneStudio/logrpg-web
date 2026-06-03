// COMBAT VIEW
// ═══════════════════════════════════════════════════════════════

let _cvCtxId       = null;
let _cvShowAdd     = false;
let _cvBonusId     = null;
let _cvEndModal    = false;
let _cvConditionId = null; // id du participant pour la dialog condition

// ── Render principal ──────────────────────────────────────────
function renderCombatView() {
  const overlay = document.getElementById('combat-overlay');
  overlay.innerHTML = `
    <div class="cbt-left-panel">
      ${_renderLeftPanel()}
    </div>
    <div class="cbt-right-panel">
      ${_renderRightPanel()}
    </div>
    ${_cvBonusId     ? _renderBonusDialog()     : ''}
    ${_cvEndModal    ? _renderEndModal()      : ''}
    ${_cvConditionId ? _renderConditionDialog() : ''}
    ${_cvCtxId    ? _renderCtxMenu()      : ''}`;

  overlay.addEventListener('click', (e) => {
    if (_cvCtxId && !e.target.closest('.cbt-ctx-menu') && !e.target.closest('[data-ctx]')) {
      _cvCtxId = null; renderCombatView();
    }
  }, { once: true });
}

// ── Panneau gauche ────────────────────────────────────────────
function _renderLeftPanel() {
  const p = _combat.participants.find(p => p.id === _combat.currentId);
  if (!p) return `
    <div class="cbt-pnl-header">
      <div style="font-size:15px;font-weight:800;color:var(--text-light);">Aucun participant actif</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="round-badge">Round ${_combat.round}</div>
        <button onclick="openEndCombatModal()" class="cbt-end-btn">🏁 Fin de combat</button>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--text-light);">
      <div style="font-size:40px;">🏁</div>
      <div style="font-size:14px;font-weight:800;">Tous les participants sont hors combat.</div>
      <button onclick="openEndCombatModal()" class="next-turn-btn" style="max-width:300px;">🏁 Terminer le combat</button>
    </div>`;

  const hpPct  = p.maxHp > 0 ? Math.max(0, p.currentHp / p.maxHp * 100) : 0;
  const typeClr = p.type === 'PJ' ? 'var(--blue)' : p.type === 'PNJ' ? '#B8860B' : 'var(--red)';
  const bonus  = p.initiativeBonus !== 0;
  const pending = p.pendingBonus !== 0;

  return `
    <div class="cbt-pnl-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:48px;height:48px;border-radius:14px;background:${p.avatarColor};overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white;flex-shrink:0;">${p.avatarPhoto ? '<img src="' + p.avatarPhoto + '" style="width:100%;height:100%;object-fit:cover;"/>' : p.avatarLetter}</div>
        <div>
          <div style="font-size:17px;font-weight:900;color:var(--text);">${escapeHtml(p.name)}</div>
          <div style="font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${typeClr};margin-top:2px;">${p.type}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <div class="round-badge">Round ${_combat.round}</div>
        <button onclick="openEndCombatModal()" class="cbt-end-btn">🏁 Fin de combat</button>
      </div>
    </div>

    <div class="cbt-divider"></div>

    <div class="cbt-section">
      <div class="hp-label" style="margin-bottom:8px;">❤️ POINTS DE VIE</div>
      <div class="ctr-bar-wrap">
        <div class="ctr-bar-track">
          <div class="ctr-bar-base" style="width:${hpPct}%;background:linear-gradient(90deg,var(--red),#FF9999);"></div>
          <div class="ctr-bar-temp" style="left:${hpPct}%;width:${p.maxHp>0?Math.min(p.tempHp/p.maxHp*100,100-hpPct):0}%;background:linear-gradient(90deg,#FFBBBB,#FFD5D5);"></div>
        </div>
        <div class="ctr-bar-legend">
          <span class="ctr-legend-item"><span class="ctr-legend-dot" style="background:var(--red);"></span>${p.currentHp} / ${p.maxHp} PV</span>
          ${p.tempHp > 0 ? '<span class="ctr-legend-item"><span class="ctr-legend-dot" style="background:#FFBBBB;"></span>+' + p.tempHp + ' PV temp.</span>' : ''}
        </div>
      </div>
      <div class="ctr-controls">
        <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="combatHpAction('${p.id}',-1)">−</button>
        <div class="ctr-val-block">
          <div class="ctr-big" style="color:var(--red);">${p.currentHp}</div>
          <div class="ctr-sub">/ ${p.maxHp}${p.tempHp > 0 ? ' <span style="color:#FF9999;font-weight:900;">+' + p.tempHp + '✨</span>' : ''}</div>
        </div>
        <button class="ctr-btn" style="background:var(--red-l);color:var(--red);" onclick="combatHpAction('${p.id}',+1)">＋</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="ctrl-btn minus" onclick="combatHpAction('${p.id}',-5)" style="font-size:12px;">−5</button>
        <button class="ctrl-btn plus"  onclick="combatHpAction('${p.id}',+5)" style="font-size:12px;">+5</button>
      </div>
      <div class="ctr-temp-section">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="ctr-temp-label" style="color:var(--red);margin:0;">✨ PV TEMPORAIRES</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="ctr-temp-sm-btn" style="background:var(--red-l);color:var(--red);" onclick="combatChangeTempHp('${p.id}',-1);renderCombatView()">−</button>
            <span style="font-size:18px;font-weight:900;color:var(--red);min-width:28px;text-align:center;">${p.tempHp}</span>
            <button class="ctr-temp-sm-btn" style="background:var(--red-l);color:var(--red);" onclick="combatChangeTempHp('${p.id}',+1);renderCombatView()">＋</button>
                        <button class="ctr-temp-clear-btn" data-pid="${p.id}" style="${p.tempHp > 0 ? '' : 'display:none'}" onclick="combatClearTempHp(this)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cbt-divider"></div>

    <div class="cbt-section" style="flex-direction:row;gap:16px;align-items:flex-start;">
      <div style="flex:1;">
        <div class="hp-label" style="margin-bottom:10px;">🎲 INITIATIVE</div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--text-light);margin-bottom:4px;">Initiative</div>
            <input type="number" value="${p.initiative}"
              onchange="combatSetInitiative('${p.id}',this.value);_refreshLeftRight()" onblur="combatSetInitiative('${p.id}',this.value);_refreshLeftRight()"
              class="cbt-num-input" style="color:var(--purple);"/>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--text-light);margin-bottom:4px;">Bonus / Malus</div>
            <input type="number" value="${p.initiativeBonus + p.pendingBonus}"
              onchange="combatAddBonus('${p.id}',parseInt(this.value)||0);_refreshLeftRight()" onblur="combatAddBonus('${p.id}',parseInt(this.value)||0);_refreshLeftRight()"
              class="cbt-num-input"/>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:14px;">
            <span style="font-size:26px;font-weight:900;color:var(--text);">${_effectiveInit(p)}</span>
            ${bonus ? `<span style="font-size:9px;font-weight:800;color:var(--green-d);background:var(--green-l);padding:1px 6px;border-radius:4px;cursor:pointer;" onclick="combatRemoveBonus('${p.id}');renderCombatView()">base ${p.initiative} ×</span>` : ''}
            ${pending ? `<span style="font-size:9px;font-weight:800;color:var(--text-light);background:var(--bg);padding:1px 6px;border-radius:4px;">⏳ ${p.pendingBonus > 0 ? '+' : ''}${p.pendingBonus}</span>` : ''}
          </div>
        </div>
      </div>
      <div style="width:1px;background:var(--divider);align-self:stretch;flex-shrink:0;"></div>
      <div style="flex:0 0 auto;min-width:120px;">
        <div class="hp-label" style="margin-bottom:10px;">⚡ STATUT</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button onclick="combatSetStatus('${p.id}','KO');renderCombatView()" class="cbt-status-btn" style="background:var(--red-l);border-color:rgba(255,107,107,.3);color:var(--red);">💀 KO</button>
          <button onclick="combatSetStatus('${p.id}','FLED');renderCombatView()" class="cbt-status-btn" style="background:var(--surface);border-color:var(--divider);color:var(--text-mid);">🏃 Fuite</button>
        </div>
      </div>
    </div>

    <div class="cbt-divider"></div>

    <div class="cbt-section" style="flex:1;overflow:hidden;">
      <div class="hp-label" style="margin-bottom:8px;">⚡ CONDITIONS</div>
      <div class="conditions-row">
        ${p.conditions.map(c => {
          const name    = _condName(c);
          const expired = c.expired;
          const rounds  = c.rounds;
          if (expired) {
            return `<span class="condition-badge" style="background:var(--divider);color:var(--text-light);text-decoration:line-through;cursor:default;">
              n'est plus ${escapeHtml(name)}</span>`;
          }
          return `<span class="condition-badge active" onclick="combatRemoveCondition('${p.id}','${_safeAttr(name)}');renderCombatView()" title="Cliquer pour retirer">
            ${escapeHtml(name)}${rounds !== null ? ` <span style="font-size:9px;font-weight:900;background:rgba(255,140,66,.3);border-radius:4px;padding:0 4px;">${rounds}🔄</span>` : ''} ×
          </span>`;
        }).join('')}
        <button class="add-condition" onclick="event.stopPropagation();_cvConditionId='${p.id}';renderCombatView()">＋ Ajouter</button>
      </div>
    </div>

    <button class="next-turn-btn" onclick="combatNextTurn();renderCombatView();">⚔️ Tour suivant →</button>`;
}

// ── Panneau droit ─────────────────────────────────────────────
function _renderRightPanel() {
  const active   = combatSortedActive();
  const inactive = combatSortedInactive();

  return `
    <div class="init-header" style="flex-shrink:0;">
      <span class="init-title">INITIATIVE</span>
      <div class="init-add-btn" onclick="_cvShowAdd=!_cvShowAdd;renderCombatView()" title="Ajouter un participant">
        ${_cvShowAdd ? '×' : '＋'}
      </div>
    </div>

    ${_cvShowAdd ? _renderMidCombatAddForm() : ''}

    <div class="init-list">
      ${active.map(p => _renderInitCard(p)).join('')}
      ${inactive.length > 0 ? `
        <div class="init-separator">— HORS COMBAT —</div>
        ${inactive.map(p => _renderInitCard(p)).join('')}` : ''}
    </div>`;
}

function _renderInitCard(p) {
  const isCurrent = p.id === _combat.currentId;
  const hpPct     = p.maxHp > 0 ? Math.max(0, p.currentHp / p.maxHp * 100) : 0;
  const hpColor   = hpPct > 60 ? 'var(--green-d)' : hpPct > 25 ? '#B8860B' : 'var(--red)';
  const typeClr   = p.type === 'PJ' ? 'var(--blue)' : p.type === 'PNJ' ? '#B8860B' : 'var(--red)';
  const cls       = `cbt-init-card ${isCurrent ? 'active-turn' : ''} ${p.status === 'KO' ? 'ko' : p.status === 'FLED' ? 'fled' : ''}`;
  const bonusBadge = p.initiativeBonus !== 0
    ? `<span style="font-size:9px;color:${p.initiativeBonus > 0 ? 'var(--green-d)':'var(--red)'};">${p.initiativeBonus > 0 ? '+' : ''}${p.initiativeBonus}</span>`
    : '';

  return `<div class="${cls}" data-ctx="${p.id}"
    oncontextmenu="event.preventDefault();event.stopPropagation();_openCvCtx('${p.id}',event)">
    <div class="cbt-init-num">
      <span style="font-size:15px;font-weight:900;color:${isCurrent ? 'var(--green-d)' : 'var(--text-light)'};">${_effectiveInit(p)}</span>
      ${bonusBadge}
    </div>
    <div style="width:36px;height:36px;border-radius:11px;background:${p.avatarColor};overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">${p.avatarPhoto ? `<img src="${p.avatarPhoto}" style="width:100%;height:100%;object-fit:cover;"/>` : p.avatarLetter}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:900;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
      <div style="font-size:10px;font-weight:700;color:${typeClr};">${p.type}</div>
      ${p.conditions.length > 0 ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px;">
        ${p.conditions.map(c => {
          const name = _condName(c);
          const expired = c.expired;
          const rounds = typeof c === 'object' ? c.rounds : null;
          if (expired) return '<span style="font-size:8px;font-weight:800;color:var(--text-light);background:var(--divider);border-radius:4px;padding:1px 5px;text-decoration:line-through;">'+escapeHtml(name)+'</span>';
          return '<span style="font-size:8px;font-weight:800;color:var(--orange);background:var(--orange-l);border-radius:4px;padding:1px 5px;">'+escapeHtml(name)+(rounds!==null?' ('+rounds+')':'')+'</span>';
        }).join('')}
      </div>` : ''}
    </div>
    ${p.status === 'ACTIVE' ? `
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
        <span style="font-size:12px;font-weight:900;color:${hpColor};">${p.currentHp}/${p.maxHp}</span>
        <div style="width:48px;height:4px;background:var(--divider);border-radius:2px;overflow:hidden;">
          <div style="width:${hpPct}%;height:100%;background:${hpColor};border-radius:2px;"></div>
        </div>
      </div>` : `<span class="status-pill ${p.status === 'KO' ? 'status-ko' : 'status-fled'}">${p.status}</span>`}
  </div>`;
}

// ── Formulaire ajout mid-combat ───────────────────────────────
function _renderMidCombatAddForm() {
  const chips = [
    {t:'MONSTRE',l:'👹 Monstre',c:'mob'},
    {t:'PNJ',l:'🗣 PNJ',c:'pnj'},
    {t:'PJ',l:'🧙 PJ',c:'pj'},
  ].map(({t,l,c}) =>
    `<div id="mchip-${t}" class="type-chip ${c} ${_cSetup.type===t?'cbt-chip-active':''}" style="font-size:10px;"
      onclick="selectCombatType('${t}')">${l}</div>`).join('');

  return `<div style="background:var(--white);border-radius:12px;padding:12px;margin-bottom:8px;border:1.5px solid var(--divider);flex-shrink:0;">
    <div style="display:flex;gap:5px;margin-bottom:8px;">${chips}</div>
    <div style="display:flex;gap:6px;align-items:flex-end;">
      <input id="mid-name" class="field-input" placeholder="Nom…" style="flex:2;font-size:12px;padding:7px 10px;"/>
      <div style="flex:1;"><div class="field-label" style="font-size:9px;">PV</div>
        <input id="mid-hp" class="field-input" type="number" placeholder="10" style="font-size:12px;padding:7px 10px;width:100%;"/></div>
      <div style="flex:1;"><div class="field-label" style="font-size:9px;">INIT.</div>
        <input id="mid-init" class="field-input" type="number" placeholder="0" style="font-size:12px;padding:7px 10px;width:100%;"/></div>
      <button onclick="_submitMidAdd()" style="height:36px;padding:0 10px;border-radius:9px;background:var(--green-l);border:1.5px solid rgba(92,200,168,.4);color:var(--green-d);font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;white-space:nowrap;flex-shrink:0;">＋</button>
    </div>
  </div>`;
}

function _submitMidAdd() {
  const name = document.getElementById('mid-name')?.value.trim();
  const hp   = parseInt(document.getElementById('mid-hp')?.value)   || 10;
  const init = parseInt(document.getElementById('mid-init')?.value) || 0;
  if (!name) return;
  combatAddParticipant(name, _cSetup.type, Math.max(1, hp), init);
  _cvShowAdd = false;
  renderCombatView();
}

// ── Menu contextuel ───────────────────────────────────────────
function _openCvCtx(id, event) {
  _cvCtxId = _cvCtxId === id ? null : id;
  // Capturer la position du curseur AVANT le re-render
  const mx = event ? event.clientX : 0;
  const my = event ? event.clientY : 0;
  renderCombatView();
  if (_cvCtxId) {
    const menu = document.querySelector('.cbt-ctx-menu');
    if (menu) {
      let x = mx;
      let y = my;
      if (x + 220 > window.innerWidth)  x = window.innerWidth  - 224;
      if (y + 200 > window.innerHeight) y = window.innerHeight - 204;
      menu.style.left = x + 'px';
      menu.style.top  = y + 'px';
    }
  }
}

function _renderCtxMenu() {
  const p = _combat.participants.find(p => p.id === _cvCtxId);
  if (!p) return '';
  const hpBtns = [
    { label: '−5', delta: -5 }, { label: '−1', delta: -1 },
    { label: '+1', delta: +1 }, { label: '+5', delta: +5 },
  ].map(({label, delta}) => {
    const col = delta < 0 ? 'var(--red)' : 'var(--green-d)';
    const bg  = delta < 0 ? 'var(--red-l)' : 'var(--green-l)';
    return `<button onclick="combatChangeHp('${p.id}',${delta});_cvCtxId=null;renderCombatView()"
      style="flex:1;padding:6px 2px;border-radius:8px;border:1.5px solid ${delta<0?'rgba(255,107,107,.3)':'rgba(92,200,168,.3)'};
      background:${bg};color:${col};font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">
      ${label}</button>`;
  }).join('');

  const isCurrent = p.id === _combat.currentId;
  const actions = [
    ...(p.status === 'ACTIVE' && !isCurrent ? [{ label: '⚡ Forcer son tour', fn: `combatForceTurn('${p.id}');_cvCtxId=null;renderCombatView()` }] : []),
    ...(p.status !== 'KO'     ? [{ label: '💀 Marquer KO',        fn: `combatSetStatus('${p.id}','KO');_cvCtxId=null;renderCombatView()` }] : []),
    ...(p.status !== 'FLED'   ? [{ label: '🏃 Marquer en fuite',  fn: `combatSetStatus('${p.id}','FLED');_cvCtxId=null;renderCombatView()` }] : []),
    ...(p.status !== 'ACTIVE' ? [{ label: '↩️ Remettre actif',    fn: `combatSetStatus('${p.id}','ACTIVE');_cvCtxId=null;renderCombatView()` }] : []),
    { label: '🎲 Bonus / Malus initiative', fn: `_cvBonusId='${p.id}';_cvCtxId=null;renderCombatView()` },
    { label: '🗑 Retirer du combat', danger: true, fn: `combatRemoveParticipant('${p.id}');_cvCtxId=null;renderCombatView()` },
  ];

  return `<div class="cbt-ctx-menu" onclick="event.stopPropagation()" style="position:fixed;z-index:5100;">
    <div style="font-size:11px;font-weight:900;color:var(--text-light);padding:6px 12px 4px;border-bottom:1px solid var(--divider);">${escapeHtml(p.name)} — ${p.currentHp}/${p.maxHp} PV</div>
    <div style="padding:6px 10px;border-bottom:1px solid var(--divider);">
      <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:.8px;margin-bottom:5px;">❤️ DÉGÂTS / SOINS</div>
      <div style="display:flex;gap:5px;">${hpBtns}</div>
    </div>
    ${actions.map(a => `<button class="cbt-ctx-item ${a.danger ? 'danger' : ''}" onclick="${a.fn}">${a.label}</button>`).join('')}
  </div>`;
}

// ── Dialog bonus ──────────────────────────────────────────────
function _renderBonusDialog() {
  const p = _combat.participants.find(p => p.id === _cvBonusId);
  if (!p) return '';
  return `<div class="cbt-overlay-dim" onclick="_cvBonusId=null;renderCombatView()">
    <div class="cbt-bonus-dialog" onclick="event.stopPropagation()">
      <div style="font-size:16px;font-weight:900;color:var(--text);margin-bottom:4px;">🎲 Bonus / Malus d'initiative</div>
      <div style="font-size:12px;color:var(--text-light);margin-bottom:16px;">${escapeHtml(p.name)} — actuel : ${_effectiveInit(p)}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:16px;">
        ${[-5,-3,-2,-1,1,2,3,5].map(v =>
          `<button onclick="combatAddBonus('${p.id}',${v});_cvBonusId=null;renderCombatView()"
            style="padding:10px 4px;border-radius:10px;border:1.5px solid ${v>0?'rgba(92,200,168,.4)':'rgba(255,107,107,.3)'};
            background:${v>0?'var(--green-l)':'var(--red-l)'};color:${v>0?'var(--green-d)':'var(--red)'};
            font-family:'Nunito',sans-serif;font-size:13px;font-weight:900;cursor:pointer;">
            ${v>0?'+':''}${v}</button>`).join('')}
      </div>
      ${p.initiativeBonus !== 0 || p.pendingBonus !== 0 ? `
        <button onclick="combatRemoveBonus('${p.id}');_cvBonusId=null;renderCombatView()"
          style="width:100%;padding:9px;border-radius:10px;background:var(--bg);border:1.5px solid var(--divider);font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--text-mid);cursor:pointer;margin-bottom:8px;">
          ✕ Annuler le bonus</button>` : ''}
      <button onclick="_cvBonusId=null;renderCombatView()"
        style="width:100%;padding:9px;border-radius:10px;background:var(--bg);border:1.5px solid var(--divider);font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--text-light);cursor:pointer;">
        Fermer</button>
    </div>
  </div>`;
}

// ── Modal fin de combat ───────────────────────────────────────
// ── Dialog ajout condition ────────────────────────────────────
const _COMMON_CONDITIONS = [
  '🔥 Brûlé','❄️ Gelé','⚡ Étourdi','🤢 Empoisonné','⬇️ À terre',
  '😱 Effrayé','🧲 Agrippé','🌀 Concentré','👁 Invisible','🐌 Ralenti',
];

function _renderConditionDialog() {
  const p = _combat.participants.find(p => p.id === _cvConditionId);
  if (!p) return '';
  return `<div class="cbt-overlay-dim" onclick="_cvConditionId=null;renderCombatView()">
    <div class="cbt-bonus-dialog" style="max-width:420px;" onclick="event.stopPropagation()">
      <div style="font-size:16px;font-weight:900;color:var(--text);margin-bottom:4px;">⚡ Ajouter une condition</div>
      <div style="font-size:12px;color:var(--text-light);margin-bottom:14px;">${escapeHtml(p.name)}</div>

      <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:1px;margin-bottom:8px;">SUGGESTIONS — cliquer pour pré-remplir</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px;">
        ${_COMMON_CONDITIONS.map(c => `
          <button onclick="_prefillCondition('${_safeAttr(c)}')"
            class="condition-badge inactive" style="cursor:pointer;font-size:11px;padding:5px 10px;">
            ${escapeHtml(c)}</button>`).join('')}
      </div>

      <div style="height:1px;background:var(--divider);margin-bottom:14px;"></div>

      <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;margin-bottom:14px;">
        <div>
          <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:1px;margin-bottom:6px;">CONDITION</div>
          <input id="cond-name-input" placeholder="Nom…"
            style="width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid var(--divider);
            background:var(--green-l);font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;
            color:var(--text);outline:none;box-sizing:border-box;"
            onfocus="this.style.borderColor='var(--green)'" onblur="this.style.borderColor='var(--divider)'"
            onkeydown="if(event.key==='Enter') _submitCondition('${p.id}')"/>
        </div>
        <div>
          <div style="font-size:9px;font-weight:900;color:var(--text-light);letter-spacing:1px;margin-bottom:6px;">ROUNDS</div>
          <input id="cond-rounds-input" type="number" min="1" placeholder="∞"
            style="width:80px;padding:11px 10px;border-radius:12px;border:1.5px solid var(--divider);
            background:var(--purple-l, #F0EEFF);font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;
            color:var(--text);text-align:center;outline:none;"
            onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--divider)'"
            onkeydown="if(event.key==='Enter') _submitCondition('${p.id}')"/>
        </div>
      </div>

      <button onclick="_submitCondition('${p.id}')"
        style="width:100%;padding:11px;border-radius:12px;background:var(--orange-l);border:1.5px solid rgba(255,140,66,.4);
        font-family:'Nunito',sans-serif;font-size:13px;font-weight:900;color:var(--orange);cursor:pointer;margin-bottom:8px;">
        ＋ Ajouter la condition</button>
      <button onclick="_cvConditionId=null;renderCombatView()"
        style="width:100%;padding:9px;border-radius:10px;background:transparent;border:none;
        font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--text-light);cursor:pointer;">
        Fermer</button>
    </div>
  </div>`;
}

// Pré-remplit le champ nom sans ajouter immédiatement
function _prefillCondition(name) {
  const input = document.getElementById('cond-name-input');
  if (input) { input.value = name; input.focus(); }
}

function _submitCondition(participantId) {
  const name   = document.getElementById('cond-name-input')?.value.trim();
  const rounds = parseInt(document.getElementById('cond-rounds-input')?.value) || null;
  if (!name) return;
  combatAddCondition(participantId, name, rounds);
  _cvConditionId = null;
  renderCombatView();
}

function openEndCombatModal()  { _cvEndModal = true; renderCombatView(); }

function _renderEndModal() {
  const localPJs = _combat.participants.filter(p => p.localCharId != null);
  return `<div class="cbt-overlay-dim">
    <div class="cbt-bonus-dialog" style="max-width:420px;" onclick="event.stopPropagation()">
      <div style="font-size:17px;font-weight:900;color:var(--text);margin-bottom:4px;">🏁 Fin de combat</div>
      <div style="font-size:11px;color:var(--text-light);margin-bottom:16px;">
        Round ${_combat.round} · ${_combat.participants.filter(p=>p.status==='KO').length} KO · ${_combat.participants.filter(p=>p.status==='FLED').length} en fuite
      </div>
      ${localPJs.length > 0 ? `
        <div style="background:var(--green-l);border:1.5px solid rgba(92,200,168,.3);border-radius:14px;padding:14px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:900;color:var(--green-d);letter-spacing:.8px;margin-bottom:12px;">SAUVEGARDER LES PV DES PJ</div>
          ${localPJs.map(p => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(92,200,168,.2);">
              <div style="width:32px;height:32px;border-radius:10px;background:${p.avatarColor};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:white;flex-shrink:0;">${p.avatarLetter}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:800;color:var(--text);">${escapeHtml(p.name)}</div>
                <div style="font-size:11px;color:var(--text-light);">${p.currentHp} / ${p.maxHp} PV</div>
              </div>
              <input type="checkbox" id="save-hp-${p.id}" checked style="width:18px;height:18px;cursor:pointer;accent-color:var(--green);"/>
            </div>`).join('')}
        </div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="_endCombatSave()" class="btn-main btn-green">
          Terminer${localPJs.length > 0 ? ' et sauvegarder' : ''}</button>
        <button onclick="_endCombatDiscard()" class="btn-main btn-cancel">Terminer sans sauvegarder</button>
        <button onclick="_cvEndModal=false;renderCombatView()" style="width:100%;padding:10px;border-radius:99px;background:transparent;border:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:var(--text-light);cursor:pointer;margin-top:2px;">↩ Annuler</button>
      </div>
    </div>
  </div>`;
}

async function _endCombatSave() {
  const localPJs = _combat.participants.filter(p => p.localCharId != null);
  const savedMap = {};
  for (const p of localPJs) {
    const cb = document.getElementById(`save-hp-${p.id}`);
    if (cb?.checked) {
      await combatSaveHpForLocalChar(p.localCharId, p.currentHp);
      savedMap[p.localCharId] = p.currentHp;
    }
  }
  closeCombatOverlay();
  // Mettre à jour la sidebar
  await loadCharacterList();
  // Si le perso actuellement sélectionné a été sauvegardé, rafraîchir CS + compteurs
  if (_selectedCharId && savedMap[_selectedCharId] !== undefined && typeof CS !== 'undefined') {
    CS.hp = savedMap[_selectedCharId];
    if (typeof renderCountersContent === 'function') renderCountersContent();
  }
}

function _endCombatDiscard() { closeCombatOverlay(); }

// Reset complet de l'état de la vue combat — appelé par closeCombatOverlay
function _resetCombatViewState() {
  _cvCtxId       = null;
  _cvShowAdd     = false;
  _cvBonusId     = null;
  _cvEndModal    = false;
  _cvConditionId = null;
}

// ── Helpers ───────────────────────────────────────────────────
function combatHpAction(id, delta) { combatChangeHp(id, delta); renderCombatView(); }

// Refresh partiel : re-rend uniquement les deux panneaux sans toucher aux dialogs ouverts
function _refreshLeftRight() {
  const left  = document.querySelector('.cbt-left-panel');
  const right = document.querySelector('.cbt-right-panel');
  if (left)  left.innerHTML  = _renderLeftPanel();
  if (right) right.innerHTML = _renderRightPanel();
}

function combatClearTempHp(el) {
  const id = el.getAttribute('data-pid');
  const p = _combat.participants.find(x => x.id === id);
  if (p) { combatChangeTempHp(id, -(p.tempHp)); renderCombatView(); }
}

// _promptCustomCondition remplacée par _renderConditionDialog

function _effectiveInit(p) { return p.initiative + p.initiativeBonus; }

function _safeAttr(str) {
  return str.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}