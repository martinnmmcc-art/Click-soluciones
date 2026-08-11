import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

export async function POST(request) {
  try {
    const { telefono, email } = await request.json();

    if (!telefono || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Faltan datos o el correo no es válido" }, { status: 400 });
    }

    const codigo = generarCodigo();
    const expira_en = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    const { error: insertError } = await supabase.from("verificaciones_email").insert({
      telefono,
      email,
      codigo,
      expira_en
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Bolson Click <verificacion@bolsonclick.com.ar>",
        to: [email],
        subject: `Tu código de verificación: ${codigo}`,
        html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto">
          <h2 style="color:#1560D4">Bolson Click</h2>
          <p>Tu código para confirmar tu registro es:</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1560D4">${codigo}</p>
          <p style="color:#888;font-size:13px">Vence en 10 minutos. Si no pediste este código, ignorá este mensaje.</p>
        </div>`
      })
    });

    if (!resendRes.ok) {
      const detalle = await resendRes.text();
      return NextResponse.json({ error: `No se pudo enviar el correo: ${detalle}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
