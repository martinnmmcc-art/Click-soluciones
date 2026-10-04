"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rutas públicas: no se valida sesión acá.
    // /login: la propia pantalla de login.
    // /catalogo-compartir: el catálogo que se comparte por WhatsApp, debe verse sin registrarse.
    if (pathname.startsWith("/login") || pathname.startsWith("/catalogo-compartir")) return;

    // Verificación instantánea de sesión local (Cliente o Admin)
    const sesionCliente = typeof window !== "undefined"
      ? (localStorage.getItem("clic_soluciones_user") || localStorage.getItem("cliente_sesion"))
      : null;
    const hasSupabaseToken = typeof window !== "undefined" && Object.keys(localStorage).some(key => key.includes("auth-token"));

    if (sesionCliente || hasSupabaseToken) {
      return; // Hay sesión local válida, pasamos libremente sin bloquear
    }

    // Sin señal no se puede verificar nada, y mandar a "Iniciar sesión" no
    // sirve (tampoco se podría iniciar): se deja mirar lo guardado.
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // Verificación de respaldo en segundo plano. Con poca señal la consulta
    // puede tardar o fallar: solo se redirige si contestó, y rápido.
    let vigente = true;
    const limite = setTimeout(() => {
      vigente = false;
    }, 4000);
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!vigente || error || !navigator.onLine) return;
        if (!session) {
          router.replace("/login");
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(limite));
  }, [pathname, router]);

  // Renderizado inmediato: Cero pantallas de carga bloqueantes ("Verificando acceso...")
  return <>{children}</>;
}
