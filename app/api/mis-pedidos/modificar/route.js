import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { pedido_id, telefono, items } = await request.json();

    if (!pedido_id || !telefono || !Array.isArray(items)) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Verificamos que el pedido sea del cliente y siga pendiente
    const { data: pedido, error: fetchError } = await supabase
      .from("pedidos")
      .select("id, telefono_cliente, estado")
      .eq("id", pedido_id)
      .maybeSingle();

    if (fetchError || !pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.telefono_cliente !== telefono) {
      return NextResponse.json({ error: "Este pedido no te pertenece" }, { status: 403 });
    }
    if (pedido.estado && pedido.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este pedido ya está en proceso, escribinos por WhatsApp para modificarlo." },
        { status: 400 }
      );
    }

    // Aplicamos los cambios: cantidad 0 o menos = eliminar el ítem
    for (const item of items) {
      if (!item.id) continue;

      if (Number(item.cantidad) <= 0) {
        const { error: delError } = await supabase
          .from("items_pedido")
          .delete()
          .eq("id", item.id)
          .eq("pedido_id", pedido_id);
        if (delError) throw new Error(delError.message);
      } else {
        const { data: itemActual } = await supabase
          .from("items_pedido")
          .select("precio_unitario")
          .eq("id", item.id)
          .maybeSingle();
        if (!itemActual) continue;

        const nuevaCantidad = Number(item.cantidad);
        const { error: updError } = await supabase
          .from("items_pedido")
          .update({
            cantidad: nuevaCantidad,
            subtotal: itemActual.precio_unitario * nuevaCantidad
          })
          .eq("id", item.id)
          .eq("pedido_id", pedido_id);
        if (updError) throw new Error(updError.message);
      }
    }

    // Recalculamos el total del pedido con lo que quedó
    const { data: itemsRestantes, error: itemsError } = await supabase
      .from("items_pedido")
      .select("subtotal")
      .eq("pedido_id", pedido_id);

    if (itemsError) throw new Error(itemsError.message);

    if (!itemsRestantes || itemsRestantes.length === 0) {
      return NextResponse.json(
        { error: "No podés dejar el pedido sin productos. Cancelalo en vez de vaciarlo." },
        { status: 400 }
      );
    }

    const nuevoTotal = itemsRestantes.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);

    const { error: totalError } = await supabase
      .from("pedidos")
      .update({ total: nuevoTotal })
      .eq("id", pedido_id);

    if (totalError) throw new Error(totalError.message);

    return NextResponse.json({ ok: true, total: nuevoTotal });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
