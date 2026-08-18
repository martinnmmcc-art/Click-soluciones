import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usa la service role key porque la columna "codigo" está protegida:
// nadie puede leerla desde el navegador (para que no se puedan robar los
// códigos de verificación de otros). La comparación se hace acá, en el servidor.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { telefono, email, codigo } = await request.json();

    if (!telefono || !email || !codigo) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("verificaciones_email")
      .select("*")
      .eq("telefono", telefono)
      .eq("email", email)
      .eq("codigo", codigo.trim())
      .eq("verificado", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    if (new Date(data.expira_en) < new Date()) {
      return NextResponse.json({ error: "El código venció, pedí uno nuevo" }, { status: 400 });
    }

    await supabase.from("verificaciones_email").update({ verificado: true }).eq("id", data.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
