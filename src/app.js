'use strict';
/* ===================== Utilidades ===================== */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (arr, n) => shuffle(arr).slice(0, n);
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}@]+/gu, ' ').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }

/* ===================== Estado ===================== */
const DAY = 86400000;
const BOX_DAYS = [0, 1, 3, 7, 14];
const state = { packs: [], packId: null, prog: {}, runId: 0, caps: { sample: undefined, downloads: undefined }, capsReady: null };
// Juego en curso: al salir a cualquier otra pantalla se retira su escucha de teclado (si no, las teclas seguían respondiendo a la ronda abandonada).

let activeShell = null; let funMounted = false;
function leaveGame() {
  if (activeShell) { const s = activeShell; activeShell = null; s.destroy(); }
  if (funMounted) { funMounted = false; try { if (window.FUN && typeof window.FUN.unmount === 'function') window.FUN.unmount(); } catch (e) { console.error(e); } }
}


function normalizePack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = {
    id: String(raw.id || ('pack-' + Date.now().toString(36))),
    title: String(raw.title || 'Tema sin título').slice(0, 120),
    subtitle: String(raw.subtitle || '').slice(0, 200),
    source: String(raw.source || '').slice(0, 160),
    builtin: !!raw.builtin,
    created: raw.created || Date.now(),
    sections: [], concepts: [], questions: [], tf: [], cloze: [], sort: [], order: [], explain: []
  };
  const secsRaw = Array.isArray(raw.sections) ? raw.sections : [];
  p.sections = secsRaw.map((s, i) => ({ id: (s && s.id) ? String(s.id) : 's' + (i + 1), name: String((s && (s.name || s.title)) || s || ('Sección ' + (i + 1))).slice(0, 60) })).filter(s => s.name);
  if (!p.sections.length) p.sections = [{ id: 's1', name: 'General' }];
  const secIndex = new Map(p.sections.map((s, i) => [s.id, s.id]));
  const secByName = new Map(p.sections.map(s => [norm(s.name), s.id]));
  const sec = (v) => {
    if (v == null) return p.sections[0].id;
    if (typeof v === 'number') return (p.sections[v] || p.sections[v - 1] || p.sections[0]).id;
    const s = String(v); if (secIndex.has(s)) return s;
    const n = secByName.get(norm(s)); if (n) return n;
    const num = parseInt(s, 10); if (!isNaN(num) && p.sections[num - 1]) return p.sections[num - 1].id;
    for (const [k, id] of secByName) { if (k && (norm(s).includes(k) || k.includes(norm(s)))) return id; }
    return p.sections[0].id;
  };
  const str = (v, max = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const arr = (v) => Array.isArray(v) ? v : [];
  arr(raw.concepts).forEach((c, i) => { if (!c) return; const term = str(c.term || c.t, 90), def = str(c.def || c.d || c.definition); if (term && def) p.concepts.push({ id: 'k' + (i + 1), sec: sec(c.sec), term, def }); });
  arr(raw.questions).forEach((q, i) => {
    if (!q) return; const text = str(q.q || q.question, 300); let options = arr(q.options).map(o => str(o, 160)).filter(Boolean); let a = Number(q.a ?? q.answer ?? 0);
    if (typeof q.a === 'string' && isNaN(Number(q.a))) { const idx = options.findIndex(o => norm(o) === norm(q.a)); a = idx >= 0 ? idx : 0; }
    options = Array.from(new Set(options)); if (!text || options.length < 2 || !(a >= 0 && a < options.length)) return;
    p.questions.push({ id: 'q' + (i + 1), sec: sec(q.sec), q: text, options: options.slice(0, 5), a: Math.min(a, 4), why: str(q.why || q.explain || q.explanation, 300) });
  });
  arr(raw.tf).forEach((t, i) => { if (!t) return; const s = str(t.s || t.statement, 300); const a = typeof t.a === 'string' ? /^(v|true|verdadero|sí|si)/i.test(t.a) : !!(t.a ?? t.answer); if (s) p.tf.push({ id: 't' + (i + 1), sec: sec(t.sec), s, a, why: str(t.why || t.explain, 300) }); });
  arr(raw.cloze).forEach((c, i) => { if (!c) return; let text = str(c.text || c.t, 300); const answer = str(c.answer || c.a, 60); if (!text || !answer) return; if (!text.includes('___')) { const re = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); if (!re.test(text)) return; text = text.replace(re, '___'); } p.cloze.push({ id: 'c' + (i + 1), sec: sec(c.sec), text, answer, alt: arr(c.alt).map(x => str(x, 60)).filter(Boolean), hint: str(c.hint, 120) }); });
  arr(raw.sort).forEach((s, i) => { if (!s) return; const cats = arr(s.cats || s.categories).map(x => str(x, 60)).filter(Boolean).slice(0, 4); const items = arr(s.items).map(it => { if (!it) return null; const t = str(it.t || it.text, 160); let c = it.c ?? it.cat; if (typeof c === 'string' && isNaN(Number(c))) { const idx = cats.findIndex(x => norm(x) === norm(c)); c = idx; } c = Number(c); return (t && c >= 0 && c < cats.length) ? { t, c } : null; }).filter(Boolean); if (cats.length >= 2 && items.length >= 3) p.sort.push({ id: 's' + (i + 1), sec: sec(s.sec), title: str(s.title, 120) || 'Clasifica', cats, items }); });
  arr(raw.order).forEach((o, i) => { if (!o) return; const steps = arr(o.steps).map(x => str(x, 160)).filter(Boolean); if (steps.length >= 3) p.order.push({ id: 'o' + (i + 1), sec: sec(o.sec), title: str(o.title, 120) || 'Ordena los pasos', steps: steps.slice(0, 8) }); });
  arr(raw.explain).forEach((e, i) => { if (!e) return; const q = str(e.q || e.question, 300), model = str(e.model || e.answer || e.a, 700); if (q && model) p.explain.push({ id: 'e' + (i + 1), sec: sec(e.sec), q, model }); });
  const total = p.concepts.length + p.questions.length + p.tf.length + p.cloze.length + p.sort.length + p.order.length + p.explain.length;
  return total >= 4 ? p : null;
}
function loadState() {
  const custom = LS.get('ra.packs', []);
  state.packs = [normalizePack(PACK_TEMA2), ...custom.map(normalizePack).filter(Boolean)].filter(Boolean);
  state.packId = LS.get('ra.packId', state.packs[0].id);
  if (!state.packs.find(p => p.id === state.packId)) state.packId = state.packs[0].id;
  loadProg();
}
function saveCustomPacks() { LS.set('ra.packs', state.packs.filter(p => !p.builtin)); }
function loadProg() { state.prog = LS.get('ra.prog.' + state.packId, {}); }
function saveProg() { LS.set('ra.prog.' + state.packId, state.prog); }
function pack() { return state.packs.find(p => p.id === state.packId); }
function setPack(id) { if (!state.packs.find(p => p.id === id)) return; state.packId = id; LS.set('ra.packId', id); loadProg(); fillPackSelect(); }
function secName(id) { const s = pack().sections.find(s => s.id === id); return s ? s.name : ''; }

