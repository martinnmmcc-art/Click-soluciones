export const dynamic = "force-dynamic";
import { sincronizarPagoUala, supabaseAdmin } from "@/lib/uala";

// Ualá avisa acá cuando cambia el estado de un pago. El aviso no viene
// firmado, así que solo lo usamos para saber QUÉ orden mirar: el estado real
// se le pregunta a Ualá (ver sincronizarPagoUala).
// Hay que contestar 200; si no, Ualá reintenta hasta 3 veces más.
export async function POST(req) {
  const aviso = await req.json().catch(() => ({}));
  const uuid = aviso?.uuid;
  if (!uuid) return Response.json({ ok: true });

  const db = supabaseAdmin();
  const { data: pedido } = await db
    .from("pedidos")
    .select("id, numero_pedido, total, monto_pagado, estado_pago, pago_uala_uuid, pago_uala_monto")
    .eq("pago_uala_uuid", uuid)
    .maybeSingle();

  // Orden que no es nuestra o que ya se procesó
  if (!pedido) return Response.json({ ok: true });

  try {
    const r = await sincronizarPagoUala(db, pedido);
    // Si Ualá no contestó, devolvemos error para que reintente el aviso
    if (r.estado === "desconocido") return Response.json({ ok: false }, { status: 503 });
    return Response.json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error("[Ualá webhook]", e.message);
    return Response.json({ ok: false }, { status: 503 });
  }
}
