export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      gastosGeneralesRes
    ] = await Promise.all([
      supabaseAdmin.from("pedidos").select("id, total, estado, created_at, items_pedido(nombre_producto, cantidad)"),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }).gte("created_at", inicioMesISO),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("Productos").select("id, bajo_pedido, activo, stock"),
      supabaseAdmin.from("compras_proveedor").select("subtotal, flete").gte("fecha", inicioMesFecha),
      supabaseAdmin.from("gastos_generales").select("monto").gte("fecha", inicioMesFecha)
    ]);

    if (pedidosRes.error) throw new Error(pedidosRes.error.message);

    const todosPedidos = pedidosRes.data || [];
    const pedidosMes = todosPedidos.filter(
      (p) => new Date(p.created_at) >= inicioMes && p.estado !== "cancelado"
    );

    const ventasMes = pedidosMes.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const pedidosPendientes = todosPedidos.filter((p) => !p.estado || p.estado === "pendiente").length;

    // ---------- PLATA REAL DEL MES (no estimaciones) ----------
    // Gastado en materiales y en transporte: suma de lo que realmente pagaste a proveedores
    // este mes, cargado a mano en "Compras a proveedor". No depende de cuánto vendiste,
    // depende de cuánto compraste — así funciona la plata real.
    const gastoMaterialesReal = (comprasProveedorRes.data || []).reduce(
      (acc, c) => acc + Number(c.subtotal || 0),
      0
    );
    const gastoTransporteReal = (comprasProveedorRes.data || []).reduce(
      (acc, c) => acc + Number(c.flete || 0),
      0
    );
    const otrosGastosReal = (gastosGeneralesRes.data || []).reduce(
      (acc, g) => acc + Number(g.monto || 0),
      0
    );

    const gananciaReal = ventasMes - gastoMaterialesReal - gastoTransporteReal - otrosGastosReal;

    // ---------- RANKING DE PRODUCTOS VENDIDOS (informativo, no toca la plata) ----------
    const conteoVendidos = {};
    pedidosMes.forEach((pedido) => {
      (pedido.items_pedido || []).forEach((item) => {
        const cantidad = Number(item.cantidad || 0);
        conteoVendidos[item.nombre_producto] = (conteoVendidos[item.nombre_producto] || 0) + cantidad;
      });
    });
    const masVendido = Object.entries(conteoVendidos).sort((a, b) => b[1] - a[1])[0];
    const rankingVendidos = Object.entries(conteoVendidos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    const productos = productosRes.data || [];
    const productosActivos = productos.filter((p) => p.activo && !p.bajo_pedido).length;
    const productosAPedido = productos.filter((p) => p.bajo_pedido).length;
    const sinStock = productos.filter((p) => !p.bajo_pedido && p.stock !== null && Number(p.stock) <= 0).length;

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
        gastoMaterialesReal,
        gastoTransporteReal,
        otrosGastosReal,
        gananciaReal,
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
