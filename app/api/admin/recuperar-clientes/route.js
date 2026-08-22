export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const [pedidosRes, clientesRes, suscripcionesRes] = await Promise.all([
      supabase
        .from("pedidos")
        .select("telefono_cliente, nombre_cliente, localidad, total, created_at, estado, items_pedido(nombre_producto)"),
      supabase.from("clientes").select("id, telefono, nombre, localidad"),
      supabase.from("push_subscriptions").select("telefono")
    ]);

    const pedidos = (pedidosRes.data || []).filter((p) => p.estado !== "cancelado");
    const conCuenta = new Set((clientesRes.data || []).map((c) => c.telefono));
    const conPush = new Set((suscripcionesRes.data || []).map((s) => s.telefono));

    // Agrupamos el historial de cada cliente
    const mapa = {};
    pedidos.forEach((p) => {
      const tel = p.telefono_cliente;
      if (!tel) return;
      if (!mapa[tel]) {
        mapa[tel] = {
          telefono: tel,
          nombre: (p.nombre_cliente || "Sin nombre").trim(),
          localidad: p.localidad || "",
          compras: 0,
          gastado: 0,
          ultimaCompra: null,
          productos: []
        };
      }
      const c = mapa[tel];
      c.compras += 1;
      c.gastado += Number(p.total || 0);
      const fecha = p.created_at ? new Date(p.created_at) : null;
      if (fecha && (!c.ultimaCompra || fecha > c.ultimaCompra)) c.ultimaCompra = fecha;
      (p.items_pedido || []).forEach((i) => {
        if (i.nombre_producto && c.productos.length < 6) c.productos.push(i.nombre_producto);
      });
    });

    const hoy = new Date();

    const clientes = Object.values(mapa).map((c) => {
      const dias = c.ultimaCompra
        ? Math.floor((hoy - c.ultimaCompra) / (1000 * 60 * 60 * 24))
        : 999;

      // Prioridad: cuánto gastó pesa, pero también hace cuánto que no vuelve.
      // Un cliente que gastó mucho y hace rato que no aparece es el que más
      // conviene recuperar: ya confió una vez y el costo de traerlo es cero.
      const puntaje = Math.round((c.gastado / 1000) + dias * 2 + (c.compras > 1 ? 30 : 0));

      return {
        ...c,
        ultimaCompra: c.ultimaCompra ? c.ultimaCompra.toISOString() : null,
        diasSinComprar: dias,
        tieneCuenta: conCuenta.has(c.telefono),
        recibeAvisos: conPush.has(c.telefono),
        ticketPromedio: Math.round(c.gastado / c.compras),
        puntaje
      };
    });

    clientes.sort((a, b) => b.puntaje - a.puntaje);

    const resumen = {
      total: clientes.length,
      sinCuenta: clientes.filter((c) => !c.tieneCuenta).length,
      sinAvisos: clientes.filter((c) => !c.recibeAvisos).length,
      dormidos: clientes.filter((c) => c.diasSinComprar >= 30).length,
      recompraron: clientes.filter((c) => c.compras > 1).length,
      plataDormida: clientes
        .filter((c) => c.diasSinComprar >= 15)
        .reduce((acc, c) => acc + c.ticketPromedio, 0)
    };

    return Response.json(
      { clientes, resumen },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
