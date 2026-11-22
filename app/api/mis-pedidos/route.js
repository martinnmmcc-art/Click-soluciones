export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Deja el teléfono en su forma "núcleo": solo dígitos, sin el 54 de país
// ni el 9 de celular. Así "2944396888", "+542944396888" y "54 9 2944 396888"
// terminan siendo el mismo número y el cliente ve sus pedidos igual.
function normalizarTelefono(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return limpio;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const telefono = searchParams.get("telefono");

  if (!telefono) {
    return Response.json({ error: "Falta el teléfono" }, { status: 400 });
  }

  const telefonoNormalizado = normalizarTelefono(telefono);

  if (!telefonoNormalizado) {
    return Response.json({ pedidos: [] });
  }

  // Solo con la sesión verificada de ESE celular (ver lib/sesionCliente.js).
  // Antes alcanzaba con saber el número para ver pedidos, direcciones y
  // comprobantes de cualquier persona.
  const sesion = searchParams.get("sesion");
  const { data: valida } = await supabaseAdmin.rpc("sesion_cliente_valida", {
    p_token: /^[0-9a-f-]{36}$/i.test(sesion || "") ? sesion : null,
    p_telefono: telefonoNormalizado
  });
  if (!valida) {
    return Response.json({ error: "SIN_SESION", pedidos: [] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  // Traemos los pedidos cuyo teléfono TERMINE con el número núcleo, para que
  // coincida sin importar cómo se haya guardado el prefijo en cada caso.
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select(`*, items_pedido (*)`)
    .like("telefono_cliente", `%${telefonoNormalizado}`)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // Segundo filtro en el servidor: confirmamos que el núcleo sea idéntico,
  // para no devolver por error el pedido de otra persona con un final parecido.
  const pedidos = (data || []).filter(
    (p) => normalizarTelefono(p.telefono_cliente) === telefonoNormalizado
  );

  return Response.json(
    { pedidos },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
