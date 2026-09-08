export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Envía una notificación puntual a un cliente. Sirve para avisar de una
// oferta sin tener que resignar margen con un cupón: a veces alcanza con
// que se entere de que bajó el precio de algo que ya le interesaba.
export async function POST(request) {
  try {
    const { telefono, titulo, cuerpo, url } = await request.json();

    if (!telefono || !titulo) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;

    if (!publica || !privada) {
      return Response.json({ ok: false, enviados: 0, motivo: "push_no_configurado" });
    }

    webpush.setVapidDetails("mailto:martinnm.mcc@gmail.com", publica, privada);

    // Solo dispositivos del cliente, nunca los de los admins
    const { data: suscripciones } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("telefono", telefono)
      .or("es_admin.is.null,es_admin.eq.false");

    if (!suscripciones || suscripciones.length === 0) {
      return Response.json({ ok: true, enviados: 0, motivo: "no_tiene_avisos" });
    }

    const contenido = JSON.stringify({
      title: titulo,
      body: cuerpo || "",
      url: url || "/catalogo"
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
          // Suscripción muerta: la limpiamos para no reintentar siempre
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
