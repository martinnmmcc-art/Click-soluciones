// Pedidos guardados en la base del celular (lib/baseLocal.js), que se
// actualizan bajando SOLO lo que cambió.
//
// - La primera vez (y una vez por día, por las dudas) se bajan todos.
// - Después, cada actualización pide "¿qué cambió desde la última vez?":
//   pedidos nuevos, cambios de estado o de pago, productos agregados o
//   sacados, y los pedidos borrados. Es una respuesta chiquita que llega
//   aunque la señal sea mala, y gasta muchos menos datos.
// - Sin señal se usa lo guardado, con la fecha a la vista.
//
// La usan Pedidos, Ventas cerradas y Resumen por cliente: las tres pantallas
// comparten la misma copia.

import { todos, aplicarCambios, leerMeta, guardarMeta } from "@/lib/baseLocal";

const META = "pedidos";
const HORAS_REVISION_COMPLETA = 24;
// La copia que guardaba la versión anterior (en el almacenamiento chico)
const CLAVE_VIEJA = "bolsonclick_pedidos_sync";

function ordenar(lista) {
  return lista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

// Pasa una sola vez la copia de la versión anterior a la base nueva
async function migrarCopiaVieja() {
  try {
    const crudo = localStorage.getItem(CLAVE_VIEJA);
    if (!crudo) return;
    const g = JSON.parse(crudo);
    if (Array.isArray(g?.pedidos) && g.pedidos.length > 0 && !(await leerMeta(META))) {
      await aplicarCambios("pedidos", { poner: g.pedidos, reemplazarTodo: true });
      await guardarMeta(META, { hasta: g.hasta, completoEn: g.completoEn, actualizadoEn: g.actualizadoEn });
    }
    localStorage.removeItem(CLAVE_VIEJA);
  } catch (e) {}
}

// Lo guardado, sin consultar nada (para mostrar algo al instante)
export async function pedidosGuardados() {
  try {
    await migrarCopiaVieja();
    return ordenar(await todos("pedidos"));
  } catch (e) {
    return [];
  }
}

export async function fechaPedidosGuardados() {
  try {
    const m = await leerMeta(META);
    return m?.actualizadoEn ? new Date(m.actualizadoEn) : null;
  } catch (e) {
    return null;
  }
}

let enCurso = null;

// Devuelve { pedidos, copiaDe }: copiaDe es la fecha de los datos si son
// una copia guardada (sin señal o señal muy débil), o null si están al día.
export function sincronizarPedidos({ completo = false } = {}) {
  if (!enCurso) {
    enCurso = sincronizar({ completo }).finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function sincronizar({ completo }) {
  await migrarCopiaVieja();
  let meta = null;
  let locales = [];
  try {
    meta = await leerMeta(META);
    locales = await todos("pedidos");
  } catch (e) {}

  const horasDesdeCompleto = meta?.completoEn
    ? (Date.now() - new Date(meta.completoEn).getTime()) / 3600000
    : Infinity;
  const pedirTodo =
    completo || !meta?.hasta || locales.length === 0 || horasDesdeCompleto >= HORAS_REVISION_COMPLETA;

  const url = pedirTodo ? "/api/admin/pedidos" : `/api/admin/pedidos?desde=${encodeURIComponent(meta.hasta)}`;

  let res = null;
  let r = null;
  try {
    res = await fetch(url, { cache: "no-store" });
    r = await res.json();
  } catch (e) {}

  const fechaLocal = meta?.actualizadoEn ? new Date(meta.actualizadoEn) : null;

  // Sin respuesta útil (sin señal, sesión vencida...): lo guardado
  if (!res || !res.ok || !r || !Array.isArray(r.pedidos)) {
    if (locales.length > 0) return { pedidos: ordenar(locales), copiaDe: fechaLocal };
    throw new Error(r?.error || "No se pudieron cargar los pedidos");
  }

  // La lista completa pudo venir de la copia del service worker (señal muy
  // débil). Si lo guardado acá es más nuevo, se queda lo de acá.
  const fechaCopiaSW = res.headers.get("x-bc-guardado");
  if (fechaCopiaSW) {
    const fCopia = new Date(fechaCopiaSW);
    if (locales.length > 0 && fechaLocal && fechaLocal >= fCopia) {
      return { pedidos: ordenar(locales), copiaDe: fechaLocal };
    }
    return { pedidos: ordenar([...r.pedidos]), copiaDe: fCopia };
  }

  const ahora = new Date().toISOString();
  let pedidos;
  if (r.completo) {
    pedidos = ordenar([...r.pedidos]);
    try {
      await aplicarCambios("pedidos", { poner: pedidos, reemplazarTodo: true });
      await guardarMeta(META, { hasta: r.hasta, completoEn: ahora, actualizadoEn: ahora });
    } catch (e) {}
  } else {
    // Solo los cambios: se reemplazan los que cambiaron, se suman los
    // nuevos y se sacan los borrados
    const borrados = r.borrados || [];
    const mapa = new Map(locales.map((p) => [p.id, p]));
    r.pedidos.forEach((p) => mapa.set(p.id, p));
    borrados.forEach((id) => mapa.delete(id));
    pedidos = ordenar(Array.from(mapa.values()));
    try {
      await aplicarCambios("pedidos", { poner: r.pedidos, borrar: borrados });
      await guardarMeta(META, { ...meta, hasta: r.hasta, actualizadoEn: ahora });
    } catch (e) {}
  }
  return { pedidos, copiaDe: null };
}
