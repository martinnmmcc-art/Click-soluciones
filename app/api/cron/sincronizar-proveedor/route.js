export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { claveInterna, CABECERA_INTERNA } from "@/lib/claveInterna";

// Sincronización automática con el proveedor.
//
// La llama el programador de tareas de Supabase (pg_cron) cada 10 minutos.
// Una vuelta completa por día: trae los productos nuevos, actualiza los
// precios de los "a pedido" (los tuyos en stock no se tocan) y oculta los
// que el proveedor dio de baja. Son ~61 páginas, así que se hace de a
// tandas: cada llamada procesa unos 45 segundos y guarda por dónde va.
//
// Antes la importación era manual: si no se corría completa, quedaban
// productos sin traer y precios viejos.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HORAS_ENTRE_VUELTAS = 20;
const TIEMPO_MAXIMO_MS = 45000;
// Si una página falla 6 veces seguidas (una hora), se saltea y se sigue.
// Antes un solo producto con un dato raro dejaba la sincronización trabada
// en la misma página para siempre (pasó 3 días en la página 48).
const MAX_REINTENTOS = 6;

function sumar(a = {}, b = {}) {
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number") r[k] = (r[k] || 0) + v;
    else if (v && typeof v === "object") r[k] = sumar(r[k], v);
  }
  return r;
}

export async function POST(request) {
  // Solo el programador de tareas tiene esta clave (guardada en la base,
  // sin acceso desde la app)
  const { data: secreto } = await supabase.from("secretos_internos").select("valor").eq("clave", "cron").single();
  if (!secreto?.valor || request.headers.get("x-cron") !== secreto.valor) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  let { data: s } = await supabase.from("sync_proveedor").select("*").eq("id", 1).single();
  await supabase.from("sync_proveedor").update({ ultima_llamada: new Date().toISOString() }).eq("id", 1);

  // ¿Toca empezar una vuelta nueva?
  if (s.estado !== "en_curso") {
    const horas = s.ciclo_fin ? (Date.now() - new Date(s.ciclo_fin).getTime()) / 36e5 : Infinity;
    if (horas < HORAS_ENTRE_VUELTAS) {
      return Response.json({ ok: true, estado: "reposo", proxima_en_horas: Math.round(HORAS_ENTRE_VUELTAS - horas) });
    }
    const nuevo = {
      estado: "en_curso",
      pagina_actual: 1,
      total_paginas: null,
      ciclo_inicio: new Date().toISOString(),
      contadores: {},
      ultimo_error: null
    };
    await supabase.from("sync_proveedor").update(nuevo).eq("id", 1);
    s = { ...s, ...nuevo };
  }

  const origen = new URL(request.url).origin;
  const clave = await claveInterna();
  let pagina = s.pagina_actual;
  let total = s.total_paginas;
  let contadores = s.contadores || {};
  let error = null;

  // Páginas mientras haya tiempo
  while (Date.now() - inicio < TIEMPO_MAXIMO_MS && (!total || pagina <= total)) {
    try {
      const res = await fetch(`${origen}/api/admin/importar-proveedor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CABECERA_INTERNA]: clave },
        body: JSON.stringify({ pagina, actualizar_precios: true }),
        cache: "no-store"
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || `respuesta ${res.status}`);

      total = r.total_paginas || total;
      contadores = sumar(contadores, {
        importados: r.importados || 0,
        actualizados: r.actualizados || 0,
        protegidos: r.protegidos || 0,
        motivos: r.motivos || {}
      });
      pagina++;
      s.reintentos = 0;
      await supabase
        .from("sync_proveedor")
        .update({ pagina_actual: pagina, total_paginas: total, contadores, ultimo_error: null, reintentos: 0 })
        .eq("id", 1);
    } catch (e) {
      const intentos = (s.reintentos || 0) + 1;
      if (intentos >= MAX_REINTENTOS) {
        // Esta página no hay forma de pasarla: se anota y se sigue con la próxima
        contadores = sumar(contadores, { paginas_salteadas: 1 });
        pagina++;
        s.reintentos = 0;
        await supabase
          .from("sync_proveedor")
          .update({ pagina_actual: pagina, contadores, reintentos: 0, ultimo_error: `Página ${pagina - 1} salteada: ${e.message}` })
          .eq("id", 1);
        continue;
      }
      // Proveedor caído o en mantenimiento: se reintenta en la próxima llamada
      error = e.message;
      await supabase.from("sync_proveedor").update({ ultimo_error: error, reintentos: intentos }).eq("id", 1);
      break;
    }
  }

  // ¿Terminó la vuelta?
  if (!error && total && pagina > total) {
    const { data: fin } = await supabase.rpc("finalizar_ciclo_proveedor", { p_inicio: s.ciclo_inicio });
    const resumen = {
      ...contadores,
      retirados: fin?.[0]?.retirados || 0,
      vistos: fin?.[0]?.vistos || 0,
      paginas: total,
      inicio: s.ciclo_inicio,
      fin: new Date().toISOString()
    };
    await supabase
      .from("sync_proveedor")
      .update({ estado: "reposo", ciclo_fin: resumen.fin, ultimo_resumen: resumen, contadores: {}, pagina_actual: 1 })
      .eq("id", 1);
    return Response.json({ ok: true, estado: "vuelta_completa", resumen });
  }

  return Response.json({ ok: !error, estado: "en_curso", pagina, total_paginas: total, error });
}
