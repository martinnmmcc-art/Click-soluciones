#!/bin/bash
# Aplica el paquete y VERIFICA. Se corre desde la carpeta del proyecto: bash fix32/aplicar.sh
cd "$(dirname "$0")/.." || exit 1
if [ ! -f package.json ] || [ ! -d app ]; then echo "✗ Entrá primero con: cd ~/Click-soluciones"; exit 1; fi
cp -r fix32/archivos/. . || { echo "✗ No se pudieron copiar los archivos"; exit 1; }
echo "Verificando..."
ok=1
chk() { if grep -q "$2" "$1" 2>/dev/null; then echo "  ✓ $3"; else echo "  ✗ $3  ($1)"; ok=0; fi; }
chk app/admin/pedido-proveedor/page.js "function cambiarTipoEdicion" "botones Normal / Reposición / Cambio al editar"
chk app/admin/pedido-proveedor/page.js "Pagás la diferencia" "el cambio calcula la diferencia que pagás"
chk app/admin/pedido-proveedor/page.js "tipo, costo_real, nota" "carga y guarda reposiciones y cambios"
chk components/DetallePedidoRecibido.jsx "const costoBase" "los recibidos usan el costo real, no cero"
chk components/DetallePedidoRecibido.jsx "ya pagado en pedidos anteriores" "muestra lo que ya habías pagado antes"
chk app/admin/productos/page.js "cantidadARestaurar" "lo anterior sigue estando (volver en Productos)"
chk app/api/cron/sincronizar-proveedor/route.js "MAX_REINTENTOS" "lo anterior sigue estando (sincronización)"
echo ""
if [ $ok = 1 ]; then echo "✅ TODO OK. Ahora subí con los comandos de git."; else echo "❌ ALGO FALLÓ. NO subas nada y mandame una captura."; exit 1; fi
