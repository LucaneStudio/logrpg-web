// COMBAT STATE — logique pure, sans DOM
// ═══════════════════════════════════════════════════════════════

const _COMBAT_PALETTE = [
  'linear-gradient(135deg,#A78BFA,#7C5CDB)',
  'linear-gradient(135deg,#5CC8A8,#3DAF8E)',
  'linear-gradient(135deg,#FF6B6B,#E05050)',
  'linear-gradient(135deg,#FFD166,#E6A800)',
  'linear-gradient(135deg,#5B9CF6,#3A7FD4)',
  'linear-gradient(135deg,#FF8C42,#E06000)',
  'linear-gradient(135deg,#A8E063,#5CAC2C)',
  'linear-gradient(135deg,#F06292,#C2185B)',
];

function combatColorFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
  return _COMBAT_PALETTE[h % _COMBAT_PALETTE.length];
}

// Normalise une condition (string ou objet) → nom
function _condName(c) { return typeof c === 'string' ? c : c.name; }

function _newCombatId() {
  return 'cp_' + Math.random().toString(36).slice(2, 9);
}

// ── État global ───────────────────────────────────────────────
let _combat = _freshCombatState();

function _freshCombatState() {
  return { participants: [], round: 1, isStarted: false, playedThisRound: [], currentId: null };
}

// ── Computed ──────────────────────────────────────────────────
function combatSortedActive() {
  const active    = _combat.participants.filter(p => p.status === 'ACTIVE');
  const lockedIds = new Set([..._combat.playedThisRound, ...(_combat.currentId ? [_combat.currentId] : [])]);
  const played    = _combat.playedThisRound.map(id => active.find(p => p.id === id)).filter(Boolean);
  const current   = _combat.currentId ? active.find(p => p.id === _combat.currentId) : null;
  const remaining = active
    .filter(p => !lockedIds.has(p.id))
    .sort((a, b) => _effectiveInit(b) - _effectiveInit(a));
  return [...played, ...(current ? [current] : []), ...remaining];
}

function combatSortedInactive() {
  return _combat.participants.filter(p => p.status !== 'ACTIVE');
}

function _effectiveInit(p) { return p.initiative + p.initiativeBonus; }

// ── Participants ──────────────────────────────────────────────
// avatarColorOverride : permet de passer getAvatarColor(char.id) pour les persos locaux
function combatAddParticipant(name, type, maxHp, initiative, localCharId = null, avatarColorOverride = null, avatarPhoto = null, currentHpOverride = null) {
  const p = {
    id: _newCombatId(), name, type, localCharId,
    currentHp: (currentHpOverride !== null ? currentHpOverride : maxHp), maxHp, tempHp: 0, initiative,
    initiativeBonus: 0, pendingBonus: 0,
    conditions: [], status: 'ACTIVE',
    avatarColor: avatarColorOverride || combatColorFor(name),
    avatarLetter: (name[0] || '?').toUpperCase(),
    avatarPhoto: avatarPhoto || null,
  };
  _combat.participants.push(p);
  return p;
}

// Génère un nom unique en ajoutant un suffixe numérique si besoin
function _uniqueParticipantName(baseName) {
  const existing = new Set(_combat.participants.map(p => p.name));
  if (!existing.has(baseName)) return baseName;
  let i = 2;
  while (existing.has(`${baseName} ${i}`)) i++;
  return `${baseName} ${i}`;
}

function combatRemoveParticipant(id) {
  _combat.participants = _combat.participants.filter(p => p.id !== id);
  if (_combat.currentId === id) _combat.currentId = null;
  _combat.playedThisRound = _combat.playedThisRound.filter(i => i !== id);
}

function combatSetInitiative(id, value) {
  _updateP(id, p => ({ ...p, initiative: parseInt(value) || 0 }));
}

// ── Bonus d'initiative ────────────────────────────────────────
// Si le participant a déjà joué ce round → pendingBonus (appliqué au round suivant)
// Sinon → initiativeBonus immédiat
function combatAddBonus(id, bonus) {
  const hasPlayed = id === _combat.currentId || _combat.playedThisRound.includes(id);
  if (hasPlayed) _updateP(id, p => ({ ...p, pendingBonus: bonus }));
  else           _updateP(id, p => ({ ...p, initiativeBonus: bonus }));
}

function combatRemoveBonus(id) {
  _updateP(id, p => ({ ...p, initiativeBonus: 0, pendingBonus: 0 }));
}

// ── HP ────────────────────────────────────────────────────────
function combatChangeHp(id, delta) {
  _updateP(id, p => ({ ...p, currentHp: Math.max(0, Math.min(p.maxHp, p.currentHp + delta)) }));
}

