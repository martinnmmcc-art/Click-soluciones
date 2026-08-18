import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:contacto@bolsonclick.com.ar",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Formato internacional para abrir WhatsApp (la base guarda 2944636224)
function telefonoParaWhatsapp(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return `549${limpio}`;
}

// Cada tipo de evento define cómo se ve la notificación
const PLANTILLAS = {
  registro: (e) => ({
    titulo: "🎉 Cliente nuevo",
    cuerpo: `${e.nombre || "Alguien"} (${e.telefono}) se registró en la app`
  }),
  carrito: (e) => ({
    titulo: "🛒 Agregó al carrito",
    cuerpo: `${e.nombre || "Un cliente"} sumó ${e.detalle} al carrito`
  }),
  carrito_quitar: (e) => ({
    titulo: "➖ Sacó del carrito",
    cuerpo: `${e.nombre || "Un cliente"} quitó ${e.detalle} del carrito`
  }),
  pedido_nuevo: (e) => ({
    titulo: "💰 ¡Pedido nuevo!",
    cuerpo: `${e.nombre || "Un cliente"} hizo un pedido de $${Number(e.monto || 0).toLocaleString("es-AR")}`
  }),
  pedido_modificado: (e) => ({
    titulo: "✏️ Modificó su pedido",
    cuerpo: `${e.nombre || "Un cliente"} cambió su pedido. Nuevo total: $${Number(e.monto || 0).toLocaleString("es-AR")}`
  }),
  pedido_agregado: (e) => ({
    titulo: "➕ Sumó al pedido",
    cuerpo: `${e.nombre || "Un cliente"} agregó ${e.detalle}. Total: $${Number(e.monto || 0).toLocaleString("es-AR")}`
  }),
  pedido_cancelado: (e) => ({
    titulo: "❌ Canceló un pedido",
    cuerpo: `${e.nombre || "Un cliente"} canceló su pedido de $${Number(e.monto || 0).toLocaleString("es-AR")}`
  }),
  comprobante: (e) => ({
    titulo: "📎 Subió comprobante",
    cuerpo: `${e.nombre || "Un cliente"} cargó el comprobante de pago`
  })
};

export async function POST(request) {
  try {
    const evento = await request.json();
    const { tipo, telefono, nombre, detalle, monto } = evento;

    if (!tipo) {
      return NextResponse.json({ error: "Falta el tipo de evento" }, { status: 400 });
    }

    // 1. Guardamos el evento en el historial (aunque falle el push, queda registro)
    await supabase.from("eventos_actividad").insert({
      tipo,
      telefono: telefono || null,
      nombre: nombre || null,
      detalle: detalle || null,
      monto: monto || null
    });

    // 2. Armamos el texto según el tipo
    const plantilla = PLANTILLAS[tipo];
    if (!plantilla) {
      return NextResponse.json({ ok: true, push: false });
    }
    const { titulo, cuerpo } = plantilla(evento);

    // 3. Enviamos SOLO a los dispositivos del negocio
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("es_admin", true);

    // Al tocar la notificación se abre WhatsApp con esa persona, así podés
    // escribirle al toque si no sabe cómo contactarse.
    const urlDestino = telefono
      ? `https://wa.me/${telefonoParaWhatsapp(telefono)}`
      : "/admin/actividad";

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      url: urlDestino
    });

    let enviados = 0;
    await Promise.all(
      (subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          enviados++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      })
    );

    return NextResponse.json({ ok: true, enviados });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
