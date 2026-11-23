export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import {
  configuracion,
  ticketAcceso,
  ultimoNumero,
  solicitarCAE,
  consultarComprobante,
  CONDICION_IVA,
  TIPO_DOC
} from "@/lib/arca";

// Emite una Factura C en ARCA. Protegida por middleware.js (solo admin).
//
// Recibe:
//  { pedido_id }                     → factura ese pedido (total e ítems del pedido)
//  { total, descripcion }            → factura suelta (una venta fuera de la app)
//  + opcional: condicion ("consumidor_final" | "monotributo" | "responsable_inscripto" | "exento"),
//              doc_tipo ("dni" | "cuit" | "cuil"), doc_nro, nombre
//
// Cuidados:
//  - Un pedido se factura una sola vez (lo frena la base).
//  - Si se corta la conexión justo después de pedir el CAE, antes de marcar
//    error se consulta a ARCA si ese número quedó emitido, para no duplicar.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Desde este importe ARCA exige identificar al consumidor final (RG 5700/2025)
const TOPE_SIN_IDENTIFICAR = 10000000;

function respuestaError(mensaje, estado = 400, extra = {}) {
  return Response.json({ error: mensaje, ...extra }, { status: estado });
}

export async function POST(request) {
  const cfg = configuracion();
  if (cfg.faltan.length) {
    return respuestaError(`Falta configurar ARCA en Vercel: ${cfg.faltan.join(", ")}`, 503);
  }

  let b = {};
  try {
    b = await request.json();
  } catch (e) {}

  // ----- qué se factura -----
  let total = 0;
  let detalle = null;
  let pedidoId = null;
  let nombre = String(b.nombre || "").trim().slice(0, 80);

  if (b.pedido_id) {
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, nombre_cliente, total, estado, items_pedido(nombre_producto, cantidad, precio_unitario, subtotal)")
      .eq("id", b.pedido_id)
      .maybeSingle();
    if (!pedido) return respuestaError("No existe ese pedido", 404);
    if (pedido.estado === "cancelado") return respuestaError("Ese pedido está cancelado");
    pedidoId = pedido.id;
    total = Number(pedido.total);
    nombre = nombre || pedido.nombre_cliente || "";
    detalle = {
      pedido: pedido.numero_pedido,
      items: (pedido.items_pedido || []).map((i) => ({
        descripcion: i.nombre_producto,
        cantidad: Number(i.cantidad),
        precio: Number(i.precio_unitario),
        subtotal: Number(i.subtotal ?? i.precio_unitario * i.cantidad)
      }))
    };
    // Si el pedido tiene descuento, se aclara en el detalle
    const suma = detalle.items.reduce((s, i) => s + i.subtotal, 0);
    if (Math.round(suma) !== Math.round(total)) detalle.ajuste = Math.round((total - suma) * 100) / 100;
  } else {
    total = Math.round(Number(b.total) * 100) / 100;
    const desc = String(b.descripcion || "").trim().slice(0, 200);
    if (!desc) return respuestaError("Escribí qué se vendió");
    detalle = { items: [{ descripcion: desc, cantidad: 1, precio: total, subtotal: total }] };
  }
  if (!(total > 0)) return respuestaError("El total tiene que ser mayor a cero");

  // ----- a quién -----
  const condicion = CONDICION_IVA[b.condicion] ? b.condicion : "consumidor_final";
  let docTipo = TIPO_DOC.sin_identificar;
  let docNro = "0";
  const nroLimpio = String(b.doc_nro || "").replace(/\D/g, "");
  if (nroLimpio) {
    docTipo = TIPO_DOC[b.doc_tipo] || (nroLimpio.length === 11 ? TIPO_DOC.cuit : TIPO_DOC.dni);
    docNro = nroLimpio;
  }
  if (condicion !== "consumidor_final" && docTipo !== TIPO_DOC.cuit) {
    return respuestaError("Para un monotributista, responsable inscripto o exento hace falta su CUIT.");
  }
  if (condicion === "consumidor_final" && total >= TOPE_SIN_IDENTIFICAR && docTipo === TIPO_DOC.sin_identificar) {
    return respuestaError("Desde $10.000.000 ARCA pide el DNI o CUIT del cliente.");
  }

  // ----- reserva: un pedido, una factura -----
  const { data: fila, error: errFila } = await supabase
    .from("facturas")
    .insert({
      pedido_id: pedidoId,
      produccion: cfg.produccion,
      punto_venta: cfg.puntoVenta,
      total,
      doc_tipo: docTipo,
      doc_nro: docNro,
      condicion_iva: CONDICION_IVA[condicion],
      receptor_nombre: nombre || null,
      detalle,
      estado: "pendiente"
    })
    .select("id, codigo")
    .single();
  if (errFila) {
    if (String(errFila.message).includes("facturas_un_pedido")) {
      return respuestaError("Ese pedido ya tiene factura (o se está emitiendo ahora).", 409);
    }
    return respuestaError(errFila.message, 500);
  }

  let numero = null;
  try {
    const ticket = await ticketAcceso(supabase, cfg);
    let r = null;
    for (let intento = 0; intento < 2 && !r; intento++) {
      numero = (await ultimoNumero(ticket, cfg)) + 1;
      try {
        r = await solicitarCAE(ticket, cfg, {
          numero,
          total,
          docTipo,
          docNro,
          condicionIva: CONDICION_IVA[condicion]
        });
      } catch (e) {
        // Otro pedido usó ese número justo antes: se reintenta con el siguiente
        if (intento === 0 && /10016|correlativ/i.test(e.message)) continue;
        throw e;
      }
    }

    const fecha = `${r.fecha.slice(0, 4)}-${r.fecha.slice(4, 6)}-${r.fecha.slice(6, 8)}`;
    const venceCae = r.caeVence ? `${r.caeVence.slice(0, 4)}-${r.caeVence.slice(4, 6)}-${r.caeVence.slice(6, 8)}` : null;
    await supabase
      .from("facturas")
      .update({
        numero,
        fecha,
        cae: r.cae,
        cae_vence: venceCae,
        estado: "emitida",
        emitida_en: new Date().toISOString(),
        respuesta: r.observaciones.length ? r.observaciones.join(" · ") : null
      })
      .eq("id", fila.id);

    return Response.json({
      ok: true,
      factura: { id: fila.id, codigo: fila.codigo, numero, punto_venta: cfg.puntoVenta, cae: r.cae, total, produccion: cfg.produccion },
      observaciones: r.observaciones
    });
  } catch (e) {
    // ¿Quedó emitida igual? (se cortó la conexión después de mandarla)
    if (numero && !/RECHAZADA/.test(e.codigo || "")) {
      try {
        const ticket = await ticketAcceso(supabase, cfg);
        const c = await consultarComprobante(ticket, cfg, numero);
        if (c?.cae && Math.abs(c.total - total) < 0.01) {
          const f = c.fecha;
          await supabase
            .from("facturas")
            .update({
              numero,
              fecha: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
              cae: c.cae,
              cae_vence: c.caeVence ? `${c.caeVence.slice(0, 4)}-${c.caeVence.slice(4, 6)}-${c.caeVence.slice(6, 8)}` : null,
              estado: "emitida",
              emitida_en: new Date().toISOString(),
              respuesta: "Recuperada después de un corte de conexión"
            })
            .eq("id", fila.id);
          return Response.json({
            ok: true,
            factura: { id: fila.id, codigo: fila.codigo, numero, punto_venta: cfg.puntoVenta, cae: c.cae, total, produccion: cfg.produccion }
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
