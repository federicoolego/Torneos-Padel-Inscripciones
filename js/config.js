/**
 * Constantes globales de la app.
 * NOTA: el hash de auth NO es seguridad real (cliente-side, cualquiera puede
 * hacer fuerza bruta). Sirve como cortina para casuales/bots.
 */

const AUTH_HASH = 'abb4f04275be6363adddb2edf8852d83f7cfce79795251facdaf660058e8c533';
const AUTH_TTL_MS = 1000 * 60 * 60 * 24 * 7; // sesión válida 7 días

// localStorage keys
const LS_AUTH       = 'circuitopm_auth_v1';
const LS_TOKEN      = 'circuitopm_token';
const LS_CACHE      = 'circuitopm_team_cache';
const LS_CACHE_DATE = 'circuitopm_cache_date';
const LS_BASE       = 'circuitopm_base_url';
const LS_TID        = 'circuitopm_tournament_id';

/**
 * Orden jerárquico de instancias (mejor → peor).
 * Se compara case-insensitive y con startsWith en maxInstance() para tolerar
 * variantes ("Zona A", "Zona 3", etc.).
 */
const INSTANCE_ORDER = ['Campeón', 'Subcampeón', 'Semifinal', 'Cuartos de Final', 'Octavos de Final', 'Zona'];
