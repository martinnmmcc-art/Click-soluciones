// Guarda una copia del catálogo en el celular, para poder armar pedidos
// en lugares sin señal. Solo se guardan los datos mínimos necesarios
// (nombre y precio), no las fotos, así ocupa poco espacio.

import { supabase } from "@/lib/supabaseClient";
import { guardarLocal } from "@/lib/almacenLocal";
import { sincronizarPedidos, pedidosGuardados, fechaPedidosGuardados } from "@/lib/pedidosSync";

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

  // Primero solo los productos propios (lo que se vende en el momento) y
  // aparte el resto. Si el catálogo completo no entra, queda lo propio.
  const soloStock = todos.filter((p) => !p.bajo_pedido);
  if (!guardarLocal(CLAVE_CATALOGO, todos)) {
    guardarLocal(CLAVE_CATALOGO, soloStock);
    guardarLocal(CLAVE_FECHA, new Date().toISOString());
    return { total: soloStock.length, parcial: true };
  }
  guardarLocal(CLAVE_FECHA, new Date().toISOString());

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

  if (!guardarLocal(CLAVE_CLIENTES, data || [])) throw new Error("no hay lugar en el celular");

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

// ---------- PEDIDOS ----------
// Ahora se guardan con lib/pedidosSync.js, que baja solo lo que cambió.
// Estas funciones quedan con el mismo nombre para no tocar las pantallas.

export async function guardarPedidosOffline() {
  const { pedidos } = await sincronizarPedidos();
  // La copia vieja (antes se bajaba todo cada 15 minutos) ya no se usa
  try {
    localStorage.removeItem(CLAVE_PEDIDOS);
  } catch (e) {}
  return pedidos.length;
}

export function fechaPedidosOffline() {
  return fechaPedidosGuardados();
}

export function leerPedidosOffline() {
  const nuevos = pedidosGuardados();
  if (nuevos.length > 0) return nuevos;
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
// ---------- TUS PRODUCTOS, COMPLETOS (para la pantalla Productos) ----------
// La copia del catálogo de arriba guarda solo nombre, precio y stock de
// TODOS los productos. La pantalla de Productos del panel necesita además
// categoría, foto, costo, si está activo... Sin esto, sin señal se veía
// "0 productos". Son unos 150 propios: ocupa muy poco.
const CLAVE_PROPIOS = "bolsonclick_productos_propios_offline";

export async function guardarProductosPropiosOffline() {
  const { data, error } = await supabase
    .from("Productos")
    .select("*")
    .or("bajo_pedido.is.null,bajo_pedido.eq.false")
    .order("id", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  // Sin los textos del proveedor: no se muestran y duplicaban el tamaño
  const livianos = (data || []).map(({ descripcion_proveedor, nombre_proveedor, nombre_busqueda, ...p }) => p);
  guardarLocal(CLAVE_PROPIOS, livianos);
  return (data || []).length;
}

export function leerProductosPropiosOffline() {
  try {
    const g = localStorage.getItem(CLAVE_PROPIOS);
    return g ? JSON.parse(g) : [];
  } catch (e) {
    return [];
  }
}

export async function descargarDatosAdmin() {
  const resultados = { productos: 0, clientes: 0, pedidos: 0, errores: [] };

  try {
    const r = await guardarCatalogoOffline();
    resultados.productos = r.total;
  } catch (e) {
    resultados.errores.push("productos: " + e.message);
  }

  try {
    await guardarProductosPropiosOffline();
  } catch (e) {
    resultados.errores.push("tus productos: " + e.message);
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