/* ---- Repaso espaciado (cajas tipo Leitner compartidas por todos los juegos) ---- */
function rec(id) { return state.prog[id] || (state.prog[id] = { box: 0, due: 0, seen: 0, ok: 0, ko: 0, last: 0 }); }
function grade(id, result) {
  const r = rec(id); r.seen++; r.last = Date.now();
  if (result === true || result === 'ok') { r.ok++; r.box = Math.min(r.box + 1, 4); }
  else if (result === 'partial') { /* se mantiene la caja */ }
  else { r.ko++; r.box = 0; }
  r.due = Date.now() + BOX_DAYS[r.box] * DAY;
  saveProg(); markDay();
}
function weight(id) {
  const r = state.prog[id]; if (!r || !r.seen) return 2.5;
  if (r.due <= Date.now()) return r.box === 0 ? 6 : 4;
  return r.box >= 4 ? 0.4 : 1;
}
function pick(items, n) {
  const pool = items.map(it => ({ it, w: weight(it.id) })); const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0); let r = Math.random() * total; let i = 0;
    for (; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) break; }
    i = Math.min(i, pool.length - 1); out.push(pool[i].it); pool.splice(i, 1);
  }
  return out;
}
function allItems(p = pack()) { return [...p.concepts, ...p.questions, ...p.tf, ...p.cloze, ...p.sort, ...p.order, ...p.explain]; }
function mastery(items) { if (!items.length) return 0; let s = 0; for (const it of items) { const r = state.prog[it.id]; s += r ? r.box / 4 : 0; } return s / items.length; }
function dueCount(items) { const now = Date.now(); return items.filter(it => { const r = state.prog[it.id]; return r && r.seen && r.due <= now; }).length; }
const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function markDay() { const d = dayKey(new Date()); const days = LS.get('ra.days', []); if (!days.includes(d)) { days.push(d); LS.set('ra.days', days.slice(-400)); } }
function dayStreak() {
  const days = new Set(LS.get('ra.days', [])); let n = 0; const d = new Date();
  for (; ;) { const k = dayKey(d); if (days.has(k)) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
function bestKey(game) { return 'ra.best.' + state.packId + '.' + game; }


/* ===================== Iconos (SVG en línea, rejilla de 24 px, trazo de 1.75) ===================== */
const ICONS = {
  quiz: '<path d="M4 7h16M4 12h10M4 17h7"/><path d="M15 16l2 2 4-4"/>',
  cloze: '<path d="M4 20h16"/><path d="M14.5 4.5l5 5L9 20H4v-5z"/>',
  tf: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/><path d="M5.5 12l1.5 1.5 3-3.5"/><path d="M15 10.5l3 3M18 10.5l-3 3"/>',
  match: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="18" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><circle cx="18" cy="17.5" r="2.5"/><path d="M8.5 6.5h7M8.5 17.5h7"/>',
  sort: '<path d="M12 4v5"/><path d="M4 20v-5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5"/><path d="M12 12v8"/>',
  order: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  cards: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h14v13"/>',
  explain: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  mix: '<path d="M3 7h4l10 10h4"/><path d="M3 17h4l10-10h4"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-3"/>'
};
function icon(name, cls) { return el('span', { class: 'ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24">' + (ICONS[name] || '') + '</svg>' }); }

/* ===================== Color de acento y modo claro/oscuro ===================== */
// Los valores reales viven en el CSS (:root[data-accent]); esta tabla solo pinta las muestras del selector.
const ACCENTS = [
  { key: 'tinta', name: 'Tinta', light: '#2B40D4', dark: '#9DA8FF' },
  { key: 'petroleo', name: 'Petróleo', light: '#0E7C86', dark: '#4FC6CF' },
  { key: 'ciruela', name: 'Ciruela', light: '#7A2E8E', dark: '#D39AE3' },
  { key: 'naranja', name: 'Naranja', light: '#B5500F', dark: '#F6A062' },
  { key: 'carbon', name: 'Carbón', light: '#1A1813', dark: '#ECE7DC' }
];
const MODES = [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']];
const theme = { accent: LS.get('ra.accent', 'tinta'), mode: LS.get('ra.mode', 'system') };
function isDark() { const h = document.documentElement; if (h.dataset.theme === 'dark') return true; if (h.dataset.theme === 'light') return false; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function applyTheme() {
  const h = document.documentElement;
  if (!ACCENTS.find(a => a.key === theme.accent)) theme.accent = 'tinta';
  if (!MODES.find(m => m[0] === theme.mode)) theme.mode = 'system';
  h.setAttribute('data-accent', theme.accent);
  if (theme.mode === 'light' || theme.mode === 'dark') h.setAttribute('data-theme', theme.mode); else h.removeAttribute('data-theme');
  LS.set('ra.accent', theme.accent); LS.set('ra.mode', theme.mode);
  renderThemePanel();
  document.dispatchEvent(new CustomEvent('themechange', { detail: { accent: theme.accent, mode: theme.mode, dark: isDark() } }));
}
// Colores resueltos (rgb) para quien pinte en canvas; se vuelven a leer en cada evento themechange.
function colors() {
  const probe = el('span', { style: 'position:absolute;visibility:hidden;pointer-events:none' }); document.body.append(probe); const out = {};
  for (const k of ['paper', 'surface', 'surface-2', 'ink', 'ink-2', 'line', 'line-2', 'accent', 'accent-ink', 'accent-soft', 'ok', 'ok-soft', 'ko', 'ko-soft', 'warn', 'warn-soft']) { probe.style.color = 'var(--' + k + ')'; out[k] = getComputedStyle(probe).color; }
  probe.remove(); return out;
}
function renderThemePanel() {
  const panel = $('#themePanel'); if (!panel) return; panel.replaceChildren();
  const dark = isDark();
  const sw = el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Color' });
  for (const a of ACCENTS) sw.append(el('button', { class: 'sw' + (a.key === theme.accent ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': a.key === theme.accent ? 'true' : 'false', title: a.name, 'aria-label': a.name, style: '--sw:' + (dark ? a.dark : a.light), onclick: () => { theme.accent = a.key; applyTheme(); } }));
  const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Modo' });
  for (const [k, label] of MODES) seg.append(el('button', { class: k === theme.mode ? 'on' : '', type: 'button', role: 'radio', 'aria-checked': k === theme.mode ? 'true' : 'false', text: label, onclick: () => { theme.mode = k; applyTheme(); } }));
  panel.append(el('div', { class: 'tpRow' }, el('span', { class: 'tpL', text: 'Color' }), sw), el('div', { class: 'tpRow' }, el('span', { class: 'tpL', text: 'Modo' }), seg));
}
function toggleThemePanel(force) {
  const panel = $('#themePanel'); const btn = $('#themeBtn'); const open = typeof force === 'boolean' ? force : panel.hidden;
  panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ===================== Cabecera y navegación ===================== */
function fillPackSelect() {
  const sel = $('#packSel'); if (!sel) return; sel.replaceChildren();
  for (const p of state.packs) sel.append(el('option', { value: p.id, selected: p.id === state.packId }, p.title));
}
function setNav(key) { document.querySelectorAll('.navItem').forEach(b => { const on = b.dataset.nav === key; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
const VIEWS = { home: () => renderHome(), fun: () => renderFun(), packs: () => renderPacks(), why: () => renderWhy() };
document.querySelectorAll('.navItem').forEach(b => b.addEventListener('click', () => VIEWS[b.dataset.nav]()));
$('#brandBtn').addEventListener('click', () => renderHome());
$('#themeBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleThemePanel(); });
// composedPath se evalúa al despachar: aunque el botón pulsado se haya reconstruido, sigue contando como clic dentro del panel.
document.addEventListener('click', (e) => { const panel = $('#themePanel'); if (!panel.hidden && !(e.composedPath ? e.composedPath().includes(panel) : panel.contains(e.target))) toggleThemePanel(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const panel = $('#themePanel'); if (!panel.hidden) { toggleThemePanel(false); $('#themeBtn').focus(); } } });

/* ===================== Inicio ===================== */
const GAME_DEFS = [
  { key: 'quiz', name: 'Test rápido', desc: 'Diez preguntas con cuatro opciones.', principle: 'Práctica de recuperación', needs: p => p.questions.length >= 4 },
  { key: 'cloze', name: 'Completa el hueco', desc: 'Escribe la palabra que falta.', principle: 'Efecto de generación', needs: p => p.cloze.length >= 3 },
  { key: 'tf', name: 'Verdadero o falso', desc: 'Afirmaciones con trampa y su porqué.', principle: 'Recuperación con feedback', needs: p => p.tf.length >= 4 },
  { key: 'match', name: 'Empareja', desc: 'Cada término con su definición.', principle: 'Discriminación e intercalado', needs: p => p.concepts.length >= 4 },
  { key: 'sort', name: 'Clasifica', desc: 'Cada frase a su categoría.', principle: 'Intercalado de categorías', needs: p => p.sort.length >= 1 },
  { key: 'order', name: 'Ordena los pasos', desc: 'Un caso práctico, paso a paso.', principle: 'Conocimiento procedimental', needs: p => p.order.length >= 1 },
  { key: 'cards', name: 'Tarjetas', desc: 'Recuerda antes de girar.', principle: 'Repaso espaciado', needs: p => p.concepts.length >= 3 },
  { key: 'explain', name: 'Explícalo', desc: 'Un porqué con tus palabras.', principle: 'Interrogación elaborativa', needs: p => p.explain.length >= 1 }
];
function lastDays(n) { const days = new Set(LS.get('ra.days', [])); const out = []; const d = new Date(); d.setDate(d.getDate() - (n - 1)); for (let i = 0; i < n; i++) { out.push(days.has(dayKey(d))); d.setDate(d.getDate() + 1); } return out; }
// Las barras y el anillo se dibujan vacíos y se llenan en el siguiente fotograma, para que se vea la transición.
function growIn(root) { requestAnimationFrame(() => requestAnimationFrame(() => { root.querySelectorAll('[data-w]').forEach(b => { b.style.width = b.dataset.w + '%'; }); root.querySelectorAll('[data-off]').forEach(c => c.setAttribute('stroke-dashoffset', c.dataset.off)); })); }
function renderHome() {
  state.runId++; leaveGame(); setNav('home'); const p = pack(); const view = $('#view'); view.replaceChildren();
  const items = allItems(p); const m = Math.round(mastery(items) * 100); const due = dueCount(items); const streak = dayStreak();
  const seen = items.filter(it => state.prog[it.id] && state.prog[it.id].seen).length;
  const hero = el('section', { class: 'hero' }, el('h1', { text: p.title }), p.subtitle ? el('p', { class: 'sub', text: p.subtitle }) : null);
  if (state.packs.length > 1) {
    const sel = el('select', { id: 'packSel', class: 'packSel', 'aria-label': 'Tema de estudio' });
    sel.addEventListener('change', (e) => { setPack(e.target.value); renderHome(); });
    hero.append(el('div', { class: 'packPick' }, el('span', { class: 'label', text: 'Tema' }), sel));
  }
  view.append(hero); fillPackSelect();
  const daysEl = el('span', { class: 'days', title: 'Últimos siete días' }, lastDays(7).map(on => el('i', { class: on ? 'on' : '' })));
  view.append(el('section', { class: 'ledger', 'aria-label': 'Progreso' },
    el('div', { class: 'big' }, el('span', { class: 'n' }, String(m), el('small', { text: '%' })), el('span', { class: 'l', text: 'del tema dominado' })),
    el('ul', { class: 'facts' },
      el('li', {}, el('span', { class: 'k', text: 'Para hoy' }), el('span', { class: 'v' + (due ? ' due' : ''), text: String(due) })),
      el('li', {}, el('span', { class: 'k', text: 'Vistos' }), el('span', { class: 'v' }, seen + ' de ' + items.length, el('span', { class: 'mini' }, el('i', { 'data-w': Math.round(items.length ? seen / items.length * 100 : 0) })))),
      el('li', {}, el('span', { class: 'k', text: 'Racha' }), el('span', { class: 'v' }, streak + (streak === 1 ? ' día' : ' días'), daysEl))
    )));
  view.append(el('button', { class: 'cta', type: 'button', onclick: () => startGame('mix') },
    icon('mix'), el('span', { class: 't' }, el('b', { text: 'Ruleta' }), el('span', { class: 'd', text: 'Doce rondas con todos los juegos. Prioriza lo pendiente.' })), icon('arrow')));
  const grid = el('div', { class: 'games' });
  for (const g of GAME_DEFS) {
    const ok = g.needs(p); const best = LS.get(bestKey(g.key), null);
    grid.append(el('button', { class: 'game', type: 'button', disabled: !ok, onclick: () => startGame(g.key) },
      icon(g.key), el('span', { class: 't' }, el('b', { text: g.name }), el('span', { class: 'd', text: ok ? g.desc : 'Sin contenido en este tema.' })),
      el('span', { class: 'right' }, best ? el('span', { class: 'rec', text: 'récord ' + best }) : null, icon('chev', 'chev'))));
  }
  view.append(el('section', { class: 'block' }, el('div', { class: 'h' }, el('h2', { text: 'Juegos' })), grid));
  const secs = el('div', { class: 'secs' });
  for (const s of p.sections) {
    const its = items.filter(it => it.sec === s.id); if (!its.length) continue;
    const pct = Math.round(mastery(its) * 100);
    secs.append(el('div', { class: 'sec' }, el('span', { text: s.name }), el('div', { class: 'meter', role: 'img', 'aria-label': pct + '% dominado' }, el('i', { 'data-w': pct })), el('span', { class: 'pct', text: pct + '%' })));
  }
  view.append(el('section', { class: 'block' }, el('div', { class: 'h' }, el('h2', { text: 'Apartados' }), el('span', { class: 'label', text: 'dominio' })), secs));
  growIn(view);
  window.scrollTo({ top: 0 });
}

/* ===================== Pestaña FUN (módulo externo src/fun.js, ver DISENO.md) ===================== */
const FUN_API = Object.freeze({ el, icon, pack, allItems, pick, shuffle, sample, norm, secName, grade, toast, LS, colors, state, dueCount, mastery, goHome: () => renderHome() });
function renderFun() {
  state.runId++; leaveGame(); setNav('fun'); const view = $('#view'); view.replaceChildren();
  if (window.FUN && typeof window.FUN.mount === 'function') {
    funMounted = true;
    try { window.FUN.mount(view, FUN_API); } catch (e) { console.error(e); funMounted = false; view.replaceChildren(el('div', { class: 'empty' }, el('h1', { text: 'FUN' }), el('p', { class: 'muted', text: 'No se pudo abrir esta pestaña.' }))); }
  } else {
    view.append(el('div', { class: 'empty' }, el('h1', { text: 'FUN' }), el('p', { class: 'muted', text: 'Aquí irán los juegos tipo videojuego. Están en preparación.' })));
  }
  window.scrollTo({ top: 0 });
}

/* ===================== Motor de rondas ===================== */
function buildShell(title, total) {
  const root = el('section', { class: 'shell' });
  const t = el('div', { class: 'shellTitle', text: title });
  const pts = el('span', { class: 'pts', text: '0 pts' });
  const streakEl = el('span', { class: 'streak', text: 'racha 0' });
  const exit = el('button', { class: 'btn small text', type: 'button', text: 'Salir', onclick: () => renderHome() });
  const head = el('div', { class: 'shellHead' }, t, el('div', { class: 'shellMeta' }, pts, streakEl, exit));
  const segs = el('div', { class: 'segs', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': '0', 'aria-label': 'Progreso de la partida' });
  for (let i = 0; i < total; i++) segs.append(el('i'));
  const body = el('div', { class: 'body' });
  const verdict = el('div', { class: 'verdict' }); const why = el('div', { class: 'why' });
  const nextBtn = el('button', { class: 'btn primary', type: 'button', text: 'Siguiente' });
  const fb = el('div', { class: 'fb' }, el('div', {}, verdict, why), nextBtn);
  root.append(head, segs, body, fb);
  let nextResolve = null; let keys = null;
  nextBtn.addEventListener('click', () => { if (nextResolve) { const r = nextResolve; nextResolve = null; r(); } });
  const onKey = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (nextResolve && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextBtn.click(); return; }
    if (keys) keys(e);
  };
  document.addEventListener('keydown', onKey);
  const shell = {
    root, body,
    setTitle(s) { t.textContent = s; },
    setStep(i, n) { segs.setAttribute('aria-valuenow', String(i)); segs.setAttribute('aria-valuemax', String(n)); [...segs.children].forEach((s, idx) => { s.className = idx < i ? 'done' : idx === i ? 'now' : ''; }); },
    setScore(p, s) { pts.textContent = p + ' pts'; streakEl.textContent = 'racha ' + s; streakEl.classList.toggle('hot', s >= 3); },
    feedback(res) {
      fb.className = 'fb show ' + (res.ok ? 'ok' : 'ko');
      verdict.replaceChildren(icon(res.ok ? 'check' : 'x', 'sm'), document.createTextNode(res.msg || (res.ok ? 'Correcto' : 'No es eso')));
      why.textContent = res.why || '';
      nextBtn.textContent = res.last ? 'Ver resultado' : 'Siguiente';
      nextBtn.focus({ preventScroll: true });
      fb.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    },
    hideFeedback() { fb.className = 'fb'; },
    next() { return new Promise(r => { nextResolve = r; }); },
    setKeys(fn) { keys = fn; },
    destroy() { document.removeEventListener('keydown', onKey); keys = null; nextResolve = null; if (activeShell === shell) activeShell = null; }
  };
  leaveGame(); activeShell = shell;
  return shell;
}
async function runRounds(def) {
  if (!def.rounds.length) { toast('Este tema no tiene contenido suficiente para este juego.'); return renderHome(); }
  const run = ++state.runId; setNav('home'); const view = $('#view'); view.replaceChildren();
  const shell = buildShell(def.title, def.rounds.length); view.append(shell.root); window.scrollTo({ top: 0 });
  let correct = 0, streak = 0, best = 0, points = 0; const results = [];
  const cleanup = () => shell.destroy();
  const guard = () => { if (run !== state.runId) { cleanup(); return true; } return false; };
  for (let i = 0; i < def.rounds.length; i++) {
    if (guard()) return;
    const round = def.rounds[i];
    shell.setStep(i, def.rounds.length); shell.hideFeedback(); shell.setKeys(null); shell.body.replaceChildren();
    if (round.label) shell.setTitle(def.title + ' · ' + round.label);
    const res = await round.play(shell.body, shell);
    if (guard()) return;
    results.push(Object.assign({ round }, res));
    if (res.ok) { correct++; streak++; best = Math.max(best, streak); points += 10 + Math.min(streak - 1, 5) * 2; } else streak = 0;
    shell.setScore(points, streak); shell.setKeys(null);
    res.last = i === def.rounds.length - 1;
    shell.feedback(res);
    await shell.next();
  }
  if (guard()) return;
  cleanup();
  showSummary(def, { correct, total: def.rounds.length, points, best, results });
}
function resultShell(title, kids) {
  return el('section', { class: 'shell' }, el('div', { class: 'shellHead' }, el('div', { class: 'shellTitle', text: title }), el('span', { class: 'label', text: 'resultado' })), el('div', { class: 'body summary' }, kids));
}
function missedList(rows) {
  return el('div', { class: 'stack tight' }, el('h3', { text: 'Para repasar' }), el('div', { class: 'missed' }, rows.map(x => el('div', { class: 'm' }, el('b', { text: x.q }), el('span', { text: x.a })))));
}
function showSummary(def, s) {
  const view = $('#view'); view.replaceChildren();
  const pct = Math.round((s.correct / s.total) * 100);
  const key = bestKey(def.key); const prev = LS.get(key, null); let record = false;
  const scoreStr = s.correct + '/' + s.total;
  if (!prev || s.correct > parseInt(prev, 10)) { LS.set(key, scoreStr); record = !!prev || s.correct === s.total; }
  const r = 46, c = 2 * Math.PI * r;
  const ring = el('div', { class: 'ringWrap' });
  ring.innerHTML = '<svg class="ring" viewBox="0 0 110 110" role="img" aria-label="' + pct + '% de aciertos"><circle class="track" cx="55" cy="55" r="' + r + '"></circle><circle class="val" cx="55" cy="55" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + (c * (1 - pct / 100)).toFixed(1) + '"></circle><text x="55" y="65" text-anchor="middle">' + pct + '%</text></svg>';
  const missed = s.results.filter(x => !x.ok && x.review).map(x => x.review);
  const headline = pct === 100 ? 'Pleno.' : pct >= 80 ? 'Muy bien.' : pct >= 50 ? 'Buen avance.' : 'Primer contacto.';
  const sub = pct === 100 ? 'Nada que objetar.' : pct >= 80 ? 'Casi todo dominado.' : pct >= 50 ? 'Repasa lo marcado.' : 'Lo fallado volverá pronto.';
  view.append(resultShell(def.title, [
    el('div', { class: 'summaryTop' }, ring, el('div', { class: 'summaryNums' },
      el('div', { class: 'h2', text: headline + ' ' + sub }),
      el('div', { class: 'muted', text: s.correct + ' de ' + s.total + ' rondas acertadas · ' + s.points + ' puntos · mejor racha ' + s.best }),
      record ? el('span', { class: 'tag warn', text: 'Nuevo récord' }) : (prev ? el('span', { class: 'label', text: 'Récord: ' + prev }) : null)
    )),
    missed.length ? missedList(missed) : el('p', { class: 'muted', text: 'Sin fallos. Estas preguntas tardarán más en volver a salir.' }),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', type: 'button', onclick: () => startGame(def.key) }, 'Otra partida'),
      def.key !== 'mix' ? el('button', { class: 'btn', type: 'button', onclick: () => startGame('mix') }, icon('mix', 'sm'), 'Ruleta') : null,
      el('button', { class: 'btn text', type: 'button', onclick: renderHome }, 'Inicio')
    )
  ]));
  growIn(view);
  window.scrollTo({ top: 0 });
}

function roundHeader(body, label, text) { body.append(el('div', { class: 'label', text: label }), el('h2', { class: 'q', text })); }
function mcRound(q) {
  return {
    type: 'quiz', play: (body, shell) => new Promise(resolve => {
      roundHeader(body, secName(q.sec), q.q);
      const opts = shuffle(q.options.map((t, i) => ({ t, ok: i === q.a })));
      const list = el('div', { class: 'opts' }); const btns = [];
      opts.forEach((o, idx) => {
        const b = el('button', { class: 'opt', type: 'button' }, el('span', { class: 'key', text: String(idx + 1) }), el('span', { class: 'txt', text: o.t }), el('span', { class: 'mark' }));
        b.addEventListener('click', () => {
          btns.forEach((x, j) => { x.disabled = true; if (opts[j].ok) { x.classList.add('is-right'); x.querySelector('.mark').replaceChildren(icon('check', 'sm')); } });
          if (!o.ok) { b.classList.add('is-wrong'); b.querySelector('.mark').replaceChildren(icon('x', 'sm')); }
          grade(q.id, o.ok);
          resolve({ ok: o.ok, why: q.why, review: o.ok ? null : { q: q.q, a: 'Respuesta: ' + q.options[q.a] } });
        });
        btns.push(b); list.append(b);
      });
      body.append(list);
      shell.setKeys(e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length && !btns[0].disabled) btns[n - 1].click(); });
    })
  };
}
function tfRound(t) {
  return {
    type: 'tf', play: (body, shell) => new Promise(resolve => {
      roundHeader(body, secName(t.sec), t.s);
      const list = el('div', { class: 'opts two' }); const btns = [];
      [['Verdadero', true, 'V'], ['Falso', false, 'F']].forEach(([label, val, key]) => {
        const b = el('button', { class: 'opt', type: 'button' }, el('span', { class: 'key', text: key }), el('span', { class: 'txt', text: label }), el('span', { class: 'mark' }));
        b.addEventListener('click', () => {
          btns.forEach(x => x.disabled = true); const ok = val === t.a;
          b.classList.add(ok ? 'is-right' : 'is-wrong'); b.querySelector('.mark').replaceChildren(icon(ok ? 'check' : 'x', 'sm')); if (!ok) { const r = btns[t.a ? 0 : 1]; r.classList.add('is-right'); r.querySelector('.mark').replaceChildren(icon('check', 'sm')); }
          grade(t.id, ok);
          resolve({ ok, why: (t.a ? 'Es verdadero. ' : 'Es falso. ') + (t.why || ''), review: ok ? null : { q: t.s, a: (t.a ? 'Verdadero. ' : 'Falso. ') + (t.why || '') } });
        });
        btns.push(b); list.append(b);
      });
      body.append(list);
      shell.setKeys(e => { const k = e.key.toLowerCase(); if (btns[0].disabled) return; if (k === 'v' || k === '1') btns[0].click(); if (k === 'f' || k === '2') btns[1].click(); });
    })
  };
}
function clozeRound(c) {
  return {
    type: 'cloze', play: (body) => new Promise(resolve => {
      body.append(el('div', { class: 'label', text: secName(c.sec) }));
      const parts = c.text.split('___');
      const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Palabra que falta', id: 'cloze-' + c.id });
      input.style.width = Math.max(8, Math.min(26, c.answer.length + 3)) + 'ch';
      const line = el('p', { class: 'cloze' }); parts.forEach((part, i) => { line.append(part); if (i < parts.length - 1) line.append(input); });
      const hint = el('p', { class: 'hint' });
      let hintLevel = 0; let done = false;
      const check = el('button', { class: 'btn primary', type: 'button', text: 'Comprobar' });
      const hintBtn = el('button', { class: 'btn', type: 'button', text: 'Pista' });
      const giveUp = el('button', { class: 'btn text', type: 'button', text: 'No lo sé' });
      const finish = (ok, typed) => {
        if (done) return; done = true; input.disabled = true; check.disabled = hintBtn.disabled = giveUp.disabled = true;
        input.classList.add(ok ? 'ok' : 'ko'); if (!ok) input.value = c.answer;
        grade(c.id, ok && hintLevel <= 1 ? true : ok ? 'partial' : false);
        resolve({ ok, why: ok ? (hintLevel ? 'Con pista, pero bien. La respuesta es ' + c.answer + '.' : 'La respuesta es ' + c.answer + '.') : (typed ? 'Escribiste «' + typed + '». ' : '') + 'La respuesta correcta es ' + c.answer + '.', review: ok ? null : { q: c.text.replace('___', '______'), a: c.answer } });
      };
      const accepted = [c.answer, ...(c.alt || [])].map(norm);
      check.addEventListener('click', () => { const v = input.value.trim(); if (!v) { input.focus(); return; } finish(accepted.includes(norm(v)), v); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check.click(); } });
      hintBtn.addEventListener('click', () => {
        hintLevel++;
        if (hintLevel === 1 && c.hint) hint.textContent = 'Pista: ' + c.hint;
        else { const n = Math.min(c.answer.length - 1, hintLevel - (c.hint ? 1 : 0)); hint.textContent = 'Empieza por «' + c.answer.slice(0, Math.max(1, n)) + '…» (' + c.answer.length + ' caracteres)'; if (n >= c.answer.length - 1) hintBtn.disabled = true; }
        input.focus();
      });
      giveUp.addEventListener('click', () => finish(false, ''));
      body.append(line, hint, el('div', { class: 'row' }, check, hintBtn, giveUp));
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    })
  };
}
function matchRound(concepts, label) {
  return {
    type: 'match', label, play: (body) => new Promise(resolve => {
      body.append(el('div', { class: 'label', text: 'Empareja' }), el('h2', { class: 'q', text: 'Toca un término y después su definición.' }));
      const terms = shuffle(concepts); const defs = shuffle(concepts);
      const chipsWrap = el('div', { class: 'chipsWrap' }); const defsWrap = el('div', { class: 'defs' });
      let selected = null; let errors = 0; let matched = 0; const firstTry = new Map(); const chipOf = new Map();
      terms.forEach(k => { const b = el('button', { class: 'pchip', type: 'button', text: k.term }); b.addEventListener('click', () => { if (selected) selected.classList.remove('is-sel'); selected = b; b.classList.add('is-sel'); }); chipOf.set(k.id, b); chipsWrap.append(b); });
      defs.forEach(k => {
        const d = el('button', { class: 'pdef', type: 'button', text: k.def });
        d.addEventListener('click', () => {
          if (!selected) { toast('Primero elige un término.'); return; }
          const selId = [...chipOf].find(([, b]) => b === selected)[0];
          if (selId === k.id) {
            selected.classList.remove('is-sel'); selected.classList.add('is-done'); d.classList.add('is-done'); d.prepend(icon('check', 'sm'));
            if (!firstTry.has(selId)) { firstTry.set(selId, true); grade(selId, true); }
            selected = null; matched++;
            if (matched === concepts.length) resolve({ ok: errors <= 1, msg: errors === 0 ? 'Todas emparejadas sin fallos.' : errors === 1 ? 'Emparejadas con un fallo. Vale.' : 'Emparejadas con ' + errors + ' fallos.', why: errors ? 'Los términos que confundiste volverán a salir pronto.' : '', review: errors > 1 ? { q: 'Empareja: ' + concepts.map(c => c.term).join(', '), a: 'Repasa estas definiciones en Tarjetas.' } : null });
          } else {
            errors++; if (!firstTry.has(selId)) { firstTry.set(selId, false); grade(selId, false); }
            const s = selected; s.classList.add('is-wrong'); d.classList.add('is-wrong'); setTimeout(() => { s.classList.remove('is-wrong'); d.classList.remove('is-wrong'); }, 450);
          }
        });
        defsWrap.append(d);
      });
      body.append(el('div', { class: 'pairs' }, chipsWrap, defsWrap));
    })
  };
}
function sortRound(s, maxItems) {
  return {
    type: 'sort', label: '', play: (body, shell) => new Promise(resolve => {
      const items = shuffle(s.items).slice(0, maxItems || s.items.length);
      body.append(el('div', { class: 'label', text: secName(s.sec) }), el('h2', { class: 'q', text: s.title }));
      const counter = el('span', { class: 'counter', text: '1/' + items.length });
      const card = el('div', { class: 'itemCard' }); const cats = el('div', { class: 'cats' }); const btns = [];
      let i = 0; let hits = 0; let busy = false; const wrong = [];
      s.cats.forEach((c, ci) => { const b = el('button', { class: 'btn', type: 'button' }, el('span', { class: 'kbd', text: String(ci + 1) }), ' ', c); b.addEventListener('click', () => answer(ci)); btns.push(b); cats.append(b); });
      const show = () => { card.className = 'itemCard'; card.textContent = items[i].t; counter.textContent = (i + 1) + '/' + items.length; btns.forEach(b => { b.classList.remove('is-right', 'is-wrong'); b.disabled = false; }); };
      const answer = async (ci) => {
        if (busy) return; busy = true; const it = items[i]; const ok = ci === it.c; if (ok) hits++; else wrong.push(it);
        card.classList.add(ok ? 'ok' : 'ko'); btns[it.c].classList.add('is-right'); if (!ok) btns[ci].classList.add('is-wrong'); btns.forEach(b => b.disabled = true);
        await sleep(ok ? 650 : 1400); i++; busy = false;
        if (i < items.length) show();
        else {
          const ok2 = hits / items.length >= 0.8; grade(s.id, hits === items.length ? true : ok2 ? 'partial' : false);
          resolve({ ok: ok2, msg: hits === items.length ? 'Clasificación perfecta.' : hits + ' de ' + items.length + ' bien clasificadas.', why: wrong.length ? 'Fallos: ' + wrong.map(w => '«' + w.t + '» es ' + s.cats[w.c]).join('; ') + '.' : '', review: ok2 ? null : { q: s.title, a: wrong.map(w => w.t + ' → ' + s.cats[w.c]).join(' · ') } });
        }
      };
      body.append(el('div', { class: 'row between' }, el('span', { class: 'muted small', text: '¿A qué categoría pertenece?' }), counter), card, cats);
      shell.setKeys(e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) answer(n - 1); });
      show();
    })
  };
}
function orderRound(o) {
  return {
    type: 'order', label: '', play: (body) => new Promise(resolve => {
      body.append(el('div', { class: 'label', text: secName(o.sec) }), el('h2', { class: 'q', text: o.title }), el('p', { class: 'muted small', text: 'Toca los pasos en orden.' }));
      const shuffled = shuffle(o.steps.map((t, i) => ({ t, i })));
      const list = el('div', { class: 'steps' }); const picked = []; const btns = [];
      const undo = el('button', { class: 'btn text', type: 'button', disabled: true }, icon('undo', 'sm'), 'Deshacer');
      const render = () => { btns.forEach((b, idx) => { const pos = picked.indexOf(idx); b.classList.toggle('picked', pos >= 0); b.querySelector('.n').textContent = pos >= 0 ? String(pos + 1) : '·'; }); undo.disabled = !picked.length; };
      const finish = () => {
        btns.forEach(b => b.disabled = true); undo.disabled = true; let okCount = 0;
        picked.forEach((idx, pos) => { const ok = shuffled[idx].i === pos; if (ok) okCount++; btns[idx].classList.add(ok ? 'pos-ok' : 'pos-ko'); btns[idx].classList.remove('picked'); });
        const all = okCount === o.steps.length; grade(o.id, all ? true : okCount >= o.steps.length - 1 ? 'partial' : false);
        resolve({ ok: all, msg: all ? 'Orden correcto.' : okCount + ' de ' + o.steps.length + ' pasos en su sitio.', why: all ? '' : 'Orden correcto: ' + o.steps.map((s, i) => (i + 1) + ') ' + s).join(' '), review: all ? null : { q: o.title, a: o.steps.map((s, i) => (i + 1) + '. ' + s).join(' ') } });
      };
      shuffled.forEach((s, idx) => { const b = el('button', { class: 'step', type: 'button' }, el('span', { class: 'n', text: '·' }), el('span', { text: s.t })); b.addEventListener('click', () => { if (picked.includes(idx)) return; picked.push(idx); render(); if (picked.length === shuffled.length) finish(); }); btns.push(b); list.append(b); });
      undo.addEventListener('click', () => { picked.pop(); render(); });
      body.append(list, el('div', { class: 'row' }, undo));
    })
  };
}
function explainRound(e) {
  return {
    type: 'explain', play: (body) => new Promise(resolve => {
      roundHeader(body, secName(e.sec), e.q);
      const ta = el('textarea', { class: 'answer', placeholder: 'Explícalo con tus palabras, como se lo contarías a un compañero...', id: 'explain-' + e.id });
      const reveal = el('button', { class: 'btn primary', type: 'button', text: 'Comparar con la respuesta modelo' });
      const box = el('div', { class: 'stack' });
      reveal.addEventListener('click', () => {
        reveal.disabled = true; ta.readOnly = true;
        const model = el('div', { class: 'model' }, el('div', { class: 'label', text: 'Respuesta modelo' }), el('p', { text: e.model }));
        const rate = el('div', { class: 'rate' });
        const mk = (label, sub, cls, result) => { const b = el('button', { class: 'btn ' + cls, type: 'button' }, label, el('small', { text: sub })); b.addEventListener('click', () => { rate.querySelectorAll('button').forEach(x => x.disabled = true); grade(e.id, result); resolve({ ok: result !== false, msg: result === true ? 'Lo tenías claro.' : result === 'partial' ? 'A medias: volverá a salir.' : 'Apuntado para repasar.', why: '', review: result === true ? null : { q: e.q, a: e.model } }); }); return b; };
        rate.append(mk('Lo tenía bien', 'mismas ideas clave', 'ok', true), mk('A medias', 'me faltaba algo', '', 'partial'), mk('No lo sabía', 'o lo tenía mal', 'ko', false));
        box.append(model, el('div', { class: 'label', text: 'Valórate con sinceridad: así se ajusta el repaso.' }), rate);
        if (state.caps.sample) {
          const aiBtn = el('button', { class: 'btn', type: 'button', text: 'Pedir a Claude que valore mi respuesta' });
          const out = el('div', { class: 'aiBox', hidden: true });
          aiBtn.addEventListener('click', async () => {
            const mine = ta.value.trim(); if (!mine) { toast('Escribe primero tu explicación.'); return; }
            aiBtn.disabled = true; out.hidden = false; out.textContent = 'Pensando...';
            try {
              const prompt = 'Eres un profesor de formación profesional que corrige con amabilidad y precisión. Responde en español, en 3 o 4 frases, sin nota numérica: di qué ideas clave de la respuesta modelo aparecen en la respuesta del estudiante, cuáles faltan o están mal, y termina con una pista breve para recordarlo.\n\nPregunta: ' + e.q + '\n\nRespuesta modelo: ' + e.model + '\n\nRespuesta del estudiante: ' + mine;
              const r = await state.caps.sample(prompt, { modelTier: 'quick', onText: ({ text }) => { out.textContent = text; } });
              out.textContent = r.text;
            } catch (err) {
              const code = err && err.code; out.textContent = code === 'not_granted' ? 'No has permitido que esta página use Claude. Puedes seguir autoevaluándote.' : code === 'rate_limited' ? 'Claude está ocupado ahora mismo. Prueba más tarde.' : (err && err.text) || 'No se pudo obtener la valoración.'; if (code !== 'not_granted') aiBtn.disabled = false;
            }
          });
          box.append(el('div', { class: 'row' }, aiBtn), out);
        }
      });
      body.append(ta, el('div', { class: 'row' }, reveal), box);
      setTimeout(() => ta.focus({ preventScroll: true }), 50);
    })
  };
}

/* ===================== Tarjetas (repaso espaciado) ===================== */
function runCards() {
  const run = ++state.runId; const p = pack(); setNav('home'); const view = $('#view'); view.replaceChildren();
  const deck = pick(p.concepts, Math.min(12, p.concepts.length));
  const shell = buildShell('Tarjetas', deck.length); view.append(shell.root); window.scrollTo({ top: 0 });
  let i = 0; let known = 0, partial = 0, missed = 0; const missedCards = [];
  const guard = () => { if (run !== state.runId) { shell.destroy(); return true; } return false; };
  const next = () => {
    if (guard()) return;
    if (i >= deck.length) {
      shell.destroy(); const prevBest = LS.get(bestKey('cards'), null); if (!prevBest || known > parseInt(prevBest, 10)) LS.set(bestKey('cards'), known + '/' + deck.length);
      const view2 = $('#view'); view2.replaceChildren();
      const dueNow = dueCount(p.concepts);
      view2.append(resultShell('Tarjetas', [
        el('div', { class: 'summaryNums' },
          el('div', { class: 'h2', text: known === deck.length ? 'Todas sabidas.' : 'Sesión terminada.' }),
          el('div', { class: 'muted', text: known + ' sabidas · ' + partial + ' a medias · ' + missed + ' por aprender' }),
          el('div', { class: 'label', text: 'Las sabidas vuelven dentro de unos días; las falladas, en la próxima sesión. Pendientes ahora: ' + dueNow + '.' })),
        missedCards.length ? missedList(missedCards.map(k => ({ q: k.term, a: k.def }))) : null,
        el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: () => startGame('cards') }, 'Otra tanda'), el('button', { class: 'btn', type: 'button', onclick: () => startGame('mix') }, icon('mix', 'sm'), 'Ruleta'), el('button', { class: 'btn text', type: 'button', onclick: renderHome }, 'Inicio'))
      ]));
      return;
    }
    const k = deck[i]; const r = state.prog[k.id]; const box = r ? r.box : 0; const reverse = Math.random() < 0.3;
    shell.setStep(i, deck.length); shell.setScore(known * 10, 0); shell.body.replaceChildren(); shell.hideFeedback();
    const boxes = el('div', { class: 'boxes', title: 'Caja de repaso', role: 'img', 'aria-label': 'Caja ' + (r ? box + 1 : 0) + ' de 5' }); for (let b = 0; b < 5; b++) boxes.append(el('i', { class: b <= box && r ? 'on' : '' }));
    const card = el('div', { class: 'flashCard' }, el('div', { class: 'face' }, el('div', { class: 'label', text: reverse ? 'Definición. ¿Qué término es?' : 'Término. ¿Cuál es su definición?' }), el('div', { class: reverse ? 'ans' : 'big', text: reverse ? k.def : k.term })));
    const flip = el('button', { class: 'btn primary big', type: 'button', text: 'Mostrar respuesta' });
    const rate = el('div', { class: 'rate', hidden: true });
    const mk = (label, sub, cls, result) => { const b = el('button', { class: 'btn ' + cls, type: 'button' }, label, el('small', { text: sub })); b.addEventListener('click', () => { grade(k.id, result); if (result === true) known++; else if (result === 'partial') partial++; else { missed++; missedCards.push(k); } i++; next(); }); return b; };
    rate.append(mk('No la sabía', 'vuelve enseguida', 'ko', false), mk('Casi', 'me faltaba algo', '', 'partial'), mk('La sabía', 'sube de caja', 'ok', true));
    flip.addEventListener('click', () => { card.classList.add('flipped'); card.replaceChildren(el('div', { class: 'face' }, el('div', { class: 'label', text: reverse ? k.term : 'Definición' }), el('div', { class: reverse ? 'big' : 'ans', text: reverse ? k.term : k.def }))); flip.hidden = true; rate.hidden = false; });
    shell.setKeys(e => { if (e.key === ' ' || e.key === 'Enter') { if (!flip.hidden) { e.preventDefault(); flip.click(); } } else if (!rate.hidden) { const n = parseInt(e.key, 10); const bs = rate.querySelectorAll('button'); if (n >= 1 && n <= 3) bs[n - 1].click(); } });
    shell.body.append(el('div', { class: 'row between' }, el('span', { class: 'label', text: secName(k.sec) }), boxes), card, el('div', { class: 'row' }, flip), rate);
  };
  next();
}

/* ===================== Lanzador ===================== */
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
function matchGroups(p, rounds, size) {
  const chosen = pick(p.concepts, Math.min(p.concepts.length, rounds * size));
  // Agrupa por sección cuando se puede, para que convivan conceptos parecidos (más difícil y más útil).
  const bySec = new Map(); chosen.forEach(k => { if (!bySec.has(k.sec)) bySec.set(k.sec, []); bySec.get(k.sec).push(k); });
  const ordered = [...bySec.values()].flat();
  return chunk(ordered, size).filter(g => g.length >= 3).slice(0, rounds);
}
function startGame(key) {
  const p = pack();
  if (key === 'cards') return runCards();
  if (key === 'quiz') return runRounds({ key, title: 'Test rápido', rounds: pick(p.questions, Math.min(10, p.questions.length)).map(mcRound) });
  if (key === 'tf') return runRounds({ key, title: 'Verdadero o falso', rounds: pick(p.tf, Math.min(10, p.tf.length)).map(tfRound) });
  if (key === 'cloze') return runRounds({ key, title: 'Completa el hueco', rounds: pick(p.cloze, Math.min(8, p.cloze.length)).map(clozeRound) });
  if (key === 'match') return runRounds({ key, title: 'Empareja', rounds: matchGroups(p, 2, 6).map((g, i) => matchRound(g, 'ronda ' + (i + 1))) });
  if (key === 'sort') return runRounds({ key, title: 'Clasifica', rounds: pick(p.sort, Math.min(3, p.sort.length)).map(s => sortRound(s)) });
  if (key === 'order') return runRounds({ key, title: 'Ordena los pasos', rounds: pick(p.order, Math.min(3, p.order.length)).map(orderRound) });
  if (key === 'explain') return runRounds({ key, title: 'Explícalo', rounds: pick(p.explain, Math.min(3, p.explain.length)).map(explainRound) });
  if (key === 'mix') {
    const plan = [];
    const add = (type, n) => { for (let i = 0; i < n; i++) plan.push(type); };
    add('quiz', Math.min(3, p.questions.length)); add('cloze', Math.min(2, p.cloze.length)); add('tf', Math.min(2, p.tf.length));
    if (p.concepts.length >= 4) add('match', 1); add('sort', Math.min(1, p.sort.length)); add('order', Math.min(1, p.order.length)); add('explain', Math.min(1, p.explain.length)); if (p.concepts.length >= 4) add('cardq', 1);
    const types = shuffle(plan).slice(0, 12);
    if (!types.length) { toast('Este tema no tiene contenido suficiente.'); return renderHome(); }
    const used = { quiz: pick(p.questions, 3), cloze: pick(p.cloze, 2), tf: pick(p.tf, 2), sort: pick(p.sort, 1), order: pick(p.order, 1), explain: pick(p.explain, 1), concepts: pick(p.concepts, 8) };
    const rounds = []; const cursors = { quiz: 0, cloze: 0, tf: 0, sort: 0, order: 0, explain: 0 };
    for (const t of types) {
      if (t === 'quiz') rounds.push(withLabel(mcRound(used.quiz[cursors.quiz++]), 'Test'));
      else if (t === 'cloze') rounds.push(withLabel(clozeRound(used.cloze[cursors.cloze++]), 'Hueco'));
      else if (t === 'tf') rounds.push(withLabel(tfRound(used.tf[cursors.tf++]), 'Verdadero o falso'));
      else if (t === 'sort') rounds.push(withLabel(sortRound(used.sort[cursors.sort++], 5), 'Clasifica'));
      else if (t === 'order') rounds.push(withLabel(orderRound(used.order[cursors.order++]), 'Ordena'));
      else if (t === 'explain') rounds.push(withLabel(explainRound(used.explain[cursors.explain++]), 'Explícalo'));
      else if (t === 'match') rounds.push(withLabel(matchRound(used.concepts.slice(0, 4), ''), 'Empareja'));
      else if (t === 'cardq') { const k = used.concepts[used.concepts.length - 1]; rounds.push(withLabel(conceptMcRound(k, p), 'Concepto')); }
    }
    return runRounds({ key, title: 'Ruleta', rounds });
  }
}
function withLabel(round, label) { round.label = label; return round; }
function conceptMcRound(k, p) {
  // Pregunta tipo test construida al vuelo a partir de un concepto: definición → término.
  const others = sample(p.concepts.filter(x => x.id !== k.id && x.sec === k.sec), 3);
  while (others.length < 3) { const extra = p.concepts.find(x => x.id !== k.id && !others.includes(x)); if (!extra) break; others.push(extra); }
  const q = { id: k.id, sec: k.sec, q: '¿A qué concepto corresponde esta definición? «' + k.def + '»', options: [k.term, ...others.map(o => o.term)], a: 0, why: k.term + ': ' + k.def };
  return mcRound(q);
}

/* ===================== Método ===================== */
// Una fila por técnica: icono del juego, nombre, una frase, el dato y el detalle plegado en <details>.
const METHODS = [
  { icon: 'quiz', games: 'Test rápido · Verdadero o falso · Ruleta', name: 'Práctica de recuperación', line: 'Recordar algo de memoria lo fija más que volver a leerlo.', num: '+200', unit: 'estudios a favor', more: 'Un metaanálisis de 2017 con más de 200 estudios (Adesope, Trevisan y Sundararajan) encontró que hacerse preguntas gana a releer de forma consistente, en aula y en laboratorio, y sobre todo cuando el examen es días después. Dunlosky y colaboradores (2013) la clasificaron como una de las dos únicas técnicas de utilidad alta. Por eso aquí no hay modo lectura: todo es pregunta.' },
  { icon: 'tf', games: 'Test rápido · Verdadero o falso', name: 'Feedback con explicación', line: 'Cada respuesta trae su porqué, para que no se te cuele una idea falsa.', num: '1 porqué', unit: 'por cada respuesta', more: 'Las opciones de un test pueden colarte ideas falsas si eliges mal y nadie te corrige (Marsh y otros, 2007). Con corrección después de cada respuesta ese riesgo desaparece y el aprendizaje mejora (Butler y Roediger, 2008; Kang y otros, 2007).' },
  { icon: 'cloze', games: 'Completa el hueco · Tarjetas', name: 'Efecto de generación', line: 'Escribir la respuesta deja más huella que reconocerla entre opciones.', num: 'd ≈ 0,40', unit: 'Bertsch y otros, 2007', more: 'El metaanálisis de Bertsch y otros (2007) estima ese efecto en d ≈ 0,40, y Kang y otros (2007) vieron que las preguntas de respuesta corta con feedback rendían mejor que el tipo test a una semana vista. Por eso hay un juego en el que escribes la palabra, y en Tarjetas intentas recordar antes de girar.' },
  { icon: 'cards', games: 'Tarjetas · Para hoy', name: 'Repaso espaciado', line: 'Lo que aciertas vuelve más tarde; lo que fallas, mañana.', num: '1 · 3 · 7 · 14', unit: 'días entre repasos', more: 'Repartir el estudio en varios días retiene mucho más que concentrarlo. Cepeda y otros (2006) lo confirmaron en 317 experimentos y vieron que el hueco óptimo entre repasos crece cuanto más lejos está el examen. Aquí cada elemento vive en una caja tipo Leitner: si lo aciertas vuelve a los 1, 3, 7 o 14 días; si lo fallas vuelve al día siguiente. Todos los juegos comparten ese calendario, y el dominio de la portada sube cuando aciertas un elemento varias veces en días distintos y baja cuando lo fallas.' },
  { icon: 'sort', games: 'Clasifica · Empareja · Ruleta', name: 'Intercalado', line: 'Mezclar categorías parecidas enseña a distinguirlas.', num: 'g = 0,42', unit: 'Brunmair y Richter, 2019', more: 'Brunmair y Richter (2019) midieron un efecto medio de g = 0,42 en 238 comparaciones, mayor cuanto más se confunden las categorías entre sí (IMAP y POP3, cita y reunión). Yan y Sana (2021) comprobaron que el beneficio aparece en la mayoría de las personas aunque casi nadie lo intuya. La Ruleta mezcla además tipos de pregunta y secciones.' },
  { icon: 'explain', games: 'Explícalo', name: 'Interrogación elaborativa', line: 'Explicar un porqué con tus palabras conecta la idea con lo que ya sabes.', num: 'utilidad media', unit: 'Dunlosky y otros, 2013', more: 'Dunlosky y otros (2013) la valoran como técnica de utilidad moderada, útil sobre todo para contenido factual como este tema. Comparar con la respuesta modelo y, si quieres, pedir a Claude que la valore, cierra el ciclo con feedback.' },
  { icon: 'order', games: 'Ordena los pasos', name: 'Conocimiento procedimental', line: 'Reconstruir los pasos de un caso práctico es recuperación aplicada.', num: 'en orden', unit: 'como se evalúa en clase', more: 'Los casos prácticos del tema son secuencias (crear una cuenta, configurar POP3, exportar un PST). Reconstruir el orden es una forma de recuperación que además encaja con cómo se evalúan estos procedimientos en clase.' },
  { icon: 'mix', games: 'Puntos · rachas · Ruleta', name: 'Juego como envoltorio', line: 'Puntos y rachas, sin rankings; cada partida se baraja.', num: 'd = 0,29', unit: 'Wouters y otros, 2013', more: 'Los metaanálisis sobre juegos serios (Wouters y otros, 2013: d = 0,29 en aprendizaje y 0,36 en retención; Sitzmann, 2011) muestran beneficios moderados que crecen cuando se juega en varias sesiones y como complemento de otra instrucción. Sailer y Homner (2020) añaden que la competición pura puede desmotivar a parte del alumnado. Por eso hay puntos y rachas, pero no rankings, y cada partida se baraja para que repetir siga siendo un reto.' }
];
function renderWhy() {
  state.runId++; leaveGame(); setNav('why'); const view = $('#view'); view.replaceChildren();
  const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener' }, text);
  const fold = (title, kids, cls) => el('details', { class: 'more' + (cls ? ' ' + cls : '') }, el('summary', {}, icon('chev', 'sm'), title), kids);
  const rows = el('ul', { class: 'methods' });
  for (const m of METHODS) {
    rows.append(el('li', { class: 'method' },
      el('span', { class: 'mIc' }, icon(m.icon)),
      el('div', { class: 'mT' }, el('b', { text: m.name }), el('span', { class: 'd', text: m.line }), el('span', { class: 'label', text: m.games })),
      el('div', { class: 'mNum' }, el('span', { class: 'n', text: m.num }), el('small', { text: m.unit })),
      fold('Qué dice la investigación', el('p', { text: m.more }))
    ));
  }
  const avoid = el('div', { class: 'avoid' }, ['Releer', 'Subrayar', 'Resumir'].map(t => el('span', {}, icon('x', 'sm'), t)));
  const sources = el('ul', {},
    el('li', {}, 'Adesope, Trevisan y Sundararajan (2017). Rethinking the use of tests: a meta-analysis of practice testing. ', link('https://journals.sagepub.com/doi/10.3102/0034654316689306', 'Review of Educational Research'), ' · ', link('https://www.learningscientists.org/blog/2017/2/9-1', 'resumen en The Learning Scientists')),
    el('li', {}, 'Dunlosky, Rawson, Marsh, Nathan y Willingham (2013). Improving students’ learning with effective learning techniques. ', link('https://www.citedrive.com/en/discovery/improving-students-learning-with-effective-learning-techniques', 'Psychological Science in the Public Interest')),
    el('li', {}, 'Cepeda, Pashler, Vul, Wixted y Rohrer (2006). Distributed practice in verbal recall tasks. ', link('https://digitalcommons.usf.edu/psy_facpub/1771/', 'Psychological Bulletin')),
    el('li', {}, 'Brunmair y Richter (2019). Similarity matters: a meta-analysis of interleaved learning. ', link('https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf', 'Psychological Bulletin (preprint)')),
    el('li', {}, 'Yan y Sana (2021). The robustness of the interleaving benefit. ', link('https://www.Gwern.net/doc/psychology/spaced-repetition/2021-yan.pdf', 'Journal of Applied Research in Memory and Cognition')),
    el('li', {}, 'Bertsch, Pesta, Wiscott y McDaniel (2007). The generation effect: a meta-analytic review. ', link('https://pubmed.ncbi.nlm.nih.gov/17645161/', 'Memory & Cognition')),
    el('li', {}, 'Butler y Roediger (2008); Kang, McDermott y Roediger (2007); Marsh y otros (2007), sobre formatos de test y feedback. ', link('https://www.mojquiz.com/multiple-choice-vs-free-recall', 'resumen comparativo')),
    el('li', {}, 'Wouters, van Nimwegen, van Oostendorp y van der Spek (2013). A meta-analysis of the cognitive and motivational effects of serious games. ', link('https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/', 'Journal of Educational Psychology'), ' · Sitzmann (2011), resumidos en ', link('https://karlkapp.com/?p=4333', 'Karl Kapp')),
    el('li', {}, 'Sailer y Homner (2020). The gamification of learning: a meta-analysis. ', link('https://link.springer.com/article/10.1007/s10648-019-09498-w', 'Educational Psychology Review'))
  );
  view.append(el('div', { class: 'page' },
    el('h1', { text: 'Por qué estos juegos' }),
    el('p', { class: 'muted', text: 'Cada juego aplica una técnica que la psicología cognitiva ha comparado con releer o subrayar. Y gana.' }),
    rows,
    el('section', { class: 'block' },
      el('div', { class: 'h' }, el('h2', { text: 'Lo que no hay aquí' }), el('span', { class: 'label', text: 'utilidad baja' })),
      avoid,
      el('p', { class: 'muted', text: 'Dan sensación de dominio sin producirlo (Dunlosky, 2013). Si necesitas el texto, vuelve al PDF, pero después de intentar recordar.' })),
    fold('Fuentes', sources, 'sources')
  ));
  window.scrollTo({ top: 0 });
}

/* ===================== Temas ===================== */
function renderPacks() {
  state.runId++; leaveGame(); setNav('packs'); const view = $('#view'); view.replaceChildren();
  const list = el('div', { class: 'packs' });
  for (const p of state.packs) {
    const counts = p.questions.length + ' test · ' + p.tf.length + ' V/F · ' + p.cloze.length + ' huecos · ' + p.concepts.length + ' conceptos · ' + p.sort.length + ' clasificaciones · ' + p.order.length + ' secuencias · ' + p.explain.length + ' porqués';
    const actions = el('div', { class: 'row' });
    const row = el('div', { class: 'packRow' }, el('div', { class: 'stack tight' }, el('b', { text: p.title }), el('span', { class: 'counts', text: counts }), p.id === state.packId ? el('span', { class: 'tag', text: 'Tema activo' }) : null), actions);
    if (p.id !== state.packId) actions.append(el('button', { class: 'btn small', type: 'button', onclick: () => { setPack(p.id); renderHome(); } }, 'Estudiar'));
    actions.append(el('button', { class: 'btn small', type: 'button', onclick: () => exportPack(p, row) }, 'Exportar JSON'));
    const confirmBtn = (label, cls, fn) => { const b = el('button', { class: 'btn small ' + cls, type: 'button', text: label }); let armed = false; b.addEventListener('click', () => { if (!armed) { armed = true; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { armed = false; b.textContent = label; }, 3000); } else fn(); }); return b; };
    actions.append(confirmBtn('Reiniciar progreso', 'text', () => { LS.del('ra.prog.' + p.id); if (p.id === state.packId) loadProg(); toast('Progreso reiniciado.'); renderPacks(); }));
    if (!p.builtin) actions.append(confirmBtn('Eliminar', 'text danger', () => { state.packs = state.packs.filter(x => x.id !== p.id); saveCustomPacks(); LS.del('ra.prog.' + p.id); if (state.packId === p.id) setPack(state.packs[0].id); toast('Tema eliminado.'); renderPacks(); }));
    list.append(row);
  }
  view.append(el('div', { class: 'page' },
    el('div', { class: 'h' }, el('h1', { text: 'Temas' }), el('button', { class: 'btn primary', type: 'button', onclick: renderAdd }, icon('plus', 'sm'), 'Añadir tema')),
    el('p', { class: 'muted', text: 'Los temas y tu progreso se guardan en este navegador. Exporta un tema en JSON para llevártelo a otro dispositivo; se importa desde Añadir tema.' }),
    list));
  window.scrollTo({ top: 0 });
}

async function exportPack(p, row) {
  const clean = Object.assign({}, p); delete clean.builtin; const json = JSON.stringify(clean, null, 1);
  if (state.caps.downloads) {
    try { await state.caps.downloads.save({ filename: (p.id || 'tema') + '.json', data: json }); toast('Archivo guardado.'); return; } catch (e) { if (e && e.code === 'declined') return; }
  }
  let box = row.querySelector('.exportBox');
  if (!box) { box = el('div', { class: 'stack tight exportBox', style: 'grid-column:1/-1' }); row.append(box); }
  const ta = el('textarea', { class: 'src', readonly: true, 'aria-label': 'JSON del tema' }); ta.value = json;
  const copy = el('button', { class: 'btn small', type: 'button', text: 'Copiar JSON' });
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(json); toast('Copiado.'); } catch { ta.focus(); ta.select(); toast('Selecciona el texto y cópialo.'); } });
  box.replaceChildren(el('span', { class: 'small muted', text: 'Copia este JSON y guárdalo donde quieras.' }), ta, el('div', { class: 'row' }, copy));
}

/* ===================== Añadir tema (PDF / texto / JSON) ===================== */
const GEN_SIZES = {
  s: { label: 'Pequeño', q: 12, tf: 8, k: 12, c: 8, sort: 2, order: 2, e: 4 },
  m: { label: 'Medio', q: 24, tf: 14, k: 22, c: 14, sort: 4, order: 3, e: 6 },
  l: { label: 'Grande', q: 40, tf: 22, k: 34, c: 22, sort: 6, order: 5, e: 10 }
};
const MAX_TEXT = 110000;
function renderAdd() {
  state.runId++; leaveGame(); setNav('packs'); const view = $('#view'); view.replaceChildren();
  const st = { mode: 'pdf', text: '', title: '', method: state.caps.sample ? 'claude' : 'auto', size: 'm', json: null };
  const log = el('div', { class: 'log' }); const preview = el('div', { class: 'preview', hidden: true });
  const titleInput = el('input', { class: 'text', type: 'text', placeholder: 'Título del tema (por ejemplo: Tema 3. Hojas de cálculo)', id: 'packTitle', 'aria-label': 'Título del tema' });
  const srcBox = el('div', { class: 'stack' });
  const step2 = el('div', { class: 'block stack', hidden: true });
  const status = el('div', { class: 'prog' });
  const setText = (text, suggestedTitle) => {
    st.text = text.replace(/\s+\n/g, '\n').trim();
    if (!titleInput.value && suggestedTitle) titleInput.value = suggestedTitle.slice(0, 100);
    preview.hidden = false; preview.textContent = st.text.slice(0, 600) + (st.text.length > 600 ? '…' : '');
    log.textContent = 'Texto listo: ' + st.text.length.toLocaleString('es-ES') + ' caracteres' + (st.text.length > MAX_TEXT ? ' (se usarán los primeros ' + MAX_TEXT.toLocaleString('es-ES') + ')' : '') + '.';
    step2.hidden = false; step2.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const tabs = el('div', { class: 'tabs' });
  const renderSource = () => {
    srcBox.replaceChildren();
    if (st.mode === 'pdf') {
      const input = el('input', { type: 'file', accept: 'application/pdf,.pdf', id: 'pdfFile', class: 'vh', 'aria-label': 'Archivo PDF' });
      const drop = el('div', { class: 'drop' }, el('b', { text: 'Arrastra aquí un PDF o elígelo' }), el('span', { class: 'small muted', text: 'Se lee en tu navegador, página a página. Funciona con PDF de texto (no escaneados).' }), input, el('label', { class: 'btn', for: 'pdfFile' }, 'Elegir PDF'));
      const handle = async (file) => {
        if (!file) return; if (!/pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Elige un archivo PDF.'); return; }
        log.textContent = 'Cargando el lector de PDF…';
        try {
          const text = await extractPdfText(file, (p, n) => { log.textContent = 'Leyendo página ' + p + ' de ' + n + '…'; });
          if (text.trim().length < 200) { log.textContent = 'Este PDF casi no tiene texto extraíble (puede ser un escaneo). Prueba a pegar el texto a mano.'; return; }
          setText(text, file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
        } catch (e) { log.textContent = 'No se pudo leer el PDF: ' + (e && e.message ? e.message : e) + '. Prueba con la pestaña Texto: abre el PDF, selecciona todo, copia y pega.'; }
      };
      input.addEventListener('change', () => handle(input.files && input.files[0]));
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files && e.dataTransfer.files[0]); });
      srcBox.append(drop);
    } else if (st.mode === 'text') {
      const ta = el('textarea', { class: 'src', placeholder: 'Pega aquí el texto del tema (apuntes, el PDF copiado, un artículo…)', id: 'srcText', 'aria-label': 'Texto del tema' });
      const use = el('button', { class: 'btn primary', type: 'button', text: 'Usar este texto' });
      use.addEventListener('click', () => { const t = ta.value.trim(); if (t.length < 200) { toast('Pega al menos unos párrafos.'); return; } setText(t, t.split('\n')[0]); });
      srcBox.append(ta, el('div', { class: 'row' }, use));
    } else {
      const ta = el('textarea', { class: 'src', placeholder: '{ "title": "...", "sections": [...], "questions": [...], ... }', id: 'srcJson', 'aria-label': 'JSON del tema' });
      const file = el('input', { type: 'file', accept: 'application/json,.json', id: 'jsonFile', class: 'vh', 'aria-label': 'Archivo JSON' });
      file.addEventListener('change', async () => { const f = file.files && file.files[0]; if (f) ta.value = await f.text(); });
      const use = el('button', { class: 'btn primary', type: 'button', text: 'Importar tema' });
      use.addEventListener('click', () => { try { const raw = JSON.parse(ta.value); const p = normalizePack(Object.assign({}, raw, { id: raw.id && !state.packs.find(x => x.id === raw.id) ? raw.id : 'pack-' + Date.now().toString(36), builtin: false })); if (!p) throw new Error('El JSON no contiene preguntas válidas.'); addPack(p); } catch (e) { log.textContent = 'No se pudo importar: ' + (e && e.message ? e.message : e); } });
      srcBox.append(el('p', { class: 'small muted', text: 'Pega el JSON exportado desde Temas › Exportar JSON, o elige el archivo.' }), ta, el('div', { class: 'row' }, file, el('label', { class: 'btn', for: 'jsonFile' }, 'Elegir archivo'), use));
    }
  };
  [['pdf', 'PDF'], ['text', 'Texto pegado'], ['json', 'JSON de un tema']].forEach(([m, label]) => { const b = el('button', { class: 'tab' + (st.mode === m ? ' on' : ''), type: 'button', text: label }); b.addEventListener('click', () => { st.mode = m; tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderSource(); }); tabs.append(b); });
  renderSource();
  // Paso 2: método y tamaño
  const radios = el('div', { class: 'radios' });
  const mkRadio = (val, title, desc, enabled) => { const r = el('input', { type: 'radio', name: 'method', value: val, id: 'method-' + val, checked: st.method === val, disabled: !enabled }); const lab = el('label', { class: 'radio' + (st.method === val ? ' on' : '') + (enabled ? '' : ' off'), for: 'method-' + val }, r, el('div', {}, el('b', { text: title }), el('span', { text: desc }))); r.addEventListener('change', () => { st.method = val; st.picked = true; radios.querySelectorAll('.radio').forEach(x => x.classList.remove('on')); lab.classList.add('on'); }); return lab; };
  const buildRadios = () => radios.replaceChildren(
    mkRadio('claude', 'Con Claude (recomendado)', state.caps.sample ? 'Claude lee el texto y redacta preguntas, definiciones, verdadero/falso, huecos, clasificaciones, secuencias y porqués en español. Tarda uno o dos minutos y usa tu cuenta de Claude; la primera vez te pedirá permiso.' : 'No disponible en esta vista: abre la página desde claude.ai para usarlo. Mientras tanto, usa el modo automático.', !!state.caps.sample),
    mkRadio('auto', 'Automático sin Claude', 'Extrae del texto definiciones («Término: definición»), pasos numerados y frases clave para montar los juegos. Es instantáneo pero más básico.', true)
  );
  buildRadios();
  // Si la pantalla se abrió antes de que la capacidad de Claude estuviera resuelta, se activa la opción en cuanto llega.
  if (state.caps.sample === undefined && state.capsReady) state.capsReady.then(() => { if (state.caps.sample && document.contains(radios) && !st.picked) { st.method = 'claude'; buildRadios(); } });
  const sizes = el('div', { class: 'sizes' });
  Object.entries(GEN_SIZES).forEach(([k, v]) => { const b = el('button', { class: 'btn small' + (st.size === k ? ' on' : ''), type: 'button', text: v.label }); b.addEventListener('click', () => { st.size = k; sizes.querySelectorAll('.btn').forEach(x => x.classList.remove('on')); b.classList.add('on'); }); sizes.append(b); });
  const go = el('button', { class: 'btn primary big', type: 'button', text: 'Crear los juegos' });
  const stop = el('button', { class: 'btn text', type: 'button', text: 'Cancelar', hidden: true });
  let ctl = null;
  stop.addEventListener('click', () => { if (ctl) ctl.abort(); });
  go.addEventListener('click', async () => {
    const title = titleInput.value.trim() || 'Tema nuevo'; const text = st.text.slice(0, MAX_TEXT);
    go.disabled = true; stop.hidden = st.method !== 'claude'; status.replaceChildren();
    const line = el('div', { class: 'notice' }); status.append(line);
    try {
      let raw;
      if (st.method === 'claude') { ctl = new AbortController(); raw = await generateWithClaude(text, title, st.size, ctl.signal, msg => { line.textContent = msg; }); }
      else { line.textContent = 'Analizando el texto…'; await sleep(30); raw = heuristicPack(text, title, st.size); }
      const p = normalizePack(Object.assign(raw, { id: 'pack-' + Date.now().toString(36), title, builtin: false, source: raw.source || (st.mode === 'pdf' ? 'PDF subido' : 'Texto pegado') }));
      if (!p) throw new Error('No se pudo extraer contenido suficiente del texto.');
      line.className = 'notice good'; line.textContent = 'Listo: ' + p.questions.length + ' preguntas, ' + p.concepts.length + ' conceptos, ' + p.tf.length + ' V/F, ' + p.cloze.length + ' huecos, ' + p.sort.length + ' clasificaciones, ' + p.order.length + ' secuencias y ' + p.explain.length + ' porqués.';
      await sleep(600); addPack(p);
    } catch (e) {
      const code = e && e.code; let msg = (e && e.message) ? e.message : String(e);
      if (code === 'cancelled') msg = 'Cancelado.'; else if (code === 'not_granted') msg = 'No has permitido que la página use Claude. Puedes usar el modo automático.'; else if (code === 'rate_limited') msg = 'Claude está saturado o has llegado a tu límite de uso. Prueba más tarde o usa el modo automático.'; else if (code === 'invalid_json') msg = 'Claude devolvió una respuesta incompleta. Prueba con el tamaño Pequeño o vuelve a intentarlo.'; else if (code === 'prompt_too_large') msg = 'El texto es demasiado largo. Pega solo una parte.';
      line.className = 'notice bad'; line.textContent = msg;
    } finally { go.disabled = false; stop.hidden = true; ctl = null; }
  });
  step2.append(el('h2', { text: '2. Título y método' }), titleInput, radios, el('div', { class: 'row' }, el('span', { class: 'small muted', text: 'Cantidad de preguntas:' }), sizes), el('div', { class: 'row' }, go, stop), status);
  view.append(el('div', { class: 'page' },
    el('h1', { text: 'Añadir tema' }),
    el('p', { class: 'muted', text: 'Sube un PDF o pega su texto. La web crea un banco de preguntas nuevo con los mismos juegos y su propio repaso.' }),
    el('div', { class: 'block stack' }, el('h2', { text: '1. Fuente' }), tabs, srcBox, log, preview),
    step2,
    el('div', { class: 'row' }, el('button', { class: 'btn text', type: 'button', onclick: renderPacks }, icon('back', 'sm'), 'Volver a temas'))
  ));
  window.scrollTo({ top: 0 });
}
function addPack(p) { state.packs.push(p); saveCustomPacks(); setPack(p.id); toast('Tema añadido: ' + p.title); renderHome(); }

/* ---- Lectura de PDF en el navegador (pdf.js desde cdnjs, cargado solo cuando hace falta) ---- */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('no se pudo cargar el lector')); document.head.append(s); }); }
async function ensurePdfJs() {
  if (!window.pdfjsLib) { await loadScript(PDFJS + 'pdf.min.js'); }
  if (!window.pdfjsLib) throw new Error('el lector de PDF no está disponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  return window.pdfjsLib;
}
async function extractPdfText(file, onProgress) {
  const lib = await ensurePdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: false }).promise;
  let out = '';
  for (let pn = 1; pn <= doc.numPages; pn++) {
    onProgress(pn, doc.numPages);
    const page = await doc.getPage(pn); const tc = await page.getTextContent();
    let line = ''; let lastY = null;
    for (const it of tc.items) {
      if (typeof it.str !== 'string') continue;
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) { out += line.trim() + '\n'; line = ''; }
      line += it.str; line += it.hasEOL ? '\n' : ' '; lastY = y;
    }
    out += line.trim() + '\n\n';
    page.cleanup && page.cleanup();
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

