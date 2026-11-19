// El catálogo guardado en la base del celular, que se actualiza bajando SOLO
// lo que cambió (precio, stock, fotos, productos nuevos, dados de baja o
// borrados).
//
// Reemplaza CINCO copias que había antes, cada una por su lado y en el
// almacenamiento chico: la de la caja, la del panel, la de "mis productos",
// la de la tienda y la del catálogo del cliente.
//
// - Celular del negocio (admin): todos los productos. Los "a pedido" sin
//   descripción, para que pese poco.
// - Celular de un cliente: solo los productos propios (los que se entregan
//   al momento).
//
// Las pantallas leen de una copia en memoria (productosEnMemoria) que se
// carga de la base del celular apenas abre la app: así se puede leer al
// instante, sin esperar.

import { supabase } from "@/lib/supabaseClient";
import { todos, aplicarCambios, leerMeta, guardarMeta } from "@/lib/baseLocal";
import { correoGuardado } from "@/lib/sesionGuardada";

const META = "productos";
const HORAS_REVISION_COMPLETA = 24;
export const EVENTO_PRODUCTOS = "bolsonclick:productos";

const CAMPOS_BASE =
  "id, nombre, precio, precio_oferta, stock, bajo_pedido, categoria, imagen_url, imagen_url_2, " +
  "codigo_barras, video_url, actualizado_en, activo, created_at, sin_stock_proveedor, destacado, fecha_ingreso";
const CAMPOS_PROPIOS = CAMPOS_BASE + ", descripcion, caracteristicas, accesorios";
const CAMPOS_ADMIN = CAMPOS_PROPIOS + ", costo, precio_manual, stock_minimo, proveedor";
const CAMPOS_A_PEDIDO = CAMPOS_BASE;
const TANDA = 1000;

// Las copias de antes (almacenamiento chico): se borran cuando la base
// nueva ya tiene los productos, así se libera ese lugar
const COPIAS_VIEJAS = [
  "bolsonclick_caja_catalogo",
  "bolsonclick_catalogo_offline",
  "bolsonclick_productos_propios_offline",
  "bolsonclick_copia_tienda",
  "bolsonclick_catalogo_cliente",
  "bolsonclick_offline_datos"
];

function esAdmin() {
  return !!correoGuardado();
}

// ---------- copia en memoria ----------
let memoria = null; // Map id → producto, o null si todavía no cargó
let cargando = null;

function avisar(detalle) {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_PRODUCTOS, { detail: detalle }));
  } catch (e) {}
}

// Carga la base del celular en memoria (una sola vez)
export function cargarProductosGuardados() {
  if (memoria) return Promise.resolve(memoria);
  if (!cargando) {
    cargando = todos("productos")
      .then((lista) => {
        memoria = new Map(lista.map((p) => [p.id, p]));
        avisar({ cargado: true });
        return memoria;
      })
      .catch(() => {
        memoria = new Map();
        return memoria;
      });
  }
  return cargando;
}

// Lista sincrónica, al instante. null si la base todavía no cargó (las
// funciones viejas usan entonces su copia anterior).
export function productosEnMemoria() {
  if (typeof window !== "undefined" && !memoria) cargarProductosGuardados();
  return memoria && memoria.size > 0 ? Array.from(memoria.values()) : null;
}

export function propiosEnMemoria() {
  const l = productosEnMemoria();
  return l ? l.filter((p) => !p.bajo_pedido && p.activo !== false) : null;
}

// La caja descuenta stock sin señal: se refleja en la copia (el servidor
// descuenta el real al mandar la venta)
export async function descontarStockLocal(porId) {
  await cargarProductosGuardados();
  const cambiados = [];
  for (const [id, cant] of Object.entries(porId)) {
    const p = memoria.get(Number(id)) || memoria.get(id);
    if (!p) continue;
    const nuevo = { ...p, stock: Math.max(Number(p.stock || 0) - cant, 0) };
    memoria.set(p.id, nuevo);
    cambiados.push(nuevo);
  }
  if (cambiados.length) {
    aplicarCambios("productos", { poner: cambiados }).catch(() => {});
    avisar({ cambios: cambiados.length });
  }
}

// ---------- sincronización ----------
async function traerTodo(consultaBase) {
  let todosLos = [];
  for (let desde = 0; desde < 30000; desde += TANDA) {
    const { data, error } = await consultaBase().range(desde, desde + TANDA - 1);
    if (error) throw error;
    todosLos = todosLos.concat(data || []);
    if (!data || data.length < TANDA) break;
  }
  return todosLos;
}

