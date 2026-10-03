// COMBAT BESTIARY — templates de monstres/PNJ sauvegardés
// ═══════════════════════════════════════════════════════════════
// Stockage IndexedDB (table mj_bestiary). bestiaryGetAll() reste SYNCHRONE
// (lit un cache mémoire) car appelée depuis du code de rendu existant qui
// ne peut pas devenir async sans remaniement disproportionné
// (js/combat/setup.js, js/mj/encounters.js, js/mj/tags.js).

const _BESTIARY_KEY = 'logrpg_bestiary'; // ancienne clé localStorage, migration one-shot
let _bestiaryCache = [];

function newBestiaryId() { return 'bt_' + Math.random().toString(36).slice(2, 9); }

// Charge le cache depuis IndexedDB ; migre le localStorage historique s'il
// en reste (bulkPut = insert-ou-remplace par id, donc rejouable sans risque
// de doublon). Appelée à l'ouverture de Mode MJ et de l'écran de combat.
async function bestiaryLoad() {
  const legacyRaw = localStorage.getItem(_BESTIARY_KEY);
  if (legacyRaw) {
    let legacy;
    try {
      legacy = JSON.parse(legacyRaw);
    } catch (err) {
      console.error('[bestiaryLoad] localStorage legacy illisible, ignorée', err);
      localStorage.removeItem(_BESTIARY_KEY); // donnée corrompue, non récupérable
      legacy = null;
    }
    if (Array.isArray(legacy) && legacy.length) {
      try {
        await db.mj_bestiary.bulkPut(legacy.map(t => ({
          id: t.id, name: t.name, type: t.type, maxHp: t.maxHp,
          initiative: t.initiative, stats: t.stats || [], notes: t.notes || '',
        })));
        localStorage.removeItem(_BESTIARY_KEY); // migration réussie
      } catch (err) {
        console.error('[bestiaryLoad] migration IndexedDB échouée, on retentera au prochain chargement', err);
        // pas de removeItem ici : erreur potentiellement transitoire
      }
    } else if (legacy !== null) {
      // JSON valide mais rien à migrer (tableau vide ou forme inattendue) :
      // rien à perdre, rien à retenter — on nettoie quand même la clé.
      localStorage.removeItem(_BESTIARY_KEY);
    }
  }
  _bestiaryCache = await db.mj_bestiary.toArray();
}

function bestiaryGetAll() { return _bestiaryCache; }

async function bestiaryAdd(name, type, maxHp, initiative) {
  const entry = { id: newBestiaryId(), name: name.trim(), type, maxHp, initiative, stats: [], notes: '' };
  await db.mj_bestiary.put(entry);
  await bestiaryLoad();
  return entry.id;
}

async function bestiarySaveEntry(entry) {
  await db.mj_bestiary.put(entry);
  await bestiaryLoad();
}

async function bestiaryRemove(id) {
  await db.mj_bestiary.delete(id);
  await bestiaryLoad();
}

// Restauration ZIP complète (mjImportZip) : remplace tout le contenu de la table.
async function bestiarySave(templates) {
  await db.mj_bestiary.clear();
  await db.mj_bestiary.bulkPut(templates);
  await bestiaryLoad();
}
