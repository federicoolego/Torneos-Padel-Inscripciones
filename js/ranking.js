/**
 * Vista Ranking — completamente independiente de la vista Torneo.
 *
 * Flujo:
 *   1. Al entrar a la vista (o al abrir la app si arranca en Ranking),
 *      fetchCategoriesList() llama a GET /api/categories y cachea el listado
 *      en la variable global `categoriesList`.
 *   2. Ese listado alimenta el <select> del filtro.
 *   3. Al elegir una categoría, fetchRanking(categoryId) baja
 *      GET /api/tournament-categories/ranking?category_id=X y cachea la
 *      respuesta en `rankingCache[categoryId]`.
 *   4. renderRanking() dibuja tabla + KPIs + acordeón sin tocar más el DOM
 *      hasta el próximo cambio.
 */

// ============ CATEGORÍAS (endpoint /api/categories) ============

async function fetchCategoriesList(forceRefresh = false) {
  if (!forceRefresh && categoriesList) {
    populateRankingCategorySelect();
    return;
  }
  const statusEl = document.getElementById('apiStatus');
  const sel = document.getElementById('rankCategorySelect');

  sel.disabled = true;
  sel.innerHTML = '<option value="">Cargando categorías…</option>';
  statusEl.className = 'status loading';
  statusEl.innerHTML = '<span class="spinner"></span>Cargando categorías...';

  try {
    const resp = await apiGet(`/api/categories?_ts=${Date.now()}`);
    if (!resp || !Array.isArray(resp.data)) throw new Error('Respuesta inesperada de /api/categories');
    categoriesList = resp.data;
    populateRankingCategorySelect();
    statusEl.className = 'status ok';
    statusEl.textContent = `✓ Categorías OK (${categoriesList.length}) · ${new Date().toLocaleTimeString('es-AR')}`;
  } catch (err) {
    showError(err, '/api/categories');
    statusEl.className = 'status error';
    statusEl.textContent = '✗ Error categorías';
    sel.innerHTML = '<option value="">Error cargando categorías</option>';
  }
}

/**
 * Puebla el <select> desde `categoriesList` (cache en RAM del endpoint
 * /api/categories). Mantiene la selección previa si sigue disponible.
 * También habilita el buscador y los botones asociados.
 */
function populateRankingCategorySelect() {
  const sel = document.getElementById('rankCategorySelect');

  if (!categoriesList || !categoriesList.length) {
    sel.innerHTML = '<option value="">Sin categorías disponibles</option>';
    sel.disabled = true;
    document.getElementById('rankSearch').disabled = true;
    document.getElementById('rankRefreshBtn').disabled = true;
    document.getElementById('rankExpandAllBtn').disabled = true;
    return;
  }

  const options = [...categoriesList]
    .filter(c => c.active !== false) // por si algún día vienen inactivas
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const prevSelected = currentRankingCategoryId;
  sel.innerHTML = '<option value="">— Elegí una categoría —</option>' + options.map(c =>
    `<option value="${c.id}" data-gender="${c.gender}" data-name="${c.name}">${c.name} (${c.gender})</option>`
  ).join('');
  sel.disabled = false;
  document.getElementById('rankSearch').disabled = false;

  if (prevSelected && options.some(o => o.id === prevSelected)) {
    sel.value = String(prevSelected);
  } else {
    currentRankingCategoryId = null;
    rankingExpanded.clear();
    renderRanking();
  }
}

// ============ RANKING (endpoint /api/tournament-categories/ranking) ============

function onRankCategoryChange() {
  const sel = document.getElementById('rankCategorySelect');
  const val = sel.value ? Number(sel.value) : null;
  currentRankingCategoryId = val;
  rankingExpanded.clear();
  if (val == null) {
    renderRanking();
    return;
  }
  const cached = rankingCache[val];
  if (cached) {
    renderRanking();
    updateRankUpdatedHint();
  } else {
    fetchRanking(val, false);
  }
}