/* ---- Generación con Claude (capacidad sample) ---- */
async function generateWithClaude(text, title, sizeKey, signal, onStatus) {
  const S = GEN_SIZES[sizeKey]; const s = state.caps.sample;
  const common = 'Eres un profesor de formación profesional que prepara material de estudio en español a partir de un texto. Usa SOLO la información del texto; no inventes datos. Escribe en español claro, con la terminología del propio texto. Divide el contenido en entre 3 y 6 secciones con nombres cortos tomados de los títulos del texto y usa esos mismos nombres en el campo "sec" de cada elemento.\n\nTÍTULO DEL TEMA: ' + title + '\n\nTEXTO:\n"""\n' + text + '\n"""\n\n';
  const promptA = common + 'Devuelve ÚNICAMENTE un objeto JSON con esta forma exacta (sin comentarios ni texto fuera del JSON):\n{\n "sections": ["Nombre sección 1", "Nombre sección 2"],\n "concepts": [{"term": "Término", "def": "Definición breve y fiel al texto (1-2 frases)", "sec": "Nombre sección"}],\n "cloze": [{"text": "Frase del texto con la palabra clave sustituida por ___", "answer": "palabra clave (1-3 palabras)", "alt": ["variante aceptable"], "hint": "pista breve", "sec": "Nombre sección"}],\n "sort": [{"title": "¿X o Y?", "cats": ["X", "Y"], "items": [{"t": "frase que pertenece a una categoría", "c": 0}], "sec": "Nombre sección"}],\n "order": [{"title": "Nombre del procedimiento", "steps": ["paso 1", "paso 2", "paso 3", "paso 4"], "sec": "Nombre sección"}],\n "explain": [{"q": "¿Por qué ...?", "model": "Respuesta modelo de 2-4 frases", "sec": "Nombre sección"}]\n}\nCantidades: exactamente ' + S.k + ' concepts (los términos más importantes, con definiciones distintas entre sí), ' + S.c + ' cloze (la respuesta debe ser una palabra o expresión concreta, nunca una frase larga), ' + S.sort + ' sort (categorías del texto que se confundan entre sí, con 2 o 3 categorías y entre 5 y 10 items cada una, "c" es el índice de la categoría), ' + S.order + ' order (procedimientos o secuencias reales del texto con 4-7 pasos en orden correcto) y ' + S.e + ' explain (preguntas de porqué o de comparación). Si el texto no tiene procedimientos, devuelve "order": [].';
  const promptB = common + 'Devuelve ÚNICAMENTE un objeto JSON con esta forma exacta (sin comentarios ni texto fuera del JSON):\n{\n "sections": ["Nombre sección 1", "Nombre sección 2"],\n "questions": [{"q": "Pregunta", "options": ["correcta", "distractor plausible", "distractor plausible", "distractor plausible"], "a": 0, "why": "Explicación breve de por qué es la correcta", "sec": "Nombre sección"}],\n "tf": [{"s": "Afirmación", "a": true, "why": "Explicación breve", "sec": "Nombre sección"}]\n}\nCantidades: exactamente ' + S.q + ' questions repartidas entre las secciones (la opción correcta siempre en la posición 0 con "a": 0; los distractores deben ser plausibles para quien ha leído el tema a medias, nunca absurdos; evita preguntas sobre números de figura o detalles triviales) y ' + S.tf + ' tf (mitad verdaderas, mitad falsas; las falsas deben ser errores típicos de comprensión, no inventos evidentes).';
  onStatus('Claude está leyendo el texto y redactando los juegos. Suele tardar entre uno y dos minutos…');
  const opts = { signal, modelTier: 'default', cache: false };
  let chars = 0; const prog = () => onStatus('Claude está escribiendo… ' + chars.toLocaleString('es-ES') + ' caracteres generados.');
  const callA = s.json(promptA, Object.assign({}, opts, { onText: ({ delta }) => { chars += delta.length; prog(); } }));
  const callB = s.json(promptB, Object.assign({}, opts, { onText: ({ delta }) => { chars += delta.length; prog(); } }));
  const [ra, rb] = await Promise.allSettled([callA, callB]);
  if (ra.status === 'rejected' && rb.status === 'rejected') throw ra.reason;
  const A = ra.status === 'fulfilled' && ra.value && typeof ra.value === 'object' ? ra.value : {};
  const B = rb.status === 'fulfilled' && rb.value && typeof rb.value === 'object' ? rb.value : {};
  const secNames = []; const seen = new Set();
  for (const n of [...(Array.isArray(A.sections) ? A.sections : []), ...(Array.isArray(B.sections) ? B.sections : [])]) { const k = norm(n); if (k && !seen.has(k)) { seen.add(k); secNames.push(String(n)); } }
  const partial = ra.status === 'rejected' ? 'test y verdadero/falso' : rb.status === 'rejected' ? 'conceptos, huecos, clasificaciones y secuencias' : null;
  if (partial) toast('Una de las dos partes falló; el tema se creó sin ' + (partial === 'test y verdadero/falso' ? 'conceptos ni huecos' : 'test ni V/F') + '.');
  return { sections: secNames.length ? secNames : ['General'], concepts: A.concepts, cloze: A.cloze, sort: A.sort, order: A.order, explain: A.explain, questions: B.questions, tf: B.tf, source: 'Generado con Claude a partir de ' + (title || 'un texto') };
}

