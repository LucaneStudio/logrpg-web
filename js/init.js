// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadCharacterList();
  if (window.innerWidth < 1100) await initMobileApp();
  // Transfert demandé par l'application : sa modale passe avant la release note
  if (backupHasPendingTransfer()) await backupCheckTransfer();
  else aproposCheckReleaseNote();
});
