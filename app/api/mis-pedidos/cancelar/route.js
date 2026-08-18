import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Deja el teléfono en su forma "núcleo": solo dígitos, sin el 54 de país
// ni el 9 de celular, para que distintos formatos coincidan igual.
function normalizarTelefono(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return limpio;
}

export async function POST(request) {
  try {
    const { pedido_id, telefono } = await request.json();

    if (!pedido_id || !telefono) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const { data: pedido, error: fetchError } = await supabase
      .from("pedidos")
      .select("id, telefono_cliente, estado")
      .eq("id", pedido_id)
      .maybeSingle();

    if (fetchError || !pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (normalizarTelefono(pedido.telefono_cliente) !== normalizarTelefono(telefono)) {
      return NextResponse.json({ error: "Este pedido no te pertenece" }, { status: 403 });
    }

    if (pedido.estado && pedido.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este pedido ya está en proceso, escribinos por WhatsApp si necesitás cancelarlo." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({ estado: "cancelado" })
      .eq("id", pedido_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
