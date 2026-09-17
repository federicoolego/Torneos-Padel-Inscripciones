/**
 * Vista Torneo: fetch principal, KPIs, tabla de categorías y de parejas inscriptas.
 * También dispara el enriquecimiento del teamCache tras cargar un torneo.
 */

async function fetchTournament() {
  saveToken(); saveBase(); saveTid();
  const id = document.getElementById('tournamentId').value.trim();
  if (!id) return;

  const statusEl = document.getElementById('apiStatus');
  const btn = document.getElementById('fetchBtn');
  const errorBox = document.getElementById('errorBox');

  btn.disabled = true;
  statusEl.className = 'status loading';
  statusEl.innerHTML = '<span class="spinner"></span>Cargando torneo...';
  errorBox.classList.add('hidden');

  try {
    const data = await apiGet(`/api/tournaments/${id}`);
    if (!data.data || !data.data.categories) throw new Error('El JSON no tiene la estructura esperada.');
    raw = data;
    renderAll();
    document.getElementById('mainContent').classList.remove('hidden');

    statusEl.innerHTML = '<span class="spinner"></span>Enriqueciendo equipos...';
    let enriched = 0;
    const jobs = raw.data.categories.map(async tc => {
      try {
        const s = await apiGet(`/api/tournament-categories/standings?tournament_category_id=${tc.id}`);
        enriched += absorbTeamsFromStandings(s);
      } catch { /* la categoría no tiene zonas → ignorar */ }
    });
    await Promise.all(jobs);
    if (enriched > 0) saveCache();
    renderRegistrations();

    statusEl.className = 'status ok';
    statusEl.textContent = `✓ OK (${enriched} teams nuevos) · ${new Date().toLocaleTimeString('es-AR')}`;
  } catch (err) {
    showError(err, `/api/tournaments/${id}`);
    statusEl.className = 'status error';
    statusEl.textContent = '✗ Error';
  } finally {
    btn.disabled = false;
  }
}

function renderHeader() {
  const d = raw.data;
  document.getElementById('t-name').textContent = d.nombre || 'Torneo sin nombre';
  document.getElementById('t-desc').textContent = d.descripcion || '';
  const estadoClass = 'estado-' + (d.estado || '').replace(/\s+/g, '-');
  const meta = document.getElementById('t-meta');
  meta.innerHTML = '';
  [
    { html: `📅 ${fmtDateRange(d.fecha_inicio, d.fecha_fin)}`, cls: '' },
    { html: `Estado: ${d.estado || '—'}`, cls: estadoClass },
    { html: `Double points: ${d.double_points ? '✓ Sí' : '✗ No'}`, cls: '' },
    { html: `ID: #${d.id}`, cls: '' },
  ].forEach(p => {
    const b = document.createElement('span');
    b.className = 'badge ' + p.cls;
    b.innerHTML = p.html;
    meta.appendChild(b);
  });
}

function renderKpis() {
  const totalCats = cats.length;
  const totalRegs = cats.reduce((s, c) => s + c.registrations.length, 0);
  const totalCupo = cats.reduce((s, c) => s + c.cupo, 0);
  const openCats = cats.filter(c => c.inscripcion_abierta).length;
  const damasRegs = cats.filter(c => c.category.gender === 'damas').reduce((s, c) => s + c.registrations.length, 0);
  const cabRegs = totalRegs - damasRegs;
  const ocupPct = totalCupo ? Math.round((totalRegs / totalCupo) * 100) : 0;
  const kpiEl = document.getElementById('kpis');
  kpiEl.innerHTML = '';
  [
    { val: totalCats, lbl: 'Categorías', cls: '' },
    { val: totalRegs, lbl: 'Inscriptos totales', cls: 'accent' },
    { val: cabRegs, lbl: 'Caballeros', cls: 'accent' },
    { val: damasRegs, lbl: 'Damas', cls: 'damas-c' },
    { val: totalCupo, lbl: 'Cupo total', cls: '' },
    { val: ocupPct + '%', lbl: 'Ocupación', cls: 'success' },
    { val: openCats, lbl: 'Inscripción abierta', cls: 'success' },
  ].forEach(k => {
    const d = document.createElement('div');
    d.className = 'kpi ' + k.cls;
    d.innerHTML = `<div class="val">${k.val}</div><div class="lbl">${k.lbl}</div>`;
    kpiEl.appendChild(d);
  });
}

function sortBy(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = 1; }
  // scopeado a mainContent para no pisar cabeceras del ranking
  document.querySelectorAll('#mainContent thead th').forEach(th => th.classList.remove('sorted'));
  const el = document.getElementById('th-' + key);
  if (el) el.classList.add('sorted');
  renderTable();
}

