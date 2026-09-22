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

  // Cupón de descuento: se valida acá (no en el celular) y el descuento se
  // guarda en el pedido. Así el total queda bien y el cliente no figura
  // debiendo la parte que le descontamos.
  const subtotal = Number(pedidoLimpio.subtotal ?? pedidoLimpio.total ?? 0);
  let cuponUsado = null;
  if (body.cupon) {
    const unidades = (body.items || []).reduce((a, i) => a + Number(i.cantidad || 0), 0);
    const { data: validacion } = await supabaseAdmin.rpc("validar_cupon", {
      p_codigo: body.cupon,
      p_telefono: pedidoLimpio.telefono_cliente,
      p_total: subtotal
    });
    const r = validacion?.[0];
    if (r?.valido) {
      const pct =
        unidades >= 2 && Number(r.porcentaje_segundo) > Number(r.porcentaje)
          ? Number(r.porcentaje_segundo)
          : Number(r.porcentaje);
      const descuento = Math.round((subtotal * pct) / 100);
      cuponUsado = { codigo: String(body.cupon).trim().toUpperCase(), pct, descuento };
      pedidoLimpio.descuento_tipo = "monto";
      pedidoLimpio.descuento_valor = descuento;
      pedidoLimpio.total = Math.max(0, subtotal - descuento);
      const marca = `[Cupón ${cuponUsado.codigo} -${pct}%]`;
      pedidoLimpio.nota_cliente = pedidoLimpio.nota_cliente
        ? `${pedidoLimpio.nota_cliente} ${marca}`
        : marca;
    }
  }

  const pedidoAInsertar = {
    ...pedidoLimpio,
    subtotal,
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

  // El cupón es de un solo uso: queda marcado con este pedido
  if (cuponUsado) {
    await supabaseAdmin.rpc("usar_cupon", { p_codigo: cuponUsado.codigo, p_pedido_id: pedido.id });
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
