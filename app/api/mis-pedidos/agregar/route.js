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

// Avisa SOLO a los dispositivos marcados como admin, para no molestar a los clientes.
async function avisarAlAdmin(titulo, mensaje, url) {
  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("es_admin", true);

    const payload = JSON.stringify({ title: titulo, body: mensaje, url: url || "/admin/pedidos" });

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
    // Si falla el aviso, no rompemos la operación del cliente: lo importante
    // es que su pedido quede bien guardado.
    console.error("Error al avisar al admin:", err);
  }
}

export async function POST(request) {
  try {
    const { pedido_id, telefono, productos } = await request.json();

    if (!pedido_id || !telefono || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // 1. Verificamos que el pedido sea del cliente y siga pendiente
    const { data: pedido, error: fetchError } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, telefono_cliente, nombre_cliente, estado")
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
        { error: "Este pedido ya está en proceso. Escribinos por WhatsApp para agregarle productos." },
        { status: 400 }
      );
    }

    // 2. Traemos los precios REALES desde la base (nunca confiamos en el precio
    // que manda el navegador: si no, alguien podría mandarse un precio de $1).
    const ids = productos.map((p) => Number(p.producto_id)).filter(Boolean);
    const { data: productosDB, error: prodError } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, activo")
      .in("id", ids);

    if (prodError) throw new Error(prodError.message);

    // 3. Traemos los ítems que ya tiene el pedido, para sumar cantidad si repite producto
    const { data: itemsExistentes } = await supabase
      .from("items_pedido")
      .select("id, producto_id, cantidad, precio_unitario")
      .eq("pedido_id", pedido_id);

    const nombresAgregados = [];

    for (const pedidoItem of productos) {
      const prod = (productosDB || []).find((p) => p.id === Number(pedidoItem.producto_id));
      if (!prod || !prod.activo) continue;

      const cantidad = Math.max(1, Number(pedidoItem.cantidad) || 1);
      const precio = Number(prod.precio_oferta) > 0 ? Number(prod.precio_oferta) : Number(prod.precio);

      const yaEstaba = (itemsExistentes || []).find((i) => i.producto_id === prod.id);

      if (yaEstaba) {
        const nuevaCantidad = Number(yaEstaba.cantidad) + cantidad;
        const { error: updError } = await supabase
          .from("items_pedido")
          .update({
            cantidad: nuevaCantidad,
            subtotal: Number(yaEstaba.precio_unitario) * nuevaCantidad
          })
          .eq("id", yaEstaba.id);
        if (updError) throw new Error(updError.message);
      } else {
        const { error: insError } = await supabase.from("items_pedido").insert({
          pedido_id: pedido_id,
          producto_id: prod.id,
          nombre_producto: prod.nombre,
          precio_unitario: precio,
          cantidad: cantidad,
          subtotal: precio * cantidad
        });
        if (insError) throw new Error(insError.message);
      }

      nombresAgregados.push(`${cantidad}x ${prod.nombre}`);
    }

    if (nombresAgregados.length === 0) {
      return NextResponse.json(
        { error: "No se pudo agregar ningún producto (puede que ya no estén disponibles)." },
        { status: 400 }
      );
    }

    // 4. Recalculamos el total del pedido
    const { data: itemsFinales, error: itemsError } = await supabase
      .from("items_pedido")
      .select("subtotal")
      .eq("pedido_id", pedido_id);

    if (itemsError) throw new Error(itemsError.message);

    const nuevoTotal = (itemsFinales || []).reduce((acc, i) => acc + Number(i.subtotal || 0), 0);

    const { error: totalError } = await supabase
      .from("pedidos")
      .update({ total: nuevoTotal, subtotal: nuevoTotal })
      .eq("id", pedido_id);

    if (totalError) throw new Error(totalError.message);

    // 5. Te avisamos por push (solo a los dispositivos del negocio)
    await avisarAlAdmin(
      "🛒 Agregaron productos a un pedido",
      `${pedido.nombre_cliente || "Un cliente"} sumó ${nombresAgregados.join(", ")} al pedido ${pedido.numero_pedido}. Nuevo total: $${nuevoTotal.toLocaleString("es-AR")}`,
      "/admin/pedidos"
    );

    return NextResponse.json({ ok: true, total: nuevoTotal, agregados: nombresAgregados });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