function renderTable() {
  if (!cats.length) return;
  const search = document.getElementById('searchInput').value.toLowerCase();
  const openF = document.getElementById('openFilter').value;
  const catSel = document.getElementById('catNameFilter');
  const catF = catSel?.value || '';

  // Poblar el <select> de categorías preservando la selección actual
  if (catSel) {
    const prev = catSel.value;
    const opts = ['<option value="">Todas las categorías</option>'];
    [...cats]
      .sort((a, b) => (a.category.rank || 0) - (b.category.rank || 0))
      .forEach(c => {
        const label = `${c.category.name} (${c.category.gender})`;
        opts.push(`<option value="${c.id}">${label}</option>`);
      });
    catSel.innerHTML = opts.join('');
    if (prev && cats.some(c => String(c.id) === String(prev))) {
      catSel.value = prev;
    }
  }

  let rows = cats.map(c => ({
    name: c.category.name, gender: c.category.gender, rank: c.category.rank,
    inscriptions: c.registrations.length, cupo: c.cupo, open: c.inscripcion_abierta,
    format: c.match_format, id: c.id,
  }));
  if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search) || r.gender.toLowerCase().includes(search));
  if (catF) rows = rows.filter(r => String(r.id) === String(catF));
  if (openF === 'open') rows = rows.filter(r => r.open);
  if (openF === 'closed') rows = rows.filter(r => !r.open);
  rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });
  const tbody = document.getElementById('catBody');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Sin coincidencias.</td></tr>';
  } else {
    rows.forEach(r => {
      const pct = r.cupo ? Math.round((r.inscriptions / r.cupo) * 100) : 0;
      const barW = Math.min(pct, 100);
      const tr = document.createElement('tr');
      tr.className = 'cat-row-clickable';
      tr.title = 'Click para ver el cuadro de playoff';
      tr.onclick = () => openBracketModal(r.id, {
        title: `Cuadro · ${r.name} (${r.gender})`,
        subtitle: raw?.data?.nombre ? `${raw.data.nombre}` : `Torneo #${document.getElementById('tournamentId').value}`
      });
      tr.innerHTML = `
        <td><strong>${r.name}</strong> <span class="pill ${r.gender}" style="margin-left:4px">${r.gender}</span></td>
        <td><span class="reg-count">${r.inscriptions}</span></td>
        <td><span class="cupo-num">${r.cupo}</span></td>
        <td><span class="bar-wrap"><span class="bar-fill ${barClass(pct)}" style="width:${barW}%"></span></span><span class="pct-label">${pct}%</span></td>
        <td><span class="pill ${r.open ? 'open' : 'closed'}">${r.open ? 'Abierta' : 'Cerrada'}</span></td>
        <td class="format-cell">${r.format.replace(/_/g,' ')}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  const totalRegs = cats.reduce((s, c) => s + c.registrations.length, 0);
  document.getElementById('caption').textContent = `${rows.length} de ${cats.length} categorías · ${totalRegs} inscripciones totales`;
}

function renderPlayers(teamId) {
  const t = teamCache[teamId];
  if (!t) {
    return `<div class="players unknown">
      <span class="team-tag">Team #${teamId}</span>
      <span class="p-name">— sin datos —</span>
      <span class="p-dni">Precargá el cache para resolver</span>
    </div>`;
  }
  return `<div class="players">
    <span class="team-tag">Team #${teamId}</span>
    <span class="p-name">${t.p1 || '—'}</span>
    <span class="p-dni">DNI ${t.dni1 || '—'}</span>
    <span class="p-name" style="margin-top:2px">${t.p2 || '—'}</span>
    <span class="p-dni">DNI ${t.dni2 || '—'}</span>
  </div>`;
}

function renderRegistrations() {
  const regBody = document.getElementById('regBody');
  regBody.innerHTML = '';
  const search = (document.getElementById('regSearch')?.value || '').toLowerCase();
  const resolvedF = document.getElementById('regResolvedFilter')?.value || '';
  const catSel = document.getElementById('regCategoryFilter');
  const catF = catSel?.value || '';

  // Poblar el <select> de categorías preservando la selección actual
  if (catSel) {
    const prev = catSel.value;
    const opts = ['<option value="">Todas las categorías</option>'];
    cats.forEach(c => {
      const label = `${c.category.name} ${c.category.gender}`;
      opts.push(`<option value="${c.category.id}">${label}</option>`);
    });
    catSel.innerHTML = opts.join('');
    // Restaurar selección si sigue existiendo
    if (prev && cats.some(c => String(c.category.id) === String(prev))) {
      catSel.value = prev;
    }
  }

  let allRegs = [];
  cats.forEach(c => c.registrations.forEach(r => allRegs.push({ ...r, cat: c.category })));

  if (catF) allRegs = allRegs.filter(r => String(r.cat.id) === String(catF));
  if (resolvedF === 'resolved') allRegs = allRegs.filter(r => teamCache[r.team_id]);
  if (resolvedF === 'unresolved') allRegs = allRegs.filter(r => !teamCache[r.team_id]);
  if (search) {
    allRegs = allRegs.filter(r => {
      const t = teamCache[r.team_id];
      const hay = [r.cat.name, r.team_id, t?.p1, t?.p2, t?.dni1, t?.dni2].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    });
  }
  allRegs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (allRegs.length === 0) {
    regBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Sin inscripciones para mostrar.</td></tr>';
    return;
  }

  allRegs.forEach(r => {
    const tr = document.createElement('tr');
    const problems = r.schedule_problems ? `<span class="schedule-cell">${r.schedule_problems}</span>` : `<span class="empty-cell">—</span>`;
    tr.innerHTML = `
      <td class="mono">#${r.id}</td>
      <td><strong>${r.cat.name}</strong> <span class="pill ${r.cat.gender}" style="margin-left:4px">${r.cat.gender}</span></td>
      <td>${renderPlayers(r.team_id)}</td>
      <td><span class="pill ${r.estado}">${r.estado}</span></td>
      <td>${problems}</td>
      <td class="mono" style="white-space:nowrap">${fmtDate(r.created_at, true)}</td>
    `;
    regBody.appendChild(tr);
  });
}

function renderAll() {
  cats = raw.data.categories || [];
  cats.sort((a, b) => a.category.rank - b.category.rank);
  renderHeader();
  renderKpis();
  renderTable();
  renderRegistrations();
  document.title = `${raw.data.nombre} · Circuito PM`;
}