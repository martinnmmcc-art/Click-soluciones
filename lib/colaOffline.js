// UNA sola cola para todo lo que se hace sin señal: ventas de la caja,
// pedidos nuevos, cambios de estado o de pago, productos agregados a un
// pedido. Antes había tres colas separadas que se mandaban cada una por su
// lado.
//
// - Se manda en orden (lo primero que hiciste, primero): si armaste un
//   pedido y después le cambiaste el pago, llegan en ese orden.
// - Cada cosa lleva una clave única: si se manda dos veces (la señal se
//   cortó justo después de que el servidor la guardó), el servidor la
//   reconoce y NO duplica la venta.
// - Si el servidor la rechaza (por ejemplo, un pedido que ya no existe),
//   NO se borra: queda marcada "con problema" para que la veas en el Panel
//   y decidas. Antes, los pedidos rechazados se descartaban en silencio.
//
// Vive en el almacenamiento rápido del celular (se lee al instante, sin
// esperar): son pocas cosas y nunca se sacrifican por falta de lugar.

import { supabase } from "@/lib/supabaseClient";
import { guardarLocal } from "@/lib/almacenLocal";

const CLAVE = "bolsonclick_cola";
export const EVENTO_COLA = "bolsonclick:cola";

// Las colas de antes, que se pasan una sola vez a esta
const VIEJAS = {
  ventas: "bolsonclick_caja_cola",
  cambios: "bolsonclick_caja_cambios",
  pedidos: "bolsonclick_pedidos_pendientes"
};

