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
const CAMPOS =
  "id, nombre, descripcion, categoria, nombre_proveedor, descripcion_proveedor, caracteristicas, accesorios, imagen_url, imagen_url_2, imagen_url_3, imagen_url_4, imagen_url_5, imagen_url_6";

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
  const borrador = await completarConIA(p, {
    clave: process.env.GEMINI_API_KEY,
    modelo: process.env.GEMINI_MODEL
  });

  const cambios = { ficha_ia: borrador, ficha_ia_en: new Date().toISOString() };
  const car = lineasSeguras(borrador.caracteristicas);
  const inc = lineasSeguras(borrador.incluye);
  if (car && !String(p.caracteristicas || "").trim()) cambios.caracteristicas = car;
  if (inc && !String(p.accesorios || "").trim()) cambios.accesorios = inc;

  const { error } = await supabase.from("Productos").update(cambios).eq("id", p.id);
  if (error) throw new Error(error.message);
  return {
    id: p.id,
    caracteristicas: !!cambios.caracteristicas,
    incluye: !!cambios.accesorios,
    dudosos: [...borrador.caracteristicas, ...borrador.incluye].filter((x) => !x.seguro).length
  };
}

async function correr() {
  const inicio = Date.now();
  const hechos = [];
  while (Date.now() - inicio < LIMITE_MS - 20000) {
    const p = await siguiente();
    if (!p) return { listo: true, hechos };
    try {
      hechos.push(await procesar(p));
    } catch (e) {
      if (e.codigo === "LIMITE") return { listo: false, frenado: "limite", hechos };
      if (e.codigo === "SIN_CLAVE") return { listo: false, frenado: "sin_clave", hechos };
      // Otro error con este producto: se anota y se pasa al siguiente
      await supabase
        .from("Productos")
        .update({ ficha_ia: { error: String(e.message).slice(0, 300) }, ficha_ia_en: new Date().toISOString() })
        .eq("id", p.id);
      hechos.push({ id: p.id, error: String(e.message).slice(0, 120) });
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

export const GET = POST;
