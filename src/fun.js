/* ===================== FUN: juegos de acción con el contenido del tema =====================
   Módulo independiente. build.sh lo mete en su propia etiqueta <script> detrás de la de app.js (si fallara, no se cae
   la web de estudio); todo vive dentro de una función y solo se expone window.FUN = { mount(root, api), unmount(), ... }.
   api (lo pasa app.js al abrir la pestaña): { el, pack, allItems, pick, shuffle, sample, norm, secName,
   grade, toast, LS, colors, goHome, state }. Si falta algo se usan las funciones globales o un sustituto. */
window.FUN = (function () {
  'use strict';
  const FUN_CSS = String.raw`
/* Estilos de la pestaña FUN. Siguen DISENO.md: todo el color sale de las variables de :root (--paper, --surface,
   --surface-2, --ink, --ink-2, --line, --ok, --ko, --warn, --accent, --accent-edge…); la única sombra es el borde
   inferior duro de lo pulsable; radios --r-s (10) y --r-m (14). Todo va bajo .fun para no pisar el resto de la web. */

.fun { display: grid; gap: 32px; }
.fun *, .fun-game * { box-sizing: border-box; }
.fun button, .fun-game button { font: inherit; color: inherit; cursor: pointer; }
.fun button:focus-visible, .fun-game button:focus-visible, .fun-game input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fun svg, .fun-game svg { display: block; }
.fun-num { font-variant-numeric: tabular-nums; }

/* ---- Botones con relieve ---- */
.fun-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 10px 18px; border-radius: var(--r-s, 10px); border: 2px solid var(--line); box-shadow: 0 3px 0 var(--line); background: var(--surface); color: var(--ink); font-weight: 600; line-height: 1.2; text-decoration: none; transition: border-color 160ms ease-out, box-shadow 160ms ease-out, background 160ms ease-out; }
.fun-btn:hover { border-color: var(--line-2); box-shadow: 0 3px 0 var(--line-2); }
.fun-btn:active:not([disabled]) { transform: translateY(3px); box-shadow: none; }
.fun-btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); box-shadow: 0 3px 0 var(--accent-edge, var(--accent)); }
.fun-btn.primary:hover { filter: brightness(1.06); border-color: var(--accent); box-shadow: 0 3px 0 var(--accent-edge, var(--accent)); }
.fun-btn.tertiary { background: transparent; border-color: transparent; box-shadow: none; color: var(--ink-2); }
.fun-btn.tertiary:hover { color: var(--ink); background: var(--surface-2); }
.fun-btn.tertiary:active:not([disabled]) { transform: none; }
.fun-btn[disabled] { opacity: .5; cursor: not-allowed; }
.fun-btn svg { width: 20px; height: 20px; }
.fun-icon-btn { display: inline-grid; place-items: center; width: 46px; height: 46px; border-radius: var(--r-s, 10px); border: 2px solid var(--line); box-shadow: 0 3px 0 var(--line); background: var(--surface); color: var(--ink-2); transition: border-color 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out; }
.fun-icon-btn:hover { border-color: var(--line-2); box-shadow: 0 3px 0 var(--line-2); color: var(--ink); }
.fun-icon-btn:active { transform: translateY(3px); box-shadow: none; }
.fun-icon-btn svg { width: 22px; height: 22px; }
.fun-icon-btn.on { color: var(--accent); }

/* ---- Portada de la pestaña ---- */
.fun-hub-head { display: grid; gap: 8px; }
.fun-hub-head h1 { font-family: var(--font-display); font-size: 2.5rem; font-weight: 800; line-height: 1.12; margin: 0; letter-spacing: -0.01em; }
.fun-hub-head p { color: var(--ink-2); max-width: 60ch; margin: 0; }
.fun-list { display: grid; }
.fun-item { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 14px; align-items: center; width: 100%; padding: 14px 0; border: 0; border-top: 1px solid var(--line); background: none; text-align: left; color: var(--ink); }
.fun-item:last-child { border-bottom: 1px solid var(--line); }
.fun-item .fun-item-icon { width: 40px; height: 40px; color: var(--accent); }
.fun-item .fun-item-icon svg { width: 100%; height: 100%; }
.fun-item .fun-item-name { font-family: var(--font-display); font-size: 1.375rem; font-weight: 800; line-height: 1.12; }
.fun-item .fun-item-desc { color: var(--ink-2); font-size: .9375rem; margin-top: 2px; line-height: 1.45; }
.fun-item .fun-item-best { color: var(--ink-2); font-size: .8125rem; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.fun-item .fun-chev { color: var(--ink-2); width: 22px; height: 22px; transition: color 160ms ease-out; }
.fun-item:hover:not([disabled]) .fun-chev { color: var(--ink); }
.fun-item[disabled] { opacity: .45; cursor: not-allowed; }
@media (max-width: 440px) { .fun-item { grid-template-columns: 36px 1fr auto; } .fun-item .fun-item-icon { width: 32px; height: 32px; } .fun-item .fun-item-best { display: none; } }

/* ---- Pantalla de juego ---- */
.fun-game { display: grid; gap: 12px; padding-top: 24px; }
.fun-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fun-head .fun-title { font-family: var(--font-display); font-size: 1.375rem; font-weight: 800; line-height: 1.12; }
.fun-head .fun-tools { display: flex; gap: 8px; }
.fun-hud { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.fun-hud .fun-score { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; min-width: 2.5ch; letter-spacing: -0.01em; }
.fun-hud .fun-combo { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; min-width: 2.5ch; transition: opacity 160ms ease-out; }
.fun-hud .fun-combo.hidden { opacity: 0; }
.fun-hud .fun-meta { color: var(--ink-2); font-size: .9375rem; font-variant-numeric: tabular-nums; }
.fun-lives { display: inline-flex; gap: 5px; align-items: center; }
.fun-lives i { display: block; width: 12px; height: 12px; border-radius: 50%; background: var(--ink); transition: background 160ms ease-out; }
.fun-lives i.off { background: var(--surface-2); }

.fun-prompt { display: grid; gap: 8px; min-height: 56px; }
.fun-prompt .fun-label { color: var(--ink-2); font-size: .8125rem; }
.fun-prompt .fun-q { font-family: var(--font-display); font-size: 1.375rem; font-weight: 700; line-height: 1.25; margin: 0; letter-spacing: -0.01em; text-wrap: balance; }
.fun-prompt .fun-q.small { font-size: 1rem; font-family: var(--font-ui, inherit); font-weight: 400; letter-spacing: 0; }
.fun-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px 20px; }
.fun-legend .fun-opt { display: flex; gap: 10px; align-items: baseline; font-size: .9375rem; line-height: 1.35; transition: color 160ms ease-out; }
.fun-legend .fun-opt.ok { color: var(--ok); font-weight: 600; }
.fun-legend .fun-opt.ko { color: var(--ko); }
.fun-legend .fun-opt.dim { color: var(--ink-2); }
.fun-key { flex: 0 0 auto; display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 6px; background: var(--surface-2); font-size: .8125rem; font-weight: 600; line-height: 1; color: var(--ink-2); position: relative; top: 2px; }
.fun-opt.ok .fun-key { background: var(--ok); color: var(--paper); }
.fun-opt.ko .fun-key { background: var(--ko); color: var(--paper); }
.fun-kbd { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 7px; border-radius: 6px; background: var(--surface-2); font-size: .8125rem; font-weight: 600; line-height: 1; color: var(--ink-2); vertical-align: middle; }
.fun-kbd svg { width: 16px; height: 16px; }

.fun-stage { position: relative; border: 1px solid var(--line); border-radius: var(--r-m, 14px); background: var(--surface); overflow: hidden; width: 100%; max-width: 560px; margin: 0 auto; }
.fun-stage canvas { display: block; width: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
.fun-stage.shake { animation: fun-shake 220ms ease-out; }
@keyframes fun-shake { 0% { transform: translate(0, 0); } 25% { transform: translate(-5px, 2px); } 50% { transform: translate(4px, -3px); } 75% { transform: translate(-3px, 2px); } 100% { transform: translate(0, 0); } }
@media (prefers-reduced-motion: reduce) { .fun-stage.shake { animation: none; } }

.fun-overlay { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; background: color-mix(in srgb, var(--surface) 94%, transparent); z-index: 2; overflow: auto; }
.fun-overlay .fun-panel { display: grid; gap: 12px; width: 100%; max-width: 420px; animation: fun-rise 200ms ease-out; }
@keyframes fun-rise { from { opacity: 0; transform: translateY(8px); } }
.fun-overlay h2 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; line-height: 1.12; margin: 0; letter-spacing: -0.01em; }
.fun-overlay p { margin: 0; color: var(--ink-2); line-height: 1.5; }
.fun-overlay p.ink { color: var(--ink); }
.fun-overlay .fun-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.fun-howto { display: grid; gap: 10px; }
.fun-howto .fun-h { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; }
.fun-howto .fun-keys { display: inline-flex; gap: 4px; }
.fun-howto span { line-height: 1.4; font-size: .9375rem; }
.fun-answer { display: grid; gap: 4px; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.fun-answer b { font-family: var(--font-display); font-size: 1.375rem; font-weight: 700; line-height: 1.25; }
.fun-answer b.ok { color: var(--ok); }
.fun-result { display: grid; grid-template-columns: auto 1fr; gap: 4px 24px; align-items: baseline; }
.fun-result .fun-big { font-family: var(--font-display); font-size: 4rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; grid-row: span 2; letter-spacing: -0.02em; }
.fun-result .fun-sub { color: var(--ink-2); font-size: .9375rem; }
.fun-result .fun-sub.ok { color: var(--ok); font-weight: 600; }
.fun-missed { display: grid; gap: 8px; max-height: 190px; overflow: auto; padding-top: 12px; border-top: 1px solid var(--line); }
.fun-missed div { font-size: .9375rem; line-height: 1.45; }
.fun-missed div b { display: block; font-weight: 600; }
.fun-missed div span { color: var(--ink-2); }
.fun-track { height: 10px; background: var(--surface-2); border-radius: 5px; overflow: hidden; }
.fun-track i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 5px; transition: width 300ms ease-out; }

/* Controles táctiles (solo en pantallas sin puntero fino) */
.fun-touch { display: none; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 10px; max-width: 560px; margin: 0 auto; width: 100%; padding-bottom: 3px; }
.fun-touch button { min-height: 56px; border: 2px solid var(--line); box-shadow: 0 3px 0 var(--line); background: var(--surface); border-radius: var(--r-s, 10px); font-weight: 600; display: grid; place-items: center; touch-action: manipulation; user-select: none; -webkit-user-select: none; color: var(--ink); }
.fun-touch button:active { transform: translateY(3px); box-shadow: none; background: var(--surface-2); }
.fun-touch button svg { width: 26px; height: 26px; }
@media (pointer: coarse) { .fun-touch { display: grid; } }

/* ---- Jefes (DOM) ---- */
.fun-arena { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: end; padding: 16px 16px 0; min-height: 150px; }
.fun-fighter { display: grid; gap: 8px; justify-items: center; }
.fun-fighter .fun-hp { width: 100%; display: grid; gap: 4px; }
.fun-fighter .fun-hp div { display: flex; justify-content: space-between; font-size: .8125rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.fun-fighter.boss .fun-hp .fun-track i { background: var(--ko); }
.fun-sprite { width: 72px; height: 72px; color: var(--accent); transition: transform 160ms ease-out; }
.fun-fighter.boss .fun-sprite { width: 96px; height: 96px; color: var(--ink); }
.fun-sprite svg { width: 100%; height: 100%; }
.fun-sprite.lunge { transform: translateX(28px); }
.fun-fighter.boss .fun-sprite.lunge { transform: translateX(-28px); }
.fun-sprite.hurt { animation: fun-hurt 300ms ease-out; }
@keyframes fun-hurt { 0% { transform: translateX(0); opacity: 1; } 30% { transform: translateX(8px); opacity: .4; } 60% { transform: translateX(-6px); opacity: 1; } 100% { transform: translateX(0); } }
.fun-dmg { position: absolute; font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; pointer-events: none; animation: fun-float 700ms ease-out forwards; font-variant-numeric: tabular-nums; }
.fun-dmg.ko { color: var(--ko); }
.fun-dmg.ok { color: var(--ok); }
.fun-dmg.crit { font-size: 2.5rem; }
@keyframes fun-float { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-40px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .fun-sprite.hurt { animation: none; } .fun-dmg { animation-duration: 1ms; } }
.fun-turn { display: grid; gap: 12px; padding: 16px; border-top: 1px solid var(--line); }
.fun-turn .fun-timer { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; font-size: .8125rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.fun-turn .fun-timer .fun-track { height: 8px; border-radius: 4px; }
.fun-turn .fun-timer .fun-track i { transition: none; border-radius: 4px; }
.fun-turn .fun-timer.low .fun-track i { background: var(--ko); }
.fun-choices { display: grid; gap: 10px; }
.fun-choices.two { grid-template-columns: 1fr 1fr; }
.fun-choice { display: flex; gap: 12px; align-items: center; text-align: left; width: 100%; min-height: 54px; padding: 12px 14px; border-radius: var(--r-s, 10px); border: 2px solid var(--line); box-shadow: 0 2px 0 var(--line); background: var(--surface); line-height: 1.3; transition: border-color 160ms ease-out, background 160ms ease-out, box-shadow 160ms ease-out; }
.fun-choice:hover:not([disabled]) { border-color: var(--line-2); box-shadow: 0 2px 0 var(--line-2); }
.fun-choice:active:not([disabled]) { transform: translateY(2px); box-shadow: none; }
.fun-choice.ok { border-color: var(--ok); background: var(--ok-soft); box-shadow: 0 2px 0 var(--ok); animation: fun-pop 220ms ease-out; }
@keyframes fun-pop { 50% { transform: scale(1.015); } }
.fun-choice.ok .fun-key { background: var(--ok); color: var(--paper); }
.fun-choice.ko { border-color: var(--ko); background: var(--ko-soft); box-shadow: 0 2px 0 var(--ko); }
.fun-choice.ko .fun-key { background: var(--ko); color: var(--paper); }
.fun-choice[disabled] { cursor: default; }
.fun-choice .fun-key { top: 0; }
.fun-choices.two .fun-choice { justify-content: center; font-weight: 600; }
.fun-type { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
.fun-type input { min-height: 46px; padding: 8px 14px; border: 2px solid var(--line); border-radius: var(--r-s, 10px); background: var(--surface); color: var(--ink); font: inherit; width: 100%; }
.fun-type input:focus { outline: none; border-color: var(--accent); }
.fun-type input.ok { border-color: var(--ok); background: var(--ok-soft); }
.fun-type input.ko { border-color: var(--ko); background: var(--ko-soft); }
.fun-levels { display: grid; }
.fun-level { display: grid; grid-template-columns: 40px 1fr auto; gap: 14px; align-items: center; width: 100%; padding: 14px 0; border: 0; border-top: 1px solid var(--line); background: none; text-align: left; color: var(--ink); }
.fun-level:last-child { border-bottom: 1px solid var(--line); }
.fun-level .fun-n { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; color: var(--ink-2); font-variant-numeric: tabular-nums; line-height: 1; }
.fun-level .fun-name { font-weight: 600; }
.fun-level .fun-sub { color: var(--ink-2); font-size: .8125rem; }
.fun-level .fun-state { color: var(--ink-2); font-size: .8125rem; display: inline-flex; align-items: center; gap: 6px; }
.fun-level .fun-state svg { width: 18px; height: 18px; }
.fun-level.done .fun-state { color: var(--ok); }
.fun-level:hover .fun-name { color: var(--accent); }

/* ---- Topos (DOM) ---- */
.fun-moles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px; }
.fun-hole { position: relative; aspect-ratio: 1.25; border-radius: var(--r-s, 10px); background: var(--surface-2); overflow: hidden; }
.fun-mole { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; text-align: center; border: 0; border-radius: var(--r-s, 10px); background: var(--accent); color: var(--accent-ink); box-shadow: inset 0 -3px 0 var(--accent-edge, var(--accent)); font-weight: 600; font-size: .9375rem; line-height: 1.2; transform: translateY(105%); transition: transform 160ms ease-out, background 160ms ease-out; overflow-wrap: anywhere; hyphens: auto; }
@media (max-width: 420px) { .fun-mole { padding: 6px 4px; font-size: .8125rem; } .fun-mole.long { font-size: .75rem; } }
.fun-mole.up { transform: translateY(0); }
.fun-mole.long { font-size: .8125rem; font-weight: 400; }
.fun-mole.ok { background: var(--ok); box-shadow: none; animation: fun-pop 220ms ease-out; }
.fun-mole.ko { background: var(--ko); box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .fun-mole { transition-duration: 1ms; } }
.fun-timebar { padding: 0 12px 12px; display: grid; gap: 4px; }
.fun-timebar .fun-track { height: 8px; border-radius: 4px; }
.fun-timebar .fun-track i { transition: none; border-radius: 4px; }
.fun-timebar.low .fun-track i { background: var(--ko); }
.fun-timebar span { font-size: .8125rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }

/* ---- Pantallas pequeñas: el panel cabe en el lienzo y no repite el enunciado que ya está encima ---- */
@media (max-width: 420px), (max-height: 760px) {
  .fun-overlay { padding: 16px; }
  .fun-overlay .fun-panel { gap: 10px; }
  .fun-overlay .fun-panel > p.ink, .fun-overlay .fun-intro { display: none; }
  .fun-result .fun-big { font-size: 3rem; }
  .fun-missed { max-height: 120px; }
  .fun-answer b { font-size: 1.125rem; }
  .fun-fb > .fun-row { order: 1; } .fun-fb > .fun-why { order: 2; } /* «Seguir» a la vista; el porqué debajo */
}
@media (max-width: 420px) {
  .fun-prompt .fun-q { font-size: 1.1875rem; }
  .fun-arena { min-height: 0; padding: 12px 12px 0; }
  .fun-sprite { width: 56px; height: 56px; }
  .fun-fighter.boss .fun-sprite { width: 72px; height: 72px; }
  .fun-turn { padding: 12px; }
}

/* ---- Táctil y movimiento reducido (DISENO.md) ---- */
@media (hover: none) and (pointer: coarse) {
  .fun-btn, .fun-icon-btn, .fun-choice, .fun-item, .fun-level, .fun-touch button, .fun-type input { min-height: 44px; }
  .fun-icon-btn { min-width: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .fun *, .fun *::before, .fun *::after, .fun-game *, .fun-game *::before, .fun-game *::after { animation: none !important; transition: none !important; }
}
`;
  const G = window;
  const CSS_ID = 'fun-css';
  let api = null;            // API que nos pasa app.js
  let root = null;           // contenedor de la pestaña
  let current = null;        // juego en marcha
  // Relación con el repaso espaciado de los juegos de estudio (decisión de Cero, en un solo sitio):
  //   'all'    → aciertos y fallos cuentan igual que en los juegos de estudio (lo que eligió Cero)
  //   'errors' → solo los fallos de FUN cuentan (el elemento vuelve antes)
  //   'none'   → lo que pasa en FUN no toca el repaso
  // Las preguntas que pasan sin respuesta (cápsula que llega abajo, tiempo agotado, topo escapado) no se registran nunca.
  const GRADE_MODE = 'all';

  /* ---------- Utilidades propias (no se redefine nada de app.js) ---------- */
  const fshuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fnorm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}@]+/gu, ' ').trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reducedMotion = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = () => G.matchMedia && G.matchMedia('(pointer: coarse)').matches;
  const now = () => performance.now();

  function h(tag, attrs = {}, ...kids) {
    if (api && api.el) return api.el(tag, attrs, ...kids);
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; n.append(c.nodeType ? c : document.createTextNode(String(c))); }
    return n;
  }
  const LS = {
    get(k, d) { if (api && api.LS) return api.LS.get(k, d); try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { if (api && api.LS) return api.LS.set(k, v); try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
  };
  const A = {
    pack: () => (api && api.pack ? api.pack() : (typeof G.pack === 'function' ? G.pack() : null)),
    pick: (items, n) => (api && api.pick ? api.pick(items, n) : (typeof G.pick === 'function' ? G.pick(items, n) : fshuffle(items).slice(0, n))),
    shuffle: (a) => (api && api.shuffle ? api.shuffle(a) : fshuffle(a)),
    norm: (s) => (api && api.norm ? api.norm(s) : fnorm(s)),
    secName: (id) => { if (api && api.secName) return api.secName(id); const p = A.pack(); const s = p && p.sections.find(x => x.id === id); return s ? s.name : ''; },
    grade: (id, r) => { try { if (api && api.grade) api.grade(id, r); else if (typeof G.grade === 'function') G.grade(id, r); } catch { } },
    toast: (m) => { if (api && api.toast) api.toast(m); else if (typeof G.toast === 'function') G.toast(m); },
    goHome: () => { if (api && api.goHome) api.goHome(); else if (typeof G.renderHome === 'function') G.renderHome(); },
    packId: () => { const p = A.pack(); return (p && p.id) || 'pack'; }
  };

  /* ---------- Colores del tema (variables de :root; se releen en "themechange") ---------- */
  const COLOR_VARS = { paper: '--paper', surface: '--surface', surface2: '--surface-2', ink: '--ink', ink2: '--ink-2', line: '--line', line2: '--line-2', ok: '--ok', okSoft: '--ok-soft', ko: '--ko', koSoft: '--ko-soft', warn: '--warn', warnSoft: '--warn-soft', accent: '--accent', accentInk: '--accent-ink', accentSoft: '--accent-soft' };
  const FALLBACK = { paper: '#F6F3EC', surface: '#FFFDF8', surface2: '#ECE7DC', ink: '#1A1813', ink2: '#6B665B', line: '#DAD4C8', line2: '#B9B1A1', ok: '#1F7A4D', okSoft: '#DDEFE3', ko: '#BC3A2B', koSoft: '#F7DEDA', warn: '#A86F13', warnSoft: '#F4E6C6', accent: '#2B40D4', accentInk: '#FFFFFF', accentSoft: '#E3E6F9' };
  let colorCache = null;
  function colors() {
    if (colorCache) return colorCache;
    const cs = getComputedStyle(document.documentElement);
    const c = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) { const val = (cs.getPropertyValue(v) || '').trim(); c[k] = val || FALLBACK[k]; }
    c.fontUi = (cs.getPropertyValue('--font-ui') || cs.getPropertyValue('--font-body') || '').trim() || 'system-ui, sans-serif';
    c.fontDisplay = (cs.getPropertyValue('--font-display') || '').trim() || c.fontUi;
    // color-mix() no sirve como fillStyle de canvas: lo resolvemos pintando en un canvas de 1 px.
    for (const k of Object.keys(c)) if (/color-mix|var\(/.test(c[k])) c[k] = resolveColor(c[k], FALLBACK[k]);
    colorCache = c; return c;
  }
  function resolveColor(expr, fallback) {
    try { const probe = document.createElement('span'); probe.style.color = expr; probe.style.display = 'none'; document.body.append(probe); const v = getComputedStyle(probe).color; probe.remove(); return v || fallback; } catch { return fallback; }
  }
  document.addEventListener('themechange', () => { colorCache = null; if (current && current.onTheme) current.onTheme(); });
  if (G.matchMedia) { try { G.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colorCache = null; if (current && current.onTheme) current.onTheme(); }); } catch { } }

  /* ---------- Iconos (trazo 1.75, rejilla 24) ---------- */
  const ICON = {
    ship: '<path d="M12 3l5 10H7l5-10z"/><path d="M5 17l7 4 7-4"/><path d="M7 13l-2 4M17 13l2 4"/>',
    road: '<path d="M4 20L9 4h6l5 16"/><path d="M12 7v2M12 12v2M12 17v2"/>',
    boss: '<path d="M6 20V9a6 6 0 0 1 12 0v11l-3-2-3 2-3-2-3 2z"/><circle cx="9.5" cy="11" r=".9"/><circle cx="14.5" cy="11" r=".9"/>',
    stairs: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/><path d="M4 20V4"/>',
    basket: '<path d="M4 10h16l-2 9H6l-2-9z"/><path d="M8 10l4-6 4 6"/><path d="M9 14v2M12 14v2M15 14v2"/>',
    mole: '<path d="M4 18h16"/><path d="M7 18v-5a5 5 0 0 1 10 0v5"/><circle cx="10" cy="12.5" r=".8"/><circle cx="14" cy="12.5" r=".8"/><path d="M11 15h2"/>',
    sound: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    mute: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 5l12 7-12 7V5z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M5 15l7-7 7 7"/>',
    fire: '<path d="M12 4v10"/><path d="M8 10l4-4 4 4"/><path d="M6 20h12"/>'
  };
  const icon = (name, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); s.innerHTML = ICON[name] || ''; return s; };
  const kbd = (label) => { const k = h('span', { class: 'fun-kbd' }); if (ICON[label]) k.append(icon(label)); else k.textContent = label; return k; };

  /* ---------- Sonido (efectos sintetizados, sin música; activo por defecto y se recuerda la preferencia) ---------- */
  const Snd = (() => {
    let ctx = null; let on = LS.get('ra.fun.sound', true) !== false;
    const ensure = () => { if (!ctx) { try { ctx = new (G.AudioContext || G.webkitAudioContext)(); } catch { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { }); return ctx; };
    // `at` retrasa la nota en el reloj del audio (segundos): así las notas segundas y las secuencias se programan
    // de golpe y no queda ningún temporizador que suene después de salir del juego.
    const tone = (f, dur, type, vol, slide, at) => {
      if (!on) return; const c = ensure(); if (!c) return;
      try {
        const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime + (at || 0);
        o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
        g.gain.setValueAtTime(vol || .06, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .03);
      } catch { }
    };
    const seq = (notes, step, dur, type, vol) => notes.forEach((f, i) => tone(f, dur, type, vol, 0, i * step / 1000));
    return {
      get on() { return on; },
      // Safari e iOS solo arrancan el AudioContext dentro de un gesto del usuario: se llama desde los clics y teclas del juego.
      unlock() { if (on) ensure(); },
      toggle() { on = !on; LS.set('ra.fun.sound', on); if (on) { ensure(); tone(660, .08, 'sine', .05, 200); } return on; },
      shoot: () => tone(900, .07, 'square', .035, -600),
      hit: () => { tone(540, .09, 'triangle', .07); tone(810, .12, 'triangle', .07, 0, .06); },
      wrong: () => tone(170, .28, 'sawtooth', .06, -90),
      tap: () => tone(700, .05, 'sine', .05, 150),
      step: () => tone(420, .04, 'triangle', .03),
      level: () => seq([523, 659, 784, 1046], 90, .12, 'square', .045),
      win: () => seq([523, 659, 784, 1046, 1318], 110, .18, 'triangle', .06),
      lose: () => seq([392, 330, 262], 190, .26, 'triangle', .06),
      tick: () => tone(1300, .03, 'square', .025),
      crit: () => { tone(300, .12, 'sawtooth', .07, 500); tone(1200, .15, 'square', .05, 300, .09); }
    };
  })();

  /* ---------- Contenido: adaptadores del pack a preguntas de juego ---------- */
  // Una pregunta de opciones (mc) es {id, sec, kind:'q'|'k'|'tf', prompt, sub?, options, a, why}
  function mcPool(p, kinds) {
    const want = new Set(kinds || ['q', 'k', 'tf']); const out = [];
    if (want.has('q')) for (const q of p.questions) if (q.options && q.options.length >= 2 && q.options.length <= 4) out.push({ id: q.id, sec: q.sec, kind: 'q', prompt: q.q, options: q.options.slice(), a: q.a, why: q.why || '', answer: q.options[q.a] });
    if (want.has('k') && p.concepts.length >= 4) for (const k of p.concepts) {
      // Primero términos de la misma sección; nunca dos opciones con el mismo texto (temas importados con términos repetidos).
      const seen = new Set([fnorm(k.term)]); const others = [];
      for (const x of [...fshuffle(p.concepts.filter(x => x.sec === k.sec)), ...fshuffle(p.concepts)]) { if (others.length >= 3) break; const n = fnorm(x.term); if (x.id === k.id || seen.has(n)) continue; seen.add(n); others.push(x); }
      if (others.length < 2) continue;
      out.push({ id: k.id, sec: k.sec, kind: 'k', prompt: k.def, label: 'Qué término es', options: [k.term, ...others.map(o => o.term)], a: 0, why: '', answer: k.term });
    }
    if (want.has('tf')) for (const t of p.tf) out.push({ id: t.id, sec: t.sec, kind: 'tf', prompt: t.s, label: 'Verdadero o falso', options: ['Verdadero', 'Falso'], a: t.a ? 0 : 1, why: (t.a ? 'Es verdadero. ' : 'Es falso. ') + (t.why || ''), answer: t.a ? 'Verdadero' : 'Falso' });
    return out;
  }
  // Baraja las opciones (menos en verdadero/falso) y devuelve una copia lista para jugar.
  function dealMc(it) {
    if (it.kind === 'tf') return Object.assign({}, it);
    const idx = fshuffle(it.options.map((_, i) => i));
    return Object.assign({}, it, { options: idx.map(i => it.options[i]), a: idx.indexOf(it.a) });
  }
  const LETTERS = ['A', 'B', 'C', 'D'];
  // Conjuntos de clasificación: cada set es {id, sec, title, cats, items:[{t,c}]}; el v/f se convierte en un set más.
  function sortSets(p, maxItems) {
    const sets = p.sort.filter(s => s.cats && s.cats.length >= 2 && s.cats.length <= 3 && s.items && s.items.length >= 3).map(s => ({ id: s.id, sec: s.sec, title: s.title, cats: s.cats.slice(), items: fshuffle(s.items).slice(0, maxItems || 6).map(it => ({ t: it.t, c: it.c })), gradeAsSet: true }));
    if (p.tf.length >= 4) sets.push({ id: 'tf', sec: null, title: 'Verdadero o falso', cats: ['Verdadero', 'Falso'], items: A.pick(p.tf, Math.min(maxItems || 6, p.tf.length)).map(t => ({ t: t.s, c: t.a ? 0 : 1, id: t.id, why: t.why })), gradeAsSet: false });
    return sets;
  }
  function clozePool(p) { return p.cloze.filter(c => c.text && c.text.includes('___') && c.answer).map(c => ({ id: c.id, sec: c.sec, text: c.text, answer: c.answer, alt: c.alt || [], hint: c.hint || '' })); }
  // Textos distintos entre sí y distintos de lo que ya vale como respuesta (texto normalizado).
  function distinct(list, exclude) { const seen = new Set((exclude || []).map(fnorm)); return list.filter(t => { const n = fnorm(t); if (!n || seen.has(n)) return false; seen.add(n); return true; }); }
  function clozeOk(c, typed) { const t = A.norm(typed); if (!t) return false; return [c.answer, ...(c.alt || [])].some(a => A.norm(a) === t); }

  /* ---------- Récords (lo único que se guarda: Cero no quiere progreso de jugador) ---------- */
  function finishGame(s) {
    const key = 'ra.fun.best.' + A.packId() + '.' + s.key; const prev = LS.get(key, null);
    const record = s.score > 0 && (!prev || s.score > prev.score); if (record) LS.set(key, { score: s.score, date: Date.now() });
    return { record, prev };
  }
  const best = (key) => LS.get('ra.fun.best.' + A.packId() + '.' + key, null);

  /* ---------- Lienzo: tamaño según el sitio disponible, escala según el píxel del dispositivo ---------- */
  // below(): alto de lo que va debajo del lienzo (botones táctiles). o.shrinkOnly: en partida solo encoge, para que no baile.
  function makeCanvas(stage, below) {
    const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); stage.append(c);
    const cv = { el: c, ctx: c.getContext('2d'), W: 0, H: 0, dpr: 1 };
    cv.resize = (o) => {
      const w = Math.max(240, Math.round(stage.clientWidth || 360));
      const top = stage.getBoundingClientRect().top; const extra = below ? below() : 0;
      const avail = G.innerHeight - Math.max(0, top) - extra - 12;
      let hgt = Math.round(clamp(avail, G.innerHeight < 800 ? 260 : 300, Math.min(640, w * 1.5)));
      if (o && o.shrinkOnly && cv.H && w === cv.W) hgt = Math.min(hgt, cv.H);
      const dpr = Math.min(2, G.devicePixelRatio || 1);
      if (w === cv.W && hgt === cv.H && dpr === cv.dpr) return false;
      cv.W = w; cv.H = hgt; cv.dpr = dpr; c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr); c.style.height = hgt + 'px';
      cv.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };
    return cv;
  }
  // Efectos de juego sobre canvas: partículas, textos flotantes y sacudida. Discretos y planos.
  function makeFx() {
    const parts = []; const texts = []; let shakeT = 0, shakeMag = 0;
    const fx = {
      burst(x, y, color, n = 12, speed = 160) { if (reducedMotion()) n = Math.min(n, 4); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const v = speed * (0.4 + Math.random() * 0.8); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 1.6 + Math.random() * 1.2, size: 3 + Math.random() * 3, color }); } },
      text(x, y, str, color, size = 18) { texts.push({ x, y, str, color, life: 1, size }); },
      shake(mag = 5) { if (reducedMotion()) return; shakeT = .22; shakeMag = mag; },
      update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= p.decay * dt; if (p.life <= 0) parts.splice(i, 1); }
        for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.y -= 34 * dt; t.life -= 1.1 * dt; if (t.life <= 0) texts.splice(i, 1); }
        if (shakeT > 0) shakeT -= dt;
      },
      offset() { if (shakeT <= 0) return [0, 0]; const m = shakeMag * (shakeT / .22); return [(Math.random() - .5) * 2 * m, (Math.random() - .5) * 2 * m]; },
      draw(ctx, fontUi) {
        for (const p of parts) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
        ctx.globalAlpha = 1;
        for (const t of texts) { ctx.globalAlpha = clamp(t.life * 1.4, 0, 1); ctx.fillStyle = t.color; ctx.font = '800 ' + t.size + 'px ' + fontUi; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.str, t.x, t.y); }
        ctx.globalAlpha = 1;
      },
      clear() { parts.length = 0; texts.length = 0; shakeT = 0; }
    };
    return fx;
  }
  // Parte un texto en líneas que quepan en maxWidth (para rótulos dentro del canvas).
  function wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxWidth || !line) line = t; else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) { const cut = lines.slice(0, maxLines); let last = cut[maxLines - 1]; while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1); cut[maxLines - 1] = last + '…'; return cut; }
    return lines;
  }
  function roundRect(ctx, x, y, w, r, hgt) { const hh = hgt; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* ---------- Juego base: pantalla, HUD, bucle, pausa, feedback y resultado ---------- */
  class Game {
    constructor(def, opts) {
      this.def = def; this.key = def.key; this.opts = opts || {};
      this.lives = def.lives == null ? 3 : def.lives; this.maxLives = this.lives;
      this.score = 0; this.combo = 0; this.state = 'idle'; this.rafId = 0; this.last = 0;
      this.stats = { key: def.key, answered: 0, correct: 0, wrong: 0, maxCombo: 0, score: 0, won: false, missed: [], graded: new Set(), t0: 0 };
      this.keys = new Set(); this.fx = makeFx(); this.resumeAfterOverlay = false; this.overlay = null; this.timers = [];
    }
    // Monta la pantalla dentro de root y enseña la portada con las instrucciones.
    mount(container) {
      this.container = container; container.replaceChildren();
      const c = colors();
      this.scoreEl = h('span', { class: 'fun-score', text: '0', 'aria-label': 'Puntos' });
      this.comboEl = h('span', { class: 'fun-combo hidden', text: 'x1' });
      this.livesEl = h('span', { class: 'fun-lives', 'aria-label': 'Vidas' });
      this.metaEl = h('span', { class: 'fun-meta', text: '' });
      this.sndBtn = h('button', { class: 'fun-icon-btn' + (Snd.on ? ' on' : ''), type: 'button', 'aria-label': 'Sonido', title: 'Sonido', onclick: () => { const on = Snd.toggle(); this.sndBtn.classList.toggle('on', on); this.sndBtn.replaceChildren(icon(on ? 'sound' : 'mute')); } }, icon(Snd.on ? 'sound' : 'mute'));
      this.pauseBtn = h('button', { class: 'fun-icon-btn', type: 'button', 'aria-label': 'Pausa', title: 'Pausa', onclick: () => this.togglePause() }, icon('pause'));
      const exitBtn = h('button', { class: 'fun-icon-btn', type: 'button', 'aria-label': 'Salir del juego', title: 'Salir', onclick: () => this.exit() }, icon('close'));
      this.promptEl = h('div', { class: 'fun-prompt', 'aria-live': 'polite' });
      this.stage = h('div', { class: 'fun-stage' });
      this.touchEl = h('div', { class: 'fun-touch' });
      this.rootEl = h('section', { class: 'fun-game' },
        h('div', { class: 'fun-head' }, h('div', { class: 'fun-title', text: this.def.name }), h('div', { class: 'fun-hud' }, this.scoreEl, this.comboEl, this.livesEl, this.metaEl), h('div', { class: 'fun-tools' }, this.sndBtn, this.pauseBtn, exitBtn)),
        this.promptEl, this.stage, this.touchEl);
      container.append(this.rootEl);
      this.renderLives();
      // aria-live="off": main#view es una región viva y si no leería cada cambio de marcador y de reloj; el enunciado tiene la suya.
      this.rootEl.setAttribute('aria-live', 'off');
      if (this.def.canvas) { this.cv = makeCanvas(this.stage, () => (this.touchEl.offsetHeight ? this.touchEl.offsetHeight + 12 : 0)); this.cv.resize(); this.ro = new ResizeObserver(() => this.refit()); this.ro.observe(this.stage); }
      else this.stage.style.minHeight = '400px';
      // Si app.js vacía el contenedor sin llamar a FUN.unmount(), el juego se retira solo.
      this.watch = setInterval(() => { if (!this.rootEl.isConnected) this.destroy(); }, 500);
      this.onKeyDown = (e) => this.keyDown(e); this.onKeyUp = (e) => { this.keys.delete(e.code); };
      this.onVis = () => { if (document.hidden && this.state === 'running') this.pause(); };
      this.onWinResize = () => this.refit();
      this.onBlur = () => this.keys.clear(); // si la ventana pierde el foco con una flecha pulsada, el keyup no llega
      G.addEventListener('keydown', this.onKeyDown); G.addEventListener('keyup', this.onKeyUp); document.addEventListener('visibilitychange', this.onVis); G.addEventListener('resize', this.onWinResize); G.addEventListener('blur', this.onBlur);
      this.bindPointer();
      this.c = c; this.setup();
      this.fit(true);
      this.showStart();
    }
    // Ajusta el lienzo al hueco libre; si aun así el juego no cabe, sube la página lo justo (sin esconder la cabecera del juego).
    fit(grow) {
      if (this.state === 'dead' || !this.rootEl.isConnected) return;
      const o = { shrinkOnly: !grow };
      let changed = this.cv ? this.cv.resize(o) : false;
      const r = this.rootEl.getBoundingClientRect(); const over = r.bottom - G.innerHeight + 8;
      if (over > 0 && r.top > 0) { G.scrollTo({ top: G.scrollY + Math.min(r.top, over), behavior: 'instant' }); if (this.cv) changed = this.cv.resize(o) || changed; }
      if (changed) { this.onResize(); if (this.state !== 'idle') this.draw(); }
    }
    refit() { if (this.cv && this.state !== 'dead' && this.cv.resize()) { this.onResize(); if (this.state !== 'idle') this.draw(); } }
    // Espera en tiempo de juego: se congela con la pausa (o con la pestaña oculta) y se anula al salir.
    later(sec, fn) { this.timers.push({ t: sec, fn }); }
    runTimers(dt) {
      if (!this.timers.length) return;
      const due = []; this.timers = this.timers.filter(x => { x.t -= dt; if (x.t > 0) return true; due.push(x.fn); return false; });
      for (const fn of due) if (this.state === 'running') fn();
    }
    setup() { } tick() { } draw() { } onKey() { } onPointer() { } howto() { return []; } onResize() { } onTheme() { this.c = colors(); if (this.state !== 'running' && this.state !== 'idle' && this.state !== 'dead') this.draw(); }
    // --- portada ---
    showStart() {
      const b = best(this.key);
      const rows = this.howto().filter(r => !(r.kb && coarse())).map(r => h('div', { class: 'fun-h' }, h('span', { class: 'fun-keys' }, r.keys.map(kbd)), h('span', { text: r.text })));
      this.showOverlay(h('div', { class: 'fun-panel' },
        h('h2', { text: this.def.name }), h('p', { class: 'fun-intro', text: this.def.intro }),
        h('div', { class: 'fun-howto' }, rows),
        b ? h('p', { class: 'fun-num', text: 'Tu récord: ' + b.score }) : null,
        h('div', { class: 'fun-row' }, h('button', { class: 'fun-btn primary', type: 'button', onclick: () => this.begin() }, icon('play'), 'Jugar'), h('button', { class: 'fun-btn tertiary', type: 'button', onclick: () => this.exit() }, 'Volver'))
      ), { focus: true });
      this.startAction = () => this.begin();
    }
    begin() { Snd.unlock(); this.hideOverlay(); this.startAction = null; this.stats.t0 = now(); this.state = 'running'; this.last = now(); this.start(); this.loop(); }
    start() { }
    // --- bucle ---
    loop() {
      cancelAnimationFrame(this.rafId);
      const step = (t) => {
        if (this.state !== 'running') return;
        if (!this.rootEl.isConnected) { this.destroy(); return; }
        const dt = Math.min(.05, Math.max(0, (t - this.last) / 1000)); this.last = t;
        this.fx.update(dt); this.tick(dt); this.runTimers(dt); this.draw();
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
    }
    pause(reason) { if (this.state !== 'running') return; this.state = 'paused'; cancelAnimationFrame(this.rafId); if (reason !== 'silent') this.showPause(); }
    resume() { if (this.state !== 'paused') return; this.hideOverlay(); this.state = 'running'; this.last = now(); this.keys.clear(); this.loop(); }
    togglePause() { if (this.state === 'running') this.pause(); else if (this.state === 'paused' && this.overlayKind === 'pause') this.resume(); }
    showPause() {
      this.showOverlay(h('div', { class: 'fun-panel' }, h('h2', { text: 'Pausa' }), h('div', { class: 'fun-row' }, h('button', { class: 'fun-btn primary', type: 'button', onclick: () => this.resume() }, icon('play'), 'Seguir'), h('button', { class: 'fun-btn tertiary', type: 'button', onclick: () => this.exit() }, 'Salir'))), { kind: 'pause', focus: true });
    }
    // --- HUD ---
    renderLives() { this.livesEl.replaceChildren(); for (let i = 0; i < this.maxLives; i++) this.livesEl.append(h('i', { class: i < this.lives ? '' : 'off' })); }
    setMeta(t) { this.metaEl.textContent = t; }
    multiplier() { return 1 + Math.min(4, Math.floor(this.combo / 3)) * 0.5; }
    // Acierto: puntos con multiplicador por racha.
    hit(base, pos) {
      this.combo++; this.stats.correct++; this.stats.answered++; this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      const pts = Math.round(base * this.multiplier()); this.score += pts; this.stats.score = this.score;
      this.scoreEl.textContent = String(this.score);
      const m = this.multiplier(); this.comboEl.textContent = 'x' + (Number.isInteger(m) ? m : m.toFixed(1)); this.comboEl.classList.toggle('hidden', this.combo < 3);
      if (pos && this.cv) this.fx.text(pos.x, pos.y, '+' + pts, this.c.ok);
      if (this.combo > 0 && this.combo % 3 === 0 && this.combo <= 12 && this.cv && pos) this.fx.text(pos.x, pos.y - 24, 'x' + (Number.isInteger(m) ? m : m.toFixed(1)), this.c.accent, 16);
      return pts;
    }
    // Fallo: se rompe la racha y se pierde una vida (si el juego las usa). opts.count=false: error de manos, no de conocimiento.
    miss(review, opts) {
      this.combo = 0; this.comboEl.classList.add('hidden');
      if (!opts || opts.count !== false) { this.stats.wrong++; this.stats.answered++; }
      if (review) this.stats.missed.push(review);
      if (this.maxLives > 0) { this.lives = Math.max(0, this.lives - 1); this.renderLives(); }
      if (!reducedMotion()) { this.stage.classList.remove('shake'); void this.stage.offsetWidth; this.stage.classList.add('shake'); }
      return this.lives > 0 || this.maxLives === 0;
    }
    gradeOnce(id, r) {
      if (GRADE_MODE === 'none' || !id || this.stats.graded.has(id)) return;
      if (GRADE_MODE === 'errors' && r !== false) return;
      this.stats.graded.add(id); A.grade(id, r);
    }
    // Enunciado y leyenda de opciones (letras) encima del escenario.
    prompt(o) {
      this.promptEl.replaceChildren();
      if (o.label) this.promptEl.append(h('div', { class: 'fun-label', text: o.label }));
      if (o.text) this.promptEl.append(h('p', { class: 'fun-q' + (o.small ? ' small' : ''), text: o.text }));
      if (o.node) this.promptEl.append(o.node);
      if (o.options) {
        const lg = h('div', { class: 'fun-legend' });
        o.options.forEach((t, i) => lg.append(h('div', { class: 'fun-opt', 'data-i': i }, h('span', { class: 'fun-key', text: o.letters ? o.letters[i] : LETTERS[i] }), h('span', { text: t }))));
        this.promptEl.append(lg); this.legendEl = lg;
      } else this.legendEl = null;
      this.fit(false);
    }
    markLegend(correct, chosen) { if (!this.legendEl) return; [...this.legendEl.children].forEach((n, i) => { n.classList.toggle('ok', i === correct); n.classList.toggle('ko', chosen != null && i === chosen && i !== correct); n.classList.toggle('dim', i !== correct && i !== chosen); }); }
    // Tarjeta de corrección tras un fallo: para el juego hasta que el jugador sigue. Devuelve una promesa.
    feedback(o) {
      return new Promise(res => {
        this.pause('silent');
        const go = () => { this.overlayKind = null; this.resume(); res(); };
        this.showOverlay(h('div', { class: 'fun-panel fun-fb' },
          h('h2', { text: o.title || 'No era esa' }),
          o.prompt ? h('p', { class: 'ink', text: o.prompt }) : null,
          h('div', { class: 'fun-answer' }, h('span', { class: 'fun-label', text: o.answerLabel || 'Respuesta correcta' }), h('b', { class: 'ok', text: o.answer })),
          o.why ? h('p', { class: 'fun-why', text: o.why }) : null,
          h('div', { class: 'fun-row' }, h('button', { class: 'fun-btn primary', type: 'button', onclick: go }, 'Seguir'))
        ), { kind: 'feedback', focus: true });
        this.continueAction = go;
      });
    }
    // Aviso corto sin parar el juego (p. ej. "Siguiente tramo").
    banner(text, ms) {
      const b = h('div', { class: 'fun-overlay', style: 'pointer-events:none;background:transparent' }, h('div', { class: 'fun-panel', style: 'text-align:center' }, h('h2', { text })));
      this.stage.append(b); setTimeout(() => b.remove(), ms || 1200);
    }
    // --- final ---
    end(won) {
      if (this.state === 'over' || this.state === 'dead') return; this.state = 'over'; cancelAnimationFrame(this.rafId);
      this.stats.won = !!won; this.stats.score = this.score; this.stats.seconds = Math.round((now() - this.stats.t0) / 1000);
      const r = finishGame(this.stats); this.result = r;
      if (won) Snd.win(); else Snd.lose();
      const acc = this.stats.answered ? Math.round(this.stats.correct / this.stats.answered * 100) : 0;
      const missed = this.stats.missed.length ? h('div', { class: 'fun-missed' }, this.stats.missed.slice(0, 12).map(m => h('div', {}, h('b', { text: m.q }), h('span', { text: m.a })))) : null;
      const extra = this.extraEndButtons(won);
      this.showOverlay(h('div', { class: 'fun-panel' },
        h('h2', { text: this.endTitle(won) }),
        h('div', { class: 'fun-result' }, h('div', { class: 'fun-big', text: String(this.score) }), h('div', { class: 'fun-sub' + (r.record && this.score > 0 ? ' ok' : ''), text: r.record && this.score > 0 ? (r.prev ? 'Nuevo récord' : 'Primer récord') : 'Récord: ' + (r.prev ? r.prev.score : 0) }), h('div', { class: 'fun-sub', text: this.stats.correct + ' de ' + this.stats.answered + ' aciertos · ' + acc + ' %' + (this.stats.maxCombo >= 3 ? ' · mejor racha ' + this.stats.maxCombo : '') })),
        missed,
        h('div', { class: 'fun-row' }, extra, h('button', { class: 'fun-btn' + (extra.length ? '' : ' primary'), type: 'button', onclick: () => this.restart() }, 'Otra partida'), h('button', { class: 'fun-btn' + (extra.length ? ' tertiary' : ''), type: 'button', onclick: () => this.exit() }, 'Volver a FUN'))
      ), { kind: 'over', focus: true });
      this.promptEl.replaceChildren(); this.legendEl = null; this.fit(true);
      this.startAction = () => this.restart();
    }
    endTitle(won) { return won ? 'Partida completada' : 'Fin de la partida'; }
    extraEndButtons() { return []; }
    restart() { const c = this.container; const o = this.opts; this.destroy(); startGame(this.key, c, o); }
    exit() { const o = this.opts; this.destroy(); if (o.onExit) o.onExit(); }
    destroy() {
      this.state = 'dead'; cancelAnimationFrame(this.rafId);
      G.removeEventListener('keydown', this.onKeyDown); G.removeEventListener('keyup', this.onKeyUp); document.removeEventListener('visibilitychange', this.onVis); G.removeEventListener('resize', this.onWinResize); G.removeEventListener('blur', this.onBlur);
      this.timers = []; if (this.ro) this.ro.disconnect(); clearInterval(this.watch); this.fx.clear(); this.teardown && this.teardown();
      if (current === this) current = null;
    }
    // --- capas ---
    showOverlay(panel, o) { this.hideOverlay(); this.overlayKind = (o && o.kind) || 'start'; this.overlay = h('div', { class: 'fun-overlay', role: 'dialog' }, panel); this.stage.append(this.overlay);
      // Sin lienzo (Jefes, Topos) el escenario mide lo que su contenido: si el panel es más alto, se estira mientras está a la vista.
      if (!this.cv && this.overlay.scrollHeight > this.stage.clientHeight) { this.overMin = this.stage.style.minHeight; this.stage.style.minHeight = (this.overlay.scrollHeight + this.stage.offsetHeight - this.stage.clientHeight) + 'px'; }
      if (o && o.focus) { const b = this.overlay.querySelector('button.primary, button'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 0); } }
    hideOverlay() { if (this.overlay) { this.overlay.remove(); this.overlay = null; } this.overlayKind = null; if (this.overMin != null) { this.stage.style.minHeight = this.overMin; this.overMin = null; } }
    // --- entrada ---
    keyDown(e) {
      Snd.unlock();
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) { if (e.key === 'Escape') { e.target.blur(); } return; }
      if (e.key === 'Escape') { e.preventDefault(); if (this.state === 'running') this.pause(); else if (this.overlayKind === 'pause') this.resume(); return; }
      if (this.overlayKind && this.state !== 'running' && (e.key === 'Enter' || e.key === ' ') && e.target && e.target.tagName === 'BUTTON') return;
      if (this.overlayKind === 'feedback' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.continueAction && this.continueAction(); return; }
      if ((this.overlayKind === 'start' || this.overlayKind === 'over') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.startAction && this.startAction(); return; }
      if (this.overlayKind === 'pause' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.resume(); return; }
      if (this.state !== 'running') return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
      this.onKey(e);
    }
    bindPointer() {
      const st = this.stage; let down = null;
      const pos = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      st.addEventListener('pointerdown', (e) => { Snd.unlock(); if (this.state !== 'running' || e.button) return; if (e.target.closest('button')) return; const p = pos(e); down = { x: p.x, y: p.y, t: now(), moved: false }; try { st.setPointerCapture(e.pointerId); } catch { } this.onPointer({ type: 'down', x: p.x, y: p.y, dx: 0, dy: 0 }); });
      st.addEventListener('pointermove', (e) => { if (!down || this.state !== 'running') return; const p = pos(e); const dx = p.x - down.x, dy = p.y - down.y; if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.moved = true; this.onPointer({ type: 'move', x: p.x, y: p.y, dx, dy }); });
      const up = (e) => { if (!down) return; const p = pos(e); const d = down; down = null; if (this.state !== 'running') return; const dx = p.x - d.x, dy = p.y - d.y; const dt = now() - d.t; this.onPointer({ type: 'up', x: p.x, y: p.y, dx, dy, dt, tap: !d.moved && dt < 320, swipe: d.moved && dt < 500 && (Math.abs(dx) > 24 || Math.abs(dy) > 24) ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')) : null }); };
      st.addEventListener('pointerup', up); st.addEventListener('pointercancel', () => { down = null; });
    }
    // Botones táctiles bajo el escenario: [{icon|text, press(), release()?}]
    touchButtons(list) {
      this.touchEl.replaceChildren();
      for (const b of list) {
        const btn = h('button', { type: 'button', 'aria-label': b.label || b.text || b.icon }, b.icon ? icon(b.icon) : b.text);
        const start = (e) => { e.preventDefault(); Snd.unlock(); if (this.state !== 'running') return; b.press && b.press(); };
        const stop = (e) => { e.preventDefault(); b.release && b.release(); };
        btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', stop); btn.addEventListener('pointercancel', stop); btn.addEventListener('pointerleave', stop);
        btn.addEventListener('contextmenu', e => e.preventDefault());
        this.touchEl.append(btn);
      }
    }
  }

  /* ---------- Registro de juegos y portada de la pestaña ---------- */
  const GAMES = [];
  function register(def, cls) { def.cls = cls; GAMES.push(def); }
  function startGame(key, container, opts) {
    const def = GAMES.find(g => g.key === key); if (!def) return;
    if (current) current.destroy();
    const g = new def.cls(def, opts || {}); current = g; g.mount(container); return g;
  }
  function ensureCss() { if (document.getElementById(CSS_ID)) return; const s = document.createElement('style'); s.id = CSS_ID; s.textContent = FUN_CSS; document.head.append(s); }
  function renderHub() {
    if (current) { current.destroy(); }
    root.replaceChildren(); G.scrollTo({ top: 0 });
    const p = A.pack(); if (!p) { root.append(h('p', { text: 'No hay ningún tema cargado.' })); return; }
    const list = h('div', { class: 'fun-list' });
    for (const g of GAMES) {
      const ok = g.needs(p); const b = best(g.key);
      list.append(h('button', { class: 'fun-item', type: 'button', disabled: !ok, onclick: () => startGame(g.key, root, { onExit: renderHub }) },
        h('span', { class: 'fun-item-icon' }, icon(g.icon)), h('div', {}, h('div', { class: 'fun-item-name', text: g.name }), h('div', { class: 'fun-item-desc', text: ok ? g.desc : 'Este tema no tiene contenido suficiente para este juego.' })),
        h('span', { class: 'fun-item-best' }, b ? 'Récord ' + b.score : ''), icon('right', 'fun-chev')));
    }
    root.append(h('section', { class: 'fun' },
      h('div', { class: 'fun-hub-head' }, h('h1', { text: 'FUN' }), h('p', { text: 'Seis juegos de acción con las preguntas de «' + p.title + '». Para jugar con el teclado o con el dedo; el sonido se apaga en cada juego.' })),
      list
    ));
  }
  function mount(container, apiIn) {
    api = apiIn || null; root = container; ensureCss(); renderHub();
  }
  function unmount() { if (current) current.destroy(); current = null; }

  /* ===================== Invasión: dispara a la respuesta correcta ===================== */
  class Invaders extends Game {
    setup() {
      const p = A.pack(); this.pool = mcPool(p);
      this.queue = A.pick(this.pool, Math.min(10, this.pool.length)).map(dealMc);
      this.ship = { x: 0, w: 34, h: 22, target: null }; this.bullets = []; this.pods = []; this.stars = []; this.round = -1; this.speed = 24; this.cool = 0; this.busy = false; this.roundT = 0; this.q = null;
      this.touchButtons([
        { icon: 'left', label: 'Izquierda', press: () => this.keys.add('TouchLeft'), release: () => this.keys.delete('TouchLeft') },
        { icon: 'fire', label: 'Disparar', press: () => this.shoot() },
        { icon: 'right', label: 'Derecha', press: () => this.keys.add('TouchRight'), release: () => this.keys.delete('TouchRight') }
      ]);
    }
    howto() { return [{ keys: ['left', 'right'], text: 'Mueve la nave. En el móvil, arrastra el dedo o usa los botones.' }, { keys: ['Espacio'], text: 'Dispara a la cápsula con la letra de la respuesta correcta. En el móvil, toca la pantalla.' }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    start() { this.ship.x = this.cv.W / 2; this.makeStars(); this.nextRound(); }
    onResize() { this.makeStars(); }
    makeStars() { const { W, H } = this.cv; this.stars = Array.from({ length: 40 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(1, 2.2), v: rnd(12, 30) })); }
    nextRound() {
      this.round++; if (this.round >= this.queue.length) return this.end(true);
      const q = this.queue[this.round]; this.q = q; this.roundT = 0; this.busy = false; this.bullets = [];
      this.prompt({ label: q.label || A.secName(q.sec), text: q.prompt, options: q.options });
      this.setMeta((this.round + 1) + '/' + this.queue.length);
      const n = q.options.length; const colW = this.cv.W / n;
      const cols = fshuffle(q.options.map((_, i) => i));
      this.pods = q.options.map((t, i) => ({ i, x: colW * cols[i] + colW / 2 + rnd(-colW * .12, colW * .12), y: -24 - rnd(0, 30) - i * 14, r: 21, phase: rnd(0, 6.28), dead: false, fade: 1, ok: null }));
      // Tardan unos 15 s en cruzar la pantalla al principio y unos 9 al final, sea cual sea su altura.
      this.speed = this.cv.H / (15 - Math.min(this.round, 9) * .65);
    }
    shoot() { if (this.state !== 'running' || this.busy || this.cool > 0) return; this.cool = .24; this.bullets.push({ x: this.ship.x, y: this.cv.H - this.ship.h - 18, dead: false }); Snd.shoot(); }
    onKey(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') this.shoot(); }
    onPointer(ev) { if (ev.type === 'move') this.ship.target = ev.x; else if (ev.type === 'up' && ev.tap) this.shoot(); }
    tick(dt) {
      const { W, H } = this.cv; const s = this.ship;
      let dir = 0; if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.keys.has('TouchLeft')) dir -= 1; if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.keys.has('TouchRight')) dir += 1;
      if (dir) { s.x += dir * 340 * dt; s.target = null; } else if (s.target != null) { s.x = lerp(s.x, s.target, Math.min(1, dt * 16)); if (Math.abs(s.x - s.target) < .5) s.target = null; }
      s.x = clamp(s.x, s.w / 2 + 6, W - s.w / 2 - 6);
      this.cool = Math.max(0, this.cool - dt);
      for (const st of this.stars) { st.y += st.v * dt; if (st.y > H) { st.y = -2; st.x = rnd(0, W); } }
      for (const b of this.bullets) b.y -= 560 * dt;
      this.bullets = this.bullets.filter(b => b.y > -12 && !b.dead);
      this.roundT += dt;
      const line = H - s.h - 16;
      for (const p of this.pods) {
        if (p.dead) { p.fade = Math.max(0, p.fade - dt * 3); continue; }
        if (this.busy) continue;
        p.y += this.speed * dt; p.x += Math.cos(p.phase + this.roundT * 1.3) * 14 * dt; p.x = clamp(p.x, p.r + 4, W - p.r - 4);
        for (const b of this.bullets) { if (b.dead) continue; const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < (p.r + 4) * (p.r + 4)) { b.dead = true; this.hitPod(p); break; } }
        if (!this.busy && p.y + p.r >= line) { this.reached(p); break; }
      }
    }
    hitPod(p) {
      const q = this.q; this.busy = true;
      if (p.i === q.a) {
        p.dead = true; p.ok = true; Snd.hit(); this.fx.burst(p.x, p.y, this.c.ok, 16);
        const bonus = Math.max(0, Math.round(60 - this.roundT * 5));
        this.hit(100 + bonus, { x: p.x, y: p.y }); this.gradeOnce(q.id, true); this.markLegend(q.a, p.i);
        for (const o of this.pods) if (!o.dead) { o.dead = true; o.fade = .6; }
        this.later(.6, () => this.nextRound());
      } else {
        p.dead = true; p.ok = false; Snd.wrong(); this.fx.burst(p.x, p.y, this.c.ko, 12); this.fx.shake(6); this.markLegend(q.a, p.i); this.gradeOnce(q.id, false);
        const alive = this.miss({ q: q.prompt, a: q.answer });
        this.feedback({ title: 'No era esa', prompt: q.prompt, answer: LETTERS[q.a] + ' · ' + q.answer, why: q.why }).then(() => { if (!alive) this.end(false); else this.nextRound(); });
      }
    }
    reached() {
      const q = this.q; this.busy = true; Snd.wrong(); this.fx.shake(8); this.fx.burst(this.ship.x, this.cv.H - 26, this.c.ko, 18); this.markLegend(q.a, null);
      const alive = this.miss({ q: q.prompt, a: q.answer });
      this.feedback({ title: 'Han llegado hasta ti', prompt: q.prompt, answer: LETTERS[q.a] + ' · ' + q.answer, why: q.why }).then(() => { if (!alive) this.end(false); else this.nextRound(); });
    }
    draw() {
      const { ctx, W, H } = this.cv; const c = this.c; const s = this.ship;
      ctx.save(); ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      const [ox, oy] = this.fx.offset(); ctx.translate(ox, oy);
      ctx.fillStyle = c.line; for (const st of this.stars) ctx.fillRect(st.x, st.y, st.s, st.s);
      const line = H - s.h - 16;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(0, line + .5); ctx.lineTo(W, line + .5); ctx.stroke(); ctx.setLineDash([]);
      for (const p of this.pods) {
        if (p.dead && p.fade <= 0) continue;
        ctx.globalAlpha = p.dead ? p.fade : 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.ok === true ? c.okSoft : p.ok === false ? c.koSoft : c.surface2; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = p.ok === true ? c.ok : p.ok === false ? c.ko : c.line2; ctx.stroke();
        ctx.fillStyle = p.ok === true ? c.ok : p.ok === false ? c.ko : c.ink; ctx.font = '800 18px ' + c.fontDisplay; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LETTERS[p.i], p.x, p.y + 1);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = c.accent; for (const b of this.bullets) ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
      const y = H - 12;
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.moveTo(s.x, y - s.h); ctx.lineTo(s.x + s.w / 2, y); ctx.lineTo(s.x - s.w / 2, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.surface; ctx.fillRect(s.x - 2, y - s.h + 8, 4, 7);
      this.fx.draw(ctx, c.fontUi); ctx.restore();
    }
  }
  register({ key: 'invaders', name: 'Invasión', icon: 'ship', canvas: true, lives: 3, desc: 'Las respuestas bajan en cápsulas con letra. Dispara a la correcta antes de que lleguen a tu nave.', intro: 'Diez preguntas del tema. Cada respuesta baja dentro de una cápsula con su letra; solo una es la buena. Tienes tres vidas.', needs: p => mcPool(p).length >= 6 }, Invaders);
  /* ===================== Ascenso: plataformas; cae sobre la letra correcta para seguir subiendo ===================== */
  class Climb extends Game {
    setup() {
      const p = A.pack(); this.pool = mcPool(p);
      this.queue = A.pick(this.pool, Math.min(10, this.pool.length)).map(dealMc);
      this.player = { x: 0, y: 0, vx: 0, vy: 0, w: 26, h: 30 }; this.cam = 0; this.round = -1; this.spacing = 150; this.gravity = 1200; this.jump = 730; this.busy = false; this.touchDir = 0; this.rows = []; this.startPlat = null; this.lastSafe = null;
      this.touchButtons([
        { icon: 'left', label: 'Izquierda', press: () => this.keys.add('TouchLeft'), release: () => this.keys.delete('TouchLeft') },
        { icon: 'right', label: 'Derecha', press: () => this.keys.add('TouchRight'), release: () => this.keys.delete('TouchRight') }
      ]);
    }
    howto() { return [{ keys: ['left', 'right'], text: 'Dirige el salto en el aire. Rebotas solo al caer sobre una plataforma, y por un lado de la pantalla se sale y por el otro se entra.' }, { keys: ['A', 'B', 'C'], text: 'Cae en la plataforma con la letra de la respuesta correcta. Las equivocadas se rompen.' }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    start() {
      const { W, H } = this.cv; const pl = this.player;
      this.startPlat = { x: W / 2 - 50, y: H - 34, w: 100, neutral: true, row: null, i: -1, broken: false, fade: 1, ok: null };
      this.rows = this.queue.map((q, i) => {
        const n = q.options.length; const slot = W / n; const w = Math.min(100, slot - 16); const y = H - 34 - (i + 1) * this.spacing; const order = fshuffle(q.options.map((_, k) => k));
        const row = { q, i, y, answered: false, plats: [] };
        row.plats = q.options.map((_, k) => ({ i: k, x: slot * order[k] + (slot - w) / 2 + rnd(-5, 5), y, w, row, broken: false, fade: 1, ok: null }));
        return row;
      });
      this.goalY = H - 34 - (this.queue.length + 1) * this.spacing; this.baseY = H - 34; this.prevH = H;
      pl.x = W / 2; pl.y = this.startPlat.y - pl.h; pl.vy = -this.jump; pl.vx = 0; this.cam = 0; this.lastSafe = this.startPlat; this.round = -1;
      this.nextRound();
    }
    onResize() { /* las plataformas se recolocan proporcionalmente al nuevo ancho; si cambia el alto, la cámara deja el suelo abajo */
      const { W, H } = this.cv; if (this.prevH) this.cam += this.prevH - H; this.prevH = H;
      if (!this.startPlat) { this.prevW = W; return; } // en la portada aún no hay plataformas
      for (const r of this.rows) { const n = r.q.options.length; const slot = W / n; const w = Math.min(100, slot - 16); r.plats.forEach((p, k) => { const c = (p.x + p.w / 2) / (this.prevW || W); p.x = clamp(c * W - w / 2, 4, W - w - 4); p.w = w; }); }
      this.startPlat.x = W / 2 - 50; this.prevW = W;
    }
    nextRound() {
      this.round++; if (this.round >= this.queue.length) return this.end(true);
      const q = this.rows[this.round].q; this.busy = false;
      // Tiempo para leer: mientras dura, el salto va a cámara lenta (misma trayectoria). Si no, el rebote caía solo en la plataforma
      // de encima a los 0,8 s, sin tocar nada (en 390 px pasaba en 3 de cada 4 partidas) y contaba como respuesta.
      this.roundT = 0; this.readT = 1.2 + Math.min(2.8, (q.prompt.length + q.options.join(' ').length) / 70);
      this.prompt({ label: q.label || A.secName(q.sec), text: q.prompt, options: q.options });
      this.setMeta((this.round + 1) + '/' + this.queue.length);
    }
    onPointer(ev) { if (ev.type === 'down' || ev.type === 'move') this.touchDir = ev.x < this.cv.W / 2 ? -1 : 1; else if (ev.type === 'up') this.touchDir = 0; }
    tick(dt) {
      if (this.busy) return;
      const { W, H } = this.cv; const pl = this.player; if (!this.prevW) this.prevW = W; this.roundT += dt; const vdt = this.roundT < this.readT ? dt * .3 : dt;
      let dir = 0; if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.keys.has('TouchLeft')) dir -= 1; if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.keys.has('TouchRight')) dir += 1; if (!dir) dir = this.touchDir;
      pl.vx = lerp(pl.vx, dir * 300, Math.min(1, dt * 10));
      const prevY = pl.y; pl.vy += this.gravity * vdt; pl.x += pl.vx * dt; pl.y += pl.vy * vdt;
      if (pl.x < -pl.w / 2) pl.x += W + pl.w; else if (pl.x > W + pl.w / 2) pl.x -= W + pl.w;
      if (pl.vy > 0) {
        const feetPrev = prevY + pl.h, feet = pl.y + pl.h; const cur = this.rows[this.round];
        const solid = [this.startPlat]; for (const r of this.rows) if (r.answered || r === cur) solid.push(...r.plats);
        for (const p of solid) { if (p.broken) continue; if (feetPrev <= p.y + 2 && feet >= p.y && pl.x + pl.w * .4 > p.x && pl.x - pl.w * .4 < p.x + p.w) { this.land(p); break; } }
      }
      if (pl.y - this.cam < H * .42) this.cam = pl.y - H * .42;
      if (pl.y - this.cam > H + 30) this.fell();
      for (const r of this.rows) for (const p of r.plats) if (p.broken && p.fade > 0) p.fade = Math.max(0, p.fade - dt * 2.5);
    }
    bounce(p) { const pl = this.player; pl.y = p.y - pl.h; pl.vy = -this.jump; }
    land(p) {
      const row = p.row;
      if (!row || row.answered) { this.bounce(p); Snd.step(); if (!row || row.plats[row.q.a] === p) this.lastSafe = p; return; }
      const q = row.q;
      if (p.i === q.a) {
        row.answered = true; p.ok = true; this.lastSafe = p; this.bounce(p); Snd.hit();
        this.fx.burst(p.x + p.w / 2, p.y - this.cam, this.c.ok, 12, 120);
        this.hit(100 + this.round * 5, { x: p.x + p.w / 2, y: p.y - this.cam - 22 }); this.gradeOnce(q.id, true); this.markLegend(q.a, p.i);
        if (this.round + 1 >= this.queue.length) { this.busy = true; this.later(.5, () => this.end(true)); } else this.nextRound();
      } else {
        p.broken = true; p.ok = false; this.player.vy = 60; Snd.wrong(); this.fx.burst(p.x + p.w / 2, p.y - this.cam, this.c.ko, 12); this.fx.shake(6);
        this.markLegend(q.a, p.i); this.gradeOnce(q.id, false); this.busy = true;
        const alive = this.miss({ q: q.prompt, a: q.answer });
        this.feedback({ title: 'Esa plataforma se rompe', prompt: q.prompt, answer: LETTERS[q.a] + ' · ' + q.answer, why: q.why }).then(() => { if (!alive) return this.end(false); this.respawn(row); });
      }
    }
    // Tras un fallo: la fila queda resuelta y se sigue desde su plataforma correcta.
    respawn(row) { const good = row.plats[row.q.a]; row.answered = true; good.ok = true; good.broken = false; this.lastSafe = good; const pl = this.player; pl.x = good.x + good.w / 2; pl.vx = 0; this.bounce(good); this.cam = Math.min(this.cam, pl.y - this.cv.H * .55); this.nextRound(); }
    // Caída al vacío: error de manos, no de conocimiento. Cuesta una vida y se vuelve a la última plataforma segura con la misma pregunta.
    fell() {
      this.busy = true; Snd.wrong(); this.fx.shake(6);
      const alive = this.miss(null, { count: false });
      if (!alive) return this.end(false);
      const s = this.lastSafe; const pl = this.player; pl.x = s.x + s.w / 2; pl.vx = 0; this.bounce(s); this.cam = Math.min(this.cam, pl.y - this.cv.H * .55);
      this.banner('Te has caído', 900); this.later(.5, () => { this.busy = false; });
    }
    draw() {
      const { ctx, W, H } = this.cv; const c = this.c; const pl = this.player; const cam = this.cam;
      ctx.save(); ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      const [ox, oy] = this.fx.offset(); ctx.translate(ox, oy);
      // Marcas de altura cada tramo.
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.setLineDash([3, 9]);
      for (let i = 0; i <= this.queue.length; i++) { const y = this.rows.length ? (this.baseY - i * this.spacing) - cam : 0; if (y < -2 || y > H + 2) continue; ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); ctx.stroke(); }
      ctx.setLineDash([]);
      // Meta.
      const gy = this.goalY - cam; if (gy > -20 && gy < H + 20) { ctx.fillStyle = c.ink2; ctx.font = '600 13px ' + c.fontUi; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('Meta', W / 2, gy - 6); ctx.fillStyle = c.accent; ctx.fillRect(W / 2 - 40, gy - 3, 80, 3); }
      const drawPlat = (p, alpha) => {
        const y = p.y - cam; if (y < -30 || y > H + 30 || (p.broken && p.fade <= 0)) return;
        ctx.globalAlpha = alpha * (p.broken ? p.fade : 1);
        roundRect(ctx, p.x, y, p.w, 5, 14);
        ctx.fillStyle = p.ok === true ? c.okSoft : p.ok === false ? c.koSoft : p.neutral ? c.surface2 : c.surface; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = p.ok === true ? c.ok : p.ok === false ? c.ko : c.line2; ctx.stroke();
        if (p.i >= 0) { ctx.fillStyle = p.ok === true ? c.ok : p.ok === false ? c.ko : c.ink; ctx.font = '800 14px ' + c.fontDisplay; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LETTERS[p.i], p.x + p.w / 2, y + 7.5); }
        ctx.globalAlpha = 1;
      };
      drawPlat(this.startPlat, 1);
      for (const r of this.rows) { const alpha = r.answered ? .55 : r.i === this.round ? 1 : .3; for (const p of r.plats) drawPlat(p, alpha); }
      // Jugador: una figura redondeada con dos ojos.
      const px = pl.x, py = pl.y - cam;
      roundRect(ctx, px - pl.w / 2, py, pl.w, 9, pl.h); ctx.fillStyle = c.accent; ctx.fill();
      ctx.fillStyle = c.accentInk; ctx.beginPath(); ctx.arc(px - 5, py + 10, 2.2, 0, Math.PI * 2); ctx.arc(px + 5, py + 10, 2.2, 0, Math.PI * 2); ctx.fill();
      this.fx.draw(ctx, c.fontUi); ctx.restore();
    }
  }
  register({ key: 'climb', name: 'Ascenso', icon: 'stairs', canvas: true, lives: 3, desc: 'Plataformas con letra. Salta hasta la de la respuesta correcta; las otras se rompen bajo tus pies.', intro: 'Diez pisos, uno por pregunta. Rebotas sin parar: dirige el salto y cae sobre la plataforma de la respuesta correcta para subir al siguiente piso. Tres vidas.', needs: p => mcPool(p).length >= 6 }, Climb);
  /* ===================== Carrera: elige el carril de la categoría correcta ===================== */
  class Runner extends Game {
    setup() {
      const p = A.pack(); this.sets = fshuffle(sortSets(p, 5));
      this.queue = []; for (const s of this.sets) for (const it of s.items) this.queue.push({ set: s, item: it });
      this.queue = this.queue.slice(0, 15);
      this.car = { lane: 0, x: 0 }; this.lanes = 2; this.speed = 150; this.gate = null; this.idx = -1; this.setHits = new Map(); this.roadT = 0; this.marks = [];
      this.touchButtons([{ icon: 'left', label: 'Carril izquierdo', press: () => this.move(-1) }, { icon: 'right', label: 'Carril derecho', press: () => this.move(1) }]);
    }
    howto() { return [{ keys: ['left', 'right'], text: 'Cambia de carril. En el móvil, toca el carril al que quieres ir.' }, { keys: ['1', '2', '3'], text: 'Ir directo a ese carril.', kb: true }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    start() { this.car.x = 0; this.nextGate(); }
    nextGate() {
      this.idx++; if (this.idx >= this.queue.length) { this.finishSets(); return this.end(true); }
      const g = this.queue[this.idx]; const prev = this.idx > 0 ? this.queue[this.idx - 1].set : null;
      this.lanes = g.set.cats.length; if (this.car.lane >= this.lanes) this.car.lane = this.lanes - 1;
      if (g.set !== prev) this.banner(g.set.title, 1300);
      this.gate = { y: -90, item: g.item, set: g.set, resolved: false, chosen: null };
      this.prompt({ label: g.set.title, text: g.item.t, options: g.set.cats, letters: ['1', '2', '3'] });
      this.setMeta((this.idx + 1) + '/' + this.queue.length);
    }
    move(d) { if (this.state !== 'running') return; const l = clamp(this.car.lane + d, 0, this.lanes - 1); if (l !== this.car.lane) { this.car.lane = l; Snd.step(); } }
    onKey(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.move(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.move(1);
      else if (/^(Digit|Numpad)[123]$/.test(e.code)) { const n = +e.code.slice(-1) - 1; if (n < this.lanes && n !== this.car.lane) { this.car.lane = n; Snd.step(); } }
    }
    onPointer(ev) { if (ev.type === 'down') { const l = clamp(Math.floor(ev.x / (this.cv.W / this.lanes)), 0, this.lanes - 1); if (l !== this.car.lane) { this.car.lane = l; Snd.step(); } } }
    tick(dt) {
      const { W, H } = this.cv; this.roadT += this.speed * dt;
      const laneW = W / this.lanes; const tx = laneW * this.car.lane + laneW / 2;
      this.car.x = this.car.x ? lerp(this.car.x, tx, Math.min(1, dt * 12)) : tx;
      const g = this.gate; if (!g) return;
      g.y += this.speed * dt;
      const carY = H - 78;
      if (!g.resolved && g.y + 26 >= carY - 22) this.resolve(g);
      if (g.resolved && g.y > H + 60 && this.pending) { const f = this.pending; this.pending = null; f(); }
    }
    resolve(g) {
      g.resolved = true; g.chosen = this.car.lane; const ok = this.car.lane === g.item.c; const set = g.set;
      const rec = this.setHits.get(set.id) || { hits: 0, total: 0 }; rec.total++; if (ok) rec.hits++; this.setHits.set(set.id, rec);
      if (!set.gradeAsSet && g.item.id) this.gradeOnce(g.item.id, ok);
      this.markLegend(g.item.c, this.car.lane);
      if (ok) {
        Snd.hit(); this.fx.burst(this.car.x, this.cv.H - 78, this.c.ok, 10, 120);
        this.hit(80 + Math.round(this.speed / 6), { x: this.car.x, y: this.cv.H - 120 });
        this.speed = Math.min(400, this.speed + 14);
        this.pending = () => { if (this.state === 'running') this.nextGate(); };
      } else {
        Snd.wrong(); this.fx.shake(8); this.fx.burst(this.car.x, this.cv.H - 78, this.c.ko, 16); this.speed = Math.max(150, this.speed - 50);
        const alive = this.miss({ q: g.item.t, a: set.cats[g.item.c] });
        const why = g.item.why ? (g.item.c === 0 ? 'Es verdadero. ' : 'Es falso. ') + g.item.why : '';
        this.feedback({ title: 'Carril equivocado', prompt: g.item.t, answer: set.cats[g.item.c], why }).then(() => { if (!alive) { this.finishSets(); this.end(false); } else this.nextGate(); });
      }
    }
    finishSets() {
      for (const s of this.sets) { const r = this.setHits.get(s.id); if (!r || !s.gradeAsSet) continue; this.gradeOnce(s.id, r.hits === r.total ? true : r.hits / r.total >= .8 ? 'partial' : false); }
    }
    draw() {
      const { ctx, W, H } = this.cv; const c = this.c; const laneW = W / this.lanes;
      ctx.save(); ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      const [ox, oy] = this.fx.offset(); ctx.translate(ox, oy);
      // Asfalto y marcas de carril que avanzan hacia abajo.
      ctx.fillStyle = c.surface2; ctx.fillRect(8, 0, W - 16, H);
      ctx.strokeStyle = c.line2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(8, H); ctx.moveTo(W - 8, 0); ctx.lineTo(W - 8, H); ctx.stroke();
      ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.setLineDash([22, 22]); ctx.lineDashOffset = -(this.roadT % 44);
      for (let i = 1; i < this.lanes; i++) { ctx.beginPath(); ctx.moveTo(laneW * i, 0); ctx.lineTo(laneW * i, H); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = c.ink2; ctx.font = '600 13px ' + c.fontUi; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < this.lanes; i++) ctx.fillText(String(i + 1), laneW * i + laneW / 2, H - 18);
      // Puerta: una caja por carril con el nombre de la categoría.
      const g = this.gate;
      if (g) {
        const bh = 52;
        for (let i = 0; i < this.lanes; i++) {
          const x = laneW * i + 10, w = laneW - 20, y = g.y;
          let fill = c.surface, stroke = c.line2, ink = c.ink;
          if (g.resolved) { if (i === g.item.c) { fill = c.okSoft; stroke = c.ok; ink = c.ok; } else if (i === g.chosen) { fill = c.koSoft; stroke = c.ko; ink = c.ko; } }
          roundRect(ctx, x, y, w, 6, bh); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
          ctx.fillStyle = ink; ctx.font = '600 13px ' + c.fontUi; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const lines = wrapText(ctx, g.set.cats[i], w - 14, 2); const lh = 16; const y0 = y + bh / 2 - (lines.length - 1) * lh / 2;
          lines.forEach((ln, k) => ctx.fillText(ln, x + w / 2, y0 + k * lh));
        }
      }
      // Coche.
      const cx = this.car.x || laneW / 2, cy = H - 78, cw = 32, ch = 50;
      roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, 8, ch); ctx.fillStyle = c.accent; ctx.fill();
      ctx.fillStyle = c.accentInk; ctx.globalAlpha = .7; roundRect(ctx, cx - cw / 2 + 6, cy - ch / 2 + 9, cw - 12, 3, 10); ctx.fill(); roundRect(ctx, cx - cw / 2 + 6, cy + ch / 2 - 16, cw - 12, 3, 7); ctx.fill(); ctx.globalAlpha = 1;
      this.fx.draw(ctx, c.fontUi); ctx.restore();
    }
  }
  register({ key: 'runner', name: 'Carrera', icon: 'road', canvas: true, lives: 3, desc: 'Cada frase pertenece a una categoría. Ponte en el carril correcto antes de llegar a la puerta.', intro: 'La carretera se divide en carriles con nombre. Lee la frase, elige el carril de su categoría y pasa por la puerta. Cuanto más aciertas, más rápido vas.', needs: p => sortSets(p).length >= 1 }, Runner);
  /* ===================== Lluvia: atrapa la palabra que responde y esquiva las demás ===================== */
  class Rain extends Game {
    setup() {
      const p = A.pack();
      const ks = p.concepts.filter(k => k.term.length <= 26); const cs = clozePool(p).filter(c => c.answer.length <= 18);
      const kRounds = ks.length >= 5 ? A.pick(ks, Math.min(7, ks.length)).map(k => ({ id: k.id, label: 'Qué término es', text: k.def, answer: k.term, decoys: distinct(fshuffle(ks.filter(x => x.id !== k.id)).map(x => x.term), [k.term]).slice(0, 4), why: '' })) : [];
      const cRounds = cs.length >= 5 ? A.pick(cs, Math.min(5, cs.length)).map(c => ({ id: c.id, label: 'Qué palabra falta', text: c.text.replace('___', '______'), answer: c.answer, decoys: distinct(fshuffle(cs.filter(x => x.id !== c.id)).map(x => x.answer), [c.answer, ...c.alt]).slice(0, 4), why: c.hint ? 'Pista: ' + c.hint : '', small: true })) : [];
      this.rounds = fshuffle([...kRounds, ...cRounds]).slice(0, 10);
      this.player = { x: 0, w: 60, h: 16, target: null }; this.drops = []; this.round = -1; this.speed = 90; this.busy = false; this.spawnT = 0; this.bag = []; this.roundT = 0; this.r = null;
      this.touchButtons([
        { icon: 'left', label: 'Izquierda', press: () => this.keys.add('TouchLeft'), release: () => this.keys.delete('TouchLeft') },
        { icon: 'right', label: 'Derecha', press: () => this.keys.add('TouchRight'), release: () => this.keys.delete('TouchRight') }
      ]);
    }
    howto() { return [{ keys: ['left', 'right'], text: 'Mueve la cesta. En el móvil, arrastra el dedo o usa los botones.' }, { keys: ['Atrapa'], text: 'Recoge la palabra que responde al enunciado y deja caer las demás. Recoger otra cuesta una vida.' }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    start() { this.player.x = this.cv.W / 2; this.nextRound(); }
    nextRound() {
      this.round++; if (this.round >= this.rounds.length) return this.end(true);
      const r = this.rounds[this.round]; this.r = r; this.busy = false; this.drops = []; this.roundT = 0; this.spawnT = .5;
      const decoys = r.decoys.slice(); const first = fshuffle([r.answer, ...decoys.splice(0, 2)]);
      this.bag = [...first, ...fshuffle(decoys)].map(t => ({ t, ok: t === r.answer }));
      this.prompt({ label: r.label, text: r.text, small: !!r.small }); this.setMeta((this.round + 1) + '/' + this.rounds.length);
      this.speed = this.cv.H / 5.5 + this.round * 7;
    }
    onPointer(ev) { if (ev.type === 'move' || ev.type === 'down') this.player.target = ev.x; }
    tick(dt) {
      if (this.busy) return; const { W, H } = this.cv; const pl = this.player;
      let dir = 0; if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.keys.has('TouchLeft')) dir -= 1; if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.keys.has('TouchRight')) dir += 1;
      if (dir) { pl.x += dir * 380 * dt; pl.target = null; } else if (pl.target != null) { pl.x = lerp(pl.x, pl.target, Math.min(1, dt * 16)); if (Math.abs(pl.x - pl.target) < .5) pl.target = null; }
      pl.x = clamp(pl.x, pl.w / 2 + 4, W - pl.w / 2 - 4);
      this.roundT += dt; this.spawnT -= dt;
      if (this.spawnT <= 0 && this.bag.length) {
        this.spawnT = Math.max(.7, 1.15 - this.round * .04); const d = this.bag.shift();
        this.cv.ctx.font = '600 14px ' + this.c.fontUi; const w = Math.min(W - 24, Math.ceil(this.cv.ctx.measureText(d.t).width) + 24);
        this.drops.push({ t: d.t, ok: d.ok, w, h: 30, x: rnd(12 + w / 2, W - 12 - w / 2), y: -34, vy: this.speed * rnd(.9, 1.15), done: false, fade: 1, caught: null });
      }
      const py = H - 30;
      for (const d of this.drops) {
        if (d.done) { d.fade = Math.max(0, d.fade - dt * 3); continue; }
        d.y += d.vy * dt;
        if (d.y + d.h / 2 >= py - pl.h / 2 && d.y - d.h / 2 <= py + pl.h && Math.abs(d.x - pl.x) < (pl.w + d.w) / 2 * .75) { this.catchDrop(d); if (this.busy) return; }
        else if (d.y - d.h / 2 > H) { d.done = true; d.fade = 0; if (d.ok) { this.escaped(); return; } }
      }
    }
    catchDrop(d) {
      const r = this.r; d.done = true; d.caught = d.ok;
      if (d.ok) {
        Snd.hit(); this.fx.burst(d.x, d.y, this.c.ok, 14); this.hit(100 + Math.max(0, Math.round(40 - this.roundT * 5)), { x: d.x, y: d.y - 16 }); this.gradeOnce(r.id, true); this.busy = true;
        for (const o of this.drops) if (!o.done) { o.done = true; o.fade = .6; }
        this.later(.55, () => this.nextRound());
      } else {
        Snd.wrong(); this.fx.burst(d.x, d.y, this.c.ko, 12); this.fx.shake(6); this.gradeOnce(r.id, false); this.busy = true;
        const alive = this.miss({ q: r.text, a: r.answer });
        this.feedback({ title: 'Esa no era', prompt: r.text, answer: r.answer, why: r.why }).then(() => { if (!alive) this.end(false); else this.nextRound(); });
      }
    }
    escaped() {
      const r = this.r; this.busy = true; Snd.wrong(); this.fx.shake(4);
      const alive = this.miss({ q: r.text, a: r.answer });
      this.feedback({ title: 'Se te ha escapado', prompt: r.text, answer: r.answer, why: r.why }).then(() => { if (!alive) this.end(false); else this.nextRound(); });
    }
    draw() {
      const { ctx, W, H } = this.cv; const c = this.c; const pl = this.player;
      ctx.save(); ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      const [ox, oy] = this.fx.offset(); ctx.translate(ox, oy);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H - 12.5); ctx.lineTo(W, H - 12.5); ctx.stroke();
      for (const d of this.drops) {
        if (d.done && d.fade <= 0) continue; ctx.globalAlpha = d.done ? d.fade : 1;
        roundRect(ctx, d.x - d.w / 2, d.y - d.h / 2, d.w, 6, d.h);
        ctx.fillStyle = d.caught === true ? c.okSoft : d.caught === false ? c.koSoft : c.surface2; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = d.caught === true ? c.ok : d.caught === false ? c.ko : c.line2; ctx.stroke();
        ctx.fillStyle = d.caught === true ? c.ok : d.caught === false ? c.ko : c.ink; ctx.font = '600 14px ' + c.fontUi; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.t, d.x, d.y + 1);
        ctx.globalAlpha = 1;
      }
      // Cesta: una U de acento.
      const py = H - 30; ctx.strokeStyle = c.accent; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(pl.x - pl.w / 2, py - pl.h / 2); ctx.lineTo(pl.x - pl.w / 2 + 6, py + pl.h / 2); ctx.lineTo(pl.x + pl.w / 2 - 6, py + pl.h / 2); ctx.lineTo(pl.x + pl.w / 2, py - pl.h / 2); ctx.stroke();
      this.fx.draw(ctx, c.fontUi); ctx.restore();
    }
  }
  register({ key: 'rain', name: 'Lluvia', icon: 'basket', canvas: true, lives: 3, desc: 'Caen palabras. Atrapa con la cesta la que responde al enunciado y esquiva todas las demás.', intro: 'Diez enunciados. Las palabras caen mezcladas: solo una responde. Mueve la cesta para recogerla y aparta la cesta de las otras. Tres vidas.', needs: p => p.concepts.filter(k => k.term.length <= 26).length >= 5 || clozePool(p).filter(c => c.answer.length <= 18).length >= 5 }, Rain);
  /* ===================== Jefes: aventura por niveles, un jefe por sección y un jefe final ===================== */
  const BEATEN = {}; // jefes vencidos mientras la página está abierta (sin progreso guardado, como pidió Cero)
  class Boss extends Game {
    setup() {
      const p = A.pack(); this.p = p; this.pool = mcPool(p); this.cloze = clozePool(p);
      this.levels = []; let n = 0;
      for (const s of p.sections) {
        const items = this.pool.filter(it => it.sec === s.id); if (items.length < 4) continue; n++;
        this.levels.push({ id: s.id, n, name: s.name, items, cloze: this.cloze.filter(c => c.sec === s.id), hp: 100, timer: 20 });
      }
      this.levels.push({ id: 'final', n: n + 1, name: 'Jefe final', items: this.pool, cloze: this.cloze, hp: 160, timer: 15, final: true });
      this.level = null; this.waiting = true; this.current = null; this.choiceBtns = null; this.input = null;
    }
    howto() { return [{ keys: ['1', '2', '3', '4'], text: 'Responde con el número de la opción o tócala. Cuanto antes, más daño haces.' }, { keys: ['Intro'], text: 'Cada cuatro turnos, ataque cargado: escribe la palabra que falta y pulsa Intro.' }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    showStart() { if (this.opts.level || this.opts.skipIntro) return this.begin(); super.showStart(); }
    start() { if (this.opts.level) { const lv = this.levels.find(l => l.id === this.opts.level); if (lv) return this.beginBattle(lv); } this.chooseLevel(); }
    beaten() { return BEATEN[A.packId()] || (BEATEN[A.packId()] = {}); }
    chooseLevel() {
      this.state = 'paused'; cancelAnimationFrame(this.rafId); this.setMeta('');
      const done = this.beaten();
      const list = h('div', { class: 'fun-levels' });
      for (const lv of this.levels) {
        const isDone = !!done[lv.id];
        list.append(h('button', { class: 'fun-level' + (isDone ? ' done' : ''), type: 'button', onclick: () => this.beginBattle(lv) },
          h('span', { class: 'fun-n', text: String(lv.n) }),
          h('div', {}, h('div', { class: 'fun-name', text: lv.name }), h('div', { class: 'fun-sub', text: (lv.final ? 'Preguntas de todo el tema' : lv.items.length + ' preguntas') + ' · ' + lv.hp + ' de vida · ' + lv.timer + ' s por turno' })),
          h('span', { class: 'fun-state' }, isDone ? [icon('check'), 'Derrotado'] : '')));
      }
      this.showOverlay(h('div', { class: 'fun-panel' }, h('h2', { text: 'Elige un jefe' }), list, h('div', { class: 'fun-row' }, h('button', { class: 'fun-btn tertiary', type: 'button', onclick: () => this.exit() }, 'Volver'))), { kind: 'levels', focus: true });
    }
    beginBattle(lv) {
      this.hideOverlay(); this.level = lv; this.hp = 100; this.bhp = lv.hp; this.turn = 0; this.timerMax = lv.timer; this.timeLeft = lv.timer; this.waiting = true; this.queue = [];
      this.score = 0; this.combo = 0; this.scoreEl.textContent = '0'; this.comboEl.classList.add('hidden');
      this.build(); this.setMeta(lv.name);
      this.state = 'running'; this.last = now(); this.loop(); this.nextTurn();
    }
    build() {
      this.stage.replaceChildren(); this.stage.style.minHeight = '';
      this.pSprite = h('div', { class: 'fun-sprite' }, icon('ship')); this.bSprite = h('div', { class: 'fun-sprite' }, icon('boss'));
      this.pBar = h('i', { style: 'width:100%' }); this.bBar = h('i', { style: 'width:100%' }); this.pNum = h('span', { text: '100' }); this.bNum = h('span', { text: String(this.bhp) });
      this.arena = h('div', { class: 'fun-arena' },
        h('div', { class: 'fun-fighter' }, this.pSprite, h('div', { class: 'fun-hp' }, h('div', {}, h('span', { text: 'Tú' }), this.pNum), h('div', { class: 'fun-track' }, this.pBar))),
        h('div', { class: 'fun-fighter boss' }, this.bSprite, h('div', { class: 'fun-hp' }, h('div', {}, h('span', { text: this.level.name }), this.bNum), h('div', { class: 'fun-track' }, this.bBar))));
      this.timerBar = h('i', { style: 'width:100%' }); this.timerNum = h('span', { text: '' });
      this.timerEl = h('div', { class: 'fun-timer' }, h('div', { class: 'fun-track' }, this.timerBar), this.timerNum);
      this.turnEl = h('div', {});
      this.stage.append(this.arena, h('div', { class: 'fun-turn' }, this.timerEl, this.turnEl));
    }
    nextTurn() {
      if (this.state !== 'running') return;
      this.turn++; this.waiting = false; this.choiceBtns = null; this.input = null;
      if (!this.queue.length) this.queue = A.pick(this.level.items, Math.min(12, this.level.items.length));
      this.timerMax = Math.max(8, this.level.timer - Math.floor(this.turn / 3)); this.timeLeft = this.timerMax; this.timerEl.classList.remove('low');
      const charged = this.level.cloze.length > 0 && this.turn % 4 === 0;
      if (charged) { const c = this.level.cloze[Math.floor(Math.random() * this.level.cloze.length)]; this.current = { kind: 'cloze', c }; this.renderCloze(c); }
      else { const q = dealMc(this.queue.shift()); this.current = { kind: 'mc', q }; this.renderMc(q); }
    }
    renderMc(q) {
      this.prompt({ label: 'Turno ' + this.turn + ' · ' + (q.label || A.secName(q.sec)), text: q.prompt });
      const box = h('div', { class: 'fun-choices' + (q.options.length === 2 ? ' two' : '') }); this.choiceBtns = [];
      q.options.forEach((t, i) => { const b = h('button', { class: 'fun-choice', type: 'button', onclick: () => this.answerMc(i) }, h('span', { class: 'fun-key', text: q.kind === 'tf' ? (i === 0 ? 'V' : 'F') : String(i + 1) }), h('span', { text: t })); this.choiceBtns.push(b); box.append(b); });
      this.turnEl.replaceChildren(box); this.fit(false);
    }
    renderCloze(c) {
      this.prompt({ label: 'Turno ' + this.turn + ' · ataque cargado: escribe la palabra que falta', text: c.text.replace('___', '______') });
      this.input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Palabra que falta', enterkeyhint: 'go' });
      this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.answerCloze(); } });
      const btn = h('button', { class: 'fun-btn primary', type: 'button', onclick: () => this.answerCloze() }, 'Atacar');
      this.turnEl.replaceChildren(h('div', { class: 'fun-type' }, this.input, btn), c.hint ? h('div', { class: 'fun-label', text: 'Pista: ' + c.hint }) : null); this.fit(false);
      setTimeout(() => { if (this.input && this.state === 'running') this.input.focus({ preventScroll: true }); }, 60);
    }
    onKey(e) {
      if (this.waiting || !this.current || this.current.kind !== 'mc') return; const q = this.current.q; let i = -1;
      if (/^(Digit|Numpad)[1-4]$/.test(e.code)) i = +e.code.slice(-1) - 1; else if (q.kind === 'tf' && e.code === 'KeyV') i = 0; else if (q.kind === 'tf' && e.code === 'KeyF') i = 1;
      if (i >= 0 && i < q.options.length) this.answerMc(i);
    }
    tick(dt) {
      if (this.waiting) return;
      this.timeLeft -= dt; const f = clamp(this.timeLeft / this.timerMax, 0, 1);
      this.timerBar.style.width = (f * 100) + '%'; const secs = Math.ceil(Math.max(0, this.timeLeft)) + ' s'; if (this.timerNum.textContent !== secs) this.timerNum.textContent = secs; this.timerEl.classList.toggle('low', this.timeLeft < 5);
      if (this.timeLeft <= 0) this.timeout();
    }
    hurt(el) { el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt'); }
    lunge(el) { el.classList.add('lunge'); setTimeout(() => el.classList.remove('lunge'), 180); }
    float(anchor, text, cls) {
      const r = anchor.getBoundingClientRect(); const s = this.stage.getBoundingClientRect();
      const d = h('div', { class: 'fun-dmg ' + cls, text }); d.style.left = (r.left - s.left + r.width / 2 - 24) + 'px'; d.style.top = Math.max(0, r.top - s.top + r.height * .2) + 'px';
      this.stage.append(d); setTimeout(() => d.remove(), 760);
    }
    damageBoss(dmg, crit) { this.bhp = Math.max(0, this.bhp - dmg); this.bBar.style.width = (this.bhp / this.level.hp * 100) + '%'; this.bNum.textContent = String(this.bhp); this.float(this.bSprite, '-' + dmg, 'ko' + (crit ? ' crit' : '')); this.hurt(this.bSprite); this.lunge(this.pSprite); }
    damagePlayer(dmg) { this.hp = Math.max(0, this.hp - dmg); this.pBar.style.width = this.hp + '%'; this.pNum.textContent = String(this.hp); this.float(this.pSprite, '-' + dmg, 'ko'); this.hurt(this.pSprite); this.lunge(this.bSprite); }
    answerMc(i) {
      if (this.waiting || this.state !== 'running') return; const q = this.current.q; this.waiting = true;
      this.choiceBtns.forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add('ok'); if (k === i && i !== q.a) b.classList.add('ko'); });
      this.resolveAnswer(i === q.a, q.id, { q: q.prompt, a: q.answer, why: q.why });
    }
    answerCloze() {
      if (this.waiting || this.state !== 'running' || !this.input) return; const c = this.current.c; const v = this.input.value; if (!A.norm(v)) return; this.waiting = true;
      const ok = clozeOk(c, v); this.input.classList.add(ok ? 'ok' : 'ko'); this.input.disabled = true;
      this.resolveAnswer(ok, c.id, { q: c.text.replace('___', '______'), a: c.answer, why: '', charged: true });
    }
    timeout() {
      this.waiting = true; const cur = this.current; if (this.choiceBtns) this.choiceBtns.forEach(b => b.disabled = true); if (this.input) this.input.disabled = true;
      const info = cur.kind === 'mc' ? { q: cur.q.prompt, a: cur.q.answer, why: cur.q.why } : { q: cur.c.text.replace('___', '______'), a: cur.c.answer, why: '' };
      Snd.wrong(); this.damagePlayer(15); this.miss({ q: info.q, a: info.a });
      if (this.hp <= 0) return this.later(.5, () => this.end(false));
      this.feedback({ title: 'Se acabó el tiempo', prompt: info.q, answer: info.a, why: info.why }).then(() => this.nextTurn());
    }
    resolveAnswer(ok, id, info) {
      this.gradeOnce(id, ok);
      if (ok) {
        const speed = clamp(this.timeLeft / this.timerMax, 0, 1); const mult = this.multiplier(); const charged = info.charged ? 1.5 : 1;
        const dmg = Math.round((12 + Math.round(10 * speed)) * mult * charged); const crit = mult >= 2 || !!info.charged;
        if (crit) Snd.crit(); else Snd.hit();
        this.hit(dmg * 4); this.damageBoss(dmg, crit);
        if (this.bhp <= 0) return this.later(.45, () => this.victory());
        this.later(.65, () => this.nextTurn());
      } else {
        Snd.wrong(); this.damagePlayer(20); this.miss({ q: info.q, a: info.a });
        if (this.hp <= 0) return this.later(.5, () => this.end(false));
        this.feedback({ title: 'El jefe contraataca', prompt: info.q, answer: info.a, why: info.why }).then(() => this.nextTurn());
      }
    }
    victory() { this.beaten()[this.level.id] = true; this.end(true); }
    endTitle(won) { return won ? (this.level.final ? 'Jefe final derrotado' : 'Jefe derrotado') : 'Te ha vencido ' + this.level.name; }
    extraEndButtons(won) {
      if (!won) return [];
      const done = this.beaten(); const next = this.levels.find(l => !done[l.id]);
      if (!next) return [];
      return [h('button', { class: 'fun-btn primary', type: 'button', onclick: () => { const c = this.container; const o = this.opts; this.destroy(); startGame(this.key, c, { onExit: o.onExit, level: next.id }); } }, 'Siguiente jefe')];
    }
    restart() { const c = this.container; const o = this.opts; this.destroy(); startGame(this.key, c, { onExit: o.onExit, skipIntro: true }); }
  }
  register({ key: 'boss', name: 'Jefes', icon: 'boss', canvas: false, lives: 0, desc: 'Un jefe por sección y un jefe final. Cada acierto rápido le quita vida; cada fallo te la quita a ti.', intro: 'Combate por turnos. Elige un jefe, responde antes de que se agote el tiempo y encadena aciertos para hacer golpes críticos. El jefe final mezcla todo el tema y tiene más vida.', needs: p => mcPool(p).length >= 8 }, Boss);
  /* ===================== Topos: toca la respuesta antes de que se esconda ===================== */
  class Moles extends Game {
    setup() {
      const p = A.pack(); this.p = p;
      this.concepts = moleConcepts(p); this.cloze = moleCloze(p); this.sorts = moleSorts(p);
      this.duration = 60; this.timeLeft = 60; this.holes = []; this.cur = null; this.lock = true; this.roundN = 0; this.roundT = 0; this.spawnT = 0; this.sinceTarget = 0; this.hits = 0; this.pending = [];
    }
    howto() { return [{ keys: ['Toca'], text: 'Lee el enunciado y toca el topo que lleva la respuesta. Los demás, déjalos pasar.' }, { keys: ['1', '9'], text: 'Con teclado: el número del hueco, de izquierda a derecha y de arriba abajo.', kb: true }, { keys: ['60 s'], text: 'Cada acierto suma puntos; un fallo o un topo escapado resta tiempo.' }, { keys: ['Esc'], text: 'Pausa.', kb: true }]; }
    start() { this.build(); this.timeLeft = this.duration; this.nextRound(); }
    onKey(e) { const m = /^(Digit|Numpad)([1-9])$/.exec(e.code); if (!m) return; const n = +m[2]; this.whack(m[1] === 'Numpad' ? [6, 7, 8, 3, 4, 5, 0, 1, 2][n - 1] : n - 1); }
    build() {
      this.grid = h('div', { class: 'fun-moles' }); this.holes = [];
      for (let i = 0; i < 9; i++) {
        const m = h('button', { class: 'fun-mole', type: 'button', tabindex: '-1' });
        m.addEventListener('pointerdown', (e) => { e.preventDefault(); this.whack(i); });
        const hole = h('div', { class: 'fun-hole' }, m);
        this.holes.push({ el: hole, mole: m, up: false, label: null, isTarget: false, t: 0 }); this.grid.append(hole);
      }
      this.timeBar = h('i', { style: 'width:100%' }); this.timeNum = h('span', { text: this.duration + ' s' });
      this.timeEl = h('div', { class: 'fun-timebar' }, h('div', { class: 'fun-track' }, this.timeBar), this.timeNum);
      this.stage.replaceChildren(this.grid, this.timeEl); this.stage.style.minHeight = '';
    }
    makeRound() {
      const kinds = []; if (this.concepts.length >= 6) kinds.push('k', 'k'); if (this.cloze.length >= 5) kinds.push('c'); if (this.sorts.length) kinds.push('s');
      if (!kinds.length) return null;
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === 'k') {
        const k = A.pick(this.concepts, 1)[0]; const decoys = distinct(fshuffle(this.concepts.filter(x => x.id !== k.id)).map(x => x.term), [k.term]).slice(0, 6);
        return { kind, id: k.id, label: 'Qué término es', text: k.def, targets: [k.term], decoys, need: 1, answer: k.term };
      }
      if (kind === 'c') {
        const c = A.pick(this.cloze, 1)[0]; const decoys = distinct(fshuffle(this.cloze.filter(x => x.id !== c.id)).map(x => x.answer), [c.answer, ...c.alt]).slice(0, 6);
        return { kind, id: c.id, label: 'Qué palabra falta', text: c.text.replace('___', '______'), targets: [c.answer], decoys, need: 1, answer: c.answer, small: true };
      }
      const s = this.sorts[Math.floor(Math.random() * this.sorts.length)];
      const cats = s.cats.map((_, ci) => ci).filter(ci => s.items.filter(it => it.c === ci).length >= 2 && s.items.filter(it => it.c !== ci).length >= 2);
      const ci = cats[Math.floor(Math.random() * cats.length)];
      const targets = fshuffle(s.items.filter(it => it.c === ci).map(it => it.t)); const decoys = fshuffle(s.items.filter(it => it.c !== ci).map(it => it.t));
      const need = Math.min(3, targets.length);
      return { kind, id: s.id, label: s.title + ' · toca ' + need + ' topos', text: 'Todo lo que sea «' + s.cats[ci] + '»', targets: targets.slice(0, need), decoys: decoys.slice(0, 5), need, answer: targets.slice(0, need).join(' · '), set: true };
    }
    nextRound() {
      const r = this.makeRound(); if (!r) return this.end(true);
      this.roundN++; this.cur = r; this.roundT = 0; this.sinceTarget = 0; this.spawnT = .6; this.hits = 0; this.lock = false; this.pending = r.targets.slice();
      this.hideAll(); this.prompt({ label: r.label, text: r.text, small: !!r.small }); this.setMeta('ronda ' + this.roundN);
    }
    hideAll() { for (const hl of this.holes) this.down(hl); }
    down(hl) { hl.up = false; hl.mole.classList.remove('up', 'ok', 'ko'); hl.label = null; hl.isTarget = false; }
    tick(dt) {
      this.timeLeft -= dt;
      this.timeBar.style.width = clamp(this.timeLeft / this.duration, 0, 1) * 100 + '%'; const secs = Math.ceil(Math.max(0, this.timeLeft)) + ' s'; if (this.timeNum.textContent !== secs) this.timeNum.textContent = secs; this.timeEl.classList.toggle('low', this.timeLeft < 10);
      if (this.timeLeft <= 0) return this.end(true);
      if (this.lock) return;
      this.roundT += dt; this.spawnT += dt;
      for (const hl of this.holes) if (hl.up) { hl.t -= dt; if (hl.t <= 0) this.down(hl); }
      if (this.roundT > (this.cur.set ? 14 : 9)) return this.escaped();
      const f = clamp(this.score / 1800, 0, 1); const every = lerp(.8, .5, f); const upFor = lerp(1.8, 1.1, f);
      if (this.spawnT >= every) { this.spawnT = 0; this.spawn(upFor); }
    }
    spawn(upFor) {
      const free = this.holes.filter(x => !x.up); if (!free.length || this.holes.length - free.length >= 4) return;
      const upLabels = this.holes.filter(x => x.up).map(x => x.label);
      const want = this.pending.filter(t => !upLabels.includes(t)); let label, isTarget;
      if (want.length && (this.sinceTarget >= 2 || Math.random() < .4)) { label = want[Math.floor(Math.random() * want.length)]; isTarget = true; this.sinceTarget = 0; }
      else { const d = this.cur.decoys.filter(x => !upLabels.includes(x)); if (!d.length) return; label = d[Math.floor(Math.random() * d.length)]; isTarget = false; this.sinceTarget++; }
      const hl = free[Math.floor(Math.random() * free.length)];
      hl.up = true; hl.label = label; hl.isTarget = isTarget; hl.t = upFor; hl.mole.textContent = label; hl.mole.classList.toggle('long', label.length > 22); hl.mole.classList.remove('ok', 'ko'); hl.mole.classList.add('up');
    }
    whack(i) {
      if (this.state !== 'running' || this.lock) return; const hl = this.holes[i]; if (!hl.up) return;
      if (hl.isTarget) {
        Snd.tap(); hl.mole.classList.add('ok'); hl.up = false; hl.isTarget = false; this.hits++; this.pending = this.pending.filter(t => t !== hl.label);
        this.hit(50 + Math.max(0, Math.round(30 - this.roundT * 4)));
        if (this.hits >= this.cur.need) { this.lock = true; this.gradeOnce(this.cur.id, true); this.later(.38, () => this.nextRound()); }
      } else {
        Snd.wrong(); hl.mole.classList.add('ko'); hl.up = false; this.timeLeft = Math.max(0, this.timeLeft - 3);
        this.miss({ q: this.cur.text, a: this.cur.answer }); this.gradeOnce(this.cur.id, false);
        this.reveal('No era «' + hl.label + '». ' + (this.cur.set ? 'Valían: ' : 'Era: ') + this.cur.answer);
      }
    }
    escaped() { this.miss({ q: this.cur.text, a: this.cur.answer }); Snd.wrong(); this.timeLeft = Math.max(0, this.timeLeft - 2); this.reveal('Se ha escapado. ' + (this.cur.set ? 'Valían: ' : 'Era: ') + this.cur.answer); }
    reveal(text) {
      this.lock = true; for (const hl of this.holes) if (hl.up) { hl.mole.classList.toggle('ok', hl.isTarget); hl.up = false; }
      this.prompt({ label: text, text: this.cur.text, small: !!this.cur.small }); const lb = this.promptEl.querySelector('.fun-label'); if (lb) lb.style.color = 'var(--ko)';
      this.later(1.5, () => this.nextRound());
    }
    endTitle(won) { return won ? 'Tiempo cumplido' : 'Fin de la partida'; }
  }
  const moleConcepts = (p) => { const k = p.concepts.filter(x => x.term.length <= 34); return k.length >= 6 ? k : []; };
  const moleCloze = (p) => { const c = clozePool(p).filter(x => x.answer.length <= 24); return c.length >= 5 ? c : []; };
  const moleSorts = (p) => p.sort.filter(s => s.cats.length >= 2 && s.items.every(it => it.t.length <= 60) && s.cats.some((_, ci) => s.items.filter(it => it.c === ci).length >= 2 && s.items.filter(it => it.c !== ci).length >= 2));
  register({ key: 'moles', name: 'Topos', icon: 'mole', canvas: false, lives: 0, desc: 'Sesenta segundos. Los términos asoman y se esconden; toca solo el que responde al enunciado.', intro: 'Un minuto de reflejos. Arriba sale una definición, una frase con hueco o una categoría; abajo asoman topos con términos. Toca el que corresponde y deja pasar los demás. Los fallos restan tiempo.', needs: p => moleConcepts(p).length > 0 || moleCloze(p).length > 0 || moleSorts(p).length > 0 }, Moles);
  return { mount, unmount, start: (key) => startGame(key, root, { onExit: renderHub }), games: GAMES, current: () => current, gradeMode: GRADE_MODE, _: { Game, register, h, icon, kbd, colors, Snd, mcPool, dealMc, sortSets, clozePool, clozeOk, LETTERS, A, wrapText, roundRect, clamp, lerp, rnd, reducedMotion, coarse, fshuffle } };
})();
