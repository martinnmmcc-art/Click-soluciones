import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const { titulo, mensaje, url } = await request.json();

    if (!titulo || !mensaje) {
      return NextResponse.json({ error: "Falta título o mensaje" }, { status: 400 });
    }

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = JSON.stringify({ title: titulo, body: mensaje, url: url || "/" });

    let enviados = 0;
    let vencidos = 0;

    await Promise.all(
      (subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            payload
          );
          enviados++;
        } catch (err) {
          // 404/410 = la suscripción ya no existe (el usuario desinstaló o bloqueó) -> la borramos
          if (err.statusCode === 404 || err.statusCode === 410) {
            vencidos++;
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      })
    );

    return NextResponse.json({ ok: true, enviados, vencidos, total: subs?.length || 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
