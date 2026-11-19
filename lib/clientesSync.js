// Clientes guardados en la base del celular, que se actualizan bajando SOLO
// lo que cambió (registros nuevos, datos corregidos, cuentas borradas).
//
// La marca de "hasta dónde llegué" sale de las fechas de la propia base
// (no del reloj del celular, que puede estar mal): el cambio más nuevo que
// llegó. La próxima vez se pide lo posterior a eso.

import { supabase } from "@/lib/supabaseClient";
import { todos, aplicarCambios, leerMeta, guardarMeta } from "@/lib/baseLocal";
import { guardarLocal } from "@/lib/almacenLocal";

const META = "clientes";
const HORAS_REVISION_COMPLETA = 24;
const CAMPOS = "id, nombre, telefono, localidad, direccion, email, cambiado_en";
// La caja (etapa 2) todavía lee esta copia del almacenamiento chico
const CLAVE_CAJA = "bolsonclick_clientes_offline";

function ordenar(lista) {
  return lista.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
}

function masNuevo(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

export async function clientesGuardados() {
  try {
    return ordenar(await todos("clientes"));
  } catch (e) {
    return [];
  }
}

let enCurso = null;

// Devuelve { clientes, copiaDe }
export function sincronizarClientes({ completo = false } = {}) {
  if (!enCurso) {
    enCurso = sincronizar({ completo }).finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function sincronizar({ completo }) {
  let meta = null;
  let locales = [];
  try {
    meta = await leerMeta(META);
    locales = await todos("clientes");
  } catch (e) {}

  const horas = meta?.completoEn ? (Date.now() - new Date(meta.completoEn).getTime()) / 3600000 : Infinity;
  const pedirTodo = completo || !meta?.hasta || locales.length === 0 || horas >= HORAS_REVISION_COMPLETA;
  const fechaLocal = meta?.actualizadoEn ? new Date(meta.actualizadoEn) : null;
  const ahora = new Date().toISOString();

  try {
    if (pedirTodo) {
      const { data, error } = await supabase.from("clientes").select(CAMPOS).order("nombre", { ascending: true });
      if (error || !data) throw error || new Error("sin datos");
      const hasta = data.reduce((m, c) => masNuevo(m, c.cambiado_en), null);
      // Lo último borrado hasta ahora: los borrados anteriores ya no importan
      const { data: ult } = await supabase
        .from("registros_borrados")
        .select("borrado_en")
        .eq("tabla", "clientes")
        .order("borrado_en", { ascending: false })
        .limit(1);
      try {
        await aplicarCambios("clientes", { poner: data, reemplazarTodo: true });
        await guardarMeta(META, {
          hasta,
          hastaBorrados: ult?.[0]?.borrado_en || ahora,
          completoEn: ahora,
          actualizadoEn: ahora
        });
      } catch (e) {}
      guardarLocal(CLAVE_CAJA, data);
      return { clientes: ordenar([...data]), copiaDe: null };
    }

    // Solo los cambios
    const [cambios, borr] = await Promise.all([
      supabase.from("clientes").select(CAMPOS).gt("cambiado_en", meta.hasta),
      supabase
        .from("registros_borrados")
        .select("registro_id, borrado_en")
        .eq("tabla", "clientes")
        .gt("borrado_en", meta.hastaBorrados || meta.hasta)
    ]);
    if (cambios.error || borr.error) throw cambios.error || borr.error;
    // La copia de un service worker trae "Sin señal" como error: ya cortó arriba
    const nuevos = cambios.data || [];
    const borrados = (borr.data || []).map((b) => b.registro_id);

    const mapa = new Map(locales.map((c) => [c.id, c]));
    nuevos.forEach((c) => mapa.set(c.id, c));
    borrados.forEach((id) => mapa.delete(id));
    const clientes = ordenar(Array.from(mapa.values()));

    try {
      await aplicarCambios("clientes", { poner: nuevos, borrar: borrados });
      await guardarMeta(META, {
        ...meta,
        hasta: nuevos.reduce((m, c) => masNuevo(m, c.cambiado_en), meta.hasta),
        hastaBorrados: (borr.data || []).reduce((m, b) => masNuevo(m, b.borrado_en), meta.hastaBorrados),
        actualizadoEn: ahora
      });
    } catch (e) {}
    if (nuevos.length || borrados.length) guardarLocal(CLAVE_CAJA, clientes);
    return { clientes, copiaDe: null };
  } catch (e) {
    if (locales.length > 0) return { clientes: ordenar(locales), copiaDe: fechaLocal };
    throw e;
  }
}
