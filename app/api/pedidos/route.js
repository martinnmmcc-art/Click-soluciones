import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();

  const { data: pedido, error: errPedido } = await supabaseAdmin
    .from("pedidos")
    .insert(body.pedido)
    .select()
    .single();

  if (errPedido) {
    return Response.json({ error: errPedido.message }, { status: 400 });
  }

  const itemsAInsertar = body.items.map((i) => ({
    ...i,
    pedido_id: pedido.id
  }));

  const { error: errItems } = await supabaseAdmin
    .from("items_pedido")
    .insert(itemsAInsertar);

  if (errItems) {
    return Response.json({ error: errItems.message }, { status: 400 });
  }

  return Respon
