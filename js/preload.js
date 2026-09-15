/**
 * Precarga del cache de equipos barriendo torneos históricos.
 * `absorbTeamsFromStandings` la usan tanto la precarga como fetchTournament.
 */

function absorbTeamsFromStandings(standingsData) {
  let added = 0;
  if (!standingsData || !Array.isArray(standingsData.data)) return 0;
  standingsData.data.forEach(zone => {
    (zone.standings || []).forEach(s => {
      if (s.team && s.team.id != null) {
        const existing = teamCache[s.team.id];
        const entry = {
          id: s.team.id,
          dni1: s.team.player1_dni,
          dni2: s.team.player2_dni,
          p1: s.team.player1 ? `${s.team.player1.nombre.trim()} ${s.team.player1.apellido.trim()}` : null,
          p2: s.team.player2 ? `${s.team.player2.nombre.trim()} ${s.team.player2.apellido.trim()}` : null,
        };
        if (!existing) added++;
        teamCache[s.team.id] = entry;
      }
    });
  });
  return added;
}

function showPreloadModal() {
  const from = prompt('¿Desde qué torneo ID barrer?', '1');
  if (from === null) return;
  const to = prompt('¿Hasta qué torneo ID barrer?', document.getElementById('tournamentId').value || '20');
  if (to === null) return;
  const fromN = parseInt(from), toN = parseInt(to);
  if (isNaN(fromN) || isNaN(toN) || fromN > toN) { alert('IDs inválidos'); return; }
  runPreload(fromN, toN);
}

async function runPreload(fromId, toId) {
  saveToken(); saveBase();
  preloadCancelled = false;
  const overlay = document.getElementById('progressOverlay');
  const statusEl = document.getElementById('progressStatus');
  const barEl = document.getElementById('progressBar');
  const cT = document.getElementById('counterTournaments');
  const cC = document.getElementById('counterCats');
  const cN = document.getElementById('counterTeams');
  const cE = document.getElementById('counterErrors');
  document.getElementById('closePreloadBtn').classList.add('hidden');
  document.getElementById('cancelPreloadBtn').classList.remove('hidden');
  overlay.classList.remove('hidden');

  let tCount = 0, cCount = 0, tNew = 0, errs = 0;
  const totalT = toId - fromId + 1;

  for (let tid = fromId; tid <= toId; tid++) {
    if (preloadCancelled) break;
    statusEl.textContent = `Torneo #${tid}...`;
    try {
      const t = await apiGet(`/api/tournaments/${tid}`);
      tCount++; cT.textContent = tCount;
      const tcIds = (t.data?.categories || []).map(c => c.id);
      for (const tcId of tcIds) {
        if (preloadCancelled) break;
        statusEl.textContent = `Torneo #${tid} · categoría ${tcId}...`;
        try {
          const s = await apiGet(`/api/tournament-categories/standings?tournament_category_id=${tcId}`);
          const added = absorbTeamsFromStandings(s);
          cCount++; cC.textContent = cCount;
          tNew += added; cN.textContent = tNew;
        } catch (e) {
          errs++; cE.textContent = errs;
        }
      }
    } catch (e) {
      errs++; cE.textContent = errs;
    }
    barEl.style.width = Math.round(((tid - fromId + 1) / totalT) * 100) + '%';
  }

  saveCache();
  statusEl.textContent = preloadCancelled
    ? '⚠ Cancelado por el usuario.'
    : `✓ Terminado. ${tNew} teams nuevos en el cache (total: ${Object.keys(teamCache).length}).`;
  document.getElementById('cancelPreloadBtn').classList.add('hidden');
  document.getElementById('closePreloadBtn').classList.remove('hidden');
  if (raw) renderRegistrations();
}

function cancelPreload() { preloadCancelled = true; }
function closePreloadModal() { document.getElementById('progressOverlay').classList.add('hidden'); }
