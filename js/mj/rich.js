// MJ — ÉDITEUR RICH (WYSIWYG inline, option D)
// ═══════════════════════════════════════════════════════════════
// Cœur technique : le couple de fonctions MIROIR markdown ↔ DOM éditable.
// Le stockage reste 100 % Markdown ; seul le MODE ÉDITION d'un bloc texte
// passe d'une <textarea> brute à un contenteditable riche.
//
//   mjMdToEditableHtml(raw)   markdown inline  → HTML éditable (marques + puces)
//   mjEditableToMd(rootEl)    DOM éditable     → markdown inline
//
// Vocabulaire inline supporté (cf. spec §4) :
//   • texte + retours à la ligne (<br>)
//   • marques  **gras**  *ital*  __souligné__  ~~barré~~  (<strong>/<em>/<u>/<s>)
//   • puces atomiques (contenteditable="false") : @tags et widgets /switch…
//
// L'aller-retour doit être idempotent pour un contenu canonique (cf. spec §13.1).
// Dépend uniquement de escapeHtml (js/db.js) et inlineMd (js/player/notes.js) ;
// la résolution des @tags utilise _mjTagFind si présent (sinon puce « brute »).

// Sentinelles (zone privée Unicode) : survivent à escapeHtml et ne contiennent
// aucun caractère Markdown, donc inlineMd ne les abîme pas. Construites par code
// pour ne pas dépendre de caractères non imprimables dans la source.
const _MJ_RICH_OPEN  = String.fromCharCode(0xE000);
const _MJ_RICH_CLOSE = String.fromCharCode(0xE001);
// Espace de largeur nulle : marqueur de position de curseur, ignoré à la sérialisation.
const _MJ_RICH_ZWSP  = String.fromCharCode(0x200B);

// Widgets inline (état dans [ ]) — /details est multi-lignes et géré ailleurs.
const _MJ_RICH_WIDGET_RE = /\/(switch|todo|combo|compteur|jauge)(?:\[[^\]]*\])?\{[^}]*\}/g;
// Tag @Simple ou @{Nom complet}, précédé d'un bord de mot.
const _MJ_RICH_TAG_RE = /(^|[^\wÀ-ÿ])@(\{([^}]+)\}|([\wÀ-ÿ\-]+))/g;

// ── markdown → HTML éditable ──────────────────────────────────
// 1) on extrait les tokens atomiques (widgets puis tags) en sentinelles,
// 2) on échappe + applique les marques sur le texte restant,
// 3) on réinjecte les puces, 4) les \n deviennent des <br>.
function mjMdToEditableHtml(raw) {
  const pills = [];
  let s = raw == null ? '' : String(raw);

  s = s.replace(_MJ_RICH_WIDGET_RE, (m) => {
    pills.push(_mjWidgetPillHtml(m));
    return _MJ_RICH_OPEN + (pills.length - 1) + _MJ_RICH_CLOSE;
  });
  s = s.replace(_MJ_RICH_TAG_RE, (m, pre, _whole, braced, simple) => {
    const name = (braced != null ? braced : simple).trim();
    pills.push(_mjTagPillHtml(name));
    return pre + _MJ_RICH_OPEN + (pills.length - 1) + _MJ_RICH_CLOSE;
  });

  let html = (typeof inlineMd === 'function') ? inlineMd(escapeHtml(s)) : escapeHtml(s);
  html = html.replace(/\n/g, '<br>');
  html = html.replace(new RegExp(_MJ_RICH_OPEN + '(\\d+)' + _MJ_RICH_CLOSE, 'g'),
    (m, i) => pills[+i] || '');
  return html;
}

// Puce-tag : porte data-name (source de vérité pour la sérialisation). Le style
// reprend .mj-tag quand la ressource est résolue, sinon « cassé ».
function _mjTagPillHtml(name) {
  const res = (typeof _mjTagFind === 'function') ? _mjTagFind(name.toLowerCase()) : null;
  if (res) {
    return `<span class="mj-pill mj-pill-tag mj-tag mj-tag-${res.type}" contenteditable="false"`
         + ` data-name="${escapeHtml(name)}">${res.icon} ${escapeHtml(res.name)}</span>`;
  }
  return `<span class="mj-pill mj-pill-tag mj-tag broken" contenteditable="false"`
       + ` data-name="${escapeHtml(name)}">@${escapeHtml(name)}</span>`;
}

