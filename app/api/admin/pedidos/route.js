export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NEGOCIO as CFG } from "@/lib/config";
import { PAGOS_QUE_CIERRAN } from "@/lib/estadosPedido";
import { claveInterna, CABECERA_INTERNA } from "@/lib/claveInterna";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET            → todos los pedidos (la primera vez, y una revisión por día)
// GET ?desde=ISO  → SOLO los pedidos que cambiaron desde esa fecha (estado,
//                   pago, productos...) y los que se borraron. Es lo que pide
//                   el celular cada vez: una respuesta chiquita que llega
//                   aunque la señal sea mala.
// En los dos casos devuelve "hasta": la fecha que el celular tiene que mandar
// la próxima vez. Va un minuto para atrás a propósito: si algo cambió justo
// mientras se armaba la respuesta, la próxima vez vuelve a venir (repetir un
// pedido no hace daño, perderlo sí).
export async function GET(request) {
  const desde = new URL(request.url).searchParams.get("desde");
  const hasta = new Date(Date.now() - 60 * 1000).toISOString();

  let consulta = supabaseAdmin
    .from("pedidos")
    .select(`*, items_pedido (*)`)
    .order("created_at", { ascending: false });

  let fechaDesde = null;
  if (desde) {
    fechaDesde = new Date(desde);
    if (isNaN(fechaDesde.getTime())) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }
    consulta = consulta.gt("cambiado_en", fechaDesde.toISOString());
  }

  const { data, error } = await consulta;
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (!fechaDesde) {
    return Response.json({ pedidos: data, completo: true, hasta });
  }

  const { data: borrados, error: errBorrados } = await supabaseAdmin
    .from("registros_borrados")
    .select("registro_id")
    .eq("tabla", "pedidos")
    .gt("borrado_en", fechaDesde.toISOString());
  if (errBorrados) {
    return Response.json({ error: errBorrados.message }, { status: 400 });
  }

  return Response.json({
    pedidos: data,
    borrados: (borrados || []).map((b) => b.registro_id),
    completo: false,
    hasta
  });
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

    // El tipo se guarda aunque el valor sea 0. Antes, al elegir "%" (con el
    // número todavía en 0) el tipo se borraba, el casillero del número
    // quedaba bloqueado y no había forma de cargar un descuento.
    // El total final lo recalcula la base desde los productos (trigger).
    campos.subtotal = subtotal;
    campos.descuento_tipo = tipo || null;
    campos.descuento_valor = valor;
    campos.total = nuevoTotal;
  }

  // ===== LÓGICA DE CONVERSIÓN A VENTA Y DESCUENTO DE STOCK =====
  const estadoFinal = estado !== undefined ? estado : pedidoActual.estado;
  const estadoPagoFinal = estado_pago !== undefined ? estado_pago : pedidoActual.estado_pago;

  const debeConvertirseAVenta =
    !pedidoActual.stock_descontado &&
    (convertir_a_venta === true ||
      (estadoFinal === "entregado" && PAGOS_QUE_CIERRAN.includes(estadoPagoFinal)));

  if (debeConvertirseAVenta) {
    // Una sola llamada descuenta el stock de todos los productos.
    // Antes se hacían dos consultas por producto esperando cada una, y con
    // pedidos de varios items el servicio cortaba por tiempo de espera.
    const { error: errStock } = await supabaseAdmin.rpc("descontar_stock_pedido", {
      p_pedido_id: Number(id)
    });

    if (errStock) {
      return Response.json({ error: errStock.message }, { status: 400 });
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

  // Le avisamos al cliente que cambió el estado de su pedido. Va sin esperar
  // respuesta: si el aviso falla, el cambio de estado igual se guardó.
  const cambioEstado = estado !== undefined && estado !== pedidoActual.estado;
  const cambioPago =
    estado_pago !== undefined && estado_pago !== pedidoActual.estado_pago;

  if (cambioEstado || cambioPago) {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL || CFG.sitio;

    // Cortamos el aviso a los 3 segundos: si tarda más, el cambio de estado
    // igual se guardó y no tiene sentido hacer esperar al panel.
    const corte = AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined;

    // La firmamos con la clave interna: esta llamada la hace el servidor,
    // no hay sesión de administrador detrás.
    const clave = await claveInterna();

    fetch(`${base}/api/avisar-cliente`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [CABECERA_INTERNA]: clave || "" },
      signal: corte,
      body: JSON.stringify({
        pedido_id: id,
        estado: cambioEstado ? estado : null,
        estado_pago: cambioPago ? estado_pago : null
      })
    }).catch(() => {});
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
    // Devolvemos todo el stock en una sola llamada
    await supabaseAdmin.rpc("devolver_stock_pedido", { p_pedido_id: Number(id) });
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
