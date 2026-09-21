export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();

  // Quitamos campos que no maneja el cliente (el saldo lo calcula la base)
  const { saldo_aplicado, saldo_cedido, ...pedidoLimpio } = body.pedido || {};

  const pedidoAInsertar = {
    ...pedidoLimpio,
    subtotal: body.pedido.subtotal ?? body.pedido.total,
    tipo_pedido: "presupuesto",
    stock_descontado: false,
  };

  const { data: pedido, error: errPedido } = await supabaseAdmin
    .from("pedidos")
    .insert(pedidoAInsertar)
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

  // Saldo a favor: si el cliente pagó de más en pedidos anteriores y se
  // eligió usarlo, se pasa a este pedido (se descuenta de lo que debe).
  let saldoAplicado = 0;
  if (body.aplicar_saldo) {
    const { data: aplicado, error: errSaldo } = await supabaseAdmin.rpc("aplicar_saldo_a_favor", {
      p_pedido_id: pedido.id,
      p_maximo: null
    });
    if (!errSaldo) saldoAplicado = Number(aplicado || 0);
  }

  if (saldoAplicado > 0) {
    const { data: actualizado } = await supabaseAdmin
      .from("pedidos")
      .select("*")
      .eq("id", pedido.id)
      .single();
    return Response.json({ pedido: actualizado || pedido, saldo_aplicado: saldoAplicado });
  }

  return Response.json({ pedido, saldo_aplicado: 0 });
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
