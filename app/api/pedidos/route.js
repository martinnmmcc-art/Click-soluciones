export const dynamic = "force-dynamic";
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

  return Response.json({ pedido });
} 
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero");

  if (!numero) {
    return Response.json({ error: "Falta el número de pedido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("*")
    .eq("numero_pedido", numero)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedido: data });
}
