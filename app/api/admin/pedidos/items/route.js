export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ajustarStock(producto_id, delta) {
  // delta negativo = restar stock (se vendió más), delta positivo = devolver stock
  if (!producto_id) return;
  const { data: prod } = await supabaseAdmin
    .from("Productos")
    .select("stock")
    .eq("id", producto_id)
    .single();

  if (prod) {
    const nuevoStock = Number(prod.stock || 0) + delta;
    await supabaseAdmin.from("Productos").update({ stock: nuevoStock }).eq("id", producto_id);
  }
}

async function pedidoTieneStockDescontado(pedido_id) {
  const { data } = await supabaseAdmin
    .from("pedidos")
    .select("stock_descontado")
    .eq("id", pedido_id)
    .single();
  return !!data?.stock_descontado;
}

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

  // Si el pedido ya es una venta confirmada, este producto nuevo también descuenta stock
  const yaEsVenta = await pedidoTieneStockDescontado(pedido_id);
  if (yaEsVenta) {
    await ajustarStock(producto_id, -Number(cantidad));
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

async function recalcularTotalPedido(pedidoId) {
  const { data: items, error: errItems } = await supabaseAdmin
    .from("items_pedido")
    .select("subtotal")
    .eq("pedido_id", pedidoId);

  if (errItems) return { error: errItems.message };

  const nuevoTotal = items.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);

  const { error: errPedido } = await supabaseAdmin
    .from("pedidos")
    .update({ total: nuevoTotal })
    .eq("id", pedidoId);

  if (errPedido) return { error: errPedido.message };

  return { total: nuevoTotal };
}

export async function PATCH(req) {
  const body = await req.json();
  const { item_id, pedido_id, cantidad } = body;

  if (!item_id || !pedido_id || !cantidad) {
    return Response.json({ error: "Faltan datos para modificar el item" }, { status: 400 });
  }

  const { data: itemActual, error: errGet } = await supabaseAdmin
    .from("items_pedido")
    .select("precio_unitario, cantidad, producto_id")
    .eq("id", item_id)
    .single();

  if (errGet) {
    return Response.json({ error: errGet.message }, { status: 400 });
  }

  const nuevoSubtotal = Number(itemActual.precio_unitario) * Number(cantidad);

  const { data: item, error: errUpdate } = await supabaseAdmin
    .from("items_pedido")
    .update({ cantidad, subtotal: nuevoSubtotal })
    .eq("id", item_id)
    .select()
    .single();

  if (errUpdate) {
    return Response.json({ error: errUpdate.message }, { status: 400 });
  }

  // Si el pedido ya es una venta confirmada, ajustamos stock por la diferencia de cantidad
  const yaEsVenta = await pedidoTieneStockDescontado(pedido_id);
  if (yaEsVenta) {
    const diferencia = Number(cantidad) - Number(itemActual.cantidad);
    // si subió la cantidad, se descuenta más stock (delta negativo); si bajó, se devuelve
    await ajustarStock(itemActual.producto_id, -diferencia);
  }

  const resultado = await recalcularTotalPedido(pedido_id);
  if (resultado.error) {
    return Response.json({ error: resultado.error }, { status: 400 });
  }

  return Response.json({ item, total: resultado.total });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("item_id");
  const pedidoId = searchParams.get("pedido_id");

  if (!itemId || !pedidoId) {
    return Response.json({ error: "Faltan datos para eliminar el item" }, { status: 400 });
  }

  // Antes de borrar, guardamos qué producto y cantidad tenía, por si hay que devolver stock
  const { data: itemAEliminar } = await supabaseAdmin
    .from("items_pedido")
    .select("producto_id, cantidad")
    .eq("id", itemId)
    .single();

  const { error: errDelete } = await supabaseAdmin
    .from("items_pedido")
    .delete()
    .eq("id", itemId);

  if (errDelete) {
    return Response.json({ error: errDelete.message }, { status: 400 });
  }

  const yaEsVenta = await pedidoTieneStockDescontado(pedidoId);
  if (yaEsVenta && itemAEliminar) {
    await ajustarStock(itemAEliminar.producto_id, Number(itemAEliminar.cantidad));
  }

  const resultado = await recalcularTotalPedido(pedidoId);
  if (resultado.error) {
    return Response.json({ error: resultado.error }, { status: 400 });
  }

  return Response.json({ success: true, total: resultado.total });
    }
