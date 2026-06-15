// ═══════════════════════════════════════════════════════════════
// CONFIG LogRPG — modifier ici sans toucher au code
// ═══════════════════════════════════════════════════════════════
const APP_CONFIG = {
  version : '1.6.0',
  appName : 'LogRPG',
};

// ═══════════════════════════════════════════════════════════════
// Webhooks Discord — remplacer par vos URLs en prod (ne pas committer)
// ═══════════════════════════════════════════════════════════════
const DISCORD_WEBHOOKS = {
  bugs  : 'VOTRE_WEBHOOK_BUGS_ICI',
  ideas : 'VOTRE_WEBHOOK_IDEES_ICI',
};

// Affichage automatique de la version dans le badge topbar
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('app-version-badge');
  if (badge) badge.textContent = 'v' + APP_CONFIG.version;
  const mobBadge = document.getElementById('mob-version-badge');
  if (mobBadge) mobBadge.textContent = 'v' + APP_CONFIG.version;
});