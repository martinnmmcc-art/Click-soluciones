export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();
  const { pedido_id, producto_id, nombre_producto, precio_unitario, cantidad } = body;

  if (!pedido_id || !nombre_producto || !precio_unitario || !cantidad) {
    return Response.json({ error: "Faltan datos del producto" }, { status: 400 });
  }

  const subtotal = Number(precio_unitario) * Number(cantidad);

  const { data: item, error: errItem } = await supabaseAdmin
    .from("items_pedido")
    .insert({
      pedido_id,
      producto_id,
      nombre_producto,
      precio_unitario,
      cantidad,
      subtotal,
    })
    .select()
    .single();

  if (errItem) {
    return Response.json({ error: errItem.message }, { status: 400 });
  }

  const { data: items, error: errItems } = await supabaseAdmin
    .from("items_pedido")
    .select("subtotal")
    .eq("pedido_id", pedido_id);

  if (errItems) {
    return Response.json({ error: errItems.message }, { status: 400 });
  }

  const nuevoTotal = items.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);

  const { error: errPedido } = await supabaseAdmin
    .from("pedidos")
    .update({ total: nuevoTotal })
    .eq("id", pedido_id);

  if (errPedido) {
    return Response.json({ error: errPedido.message }, { status: 400 });
  }

  return Response.json({ item, total: nuevoTotal });
}
