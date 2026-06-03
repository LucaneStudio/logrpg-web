// COMBAT BESTIARY — templates de monstres/PNJ sauvegardés
// ═══════════════════════════════════════════════════════════════
// Stockage localStorage (pas de DB migration nécessaire)

const _BESTIARY_KEY = 'logrpg_bestiary';

function bestiaryGetAll() {
  try {
    return JSON.parse(localStorage.getItem(_BESTIARY_KEY) || '[]');
  } catch { return []; }
}

function bestiarySave(templates) {
  localStorage.setItem(_BESTIARY_KEY, JSON.stringify(templates));
}

function bestiaryAdd(name, type, maxHp, initiative) {
  const templates = bestiaryGetAll();
  templates.push({
    id: 'bt_' + Math.random().toString(36).slice(2, 9),
    name: name.trim(), type, maxHp, initiative,
  });
  bestiarySave(templates);
}

function bestiaryRemove(id) {
  bestiarySave(bestiaryGetAll().filter(t => t.id !== id));
}
