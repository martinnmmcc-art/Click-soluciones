export const dynamic = "force-dynamic";
import { crearOrdenUala, saldoPedido, supabaseAdmin, ualaConfigurado } from "@/lib/uala";

// Arma el cobro con tarjeta del pedido y devuelve el link de Ualá Bis.
// El monto lo calcula el servidor desde la base: el celular solo manda el
// número de pedido, así nadie puede pagar menos tocando la página.
export async function POST(req) {
  if (!ualaConfigurado()) {
    return Response.json({ error: "El pago con tarjeta todavía no está configurado" }, { status: 503 });
  }

  const { numero } = await req.json().catch(() => ({}));
  if (!numero) return Response.json({ error: "Falta el número de pedido" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: pedido, error } = await db
    .from("pedidos")
    .select("id, numero_pedido, total, monto_pagado, estado, estado_pago")
    .eq("numero_pedido", numero)
    .maybeSingle();

  if (error || !pedido) return Response.json({ error: "No encontramos el pedido" }, { status: 404 });
  if (pedido.estado === "cancelado" || pedido.estado === "rechazado") {
    return Response.json({ error: "Este pedido está cancelado" }, { status: 400 });
  }
  if (pedido.estado_pago === "pagado" || saldoPedido(pedido) <= 0) {
    return Response.json({ pagado: true });
  }

  try {
    const { uuid, link } = await crearOrdenUala(pedido);
    const { error: errGuardar } = await db
      .from("pedidos")
      .update({ pago_uala_uuid: uuid, pago_uala_monto: saldoPedido(pedido) })
      .eq("id", pedido.id);
    if (errGuardar) {
      console.error("[Ualá] No se pudo guardar la orden en el pedido:", errGuardar.message);
      return Response.json({ error: "No se pudo preparar el pago. Probá de nuevo." }, { status: 500 });
    }
    return Response.json({ link });
  } catch (e) {
    console.error("[Ualá]", e.message);
    return Response.json({ error: "No se pudo conectar con Ualá. Probá de nuevo en un rato." }, { status: 502 });
  }
}
