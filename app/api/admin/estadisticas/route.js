export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";
import { costoReal } from "@/lib/reglaPrecios";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// El costo real de cada producto sale de la regla única de precios
// (lib/reglaPrecios.js): costo + 3% transferencia + 10% transporte, con los
// porcentajes propios de cada producto. Antes acá había un 5% de dólar
// escrito fijo y no se contaba el transporte.

export async function GET() {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesISO = inicioMes.toISOString();
    const inicioMesFecha = inicioMesISO.slice(0, 10); // "YYYY-MM-DD", para columnas tipo date

    const [
      pedidosRes,
      clientesMesRes,
      clientesTotalRes,
      productosRes,
      comprasProveedorRes,
      gastosGeneralesRes,
      aPedidoRes
    ] = await Promise.all([
      supabaseAdmin.from("pedidos").select("id, total, estado, estado_pago, monto_pagado, created_at, items_pedido(nombre_producto, cantidad, producto_id)"),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }).gte("created_at", inicioMesISO),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }),
      // Solo los productos propios: son los únicos que cuentan para el valor
      // en stock. Los "a pedido" no son mercadería tuya, no están comprados.
      supabaseAdmin
        .from("Productos")
        .select("id, costo, activo, stock, pct_transferencia, pct_dolar, pct_transporte")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false"),
      supabaseAdmin.from("compras_proveedor").select("subtotal, flete").gte("fecha", inicioMesFecha),
      supabaseAdmin.from("gastos_generales").select("monto").gte("fecha", inicioMesFecha),
      supabaseAdmin
        .from("Productos")
        .select("id", { count: "exact", head: true })
        .eq("bajo_pedido", true)
        .eq("activo", true)
    ]);

    if (pedidosRes.error) throw new Error(pedidosRes.error.message);

    const todosPedidos = pedidosRes.data || [];
    const pedidosMes = todosPedidos.filter(
      (p) => new Date(p.created_at) >= inicioMes && p.estado !== "cancelado"
    );

    const ventasMes = pedidosMes.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const pedidosPendientes = todosPedidos.filter((p) => !p.estado || p.estado === "pendiente").length;

    const otrosGastosReal = (gastosGeneralesRes.data || []).reduce(
      (acc, g) => acc + Number(g.monto || 0),
      0
    );

    // =====================================================================
    // BLOQUE 1 — MARGEN SOBRE LO VENDIDO (rentabilidad real de tus ventas)
    // Responde: "de lo que vendí este mes, ¿cuánto me quedó de ganancia?"
    // Usa el costo real de CADA PRODUCTO VENDIDO (no de lo que compraste al
    // proveedor). Es la forma correcta de medir rentabilidad en contabilidad:
    // el costo se descuenta cuando el producto se vende, no cuando se compra.
    // =====================================================================
    const costosPorProducto = {};
    (productosRes.data || []).forEach((p) => {
      costosPorProducto[p.id] = costoReal(p);
    });

    let costoMercaderiaVendida = 0;
    const conteoVendidos = {};

    pedidosMes.forEach((pedido) => {
      (pedido.items_pedido || []).forEach((item) => {
        const cantidad = Number(item.cantidad || 0);
        const costoUnitarioReal = costosPorProducto[item.producto_id];
        if (costoUnitarioReal !== undefined) {
          costoMercaderiaVendida += costoUnitarioReal * cantidad;
        }
        conteoVendidos[item.nombre_producto] = (conteoVendidos[item.nombre_producto] || 0) + cantidad;
      });
    });

    const gananciaBruta = ventasMes - costoMercaderiaVendida;
    const gananciaNeta = gananciaBruta - otrosGastosReal;

    // =====================================================================
    // BLOQUE 2 — FLUJO DE CAJA (plata real que entró y salió del bolsillo)
    // Responde: "¿me está sobrando o faltando plata este mes?"
    // Usa lo que compraste al proveedor este mes, venda o no venda todavía.
    // Si compraste más de lo que vendiste, da negativo — no es una pérdida,
    // es mercadería que quedó en stock y todavía no se convirtió en venta.
    // =====================================================================
    const gastoMaterialesCaja = (comprasProveedorRes.data || []).reduce(
      (acc, c) => acc + Number(c.subtotal || 0),
      0
    );
    const gastoTransporteCaja = (comprasProveedorRes.data || []).reduce(
      (acc, c) => acc + Number(c.flete || 0),
      0
    );
    const resultadoCaja = ventasMes - gastoMaterialesCaja - gastoTransporteCaja - otrosGastosReal;

    // =====================================================================
    // BLOQUE 3 — FOTO ACTUAL (no es "de este mes", es "ahora mismo")
    // =====================================================================
    // Valor de inventario: plata que tenés "parada" en stock sin vender.
    // Usa el costo real (igual que el margen) por la cantidad que tenés hoy.
    // Solo cuenta la mercadería que realmente tenés comprada y en tu poder.
    const valorInventario = (productosRes.data || []).reduce((acc, p) => {
      const stock = Number(p.stock || 0);
      if (stock <= 0) return acc;
      return acc + costoReal(p) * stock;
    }, 0);

    const unidadesEnStock = (productosRes.data || []).reduce(
      (acc, p) => acc + Math.max(Number(p.stock || 0), 0),
      0
    );
    const productosConStock = (productosRes.data || []).filter(
      (p) => Number(p.stock || 0) > 0
    ).length;

    // Cuentas por cobrar: plata que tus clientes todavía te deben, de TODOS
    // los pedidos activos (no solo los de este mes).
    const cuentasPorCobrar = todosPedidos.reduce((acc, p) => {
      if (p.estado === "cancelado") return acc;
      if (p.estado_pago !== "falta_pagar" && p.estado_pago !== "deuda_parcial") return acc;
      const saldo = Number(p.total || 0) - Number(p.monto_pagado || 0);
      return acc + Math.max(saldo, 0);
    }, 0);

    const masVendido = Object.entries(conteoVendidos).sort((a, b) => b[1] - a[1])[0];
    const rankingVendidos = Object.entries(conteoVendidos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    const productos = productosRes.data || [];
    const productosActivos = productos.filter((p) => p.activo).length;
    const productosAPedido = aPedidoRes.count || 0;
    const sinStock = productos.filter((p) => p.stock !== null && Number(p.stock) <= 0).length;

    return Response.json(
      {
        ventasMes,
        cantidadPedidosMes: pedidosMes.length,
        pedidosPendientes,
        clientesNuevosMes: clientesMesRes.count || 0,
        clientesTotal: clientesTotalRes.count || 0,
        productosActivos,
        productosAPedido,
        sinStock,

        // Bloque 1: margen sobre lo vendido
        costoMercaderiaVendida,
        gananciaBruta,
        otrosGastosReal,
        gananciaNeta,

        // Bloque 2: flujo de caja
        gastoMaterialesCaja,
        gastoTransporteCaja,
        resultadoCaja,

        // Bloque 3: foto actual
        valorInventario,
        unidadesEnStock,
        productosConStock,
        cuentasPorCobrar,

        masVendido: masVendido ? { nombre: masVendido[0], cantidad: masVendido[1] } : null,
        rankingVendidos
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
