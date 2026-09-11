import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Clave de servidor: guardar una suscripción es una operación de sistema.
// Con la clave pública el upsert fallaba en silencio cuando el registro ya
// existía, porque la tabla solo permite insertar, no actualizar.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription, telefono } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }

    const { data, error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        telefono: telefono || null
      },
      { onConflict: "endpoint" }
    ).select("telefono, es_admin").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Devolvemos si quedó como admin, para poder confirmarlo en pantalla
    return NextResponse.json({
      ok: true,
      telefono: data?.telefono || null,
      es_admin: !!data?.es_admin
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
