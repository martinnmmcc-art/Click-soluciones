// Dejar la app lista para trabajar sin señal, SOLA.
//
// Dos niveles, porque no todo cambia igual de seguido:
//  - actualizarDatos(): productos para la caja, catálogo, clientes y pedidos
//    abiertos. Liviano: se hace cada 15 minutos.
//  - precargarPantallas(): recorre TODAS las pantallas del panel en una
//    ventana invisible. Cada pantalla, al cargarse, lee sus propios datos
//    (cupones, gastos, opiniones...) y el service worker los guarda. Así
//    hasta las pantallas que no abriste quedan listas sin señal. Más pesado:
//    cada 6 horas y cada vez que se sube una versión nueva de la app.
//
// La lista de pantallas sale sola del código (scripts/generar-rutas.js).

import { supabase } from "@/lib/supabaseClient";
import { guardarCatalogo, catalogoLocal, ventasPendientes } from "@/lib/cajaOffline";
import { descargarDatosAdmin } from "@/lib/catalogoOffline";
import { RUTAS_SIN_SENAL } from "@/lib/rutasSinSenal";

const CLAVE_DATOS = "bolsonclick_sin_senal_datos";
const CLAVE_PANTALLAS = "bolsonclick_sin_senal_pantallas";
// El mismo almacenamiento que usa el service worker (public/sw.js)
const CACHE_APP = "bolsonclick-app-v10";

export const PANTALLAS = RUTAS_SIN_SENAL;

function marcar(clave) {
  try {
    localStorage.setItem(clave, new Date().toISOString());
  } catch (e) {}
}

function leerFecha(clave) {
  try {
    const f = localStorage.getItem(clave);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

export function minutosDesde(clave) {
  const f = leerFecha(clave);
  return f ? (Date.now() - f.getTime()) / 60000 : Infinity;
}
export const CLAVES = { datos: CLAVE_DATOS, pantallas: CLAVE_PANTALLAS };

function avisar() {
  window.dispatchEvent(new CustomEvent("sin-senal-actualizado"));
}

// ---------- DATOS (cada 15 minutos) ----------
export async function actualizarDatos(onPaso = () => {}) {
  const r = { productos: 0, clientes: 0, pedidos: 0, errores: [] };

  onPaso("Guardando productos para la caja...");
  try {
    const { data, error } = await supabase
      .from("Productos")
      .select("id, nombre, precio, precio_oferta, stock, codigo_barras, bajo_pedido")
      .or("bajo_pedido.is.null,bajo_pedido.eq.false")
      .eq("activo", true);
    if (error) throw new Error(error.message);
    r.productos = guardarCatalogo(data || []);
  } catch (e) {
    r.errores.push("productos de la caja");
  }

  onPaso("Guardando clientes y pedidos...");
  try {
    const d = await descargarDatosAdmin();
    r.clientes = d.clientes;
    r.pedidos = d.pedidos;
    if (d.errores?.length) r.errores.push(...d.errores);
  } catch (e) {
    r.errores.push("clientes y pedidos");
  }

  if (r.errores.length === 0) marcar(CLAVE_DATOS);
  avisar();
  return r;
}

// Carga una pantalla en una ventana invisible y espera a que lea sus datos.
// "sandbox" sin permisos de avisos ni ventanas: si alguna pantalla intenta
// mostrar un cartel o abrir algo, no molesta.
function visitar(ruta, espera = 3500, maximo = 15000) {
  return new Promise((resolve) => {
    const marco = document.createElement("iframe");
    marco.setAttribute("sandbox", "allow-scripts allow-same-origin");
    marco.setAttribute("aria-hidden", "true");
    marco.tabIndex = -1;
    marco.style.cssText =
      "position:fixed;width:390px;height:844px;left:-10000px;top:0;opacity:0;pointer-events:none;border:0;";

    let terminado = false;
    const terminar = (ok) => {
      if (terminado) return;
      terminado = true;
      try {
        marco.remove();
      } catch (e) {}
      resolve(ok);
    };

    // Después de cargar, le damos unos segundos para que lea sus datos
    marco.onload = () => setTimeout(() => terminar(true), espera);
    setTimeout(() => terminar(false), maximo);

    marco.src = ruta;
    document.body.appendChild(marco);
  });
}

// ---------- PANTALLAS (cada 6 horas y con cada versión nueva) ----------
export async function precargarPantallas(onPaso = () => {}, { cancelado = () => false } = {}) {
  let listas = 0;
  let cache = null;
  try {
    cache = await caches.open(CACHE_APP);
  } catch (e) {}

  for (let i = 0; i < PANTALLAS.length; i++) {
    if (cancelado() || !navigator.onLine) break;
    const ruta = PANTALLAS[i];
    onPaso(`Guardando pantallas... ${i + 1} de ${PANTALLAS.length}`);

    // La versión que pide la app al navegar por dentro
    try {
      const interna = await fetch(ruta, { headers: { RSC: "1" } });
      if (interna.ok && cache) await cache.put(ruta + "?_rsc=1", interna.clone());
    } catch (e) {}

    // La pantalla completa, con todos sus datos
    if (await visitar(ruta)) listas++;
  }

  if (!cancelado() && listas > 0) marcar(CLAVE_PANTALLAS);
  avisar();
  return { pantallas: listas, total: PANTALLAS.length };
}

// Todo junto (el botón de la barra, por si querés forzarlo)
export async function prepararSinSenal(onPaso = () => {}) {
  const datos = await actualizarDatos(onPaso);
  const p = await precargarPantallas(onPaso);
  return { ...datos, pantallas: p.pantallas };
}

// Estado para mostrar en la barra
export function estadoSinSenal() {
  const datos = leerFecha(CLAVE_DATOS);
  const pantallas = leerFecha(CLAVE_PANTALLAS);
  const minDatos = datos ? (Date.now() - datos.getTime()) / 60000 : Infinity;
  return {
    fecha: datos,
    fechaPantallas: pantallas,
    // Al día: datos de menos de una hora y pantallas recorridas alguna vez
    alDia: minDatos < 60 && !!pantallas,
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