// Puce-widget : porte data-md (token Markdown exact, réémis tel quel — base de
// l'aller-retour). Le contenu visuel est le widget interactif (_mjWidgetEditorInner,
// défini avec les widgets) quand il est disponible ; sinon un chip de repli (ex.
// page de test, qui ne charge pas tags.js). La sérialisation ne lit que data-md.
function _mjWidgetPillHtml(token) {
  const inner = (typeof _mjWidgetEditorInner === 'function')
    ? _mjWidgetEditorInner(token)
    : escapeHtml(_mjWidgetChipLabel(token));
  return `<span class="mj-pill mj-pill-wdg" contenteditable="false"`
       + ` oncontextmenu="if(typeof mjWidgetContext==='function')return mjWidgetContext(event)"`
       + ` data-md="${escapeHtml(token)}">${inner}</span>`;
}

// Libellé court d'un token (repli quand le rendu riche n'est pas chargé).
function _mjWidgetChipLabel(token) {
  const m = token.match(/\{([^}]*)\}/);
  if (!m) return token;
  const body = m[1], ci = body.indexOf(':');
  return (ci >= 0 ? body.slice(0, ci) : body).trim() || token;
}

// ── DOM éditable → markdown ───────────────────────────────────
// Parcourt récursivement les nœuds et reconstruit la chaîne Markdown :
// texte→texte, marques→**…**/*…*/__…__/~~…~~, puce→son token, <br>→\n.
const _MJ_RICH_MARK = {
  strong: '**', b: '**',
  em: '*', i: '*',
  u: '__',
  s: '~~', strike: '~~', del: '~~',
};

function mjEditableToMd(root) {
  if (!root) return '';
  let out = '';
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {            // texte (les ZWSP de curseur sont ignorés)
        out += child.nodeValue.split(_MJ_RICH_ZWSP).join('');
        return;
      }
      if (child.nodeType !== 1) return;       // commentaire, etc.
      const el  = child;
      const tag = el.tagName.toLowerCase();

      if (el.classList && el.classList.contains('mj-pill')) {
        out += _mjPillToMd(el);
        return;
      }
      if (tag === 'br') { out += '\n'; return; }
      const mark = _MJ_RICH_MARK[tag];
      if (mark) { out += mark; walk(el); out += mark; return; }
      if (tag === 'div' || tag === 'p') {     // contenteditable enveloppe parfois en bloc
        if (out && !out.endsWith('\n')) out += '\n';
        walk(el);
        return;
      }
      walk(el);                               // span neutre / inconnu → on descend
    });
  };
  walk(root);
  return out;
}

// Normalise une borne de sélection vers le nœud texte le plus profond, SANS
// descendre dans une puce atomique. Une sélection au niveau élément (ex. Ctrl+A
// → (bloc,0)..(bloc,1)) engloberait les marqueurs `**` et fausserait la bascule ;
// on la ramène à l'intérieur des marques pour que _mjPeelStyles fonctionne.
function _mjDeepPoint(node, offset, atStart) {
  while (node && node.nodeType === 1 && !(node.classList && node.classList.contains('mj-pill'))) {
    const kids = node.childNodes;
    if (!kids.length) break;
    let next, nextOff;
    if (atStart) {
      if (offset >= kids.length) { next = kids[kids.length - 1]; nextOff = next.nodeType === 3 ? next.nodeValue.length : next.childNodes.length; }
      else { next = kids[offset]; nextOff = 0; }
    } else {
      if (offset <= 0) { next = kids[0]; nextOff = 0; }
      else { next = kids[offset - 1]; nextOff = next.nodeType === 3 ? next.nodeValue.length : next.childNodes.length; }
    }
    if (next.nodeType === 1 && next.classList && next.classList.contains('mj-pill')) break;  // puce opaque
    if (next.nodeType === 3) return { node: next, offset: nextOff };
    node = next; offset = nextOff;
  }
  return { node, offset };
}

