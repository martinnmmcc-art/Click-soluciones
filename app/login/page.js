import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

    if (pedido.telefono_cliente !== telefono) {
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
