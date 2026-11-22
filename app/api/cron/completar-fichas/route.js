export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { esAdminRequest } from "@/lib/verificarAdmin";
import { completarConIA, lineasSeguras } from "@/lib/completarIA";

// Completa SOLA la ficha técnica de los productos propios, de a uno.
//
// La llama la base de datos cada pocos minutos (pg_cron, con la clave
// "x-cron"). En cada vuelta toma el próximo producto que la IA todavía no
// revisó y:
//  - Llena "Características principales" y "¿Qué incluye la caja?" SOLO con
//    los datos marcados como seguros (leídos en la caja o dichos por el
//    proveedor). Lo dudoso NO se publica: queda guardado en ficha_ia para
//    revisarlo con el botón del formulario si querés.
//  - Solo escribe en campos VACÍOS: lo que cargaste vos nunca se pisa.
//  - La descripción no la toca.
// Si se termina el uso gratis de Gemini, frena y sigue en la próxima vuelta.
// Los productos nuevos (por ejemplo al recibir un pedido) entran solos,
// porque nacen sin revisar.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIMITE_MS = 40000;
// Si un producto falla por tiempo o por un error pasajero de Google, se
// reintenta en las próximas vueltas (sin búsqueda, que es lo más lento).
// Recién al tercer intento se da por perdido.
const MAX_INTENTOS = 3;
const CAMPOS =
  "id, nombre, descripcion, categoria, nombre_proveedor, descripcion_proveedor, caracteristicas, accesorios, imagen_url, imagen_url_2, imagen_url_3, imagen_url_4, imagen_url_5, imagen_url_6, ficha_ia";

async function autorizado(request) {
  const clave = request.headers.get("x-cron");
  if (clave) {
    const { data } = await supabase.from("secretos_internos").select("valor").eq("clave", "cron").single();
    if (data?.valor && clave === data.valor) return true;
  }
  return esAdminRequest(request, supabase);
}

async function siguiente() {
  // Primero lo que tenés en stock (es lo que más se mira), después el resto propio
  const { data, error } = await supabase
    .from("Productos")
    .select(CAMPOS)
    .eq("activo", true)
    .or("bajo_pedido.is.null,bajo_pedido.eq.false")
    .is("ficha_ia_en", null)
    .not("imagen_url", "is", null)
    .order("stock", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

async function procesar(p) {
  const intentos = Number(p.ficha_ia?.intentos) || 0;
  const borrador = await completarConIA(p, {
    clave: process.env.GEMINI_API_KEY,
    modelo: process.env.GEMINI_MODEL,
    // Un solo pedido a Gemini por vuelta para no pasarse del minuto:
    // la primera vez prueba con búsqueda, si falló, sin búsqueda
    buscar: intentos === 0,
    espera: 42000
  });

  const cambios = { ficha_ia: borrador, ficha_ia_en: new Date().toISOString() };
  // Si la IA marcó alguna duda (por ejemplo, la foto no coincide con el
  // nombre), no se publica nada de este producto: queda para revisarlo a mano
  // con el botón "Completar con IA" de la ficha.
  const conDudas = (borrador.advertencias || []).length > 0 || borrador.mismoProducto === false;
  const car = conDudas ? "" : lineasSeguras(borrador.caracteristicas);
  const inc = conDudas ? "" : lineasSeguras(borrador.incluye);
  if (car && !String(p.caracteristicas || "").trim()) cambios.caracteristicas = car;
  if (inc && !String(p.accesorios || "").trim()) cambios.accesorios = inc;

  const { error } = await supabase.from("Productos").update(cambios).eq("id", p.id);
  if (error) throw new Error(error.message);
  return {
    id: p.id,
    caracteristicas: !!cambios.caracteristicas,
    incluye: !!cambios.accesorios,
    dudosos: [...borrador.caracteristicas, ...borrador.incluye].filter((x) => !x.seguro).length,
    paraRevisar: conDudas
  };
}

async function correr() {
  const inicio = Date.now();
  const hechos = [];
  // Un producto por vuelta: cada vuelta tiene un minuto como máximo
  while (hechos.length === 0 && Date.now() - inicio < LIMITE_MS) {
    const p = await siguiente();
    if (!p) return { listo: true, hechos };
    try {
      hechos.push(await procesar(p));
    } catch (e) {
      if (e.codigo === "LIMITE") return { listo: false, frenado: "limite", hechos };
      if (e.codigo === "SIN_CLAVE") return { listo: false, frenado: "sin_clave", hechos };
      // Error con este producto: se anota el intento. Hasta el tercero
      // vuelve a la cola; después se da por perdido y se pasa al siguiente.
      const intentos = (Number(p.ficha_ia?.intentos) || 0) + 1;
      const cambios = { ficha_ia: { error: String(e.message).slice(0, 300), intentos } };
      if (intentos >= MAX_INTENTOS) cambios.ficha_ia_en = new Date().toISOString();
      await supabase.from("Productos").update(cambios).eq("id", p.id);
      hechos.push({ id: p.id, error: String(e.message).slice(0, 120), intentos });
    }
  }
  return { listo: false, hechos };
}

export async function POST(request) {
  if (!(await autorizado(request))) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    return Response.json(await correr());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Diagnóstico (?diag=1): qué modelos de Gemini responde la clave y cuánto
// tardan, con un pedido mínimo de texto. No muestra la clave.
async function diagnostico() {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) return { error: "sin clave" };
  const base = "https://generativelanguage.googleapis.com/v1beta/models";
  const salida = { modeloConfigurado: process.env.GEMINI_MODEL || null, pruebas: [] };
  try {
    const t = Date.now();
    const r = await fetch(`${base}?pageSize=200`, { headers: { "x-goog-api-key": clave }, signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => ({}));
    salida.lista = {
      estado: r.status,
      ms: Date.now() - t,
      flash: (d.models || []).map((m) => m.name.replace("models/", "")).filter((n) => /flash/.test(n)).slice(0, 30),
      error: d.error?.message?.slice(0, 200) || null
    };
  } catch (e) {
    salida.lista = { error: e.message };
  }
  for (const m of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"]) {
    const t = Date.now();
    try {
      const r = await fetch(`${base}/${m}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Respondé solo: ok" }] }] }),
        signal: AbortSignal.timeout(12000)
      });
      const d = await r.json().catch(() => ({}));
      salida.pruebas.push({ modelo: m, estado: r.status, ms: Date.now() - t, error: d.error?.message?.slice(0, 160) || null });
    } catch (e) {
      salida.pruebas.push({ modelo: m, ms: Date.now() - t, error: e.message });
    }
  }
  return salida;
}

export async function GET(request) {
  if (new URL(request.url).searchParams.get("diag") === "1") {
    if (!(await autorizado(request))) return Response.json({ error: "No autorizado" }, { status: 401 });
    return Response.json(await diagnostico());
  }
  return POST(request);
}
