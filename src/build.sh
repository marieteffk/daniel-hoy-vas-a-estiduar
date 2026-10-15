#!/bin/sh
# Reconstruye index.html a partir de src/page.html + src/pack-tema2.js + src/app.js
set -e
D=$(cd "$(dirname "$0")" && pwd)
{
  printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="description" content="Juegos de estudio aleatorios con repaso espaciado para el Tema 2 (agenda electrónica y comunicación). Admite nuevos PDF.">\n<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat "$D/page.html"; printf '\n<script>\n'; cat "$D/pack-tema2.js"; printf '\n'; cat "$D/app.js"; printf '\n</script>\n</body>\n</html>\n'
} > "$D/../index.html"
echo "index.html reconstruido"