/* ---- Generación automática sin Claude (heurística sobre el texto) ---- */
const STOP = new Set('para como pero porque aunque sobre entre desde hasta donde cuando mientras también además puede pueden permite permiten mediante través través según otros otras todos todas cada mismo misma mismos mismas este esta estos estas aquel aquella algún alguna muchos muchas poco pocos tanto tanta sino bien muy más menos siempre nunca ahora luego después antes entonces incluso solo sólo sólo hacer hace hacen tiene tienen tener forma formas parte partes caso casos ejemplo ejemplos nuestro nuestra nuestros nuestras suele suelen dentro fuera gran grande grandes nuevo nueva nuevos nuevas través cualquier cualquiera través'.split(/\s+/));
function heuristicPack(text, title, sizeKey) {
  const S = GEN_SIZES[sizeKey];
  const clean = text.replace(/\r/g, '').replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2').replace(/[ \t]+/g, ' ');
  const lines = joinLines(clean.split('\n').map(l => l.trim()).filter(Boolean));
  // Secciones: líneas cortas que empiezan por numeración tipo "1." o "1.2."
  const sections = []; const secPos = [];
  const joined = []; let pos = 0;
  lines.forEach(l => { joined.push({ l, pos }); pos += l.length + 1; });
  for (const { l, pos: p } of joined) {
    if (/^\d{1,2}(\.\d{1,2})*\.\s+[A-ZÁÉÍÓÚÑ¿][^.]{3,70}$/.test(l) && !/^\d+\.\s+(Accede|Haz|Pulsa|Escribe|Crea|Añade|Selecciona|Abre|Prueba|Rellena|Escoge|Introduce|Establece|Supera|Archiva|Destaca|Practica|Elimina|Aplica|Inicia|Personaliza|Configura|Indica|Envía|Guarda|Responde|Reenvía|Compara|Activa|Organiza|Cambia|Agrega|Localiza|Obtén|Modifica|Exporta|Importa|Instala|Importa)/.test(l) && sections.length < 8) {
      const name = l.replace(/^\d{1,2}(\.\d{1,2})*\.?\s+/, '').trim(); const multi = /^\d{1,2}\.\d/.test(l);
      if (name.length <= 60 && (multi || !/[¿?…]/.test(name)) && !sections.some(s => norm(s.name) === norm(name)) && !/^(sabías|recuerda|actividades|claves)/i.test(name.replace(/^[¿¡]/, ''))) { sections.push({ id: 's' + (sections.length + 1), name: name.slice(0, 60) }); secPos.push(p); }
    }
  }
  if (!sections.length) { sections.push({ id: 's1', name: 'General' }); secPos.push(0); }
  const secAt = (p) => { let id = sections[0].id; for (let i = 0; i < secPos.length; i++) if (secPos[i] <= p) id = sections[i].id; return id; };
  const flat = lines.join('\n');
  // Definiciones "Término: definición."
  const concepts = []; const seenTerms = new Set();
  const reDef = /(?:^|\n|[.!?]\s)\s*(?:[-–•]\s*)?([A-ZÁÉÍÓÚÑ][^.:;!?\n()]{2,45}?):\s+([^\n]{25,260}?[.!?])(?=\s|$)/g; let m;
  while ((m = reDef.exec(flat)) && concepts.length < S.k * 2) { const term = m[1].trim(); const def = cap(m[2].trim()); if (/\d/.test(term) || term.split(' ').length > 4 || /^(Fig|Figura|Actividades|Actividad|Nota|Ejemplo|Pregunta|Paso|Caso)/i.test(term) || /^[a-záéíóú]/.test(def)) continue; if (seenTerms.has(norm(term))) continue; seenTerms.add(norm(term)); concepts.push({ term, def, sec: secAt(m.index), pos: m.index }); }
  // Definiciones "X es/son un ..."
  const reIs = /(?:^|\n|[.!?]\s)\s*(?:El|La|Los|Las|Un|Una)?\s?([A-ZÁÉÍÓÚÑ][\p{L}\-]+(?: [\p{L}\-]+){0,3}?)\s(?:es|son)\s((?:un|una|el|la|los|las|cualquier|aquel|aquella|una forma|un método|un conjunto)[^\n]{20,220}?[.!?])(?=\s|$)/gu;
  while ((m = reIs.exec(flat)) && concepts.length < S.k * 2) { const term = m[1].trim(); const def = term + ' es ' + m[2].trim(); if (seenTerms.has(norm(term)) || STOP.has(norm(term)) || term.length < 3) continue; seenTerms.add(norm(term)); concepts.push({ term, def, sec: secAt(m.index), pos: m.index }); }
  concepts.sort((a, b) => a.pos - b.pos);
  const chosen = spread(concepts, S.k);
  // Secuencias numeradas (1. 2. 3. ...)
  const order = []; let cur = []; let curTitle = ''; let lastHeading = ''; let wantTitle = false; let curSec = sections[0].id; let lpos = 0;
  const flush = () => { if (cur.length >= 4 && cur.filter(s => /[¿?]/.test(s)).length < cur.length / 2 && !/^actividades/i.test(curTitle)) order.push({ title: curTitle, steps: cur, sec: curSec }); cur = []; };
  for (const l of lines) {
    const mm = /^(\d{1,2})\.\s+(.{8,})$/.exec(l);
    if (mm && !isHeading(l)) { const n = parseInt(mm[1], 10); if (n === 1) { flush(); curTitle = lastHeading || 'Procedimiento ' + (order.length + 1); curSec = secAt(lpos); } if (n === cur.length + 1) cur.push(firstSentence(mm[2])); }
    else if (wantTitle && l.length > 10 && l.length < 120 && !/[.:]$/.test(l)) { lastHeading = l; wantTitle = false; }
    else if (l.length > 4 && l.length < 70 && /^[A-ZÁÉÍÓÚÑ]/.test(l) && !/[.:]$/.test(l)) { lastHeading = l; wantTitle = /^caso práctico\s*\d*$/i.test(l); }
    lpos += l.length + 1;
  }
  flush();
  const orderOut = spread(order, S.order).map(o => ({ title: o.title.slice(0, 100), steps: o.steps.slice(0, 7), sec: o.sec }));
  // Huecos: una palabra clave de la definición
  const cloze = [];
  for (const k of shuffle(chosen)) { if (cloze.length >= S.c) break; const words = k.def.split(/\s+/); const cands = words.map((w, i) => ({ w: w.replace(/[^\p{L}\p{N}]/gu, ''), i })).filter(x => x.w.length >= 6 && !STOP.has(norm(x.w)) && norm(x.w) !== norm(k.term)); if (!cands.length) continue; const acr = cands.find(x => /^[A-Z0-9]{2,}$/.test(x.w)); const c = acr || cands.sort((a, b) => b.w.length - a.w.length)[0]; const txt = words.map((w, i) => i === c.i ? w.replace(c.w, '___') : w).join(' '); cloze.push({ text: txt, answer: c.w, hint: 'Tiene que ver con: ' + k.term, sec: k.sec }); }
  // Test: definición → término
  const questions = [];
  for (const k of shuffle(chosen)) { if (questions.length >= S.q) break; const others = sample(chosen.filter(x => x !== k), 3); if (others.length < 3) break; questions.push({ q: '¿A qué concepto corresponde esta descripción? «' + k.def + '»', options: [k.term, ...others.map(o => o.term)], a: 0, why: k.term + ': ' + k.def, sec: k.sec }); }
  // Verdadero/falso: definiciones correctas y cruzadas
  const tf = [];
  for (const k of shuffle(chosen)) { if (tf.length >= S.tf) break; const other = sample(chosen.filter(x => x !== k), 1)[0]; if (!other) break; if (tf.length % 2 === 0) tf.push({ s: k.term + ': ' + k.def, a: true, why: 'Es la definición que da el texto.', sec: k.sec }); else tf.push({ s: k.term + ': ' + other.def, a: false, why: 'Esa es la definición de ' + other.term + '. ' + k.term + ': ' + k.def, sec: k.sec }); }
  // Clasifica: fragmentos de definiciones de 2-3 conceptos de la misma sección
  const sort = [];
  const bySec = new Map(); chosen.forEach(k => { if (!bySec.has(k.sec)) bySec.set(k.sec, []); bySec.get(k.sec).push(k); });
  for (const [sec, ks] of bySec) { if (sort.length >= S.sort) break; const cats = ks.filter(k => k.def.split(/[,;]| y /).length >= 2).slice(0, 3); if (cats.length < 2) continue; const items = []; const seenIt = new Set(); cats.forEach((k, ci) => { k.def.replace(/^[^ ]+ (es|son) /, '').split(/[,;.]| y /).map(s => s.trim()).filter(s => s.length >= 15 && s.length <= 110 && !(/\(/.test(s) && !/\)/.test(s))).slice(0, 4).forEach(t => { const key = norm(t); if (seenIt.has(key)) return; seenIt.add(key); items.push({ t: cap(t), c: ci }); }); }); if (items.length >= 4) sort.push({ title: '¿' + cats.map(c => c.term).join(' o ') + '?', cats: cats.map(c => c.term), items, sec }); }
  // Explícalo
  const explain = sample(chosen, S.e).map(k => ({ q: 'Explica con tus palabras qué es «' + k.term + '» y para qué sirve.', model: k.def, sec: k.sec }));
  return { sections, concepts: chosen.map(k => ({ term: k.term, def: k.def, sec: k.sec })), cloze, questions, tf, sort, order: orderOut, explain };
}
function firstSentence(s) { const m = /^(.{10,140}?[.!?])(\s|$)/.exec(s); return (m ? m[1] : s.slice(0, 140)).trim(); }
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
// Une las líneas partidas por el salto de página o de columna del PDF en frases completas.
const JOIN_TAIL = /\b(en|de|la|el|los|las|y|o|a|con|por|para|que|del|al|un|una|su|sus|se|lo|es|son|no|más|muy|como|sin|sobre|entre|desde|hasta|ni|e|u|cuyo|cuya|al|the)$/i;
const isHeading = (l) => /^\d{1,2}(\.\d{1,2})*\.\s+\S/.test(l) && l.length < 80 && !/[.:;]$/.test(l);
function joinLines(lines) {
  const out = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const startsLow = /^[\p{Ll}(«"“¿¡]/u.test(l) || /^\d+[^.]/.test(l);
    const joinable = prev !== undefined && !/[.:;!?]$/.test(prev) && !/^\d{1,2}\.\s/.test(l) && (startsLow || /,$/.test(prev) || JOIN_TAIL.test(prev));
    // Un título numerado solo se une con la línea siguiente si esta empieza en minúscula (continuación real).
    if (joinable && (!isHeading(prev) || /^\p{Ll}/u.test(l))) out[out.length - 1] = prev + ' ' + l;
    else out.push(l);
  }
  return out;
}
function spread(arr, n) { if (arr.length <= n) return arr.slice(); const out = []; const step = arr.length / n; for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]); return out; }

/* ===================== Arranque ===================== */
function boot() {
  applyTheme(); loadState(); renderHome();
  if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); const onChange = () => { if (theme.mode === 'system') applyTheme(); }; if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange); }
  const useCap = async (name) => { try { if (!window.claude || typeof window.claude.use !== 'function') return null; return await window.claude.use(name); } catch { return null; } };
  state.capsReady = Promise.all([
    useCap('sample').then(fn => { state.caps.sample = fn || null; }),
    useCap('downloads').then(d => { state.caps.downloads = d || null; })
  ]);
}
boot();
