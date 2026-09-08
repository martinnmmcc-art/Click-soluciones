export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Avisa al cliente que tiene un cupón esperándolo.
//
// La notificación llega aunque no esté con la app abierta, que es la
// diferencia con el mensaje de WhatsApp: no depende de que lea el chat.
export async function POST(request) {
  try {
    const { telefono, codigo, porcentaje, vence_en, motivo } = await request.json();

    if (!telefono || !codigo) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;

    if (!publica || !privada) {
      return Response.json({ ok: false, motivo: "push_no_configurado" });
    }

    webpush.setVapidDetails("mailto:martinnm.mcc@gmail.com", publica, privada);

    const { data: suscripciones } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("telefono", telefono)
      .or("es_admin.is.null,es_admin.eq.false");

    if (!suscripciones || suscripciones.length === 0) {
      return Response.json({ ok: true, enviados: 0, motivo: "no_tiene_avisos" });
    }

    // El texto cambia según por qué se lo dimos: mencionar el motivo hace
    // que se sienta personal y no un envío masivo.
    const titulos = {
      carrito: "🎁 Te dejamos un descuento",
      favorito: "⭐ Descuento en tu favorito",
      bienvenida: "👋 Regalo para tu primera compra",
      manual: "🎁 Tenés un descuento esperándote"
    };

    const dias = vence_en
      ? Math.max(
          1,
          Math.ceil((new Date(vence_en) - new Date()) / (1000 * 60 * 60 * 24))
        )
      : null;

    const contenido = JSON.stringify({
      title: titulos[motivo] || titulos.manual,
      body:
        `${porcentaje}% off con el código ${codigo}` +
        (dias ? ` · Te quedan ${dias} día${dias === 1 ? "" : "s"}` : ""),
      url: "/carrito"
    });

    let enviados = 0;

    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            contenido
          );
          enviados++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );

    return Response.json({ ok: true, enviados });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
