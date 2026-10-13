#!/bin/bash
# Aplica el paquete y VERIFICA. Se corre desde la carpeta del proyecto: bash fix34/aplicar.sh
# Incluye todo lo del fix32 y fix33: no hace falta aplicarlos aparte.
cd "$(dirname "$0")/.." || exit 1
if [ ! -f package.json ] || [ ! -d app ]; then echo "✗ Entrá primero con: cd ~/Click-soluciones"; exit 1; fi
cp -r fix34/archivos/. . || { echo "✗ No se pudieron copiar los archivos"; exit 1; }
echo "Verificando..."
ok=1
chk() { if grep -q "$2" "$1" 2>/dev/null; then echo "  ✓ $3"; else echo "  ✗ $3  ($1)"; ok=0; fi; }
chk components/DetallePedidoRecibido.jsx 'rpc("marcar_no_llego"' "marcar lo que no llegó (resta stock)"
chk app/admin/pedido-proveedor/page.js 'rpc("pendientes_proveedor")' "lista de lo pagado que no llegó"
chk app/admin/pedido-proveedor/page.js "origen_linea_id: i.origen_linea_id" "agregar pendientes sin cargo al próximo pedido"
chk components/BannerLlegaPronto.jsx 'rpc("llega_pronto")' "banner 'Llega pronto' con precio (fix33)"
chk app/admin/pedido-proveedor/page.js "descuento_pct: pctDescuento" "descuento del proveedor (fix33)"
chk app/admin/pedido-proveedor/page.js "function cambiarTipoEdicion" "reposiciones y cambios (fix32)"
chk app/admin/productos/page.js "cantidadARestaurar" "lo anterior sigue estando (volver en Productos)"
echo ""
if [ $ok = 1 ]; then echo "✅ TODO OK. Ahora subí con los comandos de git."; else echo "❌ ALGO FALLÓ. NO subas nada y mandame una captura."; exit 1; fi
