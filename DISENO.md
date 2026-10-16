# Sistema visual de Repaso Arcade (v2, rediseño de octubre de 2026)

Este archivo es la referencia para cualquier pantalla nueva (incluida la pestaña FUN). Si una pantalla
no sigue esto, parece otra web. Todo el color sale de variables CSS: nada de colores escritos a mano.

## Idea

Cero quiere el orden y el aire de Notion con lo amable y jugable de Duolingo. Una sola columna de 720 px,
fondo de papel, tinta casi negra y un único color de acento que el usuario elige. Jerarquía por tamaño de
letra y espacio en blanco, no por cajas: nada de tarjetas dentro de tarjetas, sin sombras difusas, sin
degradados, sin desenfoques, sin brillos, sin pastillas de colores, sin emojis, sin etiquetas en mayúsculas
encima de cada bloque. Las secciones se separan con una línea fina (`1px solid var(--line)`) o con espacio.
Lo jugable viene de la tipografía redondeada en negrita, de los botones y opciones con borde inferior en
relieve (que se hunden al pulsar) y de las barras de progreso gruesas y redondeadas.

## Variables (definidas en `:root` de src/page.html)

Colores base (claro / oscuro; el modo sigue al sistema y se puede forzar con `html[data-theme="light|dark"]`):

| Variable | Uso | Claro | Oscuro |
|---|---|---|---|
| `--paper` | fondo de página | `#FBFAF7` | `#191917` |
| `--surface` | paneles, inputs, botones secundarios | `#FFFFFF` | `#212120` |
| `--surface-2` | pistas de progreso, teclas, relleno suave | `#EFEDE7` | `#2C2B28` |
| `--ink` | texto principal, botón primario de tinta | `#1E1D1A` | `#ECEAE4` |
| `--ink-2` | texto secundario | `#6F6B63` | `#A5A198` |
| `--line` | líneas finas y bordes | `#E3E0D8` | `#363530` |
| `--line-2` | borde en hover | `#C9C5BB` | `#4F4D46` |
| `--ok` / `--ok-soft` | acierto | `#1B6E45` / `#E1F2E7` | `#63C994` / `#17322A` |
| `--ko` / `--ko-soft` | fallo | `#B33628` / `#F9E1DD` | `#F28E7F` / `#3D1F1B` |
| `--warn` / `--warn-soft` | pendiente, aviso | `#A86F13` / `#F4E6C6` | `#E4B45D` / `#392E14` |

Acento (lo elige el usuario en el botón de la cabecera; `html[data-accent="…"]`, guardado en localStorage `ra.accent`):

| `data-accent` | Nombre | Claro | Oscuro |
|---|---|---|---|
| `tinta` (por defecto) | Tinta | `#2B40D4` | `#9DA8FF` |
| `petroleo` | Petróleo | `#0E7C86` | `#4FC6CF` |
| `ciruela` | Ciruela | `#7A2E8E` | `#D39AE3` |
| `naranja` | Naranja | `#C85A17` | `#F6A062` |
| `carbon` | Carbón (monocromo) | `#1A1813` | `#ECE7DC` |

Derivadas, siempre disponibles: `--accent`, `--accent-ink` (texto sobre el acento), `--accent-soft`
(fondo suave: `color-mix(in srgb, var(--accent) 12%, var(--paper))`), `--accent-edge` y `--ink-edge`
(el color del borde inferior en relieve: el acento o la tinta mezclados al 72 % con negro).

Desde JavaScript (canvas de un juego): `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`.
Cuando el usuario cambia tema o modo, `document` emite el evento `themechange`; vuelve a leer los colores ahí.

## Tipografía

- `--font-display`: "Nunito" (redondeada, Google Fonts). Títulos, nombre de la web, números grandes (peso 800)
  y enunciados de las preguntas (peso 700).
- `--font-ui`: "Nunito Sans" (Google Fonts, misma familia sin remates redondos). Todo lo demás: botones, texto,
  etiquetas. Pesos 400 y 600 (la negrita es 600, no 700).
