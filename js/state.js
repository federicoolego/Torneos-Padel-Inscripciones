/**
 * Estado global compartido por todos los archivos.
 * Se declara UNA sola vez acá; el resto de los .js sólo lee/escribe.
 */

// ---- Vista TORNEO ----
let raw = null;                      // JSON crudo del torneo cargado
let cats = [];                       // raw.data.categories, ordenadas por rank
let sortKey = 'rank';                // columna activa de ordenamiento
let sortDir = 1;                     // 1 asc, -1 desc

// ---- Cache de equipos (persistente en localStorage) ----
let teamCache = {};                  // { [teamId]: { id, dni1, dni2, p1, p2 } }

// ---- Preload modal ----
let preloadCancelled = false;

// ---- Navegación ----
let currentView = 'tournament';      // 'tournament' | 'ranking'

// ---- Vista RANKING (independiente del torneo) ----
let categoriesList = null;           // cache de GET /api/categories, [{id, name, gender, rank, ...}, ...]
let rankingCache = {};               // { [categoryId]: { data, fetchedAt } }
let currentRankingCategoryId = null; // categoryId seleccionado actualmente
let rankingExpanded = new Set();     // DNIs con acordeón abierto
