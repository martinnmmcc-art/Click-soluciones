export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero");

  if (!numero) {
    return Response.json({ error: "Falta el número de pedido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("*")
    .eq("numero_pedido", numero)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ pedido: data });
}
