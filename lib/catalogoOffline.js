// Guarda una copia del catálogo en el celular, para poder armar pedidos
// en lugares sin señal. Solo se guardan los datos mínimos necesarios
// (nombre y precio), no las fotos, así ocupa poco espacio.

import { supabase } from "@/lib/supabaseClient";

const CLAVE_CATALOGO = "bolsonclick_catalogo_offline";
const CLAVE_FECHA = "bolsonclick_catalogo_fecha";
const CLAVE_CLIENTES = "bolsonclick_clientes_offline";
const CLAVE_PEDIDOS = "bolsonclick_pedidos_offline";
const TANDA = 1000;

// Baja el catálogo completo y lo guarda en el celular.
export async function guardarCatalogoOffline() {
  let todos = [];
  let desde = 0;

  while (true) {
    const { data, error } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, stock, bajo_pedido")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .range(desde, desde + TANDA - 1);

    if (error) throw new Error(error.message);
    const tanda = data || [];
    todos = todos.concat(tanda);

    if (tanda.length < TANDA) break;
    desde += TANDA;
    if (desde > 20000) break; // freno de seguridad
  }

  try {
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(todos));
    localStorage.setItem(CLAVE_FECHA, new Date().toISOString());
  } catch (e) {
    // Si el celular no tiene espacio, guardamos solo lo que tiene stock,
    // que es lo que más se usa para vender en el momento.
    const soloStock = todos.filter((p) => !p.bajo_pedido);
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(soloStock));
    localStorage.setItem(CLAVE_FECHA, new Date().toISOString());
    return { total: soloStock.length, parcial: true };
  }

  return { total: todos.length, parcial: false };
}

export function leerCatalogoOffline() {
  try {
    const guardado = localStorage.getItem(CLAVE_CATALOGO);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    return [];
  }
}

export function fechaCatalogoOffline() {
  try {
    const f = localStorage.getItem(CLAVE_FECHA);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

export function hayCatalogoOffline() {
  return leerCatalogoOffline().length > 0;
}


// ---------- CLIENTES ----------
// Sin esto, armar un pedido sin señal no tiene a quién asignárselo y hay
// que escribir el nombre y el teléfono a mano cada vez.

export async function guardarClientesOffline() {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, localidad, direccion, email")
    .order("nombre", { ascending: true });

  if (error) throw new Error(error.message);

  try {
    localStorage.setItem(CLAVE_CLIENTES, JSON.stringify(data || []));
  } catch (e) {}

  return (data || []).length;
}

export function leerClientesOffline() {
  try {
    const guardado = localStorage.getItem(CLAVE_CLIENTES);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    return [];
  }
}

// ---------- PEDIDOS ABIERTOS ----------
// Para poder verlos y modificarlos (cambiar estado, agregar productos)
// aunque no haya señal.

export async function guardarPedidosOffline() {
  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "id, numero_pedido, nombre_cliente, telefono_cliente, localidad, total, subtotal, monto_pagado, estado, estado_pago, tipo_pedido, stock_descontado, created_at, items_pedido(id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)"
    )
    .neq("estado", "cancelado")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  try {
    localStorage.setItem(CLAVE_PEDIDOS, JSON.stringify(data || []));
  } catch (e) {}

  return (data || []).length;
}

export function leerPedidosOffline() {
  try {
    const guardado = localStorage.getItem(CLAVE_PEDIDOS);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    return [];
  }
}

// Descarga todo lo que hace falta para trabajar sin señal en el panel:
// productos, clientes y pedidos abiertos. Se usa desde el botón de
// "Descargar todo" y también sola al entrar con wifi.
export async function descargarDatosAdmin() {
  const resultados = { productos: 0, clientes: 0, pedidos: 0, errores: [] };

  try {
    const r = await guardarCatalogoOffline();
    resultados.productos = r.total;
  } catch (e) {
    resultados.errores.push("productos: " + e.message);
  }

  try {
    resultados.clientes = await guardarClientesOffline();
  } catch (e) {
    resultados.errores.push("clientes: " + e.message);
  }

  try {
    resultados.pedidos = await guardarPedidosOffline();
  } catch (e) {
    resultados.errores.push("pedidos: " + e.message);
  }

  return resultados;
}
