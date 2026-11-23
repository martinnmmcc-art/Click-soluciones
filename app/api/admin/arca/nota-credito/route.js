export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import {
  configuracion,
  ticketAcceso,
  ultimoNumero,
  solicitarCAE,
  consultarComprobante,
  TIPO_FACTURA_C,
  TIPO_NOTA_CREDITO_C
} from "@/lib/arca";

// Emite una Nota de Crédito C que anula COMPLETA una Factura C ya emitida.
// Protegida por middleware.js (solo admin).
//
// Recibe: { factura_id, motivo }
//
// Cuidados:
//  - Una factura se anula una sola vez (lo frena la base: facturas_una_nc).
//  - La nota de crédito va con los mismos datos del cliente y el mismo total,
//    y lleva asociada la factura que anula (lo exige ARCA).
//  - Cuando queda emitida, la factura original pasa a "anulada": el pedido se
//    puede volver a facturar si hace falta.
//  - Si se corta la conexión después de pedir el CAE, se consulta a ARCA antes
//    de marcar error, para no duplicar.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function respuestaError(mensaje, estado = 400) {
  return Response.json({ error: mensaje }, { status: estado });
}

const aFecha = (f) => (f ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : null);

export async function POST(request) {
  const cfg = configuracion();
  if (cfg.faltan.length) {
    return respuestaError(`Falta configurar ARCA en Vercel: ${cfg.faltan.join(", ")}`, 503);
  }

  let b = {};
  try {
    b = await request.json();
  } catch (e) {}
  const motivo = String(b.motivo || "").trim().slice(0, 200) || null;

  const { data: original } = await supabase
    .from("facturas")
    .select("id, pedido_id, tipo, numero, punto_venta, fecha, total, doc_tipo, doc_nro, condicion_iva, receptor_nombre, detalle, estado, produccion")
    .eq("id", b.factura_id)
    .maybeSingle();

  if (!original) return respuestaError("No existe esa factura", 404);
  if (original.tipo !== TIPO_FACTURA_C) return respuestaError("Solo se puede anular una Factura C");
  if (original.estado === "anulada") return respuestaError("Esa factura ya está anulada", 409);
  if (original.estado !== "emitida" || !original.numero) return respuestaError("Esa factura no llegó a emitirse: no hace falta anularla");
  if (original.produccion !== cfg.produccion || original.punto_venta !== cfg.puntoVenta) {
    return respuestaError("Esa factura es de otro punto de venta o del modo de prueba");
  }

  const total = Number(original.total);
  const detalle = {
    ...(original.detalle || {}),
    anula: `${String(original.punto_venta).padStart(5, "0")}-${String(original.numero).padStart(8, "0")}`
  };

  // ----- reserva: una factura, una nota de crédito -----
  const { data: fila, error: errFila } = await supabase
    .from("facturas")
    .insert({
      pedido_id: null, // el pedido queda libre para volver a facturarse
      factura_asociada: original.id,
      tipo: TIPO_NOTA_CREDITO_C,
      produccion: cfg.produccion,
      punto_venta: cfg.puntoVenta,
      total,
      doc_tipo: original.doc_tipo,
      doc_nro: original.doc_nro,
      condicion_iva: original.condicion_iva,
      receptor_nombre: original.receptor_nombre,
      detalle,
      motivo,
      estado: "pendiente"
    })
    .select("id, codigo")
    .single();
  if (errFila) {
    if (String(errFila.message).includes("facturas_una_nc")) {
      return respuestaError("Esa factura ya tiene una nota de crédito (o se está emitiendo ahora).", 409);
    }
    return respuestaError(errFila.message, 500);
  }

  const asociado = {
    tipo: TIPO_FACTURA_C,
    puntoVenta: original.punto_venta,
    numero: original.numero,
    fecha: String(original.fecha).replace(/-/g, "")
  };

  async function marcarEmitida({ numero, fecha, cae, caeVence, respuesta }) {
    await supabase
      .from("facturas")
      .update({
        numero,
        fecha: aFecha(fecha),
        cae,
        cae_vence: aFecha(caeVence),
        estado: "emitida",
        emitida_en: new Date().toISOString(),
        respuesta: respuesta || null
      })
      .eq("id", fila.id);
    await supabase.from("facturas").update({ estado: "anulada" }).eq("id", original.id);
    return Response.json({
      ok: true,
      nota: { id: fila.id, codigo: fila.codigo, numero, punto_venta: cfg.puntoVenta, cae, total }
    });
  }

  let numero = null;
  try {
    const ticket = await ticketAcceso(supabase, cfg);
    let r = null;
    for (let intento = 0; intento < 2 && !r; intento++) {
      numero = (await ultimoNumero(ticket, cfg, TIPO_NOTA_CREDITO_C)) + 1;
      try {
        r = await solicitarCAE(ticket, cfg, {
          tipo: TIPO_NOTA_CREDITO_C,
          asociado,
          numero,
          total,
          docTipo: original.doc_tipo,
          docNro: original.doc_nro,
          condicionIva: original.condicion_iva
        });
      } catch (e) {
        if (intento === 0 && /10016|correlativ/i.test(e.message)) continue;
        throw e;
      }
    }
    return await marcarEmitida({
      numero,
      fecha: r.fecha,
      cae: r.cae,
      caeVence: r.caeVence,
      respuesta: r.observaciones.length ? r.observaciones.join(" · ") : null
    });
  } catch (e) {
    // ¿Quedó emitida igual? (se cortó la conexión después de mandarla)
    if (numero && !/RECHAZADA/.test(e.codigo || "")) {
      try {
        const ticket = await ticketAcceso(supabase, cfg);
        const c = await consultarComprobante(ticket, cfg, numero, TIPO_NOTA_CREDITO_C);
        if (c?.cae && Math.abs(c.total - total) < 0.01) {
          return await marcarEmitida({
            numero,
            fecha: c.fecha,
            cae: c.cae,
            caeVence: c.caeVence,
            respuesta: "Recuperada después de un corte de conexión"
          });
        }
      } catch (e2) {}
    }
    await supabase
      .from("facturas")
      .update({ estado: "error", error: String(e.message).slice(0, 500), respuesta: e.detalle ? String(e.detalle).slice(0, 2000) : null })
      .eq("id", fila.id);
    return respuestaError(e.message, 502);
  }
}
