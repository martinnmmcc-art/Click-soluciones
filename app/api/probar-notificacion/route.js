export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Envía una notificación de prueba y devuelve el detalle de qué pasó.
//
// Sirve para saber en qué punto se corta: si falta la suscripción, si las
// claves no están configuradas, o si el servicio de Google la rechaza.
export async function POST(request) {
  const diagnostico = {
    claves_configuradas: false,
    suscripciones_encontradas: 0,
    enviadas: 0,
    fallidas: 0,
    errores: []
  };

  try {
    const { telefono } = await request.json();

    const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;

    diagnostico.claves_configuradas = !!(publica && privada);

    if (!diagnostico.claves_configuradas) {
      diagnostico.errores.push(
        "Faltan las claves VAPID en el servidor. Sin ellas no se puede enviar nada."
      );
      return Response.json(diagnostico);
    }

    webpush.setVapidDetails("mailto:martinnm.mcc@gmail.com", publica, privada);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("telefono", telefono);

    diagnostico.suscripciones_encontradas = subs?.length || 0;

    if (!subs || subs.length === 0) {
      diagnostico.errores.push(
        "Este teléfono no tiene ningún dispositivo registrado. Activá las notificaciones primero."
      );
      return Response.json(diagnostico);
    }

    diagnostico.marcado_admin = subs.some((s) => s.es_admin);

    const contenido = JSON.stringify({
      title: "✅ Prueba de Bolson Click",
      body: "Si ves esto, las notificaciones funcionan bien.",
      url: "/admin"
    });

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          contenido
        );
        diagnostico.enviadas++;
      } catch (err) {
        diagnostico.fallidas++;
        diagnostico.errores.push(
          `Rechazada (código ${err.statusCode || "?"}): ${err.body || err.message}`
        );

        // Suscripción vencida: la limpiamos para que no moleste más
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
          diagnostico.errores.push("Esa suscripción estaba vencida y se eliminó.");
        }
      }
    }

    return Response.json(diagnostico);
  } catch (err) {
    diagnostico.errores.push(err.message);
    return Response.json(diagnostico, { status: 500 });
  }
}