async function fetchRanking(categoryId, forceRefresh = false) {
  if (categoryId == null) return;
  if (!forceRefresh && rankingCache[categoryId]) {
    renderRanking();
    updateRankUpdatedHint();
    return;
  }
  saveToken(); saveBase();
  const statusEl = document.getElementById('apiStatus');
  const container = document.getElementById('rankingTableContainer');
  const refreshBtn = document.getElementById('rankRefreshBtn');

  statusEl.className = 'status loading';
  statusEl.innerHTML = '<span class="spinner"></span>Cargando ranking...';
  refreshBtn.disabled = true;

  container.innerHTML = `<div class="ranking-empty">
    <div class="icon"><span class="spinner"></span></div>
    <strong>Cargando ranking de la categoría…</strong>
  </div>`;

  try {
    const ts = Date.now();
    const resp = await apiGet(`/api/tournament-categories/ranking?category_id=${categoryId}&_ts=${ts}`);
    if (!resp || !Array.isArray(resp.data)) throw new Error('Respuesta inesperada del ranking');
    rankingCache[categoryId] = { data: resp.data, fetchedAt: ts };
    renderRanking();
    updateRankUpdatedHint();
    statusEl.className = 'status ok';
    statusEl.textContent = `✓ Ranking OK · ${new Date().toLocaleTimeString('es-AR')}`;
  } catch (err) {
    showError(err, `/api/tournament-categories/ranking?category_id=${categoryId}`);
    statusEl.className = 'status error';
    statusEl.textContent = '✗ Error ranking';
    container.innerHTML = `<div class="ranking-empty">
      <div class="icon">⚠</div>
      <strong>Error cargando el ranking.</strong>
      <p>Revisá el mensaje de error arriba.</p>
    </div>`;
  } finally {
    refreshBtn.disabled = false;
  }
}

function updateRankUpdatedHint() {
  const hint = document.getElementById('rankUpdatedHint');
  const cached = currentRankingCategoryId != null ? rankingCache[currentRankingCategoryId] : null;
  if (!cached) { hint.textContent = ''; return; }
  hint.textContent = `Actualizado: ${new Date(cached.fetchedAt).toLocaleTimeString('es-AR')}`;
}

// ============ RENDER ============

