// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadCharacterList();
  if (window.innerWidth < 1100) await initMobileApp();
  aproposCheckReleaseNote();
});
