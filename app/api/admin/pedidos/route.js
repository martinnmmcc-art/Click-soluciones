export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select(`*, items_pedido (*)`)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedidos: data });
}

export async function PATCH(req) {
  const body = await req.json();
  const { id, estado, estado_pago } = body;

  if (!id) {
    return Response.json({ error: "Falta el id del pedido" }, { status: 400 });
  }

  const campos = {};
  if (estado !== undefined) campos.estado = estado;
  if (estado_pago !== undefined) campos.estado_pago = estado_pago;

  if (Object.keys(campos).length === 0) {
    return Response.json({ error: "No se envió ningún campo para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .update(campos)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedido: data });
}
