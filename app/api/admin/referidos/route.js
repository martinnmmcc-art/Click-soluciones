export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data: clientes, error } = await supabaseAdmin
      .from("clientes")
      .select("id, nombre, telefono, referido_por, created_at");

    if (error) throw new Error(error.message);

    const porTelefono = {};
    (clientes || []).forEach((c) => {
      porTelefono[c.telefono] = c;
    });

    const referidos = (clientes || [])
      .filter((c) => c.referido_por)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        created_at: c.created_at,
        referente: porTelefono[c.referido_por]
          ? { nombre: porTelefono[c.referido_por].nombre, telefono: c.referido_por }
          : { nombre: null, telefono: c.referido_por }
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const conteoPorReferente = {};
    referidos.forEach((r) => {
      const key = r.referente.telefono;
      if (!conteoPorReferente[key]) {
        conteoPorReferente[key] = { telefono: key, nombre: r.referente.nombre, cantidad: 0 };
      }
      conteoPorReferente[key].cantidad++;
    });

    const ranking = Object.values(conteoPorReferente).sort((a, b) => b.cantidad - a.cantidad);

    return Response.json({ referidos, ranking, total: referidos.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
