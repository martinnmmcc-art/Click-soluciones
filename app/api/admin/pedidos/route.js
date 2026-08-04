export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select(`*, items_pedido (*)`)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedidos: data });
}

export async function PATCH(req) {
  const body = await req.json();
  const { id, estado, estado_pago, monto_pagado, descuento_tipo, descuento_valor, convertir_a_venta } = body;

  if (!id) {
    return Response.json({ error: "Falta el id del pedido" }, { status: 400 });
  }

  // Traemos el pedido actual completo (necesario para saber el estado final combinado
  // y para no descontar el stock dos veces)
  const { data: pedidoActual, error: errFetch } = await supabaseAdmin
    .from("pedidos")
    .select("subtotal, total, estado, estado_pago, stock_descontado, tipo_pedido")
    .eq("id", id)
    .single();

  if (errFetch) {
    return Response.json({ error: errFetch.message }, { status: 400 });
  }

  const campos = {};
  if (estado !== undefined) campos.estado = estado;
  if (estado_pago !== undefined) campos.estado_pago = estado_pago;
  if (monto_pagado !== undefined) campos.monto_pagado = monto_pagado;

  const tocaDescuento = descuento_tipo !== undefined || descuento_valor !== undefined;

  if (tocaDescuento) {
    const subtotal =
      pedidoActual.subtotal !== null && pedidoActual.subtotal !== undefined
        ? Number(pedidoActual.subtotal)
        : Number(pedidoActual.total);

    const tipo = descuento_tipo !== undefined ? descuento_tipo : null;
    const valor = descuento_valor !== undefined ? Number(descuento_valor) || 0 : 0;

    let nuevoTotal = subtotal;
    if (tipo === "porcentaje" && valor > 0) {
      nuevoTotal = subtotal - subtotal * (valor / 100);
    } else if (tipo === "monto" && valor > 0) {
      nuevoTotal = subtotal - valor;
    }
    if (nuevoTotal < 0) nuevoTotal = 0;

    campos.subtotal = subtotal;
    campos.descuento_tipo = valor > 0 ? tipo : null;
    campos.descuento_valor = valor > 0 ? valor : 0;
    campos.total = nuevoTotal;
  }

  // ===== LÓGICA DE CONVERSIÓN A VENTA Y DESCUENTO DE STOCK =====
  const estadoFinal = estado !== undefined ? estado : pedidoActual.estado;
  const estadoPagoFinal = estado_pago !== undefined ? estado_pago : pedidoActual.estado_pago;

  const debeConvertirseAVenta =
    !pedidoActual.stock_descontado &&
    (convertir_a_venta === true ||
      (estadoFinal === "entregado" && estadoPagoFinal === "pagado"));

  if (debeConvertirseAVenta) {
    const { data: items, error: errItems } = await supabaseAdmin
      .from("items_pedido")
      .select("producto_id, cantidad")
      .eq("pedido_id", id);

    if (errItems) {
      return Response.json({ error: errItems.message }, { status: 400 });
    }

    for (const item of items || []) {
      if (!item.producto_id) continue;
      const { data: prod } = await supabaseAdmin
        .from("Productos")
        .select("stock")
        .eq("id", item.producto_id)
        .single();

      if (prod) {
        const nuevoStock = Number(prod.stock || 0) - Number(item.cantidad || 0);
        await supabaseAdmin
          .from("Productos")
          .update({ stock: nuevoStock })
          .eq("id", item.producto_id);
      }
    }

    campos.stock_descontado = true;
    campos.tipo_pedido = "venta";
  }

  if (Object.keys(campos).length === 0) {
    return Response.json({ error: "No se envió ningún campo para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .update(campos)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedido: data });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Falta el id del pedido" }, { status: 400 });
  }

  // Si el pedido ya había descontado stock (era una venta confirmada), lo devolvemos
  // al eliminarlo, para no perder esas unidades del inventario.
  const { data: pedidoActual } = await supabaseAdmin
    .from("pedidos")
    .select("stock_descontado")
    .eq("id", id)
    .single();

  if (pedidoActual?.stock_descontado) {
    const { data: items } = await supabaseAdmin
      .from("items_pedido")
      .select("producto_id, cantidad")
      .eq("pedido_id", id);

    for (const item of items || []) {
      if (!item.producto_id) continue;
      const { data: prod } = await supabaseAdmin
        .from("Productos")
        .select("stock")
        .eq("id", item.producto_id)
        .single();
      if (prod) {
        const nuevoStock = Number(prod.stock || 0) + Number(item.cantidad || 0);
        await supabaseAdmin
          .from("Productos")
          .update({ stock: nuevoStock })
          .eq("id", item.producto_id);
      }
    }
  }

  const { error: errItems } = await supabaseAdmin
    .from("items_pedido")
    .delete()
    .eq("pedido_id", id);

  if (errItems) {
    return Response.json({ error: errItems.message }, { status: 400 });
  }

  const { error: errPedido } = await supabaseAdmin
    .from("pedidos")
    .delete()
    .eq("id", id);

  if (errPedido) {
    return Response.json({ error: errPedido.message }, { status: 400 });
  }

  return Response.json({ success: true });
}