function nuevaClave(prefijo) {
  const azar =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefijo}-${azar}`;
}

function leerJSON(clave) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

function avisar() {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_COLA));
  } catch (e) {}
}

let migrada = false;
function migrar() {
  if (migrada) return;
  migrada = true;
  try {
    const cola = leerJSON(CLAVE) || [];
    let cambio = false;
    for (const v of leerJSON(VIEJAS.ventas) || []) {
      const { id_local, creada_en, ...datos } = v;
      cola.push({ clave: id_local || nuevaClave("v"), tipo: "venta_caja", datos, creada_en: creada_en || new Date().toISOString() });
      cambio = true;
    }
    for (const c of leerJSON(VIEJAS.cambios) || []) {
      const { id_local, creado_en, tipo, ...resto } = c;
      cola.push({
        clave: id_local || nuevaClave("c"),
        tipo: tipo === "agregar_items" ? "agregar_items" : "cambio_estado",
        datos: resto,
        creada_en: creado_en || new Date().toISOString()
      });
      cambio = true;
    }
    for (const p of leerJSON(VIEJAS.pedidos) || []) {
      const { _id_local, _creado_en, ...datos } = p;
      cola.push({ clave: _id_local || nuevaClave("p"), tipo: "pedido_nuevo", datos, creada_en: _creado_en || new Date().toISOString() });
      cambio = true;
    }
    if (cambio) {
      cola.sort((a, b) => new Date(a.creada_en) - new Date(b.creada_en));
      if (guardarLocal(CLAVE, cola)) {
        Object.values(VIEJAS).forEach((k) => localStorage.removeItem(k));
      }
    }
  } catch (e) {}
}

export function leerCola() {
  migrar();
  return leerJSON(CLAVE) || [];
}

function escribir(cola) {
  guardarLocal(CLAVE, cola);
  avisar();
}

// tipo: "venta_caja" | "pedido_nuevo" | "cambio_estado" | "agregar_items"
export function encolar(tipo, datos) {
  const registro = {
    clave: nuevaClave(tipo.slice(0, 1)),
    tipo,
    datos,
    creada_en: new Date().toISOString()
  };
  const cola = leerCola();
  cola.push(registro);
  escribir(cola);
  return registro;
}

// Lo que espera enviarse (sin contar lo que tuvo problemas)
export function pendientes(tipo) {
  return leerCola().filter((r) => !r.problema && (!tipo || r.tipo === tipo));
}

export function conProblemas() {
  return leerCola().filter((r) => r.problema);
}

export function cantidadPendiente() {
  return pendientes().length;
}

function quitar(clave) {
  escribir(leerCola().filter((r) => r.clave !== clave));
}

function marcarProblema(clave, mensaje) {
  escribir(leerCola().map((r) => (r.clave === clave ? { ...r, problema: mensaje || "El servidor no lo aceptó" } : r)));
}

// Lo que tuvo problema: reintentar o descartar a mano
export function reintentar(clave) {
  escribir(leerCola().map((r) => (r.clave === clave ? { ...r, problema: null } : r)));
}
export function descartar(clave) {
  quitar(clave);
}

export function editarEnCola(clave, cambios) {
  escribir(leerCola().map((r) => (r.clave === clave ? { ...r, datos: { ...r.datos, ...cambios } } : r)));
}

function sinSenal() {
  try {
    return navigator.onLine === false;
  } catch (e) {
    return false;
  }
}

// ¿Error de red (reintentar más tarde) o rechazo del servidor (problema)?
function esErrorDeRed(e) {
  const m = String(e?.message || e || "");
  // La sesión vencida tampoco es un rechazo: se reintenta al volver a entrar
  return /Failed to fetch|NetworkError|Load failed|SIN_SENAL|Sin señal|network|timeout|NO_AUTORIZADO|JWT|PGRST301/i.test(m);
}

async function enviarUno(r) {
  const d = r.datos || {};
  if (r.tipo === "venta_caja") {
    const { error } = await supabase.rpc("venta_caja_offline", {
      p_clave: r.clave,
      p_items: d.items,
      p_metodo_pago: d.metodo_pago,
      p_total: d.total,
      p_pagado: d.pagado ?? d.total,
      p_nombre_cliente: d.nombre_cliente || null,
      p_telefono: d.telefono || null
    });
    if (error) throw error;
    return;
  }
  if (r.tipo === "agregar_items") {
    const { error } = await supabase.rpc("agregar_items_pedido_offline", {
      p_clave: r.clave,
      p_pedido_id: d.pedido_id,
      p_items: d.items
    });
    if (error) throw error;
    return;
  }
  if (r.tipo === "cambio_estado") {
    // Poner el mismo estado dos veces no hace daño: no hace falta clave
    const res = await fetch("/api/admin/pedidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.pedido_id, ...(d.campos || {}) })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const err = new Error(j.error || `El servidor contestó ${res.status}`);
      err.rechazo = res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408;
      throw err;
    }
    return;
  }
  if (r.tipo === "pedido_nuevo") {
    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, clave_offline: r.clave })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const err = new Error(j.error || `El servidor contestó ${res.status}`);
      err.rechazo = res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408;
      throw err;
    }
    return;
  }
  const err = new Error("Tipo desconocido: " + r.tipo);
  err.rechazo = true;
  throw err;
}

let enCurso = null;

// Manda todo lo pendiente, en orden. Devuelve cuántos salieron por tipo.
export function enviarCola() {
  if (!enCurso) {
    enCurso = enviar().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function enviar() {
  const resultado = { enviados: 0, ventas: 0, pedidos: 0, cambios: 0, problemas: 0, quedan: 0 };
  if (sinSenal()) {
    resultado.quedan = cantidadPendiente();
    return resultado;
  }
  for (const r of pendientes()) {
    try {
      await enviarUno(r);
      quitar(r.clave);
      resultado.enviados++;
      if (r.tipo === "venta_caja") resultado.ventas++;
      else if (r.tipo === "pedido_nuevo") resultado.pedidos++;
      else resultado.cambios++;
    } catch (e) {
      if ((e?.rechazo || e?.code) && !esErrorDeRed(e)) {
        // El servidor contestó que no: queda guardado para revisarlo
        marcarProblema(r.clave, e.message);
        resultado.problemas++;
        continue;
      }
      // Sin señal todavía: se corta y se reintenta después, en el mismo orden
      break;
    }
  }
  resultado.quedan = cantidadPendiente();
  return resultado;
}
