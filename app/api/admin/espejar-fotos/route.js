export const dynamic = "force-dynamic";
// Copiar fotos lleva tiempo: le damos hasta 60 segundos por tanda
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";
import { esAdminRequest } from "@/lib/verificarAdmin";
import { copiarAFotosPropias } from "@/lib/fotosProveedor";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Copia a nuestro servidor una tanda de fotos que todavía se muestran desde
// la página del proveedor. La pantalla la llama varias veces seguidas hasta
// terminar, así cada llamada es corta y no se corta por tiempo.
export async function POST(request) {
  if (!(await esAdminRequest(request, supabaseAdmin))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let productos = 6;
  try {
    const body = await request.json();
    productos = Math.min(Math.max(Number(body?.productos) || 6, 1), 15);
  } catch (e) {}

  const { data: fotos, error } = await supabaseAdmin.rpc("fotos_para_espejar", {
    p_limite: productos
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Agrupamos por producto: una sola actualización por producto
  const porProducto = new Map();
  for (const f of fotos || []) {
    if (!porProducto.has(f.id)) porProducto.set(f.id, []);
    porProducto.get(f.id).push(f);
  }

  let copiadas = 0;
  let fallidas = 0;

  // De a 3 productos en paralelo: rápido, sin saturar a nadie
  const ids = [...porProducto.keys()];
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(
      ids.slice(i, i + 3).map(async (id) => {
        const cambios = {};
        let falloAlguna = false;

        for (const f of porProducto.get(id)) {
          const nueva = await copiarAFotosPropias(supabaseAdmin, f.url, `p${id}-${f.columna}`);
          if (nueva) {
            cambios[f.columna] = nueva;
            copiadas++;
          } else {
            falloAlguna = true;
            fallidas++;
          }
        }

        if (Object.keys(cambios).length > 0) {
          await supabaseAdmin.from("Productos").update(cambios).eq("id", id);
        }

        // Si alguna falló, sumamos un intento: a los 3 se deja de reintentar
        if (falloAlguna) {
          const { data: actual } = await supabaseAdmin
            .from("Productos")
            .select("fotos_espejo_intentos")
            .eq("id", id)
            .single();
          await supabaseAdmin
            .from("Productos")
            .update({ fotos_espejo_intentos: (actual?.fotos_espejo_intentos || 0) + 1 })
            .eq("id", id);
        }
      })
    );
  }

  const { data: resumen } = await supabaseAdmin.rpc("resumen_espejo_fotos");

  return Response.json({
    copiadas,
    fallidas,
    resumen: resumen?.[0] || null
  });
}

// Solo el resumen, para mostrar el avance sin copiar nada
export async function GET(request) {
  if (!(await esAdminRequest(request, supabaseAdmin))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data: resumen } = await supabaseAdmin.rpc("resumen_espejo_fotos");
  return Response.json({ resumen: resumen?.[0] || null });
}
