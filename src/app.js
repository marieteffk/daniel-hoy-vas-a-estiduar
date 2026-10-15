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
const state = { packs: [], packId: null, prog: {}, runId: 0, caps: { sample: undefined, downloads: undefined } };

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
function markDay() { const d = new Date().toISOString().slice(0, 10); const days = LS.get('ra.days', []); if (!days.includes(d)) { days.push(d); LS.set('ra.days', days.slice(-400)); } }
function dayStreak() {
  const days = new Set(LS.get('ra.days', [])); let n = 0; const d = new Date();
  for (; ;) { const k = d.toISOString().slice(0, 10); if (days.has(k)) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
function bestKey(game) { return 'ra.best.' + state.packId + '.' + game; }

/* ===================== Cabecera ===================== */
function fillPackSelect() {
  const sel = $('#packSel'); sel.replaceChildren();
  for (const p of state.packs) sel.append(el('option', { value: p.id, selected: p.id === state.packId }, p.title));
}
$('#packSel').addEventListener('change', (e) => { setPack(e.target.value); renderHome(); });
$('#brandBtn').addEventListener('click', () => renderHome());
$('#addBtn').addEventListener('click', () => renderAdd());

/* ===================== Inicio ===================== */
const GAME_DEFS = [
  { key: 'quiz', name: 'Test rápido', desc: 'Diez preguntas con cuatro opciones. Cada respuesta trae su explicación.', principle: 'Práctica de recuperación', needs: p => p.questions.length >= 4 },
  { key: 'cloze', name: 'Completa el hueco', desc: 'Escribe la palabra que falta sin ver opciones. Hay pistas si te atascas.', principle: 'Efecto de generación', needs: p => p.cloze.length >= 3 },
  { key: 'tf', name: 'Verdadero o falso', desc: 'Afirmaciones con trampa. Lo importante es el porqué que aparece después.', principle: 'Recuperación con feedback', needs: p => p.tf.length >= 4 },
  { key: 'match', name: 'Empareja', desc: 'Une cada término con su definición. Conceptos parecidos aparecen juntos a propósito.', principle: 'Discriminación e intercalado', needs: p => p.concepts.length >= 4 },
  { key: 'sort', name: 'Clasifica', desc: 'Decide a qué categoría pertenece cada frase: IMAP o POP3, cita o tarea...', principle: 'Intercalado de categorías', needs: p => p.sort.length >= 1 },
  { key: 'order', name: 'Ordena los pasos', desc: 'Reconstruye el orden de los casos prácticos tocando los pasos en secuencia.', principle: 'Conocimiento procedimental', needs: p => p.order.length >= 1 },
  { key: 'cards', name: 'Tarjetas', desc: 'Recuerda la definición antes de girar la tarjeta. Las que fallas vuelven antes.', principle: 'Repaso espaciado', needs: p => p.concepts.length >= 3 },
  { key: 'explain', name: 'Explícalo', desc: 'Responde a un porqué con tus palabras y compáralo con la respuesta modelo.', principle: 'Interrogación elaborativa', needs: p => p.explain.length >= 1 }
];
function renderHome() {
  state.runId++; const p = pack(); const view = $('#view'); view.replaceChildren();
  const items = allItems(p); const m = Math.round(mastery(items) * 100); const due = dueCount(items); const streak = dayStreak();
  const seen = items.filter(it => state.prog[it.id] && state.prog[it.id].seen).length;
  view.append(el('section', { class: 'hero' },
    el('p', { class: 'eyebrow', text: p.builtin ? 'Tema incluido' : 'Tema añadido' }),
    el('h1', { text: p.title }),
    p.subtitle ? el('p', { class: 'sub', text: p.subtitle }) : null,
    p.source ? el('p', { class: 'src', text: 'Fuente: ' + p.source }) : null
  ));
  view.append(el('div', { class: 'stats' },
    el('div', { class: 'stat' }, el('div', { class: 'v', text: m + '%' }), el('div', { class: 'l', text: 'Dominio del tema' })),
    el('div', { class: 'stat' }, el('div', { class: 'v', text: String(due) }), el('div', { class: 'l', text: 'Para repasar hoy' })),
    el('div', { class: 'stat' }, el('div', { class: 'v', text: seen + '/' + items.length }), el('div', { class: 'l', text: 'Elementos vistos' })),
    el('div', { class: 'stat' }, el('div', { class: 'v', text: streak + (streak === 1 ? ' día' : ' días') }), el('div', { class: 'l', text: 'Racha de estudio' }))
  ));
  view.append(el('button', { class: 'ruleta', type: 'button', onclick: () => startGame('mix') },
    el('div', {}, el('div', { class: 'h', text: 'Ruleta: sesión aleatoria' }), el('p', { text: 'Doce rondas que mezclan todos los juegos y todas las secciones. Prioriza lo que tienes pendiente de repasar.' })),
    el('div', { class: 'go', text: 'Jugar' })
  ));
  const grid = el('div', { class: 'games' });
  for (const g of GAME_DEFS) {
    const ok = g.needs(p); const best = LS.get(bestKey(g.key), null);
    grid.append(el('button', { class: 'game' + (ok ? '' : ' disabled'), type: 'button', disabled: !ok, onclick: () => startGame(g.key) },
      el('div', { class: 'name', text: g.name }), el('div', { class: 'desc', text: ok ? g.desc : 'Este tema no tiene contenido para este juego.' }),
      el('div', { class: 'foot' }, el('span', { class: 'tag', text: g.principle }), best ? el('span', { class: 'rec', text: 'Récord ' + best }) : null)
    ));
  }
  view.append(el('h2', { class: 'eyebrow', text: 'Juegos', style: 'margin-bottom:10px' }), grid);
  const secs = el('div', { class: 'secs' });
  for (const s of p.sections) {
    const its = items.filter(it => it.sec === s.id); if (!its.length) continue;
    const pct = Math.round(mastery(its) * 100);
    secs.append(el('div', { class: 'sec' }, el('span', { text: s.name }), el('div', { class: 'meter' }, el('i', { style: 'width:' + pct + '%', class: pct < 40 ? 'amber' : '' })), el('span', { class: 'pct', text: pct + '%' })));
  }
  view.append(el('section', { class: 'card stack' }, el('h2', { class: 'eyebrow', text: 'Dominio por sección' }), secs, el('p', { class: 'small muted', text: 'El dominio sube cuando aciertas un elemento varias veces en días distintos y baja cuando lo fallas. Así reparte el repaso.' })));
  view.append(el('div', { class: 'homeLinks' },
    el('button', { class: 'btn', type: 'button', onclick: renderWhy }, '¿Por qué estos juegos?'),
    el('button', { class: 'btn', type: 'button', onclick: renderAdd }, 'Añadir otro PDF o tema'),
    el('button', { class: 'btn ghost', type: 'button', onclick: renderPacks }, 'Gestionar temas')
  ));
  window.scrollTo({ top: 0 });
}

/* ===================== Motor de rondas ===================== */
function buildShell(title, total) {
  const root = el('section', { class: 'shell' });
  const t = el('div', { class: 't', text: title });
  const chipPts = el('span', { class: 'chip', text: '0 pts' });
  const chipStreak = el('span', { class: 'chip', text: 'racha 0' });
  const chipStep = el('span', { class: 'chip', text: '1/' + total });
  const exit = el('button', { class: 'btn small ghost', type: 'button', text: 'Salir', onclick: () => renderHome() });
  const head = el('div', { class: 'shell-head' }, el('div', { class: 'row' }, t), el('div', { class: 'row' }, el('div', { class: 'chips' }, chipStep, chipPts, chipStreak), exit));
  const barFill = el('i', { style: 'width:0%' }); const bar = el('div', { class: 'bar' }, barFill);
  const body = el('div', { class: 'body' });
  const verdict = el('div', { class: 'verdict' }); const why = el('div', { class: 'why' });
  const nextBtn = el('button', { class: 'btn primary', type: 'button', text: 'Siguiente' });
  const fb = el('div', { class: 'fb' }, el('div', {}, verdict, why), nextBtn);
  root.append(head, bar, body, fb);
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
    setStep(i, n) { chipStep.textContent = (i + 1) + '/' + n; barFill.style.width = Math.round((i / n) * 100) + '%'; },
    setScore(pts, streak) { chipPts.textContent = pts + ' pts'; chipStreak.textContent = 'racha ' + streak; chipStreak.classList.toggle('hot', streak >= 3); },
    feedback(res) {
      fb.className = 'fb show ' + (res.ok ? 'ok' : 'ko');
      verdict.textContent = res.msg || (res.ok ? sample(['¡Correcto!', '¡Eso es!', '¡Bien visto!', '¡Exacto!'], 1)[0] : 'No exactamente.');
      why.textContent = res.why || '';
      nextBtn.textContent = res.last ? 'Ver resultado' : 'Siguiente';
      nextBtn.focus({ preventScroll: true });
      fb.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    },
    hideFeedback() { fb.className = 'fb'; },
    next() { return new Promise(r => { nextResolve = r; }); },
    setKeys(fn) { keys = fn; },
    destroy() { document.removeEventListener('keydown', onKey); }
  };
  return shell;
}
async function runRounds(def) {
  if (!def.rounds.length) { toast('Este tema no tiene contenido suficiente para este juego.'); return renderHome(); }
  const run = ++state.runId; const view = $('#view'); view.replaceChildren();
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
function showSummary(def, s) {
  const view = $('#view'); view.replaceChildren();
  const pct = Math.round((s.correct / s.total) * 100);
  const key = bestKey(def.key); const prev = LS.get(key, null); let record = false;
  const scoreStr = s.correct + '/' + s.total;
  if (!prev || s.correct > parseInt(prev, 10)) { LS.set(key, scoreStr); record = !!prev || s.correct === s.total; }
  const r = 46, c = 2 * Math.PI * r;
  const ring = el('div', { class: 'ringWrap' });
  ring.innerHTML = '<svg class="ring" viewBox="0 0 110 110" aria-hidden="true"><circle class="track" cx="55" cy="55" r="' + r + '"></circle><circle class="val" cx="55" cy="55" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '"></circle><text x="55" y="64" text-anchor="middle">' + pct + '%</text></svg>';
  const missed = s.results.filter(x => !x.ok && x.review);
  const headline = pct === 100 ? 'Pleno. Nada que objetar.' : pct >= 80 ? 'Muy bien. Casi todo dominado.' : pct >= 50 ? 'Buen avance. Repasa lo marcado.' : 'Primer contacto. Lo fallado volverá pronto.';
  view.append(el('section', { class: 'shell' },
    el('div', { class: 'shell-head' }, el('div', { class: 't', text: def.title + ' · resultado' })),
    el('div', { class: 'body summary' },
      el('div', { class: 'summaryTop' }, ring, el('div', { class: 'summaryNums' },
        el('div', { class: 'h', text: headline }),
        el('div', { text: s.correct + ' de ' + s.total + ' rondas acertadas · ' + s.points + ' puntos · mejor racha ' + s.best }),
        record ? el('span', { class: 'tag amber', text: 'Nuevo récord' }) : (prev ? el('span', { class: 'muted small', text: 'Récord anterior: ' + prev }) : null)
      )),
      missed.length ? el('div', { class: 'stack tight' }, el('div', { class: 'eyebrow', text: 'Para repasar' }), el('div', { class: 'missed' }, missed.map(x => el('div', { class: 'm' }, el('b', { text: x.review.q }), el('span', { text: x.review.a }))))) : el('p', { class: 'muted', text: 'No fallaste ninguna ronda. Estas preguntas tardarán más en volver a salir.' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', type: 'button', onclick: () => startGame(def.key) }, 'Otra partida'),
        def.key !== 'mix' ? el('button', { class: 'btn', type: 'button', onclick: () => startGame('mix') }, 'Ruleta') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: renderHome }, 'Inicio')
      )
    )
  ));
  if (pct >= 80) confetti();
  window.scrollTo({ top: 0 });
}

/* ===================== Rondas ===================== */
function roundHeader(body, label, text) { body.append(el('div', { class: 'eyebrow', text: label }), el('h2', { class: 'q', text })); }
function mcRound(q) {
  return {
    type: 'quiz', play: (body, shell) => new Promise(resolve => {
      roundHeader(body, secName(q.sec), q.q);
      const opts = shuffle(q.options.map((t, i) => ({ t, ok: i === q.a })));
      const list = el('div', { class: 'opts' }); const btns = [];
      opts.forEach((o, idx) => {
        const b = el('button', { class: 'opt', type: 'button' }, el('span', { class: 'key', text: String(idx + 1) }), el('span', { text: o.t }));
        b.addEventListener('click', () => {
          btns.forEach((x, j) => { x.disabled = true; if (opts[j].ok) x.classList.add('is-right'); });
          if (!o.ok) b.classList.add('is-wrong');
          grade(q.id, o.ok);
          resolve({ ok: o.ok, why: q.why, review: o.ok ? null : { q: q.q, a: 'Respuesta: ' + q.options[q.a] } });
        });
        btns.push(b); list.append(b);
      });
      body.append(list, el('p', { class: 'small muted', text: 'Atajo: pulsa 1-' + opts.length + ' para responder.' }));
      shell.setKeys(e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length && !btns[0].disabled) btns[n - 1].click(); });
    })
  };
}
function tfRound(t) {
  return {
    type: 'tf', play: (body, shell) => new Promise(resolve => {
      roundHeader(body, secName(t.sec), t.s);
      const list = el('div', { class: 'opts two' }); const btns = [];
      [['Verdadero', true], ['Falso', false]].forEach(([label, val]) => {
        const b = el('button', { class: 'opt', type: 'button', text: label });
        b.addEventListener('click', () => {
          btns.forEach(x => x.disabled = true); const ok = val === t.a;
          b.classList.add(ok ? 'is-right' : 'is-wrong'); if (!ok) btns[t.a ? 0 : 1].classList.add('is-right');
          grade(t.id, ok);
          resolve({ ok, why: (t.a ? 'Es verdadero. ' : 'Es falso. ') + (t.why || ''), review: ok ? null : { q: t.s, a: (t.a ? 'Verdadero. ' : 'Falso. ') + (t.why || '') } });
        });
        btns.push(b); list.append(b);
      });
      body.append(list, el('p', { class: 'small muted', text: 'Atajo: V o F.' }));
      shell.setKeys(e => { const k = e.key.toLowerCase(); if (btns[0].disabled) return; if (k === 'v' || k === '1') btns[0].click(); if (k === 'f' || k === '2') btns[1].click(); });
    })
  };
}
function clozeRound(c) {
  return {
    type: 'cloze', play: (body) => new Promise(resolve => {
      body.append(el('div', { class: 'eyebrow', text: secName(c.sec) }));
      const parts = c.text.split('___');
      const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Palabra que falta', id: 'cloze-' + c.id });
      input.style.width = Math.max(8, Math.min(26, c.answer.length + 3)) + 'ch';
      const line = el('p', { class: 'cloze' }); parts.forEach((part, i) => { line.append(part); if (i < parts.length - 1) line.append(input); });
      const hint = el('p', { class: 'hint' });
      let hintLevel = 0; let done = false;
      const check = el('button', { class: 'btn primary', type: 'button', text: 'Comprobar' });
      const hintBtn = el('button', { class: 'btn', type: 'button', text: 'Pista' });
      const giveUp = el('button', { class: 'btn ghost', type: 'button', text: 'No lo sé' });
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
      body.append(el('div', { class: 'eyebrow', text: 'Empareja' }), el('h2', { class: 'q', text: 'Toca un término y después su definición.' }));
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
            selected.classList.remove('is-sel'); selected.classList.add('is-done'); d.classList.add('is-done');
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
    type: 'sort', label: s.title, play: (body, shell) => new Promise(resolve => {
      const items = shuffle(s.items).slice(0, maxItems || s.items.length);
      body.append(el('div', { class: 'eyebrow', text: secName(s.sec) }), el('h2', { class: 'q', text: s.title }));
      const counter = el('span', { class: 'chip', text: '1/' + items.length });
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
    type: 'order', label: o.title, play: (body) => new Promise(resolve => {
      body.append(el('div', { class: 'eyebrow', text: secName(o.sec) }), el('h2', { class: 'q', text: o.title }), el('p', { class: 'muted small', text: 'Toca los pasos en el orden correcto. Se irán numerando.' }));
      const shuffled = shuffle(o.steps.map((t, i) => ({ t, i })));
      const list = el('div', { class: 'steps' }); const picked = []; const btns = [];
      const undo = el('button', { class: 'btn ghost', type: 'button', text: 'Deshacer', disabled: true });
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
        const model = el('div', { class: 'model' }, el('div', { class: 'eyebrow', text: 'Respuesta modelo' }), el('p', { text: e.model }));
        const rate = el('div', { class: 'rate' });
        const mk = (label, sub, cls, result) => { const b = el('button', { class: 'btn ' + cls, type: 'button' }, label, el('small', { text: sub })); b.addEventListener('click', () => { rate.querySelectorAll('button').forEach(x => x.disabled = true); grade(e.id, result); resolve({ ok: result !== false, msg: result === true ? 'Lo tenías claro.' : result === 'partial' ? 'A medias: volverá a salir.' : 'Apuntado para repasar.', why: '', review: result === true ? null : { q: e.q, a: e.model } }); }); return b; };
        rate.append(mk('Lo tenía bien', 'mismas ideas clave', 'ok', true), mk('A medias', 'me faltaba algo', '', 'partial'), mk('No lo sabía', 'o lo tenía mal', 'ko', false));
        box.append(model, el('div', { class: 'eyebrow', text: '¿Cómo te ha ido? Sé sincero: así se ajusta el repaso.' }), rate);
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
  const run = ++state.runId; const p = pack(); const view = $('#view'); view.replaceChildren();
  const deck = pick(p.concepts, Math.min(12, p.concepts.length));
  const shell = buildShell('Tarjetas', deck.length); view.append(shell.root); window.scrollTo({ top: 0 });
  let i = 0; let known = 0, partial = 0, missed = 0; const missedList = [];
  const guard = () => { if (run !== state.runId) { shell.destroy(); return true; } return false; };
  const next = () => {
    if (guard()) return;
    if (i >= deck.length) {
      shell.destroy(); LS.set(bestKey('cards'), known + '/' + deck.length);
      const view2 = $('#view'); view2.replaceChildren();
      const dueNow = dueCount(p.concepts);
      view2.append(el('section', { class: 'shell' }, el('div', { class: 'shell-head' }, el('div', { class: 't', text: 'Tarjetas · resultado' })),
        el('div', { class: 'body summary' },
          el('div', { class: 'summaryNums' }, el('div', { class: 'h', text: known === deck.length ? 'Todas sabidas.' : 'Sesión terminada.' }), el('div', { text: known + ' sabidas · ' + partial + ' a medias · ' + missed + ' por aprender' }), el('div', { class: 'muted small', text: 'Las que sabías volverán dentro de unos días; las falladas, en la próxima sesión. Tarjetas pendientes ahora mismo: ' + dueNow + '.' })),
          missedList.length ? el('div', { class: 'stack tight' }, el('div', { class: 'eyebrow', text: 'Para repasar' }), el('div', { class: 'missed' }, missedList.map(k => el('div', { class: 'm' }, el('b', { text: k.term }), el('span', { text: k.def }))))) : null,
          el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: () => startGame('cards') }, 'Otra tanda'), el('button', { class: 'btn', type: 'button', onclick: () => startGame('mix') }, 'Ruleta'), el('button', { class: 'btn ghost', type: 'button', onclick: renderHome }, 'Inicio'))
        )));
      if (known >= deck.length * 0.8) confetti();
      return;
    }
    const k = deck[i]; const r = state.prog[k.id]; const box = r ? r.box : 0; const reverse = Math.random() < 0.3;
    shell.setStep(i, deck.length); shell.setScore(known * 10, 0); shell.body.replaceChildren(); shell.hideFeedback();
    const boxes = el('div', { class: 'boxes', title: 'Caja de repaso' }); for (let b = 0; b < 5; b++) boxes.append(el('i', { class: b <= box && r ? 'on' : '' }));
    const card = el('div', { class: 'flashCard' }, el('div', { class: 'face' }, el('div', { class: 'eyebrow', text: reverse ? 'Definición · ¿qué término es?' : 'Término · ¿cuál es su definición?' }), el('div', { class: reverse ? 'ans' : 'big', text: reverse ? k.def : k.term })));
    const flip = el('button', { class: 'btn primary big', type: 'button', text: 'Mostrar respuesta' });
    const rate = el('div', { class: 'rate', hidden: true });
    const mk = (label, sub, cls, result) => { const b = el('button', { class: 'btn ' + cls, type: 'button' }, label, el('small', { text: sub })); b.addEventListener('click', () => { grade(k.id, result); if (result === true) known++; else if (result === 'partial') partial++; else { missed++; missedList.push(k); } i++; next(); }); return b; };
    rate.append(mk('No la sabía', 'vuelve enseguida', 'ko', false), mk('Casi', 'me faltaba algo', '', 'partial'), mk('La sabía', 'sube de caja', 'ok', true));
    flip.addEventListener('click', () => { card.classList.add('flipped'); card.replaceChildren(el('div', { class: 'face' }, el('div', { class: 'eyebrow', text: reverse ? k.term : 'Definición' }), el('div', { class: reverse ? 'big' : 'ans', text: reverse ? k.term : k.def }))); flip.hidden = true; rate.hidden = false; });
    shell.setKeys(e => { if (e.key === ' ' || e.key === 'Enter') { if (!flip.hidden) { e.preventDefault(); flip.click(); } } else if (!rate.hidden) { const n = parseInt(e.key, 10); const bs = rate.querySelectorAll('button'); if (n >= 1 && n <= 3) bs[n - 1].click(); } });
    shell.body.append(el('div', { class: 'row between' }, el('span', { class: 'eyebrow', text: secName(k.sec) }), boxes), el('div', { class: 'flash' }, card), el('div', { class: 'row' }, flip), rate, el('p', { class: 'small muted', text: 'Intenta recordarlo de verdad antes de mostrar la respuesta: ese esfuerzo es lo que fija la memoria. Atajos: espacio para girar, 1-3 para valorar.' }));
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

/* ===================== Confeti ===================== */
function confetti() {
  if (reducedMotion()) return;
  const c = $('#confetti'); const ctx = c.getContext('2d'); if (!ctx) return;
  c.hidden = false; c.width = innerWidth; c.height = innerHeight;
  const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), getComputedStyle(document.documentElement).getPropertyValue('--amber').trim(), getComputedStyle(document.documentElement).getPropertyValue('--good').trim()];
  const parts = Array.from({ length: 90 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * 100, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, s: 6 + Math.random() * 6, r: Math.random() * Math.PI, col: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const tick = (t) => { ctx.clearRect(0, 0, c.width, c.height); for (const p of parts) { p.x += p.vx; p.y += p.vy; p.r += .1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); } if (t - t0 < 1800) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, c.width, c.height); c.hidden = true; } };
  requestAnimationFrame(tick);
}

/* ===================== Por qué estos juegos ===================== */
function renderWhy() {
  state.runId++; const view = $('#view'); view.replaceChildren();
  const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener' }, text);
  const P = (g, title, body) => el('div', { class: 'principle' }, el('div', { class: 'g', text: g }), el('h3', { text: title }), el('p', { text: body }));
  view.append(el('div', { class: 'prose' },
    el('p', { class: 'eyebrow', text: 'Diseño basado en evidencia' }),
    el('h1', { text: '¿Por qué estos juegos y no otros?' }),
    el('p', { text: 'Los juegos de esta web no están elegidos por ser divertidos sin más. Cada uno aplica una técnica de estudio que la investigación en psicología cognitiva ha comparado una y otra vez con releer o subrayar, y que sale ganando. Esta es la lista corta.' }),
    el('h2', { text: 'Lo que dice la investigación' }),
    P('Test rápido · Verdadero o falso · Ruleta', 'Práctica de recuperación', 'Recordar algo de memoria fija más que volver a leerlo. Un metaanálisis de 2017 con más de 200 estudios (Adesope, Trevisan y Sundararajan) encontró que hacerse preguntas gana a releer de forma consistente, en aula y en laboratorio, y sobre todo cuando el examen es días después. Dunlosky y colaboradores (2013) la clasificaron como una de las dos únicas técnicas de utilidad alta. Por eso aquí no hay modo lectura: todo es pregunta.'),
    P('Test rápido · Verdadero o falso', 'Feedback inmediato con explicación', 'Las opciones de un test pueden colarte ideas falsas si eliges mal y nadie te corrige (Marsh y otros, 2007). Con corrección después de cada respuesta ese riesgo desaparece y el aprendizaje mejora (Butler y Roediger, 2008; Kang y otros, 2007). Cada pregunta de esta web muestra la respuesta correcta y un porqué.'),
    P('Completa el hueco · Tarjetas', 'Efecto de generación y recuerdo libre', 'Producir la respuesta uno mismo deja más huella que reconocerla entre opciones. El metaanálisis de Bertsch y otros (2007) estima ese efecto en d ≈ 0,40, y Kang y otros (2007) vieron que las preguntas de respuesta corta con feedback rendían mejor que el tipo test a una semana vista. Por eso hay un juego en el que escribes la palabra, y en Tarjetas intentas recordar antes de girar.'),
    P('Tarjetas · Para repasar hoy', 'Práctica distribuida (repaso espaciado)', 'Repartir el estudio en varios días retiene mucho más que concentrarlo. Cepeda y otros (2006) lo confirmaron en 317 experimentos y vieron que el hueco óptimo entre repasos crece cuanto más lejos está el examen. Aquí cada elemento vive en una caja tipo Leitner: si lo aciertas vuelve a los 1, 3, 7 o 14 días; si lo fallas vuelve al día siguiente. Todos los juegos comparten ese calendario.'),
    P('Clasifica · Empareja · Ruleta', 'Intercalado', 'Mezclar categorías parecidas en vez de estudiarlas en bloque mejora la capacidad de distinguirlas. Brunmair y Richter (2019) midieron un efecto medio de g = 0,42 en 238 comparaciones, mayor cuanto más se confunden las categorías entre sí (IMAP y POP3, cita y reunión). Yan y Sana (2021) comprobaron que el beneficio aparece en la mayoría de las personas aunque casi nadie lo intuya. La Ruleta mezcla además tipos de pregunta y secciones.'),
    P('Explícalo', 'Interrogación elaborativa y autoexplicación', 'Responder a un porqué con tus palabras obliga a conectar la idea con lo que ya sabes. Dunlosky y otros (2013) la valoran como técnica de utilidad moderada, útil sobre todo para contenido factual como este tema. Comparar con la respuesta modelo y, si quieres, pedir a Claude que la valore, cierra el ciclo con feedback.'),
    P('Ordena los pasos', 'Conocimiento procedimental', 'Los casos prácticos del tema son secuencias (crear una cuenta, configurar POP3, exportar un PST). Reconstruir el orden es una forma de recuperación que además encaja con cómo se evalúan estos procedimientos en clase.'),
    P('Puntos, rachas, aleatoriedad', 'Juego como envoltorio, no como sustituto', 'Los metaanálisis sobre juegos serios (Wouters y otros, 2013: d = 0,29 en aprendizaje y 0,36 en retención; Sitzmann, 2011) muestran beneficios moderados que crecen cuando se juega en varias sesiones y como complemento de otra instrucción. Sailer y Homner (2020) añaden que la competición pura puede desmotivar a parte del alumnado. Por eso hay puntos y rachas, pero no rankings, y cada partida se baraja para que repetir siga siendo un reto.'),
    el('h2', { text: 'Lo que no encontrarás aquí' }),
    el('p', { text: 'Releer, subrayar y resumir figuran entre las técnicas de utilidad baja en la revisión de Dunlosky (2013): dan sensación de dominio sin producirlo. Esta web no tiene modo lectura a propósito. Si necesitas repasar el texto, vuelve al PDF, pero vuelve después de haber intentado recordar.' }),
    el('h2', { text: 'Fuentes' }),
    el('ul', { class: 'sources' },
      el('li', {}, 'Adesope, Trevisan y Sundararajan (2017). Rethinking the use of tests: a meta-analysis of practice testing. ', link('https://journals.sagepub.com/doi/10.3102/0034654316689306', 'Review of Educational Research'), ' · ', link('https://www.learningscientists.org/blog/2017/2/9-1', 'resumen en The Learning Scientists')),
      el('li', {}, 'Dunlosky, Rawson, Marsh, Nathan y Willingham (2013). Improving students’ learning with effective learning techniques. ', link('https://www.citedrive.com/en/discovery/improving-students-learning-with-effective-learning-techniques', 'Psychological Science in the Public Interest')),
      el('li', {}, 'Cepeda, Pashler, Vul, Wixted y Rohrer (2006). Distributed practice in verbal recall tasks. ', link('https://digitalcommons.usf.edu/psy_facpub/1771/', 'Psychological Bulletin')),
      el('li', {}, 'Brunmair y Richter (2019). Similarity matters: a meta-analysis of interleaved learning. ', link('https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf', 'Psychological Bulletin (preprint)')),
      el('li', {}, 'Yan y Sana (2021). The robustness of the interleaving benefit. ', link('https://www.Gwern.net/doc/psychology/spaced-repetition/2021-yan.pdf', 'Journal of Applied Research in Memory and Cognition')),
      el('li', {}, 'Bertsch, Pesta, Wiscott y McDaniel (2007). The generation effect: a meta-analytic review. ', link('https://pubmed.ncbi.nlm.nih.gov/17645161/', 'Memory & Cognition')),
      el('li', {}, 'Butler y Roediger (2008); Kang, McDermott y Roediger (2007); Marsh y otros (2007), sobre formatos de test y feedback. ', link('https://www.mojquiz.com/multiple-choice-vs-free-recall', 'resumen comparativo')),
      el('li', {}, 'Wouters, van Nimwegen, van Oostendorp y van der Spek (2013). A meta-analysis of the cognitive and motivational effects of serious games. ', link('https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/', 'Journal of Educational Psychology'), ' · Sitzmann (2011), resumidos en ', link('https://karlkapp.com/?p=4333', 'Karl Kapp')),
      el('li', {}, 'Sailer y Homner (2020). The gamification of learning: a meta-analysis. ', link('https://link.springer.com/article/10.1007/s10648-019-09498-w', 'Educational Psychology Review'))
    ),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: renderHome }, 'Volver al inicio'))
  ));
  window.scrollTo({ top: 0 });
}