- Sin monoespaciada. Los números que cambian (puntos, contadores) llevan `font-variant-numeric: tabular-nums`.
- Escala (`rem`): 0.8125 (13 px, etiquetas), 0.9375 (15, texto secundario), 1 (17, texto), 1.375 (22, h3),
  1.625 (26, enunciados), 1.75 (28, h2), 2.5 (40, h1), 4 (64, número protagonista). Interlineado 1.5 en texto, 1.12 en títulos.
- Textos cortos, en frase, sin signos de exclamación y sin mayúsculas sostenidas. Las instrucciones van
  dentro del control (una tecla dibujada, un icono) y no en un párrafo debajo.

## Espacio, formas, movimiento

- Escala de espacio: 4, 8, 12, 16, 24, 32, 48, 64 px. Separación entre secciones: 48 px.
- Radios: `--r-s: 10px` (botones, opciones, inputs), `--r-m: 14px` (paneles grandes). Nada redondo tipo pastilla.
- Relieve: lo pulsable (botones, opciones de respuesta, pasos, tarjeta) lleva borde de 2 px `--line` y un borde
  inferior duro `box-shadow: 0 3px 0 <color>` (2 px en opciones; 4 px en el botón grande de la Ruleta). Al pulsar
  (`:active`) baja esos píxeles con `transform: translateY` y pierde el relieve. Es la única sombra permitida:
  nunca difusa (sin desenfoque).
- Separadores y bordes no pulsables: 1 px `--line`. El foco de teclado es un contorno de 2 px en `--accent`.
- Botones: primario = fondo `--accent`, texto `--accent-ink`, relieve `--accent-edge`; secundario = fondo `--surface`,
  borde y relieve `--line`; terciario (`.btn.text`) = solo texto en `--ink-2`, sin relieve. Altura mínima 46 px.
- Barras de progreso: 8 a 10 px de alto, extremos redondeados, pista `--surface-2`, relleno `--accent`.
- Movimiento: solo para cambios de estado, 160 ms `ease-out` (barras de progreso 300 ms). Nada decorativo
  (sin confeti, sin pulsos, sin brillos). Respeta `prefers-reduced-motion`.

## Iconos

SVG en línea, rejilla de 24 px, trazo de 2 px, `stroke="currentColor"`, extremos redondeados, sin relleno.
En app.js hay un helper `icon(nombre)` con los de la web (juegos, más, flecha, paleta, sol, luna, check, cruz).
Un icono nuevo sigue el mismo trazo. No se usan emojis ni iconos de colores.

## Enganche de la pestaña FUN

La navegación tiene las pestañas Repasar · FUN · Temas · Método. Al abrir FUN, app.js vacía `<main id="view">`
y llama a `window.FUN.mount(root, api)`; al salir llama a `window.FUN.unmount()` (parar bucles de animación,
quitar listeners de teclado y de resize). El módulo vive en `src/fun.js` y build.sh lo mete en su propia etiqueta
`<script>` detrás de la de app.js (build.sh pasa `node --check` a cada archivo y a cada bloque generado). Todo
fun.js va dentro de una IIFE que solo expone `window.FUN`: así no choca con los nombres globales de app.js
(`el`, `$`, `state`, `shuffle`, `toast`, `icon`…) y, si fallara, no se cae la web de estudio. Lo que necesite de
app.js lo recibe en `api`, que contiene:

- `el(tag, attrs, ...hijos)`: crea elementos (`class`, `text`, `html`, `onclick`…).
- `pack()`: el tema activo normalizado: `{title, sections:[{id,name}], concepts:[{id,sec,term,def}], questions:[{id,sec,q,options,a,why}], tf:[{id,sec,s,a,why}], cloze:[{id,sec,text,answer,alt,hint}], sort:[{id,sec,title,cats,items:[{t,c}]}], order:[{id,sec,title,steps}], explain:[{id,sec,q,model}]}`.
- `allItems()`, `pick(items, n)` (elige priorizando lo pendiente de repaso), `shuffle`, `sample`, `norm`, `secName(id)`.
- `grade(id, true | false | 'partial')`: registra acierto o fallo en el repaso espaciado. Hay que llamarlo en cada pregunta respondida.
- `toast(msg)`, `LS.get/set/del` (localStorage con JSON; usar claves `ra.fun.*`), `colors()` (tokens resueltos), `goHome()`.
- `state.caps.sample`: función para pedir texto a Claude si la página está en claude.ai; `null` si no.
