export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Dice si este celular está realmente registrado en nuestra base.
//
// Que el navegador tenga el permiso no alcanza: si el registro no llegó a
// guardarse, la persona ve "activadas" y no le llega nada. Este chequeo
// detecta justamente ese caso.
export async function POST(request) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return Response.json({ registrada: false });

    const { data } = await supabase
      .from("push_subscriptions")
      .select("telefono, es_admin")
      .eq("endpoint", endpoint)
      .maybeSingle();

    return Response.json({
      registrada: !!data,
      telefono: data?.telefono || null,
      es_admin: !!data?.es_admin
    });
  } catch (err) {
    return Response.json({ registrada: false, error: err.message });
  }
}
