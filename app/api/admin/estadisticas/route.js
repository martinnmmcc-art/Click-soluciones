export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// El campo "costo" de cada producto es el precio CRUDO del proveedor (sin recargos).
// El costo real que paga Bolson Click incluye además:
//   - 3% que cobra el proveedor por pagar con transferencia
//   - 5% que se agrega por la variación del dólar
// Estos dos recargos NO son ganancia, son costo real. Si el día de mañana cambian
// estos porcentajes, se ajustan acá.
const RECARGO_TRANSFERENCIA = 0.03;
const RECARGO_INFLACION_DOLAR = 0.05;
const MULTIPLICADOR_COSTO_REAL = (1 + RECARGO_TRANSFERENCIA) * (1 + RECARGO_INFLACION_DOLAR);

export async function GET() {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesISO = inicioMes.toISOString();

    const [pedidosRes, clientesMesRes, clientesTotalRes, productosRes] = await Promise.all([
      supabaseAdmin.from("pedidos").select("id, total, estado, created_at, items_pedido(nombre_producto, cantidad, precio_unitario, producto_id)"),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }).gte("created_at", inicioMesISO),
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("Productos").select("id, costo, costo_envio, bajo_pedido, activo, stock")
    ]);

    if (pedidosRes.error) throw new Error(pedidosRes.error.message);

    const todosPedidos = pedidosRes.data || [];
    const pedidosMes = todosPedidos.filter(
      (p) => new Date(p.created_at) >= inicioMes && p.estado !== "cancelado"
    );

    const ventasMes = pedidosMes.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const pedidosPendientes = todosPedidos.filter((p) => !p.estado || p.estado === "pendiente").length;

    // Mapa rápido de costo y costo_envio por producto
    const costosPorProducto = {};
    (productosRes.data || []).forEach((p) => {
      costosPorProducto[p.id] = { costo: Number(p.costo || 0), costo_envio: Number(p.costo_envio || 0) };
    });

    let costoMateriales = 0;
    let gastoFletes = 0;
    const conteoVendidos = {};

    pedidosMes.forEach((pedido) => {
      (pedido.items_pedido || []).forEach((item) => {
        const cantidad = Number(item.cantidad || 0);
        const costos = costosPorProducto[item.producto_id];
        if (costos) {
          // Costo real = precio crudo del proveedor + 3% transferencia + 5% inflación dólar
          costoMateriales += costos.costo * MULTIPLICADOR_COSTO_REAL * cantidad;
          gastoFletes += costos.costo_envio * cantidad;
        }
        conteoVendidos[item.nombre_producto] = (conteoVendidos[item.nombre_producto] || 0) + cantidad;
      });
    });

    const ganancia = ventasMes - costoMateriales - gastoFletes;

    const masVendido = Object.entries(conteoVendidos).sort((a, b) => b[1] - a[1])[0];
    const rankingVendidos = Object.entries(conteoVendidos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    const productos = productosRes.data || [];
    const productosActivos = productos.filter((p) => p.activo && !p.bajo_pedido).length;
    const productosAPedido = productos.filter((p) => p.bajo_pedido).length;
    const sinStock = productos.filter((p) => !p.bajo_pedido && p.stock !== null && Number(p.stock) <= 0).length;

    return Response.json({
      ventasMes,
      cantidadPedidosMes: pedidosMes.length,
      pedidosPendientes,
      clientesNuevosMes: clientesMesRes.count || 0,
      clientesTotal: clientesTotalRes.count || 0,
      productosActivos,
      productosAPedido,
      sinStock,
      costoMateriales,
      gastoFletes,
      ganancia,
      masVendido: masVendido ? { nombre: masVendido[0], cantidad: masVendido[1] } : null,
      rankingVendidos
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
