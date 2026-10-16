#!/bin/sh
# Reconstruye index.html a partir de src/page.html + src/pack-tema0.js, pack-tema1.js y pack-tema2.js + src/app.js (+ src/fun.js si existe, la pestaña FUN).
# fun.js va en su propia etiqueta <script>: si tuviera un error de sintaxis, no se cae la página ni los juegos de estudio.
set -e
D=$(cd "$(dirname "$0")" && pwd)
for f in pack-tema0 pack-tema1 pack-tema2; do node --check "$D/$f.js"; done
node --check "$D/app.js"
[ -f "$D/fun.js" ] && node --check "$D/fun.js"
{
  printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="Juegos de estudio con repaso espaciado para los Temas 0 (energía eléctrica), 1 (seguridad en instalaciones eléctricas) y 2 (agenda electrónica). Admite nuevos PDF.">\n<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat "$D/page.html"; printf '\n<script>\n'; for f in pack-tema0 pack-tema1 pack-tema2; do cat "$D/$f.js"; printf '\n'; done; cat "$D/app.js"; printf '\n</script>\n'
  if [ -f "$D/fun.js" ]; then printf '<script>\n'; cat "$D/fun.js"; printf '\n</script>\n'; fi
  printf '</body>\n</html>\n'
} > "$D/../index.html"
# Comprueba la sintaxis de cada bloque <script> tal y como queda en index.html
node -e '
const fs = require("fs"); const vm = require("vm");
const html = fs.readFileSync(process.argv[1], "utf8"); const re = /<script>\n([\s\S]*?)\n<\/script>/g; let m, n = 0;
while ((m = re.exec(html))) { n++; new vm.Script(m[1], { filename: "script-" + n }); }
if (n < 1) throw new Error("no hay bloques <script> en index.html"); console.log("sintaxis ok en " + n + " bloque(s) <script>");
' "$D/../index.html"
echo "index.html reconstruido ($(wc -c < "$D/../index.html") bytes)"
