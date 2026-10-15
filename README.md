# Daniel, hoy vas a estudiar · Repaso Arcade

Página web de juegos para estudiar el **Tema 2: Agenda electrónica y comunicación** (correo electrónico, Gmail, Outlook, agenda, Thunderbird e importación de datos).

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

Botón **+ Tema** en la página. Admite un PDF (se lee en el navegador con pdf.js), texto pegado o un JSON exportado desde *Gestionar temas*. Las preguntas se generan:

- **Con Claude**: solo cuando la página se abre como Artifact dentro de claude.ai (usa la capacidad `sample`). En GitHub Pages esta opción aparece desactivada.
- **Automático**: extrae definiciones («Término: definición») y pasos numerados del texto. Instantáneo pero más básico.

## Estructura

- `index.html`: la página completa, lista para servir (GitHub Pages).
- `src/page.html`: estilos y marcado. `src/pack-tema2.js`: banco de contenidos del Tema 2. `src/app.js`: lógica de los juegos.
- `src/build.sh`: reconstruye `index.html` a partir de los tres ficheros.

## Por qué estos juegos

La sección *¿Por qué estos juegos?* de la página resume la investigación en la que se basan (Dunlosky 2013, Adesope 2017, Cepeda 2006, Brunmair y Richter 2019, Bertsch 2007, Wouters 2013, Sailer y Homner 2020) con enlaces a las fuentes.
