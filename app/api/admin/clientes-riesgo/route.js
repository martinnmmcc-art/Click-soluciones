export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DIAS_SIN_COMPRAR = 30;

export async function GET() {
  try {
    const [pedidosRes, clientesRes] = await Promise.all([
      supabaseAdmin.from("pedidos").select("telefono_cliente, nombre_cliente, total, created_at, estado"),
      supabaseAdmin.from("clientes").select("telefono, nombre, localidad")
    ]);

    if (pedidosRes.error) throw new Error(pedidosRes.error.message);

    const porTelefono = {};
    (pedidosRes.data || [])
      .filter((p) => p.estado !== "cancelado")
      .forEach((p) => {
        const tel = p.telefono_cliente;
        if (!tel) return;
        if (!porTelefono[tel]) {
          porTelefono[tel] = { telefono: tel, nombre: p.nombre_cliente, cantidad: 0, ultimaCompra: p.created_at, totalGastado: 0 };
        }
        porTelefono[tel].cantidad++;
        porTelefono[tel].totalGastado += Number(p.total || 0);
        if (new Date(p.created_at) > new Date(porTelefono[tel].ultimaCompra)) {
          porTelefono[tel].ultimaCompra = p.created_at;
        }
      });

    const localidadPorTelefono = {};
    (clientesRes.data || []).forEach((c) => {
      localidadPorTelefono[c.telefono] = c.localidad;
    });

    const ahora = Date.now();
    const enRiesgo = Object.values(porTelefono)
      .map((c) => ({
        ...c,
        localidad: localidadPorTelefono[c.telefono] || null,
        diasSinComprar: Math.floor((ahora - new Date(c.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter((c) => c.diasSinComprar >= DIAS_SIN_COMPRAR)
      .sort((a, b) => b.diasSinComprar - a.diasSinComprar);

    return Response.json({ clientes: enRiesgo, umbralDias: DIAS_SIN_COMPRAR });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
