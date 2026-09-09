export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cuenta cuántas veces entró alguien que todavía no se registró.
//
// La IP la lee el servidor, así que no se puede falsear desde el navegador
// ni se evita entrando en incógnito. Combinada con una huella del
// dispositivo, distingue razonablemente entre visitantes distintos que
// comparten la misma conexión.
export async function POST(request) {
  try {
    const { huella } = await request.json().catch(() => ({}));

    // Vercel pone la IP real del visitante en estas cabeceras
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "desconocida";

    if (ip === "desconocida") {
      // Sin IP no podemos contar: dejamos pasar en vez de trabar a alguien
      return Response.json({ visitas: 1, exigir_registro: false });
    }

    const { data, error } = await supabase.rpc("registrar_visita", {
      p_ip: ip,
      p_huella: huella || null
    });

    if (error) {
      return Response.json({ visitas: 1, exigir_registro: false });
    }

    const r = data?.[0];
    return Response.json({
      visitas: r?.visitas || 1,
      exigir_registro: !!r?.exigir_registro
    });
  } catch (err) {
    // Ante cualquier problema dejamos pasar: es peor trabar a un cliente
    // real que dejar mirar de más a un curioso.
    return Response.json({ visitas: 1, exigir_registro: false });
  }
}
