/**
 * Wrapper de localStorage para configuración y cache persistente.
 * Todo lo que persiste vive acá; los archivos que sólo leen/escriben en RAM
 * (rankingCache, categoriesList) no pasan por este módulo.
 */

function loadFromStorage() {
  document.getElementById('bearerToken').value = localStorage.getItem(LS_TOKEN) || '';
  document.getElementById('baseUrl').value = localStorage.getItem(LS_BASE) || 'https://circuitopm.ar';
  const savedTid = localStorage.getItem(LS_TID);
  if (savedTid) document.getElementById('tournamentId').value = savedTid;
  try {
    teamCache = JSON.parse(localStorage.getItem(LS_CACHE) || '{}');
  } catch { teamCache = {}; }
  updateCacheUI();
}

function saveToken() { localStorage.setItem(LS_TOKEN, document.getElementById('bearerToken').value.trim()); }
function saveBase()  { localStorage.setItem(LS_BASE,  document.getElementById('baseUrl').value.trim()); }
function saveTid()   { localStorage.setItem(LS_TID,   document.getElementById('tournamentId').value.trim()); }

function saveCache() {
  localStorage.setItem(LS_CACHE, JSON.stringify(teamCache));
  localStorage.setItem(LS_CACHE_DATE, new Date().toISOString());
  updateCacheUI();
}

function updateCacheUI() {
  document.getElementById('cacheCount').textContent = Object.keys(teamCache).length;
  const d = localStorage.getItem(LS_CACHE_DATE);
  document.getElementById('cacheDate').textContent = d ? new Date(d).toLocaleString('es-AR') : 'nunca';
}

function clearCache() {
  if (!confirm('¿Vaciar el cache de equipos? Se perderán todos los nombres asociados a team_ids.')) return;
  teamCache = {};
  localStorage.removeItem(LS_CACHE);
  localStorage.removeItem(LS_CACHE_DATE);
  updateCacheUI();
  if (raw) renderRegistrations();
}