function masNuevo(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

let enCurso = null;

// Devuelve { productos, cambios, nuevos, precios, sinStock, copiaDe }
export function sincronizarProductos({ completo = false } = {}) {
  if (!enCurso) {
    enCurso = sincronizar({ completo }).finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function sincronizar({ completo }) {
  await cargarProductosGuardados();
  const modo = esAdmin() ? "admin" : "cliente";
  let meta = null;
  try {
    meta = await leerMeta(META);
  } catch (e) {}

  const horas = meta?.completoEn ? (Date.now() - new Date(meta.completoEn).getTime()) / 3600000 : Infinity;
  const pedirTodo =
    completo || !meta?.hasta || meta.modo !== modo || memoria.size === 0 || horas >= HORAS_REVISION_COMPLETA;
  const ahora = new Date().toISOString();

  if (pedirTodo) {
    const camposPropios = modo === "admin" ? CAMPOS_ADMIN : CAMPOS_PROPIOS;
    const propios = await traerTodo(() =>
      supabase
        .from("Productos")
        .select(camposPropios)
        .eq("activo", true)
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .order("id", { ascending: true })
    );
    const aPedido =
      modo === "admin"
        ? await traerTodo(() =>
            supabase
              .from("Productos")
              .select(CAMPOS_A_PEDIDO)
              .eq("activo", true)
              .eq("bajo_pedido", true)
              .order("id", { ascending: true })
          )
        : [];
    const lista = propios.concat(aPedido);
    if (lista.length === 0) throw new Error("No llegaron productos");

    const { data: ult } = await supabase
      .from("registros_borrados")
      .select("borrado_en")
      .eq("tabla", "Productos")
      .order("borrado_en", { ascending: false })
      .limit(1);

    const previos = memoria;
    const resumen = { cambios: 0, nuevos: 0, precios: 0, sinStock: 0 };
    for (const p of lista) {
      const ant = previos.get(p.id);
      if (!ant) resumen.nuevos++;
      else if (Number(ant.precio) !== Number(p.precio)) resumen.precios++;
      if (ant && Number(ant.stock || 0) > 0 && Number(p.stock || 0) <= 0) resumen.sinStock++;
    }
    resumen.cambios = previos.size ? resumen.nuevos + resumen.precios : 0;

    memoria = new Map(lista.map((p) => [p.id, p]));
    try {
      await aplicarCambios("productos", { poner: lista, reemplazarTodo: true });
      await guardarMeta(META, {
        modo,
        hasta: lista.reduce((m, p) => masNuevo(m, p.actualizado_en), null),
        hastaBorrados: ult?.[0]?.borrado_en || ahora,
        completoEn: ahora,
        actualizadoEn: ahora
      });
      liberarCopiasViejas();
    } catch (e) {}
    avisar(resumen);
    return { productos: lista, ...resumen, copiaDe: null };
  }

  // Solo lo que cambió (incluye los dados de baja: vienen con activo=false)
  const campos = modo === "admin" ? CAMPOS_ADMIN : CAMPOS_PROPIOS;
  const cambiados = await traerTodo(() => {
    let q = supabase.from("Productos").select(campos).gt("actualizado_en", meta.hasta).order("id", { ascending: true });
    if (modo === "cliente") q = q.or("bajo_pedido.is.null,bajo_pedido.eq.false");
    return q;
  });
  const { data: borr, error: errBorr } = await supabase
    .from("registros_borrados")
    .select("registro_id, borrado_en")
    .eq("tabla", "Productos")
    .gt("borrado_en", meta.hastaBorrados || meta.hasta);
  if (errBorr) throw errBorr;

  const resumen = { cambios: 0, nuevos: 0, precios: 0, sinStock: 0 };
  const poner = [];
  const sacar = [];
  for (const p of cambiados) {
    const ant = memoria.get(p.id);
    const fuera = p.activo === false || (modo === "cliente" && p.bajo_pedido);
    if (fuera) {
      if (ant) {
        sacar.push(p.id);
        memoria.delete(p.id);
        resumen.cambios++;
      }
      continue;
    }
    // Los "a pedido" se guardan sin descripción (pesan menos)
    const fila = modo === "admin" && p.bajo_pedido ? { ...p, descripcion: null, caracteristicas: null, accesorios: null } : p;
    if (!ant) resumen.nuevos++;
    else if (Number(ant.precio) !== Number(p.precio)) resumen.precios++;
    if (ant && Number(ant.stock || 0) > 0 && Number(p.stock || 0) <= 0) resumen.sinStock++;
    memoria.set(p.id, fila);
    poner.push(fila);
    resumen.cambios++;
  }
  for (const b of borr || []) {
    if (memoria.has(b.registro_id)) {
      memoria.delete(b.registro_id);
      sacar.push(b.registro_id);
      resumen.cambios++;
    }
  }

  try {
    await aplicarCambios("productos", { poner, borrar: sacar });
    await guardarMeta(META, {
      ...meta,
      hasta: cambiados.reduce((m, p) => masNuevo(m, p.actualizado_en), meta.hasta),
      hastaBorrados: (borr || []).reduce((m, b) => masNuevo(m, b.borrado_en), meta.hastaBorrados),
      actualizadoEn: ahora
    });
  } catch (e) {}
  if (resumen.cambios) avisar(resumen);
  return { productos: Array.from(memoria.values()), ...resumen, copiaDe: null };
}

function liberarCopiasViejas() {
  try {
    COPIAS_VIEJAS.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

export async function fechaProductosGuardados() {
  try {
    const m = await leerMeta(META);
    return m?.actualizadoEn ? new Date(m.actualizadoEn) : null;
  } catch (e) {
    return null;
  }
}