function renderRanking() {
  const container = document.getElementById('rankingTableContainer');
  const kpisEl = document.getElementById('rankKpis');
  const captionEl = document.getElementById('rankCaption');
  const catNameEl = document.getElementById('rank-cat-name');
  const catGenderBadge = document.getElementById('rank-cat-gender-badge');
  const catIdBadge = document.getElementById('rank-cat-id-badge');

  // Header: título con nombre de cat (busco en categoriesList, no en cats)
  if (currentRankingCategoryId != null) {
    const catObj = (categoriesList || []).find(c => c.id === currentRankingCategoryId);
    if (catObj) {
      catNameEl.textContent = `· ${catObj.name} (${catObj.gender})`;
      catGenderBadge.textContent = catObj.gender;
      catGenderBadge.className = `badge pill ${catObj.gender}`;
      catGenderBadge.style.display = '';
      catIdBadge.textContent = `ID #${catObj.id}`;
      catIdBadge.style.display = '';
    }
  } else {
    catNameEl.textContent = '—';
    catGenderBadge.style.display = 'none';
    catIdBadge.style.display = 'none';
  }

  const cached = currentRankingCategoryId != null ? rankingCache[currentRankingCategoryId] : null;

  if (!currentRankingCategoryId) {
    container.innerHTML = `<div class="ranking-empty">
      <div class="icon">🎾</div>
      <strong>Elegí una categoría</strong>
      <p>Usá el selector de arriba para ver el ranking.</p>
    </div>`;
    kpisEl.innerHTML = '';
    captionEl.textContent = '';
    document.getElementById('rankExpandAllBtn').disabled = true;
    document.getElementById('rankRefreshBtn').disabled = true;
    return;
  }

  if (!cached) {
    // fetchRanking se encarga del loading state
    kpisEl.innerHTML = '';
    captionEl.textContent = '';
    return;
  }

  const players = cached.data || [];
  document.getElementById('rankRefreshBtn').disabled = false;
  document.getElementById('rankExpandAllBtn').disabled = players.length === 0;

  // KPIs
  const totalPlayers = players.length;
  const totalTournaments = players.reduce((s, p) => s + (p.tournamentsPlayed || 0), 0);
  const avgTournaments = totalPlayers ? (totalTournaments / totalPlayers).toFixed(1) : '0';
  const leader = players.reduce((best, p) => (!best || p.totalPoints > best.totalPoints) ? p : best, null);
  const totalPointsSum = players.reduce((s, p) => s + (p.totalPoints || 0), 0);

  kpisEl.innerHTML = '';
  [
    { val: totalPlayers, lbl: 'Jugadores', cls: 'accent' },
    { val: leader ? leader.totalPoints : 0, lbl: leader ? `Líder: ${leader.nombre.trim()} ${leader.apellido.trim()}` : 'Líder', cls: 'gold' },
    { val: totalTournaments, lbl: 'Participaciones', cls: '' },
    { val: avgTournaments, lbl: 'Torneos prom. p/jugador', cls: 'success' },
    { val: totalPointsSum, lbl: 'Puntos totales', cls: 'accent' },
  ].forEach(k => {
    const d = document.createElement('div');
    d.className = 'kpi ' + k.cls;
    d.innerHTML = `<div class="val">${k.val}</div><div class="lbl">${k.lbl}</div>`;
    kpisEl.appendChild(d);
  });

  // filtro búsqueda
  const search = (document.getElementById('rankSearch').value || '').toLowerCase().trim();
  const ranked = computeRanks(players);
  let filtered = ranked;
  if (search) {
    filtered = ranked.filter(p => {
      const hay = [p.nombre, p.apellido, p.dni, `${p.nombre} ${p.apellido}`].join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="ranking-empty">
      <div class="icon">🔎</div>
      <strong>Sin coincidencias</strong>
      <p>Ningún jugador matchea la búsqueda "${search}".</p>
    </div>`;
    captionEl.textContent = `${ranked.length} jugadores en total`;
    return;
  }

  const rowsHtml = filtered.map(p => {
    const dni = p.dni || '—';
    const isExpanded = rankingExpanded.has(dni);
    const gender = guessGenderFromCategoria(p.categoria);
    const genderPill = gender ? `<span class="pill ${gender}" style="margin-left:6px">${gender}</span>` : '';
    const fullName = `${(p.nombre || '').trim()} ${(p.apellido || '').trim()}`.trim() || '—';

    const bestInst = maxInstance(p.pointsHistory);
    let bestInstCell;
    if (bestInst) {
      const suffix = bestInst.count > 1 ? ` (${bestInst.count})` : '';
      bestInstCell = `<span class="pill ${positionPillClass(bestInst.label)}">${bestInst.label}${suffix}</span>`;
    } else {
      bestInstCell = `<span class="empty-cell">—</span>`;
    }

    const mainRow = `
      <tr class="rank-row ${isExpanded ? 'expanded' : ''}" data-dni="${dni}" onclick="toggleRankingRow('${dni}')">
        <td>${rankBadgeHtml(p._rank)}</td>
        <td>
          <div style="font-weight:600;color:var(--text-primary);font-size:13px">${fullName}</div>
          <div class="mono" style="font-size:10px">DNI ${dni}</div>
        </td>
        <td>${p.categoria || '—'}${genderPill}</td>
        <td><span class="rank-points">${p.totalPoints ?? 0}</span></td>
        <td><span class="rank-tournaments">${p.tournamentsPlayed ?? 0}</span></td>
        <td>${bestInstCell}</td>
        <td style="text-align:right"><span class="chevron">▶</span></td>
      </tr>
    `;

    const detailRow = `
      <tr class="rank-detail-row" data-dni-detail="${dni}" ${isExpanded ? '' : 'style="display:none"'}>
        <td colspan="7">
          <div class="rank-detail-inner">
            <div class="detail-title">Historial de puntos · ${p.tournamentsPlayed ?? 0} torneo${(p.tournamentsPlayed ?? 0) === 1 ? '' : 's'}</div>
            ${renderPointsHistory(p.pointsHistory || [])}
          </div>
        </td>
      </tr>
    `;

    return mainRow + detailRow;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="no-sort" style="width:56px">#</th>
            <th class="no-sort">Jugador</th>
            <th class="no-sort">Categoría</th>
            <th class="no-sort">Puntos</th>
            <th class="no-sort">Torneos</th>
            <th class="no-sort">Instancia máxima</th>
            <th class="no-sort" style="width:40px"></th>
          </tr>
        </thead>
        <tbody id="rankBody">${rowsHtml}</tbody>
      </table>
    </div>
  `;

  captionEl.textContent = `${filtered.length} de ${ranked.length} jugadores · ordenados por puntaje total`;
  syncExpandAllButton();
}

function renderPointsHistory(history) {
  if (!history || history.length === 0) {
    return `<div class="history-empty">Sin historial de participación disponible.</div>`;
  }
  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  const rows = sorted.map(h => {
    const posClass = positionPillClass(h.position);
    const doublePts = h.isDoublePoints ? `<span class="pill doublepoints">×2</span>` : '';
    // El tc_id puede venir con distintos nombres según serializer; probamos varios
    const tcId = h.tournament_category_id ?? h.tournamentCategoryId ?? h.tc_id ?? '';
    const tid  = h.tournament_id ?? h.tournamentId ?? '';
    const cid  = currentRankingCategoryId ?? '';
    const dateStr = fmtDate(h.date, false);
    const canOpen = tcId || (tid && cid);
    return `
      <tr class="${canOpen ? 'history-row-clickable' : ''}"
          ${canOpen ? `onclick="openBracketFromHistory(this)"` : ''}
          data-tc-id="${tcId}"
          data-tid="${tid}"
          data-cid="${cid}"
          data-category="${(h.category || '').replace(/"/g,'&quot;')}"
          data-date="${dateStr}"
          title="${canOpen ? 'Click para ver el cuadro de playoff' : ''}">
        <td class="history-date">${dateStr}</td>
        <td><span class="pill ${posClass}">${h.position || '—'}</span></td>
        <td><span class="mono">${h.category || '—'}</span></td>
        <td><span class="history-points">+${h.points ?? 0}</span>${doublePts}</td>
      </tr>
    `;
  }).join('');
  return `
    <table class="history-table">
      <thead>
        <tr>
          <th style="width:110px">Fecha</th>
          <th>Posición</th>
          <th style="width:100px">Categoría</th>
          <th style="width:110px">Puntos</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ============ ACORDEÓN ============

function toggleRankingRow(dni) {
  if (rankingExpanded.has(dni)) {
    rankingExpanded.delete(dni);
  } else {
    rankingExpanded.add(dni);
  }
  // toggle sin re-render completo (más suave)
  const row = document.querySelector(`.rank-row[data-dni="${dni}"]`);
  const detail = document.querySelector(`.rank-detail-row[data-dni-detail="${dni}"]`);
  if (row && detail) {
    const nowExpanded = rankingExpanded.has(dni);
    row.classList.toggle('expanded', nowExpanded);
    detail.style.display = nowExpanded ? '' : 'none';
  }
  syncExpandAllButton();
}

function toggleAllRankingRows() {
  const cached = currentRankingCategoryId != null ? rankingCache[currentRankingCategoryId] : null;
  if (!cached) return;
  const search = (document.getElementById('rankSearch').value || '').toLowerCase().trim();
  const players = computeRanks(cached.data).filter(p => {
    if (!search) return true;
    const hay = [p.nombre, p.apellido, p.dni, `${p.nombre} ${p.apellido}`].join(' ').toLowerCase();
    return hay.includes(search);
  });
  const allExpanded = players.length > 0 && players.every(p => rankingExpanded.has(p.dni));
  if (allExpanded) {
    players.forEach(p => rankingExpanded.delete(p.dni));
  } else {
    players.forEach(p => rankingExpanded.add(p.dni));
  }
  renderRanking();
}

function syncExpandAllButton() {
  const btn = document.getElementById('rankExpandAllBtn');
  const cached = currentRankingCategoryId != null ? rankingCache[currentRankingCategoryId] : null;
  if (!cached || !cached.data.length) {
    btn.textContent = '⤢ Expandir todo';
    return;
  }
  const search = (document.getElementById('rankSearch').value || '').toLowerCase().trim();
  const players = cached.data.filter(p => {
    if (!search) return true;
    const hay = [p.nombre, p.apellido, p.dni, `${p.nombre} ${p.apellido}`].join(' ').toLowerCase();
    return hay.includes(search);
  });
  const allExpanded = players.length > 0 && players.every(p => rankingExpanded.has(p.dni));
  btn.textContent = allExpanded ? '⤡ Colapsar todo' : '⤢ Expandir todo';
}