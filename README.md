# Daniel, hoy vas a estudiar · Repaso Arcade

Página web de juegos para estudiar cuatro temas incluidos de serie, que se eligen en la pestaña Temas:

- **Tema 0: La energía eléctrica** (historia y los seis mecanismos para obtener electricidad).
- **Tema 1: Seguridad en las instalaciones eléctricas** (sobreintensidades, magnetotérmicos y curvas B/C/D, fusibles, diferencial, puesta a tierra, códigos IP e IK).
- **Tema 2: Agenda electrónica y comunicación** (correo electrónico, Gmail, Outlook, agenda, Thunderbird e importación de datos).
- **SO · Tema 1 (Sistemas Operativos): Sistemas operativos monopuesto** (sistema informático y hardware, software y licencias, unidades de información, funciones, gestores y procesos del SO, interfaces y SO actuales).

**Jugar:** https://marieteffk.github.io/daniel-hoy-vas-a-estiduar/

## Qué hay dentro

Ocho juegos que se barajan en cada partida, más una **Ruleta** de 12 rondas que los mezcla todos:

| Juego | Técnica de estudio que aplica |
|---|---|
| Test rápido | Práctica de recuperación con feedback inmediato |
| Completa el hueco | Efecto de generación (escribir la respuesta) |
| Verdadero o falso | Recuperación con explicación del porqué |
| Empareja | Discriminación entre conceptos parecidos |
| Clasifica | Intercalado de categorías (IMAP/POP3, cita/reunión/tarea…) |
| Ordena los pasos | Secuencias de los casos prácticos |
| Tarjetas | Repaso espaciado (cajas tipo Leitner) |
| Explícalo | Interrogación elaborativa |

Todos los juegos comparten un calendario de repaso espaciado: lo que fallas vuelve al día siguiente y lo que aciertas se espacia a 1, 3, 7 y 14 días. El progreso se guarda en el navegador (localStorage).

## Añadir otro tema (otro PDF)

Pestaña **Temas** › **Añadir tema**. Admite un PDF (se lee en el navegador con pdf.js), texto pegado o un JSON exportado desde *Gestionar temas*. Las preguntas se generan:

- **Con Claude**: solo cuando la página se abre como Artifact dentro de claude.ai (usa la capacidad `sample`). En GitHub Pages esta opción aparece desactivada.
- **Automático**: extrae definiciones («Término: definición») y pasos numerados del texto. Instantáneo pero más básico.

## Diseño

La web sigue el sistema visual descrito en `DISENO.md`: una columna, papel y tinta, un color de acento que elige
el usuario (Tinta, Petróleo, Ciruela, Naranja o Carbón) y modo claro, oscuro o según el sistema, todo desde el botón
de la cabecera. Tipografía Nunito y Nunito Sans, iconos SVG propios, botones con relieve y sin sombras difusas,
degradados ni emojis. La navegación tiene cuatro pestañas: **Repasar** (inicio y juegos), **FUN** (juegos tipo
videojuego, módulo `src/fun.js`), **Temas** (gestionar y añadir temas) y **Método** (la investigación detrás de los juegos).

## Estructura

- `index.html`: la página completa, lista para servir (GitHub Pages).
- `src/page.html`: estilos y marcado. `src/pack-tema0.js`, `src/pack-tema1.js` y `src/pack-tema2.js`: bancos de contenidos de los temas 0, 1 y 2 de electricidad y ofimática; `src/pack-so-tema1.js`: Tema 1 de Sistemas Operativos. `src/app.js`: lógica de los juegos.
- `src/fun.js` (opcional): pestaña FUN. Define `window.FUN = { mount(root, api), unmount() }` dentro de una IIFE; el contrato está en `DISENO.md`.
- `src/build.sh`: comprueba la sintaxis y reconstruye `index.html` a partir de los ficheros anteriores.
- `DISENO.md`: colores, tipografía, espaciado, componentes y el contrato del módulo FUN.
- `.github/workflows/pages.yml`: con cada cambio en `main` copia `index.html` a la rama `gh-pages`, que es la que publica GitHub Pages.

## Por qué estos juegos

La sección *¿Por qué estos juegos?* de la página resume la investigación en la que se basan (Dunlosky 2013, Adesope 2017, Cepeda 2006, Brunmair y Richter 2019, Bertsch 2007, Wouters 2013, Sailer y Homner 2020) con enlaces a las fuentes.
