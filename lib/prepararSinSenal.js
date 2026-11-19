// Dejar la app lista para trabajar sin señal, SOLA.
//
// Dos niveles, porque no todo cambia igual de seguido:
//  - actualizarDatos(): productos, clientes y pedidos, a la base del
//    celular. Baja solo lo que cambió, así que es liviano: cada 15 minutos.
//  - guardarPantallas(): guarda el "esqueleto" de cada pantalla del panel
//    (la página y el código que necesita) para poder abrirla sin señal
//    aunque nunca la hayas abierto. Solo UNA vez por versión de la app:
//    si no se subió nada nuevo, no baja nada.
//
// Antes, para esto, se abrían las 37 pantallas una por una en una ventana
// invisible cada 6 horas. Cada una leía todos sus datos: muchos megas y
// mucha batería para guardar copias que casi nunca se usaban. Ahora los
// datos de cada pantalla se guardan cuando la abrís (el service worker se
// queda con la última copia) y los importantes (productos, clientes,
// pedidos, caja) están siempre en la base del celular.
//
// La lista de pantallas sale sola del código (scripts/generar-rutas.js).

import { catalogoLocal, ventasPendientes } from "@/lib/cajaOffline";
import { guardarClientesOffline, guardarPedidosOffline } from "@/lib/catalogoOffline";
import { RUTAS_SIN_SENAL } from "@/lib/rutasSinSenal";
import { sincronizarProductos } from "@/lib/productosSync";

const CLAVE_DATOS = "bolsonclick_sin_senal_datos";
const CLAVE_PANTALLAS = "bolsonclick_sin_senal_pantallas";
// Qué versión de la app quedó guardada (las direcciones del código de
// Next cambian con cada versión subida)
const CLAVE_VERSION = "bolsonclick_sin_senal_version";
// El mismo almacenamiento de páginas que usa el service worker (public/sw.js)
const CACHE_APP = "bolsonclick-paginas-v11";
const A_LA_VEZ = 3;

export const PANTALLAS = RUTAS_SIN_SENAL;

function marcar(clave, valor = new Date().toISOString()) {
  try {
    localStorage.setItem(clave, valor);
  } catch (e) {}
}

function leer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch (e) {
    return null;
  }
}

function leerFecha(clave) {
  const f = leer(clave);
  return f ? new Date(f) : null;
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

  onPaso("Actualizando productos...");
  try {
    // Base del celular: baja solo lo que cambió
    const res = await sincronizarProductos();
    r.productos = res.productos.filter((p) => !p.bajo_pedido).length;
  } catch (e) {
    r.errores.push("productos");
  }

  onPaso("Actualizando clientes...");
  try {
    r.clientes = await guardarClientesOffline();
  } catch (e) {
    r.errores.push("clientes");
  }

  onPaso("Actualizando pedidos...");
  try {
    r.pedidos = await guardarPedidosOffline();
  } catch (e) {
    r.errores.push("pedidos");
  }

  // Se anota la hora si se guardó lo principal (los productos): una falla
  // chica no deja la barra en "datos de nunca".
  if (r.productos > 0) marcar(CLAVE_DATOS);
  avisar();
  return r;
}

// ---------- PANTALLAS (una vez por versión de la app) ----------

// Las direcciones del código (/_next/static/...) que pide una página
function codigoDePagina(html) {
  const archivos = new Set();
  const re = /(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g;
  let m;
  while ((m = re.exec(html))) archivos.add(m[1]);
  return archivos;
}

// Huella de la versión: las direcciones del código cambian con cada versión
function huella(archivos) {
  const texto = [...archivos].sort().join("|");
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return `${CACHE_APP}:${texto.length}:${h}`;
}

// Guarda la respuesta con la fecha, igual que hace el service worker
async function guardar(cache, clave, res) {
  const cabeceras = new Headers(res.headers);
  cabeceras.set("x-bc-guardado", new Date().toISOString());
  const cuerpo = await res.blob();
  await cache.put(clave, new Response(cuerpo, { status: res.status, statusText: res.statusText, headers: cabeceras }));
}

// Hace una lista de tareas de a pocas por vez (no satura la señal)
async function deAPocas(lista, tarea, cancelado) {
  let i = 0;
  async function trabajador() {
    while (i < lista.length && !cancelado() && navigator.onLine) {
      const actual = lista[i++];
      try {
        await tarea(actual);
      } catch (e) {}
    }
  }
  await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador));
}

export async function guardarPantallas(onPaso = () => {}, { forzar = false, cancelado = () => false } = {}) {
  if (!navigator.onLine) return { pantallas: 0, total: PANTALLAS.length, salteado: true };

  let cache;
  try {
    cache = await caches.open(CACHE_APP);
  } catch (e) {
    return { pantallas: 0, total: PANTALLAS.length, salteado: true };
  }

  // 1) ¿Cambió la versión? Una sola página alcanza para saberlo
  let huellaNueva = null;
  try {
    const res = await fetch("/admin", { cache: "no-store" });
    if (res.ok) huellaNueva = huella(codigoDePagina(await res.text()));
  } catch (e) {}
  if (!huellaNueva) return { pantallas: 0, total: PANTALLAS.length, salteado: true };

  const yaEstaba = !!(await cache.match("/admin"));
  if (!forzar && yaEstaba && leer(CLAVE_VERSION) === huellaNueva) {
    marcar(CLAVE_PANTALLAS);
    avisar();
    return { pantallas: PANTALLAS.length, total: PANTALLAS.length, salteado: true };
  }

  // 2) Versión nueva: la página y su versión interna, de cada pantalla
  const codigo = new Set();
  let listas = 0;
  let hechas = 0;
  await deAPocas(
    PANTALLAS,
    async (ruta) => {
      const pagina = await fetch(ruta, { cache: "no-store" });
      if (pagina.ok) {
        const html = await pagina.clone().text();
        for (const a of codigoDePagina(html)) codigo.add(a);
        await guardar(cache, ruta, pagina);
        listas++;
      }
      const interna = await fetch(ruta, { headers: { RSC: "1" }, cache: "no-store" });
      if (interna.ok) await guardar(cache, ruta + "?_rsc=1", interna);
      hechas++;
      onPaso(`Guardando pantallas... ${hechas} de ${PANTALLAS.length}`);
    },
    cancelado
  );

  // 3) El código que usan. Pasa por el service worker, que lo guarda solo
  //    (y si ya lo tenía, no lo vuelve a bajar)
  const archivos = [...codigo];
  let bajados = 0;
  await deAPocas(
    archivos,
    async (a) => {
      await fetch(a);
      bajados++;
      if (bajados % 10 === 0) onPaso(`Guardando el programa... ${bajados} de ${archivos.length}`);
    },
    cancelado
  );

  const completo = !cancelado() && listas === PANTALLAS.length;
  if (listas > 0) marcar(CLAVE_PANTALLAS);
  // La versión se anota solo si quedó todo: si se cortó, se completa la próxima
  if (completo) marcar(CLAVE_VERSION, huellaNueva);
  avisar();
  return { pantallas: listas, total: PANTALLAS.length, salteado: false };
}

// Nombre anterior (por si algo lo sigue llamando)
export const precargarPantallas = (onPaso, op = {}) => guardarPantallas(onPaso, op);

// Todo junto (el botón de la barra, por si querés forzarlo)
export async function prepararSinSenal(onPaso = () => {}) {
  const datos = await actualizarDatos(onPaso);
  const p = await guardarPantallas(onPaso, { forzar: true });
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
    // Al día: datos de menos de una hora y pantallas guardadas alguna vez
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
