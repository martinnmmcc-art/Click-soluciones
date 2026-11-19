// Pedidos guardados en el celular, que se actualizan bajando SOLO lo que
// cambió.
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

import { guardarLocal } from "@/lib/almacenLocal";

const CLAVE = "bolsonclick_pedidos_sync";
const HORAS_REVISION_COMPLETA = 24;

function leer() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    return g && Array.isArray(g.pedidos) ? g : null;
  } catch (e) {
    return null;
  }
}

function ordenar(lista) {
  return lista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

// Lo guardado, sin consultar nada (para mostrar algo al instante)
export function pedidosGuardados() {
  return leer()?.pedidos || [];
}

export function fechaPedidosGuardados() {
  const g = leer();
  return g?.actualizadoEn ? new Date(g.actualizadoEn) : null;
}

// Si una pantalla cambia un pedido (pago, entrega...), se anota acá también,
// así las otras pantallas lo ven aunque todavía no haya pasado la próxima
// actualización.
export function anotarPedidoLocal(pedido) {
  const g = leer();
  if (!g || !pedido?.id) return;
  const i = g.pedidos.findIndex((p) => p.id === pedido.id);
  if (i >= 0) g.pedidos[i] = { ...g.pedidos[i], ...pedido };
  else g.pedidos.unshift(pedido);
  guardarLocal(CLAVE, g);
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
  const local = leer();
  const horasDesdeCompleto = local?.completoEn
    ? (Date.now() - new Date(local.completoEn).getTime()) / 3600000
    : Infinity;
  const pedirTodo = completo || !local || !local.hasta || horasDesdeCompleto >= HORAS_REVISION_COMPLETA;

  const url = pedirTodo
    ? "/api/admin/pedidos"
    : `/api/admin/pedidos?desde=${encodeURIComponent(local.hasta)}`;

  let res;
  let r;
  try {
    res = await fetch(url, { cache: "no-store" });
    r = await res.json();
  } catch (e) {
    r = null;
  }

  // Sin respuesta útil (sin señal, sesión vencida...): lo guardado
  if (!res || !res.ok || !r || !Array.isArray(r.pedidos)) {
    if (local) return { pedidos: local.pedidos, copiaDe: fechaPedidosGuardados() };
    throw new Error(r?.error || "No se pudieron cargar los pedidos");
  }

  // La lista completa pudo venir de la copia del service worker (señal muy
  // débil). Si lo guardado acá es más nuevo, se queda lo de acá.
  const fechaCopiaSW = res.headers.get("x-bc-guardado");
  if (fechaCopiaSW) {
    const fCopia = new Date(fechaCopiaSW);
    const fLocal = fechaPedidosGuardados();
    if (local && fLocal && fLocal >= fCopia) return { pedidos: local.pedidos, copiaDe: fLocal };
    return { pedidos: ordenar([...r.pedidos]), copiaDe: fCopia };
  }

  const ahora = new Date().toISOString();
  let pedidos;
  if (r.completo) {
    pedidos = ordenar([...r.pedidos]);
    guardarLocal(CLAVE, { pedidos, hasta: r.hasta, completoEn: ahora, actualizadoEn: ahora });
  } else {
    // Solo los cambios: se reemplazan los que cambiaron, se suman los
    // nuevos y se sacan los borrados
    const mapa = new Map(local.pedidos.map((p) => [p.id, p]));
    r.pedidos.forEach((p) => mapa.set(p.id, p));
    (r.borrados || []).forEach((id) => mapa.delete(id));
    pedidos = ordenar(Array.from(mapa.values()));
    guardarLocal(CLAVE, { ...local, pedidos, hasta: r.hasta, actualizadoEn: ahora });
  }
  return { pedidos, copiaDe: null };
}
