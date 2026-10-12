#!/bin/bash
# Aplica el paquete y VERIFICA. Se corre desde la carpeta del proyecto: bash fix33/aplicar.sh
# Incluye también lo del fix32 (reposiciones y cambios): no hace falta aplicarlo aparte.
cd "$(dirname "$0")/.." || exit 1
if [ ! -f package.json ] || [ ! -d app ]; then echo "✗ Entrá primero con: cd ~/Click-soluciones"; exit 1; fi
cp -r fix33/archivos/. . || { echo "✗ No se pudieron copiar los archivos"; exit 1; }
echo "Verificando..."
ok=1
chk() { if grep -q "$2" "$1" 2>/dev/null; then echo "  ✓ $3"; else echo "  ✗ $3  ($1)"; ok=0; fi; }
chk components/BannerLlegaPronto.jsx 'rpc("llega_pronto")' "banner 'Llega pronto' con precio"
chk app/page.js "<BannerLlegaPronto />" "el banner está en el inicio"
chk app/proximamente/page.js 'rpc("llega_pronto")' "la página 'Llega pronto' muestra precios"
chk app/admin/pedido-proveedor/page.js "descuento_pct: pctDescuento" "descuento del proveedor al editar el pedido"
chk components/DetallePedidoRecibido.jsx "actualizar_descuento_pedido" "descuento en pedidos recibidos"
chk app/admin/pedido-proveedor/page.js "function cambiarTipoEdicion" "reposiciones y cambios (fix32)"
chk components/DetallePedidoRecibido.jsx "const costoBase" "recibidos usan el costo real (fix32)"
chk app/admin/productos/page.js "cantidadARestaurar" "lo anterior sigue estando (volver en Productos)"
echo ""
if [ $ok = 1 ]; then echo "✅ TODO OK. Ahora subí con los comandos de git."; else echo "❌ ALGO FALLÓ. NO subas nada y mandame una captura."; exit 1; fi
