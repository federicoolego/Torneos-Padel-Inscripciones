/**
 * Cliente HTTP para circuitopm.ar.
 * Lee el base URL y el bearer token desde el DOM (inputs de la api-bar),
 * que siguen accesibles aunque la barra esté oculta con display:none.
 */

function apiHeaders() {
  const h = { 'Accept': 'application/json' };
  const t = document.getElementById('bearerToken').value.trim();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

function apiBase() {
  return document.getElementById('baseUrl').value.trim().replace(/\/$/, '');
}

async function apiGet(path) {
  const url = apiBase() + path;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} en ${path}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Muestra un error en el errorBox global con pistas según el tipo de fallo.
 */
function showError(err, path) {
  const box = document.getElementById('errorBox');
  const msg = err.message || String(err);
  const status = err.status;
  let hint = '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
    hint = `<ul>
      <li><strong>CORS:</strong> el server bloquea requests desde este origen. Si abriste con doble-click, servilo desde http://localhost o desde el mismo dominio.</li>
      <li><strong>Auth:</strong> puede faltar el Bearer token.</li>
    </ul>`;
  } else if (status === 401 || status === 403) {
    hint = `<p><strong>Bearer token inválido o expirado.</strong> Pegá uno nuevo en la barra superior y volvé a hacer clic en <em>Cargar</em>.</p>`;
  } else if (status === 404) {
    hint = `<p>Torneo o recurso inexistente.</p>`;
  }
  box.innerHTML = `<h3>⚠ Error</h3><p><strong>Path:</strong> <code>${path}</code></p><p><strong>Error:</strong> <code>${msg}</code></p>${hint}`;
  box.classList.remove('hidden');
}