// ── Conditions ────────────────────────────────────────────────
function combatChangeTempHp(id, delta) {
  _updateP(id, p => ({ ...p, tempHp: Math.max(0, (p.tempHp || 0) + delta) }));
}

// rounds : nombre de rounds restants (null = permanent)
function combatAddCondition(id, name, rounds) {
  const obj = { name, rounds: (rounds > 0 ? rounds : null), expired: false };
  _updateP(id, p => ({
    ...p,
    conditions: [...p.conditions.filter(c => _condName(c) !== name), obj]
  }));
}
function combatRemoveCondition(id, name) {
  _updateP(id, p => ({ ...p, conditions: p.conditions.filter(c => _condName(c) !== name) }));
}

// Tick des conditions au début du tour du participant
function _combatTickConditions(id) {
  _updateP(id, p => ({
    ...p,
    conditions: p.conditions
      .map(c => {
        if (typeof c === 'string') return c;  // compat ancien format
        if (c.rounds === null) return c;       // permanente
        if (c.expired) return null;            // déjà expirée → supprimer
        if (c.rounds <= 1) return { ...c, rounds: 0, expired: true };
        return { ...c, rounds: c.rounds - 1 };
      })
      .filter(Boolean)
  }));
}

// ── Statut ────────────────────────────────────────────────────
function combatSetStatus(id, status) {
  _updateP(id, p => ({ ...p, status }));
  if (id === _combat.currentId && status !== 'ACTIVE') {
    // Participant actif déclaré KO/fuite → passer au suivant
    combatNextTurn();
  } else if (status === 'ACTIVE' && _combat.currentId === null) {
    // Plus personne n'était actif et on remet ce participant → c'est son tour
    _combat.currentId = id;
    _combat.playedThisRound = _combat.playedThisRound.filter(i => i !== id);
  }
}

// Forcer le tour d'un participant : il devient le participant actif immédiatement
// Tous ceux qui auraient dû jouer avant lui sont marqués comme ayant joué ce round
function combatForceTurn(id) {
  const p = _combat.participants.find(p => p.id === id);
  if (!p || p.status !== 'ACTIVE') return;
  // Conserver ce qui a déjà été joué + marquer comme joués tous ceux
  // qui étaient avant lui dans l'ordre d'initiative (sauf lui-même)
  const sorted = combatSortedActive().filter(p => p.id !== id);
  const nowPlayed = new Set([..._combat.playedThisRound, ...sorted.map(p => p.id)]);
  // Retirer le participant cible de la liste des "ayant joué" s'il y était
  nowPlayed.delete(id);
  _combat.playedThisRound = [...nowPlayed];
  _combat.currentId = id;
  _combatTickConditions(id);
}

// ── Démarrage ─────────────────────────────────────────────────
function combatStart() {
  const sorted = _combat.participants
    .filter(p => p.status === 'ACTIVE')
    .sort((a, b) => _effectiveInit(b) - _effectiveInit(a));
  _combat.isStarted = true;
  _combat.round = 1;
  _combat.playedThisRound = [];
  _combat.currentId = sorted[0]?.id ?? null;
  if (_combat.currentId) _combatTickConditions(_combat.currentId);
}

// ── Tour suivant ──────────────────────────────────────────────
function combatNextTurn() {
  const currentId = _combat.currentId;
  if (!currentId) return;

  const played    = [..._combat.playedThisRound, currentId];
  const remaining = combatSortedActive().filter(p => p.id !== currentId && !_combat.playedThisRound.includes(p.id));

  if (remaining.length === 0) {
    _combat.participants = _combat.participants.map(p =>
      p.pendingBonus !== 0 ? { ...p, initiativeBonus: p.pendingBonus, pendingBonus: 0 } : p
    );
    const nextSorted = _combat.participants
      .filter(p => p.status === 'ACTIVE')
      .sort((a, b) => _effectiveInit(b) - _effectiveInit(a));
    _combat.round++;
    _combat.playedThisRound = [];
    _combat.currentId       = nextSorted[0]?.id ?? null;
  } else {
    _combat.playedThisRound = played;
    _combat.currentId       = remaining[0].id;
  }
  if (_combat.currentId) _combatTickConditions(_combat.currentId);
}

// ── Fin / Reset ───────────────────────────────────────────────
function combatReset() { _combat = _freshCombatState(); }

async function combatSaveHpForLocalChar(localCharId, newHp) {
  await updateCharacterFields(localCharId, { hpCurrent: newHp });
}

// ── Helper ────────────────────────────────────────────────────
function _updateP(id, fn) {
  _combat.participants = _combat.participants.map(p => p.id === id ? fn(p) : p);
}