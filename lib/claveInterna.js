// Clave para las llamadas que el servidor se hace a sí mismo (por ejemplo,
// cuando el panel cambia el estado de un pedido y el servidor avisa al
// cliente). Esas llamadas no tienen una sesión de administrador detrás, así
// que se identifican con esta clave.
//
// Se deriva de la clave de servicio de Supabase con un resumen criptográfico:
// nunca viaja la clave original, y solo el servidor puede calcularla.
// Funciona tanto en el middleware (Edge) como en las rutas (Node).

let cache = null;

export async function claveInterna() {
  if (cache) return cache;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) return null;

  const datos = new TextEncoder().encode(`bolsonclick-interno:${base}`);
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  cache = Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return cache;
}

export const CABECERA_INTERNA = "x-clave-interna";
