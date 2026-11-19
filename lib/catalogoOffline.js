// Guarda una copia del catálogo en el celular, para poder armar pedidos
// en lugares sin señal. Solo se guardan los datos mínimos necesarios
// (nombre y precio), no las fotos, así ocupa poco espacio.

import { supabase } from "@/lib/supabaseClient";
import { guardarLocal } from "@/lib/almacenLocal";
import { sincronizarPedidos, pedidosGuardados, fechaPedidosGuardados } from "@/lib/pedidosSync";
import { sincronizarClientes } from "@/lib/clientesSync";

import { sincronizarProductos, productosEnMemoria, propiosEnMemoria } from "@/lib/productosSync";
const CLAVE_CATALOGO = "bolsonclick_catalogo_offline";
const CLAVE_FECHA = "bolsonclick_catalogo_fecha";
const CLAVE_CLIENTES = "bolsonclick_clientes_offline";
const CLAVE_PEDIDOS = "bolsonclick_pedidos_offline";
const TANDA = 1000;

// Baja el catálogo completo y lo guarda en el celular.
// El catálogo ahora vive en la base del celular y baja solo lo que cambió
// (lib/productosSync.js). Las funciones siguen con el mismo nombre.
export async function guardarCatalogoOffline() {
  const r = await sincronizarProductos();
  return { total: r.productos.length, parcial: false };
}

export function leerCatalogoOffline() {
  const enBase = productosEnMemoria();
  if (enBase) return enBase.filter((p) => p.activo !== false);
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

// Ahora se guardan en la base del celular bajando solo lo que cambió
// (lib/clientesSync.js), que también deja esta copia para la caja.
export async function guardarClientesOffline() {
  const { clientes } = await sincronizarClientes();
  return clientes.length;
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

// Ahora son asíncronas: leen de la base del celular
export async function fechaPedidosOffline() {
  return fechaPedidosGuardados();
}

export async function leerPedidosOffline() {
  return pedidosGuardados();
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
  const r = await sincronizarProductos();
  return r.productos.filter((p) => !p.bajo_pedido).length;
}

export function leerProductosPropiosOffline() {
  const enBase = propiosEnMemoria();
  if (enBase) return enBase;
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
