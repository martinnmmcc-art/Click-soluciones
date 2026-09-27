import { NextResponse } from "next/server";
import { claveInterna, CABECERA_INTERNA } from "@/lib/claveInterna";

// Guardia de las rutas de administración.
//
// Antes, cualquiera que conociera la dirección de una ruta del panel (por
// ejemplo /api/admin/pedidos) podía leer todos los pedidos con nombres,
// teléfonos y direcciones de los clientes, o mandar notificaciones a todos.
//
// Ahora cada pedido a estas rutas tiene que traer:
//  - la sesión de un administrador (la manda la app sola), o
//  - la clave interna, si la llamada la hace el propio servidor.
// Si no, se rechaza antes de llegar a la ruta.
//
// Estar acá, en un solo lugar, garantiza que ninguna ruta del panel quede
// abierta por olvido: cualquier ruta nueva bajo /api/admin nace protegida.

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/api/avisar-cupon",
    "/api/avisar-push",
    "/api/avisar-cliente",
    "/api/avisos-stock/notificar",
    "/api/push/enviar",
    "/api/resolver-video",
    "/api/verificacion/:path*"
  ]
};

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Recordamos por un minuto qué sesiones ya verificamos, para no consultar
// a Supabase en cada clic del panel.
const verificadas = new Map();
const UN_MINUTO = 60 * 1000;

function rechazar(estado, motivo) {
  return NextResponse.json({ error: motivo }, { status: estado });
}

async function esAdministrador(token) {
  const guardada = verificadas.get(token);
  if (guardada && guardada.vence > Date.now()) return guardada.ok;

  let ok = false;
  try {
    // 1. ¿De quién es esta sesión?
    const resUsuario = await fetch(`${URL_SUPABASE}/auth/v1/user`, {
      headers: { apikey: CLAVE_ANON, Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (resUsuario.ok) {
      const usuario = await resUsuario.json();
      const email = String(usuario?.email || "").toLowerCase();

      // 2. ¿Ese correo es de un administrador?
      if (email) {
        const resAdmin = await fetch(
          `${URL_SUPABASE}/rest/v1/administradores?select=email&email=eq.${encodeURIComponent(email)}`,
          {
            headers: { apikey: CLAVE_SERVICIO, Authorization: `Bearer ${CLAVE_SERVICIO}` },
            cache: "no-store"
          }
        );
        if (resAdmin.ok) {
          const filas = await resAdmin.json();
          ok = Array.isArray(filas) && filas.length > 0;
        }
      }
    }
  } catch (e) {
    ok = false;
  }

  verificadas.set(token, { ok, vence: Date.now() + UN_MINUTO });
  if (verificadas.size > 500) verificadas.clear();
  return ok;
}

export async function middleware(request) {
  // Llamadas del propio servidor
  const interna = request.headers.get(CABECERA_INTERNA);
  if (interna) {
    const esperada = await claveInterna();
    if (esperada && interna === esperada) return NextResponse.next();
    return rechazar(401, "Clave interna inválida");
  }

  // Llamadas desde el panel
  const cabecera = request.headers.get("authorization") || "";
  const token = cabecera.replace(/^Bearer\s+/i, "").trim();

  if (!token) return rechazar(401, "Necesitás iniciar sesión como administrador");
  if (!(await esAdministrador(token))) return rechazar(403, "Esta cuenta no es de administrador");

  return NextResponse.next();
}
