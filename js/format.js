/**
 * Helpers puros (sin efectos secundarios sobre el DOM ni el estado).
 * Los usan tanto la vista Torneo como Ranking.
 */

function fmtDate(iso, withTime = false) {
  if (!iso) return '-';
  const d = new Date(iso);
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('es-AR', opts);
}

function fmtDateRange(from, to) {
  const f = new Date(from), t = new Date(to);
  const yearOpts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate().toString().padStart(2,'0')}–${t.toLocaleDateString('es-AR', yearOpts)}`;
  }
  return `${f.toLocaleDateString('es-AR', { day:'2-digit', month:'short' })} – ${t.toLocaleDateString('es-AR', yearOpts)}`;
}

function barClass(pct) { if (pct >= 90) return 'full'; if (pct >= 50) return 'med'; return 'low'; }

/**
 * Devuelve la clase de pill según el nombre de la posición del ranking.
 * Trabaja en lower-case y con includes/startsWith para tolerar variantes.
 */
function positionPillClass(position) {
  const p = (position || '').toLowerCase();
  if (p.includes('campe') && !p.includes('sub')) return 'pos-campeon';
  if (p.includes('subcampe')) return 'pos-subcampeon';
  if (p.includes('semifinal')) return 'pos-semifinal';
  if (p.includes('cuartos')) return 'pos-cuartos';
  if (p.includes('octavos')) return 'pos-octavos';
  if (p === 'zona' || p.startsWith('zona')) return 'pos-zona';
  return 'pos-otro';
}

/**
 * Dado el pointsHistory de un jugador, devuelve la mejor instancia alcanzada
 * según INSTANCE_ORDER (Campeón > Subcampeón > … > Zona). null si no jugó.
 */
function maxInstance(pointsHistory) {
  if (!pointsHistory || !pointsHistory.length) return null;
  let bestIdx = INSTANCE_ORDER.length;
  pointsHistory.forEach(h => {
    const pos = (h.position || '').trim().toLowerCase();
    if (!pos) return;
    for (let i = 0; i < INSTANCE_ORDER.length; i++) {
      const target = INSTANCE_ORDER[i].toLowerCase();
      if (pos === target || pos.startsWith(target)) {
        if (i < bestIdx) bestIdx = i;
        return;
      }
    }
  });
  return bestIdx < INSTANCE_ORDER.length ? INSTANCE_ORDER[bestIdx] : null;
}

/**
 * Aplica ranking olímpico (1, 2, 3, 3, 5) sobre `totalPoints` desc.
 * Devuelve el array ordenado con `_rank` inyectado en cada jugador.
 */
function computeRanks(players) {
  const sorted = [...players].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
  let prevPoints = null, prevRank = 0;
  sorted.forEach((p, i) => {
    if (p.totalPoints === prevPoints) {
      p._rank = prevRank;
    } else {
      p._rank = i + 1;
      prevRank = p._rank;
      prevPoints = p.totalPoints;
    }
  });
  return sorted;
}

function rankBadgeHtml(rank) {
  if (rank === 1) return `<span class="rank-badge gold"><span class="medal">🥇</span>${rank}</span>`;
  if (rank === 2) return `<span class="rank-badge silver"><span class="medal">🥈</span>${rank}</span>`;
  if (rank === 3) return `<span class="rank-badge bronze"><span class="medal">🥉</span>${rank}</span>`;
  return `<span class="rank-badge">${rank}</span>`;
}

/**
 * Extrae género del string "6TA (caballeros)" que viene en cada entry del
 * ranking. Devuelve 'caballeros' | 'damas' | null.
 */
function guessGenderFromCategoria(categoria) {
  const s = (categoria || '').toLowerCase();
  if (s.includes('damas')) return 'damas';
  if (s.includes('caballeros')) return 'caballeros';
  return null;
}
