/**
 * Modal de cuadro de Playoff.
 *
 * Endpoint:
 *   GET /api/tournament-categories/playoffs?tournament_category_id={tcId}
 *
 * Se abre desde una fila del pointsHistory en la vista Ranking.
 * Cachea por tc_id para no repetir requests si el usuario reabre el mismo cuadro.
 */

const bracketCache = {};       // { [tcId]: playoffResponseData }
const tcIdResolveCache = {};   // { [`${tid}:${cid}`]: tcId }

// ============ RESOLUCIÓN DE tc_id ============
/**
 * pointsHistory idealmente trae `tournament_category_id`.
 * Si no lo trae, se puede derivar con tournament_id + category_id (base)
 * pegándole a /api/tournaments/{tid} y matcheando por category_id.
 */
async function resolveTcId(tournamentId, categoryId) {
  const key = `${tournamentId}:${categoryId}`;
  if (tcIdResolveCache[key]) return tcIdResolveCache[key];

  const resp = await apiGet(`/api/tournaments/${tournamentId}?_ts=${Date.now()}`);
  const tcs = resp?.data?.categories || [];
  const match = tcs.find(tc => Number(tc.category_id) === Number(categoryId));
  if (match) {
    tcIdResolveCache[key] = match.id;
    return match.id;
  }
  return null;
}

// ============ APERTURA DEL MODAL ============

async function openBracketFromHistory(rowEl) {
  const tcId = rowEl.dataset.tcId;
  const tid  = rowEl.dataset.tid;
  const cid  = rowEl.dataset.cid;
  const meta = {
    title: rowEl.dataset.category ? `Cuadro · ${rowEl.dataset.category}` : 'Cuadro de Playoff',
    subtitle: rowEl.dataset.date ? `Torneo del ${rowEl.dataset.date}` : ''
  };

  // Camino feliz: tc_id ya vino en el pointsHistory
  if (tcId && tcId !== 'undefined' && tcId !== '') {
    return openBracketModal(Number(tcId), meta);
  }

  // Fallback: derivar tc_id
  if (!tid || !cid) {
    console.warn('[bracket] Falta tournament_id y/o category_id en el entry:', rowEl.dataset);
    alert('No se pudo identificar el torneo desde este registro. Revisá la consola.');
    return;
  }

  showBracketModal(meta, `<div class="bracket-loading"><span class="spinner"></span> Ubicando torneo…</div>`);
  try {
    const resolved = await resolveTcId(tid, cid);
    if (!resolved) {
      setBracketBody(`<div class="bracket-empty">No se encontró la categoría en el torneo #${tid}.</div>`);
      return;
    }
    openBracketModal(resolved, meta);
  } catch (err) {
    setBracketBody(`<div class="bracket-error">⚠ ${err.message}</div>`);
  }
}

async function openBracketModal(tcId, meta = {}) {
  showBracketModal(meta, `<div class="bracket-loading"><span class="spinner"></span> Cargando cuadro…</div>`);

  try {
    let data = bracketCache[tcId];
    if (!data) {
      const resp = await apiGet(`/api/tournament-categories/playoffs?tournament_category_id=${tcId}&_ts=${Date.now()}`);
      if (!resp || !resp.data) throw new Error('Respuesta vacía del endpoint /playoffs');
      bracketCache[tcId] = resp.data;
      data = resp.data;
    }
    const matches = data.matches || [];
    if (matches.length === 0) {
      setBracketBody(`<div class="bracket-empty">Este torneo no tiene cuadro de playoff cargado.</div>`);
      return;
    }
    setBracketBody(renderBracket(matches));
  } catch (err) {
    setBracketBody(`<div class="bracket-error">⚠ Error cargando el cuadro: ${err.message}</div>`);
  }
}

function showBracketModal(meta, initialHtml) {
  const overlay = document.getElementById('bracketOverlay');
  document.getElementById('bracketTitle').textContent = meta.title || 'Cuadro de Playoff';
  document.getElementById('bracketSubtitle').textContent = meta.subtitle || '';
  setBracketBody(initialHtml);
  overlay.classList.remove('hidden');
}

function setBracketBody(html) {
  document.getElementById('bracketBody').innerHTML = html;
}

function closeBracketModal() {
  document.getElementById('bracketOverlay').classList.add('hidden');
  setBracketBody('');
}

// Cerrar con ESC y con click en el fondo
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const ov = document.getElementById('bracketOverlay');
  if (ov && !ov.classList.contains('hidden')) closeBracketModal();
});

// ============ RENDER ============

function renderBracket(matches) {
  // Agrupar por round_number
  const roundsMap = new Map();
  matches.forEach(m => {
    if (!roundsMap.has(m.round_number)) {
      roundsMap.set(m.round_number, { name: m.round_name, matches: [] });
    }
    roundsMap.get(m.round_number).matches.push(m);
  });

  const rounds = [...roundsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, r]) => ({
      number: n,
      name: r.name,
      matches: r.matches.sort((a, b) => a.match_number - b.match_number)
    }));

  const cols = rounds.map((r, idx) => {
    const cards = r.matches.map(m => renderMatchCard(m)).join('');
    const isLast = idx === rounds.length - 1;
    return `
      <div class="br-col ${isLast ? 'br-col-last' : ''}" data-round="${r.number}">
        <div class="br-round-title">${r.name || `Ronda ${r.number}`}</div>
        <div class="br-col-matches">${cards}</div>
      </div>
    `;
  }).join('');

  return `<div class="bracket">${cols}</div>`;
}

function renderMatchCard(m) {
  const isBye = m.status === 'bye';
  const homeName = teamDisplayName(m.teamHome);
  const awayName = m.teamAway ? teamDisplayName(m.teamAway) : (isBye ? '' : 'A definir');
  const homePos = m.home_source_position || '';
  const awayPos = m.away_source_position || '';
  const homeWin = m.winner_team_id && m.team_home_id === m.winner_team_id;
  const awayWin = m.winner_team_id && m.team_away_id === m.winner_team_id;

  let scoreLine = '';
  if (isBye) {
    scoreLine = `<div class="br-score br-bye">BYE</div>`;
  } else if (m.score_json && Array.isArray(m.score_json.sets) && m.score_json.sets.length) {
    const parts = m.score_json.sets.map(s => `${s.home}-${s.away}`).join(' ');
    scoreLine = `<div class="br-score">${parts}</div>`;
  } else {
    scoreLine = `<div class="br-score br-pending">—</div>`;
  }

  return `
    <div class="br-match ${isBye ? 'is-bye' : ''}">
      <div class="br-team ${homeWin ? 'is-winner' : ''}">
        <span class="br-seed">${homePos}</span>
        <span class="br-name">${escapeHtml(homeName) || '—'}</span>
      </div>
      <div class="br-team ${awayWin ? 'is-winner' : ''} ${!m.teamAway ? 'is-empty' : ''}">
        <span class="br-seed">${awayPos}</span>
        <span class="br-name">${escapeHtml(awayName) || '—'}</span>
      </div>
      ${scoreLine}
    </div>
  `;
}

function teamDisplayName(team) {
  if (!team) return '';
  const nameOrDni = (p, dniFallback) => {
    if (p && (p.nombre || p.apellido)) return `${(p.nombre || '').trim()} ${(p.apellido || '').trim()}`.trim();
    return dniFallback || '—';
  };
  const p1 = nameOrDni(team.player1, team.player1_dni);
  const p2 = nameOrDni(team.player2, team.player2_dni);
  return `${p1} / ${p2}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}