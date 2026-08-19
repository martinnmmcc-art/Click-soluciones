// Guarda una copia del catálogo en el celular, para poder armar pedidos
// en lugares sin señal. Solo se guardan los datos mínimos necesarios
// (nombre y precio), no las fotos, así ocupa poco espacio.

import { supabase } from "@/lib/supabaseClient";

const CLAVE_CATALOGO = "bolsonclick_catalogo_offline";
const CLAVE_FECHA = "bolsonclick_catalogo_fecha";
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
