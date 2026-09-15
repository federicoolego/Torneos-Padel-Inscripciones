/**
 * Login gate cliente-side. NO es seguridad: sirve como cortina para bots
 * y accesos casuales. Cualquiera con las devtools puede bypassear.
 */

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthed() {
  try {
    const raw = localStorage.getItem(LS_AUTH);
    if (!raw) return false;
    const { hash, ts } = JSON.parse(raw);
    if (hash !== AUTH_HASH) return false;
    if (Date.now() - ts > AUTH_TTL_MS) return false;
    return true;
  } catch { return false; }
}

function showApp() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  loadFromStorage();
  fetchTournament();
}

function logout() {
  localStorage.removeItem(LS_AUTH);
  location.reload();
}

// El listener del form se registra acá porque el <script> se carga con el DOM
// ya parseado (está al final del <body>). Si algún día movés los scripts al
// <head>, envolvé este bloque en DOMContentLoaded.
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Verificando...';
  try {
    const hash = await sha256Hex(`${user}:${pass}`);
    if (hash === AUTH_HASH) {
      localStorage.setItem(LS_AUTH, JSON.stringify({ hash, ts: Date.now() }));
      showApp();
    } else {
      errEl.textContent = 'Usuario o contraseña incorrectos.';
      errEl.classList.remove('hidden');
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }
  } catch (err) {
    errEl.textContent = 'Error verificando credenciales.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});
