// Dejar la app lista para trabajar sin señal, con UN solo botón.
//
// Antes había tres botones distintos en pantallas distintas, y cada uno
// guardaba una parte (el del panel: productos de la caja y pantallas; el
// de Pedidos: clientes y pedidos; el de "Usar la app sin internet": el
// catálogo). Para salir tranquilo había que acordarse de tocar los tres.

import { supabase } from "@/lib/supabaseClient";
import { guardarCatalogo, catalogoLocal, ventasPendientes } from "@/lib/cajaOffline";
import { descargarDatosAdmin } from "@/lib/catalogoOffline";

const CLAVE_LISTO = "bolsonclick_listo_sin_senal";
// El mismo almacenamiento que usa el service worker (public/sw.js)
const CACHE_APP = "bolsonclick-app-v10";

export const PANTALLAS = [
  "/", "/admin", "/admin/caja", "/admin/pedidos", "/admin/productos",
  "/admin/clientes", "/admin/ventas-cerradas", "/admin/resumen-clientes",
  "/admin/balance", "/admin/ofertas", "/admin/cupones", "/admin/resenas",
  "/admin/oportunidades", "/admin/fotos", "/admin/promocionar",
  "/admin/pedido-proveedor", "/catalogo", "/carrito", "/login"
];

// onPaso(texto): para ir mostrando en qué anda
export async function prepararSinSenal(onPaso = () => {}) {
  const resultado = { productos: 0, clientes: 0, pedidos: 0, pantallas: 0, errores: [] };

  // 1. Productos propios, para la Caja (cobrar escaneando sin señal)
  onPaso("Guardando productos para la caja...");
  try {
    const { data, error } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, stock, codigo_barras, bajo_pedido")
      .or("bajo_pedido.is.null,bajo_pedido.eq.false")
      .eq("activo", true);
    if (error) throw new Error(error.message);
    resultado.productos = guardarCatalogo(data || []);
  } catch (e) {
    resultado.errores.push("productos de la caja");
  }

  // 2. Catálogo, clientes y pedidos abiertos (para armar y modificar pedidos)
  onPaso("Guardando clientes y pedidos...");
  try {
    const r = await descargarDatosAdmin();
    resultado.clientes = r.clientes;
    resultado.pedidos = r.pedidos;
    if (r.errores?.length) resultado.errores.push(...r.errores);
  } catch (e) {
    resultado.errores.push("clientes y pedidos");
  }

  // 3. Las pantallas, en las dos formas en que las pide la app
  onPaso("Guardando pantallas...");
  try {
    const cache = await caches.open(CACHE_APP);
    for (let i = 0; i < PANTALLAS.length; i++) {
      const ruta = PANTALLAS[i];
      onPaso(`Guardando pantallas... ${i + 1} de ${PANTALLAS.length}`);
      try {
        const pagina = await fetch(ruta);
        if (pagina.ok) await cache.put(ruta, pagina.clone());
        const interna = await fetch(ruta, { headers: { RSC: "1" } });
        if (interna.ok) await cache.put(ruta + "?_rsc=1", interna.clone());
        resultado.pantallas++;
      } catch (e) {}
    }
  } catch (e) {
    resultado.errores.push("pantallas");
  }

  try {
    localStorage.setItem(CLAVE_LISTO, new Date().toISOString());
  } catch (e) {}
  window.dispatchEvent(new CustomEvent("sin-senal-actualizado"));

  return resultado;
}

// Cuándo se preparó por última vez y qué hay guardado
export function estadoSinSenal() {
  let fecha = null;
  try {
    const f = localStorage.getItem(CLAVE_LISTO);
    if (f) fecha = new Date(f);
  } catch (e) {}
  const horas = fecha ? (Date.now() - fecha.getTime()) / 36e5 : Infinity;
  return {
    fecha,
    horas,
    // Con más de un día, conviene volver a preparar antes de salir
    alDia: horas < 24,
    productos: catalogoLocal().length,
    pendientes: ventasPendientes().length
  };
}

export function haceCuanto(fecha) {
  if (!fecha) return "nunca";
  const min = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}
