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

// Deja el teléfono en su forma "núcleo" para que distintos formatos coincidan.
function normalizarTelefono(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return limpio;
}

function telefonoParaWhatsapp(tel) {
  return `549${normalizarTelefono(tel)}`;
}

// El aviso se hace acá (en el servidor) y no en el navegador, porque acá siempre
// tenemos los datos reales del pedido, aunque el cliente cancele apenas lo creó.
async function avisarCancelacion(pedido) {
  try {
    await supabase.from("eventos_actividad").insert({
      tipo: "pedido_cancelado",
      telefono: pedido.telefono_cliente,
      nombre: pedido.nombre_cliente,
      detalle: pedido.numero_pedido,
      monto: pedido.total
    });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("es_admin", true);

    const payload = JSON.stringify({
      title: "❌ Canceló un pedido",
      body: `${pedido.nombre_cliente || "Un cliente"} canceló el pedido ${pedido.numero_pedido} de $${Number(pedido.total || 0).toLocaleString("es-AR")}`,
      url: pedido.telefono_cliente
        ? `https://wa.me/${telefonoParaWhatsapp(pedido.telefono_cliente)}`
        : "/admin/pedidos"
    });

    await Promise.all(
      (subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      })
    );
  } catch (err) {
    // Si falla el aviso no rompemos la cancelación: lo importante es que el
    // pedido quede cancelado como pidió el cliente.
    console.error("Error al avisar la cancelación:", err);
  }
}

export async function POST(request) {
  try {
    const { pedido_id, telefono } = await request.json();

    if (!pedido_id || !telefono) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const { data: pedido, error: fetchError } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, telefono_cliente, nombre_cliente, estado, total")
      .eq("id", pedido_id)
      .maybeSingle();

    if (fetchError || !pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (normalizarTelefono(pedido.telefono_cliente) !== normalizarTelefono(telefono)) {
      return NextResponse.json({ error: "Este pedido no te pertenece" }, { status: 403 });
    }

    if (pedido.estado && pedido.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este pedido ya está en proceso, escribinos por WhatsApp si necesitás cancelarlo." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({ estado: "cancelado" })
      .eq("id", pedido_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await avisarCancelacion(pedido);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
