export const dynamic = "force-dynamic";
// Leer fotos + buscar en Google puede tardar: hasta 60 segundos
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { completarConIA } from "@/lib/completarIA";

// Borrador de descripción y características hecho por IA (ver lib/completarIA.js).
// Protegida por middleware.js como todo /api/admin: solo administradores.
//
// Recibe { id } de un producto guardado, y opcionalmente lo que el admin tiene
// escrito en el formulario (nombre, fotos...) para usar lo más nuevo aunque
// todavía no lo haya guardado.

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CAMPOS =
  "id, nombre, descripcion, categoria, nombre_proveedor, descripcion_proveedor, imagen_url, imagen_url_2, imagen_url_3, imagen_url_4, imagen_url_5, imagen_url_6";
const DEL_FORMULARIO = ["nombre", "descripcion", "categoria", "imagen_url", "imagen_url_2", "imagen_url_3"];

export async function POST(request) {
  let cuerpo = {};
  try {
    cuerpo = await request.json();
  } catch (e) {}

  let producto = {};
  if (cuerpo.id) {
    const { data, error } = await supabaseAdmin.from("Productos").select(CAMPOS).eq("id", cuerpo.id).maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    if (!data) return Response.json({ error: "No existe ese producto" }, { status: 404 });
    producto = data;
  }
  // Lo escrito en el formulario manda (puede ser más nuevo que lo guardado)
  const form = cuerpo.form || {};
  for (const c of DEL_FORMULARIO) {
    if (typeof form[c] === "string" && form[c].trim()) producto[c] = form[c].trim();
  }

  if (!producto.nombre && !producto.imagen_url) {
    return Response.json({ error: "Cargá al menos el nombre o una foto del producto." }, { status: 400 });
  }

  try {
    const borrador = await completarConIA(producto, {
      clave: process.env.GEMINI_API_KEY,
      modelo: process.env.GEMINI_MODEL
    });
    return Response.json({ borrador });
  } catch (e) {
    const estado = e.codigo === "SIN_CLAVE" ? 503 : e.codigo === "LIMITE" ? 429 : 502;
    return Response.json({ error: e.message, codigo: e.codigo || null }, { status: estado });
  }
}