/* ===================== Gestionar temas ===================== */
function renderPacks() {
  state.runId++; const view = $('#view'); view.replaceChildren();
  const list = el('div', { class: 'stack' });
  for (const p of state.packs) {
    const counts = p.questions.length + ' test · ' + p.tf.length + ' V/F · ' + p.cloze.length + ' huecos · ' + p.concepts.length + ' conceptos · ' + p.sort.length + ' clasif. · ' + p.order.length + ' secuencias · ' + p.explain.length + ' porqués';
    const actions = el('div', { class: 'row' });
    const row = el('div', { class: 'card packRow' }, el('div', { class: 'stack tight' }, el('b', { text: p.title }), el('span', { class: 'counts', text: counts }), p.id === state.packId ? el('span', { class: 'tag', text: 'Tema activo' }) : null), actions);
    actions.append(el('button', { class: 'btn small', type: 'button', onclick: () => { setPack(p.id); renderHome(); } }, 'Jugar'));
    actions.append(el('button', { class: 'btn small', type: 'button', onclick: () => exportPack(p, row) }, 'Exportar JSON'));
    const confirmBtn = (label, cls, fn) => { const b = el('button', { class: 'btn small ' + cls, type: 'button', text: label }); let armed = false; b.addEventListener('click', () => { if (!armed) { armed = true; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { armed = false; b.textContent = label; }, 3000); } else fn(); }); return b; };
    actions.append(confirmBtn('Reiniciar progreso', 'ghost', () => { LS.del('ra.prog.' + p.id); if (p.id === state.packId) loadProg(); toast('Progreso reiniciado.'); renderPacks(); }));
    if (!p.builtin) actions.append(confirmBtn('Eliminar', 'danger', () => { state.packs = state.packs.filter(x => x.id !== p.id); saveCustomPacks(); LS.del('ra.prog.' + p.id); if (state.packId === p.id) setPack(state.packs[0].id); fillPackSelect(); toast('Tema eliminado.'); renderPacks(); }));
    list.append(row);
  }
  view.append(el('div', { class: 'stack' }, el('p', { class: 'eyebrow', text: 'Temas' }), el('h1', { text: 'Gestionar temas' }), el('p', { class: 'muted', text: 'Los temas y tu progreso se guardan en este navegador. Exporta un tema en JSON para llevártelo a otro dispositivo o compartirlo; se importa desde Añadir tema.' }), list,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: renderAdd }, 'Añadir tema'), el('button', { class: 'btn ghost', type: 'button', onclick: renderHome }, 'Inicio'))));
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
  state.runId++; const view = $('#view'); view.replaceChildren();
  const st = { mode: 'pdf', text: '', title: '', method: state.caps.sample ? 'claude' : 'auto', size: 'm', json: null };
  const log = el('div', { class: 'log' }); const preview = el('div', { class: 'preview', hidden: true });
  const titleInput = el('input', { class: 'text', type: 'text', placeholder: 'Título del tema (por ejemplo: Tema 3. Hojas de cálculo)', id: 'packTitle', 'aria-label': 'Título del tema' });
  const srcBox = el('div', { class: 'stack' });
  const step2 = el('div', { class: 'card stack', hidden: true });
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
      const input = el('input', { type: 'file', accept: 'application/pdf,.pdf', id: 'pdfFile', 'aria-label': 'Archivo PDF' });
      const drop = el('div', { class: 'drop' }, el('b', { text: 'Arrastra aquí un PDF o elígelo' }), el('span', { class: 'small muted', text: 'Se lee en tu navegador, página a página. Funciona con PDF de texto (no escaneados).' }), input);
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
      const file = el('input', { type: 'file', accept: 'application/json,.json', id: 'jsonFile', 'aria-label': 'Archivo JSON' });
      file.addEventListener('change', async () => { const f = file.files && file.files[0]; if (f) ta.value = await f.text(); });
      const use = el('button', { class: 'btn primary', type: 'button', text: 'Importar tema' });
      use.addEventListener('click', () => { try { const raw = JSON.parse(ta.value); const p = normalizePack(Object.assign({}, raw, { id: raw.id && !state.packs.find(x => x.id === raw.id) ? raw.id : 'pack-' + Date.now().toString(36), builtin: false })); if (!p) throw new Error('El JSON no contiene preguntas válidas.'); addPack(p); } catch (e) { log.textContent = 'No se pudo importar: ' + (e && e.message ? e.message : e); } });
      srcBox.append(el('p', { class: 'small muted', text: 'Pega el JSON exportado desde Gestionar temas (o uno creado con el mismo formato).' }), ta, el('div', { class: 'row' }, file, use));
    }
  };
  [['pdf', 'PDF'], ['text', 'Texto pegado'], ['json', 'JSON de un tema']].forEach(([m, label]) => { const b = el('button', { class: 'tab' + (st.mode === m ? ' on' : ''), type: 'button', text: label }); b.addEventListener('click', () => { st.mode = m; tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderSource(); }); tabs.append(b); });
  renderSource();
  // Paso 2: método y tamaño
  const radios = el('div', { class: 'radios' });
  const mkRadio = (val, title, desc, enabled) => { const r = el('input', { type: 'radio', name: 'method', value: val, id: 'method-' + val, checked: st.method === val, disabled: !enabled }); const lab = el('label', { class: 'radio' + (st.method === val ? ' on' : '') + (enabled ? '' : ' off'), for: 'method-' + val }, r, el('div', {}, el('b', { text: title }), el('span', { text: desc }))); r.addEventListener('change', () => { st.method = val; radios.querySelectorAll('.radio').forEach(x => x.classList.remove('on')); lab.classList.add('on'); }); return lab; };
  radios.append(
    mkRadio('claude', 'Con Claude (recomendado)', state.caps.sample ? 'Claude lee el texto y redacta preguntas, definiciones, verdadero/falso, huecos, clasificaciones, secuencias y porqués en español. Tarda uno o dos minutos y usa tu cuenta de Claude; la primera vez te pedirá permiso.' : 'No disponible en esta vista: abre la página desde claude.ai para usarlo. Mientras tanto, usa el modo automático.', !!state.caps.sample),
    mkRadio('auto', 'Automático sin Claude', 'Extrae del texto definiciones («Término: definición»), pasos numerados y frases clave para montar los juegos. Es instantáneo pero más básico.', true)
  );
  const sizes = el('div', { class: 'sizes' });
  Object.entries(GEN_SIZES).forEach(([k, v]) => { const b = el('button', { class: 'btn small' + (st.size === k ? ' on' : ''), type: 'button', text: v.label }); b.addEventListener('click', () => { st.size = k; sizes.querySelectorAll('.btn').forEach(x => x.classList.remove('on')); b.classList.add('on'); }); sizes.append(b); });
  const go = el('button', { class: 'btn primary big', type: 'button', text: 'Crear los juegos' });
  const stop = el('button', { class: 'btn ghost', type: 'button', text: 'Cancelar', hidden: true });
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
  step2.append(el('div', { class: 'eyebrow', text: '2 · Título y método' }), titleInput, radios, el('div', { class: 'row' }, el('span', { class: 'small muted', text: 'Cantidad de preguntas:' }), sizes), el('div', { class: 'row' }, go, stop), status);
  view.append(el('div', { class: 'stack' },
    el('p', { class: 'eyebrow', text: 'Añadir tema' }), el('h1', { text: 'Convierte otro PDF en juegos' }),
    el('p', { class: 'muted', text: 'Sube el PDF de otro tema (o pega su texto) y la web creará un banco de preguntas nuevo con los mismos ocho juegos y su propio repaso espaciado.' }),
    el('div', { class: 'card stack' }, el('div', { class: 'eyebrow', text: '1 · Fuente' }), tabs, srcBox, log, preview),
    step2,
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: renderHome }, 'Volver'))
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
  for (const [sec, ks] of bySec) { if (sort.length >= S.sort) break; const cats = ks.filter(k => k.def.split(/[,;]| y /).length >= 2).slice(0, 3); if (cats.length < 2) continue; const items = []; cats.forEach((k, ci) => { k.def.replace(/^[^ ]+ (es|son) /, '').split(/[,;.]| y /).map(s => s.trim()).filter(s => s.length >= 15 && s.length <= 110 && !(/\(/.test(s) && !/\)/.test(s))).slice(0, 4).forEach(t => items.push({ t: cap(t), c: ci })); }); if (items.length >= 4) sort.push({ title: '¿' + cats.map(c => c.term).join(' o ') + '?', cats: cats.map(c => c.term), items, sec }); }
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
  loadState(); fillPackSelect(); renderHome();
  const useCap = async (name) => { try { if (!window.claude || typeof window.claude.use !== 'function') return null; return await window.claude.use(name); } catch { return null; } };
  useCap('sample').then(fn => { state.caps.sample = fn || null; });
  useCap('downloads').then(d => { state.caps.downloads = d || null; });
}
boot();
