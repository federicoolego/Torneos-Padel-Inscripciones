/**
 * Bootstrap y navegación.
 * Este archivo debe cargarse ÚLTIMO — asume que todo lo demás ya definió
 * sus funciones globales.
 */

/**
 * Alterna entre la vista Torneo y la vista Ranking.
 * Al entrar por primera vez a Ranking, dispara la carga del listado de
 * categorías (independiente del torneo).
 */
function switchView(view) {
  currentView = view;
  document.getElementById('tab-tournament').classList.toggle('active', view === 'tournament');
  document.getElementById('tab-ranking').classList.toggle('active', view === 'ranking');

  document.getElementById('mainContent').classList.toggle('hidden', view !== 'tournament' || !raw);
  document.getElementById('rankingContent').classList.toggle('hidden', view !== 'ranking');

  // Estas dos barras sólo aplican a la vista Torneo
  document.getElementById('cacheBar').classList.toggle('hidden', view !== 'tournament');
  document.getElementById('apiBar').classList.toggle('hidden', view !== 'tournament');

  // Al entrar a Ranking, cargar categorías si aún no las tenemos
  if (view === 'ranking' && !categoriesList) {
    fetchCategoriesList(false);
  }
}

// ---- Loggers globales: cualquier error silencioso queda en consola ----
window.addEventListener('error', e => {
  console.error('[CircuitoPM] Uncaught error:', e.error || e.message, e);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[CircuitoPM] Unhandled promise rejection:', e.reason);
});

// ---- Wiring de listeners + auto-login ----
document.addEventListener('DOMContentLoaded', () => {
  const bu = document.getElementById('baseUrl');
  const ti = document.getElementById('tournamentId');
  const bt = document.getElementById('bearerToken');
  if (bu) bu.addEventListener('keydown', e => { if (e.key === 'Enter') fetchTournament(); });
  // El select de torneo carga automáticamente al cambiar
  if (ti) ti.addEventListener('change', () => fetchTournament());
  if (bt) bt.addEventListener('keydown', e => { if (e.key === 'Enter') fetchTournament(); });

  if (isAuthed()) { showApp(); }
});