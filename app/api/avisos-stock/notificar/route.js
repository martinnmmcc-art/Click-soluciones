import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:contacto@bolsonclick.com.ar",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const { producto_id } = await request.json();
    if (!producto_id) {
      return NextResponse.json({ error: "Falta producto_id" }, { status: 400 });
    }

    const { data: producto } = await supabase
      .from("Productos")
      .select("nombre")
      .eq("id", producto_id)
      .maybeSingle();

    const { data: avisos, error } = await supabase
      .from("avisos_stock")
      .select("*")
      .eq("producto_id", producto_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!avisos || avisos.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 });
    }

    const payload = JSON.stringify({
      title: "¡Ya hay stock! 📦",
      body: `${producto?.nombre || "Un producto que buscabas"} ya está disponible en Bolson Click`,
      url: `/producto/${producto_id}`
    });

    let enviados = 0;
    await Promise.all(
      avisos.map(async (aviso) => {
        try {
          await webpush.sendNotification(
            { endpoint: aviso.endpoint, keys: { p256dh: aviso.p256dh, auth: aviso.auth } },
            payload
          );
          enviados++;
        } catch (e) {
          // suscripción vencida, no hacemos nada especial
        }
      })
    );

    // Ya avisamos, limpiamos los pedidos de aviso de este producto
    await supabase.from("avisos_stock").delete().eq("producto_id", producto_id);

    return NextResponse.json({ ok: true, enviados });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
