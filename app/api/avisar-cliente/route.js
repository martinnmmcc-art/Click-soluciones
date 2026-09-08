export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mensajes por estado, escritos para el cliente. La idea es que se entere
// sin tener que preguntar: la mayoría de las consultas por WhatsApp son
// "¿cómo viene mi pedido?", y esto las evita.
const AVISOS = {
  preparando: {
    titulo: "📦 Estamos preparando tu pedido",
    cuerpo: "Ya lo estamos juntando. Te avisamos cuando salga."
  },
  listo: {
    titulo: "✅ Tu pedido está listo",
    cuerpo: "Podés pasar a buscarlo cuando quieras."
  },
  repartiendo: {
    titulo: "🛵 Tu pedido va en camino",
    cuerpo: "Salió para tu dirección. Estate atento."
  },
  entregado: {
    titulo: "🎉 ¡Pedido entregado!",
    cuerpo: "Gracias por comprar en Bolson Click."
  },
  esperando_stock: {
    titulo: "⏳ Estamos esperando tu producto",
    cuerpo: "Lo encargamos al proveedor. Te avisamos apenas llegue."
  },
  demorado: {
    titulo: "⚠️ Tu pedido se demoró",
    cuerpo: "Disculpá la demora. Cualquier duda escribinos."
  }
};

const AVISOS_PAGO = {
  comprobando: {
    titulo: "🕐 Recibimos tu comprobante",
    cuerpo: "Lo estamos verificando, en un rato te confirmamos."
  },
  pagado: {
    titulo: "✅ Pago confirmado",
    cuerpo: "¡Listo! Recibimos tu pago. Gracias."
  }
};

function configurarPush() {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;

  webpush.setVapidDetails("mailto:martinnm.mcc@gmail.com", publica, privada);
  return true;
}

export async function POST(request) {
  try {
    const { pedido_id, estado, estado_pago } = await request.json();

    if (!pedido_id) {
      return Response.json({ error: "Falta el pedido" }, { status: 400 });
    }

    const aviso = estado
      ? AVISOS[estado]
      : estado_pago
      ? AVISOS_PAGO[estado_pago]
      : null;

    // No todos los estados ameritan molestar al cliente
    if (!aviso) return Response.json({ ok: true, enviados: 0, motivo: "sin_aviso" });

    const { data: pedido } = await supabase
      .from("pedidos")
      .select("telefono_cliente, numero_pedido, nombre_cliente")
      .eq("id", pedido_id)
      .single();

    if (!pedido?.telefono_cliente) {
      return Response.json({ ok: true, enviados: 0, motivo: "sin_telefono" });
    }

    if (!configurarPush()) {
      return Response.json({ ok: false, motivo: "push_no_configurado" });
    }

    // Solo las del cliente, nunca las de los admins
    const { data: suscripciones } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("telefono", pedido.telefono_cliente)
      .or("es_admin.is.null,es_admin.eq.false");

    if (!suscripciones || suscripciones.length === 0) {
      return Response.json({ ok: true, enviados: 0, motivo: "no_tiene_avisos" });
    }

    const contenido = JSON.stringify({
      title: aviso.titulo,
      body: `${aviso.cuerpo}${
        pedido.numero_pedido ? ` (${pedido.numero_pedido})` : ""
      }`,
      url: "/login"
    });

    let enviados = 0;

    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth }
            },
            contenido
          );
          enviados++;
        } catch (err) {
          // Si el celular ya no acepta avisos, limpiamos la suscripción
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
