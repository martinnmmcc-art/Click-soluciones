export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

// Cuánto tiene a favor un cliente (lo que pagó de más en pedidos anteriores).
// Lo usa el checkout para ofrecerle descontarlo de la compra.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const telefono = new URL(req.url).searchParams.get("telefono") || "";
  if (telefono.replace(/\D/g, "").length < 8) {
    return Response.json({ saldo: 0 });
  }
  const { data, error } = await supabaseAdmin.rpc("saldo_a_favor", { p_telefono: telefono });
  if (error) return Response.json({ saldo: 0 });
  return Response.json({ saldo: Math.max(0, Number(data || 0)) });
}
