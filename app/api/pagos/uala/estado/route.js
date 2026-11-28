export const dynamic = "force-dynamic";
import { saldoPedido, sincronizarPagoUala, supabaseAdmin, ualaConfigurado } from "@/lib/uala";

// Cuando el cliente vuelve de pagar, la página pregunta acá. Si el aviso de
// Ualá todavía no llegó, lo consultamos nosotros y dejamos el pedido al día.
export async function GET(req) {
  const numero = new URL(req.url).searchParams.get("numero");
  if (!numero) return Response.json({ error: "Falta el número de pedido" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: pedido } = await db
    .from("pedidos")
    .select("id, numero_pedido, total, monto_pagado, estado_pago, pago_uala_uuid, pago_uala_monto")
    .eq("numero_pedido", numero)
    .maybeSingle();

  if (!pedido) return Response.json({ error: "No encontramos el pedido" }, { status: 404 });
  if (pedido.estado_pago === "pagado") return Response.json({ estado: "pagado" });
  if (!ualaConfigurado()) return Response.json({ estado: "sin_orden", saldo: saldoPedido(pedido) });

  try {
    const r = await sincronizarPagoUala(db, pedido);
    return Response.json({ estado: r.estado, saldo: r.estado === "pagado" ? 0 : saldoPedido(pedido) });
  } catch (e) {
    console.error("[Ualá estado]", e.message);
    return Response.json({ estado: "desconocido" });
  }
}