// ── Correspondance point DOM ↔ offset Markdown ────────────────
// Indispensable aux marques (incrément 2) : convertir la sélection rendue en
// bornes dans la chaîne Markdown, appliquer la bascule, puis restaurer. Les deux
// fonctions ci-dessous MIROITENT exactement mjEditableToMd (mêmes règles d'émission).

// Longueur Markdown produite jusqu'au point DOM (node, offset).
function _mjRichMdLenTo(root, tNode, tOffset) {
  const ZW = _MJ_RICH_ZWSP;
  let out = '', done = false;
  const walk = (node) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length && !done; i++) {
      if (node === tNode && i === tOffset) { done = true; return; }
      const child = kids[i];
      if (child.nodeType === 3) {
        if (child === tNode) { out += child.nodeValue.slice(0, tOffset).split(ZW).join(''); done = true; return; }
        out += child.nodeValue.split(ZW).join('');
      } else if (child.nodeType === 1) {
        const el = child, tag = el.tagName.toLowerCase();
        if (el.classList && el.classList.contains('mj-pill')) { out += _mjPillToMd(el); }
        else if (tag === 'br') { out += '\n'; }
        else {
          const mark = _MJ_RICH_MARK[tag];
          if (mark) { out += mark; walk(el); if (done) return; out += mark; }
          else if (tag === 'div' || tag === 'p') { if (out && !out.endsWith('\n')) out += '\n'; walk(el); if (done) return; }
          else { walk(el); if (done) return; }
        }
      }
    }
    if (!done && node === tNode && tOffset === kids.length) done = true;
  };
  walk(root);
  return out.length;
}

// Point DOM { node, offset } correspondant à l'offset Markdown `target`.
function _mjRichDomPointAt(root, target) {
  const ZW = _MJ_RICH_ZWSP;
  let len = 0, out = '', result = null;
  const walk = (node) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length && !result; i++) {
      const child = kids[i];
      if (child.nodeType === 3) {
        const t = child.nodeValue.split(ZW).join('');
        if (len + t.length >= target) {
          const need = target - len;
          let strip = 0, orig = 0; const raw = child.nodeValue;
          while (orig < raw.length && strip < need) { if (raw[orig] !== ZW) strip++; orig++; }
          result = { node: child, offset: orig }; return;
        }
        len += t.length; out += t;
      } else if (child.nodeType === 1) {
        const el = child, tag = el.tagName.toLowerCase();
        if (el.classList && el.classList.contains('mj-pill')) {
          const tok = _mjPillToMd(el);
          if (len + tok.length >= target) { result = { node, offset: i + 1 }; return; }
          len += tok.length; out += tok;
        } else if (tag === 'br') {
          if (len + 1 >= target) { result = { node, offset: i + 1 }; return; }
          len += 1; out += '\n';
        } else {
          const mark = _MJ_RICH_MARK[tag];
          if (mark) {
            if (len + mark.length > target) { result = { node, offset: i }; return; }
            len += mark.length; out += mark;
            walk(el); if (result) return;
            if (len + mark.length > target) { result = { node, offset: i + 1 }; return; }
            len += mark.length; out += mark;
          } else if (tag === 'div' || tag === 'p') {
            if (out && !out.endsWith('\n')) { if (len + 1 > target) { result = { node, offset: i }; return; } len += 1; out += '\n'; }
            walk(el); if (result) return;
          } else { walk(el); if (result) return; }
        }
      }
    }
  };
  walk(root);
  return result || { node: root, offset: root.childNodes.length };
}

// Puce → son token Markdown. Widget : data-md verbatim. Tag : @Nom ou @{Nom}
// (accolades si le nom n'est pas un token simple), comme l'autocomplétion.
function _mjPillToMd(el) {
  if (el.classList.contains('mj-pill-wdg')) {
    return el.getAttribute('data-md') || '';
  }
  const name = el.getAttribute('data-name') || '';
  if (!name) return '';
  return /^[\wÀ-ÿ-]+$/.test(name) ? `@${name}` : `@{${name}}`;
}
